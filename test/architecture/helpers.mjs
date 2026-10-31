import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HELPERS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HELPERS_DIR, '../..');

export const PACKAGE_NAMES = {
  web: '@echotype/web',
  api: '@echotype/api',
  shared: '@echotype/shared',
};

export const DOCUMENT_DARK_SOLE_WRITER = 'apps/web/src/lib/DocumentDarkProvider.tsx';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** @param {string} filePath Absolute or repo-relative path */
export function toRepoRelative(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(REPO_ROOT, filePath);
  return path.relative(REPO_ROOT, abs).split(path.sep).join('/');
}

/**
 * Extract module specifiers from common JS/TS import forms.
 * Blind spots (not claimed): template-literal dynamic imports, variable/computed
 * specifiers, path aliases beyond @echotype/*, bundler-rewritten imports.
 *
 * @param {string} source
 * @returns {{ kind: string, specifier: string }[]}
 */
export function extractModuleSpecifiers(source) {
  const found = [];
  // Binding lists may span lines; stop at the first `from '…'` (lazy).
  // Quotes/semicolons bound the match — do not exclude `\n` in the binder.
  const patterns = [
    {
      kind: 'import-from',
      regex: /\bimport\s+(?:type\s+)?[^'";]+?\s+from\s+['"]([^'"]+)['"]/g,
    },
    {
      kind: 'export-from',
      regex: /\bexport\s+(?:type\s+)?[^'";]+?\s+from\s+['"]([^'"]+)['"]/g,
    },
    {
      kind: 'side-effect-import',
      regex: /\bimport\s*['"]([^'"]+)['"]/g,
    },
    {
      kind: 'dynamic-import',
      regex: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
    {
      kind: 'require',
      regex: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
  ];

  for (const { kind, regex } of patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
      found.push({ kind, specifier: match[1] });
    }
  }

  return found;
}

/**
 * Resolve a relative specifier against fromFile; package names pass through.
 * @param {string} fromFile repo-relative or absolute
 * @param {string} specifier
 */
export function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return specifier;
  const fromAbs = path.isAbsolute(fromFile)
    ? fromFile
    : path.resolve(REPO_ROOT, fromFile);
  return path.normalize(path.resolve(path.dirname(fromAbs), specifier));
}

function packageZone(repoRelativeFile) {
  const rel = repoRelativeFile.split(path.sep).join('/');
  if (rel.startsWith('apps/web/') || rel === 'apps/web') return 'web';
  if (rel.startsWith('apps/api/') || rel === 'apps/api') return 'api';
  if (rel.startsWith('packages/shared/') || rel === 'packages/shared') return 'shared';
  return null;
}

function targetZoneFromResolved(resolved, specifier) {
  if (specifier === PACKAGE_NAMES.web || specifier.startsWith(`${PACKAGE_NAMES.web}/`)) {
    return 'web';
  }
  if (specifier === PACKAGE_NAMES.api || specifier.startsWith(`${PACKAGE_NAMES.api}/`)) {
    return 'api';
  }
  if (specifier === PACKAGE_NAMES.shared || specifier.startsWith(`${PACKAGE_NAMES.shared}/`)) {
    return 'shared';
  }
  if (specifier.startsWith('.')) {
    const rel = toRepoRelative(resolved);
    return packageZone(rel);
  }
  return null;
}

/**
 * Pure: workspace dependency direction violations in one source file.
 * @param {{ source: string, fromFile: string }} input fromFile is repo-relative
 * @returns {string[]}
 */
export function findWorkspaceImportViolations({ source, fromFile }) {
  const rel = toRepoRelative(fromFile);
  const fromZone = packageZone(rel);
  if (!fromZone) return [];

  const violations = [];
  for (const { kind, specifier } of extractModuleSpecifiers(source)) {
    const resolved = resolveSpecifier(rel, specifier);
    const toZone = targetZoneFromResolved(resolved, specifier);
    if (!toZone || toZone === fromZone) continue;

    const forbidden =
      (fromZone === 'shared' && (toZone === 'web' || toZone === 'api')) ||
      (fromZone === 'web' && toZone === 'api') ||
      (fromZone === 'api' && toZone === 'web');

    if (forbidden) {
      violations.push(
        `${rel}: ${kind} of '${specifier}' crosses ${fromZone} → ${toZone}`,
      );
    }
  }
  return violations;
}

/**
 * Pure: package.json must not declare forbidden workspace deps.
 * @param {{ manifest: { dependencies?: Record<string,string>, devDependencies?: Record<string,string>, optionalDependencies?: Record<string,string>, peerDependencies?: Record<string,string> }, packageDir: string }} input
 * packageDir is repo-relative (apps/web | apps/api | packages/shared)
 */
export function findWorkspaceManifestViolations({ manifest, packageDir }) {
  const zone = packageZone(`${packageDir.replace(/\/$/, '')}/`);
  if (!zone) return [];

  const banned =
    zone === 'shared'
      ? [PACKAGE_NAMES.web, PACKAGE_NAMES.api]
      : zone === 'web'
        ? [PACKAGE_NAMES.api]
        : zone === 'api'
          ? [PACKAGE_NAMES.web]
          : [];

  const sections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];
  const violations = [];
  for (const section of sections) {
    const deps = manifest[section] ?? {};
    for (const name of banned) {
      if (Object.prototype.hasOwnProperty.call(deps, name)) {
        violations.push(
          `${packageDir}/package.json: ${section} declares '${name}' (forbidden for ${zone})`,
        );
      }
    }
  }
  return violations;
}

