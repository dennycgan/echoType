import { CourseMode } from '@prisma/client';
import type { CatalogCourseDef } from './types.js';

/**
 * Phase 6 onboarding catalog (Auth Phase 2+). Single source of truth for prod
 * onboarding and local dev seed — do not duplicate course text elsewhere.
 */
export const ONBOARDING_COURSES: CatalogCourseDef[] = [
  {
    mode: CourseMode.SHORT,
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
    mode: CourseMode.SHORT,
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
    mode: CourseMode.ARTICLE,
    collectionName: null,
    title: 'What I Have Lived For (excerpt)',
    content: `Three passions, simple but overwhelmingly strong, have governed my life: the longing for love, the search for knowledge, and unbearable pity for the suffering of mankind. These passions, like great winds, have blown me hither and thither, in a wayward course, over a deep ocean of anguish, reaching to the very verge of despair. I have sought love, first, because it brings ecstasy - ecstasy so great that I would often have sacrificed all the rest of life for a few hours of this joy. I have sought it, next, because it relieves loneliness - that terrible loneliness in which one shivering consciousness looks over the rim of the world into the cold unfathomable lifeless abyss. I have sought it, finally, because in the union of love I have seen, in a mystic miniature, the prefiguring vision of the heaven that saints and poets have imagined. This is what I sought, and though it might seem too good for human life, this is what - at last - I have found.`,
    annotations: [],
  },
];
