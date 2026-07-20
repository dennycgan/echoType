/** Scroll passage only when the typing cursor leaves the visible area (with padding). */
export function scrollPassageToTypingCursor(
  container: HTMLElement,
  paddingPx = 24,
): void {
  const cursor = container.querySelector<HTMLElement>('[data-typing-cursor]');
  if (!cursor) return;

  const containerRect = container.getBoundingClientRect();
  const cursorRect = cursor.getBoundingClientRect();

  if (
    cursorRect.top >= containerRect.top + paddingPx &&
    cursorRect.bottom <= containerRect.bottom - paddingPx
  ) {
    return;
  }

  let delta = 0;
  if (cursorRect.top < containerRect.top + paddingPx) {
    delta = cursorRect.top - (containerRect.top + paddingPx);
  } else if (cursorRect.bottom > containerRect.bottom - paddingPx) {
    delta = cursorRect.bottom - (containerRect.bottom - paddingPx);
  }

  if (delta !== 0) {
    container.scrollTop += delta;
  }
}

/**
 * Pin the immersive 1px textarea over the passage typing cursor so the browser's
 * caret scroll-into-view (esp. under pinch-zoom) does not pan to the input panel.
 */
export function positionImmersiveTextareaAtCursor(
  textarea: HTMLTextAreaElement,
  passage: HTMLElement,
  panel: HTMLElement,
): void {
  const cursor = passage.querySelector<HTMLElement>('[data-typing-cursor]');
  const panelRect = panel.getBoundingClientRect();
  if (!cursor) {
    textarea.style.left = '0px';
    textarea.style.top = '0px';
    return;
  }
  const cursorRect = cursor.getBoundingClientRect();
  textarea.style.left = `${Math.round(cursorRect.left - panelRect.left)}px`;
  textarea.style.top = `${Math.round(cursorRect.top - panelRect.top)}px`;
}

export function clearImmersiveTextareaPosition(textarea: HTMLTextAreaElement): void {
  textarea.style.left = '';
  textarea.style.top = '';
}

/** Keep the caret visible inside a fixed-height (two-line) textarea. */
export function scrollTextareaToCaret(textarea: HTMLTextAreaElement, visibleLines = 2): void {
  const style = getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(style.lineHeight) || 26;
  const textBeforeCaret = textarea.value.slice(0, textarea.selectionStart);
  const lineIndex = textBeforeCaret.split('\n').length - 1;
  const targetLine = Math.max(0, lineIndex - visibleLines + 1);
  textarea.scrollTop = targetLine * lineHeight;
}
