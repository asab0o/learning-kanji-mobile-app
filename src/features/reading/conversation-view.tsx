/**
 * 会話文1本の表示(要件4.1 の学習ループ 1〜2)。
 *
 * 吹き出し・アバター・英訳の寸法は、退役した `theme-preview.tsx` から数値ごと引き継いでいる。
 * 実機で合わせた値なので作り直さない(docs/plans/conversation-screen.md)。
 *
 * ハイライトは新出漢字のみ。第2段階の演出カードと★バッジはここに無い
 * (バッジは「押すとカードが出る」合図なので、カードを作る回に同時に入れる)。
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KanjiEntry, Line, Sentence } from '@/content/types';
import { CharacterAvatar } from '@/features/reading/character-avatar';
import { focusCharactersFor } from '@/features/reading/focus';
import { FuriganaText } from '@/features/reading/furigana';
import { toFuriganaSegments } from '@/features/reading/segments';
import { RomajiToggle, useRomajiEnabled } from '@/features/settings';
import { useTheme } from '@/theme';

interface ConversationViewProps {
  sentence: Sentence;
  /** 新出漢字。`newKanjiId` が null の回、または見つからない場合は null */
  newKanji: KanjiEntry | null;
  onBack: () => void;
}

export function ConversationView({ sentence, newKanji, onBack }: ConversationViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const focusCharacters = focusCharactersFor(sentence, newKanji === null ? [] : [newKanji]);

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
        <RomajiToggle />
      </View>

      <View style={styles.title}>
        <Text
          style={{
            fontFamily: theme.type.mincho,
            fontSize: 13,
            letterSpacing: 0.78,
            color: theme.text,
            opacity: 0.78,
          }}
        >
          {`Conversation ${sentence.order}`}
        </Text>
        {newKanji === null ? null : (
          <View style={styles.newKanji}>
            <Text style={{ fontFamily: theme.type.minchoBold, fontSize: 13, color: theme.accent }}>
              {newKanji.character}
            </Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>{newKanji.meaning}</Text>
          </View>
        )}
      </View>

      <View style={styles.thread}>
        {sentence.lines.map((line, index) => (
          <Bubble
            // 同じ話者が同じ文言を繰り返す回がある(#5 の空の「ごはん。」が2回)ので、
            // 本文を key にすると重複する。行の順序そのものが同一性になる。
            key={`${sentence.id}-${index}`}
            line={line}
            focusCharacters={focusCharacters}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const RIGHT_SPEAKER = 'mia';

function Bubble({ line, focusCharacters }: { line: Line; focusCharacters: string[] }) {
  const theme = useTheme();
  const romajiEnabled = useRomajiEnabled();
  // 学習者の分身であるミアを右に置く。自分の発話が右、という一般的なチャットの並び。
  const isRight = line.speaker === RIGHT_SPEAKER;

  return (
    // アバターは吹き出しの下端に揃える。英訳を同じ行に入れると
    // 「吹き出し＋英訳」の下端に揃ってしまい、アバターが英訳の高さまで下がる。
    <View style={isRight ? styles.turnRight : styles.turnLeft}>
      <View style={[styles.bubbleRow, isRight && styles.bubbleRowRight]}>
        <CharacterAvatar character={line.speaker} size={AVATAR_SIZE} />
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
          <FuriganaText segments={toFuriganaSegments(line.segments, focusCharacters)} />
        </View>
      </View>

      <View
        style={[
          styles.gloss,
          // 英訳とローマ字は吹き出しの真下に置きたいので、アバターのぶんだけ内側に寄せる。
          isRight ? styles.glossRight : styles.glossLeft,
        ]}
      >
        {romajiEnabled ? (
          // 明朝(theme.type.mincho)を指定しない。日本語本文用の書体なので、
          // ラテン文字とマクロン(ō / ā / ē)はシステム既定に任せるほうが素直に出る。
          <Text
            style={[styles.romaji, { color: theme.textMuted }, isRight ? styles.alignRight : null]}
          >
            {line.romaji}
          </Text>
        ) : null}
        <Text
          style={[
            styles.translation,
            { color: theme.textMuted },
            isRight ? styles.alignRight : null,
          ]}
        >
          {line.english}
        </Text>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 30;
const AVATAR_GAP = 10;
const BUBBLE_MAX_WIDTH = 236;

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
  title: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  newKanji: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  meta: {
    fontSize: 11,
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
    maxWidth: BUBBLE_MAX_WIDTH,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
  },
  gloss: {
    marginTop: 6,
    maxWidth: BUBBLE_MAX_WIDTH,
    gap: 2,
  },
  glossLeft: {
    marginLeft: AVATAR_SIZE + AVATAR_GAP + 2,
  },
  glossRight: {
    marginRight: AVATAR_SIZE + AVATAR_GAP + 2,
  },
  alignRight: {
    textAlign: 'right',
  },
  romaji: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  translation: {
    fontSize: 11.5,
    lineHeight: 17,
  },
});
