# プラン: db-foundation

作成日: 2026-08-27
ステータス: 完了
要件定義書の対応箇所: 6.2 / 6.3(データ設計方針)、および 5.1-4 / 5.2 / 4.4 / 4.6 のデータ受け皿

## 目的

会話文画面・SRS・推測クイズ・漢字の樹がこの上に乗るための土台を作る。
SQLite のスキーマ・マイグレーション・起動時シード・クエリ層を用意し、
**「アプリを起動すると `src/content/` の静的データが DB に入っていて、ユーザー状態を追記できる」**
状態まで持っていく。学習機能そのものは一切実装しない。

### 先に確認したい点(要件・設計ドキュメントとの差分)

実装案の前に、ドキュメント側に決まっていない/食い違う点が4つある。プランではそれぞれ
下記の方針を採るが、方針が違うなら実装前に指摘してほしい。

1. **`docs/data-model.md` はコンテンツ系を4表(`kanji` / `words` / `sentences` / `sentence_lines`)と
   定めているが、`src/content/types.ts` には表に落ちない入れ子配列が2つある。**
   `KanjiEntry.readings: Reading[]` と `Sentence.reencounters: Reencounter[]`(しかも
   `Reencounter.kanjiIds` は配列の配列)。
   → 本プランは**表を増やさず JSON テキスト列**にする(常に親行と一緒に丸ごと読む値であり、
   SQL で検索する必要が今のところ無いため)。正規化したいなら表を2つ足す判断になるので、
   ここは承認時に決めてほしい。
2. **`sentence_lines` は絶対規則2(ULID主キー)を満たす必要があるが、`Line` に `id` が無い。**
   → シード時に ULID を採番する。`Line` の型は変更しない。
3. **`docs/data-model.md` のシード節は「アプリのバージョンを記録し」とあるが、
   これでは開発中にコンテンツを足してもアプリバージョンが変わらず再シードされない。**
   → **コンテンツのフィンガープリント(内容ハッシュ)**を記録する方式に変え、
   `docs/data-model.md` の該当行も直す(本プランに含む)。
4. **`quiz_attempts` の列を決める根拠が無い。** 推測クイズの出題データ型は
   `src/content/types.ts` にまだ存在しない(クイズ項目は未設計)。
   → 「同じ問題を続けて出さない」という data-model の用途だけを満たす最小列
   (不透明な `item_key` + 結果 + 時刻)で作る。クイズ設計時に列追加のマイグレーションが
   必要になる可能性を受け入れる。表ごと後回しにする案もある。

## スコープ外

**この回で作らないもの(明示的に次回以降へ送る)**

- SRS のステージ計算・次回出題日・今日のキュー・1日3字上限(`features/srs/`)。
  `review_events` の**書き込みと読み出しまで**が今回で、畳み込みは次回
- `kanji_progress` キャッシュ表。`review_events` から導出できるので、必要になってから足す
- 推測クイズのロジックとクエリ(`quiz_attempts` は表だけ作り、クエリ関数は書かない)
- 漢字の樹のクエリ(`words` の読み出し関数は作るが、レイアウト・SVG は対象外)
- 章ロック判定・エンタイトルメント確認(`isFree` は列として持つだけ)
- 会話文画面・漢字フォーカス画面・設定画面などの本番 UI
- `user_settings` を読んで `ThemeProvider` にテーマを渡す配線(表と読み書き関数までが今回)
- **`src/content/` への実データ投入(漢字50字・会話文58文)**。別タスク。
  今回はコンテンツが空配列のままでも起動・シードが成立することを保証する
- `drizzle-orm/expo-sqlite` の `useLiveQuery` の導入。画面は都度クエリする(`docs/architecture.md`)
- クラウド同期・エクスポート・バックアップ・DB リセット UI
- スキーマ分割(`src/db/schema/content.ts` と `user-state.ts` に分ける案)。
  今回は1ファイル内でセクションを分けるに留める
