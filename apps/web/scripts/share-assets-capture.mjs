// Deterministic README share image capture (local only; NOT wired into CI).
//
// Prereq: web dev server on :5173.
// Run: pnpm --dir apps/web capture:share-image

import { mkdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const COURSE_ID = '00000000-0000-4000-8001-000000000112';
const COURSE_TITLE = 'Sonnet 18 (Shakespeare)';
const OUTPUT_URL = new URL('../../../docs/echotype-sonnet-18-readme.png', import.meta.url);
const OUTPUT_PATH = fileURLToPath(OUTPUT_URL);
const VIEWPORT = { width: 928, height: 760 };
const DEVICE_SCALE_FACTOR = 2;
const EXPECTED_OUTPUT = { width: 1856, height: 1272 };
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

async function assertComposition(page) {
  assert((await page.getByRole('heading', { level: 1 }).textContent()) === COURSE_TITLE, 'course title');

  for (const note of ANNOTATION_NOTES) {
    assert(
      (await page.getByRole('button', { name: note, exact: true }).count()) === 1,
      `annotation should exist: ${note}`,
    );
  }

  const composition = await page.evaluate(() => {
    const main = document.querySelector('main');
    const passage = document.querySelector('[data-testid="typing-passage-scroll"]');
    const visible = document.querySelector('[data-testid="annotated-visible"]');
    const input = document.querySelector('[data-testid="typing-input"]');

    if (!main || !passage || !visible || !(input instanceof HTMLTextAreaElement)) {
      throw new Error('share capture elements missing');
    }

    const passageRect = passage.getBoundingClientRect();
    const rows = [...visible.children].map((row) => {
      const rect = row.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        fullyVisible: rect.top >= passageRect.top && rect.bottom <= passageRect.bottom,
        intersects: rect.bottom > passageRect.top && rect.top < passageRect.bottom,
      };
    });

    return {
      dark: document.documentElement.classList.contains('dark'),
      mobileNotice: Boolean(document.querySelector('[data-testid="desktop-notice-banner"]')),
      followBrowserSetting: Boolean(document.querySelector('[data-testid="night-mode-use-system"]')),
      mainWidth: main.getBoundingClientRect().width,
      passageScrollTop: passage.scrollTop,
      rows,
      textarea: {
        bottom: input.getBoundingClientRect().bottom,
        clientHeight: input.clientHeight,
        scrollHeight: input.scrollHeight,
        scrollTop: input.scrollTop,
        rows: input.rows,
        selectionStart: input.selectionStart,
        selectionEnd: input.selectionEnd,
        focused: document.activeElement === input,
      },
    };
  });

  assert(!composition.dark, 'html.dark should be absent');
  assert(!composition.mobileNotice, 'mobile notice should be absent');
  assert(!composition.followBrowserSetting, 'theme override control should be absent');
  assert(composition.mainWidth === 896, `main width should be 896px, got ${composition.mainWidth}`);
  assert(composition.passageScrollTop === 0, 'passage should remain scrolled to the first line');
  assert(composition.rows.length === 8, `expected 8 passage rows, got ${composition.rows.length}`);
  assert(
    composition.rows.slice(0, 5).every((row) => row.fullyVisible),
    'first five passage rows should be fully visible',
  );
  assert(!composition.rows[5].intersects, 'sixth passage row should be fully outside the viewport');
  assert(composition.textarea.rows === 2, 'typing textarea should remain two rows high');
  assert(
    composition.textarea.scrollHeight > composition.textarea.clientHeight,
    'typing textarea content should scroll instead of growing',
  );
  assert(composition.textarea.scrollTop > 0, 'typing textarea should be scrolled to the fourth line');
  assert(composition.textarea.focused, 'typing textarea should retain focus');
  assert(
    composition.textarea.selectionStart === TYPED_TEXT.length &&
      composition.textarea.selectionEnd === TYPED_TEXT.length,
    'typing caret should be at the end of the entered text',
  );

  return Math.ceil(composition.textarea.bottom);
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

    const clipHeight = await assertComposition(page);
    assert(clipHeight === 636, `capture height should be 636px, got ${clipHeight}`);
    assert(writeRequests.length === 0, `unexpected write requests:\n${writeRequests.join('\n')}`);

    await mkdir(fileURLToPath(new URL('.', OUTPUT_URL)), { recursive: true });
    await page.screenshot({
      path: OUTPUT_PATH,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: clipHeight },
      caret: 'initial',
    });

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

    console.log(
      `share-assets-capture: wrote ${OUTPUT_PATH} (${dimensions.width}x${dimensions.height}, ${fileInfo.size} bytes)`,
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
