/** Shared copy for set-password and change-password → re-auth on /login. */

export const PASSWORD_CHANGED_LOGIN_MESSAGE =
  'New password set successfully. Sign in again with your email and the new password.';

/** Shown under Save / Update password on /account. */
export const PASSWORD_CHANGE_SIGNOUT_NOTICE =
  'Saving will sign you out. Sign in again with your email and the new password.';

/** Query flag consumed by LoginPage (also used after forgot-password via ?reset=1). */
export const PASSWORD_REAUTH_LOGIN_PATH = '/login?pwset=1';