- Node 上で SQLite を動かすテスト基盤(better-sqlite3 等)の導入

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/db/schema.ts` | 新規 | 全テーブル定義。コンテンツ系セクションとユーザー状態セクションを明確に分ける |
| `src/db/migrations/` | 新規(生成物) | `pnpm run db:generate` の出力(`0000_*.sql` / `meta/_journal.json` / `migrations.js`)。**手で触らない** |
| `src/db/client.ts` | 新規 | `openDatabaseSync('kanji.db')` + `drizzle(client)` のシングルトン |
| `src/db/ulid.ts` | 新規 | 純粋な ULID 生成ファクトリ。乱数源と時刻を引数で受ける(React・ネイティブ非依存) |
| `src/db/ulid.test.ts` | 新規 | 決定的な乱数源を注入したユニットテスト |
| `src/db/id.ts` | 新規 | `expo-crypto` の `getRandomBytes` を `ulid.ts` に注入して `newId()` を公開 |
| `src/db/mappers.ts` | 新規 | DB 行 ↔ `src/content/types.ts` の型。JSON 列の型ガード、`parseThemeId` |
| `src/db/mappers.test.ts` | 新規 | JSON 往復・壊れた JSON・null 保持・不正 themeId のテスト |
| `src/db/seed.ts` | 新規 | フィンガープリント比較 → 差があればコンテンツ系表のみトランザクションで入れ替え |
| `src/db/use-database.ts` | 新規 | `useMigrations` + シードを束ね `'migrating' \| 'ready' \| 'error'` を返すフック |
| `src/db/queries/content.ts` | 新規 | `listKanji` / `getKanji` / `listSentences` / `getSentence` / `listWordsByKanji` |
| `src/db/queries/review-events.ts` | 新規 | `insertReviewEvent` / `listReviewEvents`(**INSERT と SELECT のみ**) |
| `src/db/queries/user-settings.ts` | 新規 | `getUserSettings`(無ければ既定行を作る)/ `updateUserSettings` |
| `src/db/queries/reveal-shown.ts` | 新規 | `hasRevealShown(kanjiId)` / `markRevealShown(kanjiId)` |
| `src/db/queries/diagnostics.ts` | 新規 | `getTableCounts()`(デバッグ画面用の行数集計) |
| `src/db/index.ts` | 新規 | 公開 API の barrel。画面は必ずここ経由で触る |
| `src/content/fingerprint.ts` | 新規 | `contentFingerprint(content: ContentSet): string`(純粋関数) |
| `src/content/fingerprint.test.ts` | 新規 | 同一内容→同値 / 1文字変更→別値 / 空セットでも値を返す |
| `src/types/sql.d.ts` | 新規 | `declare module '*.sql'`。生成された `migrations.js` を tsc に通すため |
| `src/app/db-debug.tsx` | 新規 | **開発用の一時画面**。マイグレーション状態・行数・テストイベント挿入 |
| `src/app/_layout.tsx` | 変更 | `useDatabase()` が ready になるまで `<Stack>` を描画しない。失敗時は英語のエラー表示 |
| `package.json` | 変更 | `expo-crypto` を依存に追加(`pnpm exec expo install expo-crypto`) |
| `.prettierignore` | 変更 | `src/db/migrations/` を追加(生成物を整形で書き換えない) |
| `docs/data-model.md` | 変更 | シード節を「コンテンツのフィンガープリント」に修正。JSON 列と FK 不使用の方針を追記 |

## データモデルの変更

**初回マイグレーション `0000_*.sql` を新規生成する。** 以下9表。

### コンテンツ系(同梱・再シードで丸ごと入れ替わる)

| テーブル | 主な列 |
|---|---|
| `kanji` | `id`(ULID・コンテンツ由来), `character`, `meaning`, `order_index`, `chapter`, `illustration_key`, `readings`(JSON `Reading[]`), `reading_introduction`(enum) |
| `words` | `id`, `kanji_id`, `surface`, `kana`, `meaning`, `reading_type`(enum), `encountered_in_sentence_id`(nullable) |
| `sentences` | `id`, `chapter`, `order_index`, `scene`, `new_kanji_id`(nullable), `reencounters`(JSON `Reencounter[]`), `is_free`(boolean) |
| `sentence_lines` | `id`(**シード時に採番**), `sentence_id`, `line_index`, `speaker`(enum), `japanese`, `furigana`, `romaji`, `english` |
| `content_meta` | `id`, `fingerprint`, `seeded_at` — 1行だけ。端末ローカルの記録であり同期対象ではない |

### ユーザー状態(将来の同期対象)

| テーブル | 主な列 |
|---|---|
| `review_events` | `id`, `kanji_id`, `sentence_id`, `result`(`'correct' \| 'incorrect'`), `reviewed_at` — **INSERT のみ** |
| `quiz_attempts` | `id`, `item_key`, `result`, `attempted_at` — SRS とは完全に別系統 |
| `reveal_shown` | `id`, `kanji_id`(UNIQUE), `shown_at` — 読み変化カードの1回制限(絶対規則11) |
| `user_settings` | `id`, `romaji_enabled`(boolean, 既定 false), `theme_id`(既定は `DEFAULT_THEME_ID`) — 1行のみ。UPDATE 可 |

全表に `created_at` / `updated_at`(UNIX ミリ秒の integer、`Date.now()` を明示的に入れる)。
主キーはすべて `text('id').primaryKey()`。`autoincrement` を使わない。

**外部キー制約を一切張らない。** コンテンツ表はアプリ更新のたびに DELETE + INSERT で
入れ替わる一方、`review_events` は過去のコンテンツ ID を参照したまま残るのが正しい挙動であり、
FK を張ると再シードが失敗するか、ユーザー状態が CASCADE で消える。
参照整合性は `pnpm run validate:content`(`checkWordReferences` など)がコンテンツ側で担保する。

インデックス: `words(kanji_id)`, `sentence_lines(sentence_id, line_index)`,
`sentences(order_index)`, `kanji(order_index)`, `kanji(character)` UNIQUE,
`review_events(kanji_id, reviewed_at)`, `reveal_shown(kanji_id)` UNIQUE。

### ULID 生成手段(未導入のため選定)

| 候補 | 判断 |
|---|---|
| `ulid`(npm) | 不採用。`crypto.getRandomValues` の有無を import 時に検出する作りで、Hermes では `react-native-get-random-values` の polyfill 前提になる |
| `ulidx` | 不採用。同上(React Native では polyfill が要ると公式に明記) |
| **自前実装 + `expo-crypto`** | **採用**。ULID は「48bit 時刻 + 80bit 乱数を Crockford Base32 で26文字」だけの仕様で、実装は40行程度。乱数源を引数で受ける純粋関数にすれば Jest でそのままテストでき、`docs/architecture.md`「純粋ロジックは React から切り離してテストする」に乗る |

乱数源には Expo SDK 57 の `expo-crypto` の `getRandomBytes(byteCount): Uint8Array`(名前に反して同期)
を使う。追加の polyfill もグローバル汚染も要らない。
同一ミリ秒内では乱数部を +1 する単調増加(ULID の monotonic factory 相当)を入れ、
同じ ms に連続生成した ID が文字列順で並ぶようにする。

## 実装ステップ

1. `pnpm exec expo install expo-crypto` で依存を追加する
2. `src/db/ulid.ts` に `createUlidFactory({ now, randomBytes })` を書き、`ulid.test.ts` を添える。
   `src/db/id.ts` で `expo-crypto` を注入して `newId()` を公開する
   (**`ulid.test.ts` は `id.ts` を import しない**。ネイティブモジュールをテストに引き込まないため)
3. `src/content/fingerprint.ts` に `contentFingerprint()`(FNV-1a などの軽い決定的ハッシュ + 件数)を書き、
   テストを添える
4. `src/db/schema.ts` に9表を定義する。ファイル内を
   `// --- コンテンツ(同梱・同期不要) ---` / `// --- ユーザー状態(将来の同期対象) ---` で区切る
