import {
  googleSubFromIdentities,
  isPureGoogleCognitoUser,
  parseIdentitiesClaim,
} from '@echotype/shared';
import {
  adminCreateNativeUser,
  adminDeleteCognitoUser,
  adminGetUserPasswordFacts,
  adminLinkGoogleToNativeUser,
  adminListUsersByEmail,
  adminSetPermanentUserPassword,
  type CreatedNativeUser,
} from './cognitoAdmin.js';
import { loadCognitoConfig } from './cognitoConfig.js';
import { captureApiException } from '../sentry.js';
import { prisma } from '../prisma.js';

export type GooglePasswordSetupDeps = {
  adminGetUserPasswordFacts: typeof adminGetUserPasswordFacts;
  adminListUsersByEmail: typeof adminListUsersByEmail;
  adminCreateNativeUser: typeof adminCreateNativeUser;
  adminSetPermanentUserPassword: typeof adminSetPermanentUserPassword;
  adminDeleteCognitoUser: typeof adminDeleteCognitoUser;
  adminLinkGoogleToNativeUser: typeof adminLinkGoogleToNativeUser;
  findUserById: (id: string) => Promise<{ email: string; name: string } | null>;
  /** users.id PK move; every userId FK is ON UPDATE CASCADE (init migration). */
  migrateUserId: (oldId: string, newId: string) => Promise<void>;
  reportError: (error: unknown) => void;
};

export const defaultGooglePasswordSetupDeps: GooglePasswordSetupDeps = {
  adminGetUserPasswordFacts,
  adminListUsersByEmail,
  adminCreateNativeUser,
  adminSetPermanentUserPassword,
  adminDeleteCognitoUser,
  adminLinkGoogleToNativeUser,
  findUserById: async (id) => {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { email: true, name: true },
    });
    return user;
  },
  migrateUserId: async (oldId, newId) => {
    await prisma.user.update({ where: { id: oldId }, data: { id: newId } });
  },
  reportError: captureApiException,
};

export type SetupLogger = {
  error: (obj: Record<string, unknown>, msg: string) => void;
};

const noopLogger: SetupLogger = { error: () => {} };

export type GooglePasswordSetupResult =
  | { kind: 'converted' }
  /** Not a Google-only federated user (password already exists, or already native). */
  | { kind: 'not_eligible' };

/**
 * Give a Google-only user an email + password sign-in.
 *
 * Setting a password directly on the federated Google_* profile is not enough:
 * in this email-as-username pool, sign-in by email never resolves to a
 * federated-origin username, even when CONFIRMED with a verified email
 * (validated against the live pool). Per AWS guidance the user must own a
 * NATIVE profile, so this converts them — create-first so every failure leaves
 * the account usable:
 *
 *   1. create the native twin (new sub; email pre-verified, nickname kept).
 *      Resume: if a native user with this email already exists it is a leftover
 *      from an interrupted conversion (PreSignUp + L2 guarantee no other
 *      coexistence shape), so reuse it instead of creating.
 *      Requires the PreSignUp lambda to allow AdminCreateUser when all existing
 *      email holders are Google_* federated profiles.
 *   2. AdminSetUserPassword permanent -> CONFIRMED
 *   3. move the Postgres users.id from the old federated sub to the new native
 *      sub (FKs cascade, courses/history preserved). On failure: compensate by
 *      deleting the native twin so email sign-in cannot race ensureUser into
 *      the unique-email conflict; the old federated account stays fully intact.
 *   4. best-effort: delete the orphan Google_* user
 *   5. best-effort: AdminLink the Google identity to the native user
 *
 * Steps 4-5 failing never fails the request: email + password sign-in already
 * works, and the next Google sign-in self-heals through the standard L2 link
 * flow (Postgres row email matches a live native Cognito user).
 *
 * The caller's session tokens belong to the orphan; after a success response
 * the client must log out immediately (the Postgres row moved to the new sub).
 */
