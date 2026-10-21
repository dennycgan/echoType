import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  DESKTOP_NOTICE_DISMISSED_STORAGE_KEY,
  readCoarsePointerMedia,
  readDesktopNoticeDismissed,
  shouldShowDesktopNotice,
  writeDesktopNoticeDismissed,
} from './desktopNotice.ts';

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

describe('desktop notice localStorage helpers', () => {
  const original = globalThis.localStorage;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem(key: string) {
          return store.has(key) ? store.get(key)! : null;
        },
        setItem(key: string, value: string) {
          store.set(key, value);
        },
        removeItem(key: string) {
          store.delete(key);
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  });

  it('readDesktopNoticeDismissed is false when unset', () => {
    assert.equal(readDesktopNoticeDismissed(), false);
  });

  it('write then read round-trips', () => {
    assert.equal(writeDesktopNoticeDismissed(), true);
    assert.equal(store.get(DESKTOP_NOTICE_DISMISSED_STORAGE_KEY), '1');
    assert.equal(readDesktopNoticeDismissed(), true);
  });

  it('read returns false when getItem throws (treat as not dismissed)', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem() {
          throw new Error('denied');
        },
        setItem() {},
        removeItem() {},
      },
    });
    assert.equal(readDesktopNoticeDismissed(), false);
  });

  it('write returns false when setItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem() {
          return null;
        },
        setItem() {
          throw new Error('denied');
        },
        removeItem() {},
      },
    });
    assert.equal(writeDesktopNoticeDismissed(), false);
  });
});
