/**
 * 入口画面「今日の学習」(要件定義書 4.1 / 5.1-8)。
 *
 * 出すのは**今日ぶんだけ**。1日3字は目標で、達成したら祝いと樹を主役にし、
 * 続けたい人には控えめな `Learn N more kanji` を出す(ADR-0011)。全58文を並べないのは、
 * 目標という区切りが見えなくなり、第2段階の「翌日以降に戻る」も崩れるため。
 *
 * 何を出すかは `planTodaysLessons()` が決める。ここは描くだけで、
 * ルーティングも DB も知らない。
 */

import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionLabel } from '@/components/section-label';
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
  /**
   * 漢字の樹への導線(要件定義書 4.5 / 5.1-7)。学習済みの字数 / 全字数。
   * 3つ揃って渡ったときだけ行を出す。渡らない呼び出し側の見た目は変えない。
   */
  metKanjiCount?: number;
  totalKanjiCount?: number;
  onOpenTrees?: () => void;
  /** 「もう3字」を押したとき。渡らない呼び出し側ではリンクを出さない */
  onLearnMore?: () => void;
  /** 開発ビルドの制限解除(目標の枠と第2段階の翌日規則)。`__DEV__` のときだけ渡す */
  devUnrestricted?: boolean;
  onChangeDevUnrestricted?: (value: boolean) => void;
}

