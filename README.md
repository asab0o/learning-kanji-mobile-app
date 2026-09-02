# 漢字学習アプリ (Shipaton 2026)

日本語学習者(JLPT N5レベル)向けの iOS アプリ。**会話文の中で漢字に出会い → SRSで復習 →
学んだ漢字が別の場面に段階的に再登場する**ことで、「漢字は意味の核である」という感覚を育てる。

差別化の核は**「読みが変わった」演出**。`日(ひ)` を覚えた学習者が数日後に `日曜日(にちようび)`
に出会い、「同じ字なのに読みが違う。でも意味は同じ」と気づく瞬間を、全58文のうち8回仕込んである。

- **UIはすべて英語**(Shipaton の必須要件)。日本語が出るのは学習コンテンツ本体だけ
- **iOSのみ。** Android 対応は今回の範囲外
- **サーバーを持たない。** 通信は RevenueCat の購入処理だけで、学習データは端末の SQLite に閉じる
- **ライブAI生成をしない。** 会話文もイラストも事前生成した静的アセット

## 開発を始める

```bash
pnpm install
```

**`npm` ではなく `pnpm`。** 動作確認は下記「iOSシミュレータで動かす」。

### コマンド

```bash
pnpm run check        # typecheck + lint + test + content検証(これが通れば完了)
pnpm run typecheck    # tsc --noEmit
pnpm run lint         # eslint
pnpm run test         # jest
pnpm run validate:content   # 会話文・漢字データの不変条件
pnpm run romaji       # ローマ字の下書きを出す(手で書かない)
pnpm run db:generate  # drizzle-kit でマイグレーション生成(手で書かない)
```

### ディレクトリ

```
src/app/          expo-router の画面。ルーティング以外のロジックを置かない
src/features/     機能単位のロジックとUI (srs, reading, settings, paywall)
src/db/           Drizzle スキーマ・クエリ・マイグレーション
src/content/      会話文・漢字マスタ(型付き静的データ)と検証ルール
src/theme/        テーマトークン定義と Context
src/types/        アンビエント型定義
scripts/          check.sh とコンテンツ検証CLI
```

`src/components/`(機能に依存しない汎用UI)と `src/hooks/` は CLAUDE.md が定めた置き場だが、
**まだ1つも作っていない**。要るまで作らない。

**レイヤの依存は `app → features → {db, content}` の一方向。**
feature は `expo-router` を import しない(画面遷移は app 層が持ち、feature には
`onSelect` / `onBack` のようなコールバックで渡す)。

### ドキュメント

**`docs/` は flow(なぜ・書き換えない) / stock(現在の状態・都度更新) / log(作業録・追記のみ)
の3分類**で運用している。種別はファイル先頭かディレクトリの `README.md` に書いてあるので、
書き換える前に必ず見ること。

| ファイル | 読むべきとき |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **最初に読む。** 絶対規則と作業フロー |
| [`docs/README.md`](docs/README.md) | ドキュメントを足す/どこに書くか迷ったとき |
| [`docs/requirements.md`](docs/requirements.md) | 仕様の判断に迷ったとき。**要件の最終権威** |
| [`docs/architecture.md`](docs/architecture.md) | 画面追加・ディレクトリ配置・状態管理を決めるとき |
| [`docs/data-model.md`](docs/data-model.md) | DBスキーマ・クエリ・マイグレーションを触るとき |
| [`docs/content-decisions.md`](docs/content-decisions.md) | 会話文の方針を疑ったとき。**会話文の最終権威** |
| [`docs/decisions/`](docs/decisions/) | 「なぜこうなっているか」を疑ったとき |
| [`docs/log/`](docs/log/) | 過去に何をやって何をやり直したかを知りたいとき |

---

## iOSシミュレータで動かす

**Android は対象外**(絶対規則12)。実機ではなくシミュレータで確認する。

### 1. Metro を起動する(初回だけ)

Debug ビルドは JS をここから取るので、**先に動いていないとアプリが白いまま**になる。

```bash
pnpm exec expo start --port 8081
```

**起動しっぱなしになるので別ターミナルで開く。** 既に動いているかは次で分かる。

```bash
curl -s http://localhost:8081/status
```

`packager-status:running` が返れば起動済み。立て直す必要はない。

### 2. ビルドしてシミュレータに入れる

**Claude に頼む場合**は MCP のシミュレータツールを `attach` → `build` → `launch` の順で使う。
`attach` を最初に呼ぶのは、ライブパネルを先に開いて**開発者が画面を見られる状態にしてから**
ビルドを始めるため。手順の詳細と、落ちたときの復旧は `CLAUDE.md`「コマンド」節。

**自分で動かす場合**は次の1行でよい(Metro の起動も込み)。

```bash
pnpm run ios
```

### 3. 任意の会話文・漢字を開く

入口画面は**1日3字**しか出さない(ADR-0003)ので、確認したい回に上から辿り着けないことがある。
直接開く手段が2つある。

- **開発用の会話文一覧**: `learningkanjimobileapp://conversations`(`__DEV__` ビルドのみ)
- **ディープリンク**: `learningkanjimobileapp://conversation/<会話文のULID>` /
  `learningkanjimobileapp://kanji/<漢字のULID>`。ULID は `src/content/index.ts` の `S` / `K` マップ

入口画面の `Ignore daily limit` トグル(開発ビルドのみ)を ON にすると、未完了の回が全件並ぶ。

### 4. 止める

止め忘れて困るのは Metro と `disclaimer` の2つだけ。シミュレータ自体は開いたままでよい。

```bash
lsof -ti :8081 | xargs kill          # Metro を止める(ターミナルにいるなら Ctrl+C)
xcrun simctl terminate booted com.asakiita.learningkanji   # アプリだけ終了
xcrun simctl shutdown booted         # シミュレータごと落とす
```

ライブパネルだけ閉じたいときは MCP ツールの `detach`。シミュレータもアプリも動き続ける。

**`attach` / `launch` が `disclaimer exited with code 143` で落ちたら、前のセッションの
残骸が残っている。**

```bash
ps aux | grep "Helpers/disclaimer" | grep -v grep
```

`log stream` を含む行があれば kill する。**MCP ツールの故障ではないので `simctl` 直叩きに
逃げないこと**(逃げるとライブパネルに何も映らず、開発者が画面を見られない)。
経緯は `docs/log/2026-08.md` の 08-30。

### 第2段階の演出を確認するとき

「読みが変わった」演出をする8回(#17 / #30 / #38 / #41 / #45 / #48 / #51 / #55)は、
**演出語が吹き出しの折り返し2行目に落ちていないか**を必ず実機で見る。
★はふりがなの上に絶対配置で出るため、2行目に来ると直上の行に重なる。
**これだけは機械で検証できない**(`docs/content-spec.md`「演出行の書き方」5)。

演出は同じ漢字につき1回しか出ない(絶対規則11)。もう一度見たいときはアプリを削除して
入れ直す(`xcrun simctl uninstall booted com.asakiita.learningkanji`)。

---

## 技術スタック

Expo 57 (React Native / expo-router) / TypeScript strict / Drizzle ORM + expo-sqlite /
react-native-purchases (RevenueCat) / Jest。

**Expo のドキュメントはバージョン固定のものを読むこと** — <https://docs.expo.dev/versions/v57.0.0/>
