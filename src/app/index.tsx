import { StyleSheet, Text, View } from 'react-native';

/**
 * 仮の入口画面。実際の学習フローは docs/plans/ の承認済みプランに沿って実装する。
 *
 * ここに色を直接書かないこと(CLAUDE.md 絶対規則 1)。
 * 配色は src/theme/ のトークンを作ってから theme.* 経由で参照する。
 */
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Kanji app</Text>
      <Text>Setup complete. Screens come next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
});
