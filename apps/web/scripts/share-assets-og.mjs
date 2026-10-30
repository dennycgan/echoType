// Deterministic OG image capture (local only; NOT wired into CI).
// Letterboxes title→input into classic 1200×630 @ DPR 2 → 2400×1260.
//
// Prereq: web dev server on :5173.
// Run: pnpm --dir apps/web capture:share-og

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const COURSE_ID = '00000000-0000-4000-8001-000000000112';
const COURSE_TITLE = 'Sonnet 18 (Shakespeare)';
const OUTPUT_URL = new URL('../public/og/echotype-og.png', import.meta.url);
const OUTPUT_PATH = fileURLToPath(OUTPUT_URL);
const VIEWPORT = { width: 928, height: 760 };
const DEVICE_SCALE_FACTOR = 2;
const OG_CSS = { width: 1200, height: 630 };
const EXPECTED_OUTPUT = { width: 2400, height: 1260 };
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const TYPED_TEXT = `Shall I compare thee to a summer's day?
Thou art more lovely and more temperate.
Rough winds do shake the darling buds of May,
And summer's lease `;

const ANNOTATION_NOTES = [
  'you (archaic singular)',
  'you are (archaic)',
  'mild, even-natured',
  'has (archaic)',
  'the sun',
  'every beautiful thing',
  'stripped of beauty',
];

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

async function waitForStableLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

async function main() {
  const writeRequests = [];
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      colorScheme: 'light',
      hasTouch: false,
      isMobile: false,
    });
    const page = await context.newPage();

    page.on('request', (request) => {
      if (WRITE_METHODS.has(request.method())) {
        writeRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    await page.goto(`${WEB}/courses/${COURSE_ID}/type`, { waitUntil: 'networkidle' });
    await page.getByTestId('description-show').click();
    await page.getByTestId('session-timer-hide').click();
    await page.getByTestId('stats-hide').click();

    const input = page.getByTestId('typing-input');
    await input.fill(TYPED_TEXT);
    await waitForStableLayout(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await input.focus();
    await input.press('ArrowLeft');
    await input.press('ArrowRight');

    assert((await page.getByRole('heading', { level: 1 }).textContent()) === COURSE_TITLE, 'course title');
    for (const note of ANNOTATION_NOTES) {
      assert(
        (await page.getByRole('button', { name: note, exact: true }).count()) === 1,
        `annotation should exist: ${note}`,
      );
    }

    const metrics = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const textarea = document.querySelector('[data-testid="typing-input"]');
      if (!h1 || !(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('OG capture elements missing');
      }
      const h1Rect = h1.getBoundingClientRect();
      const inputRect = textarea.getBoundingClientRect();
      return {
        dark: document.documentElement.classList.contains('dark'),
        mobileNotice: Boolean(document.querySelector('[data-testid="desktop-notice-banner"]')),
        left: Math.round(inputRect.left),
        width: Math.round(inputRect.width),
        top: Math.floor(h1Rect.top),
        bottom: Math.ceil(inputRect.bottom),
      };
    });

    assert(!metrics.dark, 'html.dark should be absent');
    assert(!metrics.mobileNotice, 'mobile notice should be absent');
    assert(writeRequests.length === 0, `unexpected write requests:\n${writeRequests.join('\n')}`);

    const clip = {
      x: metrics.left,
      y: metrics.top,
      width: metrics.width,
      height: metrics.bottom - metrics.top,
    };
    const sourcePng = await page.screenshot({ clip, caret: 'initial' });
    const dataUrl = `data:image/png;base64,${sourcePng.toString('base64')}`;

    const letterPage = await context.newPage();
    await letterPage.setViewportSize(OG_CSS);
    await letterPage.setContent(
      `<!doctype html>
<html><head><style>
  html,body{margin:0;width:${OG_CSS.width}px;height:${OG_CSS.height}px;background:#fff;overflow:hidden}
  body{display:flex;align-items:center;justify-content:center}
  img{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
</style></head>
<body><img src="${dataUrl}" alt="og"/></body></html>`,
      { waitUntil: 'load' },
    );
    await letterPage.waitForTimeout(50);

    await mkdir(fileURLToPath(new URL('.', OUTPUT_URL)), { recursive: true });
    await letterPage.screenshot({ path: OUTPUT_PATH, caret: 'initial' });

    const [png, fileInfo] = await Promise.all([readFile(OUTPUT_PATH), stat(OUTPUT_PATH)]);
    const dimensions = readPngDimensions(png);
    assert(
      dimensions.width === EXPECTED_OUTPUT.width && dimensions.height === EXPECTED_OUTPUT.height,
      `output should be ${EXPECTED_OUTPUT.width}x${EXPECTED_OUTPUT.height}, got ${dimensions.width}x${dimensions.height}`,
    );
    assert(
      fileInfo.size < MAX_FILE_BYTES,
      `output should be smaller than 5MB, got ${fileInfo.size} bytes`,
    );

    // Touch path for tooling that resolves via writeFile after mkdir.
    await writeFile(OUTPUT_PATH, png);

    console.log(
      `share-assets-og: wrote ${OUTPUT_PATH} (${dimensions.width}x${dimensions.height}, ${fileInfo.size} bytes; source clip ${clip.width}x${clip.height})`,
    );

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
