const PUBLIC_AUTH_PATHS = new Set(['/login', '/register', '/verify-email']);

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.has(pathname);
}

export function loginPathWithNext(nextPath: string): string {
  const params = new URLSearchParams();
  if (nextPath && nextPath !== '/login') params.set('next', nextPath);
  const qs = params.toString();
  return `/login${qs ? `?${qs}` : ''}`;
}
