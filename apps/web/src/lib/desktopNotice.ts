/** Dismissible “best on a computer” notice for coarse primary pointers (phones). */

export const DESKTOP_NOTICE_DISMISSED_STORAGE_KEY = 'echotype.desktopNotice.dismissed.v1';

export const DESKTOP_NOTICE_COPY = 'Best on a computer with a keyboard.';

export type DesktopNoticeInputs = {
  hoverNone: boolean;
  pointerCoarse: boolean;
  dismissed: boolean;
};

/** Show when the primary input looks phone-like and the notice was not dismissed. */
export function shouldShowDesktopNotice(input: DesktopNoticeInputs): boolean {
  return input.hoverNone && input.pointerCoarse && !input.dismissed;
}

/** `true` only when the dismissed flag is present; storage errors → not dismissed. */
export function readDesktopNoticeDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(DESKTOP_NOTICE_DISMISSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist dismissal; returns whether the write succeeded. */
export function writeDesktopNoticeDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(DESKTOP_NOTICE_DISMISSED_STORAGE_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export type MatchMediaLike = {
  matchMedia?: (query: string) => { matches: boolean };
};

/** Read coarse-pointer media queries; missing matchMedia → treat as desktop (do not show). */
export function readCoarsePointerMedia(win: MatchMediaLike = globalThis): {
  hoverNone: boolean;
  pointerCoarse: boolean;
} {
  if (typeof win.matchMedia !== 'function') {
    return { hoverNone: false, pointerCoarse: false };
  }
  try {
    return {
      hoverNone: win.matchMedia('(hover: none)').matches,
      pointerCoarse: win.matchMedia('(pointer: coarse)').matches,
    };
  } catch {
    return { hoverNone: false, pointerCoarse: false };
  }
}