/**
 * Pure: @prisma/client must not be imported outside apps/api.
 * @param {{ source: string, fromFile: string }} input
 */
export function findPrismaImportViolations({ source, fromFile }) {
  const rel = toRepoRelative(fromFile);
  if (packageZone(rel) === 'api') return [];

  const violations = [];
  for (const { kind, specifier } of extractModuleSpecifiers(source)) {
    if (
      specifier === '@prisma/client' ||
      specifier.startsWith('@prisma/client/')
    ) {
      violations.push(`${rel}: ${kind} of '${specifier}' is only allowed in apps/api`);
    }
  }
  return violations;
}

/**
 * Pure: only apps/api may list @prisma/client in package manifests.
 * @param {{ manifest: object, packageDir: string }} input
 */
export function findPrismaManifestViolations({ manifest, packageDir }) {
  const dir = packageDir.replace(/\/$/, '');
  if (dir === 'apps/api' || dir.startsWith('apps/api/')) return [];

  const sections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];
  const violations = [];
  for (const section of sections) {
    const deps = manifest[section] ?? {};
    if (Object.prototype.hasOwnProperty.call(deps, '@prisma/client')) {
      violations.push(
        `${dir}/package.json: ${section} declares '@prisma/client' (only apps/api may)`,
      );
    }
  }
  return violations;
}

/**
 * Pure: detect writes of root `dark` class outside the sole writer.
 * Blind spots: computed class tokens, className template without literal 'dark',
 * CSS-only / Tailwind dark: variants (not DOM writers).
 * @param {{ source: string, fromFile: string }} input
 */
export function findDocumentDarkWriteViolations({ source, fromFile }) {
  const rel = toRepoRelative(fromFile);
  if (rel === DOCUMENT_DARK_SOLE_WRITER) return [];

  const patterns = [
    {
      // Any classList mutator arg equal to 'dark' (not only first; includes replace).
      // Intentional: any element receiving class "dark" is a second dark root.
      label: 'classList add/remove/toggle/replace(…"dark"…)',
      regex:
        /\.classList\.(?:add|remove|toggle|replace)\(\s*(?:(?:['"][^'"]*['"]\s*,\s*)*)['"]dark['"]/g,
    },
    {
      label: 'documentElement.className assignment with dark',
      regex: /documentElement\.className\s*=\s*['"][^'"]*\bdark\b[^'"]*['"]/g,
    },
    {
      label: 'setAttribute("class", …dark…)',
      regex:
        /(?:documentElement|document\.documentElement)\.setAttribute\(\s*['"]class['"]\s*,\s*['"][^'"]*\bdark\b[^'"]*['"]/g,
    },
  ];

  const violations = [];
  for (const { label, regex } of patterns) {
    regex.lastIndex = 0;
    if (regex.test(source)) {
      violations.push(`${rel}: forbidden html.dark write via ${label}`);
    }
  }
  return violations;
}

export function walkSourceFiles(absDir) {
  const out = [];
  if (!fs.existsSync(absDir)) return out;
  const stack = [absDir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
        continue;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        out.push(full);
      }
    }
  }
  return out;
}

export function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, 'utf8'));
}

/**
 * Scan the real repo for all three architecture rules.
 * @returns {string[]}
 */
export function scanRepositoryArchitecture() {
  const violations = [];

  const sourceRoots = [
    path.join(REPO_ROOT, 'apps/web/src'),
    path.join(REPO_ROOT, 'apps/api/src'),
    path.join(REPO_ROOT, 'apps/api/prisma'),
    path.join(REPO_ROOT, 'packages/shared/src'),
  ];

  for (const root of sourceRoots) {
    for (const abs of walkSourceFiles(root)) {
      const source = fs.readFileSync(abs, 'utf8');
      const fromFile = toRepoRelative(abs);
      violations.push(...findWorkspaceImportViolations({ source, fromFile }));
      violations.push(...findPrismaImportViolations({ source, fromFile }));
      if (fromFile.startsWith('apps/web/')) {
        violations.push(...findDocumentDarkWriteViolations({ source, fromFile }));
      }
    }
  }

  const manifests = [
    { packageDir: 'apps/web', abs: path.join(REPO_ROOT, 'apps/web/package.json') },
    { packageDir: 'apps/api', abs: path.join(REPO_ROOT, 'apps/api/package.json') },
    {
      packageDir: 'packages/shared',
      abs: path.join(REPO_ROOT, 'packages/shared/package.json'),
    },
  ];

  for (const { packageDir, abs } of manifests) {
    const manifest = readJson(abs);
    violations.push(...findWorkspaceManifestViolations({ manifest, packageDir }));
    violations.push(...findPrismaManifestViolations({ manifest, packageDir }));
  }

  return violations;
}
