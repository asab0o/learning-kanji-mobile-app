> 種別: **stock** — 現在のスキーマ方針。変えたら上書きし、理由は `decisions/` に残す

# データモデル

要件定義書 6.3 の「将来のクラウド移行を見据えた設計」を具体化したもの。
`src/db/` を触る前に読む。

## 大原則: コンテンツ と ユーザー状態 を分ける

| 区分 | テーブル | 性質 |
|---|---|---|
| **コンテンツ** | `kanji`, `words`, `sentences`, `sentence_lines`, `content_meta` | アプリに同梱。読み取り専用。将来も同期不要。アプリ更新で丸ごと入れ替わる |
| **ユーザー状態** | `lesson_events`, `review_events`, `quiz_attempts`, `user_settings`, `reveal_shown` | 端末で生成される。**将来のクラウド同期対象** |

この2つを同じテーブルに混ぜると、同期を足すときに全部やり直しになる。

## 全テーブル共通のルール

- 主キーは **ULID**(文字列)。`autoincrement` を使わない
- `created_at` / `updated_at` を必ず持つ(UNIX ミリ秒の integer)
- 論理削除ではなく、そもそも削除しない設計を優先する
- **外部キー制約を張らない。** コンテンツ系は再シードで丸ごと入れ替わる一方、
  `review_events` は過去のコンテンツの ID を参照したまま残るのが正しい。
  FK を張ると再シードが失敗するか、ユーザー状態が CASCADE で消える。
  コンテンツ側の参照整合性は `pnpm run validate:content` が担保する
- **入れ子の配列は JSON テキスト列で持つ**(`kanji.readings` / `sentences.reencounters` /
  `sentence_lines.segments`)。
  常に親行と一緒に丸ごと読む値で、SQL で検索する用途が要件に無いため。
  検索したくなったら表を足すマイグレーションを後から積む

## SRS: 追記のみのイベントログ

**これが最重要の設計判断。** 現在の習熟度を1レコードで上書きしない。

```ts
// review_events — INSERT のみ。UPDATE / DELETE 禁止
{
  id: string;          // ULID
  kanjiId: string;
  sentenceId: string;
  result: 'correct' | 'incorrect';
  reviewedAt: number;  // UNIX ms
  createdAt: number;
  updatedAt: number;
}
```

現在のステージは `review_events` を時系列に畳み込んで求める。

```
stage = fold(events.filter(e => e.kanjiId === id).sortBy(reviewedAt))
```

`kanji_progress` テーブルを置く場合、それは**いつ捨てても再構築できるキャッシュ**として扱う。
キャッシュにしか存在しない情報を作らない。

理由: 将来2台目の端末が入っても、イベントを時系列にマージするだけで正しい状態になる。
上書き型だと「どちらの端末の状態が正しいか」を解く競合解決ロジックが必要になり、
ログインなしのMVPから同期版へ移る一番の障害になる。

## 学習(導入)と復習を別の表に分ける

「その回を学び終えた」は `lesson_events` に、「復習した結果」は `review_events` に入れる。

```ts
// lesson_events — INSERT のみ
{
  id: string;            // ULID
  sentenceId: string;
  kanjiId: string | null; // 第2段階専用の回は新出字が無い
  completedAt: number;    // UNIX ms
  createdAt: number;
  updatedAt: number;
}
```

**`review_events` に `result: 'correct'` を入れて導入を代用しない。** あちらは結果が
2値の復習ログで「導入した」を表せず、混ぜるとステージ計算が最初から1段ずれる。
`lesson_events` は正解/不正解の概念を持たない。

`sentence_id` に UNIQUE を張っていないのは、これがフラグ(`reveal_shown`)ではなく履歴だから。
同じ回を読み返したときに制約違反で落ちるより、追記が積まれるほうがログの意図に合う。
二重計上は2段で防ぐ。

1. 書き込み側 — 既に完了記録がある文には INSERT しない(`insertLessonEvent`)
2. 読み出し側 — 畳み込みで**文ごとに最も古い1件**だけを採る(`planTodaysLessons`)

「今日何字学んだか」もこのログから導出する。カウンタを1行持って上書きしない。
理由は `review_events` と同じで、2台目の端末が入ってもマージで正しい状態になるため。

## 推測クイズは SRS と混ぜない

`quiz_attempts` は別テーブル。要件定義書 4.4 の通り、**推測クイズの結果は SRS に影響させない**。
`review_events` に quiz の結果を書いたら仕様違反。

記録する理由は「同じ問題を続けて出さない」ためだけであり、成績評価には使わない。

## 演出の頻度制限

`reveal_shown` に、読み変化カード(要件定義書 4.6 ステップ2)を出した漢字を記録する。
同じ漢字につき1回だけ出すため。

## マイグレーション

- `pnpm run db:generate` で drizzle-kit が `src/db/migrations/` に生成する
- **生成されたSQLを手で編集しない**(`.claude/settings.json` の deny でも防いでいる)
- 一度コミットしたマイグレーションを書き換えない。修正は新しいマイグレーションで行う
- Expo で SQL ファイルをバンドルするため `babel-plugin-inline-import` を使う

## シード

初回起動時に `src/content/` の静的データをコンテンツ系テーブルへ流し込む。
**コンテンツの内容から計算した指紋**(`src/content/fingerprint.ts`)を `content_meta` に記録し、
起動のたびに突き合わせて、違っていたらコンテンツ系テーブルのみ入れ替える。
**このときユーザー状態テーブルには一切触れない。**

アプリのバージョン(`app.json` の `version`)ではなく内容を見るのは、開発中に会話文を
1文足してもバージョンは上がらず、再シードが走らないため。バージョン方式だと
「データを直したのに画面に出ない」が毎回起きる。
