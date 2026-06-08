// Phase 4: anchoredText review — compare current content slice to stored snapshot.

export type ReviewStatus = 'green' | 'yellow' | 'n/a';

export type ReviewableAnnotation = {
  startIndex: number;
  endIndex: number;
  anchoredText: string;
};

export function sliceAt(content: string, startIndex: number, endIndex: number): string {
  return content.slice(startIndex, endIndex + 1);
}

/** Start anchor is past the end of content — no characters left to anchor. Partial overlap (start < len, end >= len) is kept. */
export function isFullyUnreachable(
  content: string,
  annotation: { startIndex: number },
): boolean {
  return annotation.startIndex >= content.length;
}

export function dropFullyUnreachableAnnotations<T extends { startIndex: number }>(
  content: string,
  annotations: T[],
): { kept: T[]; purgedCount: number } {
  const kept = annotations.filter((a) => !isFullyUnreachable(content, a));
  return { kept, purgedCount: annotations.length - kept.length };
}

export function computeReviewStatus(
  content: string,
  annotation: ReviewableAnnotation,
  reviewActive: boolean,
): ReviewStatus {
  if (!reviewActive) return 'n/a';
  return sliceAt(content, annotation.startIndex, annotation.endIndex) === annotation.anchoredText
    ? 'green'
    : 'yellow';
}

export function pendingReviewCount(
  content: string,
  annotations: ReviewableAnnotation[],
  reviewActive: boolean,
): number {
  if (!reviewActive) return 0;
  return annotations.filter((a) => computeReviewStatus(content, a, true) === 'yellow').length;
}
