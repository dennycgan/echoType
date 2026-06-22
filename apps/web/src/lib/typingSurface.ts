/** Shared visual tokens for passage + typing textarea (parallel surfaces). */
export const TYPING_SURFACE_CLASS =
  'rounded-md border bg-white p-4 font-mono text-base leading-relaxed';

export const TYPING_TEXTAREA_CLASS = `${TYPING_SURFACE_CLASS} w-full resize-none overflow-y-auto whitespace-pre-wrap break-words text-slate-900 focus:border-slate-500 focus:outline-none max-h-[40vh]`;

/** Visually hidden but focusable — immersive mode still captures keyboard/paste. */
export const TYPING_TEXTAREA_IMMERSIVE_CLASS =
  'sr-only fixed left-0 top-0 h-px w-px resize-none overflow-hidden opacity-0';

export const IMMERSIVE_MODE_STORAGE_KEY = 'echotype-immersive-mode';

/** Whole-second duration as minutes:seconds (e.g. 0:07, 2:05). */
export function formatTypingDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
