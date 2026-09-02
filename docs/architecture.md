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
| `features/settings/` | ユーザー設定(ローマ字ON/OFF)の配布。真実は `user_settings`(SQLite) | 5.2 |

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

色トークンは `background` / `surface` / `surfaceAlt` / `surfaceVeil` / `text` / `textMuted` /
`accent` / `onAccent` / `border` / `kunBranch` / `onBranch`。
**色はフラットに置く**(`theme.color.background` のようにネストしない)。

色以外は `radius`(bubble / card / pill)、`type`(mincho / minchoBold / jaSize / jaLineHeight)、
`shadow`(bubble)、`backdrop`(全画面に敷く背景装飾。未用意なら null)にまとめる。
定義は `src/theme/tokens.ts`。

全テーマが同じキーを全部持つ。片方のテーマにしかないキーを作らない。
`themes` は `Record<ThemeId, Theme>` なので、IDを増やすと定義漏れが型エラーになる。
`src/theme/themes.test.ts` が実行時にもキー集合の一致を見ている。

`kunBranch`(訓読み=緑系)と `onBranch`(音読み=青系)をトークンに含めているのは、
漢字の樹の色分けが差別化ポイントに直結するため、テーマを変えても意味が壊れないようにするため。

現在定義済みのテーマは **`sakura` のみ**。要件定義書 5.3 が想定する残り2種
(ノーマル / 東京の夜景)はデザイン未確定のため `ThemeId` にも入れていない(ADR-0004)。

`ThemeProvider` は選択状態を持たず、表示するテーマを props で受ける。
テーマの選択は `user_settings`(SQLite)が持ち、それを読んだ側が渡す。

## ナビゲーション

expo-router のファイルベース。`src/app/` にはルーティングと画面の組み立てだけを置き、
ロジックは feature に置く。画面ファイルが 150 行を超えたら feature 側に切り出す合図。

**feature は `expo-router` を import しない。** 画面遷移は app 層が持ち、feature には
`onSelect` / `onBack` のようなコールバックで渡す。feature をルーティングから切り離しておくと、
画面構成が変わっても feature を書き換えずに済む。

現在のルート:

```
src/app/_layout.tsx             Stack。テーマの地・背景装飾・DB・設定 Provider を敷く
src/app/index.tsx               今日の学習(1日3字)。入口
src/app/conversation/[id].tsx   会話文1本
src/app/kanji/[id].tsx          漢字フォーカス。`?lesson=<文ID>` 付きのときだけ完了 CTA が出る
src/app/conversations.tsx       開発専用。会話文の全一覧(上限を跨いで任意の回を開く)
src/app/paywall-debug.tsx       開発専用。paywall UI の実装時に削除する
```

**開発専用の画面は本番の導線から辿れない。** `learningkanjimobileapp://conversations` の
ように直接開く。`__DEV__` 以外では中身を描かない。

**固定ヘッダーは無い。** `Stack` は `headerShown: false`(`_layout.tsx`)で、ネイティブヘッダーを
出すと背景装飾の上に不透明な帯が乗るため。各画面は `Back` や `Romaji` トグルを
`ScrollView` の**中**に並べていて、スクロールすると本文と一緒に流れる。

> **検討中(2026-08-30)**: 会話文画面に**固定ヘッダーを置きたい**。
> いまは下までスクロールするとトグルにも `Back` にも手が届かなくなる。
> 背景装飾を透かす必要があるのでネイティブヘッダーは使えず、
> `ScrollView` の外に自前の View を重ねる形になる。
>
> **これは「ローマ字を出すと下の吹き出しがずれる」問題の解決策ではない。**
> あれは行が1行増えるぶん下が押し下がるだけで、避けるには OFF のときも高さを
> 確保するしかなく、そちらは全画面・常時の空白を生むので採らないと決めた。
> `ScrollView` に `maintainVisibleContentPosition` を入れる案も試したが、
> トグルが常に最上部にある(=スクロール位置0で押す)ため**何も起きず**、捨てた。
> 固定ヘッダーを入れて初めてこの設定に意味が出る。

## オフライン前提

通信するのは RevenueCat の購入処理だけ。それ以外のコードで `fetch` を書いたら設計違反。
コンテンツはアプリに同梱し、初回起動時に SQLite へ流し込む(シード)。

## アセット

- 漢字イラスト: 背景透過PNG、テーマ非依存、`assets/kanji/<illustrationKey>.png`。
  `illustrationKey` は意味の英語スラッグ(`person` / `big` / `day` …)で、`KanjiEntry` が持つ。
  漢字そのものをファイル名にしない: 日本語ファイル名を避けるため。訓読みのローマ字も使わない:
  `日`(ひ) と `火`(ひ) が衝突し、`大`(おお → ō)が非ASCIIになるため
- キャラアイコン: `assets/characters/{mia,grandma,sora}.png`
- テーマ背景装飾: `assets/themes/<theme>/*.png`(合計3〜6枚まで)。
  ルートレイアウトで1度だけ敷き、各画面の背景は透明にする(要件5.3「全画面で使い回す」)

アセットの追加は要件定義書 5.3 / 5.4 の枚数上限を超えないこと。超えると制作が破綻する。
