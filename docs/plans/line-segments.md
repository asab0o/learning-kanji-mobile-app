# プラン: line-segments

作成日: 2026-08-28
ステータス: 完了
要件定義書の対応箇所: 5.2(表記・表示の仕様)、5章 機能一覧 2(例文表示画面)、6.2 / 6.3(データ設計)

## 目的

会話文の 1 行が、**画面がそのまま `FuriganaText` に渡せる形**でデータに入っている状態にする。
「どの漢字にどの読みが乗るか」を行データが持つことで、実データ 58 文(約 145 行)を
一度書けば会話文画面の実装がデータ加工なしで済むようにする。

### 先に確認したい点(ドキュメント・既存コードとの差分)

実装案の前に、いま食い違っている/決まっていない点が 5 つある。本プランはそれぞれ下記の
方針を採るが、違う判断をしたい場合は承認前に指摘してほしい。

1. **`src/content/types.ts` の `Line.furigana`(ひらがな全文の文字列)と、実装済みの
   `FuriganaText`(`FuriganaSegment[]` を受ける)が噛み合っていない。**
   平坦なひらがなから「`ある` が `歩` の読み」であることは機械的に復元できない。
   → 本プランは `Line.furigana: string` を **削除**し、`Line.segments: LineSegment[]` に置き換える。
   実データはまだ 0 件なので移行は発生しない。

2. **`docs/会話文集.md` の「未確定事項」に「各文のふりがなデータ形式の確定」が残っている。**
   → 本プランがこれを確定させる。確定先は `docs/content-spec.md`(契約)であり、
   会話文集側は該当行を「確定済み(content-spec 参照)」に書き換える。
   **要件定義書 5.2 とは矛盾しない**(5.2 は「ふりがなを標準表示」としか定めておらず、
   保持形式には触れていない)。

3. **平坦なふりがな(ひらがな全文)を残すかどうか。**
   → **残さない。** 現在この文字列を読んでいるコードは 1 つもなく(検証の空チェックのみ)、
   「漢字を含むセグメントには必ず読みを付ける」という不変条件さえ守れば
   `segments.map(s => s.reading ?? s.text).join('')` で導出できる。二重管理をやめる。
   必要な箇所は導出関数 `segmentsToKana()` を呼ぶ。

4. **`focus`(学習中の漢字のハイライト)をデータに持つか、画面が導出するか。**
   → **画面が導出する。** `focus` は「いまどの字に注目させているか」という文脈依存の表示状態で、
   **同じ `Sentence` でも光らせる字が場面によって変わる**(要件定義書 4.6)。
   ステップ1(出会った瞬間)は `newKanjiId` 1字をハイライトするが、第2段階の演出では
   同じ文が `reencounters[].kanjiIds` の字(「大学」なら `大` と `学` の2字同時)を
   ハイライトする必要があり、これは `newKanjiId` と別の字になり得る。
   1つの `Line` に対して光らせる対象が固定でないので、`focus` をデータに焼くと
   どちらの場面のための行か曖昧になり、さらに
   「`focus: true` なのに新出漢字が入っていないセグメント」という検証すべき不整合が増える。
   コンテンツ側の `LineSegment` は `text` / `reading` だけを持ち、
   `FuriganaSegment`(= `LineSegment` + `focus?`)は `features/reading` 側の型のままにする。

5. **`FuriganaSegment` の定義場所と依存方向。**
   `docs/architecture.md` は `features → content` の一方向依存を定めているので、
   `src/content/` が `src/features/reading/furigana.tsx` の型を参照するのは逆流になる。
   → **`LineSegment` を `src/content/types.ts` に置き**、`furigana.tsx` 側を
   `export type FuriganaSegment = LineSegment & { focus?: boolean }` にする。
   `FuriganaSegment` という名前と既存の import(`theme-preview.tsx` / `features/reading/index.ts`)は変えない。

## スコープ外

今回やらないこと。**迷ったら小さい方**に倒し、以下は明示的に次回以降へ送る。

