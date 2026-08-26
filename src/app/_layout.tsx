import { useEffect } from 'react';
import { View } from 'react-native';
import {
  DefaultTheme as NavigationDefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configurePurchases } from '@/features/paywall';
import { ThemeBackdrop, ThemeProvider, useTheme } from '@/theme';

/**
 * ナビゲーションが画面の下に敷く地を無効化する。
 *
 * expo-router の既定テーマは背景に `rgb(242, 242, 242)` を持っており、
 * これが `contentStyle` より下の層で不透明に塗られるため、
 * 何もしないとテーマの地(`theme.background`)も背景装飾も完全に隠れる。
 * ここを透明にして、下の ThemedShell が描いたものを見せる。
 */
const TRANSPARENT_NAVIGATION_THEME = {
  ...NavigationDefaultTheme,
  colors: { ...NavigationDefaultTheme.colors, background: 'transparent' },
};

/**
 * ルートレイアウト。
 *
 * 画面構成は承認済みプラン(docs/plans/)に沿って足していく。
 */
export default function RootLayout() {
  useEffect(() => {
    configurePurchases();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * テーマの地と背景装飾を敷き、その上に画面を重ねる殻。
 *
 * 背景装飾は要件5.3 の通り全画面で1枚を使い回すので、ここで1度だけ描く。
 * 各画面の背景を透明にしているのは、そうしないと装飾が隠れるため。
 *
 * useTheme() は ThemeProvider の内側でしか呼べないので、RootLayout とは
 * 別コンポーネントに分けている。
 */
function ThemedShell() {
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/*
        app.json が userInterfaceStyle: "automatic" なので、端末をダークモードにすると
        システムはステータスバーを明色で描く。テーマの地は明色なので、明示しないと
        時刻やバッテリーが読めなくなる。地の明暗はテーマが知っているのでそれに従う。
      */}
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ThemeBackdrop />
      <NavigationThemeProvider value={TRANSPARENT_NAVIGATION_THEME}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </NavigationThemeProvider>
    </View>
  );
}
