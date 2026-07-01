import type { AnnotationDTO, CourseMode } from './course.js';
import { deriveAnchoredText } from './course.js';
import { categoryRollupFromMembers } from './categoryRollup.js';
import type { CategoryDTO } from './category.js';
import type { CourseDTO } from './course.js';
import { courseStatsFromRow } from './courseStats.js';

export type CatalogAnnotationSpec = {
  phrase: string;
  note: string;
};

/** User-agnostic onboarding definition; materialized into guest store or API seed. */
export type CatalogCourseDef = {
  mode: CourseMode;
  /** Omit or null = standalone on the mode list (no collection). */
  collectionName?: string | null;
  title: string;
  content: string;
  description?: string | null;
  annotations: CatalogAnnotationSpec[];
  /** Stable guest/API-agnostic id (8001 namespace). */
  stableId: string;
};

export const ONBOARDING_CATALOG_VERSION = 1;

/** Guest onboarding stable IDs (namespace 8001). */
export const GUEST_SAMPLES_CATEGORY_ID = '00000000-0000-4000-8001-000000000001';
export const GUEST_ONBOARDING_DEER_ID = '00000000-0000-4000-8001-000000000101';
export const GUEST_ONBOARDING_STRAY_ID = '00000000-0000-4000-8001-000000000102';
export const GUEST_ONBOARDING_RUSSELL_ID = '00000000-0000-4000-8001-000000000103';

const SEED_TIME = '2026-01-01T00:00:00.000Z';

export const ONBOARDING_COURSES: CatalogCourseDef[] = [
  {
    stableId: GUEST_ONBOARDING_DEER_ID,
    mode: 'SHORT',
    collectionName: 'Samples',
    title: 'Deer Enclosure 鹿柴 (Wang Wei)',
    content: `空山不见人，但闻人语响。
返景入深林，复照青苔上。`,
    description:
      'Deer Enclosure (Lu Zhai) is a celebrated Tang dynasty poem by Wang Wei, and one of the most beloved works in the Chinese literary canon. The poem moves through stillness, echo, and returning light: "Yet I hear the echo of voices" evokes echo, while "Shining once more upon luscious green moss" suggests return, repetition, and quiet settling. This course lets you type Wang Wei\'s lines, and the poem mirrors EchoType itself: quiet, repeated, echoing, and reflective, in sync with what the product is named for.',
    annotations: [
      { phrase: '空山', note: 'On the lonely mountain' },
      { phrase: '不见人', note: 'I see no one' },
      { phrase: '但闻人语响', note: 'Yet I hear the echo of voices' },
      { phrase: '返景', note: 'the returning sun rays' },
      { phrase: '入深林', note: 'Into the deep, deep forest' },
      { phrase: '复照青苔上', note: 'Shining once more upon luscious, green moss' },
    ],
  },
  {
    stableId: GUEST_ONBOARDING_STRAY_ID,
    mode: 'SHORT',
    collectionName: null,
    title: 'Stray Birds - 49',
    content: `I thank thee that I am none of the wheels of power but I am one with the living creatures that are crushed by it.`,
    annotations: [
      { phrase: 'thank', note: '感谢；致谢' },
      { phrase: 'wheels', note: '轮子（喻指权力运转的机器）' },
      { phrase: 'the living creatures', note: '有生命的造物；活生生的众生' },
    ],
  },
  {
    stableId: GUEST_ONBOARDING_RUSSELL_ID,
    mode: 'ARTICLE',
    collectionName: null,
    title: 'What I Have Lived For (excerpt)',
    content: `Three passions, simple but overwhelmingly strong, have governed my life: the longing for love, the search for knowledge, and unbearable pity for the suffering of mankind. These passions, like great winds, have blown me hither and thither, in a wayward course, over a deep ocean of anguish, reaching to the very verge of despair. I have sought love, first, because it brings ecstasy - ecstasy so great that I would often have sacrificed all the rest of life for a few hours of this joy. I have sought it, next, because it relieves loneliness - that terrible loneliness in which one shivering consciousness looks over the rim of the world into the cold unfathomable lifeless abyss. I have sought it, finally, because in the union of love I have seen, in a mystic miniature, the prefiguring vision of the heaven that saints and poets have imagined. This is what I sought, and though it might seem too good for human life, this is what - at last - I have found.`,
    annotations: [],
  },
];

