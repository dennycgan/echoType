// Local probe: scroll position across SPA navigations.
// Prereqs: web on :5173, API on :3001 (seeded with collections).
// Run: node apps/web/scripts/scroll-nav-probe.mjs

import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API = process.env.API_URL ?? 'http://localhost:3001';

async function scrollSnapshot(page, label) {
  const snap = await page.evaluate((lbl) => {
    const root = document.getElementById('root');
    const docEl = document.documentElement;
    const body = document.body;
    const findScrollParent = (el) => {
      let node = el;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        const oy = style.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
          return {
            tag: node.tagName.toLowerCase(),
            className: node.className?.slice?.(0, 80) ?? '',
            scrollTop: node.scrollTop,
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
          };
        }
        node = node.parentElement;
      }
      return null;
    };
    return {
      label: lbl,
      window: { scrollX: window.scrollX, scrollY: window.scrollY },
      docEl: { scrollTop: docEl.scrollTop, scrollHeight: docEl.scrollHeight, clientHeight: docEl.clientHeight },
      body: { scrollTop: body.scrollTop, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight },
      root: root
        ? { scrollTop: root.scrollTop, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight }
        : null,
      scrollParentFromMain: findScrollParent(document.querySelector('main')),
      scrollRestoration: history.scrollRestoration,
      path: location.pathname,
      key: history.state?.usr?.key ?? history.state?.key ?? null,
    };
  }, label);
  console.log(JSON.stringify(snap, null, 2));
  return snap;
}

async function findCollectionId() {
  const res = await fetch(`${API}/api/categories?mode=SHORT`);
  if (!res.ok) throw new Error(`GET categories -> ${res.status}`);
  const cats = await res.json();
  if (!cats[0]) throw new Error('no SHORT collections; seed?');
  return cats[0].id;
}

async function main() {
  const collectionId = await findCollectionId();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });

  await page.goto(`${WEB}/courses/short`, { waitUntil: 'networkidle' });
  await scrollSnapshot(page, 'after load mode list');

  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(100);
  const scrolled = await scrollSnapshot(page, 'after manual scroll down on mode list');

  const collectionLink = page.locator(`a[href="/courses/short/collections/${collectionId}"]`).first();
  await collectionLink.click();
  await page.waitForURL(`**/collections/${collectionId}`);
  await page.waitForTimeout(300);
  await scrollSnapshot(page, 'after click into collection (forward)');

  await page.goBack();
  await page.waitForURL('**/courses/short');
  await page.waitForTimeout(300);
  await scrollSnapshot(page, 'after browser back to mode list');

  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(100);
  await collectionLink.click();
  await page.waitForURL(`**/collections/${collectionId}`);
  await page.waitForTimeout(300);
  await scrollSnapshot(page, 'after second forward to collection');

  // In-app ← Back link (not browser back)
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(100);
  await scrollSnapshot(page, 'scrolled down on collection detail');
  await page.locator('a:has-text("← Back")').first().click();
  await page.waitForURL('**/courses/short');
  await page.waitForTimeout(300);
  await scrollSnapshot(page, 'after in-app Back link to mode list');

  const typeLink = page.locator('a:has-text("Type this")').first();
  if (await typeLink.count()) {
    await page.evaluate(() => window.scrollTo(0, 500));
    await typeLink.click();
    await page.waitForURL('**/type');
    await page.waitForTimeout(500);
    await scrollSnapshot(page, 'after Type this (mode/collection -> typing)');
  }

  await browser.close();
  console.log('\nIf window.scrollY stays high after navigation, scroll-to-top is not applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
