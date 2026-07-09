import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isSentryEnabled, scrubSentryEvent } from './sentry.js';
import type { ErrorEvent } from '@sentry/react';

describe('isSentryEnabled', () => {
  it('is false in dev without DSN', () => {
    assert.equal(isSentryEnabled(undefined, false), false);
    assert.equal(isSentryEnabled('https://example@o0.ingest.sentry.io/1', false), false);
  });

  it('is false in prod without DSN', () => {
    assert.equal(isSentryEnabled(undefined, true), false);
  });

  it('is true in prod with DSN', () => {
    assert.equal(isSentryEnabled('https://example@o0.ingest.sentry.io/1', true), true);
  });
});

describe('scrubSentryEvent', () => {
  it('removes sensitive request headers', () => {
    const event = scrubSentryEvent({
      request: {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'session=abc',
          accept: 'application/json',
        },
      },
    } as unknown as ErrorEvent);

    assert.deepEqual(event?.request?.headers, { accept: 'application/json' });
  });
});
