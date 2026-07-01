// Auth Phase 3 JWT smoke (local only; NOT wired into CI).
//
// Prereq: API on :3001 with COGNITO_* env set.
// Part A (always): public health + 401 matrix.
// Part B (optional): TEST_ACCESS_TOKEN and/or PROBE_COGNITO_AUTH=1 + TEST_USER_EMAIL/PASSWORD.
//
// Run:
//   node apps/api/scripts/auth-phase3-jwt-probe.mjs
//   TEST_ACCESS_TOKEN='eyJ...' node apps/api/scripts/auth-phase3-jwt-probe.mjs
//   PROBE_COGNITO_AUTH=1 TEST_USER_EMAIL=... TEST_USER_PASSWORD=... node apps/api/scripts/auth-phase3-jwt-probe.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadApiDotEnv() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
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
    // apps/api/.env is optional when env vars are exported in the shell
  }
}

loadApiDotEnv();

const API = process.env.API_URL ?? 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body != null) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}/api${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { status: res.status, json, text };
}

function fetchAdminAccessToken() {
  const poolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  const region = process.env.COGNITO_REGION ?? 'ap-southeast-2';
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!poolId || !clientId || !email || !password) {
    throw new Error('PROBE_COGNITO_AUTH requires COGNITO_* and TEST_USER_EMAIL/PASSWORD');
  }

  const token = execFileSync(
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

  assert(token.length > 100, 'admin-initiate-auth returned empty token');
  return token;
}

async function runPartA() {
  console.log('--- Part A: public health + 401 matrix ---');

  const health = await api('GET', '/health');
  assert(health.status === 200, `health status ${health.status}`);
  assert(health.json?.ok === true, 'health body ok');
  assert(health.json?.demoUser === undefined, 'health must not expose demoUser');

  const noAuth = await api('GET', '/courses');
  assert(noAuth.status === 401, `courses without token -> ${noAuth.status}`);
  assert(noAuth.json?.error === 'unauthorized', 'unauthorized error');

  const badToken = await api('GET', '/courses', { token: 'invalid' });
  assert(badToken.status === 401, `invalid token -> ${badToken.status}`);

  const emptyBearer = await api('GET', '/courses', { token: '' });
  assert(emptyBearer.status === 401, `empty bearer -> ${emptyBearer.status}`);

  const options = await fetch(`${API}/api/courses`, {
    method: 'OPTIONS',
    headers: {
      Origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  assert(options.status !== 401, `OPTIONS must not require auth -> ${options.status}`);
  assert(options.status < 400, `OPTIONS -> ${options.status}`);

  console.log('Part A PASS');
}

async function runPartB(token) {
  console.log('--- Part B: authenticated requests ---');

  const authed = await api('GET', '/courses', { token });
  assert(authed.status === 200, `authed courses -> ${authed.status} ${authed.text}`);
  assert(Array.isArray(authed.json), 'courses is array');

  const title = `Auth Phase3 probe ${Date.now()}`;
  const created = await api('POST', '/courses', {
    token,
    body: {
      title,
      content: 'Probe course for JWT isolation.',
      mode: 'SHORT',
      annotations: [],
    },
  });
  assert(created.status === 201, `create course -> ${created.status}`);

  const listed = await api('GET', '/courses', { token });
  assert(listed.json.some((c) => c.title === title), 'created course visible to same user');

  const healthWithToken = await api('GET', '/health', { token });
  assert(healthWithToken.status === 200, 'health still public with token');

  console.log('Part B PASS');
}

async function main() {
  console.log(`API: ${API}`);
  await runPartA();

  let token = process.env.TEST_ACCESS_TOKEN?.trim() || '';
  if (!token && process.env.PROBE_COGNITO_AUTH === '1') {
    console.log('Fetching access token via admin-initiate-auth...');
    token = fetchAdminAccessToken();
  }

  if (token) {
    await runPartB(token);
    console.log('SUMMARY PASS (Part A + B)');
  } else {
    console.log('Part B skipped (set TEST_ACCESS_TOKEN or PROBE_COGNITO_AUTH=1)');
    console.log('SUMMARY PASS (Part A only)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
