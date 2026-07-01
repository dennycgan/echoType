import { CourseMode } from '@prisma/client';
import type { CatalogCourseDef } from './types.js';

const GETTYSBURG_OPENING = `Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.

Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.`;

/** Local dev / QA only — not used for Phase 6 onboarding. */
export const DEV_QA_COURSES: CatalogCourseDef[] = [
  {
    mode: CourseMode.SHORT,
    collectionName: 'Stray Birds',
    title: 'Phase 4.2 — Three Notes (SHORT)',
    content: `The maiden in the meadow thanked the wheels of fortune for the gentle rain upon every living creature in the meadow below the amber sky at dusk.`,
    annotations: [
      { phrase: 'maiden', note: '少女；妇人' },
      { phrase: 'wheels', note: '轮子（喻指命运或权力的齿轮）' },
      { phrase: 'living creature', note: '有生命的造物' },
    ],
  },
  {
    mode: CourseMode.SHORT,
    collectionName: 'Stray Birds',
    title: 'Phase 4.2 — Twelve Notes (SHORT)',
    content: `When silence falls upon the meadow, the heron stands still by the reeds. A distant bell rings twice across the water. Morning light touches every leaf and every stone along the path we walked yesterday.`,
    annotations: [
      { phrase: 'silence', note: '寂静' },
      { phrase: 'meadow', note: '草地' },
      { phrase: 'heron', note: '苍鹭' },
      { phrase: 'reeds', note: '芦苇' },
      { phrase: 'distant', note: '遥远的' },
      { phrase: 'bell', note: '钟声' },
      { phrase: 'water', note: '水面' },
      { phrase: 'Morning', note: '清晨' },
      { phrase: 'leaf', note: '叶子' },
      { phrase: 'stone', note: '石头' },
      { phrase: 'path', note: '小径' },
      { phrase: 'yesterday', note: '昨天' },
    ],
  },
  {
    mode: CourseMode.ARTICLE,
    collectionName: 'Classic Essays',
    title: 'Gettysburg Address (opening)',
    content: GETTYSBURG_OPENING,
    annotations: [],
  },
];
