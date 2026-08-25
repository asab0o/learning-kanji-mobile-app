> 種別: **stock** — 現在のレイヤ構成。変えたら上書きし、理由は `decisions/` に残す

# アーキテクチャ

`docs/requirements.md` の要件を、どうコードに落とすかを決めたもの。
新しい画面や機能を足すときは、まずここの配置ルールに従う。

## レイヤ構成

```
src/app/          expo-router の画面ファイル
   ↓ 呼ぶ
src/features/     機能ごとのUI + ロジック(このアプリの本体)
   ↓ 呼ぶ
src/db/           Drizzle のクエリ層
src/content/      静的コンテンツ(会話文・漢字マスタ)
```

**逆方向の依存を作らない。** `src/features/` が `src/app/` を import したら設計が壊れている。

## features の切り方

要件定義書の学習ループ(4.1)にそのまま対応させる。

| ディレクトリ | 担当 | 要件定義書 |
|---|---|---|
| `features/reading/` | 会話文の表示、ふりがな/ローマ字、漢字ハイライト、読み変化の演出 | 4.1-1〜3, 4.6, 5.2 |
| `features/srs/` | 間隔反復のステージ計算、今日の出題キュー、1日の学習量上限 | 4.1-4, 5.1-4, 5.1-8 |
| `features/quiz/` | 推測クイズ「読めるかな?」。出題対象の選定、誤答選択肢の生成、種明かし | 4.4 |
| `features/tree/` | 漢字の樹の SVG 描画、レイアウトパターン選択、一覧グリッド | 4.5 |
| `features/paywall/` | RevenueCat、購入の復元、章のロック判定 | 7章 |
| `features/onboarding/` | 初回3画面 | 5.1-10 |

各 feature の中は自由だが、以下だけ守る。

```
features/srs/
├── index.ts          公開API。他 feature はここ経由でのみ触る
├── scheduler.ts      純粋ロジック(Reactに依存しない)
├── scheduler.test.ts
└── components/       この feature 専用のUI
```

**純粋ロジックを `*.ts` に分離し、必ずテストを書く。** テストの主戦場は以下4つ。

1. `srs/scheduler.ts` — ステージ遷移と次回出題日の計算
2. `quiz/distractors.ts` — 誤答選択肢の生成(「片方の漢字だけ合っている」を作れているか)
3. `tree/layout.ts` — 単語数からレイアウトパターンを選ぶ
4. `content/validate.ts` — コンテンツデータの不変条件

UI コンポーネントのテストは、上記が固まってから必要な分だけ書く。

## 状態管理

MVP の規模では専用ライブラリを入れない。

- **永続データ**: SQLite(Drizzle)が唯一の真実。画面は都度クエリする
- **テーマ**: React Context (`src/theme/`)
- **設定(ローマ字ON/OFF等)**: SQLite の `user_settings` テーブル + Context
- **画面ローカルの状態**: `useState` / `useReducer`

Redux / Zustand / Jotai を足したくなったら、その前に「SQLite から読み直せば済むのでは」を検討する。

## テーマの扱い

要件定義書 5.3 の通り、色は**必ずトークン経由**。

```ts
// ✗ やってはいけない
<View style={{ backgroundColor: '#FDF6F0' }} />

// ✓
const theme = useTheme();
<View style={{ backgroundColor: theme.background }} />
```

トークン名は `background` / `surface` / `text` / `textMuted` / `accent` / `kunBranch` / `onBranch` /
`border` を基本セットとし、テーマ3種(normal / sakura / tokyoNight)が同じキーを全部持つ。
片方のテーマにしかないキーを作らない(型で縛る)。

`kunBranch`(訓読み=緑系)と `onBranch`(音読み=青系)をトークンに含めているのは、
漢字の樹の色分けが差別化ポイントに直結するため、テーマを変えても意味が壊れないようにするため。

## ナビゲーション

expo-router のファイルベース。`src/app/` にはルーティングと画面の組み立てだけを置き、
ロジックは feature に置く。画面ファイルが 150 行を超えたら feature 側に切り出す合図。

## オフライン前提

通信するのは RevenueCat の購入処理だけ。それ以外のコードで `fetch` を書いたら設計違反。
コンテンツはアプリに同梱し、初回起動時に SQLite へ流し込む(シード)。

## アセット

- 漢字イラスト: 背景透過PNG、テーマ非依存、`assets/kanji/<漢字>.png`
- キャラアイコン: `assets/characters/{mia,grandma,sora}.png`
- テーマ背景装飾: `assets/themes/<theme>/*.png`(合計3〜6枚まで)

アセットの追加は要件定義書 5.3 / 5.4 の枚数上限を超えないこと。超えると制作が破綻する。