5. `pnpm run db:generate` を実行し、生成された `0000_*.sql` を**読んで**目視確認する
   (JSON 列が TEXT、boolean が INTEGER、enum が CHECK 制約になっていること)。**編集はしない**
6. `src/types/sql.d.ts` に `declare module '*.sql'` を置き、`.prettierignore` に
   `src/db/migrations/` を追加する
7. `src/db/client.ts` で `openDatabaseSync('kanji.db')` → `drizzle(client)` のシングルトンを作る
   (`{ schema }` は渡さない。リレーショナルクエリ API を使わないため)
8. `src/db/mappers.ts` に行 ↔ ドメイン型の変換を書く。JSON 列は `unknown` に落としてから
   型ガードで絞り、形が壊れていたら**どの行のどの列かを含むエラーを投げる**(`any` を使わない)。
   `mappers.test.ts` を添える
9. `src/db/seed.ts` に `seedContentIfChanged(db, content)` を書く。
   `content_meta.fingerprint` と現在値を比較し、異なるときだけ
   `db.transaction()`(expo ドライバは同期)の中で
   コンテンツ系5表を DELETE → INSERT(**50行ずつのチャンク**で SQLite の変数上限を避ける)。
   **ユーザー状態表には一切触れない**
10. `src/db/use-database.ts` で `useMigrations(db, migrations)` を呼び、成功後に
    `seedContentIfChanged` を1回だけ走らせる。状態を `'migrating' | 'ready' | 'error'` で返す
