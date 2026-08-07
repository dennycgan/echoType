import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NOTE_POPOVER_VIEWPORT_MARGIN_PX,
  computeNotePopoverPlacement,
} from './notePopoverPlacement.js';

describe('computeNotePopoverPlacement', () => {
  const viewportHeight = 800;

  it('prefers up when space above anchor bottom clears the margin', () => {
    // Anchor in mid-page; popover 40px tall → top would be 200, >= 8.
    const out = computeNotePopoverPlacement(
      { top: 180, bottom: 200, left: 100, width: 120 },
      40,
      viewportHeight,
    );
    assert.equal(out.placement, 'up');
    assert.equal(out.bottom, viewportHeight - 200);
    assert.equal(out.top, undefined);
    assert.equal(out.left, 100);
    assert.equal(out.minWidth, 120);
    assert.equal(out.maxWidth, 240);
  });

  it('keeps popover bottom on anchor.bottom (no body overlap when up)', () => {
    const anchorBottom = 300;
    const height = 50;
    const out = computeNotePopoverPlacement(
      { top: 274, bottom: anchorBottom, left: 40, width: 80 },
      height,
      viewportHeight,
    );
    assert.equal(out.placement, 'up');
    // CSS bottom = vh - anchor.bottom ⇒ popover bottom edge == anchor.bottom
    assert.equal(out.bottom, viewportHeight - anchorBottom);
    // Implied top = anchorBottom - height = 250 >= margin
    assert.ok(anchorBottom - height >= NOTE_POPOVER_VIEWPORT_MARGIN_PX);
  });

  it('flips down when upward top would sit above the 8px margin', () => {
    // First-line / immersive-top: anchor.bottom=30, height=40 → top=-10 < 8.
    const out = computeNotePopoverPlacement(
      { top: 10, bottom: 30, left: 50, width: 100 },
      40,
      viewportHeight,
    );
    assert.equal(out.placement, 'down');
    assert.equal(out.top, 10);
    assert.equal(out.bottom, undefined);
  });

  it('flips down when upward top would equal margin-1 (strict >= margin)', () => {
    // top would be 7 → must flip
    const out = computeNotePopoverPlacement(
      { top: 0, bottom: 47, left: 0, width: 50 },
      40,
      viewportHeight,
      8,
    );
    assert.equal(out.placement, 'down');
    assert.equal(out.top, 0);
  });

  it('stays up when upward top lands exactly on the margin', () => {
    // top would be 8 → fits
    const out = computeNotePopoverPlacement(
      { top: 0, bottom: 48, left: 0, width: 50 },
      40,
      viewportHeight,
      8,
    );
    assert.equal(out.placement, 'up');
    assert.equal(out.bottom, viewportHeight - 48);
  });

  it('uses max(anchor.width, 240) for maxWidth', () => {
    const narrow = computeNotePopoverPlacement(
      { top: 100, bottom: 120, left: 0, width: 80 },
      20,
      viewportHeight,
    );
    assert.equal(narrow.maxWidth, 240);

    const wide = computeNotePopoverPlacement(
      { top: 100, bottom: 120, left: 0, width: 300 },
      20,
      viewportHeight,
    );
    assert.equal(wide.maxWidth, 300);
    assert.equal(wide.minWidth, 300);
  });

  it('default margin is NOTE_POPOVER_VIEWPORT_MARGIN_PX (8)', () => {
    assert.equal(NOTE_POPOVER_VIEWPORT_MARGIN_PX, 8);
  });
});