- **ローマ字変換器の実装・ヘボン式の表記仕様**(長音・撥音・助詞「は/へ/を」)。次のブランチ。
  `Line.romaji: string`(行全体の手書き文字列)は**今回そのまま残す**
- **ローマ字の分かち書きのためのセグメント拡張**(語境界フラグ等)。
  セグメントは語境界の**手がかり**にはなるが解決はしない(後述「リスク」)。
  必要になったら JSON 列の中に任意フィールドを足せばよく、マイグレーションは不要
- **実データの投入**(漢字 50 字・会話文 58 文・第1章 10 文)。別タスク。
  今回はコンテンツが空配列のままで `pnpm run check` が通り、アプリが起動することまで
- **会話文画面(`features/reading` の本番 UI)**。`ThemePreview` は削除も改修もしない
- **第2段階の演出でどの字をハイライトするか**の導出。今回作る導出関数は「対象文字の配列を
  受け取って `focus` を付ける」だけの純粋関数で、対象文字を決めるのは画面側の次回の仕事
- **`Line.japanese` の廃止**(セグメントから導出できるが、既存の検証ルール 5 本が
  この文字列を直接見ているため残す。詳細は「データモデルの変更」)
- **`sentence_line_segments` 表への正規化**。`docs/data-model.md` の JSON 列方針に従う
- **形態素解析ライブラリの導入**。セグメント分割は人手(原稿執筆時)で行う
- **セグメント幅の実測に基づく折り返し検証**。文字数の閾値による警告に留める
- ADR の作成。判断の根拠は本プランと `docs/content-spec.md` に残す
  (ADR が要ると判断するなら承認時に指示してほしい)

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/content/types.ts` | 変更 | `LineSegment` を追加。`Line.furigana: string` を削除し `Line.segments: LineSegment[]` を追加 |
| `src/content/segments.ts` | 新規 | 純粋関数 `segmentsToText()` / `segmentsToKana()`。React にも DB にも依存しない |
| `src/content/segments.test.ts` | 新規 | 上記のユニットテスト |
| `src/content/validate.ts` | 変更 | `checkLineFields` から `furigana` の空チェックを外す。`checkLineSegments` を追加し `RULES` に登録 |
| `src/content/validate.test.ts` | 変更 | `line()` フィクスチャを segments 形式に更新。新ルールのテストを追加 |
| `src/content/fingerprint.test.ts` | 変更 | フィクスチャの `furigana` を `segments` に差し替え |
| `src/content/CLAUDE.md` | 変更 | 「守ること」8 のふりがなの項をセグメント形式に更新 |
| `src/db/schema.ts` | 変更 | `sentence_lines.furigana` を削除し `segments`(JSON テキスト)を追加 |
| `src/db/migrations/` | 変更(生成物) | `pnpm run db:generate` が吐く `0001_*.sql` / `meta/0001_snapshot.json` / `_journal.json` / `migrations.js`。**手で編集しない**。`0000_lethal_alice.sql` は触らない |
| `src/db/mappers.ts` | 変更 | `toLine` / `toSentenceLineRow` を segments に対応。`parseSegments()` と `isLineSegment()` の型ガードを追加 |
| `src/db/mappers.test.ts` | 変更 | `lineRow()` フィクスチャを更新。JSON 往復・壊れた JSON・要素の形不正のテストを追加 |
| `src/features/reading/furigana.tsx` | 変更 | `FuriganaSegment` を `LineSegment & { focus?: boolean }` として定義し直す(表示ロジックは変更なし) |
| `src/features/reading/segments.ts` | 新規 | `toFuriganaSegments(segments, focusCharacters)`。`focus` を導出する純粋関数 |
| `src/features/reading/segments.test.ts` | 新規 | 上記のユニットテスト |
| `src/features/reading/index.ts` | 変更 | `toFuriganaSegments` を公開 API に追加 |
| `docs/content-spec.md` | 変更 | 「行データの形」節を新設(セグメントの契約・分割の粒度・検証ルール表の更新) |
| `docs/data-model.md` | 変更 | JSON 列の例に `sentence_lines.segments` を追加 |
| `docs/会話文集.md` | 変更 | 未確定事項「各文のふりがなデータ形式の確定」を確定済みにし、`docs/content-spec.md` を参照させる |
| `.claude/skills/add-content/SKILL.md` | 変更 | 「ふりがな・英訳・ローマ字を全行に付ける」をセグメント形式の書き方に更新 |

`src/db/seed.ts` と `src/db/queries/content.ts` は **変更不要**(`toSentenceLineRow` / `toLine` の
シグネチャを変えないため)。実装時にそうなっていることを確認する。

## データモデルの変更

### アプリの型

```ts
/** ふりがな付き本文の最小単位。折り返しはこの境界でしか起きない */
export interface LineSegment {
  /** 表示する本文(japanese の一部) */
  text: string;
  /** text 全体に乗る読み。かなだけのセグメントでは省略する */
  reading?: string;
}

