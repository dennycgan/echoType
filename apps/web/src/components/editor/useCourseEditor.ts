import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ARTICLE_MAX,
  ARTICLE_MIN,
  SHORT_MAX,
  SHORT_MIN,
  type CourseDTO,
  type CourseMode,
  type CreateCourseInput,
} from '@echotype/shared';

// Short-lived front-end id for a staged annotation. It only exists while the
// editor modal is open and is never sent to the backend (the server derives its
// own ids + anchoredText). A simple incrementing counter is enough; no nanoid.
export interface DraftAnnotation {
  localId: number;
  startIndex: number;
  endIndex: number; // inclusive
  noteText: string;
}

export type EditorStep = 1 | 2 | 3 | 4;
export type EditorMode = 'create' | 'edit';

export { STEP3_NO_ANNOTATION_MESSAGE } from './annotationMessages';

function lengthOk(mode: CourseMode, len: number): boolean {
  return mode === 'SHORT' ? len >= SHORT_MIN && len <= SHORT_MAX : len >= ARTICLE_MIN && len <= ARTICLE_MAX;
}

export interface UseCourseEditor {
  editorMode: EditorMode;
  step: EditorStep;

  title: string;
  setTitle: (v: string) => void;
  content: string;
  setContent: (v: string) => void;
  courseMode: CourseMode;
  setCourseMode: (v: CourseMode) => void;

  needAnnotation: boolean | null;
  setNeedAnnotation: (v: boolean) => void;
  /** Edit flow: course already has annotations — skip Step 2 Yes/No. */
  skipAnnotationChoice: boolean;

  annotations: DraftAnnotation[];
  addAnnotation: (a: Omit<DraftAnnotation, 'localId'>) => void;
  updateAnnotation: (localId: number, patch: Partial<Omit<DraftAnnotation, 'localId'>>) => void;
  deleteAnnotation: (localId: number) => void;
  // Step 1 validation
  step1Error: string | null;
  canProceed: boolean;

  // D2: editing an existing course's content invalidates its annotations.
  contentChanged: boolean;
  originalAnnotationCount: number;
  showContentWarning: boolean; // changed AND there were annotations to lose

  // Navigation. goNext returns an optional side-effect signal the modal acts on
  // (e.g. show the "annotations cleared" toast after a D2 wipe).
  goNext: () => { clearedAnnotations: number } | void;
  goBack: () => void;
  isDirty: boolean;

  buildPayload: () => CreateCourseInput;
}

