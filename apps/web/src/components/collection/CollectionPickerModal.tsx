import { useQuery } from '@tanstack/react-query';
import type { CategoryDTO, CourseMode } from '@echotype/shared';
import { api } from '../../lib/api';

type CollectionPickerModalProps = {
  courseMode: CourseMode;
  title: string;
  excludeCategoryId?: string;
  onClose: () => void;
  onPick: (category: CategoryDTO) => void;
  onNewCollection?: () => void;
};

export function CollectionPickerModal({
  courseMode,
  title,
  excludeCategoryId,
  onClose,
  onPick,
  onNewCollection,
}: CollectionPickerModalProps) {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', courseMode, '', 'createdAt_desc'],
    queryFn: () => api.listCategories(courseMode, { sort: 'createdAt_desc' }),
  });

  const options = (categories ?? []).filter((c) => c.id !== excludeCategoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-4 max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-slate-500">No collections yet.</p>
          ) : (
            <ul className="space-y-1">
              {options.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className="w-full rounded px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    {c.name}
                    <span className="ml-2 text-xs text-slate-400">
                      {c.courseCount} course{c.courseCount === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {onNewCollection && (
            <button
              type="button"
              onClick={onNewCollection}
              className="mr-auto rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              New collection…
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