export function TodayView({
  lessons,
  kanji,
  onSelect,
  reviewDueCount = 0,
  onOpenReviews,
  lockedCount = 0,
  onUnlock,
  metKanjiCount,
  totalKanjiCount,
  onOpenTrees,
  onLearnMore,
  devUnrestricted,
  onChangeDevUnrestricted,
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
  // 目標の内と外を分けて描く。外の行は目標達成カードの**下**に並べ、
  // 「目標は3のまま、その先はおまけ」を位置で伝える
  const withinGoal = lessons.items.filter((item) => !item.beyondGoal);
  const beyondGoal = lessons.items.filter((item) => item.beyondGoal);
  // 翌日規則で止まった理由は、今日の分をやり終えてから言う。始める前に「明日戻る」と
  // 言っても、その字をまだ学んでいない
  const comesBack =
    pending.length === 0 && lessons.waitingFor !== null
      ? comesBackTomorrow(lessons.waitingFor.kanjiIds, kanjiById)
      : null;
  const renderRow = (item: TodaysLessonItem) => (
    <Row
      key={item.sentence.id}
      item={item}
      newKanji={
        item.sentence.newKanjiId === null ? null : (kanjiById.get(item.sentence.newKanjiId) ?? null)
      }
      onPress={() => onSelect(item.sentence.id)}
    />
  );

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
        <SectionLabel>Today</SectionLabel>
        {/*
          分母は目標で固定する。追加で開いた字を分母に足すと「6 of 6」になり、
          目標が引き上がったように見える(ADR-0011)。達成後は字数だけを数える。
        */}
        <Text style={[styles.progress, { color: theme.textMuted }]}>
          {lessons.goalMet
            ? `Goal met · ${lessons.learnedToday} kanji today`
            : `${lessons.learnedToday} of ${lessons.goal} kanji today`}
        </Text>
      </View>

      {withinGoal.length === 0 ? null : (
        <View style={styles.rows}>{withinGoal.map(renderRow)}</View>
      )}

      {lessons.goalMet ? (
        <GoalCard
          learnedKanji={lessons.items
            .filter((item) => item.done && item.sentence.newKanjiId !== null)
            .map((item) => kanjiById.get(item.sentence.newKanjiId ?? '')?.character ?? '?')}
          met={metKanjiCount}
          total={totalKanjiCount}
          onOpenTrees={onOpenTrees}
          // 未完了が残っている間は出さない。押す前に今日の分を終えてもらう
          moreCount={pending.length === 0 && lessons.waitingFor === null ? lessons.moreCount : 0}
          onLearnMore={onLearnMore}
          comesBack={comesBack}
        />
      ) : null}

      {beyondGoal.length === 0 ? null : (
        <View style={styles.rows}>{beyondGoal.map(renderRow)}</View>
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
          comesBack={comesBack}
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

      {/*
        樹は「今日の回」の下・Unlock の上。今日やることの後ろに、これまでの蓄積が見える順。
        学習済みが0字でも出す。空のグリッドが「まだ何も無い」を伝えてくれる。
      */}
      {metKanjiCount !== undefined && totalKanjiCount !== undefined && onOpenTrees !== undefined ? (
        <Trees met={metKanjiCount} total={totalKanjiCount} onOpen={onOpenTrees} />
      ) : null}

      {showUnlock ? (
        <Unlock lockedCount={lockedCount} exhausted={freeExhausted} onPress={onUnlock} />
      ) : null}

      {onChangeDevUnrestricted === undefined ? null : (
        <View style={styles.debugRow}>
          <Text style={[styles.debugLabel, { color: theme.textMuted }]}>
            Ignore daily goal and next-day rule
          </Text>
          <Switch
            value={devUnrestricted ?? false}
            onValueChange={onChangeDevUnrestricted}
            trackColor={{ true: theme.accent, false: theme.border }}
            thumbColor={theme.surface}
            ios_backgroundColor={theme.border}
            accessibilityLabel="Ignore daily goal and next-day rule"
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

/** 漢字の樹(進捗画面)への導線。件数は「学習済みの字数 / 全字数」 */
function Trees({ met, total, onOpen }: { met: number; total: number; onOpen: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.border,
          borderRadius: theme.radius.card,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.reviewsLabel, { color: theme.text }]}>Kanji tree</Text>
      <Text style={[styles.state, { color: theme.textMuted }]}>{`${met} of ${total}`}</Text>
    </Pressable>
  );
}

function Notice({
  lessons,
  hasKanji,
  comesBack,
  suppressAllDone,
}: {
  lessons: TodaysLessons;
  hasKanji: boolean;
  /** 翌日規則で止まったときの一言。止まっていなければ null */
  comesBack: string | null;
  suppressAllDone: boolean;
}) {
  const theme = useTheme();

  // シード前(コンテンツが1件も無い)を「全部終えた」と言わない。
  // 目標を達成した日は GoalCard が終わりの合図になるので、ここでは黙る。
  // 目標の手前で翌日規則に止められた日(3字/日だと16日目)だけ、ここで理由を言う。
  // 未達を達成と言い換えない(ADR-0011。ストリークが無いので未達に罰は無い)
  const message = !hasKanji
    ? 'No conversations yet.'
    : lessons.allDone
      ? suppressAllDone
        ? null
        : "You've finished every conversation for now."
      : !lessons.goalMet && comesBack !== null
        ? `That's all for today. ${comesBack}`
        : null;

  if (message === null) {
    return null;
  }

  return <Text style={[styles.notice, { color: theme.textMuted }]}>{message}</Text>;
}

/**
 * 目標達成カード(ADR-0011)。**祝いと樹が主役**で、`Learn N more kanji` は控えめなリンクに留める。
 * 止めはしないが、勧めもしない。同格のボタンを2つ並べると、続けることを勧めているように見える。
 *
 * `N` は押したら実際に並ぶ字数。無料枠の最後や翌日規則の手前では3に満たない(`Learn 1 more kanji`)。
 */
function GoalCard({
  learnedKanji,
  met,
  total,
  onOpenTrees,
  moreCount,
  onLearnMore,
  comesBack,
}: {
  learnedKanji: string[];
  met?: number;
  total?: number;
  onOpenTrees?: () => void;
  moreCount: number;
  onLearnMore?: () => void;
  comesBack: string | null;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.goalCard,
        {
          backgroundColor: theme.surfaceVeil,
          borderColor: theme.accent,
          borderRadius: theme.radius.card,
        },
      ]}
    >
      <Text style={[styles.cardTitle, { fontFamily: theme.type.minchoBold, color: theme.text }]}>
        Daily goal met
      </Text>

      <View style={styles.goalKanji}>
        {learnedKanji.map((character, index) => (
          <Text
            // 同じ字が2回並ぶことは無いが、引けなかった字の '?' は重なりうる
            key={`${character}-${index}`}
            style={{ fontFamily: theme.type.minchoBold, fontSize: 24, color: theme.accent }}
            accessibilityLanguage="ja-JP"
          >
            {character}
          </Text>
        ))}
      </View>

      {met !== undefined && total !== undefined ? (
        <Text style={[styles.goalBody, { color: theme.textMuted }]}>
          {`${met} of ${total} kanji on your tree`}
        </Text>
      ) : null}

      {onOpenTrees === undefined ? null : (
        <Pressable onPress={onOpenTrees} accessibilityRole="button" hitSlop={8}>
          {({ pressed }) => (
            <Text style={[styles.goalCta, { color: theme.accent, opacity: pressed ? 0.6 : 1 }]}>
              See your kanji tree
            </Text>
          )}
        </Pressable>
      )}

      {comesBack !== null ? (
        <Text style={[styles.goalBody, { color: theme.textMuted }]}>{comesBack}</Text>
      ) : moreCount > 0 && onLearnMore !== undefined ? (
        <Pressable onPress={onLearnMore} accessibilityRole="button" hitSlop={10}>
          {({ pressed }) => (
            <Text style={[styles.moreLink, { color: theme.textMuted, opacity: pressed ? 0.6 : 1 }]}>
              {`Learn ${moreCount} more kanji`}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * 翌日規則で止まったときの一言。「◯ comes back tomorrow in a new word.」
 *
 * 字を出すのは、明日開く理由を具体的にするため(何が起きるかを予告する)。
 * 2字同時に読みが変わる回(時間・大学・外国)は「A and B」にする。
 */
function comesBackTomorrow(kanjiIds: string[], kanjiById: Map<string, KanjiEntry>): string {
  const characters = kanjiIds.map((id) => kanjiById.get(id)?.character ?? '?');
  const subject =
    characters.length === 1
      ? `${characters[0]} comes`
      : `${characters.slice(0, -1).join(', ')} and ${characters[characters.length - 1]} come`;

  return `${subject} back tomorrow in a new word.`;
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
      <Text style={[styles.cardTitle, { fontFamily: theme.type.minchoBold, color: theme.text }]}>
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
  // 行の高さを明示する。ヒラギノ明朝は日本語向けの字面なので、指定しないと行の箱が
  // 欧文のディセンダ(g / y / p の下)の分だけ足りず、下端が切れる(2026-09-23 の実機報告)
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
  },
  goalCard: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  goalKanji: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  goalCta: {
    fontSize: 14,
    marginTop: 2,
  },
  moreLink: {
    fontSize: 13.5,
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
