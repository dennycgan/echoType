// Auth Phase 4 smoke (local only; NOT wired into CI).
//
// Prereq: API :3001 + web :5173; apps/web/.env VITE_COGNITO_*; apps/api/.env COGNITO_*.
// Part A: route guards (no Cognito account).
// Part B (optional): PROBE_COGNITO_AUTH=1 + TEST_USER_EMAIL/PASSWORD (verified user).
//
// Run:
//   node apps/web/scripts/auth-phase4-probe.mjs
//   PROBE_COGNITO_AUTH=1 TEST_USER_EMAIL=... TEST_USER_PASSWORD=... node apps/web/scripts/auth-phase4-probe.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

function loadDotEnv(relativeToScript, segments) {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), ...segments);
  try {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadDotEnv(import.meta.url, ['..', '.env']);
loadDotEnv(import.meta.url, ['..', '..', 'api', '.env']);

if (!process.env.VITE_COGNITO_USER_POOL_ID && process.env.COGNITO_USER_POOL_ID) {
  process.env.VITE_COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
}
if (!process.env.VITE_COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_ID) {
  process.env.VITE_COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;
}
if (!process.env.VITE_COGNITO_REGION && process.env.COGNITO_REGION) {
  process.env.VITE_COGNITO_REGION = process.env.COGNITO_REGION;
}

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function runUnitTests() {
  console.log('--- Part C: unit tests ---');
  execFileSync('pnpm', ['--filter', '@echotype/web', 'test:auth'], {
    stdio: 'inherit',
    cwd: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'),
  });
  console.log('Part C PASS');
}

async function runPartA(page) {
  console.log('--- Part A: guest browse + auth routes ---');

  await page.goto(WEB, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());

  await page.goto(`${WEB}/courses/short`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/courses\/short/, { timeout: 15_000 });
  assert(!page.url().includes('/login'), 'guest should browse /courses/short without login');
  await page.getByTestId('auth-login').waitFor({ timeout: 10_000 });

  await page.goto(`${WEB}/login?next=%2Fcourses%2Fshort`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/login/, { timeout: 10_000 });
  assert(page.url().includes('next='), `login should preserve next (${page.url()})`);

  console.log('Part A PASS');
}

function fetchAdminAccessToken() {
  const poolId = process.env.COGNITO_USER_POOL_ID ?? process.env.VITE_COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID ?? process.env.VITE_COGNITO_CLIENT_ID;
  const region = process.env.COGNITO_REGION ?? process.env.VITE_COGNITO_REGION ?? 'ap-southeast-2';
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!poolId || !clientId || !email || !password) {
    throw new Error('PROBE_COGNITO_AUTH requires COGNITO_* and TEST_USER_EMAIL/PASSWORD');
  }

  return execFileSync(
    'aws',
    [
      'cognito-idp',
      'admin-initiate-auth',
      '--user-pool-id',
      poolId,
      '--client-id',
      clientId,
      '--auth-flow',
      'ADMIN_NO_SRP_AUTH',
      '--auth-parameters',
      `USERNAME=${email},PASSWORD=${password}`,
      '--region',
      region,
      '--query',
      'AuthenticationResult.AccessToken',
      '--output',
      'text',
    ],
    { encoding: 'utf8' },
  ).trim();
}

async function runPartB(page) {
  console.log('--- Part B: login + API + logout ---');

  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  assert(email && password, 'TEST_USER_EMAIL/PASSWORD required for Part B');

  await page.goto(`${WEB}/courses/short`, { waitUntil: 'domcontentloaded' });
  const guestCourseId = await page.evaluate(() => {
    const key = 'echotype-guest-courses';
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error('guest store missing');
    const parsed = JSON.parse(raw);
    const id = crypto.randomUUID();
    const ts = new Date().toISOString();
    parsed.courses.push({
      id,
      title: 'Probe guest temp',
      content: 'hello probe',
      mode: 'SHORT',
      categoryId: null,
      description: null,
      annotations: [],
      createdAt: ts,
      updatedAt: ts,
      isReadOnly: false,
      source: 'guest',
    });
    localStorage.setItem(key, JSON.stringify(parsed));
    return id;
  });

  const guestNext = `/courses/${guestCourseId}/type`;
  await page.goto(
    `${WEB}/login?next=${encodeURIComponent(guestNext)}`,
    { waitUntil: 'networkidle' },
  );
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/courses\/short(?:\?|$)/, { timeout: 15_000 });
  assert(!page.url().includes(guestCourseId), 'guest temp typing next should redirect to list');

  const displayName = await page.getByTestId('auth-display-name').textContent();
  assert(displayName && displayName.trim().length > 0, 'header nickname missing');

  const token = await page.evaluate(async () => {
    const raw = localStorage.getItem('echotype.auth.session');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed.accessToken ?? '';
  });
  assert(token.length > 100, 'session access token missing');

  const apiRes = await fetch(`${API}/api/courses?mode=SHORT&categoryId=null`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(apiRes.status === 200, `API courses -> ${apiRes.status}`);

  await page.getByTestId('auth-logout').click();
  await page.waitForURL(/\/login/, { timeout: 10_000 });

  await page.goto(`${WEB}/courses/short`, { waitUntil: 'networkidle' });
  assert(!page.url().includes('/login'), 'after logout, guest can still browse courses');

  console.log('Part B PASS');
}

async function main() {
  console.log(`WEB: ${WEB}  API: ${API}`);
  runUnitTests();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await runPartA(page);

    if (process.env.PROBE_COGNITO_AUTH === '1') {
      fetchAdminAccessToken(); // sanity: AWS creds + user exist
      await runPartB(page);
      console.log('SUMMARY PASS (Part C + A + B)');
    } else {
      console.log('SUMMARY PASS (Part C + A); set PROBE_COGNITO_AUTH=1 for Part B');
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
