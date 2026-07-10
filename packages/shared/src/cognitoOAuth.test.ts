import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCognitoAuthorizeUrl,
  buildCognitoHostedUiBaseUrl,
  buildGoogleIdpRedirectUri,
} from './cognitoOAuth.js';

describe('buildCognitoHostedUiBaseUrl', () => {
  it('uses the regional Cognito auth domain', () => {
    assert.equal(
      buildCognitoHostedUiBaseUrl('echotype-ink', 'ap-southeast-2'),
      'https://echotype-ink.auth.ap-southeast-2.amazoncognito.com',
    );
  });
});

describe('buildGoogleIdpRedirectUri', () => {
  it('points at Cognito oauth2/idpresponse', () => {
    assert.equal(
      buildGoogleIdpRedirectUri('echotype-ink', 'ap-southeast-2'),
      'https://echotype-ink.auth.ap-southeast-2.amazoncognito.com/oauth2/idpresponse',
    );
  });
});

describe('buildCognitoAuthorizeUrl', () => {
  it('builds an authorization code URL with required params', () => {
    const url = buildCognitoAuthorizeUrl({
      domainPrefix: 'echotype-ink',
      region: 'ap-southeast-2',
      clientId: 'abc123',
      redirectUri: 'https://echotype.ink/auth/callback',
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, 'https://echotype-ink.auth.ap-southeast-2.amazoncognito.com/oauth2/authorize');
    assert.equal(parsed.searchParams.get('client_id'), 'abc123');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('scope'), 'openid email profile');
    assert.equal(parsed.searchParams.get('redirect_uri'), 'https://echotype.ink/auth/callback');
    assert.equal(parsed.searchParams.get('identity_provider'), null);
  });

  it('supports identity_provider=Google for direct federated sign-in', () => {
    const url = buildCognitoAuthorizeUrl({
      domainPrefix: 'echotype-ink',
      region: 'ap-southeast-2',
      clientId: 'abc123',
      redirectUri: 'http://localhost:5173/auth/callback',
      identityProvider: 'Google',
    });
    assert.equal(new URL(url).searchParams.get('identity_provider'), 'Google');
  });
});
