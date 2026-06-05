import {
  validateAnnotations,
  validateMode,
  type AnnotationIssue,
  type CourseMode,
  type CreateCourseInput,
} from '@echotype/shared';
import {
  STEP3_NO_ANNOTATION_MESSAGE,
  mapAnnotationIssueMessage,
  mapModeIssueMessage,
} from './annotationMessages';
import type { DraftAnnotation } from './useCourseEditor';

export type PreSubmitFailure =
  | { kind: 'd5' }
  | { kind: 'mode'; message: string }
  | { kind: 'annotation'; issues: AnnotationIssue[]; messages: string[]; highlightLocalId: number | null };

export type PreSubmitResult = { ok: true } | ({ ok: false } & PreSubmitFailure);

export function runPreSubmitValidation(
  payload: CreateCourseInput,
  annotations: DraftAnnotation[],
  needAnnotation: boolean | null,
): PreSubmitResult {
  if (needAnnotation === true && annotations.length === 0) {
    return { ok: false, kind: 'd5' };
  }

  const modeIssue = validateMode(payload.content, payload.mode as CourseMode);
  if (modeIssue) {
    return { ok: false, kind: 'mode', message: mapModeIssueMessage(modeIssue) };
  }

  const annPayload = payload.annotations ?? [];
  const issues = validateAnnotations(payload.content, annPayload);
  if (issues.length > 0) {
    return {
      ok: false,
      kind: 'annotation',
      issues,
      messages: issues.map((issue) => mapAnnotationIssueMessage(issue, annotations, annPayload)),
      highlightLocalId: annotations[issues[0]!.index]?.localId ?? null,
    };
  }

  return { ok: true };
}

export function annotationIssuesFromApi(
  issues: AnnotationIssue[],
  annotations: DraftAnnotation[],
  payloadAnnotations: CreateCourseInput['annotations'],
): { messages: string[]; highlightLocalId: number | null } {
  const list = payloadAnnotations ?? [];
  return {
    messages: issues.map((issue) => mapAnnotationIssueMessage(issue, annotations, list)),
    highlightLocalId: annotations[issues[0]?.index ?? -1]?.localId ?? null,
  };
}
