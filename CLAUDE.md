@AGENTS.md

# 漢字学習アプリ (Shipaton 2026)

日本語学習者(N5レベル)向けの iOS アプリ。**会話文の中で漢字に出会い → SRSで復習 →
学んだ漢字が別の場面に段階的に再登場する**ことで「漢字は意味の核である」という感覚を育てる。

最優先目標は賞金ではなく **2026/9/30 までに App Store へリリースしきること**。
迷ったら「スコープを削って出す」方向に倒す。

## ドキュメント (必要なときに読む / 常時ロードしない)

`docs/` は **flow(なぜ・書き換えない) / stock(現在の状態・都度更新) / log(作業録・追記のみ)**
の3分類で運用する。**種別は `docs/` 直下なら各ファイルの先頭1行、`decisions/` `plans/` `log/`
ならそのディレクトリの `README.md` に書いてある。書き換える前に必ず見る。**
分類の考え方と、新しいドキュメントをどこに置くかは `docs/README.md`。

| ファイル                    | 種別  | 読むべきとき                                     |
| --------------------------- | ----- | ------------------------------------------------ |
| `docs/README.md`            | -     | ドキュメントを新しく足す/どこに書くか迷ったとき   |
| `docs/requirements.md`      | 混在  | 仕様の判断に迷ったとき。**要件の最終権威**。章ごとに種別が違う |
| `docs/architecture.md`      | stock | 画面追加・ディレクトリ配置・状態管理を決めるとき |
| `docs/data-model.md`        | stock | DBスキーマ・クエリ・マイグレーションを触るとき   |
| `docs/content-spec.md`      | stock | `src/content/` の会話文・漢字データを触るとき    |
| `docs/content-decisions.md` | flow  | 会話文の方針を疑ったとき。**会話文の最終権威**   |
| `docs/会話文集.md`          | stock | 会話文58文の原稿(v0.2)。実データの正             |
| `docs/decisions/`           | flow  | 「なぜこうなっているか」を疑ったとき             |
| `docs/plans/`               | flow  | 実装中の機能の承認済みプラン                     |
| `docs/log/`                 | log   | 過去に何をやって何をやり直したかを知りたいとき   |

`src/db/` と `src/content/` には専用の `CLAUDE.md` があり、そこを触るときに自動で読み込まれる。

## 絶対規則

破ると後から全画面の洗い直しが発生する、または設計思想が壊れるもの。

1. **色をハードコードしない。** すべて `theme.background` / `theme.text` / `theme.accent` の
   トークン経由。テーマ3種(ノーマル/桜/東京の夜景)を後付けするため。
2. **主キーは ULID。** autoincrement 禁止。将来の複数端末同期でID衝突を避けるため。
3. **全テーブルに `created_at` / `updated_at`。**
4. **コンテンツ(漢字・会話文・イラスト)とユーザー状態(復習履歴・進捗)をテーブルレベルで分離する。**
   前者は同梱・同期不要、後者は将来の同期対象。
5. **SRSの状態は `review_events` への追記のみ。** UPDATE / DELETE 禁止。
   現在状態は `review_events` から導出する(`kanji_progress` は再計算可能なキャッシュ)。
6. **`src/db/migrations/` を手で編集しない。** `pnpm run db:generate` で生成する。
7. **UI文言はすべて英語。** Shipaton の必須要件。日本語が出てよいのは学習コンテンツ本体だけ。
8. **ライブAI生成をしない。** 会話文・イラストは事前生成した静的アセット。
9. **サーバー/AWS/バックエンドを持たない。** 通信は RevenueCat の購入時のみ。
10. **推測クイズ「読めるかな?」の結果を SRS に入れない。** ご褒美体験であり成績ではない。
11. **「読みが変わった」演出は同じ漢字につき1回だけ。** 2回目以降はハイライトのみ。
12. **iOSのみ。** Android 固有コードは書かない。

## 作業フロー

