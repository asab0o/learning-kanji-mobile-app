# src/db/ の規約

Drizzle ORM + expo-sqlite。設計の背景は `docs/data-model.md`。

## 絶対に守ること

1. **主キーは ULID(文字列)。** `autoincrement` を使わない。
   将来の複数端末同期での ID 衝突を避けるため
2. **全テーブルに `created_at` / `updated_at`**(UNIX ミリ秒の integer)
3. **コンテンツ系テーブルとユーザー状態テーブルを混ぜない**

   | 区分 | テーブル |
   |---|---|
   | コンテンツ(同梱・同期不要) | `kanji`, `words`, `sentences`, `sentence_lines`, `content_meta` |
   | ユーザー状態(将来の同期対象) | `review_events`, `quiz_attempts`, `user_settings`, `reveal_shown` |

4. **`review_events` は INSERT のみ。** UPDATE / DELETE を書かない。
   現在のステージはイベントを畳み込んで求める。
   `kanji_progress` を置く場合、それはいつ捨てても再構築できるキャッシュ
5. **推測クイズの結果を `review_events` に書かない。** `quiz_attempts` に入れる。
   要件定義書 4.4 の「結果は SRS に入れない」に反する
6. **`src/db/migrations/` を手で編集しない。** `npm run db:generate` で生成する。
   一度コミットしたマイグレーションは書き換えず、新しいものを足して直す

## クエリ層

- 画面から生の Drizzle クエリを呼ばない。`src/db/queries/` に関数として置く
- クエリ関数は入出力をアプリの型(`src/content/types.ts` 等)で表現する。
  DB の行型をそのまま UI に漏らさない

## シード

初回起動と、コンテンツのバージョンが上がったときに `src/content/` のデータを
コンテンツ系テーブルへ流し込む。**このときユーザー状態テーブルには一切触れない。**
