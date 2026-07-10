import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { loadCognitoConfig } from './cognitoConfig.js';

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    const { userPoolId, clientId } = loadCognitoConfig();
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId,
    });
  }
  return verifier;
}

export async function verifyIdToken(token: string) {
  return getVerifier().verify(token);
}
