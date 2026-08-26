import type { Theme, ThemeId } from '@/theme/tokens';
import { sakura } from '@/theme/themes/sakura';

/**
 * 利用可能なテーマ。
 *
 * Record<ThemeId, Theme> なので、ThemeId を増やすとここが型エラーになる。
 * 「テーマを足したのに定義を書き忘れる」を型で防ぐための形。
 */
export const themes: Record<ThemeId, Theme> = {
  sakura,
};

export const DEFAULT_THEME_ID: ThemeId = 'sakura';