11. `src/db/queries/` に読み書き関数を書く。戻り値は `KanjiEntry` / `Sentence` / `Word` など
    アプリの型で、DB 行型を UI に漏らさない。`src/db/index.ts` から公開する
12. `src/app/_layout.tsx` の `ThemedShell` で `useDatabase()` を呼び、
    `ready` になるまで `<Stack>` を描画しない。`error` のときは英語の一文を `theme.text` で出す
13. `src/app/db-debug.tsx`(`__DEV__` 以外では `null`)にマイグレーション状態・全表の行数・
    「Insert test review event」ボタンを置く。文言は英語、色は `useTheme()` 経由
14. `docs/data-model.md` のシード節を修正し、JSON 列と FK 不使用の方針を追記する
15. `pnpm run check` を通す

## 受け入れ条件

- [x] `src/db/schema.ts` にコンテンツ系5表(`kanji` / `words` / `sentences` / `sentence_lines` / `content_meta`)と
      ユーザー状態4表(`review_events` / `quiz_attempts` / `reveal_shown` / `user_settings`)が定義され、
      ファイル内でセクションコメントにより分離されている
- [x] 全9表が `text('id').primaryKey()` と `created_at` / `updated_at` を持つ。
      `rg "autoincrement" src/db` が0件
- [x] `rg "references\(" src/db/schema.ts` が0件(外部キーを張っていない)
- [x] `pnpm run db:generate` が `src/db/migrations/0000_*.sql` / `meta/_journal.json` / `migrations.js` を生成し、
      `git diff` に生成物への手編集が含まれない
- [x] `pnpm run check`(typecheck / lint / test / content)が通る
- [x] `newUlid()` を1000回呼ぶと、すべて26文字・Crockford Base32(`0-9A-HJKMNP-TV-Z`)のみ・重複0件
- [x] 同じミリ秒を返す時刻関数で連続生成した ULID が、文字列比較で狭義単調増加する
- [x] 時刻を 1ms 進めて生成した ULID は、前の ULID より文字列比較で大きい
- [x] `readings` に `[{"kana":"やま","romaji":"yama","type":"kun"}]` を持つ行をマッパーに渡すと
      `KanjiEntry.readings` が長さ1の `Reading[]` として返る。`readings` が `"{"` のような
      壊れた値の行を渡すと、列名を含むエラーが throw される
- [x] `encountered_in_sentence_id` が NULL の `words` 行は `Word.encounteredInSentenceId === null` になる
- [x] `contentFingerprint()` が、同一内容の `ContentSet` に同じ文字列を返し、
      会話文の1文字を変えると別の文字列を返し、`{kanji:[],words:[],sentences:[]}` でも文字列を返す
