// Ops Phase 1 Sentry smoke (local build / post-deploy; NOT wired into CI).
//
// Part A (always): built dist must not contain .map files.
// Part B (PROBE_SENTRY=1): prints web acceptance URL for manual Sentry check.
//
// Run:
//   node apps/web/scripts/ops-sentry-probe.mjs
//   PROBE_SENTRY=1 node apps/web/scripts/ops-sentry-probe.mjs

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'apps/web/dist');

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function listMapFiles(dir) {
  const maps = [];
  if (!existsSync(dir)) return maps;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      maps.push(...listMapFiles(full));
    } else if (entry.endsWith('.map')) {
      maps.push(full);
    }
  }
  return maps;
}

function partA() {
  if (!existsSync(DIST)) {
    console.log('Part A skipped: apps/web/dist not found (run pnpm --filter @echotype/web build first)');
    return;
  }

  const maps = listMapFiles(DIST);
  assert(maps.length === 0, `dist must not contain source maps before S3 sync: ${maps.join(', ')}`);
  console.log('Part A OK: no .map files in dist');
}

function partB() {
  if (process.env.PROBE_SENTRY !== '1') {
    console.log('Part B skipped (set PROBE_SENTRY=1 to print acceptance URL)');
    return;
  }

  const origin = process.env.WEB_ORIGIN ?? 'https://echotype.ink';
  console.log(`Part B: open ${origin}/?sentry_test=1 and confirm issue in Sentry echotype-web`);
}

partA();
partB();
console.log('ops-sentry-probe complete');
