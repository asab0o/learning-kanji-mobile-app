/**
 * 漢字フォーカス画面(要件定義書 5.1-3 / 学習ループ 3)。
 *
 * 会話文で出会った直後に、その字だけを大きく見せる。出すのは
 * **字 / 絵 / 意味 / 読み** の4つだけ。語の一覧(葉とつぼみ)は漢字の樹の担当で、
 * ここに並べると同じものが2画面に出る。
 *
 * 訓を緑・音を青にするのは要件4.5 の色分けと同じ規則。樹で初めて色を見るのではなく、
 * ここで先に「この字には2系統ある」を見せておくと、樹と4.6 の演出が地続きになる。
 *
 * ナビゲーションを知らない表示専用コンポーネント。学習の導線として開いたときだけ
 * `onComplete` が渡り、CTA が出る(樹から「見るだけ」で開く経路を後から足せる形)。
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KanjiEntry, Reading } from '@/content/types';
import { KanjiIllustration } from '@/features/reading/kanji-illustration';
import { useRomajiEnabled } from '@/features/settings';
import { useTheme } from '@/theme';

const ILLUSTRATION_SIZE = 148;

interface KanjiFocusProps {
  kanji: KanjiEntry;
  onBack: () => void;
  /** 学習の導線として開いたときだけ渡す。押すとこの回を学び終えたことになる */
  onComplete?: () => void;
}

export function KanjiFocus({ kanji, onBack, onComplete }: KanjiFocusProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <View style={styles.header}>
        {/* 文字だけだと当たり判定が細いので Pressable で包んで hitSlop を足す */}
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12}>
          {({ pressed }) => (
            <Text style={[styles.backLabel, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
              Back
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.hero}>
        <KanjiIllustration illustrationKey={kanji.illustrationKey} size={ILLUSTRATION_SIZE} />
        <Text
          style={{
            fontFamily: theme.type.minchoBold,
            fontSize: 72,
            lineHeight: 88,
            color: theme.text,
          }}
          accessibilityLanguage="ja-JP"
        >
          {kanji.character}
        </Text>
        <Text style={[styles.meaning, { color: theme.text }]}>{kanji.meaning}</Text>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.readings}>
        {kanji.readings.map((reading) => (
          <ReadingRow key={`${reading.type}-${reading.kana}`} reading={reading} />
        ))}
      </View>

      {onComplete === undefined ? null : (
        <Pressable
          onPress={onComplete}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: theme.accent,
              borderRadius: theme.radius.pill,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>Got it</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

/**
 * 読み1つ。ラベルが `Kun` / `On` なのは絶対規則7(UI文言は英語)。
 * 要件4.6 の絵は `[訓読み]` `[音読み]` だが、規則7 を優先している(`reveal-card.tsx` と同じ)。
 */
function ReadingRow({ reading }: { reading: Reading }) {
  const theme = useTheme();
  const romajiEnabled = useRomajiEnabled();
  const branch = reading.type === 'kun' ? theme.kunBranch : theme.onBranch;

  return (
    <View style={styles.readingRow}>
      <View style={[styles.badge, { backgroundColor: branch, borderRadius: theme.radius.pill }]}>
        <Text style={[styles.badgeLabel, { color: theme.onAccent }]}>
          {reading.type === 'kun' ? 'Kun' : 'On'}
        </Text>
      </View>

      <View style={styles.readingText}>
        <Text
          style={{ fontFamily: theme.type.mincho, fontSize: 21, color: theme.text }}
          accessibilityLanguage="ja-JP"
        >
          {reading.kana}
        </Text>
        {romajiEnabled ? (
          // 明朝を指定しない。ラテン文字とマクロンはシステム既定のほうが素直に出る
          // (`conversation-view.tsx` と同じ判断)。
          <Text style={[styles.romaji, { color: theme.textMuted }]}>{reading.romaji}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backLabel: {
    fontSize: 14,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  meaning: {
    fontSize: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  readings: {
    gap: 14,
  },
  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  badgeLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  readingText: {
    flexShrink: 1,
    gap: 1,
  },
  romaji: {
    fontSize: 12,
  },
  cta: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 8,
  },
  ctaLabel: {
    fontSize: 15,
  },
});
