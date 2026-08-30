# プラン: 会話文表示画面

作成日: 2026-08-30
ステータス: 完了
要件定義書の対応箇所: 4.1(学習ループ 1〜2)、4.2(会話文の設計方針)、5.1-2(例文表示画面)、5.2(表記・表示の仕様)、4.6(ステップ1のハイライトのみ)

## 目的

第1章の実データ(漢字10字 / 会話文10文31行)を **DB から引いて画面に描く**。
`toFuriganaSegments()` を初めて実データに当て、ふりがな・ローマ字・全角記号が
実機でどう見えるかを 10 文で確定させる。残り48文を書く前に形式の欠陥を潰すことが本題。

同時に、その場つなぎの `theme-preview.tsx` と開発専用の `db-debug.tsx` を退役させる。

## 先に確認したい点(要件・データとの食い違い)

実装案の前に、要件定義書・既存データと噛み合っていない点が5つある。本プランは下記の方針を採るが、
違う判断をしたいなら承認前に指摘してほしい。**要件を勝手に解釈で変えてはいない。**

1. **シーン名を画面に出せない。**
   `theme-preview.tsx` のヘッダーは `Conversation 32 · On the road` と書いているが、
   この英語シーン名はデータのどこにも無い。`Sentence.scene` は `'玄関'` `'縁側'` のような
   日本語で、`src/content/types.ts` に「**内部メタデータで画面には出さない**」と明記されている
   (出すなら絶対規則7に合わせて英語化が要る)。章名(`家の中`)も同様に日本語しか無い。
   → **ヘッダーはシーン名を出さない**。`Conversation 1` と新出漢字だけにする。
   英語のシーン名/章名が欲しいなら `Sentence` と章マスタに英語列を足すコンテンツ側の作業になるので、
   本プランには入れない(スコープ外に記載)。

2. **要件5.2「ふりがなとローマ字の2段表示は画面が詰まるため、常時併記はしない」の解釈。**
   これを「ローマ字ON時もふりがなと同時に出さない」と読むと機能が消えるが、同じ節が
   「ONの場合、**日本語の全文に対して**小さく添える」と定めている。禁じているのは
   **1語の上下にふりがなとローマ字を両方積むルビ二段**であり、行単位で1行添えるのは要件どおり。
   → 吹き出しの下に「ローマ字(1行) → 英訳(1行)」を置く。ふりがなは従来どおり本文の上。

3. **要件4.6 ステップ1 の「小さくバッジ(★)」を今回は出さない。**
   バッジは「タップすると種明かしカードが出る」合図であり、カード(ステップ2)を作らない今回に
   バッジだけ出すと、押せないものを押させることになる。
   → **ハイライト(accent + 太字 + 下線)のみ**。バッジは第2段階の演出プランで、カードと同時に入れる。
   要件を削るのではなく実装順を後ろにするだけ。

4. **一覧に「1日3字上限」(要件5.1-8)が効かない。**
   SRS が未実装なので「今日の3字」を計算できない。
   → 今回の一覧は **第1章10文を全部並べる暫定画面**。SRS 実装時に「今日の学習」画面へ置き換わる前提。
   併せて、第2章以降のデータが入ったら課金判定が無いまま有料分まで一覧に出る。
   **章ロックは paywall のプランの担当**であることを申し送りに残す。

5. **#1 は新出字「人」が同じ回に2読み(何人=にん / どんな人=ひと)で出る第1章唯一の回**
   (`docs/log/2026-08.md` の未回収の借り)。
   → **新出漢字の全出現をハイライトする**(下記「どの出現をハイライトするか」)。
   これは演出カードを出す行為ではないので絶対規則11には触れない。

### どの出現をハイライトするか

`toFuriganaSegments(segments, focusChars)` に渡すのは **`newKanjiId` が指す漢字1字だけ**とし、
その字を含むセグメントは**すべて**光らせる(関数の既定の挙動そのまま。新しいロジックを足さない)。

検討して捨てた案:

