import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCoarsePointerMedia, shouldShowDesktopNotice } from './desktopNotice.ts';

describe('shouldShowDesktopNotice', () => {
  it('shows only when hover:none, pointer:coarse, and not dismissed', () => {
    assert.equal(
      shouldShowDesktopNotice({ hoverNone: true, pointerCoarse: true, dismissed: false }),
      true,
    );
  });

  it('hides when dismissed', () => {
    assert.equal(
      shouldShowDesktopNotice({ hoverNone: true, pointerCoarse: true, dismissed: true }),
      false,
    );
  });

  it('hides on desktop-like media (hover available or fine pointer)', () => {
    assert.equal(
      shouldShowDesktopNotice({ hoverNone: false, pointerCoarse: true, dismissed: false }),
      false,
    );
    assert.equal(
      shouldShowDesktopNotice({ hoverNone: true, pointerCoarse: false, dismissed: false }),
      false,
    );
    assert.equal(
      shouldShowDesktopNotice({ hoverNone: false, pointerCoarse: false, dismissed: false }),
      false,
    );
  });
});

describe('readCoarsePointerMedia', () => {
  it('returns false/false when matchMedia is missing', () => {
    assert.deepEqual(readCoarsePointerMedia({}), { hoverNone: false, pointerCoarse: false });
  });

  it('reads hover and pointer queries', () => {
    const win = {
      matchMedia(query: string) {
        return { matches: query === '(hover: none)' || query === '(pointer: coarse)' };
      },
    };
    assert.deepEqual(readCoarsePointerMedia(win), { hoverNone: true, pointerCoarse: true });
  });

  it('returns false/false when matchMedia throws', () => {
    const win = {
      matchMedia() {
        throw new Error('blocked');
      },
    };
    assert.deepEqual(readCoarsePointerMedia(win), { hoverNone: false, pointerCoarse: false });
  });
});
