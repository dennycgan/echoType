import * as Sentry from '@sentry/node';
import { ZodError } from 'zod';
import type { ErrorEvent, EventHint } from '@sentry/node';

const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'set-cookie']);

export function isSentryEnabled(dsn: string | undefined): boolean {
  return Boolean(dsn);
}

export function shouldReportError(error: unknown): boolean {
  return !(error instanceof ZodError);
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
  const dsn = process.env.SENTRY_DSN;
  if (!isSentryEnabled(dsn)) return;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  });
}

export function captureApiException(error: unknown): void {
  if (!shouldReportError(error) || !isSentryEnabled(process.env.SENTRY_DSN)) return;
  Sentry.captureException(error);
}

export { Sentry };
