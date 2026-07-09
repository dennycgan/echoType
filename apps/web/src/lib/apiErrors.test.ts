import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './api.js';
import { describeQueryError } from './apiErrors.js';

describe('describeQueryError', () => {
  it('maps network failures to retryable connection copy', () => {
    const copy = describeQueryError(new ApiError(0, null, 'Network error'));
    assert.equal(copy.title, 'Connection problem');
    assert.equal(copy.retryable, true);
  });

  it('maps 401 to sign-in required', () => {
    const copy = describeQueryError(new ApiError(401, { error: 'unauthorized' }));
    assert.equal(copy.title, 'Sign in required');
    assert.equal(copy.retryable, false);
  });

  it('maps 404 and 410 to not found', () => {
    assert.equal(describeQueryError(new ApiError(404, null)).title, 'Not found');
    assert.equal(describeQueryError(new ApiError(410, null)).retryable, false);
  });

  it('maps 5xx to retryable server error', () => {
    const copy = describeQueryError(new ApiError(503, null));
    assert.equal(copy.title, 'Something went wrong');
    assert.equal(copy.retryable, true);
  });

  it('uses ApiError message when present for other statuses', () => {
    const copy = describeQueryError(new ApiError(400, null, 'Bad request payload'));
    assert.equal(copy.description, 'Bad request payload');
    assert.equal(copy.retryable, true);
  });
});