- [x] `src/content/index.ts` が空配列のままでも、iOS シミュレータでアプリが起動しクラッシュしない
- [x] `learningkanjimobileapp://db-debug` を開くと、migrations の状態(ok)と9表すべての行数が表示される
- [x] `src/content/index.ts` に漢字1件・会話文1件(2行)を一時的に足して再起動すると、
      db-debug が `kanji=1` / `sentences=1` / `sentence_lines=2` を表示する。
      **もう一度再起動しても件数が増えない**(再シードが走らない)
- [x] db-debug の「Insert test review event」を押すと `review_events` が +1 される。
      その状態で `src/content/index.ts` の内容を変えて再起動すると、コンテンツ系の件数だけが変わり、
      `review_events` の件数は変わらない
- [x] `rg "update\(reviewEvents\)|delete\(reviewEvents\)" src` が0件。
      `src/db/index.ts` が公開する `review_events` 系の関数は INSERT 1つと SELECT のみ
- [x] `src/db/queries/` に `quiz_attempts` を `review_events` へ書く経路が存在しない
      (`rg "quiz" src/db/queries/review-events.ts` が0件)
- [x] `getUserSettings()` を初回に呼ぶと `romajiEnabled: false` / `themeId: DEFAULT_THEME_ID` の行が作られ、
      2回目以降は同じ行が返る(db-debug で `user_settings=1` が2回目以降も 1 のまま)
- [x] `src/app/db-debug.tsx` の文言がすべて英語で、`rg "#[0-9a-fA-F]{3,8}" src/app/db-debug.tsx` が0件
      (色は `useTheme()` 経由)
- [x] マイグレーション完了前は `<Stack>` が描画されず、テーマの地と背景装飾だけが見える。
      `useMigrations` が error を返す状態を一度意図的に作り、白画面ではなく英語のエラー文が出ることを確認する

## テスト方針

**Jest では SQLite を動かさない。** `expo-sqlite` はネイティブモジュールで、`jest-expo` 環境では
実 DB が開けない。Node 用の SQLite ドライバを入れて二重にスキーマを検証するのは、
リリースまでの残り期間に対して割に合わないためスコープ外とする(`## スコープ外`)。

### ユニットテストを書くもの(純粋ロジック)

| 対象 | 見るもの |
|---|---|
| `src/db/ulid.test.ts` | 長さ・文字集合・時刻順序・同一 ms の単調増加・乱数源を差し替えた決定的出力 |
| `src/db/mappers.test.ts` | JSON 列(`readings` / `reencounters`)の往復、壊れた JSON でのエラー、null 保持、不正な `theme_id` の既定値フォールバック |
| `src/content/fingerprint.test.ts` | 決定性・変更検出・空セット |

`ulid.test.ts` は `src/db/id.ts`(`expo-crypto` を読む)を import しない。
`mappers.test.ts` は `src/db/client.ts` を import しない。**テストから DB 接続に到達させない**のが条件。

### シミュレータで手動確認するもの

マイグレーション適用、シードの冪等性、再シード時のユーザー状態の保全、
起動ゲートの表示。手順は `## 受け入れ条件` の該当項目がそのままチェックリストになる。
確認は `attach` → `build` → `launch` の MCP ツールで行い、
`learningkanjimobileapp://db-debug` を開く(`app.json` の `scheme` は `learningkanjimobileapp`)。

## リスク・未確定事項

- **`expo-crypto` の追加でネイティブの再ビルドが必要。** `ios/` は prebuild 済みで存在するため、
  `pod install` を含む再ビルドを回せばシミュレータ側の受け入れ条件はこの回で確認できる。
  ここまで到達しなかった場合は `docs/plans/paywall-sdk-init.md` と同じく「未実施」として明示的に残す
- **`migrations.js` は drizzle-kit が吐く型なしの JS で、`./0000_*.sql` を import している。**
  `src/types/sql.d.ts` の `declare module '*.sql'` が無いと `tsc --noEmit` が落ちる。
  Babel 側は `babel.config.js` の `inline-import` で設定済み、ESLint は
  `eslint.config.js` が `src/db/migrations/*` を無視済み。`meta/` 配下まで lint が入るようなら
  ignore を `src/db/migrations/**` に広げる
