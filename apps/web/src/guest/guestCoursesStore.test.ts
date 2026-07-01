import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  GUEST_ONBOARDING_DEER_ID,
  GUEST_SAMPLES_CATEGORY_ID,
} from '@echotype/shared';
import {
  _clearGuestStoreForTests,
  createGuestCourse,
  deleteGuestCourse,
  ensureGuestStoreSeeded,
  isGuestReadOnlyCourse,
  isGuestTempCourseId,
  listGuestCategories,
  listGuestCourses,
  updateGuestCourse,
} from './guestCoursesStore.js';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  _clearGuestStoreForTests();
});

describe('guestCoursesStore', () => {
  it('seeds onboarding courses and Samples collection', () => {
    ensureGuestStoreSeeded();
    const cats = listGuestCategories('SHORT');
    assert.ok(cats.some((c) => c.id === GUEST_SAMPLES_CATEGORY_ID));
    const deer = listGuestCourses('SHORT').find((c) => c.id === GUEST_ONBOARDING_DEER_ID);
    assert.ok(deer);
    assert.equal(isGuestReadOnlyCourse(GUEST_ONBOARDING_DEER_ID), true);
    assert.equal(isGuestTempCourseId(GUEST_ONBOARDING_DEER_ID), false);
  });

  it('creates guest temp courses with categoryId null', () => {
    ensureGuestStoreSeeded();
    const course = createGuestCourse({
      title: 'My draft',
      content: 'abc',
      mode: 'SHORT',
    });
    assert.equal(course.categoryId, null);
    assert.equal(isGuestTempCourseId(course.id), true);
    assert.equal(isGuestReadOnlyCourse(course.id), false);
  });

  it('blocks update/delete on read-only onboarding courses', () => {
    ensureGuestStoreSeeded();
    assert.throws(() =>
      updateGuestCourse(GUEST_ONBOARDING_DEER_ID, {
        title: 'x',
        content: 'y',
        mode: 'SHORT',
      }),
    );
    assert.throws(() => deleteGuestCourse(GUEST_ONBOARDING_DEER_ID));
  });
});
