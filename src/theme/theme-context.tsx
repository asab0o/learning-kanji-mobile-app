import { createContext, useContext, type ReactNode } from 'react';

import type { Theme, ThemeId } from '@/theme/tokens';
import { DEFAULT_THEME_ID, themes } from '@/theme/themes';

const ThemeContext = createContext<Theme | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
  /**
   * 表示するテーマ。
   *
   * Provider 自身は選択状態を持たない。テーマの選択は user_settings(SQLite)が持ち、
   * それを読んだ側がここに渡す。Provider をトークンの配布だけに絞るための形。
   */
  themeId?: ThemeId;
};

export function ThemeProvider({ children, themeId = DEFAULT_THEME_ID }: ThemeProviderProps) {
  // themes[themeId] は毎回同じオブジェクト参照を返すのでメモ化は不要。
  return <ThemeContext.Provider value={themes[themeId]}>{children}</ThemeContext.Provider>;
}

/**
 * テーマトークンを取り出す。
 *
 * 色は必ずこれ経由で取る。コンポーネントに色を直接書かない(CLAUDE.md 絶対規則1)。
 */
export function useTheme(): Theme {
  const theme = useContext(ThemeContext);

  if (theme === undefined) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }

  return theme;
}
