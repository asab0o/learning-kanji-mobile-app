/**
 * 入口画面「今日の学習」(要件定義書 4.1 / 5.1-8)。
 *
 * 出すのは**今日ぶんだけ**。全58文を並べると「1日3字」の意味が伝わらず、
 * 先を読み進める遊びになってしまう(ADR-0003 が防ごうとしているのがそれ)。
 *
 * 何を出すかは `planTodaysLessons()` が決める。ここは描くだけで、
 * ルーティングも DB も知らない。
 */

import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { KanjiEntry } from '@/content/types';
import type { TodaysLessonItem, TodaysLessons } from '@/features/srs/lessons';
import { useTheme } from '@/theme';

interface TodayViewProps {
  lessons: TodaysLessons;
  /** 新出漢字を引くためのマスタ */
  kanji: KanjiEntry[];
  onSelect: (sentenceId: string) => void;
  /** 今日出す復習の件数。0 なら押せない一言だけ出す */
  reviewDueCount?: number;
  onOpenReviews?: () => void;
  /**
   * 課金でロックされている会話文の本数、または判定中を表す `'unknown'`。
   *
   * **判定中を 0 で表さない。** 0 は「ロックが無い(= 購読中)」という確定した事実で、
   * 判定中とは別物。同一視すると、購読状態が確定するまでの数百ms、
   * 未購読者に「すべて終えた」と嘘をつくことになる(ちょうど転換させたい相手に)。
   */
  lockedCount?: number | 'unknown';
  onUnlock?: () => void;
  /** 開発ビルドの上限解除。`__DEV__` のときだけ渡す */
  ignoreLimit?: boolean;
  onChangeIgnoreLimit?: (value: boolean) => void;
}

export function TodayView({
  lessons,
  kanji,
  onSelect,
  reviewDueCount = 0,
  onOpenReviews,
  lockedCount = 0,
  onUnlock,
  ignoreLimit,
  onChangeIgnoreLimit,
}: TodayViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const kanjiById = new Map(kanji.map((entry) => [entry.id, entry]));
  const pending = lessons.items.filter((item) => !item.done);
  const entitlementUnknown = lockedCount === 'unknown';
  // ロックされた回が実在するか。**「全部終えた」と言えるか**はこれで決まる
  const hasLocked = !entitlementUnknown && lockedCount > 0;
  // 導線を出せるかは別問題。押す先が無ければ出しても仕方がない
  const showUnlock = hasLocked && onUnlock !== undefined;
  // 無料ぶんを学び切ったかどうかで導線の強さを変える。
  // 学び切っていれば、そこが行き止まりなのでカードで受け止める。
  const freeExhausted = lessons.allDone;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 },
      ]}
    >
      {/*
        復習を先、新規を後に置く。溜まった復習を片付けてから新しい字に進むほうが、
        「昨日やったことが返ってくる」順序として自然(要件定義書 4.1 の学習ループ)。
      */}
      <Reviews dueCount={reviewDueCount} onOpen={onOpenReviews} />

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
          Today
        </Text>
        {/*
          上限を外している間は「n of 3」が嘘になるので出さない。
          Infinity を数字として描かないための分岐でもある。
        */}
        {Number.isFinite(lessons.remaining) ? (
          <Text style={[styles.progress, { color: theme.textMuted }]}>
            {`${lessons.learnedToday} of ${lessons.learnedToday + lessons.remaining} kanji today`}
          </Text>
        ) : null}
      </View>

      {lessons.items.length === 0 ? null : (
        <View style={styles.rows}>
          {lessons.items.map((item) => (
            <Row
              key={item.sentence.id}
              item={item}
              newKanji={
                item.sentence.newKanjiId === null
                  ? null
                  : (kanjiById.get(item.sentence.newKanjiId) ?? null)
              }
              onPress={() => onSelect(item.sentence.id)}
            />
          ))}
        </View>
      )}

      {/*
        未完了が無いときに出す一言。今日ぶんを終えた直後はカードが残ったままなので、
        「カードが消える」ことではなく**この一文**が終わりの合図になる。
        カードを消さないのは、今日やったことが見えているほうが続くため。
      */}
      {pending.length === 0 ? (
        <Notice
          lessons={lessons}
          hasKanji={kanji.length > 0}
          /*
            ロック中に「全部終えた」と言うのは嘘になる(続きは有料で存在する)。
            代わりに下の Unlock カードが終わりの合図になる。

            **判定中も同じく黙る。** ロックの有無がまだ分からない以上、
            「全部終えた」と言い切れない。数百ms空白になるほうが嘘より安全。

            判定に使うのは `showUnlock` ではなく `hasLocked`。導線を出せるかどうかと、
            「全部終えた」と言えるかどうかは別。`onUnlock` が渡らない呼び出し側でも
            嘘はつかない。
          */
          suppressAllDone={entitlementUnknown || (hasLocked && freeExhausted)}
        />
      ) : null}

      {showUnlock ? (
        <Unlock lockedCount={lockedCount} exhausted={freeExhausted} onPress={onUnlock} />
      ) : null}

      {onChangeIgnoreLimit === undefined ? null : (
        <View style={styles.debugRow}>
          <Text style={[styles.debugLabel, { color: theme.textMuted }]}>Ignore daily limit</Text>
          <Switch
            value={ignoreLimit ?? false}
            onValueChange={onChangeIgnoreLimit}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.surface}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Ignore daily limit"
          />
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  item,
  newKanji,
  onPress,
}: {
  item: TodaysLessonItem;
  newKanji: KanjiEntry | null;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: item.done }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.border,
          borderRadius: theme.radius.card,
          // 終えた回は沈める。消さないのは、今日やったことが見えているほうが続くため
          opacity: pressed ? 0.6 : item.done ? 0.55 : 1,
        },
      ]}
    >
      {/*
        分岐は `newKanjiId`(生のID)で行う。引けた実体で分けると、ID はあるのに
        マスタから引けなかった回が「第2段階の回」と同じ見た目になり、実機で気づけない。
        引けないこと自体は `validate:content` が防いでいるので、下の fallback は出ない。
      */}
      {item.sentence.newKanjiId === null ? (
        // 第2段階専用の回。新出字が無いので語のほうを見出しにする
        <>
          <Text style={[styles.stageTwo, { color: theme.accent }]} accessibilityLanguage="ja-JP">
            {item.sentence.reencounters[0]?.word ?? '—'}
          </Text>
          <Text style={[styles.meaning, { color: theme.textMuted }]}>A reading changes</Text>
        </>
      ) : (
        <>
          <Text
            style={{ fontFamily: theme.type.minchoBold, fontSize: 24, color: theme.accent }}
            accessibilityLanguage="ja-JP"
          >
            {newKanji?.character ?? '?'}
          </Text>
          <Text style={[styles.meaning, { color: theme.text }]}>
            {newKanji?.meaning ?? 'Missing kanji data'}
          </Text>
        </>
      )}

      <Text style={[styles.state, { color: theme.textMuted }]}>{item.done ? 'Done' : ''}</Text>
    </Pressable>
  );
}

