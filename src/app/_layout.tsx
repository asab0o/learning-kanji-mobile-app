import { useEffect } from 'react';
import { Stack } from 'expo-router';

import { configurePurchases } from '@/features/paywall';

/**
 * ルートレイアウト。
 *
 * 画面構成は承認済みプラン(docs/plans/)に沿って足していく。
 * テーマの Provider は src/theme/ を作るときにここへ差し込む。
 */
export default function RootLayout() {
  useEffect(() => {
    configurePurchases();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
