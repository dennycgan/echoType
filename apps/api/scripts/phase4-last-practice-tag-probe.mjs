// Phase 4 lastPracticeHere tag smoke (local only; NOT wired into CI).
//
// Prereq: API on :3001 with Phase 2+3 migrations applied.
// Run: node apps/api/scripts/phase4-last-practice-tag-probe.mjs

const API = process.env.API_URL ?? 'http://localhost:3001';

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function api(method, path, body) {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text}`);
  return json;
}

async function createProbeCourse(label) {
  return api('POST', '/courses', {
    title: `Phase4 tag ${label} ${Date.now()}`,
    content: 'Probe course for lastPracticeHere tag assertions.',
    mode: 'SHORT',
    annotations: [],
  });
}

async function main() {
  console.log(`API: ${API}`);
  await api('GET', '/health');

  const probeName = `Phase4 tag probe ${Date.now()}`;
  const collection = await api('POST', '/categories', { name: probeName, mode: 'SHORT' });
  assert(collection.lastPracticeHere === false, 'empty collection not lastPracticeHere');

  const courseA = await createProbeCourse('A');
  const courseB = await createProbeCourse('B');

  await api('PATCH', '/courses/category', { courseIds: [courseA.id], categoryId: collection.id });

  // Future timestamps so probe sessions win mode-wide regardless of seed/dev data.
  const base = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const sessionA = {
    courseId: courseA.id,
    startedAt: new Date(base).toISOString(),
    endedAt: new Date(base + 60_000).toISOString(),
    durationSec: 60,
    charCount: 50,
    errorCount: 0,
    wpm: 40,
    accuracy: 1,
    loopCount: 1,
    pasteRanges: [],
  };
  await api('POST', '/sessions', sessionA);

  let cat = await api('GET', `/categories/${collection.id}`);
  assert(cat.lastPracticeHere === true, 'collection tagged after member session');

  let courseARef = await api('GET', `/courses/${courseA.id}`);
  assert(courseARef.lastPracticeHere === true, 'courseA tagged after session');
  let courseBRef = await api('GET', `/courses/${courseB.id}`);
  assert(courseBRef.lastPracticeHere === false, 'courseB not tagged yet');

  const sessionB = {
    ...sessionA,
    courseId: courseB.id,
    startedAt: new Date(base + 120_000).toISOString(),
    endedAt: new Date(base + 180_000).toISOString(),
  };
  await api('POST', '/sessions', sessionB);

  cat = await api('GET', `/categories/${collection.id}`);
  assert(cat.lastPracticeHere === false, 'uncategorized newer practice removes collection tag');

  courseARef = await api('GET', `/courses/${courseA.id}`);
  assert(courseARef.lastPracticeHere === false, 'courseA tag moves to courseB');
  courseBRef = await api('GET', `/courses/${courseB.id}`);
  assert(courseBRef.lastPracticeHere === true, 'courseB is mode-wide winner');

  const list = await api('GET', '/courses?mode=SHORT');
  const fromListA = list.find((c) => c.id === courseA.id);
  const fromListB = list.find((c) => c.id === courseB.id);
  assert(fromListA?.lastPracticeHere === false, 'list courseA not tagged');
  assert(fromListB?.lastPracticeHere === true, 'list courseB tagged');

  await api('PATCH', '/courses/category', { courseIds: [courseA.id], categoryId: null });
  await api('DELETE', `/categories/${collection.id}`);
  await api('DELETE', `/courses/${courseA.id}`);
  await api('DELETE', `/courses/${courseB.id}`);

  console.log('==== Phase 4 last-practice tag probe PASS ====');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