export interface Line {
  speaker: CharacterId;
  /** 日本語本文(セグメントを連結したものと一致すること) */
  japanese: string;
  /** ふりがな付き本文。画面はこれをそのまま FuriganaText に渡す */
  segments: LineSegment[];
  /** ヘボン式ローマ字(行全体。生成方法は別タスク) */
  romaji: string;
  english: string;
}
```

`focus` は入れない(「先に確認したい点」4)。

**`japanese` は残す。** セグメントから導出できるが、`checkSoraSpeechRule` /
`checkReencounterLineCleanliness` / `collectUnlearnedKanjiUsage` など既存の検証 5 箇所が
この文字列を直接見ており、原稿(`docs/会話文集.md`)とも 1 対 1 で対応する。
重複は残るが、**「連結が `japanese` と一致すること」を error として機械で縛る**ので
二重管理にはならない。平坦なふりがなを削るのは、こちらは誰も読んでおらず、
一致を保証する仕組みも無いため。

### スキーマ

`sentence_lines` の 1 列だけを差し替える。**追記のマイグレーション `0001_*.sql` を生成する**
(`0000_lethal_alice.sql` は書き換えない。絶対規則 6)。

| 列 | 変更 |
|---|---|
| `furigana` TEXT NOT NULL | **削除** |
| `segments` TEXT NOT NULL | **追加**。`LineSegment[]` の JSON |

JSON テキスト列にする理由は `kanji.readings` / `sentences.reencounters` と同じで、
`docs/data-model.md` の「入れ子の配列は JSON テキスト列で持つ」に従う。加えて、

- 常に親行と一緒に丸ごと読む値で、SQL でセグメントを検索する用途が要件に無い
- **後からセグメントに任意のフィールド(語境界フラグ等)を足してもマイグレーションが不要**になる。
  ローマ字の分かち書きが未確定なので、この自由度は今もっとも効く

表を足す案(`sentence_line_segments`)は、コンテンツ表が 5 → 6 に増えてシードの
DELETE/INSERT 手順とチャンク処理も増える割に、得られるのは使う予定のない検索性だけなので採らない。

主キー・タイムスタンプ・コンテンツ/ユーザー状態の分離は一切変えない。
`sentence_lines.id` は従来どおりシード時に ULID を採番する。

## 実装ステップ

1. `src/content/types.ts` に `LineSegment` を追加し、`Line.furigana` を `Line.segments` に差し替える。
   ここで `pnpm run typecheck` が落ちる箇所(mappers / validate / 各テスト)が
   影響範囲の全量であることを確認する
2. `src/content/segments.ts` に `segmentsToText()` と `segmentsToKana()` を書き、
   `segments.test.ts` を添える(句読点・カタカナ・reading 省略を含める)
3. `src/content/validate.ts` の `checkLineFields` から `furigana` の空チェックを外し、
   `checkLineSegments` を追加して `RULES` に登録する。判定内容は下記
   - error: `segments` が空 / `text` が空 / 連結が `japanese` と不一致 /
     漢字を含むセグメントに `reading` が無い / `reading` にひらがな(と長音符)以外が混じる
   - warning: かなだけのセグメントに `reading` が付いている /
     1 セグメントが 10 文字を超える /
     その回の新出漢字が、他の漢字と同じセグメントに入っている
   漢字判定は既存の `extractKanji` / `HAN` を再利用する
4. `validate.test.ts` の `line()` フィクスチャを segments 形式にし、
   新ルールごとにフィクスチャベースのテストを足す(実データに依存させない)
5. `src/db/schema.ts` の `sentence_lines` から `furigana` を消し `segments` を足す
6. `pnpm run db:generate` を実行する。
   **drizzle-kit が「furigana を segments にリネームしたか」を対話で聞いてくる可能性がある。
   リネームではなく「削除 + 追加」と答える**(平坦文字列と JSON は別物なので、中身を引き継がせない)。
   生成された `0001_*.sql` を**読んで**、`0000` に差分が出ていないことと、
   既存行がある DB でも適用できる形(テーブル再作成方式、または `NOT NULL DEFAULT` 付きの
   ADD COLUMN)になっていることを確認する。**編集はしない。**
   もし適用できない形なら、SQL ではなくスキーマ定義側で調整して再生成する
7. `src/db/mappers.ts` に `parseSegments()` / `isLineSegment()` を `parseReadings` と同じ流儀
   (`unknown` に落として型ガード、壊れていたら `RowError` で行 ID と列名を含めて throw)で書き、
   `toLine` / `toSentenceLineRow` を差し替える。`mappers.test.ts` を更新・追加する
8. `src/features/reading/furigana.tsx` の `FuriganaSegment` を
   `LineSegment & { focus?: boolean }` に変える(コンポーネント本体は触らない)
9. `src/features/reading/segments.ts` に
   `toFuriganaSegments(segments: LineSegment[], focusCharacters: readonly string[]): FuriganaSegment[]`
   を書く。「セグメントの `text` が対象文字を含むなら `focus: true`」だけの純粋関数。
   `segments.test.ts` を添え、`features/reading/index.ts` から公開する
10. `src/db/seed.ts` / `src/db/queries/content.ts` が無変更で通ることを確認する
11. `docs/content-spec.md` に「行データの形」節を追加する(セグメントの契約、分割の粒度、
    `focus` を持たない理由、検証ルール表の更新)。`docs/data-model.md`・`docs/会話文集.md`・
    `src/content/CLAUDE.md`・`.claude/skills/add-content/SKILL.md` を追随させる
12. `pnpm run check` を通す
13. シミュレータで確認する(`attach` → `build` → `launch`)。
    **マイグレーション 0001 の適用を素で見るため、先にアプリを削除してから入れ直す**

## 受け入れ条件

- [ ] `rg "furigana" src/content src/db --glob '!migrations'` が 0 件
      (`furiganaMetrics` は `src/features/reading/` にあるため対象外)。
      平坦なふりがなの列・フィールドがどこにも残っていない。
      `src/db/migrations/0000_lethal_alice.sql` と `meta/0000_snapshot.json` には
      過去の記録として `furigana` が残り続けるので、この2ファイルは除外する
      (書き換えないことが絶対規則6)
- [ ] `src/content/types.ts` の `LineSegment` に `focus` が無く、
      `rg "focus" src/content` が 0 件(ハイライトはコンテンツの責務ではない)
- [ ] `src/content/types.ts` が `@/features/` を import していない
      (`rg "@/features" src/content` が 0 件)
- [ ] `segmentsToText([{text:'たくさん'},{text:'歩',reading:'ある'},{text:'きましたね。'}])` が
      `'たくさん歩きましたね。'` を返し、`segmentsToKana(...)` が `'たくさんあるきましたね。'` を返す
- [ ] `toFuriganaSegments(上と同じ配列, ['歩'])` が 3 要素を返し、`focus === true` は
      `text === '歩'` の 1 要素だけ。対象文字を `[]` にすると `focus` が付いた要素が 0 件になる
- [ ] 上の結果が、`src/features/reading/theme-preview.tsx` に手書きされている
      会話文 #32 の 1 行目のセグメント配列と一致する
- [ ] `japanese: 'たくさん歩きましたね。'` に対し segments が `[{text:'たくさん'},{text:'歩',reading:'ある'}]`
      (「きましたね。」が欠けている)フィクスチャを検証すると、
      rule `line-segments` の **error** が 1 件出て、メッセージに会話文 ID と行番号が入る
- [ ] `{text:'歩'}`(reading 無し)を含むフィクスチャで error が出る。
      `{text:'歩', reading:'アル'}`(カタカナ)でも error が出る
- [ ] `{text:'たくさん', reading:'たくさん'}`(かなに読み)は **warning** に留まり、error にはならない
- [ ] 11 文字のセグメントを 1 つ含むフィクスチャで warning が 1 件出る(10 文字では出ない)
- [ ] 新出漢字が `日` の文で `{text:'今日', reading:'きょう'}` を使うと warning が 1 件出る。
      `{text:'日', reading:'ひ'}` では出ない
- [ ] `segments` に `'[{"text":"歩","reading":"ある"}]'` を持つ行をマッパーに渡すと
      `Line.segments` が長さ 1 の配列として返る。`'{'` のような壊れた値では
      **行 ID と `segments` を含むエラー**が throw され、`'[{"reading":"ある"}]'` では
      `segments[0]` を含むエラーが throw される
- [ ] `pnpm run db:generate` が `src/db/migrations/0001_*.sql` と
      `meta/0001_snapshot.json` を生成し、`git diff src/db/migrations/0000_lethal_alice.sql` が空
- [ ] `pnpm run check`(typecheck / lint / test / content 検証)が、
      `src/content/index.ts` が空配列のままで通る
- [ ] シミュレータでアプリを一度削除してから起動すると、クラッシュせず
      `learningkanjimobileapp://db-debug` が migrations `ok` と 9 表の行数を表示する
      (`sentence_lines = 0`)
