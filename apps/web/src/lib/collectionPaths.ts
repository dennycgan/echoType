import type { CourseMode } from '@echotype/shared';

export function collectionDetailPath(mode: CourseMode, collectionId: string): string {
  const segment = mode === 'SHORT' ? 'short' : 'article';
  return `/courses/${segment}/collections/${collectionId}`;
}

export function modeListPath(mode: CourseMode): string {
  return mode === 'SHORT' ? '/courses/short' : '/courses/article';
}
