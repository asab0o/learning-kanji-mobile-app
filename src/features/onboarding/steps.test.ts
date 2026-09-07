/**
 * オンボーディング文言の不変条件。
 *
 * 見た目と遷移はシミュレータで見るしかないが、**「3画面である」「UI文言が英語である」**
 * の2つは機械で固定できるのでここで見張る(docs/plans/onboarding.md テスト方針)。
 *
 * `@/features/srs/lessons` を直接 import する。`@/features/srs` のバレルは
 * `@/db` に到達し、`@/db/client` は import しただけで SQLite を開くため。
 */

import { ONBOARDING_STEPS } from '@/features/onboarding/steps';
import { DAILY_NEW_KANJI_LIMIT } from '@/features/srs/lessons';

/** 印字可能な ASCII だけでできているか。日本語が混じれば false */
function isAscii(value: string): boolean {
  return /^[\x20-\x7E]*$/.test(value);
}

describe('ONBOARDING_STEPS', () => {
  it('ちょうど3画面で、ループの順に並ぶ', () => {
    // 要件定義書 5.1-10 の「3画面程度」。増やすならプランの合意からやり直す
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual(['meet', 'review', 'return']);
  });

  it('どの画面にも見出しと本文がある', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });

  it('見出しと本文はすべて英語(絶対規則7)', () => {
    for (const step of ONBOARDING_STEPS) {
      expect(isAscii(step.title)).toBe(true);
      expect(isAscii(step.body)).toBe(true);
    }
  });

  it('日本語のサンプルは3画面目だけに隔離されている', () => {
    for (const step of ONBOARDING_STEPS) {
      if (step.id !== 'return') {
        expect(step.sample).toBeUndefined();
        continue;
      }

      const sample = step.sample;

      if (sample === undefined) {
        throw new Error('3画面目には読みが変わる実例が要る(要件定義書 4.6)');
      }

      expect(isAscii(sample.kanji)).toBe(false);
      expect(isAscii(sample.kun)).toBe(false);
      expect(isAscii(sample.on)).toBe(false);
      // 意味だけは英語。読みが変わっても意味の核が動かないことを英語で見せる
      expect(isAscii(sample.gloss)).toBe(true);
    }
  });

  it('1日の上限を本文に書いてある(ADR-0003 を変えたら文言も直す)', () => {
    const review = ONBOARDING_STEPS.find((step) => step.id === 'review');

    expect(review?.body).toContain(String(DAILY_NEW_KANJI_LIMIT));
    expect(review?.title).toContain(String(DAILY_NEW_KANJI_LIMIT));
  });
});
