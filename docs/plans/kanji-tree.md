# プラン: kanji-tree(漢字の樹 + 漢字一覧グリッド)

作成日: 2026-09-06
ステータス: 完了
要件定義書の対応箇所: 4.5(漢字の樹 ビジュアル仕様)、5.1-7(Must have)、5.3(`kunBranch` / `onBranch`)、6.2(react-native-svg)

## 目的

学習済みの漢字を一覧グリッドに並べ、1字をタップするとその字の樹が開いて、**出会った語が色つきの葉・未出会いの語が灰色のつぼみ**として見える状態にする。訓の枝を緑・音の枝を青で描き分けることで「この字には読みが2系統ある」を樹だけで気づけるようにする。

## 先に確認したい点(要件・既存データとの食い違い)

実装案の前に6点。方針が違うなら承認前に指摘してほしい。**要件を勝手に解釈で変えてはいない。**

1. **要件4.5 のレイアウトパターン区分(1〜2語 / 3〜4語 / 5語以上)は、実データと合わない。** 実測すると `words` 133語は全50字に 2語=18字 / 3語=31字 / 4語=1字(`入`)で分布し、**5語以上の字は1つも無い**。
   → スロット表は **1・2・3・4語ぶんを個別に持ち**、5語以上は決定的な扇形フォールバックにする(将来コンテンツが増えても落ちないための保険。テストはするが実データでは描かれない)。要件の「数種類のパターンを当てはめる/動的グラフ描画はしない」という意図は満たしている。
2. **グリッドに出すのは「学習済みの字だけ」にしたい。** 要件4.5 は誰を並べるかを書いていない。50字すべてを出すと、未購読者に第2章以降の漢字・意味・イラストがそのまま見えてしまう(課金境界は章 = ADR-0008)。学習済みだけに絞ると、**課金判定を1行も書かずに境界と一致する**(ロックされた章の字は学びようがないため)。ついでに樹が素直に「進捗画面」(5.1-7)になる。未学習ぶんは字を見せずに `38 more kanji to meet.` と件数だけ出す。
3. **つぼみのラベルは表記だけ出す。** 要件4.5 の図はつぼみに `[空気]` と表記を書いているのでそれに従うが、**読みと意味は出さない**(出すと「まだ先がある」という動機と、後の推測クイズの種明かしが先に潰れる)。
4. **要件4.5「訓=緑 / 音=青」が成立しない字が6字ある。** `買` `川` `花` は樹の語がすべて訓、`天` `本` `語` はすべて音(後者は `readingIntroduction: 'on-only'` の例外字なので設計どおり)。**今回コンテンツは直さない。** 樹は片方の色だけで描かれる。
5. **`docs/plans/srs-reviews.md` が「ステージ名・進捗バー・Burned 表示は樹の担当」と送り出しているが、今回は入れない。** 要件4.5 が樹に求めているのは「出会った単語数のバッジ」だけで、SRSステージの可視化は要件に無い。機能凍結目安(9月上旬)を過ぎているので足さない(スコープ外に記載)。
6. **`Word` にローマ字の列が無いので、樹の葉ラベルはローマ字設定に従わない。** 要件5.2 は「日本語の全文に添える」規定で、樹の語ラベルは会話文ではない。`kanaToRomaji()` を実行時に呼べば出せるが、検品を通していない文字列を画面に出すことになるため今回は見送る(スコープ外)。

## スコープ外

**今回やらないこと。迷ったら足さない。**

