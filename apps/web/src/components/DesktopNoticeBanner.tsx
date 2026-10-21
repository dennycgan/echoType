import { useState } from 'react';
import {
  DESKTOP_NOTICE_COPY,
  readCoarsePointerMedia,
  shouldShowDesktopNotice,
} from '../lib/desktopNotice';

function initialVisible(): boolean {
  const { hoverNone, pointerCoarse } = readCoarsePointerMedia();
  return shouldShowDesktopNotice({
    hoverNone,
    pointerCoarse,
    dismissed: false,
  });
}

/** Soft tip for phone-like primary input; dismiss lasts only for this AppLayout mount. */
export function DesktopNoticeBanner() {
  const [visible, setVisible] = useState(initialVisible);

  if (!visible) return null;

  function onDismiss() {
    setVisible(false);
  }

  return (
    <div
      className="shrink-0 border-b-2 border-slate-400 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 dark:border-serika-sub dark:bg-serika-raised dark:text-serika-text"
      role="status"
      data-testid="desktop-notice-banner"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <svg
            className="h-5 w-5 shrink-0 text-slate-700 dark:text-serika-text"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Simple monitor + keyboard mark */}
            <rect x="3" y="4" width="18" height="12" rx="1.5" />
            <path d="M8 20h8" />
            <path d="M12 16v4" />
            <path d="M7 10h10" />
          </svg>
          <p className="min-w-0 flex-1 font-semibold leading-snug">{DESKTOP_NOTICE_COPY}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded px-1.5 py-0.5 text-base font-medium text-slate-600 hover:bg-slate-300/70 hover:text-slate-900 dark:text-serika-sub dark:hover:bg-serika-bg dark:hover:text-serika-text"
          aria-label="Dismiss notice"
          data-testid="desktop-notice-dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
