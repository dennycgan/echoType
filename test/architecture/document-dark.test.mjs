import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOCUMENT_DARK_SOLE_WRITER,
  findDocumentDarkWriteViolations,
  scanRepositoryArchitecture,
} from './helpers.mjs';

test('document-dark: catches classList add/remove/toggle of dark outside sole writer', () => {
  const fromFile = 'apps/web/src/components/Evil.tsx';
  for (const method of ['add', 'remove', 'toggle']) {
    const source = `document.documentElement.classList.${method}('dark');`;
    const violations = findDocumentDarkWriteViolations({ source, fromFile });
    assert.equal(violations.length, 1, method);
    assert.match(violations[0], /classList/);
  }
});

test('document-dark: catches classList.replace and non-first-arg dark', () => {
  const fromFile = 'apps/web/src/components/Evil.tsx';
  assert.equal(
    findDocumentDarkWriteViolations({
      source: `el.classList.replace('light', 'dark');`,
      fromFile,
    }).length,
    1,
  );
  assert.equal(
    findDocumentDarkWriteViolations({
      source: `el.classList.add('foo', 'dark');`,
      fromFile,
    }).length,
    1,
  );
});

test('document-dark: catches className and setAttribute writers', () => {
  const fromFile = 'apps/web/src/lib/other.ts';
  assert.equal(
    findDocumentDarkWriteViolations({
      source: `document.documentElement.className = 'dark';`,
      fromFile,
    }).length,
    1,
  );
  assert.equal(
    findDocumentDarkWriteViolations({
      source: `document.documentElement.setAttribute('class', 'theme dark');`,
      fromFile,
    }).length,
    1,
  );
});

test('document-dark: sole writer path is allowed', () => {
  const source = `
    const root = document.documentElement;
    root.classList.add('dark');
    root.classList.remove('dark');
  `;
  assert.deepEqual(
    findDocumentDarkWriteViolations({
      source,
      fromFile: DOCUMENT_DARK_SOLE_WRITER,
    }),
    [],
  );
});

test('document-dark: legal samples without root dark writes do not report', () => {
  assert.deepEqual(
    findDocumentDarkWriteViolations({
      source: `
        const isDark = preference === 'dark';
        return <div className="dark:bg-black">night</div>;
      `,
      fromFile: 'apps/web/src/components/NightToggle.tsx',
    }),
    [],
  );
  assert.deepEqual(
    findDocumentDarkWriteViolations({
      source: `el.classList.add('dark-mode');`,
      fromFile: 'apps/web/src/lib/x.ts',
    }),
    [],
  );
});

test('document-dark: repository scan reports no extra html.dark writers', () => {
  const all = scanRepositoryArchitecture();
  const dark = all.filter((v) => v.includes('html.dark'));
  assert.deepEqual(dark, []);
});
