import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatePassword } from './passwordPolicy.js';

describe('validatePassword', () => {
  it('accepts policy-compliant password', () => {
    assert.equal(validatePassword('Abcdef1!'), null);
  });

  it('rejects short password', () => {
    assert.match(validatePassword('Ab1') ?? '', /8 characters/);
  });

  it('requires uppercase', () => {
    assert.match(validatePassword('abcdef1!') ?? '', /uppercase/);
  });
});
