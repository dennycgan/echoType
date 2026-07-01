import type { CourseMode } from '@prisma/client';

export type CatalogAnnotationSpec = {
  phrase: string;
  note: string;
};

/** User-agnostic course definition; materialize attaches to a userId at seed time. */
export type CatalogCourseDef = {
  mode: CourseMode;
  /** Omit or null = standalone on the mode list (no collection). */
  collectionName?: string | null;
  title: string;
  content: string;
  description?: string | null;
  annotations: CatalogAnnotationSpec[];
};
