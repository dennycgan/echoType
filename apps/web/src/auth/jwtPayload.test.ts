import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeJwtPayload, jwtExpirySeconds } from './jwtPayload.js';

describe('decodeJwtPayload', () => {
  it('decodes a payload segment', () => {
    const payload = { name: 'Ann', exp: 9_999_999_999 };
    const token = `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
    assert.deepEqual(decodeJwtPayload(token), payload);
  });

  it('returns empty object for malformed token', () => {
    assert.deepEqual(decodeJwtPayload('not-a-jwt'), {});
  });
});

describe('jwtExpirySeconds', () => {
  it('reads exp claim', () => {
    const token = `h.${Buffer.from(JSON.stringify({ exp: 42 })).toString('base64url')}.s`;
    assert.equal(jwtExpirySeconds(token), 42);
  });
});
