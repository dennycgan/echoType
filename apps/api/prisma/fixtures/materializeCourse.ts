import type { CourseMode, PrismaClient } from '@prisma/client';
import type { CatalogAnnotationSpec, CatalogCourseDef } from './types.js';

export type BuiltAnnotation = {
  startIndex: number;
  endIndex: number;
  noteText: string;
  anchoredText: string;
};

/** Locate phrases in content; endIndex inclusive (ADR-0001 anchor snapshot rules). */
export function buildAnnotations(
  content: string,
  specs: CatalogAnnotationSpec[],
): BuiltAnnotation[] {
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
      anchoredText: content.slice(startIndex, endIndex + 1),
    };
  });
}

async function resolveCategoryId(
  prisma: PrismaClient,
  userId: string,
  mode: CourseMode,
  collectionName: string | null | undefined,
): Promise<string | null> {
  if (!collectionName) return null;
  const category = await prisma.category.upsert({
    where: {
      userId_mode_name: { userId, mode, name: collectionName },
    },
    update: {},
    create: { userId, mode, name: collectionName },
  });
  return category.id;
}

async function upsertCatalogCourse(
  prisma: PrismaClient,
  userId: string,
  categoryId: string | null,
  def: CatalogCourseDef,
) {
  const annotations = buildAnnotations(def.content, def.annotations);
  const existing = await prisma.course.findFirst({
    where: { userId, mode: def.mode, title: def.title },
  });
  if (!existing) {
    await prisma.course.create({
      data: {
        userId,
        categoryId,
        title: def.title,
        content: def.content,
        mode: def.mode,
        description: def.description ?? null,
        annotations: { create: annotations },
      },
    });
    return;
  }
  await prisma.$transaction([
    prisma.course.update({
      where: { id: existing.id },
      data: {
        content: def.content,
        mode: def.mode,
        categoryId,
        description: def.description ?? null,
      },
    }),
    prisma.annotation.deleteMany({ where: { courseId: existing.id } }),
    prisma.annotation.createMany({
      data: annotations.map((a) => ({ ...a, courseId: existing.id })),
    }),
  ]);
}

export async function materializeCoursesForUser(
  prisma: PrismaClient,
  userId: string,
  defs: CatalogCourseDef[],
) {
  for (const def of defs) {
    const categoryId = await resolveCategoryId(prisma, userId, def.mode, def.collectionName);
    await upsertCatalogCourse(prisma, userId, categoryId, def);
  }
}

export async function upsertLocalDevUser(prisma: PrismaClient, userId: string) {
  return prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: 'dev@echotype.local',
      name: 'Local Dev',
    },
  });
}
