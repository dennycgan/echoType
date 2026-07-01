import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { _resetAuthSessionMemoryForTests, getDisplayName, type StoredAuthSession } from './authSession.js';

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode(payload)}.sig`;
}

describe('getDisplayName', () => {
  it('prefers name from access token when present', () => {
    const session: StoredAuthSession = {
      username: 'a@b.c',
      accessToken: fakeJwt({ name: 'From Access' }),
      idToken: fakeJwt({ name: 'From Id' }),
      refreshToken: 'r',
    };
    assert.equal(getDisplayName(session), 'From Access');
  });

  it('falls back to id token name when access token omits name', () => {
    const session: StoredAuthSession = {
      username: 'a@b.c',
      accessToken: fakeJwt({ sub: 's', username: 'a@b.c' }),
      idToken: fakeJwt({ name: 'From Id', email: 'a@b.c' }),
      refreshToken: 'r',
    };
    assert.equal(getDisplayName(session), 'From Id');
  });

  it('falls back to email local part when no name claim', () => {
    const session: StoredAuthSession = {
      username: 'user@example.com',
      accessToken: fakeJwt({ sub: 's' }),
      idToken: fakeJwt({ email: 'user@example.com' }),
      refreshToken: 'r',
    };
    assert.equal(getDisplayName(session), 'user');
  });
});

describe('authSession memory', () => {
  it('reset helper clears in-memory cache', () => {
    _resetAuthSessionMemoryForTests();
    assert.equal(getDisplayName(null), null);
  });
});