| 案 | 捨てた理由 |
|---|---|
| 最初の1回だけ光らせる | 同じ行に光る `人` と光らない `人` が並ぶ。学習者には「別の字」に見える |
| 導入読み(訓)に一致する出現だけ光らせる | セグメントの `reading` は語単位なので `{text:'今日',reading:'きょう'}` のような熟字訓では読みを字に割り当てられず、判定が破綻する |

**#1 で起きること(受け入れる):** `何人`(にん)/`三人`(にん)/`人`(ひと)の3箇所が光り、
それぞれの上に正しい別々の読みが乗る。これは「同じ字なのに読みが違う」という第2段階の
前振りとしてむしろ望ましく、演出カードは出さないので規則11に反しない。

**#4 で起きること(既知・受け入れ済み):** 新出字は `日` だが、データは熟字訓のため
`{text:'今日', reading:'きょう'}` の1セグメントで、**`今日` が丸ごと光る**。
`checkLineSegments` の warning を潰さずに受け入れた既存の判断(`docs/log/2026-08.md`)に従う。
実機確認の項目に入れて、見た目が許容できるかを目で決める。

`newKanjiId` が `null` の回(第2段階専用の特別回。第1章には無い)は `focusChars` を空にして
ハイライト無しで描く。第2段階のハイライトはこの関数の引数を差し替えるだけで入る。

## スコープ外

**今回やらないこと。迷ったら小さい方に倒し、以下は明示的に次回以降へ送る。**

- **漢字フォーカス画面(要件4.1-3 / 5.1-3)。** `assets/kanji/*.png` が**1枚も存在しない**ため、
  作っても点線の空枠しか置けない。イラストが1枚も無い状態で「意味＋象徴イラスト」の画面を作ると、
  枠のサイズ・余白・見出しの寸法を絵の無い状態で決めることになり、絵が入った時点でやり直しになる。
  → **イラスト生成の後に、独立したプランで作る。**
  今回は会話文の中で新出漢字がハイライトされるところまで(学習ループ 1〜2)。
  ヘッダーに `人 · person`(字と英語の意味)を出すが、これはハイライトの答え合わせのための
  ラベルであって、フォーカス画面の代用ではない
- **SRS。** `review_events` に一切書かない。「Next」「復習する」等の CTA も置かない。
  押しても何も起きないボタンを置くくらいなら置かない
- **第2段階の演出(要件4.6 ステップ2・3)。** 種明かしカード、★バッジ、樹への反映アニメーション、
  `hasRevealShown` / `markRevealShown` の呼び出し。今回はクエリ関数に触れない
- **推測クイズ・漢字の樹・オンボーディング・課金導線**
- **章のロック判定。** `isFree` は読まない。一覧は全文を出す
- **設定画面(`src/app/settings.tsx`)。** ローマ字トグルは会話文画面のヘッダーに置く
  (下記「ローマ字のON/OFF」)。テーマ選択UIは ADR-0006 により MVP では作らない
