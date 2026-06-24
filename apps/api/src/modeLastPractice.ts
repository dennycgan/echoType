import type { CourseMode } from '@prisma/client';
import { prisma } from './prisma.js';

/** Mode-wide last-practiced course (tie-break: smallest course id). */
export async function findModeLastPracticedCourse(userId: string, mode: CourseMode) {
  return prisma.course.findFirst({
    where: { userId, mode, lastPracticedAt: { not: null } },
    orderBy: [{ lastPracticedAt: 'desc' }, { id: 'asc' }],
    select: { id: true, categoryId: true },
  });
}

export async function modeLastPracticeCategoryIds(
  userId: string,
  modes: CourseMode[],
): Promise<Map<CourseMode, string | null>> {
  const unique = [...new Set(modes)];
  const entries = await Promise.all(
    unique.map(async (mode) => {
      const winner = await findModeLastPracticedCourse(userId, mode);
      return [mode, winner?.categoryId ?? null] as const;
    }),
  );
  return new Map(entries);
}

export async function modeLastPracticeCourseIds(
  userId: string,
  modes: CourseMode[],
): Promise<Map<CourseMode, string | null>> {
  const unique = [...new Set(modes)];
  const entries = await Promise.all(
    unique.map(async (mode) => {
      const winner = await findModeLastPracticedCourse(userId, mode);
      return [mode, winner?.id ?? null] as const;
    }),
  );
  return new Map(entries);
}
