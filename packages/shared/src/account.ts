import { z } from 'zod';
import { hasGoogleIdentity, parseIdentitiesClaim } from './federatedClaims.js';

export const NICKNAME_MAX = 64;

export const UpdateAccountInput = z.object({
  name: z.string().trim().min(1, 'name is required').max(NICKNAME_MAX),
});

export type UpdateAccountInput = z.infer<typeof UpdateAccountInput>;

export type AccountDTO = {
  id: string;
  email: string;
  name: string;
  /** True when Google-only signup has not set a nickname yet (name is empty). */
  needsNicknameSetup: boolean;
  /** null = onboarding hook not yet handled; see User.onboardingSeededAt / ADR-0015 §20. */
  onboardingSeededAt: string | null;
  /**
   * Pure Google user (Cognito EXTERNAL_PROVIDER + Google identity) may add a
   * permanent password via POST /account/set-password. Computed live from
   * AdminGetUser on every GET /account so it flips to false immediately after
   * the password is set. L2-linked users are CONFIRMED, so they are excluded.
   */
  canSetPassword: boolean;
};

/** Matches infra/cognito.tf password_policy (symbols not required); mirror of apps/web passwordPolicy. */
export const SetPasswordInput = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .regex(/[a-z]/, 'Password must include a lowercase letter.')
    .regex(/[A-Z]/, 'Password must include an uppercase letter.')
    .regex(/[0-9]/, 'Password must include a number.'),
});

export type SetPasswordInput = z.infer<typeof SetPasswordInput>;

/**
 * Pure Google user = signed in only through Google, never had a password.
 * Cognito keeps such users at EXTERNAL_PROVIDER; AdminSetUserPassword flips
 * them to CONFIRMED, after which this returns false.
 */
export function isPureGoogleCognitoUser(
  userStatus: string | undefined,
  identitiesRaw: string | undefined,
): boolean {
  return userStatus === 'EXTERNAL_PROVIDER' && hasGoogleIdentity(parseIdentitiesClaim(identitiesRaw));
}

export function needsNicknameSetup(name: string): boolean {
  return name.trim() === '';
}

/** Register blocked when Cognito/Postgres already has this email (any sign-in method). */
export const EMAIL_ALREADY_EXISTS_MESSAGE = 'An account with this email already exists.';

export const DELETE_CONFIRMATION_TEXT = 'DELETE' as const;

export function isDeleteConfirmationValid(input: string): boolean {
  return input.trim() === DELETE_CONFIRMATION_TEXT;
}
