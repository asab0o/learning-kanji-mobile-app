/**
 * 課金ゲートの純粋ロジック(要件定義書 7章 / 5.1-11)。
 *
 * **このファイルは `react-native-purchases` も `@/db` も import しない。**
 * 前者はネイティブモジュールなので Jest から触れず、後者は import しただけで
 * SQLite を開く(`@/features/srs/index.ts` の境界コメントと同じ理由)。
 * 判定はすべてここに置き、SDK との受け渡しは `./purchases` が持つ。
 */

import type { Sentence } from '@/content/types';

/**
 * RevenueCat のエンタイトルメント識別子。
 *
 * ダッシュボードの実測値(2026-09-03 時点、project `proj67324f83`)。
 * 本番の `com.asakiita.learningkanji.premium.monthly` と Test Store の
 * `premium_monthly_test` の**両方**がこの1つに紐付いているので、
 * API キーを本番に差し替えてもここは変わらない。
 */
export const PREMIUM_ENTITLEMENT_ID = 'premium';

/**
 * `CustomerInfo` のうち、判定に必要な部分だけを写した型。
 *
 * SDK の `CustomerInfo` をそのまま受けると `react-native-purchases` への import が
 * 必要になり、このファイルがテストから到達できなくなる。構造的に緩く受けることで、
 * テストは素のオブジェクトを渡せる。実際の `CustomerInfo` はこの形を満たす。
 */
export interface EntitlementSnapshot {
  entitlements: {
    active: Record<string, unknown>;
  };
}

/** 有料範囲を開ける権利を今持っているか。 */
export function isEntitled(info: EntitlementSnapshot | null | undefined): boolean {
  if (info === null || info === undefined) {
    return false;
  }

  // `active` は「いま有効なもの」だけが入るマップなので、鍵の有無だけで判定できる
  // (期限切れは `all` には残るが `active` からは消える)。
  return Object.prototype.hasOwnProperty.call(info.entitlements.active, PREMIUM_ENTITLEMENT_ID);
}

/**
 * この会話文を今開いてよいか。
 *
 * `isFree` は第1章の文だけ true(`validate:content` が検証している)。
 */
export function isSentenceUnlocked(sentence: Sentence, unlocked: boolean): boolean {
  return sentence.isFree || unlocked;
}

export interface GateSentencesInput {
  sentences: Sentence[];
  /** 購読中なら true。判定中(`unknown`)は false を渡してロック側に倒す。 */
  unlocked: boolean;
}

export interface GatedSentences {
  /** 今開いてよい会話文。**入力の並び順を保つ。** */
  unlocked: Sentence[];
  /** ロックで外した本数。0 なら解放の導線を出さなくてよい。 */
  lockedCount: number;
}

/**
 * 会話文の配列からロック中のものを外す。
 *
 * `planTodaysLessons()` の**入力**をこれで絞る。`docs/plans/srs-lessons.md` の申し送りが
 * 「入力の文の配列をフィルタする形で被せられるよう、関数の入出力を文の配列に保っておく」
 * としているのがここ。SRS 側の純粋ロジックは1行も変えない。
 *
 * 並び順を保つのは、`planTodaysLessons()` が自分で並べ替えるとはいえ、
 * 入力側で崩す理由が無いため(崩すと将来の呼び出し側が順序を仮定できなくなる)。
 */
export function gateSentences({ sentences, unlocked }: GateSentencesInput): GatedSentences {
  if (unlocked) {
    return { unlocked: sentences, lockedCount: 0 };
  }

  const allowed = sentences.filter((sentence) => sentence.isFree);

  return { unlocked: allowed, lockedCount: sentences.length - allowed.length };
}
