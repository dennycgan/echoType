import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  NOTE_WRAP_SLACK_PX,
  extendNoteWidths,
  wrappedLineCount,
} from './noteExtension.js';
import type { Note } from './layoutUtils.js';

// Length-proportional stub: every char is `ppc` px wide (spaces included),
// so words and partial lines measure realistically during wrap simulation.
const makeMeasure = (ppc: number) => (text: string) => text.length * ppc;

// Default synthetic stub: 10px per char.
const measure10 = makeMeasure(10);

const note = (id: string, left: number, width: number, text: string): Note => ({
  id,
  left,
  width,
  text,
});

// "aaaaa bbbbb ccccc" at 10px/char: words 50px each, full 170px.
// Minimal 2-line wrap: "aaaaa bbbbb" (110px) / "ccccc" -> 110px.
const THREE_WORDS = 'aaaaa bbbbb ccccc';

describe('wrappedLineCount', () => {
  it('breaks English at spaces only', () => {
    assert.equal(wrappedLineCount(THREE_WORDS, 170, measure10), 1);
    assert.equal(wrappedLineCount(THREE_WORDS, 110, measure10), 2);
    assert.equal(wrappedLineCount(THREE_WORDS, 109, measure10), 3);
  });

  it('breaks CJK between any two characters', () => {
    // 9 CJK chars, 10px each
    assert.equal(wrappedLineCount('十个中文字符的注释', 50, measure10), 2);
    assert.equal(wrappedLineCount('十个中文字符的注释', 49, measure10), 3);
  });

  it('returns Infinity for an unbreakable word wider than the line', () => {
    assert.equal(wrappedLineCount('abcdefghij', 99, measure10), Infinity);
  });
});

