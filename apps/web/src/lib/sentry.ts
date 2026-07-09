import * as Sentry from '@sentry/react';
import type { ErrorEvent, EventHint } from '@sentry/react';

const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'set-cookie']);

export function isSentryEnabled(dsn: string | undefined, prod: boolean): boolean {
  return prod && Boolean(dsn);
}

export function scrubSentryEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
        delete event.request.headers[key];
      }
    }
  }
  return event;
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!isSentryEnabled(dsn, import.meta.env.PROD)) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  });
}

export function maybeCaptureSentryTest(): void {
  if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('sentry_test') !== '1') return;
  Sentry.captureException(new Error('EchoType Sentry web probe'));
}

export { Sentry };