- **要件4.6 ステップ3(樹への反映アニメーション)。** 演出カードを閉じた瞬間に枝が生えるアニメーションは入れない。`RevealCard` の `onClose` が差し替え口として空いたままなのは `docs/plans/reading-reveal.md` の申し送りどおりで、**削除ではなく順序を後ろにするだけ**。今回作る `KanjiTreeView` は「与えられた状態を静的に描く」だけにしておき、アニメーションを後から被せられる形にする
- **SRSステージ・進捗バー・Burned 表示**(上記5)。樹は `review_events` を1件も読まない
- **推測クイズとの連携**(絶対規則10)。`quiz_attempts` も読まない
- **未学習・ロック中の漢字をグリッドに「鍵付きで見せる」演出**(上記2)。件数だけ出す
- **漢字フォーカス画面(`src/app/kanji/[id].tsx`)への課金ガード**(`docs/plans/paywall-gate.md` からの申し送り)。**判断: ガードを追加しない。** 樹からは学習済みの字にしか遷移できず、他の到達経路は開発専用の `kanji-list` と ULID を知っている前提の deep link しかないため、今回の変更で新しい漏れ口は増えない。この判断を `paywall-gate.md` 側の借りの返済として記録する
- **開発専用の漢字一覧(`src/app/kanji-list.tsx` / `src/features/reading/kanji-list.tsx`)の削除・統合。** あれはイラスト検品用で全50字を無条件に並べる別物。今回のグリッドとは要件が違うので残す
- **タブバーの導入。** 入口画面に1行の導線を足すだけにする
- 葉のタップで語の詳細を出す / 語の音声 / 語ごとの学習履歴
- 樹のズーム・パン・スクリーンショット共有
- 樹の語(`words`)の追加・修正(`分` の `〜ふん`、`話`(はなし) のつぼみ戻し等の既知の借り)。コンテンツ側の回で行う
- ローマ字表示への追従(上記6)、`Word` へのローマ字列追加とマイグレーション
- オンボーディング(5.1-10)での樹の説明

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/tree/layout.ts` | 新規 | **純粋ロジックの本体。** `layoutTree(leaves)` — 語数からパターンを選び、枝・葉・ラベルの正規化座標を返す。React も theme も `@/db` も import しない |
| `src/features/tree/layout.test.ts` | 新規 | 上記のユニットテスト(下記「テスト方針」) |
| `src/features/tree/tree.ts` | 新規 | **純粋ロジック。** ユーザー状態から葉/つぼみを導出する。`buildKanjiTree()` / `buildTreeIndex()`。`@/db` を import しない(`@/db/client` は import しただけで SQLite を開くため) |
| `src/features/tree/tree.test.ts` | 新規 | 上記のユニットテスト |
| `src/features/tree/components/kanji-tree-view.tsx` | 新規 | 1字の樹の描画。`react-native-svg` の `Svg` / `Path` / `Circle` と、その上に重ねる RN の `Text`。`expo-router` を import しない |
| `src/features/tree/components/tree-grid-view.tsx` | 新規 | 学習済みの字のグリッド。セルに「出会った語数 / 総語数」のバッジ |
| `src/features/tree/index.ts` | 新規 | 公開API。app 層はここだけを import する |
| `src/app/trees.tsx` | 新規 | グリッドのルート。DB 読み出しと遷移だけ |
| `src/app/tree/[id].tsx` | 新規 | 1字の樹のルート。DB 読み出しと遷移だけ |
| `src/db/queries/content.ts` | 変更 | `listWords()`(全133語)を追加。グリッドのバッジ用。既存の `listWordsByKanji()` は詳細画面がそのまま使う |
| `src/db/index.ts` | 変更 | `listWords` を公開 |
| `src/features/srs/components/today-view.tsx` | 変更 | 任意 props `metKanjiCount` / `totalKanjiCount` / `onOpenTrees` を受け、`Kanji tree — 12 of 50` の行を出す。渡されなければ何も描かない(既存の呼び出しを壊さない) |
| `src/app/index.tsx` | 変更 | 上記 props を渡す。`planTodaysLessons` / `planTodaysReviews` の呼び出しは**変更しない** |
| `docs/architecture.md` | 変更 | 「現在のルート」に `trees.tsx` / `tree/[id].tsx` を追加。`features/tree/` の担当欄を実態に合わせる |
| `docs/release-checklist.md` | 変更 | 「漢字の樹(5.1-7 / 4.5)」にチェックを付け、実装済み一覧に移す |
| `docs/plans/paywall-gate.md` | 変更 | 「フォーカス画面のガードは樹を作る回で見る」の申し送りに、今回の判断(ガードを追加しない理由)を1行追記 |

**変更しないと明記するもの**: `src/db/schema.ts`(マイグレーション不要)、`src/features/reading/kanji-focus.tsx`(`onComplete` を渡さない経路は既に対応済み)、`src/app/kanji/[id].tsx`、`src/app/_layout.tsx`(ルートは自動)、`src/theme/`(`kunBranch` / `onBranch` は既にトークンにある)、`package.json`(`react-native-svg@15.15.4` は導入済みで `ios/Podfile.lock` にも `RNSVG` が入っている = 再ビルド不要)。

## データモデルの変更

**なし。** マイグレーションを生成しない。

- 葉/つぼみの判定に必要な情報は `words.encountered_in_sentence_id`(コンテンツ)と `lesson_events`(ユーザー状態)に既に揃っている
- `kanji_progress` のようなキャッシュ表も作らない(絶対規則5。導出で足りる)
- `review_events` は読み書きとも一切しない

## 実装ステップ

1. **ブランチを切る。** `git fetch` → `main` を最新にして `feat/kanji-tree`。現在の `feat/kanji-illustrations` から派生させない。
2. `src/features/tree/tree.ts` を書く(純粋)。
   - 入力の最小型を feature 側で再定義する(`@/db` の型に依存しない。`features/srs/lessons.ts` の `LessonCompletion` と同じ流儀)
     ```
     CompletedLesson = { sentenceId: string; kanjiId: string | null }
     ```
   - `buildKanjiTree({ kanji, words, lessons })` → `{ kanji, leaves: TreeLeaf[], encounteredCount, totalCount }`
     - `TreeLeaf = { wordId, surface, kana, meaning, readingType, state: 'leaf' | 'bud' }`
     - **判定規則**: `word.encounteredInSentenceId !== null` かつ **その文の `lesson_events` があれば `leaf`、無ければ `bud`**
   - `buildTreeIndex({ kanji, words, lessons })` → `{ met: KanjiEntry[]; summaries: Map<kanjiId, { encounteredCount, totalCount }> }`
     - `met` は `lessons` に `kanjiId` がある字だけを、入力(`listKanji()` = 学習順)の順序のまま返す
3. `src/features/tree/tree.test.ts` を書く。
4. `src/features/tree/layout.ts` を書く(純粋)。
   - 正規化座標系 `viewBox 100 × 120`(左上原点、y は下向き)。中心の漢字は `(50, 92)`、幹は `(50, 120) → (50, 96)`、枝の起点は `(50, 84)` 固定
   - **並べ替え**: 訓を先・音を後、同種別内は入力順を保つ(安定)。`state` はソートキーに使わない
   - **スロット表**(左→右に割り当て。値は実機を見て調整してよい)
     | 語数 | パターンID | 葉の中心 |
     |---|---|---|
     | 1 | `single` | (50,22) |
     | 2 | `pair` | (24,34) (76,34) |
     | 3 | `triple` | (18,44) (50,18) (82,44) |
     | 4 | `quad` | (14,52) (36,20) (64,20) (86,52) |
     | 5以上 | `fan` | 中心 (50,84) から半径46の円弧上を -160°〜-20° で等分 |
   - 枝は二次ベジェ1本。制御点は起点→葉の 55% 地点を外側へ少しずらしたもの(棒に見せないため)
   - 各枝は `label: { x, y, align: 'left'|'center'|'right' }` を返す。トップレベルに `leafRadius` / `budRadius` / `labelWidth`(正規化単位)を持つ
   - **返り値に色を入れない**(絶対規則1)。返すのは `readingType` と `state` だけで、色は描画側が `theme.kunBranch` / `theme.onBranch` / `theme.textMuted` から選ぶ
5. `src/features/tree/layout.test.ts` を書く。
6. `kanji-tree-view.tsx` を書く。SVG は幹・枝・節点だけを描き、**ラベルは RN の `Text` を絶対配置で重ねる**(SVG の `Text` は折り返せず、`junior high school`(18字)が枠から出るため)。正規化座標 × `containerWidth / 100` で px に写す。日本語テキストには `accessibilityLanguage="ja-JP"`。
7. `tree-grid-view.tsx` を書く。3列。セルは `KanjiIllustration`(既存)+ 字 + 意味 + `1/3` バッジ。未学習の件数を末尾に1行。
8. `listWords()` を `src/db/queries/content.ts` に足し、`src/db/index.ts` から公開する。
9. `src/app/trees.tsx` / `src/app/tree/[id].tsx` を書く。`src/app/index.tsx` と同じく遅延初期化 + `useFocusEffect` で読み直す(会話文を終えて戻ったときに葉が増える)。
10. `today-view.tsx` に導線を足し、`src/app/index.tsx` から渡す。位置は「今日の回」の下・Unlock カードの上。
11. `pnpm run check` を通す。
12. シミュレータ(MCP の `attach` → `build` → `launch`)で目視確認。`Ignore daily limit` を ON にして `空`(#35)・`日`(#4→#17)・`入`(4語)・`本`(音のみ)の4本を見る。
13. `docs/` を更新し、`/log` に判断を残す。

## 受け入れ条件

- [ ] 入口画面に `Kanji tree` の行が出て、押すとグリッド画面が開く。行には `12 of 50` の形で「学習済みの字数 / 全50字」が出る
- [ ] グリッドに並ぶのは **`lesson_events` に記録のある字だけ**。会話文 #1 を1本だけ終えた状態では `人` の1セルだけが出る。購読中でも、まだ学んでいない第2章以降の字は1つも出ない
- [ ] 各セルに「出会った語数 / その字の総語数」が出る。#1 直後の `人` は `2/3`(`人`・`三人` が出会い済み、`外国人` が未出会い)
- [ ] セルを押すとその字の樹が開く
- [ ] #35 を終えた直後の `空` の樹は、`空` (そら) が**緑**の葉、`空気` と `空港` が**灰色のつぼみ**として描かれる(要件4.5 の図と一致する)
- [ ] #4 だけを終えた `日` の樹は `日` が緑の葉・`日曜日` と `毎日` がつぼみ。**#17(第2段階「日曜日」)を終えると `日曜日` が青の葉に変わり、`日` と `毎日` の位置は1ドットも動かない**
- [ ] つぼみには表記(`空気`)だけが灰色で出る。読み(くうき)と意味(air)は出ない
- [ ] 葉には表記・読み・英語の意味が出る。`中学`(junior high school)の樹で、意味が枠内で折り返して読み切れる
- [ ] 枝の色は `theme.kunBranch` / `theme.onBranch` から来ている。`src/features/tree/` を grep して `#` で始まる色リテラルが1つも無い
- [ ] 樹の画面の `See the illustration` を押すと `/kanji/<id>` が開き、**`Got it` の CTA は出ない**(学習の導線ではないため)。戻ると元の樹に戻る
- [ ] 復習で不正解を記録しても、樹の葉・つぼみ・バッジの数は一切変わらない(樹は `review_events` を読まない)
- [ ] 語数が 2 / 3 / 4 のいずれの字でも、葉が互いに重ならず、幹と重ならない
- [ ] グリッド・樹ともに画面上の文言がすべて英語(日本語が出るのは漢字・語の表記と読みだけ)
- [ ] `pnpm run check` が通る。`src/features/tree/layout.test.ts` と `src/features/tree/tree.test.ts` が実行されている
- [ ] マイグレーションが1本も増えていない(`src/db/migrations/` に差分なし)

