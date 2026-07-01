import {
  AuthenticationDetails,
  CognitoRefreshToken,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';
import { assertCognitoConfig } from './cognitoConfig.js';

let pool: CognitoUserPool | null = null;

function getPool(): CognitoUserPool {
  if (!pool) {
    const { userPoolId, clientId } = assertCognitoConfig();
    pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });
  }
  return pool;
}

export function createCognitoUser(email: string): CognitoUser {
  return new CognitoUser({ Username: email.trim(), Pool: getPool() });
}

export function signUp(email: string, password: string, nickname: string): Promise<void> {
  const attributes = [new CognitoUserAttribute({ Name: 'name', Value: nickname.trim() })];
  return new Promise((resolve, reject) => {
    getPool().signUp(email.trim(), password, attributes, [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createCognitoUser(email).confirmRegistration(code.trim(), true, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    createCognitoUser(email).resendConfirmationCode((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export function signIn(email: string, password: string): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = createCognitoUser(email);
    const details = new AuthenticationDetails({
      Username: email.trim(),
      Password: password,
    });
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(session),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error('NEW_PASSWORD_REQUIRED')),
    });
  });
}

export function refreshCognitoSession(
  email: string,
  refreshToken: string,
): Promise<CognitoUserSession> {
  return new Promise((resolve, reject) => {
    const user = createCognitoUser(email);
    const token = new CognitoRefreshToken({ RefreshToken: refreshToken });
    user.refreshSession(token, (err, session) => {
      if (err || !session) reject(err ?? new Error('refresh_failed'));
      else resolve(session);
    });
  });
}

export function signOutCognitoUser(email: string): void {
  createCognitoUser(email).signOut();
}

export function sessionToTokens(session: CognitoUserSession) {
  return {
    accessToken: session.getAccessToken().getJwtToken(),
    idToken: session.getIdToken().getJwtToken(),
    refreshToken: session.getRefreshToken().getToken(),
  };
}
