import type { CourseListSort } from '@echotype/shared';

export const DEFAULT_SORT: CourseListSort = 'createdAt_desc';

export const SORT_OPTIONS: { value: CourseListSort; label: string }[] = [
  { value: 'createdAt_desc', label: 'Newest first' },
  { value: 'createdAt_asc', label: 'Oldest first' },
  { value: 'updatedAt_desc', label: 'Recently updated' },
  { value: 'title_asc', label: 'Title A–Z' },
];
