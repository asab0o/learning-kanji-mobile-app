import type { ChapterNumber, Sentence } from '@/content/types';
import type { EntitlementSnapshot } from '@/features/paywall/access';
import {
  gateSentences,
  isEntitled,
  isSentenceUnlocked,
  PREMIUM_ENTITLEMENT_ID,
} from '@/features/paywall/access';
import { planTodaysLessons } from '@/features/srs/lessons';

/**
 * フィクスチャで組む。実データ(`@/content`)を入力にすると、章の構成が変わるたびに
 * 前提が壊れる。ここで見たいのはロック規則であってコンテンツの中身ではない
 * (`src/features/srs/lessons.test.ts` と同じ方針)。
 */
const sentence = (order: number, chapter: ChapterNumber, isFree: boolean): Sentence => ({
  id: `s${order}`,
  chapter,
  order,
  scene: 'テスト',
  lines: [],
  newKanjiId: `k${order}`,
  reencounters: [],
  isFree,
});

/** 第1章2文(無料)+ 第2章3文(有料)。実データの「第1章だけ isFree」を縮めた形。 */
const catalogue: Sentence[] = [
  sentence(1, 1, true),
  sentence(2, 1, true),
  sentence(3, 2, false),
  sentence(4, 2, false),
  sentence(5, 2, false),
];

const snapshot = (activeIds: string[]): EntitlementSnapshot => ({
  entitlements: {
    active: Object.fromEntries(activeIds.map((id) => [id, { identifier: id }])),
  },
});

describe('isEntitled', () => {
  it('returns true when the premium entitlement is active', () => {
    expect(isEntitled(snapshot([PREMIUM_ENTITLEMENT_ID]))).toBe(true);
  });

  it('returns false when no entitlement is active', () => {
    expect(isEntitled(snapshot([]))).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isEntitled(null)).toBe(false);
    expect(isEntitled(undefined)).toBe(false);
  });

  /**
   * 識別子のタイポで全解放される事故を止める。ダッシュボードの実測値は `premium` で、
   * ここが一致しなければ購入しても開いてはならない。
   */
  it('returns false when only a different entitlement is active', () => {
    expect(isEntitled(snapshot(['pro', 'lifetime']))).toBe(false);
  });

  it('ignores inherited object properties', () => {
    // `active` が空でも `hasOwnProperty` 以外で見ていると `toString` 等で true になりうる
    expect(isEntitled(snapshot(['toString']))).toBe(false);
  });
});

describe('isSentenceUnlocked', () => {
  const free = sentence(1, 1, true);
  const paid = sentence(3, 2, false);

  it('opens a free sentence without a subscription', () => {
    expect(isSentenceUnlocked(free, false)).toBe(true);
  });

  it('keeps a paid sentence closed without a subscription', () => {
    expect(isSentenceUnlocked(paid, false)).toBe(false);
  });

  it('opens both once subscribed', () => {
    expect(isSentenceUnlocked(free, true)).toBe(true);
    expect(isSentenceUnlocked(paid, true)).toBe(true);
  });
});

describe('gateSentences', () => {
  it('keeps only the free sentences when locked, and counts the rest', () => {
    const gated = gateSentences({ sentences: catalogue, unlocked: false });

    expect(gated.unlocked.map((item) => item.id)).toEqual(['s1', 's2']);
    expect(gated.lockedCount).toBe(3);
  });

  it('keeps every sentence when unlocked', () => {
    const gated = gateSentences({ sentences: catalogue, unlocked: true });

    expect(gated.unlocked).toHaveLength(catalogue.length);
    expect(gated.lockedCount).toBe(0);
  });

  it('preserves the input order', () => {
    const shuffled = [catalogue[2], catalogue[0], catalogue[3], catalogue[1]];

    const gated = gateSentences({ sentences: shuffled, unlocked: false });

    expect(gated.unlocked.map((item) => item.id)).toEqual(['s1', 's2']);
  });

  it('does not fall over on an empty catalogue', () => {
    expect(gateSentences({ sentences: [], unlocked: false })).toEqual({
      unlocked: [],
      lockedCount: 0,
    });
  });
});

/**
 * 申し送り(`docs/plans/srs-lessons.md`)の「入力の文の配列をフィルタする形で被せられる」が
 * 実際に成立していることの証明。SRS 側は購読を一切知らないままでよい。
 */
describe('gateSentences feeding planTodaysLessons', () => {
  const now = new Date(2026, 8, 3, 12).getTime();

  it('never offers a paid sentence while locked, even with the daily limit to spare', () => {
    const gated = gateSentences({ sentences: catalogue, unlocked: false });

    const lessons = planTodaysLessons({ sentences: gated.unlocked, completions: [], now });

    // 上限は3字。無料は2文しか無いので枠は余るが、第2章は1件も入らない
    expect(lessons.items.map((item) => item.sentence.id)).toEqual(['s1', 's2']);
  });

  it('offers the paid sentences once unlocked', () => {
    const gated = gateSentences({ sentences: catalogue, unlocked: true });

    const lessons = planTodaysLessons({ sentences: gated.unlocked, completions: [], now });

    expect(lessons.items.map((item) => item.sentence.id)).toEqual(['s1', 's2', 's3']);
  });
});
