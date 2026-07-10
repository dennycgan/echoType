import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../auth/AuthLayout';
import {
  clearPendingOAuth,
  exchangeAuthorizationCode,
  sessionUsernameFromTokens,
  startGoogleSignIn,
  tokensToStoredSession,
  validateOAuthCallbackState,
} from '../../auth/cognitoOAuthExchange';
import { clearAuthSession, persistCognitoSession } from '../../auth/authSession';
import { resolvePostLoginPath, GUEST_LOGIN_TOAST } from '../../auth/resolvePostLoginPath';
import { api } from '../../lib/api';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const oauthError = params.get('error');
      if (oauthError) {
        setError('Sign-in was cancelled. Try again.');
        return;
      }

      const code = params.get('code');
      const nextPath = validateOAuthCallbackState(params.get('state'));
      if (!code || !nextPath) {
        setError('Sign-in expired or invalid. Try again.');
        clearPendingOAuth();
        return;
      }

      try {
        const tokens = await exchangeAuthorizationCode(code);
        const username = sessionUsernameFromTokens(tokens.access_token, tokens.id_token);
        const session = tokensToStoredSession(tokens, username);
        persistCognitoSession(username, {
          accessToken: session.accessToken,
          idToken: session.idToken,
          refreshToken: session.refreshToken,
        });

        const linkResult = await api.linkFederated(session.idToken);
        if (cancelled) return;

        if (linkResult.requiresReauth) {
          clearAuthSession();
          clearPendingOAuth();
          await startGoogleSignIn(nextPath);
          return;
        }

        const destination = resolvePostLoginPath(nextPath);
        if (destination !== nextPath) {
          sessionStorage.setItem('echotype.auth.flash', GUEST_LOGIN_TOAST);
        }
        window.location.assign(destination);
      } catch {
        if (!cancelled) {
          clearPendingOAuth();
          setError('Could not complete Google sign-in. Try again.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold">Signing in…</h1>
      {error ? (
        <>
          <p className="mt-3 text-sm text-red-600">{error}</p>
          <p className="mt-4 text-sm">
            <Link to="/login" className="text-slate-900 underline">
              Back to sign in
            </Link>
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Completing Google sign-in…</p>
      )}
    </AuthLayout>
  );
}
