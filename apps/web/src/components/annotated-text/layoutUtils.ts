// Shared layout math for AnnotatedText (read-only) and AnnotatedTextEditor.
// Measurement depends only on content + container width + font readiness.

export const RESIZE_DEBOUNCE_MS = 100;
export const NOTE_FONT_PX = 12;
export const NOTE_LINE_PX = 15;
export const NOTE_MAX_LINES = 2;
export const NOTE_SLOT_PX = NOTE_LINE_PX * NOTE_MAX_LINES + 2;

export type VisualLine = [start: number, end: number]; // inclusive char indices

export type MeasuredLayout = {
  lines: VisualLine[];
  charWidth: number;
  charHeight: number;
};

export type LayoutAnnotation = {
  id: string;
  startIndex: number;
  endIndex: number; // inclusive
  noteText: string;
};

export type Band = { id: string; left: number; width: number; variant?: BandVariant };
export type Note = { id: string; left: number; width: number; text: string };
export type LineDatum = { start: number; end: number; bands: Band[]; notes: Note[] };

export type BandVariant = 'committed' | 'draft' | 'conflict' | 'match' | 'needsReview';

export function toChars(content: string): string[] {
  return content.split('');
}

export function measureVisualLines(charEls: HTMLElement[]): VisualLine[] {
  const first = charEls[0];
  if (!first) return [];
  const lines: VisualLine[] = [];
  let start = 0;
  let top = first.offsetTop;
  for (let i = 1; i < charEls.length; i++) {
    const t = charEls[i]!.offsetTop;
    if (t !== top) {
      lines.push([start, i - 1]);
      start = i;
      top = t;
    }
  }
  lines.push([start, charEls.length - 1]);
  return lines;
}

export function sameLines(a: VisualLine[], b: VisualLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai[0] !== bi[0] || ai[1] !== bi[1]) return false;
  }
  return true;
}

/** Host fragment for a range: default rects[0], widest if rects[0] < 50% of anchor. */
export function findNoteHost(
  lines: VisualLine[],
  startIndex: number,
  endIndex: number,
  charWidth: number,
): { lineIdx: number; left: number; width: number } | null {
  const fullCount = endIndex - startIndex + 1;
  const frags: { lineIdx: number; left: number; width: number; charCount: number }[] = [];
  for (let li = 0; li < lines.length; li++) {
    const [ls, le] = lines[li]!;
    if (endIndex < ls || startIndex > le) continue;
    const cs = Math.max(startIndex, ls);
    const ce = Math.min(endIndex, le);
    const charCount = ce - cs + 1;
    frags.push({ lineIdx: li, left: (cs - ls) * charWidth, width: charCount * charWidth, charCount });
  }
  if (frags.length === 0) return null;
  let host = frags[0]!;
  if (host.charCount < 0.5 * fullCount) {
    host = frags.reduce((best, f) => (f.charCount > best.charCount ? f : best), frags[0]!);
  }
  return { lineIdx: host.lineIdx, left: host.left, width: host.width };
}

export function buildLineData(
  lines: VisualLine[],
  annotations: LayoutAnnotation[],
  charWidth: number,
  charHeight: number,
  bandVariants?: Record<string, BandVariant>,
): LineDatum[] {
  void charHeight;
  const data: LineDatum[] = lines.map(([start, end]) => ({ start, end, bands: [], notes: [] }));

  for (const a of annotations) {
    const fullCount = a.endIndex - a.startIndex + 1;
    const frags: { lineIdx: number; left: number; width: number; charCount: number }[] = [];
    for (let li = 0; li < lines.length; li++) {
      const [ls, le] = lines[li]!;
      if (a.endIndex < ls || a.startIndex > le) continue;
      const cs = Math.max(a.startIndex, ls);
      const ce = Math.min(a.endIndex, le);
      const charCount = ce - cs + 1;
      frags.push({ lineIdx: li, left: (cs - ls) * charWidth, width: charCount * charWidth, charCount });
    }
    if (frags.length === 0) continue;

    const variant = bandVariants?.[a.id] ?? 'committed';
    for (const f of frags) {
      data[f.lineIdx]!.bands.push({ id: a.id, left: f.left, width: f.width, variant });
    }

    let host = frags[0]!;
    if (host.charCount < 0.5 * fullCount) {
      host = frags.reduce((best, f) => (f.charCount > best.charCount ? f : best), frags[0]!);
    }
    if (a.noteText.trim()) {
      data[host.lineIdx]!.notes.push({ id: a.id, left: host.left, width: host.width, text: a.noteText });
    }
  }

  return data;
}
