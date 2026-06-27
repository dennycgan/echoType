// Phase 7 pause/resume smoke (local only; NOT wired into CI).
//
// Prereqs: API on :3001 (seeded) and web dev server on :5173.
// Run: node apps/web/scripts/phase7-pause-probe.mjs

import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:3001';
const COURSE_TITLE = 'Stray Birds - 49';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function findCourseId() {
  const res = await fetch(`${API}/api/courses`);
  if (!res.ok) throw new Error(`GET /api/courses -> ${res.status}`);
  const courses = await res.json();
  const c = courses.find((x) => x.title === COURSE_TITLE) ?? courses[0];
  if (!c) throw new Error('no courses found; did you seed?');
  return c;
}

async function armTimed(page, minutes) {
  await page.evaluate((m) => window.__phase6Timer?.armTimed(m), minutes);
}

async function main() {
  const course = await findCourseId();
  console.log(`Using course "${course.title}" (${course.id})`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  const url = `${WEB}/courses/${course.id}/type`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('echotype-session-timer-hidden'));
  await page.waitForSelector('[data-testid="typing-input"]');

  // P1: cannot pause before session starts
  assert(await page.getByTestId('pause-session').isDisabled(), 'pause disabled before typing');

  // P2: freeze activeMs while paused
  await page.locator('[data-testid="typing-input"]').fill('ab');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__phase7Pause?.pauseSession());
  assert(await page.evaluate(() => window.__phase7Pause?.isPaused()), 'paused after pauseSession');
  const msBefore = await page.evaluate(() => window.__phase7Pause?.getActiveMs() ?? 0);
  await page.waitForTimeout(2000);
  const msAfterPause = await page.evaluate(() => window.__phase7Pause?.getActiveMs() ?? 0);
  assert(msAfterPause === msBefore, 'activeMs frozen while paused');

  // P3: keystroke resumes; activeMs advances again
  await page.locator('[data-testid="typing-input"]').press('c');
  await page.waitForTimeout(300);
  assert(!(await page.evaluate(() => window.__phase7Pause?.isPaused())), 'resumed after keystroke');
  const msAfterResume = await page.evaluate(() => window.__phase7Pause?.getActiveMs() ?? 0);
  await page.waitForTimeout(1200);
  const msLater = await page.evaluate(() => window.__phase7Pause?.getActiveMs() ?? 0);
  assert(msLater > msAfterResume, 'activeMs advances after resume');

  // P3-IME: keydown before compositionstart clears paused (not compositionend)
  await page.evaluate(() => window.__phase7Pause?.pauseSession());
  assert(await page.evaluate(() => window.__phase7Pause?.isPaused()), 'paused for IME smoke');
  await page.locator('[data-testid="typing-input"]').press('d');
  const pausedAfterKey = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="typing-input"]');
    el?.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    return window.__phase7Pause?.isPaused();
  });
  assert(pausedAfterKey === false, 'isPaused false after keydown before compositionstart');

  // P4/P5: countdown freeze + resume
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="typing-input"]');
  await armTimed(page, 10);
  await page.locator('[data-testid="typing-input"]').fill('xy');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__phase7Pause?.pauseSession());
  const remBefore = await page.evaluate(() => window.__phase6Timer?.getRemainingSec() ?? null);
  await page.waitForTimeout(2000);
  const remPaused = await page.evaluate(() => window.__phase6Timer?.getRemainingSec() ?? null);
  assert(remBefore != null && remPaused === remBefore, 'countdown frozen while paused');
  await page.locator('[data-testid="typing-input"]').press('z');
  await page.waitForTimeout(200);
  const remAtResume = await page.evaluate(() => window.__phase6Timer?.getRemainingSec() ?? null);
  assert(!(await page.evaluate(() => window.__phase7Pause?.isPaused())), 'resumed before countdown tick');
  await page.waitForTimeout(2000);
  const remAfter = await page.evaluate(() => window.__phase6Timer?.getRemainingSec() ?? null);
  assert(
    remAfter != null && remAtResume != null && remAfter < remAtResume,
    'countdown continues after resume',
  );

  // P6: Save clears pause
  await page.evaluate(() => window.__phase7Pause?.pauseSession());
  await page.getByRole('button', { name: 'Save session' }).click();
  await page.waitForTimeout(800);
  assert(!(await page.evaluate(() => window.__phase7Pause?.isPaused())), 'pause cleared after save');
  assert(await page.getByTestId('pause-session').isDisabled(), 'pause disabled on fresh segment');

  // P7: timer-end modal disables pause
  await page.reload({ waitUntil: 'networkidle' });
  await armTimed(page, 10);
  await page.locator('[data-testid="typing-input"]').fill('a');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__phase6Timer?.expireNow());
  await page.waitForSelector('text=Time\'s up');
  assert(await page.getByTestId('pause-session').isDisabled(), 'pause disabled during timer end');
  await page.getByRole('dialog', { name: "Time's up" }).getByRole('button', { name: "Don't save" }).click();

  // P9: T3-A then Start over restores timer strip
  await page.waitForTimeout(200);
  assert((await page.getByTestId('session-timer-set').count()) === 0, 'strip hidden after T3-A');
  await page.getByRole('button', { name: 'Start over' }).click();
  await page.waitForTimeout(200);
  assert(await page.getByTestId('session-timer-set').isVisible(), 'Start over restores timer strip after T3-A');

  await browser.close();
  console.log('==== Phase 7 pause probe PASS ====');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
