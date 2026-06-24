import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CourseMode } from '@echotype/shared';
import { api } from '../../lib/api';

type AddCoursesModalProps = {
  courseMode: CourseMode;
  onClose: () => void;
  onConfirm: (courseIds: string[]) => void;
};

export function AddCoursesModal({ courseMode, onClose, onConfirm }: AddCoursesModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const { data: courses, isLoading } = useQuery({
    queryKey: ['courses', courseMode, 'null', '', 'createdAt_desc'],
    queryFn: () =>
      api.listCourses(courseMode, { categoryId: 'null', sort: 'createdAt_desc' }),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Add courses</h2>
        <p className="mt-1 text-sm text-slate-500">Select uncategorized courses from the main list.</p>
        <div className="mt-4 max-h-72 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !courses?.length ? (
            <p className="text-sm text-slate-500">No uncategorized courses available.</p>
          ) : (
            <ul className="space-y-1">
              {courses.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    <span className="text-sm">{c.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