export function buildCatalogAnnotations(
  content: string,
  specs: CatalogAnnotationSpec[],
): Array<Omit<AnnotationDTO, 'id'>> {
  return specs.map(({ phrase, note }) => {
    const startIndex = content.indexOf(phrase);
    if (startIndex < 0) {
      throw new Error(`catalog: phrase not found in content: "${phrase}"`);
    }
    const endIndex = startIndex + phrase.length - 1;
    return {
      startIndex,
      endIndex,
      noteText: note,
      anchoredText: deriveAnchoredText(content, startIndex, endIndex),
    };
  });
}

export type GuestCategoryRecord = {
  id: string;
  name: string;
  mode: CourseMode;
  description: string | null;
  isReadOnly: true;
  createdAt: string;
  updatedAt: string;
};

export type GuestCourseRecord = {
  id: string;
  title: string;
  content: string;
  mode: CourseMode;
  categoryId: string | null;
  description: string | null;
  annotations: AnnotationDTO[];
  createdAt: string;
  updatedAt: string;
  isReadOnly: boolean;
  source: 'onboarding' | 'guest';
};

const EMPTY_STATS_ROW = {
  totalDurationSec: 0,
  totalCompletedPasses: 0,
  sessionCount: 0,
  totalCharCount: 0,
  totalWpmCharSum: 0,
  totalAccCharSum: 0,
  lastPracticedAt: null as null,
};

export function emptyCourseStats() {
  return courseStatsFromRow(EMPTY_STATS_ROW);
}

export function emptyCategoryRollup() {
  return categoryRollupFromMembers([]);
}

/** Build initial guest-store onboarding categories + courses (read-only). */
export function materializeOnboardingGuestRecords(): {
  categories: GuestCategoryRecord[];
  courses: GuestCourseRecord[];
} {
  const categories: GuestCategoryRecord[] = [
    {
      id: GUEST_SAMPLES_CATEGORY_ID,
      name: 'Samples',
      mode: 'SHORT',
      description: null,
      isReadOnly: true,
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
    },
  ];

  const courses: GuestCourseRecord[] = ONBOARDING_COURSES.map((def) => {
    const categoryId =
      def.collectionName === 'Samples' ? GUEST_SAMPLES_CATEGORY_ID : null;
    const built = buildCatalogAnnotations(def.content, def.annotations);
    return {
      id: def.stableId,
      title: def.title,
      content: def.content,
      mode: def.mode,
      categoryId,
      description: def.description ?? null,
      annotations: built.map((a, i) => ({
        ...a,
        id: `onboarding-ann-${def.stableId}-${i}`,
      })),
      createdAt: SEED_TIME,
      updatedAt: SEED_TIME,
      isReadOnly: true,
      source: 'onboarding' as const,
    };
  });

  return { categories, courses };
}

export function guestCourseToDTO(
  record: GuestCourseRecord,
  categoryName: string | null,
): CourseDTO {
  return {
    id: record.id,
    title: record.title,
    content: record.content,
    mode: record.mode,
    categoryId: record.categoryId,
    categoryName,
    description: record.description,
    annotations: record.annotations,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    stats: emptyCourseStats(),
    lastPracticeHere: false,
  };
}

export function guestCategoryToDTO(
  record: GuestCategoryRecord,
  courseCount: number,
): CategoryDTO {
  return {
    id: record.id,
    name: record.name,
    mode: record.mode,
    description: record.description,
    courseCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rollup: emptyCategoryRollup(),
    lastPracticeHere: false,
  };
}

/** API seed adapter — strip stableId for Prisma materialize. */
export function onboardingDefsForApiSeed(): Array<{
  mode: CourseMode;
  collectionName?: string | null;
  title: string;
  content: string;
  description?: string | null;
  annotations: CatalogAnnotationSpec[];
}> {
  return ONBOARDING_COURSES.map(({ stableId: _id, ...rest }) => rest);
}
