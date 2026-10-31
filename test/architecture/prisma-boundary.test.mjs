import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findPrismaImportViolations,
  findPrismaManifestViolations,
  scanRepositoryArchitecture,
} from './helpers.mjs';

test('prisma: catches import / import type / export from / import() / require outside api', () => {
  const fromFile = 'apps/web/src/lib/db.ts';
  const cases = [
    {
      source: `import { PrismaClient } from '@prisma/client';`,
      kind: 'import-from',
    },
    {
      source: `import type { User } from '@prisma/client';`,
      kind: 'import-from',
    },
    {
      source: `export { PrismaClient } from '@prisma/client';`,
      kind: 'export-from',
    },
    {
      source: `export type { User } from '@prisma/client';`,
      kind: 'export-from',
    },
    {
      source: `const c = await import('@prisma/client');`,
      kind: 'dynamic-import',
    },
    {
      source: `const c = require('@prisma/client');`,
      kind: 'require',
    },
  ];

  for (const { source, kind } of cases) {
    const violations = findPrismaImportViolations({ source, fromFile });
    assert.equal(violations.length, 1, source);
    assert.match(violations[0], new RegExp(kind));
    assert.match(violations[0], /@prisma\/client/);
  }
});

test('prisma: local relative import without @prisma/client does not report', () => {
  // Relative path to a local file is fine; package name is the boundary.
  assert.deepEqual(
    findPrismaImportViolations({
      source: `import { db } from './local-db';`,
      fromFile: 'packages/shared/src/x.ts',
    }),
    [],
  );
});

test('prisma: multiline import/export of @prisma/client outside api are caught', () => {
  const fromFile = 'apps/web/src/lib/db.ts';
  assert.equal(
    findPrismaImportViolations({
      source: `import {\n  PrismaClient,\n  Prisma,\n} from '@prisma/client';`,
      fromFile,
    }).length,
    1,
  );
  assert.equal(
    findPrismaImportViolations({
      source: `export {\n  PrismaClient,\n} from '@prisma/client';`,
      fromFile,
    }).length,
    1,
  );
});

test('prisma: legal in apps/api including all import forms', () => {
  const fromFile = 'apps/api/src/db.ts';
  const source = `
    import { PrismaClient } from '@prisma/client';
    import type { User } from '@prisma/client';
    export { PrismaClient } from '@prisma/client';
    await import('@prisma/client');
    require('@prisma/client');
  `;
  assert.deepEqual(findPrismaImportViolations({ source, fromFile }), []);
});

test('prisma: multiline import in apps/api does not report', () => {
  assert.deepEqual(
    findPrismaImportViolations({
      source: `import {\n  PrismaClient,\n  Prisma,\n} from '@prisma/client';`,
      fromFile: 'apps/api/src/db.ts',
    }),
    [],
  );
});

test('prisma: shared and web must not declare @prisma/client; api may', () => {
  assert.equal(
    findPrismaManifestViolations({
      manifest: { dependencies: { '@prisma/client': '^5' } },
      packageDir: 'packages/shared',
    }).length,
    1,
  );
  assert.equal(
    findPrismaManifestViolations({
      manifest: { devDependencies: { '@prisma/client': '^5' } },
      packageDir: 'apps/web',
    }).length,
    1,
  );
  assert.deepEqual(
    findPrismaManifestViolations({
      manifest: { dependencies: { '@prisma/client': '^5' } },
      packageDir: 'apps/api',
    }),
    [],
  );
  assert.deepEqual(
    findPrismaManifestViolations({
      manifest: { dependencies: { zod: '^3' } },
      packageDir: 'apps/web',
    }),
    [],
  );
});

test('prisma: repository scan reports no prisma violations', () => {
  const all = scanRepositoryArchitecture();
  const prisma = all.filter((v) => v.includes('@prisma/client'));
  assert.deepEqual(prisma, []);
});