- [ ] `src/content/index.ts` に漢字 1 件・会話文 1 件(segments 付きの 2 行)を一時的に足して
      再起動すると db-debug が `sentence_lines = 2` を表示し、**もう一度再起動しても増えない**。
      確認後、一時データは削除してコミットしない
- [ ] `/`(`ThemePreview`)の見た目が変更前と同一。ふりがな・ハイライト・折り返しが変わっていない
- [ ] `docs/content-spec.md` に、セグメント分割の粒度(折り返し・読みの付け方・新出漢字を
      単独セグメントにする)が原稿執筆者向けの手順として書かれており、
      `docs/会話文集.md` の未確定事項から「ふりがなデータ形式」が消えている

## テスト方針

**Jest では expo-sqlite を動かさない**(db-foundation と同じ制約)。
テストは純粋ロジックに寄せ、DB に触る部分はシミュレータで見る。

### ユニットテストを書くもの

| 対象 | 見るもの |
|---|---|
| `src/content/segments.test.ts` | `segmentsToText` / `segmentsToKana`(reading 省略・句読点・カタカナ・空配列) |
| `src/content/validate.test.ts` | `checkLineSegments` の各 error / warning をフィクスチャで 1 つずつ。既存ルールが壊れていないこと |
| `src/db/mappers.test.ts` | `segments` JSON の往復、壊れた JSON、配列でない値、要素の形不正。いずれもエラーメッセージに行 ID と列名が入ること |
| `src/features/reading/segments.test.ts` | `toFuriganaSegments` の focus 付与(単一字・複数字・対象なし・同じ字が複数セグメントに出る場合) |

