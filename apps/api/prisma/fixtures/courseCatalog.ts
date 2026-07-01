import { ONBOARDING_COURSES as SHARED_ONBOARDING } from '@echotype/shared';

/**
 * Phase 6 onboarding catalog — canonical data lives in @echotype/shared.
 * Re-export for API seed scripts that import this path.
 */
export const ONBOARDING_COURSES = SHARED_ONBOARDING.map(
  ({ stableId: _stableId, ...def }) => def,
);

export type { CatalogCourseDef } from '@echotype/shared';
