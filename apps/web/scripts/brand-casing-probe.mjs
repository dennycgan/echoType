// Brand display-name casing smoke (local; NOT wired into CI).
// Fails if the old product casing appears under scoped paths.
// Display name is echoType; do not rewrite historical ADR bodies (out of scope).
//
// Run:
//   node apps/web/scripts/brand-casing-probe.mjs

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const ROOT = process.cwd();
// Built without a contiguous old-casing literal so this file does not fail its own scan.
const OLD_BRAND = new RegExp('\\b' + 'Echo' + 'Type' + '\\b');

/** Paths relative to repo root that must not contain the old brand casing. */
const SCAN_ROOTS = [
  join(ROOT, 'apps/web'),
  join(ROOT, 'packages/shared/src/onboardingCatalog.ts'),
];

const SKIP_DIR_NAMES = new Set(['node_modules', 'dist', '.git', 'coverage']);
/** This probe mentions the forbidden pattern by construction; skip self. */
const SKIP_FILES = new Set(['brand-casing-probe.mjs']);

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function listFiles(path) {
  if (!existsSync(path)) return [];
  const st = statSync(path);
  if (st.isFile()) return [path];

  const files = [];
  for (const entry of readdirSync(path)) {
    if (SKIP_DIR_NAMES.has(entry)) continue;
    const full = join(path, entry);
    const child = statSync(full);
    if (child.isDirectory()) {
      files.push(...listFiles(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function isTextCandidate(filePath) {
  return /\.(tsx?|jsx?|mjs|cjs|html|css|json|md|svg|txt)$/i.test(filePath);
}

const hits = [];
for (const root of SCAN_ROOTS) {
  for (const file of listFiles(root)) {
    if (SKIP_FILES.has(basename(file))) continue;
    if (!isTextCandidate(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (!OLD_BRAND.test(text)) continue;
    const rel = relative(ROOT, file);
    for (const [i, line] of text.split('\n').entries()) {
      if (OLD_BRAND.test(line)) {
        hits.push(`${rel}:${i + 1}: ${line.trim()}`);
      }
    }
  }
}

assert(
  hits.length === 0,
  `found old brand casing (Echo+Type):\n${hits.join('\n')}`,
);
console.log('brand-casing-probe OK: no old brand casing under apps/web + onboardingCatalog');
