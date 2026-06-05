import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  RESIZE_DEBOUNCE_MS,
  measureVisualLines,
  sameLines,
  toChars,
  type MeasuredLayout,
  type VisualLine,
} from './layoutUtils';

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
    else reason = 'strict-remount';
  }
  const w = window as unknown as { __atMeasureLog?: unknown[] };
  (w.__atMeasureLog ||= []).push({ t: Math.round(performance.now()), reason, lines: lineCount });
  // eslint-disable-next-line no-console
  console.log(`[AnnotatedText] measure reason=${reason} lines=${lineCount}`);
}

export type TextMeasurementRefs = {
  boxRef: RefObject<HTMLDivElement | null>;
  mirrorRef: RefObject<HTMLDivElement | null>;
};

export function useTextMeasurement(content: string): {
  refs: TextMeasurementRefs;
  layout: MeasuredLayout;
  chars: string[];
} {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const prevDepsRef = useRef<{ content: string; width: number; fontReady: boolean } | null>(null);

  const [width, setWidth] = useState(0);
  const [fontReady, setFontReady] = useState(false);
  const [layout, setLayout] = useState<MeasuredLayout>({ lines: [], charWidth: 0, charHeight: 0 });

  const chars = useMemo(() => toChars(content), [content]);

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

  return { refs: { boxRef, mirrorRef }, layout, chars };
}
