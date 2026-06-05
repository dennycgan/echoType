import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ARTICLE_MAX, ARTICLE_MIN, SHORT_MAX, SHORT_MIN, type CourseDTO } from '@echotype/shared';
import { api, ApiError } from '../../lib/api';
import { AnnotatedText } from '../AnnotatedText';
import { AnnotatedTextEditor, confirmAbandonPick } from './AnnotatedTextEditor';
import {
  MSG_DISCARD_ALL_CHANGES,
  MSG_INVALID_REQUEST,
  MSG_NETWORK_ERROR,
  MSG_SERIAL_BLOCK,
  MSG_SERVER_ERROR,
  STEP3_NO_ANNOTATION_MESSAGE,
  mapModeIssueMessage,
} from './annotationMessages';
import type { AnnotationIssue, ModeIssue } from '@echotype/shared';
import { useCourseEditor, type EditorMode } from './useCourseEditor';

interface CourseEditorModalProps {
  mode: EditorMode;
  course?: CourseDTO; // present when editing
  onClose: () => void;
  onSaved: (courseId: string) => void;
}

export function CourseEditorModal({ mode, course, onClose, onSaved }: CourseEditorModalProps) {
  const ed = useCourseEditor(mode, course);
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [footerHint, setFooterHint] = useState<string | null>(null);
  const [pickState, setPickState] = useState({ active: false, hasUnsavedNote: false });

  const save = useMutation({
    mutationFn: () =>
      mode === 'create'
        ? api.createCourse(ed.buildPayload())
        : api.updateCourse(course!.id, ed.buildPayload()),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      onSaved(saved.id);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError) {
        handleApiError(e);
        return;
      }
      setSubmitError(MSG_NETWORK_ERROR);
    },
  });

  function handleApiError(e: ApiError) {
    if (e.status === 422) {
      const body = e.courseBody;
      if (body?.error === 'annotation_validation_error' && body.issues) {
        ed.applyServerAnnotationIssues(body.issues as AnnotationIssue[]);
        return;
      }
      if (body?.error === 'mode_length_violation' && body.issues?.[0]) {
        setSubmitError(mapModeIssueMessage(body.issues[0] as ModeIssue));
        return;
      }
    }
    if (e.status === 400) {
      setSubmitError(MSG_INVALID_REQUEST);
      return;
    }
    if (e.status === 0) {
      setSubmitError(MSG_NETWORK_ERROR);
      return;
    }
    if (e.status >= 500) {
      setSubmitError(MSG_SERVER_ERROR);
      return;
    }
    setSubmitError(MSG_SERVER_ERROR);
  }

  function handleSave() {
    setSubmitError(null);
    setFooterHint(null);

    const pre = ed.validateBeforeSave();
    if (!pre.ok) {
      if (pre.kind === 'd5') {
        setSubmitError(STEP3_NO_ANNOTATION_MESSAGE);
        return;
      }
      if (pre.kind === 'mode') {
        setSubmitError(pre.message);
        return;
      }
      if (pre.kind === 'annotation') {
        ed.applyAnnotationValidationFeedback(pre.issues, pre.messages, pre.highlightLocalId);
        return;
      }
    }

    save.mutate();
  }

  function handleNext() {
    setFooterHint(null);
    if (ed.step === 3) {
      if (pickState.active) {
        setFooterHint(MSG_SERIAL_BLOCK);
        return;
      }
      if (ed.needAnnotation && ed.annotations.length === 0) {
        setFooterHint(STEP3_NO_ANNOTATION_MESSAGE);
        return;
      }
      ed.clearSubmitFeedback();
    }
    if (!ed.canProceed) return;
    const effect = ed.goNext();
    if (effect && effect.clearedAnnotations > 0) {
      const n = effect.clearedAnnotations;
      setToast(`Editing the text cleared the ${n} existing annotation${n > 1 ? 's' : ''}.`);
    }
  }

  function handleBack() {
    setFooterHint(null);
    setSubmitError(null);
    if (ed.step === 3 && !confirmAbandonPick(pickState.active, pickState.hasUnsavedNote)) return;
    ed.goBack();
  }

  /** Dismiss the entire editor (X button or backdrop). Back is a separate, narrower action. */
  function handleDismiss() {
    const needsConfirm = ed.isDirty || pickState.active;
    if (needsConfirm && !window.confirm(MSG_DISCARD_ALL_CHANGES)) return;
    onClose();
  }

  const nextPrimaryEnabled = ed.step === 4 ? !save.isPending : ed.canProceed && !pickState.active;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={handleDismiss}
    >
      <div
        className="flex max-h-[96vh] w-[min(98vw,1280px)] flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">
            {mode === 'create' ? 'New course' : 'Edit course'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Step {ed.step} / 4</span>
            <button
              type="button"
              aria-label="Close editor"
              onClick={handleDismiss}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              data-testid="editor-close"
            >
              <span className="block text-xl leading-none" aria-hidden>
                ×
              </span>
            </button>
          </div>
        </header>

        {toast && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-800">
            {toast}
            <button className="ml-2 underline" onClick={() => setToast(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {ed.step === 1 && <Step1 ed={ed} />}
          {ed.step === 2 && <Step2 ed={ed} />}
          {ed.step === 3 && <Step3 ed={ed} onPickStateChange={setPickState} />}
          {ed.step === 4 && <Step4Review ed={ed} />}
        </div>

        <footer className="border-t px-5 py-3">
          {footerHint && (
            <p className="mb-2 text-sm text-amber-700" data-testid="editor-footer-hint">
              {footerHint}
            </p>
          )}
          {ed.step === 4 && submitError && (
            <p
              className="mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
              data-testid="editor-submit-error"
            >
              {submitError}
            </p>
          )}
          <div className="flex items-center justify-between">
            {ed.step > 1 ? (
              <button
                onClick={handleBack}
                className="rounded-md border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {ed.step === 4 ? (
              <button
                onClick={handleSave}
                disabled={save.isPending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {save.isPending ? 'Saving…' : 'Save course'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={ed.step === 3 ? false : !ed.canProceed}
                className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                  nextPrimaryEnabled
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'cursor-not-allowed bg-slate-400 opacity-80'
                }`}
              >
                Next
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Step1({ ed }: { ed: ReturnType<typeof useCourseEditor> }) {
  const len = ed.content.length;
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-sm text-slate-600">Course title</span>
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          value={ed.title}
          onChange={(e) => ed.setTitle(e.target.value)}
          placeholder="e.g. Stray Birds - 49"
        />
      </label>

      {/*
        TEMP (Phase 3.0 stopgap): mode selector should not be here.
        Per user flow in docs/project-kickoff.md, mode is preselected
        on the "模式界面" (mode-specific list page) before opening
        this modal. To be removed when 模式界面 is implemented:
        - CoursesPage will split into short/article routes
        - Modal will receive mode as prop, displaying it read-only
          in edit mode (since changing mode mid-edit is meaningless)
      */}
      <fieldset className="space-y-2">
        <legend className="text-sm text-slate-600">Mode</legend>
        <label className="flex cursor-pointer items-start gap-2 rounded border px-3 py-2 hover:bg-slate-50">
          <input
            type="radio"
            name="course-mode"
            className="mt-1"
            checked={ed.courseMode === 'SHORT'}
            onChange={() => ed.setCourseMode('SHORT')}
          />
          <span>
            <span className="text-sm font-medium">Short mode</span>
            <span className="block text-xs text-slate-400">
              Best for quotes, short poems, a single sentence or paragraph ({SHORT_MIN}-{SHORT_MAX}{' '}
              characters)
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2 rounded border px-3 py-2 hover:bg-slate-50">
          <input
            type="radio"
            name="course-mode"
            className="mt-1"
            checked={ed.courseMode === 'ARTICLE'}
            onChange={() => ed.setCourseMode('ARTICLE')}
          />
          <span>
            <span className="text-sm font-medium">Article mode</span>
            <span className="block text-xs text-slate-400">
              Best for full speeches, poems, essays, self-contained passages ({ARTICLE_MIN}-
              {ARTICLE_MAX} characters)
            </span>
          </span>
        </label>
        <span className="block text-xs text-slate-400">
          A character = each keystroke (letters, punctuation, spaces, and line breaks each count as
          one).
        </span>
      </fieldset>

      <label className="block">
        <span className="text-sm text-slate-600">
          Text content ({len} characters, incl. spaces and line breaks)
        </span>
        <textarea
          className="mt-1 h-44 w-full rounded border px-3 py-2 font-mono text-sm"
          value={ed.content}
          onChange={(e) => ed.setContent(e.target.value)}
          placeholder="Enter the English text to practice…"
        />
      </label>

      {ed.showContentWarning && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Editing the text will clear the {ed.originalAnnotationCount} existing annotation
          {ed.originalAnnotationCount > 1 ? 's' : ''}. (Revert the text to keep them.)
        </p>
      )}
      {ed.step1Error && <p className="text-sm text-amber-600">{ed.step1Error}</p>}
    </div>
  );
}

function Step2({ ed }: { ed: ReturnType<typeof useCourseEditor> }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-slate-600">Text preview (how the typing page will show it):</p>
        <AnnotatedText content={ed.content} annotations={[]} />
      </div>

      {!ed.skipAnnotationChoice && (
        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-600">Do you want to add annotations?</legend>
          <div className="flex gap-3">
            <button
              onClick={() => ed.setNeedAnnotation(true)}
              className={`rounded-md border px-4 py-2 text-sm ${
                ed.needAnnotation === true
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => ed.setNeedAnnotation(false)}
              className={`rounded-md border px-4 py-2 text-sm ${
                ed.needAnnotation === false
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              No
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function Step3({
  ed,
  onPickStateChange,
}: {
  ed: ReturnType<typeof useCourseEditor>;
  onPickStateChange: (s: { active: boolean; hasUnsavedNote: boolean }) => void;
}) {
  return (
    <AnnotatedTextEditor
      content={ed.content}
      annotations={ed.annotations}
      onCreate={ed.addAnnotation}
      onUpdate={ed.updateAnnotation}
      onDelete={ed.deleteAnnotation}
      onPickStateChange={onPickStateChange}
      highlightLocalId={ed.highlightLocalId}
      submitIssueMessages={ed.submitIssueMessages}
    />
  );
}

function Step4Review({ ed }: { ed: ReturnType<typeof useCourseEditor> }) {
  const previewAnnotations = ed.annotations.map((a) => ({
    id: String(a.localId),
    startIndex: a.startIndex,
    endIndex: a.endIndex,
    noteText: a.noteText,
  }));

  return (
    <div className="space-y-4" data-testid="step4-review">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">{ed.title.trim()}</h3>
        <p className="mt-1 text-sm text-slate-500">
          {ed.courseMode} · {ed.content.length} characters · {ed.annotations.length} annotation
          {ed.annotations.length === 1 ? '' : 's'}
        </p>
      </div>

      <p className="text-sm text-slate-600">
        Check annotation placement before saving. This preview matches the typing page layout.
      </p>

      <AnnotatedText content={ed.content} annotations={previewAnnotations} />
    </div>
  );
}