- **JSON 列にした `reencounters` は SQL で検索できない。** 「この漢字が第2段階で再登場する文」を
  引きたくなったら JS 側でフィルタすることになる。58文なので実用上は問題ないはずだが、
  重くなったら `sentence_reencounters` 表を追加するマイグレーションを後から足す(追記なので可能)
- **`quiz_attempts` の列は暫定。** クイズ項目のデータ型が `src/content/types.ts` に無いため、
  `item_key`(語の表記を入れる想定)という不透明な列で置いている。クイズ実装時に
  列追加のマイグレーションが必要になる可能性が高い。表ごと後回しにする判断もあり得る
- **フィンガープリントは起動のたびに `ContentSet` 全体をハッシュする。** 58文で数ミリ秒の想定だが、
  実データ投入後に起動が体感で遅れるようなら、件数 + `id` の列挙だけを対象にするなど軽量化する
- **`docs/data-model.md` を1箇所書き換える。** 要件定義書 6.3 とは矛盾しない
  (6.3 はシードの版管理方法まで規定していない)ため ADR は起こさない想定。
  ADR が要ると判断するなら承認時に指示してほしい
- **`src/app/db-debug.tsx` は一時的な開発用画面。** 本番ビルドにも(`null` を返す形で)
  ルートとして残る。会話文画面が入る回で削除する前提のものであり、削除タイミングを
  忘れないよう `db-debug.tsx` の冒頭コメントに明記する
- **`src/content/` の実データ投入は別タスク。** 今回のシードは空配列でも成立するが、
  実データが入った時点で「`validate:content` が通ること」と「シードが通ること」の
  両方を確認する必要がある(未習漢字などの内容検証はコンテンツ側の責務で、DB 層では検証しない)

---

## 実装後の記録(2026-08-27)

### プランの記述で誤っていたもの

- **実装ステップ5の「enum が CHECK 制約になっていること」は誤り。**
  drizzle の sqlite `text({ enum })` は型レベルのみで、DDL には出ない
  (生成 SQL は `result text NOT NULL`)。書き込み経路がすべて型付きなので実害はないが、
  DB 単体では enum の値域が守られていない。
- **リスク欄の「`ios/` はまだ生成されていない」は誤り。** prebuild 済みだったため、
  `pod install` + 再ビルドでシミュレータ確認まで到達できた。

### 承認済みスコープから外れて触ったもの

- **`src/content/validate.ts` に `checkUniqueKanjiCharacters` を追加**(テストも追加)。
  本プランで `kanji.character` に UNIQUE を張った結果、
  「`validate:content` は通るのにシードだけが UNIQUE 制約違反で落ちる」という
  非対称が生まれたため。次のコンテンツ投入タスクで踏むと全ユーザーが起動不能になる。

### レビュー指摘への対応

`reviewer` の要修正5件をすべて修正した。

1. エラー画面が例外本文(日本語)を本番でも出していた → 固定の英文のみにし、
   詳細は `console.error` と `__DEV__` 時の表示に回した(絶対規則7)
2. `kanji.character` の UNIQUE をコンテンツ検証が担保していなかった → 上記のルールを追加
3. `listReviewEvents` の並びに同一ミリ秒のタイブレークが無かった → `id` を第2キーにした
4. `parseThemeId` の `in` がプロトタイプチェーンを辿っていた → `Object.hasOwn` にした
5. `docs/data-model.md` と `src/db/CLAUDE.md` の表に `content_meta` が無かった → 追記

### 次のタスクへの申し送り

- `src/db/mappers.ts` が `@/theme/themes` 経由で背景画像アセットを DB 層に引き込んでいる。
  `ThemeId` をデータだけのモジュールに分けるのが素直(今回は実害なしとして許容)
- `src/app/db-debug.tsx` は会話文画面を実装する回で削除する
