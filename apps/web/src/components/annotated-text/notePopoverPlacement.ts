/** Viewport edge inset when deciding prefer-up vs flip-down (px). */
export const NOTE_POPOVER_VIEWPORT_MARGIN_PX = 8;

export type AnchorRect = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

export type NotePopoverPlacement = {
  /** Prefer upward (CSS `bottom`); flip to downward (CSS `top`) when clipped. */
  placement: 'up' | 'down';
  left: number;
  minWidth: number;
  maxWidth: number;
  /** Set when placement === 'down'; CSS `top` in px. */
  top?: number;
  /** Set when placement === 'up'; CSS `bottom` in px (distance from viewport bottom). */
  bottom?: number;
};

/**
 * Compute fixed-position styles for NotePopover.
 *
 * Prefer expand upward with the popover bottom edge on `anchor.bottom`
 * (in-place expansion of the hidden NoteBox). If that would place the
 * popover top above `marginPx` from the viewport top, flip to expand
 * downward from `anchor.top` (may overlap body text — accepted fallback).
 *
 * Known limitation: no horizontal collision detection; `left` / maxWidth
 * follow the anchor only and may overflow the viewport on narrow screens.
 */
export function computeNotePopoverPlacement(
  anchor: AnchorRect,
  popoverHeight: number,
  viewportHeight: number,
  marginPx: number = NOTE_POPOVER_VIEWPORT_MARGIN_PX,
): NotePopoverPlacement {
  const minWidth = anchor.width;
  const maxWidth = Math.max(anchor.width, 240);
  const left = anchor.left;

  // Upward: top edge at anchor.bottom - height. Fits if top >= marginPx.
  const fitsUp = anchor.bottom - popoverHeight >= marginPx;

  if (fitsUp) {
    return {
      placement: 'up',
      left,
      minWidth,
      maxWidth,
      bottom: viewportHeight - anchor.bottom,
    };
  }

  return {
    placement: 'down',
    left,
    minWidth,
    maxWidth,
    top: anchor.top,
  };
}
