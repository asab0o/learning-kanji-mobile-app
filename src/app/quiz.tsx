import { useCallback, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  listKanji,
  listLessonEvents,
  listRecentQuizAttempts,
  listSentences,
  listWords,
} from '@/db';
import {
  buildQuizChoices,
  pickQuizItem,
  QuizView,
  RECENT_ITEM_MEMORY,
  recordQuizAttempt,
} from '@/features/quiz';
import type { QuizSlot } from '@/features/quiz';

/**
 * 推測クイズの画面。ルーティングと DB の読み書きだけを持つ。
 *
 * **出題はこの画面に入った時点で1回だけ決める。** 描画のたびに選び直すと、
 * 選択肢を押した瞬間に別の語に入れ替わる。
 *
 * **課金ゲートを掛けていないのは意図的。** 出題は「既習字を含む語」に限られ、既習字は
 * ゲート済みの学習フロー(`gateSentences`)を通ってしか増えないので、未購読者の出題範囲は
 * 構造的に第1章の10字由来に閉じる。クイズは会話文を1行も表示しないため、有料の中身
 * (会話文と学習フロー)は漏れない(docs/plans/guess-quiz.md 実装ステップ6)。
 */
export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    slot?: string | string[];
    kanji?: string | string[];
  }>();
  const rawSlot = Array.isArray(params.slot) ? params.slot[0] : params.slot;
  const slot: QuizSlot = rawSlot === 'review' ? 'review' : 'lesson';
  // 学習直後だけ付く。たった今学び終えた字を含む語を最優先で出すため
  const focusKanjiId = Array.isArray(params.kanji) ? params.kanji[0] : params.kanji;

  // 描画の中で直接クエリを呼ぶと React Compiler にメモ化されるので、遅延初期化で1回だけ読む
  // (`src/app/index.tsx` と同じ)。出題と4択はここで確定し、以後作り直さない
  const [{ item, choices }] = useState(() => read(slot, focusKanjiId));
  const [choicesShown, setChoicesShown] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  /**
   * 選択肢を選んだとき。
   *
   * **書き込みを `setState` の updater function の中に入れない。** React は updater を
   * 副作用の無い純粋な関数として扱い、必要なら複数回呼ぶ(このリポジトリは
   * `reactCompiler: true` なので、その純粋性は最適化の前提でもある)。
   * 中で書くと1回の回答で `quiz_attempts` に2行入り、「同じ問題を続けて出さない」の窓が
   * 静かに1つぶんずれる。理由の詳細は `src/app/review.tsx` の同じ箇所のコメント。
   *
   * **`review_events` には書かない**(絶対規則10)。ここで記録するのは
   * 「この語を出した」ことだけで、正誤は復習の出題日に一切影響しない。
   */
  const select = useCallback(
    (choice: string) => {
      if (item === null || selected !== null) {
        return;
      }

      recordQuizAttempt({
        itemKey: item.itemKey,
        result: choice === item.meaning ? 'correct' : 'incorrect',
      });

      setSelected(choice);
    },
    [item, selected]
  );

  /**
   * 終えて入口に戻る。
   *
   * 学習からの流入は「会話文 → 漢字フォーカス → クイズ」と積み上がっているので、
   * 1枚ずつ戻さずまとめて畳む(`src/app/kanji/[id].tsx` の `complete` と同じ理由)。
   */
  const done = useCallback(() => {
    if (router.canDismiss()) {
      router.dismissAll();
    } else {
      router.replace('/');
    }
  }, [router]);

  return (
    <QuizView
      item={item}
      choices={choices}
      choicesShown={choicesShown}
      selected={selected}
      onShowChoices={() => setChoicesShown(true)}
      onSelect={select}
      onDone={done}
    />
  );
}

function read(slot: QuizSlot, focusKanjiId: string | undefined) {
  const sentences = listSentences();
  const words = listWords();
  const lessons = listLessonEvents();

  const item = pickQuizItem({
    words,
    kanji: listKanji(),
    // 第2段階の演出語。ここを渡し忘れると、演出回に着く前にクイズが答えを明かす
    // (docs/plans/guess-quiz.md 差分3)
    reencounterWords: sentences.flatMap((sentence) =>
      sentence.reencounters.map((reencounter) => reencounter.word)
    ),
    // 第2段階専用の回は新出漢字が無い(`kanjiId` が null)ので、そこは既習に数えない
    learned: lessons.flatMap((lesson) =>
      lesson.kanjiId === null ? [] : [{ kanjiId: lesson.kanjiId, completedAt: lesson.completedAt }]
    ),
    completedSentenceIds: lessons.map((lesson) => lesson.sentenceId),
    recentItemKeys: listRecentQuizAttempts(RECENT_ITEM_MEMORY).map((attempt) => attempt.itemKey),
    slot,
    focusKanjiId,
    // 描画中に `Date.now()` を呼ぶと不純になる(react-hooks/purity)ので、
    // 遅延初期化のここで1回だけ取る
    now: Date.now(),
  });

  return {
    item,
    choices: item === null ? [] : buildQuizChoices({ target: item, words }),
  };
}
