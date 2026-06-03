import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Read-only annotated text renderer (Phase 2.0).
//
// Architecture (see kickoff spec + Phase 2 design):
//   - A hidden, full-width "mirror" holds the whole content in normal flow
//     (white-space: pre-wrap). It is the single source of truth for where the
//     browser wraps. We measure visual-line index ranges from it via each
//     char span's offsetTop (integer -> stable grouping).
//   - The visible layer renders ONE block per measured visual line with
//     white-space: pre (never re-wraps), so it reproduces the mirror's breaks
//     exactly. This is what lets a line with no annotation collapse its slot.
//   - Two decoupled update paths:
//       * lines/charWidth/charHeight (layout) -> only re-measured on
//         [content, width, fontReady]. NEVER on a keystroke.
//       * per-char typed status -> flows through memoized <Char> so a keystroke
//         only mutates the 1-2 chars that changed, never the line structure.

export type CharStatus = 'untyped' | 'correct' | 'wrong' | 'cursor';

export interface AnnotationView {
  id: string;
  startIndex: number;
  endIndex: number; // inclusive, matches the API contract
  noteText: string;
}

interface AnnotatedTextProps {
  content: string;
  annotations: AnnotationView[];
  typed?: string; // typing page passes this; editor (Phase 3) omits it
  className?: string;
}

const RESIZE_DEBOUNCE_MS = 100;
// NOTE_FONT_PX is fixed at 12px (instead of dynamic shrinking from
// default down to 11px as originally specified in kickoff doc).
// Rationale: per-note measurement overhead during resize would scale
// with annotation count (80x cost for 20 annotations) for a visual
// difference that users do not notice. Falls back to ellipsis +
// hover tooltip when content exceeds 2 lines.
const NOTE_FONT_PX = 12;
const NOTE_LINE_PX = 15;
const NOTE_MAX_LINES = 2;
const NOTE_SLOT_PX = NOTE_LINE_PX * NOTE_MAX_LINES + 2;

type VisualLine = [start: number, end: number]; // inclusive char indices

type MeasuredLayout = {
  lines: VisualLine[];
  charWidth: number;
  charHeight: number;
};

type Band = { id: string; left: number; width: number };
type Note = { id: string; left: number; width: number; text: string };
type LineDatum = { start: number; end: number; bands: Band[]; notes: Note[] };

// Split by UTF-16 code unit so indices line up 1:1 with the annotation index
// semantics locked in the spec.
function toChars(content: string): string[] {
  return content.split('');
}

function measureVisualLines(charEls: HTMLElement[]): VisualLine[] {
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

function sameLines(a: VisualLine[], b: VisualLine[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai[0] !== bi[0] || ai[1] !== bi[1]) return false;
  }
  return true;
}

// Map measured lines + annotations to per-line highlight bands and note boxes.
//
// Note-text placement (revised spec):
//   1. default  -> the note hosts on rects[0] (the first visual fragment).
//   2. fallback -> if rects[0] is badly clipped (its char count < 50% of the
//      full anchor), host the note on the WIDEST fragment instead, so the text
//      gets the most room rather than being stuck on a tiny sliver.
//   3. final fallback (handled in <NoteBox>) -> if even the host fragment can't
//      fit the note (still truncated after 2 lines), show a "…" badge at the
//      fragment's top-right; the full note stays available via hover tooltip.
// Every fragment still gets a highlight band; only the host fragment gets text.
function buildLineData(
  lines: VisualLine[],
  annotations: AnnotationView[],
  charWidth: number,
  charHeight: number,
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

    for (const f of frags) data[f.lineIdx]!.bands.push({ id: a.id, left: f.left, width: f.width });

    let host = frags[0]!;
    if (host.charCount < 0.5 * fullCount) {
      host = frags.reduce((best, f) => (f.charCount > best.charCount ? f : best), frags[0]!);
    }
    data[host.lineIdx]!.notes.push({ id: a.id, left: host.left, width: host.width, text: a.noteText });
  }

  return data;
}