export async function setPasswordForGoogleOnlyUser(
  input: {
    /** Postgres users.id == federated Cognito sub. */
    userId: string;
    /** Pool username from the access token (Google_<googleSub>). */
    cognitoUsername: string;
    newPassword: string;
  },
  deps: GooglePasswordSetupDeps = defaultGooglePasswordSetupDeps,
  log: SetupLogger = noopLogger,
): Promise<GooglePasswordSetupResult> {
  const { userPoolId } = loadCognitoConfig();

  const facts = await deps.adminGetUserPasswordFacts({
    userPoolId,
    username: input.cognitoUsername,
  });
  if (!isPureGoogleCognitoUser(facts.userStatus, facts.identitiesRaw)) {
    return { kind: 'not_eligible' };
  }

  const googleSub =
    googleSubFromIdentities(parseIdentitiesClaim(facts.identitiesRaw)) ??
    (input.cognitoUsername.startsWith('Google_')
      ? input.cognitoUsername.slice('Google_'.length)
      : null);
  if (!googleSub) {
    throw new Error('google_sub_missing');
  }

  const user = await deps.findUserById(input.userId);
  if (!user) {
    throw new Error('postgres_user_missing');
  }

  // Step 1 — native twin (resume a leftover from an interrupted conversion if present).
  const native = await findResumableNativeUser(user.email, deps, userPoolId);
  const created: CreatedNativeUser =
    native ??
    (await deps.adminCreateNativeUser({
      userPoolId,
      email: user.email,
      name: user.name,
    }));

  // Step 2 — permanent password (FORCE_CHANGE_PASSWORD/CONFIRMED -> CONFIRMED).
  await deps.adminSetPermanentUserPassword({
    userPoolId,
    username: created.username,
    password: input.newPassword,
  });

  // Step 3 — move the Postgres identity. This is the commit point.
  try {
    await deps.migrateUserId(input.userId, created.sub);
  } catch (migrateErr) {
    log.error(
      { err: migrateErr, oldSub: input.userId, nativeSub: created.sub },
      'set-password: postgres id migration failed; compensating by deleting native twin',
    );
    deps.reportError(migrateErr);
    try {
      await deps.adminDeleteCognitoUser({ userPoolId, username: created.username });
    } catch (compensateErr) {
      // Double failure: passworded native twin + orphan coexist while Postgres
      // still points at the orphan sub. Google sign-in keeps working; email
      // sign-in hits the unique-email conflict. Needs manual cleanup.
      log.error(
        { err: compensateErr, nativeSub: created.sub },
        'set-password: compensation delete failed; manual cleanup required',
      );
      deps.reportError(compensateErr);
    }
    throw migrateErr;
  }

  // Steps 4-5 — best-effort cleanup + link. Email sign-in already works; a
  // failure here is recovered by the L2 link flow on the next Google sign-in.
  try {
    await deps.adminDeleteCognitoUser({ userPoolId, username: input.cognitoUsername });
    await deps.adminLinkGoogleToNativeUser({
      userPoolId,
      nativeUsername: created.username,
      googleSub,
    });
  } catch (cleanupErr) {
    log.error(
      { err: cleanupErr, orphanUsername: input.cognitoUsername, nativeSub: created.sub },
      'set-password: orphan cleanup/link failed; next Google sign-in self-heals via L2',
    );
    deps.reportError(cleanupErr);
  }

  return { kind: 'converted' };
}

/**
 * PreSignUp + L2 linking guarantee a native user never legitimately shares an
 * email with a live Google_* orphan, so any native match here is a half-built
 * twin from a previous conversion attempt (or an interrupted L2 state that this
 * conversion repairs). Reusing it makes retries idempotent.
 */
async function findResumableNativeUser(
  email: string,
  deps: GooglePasswordSetupDeps,
  userPoolId: string,
): Promise<CreatedNativeUser | null> {
  const users = await deps.adminListUsersByEmail({ userPoolId, email });
  const nativeUser = users.find((u) => !u.username.startsWith('Google_'));
  if (!nativeUser) return null;
  if (!nativeUser.sub) {
    throw new Error('native_twin_sub_missing');
  }
  return { username: nativeUser.username, sub: nativeUser.sub };
}