## テスト方針

**ユニットテストを書くのは純粋ロジック2本だけ。** UI は上記の受け入れ条件をシミュレータで目視確認する。

`layout.test.ts`(**座標そのものを固定値で assert しない。** 実機調整のたびに壊れるだけなので、不変条件を見る)

1. 訓1・音1の2語を渡すと枝が2本返り、**訓が先**(= 左のスロット)になる
2. 入力が音→訓の順でも出力は訓が先になる(`入` の実データ順を模したフィクスチャ)
3. **`state` を `bud` → `leaf` に変えても `from` / `control` / `to` / `label` が完全に一致する**(出会っても葉が動かない)
4. 同じ入力で2回呼ぶと完全に同じ結果(乱数・時刻に依存しない)
5. 語数 1/2/3/4 でパターンIDが `single`/`pair`/`triple`/`quad` に切り替わり、枝の本数が語数と一致する
6. 語数5・8でも例外を投げず、`fan` になり、枝の本数が語数と一致する
7. すべての葉の中心が `viewBox` の内側(半径ぶんのマージン込み)に収まる
8. すべての葉が中心の漢字より上にある(`to.y < 枝の起点.y`)
9. `align` が x 座標と整合する(中心より左なら `right` 寄せ、右なら `left` 寄せ、真上は `center`)
10. 語0件でも落ちず、枝が空で返る

