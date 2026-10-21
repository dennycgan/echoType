/** In-session dismissible “best on a computer” notice for coarse primary pointers. */

export const DESKTOP_NOTICE_COPY = 'Best on a computer with a keyboard.';

export type DesktopNoticeInputs = {
  hoverNone: boolean;
  pointerCoarse: boolean;
  dismissed: boolean;
};

/** Show when the primary input looks phone-like and the notice was not dismissed this mount. */
export function shouldShowDesktopNotice(input: DesktopNoticeInputs): boolean {
  return input.hoverNone && input.pointerCoarse && !input.dismissed;
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
