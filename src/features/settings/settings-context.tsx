/**
 * ユーザー設定の配布層。
 *
 * 真実は SQLite の `user_settings` にあり、ここは読んだ値を配るだけ
 * (docs/architecture.md「設定(ローマ字ON/OFF等): SQLite + Context」)。
 * Context にしているのは、トグルがヘッダーにあるのに値を読むのは発話ごと(吹き出しの下)で、
 * ローカル state だと2階層のプロップ配りになるため。
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { getUserSettings, updateUserSettings } from '@/db';

interface SettingsValue {
  romajiEnabled: boolean;
  setRomajiEnabled: (enabled: boolean) => void;
  onboardingCompleted: boolean;
  completeOnboarding: () => void;
}

const SettingsContext = createContext<SettingsValue | undefined>(undefined);

/**
 * **`database.status === 'ready'` の内側に置くこと。**
 * `getUserSettings()` は行が無ければ INSERT するので、マイグレーション前に呼ぶと落ちる。
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  // 遅延初期化で1回だけ読む。描画の中で直接クエリを呼ぶと React Compiler
  // (app.json の reactCompiler: true)にメモ化され、更新しても表示が古いままになる。
  const [settings, setSettings] = useState(() => getUserSettings());

  const setRomajiEnabled = useCallback((enabled: boolean) => {
    setSettings(updateUserSettings({ romajiEnabled: enabled }));
  }, []);

  /**
   * オンボーディングを抜けた(要件定義書 5.1-10)。
   *
   * **戻す手段は用意しない。** 一度抜けたら二度と出さないので、
   * 真偽値ではなく「完了した」という一方向の操作として配る。
   */
  const completeOnboarding = useCallback(() => {
    setSettings(updateUserSettings({ onboardingCompleted: true }));
  }, []);

  const value = useMemo(
    () => ({
      romajiEnabled: settings.romajiEnabled,
      setRomajiEnabled,
      onboardingCompleted: settings.onboardingCompleted,
      completeOnboarding,
    }),
    [settings, setRomajiEnabled, completeOnboarding]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);

  if (value === undefined) {
    throw new Error('useSettings must be used inside <SettingsProvider>.');
  }

  return value;
}

/** ローマ字を本文に添えるか(要件5.2。既定は OFF)。 */
export function useRomajiEnabled(): boolean {
  return useSettings().romajiEnabled;
}

export function useSetRomajiEnabled(): (enabled: boolean) => void {
  return useSettings().setRomajiEnabled;
}

/** 初回オンボーディングを抜けたか(要件定義書 5.1-10)。false なら入口画面より先に割り込む。 */
export function useOnboardingCompleted(): boolean {
  return useSettings().onboardingCompleted;
}

export function useCompleteOnboarding(): () => void {
  return useSettings().completeOnboarding;
}