function charClassName(ch: string, typedCh: string | undefined, isCursor: boolean): string {
  // This is the exact red/green rule from the original TextHighlight, preserved.
  if (typedCh !== undefined) {
    return typedCh === ch ? 'text-emerald-600' : 'rounded-sm bg-red-200 text-red-800';
  }
  if (isCursor) return 'underline decoration-2 underline-offset-2 text-slate-700';
  return 'text-slate-400';
}

const Char = memo(function Char({
  ch,
  typedCh,
  isCursor,
}: {
  ch: string;
  typedCh: string | undefined;
  isCursor: boolean;
}) {
  return (
    <span className={`relative z-[1] ${charClassName(ch, typedCh, isCursor)}`}>
      {ch === '\n' ? '' : ch}
    </span>
  );
});

// A single note preview, clamped to NOTE_MAX_LINES. When the text overflows the
// clamp, CSS shows its own ellipsis; hovering anywhere on the note area surfaces
// the full noteText via the native title tooltip (no separate "…" badge — the
// CSS ellipsis already signals "more on hover", the web's standard pattern).
const NoteBox = memo(function NoteBox({ note }: { note: Note }) {
  return (
    <span
      className="absolute top-0 block overflow-hidden text-amber-700"
      style={{
        left: note.left,
        width: note.width,
        fontSize: NOTE_FONT_PX,
        lineHeight: `${NOTE_LINE_PX}px`,
        display: '-webkit-box',
        WebkitLineClamp: NOTE_MAX_LINES,
        WebkitBoxOrient: 'vertical',
      }}
      title={note.text}
    >
      {note.text}
    </span>
  );
});

