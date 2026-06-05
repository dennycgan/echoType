import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CourseDTO } from '@echotype/shared';
import { api } from '../lib/api';
import { CourseEditorModal } from '../components/editor/CourseEditorModal';

type EditorTarget = { mode: 'create' } | { mode: 'edit'; course: CourseDTO } | null;

const HIGHLIGHT_MS = 2000;

export function CoursesPage() {
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: api.listCourses,
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your courses</h2>
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
          <p className="text-slate-500">No courses yet. Create one above.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.map((c) => (
              <li
                key={c.id}
                className={`rounded-md border bg-white p-4 transition-shadow ${
                  highlightCourseId === c.id ? 'ring-2 ring-emerald-400' : ''
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-medium">{c.title}</h3>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {c.mode}
                  </span>
                </div>
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
          key={editor.mode === 'edit' ? `edit-${editor.course.id}` : 'create'}
          mode={editor.mode}
          course={editor.mode === 'edit' ? editor.course : undefined}
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
