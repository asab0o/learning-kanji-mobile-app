import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';

import { listKanji, listLessonEvents, listReviewEvents, listSentences, listWords } from '@/db';
import { gateSentences, useEntitlement } from '@/features/paywall';
import { useOnboardingCompleted } from '@/features/settings';
import {
  planTodaysLessons,
  planTodaysReviews,
  requestMoreLessons,
  TodayView,
  type MoreLessonsRequest,
} from '@/features/srs';
import { buildTreeIndex } from '@/features/tree';

/**
 * 入口画面「今日の学習」(要件定義書 4.1 / 5.1-8)。
 *
 * ここが持つのはルーティングと DB の読み出しだけ。何を出すかの規則は
 * `planTodaysLessons()`(純粋関数)にある。
 *
 * 会話文の一覧は `learningkanjimobileapp://conversations` に移した(開発ビルド専用)。
 *
 * 課金ゲートはここで**入力の文の配列を絞る**形で被せる(`gateSentences()`)。
 * `planTodaysLessons()` も `planTodaysReviews()` も購読を知らないままでよい
 * (docs/plans/paywall-gate.md 決めどころ1・2)。
 */
export default function TodayScreen() {
  const router = useRouter();
  // 開発ビルドでだけ目標の枠と第2段階の翌日規則を外せる。外せないと、第2段階を確かめるのに
  // 毎回1日待つことになる。リリースには出ない。
  const [devUnrestricted, setDevUnrestricted] = useState(false);
  // 「もう3字」を押したこと。**その日だけの UI 状態**で永続化しない(ADR-0011)。
  // 押した日でなければ `planTodaysLessons()` が無視するので、日をまたいでも持ち越さない
  const [moreRequest, setMoreRequest] = useState<MoreLessonsRequest | null>(null);
  // 描画の中で直接クエリを呼ぶと React Compiler にメモ化されるので、遅延初期化で1回だけ読む。
  const [snapshot, setSnapshot] = useState(() => read());

  // 会話文を終えて戻ってきたときに読み直す。遅延初期化だけだと、
  // 完了が入口画面に反映されず「押しても何も起きない」ように見える。
  useFocusEffect(
    useCallback(() => {
      setSnapshot(read());
    }, [])
  );

  // 判定中(`unknown`)は unlocked=false でロック側に倒す。無料の第1章は常に出るので、
  // 未購読者から見れば待たされない(docs/plans/paywall-gate.md 決めどころ6)。
  const entitlement = useEntitlement();
  const onboardingCompleted = useOnboardingCompleted();

  // 初回だけオンボーディングに割り込む(要件定義書 5.1-10)。
  //
  // **hooks を全部呼び切ってから返す。** 早期 return を上に置くと、
  // 初回と2回目以降で hooks の呼び出し数が変わって React が壊れる。
  // そのぶん未完了でも `read()` が1回走るが、同期で数百行なので体感しない
  // (docs/plans/onboarding.md リスク)。
  if (!onboardingCompleted) {
    return <Redirect href="/onboarding" />;
  }

  const gated = gateSentences({ sentences: snapshot.sentences, unlocked: entitlement.unlocked });

  const lessons = planTodaysLessons({
    sentences: gated.unlocked,
    completions: snapshot.completions,
    now: snapshot.now,
    moreRequest,
    unrestricted: devUnrestricted,
  });

  // 復習には1日の目標も上限も掛けない。1日の字数(ADR-0011)が区切るのは新規の投入で、
  // 復習の件数はその結果として決まる(docs/plans/srs-reviews.md)。
  //
  // **課金ゲートを掛けないのも意図的。** 一度学んだ字は購読が切れても復習に出し続ける
  // (docs/plans/paywall-gate.md 決めどころ2)。学んだ進捗を取り上げないため、
  // また購読状態を畳み込みに持ち込むと絶対規則5が壊れるため。
  const reviews = planTodaysReviews({
    kanji: snapshot.kanji,
    lessons: snapshot.completions,
    reviews: snapshot.reviews,
    now: snapshot.now,
  });

  // 樹の導線に出す「学習済みの字数」。誰を数えるかは `buildTreeIndex()` に任せる
  const trees = buildTreeIndex({
    kanji: snapshot.kanji,
    words: snapshot.words,
    lessons: snapshot.completions,
  });

  return (
    <TodayView
      lessons={lessons}
      kanji={snapshot.kanji}
      onSelect={(id) => router.push({ pathname: '/conversation/[id]', params: { id } })}
      reviewDueCount={reviews.dueCount}
      onOpenReviews={() => router.push('/review')}
      // 判定中は 'unknown' を渡す。0(= ロック無し)と同一視すると、
      // 確定までの数百ms「すべて終えた」と嘘をつく経路ができる
      lockedCount={entitlement.status === 'unknown' ? 'unknown' : gated.lockedCount}
      onUnlock={() => router.push('/paywall')}
      metKanjiCount={trees.met.length}
      totalKanjiCount={snapshot.kanji.length}
      onOpenTrees={() => router.push('/trees')}
      // 押した時刻は表示している計画と同じ「今日」(`snapshot.now`)に揃える
      onLearnMore={() => setMoreRequest(requestMoreLessons(lessons, snapshot.now))}
      devUnrestricted={__DEV__ ? devUnrestricted : undefined}
      onChangeDevUnrestricted={__DEV__ ? setDevUnrestricted : undefined}
    />
  );
}

function read() {
  return {
    sentences: listSentences(),
    kanji: listKanji(),
    words: listWords(),
    completions: listLessonEvents(),
    reviews: listReviewEvents(),
    // 「今日」も画面に入るたびに取り直す。描画中に `Date.now()` を呼ぶと
    // 再描画のたびに結果が変わる不純な関数になる(react-hooks/purity)。
    // 開きっぱなしで日をまたいでも、次に画面へ戻った時点で今日の枠に切り替わる。
    now: Date.now(),
  };
}
