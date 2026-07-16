import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { claimsFromFederatedTokens } from '../auth/cognitoUserProfile.js';
import {
  adminGetNativeUserProfile,
  type CognitoNativeUserProfile,
} from '../auth/cognitoAdmin.js';
import { loadCognitoConfig } from '../auth/cognitoConfig.js';
import { ensureUser, resolveUserProfile } from '../auth/ensureUser.js';
import {
  linkGoogleFederatedUser,
  type FederatedLinkOutcome,
} from '../auth/federatedLink.js';
import { syncNativeLinkedAttributes } from '../auth/federatedSync.js';
import { prisma } from '../prisma.js';
import { verifyAccessToken } from '../auth/verifyAccessToken.js';
import { verifyIdToken } from '../auth/verifyIdToken.js';
import { parseFederatedTokenClaims } from '@echotype/shared';

const LinkBody = z.object({
  idToken: z.string().min(1),
});

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  return token || null;
}

type LinkedNativeUser = { id: string; name: string };

export type LinkedNativeAccountDeps = {
  findUserByEmail: (email: string) => Promise<LinkedNativeUser | null>;
  getNativeProfile: (nativeUsername: string) => Promise<CognitoNativeUserProfile>;
  upsertUserByEmail: (profile: {
    id: string;
    email: string;
    name: string;
  }) => Promise<LinkedNativeUser>;
  syncNativeAttributes: (nativeUsername: string, name: string) => Promise<void>;
};

const defaultLinkedNativeAccountDeps: LinkedNativeAccountDeps = {
  findUserByEmail: (email) =>
    prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    }),
  getNativeProfile: (nativeUsername) => {
    const { userPoolId } = loadCognitoConfig();
    return adminGetNativeUserProfile({ userPoolId, username: nativeUsername });
  },
  upsertUserByEmail: ({ id, email, name }) =>
    prisma.user.upsert({
      where: { email },
      create: { id, email, name },
      update: {},
      select: { id: true, name: true },
    }),
  syncNativeAttributes: syncNativeLinkedAttributes,
};

export async function ensureLinkedNativeAccount(
  email: string,
  nativeUsername: string,
  deps: LinkedNativeAccountDeps = defaultLinkedNativeAccountDeps,
): Promise<void> {
  const existing = await deps.findUserByEmail(email);
  if (existing) {
    await deps.syncNativeAttributes(existing.id, existing.name);
    return;
  }

  const profile = await deps.getNativeProfile(nativeUsername);
  if (profile.email.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('native_email_mismatch');
  }

  const user = await deps.upsertUserByEmail({
    id: profile.sub,
    email: profile.email,
    name: profile.name,
  });
  if (user.id !== profile.sub) {
    throw new Error('native_identity_conflict');
  }
  await deps.syncNativeAttributes(profile.username, user.name);
}

export async function reconcileLinkedNativeAccount(
  result: FederatedLinkOutcome,
  accessPayload: Record<string, unknown>,
  idPayload: Record<string, unknown>,
  deps: LinkedNativeAccountDeps = defaultLinkedNativeAccountDeps,
): Promise<void> {
  if (result.reason !== 'linked' && result.reason !== 'already_linked') return;

  const claims = parseFederatedTokenClaims(accessPayload, idPayload);
  if (!claims) {
    throw new Error('invalid_token_claims');
  }
  await ensureLinkedNativeAccount(
    claims.email,
    result.nativeUsername ?? claims.cognitoUsername,
    deps,
  );
}

export async function registerFederatedAuthRoutes(api: FastifyInstance) {
  api.post('/auth/federated/link', async (req, reply) => {
    const accessToken = bearerToken(req.headers.authorization);
    if (!accessToken) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = LinkBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'validation_error', issues: parsed.error.issues });
    }

    let accessPayload: Record<string, unknown>;
    let idPayload: Record<string, unknown>;
    try {
      accessPayload = (await verifyAccessToken(accessToken)) as Record<string, unknown>;
      idPayload = (await verifyIdToken(parsed.data.idToken)) as Record<string, unknown>;
    } catch {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    if (String(accessPayload.sub) !== String(idPayload.sub)) {
      return reply.status(401).send({ error: 'token_mismatch' });
    }

    try {
      const result = await linkGoogleFederatedUser({ accessPayload, idPayload });

      await reconcileLinkedNativeAccount(result, accessPayload, idPayload);

      if (result.reason === 'new_user') {
        const claims = claimsFromFederatedTokens(accessPayload, idPayload);
        const profile = resolveUserProfile(claims);
        if (profile) {
          const stale = await prisma.user.findUnique({ where: { email: profile.email } });
          if (stale && stale.id !== claims.sub) {
            await prisma.user.delete({ where: { id: stale.id } });
          }
        }
        await ensureUser(prisma, claims, { pendingNickname: true });
        return { ...result, needsNicknameSetup: true };
      }

      return {
        linked: result.linked,
        requiresReauth: result.requiresReauth,
        reason: result.reason,
      };
    } catch (err) {
      const code =
        err instanceof Error && err.message === 'google_sub_missing'
          ? 'google_sub_missing'
          : typeof err === 'object' &&
              err !== null &&
              'name' in err &&
              typeof (err as { name?: string }).name === 'string'
            ? (err as { name: string }).name
            : 'unknown';
      req.log.error({ err, code }, 'federated link failed');
      return reply.status(500).send({ error: 'link_failed', code });
    }
  });
}
