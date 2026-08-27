/**
 * 開発用の一時画面。DB 基盤の受け入れ確認のためだけに存在する。
 *
 * **会話文画面を実装する回で削除すること**(docs/plans/db-foundation.md)。
 * 本番の導線からは辿れず、`learningkanjimobileapp://db-debug` で直接開く。
 *
 * ここで見たいのは1つだけ:「コンテンツを入れ替えてもユーザー状態が消えないこと」。
 */

import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getContentFingerprint,
  getTableCounts,
  getUserSettings,
  insertReviewEvent,
  listReviewEvents,
} from '@/db';
import type { TableCounts, UserSettings } from '@/db';
import { useTheme } from '@/theme';

/**
 * 本番ビルドでは何も出さない。
 *
 * フックを持つ本体を内側に分けているのは、`__DEV__` の判定をフックより先に置くため。
 * 同じ関数の中で早期 return すると、本番でも DB クエリを含む初期化が走ってしまう。
 */
export default function DbDebugScreen() {
  if (!__DEV__) {
    return null;
  }

  return <DbDebug />;
}

function DbDebug() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState<TableCounts>(() => getTableCounts());
  const [fingerprint, setFingerprint] = useState<string | null>(() => getContentFingerprint());
  // 最後に追記されたイベント。listReviewEvents() が動いていることの確認も兼ねる。
  // 描画の中で直接呼ぶと React Compiler にメモ化され、追記しても表示が古いままになる
  const [lastEventAt, setLastEventAt] = useState<number | null>(() => latestReviewedAt());
  // 初回に呼ぶと既定値の行が作られる。押すたびに user_settings が増えないことを見る
  const [settings, setSettings] = useState<UserSettings | null>(null);

  const refresh = useCallback(() => {
    setCounts(getTableCounts());
    setFingerprint(getContentFingerprint());
    setLastEventAt(latestReviewedAt());
  }, []);

  const addTestEvent = useCallback(() => {
    // コンテンツが空でも押せるように、実在しない ID を入れる。
    // 外部キーを張っていないので通る。ここで見たいのは行数の増減だけ。
    insertReviewEvent({
      kanjiId: 'debug-kanji',
      sentenceId: 'debug-sentence',
      result: 'correct',
    });
    refresh();
  }, [refresh]);

  const loadSettings = useCallback(() => {
    setSettings(getUserSettings());
    refresh();
  }, [refresh]);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        gap: 20,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 22 }}>Database debug</Text>

      <Section title="Migrations">
        {/* この画面が描けている時点で、_layout のゲートを通過している */}
        <Row label="status" value="ok" />
        <Row label="content fingerprint" value={fingerprint ?? '(not seeded)'} />
      </Section>

      <Section title="Content (replaced on reseed)">
        <Row label="kanji" value={String(counts.content.kanji)} />
        <Row label="words" value={String(counts.content.words)} />
        <Row label="sentences" value={String(counts.content.sentences)} />
        <Row label="sentence_lines" value={String(counts.content.sentenceLines)} />
        <Row label="content_meta" value={String(counts.content.contentMeta)} />
      </Section>

      <Section title="User state (must survive a reseed)">
        <Row label="review_events" value={String(counts.userState.reviewEvents)} />
        <Row label="quiz_attempts" value={String(counts.userState.quizAttempts)} />
        <Row label="reveal_shown" value={String(counts.userState.revealShown)} />
        <Row label="user_settings" value={String(counts.userState.userSettings)} />
      </Section>

      {settings === null ? null : (
        <Section title="Settings (created on first read)">
          <Row label="romajiEnabled" value={String(settings.romajiEnabled)} />
          <Row label="themeId" value={settings.themeId} />
        </Section>
      )}

      <Button label="Insert test review event" onPress={addTestEvent} />
      <Button label="Read user settings" onPress={loadSettings} />
      <Button label="Refresh counts" onPress={refresh} />

      <Text style={{ color: theme.textMuted, fontSize: 13 }}>
        {lastEventAt === null
          ? 'No review events yet.'
          : `Last review event: ${new Date(lastEventAt).toISOString()}`}
      </Text>
    </ScrollView>
  );
}

/** 一番新しい復習イベントの時刻。無ければ null */
function latestReviewedAt(): number | null {
  const events = listReviewEvents();

  return events.length === 0 ? null : events[events.length - 1].reviewedAt;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.surfaceVeil,
        borderRadius: theme.radius.card,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        gap: 6,
      }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 13 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: theme.textMuted, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 15, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: theme.accent,
        borderRadius: theme.radius.pill,
        paddingVertical: 14,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: theme.onAccent, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
