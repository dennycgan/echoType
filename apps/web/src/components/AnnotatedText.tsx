import { memo, useMemo, type Ref } from 'react';
import {
  NOTE_FONT_PX,
  NOTE_LINE_PX,
  NOTE_MAX_LINES,
  NOTE_SLOT_PX,
  buildLineData,
  type Band,
  type LineDatum,
  type Note,
} from './annotated-text/layoutUtils';
import { useTextMeasurement } from './annotated-text/useTextMeasurement';

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

function charClassName(ch: string, typedCh: string | undefined, isCursor: boolean): string {
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

const LineDecorations = memo(function LineDecorations({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null;
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
    <div className="mb-2.5 last:mb-0">
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

export function AnnotatedText({ content, annotations, typed = '', className }: AnnotatedTextProps) {
  const { refs, layout, chars } = useTextMeasurement(content);

  const lineData = useMemo(
    () =>
      buildLineData(
        layout.lines,
        annotations.map((a) => ({
          id: a.id,
          startIndex: a.startIndex,
          endIndex: a.endIndex,
          noteText: a.noteText,
        })),
        layout.charWidth,
        layout.charHeight,
        undefined,
        layout.charEdges,
      ),
    [layout, annotations],
  );

  return (
    <div
      className={`rounded-md border bg-white p-4 font-mono text-base leading-relaxed ${className ?? ''}`}
      data-testid="annotated-text"
    >
      <div ref={refs.boxRef as Ref<HTMLDivElement>} style={{ position: 'relative' }}>
        <div
          ref={refs.mirrorRef as Ref<HTMLDivElement>}
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
