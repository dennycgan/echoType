import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NICKNAME_MAX,
  SetPasswordInput,
  UpdateAccountInput,
  isDeleteConfirmationValid,
  isPureGoogleCognitoUser,
} from '@echotype/shared';

describe('UpdateAccountInput', () => {
  it('accepts a trimmed nickname within max length', () => {
    const result = UpdateAccountInput.safeParse({ name: '  Echo  ' });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.name, 'Echo');
  });

  it('rejects empty nickname', () => {
    const result = UpdateAccountInput.safeParse({ name: '   ' });
    assert.equal(result.success, false);
  });

  it('rejects nickname over max length', () => {
    const result = UpdateAccountInput.safeParse({ name: 'a'.repeat(NICKNAME_MAX + 1) });
    assert.equal(result.success, false);
  });
});

describe('isDeleteConfirmationValid', () => {
  it('requires exact DELETE after trim', () => {
    assert.equal(isDeleteConfirmationValid('DELETE'), true);
    assert.equal(isDeleteConfirmationValid('delete'), false);
  });
});

describe('SetPasswordInput', () => {
  it('accepts a password matching the Cognito policy', () => {
    assert.equal(SetPasswordInput.safeParse({ newPassword: 'Abcdef12' }).success, true);
  });

  it('rejects passwords missing length, case, or digit requirements', () => {
    assert.equal(SetPasswordInput.safeParse({ newPassword: 'Ab1' }).success, false);
    assert.equal(SetPasswordInput.safeParse({ newPassword: 'abcdefg1' }).success, false);
    assert.equal(SetPasswordInput.safeParse({ newPassword: 'ABCDEFG1' }).success, false);
    assert.equal(SetPasswordInput.safeParse({ newPassword: 'Abcdefgh' }).success, false);
  });
});

describe('isPureGoogleCognitoUser', () => {
  const googleIdentities = JSON.stringify([
    { userId: '107121059094644779940', providerName: 'Google', providerType: 'Google' },
  ]);

  it('true for EXTERNAL_PROVIDER with a Google identity', () => {
    assert.equal(isPureGoogleCognitoUser('EXTERNAL_PROVIDER', googleIdentities), true);
  });

  it('false once the user is CONFIRMED (password set or L2 linked)', () => {
    assert.equal(isPureGoogleCognitoUser('CONFIRMED', googleIdentities), false);
  });

  it('false for EXTERNAL_PROVIDER without a Google identity', () => {
    assert.equal(isPureGoogleCognitoUser('EXTERNAL_PROVIDER', undefined), false);
    assert.equal(isPureGoogleCognitoUser('EXTERNAL_PROVIDER', '[]'), false);
  });

  it('false when UserStatus is missing', () => {
    assert.equal(isPureGoogleCognitoUser(undefined, googleIdentities), false);
  });
});
