import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

/**
 * 画面の小見出し(`Today` / `Kanji tree` / `Conversation 3` など)。
 *
 * 以前は同じスタイルを5画面にコピーしていた。1か所にまとめたのは、
 * **行の高さを指定し忘れると欧文のディセンダが切れる**のを再発させないため。
 * ヒラギノ明朝は日本語向けの字面なので、`lineHeight` が無いと行の箱が
 * g / j / p / y の下の分だけ足りない(2026-09-23、`Today` の y が切れていた)。
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <Text style={[styles.label, { fontFamily: theme.type.mincho, color: theme.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.78,
    // 本文より一段引かせる。textMuted ほど弱くはしない(見出しなので)
    opacity: 0.78,
  },
});
