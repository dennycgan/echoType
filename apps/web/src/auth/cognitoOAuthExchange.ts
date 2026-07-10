import type { FederatedTokenClaims, FederatedLinkResult, CognitoTokenResponse } from '@echotype/shared';
import {
  buildAuthorizationCodeExchangeBody,
  buildCognitoAuthorizeUrl,
  buildCognitoTokenUrl,
  encodeOAuthState,
  generatePkcePair,
  parseOAuthState,
  randomUrlSafeString,
} from '@echotype/shared';
import { parseFederatedTokenClaims } from '@echotype/shared';
import { decodeJwtPayload } from './jwtPayload.js';
import type { StoredAuthSession } from './authSession.js';
import { assertCognitoOAuthConfig, oauthRedirectUri } from './cognitoOAuthConfig.js';

const PKCE_STORAGE_KEY = 'echotype.oauth.pkce';
const STATE_NONCE_STORAGE_KEY = 'echotype.oauth.stateNonce';

type PendingOAuth = {
  codeVerifier: string;
  stateNonce: string;
};

function readPendingOAuth(): PendingOAuth | null {
  const codeVerifier = sessionStorage.getItem(PKCE_STORAGE_KEY);
  const stateNonce = sessionStorage.getItem(STATE_NONCE_STORAGE_KEY);
  if (!codeVerifier || !stateNonce) return null;
  return { codeVerifier, stateNonce };
}

function writePendingOAuth(pending: PendingOAuth): void {
  sessionStorage.setItem(PKCE_STORAGE_KEY, pending.codeVerifier);
  sessionStorage.setItem(STATE_NONCE_STORAGE_KEY, pending.stateNonce);
}

export function clearPendingOAuth(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
  sessionStorage.removeItem(STATE_NONCE_STORAGE_KEY);
}

export async function startGoogleSignIn(nextPath: string): Promise<void> {
  const config = assertCognitoOAuthConfig();
  const { codeVerifier, codeChallenge } = await generatePkcePair();
  const stateNonce = randomUrlSafeString(16);
  writePendingOAuth({ codeVerifier, stateNonce });

  const state = encodeOAuthState({
    next: nextPath.startsWith('/') ? nextPath : '/courses/short',
    nonce: stateNonce,
  });

  const url = buildCognitoAuthorizeUrl({
    domainPrefix: config.domainPrefix,
    region: config.region,
    clientId: config.clientId,
    redirectUri: oauthRedirectUri(),
    identityProvider: 'Google',
    state,
    codeChallenge,
  });

  window.location.assign(url);
}

export async function exchangeAuthorizationCode(code: string): Promise<CognitoTokenResponse> {
  const config = assertCognitoOAuthConfig();
  const pending = readPendingOAuth();
  if (!pending) {
    throw new Error('oauth_state_missing');
  }

  const body = buildAuthorizationCodeExchangeBody({
    clientId: config.clientId,
    code,
    redirectUri: oauthRedirectUri(),
    codeVerifier: pending.codeVerifier,
  });

  const res = await fetch(buildCognitoTokenUrl(config.domainPrefix, config.region), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  if (!res.ok) {
    throw new Error('token_exchange_failed');
  }

  clearPendingOAuth();
  return (await res.json()) as CognitoTokenResponse;
}

export function validateOAuthCallbackState(stateParam: string | null): string | null {
  if (!stateParam) return null;
  const parsed = parseOAuthState(stateParam);
  if (!parsed) return null;
  const pending = readPendingOAuth();
  if (!pending || pending.stateNonce !== parsed.nonce) return null;
  return parsed.next;
}

export function sessionUsernameFromTokens(
  accessToken: string,
  idToken: string,
  fallbackEmail?: string,
): string {
  const claims = parseFederatedTokenClaims(
    decodeJwtPayload(accessToken),
    decodeJwtPayload(idToken),
  );
  if (!claims) {
    return fallbackEmail ?? '';
  }
  if (claims.isGoogleLinked || !claims.isOrphanGoogleSession) {
    return claims.email;
  }
  return claims.cognitoUsername;
}

export function federatedClaimsFromSession(session: StoredAuthSession): FederatedTokenClaims | null {
  return parseFederatedTokenClaims(
    decodeJwtPayload(session.accessToken),
    decodeJwtPayload(session.idToken),
  );
}

export function isOrphanGoogleSession(session: StoredAuthSession): boolean {
  return federatedClaimsFromSession(session)?.isOrphanGoogleSession ?? false;
}

export type OAuthCallbackSuccess = {
  session: StoredAuthSession;
  linkResult: FederatedLinkResult;
  nextPath: string;
};

export function tokensToStoredSession(
  tokens: CognitoTokenResponse,
  username: string,
): StoredAuthSession {
  if (!tokens.refresh_token) {
    throw new Error('refresh_token_missing');
  }
  return {
    username,
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
  };
}
