import { useCallback } from 'react';
import { useRouter } from 'expo-router';

import { OnboardingView } from '@/features/onboarding';
import { useCompleteOnboarding } from '@/features/settings';

/**
 * 初回オンボーディングの画面(要件定義書 5.1-10)。ルーティングとフラグの保存だけを持つ。
 *
 * **`replace` で入口画面に移る。** `push` だと iOS のスワイプバックで戻れてしまい、
 * 「一度抜けたら二度と出さない」が画面の上では嘘になる。
 *
 * Skip も Start learning も同じ `done` を通る。**途中で抜けても完了として扱う**のは、
 * 3画面を強制しないと決めたため(docs/plans/onboarding.md)。見なかった人に
 * 翌起動でまた出すのは、スキップ導線を用意した意味を消す。
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const completeOnboarding = useCompleteOnboarding();

  const done = useCallback(() => {
    completeOnboarding();
    router.replace('/');
  }, [completeOnboarding, router]);

  return <OnboardingView onDone={done} />;
}
