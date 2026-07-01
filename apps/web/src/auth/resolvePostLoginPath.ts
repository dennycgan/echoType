import { isGuestTempCourseId } from '../guest/guestCoursesStore';

const TYPING_PATH_RE = /^\/courses\/([^/]+)\/type$/;

/**
 * After login, guest temp course ids do not exist in the API.
 * Redirect to mode list instead of a 404 typing page.
 */
export function resolvePostLoginPath(next: string, fallback = '/courses/short'): string {
  if (!next.startsWith('/')) return fallback;
  const match = TYPING_PATH_RE.exec(next.split('?')[0] ?? next);
  if (!match?.[1]) return next;
  if (isGuestTempCourseId(match[1])) return fallback;
  return next;
}

export const GUEST_LOGIN_TOAST =
  'Logged in — your temporary courses are still available when you browse as a guest.';