function Reviews({ dueCount, onOpen }: { dueCount: number; onOpen?: () => void }) {
  const theme = useTheme();

  if (dueCount === 0) {
    return <Text style={[styles.notice, { color: theme.textMuted }]}>No reviews due.</Text>;
  }

  // 件数はあるのに開く手段が渡っていない場合。件数まで隠すと嘘になるので出すだけ出す
  if (onOpen === undefined) {
    return (
      <Text style={[styles.notice, { color: theme.textMuted }]}>{`Reviews: ${dueCount} due`}</Text>
    );
  }

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.accent,
          borderRadius: theme.radius.card,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.reviewsLabel, { color: theme.text }]}>Reviews</Text>
      <Text style={[styles.state, { color: theme.accent }]}>{`${dueCount} due`}</Text>
    </Pressable>
  );
}

function Notice({
  lessons,
  hasKanji,
  suppressAllDone,
}: {
  lessons: TodaysLessons;
  hasKanji: boolean;
  suppressAllDone: boolean;
}) {
  const theme = useTheme();

  // シード前(コンテンツが1件も無い)を「全部終えた」と言わない
  const message = !hasKanji
    ? 'No conversations yet.'
    : lessons.allDone
      ? suppressAllDone
        ? null
        : "You've finished every conversation for now."
      : "You're done for today. Come back tomorrow.";

  if (message === null) {
    return null;
  }

  return <Text style={[styles.notice, { color: theme.textMuted }]}>{message}</Text>;
}

/**
 * 有料の章への導線(要件定義書 7章)。
 *
 * 無料ぶんを学び切ったらカードで受け止め、そうでなければ末尾の1行に留める。
 * **学び切る前でも必ず出す**のは、再インストールした購読者が Restore に
 * 辿り着けるようにするため(docs/plans/paywall-gate.md 決めどころ4)。
 */
function Unlock({
  lockedCount,
  exhausted,
  onPress,
}: {
  lockedCount: number;
  exhausted: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  if (!exhausted) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
        <Text style={[styles.unlockLink, { color: theme.accent }]}>Unlock all chapters</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.unlockCard,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.accent,
          borderRadius: theme.radius.card,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={{ fontFamily: theme.type.minchoBold, fontSize: 17, color: theme.text }}>
        Unlock the next 3 chapters
      </Text>
      <Text style={[styles.unlockBody, { color: theme.textMuted }]}>
        {`${lockedCount} more conversations are waiting. See a kanji you know change its reading.`}
      </Text>
      <Text style={[styles.unlockCta, { color: theme.accent }]}>See the subscription</Text>
    </Pressable>
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
    alignItems: 'baseline',
  },
  progress: {
    fontSize: 12,
  },
  rows: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
  },
  stageTwo: {
    fontSize: 18,
  },
  reviewsLabel: {
    fontSize: 15,
  },
  meaning: {
    fontSize: 15,
    flexShrink: 1,
  },
  state: {
    marginLeft: 'auto',
    fontSize: 11,
  },
  notice: {
    fontSize: 14,
  },
  unlockLink: {
    fontSize: 14,
  },
  unlockCard: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  unlockBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  unlockCta: {
    fontSize: 14,
    marginTop: 2,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  debugLabel: {
    fontSize: 11.5,
  },
});
