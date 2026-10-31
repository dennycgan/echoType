import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractModuleSpecifiers,
  findWorkspaceImportViolations,
  findWorkspaceManifestViolations,
  scanRepositoryArchitecture,
} from './helpers.mjs';

test('extractModuleSpecifiers covers import / import type / export from / import() / require', () => {
  const source = `
    import { a } from '@echotype/api';
    import type { B } from '@echotype/web';
    export { c } from '../apps/api/src/x';
    export type { D } from '@echotype/shared';
    const x = await import('@echotype/api/foo');
    const y = require('../../apps/web/src/App');
    import './side-effect';
  `;
  const specs = extractModuleSpecifiers(source).map((s) => s.specifier);
  assert.ok(specs.includes('@echotype/api'));
  assert.ok(specs.includes('@echotype/web'));
  assert.ok(specs.includes('../apps/api/src/x'));
  assert.ok(specs.includes('@echotype/shared'));
  assert.ok(specs.includes('@echotype/api/foo'));
  assert.ok(specs.includes('../../apps/web/src/App'));
  assert.ok(specs.includes('./side-effect'));
});

test('workspace: shared must not import apps (package name)', () => {
  const fromFile = 'packages/shared/src/index.ts';
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `import { x } from '@echotype/web';`,
      fromFile,
    }),
    [`${fromFile}: import-from of '@echotype/web' crosses shared → web`],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `import type { x } from '@echotype/api';`,
      fromFile,
    }),
    [`${fromFile}: import-from of '@echotype/api' crosses shared → api`],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `export { x } from '@echotype/api';`,
      fromFile,
    }),
    [`${fromFile}: export-from of '@echotype/api' crosses shared → api`],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `await import('@echotype/web');`,
      fromFile,
    }),
    [`${fromFile}: dynamic-import of '@echotype/web' crosses shared → web`],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `require('@echotype/api');`,
      fromFile,
    }),
    [`${fromFile}: require of '@echotype/api' crosses shared → api`],
  );
});

test('workspace: shared must not import apps via relative path', () => {
  const fromFile = 'packages/shared/src/index.ts';
  const violations = findWorkspaceImportViolations({
    source: `import x from '../../../apps/api/src/server';`,
    fromFile,
  });
  assert.equal(violations.length, 1);
  assert.match(violations[0], /shared → api/);
});

test('workspace: multiline import/export from apps are caught', () => {
  const fromFile = 'packages/shared/src/index.ts';
  assert.equal(
    findWorkspaceImportViolations({
      source: `import {\n  Client,\n} from '@echotype/api';`,
      fromFile,
    }).length,
    1,
  );
  assert.equal(
    findWorkspaceImportViolations({
      source: `export {\n  Client,\n} from '@echotype/web';`,
      fromFile,
    }).length,
    1,
  );
});

test('workspace: web and api must not import each other', () => {
  assert.equal(
    findWorkspaceImportViolations({
      source: `import { x } from '@echotype/api';`,
      fromFile: 'apps/web/src/App.tsx',
    }).length,
    1,
  );
  assert.equal(
    findWorkspaceImportViolations({
      source: `import { x } from '@echotype/web';`,
      fromFile: 'apps/api/src/server.ts',
    }).length,
    1,
  );
  assert.equal(
    findWorkspaceImportViolations({
      source: `import x from '../../../api/src/server';`,
      fromFile: 'apps/web/src/lib/foo.ts',
    }).length,
    1,
  );
});

test('workspace: legal samples do not report', () => {
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `import { z } from 'zod';\nimport { Course } from '@echotype/shared';`,
      fromFile: 'apps/web/src/App.tsx',
    }),
    [],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `import { z } from 'zod';\nimport { Course } from '@echotype/shared';`,
      fromFile: 'apps/api/src/server.ts',
    }),
    [],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `import { z } from 'zod';\nexport * from './other';`,
      fromFile: 'packages/shared/src/index.ts',
    }),
    [],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `import type { Foo } from './local';`,
      fromFile: 'apps/web/src/lib/x.ts',
    }),
    [],
  );
  assert.deepEqual(
    findWorkspaceImportViolations({
      source: `import {\n  Course,\n  Lesson,\n} from '@echotype/shared';`,
      fromFile: 'apps/web/src/App.tsx',
    }),
    [],
  );
});

test('workspace: shared/web/api manifests ban forbidden app deps', () => {
  assert.equal(
    findWorkspaceManifestViolations({
      manifest: { dependencies: { '@echotype/web': 'workspace:*' } },
      packageDir: 'packages/shared',
    }).length,
    1,
  );
  assert.equal(
    findWorkspaceManifestViolations({
      manifest: { dependencies: { '@echotype/api': 'workspace:*' } },
      packageDir: 'apps/web',
    }).length,
    1,
  );
  assert.equal(
    findWorkspaceManifestViolations({
      manifest: { dependencies: { '@echotype/web': 'workspace:*' } },
      packageDir: 'apps/api',
    }).length,
    1,
  );
  assert.deepEqual(
    findWorkspaceManifestViolations({
      manifest: { dependencies: { '@echotype/shared': 'workspace:*', zod: '^3' } },
      packageDir: 'apps/web',
    }),
    [],
  );
  assert.deepEqual(
    findWorkspaceManifestViolations({
      manifest: { dependencies: { zod: '^3' } },
      packageDir: 'packages/shared',
    }),
    [],
  );
});

test('workspace: repository scan reports no workspace violations', () => {
  const all = scanRepositoryArchitecture();
  const workspace = all.filter(
    (v) => v.includes('crosses') || v.includes('forbidden for'),
  );
  assert.deepEqual(workspace, []);
});

test('repository scan reports zero architecture violations', () => {
  assert.deepEqual(scanRepositoryArchitecture(), []);
});