`src/features/reading/segments.test.ts` は `FuriganaText`(React)を import しない。
`mappers.test.ts` は従来どおり `@/db/client` に到達させない。
`validate.test.ts` は**実データを参照しない**(`src/content/CLAUDE.md` の規約)。

### シミュレータで手動確認するもの

- マイグレーション `0001` の適用(アプリ削除 → 初回起動 → db-debug が `ok`)
- 一時データを入れたときのシード(`sentence_lines = 2`)と冪等性(再起動で増えない)
- `ThemePreview` の描画が変わっていないこと(セグメント境界での折り返し・ハイライト)

UI コンポーネント(`FuriganaText`)の自動テストは今回書かない。型定義の変更のみで
描画ロジックに手を入れないため、目視確認で足りる。

## リスク・未確定事項

- **セグメントはローマ字の分かち書きを「解決しない」。** 送り仮名がセグメント境界をまたぐため、
  `たくさん / 歩(ある) / きましたね。` を素朴に連結すると `takusan aru kimashita ne.` になり、
  `arukimashita` にならない。次のローマ字タスクは
  (a) 行単位の手書きローマ字を維持する、(b) 「読みを持つセグメントは次のかなセグメントと 1 語に結合する」
  という結合規則を入れる、(c) セグメントに語境界フラグを足す、のいずれかを選ぶことになる。
  **今回は決めない**。(c) を選んでも JSON 列なのでマイグレーションは不要。
