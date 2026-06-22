import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CourseDTO, CourseMode } from '@echotype/shared';
import { api } from '../lib/api';
import { CourseEditorModal } from '../components/editor/CourseEditorModal';

type EditorTarget =
  | { mode: 'create' }
  | { mode: 'edit'; course: CourseDTO }
  | null;

const HIGHLIGHT_MS = 2000;

const MODE_COPY: Record<
  CourseMode,
  { title: string; empty: string; otherLabel: string; otherPath: string }
> = {
  SHORT: {
    title: 'Short courses',
    empty: 'No short courses yet. Create one above.',
    otherLabel: 'Article courses',
    otherPath: '/courses/article',
  },
  ARTICLE: {
    title: 'Article courses',
    empty: 'No article courses yet. Create one above.',
    otherLabel: 'Short courses',
    otherPath: '/courses/short',
  },
};

export function CourseListPage({ courseMode }: { courseMode: CourseMode }) {
  const copy = MODE_COPY[courseMode];

  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', courseMode],
    queryFn: () => api.listCourses(courseMode),
  });

  const [editor, setEditor] = useState<EditorTarget>(null);
  const [highlightCourseId, setHighlightCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightCourseId) return;
    const t = setTimeout(() => setHighlightCourseId(null), HIGHLIGHT_MS);
    return () => clearTimeout(t);
  }, [highlightCourseId]);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{copy.title}</h2>
            <Link to={copy.otherPath} className="text-sm text-slate-500 hover:text-slate-800">
              Switch to {copy.otherLabel.toLowerCase()} →
            </Link>
          </div>
          <button
            onClick={() => setEditor({ mode: 'create' })}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New course
          </button>
        </div>

        {isLoading ? (
          <p className="text-slate-500">Loading…</p>
        ) : !courses?.length ? (
          <p className="text-slate-500">{copy.empty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li
                key={c.id}
                className={`rounded-md border bg-white p-4 transition-shadow ${
                  highlightCourseId === c.id ? 'ring-2 ring-emerald-400' : ''
                }`}
              >
                <h3 className="mb-1 font-medium">{c.title}</h3>
                <p className="line-clamp-2 text-sm text-slate-500">{c.content}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    to={`/courses/${c.id}/type`}
                    className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800"
                  >
                    Type this
                  </Link>
                  <button
                    onClick={() => setEditor({ mode: 'edit', course: c })}
                    className="rounded border px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  {c.annotations.length > 0 && (
                    <span className="text-xs text-slate-400">
                      {c.annotations.length} annotation{c.annotations.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editor && (
        <CourseEditorModal
          key={editor.mode === 'edit' ? `edit-${editor.course.id}` : `create-${courseMode}`}
          mode={editor.mode}
          course={editor.mode === 'edit' ? editor.course : undefined}
          presetCourseMode={courseMode}
          onClose={() => setEditor(null)}
          onSaved={(courseId) => {
            setEditor(null);
            setHighlightCourseId(courseId);
          }}
        />
      )}
    </div>
  );
}
