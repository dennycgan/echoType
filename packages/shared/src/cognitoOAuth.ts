/** Cognito Hosted UI / Google federation URL helpers (Google sign-in Phase 1+). */

export function buildCognitoHostedUiBaseUrl(domainPrefix: string, region: string): string {
  return `https://${domainPrefix}.auth.${region}.amazoncognito.com`;
}

/** Redirect URI registered in the Google Cloud OAuth client (Cognito IdP handshake). */
export function buildGoogleIdpRedirectUri(domainPrefix: string, region: string): string {
  return `${buildCognitoHostedUiBaseUrl(domainPrefix, region)}/oauth2/idpresponse`;
}

export type CognitoAuthorizeUrlParams = {
  domainPrefix: string;
  region: string;
  clientId: string;
  redirectUri: string;
  /** When set, skip the Hosted UI chooser and go straight to this IdP (e.g. "Google"). */
  identityProvider?: string;
  state?: string;
};

export function buildCognitoAuthorizeUrl(params: CognitoAuthorizeUrlParams): string {
  const base = buildCognitoHostedUiBaseUrl(params.domainPrefix, params.region);
  const search = new URLSearchParams({
    client_id: params.clientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: params.redirectUri,
  });
  if (params.identityProvider) {
    search.set('identity_provider', params.identityProvider);
  }
  if (params.state) {
    search.set('state', params.state);
  }
  return `${base}/oauth2/authorize?${search.toString()}`;
}
