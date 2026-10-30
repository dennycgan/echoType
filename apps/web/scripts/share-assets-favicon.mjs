// Render favicon-32x32.png from public/favicon.svg (local only; NOT wired into CI).
// Uses Playwright only — no extra image npm deps.
//
// Run: pnpm --dir apps/web capture:share-favicon

import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const SVG_URL = new URL('../public/favicon.svg', import.meta.url);
const PNG_URL = new URL('../public/favicon-32x32.png', import.meta.url);
const SVG_PATH = fileURLToPath(SVG_URL);
const PNG_PATH = fileURLToPath(PNG_URL);
const SIZE = 32;

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function readPngDimensions(buffer) {
  assert(
    buffer.length >= 24 && buffer.subarray(1, 4).toString('ascii') === 'PNG',
    'output should be a PNG',
  );
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function main() {
  const svg = await readFile(SVG_PATH, 'utf8');
  assert(svg.includes('#fef3c7'), 'favicon should use day-mode phrase highlight');
  assert(svg.includes('#b45309'), 'favicon should use day-mode annotation note color');
  assert(/\be\b|>e</.test(svg), 'favicon should contain lowercase e');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: SIZE, height: SIZE },
      deviceScaleFactor: 1,
    });
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent"><img src="${dataUrl}" width="${SIZE}" height="${SIZE}" style="display:block"/></body></html>`,
      { waitUntil: 'load' },
    );
    await page.waitForTimeout(40);
    await page.screenshot({ path: PNG_PATH, omitBackground: true });
    await page.close();
  } finally {
    await browser.close();
  }

  const [png, info] = await Promise.all([readFile(PNG_PATH), stat(PNG_PATH)]);
  const dimensions = readPngDimensions(png);
  assert(
    dimensions.width === SIZE && dimensions.height === SIZE,
    `favicon PNG should be ${SIZE}x${SIZE}, got ${dimensions.width}x${dimensions.height}`,
  );

  // Ensure SVG stays the committed source of truth (no accidental rewrite).
  await writeFile(SVG_PATH, svg, 'utf8');

  console.log(
    `share-assets-favicon: wrote ${PNG_PATH} (${dimensions.width}x${dimensions.height}, ${info.size} bytes)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
