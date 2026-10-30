// Deterministic annotation GIF capture (local only; NOT wired into CI).
// Requires host ffmpeg (`brew install ffmpeg`). No GIF npm dependency.
//
// Prereq: web dev server on :5173.
// Run: pnpm --dir apps/web capture:share-gif

import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const COURSE_ID = '00000000-0000-4000-8001-000000000112';
const COURSE_TITLE = 'Sonnet 18 (Shakespeare)';
const OUTPUT_URL = new URL('../../../docs/echotype-annotations.gif', import.meta.url);
const OUTPUT_PATH = fileURLToPath(OUTPUT_URL);
const VIEWPORT = { width: 928, height: 760 };
const FPS = 10;
const CHAR_DELAY_MS = 75;
const HOLD_EMPTY_MS = 350;
const HOLD_END_MS = 1500;
const HOLD_ERROR_MS = 550;
const HOLD_BEFORE_FIX_MS = 200;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const LINE1 = "Shall I compare thee to a summer's day?";
const LINE2 = 'Thou art more lovely and more temperate.';
const EXPECTED_FINAL = `${LINE1}\n${LINE2}`;

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

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed (${code}): ${err.slice(-1000)}`));
    });
  });
}

async function main() {
  const writeRequests = [];
  const framesDir = join(tmpdir(), `echotype-gif-frames-${process.pid}`);
  const palettePath = join(tmpdir(), `echotype-gif-palette-${process.pid}.png`);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let frameCount = 0;

  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
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
    await page.getByTestId('typing-input').click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    await page.evaluate(() => window.scrollTo(0, 0));

    assert((await page.getByRole('heading', { level: 1 }).textContent()) === COURSE_TITLE, 'course title');
    for (const note of ANNOTATION_NOTES) {
      assert(
        (await page.getByRole('button', { name: note, exact: true }).count()) === 1,
        `annotation should exist: ${note}`,
      );
    }

    const clip = await page.evaluate(() => {
      const passage = document.querySelector('[data-testid="typing-passage-scroll"]');
      const textarea = document.querySelector('[data-testid="typing-input"]');
      if (!passage || !(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('GIF capture elements missing');
      }
      const passageRect = passage.getBoundingClientRect();
      const inputRect = textarea.getBoundingClientRect();
      return {
        dark: document.documentElement.classList.contains('dark'),
        mobileNotice: Boolean(document.querySelector('[data-testid="desktop-notice-banner"]')),
        x: Math.round(inputRect.left),
        y: Math.floor(passageRect.top),
        width: Math.round(inputRect.width),
        height: Math.ceil(inputRect.bottom) - Math.floor(passageRect.top),
      };
    });

    assert(!clip.dark, 'html.dark should be absent');
    assert(!clip.mobileNotice, 'mobile notice should be absent');

    async function shot() {
      await page.screenshot({
        path: join(framesDir, `frame-${String(frameCount).padStart(4, '0')}.png`),
        clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height },
        caret: 'initial',
      });
      frameCount += 1;
    }

    async function hold(ms) {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        await shot();
        await page.waitForTimeout(1000 / FPS);
      }
    }

    async function typeText(text) {
      for (const ch of text) {
        await page.keyboard.type(ch, { delay: 0 });
        await shot();
        await page.waitForTimeout(CHAR_DELAY_MS);
      }
    }

    async function backspaces(n) {
      for (let i = 0; i < n; i += 1) {
        await page.keyboard.press('Backspace');
        await shot();
        await page.waitForTimeout(CHAR_DELAY_MS + 20);
      }
    }

    await hold(HOLD_EMPTY_MS);

    // Mistake 1 on thee: th + a → fix to ee
    await typeText('Shall I compare th');
    await typeText('a');
    await hold(HOLD_ERROR_MS);
    await hold(HOLD_BEFORE_FIX_MS);
    await backspaces(1);
    await typeText("ee to a summer's day?");
    await page.keyboard.press('Enter');
    await shot();
    await page.waitForTimeout(CHAR_DELAY_MS);

    // Mistake 2 on temperate: temperat + a → fix to e.
    await typeText('Thou art more lovely and more temperat');
    await typeText('a');
    await hold(HOLD_ERROR_MS);
    await hold(HOLD_BEFORE_FIX_MS);
    await backspaces(1);
    await typeText('e.');

    const finalValue = await page.getByTestId('typing-input').inputValue();
    assert(finalValue === EXPECTED_FINAL, `final input mismatch:\n got ${JSON.stringify(finalValue)}`);

    await hold(HOLD_END_MS);
    assert(writeRequests.length === 0, `unexpected write requests:\n${writeRequests.join('\n')}`);
    assert(frameCount > 40, `expected a substantial frame count, got ${frameCount}`);

    const frameFiles = (await readdir(framesDir)).filter((name) => name.endsWith('.png')).sort();
    assert(frameFiles.length === frameCount, 'frame files should match shot count');

    await run('ffmpeg', [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      join(framesDir, 'frame-%04d.png'),
      '-vf',
      'palettegen=stats_mode=full:max_colors=256',
      palettePath,
    ]);
    await run('ffmpeg', [
      '-y',
      '-framerate',
      String(FPS),
      '-i',
      join(framesDir, 'frame-%04d.png'),
      '-i',
      palettePath,
      '-lavfi',
      'paletteuse=dither=none:diff_mode=rectangle',
      '-loop',
      '0',
      OUTPUT_PATH,
    ]);

    const info = await stat(OUTPUT_PATH);
    assert(info.size <= MAX_FILE_BYTES, `GIF should be ≤3MB, got ${info.size} bytes`);
    assert(info.size > 10_000, `GIF looks too small: ${info.size} bytes`);

    // Keep a tiny sidecar note for operators (not required by product).
    await writeFile(
      join(tmpdir(), 'echotype-gif-last-run.txt'),
      `frames=${frameCount} fps=${FPS} bytes=${info.size} path=${OUTPUT_PATH}\n`,
      'utf8',
    );

    console.log(
      `share-assets-gif: wrote ${OUTPUT_PATH} (${frameCount} frames @ ${FPS}fps, ${info.size} bytes, clip ${clip.width}x${clip.height})`,
    );

    await context.close();
  } finally {
    await browser.close();
    await rm(framesDir, { recursive: true, force: true });
    await rm(palettePath, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
