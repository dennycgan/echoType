import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { PageError } from './page-status/PageError';
import { Sentry } from '../lib/sentry';

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
    <div className="mx-auto max-w-lg px-4 py-8">
      <PageError title="Unexpected error" description={message} />
    </div>
  );
}
