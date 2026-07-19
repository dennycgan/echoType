import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminLinkProviderForUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { loadCognitoConfig } from './cognitoConfig.js';

let client: CognitoIdentityProviderClient | null = null;

function getClient(): CognitoIdentityProviderClient {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: loadCognitoConfig().region });
  }
  return client;
}

export async function adminGetUserPoolUsername(params: {
  userPoolId: string;
  usernameOrAlias: string;
}): Promise<string> {
  const res = await getClient().send(
    new AdminGetUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.usernameOrAlias,
    }),
  );
  return res.Username ?? params.usernameOrAlias;
}

export type CognitoNativeUserProfile = {
  username: string;
  sub: string;
  email: string;
  name: string;
};

export async function adminGetNativeUserProfile(params: {
  userPoolId: string;
  username: string;
}): Promise<CognitoNativeUserProfile> {
  const res = await getClient().send(
    new AdminGetUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.username,
    }),
  );
  const attributes = Object.fromEntries(
    (res.UserAttributes ?? [])
      .filter((attribute): attribute is { Name: string; Value: string } =>
        Boolean(attribute.Name && attribute.Value),
      )
      .map((attribute) => [attribute.Name, attribute.Value]),
  );
  const sub = attributes.sub?.trim();
  const email = attributes.email?.trim();
  const name = attributes.name?.trim();
  if (!sub || !email || !name) {
    throw new Error('native_profile_incomplete');
  }

  return {
    username: res.Username ?? params.username,
    sub,
    email,
    name,
  };
}

export type CognitoUserPasswordFacts = {
  userStatus?: string;
  /** Raw `identities` attribute JSON, parseable with shared parseIdentitiesClaim. */
  identitiesRaw?: string;
};

/** Live UserStatus + identities for the canSetPassword check (no caching by design). */
export async function adminGetUserPasswordFacts(params: {
  userPoolId: string;
  username: string;
}): Promise<CognitoUserPasswordFacts> {
  const res = await getClient().send(
    new AdminGetUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.username,
    }),
  );
  const identitiesRaw = (res.UserAttributes ?? []).find((a) => a.Name === 'identities')?.Value;
  return { userStatus: res.UserStatus, identitiesRaw };
}

export type CreatedNativeUser = {
  /** Pool username (UUID in this email-as-username pool). */
  username: string;
  sub: string;
};

/**
 * Native user for email + password sign-in. Email arrives pre-verified (Google
 * OAuth verified it); MessageAction SUPPRESS skips the invite email since the
 * caller immediately sets a permanent password.
 */
export async function adminCreateNativeUser(params: {
  userPoolId: string;
  email: string;
  name?: string;
}): Promise<CreatedNativeUser> {
  const name = params.name?.trim();
  const res = await getClient().send(
    new AdminCreateUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: params.email },
        { Name: 'email_verified', Value: 'true' },
        ...(name ? [{ Name: 'name', Value: name }] : []),
      ],
    }),
  );

  const username = res.User?.Username;
  const sub = (res.User?.Attributes ?? []).find((a) => a.Name === 'sub')?.Value;
  if (!username || !sub) {
    throw new Error('native_user_create_incomplete');
  }
  return { username, sub };
}

/** Permanent password: user can sign in with email + password right away, no reset flow. */
export async function adminSetPermanentUserPassword(params: {
  userPoolId: string;
  username: string;
  password: string;
}): Promise<void> {
  await getClient().send(
    new AdminSetUserPasswordCommand({
      UserPoolId: params.userPoolId,
      Username: params.username,
      Password: params.password,
      Permanent: true,
    }),
  );
}

export async function adminLinkGoogleToNativeUser(params: {
  userPoolId: string;
  nativeUsername: string;
  googleSub: string;
}): Promise<void> {
  await getClient().send(
    new AdminLinkProviderForUserCommand({
      UserPoolId: params.userPoolId,
      DestinationUser: {
        ProviderName: 'Cognito',
        ProviderAttributeValue: params.nativeUsername,
      },
      SourceUser: {
        ProviderName: 'Google',
        ProviderAttributeName: 'Cognito_Subject',
        ProviderAttributeValue: params.googleSub,
      },
    }),
  );
}

export async function adminDeleteCognitoUser(params: {
  userPoolId: string;
  username: string;
}): Promise<void> {
  await getClient().send(
    new AdminDeleteUserCommand({
      UserPoolId: params.userPoolId,
      Username: params.username,
    }),
  );
}

export async function adminUpdateUserAttributes(params: {
  userPoolId: string;
  username: string;
  attributes: Record<string, string>;
}): Promise<void> {
  const entries = Object.entries(params.attributes);
  if (entries.length === 0) return;
  await getClient().send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: params.userPoolId,
      Username: params.username,
      UserAttributes: entries.map(([Name, Value]) => ({ Name, Value })),
    }),
  );
}

export function isAliasExistsError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'AliasExistsException'
  );
}

export function isUserNotFoundError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'UserNotFoundException'
  );
}

export function isInvalidParameterError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: string }).name === 'InvalidParameterException'
  );
}

/** Cognito quirk: link may succeed but repeat calls throw this misleading message. */
export function isMisleadingLinkedInvalidParameterError(err: unknown): boolean {
  if (!isInvalidParameterError(err)) return false;
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message)
      : '';
  return message.includes('may not be passed in as a SourceUser');
}

/**
 * AdminLink rejects a SourceUser that already exists in the pool: "Merging is not
 * currently supported, provide a SourceUser that has not been signed up in order
 * to link". Recovery = delete the orphan Google_* user, then retry the link.
 */
export function isMergingNotSupportedError(err: unknown): boolean {
  if (!isInvalidParameterError(err)) return false;
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message?: unknown }).message)
      : '';
  return message.includes('Merging is not currently supported');
}

export async function adminListUsersByEmail(params: {
  userPoolId: string;
  email: string;
}): Promise<Array<{ username: string; status?: string; sub?: string }>> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes('@')) return [];

  const safe = email.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const res = await getClient().send(
    new ListUsersCommand({
      UserPoolId: params.userPoolId,
      Filter: `email = "${safe}"`,
      Limit: 5,
    }),
  );

  return (res.Users ?? [])
    .map((u) => ({
      username: u.Username ?? '',
      status: u.UserStatus,
      sub: (u.Attributes ?? []).find((a) => a.Name === 'sub')?.Value,
    }))
    .filter((u) => u.username);
}
