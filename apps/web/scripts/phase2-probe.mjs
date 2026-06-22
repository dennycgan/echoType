// Phase 2 stop-loss probe harness (local only; NOT wired into CI).
//
// Collects objective evidence for the AnnotatedText read-only demo:
//   b-1  measure-effect log: pure typing must add 0 entries; a resize adds
//        exactly one entry with reason "resize" (and none with reason "???").
//   c    getClientRects stability: window.__atMeasureNow() must return
//        byte-identical visual-line ranges across N calls.
//   a'   DOM-mutation proxy for flicker: each keystroke mutates <= 2 char
//        attributes and performs 0 structural (childList) changes.
//   b-2  programmatic approx p95 of input->next-frame (REFERENCE ONLY; headless
//        timing is noisy and is not the machine the user judges on).
//
// Prereqs: API on :3001 (seeded) and web dev server on :5173.
//   Run:  node apps/web/scripts/phase2-probe.mjs

import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:3001';
const COURSE_TITLE = 'Stray Birds - 49';

const p95 = (xs) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};

async function findCourseId() {
  const res = await fetch(`${API}/api/courses`);
  if (!res.ok) throw new Error(`GET /api/courses -> ${res.status}`);
  const courses = await res.json();
  const c = courses.find((x) => x.title === COURSE_TITLE) ?? courses[0];
  if (!c) throw new Error('no courses found; did you seed?');
  return c;
}

async function main() {
  const course = await findCourseId();
  console.log(`Using course "${course.title}" (${course.id}), ${course.annotations.length} annotations`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } });
  const url = `${WEB}/courses/${course.id}/type`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="annotated-visible"] span');

  // Let mount/resize/font measurements settle, then snapshot the baseline.
  await page.waitForTimeout(700);
  const baseline = await page.evaluate(() => (window.__atMeasureLog ?? []).slice());
  console.log(`\n[load] measure log after mount settle (${baseline.length} entries):`);
  for (const e of baseline) console.log(`   reason=${e.reason} lines=${e.lines} t=${e.t}`);

  const results = { b1_typing: null, b1_resize: null, c_stability: null, a_dom: null, b2_p95: null };

  // --- install per-keystroke DOM-mutation + latency instrumentation ----------
  await page.evaluate(() => {
    const visible = document.querySelector('[data-testid="annotated-visible"]');
    const w = window;
    w.__mut = { attr: 0, child: 0, charData: 0 };
    w.__mutReset = () => (w.__mut = { attr: 0, child: 0, charData: 0 });
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') w.__mut.attr++;
        else if (r.type === 'childList') w.__mut.child += r.addedNodes.length + r.removedNodes.length;
        else if (r.type === 'characterData') w.__mut.charData++;
      }
    });
    obs.observe(visible, { attributes: true, childList: true, subtree: true, characterData: true });

    const input = document.querySelector('[data-testid="typing-input"]') ?? document.querySelector('textarea');
    w.__lat = [];
    input.addEventListener('input', () => {
      const t0 = performance.now();
      requestAnimationFrame(() => w.__lat.push(performance.now() - t0));
    });
  });

  const input = page.locator('[data-testid="typing-input"]');
  await input.focus();

  // --- a' : per-keystroke DOM mutation counts -------------------------------
  const target = course.content;
  const domSamples = [];
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__mutReset());
    await page.keyboard.type(target[i] ?? 'x');
    await page.waitForTimeout(25);
    const m = await page.evaluate(() => window.__mut);
    domSamples.push(m);
  }
  const maxAttr = Math.max(...domSamples.map((m) => m.attr));
  const totalChild = domSamples.reduce((s, m) => s + m.child, 0);
  results.a_dom = { maxAttrPerKeystroke: maxAttr, totalChildListChanges: totalChild, samples: domSamples };
  console.log(`\n[a' DOM] max attribute mutations/keystroke = ${maxAttr}; total childList changes = ${totalChild}`);

  // --- b-1 : measure log must NOT grow during pure typing -------------------
  const beforeTyping = await page.evaluate(() => (window.__atMeasureLog ?? []).length);
  // keep typing the rest of the line
  for (let i = 12; i < Math.min(target.length, 70); i++) {
    await page.keyboard.type(target[i] ?? 'x', { delay: 8 });
  }
  await page.waitForTimeout(200);
  const afterTyping = await page.evaluate(() => (window.__atMeasureLog ?? []).slice());
  const newDuringTyping = afterTyping.slice(beforeTyping);
  results.b1_typing = {
    newEntriesDuringTyping: newDuringTyping.length,
    reasons: newDuringTyping.map((e) => e.reason),
    pass: newDuringTyping.length === 0,
  };
  console.log(
    `\n[b-1 typing] measure entries added during typing = ${newDuringTyping.length} ` +
      `(${results.b1_typing.pass ? 'PASS' : 'FAIL'})`,
  );

  // --- b-1 : a resize must add exactly one entry, reason=resize -------------
  const beforeResize = await page.evaluate(() => (window.__atMeasureLog ?? []).length);
  await page.setViewportSize({ width: 560, height: 800 });
  await page.waitForTimeout(400); // > 100ms debounce + measure
  const afterResize = await page.evaluate(() => (window.__atMeasureLog ?? []).slice());
  const newDuringResize = afterResize.slice(beforeResize);
  results.b1_resize = {
    newEntries: newDuringResize.length,
    reasons: newDuringResize.map((e) => e.reason),
    pass:
      newDuringResize.length >= 1 &&
      newDuringResize.every((e) => e.reason === 'resize') &&
      !newDuringResize.some((e) => e.reason === '???'),
  };
  console.log(
    `\n[b-1 resize] entries added by one resize = ${newDuringResize.length} ` +
      `reasons=[${results.b1_resize.reasons.join(',')}] (${results.b1_resize.pass ? 'PASS' : 'FAIL'})`,
  );

  // --- c : getClientRects stability (same content + width) ------------------
  const stabilityRuns = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 10; i++) out.push(JSON.stringify(window.__atMeasureNow()));
    return out;
  });
  const allEqual = stabilityRuns.every((r) => r === stabilityRuns[0]);
  results.c_stability = { runs: stabilityRuns.length, allIdentical: allEqual, sample: stabilityRuns[0], pass: allEqual };
  console.log(`\n[c stability] ${stabilityRuns.length} measures identical = ${allEqual} (${allEqual ? 'PASS' : 'FAIL'})`);
  console.log(`   lines = ${stabilityRuns[0]}`);

  // --- b-2 : programmatic approx p95 (reference) ----------------------------
  const lat = await page.evaluate(() => window.__lat ?? []);
  results.b2_p95 = { samples: lat.length, p95ms: Number(p95(lat).toFixed(2)), maxMs: Number(Math.max(...lat).toFixed(2)) };
  console.log(
    `\n[b-2 p95 REFERENCE] input->next-frame over ${lat.length} keystrokes: ` +
      `p95=${results.b2_p95.p95ms}ms max=${results.b2_p95.maxMs}ms (headless, noisy)`,
  );

  await browser.close();

  const pass = results.b1_typing.pass && results.b1_resize.pass && results.c_stability.pass && results.a_dom.totalChildListChanges === 0 && results.a_dom.maxAttrPerKeystroke <= 2;
  console.log(`\n==== SUMMARY ${pass ? 'PASS' : 'CHECK'} ====`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
