# データモデル

要件定義書 6.3 の「将来のクラウド移行を見据えた設計」を具体化したもの。
`src/db/` を触る前に読む。

## 大原則: コンテンツ と ユーザー状態 を分ける

| 区分 | テーブル | 性質 |
|---|---|---|
| **コンテンツ** | `kanji`, `words`, `sentences`, `sentence_lines` | アプリに同梱。読み取り専用。将来も同期不要。アプリ更新で丸ごと入れ替わる |
| **ユーザー状態** | `review_events`, `quiz_attempts`, `user_settings`, `reveal_shown` | 端末で生成される。**将来のクラウド同期対象** |

この2つを同じテーブルに混ぜると、同期を足すときに全部やり直しになる。

## 全テーブル共通のルール

- 主キーは **ULID**(文字列)。`autoincrement` を使わない
- `created_at` / `updated_at` を必ず持つ(UNIX ミリ秒の integer)
- 論理削除ではなく、そもそも削除しない設計を優先する

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
アプリのバージョンを記録し、コンテンツが更新されていたらコンテンツ系テーブルのみ入れ替える。
**このときユーザー状態テーブルには一切触れない。**
