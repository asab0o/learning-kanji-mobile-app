/**
 * 会話文1本の表示(要件4.1 の学習ループ 1〜2)。
 *
 * 吹き出し・アバター・英訳の寸法は、退役した `theme-preview.tsx` から数値ごと引き継いでいる。
 * 実機で合わせた値なので作り直さない(docs/plans/conversation-screen.md)。
 *
 * 第2段階の回では、読みが変わる字が光り、演出行に★が付いて押せるようになる
 * (要件定義書 4.6 ステップ1・2)。何を光らせ、どの行に★を出すかは `revealFor()` が決める。
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KanjiEntry, Line, Sentence } from '@/content/types';
import { CharacterAvatar } from '@/features/reading/character-avatar';
import { focusCharactersFor } from '@/features/reading/focus';
import { FuriganaText } from '@/features/reading/furigana';
import { revealFor } from '@/features/reading/reveal';
import { RevealCard } from '@/features/reading/reveal-card';
import { toFuriganaSegments } from '@/features/reading/segments';
import { useRevealSeen } from '@/features/reading/use-reveal-seen';
import { RomajiToggle, useRomajiEnabled } from '@/features/settings';
import { useTheme } from '@/theme';

const NO_KANJI_IDS: string[] = [];

interface ConversationViewProps {
  sentence: Sentence;
  /** 漢字マスタ。新出漢字と、第2段階で読みが変わる字をここから引く */
  kanji: KanjiEntry[];
  onBack: () => void;
  /**
   * 読み終えたあとの続き。新出字のある回は漢字フォーカス画面へ、
   * 第2段階専用の回はその場で完了になる。省略すると CTA が出ない(表示専用)。
   */
  onContinue?: () => void;
}

export function ConversationView({ sentence, kanji, onBack, onContinue }: ConversationViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const newKanji =
    sentence.newKanjiId === null ? null : (kanji.find((k) => k.id === sentence.newKanjiId) ?? null);
  const focusCharacters = focusCharactersFor(sentence, kanji);
  const reveal = revealFor(sentence, kanji);
  // フックは条件付きで呼べないので、演出が無い回でも安定した空配列を渡す
  const { canShow, markSeen } = useRevealSeen(reveal?.kanjiIds ?? NO_KANJI_IDS);
  const [cardOpen, setCardOpen] = useState(false);
  // 絶対規則11: 一度見た回では★も出さず、押しても開かない(ハイライトだけ残る)
  const revealable = reveal !== null && canShow;

  const openCard = () => {
    // 記録するのは開いた瞬間。閉じる経路は3つあるが開く経路は1つしかない
    markSeen();
    setCardOpen(true);
  };

  return (
    <View style={{ flex: 1 }}>
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
              <Text
                style={{ fontFamily: theme.type.minchoBold, fontSize: 13, color: theme.accent }}
              >
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
              badgeSegmentIndex={
                revealable && reveal.lineIndex === index ? reveal.badgeSegmentIndex : undefined
              }
              onPress={revealable && reveal.lineIndex === index ? openCard : undefined}
            />
          ))}
        </View>

        {onContinue === undefined ? null : (
          // 固定フッターにせずスレッドの末尾に置く。会話を読み終えた人だけが
          // 到達する位置にあることが「読んでから学ぶ」順序を担保する
          // (画面上部のヘッダーを固定にする話は docs/architecture.md の検討中項目)。
          <Pressable
            onPress={onContinue}
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
            {/*
              ラベルは `newKanjiId`(生のID)で分ける。引けた実体 `newKanji` で分けると、
              ID はあるのにマスタに無い字のときラベルが `Got it` になるのに、
              app 層は同じ条件をIDで見てフォーカス画面へ飛ばすので食い違う。
            */}
            <Text style={[styles.ctaLabel, { color: theme.onAccent }]}>
              {sentence.newKanjiId === null ? 'Got it' : 'Study this kanji'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {reveal !== null && cardOpen ? (
        <RevealCard reveal={reveal} onClose={() => setCardOpen(false)} />
      ) : null}
    </View>
  );
}

const RIGHT_SPEAKER = 'mia';

interface BubbleProps {
  line: Line;
  focusCharacters: string[];
  /** ★を載せるセグメント。この行に★を出さないなら undefined */
  badgeSegmentIndex?: number;
  /** 押すと演出カードが出る行だけ渡す。undefined なら押せない */
  onPress?: () => void;
}

function Bubble({ line, focusCharacters, badgeSegmentIndex, onPress }: BubbleProps) {
  const theme = useTheme();
  const romajiEnabled = useRomajiEnabled();
  // 学習者の分身であるミアを右に置く。自分の発話が右、という一般的なチャットの並び。
  const isRight = line.speaker === RIGHT_SPEAKER;
  const text = (
    <FuriganaText
      segments={toFuriganaSegments(line.segments, focusCharacters, badgeSegmentIndex)}
      // Pressable で包む行では行全体のグループ化を外す。そのままだと
      // ボタン(Pressable)とラベル(FuriganaText)が二重になり、同じ本文が2回読まれる。
      groupForAccessibility={onPress === undefined}
    />
  );

  return (
    // アバターは吹き出しの下端に揃える。英訳を同じ行に入れると
    // 「吹き出し＋英訳」の下端に揃ってしまい、アバターが英訳の高さまで下がる。
    <View style={isRight ? styles.turnRight : styles.turnLeft}>
      <View style={[styles.bubbleRow, isRight && styles.bubbleRowRight]}>
        <CharacterAvatar character={line.speaker} size={AVATAR_SIZE} />
        {/*
          タップ対象は吹き出し全体。ふりがな付きセグメントは幅が10〜20pt しかなく、
          単独では iOS の 44pt タップ領域を満たせない(要件は「ハイライトをタップ」だが、
          ハイライトを押せばカードは出るので満たしている)。
        */}
        <Pressable
          disabled={onPress === undefined}
          onPress={onPress}
          accessibilityRole={onPress === undefined ? undefined : 'button'}
          accessibilityLabel={onPress === undefined ? undefined : line.japanese}
          accessibilityLanguage="ja-JP"
          accessibilityHint={
            onPress === undefined ? undefined : 'Shows why this kanji is read differently'
          }
          style={({ pressed }) => [
            styles.bubble,
            theme.shadow.bubble,
            {
              backgroundColor: isRight ? theme.surfaceAlt : theme.surface,
              borderColor: theme.border,
              borderRadius: theme.radius.bubble,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {text}
        </Pressable>
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
  cta: {
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 8,
  },
  ctaLabel: {
    fontSize: 15,
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