describe('extendNoteWidths', () => {
  it('leaves a note alone when text already fits maxLines at current width', () => {
    // "ab cd" wraps to 2 lines at 20px -> fits the clamp, no extension
    const out = extendNoteWidths([note('a', 0, 20, 'ab cd')], 400, measure10);
    assert.equal(out[0]!.width, 20);
  });

  it('pinions fixture: extends so the real note text fits two lines', () => {
    // Real data from the On Love (Gibran) debug logs:
    // fullTextPx=159 for 22 chars -> ppc = 159/22; currentWidth=67; left=328;
    // container 830 -> hardCap 502. Minimal 2-line width = "a bird's wing"
    // = 13 chars = 93.95px -> minimal integer 94, + NOTE_WRAP_SLACK_PX (6) = 100.
    const text = "a bird's wing feathers";
    const measure = makeMeasure(159 / 22);
    const out = extendNoteWidths([note('pinions', 328, 67, text)], 830, measure);
    assert.equal(out[0]!.width, 94 + NOTE_WRAP_SLACK_PX);
    assert.ok(wrappedLineCount(text, out[0]!.width, measure) <= 2);
    assert.equal(out[0]!.left, 328);
  });

  it('threshes fixture: extends so the real note text fits two lines', () => {
    // fullTextPx=282 for 39 chars -> ppc = 282/39; currentWidth=77; left=29;
    // container 830 -> hardCap 801. Minimal 2-line width =
    // "beats grain to separate" = 23 chars = 166.31px -> 167, + slack 6 = 173.
    const text = 'beats grain to separate seed from stalk';
    const measure = makeMeasure(282 / 39);
    const out = extendNoteWidths([note('threshes', 29, 77, text)], 830, measure);
    assert.equal(out[0]!.width, 167 + NOTE_WRAP_SLACK_PX);
    assert.ok(wrappedLineCount(text, out[0]!.width, measure) <= 2);
  });

  it('extends to hardCap with ellipsis when even the cap cannot fit (rule 1d)', () => {
    // THREE_WORDS needs 110px for 2 lines; next note allows only 80px.
    const out = extendNoteWidths(
      [note('a', 0, 50, THREE_WORDS), note('b', 84, 20, 'xx')],
      400,
      measure10,
    );
    // gap 34 > 24 threshold; hardCap = 84 - 4 = 80; !fits(80) -> hardCap
    assert.equal(out[0]!.width, 80);
  });

  it('caps extension at the line right edge (rule 1c)', () => {
    // Last note; line leaves 90px; needs 110px -> extends to 90, ellipsis.
    const out = extendNoteWidths([note('a', 0, 50, THREE_WORDS)], 90, measure10);
    assert.equal(out[0]!.width, 90);
  });

  it('does not extend when gap to next note is below threshold', () => {
    const out = extendNoteWidths(
      [note('a', 0, 50, THREE_WORDS), note('b', 70, 20, 'xx')],
      400,
      measure10,
    );
    // gap 20 <= 24
    assert.equal(out[0]!.width, 50);
  });

  it('does not extend when gap equals the threshold exactly', () => {
    const out = extendNoteWidths(
      [note('a', 0, 50, THREE_WORDS), note('b', 74, 20, 'xx')],
      400,
      measure10,
    );
    // gap 24, trigger requires gap > threshold
    assert.equal(out[0]!.width, 50);
  });

  it('adjacent annotated phrases: first stays, second extends freely (rule 4)', () => {
    const out = extendNoteWidths(
      [note('a', 0, 50, THREE_WORDS), note('b', 50, 50, THREE_WORDS)],
      400,
      measure10,
    );
    assert.equal(out[0]!.width, 50); // gap 0 -> no extension, no forced gap
    assert.equal(out[0]!.left, 0);
    assert.equal(out[1]!.width, 110 + NOTE_WRAP_SLACK_PX); // last note: min 110 + slack
    assert.equal(out[1]!.left, 50);
  });

  it('handles unsorted input and preserves input order', () => {
    const out = extendNoteWidths(
      [note('b', 200, 50, THREE_WORDS), note('a', 0, 50, THREE_WORDS)],
      400,
      measure10,
    );
    assert.equal(out[0]!.id, 'b');
    assert.equal(out[0]!.width, 110 + NOTE_WRAP_SLACK_PX); // last note, room available
    assert.equal(out[1]!.id, 'a');
    assert.equal(out[1]!.width, 110 + NOTE_WRAP_SLACK_PX); // gap 100 > 24; cap 196 > result
  });

  it('three notes: each capped independently, lefts never move', () => {
    const out = extendNoteWidths(
      [
        note('a', 0, 50, THREE_WORDS),
        note('b', 90, 50, THREE_WORDS),
        note('c', 180, 50, THREE_WORDS),
      ],
      240,
      measure10,
    );
    assert.equal(out[0]!.width, 86); // hardCap = 90 - 4; !fits(86) -> hardCap
    assert.equal(out[1]!.width, 86); // hardCap = 180 - 4 - 90
    assert.equal(out[2]!.width, 60); // line edge cap = 240 - 180; !fits -> hardCap
    assert.deepEqual(
      out.map((n) => n.left),
      [0, 90, 180],
    );
  });

  it('unbreakable long word wider than hardCap extends to hardCap', () => {
    const out = extendNoteWidths([note('a', 0, 40, 'abcdefghij')], 70, measure10);
    // word is 100px, unbreakable; hardCap 70 -> extend to 70, ellipsis
    assert.equal(out[0]!.width, 70);
  });

  it('extends CJK notes per-character', () => {
    // 9 CJK chars at 10px: minimal 2-line width 50 -> + slack 6 = 56
    const out = extendNoteWidths([note('a', 0, 30, '十个中文字符的注释')], 400, measure10);
    assert.equal(out[0]!.width, 50 + NOTE_WRAP_SLACK_PX);
  });

  it('mixed IPA+CJK with long unbreakable token: sim-fits within hardCap (slack regression)', () => {
    // Regression (2026-08 TypingPage audit): note like
    // "kənspaɪə/暗中配合（非贬义）/ 原意-共谋；图谋（一般贬义）" extended to
    // newWidth=180 (slack=2) while Chromium -webkit-line-clamp still needed
    // ~181px (dead zone ≥3px). Default slack raised 2→6. This suite is
    // pure-function (no DOM); it cannot reproduce webkit overflow — it locks
    // that extension still runs, stays ≤ hardCap, sim reports ≤2 lines, and
    // default slack is 4px wider than an explicit wrapSlackPx:2 pass.
    const text = 'kənspaɪə/暗中配合（非贬义）/ 原意-共谋；图谋（一般贬义）';
    const left = 405;
    const phraseWidth = 87;
    const containerWidth = 832;
    const hardCap = containerWidth - left; // 427; single note on the line
    const withDefault = extendNoteWidths(
      [note('conspires', left, phraseWidth, text)],
      containerWidth,
      measure10,
    );
    const withSlack2 = extendNoteWidths(
      [note('conspires', left, phraseWidth, text)],
      containerWidth,
      measure10,
      { wrapSlackPx: 2 },
    );
    assert.ok(withDefault[0]!.width > phraseWidth);
    assert.ok(withDefault[0]!.width <= hardCap);
    assert.ok(wrappedLineCount(text, withDefault[0]!.width, measure10) <= 2);
    assert.equal(withDefault[0]!.width - withSlack2[0]!.width, NOTE_WRAP_SLACK_PX - 2);
    assert.equal(NOTE_WRAP_SLACK_PX, 6);
  });

  it('respects extendThresholdPx override from opts', () => {
    const out = extendNoteWidths(
      [note('a', 0, 50, THREE_WORDS), note('b', 70, 20, 'xx')],
      400,
      measure10,
      { extendThresholdPx: 12 },
    );
    // gap 20 > 12 now; hardCap = 70 - 4 = 66; !fits(66) -> hardCap
    assert.equal(out[0]!.width, 66);
  });

  it('respects wrapSlackPx override from opts', () => {
    const out = extendNoteWidths([note('a', 0, 50, THREE_WORDS)], 400, measure10, {
      wrapSlackPx: 0,
    });
    assert.equal(out[0]!.width, 110); // exact minimal, no slack
  });

  it('returns input unchanged when line width is not yet known', () => {
    const out = extendNoteWidths([note('a', 0, 50, THREE_WORDS)], 0, measure10);
    assert.equal(out[0]!.width, 50);
  });
});
