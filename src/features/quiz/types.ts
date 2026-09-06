/**
 * 推測クイズ「読めるかな?」の型(要件定義書 4.4 / 5.1-6)。
 *
 * **`@/features/srs` の型を import しない。** 復習とクイズは別系統で、
 * クイズの結果は SRS に入らない(絶対規則10)。境界は `boundaries.test.ts` が機械で見る。
 * srs 側が `ReviewRecord` を自前で定義しているのと同じ扱い。
 */

/** 出題した語を指す不透明なキー。`quiz_attempts.item_key` に入る */
export type QuizItemKey = string;

/**
 * 出題タイミング。難易度の寄せ方だけが変わる(要件定義書 4.4)。
 *
 * 要件は「学習直後=易しめ / 復習中=難しめ」と書いているが、**構成字が全部既習の語**は
 * 15字目まで1問も存在しない(実データで確認)。無料範囲の第1章だけを終えた学習者は
 * 易しい問題に一度も当たらないので、難易度を**時間軸**で読み替えている
 * (`docs/plans/guess-quiz.md` 差分2。2026-09-06 承認)。
 */
export type QuizSlot = 'lesson' | 'review';

/** 種明かしの1行。「人 = person」 */
export interface QuizComponent {
  /** 漢字1字 */
  character: string;
  /** 英語の意味。`KanjiEntry.meaning` をそのまま使う */
  meaning: string;
  /** 既に学んだ字か。未習の相方は薄く出す */
  learned: boolean;
}

/**
 * 出題1問。**画面が判断を持たなくていいところまで詰めてある。**
 *
 * 「どの字が既習か」「種明かしに何を出すか」を画面側で計算させない。
 * 選定の条件(`selection.ts`)と表示が二重に真実を持つのを避けるため。
 */
export interface QuizItem {
  itemKey: QuizItemKey;
  /** 表記(例: 人間)。第1段ではこれだけを大きく出す */
  surface: string;
  /** ひらがな読み。答え合わせでだけ見せる */
  kana: string;
  /** 英語の意味 = 正解の選択肢 */
  meaning: string;
  /** 構成字の内訳。`surface` に出てくる順 */
  components: QuizComponent[];
}

/** 導入済みの漢字1字。`lesson_events` の畳み込み結果を受け取る形 */
export interface LearnedKanji {
  kanjiId: string;
  /** その字を導入した回を終えた時刻 */
  completedAt: number;
}
