import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { z } from 'zod';
import { isSentryEnabled, scrubSentryEvent, shouldReportError } from './sentry.js';
import type { ErrorEvent } from '@sentry/node';

describe('isSentryEnabled', () => {
  it('is false without DSN', () => {
    assert.equal(isSentryEnabled(undefined), false);
    assert.equal(isSentryEnabled(''), false);
  });

  it('is true with DSN', () => {
    assert.equal(isSentryEnabled('https://example@o0.ingest.sentry.io/1'), true);
  });
});

describe('shouldReportError', () => {
  it('skips Zod validation errors', () => {
    const err = new ZodError(z.string().safeParse(1).error!.issues);
    assert.equal(shouldReportError(err), false);
  });

  it('reports generic errors', () => {
    assert.equal(shouldReportError(new Error('boom')), true);
  });
});

describe('scrubSentryEvent', () => {
  it('removes sensitive request headers', () => {
    const event = scrubSentryEvent({
      request: {
        headers: {
          Authorization: 'Bearer secret',
          Cookie: 'session=abc',
          Accept: 'application/json',
        },
      },
    } as unknown as ErrorEvent);

    assert.deepEqual(event?.request?.headers, { Accept: 'application/json' });
  });
});
