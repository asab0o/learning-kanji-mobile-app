import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { listKanji, listLessonEvents, listReviewEvents, listSentences } from '@/db';
import { planTodaysLessons, planTodaysReviews, TodayView } from '@/features/srs';

/**
 * 入口画面「今日の学習」(要件定義書 4.1 / 5.1-8)。
 *
 * ここが持つのはルーティングと DB の読み出しだけ。何を出すかの規則は
 * `planTodaysLessons()`(純粋関数)にある。
 *
 * 会話文の一覧は `learningkanjimobileapp://conversations` に移した(開発ビルド専用)。
 */
export default function TodayScreen() {
  const router = useRouter();
  // 開発ビルドでだけ上限を外せる(ADR-0003 の宿題)。リリースには出ない。
  const [ignoreLimit, setIgnoreLimit] = useState(false);
  // 描画の中で直接クエリを呼ぶと React Compiler にメモ化されるので、遅延初期化で1回だけ読む。
  const [snapshot, setSnapshot] = useState(() => read());

  // 会話文を終えて戻ってきたときに読み直す。遅延初期化だけだと、
  // 完了が入口画面に反映されず「押しても何も起きない」ように見える。
  useFocusEffect(
    useCallback(() => {
      setSnapshot(read());
    }, [])
  );

  const lessons = planTodaysLessons({
    sentences: snapshot.sentences,
    completions: snapshot.completions,
    now: snapshot.now,
    limit: ignoreLimit ? Number.POSITIVE_INFINITY : undefined,
  });

  // 復習には1日の上限を掛けない。ADR-0003 が抑えたいのは新規の投入速度で、
  // 復習の件数はその結果として決まる(docs/plans/srs-reviews.md)
  const reviews = planTodaysReviews({
    kanji: snapshot.kanji,
    lessons: snapshot.completions,
    reviews: snapshot.reviews,
    now: snapshot.now,
  });

  return (
    <TodayView
      lessons={lessons}
      kanji={snapshot.kanji}
      onSelect={(id) => router.push({ pathname: '/conversation/[id]', params: { id } })}
      reviewDueCount={reviews.dueCount}
      onOpenReviews={() => router.push('/review')}
      ignoreLimit={__DEV__ ? ignoreLimit : undefined}
      onChangeIgnoreLimit={__DEV__ ? setIgnoreLimit : undefined}
    />
  );
}

function read() {
  return {
    sentences: listSentences(),
    kanji: listKanji(),
    completions: listLessonEvents(),
    reviews: listReviewEvents(),
    // 「今日」も画面に入るたびに取り直す。描画中に `Date.now()` を呼ぶと
    // 再描画のたびに結果が変わる不純な関数になる(react-hooks/purity)。
    // 開きっぱなしで日をまたいでも、次に画面へ戻った時点で今日の枠に切り替わる。
    now: Date.now(),
  };
}
