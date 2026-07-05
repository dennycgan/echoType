import { useEffect, useLayoutEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { useOnboardingSeed } from './auth/useOnboardingSeed';
import { loginPathWithNext } from './auth/publicPaths';
import { SiteHeader } from './components/SiteHeader';
import { logRouteScrollMonitor, scrollRouteToTop } from './lib/routeScroll';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { displayName, logout, status } = useAuth();

  useOnboardingSeed();

  useLayoutEffect(() => {
    scrollRouteToTop();
    logRouteScrollMonitor(location.pathname, 'layout');
    const frame = requestAnimationFrame(() => {
      scrollRouteToTop();
      logRouteScrollMonitor(location.pathname, 'rAF');
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.pathname]);

  useEffect(() => {
    scrollRouteToTop();
    logRouteScrollMonitor(location.pathname, 'effect');
    const t = window.setTimeout(() => {
      scrollRouteToTop();
      logRouteScrollMonitor(location.pathname, 't+0ms');
    }, 0);
    const tLate = window.setTimeout(() => {
      logRouteScrollMonitor(location.pathname, 't+100ms');
    }, 100);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(tLate);
    };
  }, [location.key, location.pathname]);

  function onLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-full">
      <SiteHeader
        trailing={
          status === 'authed' ? (
            <>
              {displayName && (
                <Link
                  to="/account"
                  className="text-sm text-slate-600 underline hover:text-slate-900"
                  data-testid="auth-display-name"
                >
                  {displayName}
                </Link>
              )}
              <button
                type="button"
                onClick={onLogout}
                className="text-sm text-slate-600 hover:text-slate-900"
                data-testid="auth-logout"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              to={loginPathWithNext(location.pathname + location.search)}
              className="text-sm font-medium text-slate-900 hover:underline"
              data-testid="auth-login"
            >
              Log in
            </Link>
          )
        }
      />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
