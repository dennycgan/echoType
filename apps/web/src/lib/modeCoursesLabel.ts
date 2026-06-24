import type { CourseMode } from '@echotype/shared';

/** "Short" | "Article" for duplicate-name error copy ({mode} courses). */
export function modeCoursesLabel(mode: CourseMode): string {
  return mode === 'SHORT' ? 'Short' : 'Article';
}
