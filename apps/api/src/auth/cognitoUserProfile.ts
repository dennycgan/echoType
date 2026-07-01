import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { loadCognitoConfig } from './cognitoConfig.js';
import type { AccessTokenClaims } from './ensureUser.js';
import { resolveUserProfile } from './ensureUser.js';

let client: CognitoIdentityProviderClient | null = null;

function getClient() {
  if (!client) {
    client = new CognitoIdentityProviderClient({ region: loadCognitoConfig().region });
  }
  return client;
}

export function claimsFromAccessTokenPayload(payload: Record<string, unknown>): AccessTokenClaims {
  return {
    sub: String(payload.sub),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    username: typeof payload.username === 'string' ? payload.username : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

/** Access tokens often omit name; GetUser(AccessToken) fills profile without admin IAM. */
export async function enrichClaimsFromAccessToken(
  accessToken: string,
  claims: AccessTokenClaims,
): Promise<AccessTokenClaims> {
  if (resolveUserProfile(claims)) return claims;

  const res = await getClient().send(new GetUserCommand({ AccessToken: accessToken }));
  const attrs = Object.fromEntries(
    (res.UserAttributes ?? [])
      .filter((a): a is { Name: string; Value: string } => Boolean(a.Name && a.Value))
      .map((a) => [a.Name, a.Value]),
  );

  return {
    sub: claims.sub,
    email: claims.email ?? attrs.email ?? res.Username,
    username: claims.username ?? res.Username,
    name: claims.name ?? attrs.name,
  };
}
