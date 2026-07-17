import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  consumeStaleSessionRetry,
  saveStaleSessionRetry,
  shouldRetryStaleCognitoSession,
} from './cognitoOAuthExchange.js';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('stale Cognito session retry', () => {
  it('retries only invalid_grant from the single allowed reauth leg', () => {
    assert.equal(shouldRetryStaleCognitoSession('invalid_grant', 1), true);
    assert.equal(shouldRetryStaleCognitoSession('invalid_grant', 0), false);
    assert.equal(shouldRetryStaleCognitoSession('invalid_grant', 2), false);
    assert.equal(shouldRetryStaleCognitoSession('invalid_request', 1), false);
  });

  it('consumes a fresh retry marker exactly once', () => {
    const storage = new MemoryStorage();
    saveStaleSessionRetry(
      {
        nextPath: '/account',
        hintEmail: 'user@example.com',
        createdAt: 1_000,
      },
      storage,
    );

    assert.deepEqual(consumeStaleSessionRetry(storage, 2_000), {
      nextPath: '/account',
      hintEmail: 'user@example.com',
      createdAt: 1_000,
    });
    assert.equal(consumeStaleSessionRetry(storage, 2_000), null);
  });

  it('rejects expired and non-local retry markers', () => {
    const expired = new MemoryStorage();
    saveStaleSessionRetry({ nextPath: '/', createdAt: 1_000 }, expired);
    assert.equal(consumeStaleSessionRetry(expired, 122_001), null);

    const external = new MemoryStorage();
    saveStaleSessionRetry({ nextPath: '//example.com', createdAt: 1_000 }, external);
    assert.equal(consumeStaleSessionRetry(external, 2_000), null);
  });
});