// Bands + note slot for one visual line. Depends only on layout/annotations
// (stable refs while content + width are unchanged), so memoization keeps it
// out of the per-keystroke render path entirely.
const LineDecorations = memo(function LineDecorations({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null; // collapse: no vertical space reserved
  return (
    <div className="relative" style={{ height: NOTE_SLOT_PX }}>
      {notes.map((n) => (
        <NoteBox key={n.id} note={n} />
      ))}
    </div>
  );
});

const BandLayer = memo(function BandLayer({
  bands,
  charHeight,
}: {
  bands: Band[];
  charHeight: number;
}) {
  if (bands.length === 0) return null;
  return (
    <>
      {bands.map((b, i) => (
        <span
          key={`${b.id}-${i}`}
          aria-hidden
          className="absolute left-0 top-0 z-0 rounded-sm bg-amber-100"
          style={{ left: b.left, width: b.width, height: charHeight || '1.6em' }}
        />
      ))}
    </>
  );
});

const LineRow = memo(function LineRow({
  datum,
  chars,
  typed,
  charHeight,
}: {
  datum: LineDatum;
  chars: string[];
  typed: string;
  charHeight: number;
}) {
  const indices: number[] = [];
  for (let i = datum.start; i <= datum.end; i++) indices.push(i);
  return (
    <div>
      <LineDecorations notes={datum.notes} />
      <div className="relative" style={{ whiteSpace: 'pre' }}>
        <BandLayer bands={datum.bands} charHeight={charHeight} />
        <span className="relative z-[1]">
          {indices.map((i) => (
            <Char
              key={i}
              ch={chars[i] ?? ''}
              typedCh={i < typed.length ? typed[i] : undefined}
              isCursor={i === typed.length}
            />
          ))}
        </span>
      </div>
    </div>
  );
});

function logMeasure(
  prev: { content: string; width: number; fontReady: boolean } | null,
  next: { content: string; width: number; fontReady: boolean },
  lineCount: number,
) {
  let reason: 'mount' | 'content' | 'font' | 'resize' | 'strict-remount' | '???' = 'mount';
  if (prev) {
    if (prev.content !== next.content) reason = 'content';
    else if (prev.fontReady !== next.fontReady) reason = 'font';
    else if (prev.width !== next.width) reason = 'resize';
    // Identical deps re-run only happens via React 18 StrictMode's dev-only
    // mount double-invoke (no StrictMode in prod). Anything else reaching here
    // with unchanged deps would be a genuine anomaly -> '???'.
    else reason = 'strict-remount';
  }
  const w = window as unknown as { __atMeasureLog?: unknown[] };
  (w.__atMeasureLog ||= []).push({ t: Math.round(performance.now()), reason, lines: lineCount });
  // eslint-disable-next-line no-console
  console.log(`[AnnotatedText] measure reason=${reason} lines=${lineCount}`);
}

export function AnnotatedText({ content, annotations, typed = '', className }: AnnotatedTextProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const prevDepsRef = useRef<{ content: string; width: number; fontReady: boolean } | null>(null);

  const [width, setWidth] = useState(0);
  const [fontReady, setFontReady] = useState(false);
  const [layout, setLayout] = useState<MeasuredLayout>({ lines: [], charWidth: 0, charHeight: 0 });

  const chars = useMemo(() => toChars(content), [content]);

  // Wait for web fonts so metrics are final before we trust measurements. This
  // project falls back to system monospace (no @font-face), so it resolves
  // immediately, but the guard keeps us correct if a font is added later.
  useEffect(() => {
    let alive = true;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        if (alive) setFontReady(true);
      });
    } else {
      setFontReady(true);
    }
    return () => {
      alive = false;
    };
  }, []);

  // Debounced width tracking. Width is a re-measure trigger; the actual width is
  // read live in the layout effect. Resize is off the typing path entirely.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    setWidth(box.clientWidth);
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      if (t) clearTimeout(t);
      t = setTimeout(() => setWidth(w), RESIZE_DEBOUNCE_MS);
    });
    ro.observe(box);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, []);

  // Synchronous (pre-paint) measurement. Depends ONLY on content/width/fontReady
  // -> never runs for a keystroke. A dev probe logs every run with its reason so
  // we can prove the "typing does not trigger layout" invariant (stop-loss b-1).
  useLayoutEffect(() => {
    const box = boxRef.current;
    const mirror = mirrorRef.current;
    if (!box || !mirror) return;
    const liveWidth = box.clientWidth;
    if (liveWidth === 0) return;

    const charEls = Array.from(mirror.querySelectorAll<HTMLElement>('[data-idx]'));
    const lines = measureVisualLines(charEls);
    const first = charEls[0];
    const rect = first ? first.getBoundingClientRect() : null;
    const charWidth = rect ? rect.width : 0;
    const charHeight = rect ? rect.height : 0;

    if (import.meta.env.DEV) {
      logMeasure(prevDepsRef.current, { content, width, fontReady }, lines.length);
    }
    prevDepsRef.current = { content, width, fontReady };

    setLayout((prev) =>
      sameLines(prev.lines, lines) && prev.charWidth === charWidth && prev.charHeight === charHeight
        ? prev
        : { lines, charWidth, charHeight },
    );
  }, [content, width, fontReady]);

  // Dev-only hook so the Playwright harness can re-run measurement N times and
  // assert byte-identical results (stop-loss c: getClientRects stability).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __atMeasureNow?: () => VisualLine[] | null };
    w.__atMeasureNow = () => {
      const mirror = mirrorRef.current;
      if (!mirror) return null;
      const els = Array.from(mirror.querySelectorAll<HTMLElement>('[data-idx]'));
      return measureVisualLines(els);
    };
    return () => {
      delete w.__atMeasureNow;
    };
  }, []);

  const lineData = useMemo(
    () => buildLineData(layout.lines, annotations, layout.charWidth, layout.charHeight),
    [layout, annotations],
  );

  return (
    <div
      className={`rounded-md border bg-white p-4 font-mono text-base leading-relaxed ${className ?? ''}`}
      data-testid="annotated-text"
    >
      <div ref={boxRef} style={{ position: 'relative' }}>
        {/* Hidden measurement mirror: full content in normal flow. */}
        <div
          ref={mirrorRef}
          aria-hidden
          data-testid="annotated-mirror"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            visibility: 'hidden',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
          }}
        >
          {chars.map((ch, i) => (
            <span key={i} data-idx={i}>
              {ch}
            </span>
          ))}
        </div>

        {/* Visible per-line layer. */}
        <div data-testid="annotated-visible">
          {lineData.map((datum) => (
            <LineRow
              key={`${datum.start}-${datum.end}`}
              datum={datum}
              chars={chars}
              typed={typed}
              charHeight={layout.charHeight}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