- **`pnpm run db:generate` が対話プロンプトを出す可能性がある**(列の削除+追加をリネームと
  誤認するケース)。非対話シェルで実行すると止まるため、実装時は対話端末で実行する。
  生成 SQL が既存行のある DB に適用できない形(`ADD COLUMN ... NOT NULL` に既定値なし)なら、
  **SQL を手で直さず**スキーマ側で調整して再生成する(絶対規則 6)。
  開発端末には db-foundation の受け入れ確認で入れた行が残っている可能性があるため、
  シミュレータ確認はアプリ削除から始める。
- **`japanese` と `segments` の重複は残る。** 一致は検証で縛るが、原稿から手で写す作業が
  1 行につき 2 回発生する。58 文 145 行のコストは許容する判断。
  苦痛が大きければ、実データ投入タスクで「segments から `japanese` を生成する」方向に
  倒すことも可能(型からフィールドを 1 つ消すだけで、検証 5 箇所の修正が要る)。
- **セグメント分割は人手。** 形態素解析を入れないので、分割の質は原稿執筆時のレビューに依存する。
  10 文字超の警告と `japanese` 一致検査で機械的に拾えるのは「はみ出し」と「写し間違い」だけで、
  「文節として不自然な切り方」は拾えない。`content-auditor` の観点に追加するかは実データ投入時に判断する。
- **10 文字という警告閾値の根拠は概算。** 吹き出しの実効幅 208pt(`maxWidth 236` − 左右 `padding 14`)を
  桜テーマの `jaSize 17.5` で割ると約 11.8 字。端末の文字サイズを上げるとさらに減るため、
  実データを入れて実機で見たあとに調整する余地がある(閾値は定数 1 つ)。
- **`FuriganaSegment` が交差型になることで、意図しない構造的代入が通る。**
  `LineSegment` をそのまま `FuriganaText` に渡せてしまうが、これは実際に使いたい経路なので許容する。
  逆に `focus` 付きの値がコンテンツ側に紛れ込む経路は、`src/content` に `focus` が
  1 件も無いこと(受け入れ条件)で見張る。
- **`docs/会話文集.md`(stock)を書き換える。** 変えるのは未確定事項のチェックリスト 1 行のみで、
  原稿本体には触れない。
- **`.claude/skills/add-content/SKILL.md` を更新しないと、次のコンテンツ投入タスクが
  旧形式で書き始める**。ドキュメント更新を「ついで」にせず、実装ステップに含めている理由がこれ。

### 絶対規則の自己点検

