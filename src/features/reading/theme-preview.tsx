import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CharacterId } from '@/content/types';
import { CharacterAvatar } from '@/features/reading/character-avatar';
import { FuriganaText, type FuriganaSegment } from '@/features/reading/furigana';
import { useTheme } from '@/theme/theme-context';

/**
 * テーマの見た目を確認するための暫定画面。
 *
 * デザイン案のモックと同じ要素(ヘッダー・吹き出し・フォーカスカード・CTA)を並べ、
 * トークンが実機でどう見えるかを目視で突き合わせるために置いている。
 *
 * **削除トリガー: 本物の会話画面(reading)の実装。** そのときこのファイルごと捨てる。
 *
 * 会話文は docs/会話文集.md の32番(歩)から**原稿どおり**引いている。
 * 台詞を勝手に作らないこと。ここの文字列は src/content/ の外にあるため
 * `pnpm run validate:content` の検査対象外で、創作を混ぜても機械検証に引っかからない。
 */
export function ThemePreview() {
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
        <Text
          style={{
            fontFamily: theme.type.mincho,
            fontSize: 13,
            letterSpacing: 0.78,
            color: theme.text,
            opacity: 0.78,
          }}
        >
          Conversation 32 · On the road
        </Text>
        <Text
          style={{
            fontFamily: theme.type.minchoBold,
            fontSize: 13,
            color: theme.accent,
          }}
        >
          歩
        </Text>
      </View>

      <View style={styles.thread}>
        <Bubble
          speaker="mia"
          side="right"
          segments={[
            { text: 'たくさん' },
            { text: '歩', reading: 'ある', focus: true },
            { text: 'きましたね。' },
          ]}
          translation="We've walked a lot."
        />
        <Bubble
          speaker="grandma"
          side="left"
          segments={[
            { text: '毎日', reading: 'まいにち' },
            { text: '歩', reading: 'ある', focus: true },
            { text: 'くのが、' },
            { text: '元気', reading: 'げんき' },
            { text: 'のもとだよ。' },
          ]}
          translation="Walking every day is the source of good health."
        />
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surfaceVeil,
            borderColor: theme.border,
            borderRadius: theme.radius.card,
          },
        ]}
      >
        <View style={styles.cardHead}>
          <View
            style={[
              styles.illustSlot,
              { borderColor: theme.border, borderRadius: theme.radius.card },
            ]}
          >
            <Text style={[styles.illustLabel, { color: theme.textMuted }]}>walk{'\n'}illust.</Text>
          </View>
          <View>
            <Text
              style={{
                fontFamily: theme.type.minchoBold,
                fontSize: 30,
                lineHeight: 34,
                color: theme.accent,
              }}
            >
              歩
            </Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>to walk ／ ホ・ブ・あるく</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.words}>
          <Word word="歩く" reading="あるく" />
          <Word word="散歩" reading="さんぽ" />
        </View>
      </View>

      <View
        style={[styles.cta, { backgroundColor: theme.accent, borderRadius: theme.radius.pill }]}
      >
        <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>
          Practice writing this kanji
        </Text>
      </View>
    </ScrollView>
  );
}

type BubbleProps = {
  speaker: CharacterId;
  side: 'left' | 'right';
  segments: FuriganaSegment[];
  translation: string;
};

function Bubble({ speaker, side, segments, translation }: BubbleProps) {
  const theme = useTheme();
  const isRight = side === 'right';

  return (
    // アバターは吹き出しの下端に揃える。英訳を同じ行に入れると
    // 「吹き出し＋英訳」の下端に揃ってしまい、アバターが英訳の高さまで下がる。
    <View style={isRight ? styles.turnRight : styles.turnLeft}>
      <View style={[styles.bubbleRow, isRight && styles.bubbleRowRight]}>
        <CharacterAvatar character={speaker} size={AVATAR_SIZE} />
        <View
          style={[
            styles.bubble,
            theme.shadow.bubble,
            {
              backgroundColor: isRight ? theme.surfaceAlt : theme.surface,
              borderColor: theme.border,
              borderRadius: theme.radius.bubble,
            },
          ]}
        >
          <FuriganaText segments={segments} />
        </View>
      </View>
      <Text
        style={[
          styles.translation,
          { color: theme.textMuted },
          // 英訳は吹き出しの真下に置きたいので、アバターのぶんだけ内側に寄せる。
          isRight ? styles.translationRight : styles.translationLeft,
        ]}
      >
        {translation}
      </Text>
    </View>
  );
}

function Word({ word, reading }: { word: string; reading: string }) {
  const theme = useTheme();

  return (
    <View style={styles.word}>
      <Text
        style={{
          fontFamily: theme.type.minchoBold,
          fontSize: 14,
          color: theme.text,
        }}
      >
        {word}
      </Text>
      <Text style={[styles.meta, { color: theme.textMuted }]}>{reading}</Text>
    </View>
  );
}

const AVATAR_SIZE = 30;
const AVATAR_GAP = 10;

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
  thread: {
    gap: 16,
  },
  turnLeft: {
    alignItems: 'flex-start',
  },
  turnRight: {
    alignItems: 'flex-end',
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: AVATAR_GAP,
  },
  bubbleRowRight: {
    flexDirection: 'row-reverse',
  },
  bubble: {
    maxWidth: 236,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  translation: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 236,
  },
  translationLeft: {
    marginLeft: AVATAR_SIZE + AVATAR_GAP + 2,
  },
  translationRight: {
    marginRight: AVATAR_SIZE + AVATAR_GAP + 2,
    textAlign: 'right',
  },
  card: {
    padding: 15,
    borderWidth: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  illustSlot: {
    width: 58,
    height: 58,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustLabel: {
    fontSize: 8.5,
    lineHeight: 12,
    textAlign: 'center',
  },
  meta: {
    fontSize: 11,
  },
  divider: {
    height: 1,
    marginTop: 13,
    marginBottom: 11,
  },
  words: {
    flexDirection: 'row',
    gap: 18,
  },
  word: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  cta: {
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.56,
  },
});
