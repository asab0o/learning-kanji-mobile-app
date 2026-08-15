import { Stack } from 'expo-router';

/**
 * ルートレイアウト。
 *
 * 画面構成は承認済みプラン(docs/plans/)に沿って足していく。
 * テーマの Provider は src/theme/ を作るときにここへ差し込む。
 */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
