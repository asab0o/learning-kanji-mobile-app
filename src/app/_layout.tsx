import { Text, View } from 'react-native';
import {
  DefaultTheme as NavigationDefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useDatabase } from '@/db';
import { EntitlementProvider } from '@/features/paywall';
import { SettingsProvider } from '@/features/settings';
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
  const database = useDatabase();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/*
        app.json が userInterfaceStyle: "automatic" なので、端末をダークモードにすると
        システムはステータスバーを明色で描く。テーマの地は明色なので、明示しないと
        時刻やバッテリーが読めなくなる。地の明暗はテーマが知っているのでそれに従う。
      */}
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ThemeBackdrop />
      {/*
        マイグレーションとシードが終わるまで画面を出さない。
        用意できていないテーブルにクエリを投げると落ちるため。
        待っている間はテーマの地と背景装飾だけが見える(スプラッシュからの繋ぎになる)。
      */}
      {database.status === 'error' ? (
        <DatabaseError message={database.error?.message ?? 'Unknown error'} />
      ) : database.status === 'ready' ? (
        <NavigationThemeProvider value={TRANSPARENT_NAVIGATION_THEME}>
          {/*
            SettingsProvider は ready の内側に置く。getUserSettings() は行が無ければ
            INSERT するので、マイグレーション前に呼ぶと落ちる。
          */}
          <SettingsProvider>
            {/*
              購読状態は DB を必要としないので ready の外でも動くが、Provider の並びを
              1箇所にまとめたいのでここに置く。configurePurchases() は
              EntitlementProvider の中で呼ばれる(effect の実行順のため)。
            */}
            <EntitlementProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              />
            </EntitlementProvider>
          </SettingsProvider>
        </NavigationThemeProvider>
      ) : null}
    </View>
  );
}

/**
 * DB を用意できなかったときの最終手段の表示。
 *
 * 何も出さないと白い画面のまま固まって原因が分からなくなるので、
 * 少なくとも「DB で失敗した」ことは出す。
 *
 * **例外の本文を本番で画面に出さない。** DB 層が投げる例外の文言は日本語なので
 * (`@/db/mappers` の RowError など)、そのまま出すと絶対規則7(UI文言は英語)を破る。
 * 原因は常に console に落とし、画面に出すのは開発ビルドのときだけにする。
 */
function DatabaseError({ message }: { message: string }) {
  const theme = useTheme();

  console.error('[db] could not prepare the database:', message);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
      <Text style={{ color: theme.text, fontSize: 17, textAlign: 'center' }}>
        Could not prepare the app’s data. Please reinstall the app.
      </Text>
      {__DEV__ ? (
        <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>{message}</Text>
      ) : null}
    </View>
  );
}
