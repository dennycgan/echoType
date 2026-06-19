import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AnnotationDTO } from '@echotype/shared';
import { api } from '../lib/api';
import { AnnotatedText } from '../components/AnnotatedText';

/** Live per-loop diff errors (typed is capped to target.length). */
function countLoopErrors(typed: string, target: string): number {
  let errors = 0;
  for (let i = 0; i < typed.length; i++) {
    if (typed[i] !== target[i]) errors++;
  }
  return errors;
}

export function TypingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: course, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api.getCourse(id!),
    enabled: !!id,
  });

  if (isLoading || !course) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <TypingSession
      key={course.id}
      courseId={course.id}
      target={course.content}
      title={course.title}
      annotations={course.annotations}
    />
  );
}

function TypingSession({
  courseId,
  target,
  title,
  annotations,
}: {
  courseId: string;
  target: string;
  title: string;
  annotations: AnnotationDTO[];
}) {
  const [typed, setTyped] = useState('');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [loopCount, setLoopCount] = useState(0);
  const [sessionCharCount, setSessionCharCount] = useState(0);
  const [sessionErrorCount, setSessionErrorCount] = useState(0);
  const [submitted, setSubmitted] = useState<null | {
    durationSec: number;
    wpm: number;
    accuracy: number;
    errorCount: number;
    charCount: number;
    loopCount: number;
  }>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const liveStats = useMemo(() => {
    const errors = countLoopErrors(typed, target);
    const accuracy = typed.length === 0 ? 1 : 1 - errors / typed.length;
    return { errors, accuracy };
  }, [typed, target]);

  const elapsedSec = startedAt ? (Date.now() - startedAt.getTime()) / 1000 : 0;
  const wpm = elapsedSec > 0 ? sessionCharCount / 5 / (elapsedSec / 60) : 0;
  const progress = target.length === 0 ? 0 : typed.length / target.length;

  const submitMutation = useMutation({
    mutationFn: api.createSession,
    onSuccess: (s) => {
      setSubmitted({
        durationSec: s.durationSec,
        wpm: s.wpm,
        accuracy: s.accuracy,
        errorCount: s.errorCount,
        charCount: s.charCount,
        loopCount: s.loopCount,
      });
    },
  });

  function handleChange(value: string) {
    const normalized = value.slice(0, target.length);

    if (!startedAt && normalized.length > 0) setStartedAt(new Date());

    if (normalized.length > typed.length) {
      setSessionCharCount((c) => c + (normalized.length - typed.length));
    }

    if (normalized.length === target.length && target.length > 0) {
      setSessionErrorCount((c) => c + countLoopErrors(normalized, target));
      setLoopCount((n) => n + 1);
      setTyped('');
      return;
    }

    setTyped(normalized);
  }

  function handleFinish() {
    if (!startedAt) return;
    const endedAt = new Date();
    const durationSec = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
    const partialErrors = typed.length > 0 ? countLoopErrors(typed, target) : 0;
    const errorCount = sessionErrorCount + partialErrors;
    const finalWpm = durationSec > 0 ? sessionCharCount / 5 / (durationSec / 60) : 0;
    const accuracy =
      sessionCharCount === 0 ? 1 : 1 - errorCount / sessionCharCount;

    submitMutation.mutate({
      courseId,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSec,
      charCount: sessionCharCount,
      errorCount,
      wpm: Number(finalWpm.toFixed(2)),
      accuracy: Number(accuracy.toFixed(4)),
      loopCount,
      pasteRanges: [],
    });
  }

  function handleReset() {
    setTyped('');
    setStartedAt(null);
    setLoopCount(0);
    setSessionCharCount(0);
    setSessionErrorCount(0);
    setSubmitted(null);
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{title}</h1>
        <Link to="/courses" className="text-sm text-slate-500 hover:text-slate-800">
          ← Back
        </Link>
      </div>

      <AnnotatedText content={target} annotations={annotations} typed={typed} clickableNotes />

      <input
        ref={inputRef}
        type="text"
        autoFocus
        value={typed}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-md border bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-slate-500 focus:outline-none"
        placeholder="Start typing…"
        disabled={!!submitted}
      />

      <StatsBar
        durationSec={elapsedSec}
        wpm={wpm}
        accuracy={liveStats.accuracy}
        progress={progress}
        errors={liveStats.errors}
      />

      <div className="flex gap-2">
        <button
          onClick={handleFinish}
          disabled={!startedAt || submitMutation.isPending || !!submitted}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitMutation.isPending ? 'Saving…' : 'End session & save'}
        </button>
        <button
          onClick={handleReset}
          className="rounded-md border bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      {submitted && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Session saved.</p>
          <p>
            duration {submitted.durationSec}s · wpm {submitted.wpm.toFixed(1)} · accuracy{' '}
            {(submitted.accuracy * 100).toFixed(1)}% · errors {submitted.errorCount} · chars{' '}
            {submitted.charCount} · loops {submitted.loopCount}
          </p>
        </div>
      )}
      {submitMutation.isError && (
        <p className="text-sm text-red-600">Failed to save: {(submitMutation.error as Error).message}</p>
      )}
    </div>
  );
}

function StatsBar({
  durationSec,
  wpm,
  accuracy,
  progress,
  errors,
}: {
  durationSec: number;
  wpm: number;
  accuracy: number;
  progress: number;
  errors: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-md border bg-white p-3 text-sm sm:grid-cols-5">
      <Stat label="time" value={`${durationSec.toFixed(1)}s`} />
      <Stat label="wpm" value={wpm.toFixed(1)} />
      <Stat label="accuracy" value={`${(accuracy * 100).toFixed(1)}%`} />
      <Stat label="progress" value={`${(progress * 100).toFixed(0)}%`} />
      <Stat label="errors" value={String(errors)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="font-mono text-base">{value}</div>
    </div>
  );
}
