/** Reset window/document scroll — html is the scrolling element in this app (body stays 0). */
export function scrollRouteToTop(): void {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function disableBrowserScrollRestoration(): void {
  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
}

/** DEV: log scroll positions shortly after route changes to catch restoration races. */
export function logRouteScrollMonitor(pathname: string, phase: string): void {
  if (!import.meta.env.DEV) return;
  console.debug('[route-scroll]', phase, pathname, {
    windowY: window.scrollY,
    docEl: document.documentElement.scrollTop,
    body: document.body.scrollTop,
    scrollRestoration: history.scrollRestoration,
  });
}
