/**
 * 初回オンボーディングの3画面ぶんの文言(要件定義書 5.1-10)。
 *
 * **要件4章は「3つ組」を2種類持っている。** 冒頭表の差別化3層(入口=会話文 /
 * 体験=推測クイズ / 可視化=漢字の樹)と、4.1 の学習ループを畳んだ3段
 * (出会う → SRSで復習 → 段階的に再登場)で、共通するのは「出会う」だけ。
 * どちらか一方に寄せると、要件自身が「面白さの主軸」と呼ぶ推測クイズか、
 * 最大の差別化である再登場(4.6)のどちらかが落ちる。
 *
 * そこで**骨格はループにし、クイズと樹を画面2・3に一文ずつ相乗りさせる**。
 * 画面を4枚に増やして「3画面程度」から外れるより軽いと判断した
 * (docs/plans/onboarding.md 先に確認したい点1)。
 *
 * **React も @/theme も @/db も import しない純粋データ。** 色を持たせないのは
 * 絶対規則1、文言が英語なのは絶対規則7。日本語は `sample` にだけ隔離してあり、
 * `steps.test.ts` が両方を機械で見張っている。
 */

import { DAILY_NEW_KANJI_LIMIT } from '@/features/srs/lessons';

export type OnboardingStepId = 'meet' | 'review' | 'return';

/** 3画面目だけが持つ、読みが変わることの実例(要件定義書 4.3 / 4.6)。 */
export interface OnboardingSample {
  kanji: string;
  /** 訓読み。樹では緑の枝(theme.kunBranch) */
  kun: string;
  /** 音読み。樹では青の枝(theme.onBranch) */
  on: string;
  /** 英語の意味。読みが変わっても意味の核は動かないことを見せる */
  gloss: string;
}

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  body: string;
  sample?: OnboardingSample;
}

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: 'meet',
    title: 'Meet kanji in a conversation',
    body: 'Every lesson is a short chat between Mia, her host grandma, and Sora the cat. You meet a new kanji inside the talk, not in a list.',
  },
  {
    id: 'review',
    title: `${DAILY_NEW_KANJI_LIMIT} kanji a day, then review`,
    // 上限を本文に書くのは要件に無い判断。初日に打ち止めになるのを故障と
    // 誤解されるため(docs/plans/onboarding.md 先に確認したい点2)。
    // ADR-0003 で上限を変えたらここも変わるよう、定数から組み立てている。
    body: `You learn up to ${DAILY_NEW_KANJI_LIMIT} new kanji a day, then meet them again in short reviews. Sometimes we show you a word you have never seen and let you guess what it means.`,
  },
  {
    id: 'return',
    title: 'The same kanji comes back',
    body: 'Later it returns inside a new word with a new reading. The sound changes, the meaning stays. Every kanji you meet grows its own tree of words.',
    // 空気 / 空港 はどの会話文にも出ず、第2段階の演出語8つにも含まれない。
    // アプリ内で後から起きる驚きを先食いしない例として選んだ
    // (docs/plans/onboarding.md 先に確認したい点3)。
    sample: { kanji: '空', kun: 'そら', on: 'くう', gloss: 'sky / empty' },
  },
];