1. **実装の前に必ずプランを立て、承認を得る。** このプロジェクトはデフォルトがプランモード。
   `ExitPlanMode` での承認なしにファイルを書き始めない。
2. 機能単位の大きい作業は `/plan-feature <機能名>` を使う。設計担当(`architect`)が
   `docs/plans/<機能名>.md` の下書きを作る。
3. **`main` で作業しない。手を動かす前に作業ブランチを切る。** 詳細は下記「ブランチ」。
4. 実装は `/implement docs/plans/<機能名>.md` から始める。
5. 実装後は `pnpm run check` が通ること。Stop フックが自動で回すので、
   失敗したらエラーを読んで直す(最大3周で打ち切り、残りは報告する)。
6. ひと段落したら `reviewer` サブエージェントでレビューする。
   コンテンツデータを触ったなら `content-auditor` も使う。
7. **レビューが通ったら `/log` で作業録を追記する。** 判断・捨てた案・詰まった点を残す。
   git に残るものは書かない(`docs/log/README.md`)。
8. **コミットメッセージと PR は英語で書く。** Git 履歴はストア公開時に外から読まれる面。
   チャットでのやりとり・`docs/`・コード中のコメントは日本語のままでよい。

## ブランチ

**`main` に直接コミットしない。** 変更は必ず作業ブランチ → PR を通す。

- **最初に `git fetch` してから `main` を最新にし、そこからブランチを切る。**
  古い `main` から切ると、既に入っている仕組み(スキル・規約)を知らずに二重作業をする
- 命名は `<種別>/<内容>` のケバブケース。種別は `feat` / `fix` / `chore` / `docs`
  (例: `feat/db-foundation`、`docs/flow-stock-log`)
- プランがある作業は、ブランチ名をプラン名に合わせる(`docs/plans/db-foundation.md`
  → `feat/db-foundation`)。後から履歴とプランを突き合わせやすくするため
- **1ブランチ1プラン。** プランのスコープ外に手を出したくなったら、
  やるかどうかを先に確認し、やるなら理由をプランの「実装後の記録」に残す
- PR は `gh pr create` で作る。本文にはプランへのリンクと、
  受け入れ条件のうち**実機で確認したもの / 未確認のもの**を書く

うっかり `main` で書き始めてしまったら、`git stash -u` → ブランチを切る →
`git stash pop` で移す。コミット前なら履歴は汚れない。

## コマンド

```
pnpm run check        # typecheck + lint + test + content検証(これが通れば完了)
pnpm run typecheck    # tsc --noEmit
pnpm run lint         # eslint
pnpm run test         # jest
pnpm run validate:content
pnpm run db:generate  # drizzle-kit でマイグレーション生成
```

`pnpm exec expo start` は起動しっぱなしになるので、動作確認は iOS シミュレータの
MCP ツール(`attach` → `build` → `launch`)を使う。

## ディレクトリ

```
src/app/          expo-router の画面。ルーティング以外のロジックを置かない
src/features/     機能単位のロジックとUI (srs, quiz, tree, reading, paywall)
src/db/           Drizzle スキーマ・クエリ・マイグレーション
src/content/      会話文・漢字マスタ(型付き静的データ)と検証ルール
src/theme/        テーマトークン定義と Context
src/components/   機能に依存しない汎用UI
src/hooks/        汎用フック
scripts/          check.sh とコンテンツ検証CLI
```

## コード規約

- TypeScript strict。`any` を使わない。外部データは型ガードで絞る。
- 関数コンポーネント + フック。クラスコンポーネントを書かない。
- ファイル名は kebab-case (`kanji-tree.tsx`)、コンポーネント名は PascalCase。
- import は `@/` エイリアス経由 (`@/features/srs/...`)。相対パスの `../../` を作らない。
- 純粋ロジック(SRSの間隔計算、推測クイズの誤答生成、樹のレイアウト選択)は
  React から切り離し、`*.test.ts` を必ず添える。**ここがテストの主戦場。**
- コメントは「なぜ」を書く。「何を」はコードで表す。