`tree.test.ts`

1. `encounteredInSentenceId` が `null` の語は、どんな `lessons` を渡しても `bud`
2. `encounteredInSentenceId` の文が `lessons` にあれば `leaf`、無ければ `bud`
3. 同じ文の `lesson_events` が二重に入っていても `encounteredCount` は増えない
4. `buildTreeIndex()` が返す `met` は、`kanjiId` を持つ `lesson_events` がある字だけで、入力の順序を保つ
5. `kanjiId: null` の記録(第2段階専用の回)だけを渡しても `met` は空
6. `lessons` が空なら `met` は空、`buildKanjiTree()` の葉は全部 `bud`
7. `words` が空の字を渡しても落ちず、`totalCount: 0` を返す

**どちらのテストも `@/db` を import しない**(`@/db/client` は import しただけで SQLite を開く)。`@/features/tree/index.ts` 経由ではなく個別モジュールを import する。

## リスク・未確定事項

- **ラベルの重なりは機械で検証できない。** 座標がスロット表どおりでも、`elementary school` のような長い意味で隣とぶつかる可能性がある。語数4の唯一の字 `入` と、語数3で長い意味を持つ字(`学`・`生`)を実機で必ず見る。ぶつかったら `labelWidth` とスロットのx座標を調整する(テストは不変条件しか見ないので壊れない)
- **`買` `川` `花` の樹は緑だけ、`天` `本` `語` の樹は青だけになる。** 要件4.5 の「読みが2系統あることが視覚的に分かる」が、この6字では成立しない。`天` `本` `語` は例外字として設計どおり。残り3字は `kanji.readings` に音(ばい/せん/か)が登録されているのにその読みの語が無い状態で、**フォーカス画面には青い `On` バッジが出るのに樹には青い枝が無い**という食い違いが出る。今回は直さず、コンテンツ側の回に送る
- **既知のコンテンツの借りがこの画面で目に見えるようになる**(`docs/log/2026-08.md`): `分` の樹に時刻の `〜ふん` が無い / `話`(はなし) が #25 に出るのにつぼみのまま / `来` の訓を `く` で登録している。**この画面のバグではない**ので今回は直さない
- `react-native-svg` は SDK 57 の推奨バージョン(15.15.4)が導入済みで、`ios/Podfile.lock` にも `RNSVG` が入っている。**新規のネイティブ依存が無いので prebuild のやり直しは発生しない**見込み。万一 SVG が描画されないときはネイティブ再ビルドを疑う(コードを疑う前にここを確認する)
- 4.6 ステップ3(樹への反映)を後から入れるとき、`KanjiTreeView` に「どの語を今生やしたか」を渡す props が要る。今回は入れないが、`buildKanjiTree()` の出力に語IDが入っているので、後から `highlightWordId?: string` を足すだけで済む形にしておく
- グリッドの空状態(まだ1字も学んでいない)は、初回起動直後に必ず通る。`You haven't met any kanji yet.` の1行だけを出す。オンボーディング(5.1-10)が入ったら文言を見直す可能性がある

