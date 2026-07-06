import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTargetStatuses,
  countAlignedErrors,
  forgivingCharsMatch,
  forgivingPositionMatches,
  isIgnorableChar,
  isPassComplete,
  isCoreChar,
  syncTypedToTarget,
} from './typingAlign.ts';

describe('isIgnorableChar / isCoreChar', () => {
  it('treats whitespace and punctuation as ignorable', () => {
    assert.equal(isIgnorableChar(' '), true);
    assert.equal(isIgnorableChar('\n'), true);
    assert.equal(isIgnorableChar(','), true);
    assert.equal(isIgnorableChar('，'), true);
    assert.equal(isIgnorableChar('.'), true);
  });

  it('treats letters and digits as core', () => {
    assert.equal(isCoreChar('a'), true);
    assert.equal(isCoreChar('好'), true);
    assert.equal(isCoreChar('7'), true);
    assert.equal(isCoreChar(' '), false);
    assert.equal(isCoreChar(','), false);
  });
});

describe('forgivingCharsMatch', () => {
  it('ignores Latin case', () => {
    assert.equal(forgivingCharsMatch('t', 'T'), true);
    assert.equal(forgivingCharsMatch('x', 'T'), false);
  });

  it('requires exact match for CJK', () => {
    assert.equal(forgivingCharsMatch('好', '好'), true);
    assert.equal(forgivingCharsMatch('坏', '好'), false);
  });
});

describe('forgivingPositionMatches', () => {
  it('accepts any keystroke when target is ignorable', () => {
    assert.equal(forgivingPositionMatches(' ', ','), true);
    assert.equal(forgivingPositionMatches('x', ' '), true);
    assert.equal(forgivingPositionMatches(',', '，'), true);
  });
});

describe('forgiving sync and errors', () => {
  it('does not complete without typing through ignorable target chars', () => {
    const target = 'When love beckons, follow.';
    const typed = 'Whenlovebeckonsfollow';
    assert.equal(isPassComplete(typed, target, 'forgiving'), false);
  });

  it('accepts Latin case differences with spaces', () => {
    const target = 'The Prophet';
    const typed = 'the prophet';
    assert.equal(countAlignedErrors(typed, target, 'forgiving'), 0);
    assert.ok(countAlignedErrors(typed, target, 'strict') > 0);
  });

  it('forgives wrong punctuation when user types at ignorable slot', () => {
    const target = 'hi, there';
    const typed = 'hi, there';
    assert.equal(countAlignedErrors(typed, target, 'forgiving'), 0);
    assert.equal(countAlignedErrors('hi. there', target, 'forgiving'), 0);
  });

  it('still counts wrong core characters', () => {
    const target = 'hello';
    const typed = 'hallo';
    assert.equal(countAlignedErrors(typed, target, 'forgiving'), 1);
  });

  it('still requires digits', () => {
    const target = 'year 1923';
    const typed = 'year 1924';
    assert.equal(countAlignedErrors(typed, target, 'forgiving'), 1);
  });

  it('ignores extra typed punctuation after target', () => {
    const target = 'hello';
    const typed = 'hello!!!';
    assert.equal(countAlignedErrors(typed, target, 'forgiving'), 0);
    assert.equal(isPassComplete(typed, target, 'forgiving'), true);
  });

  it('strict mode unchanged for case', () => {
    assert.equal(countAlignedErrors('the', 'The', 'strict'), 1);
  });
});

describe('forgiving buildTargetStatuses', () => {
  it('keeps cursor on ignorable chars until typed (no auto-skip)', () => {
    const statuses = buildTargetStatuses('hi', 'hi, there', 'forgiving');
    assert.equal(statuses[0], 'correct');
    assert.equal(statuses[1], 'correct');
    assert.equal(statuses[2], 'cursor');
  });

  it('marks ignorable target green when user types at that index', () => {
    const statuses = buildTargetStatuses('hi,', 'hi, there', 'forgiving');
    assert.equal(statuses[2], 'correct');
    assert.equal(statuses[3], 'cursor');
  });

  it('marks Latin case match as correct', () => {
    const statuses = buildTargetStatuses('the', 'The', 'forgiving');
    assert.equal(statuses[0], 'correct');
    assert.equal(statuses[1], 'correct');
    assert.equal(statuses[2], 'correct');
  });
});

describe('forgiving syncTypedToTarget', () => {
  it('uses the same index walk as strict', () => {
    const strict = syncTypedToTarget('a b', 'a b', 'strict');
    const forgiving = syncTypedToTarget('a b', 'a b', 'forgiving');
    assert.deepEqual(forgiving, strict);
    assert.equal(forgiving.targetCursor, 3);
  });
});
