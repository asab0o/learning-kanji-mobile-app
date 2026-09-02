import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

import { listKanji, listLessonEvents, listReviewEvents } from '@/db';
import {
  advanceReviewSession,
  answerReviewSession,
  createReviewSession,
  planTodaysReviews,
  recordReview,
  ReviewSessionView,
} from '@/features/srs';

/**
 * 復習セッションの画面。ルーティングと DB の読み書きだけを持つ。
 *
 * **キューはこの画面に入った時点で1回だけ作る。** 描画のたびに作り直すと、
 * 1問答えて `review_events` が増えるたびに出題が入れ替わってしまう。
 */
export default function ReviewScreen() {
  const [pool] = useState(() => listKanji());
  const [session, setSession] = useState(() => {
    const { items } = planTodaysReviews({
      kanji: pool,
      lessons: listLessonEvents(),
      reviews: listReviewEvents(),
      now: Date.now(),
    });

    return createReviewSession({ items, pool });
  });
  const router = useRouter();

  /**
   * 選択肢を選んだとき。1問ごとに DB へ書く(途中でやめても、そこまでの結果は残る)。
   *
   * **判定も書き込みも `setSession` の外でやる。`setSession(current => ...)` の形で
   * 渡す関数(updater function)の中に `recordReview()` を入れてはいけない。**
   *
   * React は updater function を「同じ入力なら同じ出力を返すだけの、副作用のない関数」
   * として扱う契約で、**必要なら複数回呼ぶ**。開発時の StrictMode は意図的に2回呼び、
   * 並行レンダリングでは更新が巻き戻されて再実行されることがある。
   * このリポジトリは `app.json` の `reactCompiler: true` を有効にしているので、
   * その純粋性はコンパイラの最適化の前提そのものになっている。
   *
   * 中で書くと**1回の回答で `review_events` に2行入る**。ステージはイベントの
   * 畳み込みで求める(絶対規則5)ので、正解1回が2回として数えられ、
   * **ステージが 1 → 2 ではなく 1 → 3 に飛び、次回出題日が2日後ではなく4日後になる**。
   * しかも画面には何も異常が出ない。答え合わせも進捗も正しく見えて、
   * 壊れるのは数日後の出題日だけ。復習アプリで一番気づけない壊れ方をする。
   *
   * **eslint は止めてくれない。** `react-hooks/purity` は描画中の不純な呼び出し
   * (`Date.now()` など。`src/app/index.tsx` を参照)は弾くが、
   * updater function の中身までは見ない。ここは人が守るしかない。
   */
  const select = useCallback(
    (choice: string) => {
      if (session.current === null || session.answered !== null) {
        return;
      }

      const kanjiId = session.current.kanji.id;
      const next = answerReviewSession(session, choice);

      // 記録するのは1字につき最初の回答だけ(`ReviewAnswer.first`)。
      // 出し直しの正解まで書くと降格が打ち消される
      if (next.answered !== null && next.answered.first) {
        recordReview({ kanjiId, result: next.answered.correct ? 'correct' : 'incorrect' });
      }

      setSession(next);
    },
    [session]
  );

  const next = useCallback(() => {
    setSession(advanceReviewSession({ state: session, pool }));
  }, [session, pool]);

  const quit = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router]);

  return <ReviewSessionView session={session} onSelect={select} onNext={next} onQuit={quit} />;
}