export function useCourseEditor(editorMode: EditorMode, initial?: CourseDTO): UseCourseEditor {
  const [step, setStep] = useState<EditorStep>(1);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [courseMode, setCourseMode] = useState<CourseMode>(initial?.mode ?? 'SHORT');
  const originalAnnotationCount = initial?.annotations?.length ?? 0;

  const [needAnnotation, setNeedAnnotationState] = useState<boolean | null>(() =>
    editorMode === 'edit' && originalAnnotationCount > 0 ? true : null,
  );

  const [annotations, setAnnotations] = useState<DraftAnnotation[]>(() =>
    (initial?.annotations ?? []).map((a, i) => ({
      localId: i + 1,
      startIndex: a.startIndex,
      endIndex: a.endIndex,
      noteText: a.noteText,
    })),
  );
  const nextLocalId = useRef<number>((initial?.annotations?.length ?? 0) + 1);

  const originalContent = useRef(initial?.content ?? '');
  const contentChanged = editorMode === 'edit' && content !== originalContent.current;
  const showContentWarning = contentChanged && originalAnnotationCount > 0;

  // Edit + still has staged annotations: skip Step 2 Yes/No and go straight to Step 3.
  const skipAnnotationChoice = useMemo(
    () => editorMode === 'edit' && annotations.length > 0,
    [editorMode, annotations.length],
  );

  const addAnnotation = useCallback((a: Omit<DraftAnnotation, 'localId'>) => {
    setAnnotations((prev) => [...prev, { ...a, localId: nextLocalId.current++ }]);
  }, []);

  const updateAnnotation = useCallback(
    (localId: number, patch: Partial<Omit<DraftAnnotation, 'localId'>>) => {
      setAnnotations((prev) => prev.map((x) => (x.localId === localId ? { ...x, ...patch } : x)));
    },
    [],
  );

  const deleteAnnotation = useCallback((localId: number) => {
    setAnnotations((prev) => prev.filter((x) => x.localId !== localId));
  }, []);

  const setNeedAnnotation = useCallback((v: boolean) => {
    setNeedAnnotationState(v);
    // Selecting "no" means this course has no annotations; drop any staged ones.
    if (!v) setAnnotations([]);
  }, []);

  const step1Error = useMemo(() => {
    if (!title.trim()) return 'Title is required.';
    if (!content) return 'Text content is required.';
    if (!lengthOk(courseMode, content.length)) {
      return courseMode === 'SHORT'
        ? `Short mode needs ${SHORT_MIN}-${SHORT_MAX} characters (currently ${content.length}).`
        : `Article mode needs ${ARTICLE_MIN}-${ARTICLE_MAX} characters (currently ${content.length}).`;
    }
    return null;
  }, [title, content, courseMode]);

  const canProceed = useMemo(() => {
    if (step === 1) return step1Error === null;
    if (step === 2) return skipAnnotationChoice || needAnnotation !== null;
    if (step === 3) return needAnnotation === true ? annotations.length > 0 : true;
    return true;
  }, [step, step1Error, needAnnotation, annotations.length, skipAnnotationChoice]);

  const goNext = useCallback((): { clearedAnnotations: number } | void => {
    if (step === 1) {
      // D2: leaving step 1 with a changed content wipes the now-stale annotations.
      if (contentChanged && annotations.length > 0) {
        const cleared = annotations.length;
        setAnnotations([]);
        originalContent.current = content; // re-baseline so the warning clears
        setStep(skipAnnotationChoice ? 3 : 2);
        return { clearedAnnotations: cleared };
      }
      setStep(skipAnnotationChoice ? 3 : 2);
      return;
    }
    if (step === 2) {
      setStep(needAnnotation ? 3 : 4);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
  }, [step, contentChanged, annotations.length, content, needAnnotation, skipAnnotationChoice]);

  const goBack = useCallback(() => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(skipAnnotationChoice ? 1 : 2);
    else if (step === 4) setStep(needAnnotation ? 3 : skipAnnotationChoice ? 1 : 2);
  }, [step, needAnnotation, skipAnnotationChoice]);

  const isDirty = useMemo(() => {
    if (editorMode === 'create') {
      return title.trim() !== '' || content !== '' || annotations.length > 0;
    }
    return (
      title !== (initial?.title ?? '') ||
      content !== (initial?.content ?? '') ||
      courseMode !== (initial?.mode ?? 'SHORT') ||
      annotations.length !== originalAnnotationCount
    );
  }, [editorMode, title, content, courseMode, annotations.length, initial, originalAnnotationCount]);

  const buildPayload = useCallback(
    (): CreateCourseInput => ({
      title: title.trim(),
      content,
      mode: courseMode,
      annotations: annotations.map((a) => ({
        startIndex: a.startIndex,
        endIndex: a.endIndex,
        noteText: a.noteText,
      })),
    }),
    [title, content, courseMode, annotations],
  );

  return {
    editorMode,
    step,
    title,
    setTitle,
    content,
    setContent,
    courseMode,
    setCourseMode,
    needAnnotation,
    setNeedAnnotation,
    skipAnnotationChoice,
    annotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    step1Error,
    canProceed,
    contentChanged,
    originalAnnotationCount,
    showContentWarning,
    goNext,
    goBack,
    isDirty,
    buildPayload,
  };
}
