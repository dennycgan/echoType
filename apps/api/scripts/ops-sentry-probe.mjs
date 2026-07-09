// Ops Phase 1 Sentry smoke (local / post-deploy; NOT wired into CI).
//
// Part A (always): health + optional debug-route guard.
// Part B (PROBE_SENTRY=1): trigger API probe route (requires SENTRY_DEBUG=1 on API).
//
// Run:
//   node apps/api/scripts/ops-sentry-probe.mjs
//   PROBE_SENTRY=1 node apps/api/scripts/ops-sentry-probe.mjs

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

async function api(method, path, { token } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}/api${path}`, { method, headers });
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

async function partA() {
  const health = await api('GET', '/health');
  assert(health.status === 200, `health expected 200, got ${health.status}`);
  assert(health.json?.ok === true, 'health body missing ok:true');

  const unauthorized = await api('GET', '/courses');
  assert(unauthorized.status === 401, `unauthenticated courses expected 401, got ${unauthorized.status}`);

  const debug = await api('GET', '/debug/sentry');
  assert(debug.status === 404, `debug route must be hidden without SENTRY_DEBUG=1 (got ${debug.status})`);

  console.log('Part A OK: health, 401 guard, debug route hidden');
}

async function partB() {
  if (process.env.PROBE_SENTRY !== '1') {
    console.log('Part B skipped (set PROBE_SENTRY=1 and SENTRY_DEBUG=1 on API to run)');
    return;
  }

  if (process.env.SENTRY_DEBUG !== '1') {
    throw new Error('Part B requires SENTRY_DEBUG=1 on the running API');
  }

  const probe = await api('GET', '/debug/sentry');
  assert(probe.status === 500, `debug probe expected 500, got ${probe.status}`);
  console.log('Part B OK: API probe returned 500 — confirm issue in Sentry echotype-api');
}

await partA();
await partB();
console.log('ops-sentry-probe complete');