## 実装後の記録(2026-09-06)

プランからずれた点と、実機で決めた値。

- **ラベルは葉の上に置く。** プランは「葉の下 + 左右寄せ(`align`)」だったが、実機で見ると
  真上の葉(`triple` / `quad` の中央)のラベルが自分の枝の上に乗る。枝は葉から下へ伸びるので、
  **上に置けばどの葉でも枝と重ならない**。`LabelPlacement` から `align` を外し、`y` は
  「枠の下端」に変えた(枠は `bottom` で留めて上へ伸びる。意味が2行になっても葉に被らない)。
  テスト9(align の整合)は「ラベルは葉より上にある」に差し替えた
- **スロット表の実値。** ラベルを上に置いたぶん、葉を下げた:
  `single (50,30)` / `pair (24,36)(76,36)` / `triple (18,46)(50,30)(82,46)` /
  `quad (14,54)(36,32)(64,32)(86,54)`。枝の起点は `(50,82)`、幹は `(50,120)→(50,102)`
  (漢字の上下に隙間を空けて、字に食い込ませない)
- **葉のラベルの並びは 表記 → 読み → 意味**(上から)。意味を先頭に置くと英語の小さな
  キャプションが見出しに見える
- **`buildKanjiTree()` は全語を渡しても `kanjiId` で絞る。** 画面は `listWordsByKanji()` を
  使うが、テストと将来の呼び出しが混ざっても安全なように
- **実機確認で第2章以降の状態を作るのに、Test Store の購入はしていない。** シミュレータの
  SQLite に `lesson_events` を直接 INSERT した(#17 / #28 / #35 / #49 / #53)。
  受け入れ条件の「購読中でも未学習の字は出ない」は、購読状態を作っていないため**未確認**
- **expo-router の型付きルート(`.expo/types/router.d.ts`)は `expo start` を数秒回して再生成した**
  (`docs/log/2026-09.md` の申し送りどおり)。この Metro は Fast Refresh が効かず、
  レイアウト変更を見るたびに Metro を立て直してアプリを再起動した
