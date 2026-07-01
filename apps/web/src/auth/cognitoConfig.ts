export type CognitoWebConfig = {
  userPoolId: string;
  clientId: string;
  region: string;
};

export function loadCognitoConfig(): CognitoWebConfig {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() ?? '';
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim() ?? '';
  const region = import.meta.env.VITE_COGNITO_REGION?.trim() || 'ap-southeast-2';
  return { userPoolId, clientId, region };
}

export function assertCognitoConfig(): CognitoWebConfig {
  const config = loadCognitoConfig();
  if (!config.userPoolId || !config.clientId) {
    throw new Error(
      'Missing VITE_COGNITO_USER_POOL_ID or VITE_COGNITO_CLIENT_ID (see apps/web/.env.example)',
    );
  }
  return config;
}
