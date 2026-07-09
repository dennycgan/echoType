import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Sentry } from '../lib/sentry';
import { useEffect } from 'react';

export function SentryRouteError() {
  const error = useRouteError();

  useEffect(() => {
    if (isRouteErrorResponse(error)) return;
    Sentry.captureException(error);
  }, [error]);

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something went wrong';

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold text-stone-800">Unexpected error</h1>
      <p className="text-sm text-stone-600">{message}</p>
      <a href="/" className="text-sm text-amber-800 underline hover:text-amber-900">
        Back to home
      </a>
    </div>
  );
}