| 規則 | 点検 |
|---|---|
| 1 色のハードコード禁止 | 新規 UI なし。`furigana.tsx` は型定義のみ変更 |
| 2 主キーは ULID | `sentence_lines.id` の採番方法は変更なし |
| 3 全テーブルに `created_at` / `updated_at` | 列の追加/削除は `segments` / `furigana` のみ |
| 4 コンテンツとユーザー状態の分離 | 触るのはコンテンツ表 1 つ。ユーザー状態表は無変更 |
| 5 `review_events` は追記のみ | 対象外(触らない) |
| 6 migrations を手編集しない | `0001` を生成し、`0000` は書き換えない。生成 SQL が不都合ならスキーマ側で直す |
| 7 UI 文言は英語 | 新しい UI 文言なし。セグメント内の日本語は学習コンテンツ本体 |
| 8 ライブAI生成をしない | セグメント分割は原稿執筆時の人手作業 |
| 10 推測クイズを SRS に入れない | 対象外 |
| 11 読み変化の演出は 1 回だけ | 対象外(`focus` は演出カードではなくハイライト) |

---

## 実装後の記録(2026-08-28)

### プランの記述で誤っていたもの

- **`ADD COLUMN ... NOT NULL` は「行があると失敗、空なら成功」だった。**
  プランは「既存行がある DB でも適用できる形か確認する」とだけ書いていたが、
  実際に `sqlite3` で確かめると、空のテーブルには既定値なしでも追加できる。
  つまり 0000→0001 の間ずっとコンテンツが空だったこのリポジトリでは、
  既定値なしでも全端末で通る状態だった。それでもプランに従って既定値を付けたのは、
  「たまたま通る」に依存せず、後からどの端末で当たっても壊れない形にするため。

### 承認済みスコープから外れて触ったもの

- **なし。** `src/db/seed.ts` と `src/db/queries/content.ts` は予定どおり無変更で通った。

### 実装中に決めたこと

- **`segments` 列に既定値 `'[]'` を付けた。** 上記のマイグレーション制約のため。
  副作用として drizzle の `$inferInsert` で `segments` が省略可能になり、
  `toSentenceLineRow` の入れ忘れを型で防げなくなった。代わりに
  `mappers.test.ts` の `asSelectedLine` が `undefined` を検出して落とすようにしてある。
- **`drizzle-kit drop` が途中で失敗する。** `.sql` とスナップショットは消すが
  `_journal.json` と `migrations.js` の巻き戻しに失敗して止まる。
  生成物は追跡下にあるので `git checkout --` で戻した。
- **`db:generate` は列の削除+追加を「リネームか?」と対話で聞いてくる。**
  非対話シェルでは止まるので `expect` 経由で「create column」を選んだ。

### 受け入れ条件のうち、文言どおりには 0 件にならなかったもの

- `rg "furigana" src/content src/db --glob '!migrations'` は **2 件残る**。
  `src/content/segments.ts` の「平坦なふりがな文字列(旧 `Line.furigana`)は持たなくなった」と、
  `src/content/types.ts` の「`src/features/reading/furigana.tsx` の制約」で、
  どちらもコメント。フィールドや列の実体ではない。
  同様に `rg "focus" src/content` も `types.ts` のコメント 1 件が残る。
  **識別子としての実体は両方とも 0 件**であることを
  `rg "furigana\s*[:?]|'furigana'|\.furigana"` と `rg "focus\s*[:?]"` で確認した。
  条件の書き方が「なぜそうしたか」を書いたコメントまで禁じる形になっていた。

### シミュレータ確認の結果(iPhone 17 Pro / iOS 26.5)

レビューで指摘された順序(削除する前にアップグレード適用を見る)で実施し、**全項目を確認した**。

**1. アップグレード経路(削除せず上書き)**

端末には 0000 のみ適用済みの DB が残っていた(`furigana` 列あり、`review_events` が1件)。
既定値を付けた理由そのものを実機で通すため、**上書き前に `sentence_lines` へ行を1件注入**してから
アップグレードした。結果:

- 0001 が適用され、`furigana` 列が消えて `segments` 列が入った
- **注入した行が `segments = '[]'` で生き残った**(行がある表への `ADD COLUMN` が通った)
- `review_events` は 1 件のまま。マイグレーションでユーザー状態が消えていない

**2. シードと冪等性**

