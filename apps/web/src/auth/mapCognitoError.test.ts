import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isUserNotConfirmed, mapCognitoError } from './mapCognitoError.js';

describe('mapCognitoError', () => {
  it('maps UserNotConfirmedException', () => {
    assert.match(mapCognitoError({ code: 'UserNotConfirmedException' }), /Confirm your email/);
  });

  it('maps NotAuthorizedException to generic login failure', () => {
    assert.match(mapCognitoError({ code: 'NotAuthorizedException' }), /Incorrect email or password/);
  });

  it('maps CodeMismatchException', () => {
    assert.match(mapCognitoError({ code: 'CodeMismatchException' }), /Invalid verification code/);
  });
});

describe('isUserNotConfirmed', () => {
  it('detects unconfirmed user', () => {
    assert.equal(isUserNotConfirmed({ code: 'UserNotConfirmedException' }), true);
    assert.equal(isUserNotConfirmed({ code: 'NotAuthorizedException' }), false);
  });
});
