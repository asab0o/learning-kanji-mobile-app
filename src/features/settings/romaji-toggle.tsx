import { StyleSheet, Switch, Text, View } from 'react-native';

import { useRomajiEnabled, useSetRomajiEnabled } from '@/features/settings/settings-context';
import { useTheme } from '@/theme';

/**
 * ローマ字の表示切り替え(要件5.2)。
 *
 * 設定画面ではなく会話文画面のヘッダーに置いている。既定が OFF なので、
 * 切り替える手段がないとローマ字の描画を実機で一度も確認できないため
 * (docs/plans/conversation-screen.md「ローマ字のON/OFF」)。
 * 設定画面は購入の復元と同居させるほうが自然なので、paywall の回に作る。
 */
export function RomajiToggle() {
  const theme = useTheme();
  const enabled = useRomajiEnabled();
  const setEnabled = useSetRomajiEnabled();

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.textMuted }]}>Romaji</Text>
      <Switch
        value={enabled}
        onValueChange={setEnabled}
        trackColor={{ true: theme.accent, false: theme.border }}
        thumbColor={theme.surface}
        // iOS は OFF のときトラックの地を自前で塗るので、trackColor.false だけでは
        // システム既定の薄灰色が残る。テーマの地に合わせる(絶対規則1)。
        ios_backgroundColor={theme.border}
        accessibilityLabel="Show romaji"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 11.5,
  },
});
