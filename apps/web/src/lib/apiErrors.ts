import { ApiError, getApiErrorStatus } from './api';

export type QueryErrorCopy = {
  title: string;
  description: string;
  retryable: boolean;
};

export function describeQueryError(error: unknown): QueryErrorCopy {
  const status = getApiErrorStatus(error);

  if (status === 0) {
    return {
      title: 'Connection problem',
      description: 'Network error. Check your connection and try again.',
      retryable: true,
    };
  }

  if (status === 401) {
    return {
      title: 'Sign in required',
      description: 'Please sign in to view this content.',
      retryable: false,
    };
  }

  if (status === 404 || status === 410) {
    return {
      title: 'Not found',
      description: 'This item was deleted or is no longer available.',
      retryable: false,
    };
  }

  if (status != null && status >= 500) {
    return {
      title: 'Something went wrong',
      description: 'Our server had trouble loading this page. Please try again.',
      retryable: true,
    };
  }

  if (error instanceof ApiError && typeof error.message === 'string' && error.message) {
    return {
      title: 'Something went wrong',
      description: error.message,
      retryable: true,
    };
  }

  return {
    title: 'Something went wrong',
    description: 'We could not load this page. Please try again.',
    retryable: true,
  };
}
