// Note bubble width extension (post-layout, pixel space only).
//
// Operates on the notes of ONE visual line: it may widen a bubble to the right
// so more of its text fits, but never moves `left` and never crosses lines
// (rule 2 holds by construction — callers invoke this per line). The per-glyph
// charEdges measurement that produced the input positions is untouched
// (ADR-0002).
//
// Width search: binary search in [currentWidth, hardCap] for the smallest
// width at which a greedy word-wrap of the note text fits within `maxLines`
// lines, where hardCap = min(next bubble left − minGapPx, line right edge).
// If even hardCap cannot fit the text, the bubble extends to hardCap and the
// renderer's native line-clamp ellipsis takes over (correct degradation).
//
// Priority (enforced by hardCap): stay inside the line > keep minGapPx before
// the next bubble > show as much text as possible.

import { NOTE_MAX_LINES, type Note } from './layoutUtils';

/** Extend only when the free gap to the next bubble exceeds this (px). */
export const NOTE_EXTEND_THRESHOLD_PX = 24;
/** Keep at least this many px between an extended bubble and the next one. */
export const NOTE_MIN_GAP_PX = 4;
/** Safety margin added to the found minimal width (canvas vs DOM subpixel drift). */
export const NOTE_WRAP_SLACK_PX = 2;

export type NoteExtensionOptions = {
  extendThresholdPx?: number;
  minGapPx?: number;
  /** Line clamp used by the note box renderer (defaults to NOTE_MAX_LINES). */
  maxLines?: number;
  wrapSlackPx?: number;
};

// Han, kana, hangul, CJK punctuation/full-width forms — browsers may break
// lines between any two such characters, so each one is its own wrap token.
const CJK_CHAR_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u3000-\u303F\uFF00-\uFFEF]/;

type WrapToken = { text: string; spaceBefore: boolean };

function tokenizeForWrap(text: string): WrapToken[] {
  const tokens: WrapToken[] = [];
  let spaceBefore = false;
  let word = '';
  const flushWord = () => {
    if (!word) return;
    tokens.push({ text: word, spaceBefore });
    word = '';
    spaceBefore = false;
  };
  for (const ch of text) {
    if (/\s/.test(ch)) {
      flushWord();
      spaceBefore = true;
    } else if (CJK_CHAR_RE.test(ch)) {
      flushWord();
      tokens.push({ text: ch, spaceBefore });
      spaceBefore = false;
    } else {
      word += ch;
    }
  }
  flushWord();
  return tokens;
}

/**
 * Greedy word-wrap simulation matching the note box (white-space: normal):
 * breaks at spaces and between CJK characters; wrap-point spaces collapse.
 * Returns Infinity when a single token is wider than `widthPx` (unbreakable).
 */
export function wrappedLineCount(
  text: string,
  widthPx: number,
  measureTextWidth: (text: string) => number,
): number {
  const tokens = tokenizeForWrap(text);
  if (tokens.length === 0) return 0;
  let lines = 1;
  let line = '';
  for (const token of tokens) {
    const candidate = line
      ? line + (token.spaceBefore ? ' ' : '') + token.text
      : token.text;
    if (measureTextWidth(candidate) <= widthPx) {
      line = candidate;
      continue;
    }
    if (measureTextWidth(token.text) > widthPx) return Infinity;
    lines++;
    line = token.text;
  }
  return lines;
}

/**
 * Returns a copy of `notes` (input order preserved) with widths possibly
 * extended. `measureTextWidth` must return the single-line pixel width of any
 * string at the note font (whole notes, words, and partial lines are all
 * measured during wrap simulation).
 */
export function extendNoteWidths(
  notes: Note[],
  lineRightEdgePx: number,
  measureTextWidth: (text: string) => number,
  opts: NoteExtensionOptions = {},
): Note[] {
  const {
    extendThresholdPx = NOTE_EXTEND_THRESHOLD_PX,
    minGapPx = NOTE_MIN_GAP_PX,
    maxLines = NOTE_MAX_LINES,
    wrapSlackPx = NOTE_WRAP_SLACK_PX,
  } = opts;
  if (notes.length === 0 || lineRightEdgePx <= 0) return notes;

  // Left-to-right order; lefts never change, so neighbor lookups stay valid
  // even after earlier bubbles in the pass have been widened.
  const order = notes
    .map((_, i) => i)
    .sort((a, b) => notes[a]!.left - notes[b]!.left);
  const result = notes.slice();

  for (let k = 0; k < order.length; k++) {
    const note = notes[order[k]!]!;
    const fits = (w: number) =>
      wrappedLineCount(note.text, w, measureTextWidth) <= maxLines;
    if (fits(note.width)) continue;

    let hardCap = lineRightEdgePx - note.left;
    const next = k + 1 < order.length ? notes[order[k + 1]!]! : null;
    if (next) {
      const gap = next.left - (note.left + note.width);
      if (gap <= extendThresholdPx) continue;
      hardCap = Math.min(hardCap, next.left - minGapPx - note.left);
    }
    if (hardCap <= note.width) continue;

    let newWidth: number;
    const hi = Math.floor(hardCap);
    if (!fits(hi)) {
      // Even the cap cannot fit the text: extend fully, line-clamp ellipsis
      // handles the rest (rule 1d).
      newWidth = hardCap;
    } else {
      let lo = Math.ceil(note.width);
      let bound = hi;
      while (lo < bound) {
        const mid = (lo + bound) >> 1;
        if (fits(mid)) bound = mid;
        else lo = mid + 1;
      }
      newWidth = Math.min(lo + wrapSlackPx, hardCap);
    }

    if (newWidth > note.width) {
      result[order[k]!] = { ...note, width: newWidth };
    }
  }

  return result;
}

/**
 * Canvas-based single-line text measurer for note text (no DOM reflow).
 * `font` is a CSS font shorthand, e.g. `12px ui-monospace, monospace`.
 * DOM access is deferred to the first call so this module stays importable
 * under node (unit tests inject a stub instead).
 */
export function createCanvasTextMeasurer(font: string): (text: string) => number {
  let ctx: CanvasRenderingContext2D | null = null;
  const cache = new Map<string, number>();
  return (text: string) => {
    const hit = cache.get(text);
    if (hit !== undefined) return hit;
    if (!ctx) {
      ctx = document.createElement('canvas').getContext('2d');
      if (ctx) ctx.font = font;
    }
    const width = ctx ? ctx.measureText(text).width : 0;
    cache.set(text, width);
    return width;
  };
}