一時コンテンツ(漢字1件・会話文1件・segments 付きの2行)を入れて再起動:

- `kanji = 1` / `sentences = 1` / `sentence_lines = 2`
- `segments` が `[{"text":"三","reading":"さん"},{"text":"人","reading":"にん"},{"text":"です。"}]`
  として正しく格納された
- 注入しておいた行は再シードで消えた(コンテンツ系は丸ごと入れ替わる)
- **もう一度再起動しても行 ID が変わらない**(指紋が同じなので再シードが走っていない)
- 一時コンテンツを撤去して再起動すると、コンテンツ系だけが 0 に戻り、
  `review_events = 1` / `user_settings = 1` は保持された(絶対規則4が実際に効いている)

**3. 初回インストール(削除して入れ直し)**

0000 + 0001 が空の DB に連続適用され、クラッシュせず起動。マイグレーション2件、
スキーマは `furigana` なし / `segments` あり。

**4. 画面**

- `ThemePreview` の描画は変更前と同一。2つ目の吹き出し(`毎日` / `歩` / `元気`)も含めて、
  ふりがな・ハイライト・セグメント境界での折り返しが崩れていない
- `db-debug` は migrations `ok`、指紋、9テーブルの行数をコンテンツ/ユーザー状態に分けて表示。
  文言はすべて英語
- コンソールのエラーは0件。警告2件はいずれも今回の変更と無関係
  (RevenueCat の Test Store 警告 = 本番キー差し替えが別タスク、Reanimated の既知ノイズ)

確認後、一時コンテンツは撤去済み(`git status` で `src/content/index.ts` に差分なし)。
`pnpm run check` も再実行して全通過。

### レビュー指摘への対応

`reviewer` の判定は**合格**(ブロッカーなし)。改善提案4件をすべて修正した。

1. `toSentenceLineRow` の戻り型を `typeof sentenceLines.$inferInsert & { segments: string }` に
   締めた。既定値を残したまま入れ忘れを型で防げるようになり、上記の副作用は解消した。
   `segments` を代入する行を消すと `tsc` が落ちることを実測で確認済み
2. `docs/content-spec.md` の warning 表に `checkLineSegments` を追加(error 表にしか
   載っておらず、warning を3種類出すことが書かれていなかった)。同じ行の「下記」→「上記」も修正
3. この記録の残存コメント件数を 1 件 → **2 件**に訂正(`types.ts` の分を数え落としていた)
4. 連結不一致のテストに、メッセージへ会話文 ID と行番号が入ることの assert を追加

### シミュレータ確認の順序(レビューでの指摘)

**実装ステップ13「先にアプリを削除してから入れ直す」だけでは不十分。**
削除すると 0000 と 0001 が空の DB に連続適用されるだけで、
`segments` に既定値 `'[]'` を付けた理由(行がある表への `ADD COLUMN`)を一度も通らない。
唯一検証すべきケースを検証しないまま終わる。正しい順序は次の2段階。

1. **削除せずに起動する。** db-foundation の確認で行が残っている端末なら、
   0001 のアップグレード適用と、既存行の `segments` が `'[]'` になることを db-debug で見る
2. **そのあとで削除して入れ直す。** 初回インストール経路(0000+0001 の連続適用)を見る

また `ThemePreview` は2つ目の吹き出し(`毎日` / `歩` / `元気`)も見ること。
`toFuriganaSegments` のテストが一致を保証しているのは1行目だけ。

### 次のタスクへの申し送り

- **ローマ字の分かち書きは未解決のまま。** 送り仮名がセグメント境界をまたぐため
  (`歩(ある)` + `きました`)、セグメントを素朴に連結しても `arukimashita` にならない。
  次のローマ字タスクで (a) 行単位の手書き / (b) 結合規則 / (c) 語境界フラグ から選ぶ。
- `docs/会話文集.md` の未確定事項に「各文の『新出漢字はどれか』のデータ持ち方」が残っているが、
  これは `Sentence.newKanjiId` で既に解決済みに見える。実データ投入時に確認して閉じる。
