import { Link } from 'react-router-dom';
import type { CategoryDTO, CourseMode } from '@echotype/shared';
import { collectionDetailPath } from '../../lib/collectionPaths';
import { toCardPreviewLine } from '../../lib/courseCard';
import { CardOverflowMenu, type OverflowMenuItem } from '../CardOverflowMenu';

type CollectionCardProps = {
  category: CategoryDTO;
  courseMode: CourseMode;
  menuItems: OverflowMenuItem[];
};

export function CollectionCard({ category, courseMode, menuItems }: CollectionCardProps) {
  const detailPath = collectionDetailPath(courseMode, category.id);

  return (
    <li className="rounded-md border bg-white transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <Link to={detailPath} className="min-w-0 flex-1">
          <h3 className="line-clamp-1 overflow-hidden font-medium">{category.name}</h3>
          <p
            className={`mt-1 line-clamp-1 overflow-hidden text-sm leading-5 ${
              category.description?.trim() ? 'text-slate-500' : 'text-slate-300'
            }`}
          >
            {category.description?.trim() ? toCardPreviewLine(category.description) : '—'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {category.courseCount} course{category.courseCount === 1 ? '' : 's'}
          </p>
        </Link>
        <CardOverflowMenu items={menuItems} ariaLabel={`Collection actions for ${category.name}`} />
      </div>
    </li>
  );
}
