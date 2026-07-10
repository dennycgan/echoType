import type { CognitoWebConfig } from './cognitoConfig.js';

export type CognitoOAuthConfig = CognitoWebConfig & {
  domainPrefix: string;
};

export function loadCognitoOAuthConfig(): CognitoOAuthConfig {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() ?? '';
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim() ?? '';
  const region = import.meta.env.VITE_COGNITO_REGION?.trim() || 'ap-southeast-2';
  const domainPrefix = import.meta.env.VITE_COGNITO_DOMAIN_PREFIX?.trim() ?? '';
  return { userPoolId, clientId, region, domainPrefix };
}

export function assertCognitoOAuthConfig(): CognitoOAuthConfig {
  const config = loadCognitoOAuthConfig();
  if (!config.userPoolId || !config.clientId || !config.domainPrefix) {
    throw new Error(
      'Missing VITE_COGNITO_USER_POOL_ID, VITE_COGNITO_CLIENT_ID, or VITE_COGNITO_DOMAIN_PREFIX',
    );
  }
  return config;
}

export function oauthRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}
