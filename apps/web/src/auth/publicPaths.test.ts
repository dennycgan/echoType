import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPublicAuthPath, loginPathWithNext } from './publicPaths.js';

describe('publicPaths', () => {
  it('marks auth pages public', () => {
    assert.equal(isPublicAuthPath('/login'), true);
    assert.equal(isPublicAuthPath('/register'), true);
    assert.equal(isPublicAuthPath('/verify-email'), true);
    assert.equal(isPublicAuthPath('/auth/callback'), true);
    assert.equal(isPublicAuthPath('/courses/short'), false);
  });

  it('builds login path with next', () => {
    assert.equal(loginPathWithNext('/courses/short'), '/login?next=%2Fcourses%2Fshort');
    assert.equal(loginPathWithNext('/login'), '/login');
  });
});
