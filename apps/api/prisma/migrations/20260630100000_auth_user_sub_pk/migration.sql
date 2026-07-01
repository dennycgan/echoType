-- Auth Phase 2: purge walking-skeleton demo user (cascades courses/collections/sessions).
-- Onboarding course text lives in prisma/fixtures/courseCatalog.ts (extracted before this migration).
DELETE FROM "users" WHERE "id" = 'demo-user';

-- Cognito sub is supplied by the app; email and nickname are required at registration.
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "name" SET NOT NULL;
