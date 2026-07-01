export type CognitoConfig = {
  userPoolId: string;
  clientId: string;
  region: string;
};

export function loadCognitoConfig(): CognitoConfig {
  const userPoolId = process.env.COGNITO_USER_POOL_ID?.trim();
  const clientId = process.env.COGNITO_CLIENT_ID?.trim();
  if (!userPoolId || !clientId) {
    throw new Error('COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID are required');
  }

  let region = process.env.COGNITO_REGION?.trim();
  if (!region) {
    const match = userPoolId.match(/^([a-z]{2}-[a-z]+-\d+)_/);
    region = match?.[1] ?? 'ap-southeast-2';
  }

  return { userPoolId, clientId, region };
}

/** Fail fast at process startup when Cognito env is missing. */
export function assertCognitoConfig(): CognitoConfig {
  return loadCognitoConfig();
}
