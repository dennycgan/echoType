import { Link } from 'react-router-dom';
import type { CourseDTO } from '@echotype/shared';
import { toCardPreviewLine } from '../../lib/courseCard';
import { CardOverflowMenu, type OverflowMenuItem } from '../CardOverflowMenu';

type CourseListCardProps = {
  course: CourseDTO;
  highlight?: boolean;
  bulkMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  deleting?: boolean;
  menuItems: OverflowMenuItem[];
  onEdit: () => void;
  /** Show "In: {collection}" badge (mode list search hits only). */
  showInCollectionLabel?: boolean;
};

export function CourseListCard({
  course,
  highlight,
  bulkMode,
  selected,
  onToggleSelect,
  deleting,
  menuItems,
  onEdit,
  showInCollectionLabel = false,
}: CourseListCardProps) {
  return (
    <li
      className={`flex min-h-40 flex-col rounded-md border bg-white p-4 transition-shadow ${
        highlight ? 'ring-2 ring-emerald-400' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {bulkMode && (
          <input
            type="checkbox"
            className="mt-1 shrink-0"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${course.title}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-1 min-w-0 flex-1 overflow-hidden font-medium">{course.title}</h3>
            <CardOverflowMenu items={menuItems} ariaLabel={`Course actions for ${course.title}`} />
          </div>
          {showInCollectionLabel && course.categoryName && (
            <p className="mt-0.5 text-xs text-slate-400">
              Inside collection: {course.categoryName}
            </p>
          )}
        </div>
      </div>
      <p
        className={`mt-1 line-clamp-1 overflow-hidden text-sm leading-5 ${
          course.description?.trim() ? 'text-slate-500' : 'text-slate-300'
        }`}
      >
        {course.description?.trim() ? toCardPreviewLine(course.description) : '—'}
      </p>
      <div className="h-5 shrink-0" aria-hidden />
      <p className="line-clamp-1 overflow-hidden text-sm leading-5 text-slate-500">
        <span className="text-slate-400">Content: </span>
        {toCardPreviewLine(course.content)}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        <Link
          to={`/courses/${course.id}/type`}
          className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800"
        >
          Type this
        </Link>
        <button
          onClick={onEdit}
          className="rounded border px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
        >
          Edit
        </button>
        {deleting && <span className="text-xs text-slate-400">Deleting…</span>}
        {course.annotations.length > 0 && (
          <span className="text-xs text-slate-400">
            {course.annotations.length} annotation{course.annotations.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </li>
  );
}
