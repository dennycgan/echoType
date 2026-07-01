/**
 * Prisma seed entry. Production deploy does not run this script.
 * Local dev: SEED_ENV=dev pnpm --filter @echotype/api seed
 */
if (process.env.SEED_ENV !== 'dev') {
  console.log('Seed skipped (set SEED_ENV=dev for local dev seed).');
  process.exit(0);
}

await import('./seed.dev.js');