- **`user_settings.themeId` を `ThemeProvider` に渡す配線。** テーマは桜1種なので既定値のままでよい
- **英語のシーン名 / 章タイトルのデータ追加**(上記「先に確認したい点」1)
- **音声読み上げ・タップで単語の意味を出すポップアップ・スワイプでの文送り**
- **`src/app/paywall-debug.tsx` の削除。** paywall UI を作る回で消す約束(`paywall-sdk-init.md`)
- **`src/db/queries/` への関数追加とスキーマ変更。** 既存クエリで足りる(下記)
- **UIコンポーネントの自動テスト。** `docs/architecture.md` の方針どおり純粋ロジックを優先し、
  描画は実機確認で見る

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/reading/conversation-view.tsx` | 新規 | 1文の会話表示。ヘッダー(戻る / `Conversation N` / 新出漢字 / ローマ字トグル)＋発話の並び。吹き出し・アバター・英訳のスタイルは `theme-preview.tsx` から**寸法をそのまま移植**する(実機で合わせた値を作り直さない) |
| `src/features/reading/conversation-list.tsx` | 新規 | 会話文の一覧。行は `1` / `人` / `person` |
| `src/features/reading/focus.ts` | 新規 | 純粋関数 `focusCharactersFor(sentence, kanji)`。`newKanjiId` → 漢字1字の配列 |
| `src/features/reading/focus.test.ts` | 新規 | 上記のユニットテスト |
| `src/features/reading/index.ts` | 変更 | `ConversationView` / `ConversationList` を公開。`ThemePreview` の export を削除 |
| `src/features/reading/theme-preview.tsx` | **削除** | 役目を終えた仮画面(ファイル冒頭に「本物の会話画面の実装で捨てる」と明記されている) |
| `src/features/reading/segments.test.ts` | 変更 | テスト名とコメントの `theme-preview` 参照を、原稿 #32 基準の表現に直す(参照先ファイルが消えるため) |
| `src/features/settings/settings-context.tsx` | 新規 | `SettingsProvider` / `useRomajiEnabled()` / `useSetRomajiEnabled()`。真実は SQLite、Context は配布のみ |
| `src/features/settings/romaji-toggle.tsx` | 新規 | `Romaji` ラベル + RN の `Switch`。色はトークン経由 |
| `src/features/settings/index.ts` | 新規 | 公開API |
| `src/app/index.tsx` | 変更 | `ThemePreview` → `ConversationList`。`listSentences()` / `listKanji()` を引いて渡し、行タップで `router.push` |
| `src/app/conversation/[id].tsx` | 新規 | `useLocalSearchParams` の id で `getSentence()` / `getKanji()` を引き、`ConversationView` に渡す。戻るも app 層が持つ |
| `src/app/_layout.tsx` | 変更 | DB が `ready` の内側に `SettingsProvider` を挿す(未マイグレーションの表を読ませないため) |
| `src/app/db-debug.tsx` | **削除** | 退役条件「会話文画面を実装する回で削除」(`docs/plans/db-foundation.md`)を満たした |
| `docs/architecture.md` | 変更 | features の表に `features/settings/` を1行追加。「ナビゲーション」節に現在のルート一覧を追記 |

**変更しないもの(実装時にそうなっていることを確認する):**
`src/db/**`(スキーマ・マイグレーション・クエリ・マッパー)、`src/content/**`、
`src/theme/**`、`src/features/reading/furigana.tsx`、`furigana-metrics.ts`、
`segments.ts`、`character-avatar.tsx`、`src/app/paywall-debug.tsx`。

`src/db/queries/diagnostics.ts` は **db-debug が消えても残す**。`getTableCounts()` は
「再シードでユーザー状態が消えていないか」を確かめる唯一の手段で、SRS がイベントを
書き始める回にまた要る。66行・バンドルへの影響はごく小さい。
消す案も検討したが、消して再び足すと `src/db/index.ts` の公開APIが往復するだけなので採らない。

## データモデルの変更

**なし。** スキーマ変更もマイグレーション生成も行わない(`pnpm run db:generate` を実行しない)。

既存のクエリで足りることを確認済み:

| 必要なもの | 既存の関数 |
|---|---|
| 一覧の全文 | `listSentences()`(`toSentence` が `lineIndex` で行を整列する) |
| 1文と全行 | `getSentence(id)` |
| 新出漢字の字と意味 | `getKanji(id)` / 一覧用に `listKanji()` |
| ローマ字ON/OFF | `getUserSettings()` / `updateUserSettings({ romajiEnabled })` |

`user_settings.romaji_enabled` は既に存在し、既定値は `false`(要件5.2 のデフォルトOFF)。

## ローマ字のON/OFF(要件5.2)

**置き場はある。今回は「設定画面」は作らず、会話文画面のヘッダーにトグルを1つ置く。**

理由:

- **実機でマクロン(`ō` `ā` `ē`)を確認するには、ONにする手段が要る。** 既定はOFFなので、
  トグルが無いと今回の目的の1つが達成できない。`__DEV__` で決め打ちにすると要件が検証されない
- 設定画面は「購入の復元」(要件7章)と同居させるのが自然で、paywall の回に作るのが順当。
  行が1つしかない画面を先に作る意味が薄い
- 読みながら切り替えられるほうが学習者にとっても素直

**状態の持ち方**は `docs/architecture.md`「設定(ローマ字ON/OFF等): SQLite の `user_settings`
テーブル + Context」に従う。トグルはヘッダー、値を読むのは吹き出しの下(発話ごと)なので、
Context にしないとローカル状態を持ち上げて2階層のプロップ配りになる。

- 置き場は `src/features/settings/`。`src/settings/` にしないのは、CLAUDE.md の
  ディレクトリ一覧にその名前が無いため(features は「機能単位のロジックとUI」で条件を満たす)
- `SettingsProvider` は初期値を `useState(() => getUserSettings())` の**遅延初期化**で1回だけ読む。
  描画中に直接クエリを呼ぶと React Compiler(`app.json` の `reactCompiler: true`)がメモ化し、
  更新しても表示が古いままになる(db-debug で実際に踏んだ)
- 書き込みは `updateUserSettings({ romajiEnabled })` → 成功したら state を更新
- `SettingsProvider` は `database.status === 'ready'` の内側に置く。
  `getUserSettings()` は行が無ければ INSERT するので、マイグレーション前に呼ぶと落ちる

`themeId` は Context に載せない(桜1種。ADR-0006)。

## ナビゲーション

expo-router のファイルベース。ルートは2つだけにする。

```
src/app/_layout.tsx            Stack(headerShown: false のまま)
src/app/index.tsx              会話文の一覧(暫定。将来「今日の学習」に置き換わる)
src/app/conversation/[id].tsx  1文の会話画面
```

- 一覧 → 詳細の2画面にする(1文ずつのページャにしない)。**10文のどれにでも直接飛べるほうが
  実機での形式検証が速い**のと、SRS が入ったとき一覧の位置がそのまま「今日の学習」になるため
- 遷移は型付きルートの形で書く: `router.push({ pathname: '/conversation/[id]', params: { id } })`
  (`app.json` の `experiments.typedRoutes: true`)
- **ナビゲーションは app 層が持ち、feature にはコールバックで渡す。**
  `ConversationList` は `onSelect(sentenceId)`、`ConversationView` は `onBack()` を受け取る。
  feature が `expo-router` を直接叩かないので、`docs/architecture.md` の
  「`src/app/` にはルーティングと画面の組み立てだけ」という切り分けが保てる
- 戻る導線は画面内の `Back` テキストボタン(英語)。`Stack` の `headerShown: false` は変えない
  (ネイティブヘッダーを出すと背景装飾の上に不透明な帯が乗る)
- `id` が不正/該当なしのときは英語で `Conversation not found.` と `Back` を出す
  (`useLocalSearchParams` は `string | string[]` を返すので型で絞る)

## 実装ステップ

1. `src/features/settings/` を作る(`settings-context.tsx` / `romaji-toggle.tsx` / `index.ts`)。
   `Switch` の色は `trackColor={{ true: theme.accent, false: theme.border }}` のようにトークン経由
2. `src/app/_layout.tsx` の `ready` 分岐の内側に `SettingsProvider` を挿す
3. `src/features/reading/focus.ts` に `focusCharactersFor()` を書き、`focus.test.ts` を添える
4. `src/features/reading/conversation-view.tsx` を書く。
   **`theme-preview.tsx` の `Bubble` / `styles`(`maxWidth: 236` / `AVATAR_SIZE: 30` /
   `AVATAR_GAP: 10` / 英訳のインデント)を数値ごと移植する。** 実機で合わせた値なので作り直さない。
   その上に (a) ヘッダー、(b) ローマ字行(`romajiEnabled` のときだけ)を足す。
   **ローマ字と英訳に `theme.type.mincho` を指定しない**(明朝は日本語本文用。ラテン文字は
   システム既定に任せる。マクロンの字形もそのほうが素直)
5. `src/features/reading/conversation-list.tsx` を書く。データが空なら `No conversations yet.`
6. `src/app/index.tsx` を差し替え、`src/app/conversation/[id].tsx` を足す
7. `src/features/reading/theme-preview.tsx` と `src/app/db-debug.tsx` を削除し、
   `src/features/reading/index.ts` の export を差し替える。`segments.test.ts` の
   theme-preview 参照を書き直す
8. `docs/architecture.md` を更新(features の表 + ルート一覧)
9. `pnpm run check` を通す
10. iOS シミュレータで確認(`attach` → `build` → `launch`)。下の実機チェックを全部見る
11. レビュー後に `/log` で作業録を残す(db-debug 退役、未回収の借りの消し込み)

## 受け入れ条件

### コード上で確認できること

- [ ] `src/features/reading/theme-preview.tsx` と `src/app/db-debug.tsx` が存在せず、
      `rg "ThemePreview|db-debug" src` が0件
- [ ] `rg "#[0-9a-fA-F]{3,8}" src/app src/features/reading src/features/settings` が0件
      (絶対規則1。色は全てトークン経由)
- [ ] `rg "expo-router" src/features` が0件(ナビゲーションは app 層だけが触る)
- [ ] `rg "scene" src/features/reading src/app` が0件(日本語のシーン名を画面に出さない)
- [ ] `git diff --stat src/db src/content` が空(スキーマ・クエリ・コンテンツを変更していない)
- [ ] `src/db/migrations/` に新しいファイルが増えていない
- [ ] `rg "insertReviewEvent|markRevealShown|quizAttempts" src/features src/app` が0件
      (絶対規則5・10・11。今回はユーザー状態を書かない)
- [ ] `src/app/index.tsx` と `src/app/conversation/[id].tsx` がいずれも150行未満
      (`docs/architecture.md` の「画面ファイルが150行を超えたら feature へ」)

### テストで担保すること

- [ ] `focusCharactersFor()` に `newKanjiId` が `人` の会話文と漢字一覧を渡すと `['人']` を返す
- [ ] `newKanjiId: null` の会話文(第2段階専用の回)を渡すと `[]` を返す
- [ ] `newKanjiId` が漢字一覧に無いIDを指すとき、例外を投げずに `[]` を返す
- [ ] 既存の `src/features/reading/segments.test.ts` が全て通る(名前の書き換えのみで挙動は不変)
- [ ] `pnpm run check`(typecheck / lint / test / content検証)が通る

### 実機(iOSシミュレータ)で確認すること

**PR #10 の積み残し3点(最優先)**

- [ ] **折り返し**: #7 のおばあちゃんの行(`机の下は見たかい？下によく落ちてるんだよ。` = 10セグメント)が
      吹き出しの中で複数行に折り返り、**どのセグメントも吹き出しの右端からはみ出さない**。
      折り返した2行目のふりがなが1行目の本文と重ならない。
      同様に #1 の3行目(`がいるから、あなたで` = 10文字のかなセグメント)と
      #10 の3行目(`が、あたたかいです。`)を見る
- [ ] **マクロン**: ローマ字ONで、以下がすべて豆腐(□)にならず、マクロンが行の上端で切れずに出る。
      **小文字と大文字の両方**を見る:
      `nē`(#1-1) / **`Ā, Sora wa neko da yo.`(#1-5、大文字 Ā)** /
      **`Ōkii nimotsu`(#2-2、大文字 Ō)** / `ōkikute`(#2-1) / `Kyō`(#4-1) /
      `Sō da nē. Kō iu hi wa, futon o hosō ka ne.`(#4-2、1行に3つ) /
      `Obāchan`(#5・#6) / `Wā`(#9-1) / `darō`(#9-2) / `mō`(#10-2)
- [ ] **行末の全角 `？`**: `ですか？`(#1-2 / #1-4)、`れたかい？`(#10-2)、
      `……おかえりは？`(#10-5)で、**`？` だけが次の行に落ちない**・吹き出しの右端からはみ出さない・
      `？` の後に不自然な空きが出ない。行中に来る `たかい？`(#7-2)も同じ観点で見る

**ハイライト**

- [ ] #1 を開くと `人` が**3箇所**光り、それぞれの上のふりがなが `にん` / `にん` / `ひと` と
      別々に出ている(演出カードやバッジは出ない)
- [ ] #4 では `今日` が**丸ごと**光る(熟字訓のため。見た目が許容できるかを目で判断し、
      許容できなければ実装ではなく `docs/content-spec.md` 側の課題として記録する)
- [ ] #7 では `下` が2箇所とも光り、同じ行の `見`(未習・別の字)は光らない

**画面と導線**

- [ ] アプリを起動すると会話文の一覧が出て、**10件**並ぶ。各行に通し番号・新出漢字・英語の意味が出る
- [ ] 一覧にも会話画面にも**日本語のシーン名(`玄関` `縁側` など)が一切出ない**。
      UI文言はすべて英語(学習コンテンツ本体の日本語だけが日本語)
- [ ] 行をタップすると該当の会話文が開き、`Back` で一覧に戻る。端からのスワイプでも戻れる
- [ ] #1 は5つの発話が出て、ミアが右・おばあちゃんが左に並び、アバターが吹き出しの下端に揃う
- [ ] #10 に猫(空)の吹き出しが出て、アバターが猫の顔になっている
- [ ] 各発話の下に英訳が出る。ローマ字OFFのときはローマ字の行が**出ない**

**ローマ字の設定**

- [ ] ヘッダーの `Romaji` をONにすると、その場で全発話にローマ字が1行ずつ出る
- [ ] OFFに戻すとローマ字だけが消え、ふりがなと英訳は残る
- [ ] **ONのままアプリを終了して再起動してもONのまま**(`user_settings` に永続している)
- [ ] ふりがな・ローマ字・英訳が同時に出ても吹き出しが破綻しない(要件5.2 の「画面が詰まる」懸念の実測)

**回帰**

- [ ] 一度アプリを削除してから入れ直しても、マイグレーションとシードが通って一覧が10件出る
- [ ] コンソールにエラーが0件(RevenueCat の Test Store 警告と Reanimated の既知ノイズを除く)

## テスト方針

**ユニットテストを書くのは `src/features/reading/focus.ts` の1本だけ。**
ここが「どの字を光らせるか」という差別化に直結する分岐で、第2段階の演出が後から差し込まれる場所。
入出力が純粋(会話文 + 漢字一覧 → 文字の配列)なので React にも DB にも触れずに書ける。

既に `toFuriganaSegments()`(focus の付与)と `furiganaMetrics()`(行の高さ)には
テストがあるので、今回はその上に薄い1段を足すだけになる。

**UIコンポーネントのテストは書かない。** `docs/architecture.md` の
「UI コンポーネントのテストは、上記(純粋ロジック)が固まってから必要な分だけ書く」に従う。
今回いちばん壊れやすいのは折り返し・字形・行の高さで、これらは RTL では検出できず
実機で見るしかない。**Jest を通ることと、実機で正しく見えることの差がまさに PR #10 の教訓**なので、
自動テストを増やすより実機チェックリストを厚くする方に配分する。

`src/features/settings/` にもテストを書かない。中身は `getUserSettings` /
`updateUserSettings`(既にテスト済みの層)への素通しで、独自の判断を持たないため。
永続の確認は実機の「再起動してもONのまま」で行う。

## リスク・未確定事項

- **折り返した2行目の行間が詰まる可能性がある。** `FuriganaText` は
  `flexWrap: 'wrap'` + `alignItems: 'flex-end'` で並べているだけで、**折り返しが起きた状態を
  実機で一度も見ていない**(theme-preview の2文はどちらも1行に収まっていた)。
  2行目のふりがなが1行目の本文に接触するようなら `styles.row` に `rowGap` を足して調整する。
  これは寸法値なので色トークンの規則には触れない。**本プランで最初に見るべきはここ**
- **大文字マクロン(`Ā` `Ō`)がシステムフォントで欠ける可能性。** 欠けた場合でも
  **コンテンツ側の表記を変えない**(ローマ字の表記規則は `docs/content-spec.md` が権威で、
  修正ヘボン式を崩すと58文の一貫性が壊れる)。描画側でフォント指定を見直す
- **`今日` が丸ごと光る件は、実機で見て初めて可否を判断できる。** 許容できないと判断した場合、
  対処は (a) 熟字訓セグメントは新出字を含んでいても光らせない、(b) 原稿を書き換える、の2択になるが、
  どちらもコンテンツ仕様の変更なので**本プランでは決めず、判断だけ記録して次に送る**
- **一覧が第2章以降の有料分まで出す。** 課金判定が未実装のため。第2章のデータが入る前か、
  遅くとも paywall のプランで `isFree` によるロックを入れる必要がある。**申し送り事項**
- **一覧画面は「1日3字上限」を反映しない暫定物。** SRS 実装時に「今日の学習」へ置き換わる前提で、
  作り込まない(行の見た目は最小限)
- **`theme-preview.tsx` を消すと、漢字フォーカスカードのモック(イラスト枠・意味・語の並び・
  ピル形CTA)が画面から消える。** デザインの正は ADR-0004 とデザイン案『春泥棒』に残っており、
  寸法もこのプランの git 履歴から辿れるので失われはしない。フォーカス画面のプランで作り直す
- **`theme.kunBranch` / `onBranch` / `radius.pill` を使う画面が一時的に0になる。**
  トークン層は ADR-0006 の方針どおり残す(樹とCTAが来たときに使う)
- **React Compiler のメモ化。** 描画中に DB クエリを直接呼ぶとメモ化されて更新が反映されない。
  DB 読み出しは `useState` の遅延初期化に閉じ込める(db-debug で踏んだ罠)
- **`SettingsProvider` の位置を間違えると起動時に落ちる。** `getUserSettings()` は
  行が無ければ INSERT するので、必ず `database.status === 'ready'` の内側に置く
- **`docs/plans/db-foundation.md` と `docs/plans/line-segments.md` は完了済み(凍結)なので書き換えない。**
  db-debug 退役の事実は `/log` に残す

### 絶対規則の自己点検

| 規則 | 点検 |
|---|---|
| 1 色のハードコード禁止 | 新規UIは全て `useTheme()` 経由。`Switch` の `trackColor` / `thumbColor` もトークン。grep を受け入れ条件に入れた |
| 2 主キーは ULID | 新しい行を作らない(`user_settings` の更新のみ。ID採番は既存の `newId()`) |
| 3 全テーブルに created_at / updated_at | スキーマ変更なし |
| 4 コンテンツとユーザー状態の分離 | コンテンツ表は読み取りのみ。書くのは `user_settings` の1列だけ |
| 5 `review_events` は追記のみ | **一切触らない。** SRS はこのプランの外 |
| 6 migrations を手編集しない | マイグレーションを生成も編集もしない |
| 7 UI文言は英語 | ヘッダー・ボタン・空状態・エラーすべて英語。**日本語のシーン名を画面に出さない**ことを受け入れ条件で担保。画面に出る日本語は会話文・漢字・ふりがな(学習コンテンツ本体)だけ |
| 8 ライブAI生成をしない | 静的データを DB から読むだけ。`fetch` を書かない |
| 9 サーバーを持たない | 通信なし |
| 10 推測クイズを SRS に入れない | クイズを実装しない。`quiz_attempts` に触らない |
| 11 読み変化の演出は1回だけ | 演出カードを出さない。★バッジも出さない(出すとカードの合図になるため)。`reveal_shown` に触らない |
| 12 iOSのみ | `Switch` は RN 標準。Android 固有コードなし |


## 実装後の記録(2026-08-30)

### プランの記述で誤っていたもの

- **`Back` を `Text` の `onPress` + `hitSlop` で作る想定は誤り。** React Native の `Text` は
  `hitSlop` を持たない(`pressRetentionOffset` のみ)ため型エラーになる。`Pressable` で包み、
  押下時の `opacity` フィードバックも足した(`conversation-view.tsx` / `conversation/[id].tsx`)。
- **リスク欄の「折り返した2行目のふりがなが1行目の本文に接触するかもしれない」は起きなかった。**
  `styles.row` の `rowGap` 調整は不要で、`furigana.tsx` は1行も触っていない。
  #7 の10セグメントの行、#4 の3行折り返しのいずれも接触なし。
- **リスク欄の「大文字マクロンがシステムフォントで欠けるかもしれない」も起きなかった。**
  `Ā`(#1-5) / `Ō`(#2-2) / `Kyō` / `Sō` / `Kō` / `hosō` / `mō` / `nē` / `Wā` すべて
  豆腐にならず上端も切れない。ローマ字行に `theme.type.mincho` を指定せず
  システム既定に任せた判断(実装ステップ4)がそのまま効いている。

### 承認済みスコープから外れて触ったもの(4件。いずれもコメントのみ / 型の都合)

1. **`src/db/queries/diagnostics.ts` のブロックコメント**(+5/-1)。受け入れ条件
   「`git diff --stat src/db src/content` が空」に反する。`db-debug` を消したことで
   「`src/app/db-debug.tsx` が使う」が実在しないファイルを指す嘘になったため。
   関数の本体は1文字も変えていない。**残す理由**(再シードでユーザー状態が消えていないかを
   確かめる唯一の手段で、SRS の回にまた要る)をコメントに書いた。
2. **`src/app/paywall-debug.tsx` のコメント2箇所**(+2/-2)。プランは同ファイルを
   「変更しないもの」と「スコープ外」の両方に挙げていた。理由は1と同じで、
   `db-debug` への言及が実在しないファイルを指すようになったため。挙動は不変。
   **これは reviewer に指摘されるまで報告から漏れていた。**
3. **受け入れ条件「`rg "scene" src/features/reading src/app` が0件」の未達**。
   `focus.test.ts` の `scene: '玄関'` 1件。`Sentence.scene` は必須フィールドなので
   フィクスチャから省くと型エラーになる。画面に出る文字列ではなく、条件の意図
   (絶対規則7 / 日本語のシーン名を画面に出さない)は満たしている。
   **条件の書き方を次から `rg "\.scene"`(プロパティアクセス)にすると正確になる**、と reviewer。
4. **`src/features/reading/segments.ts` のコメント**。`theme-preview に手書きされている配列と
   構造を揃えるため」が、参照先ファイルの削除で意味を失ったため書き換えた。

### 次に送るもの

- **ふりがなが親字より横に長いときの字間。** `机`(つくえ)や `こういう日`(ひ)の後に空きが出る。
  実機確認では「右側にだけ寄っている」と報告したが**これは誤りで**、`furigana.tsx` の
  `styles.segment` は `alignItems: 'center'` なので親字はルビの中央に揃っている。
  実際は**親字の余白と隣接セグメントの余白が合算されて広く見えている**。
  対処は (a) ルビが長いときだけ親字に `letterSpacing` を配る(日本語組版の正しい振る舞い)か
  (b) ルビ側を `maxWidth` で圧縮するかの2択。**漢字フォーカス画面より前に片付ける価値がある。**
- **`#4` の `今日` が丸ごと光る件。** 熟字訓なのでセグメントを割れず、実装では直せない。
  同じ回の2行目に `日`(ひ) 単独のハイライトがあるので対象字は伝わるが、
  許容できないなら原稿の書き換えになる。**開発者の判断待ち。**
- **シミュレータの自動タップでは RN の `Switch` が反応しない**(ドラッグなら反応する)。
  `Back` やリスト行のタップは効くので座標の問題ではなく、ネイティブ `UISwitch` と
  自動化イベントの相性。**指で押したときの挙動は未検証。**
- 一覧が `isFree` を読まないので、第2章のデータが入ると有料分まで出る。**paywall の回で対応。**
- 一覧は「1日3字上限」を反映しない暫定物。SRS の回に「今日の学習」へ置き換える。

### レビュー指摘への対応

`reviewer` の判定は**合格**で、コード修正の指摘は0件。ドキュメント2点の指摘に対応した。

1. プランのステータスと「実装後の記録」節が無い → この節を追加し `完了` にした
2. `assets/temp/*.png`(1.4MB)が未追跡で残っている → `.gitignore` に `assets/temp/` を追加。
   イラスト生成の入力であって本ブランチの成果物ではないため
