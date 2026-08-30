# プラン: 読み変化の演出

作成日: 2026-08-30
ステータス: 完了
要件定義書の対応箇所: 4.6(ステップ1・2)、4.1-5(第2段階)、5.2(表記)、5.1-5

## 先に指摘したいこと(要件・データとの食い違い)

実装案の前に4点。**要件を勝手に解釈で変えてはいない。**違う判断をしたいなら承認前に指摘してほしい。

1. **要件4.6 のカードの絵は日本語ラベル(`[訓読み]` `[音読み]`)だが、絶対規則7(UI文言は英語)と衝突する。**
   → ラベルは **`Kun` / `On`** にする。カードに出る日本語は学習コンテンツ本体(漢字・かな)だけにする。
   `Same kanji, different reading!` は要件の文言をそのまま使う。

2. **要件のカードは右側の読みが1つ(`そら → くう`)だが、実データ #17 は1字が語中で2回別読みになる**
   (`日曜日` = **にち**・よう・**び**)。1つに絞ると画面に見えている `び` がカードから消える。
   → 右側は**出現順の並び**(`ひ → にち・び`)にする。要件の矛盾ではなく、実データが要求する一般化。

3. **要件4.6 ステップ3(樹への反映アニメーション)は作れない。** `features/tree/` が存在せず、
   漢字の樹そのものが未着手。**削除ではなく順序を後ろにするだけ**で、後から差し込む口を残す(下記スコープ外)。

4. **要件は「ハイライトをタップするとカードがせり上がる」だが、タップ対象は演出行の吹き出し全体にする。**
   ふりがな付きセグメントは幅が10〜20pt しかなく、単独では iOS の 44pt タップ領域を満たせない。
   ハイライトを押せばカードは出るので要件は満たしており、その周囲のタップも受けるだけ広げている。

## 目的

第2段階の会話文(#17「日曜日」)で、**同じ `日` が `ひ` → `にち`/`び` と読みを変えたことを、
ハイライト＋★バッジ＋種明かしカードで学習者に見せる**(要件4.6 ステップ1・2)。

**このプランのもう半分の目的は、残り7回を書く前にデータ形式を実物で確定させること。**
UI を作った結果 `Reencounter` / `KanjiEntry.readings` に何が足りないかを判定し、
足りない分は**型ではなく検証ルール**で埋める(判断の根拠は下記)。

## 設計判断(依頼の6点への回答)

### 1. `Reencounter` の型は変えない

**開発者の見込み(「`kanjiIds` でどの字か、セグメントの `reading` でその場の読みが引ける」)は成立する。**
ただし**1箇所だけ穴があり、そこは検証ルールで塞ぐ**。

穴: `Reencounter` は**どの行が演出行かを持たない**。カードの右側の読みも、★バッジの位置も、
演出行が特定できないと決まらない。

穴の塞ぎ方の候補:

| 案 | 判定 |
|---|---|
| **A. `word` を含む行を演出行とし、「ちょうど1行」を検証ルールで保証する** | **採用** |
| B. `Reencounter` に `lineIndex: number` を足す | 却下 |
| C. `Reencounter` に変化後の読みを直接持たせる | 却下 |

- **B を却下する理由**: `lines` 配列への添字は、行を1つ挿入した瞬間に黙って別の行を指す。
  手書きデータで最も壊れやすい種類のフィールドで、結局「本当にその行か」を検証することになる。
  それなら最初から `word` で引けばよい。
- **C を却下する理由**: `segments` と二重管理になり、ずれたときに**画面とカードが食い違う**という
  最悪の壊れ方をする。セグメントから引けば定義上ずれない。
- **A の前提**(演出語が2行に出ると曖昧になる)は、`checkReencounterRevealLine`(新規 error)で機械保証する。
  既に `checkReencounterLineCleanliness` が `line.japanese.includes(r.word)` で演出行を探しており、
  **同じ引き方をコードベースが既に採っている**。

**残り7回の執筆に課される形式**(これが今回確定させるもの):

- 演出語(`word`)は、その回の**ちょうど1行**に現れること。ミアが復唱する行は**かなで書く**
  (#17 が「きょう」をかなで書いて演出を守っているのと同じ手)
- 演出行の**語の範囲内は1字1セグメント**に割り、**全セグメントに `reading` を付ける**こと
  (`日`/`曜`/`日` のように。`{text:'日曜日', reading:'にちようび'}` は error)
- 対象字の `KanjiEntry` に訓読みが登録されていること(`kun-first`。既存 `checkReadingIntroduction` が担保)

**#17 の既存データは1文字も変更不要。** そのまま新ルールを通る。

### 2. `KanjiEntry.readings` も変えない(`び` / `げん` は登録しない)

カードの**左側(変化前)は `readings` の訓読み**、**右側(変化後)は演出行のセグメントの読み**から引く。
役割が分かれているので `び` を `readings` に足す必要がない。むしろ足すと、
画面に出ている読みとカードの読みの出所が2つになり、ずれる余地が生まれる。

- 右側のラベルを `On` に固定してよい根拠: 第2段階の対象字は `checkReadingIntroduction` により
  `on-only` を弾かれ、決定事項4章が「訓読みを先、音読みを後」と定めている。8回すべて音読み
  (`日曜日`/`水曜日`/`時間`/`休日`/`大学`/`学生`/`新聞`/`外国`)。`び` は連濁した音読み。
- 現在24字すべてが「訓1・音1」ちょうど。左側は `readings` の最初の `kun` を採る。
- 樹(4.5)の枝色は `Word.readingType` で決まるので、樹のためにも `readings` の追加は要らない。

### 3. ★バッジの出し方とタップ対象

- **★は演出行の、対象字を含む最初のセグメントの上に1つだけ**出す。行1の `日`(ひ)には出さない
  (★が「読みが変わった場所」を指すため)。`FuriganaSegment` に `badge?: boolean` を足す。
- **タップ対象は演出行の吹き出し全体**(`Pressable` で包む)。上記「先に指摘したいこと」4 の通り。
- **VoiceOver**: `FuriganaText` は行全体を1要素にまとめている(`accessible` +
  `accessibilityLabel` に本文を連結)ので、そのまま `Pressable` で包むとボタンとラベルが二重になる。
  `FuriganaText` に `groupForAccessibility?: boolean`(既定 true)を足し、
  押せる行では false にして、`Pressable` 側が
  `accessibilityRole="button"` / `accessibilityLabel={line.japanese}` /
  `accessibilityLanguage="ja-JP"` / `accessibilityHint="Shows why this kanji is read differently"` を持つ。

### 4. ステップ3(樹への反映)は今回入れない

`features/tree/` が無いので、閉じたあとに生やす枝が存在しない。
**「押しても何も起きないボタンを置くくらいなら置かない」**(`conversation-screen.md` の既存判断)に従い、
`See the tree` のような CTA も置かない。

後から差し込めるように残すもの:

- カードの閉じ処理を `RevealCard` の `onClose` 1本に集約し、`ConversationView` 側の1関数に閉じる
  (樹のアニメーションはここに足す)
- `RevealCard` はナビゲーションを知らない純粋な表示コンポーネントにする
- `日曜日` の `Word` 行は既に `encounteredInSentenceId: S.s17` を持っており、
  **生やすべき葉はデータ上すでに存在する**ことをコメントに残す

### 5. 絶対規則11(演出は1回だけ)の実装

- **記録するのはカードを開いた瞬間**(閉じた時ではない)。閉じる経路が3つ(`Got it` / 暗幕タップ / 画面ごと戻る)
  あり、開くのは1経路しかないため。見た直後に強制終了しても「初めて」に戻らない。
- **2字同時の回は「カード1枚 = 1単位」として扱う**。カードの中身は語の組み立て(とき＋あいだ→じかん)で
  分割できないため。
  - ★を出す条件: 対象字の**どれか1つでも**未記録
  - 開いたときの記録: 対象字を**すべて**記録
  - なお計画中の8回で対象字は全て相異なる(日/水/時/間/休/大/学/生/聞/外/国)ので、
    「片方だけ既出」は現データでは発生しない。上のルールはその前提が崩れたときの規定。
- **同じ画面滞在中は再タップで開き直せる**。「見たか」は画面マウント時に1回だけ読む。
  規則11 が禁じているのは「毎回勝手に出る」ことで、誤って閉じた直後に開き直せないのは別の話。
  **一覧に戻って入り直すと★は消え、吹き出しは押せなくなる**(ハイライトだけが残る)。

### 6. 発火場所

`src/app/conversation/[id].tsx` は `listKanji()` を足して `ConversationView` に
`kanji: KanjiEntry[]` を渡すだけにする(ロジックは feature 側)。
`ConversationView` が `revealFor(sentence, kanji)` を呼び、★・タップ・カードの状態を持つ。
`hasRevealShown` / `markRevealShown` は features から呼んでよい
(`docs/architecture.md` のレイヤ順 `features → db` に合致)。

## スコープ外

**今回やらないこと。迷ったら小さい方に倒し、以下は明示的に次回以降へ送る。**

- **要件4.6 ステップ3(樹への反映アニメーション)。** `features/tree/` を作らない。
  カードに樹への導線・CTA も置かない(上記4)
- **ふりがなが親字より横に長いときの字間**(`conversation-screen.md`「次に送るもの」)。
  **今回入れない。** 理由は (a) `furigana.tsx` の字間を変えると58文すべての見え方が変わり、
  カードの受け入れ判定と混ざる、(b) 1ブランチ1プラン。
  ただし #17 の演出行は `日`/`にち`・`曜`/`よう` と**この問題が最も強く出る行**なので、
  実機確認に「どう見えるかを記録する」項目だけ入れる(直さない。次のプランの材料にする)
- **第1段階(`stage: 1`)の演出。** 要件4.6 は第2段階のためのもので、実データにも `stage: 1` はまだ無い。
  `revealFor()` は `stage === 2` だけを見る
- **カードにローマ字を出す。** 右側の読みはセグメント由来でローマ字を持たない。
  実行時に `src/content/romaji.ts` を呼ぶのはこのプランの目的ではない
- **カードに語の英訳(`Sunday`)を出す。** `Word` テーブルの参照が増える。
  吹き出しの下に英訳が出ているので情報としては足りている
- **Reanimated の導入。** RN 標準の `Animated`(`useNativeDriver: true`)で足りる
- **`@expo/ui` の `BottomSheet`。** SwiftUI ホストの中に明朝＋自前ルビのカードを載せる構成は
  このリポジトリで未検証。カードの中身は完全に自前なので恩恵が薄い
- **RN の `Modal`。** 画面内のオーバーレイにする(下記「カードの出し方」)
- **演出をリセットする開発用UI。** 再確認はアプリを削除して入れ直す(受け入れ条件に入れてある)
- **漢字フォーカス画面 / SRS / 推測クイズ / 課金による章ロック / オンボーディング**
- **一覧画面の作り込み**(SRS の回に「今日の学習」へ置き換わる暫定物)
- **テーマトークンの追加。** 暗幕は `theme.text` に透明度を掛けて描く。
  `scrim` トークンを足すと `docs/requirements.md` 5.3 の表と `architecture.md` の
  トークン一覧まで書き換えることになるため、今回は増やさない
- **UIコンポーネントの自動テスト**(既存方針どおり純粋ロジックに集中する)

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/reading/reveal.ts` | 新規 | 純粋関数 `revealFor(sentence, kanji): Reveal \| null`。演出行の特定・語のかな組み立て・字ごとの変化前後の読み・★の位置を1関数で決める |
| `src/features/reading/reveal.test.ts` | 新規 | 上記のユニットテスト(このプランのテストの主戦場) |
| `src/features/reading/reveal-card.tsx` | 新規 | 種明かしカード。`Reveal` と `onClose` だけを受ける表示専用。`Animated` でせり上がりとフェード |
| `src/features/reading/use-reveal-seen.ts` | 新規 | `hasRevealShown` / `markRevealShown` を包む薄いフック。DB読みは `useState` の遅延初期化 |
| `src/features/reading/focus.ts` | 変更 | `newKanjiId` が null のとき `revealFor()` の対象字を返すようにする(関数の doc コメントが元から予告している挙動) |
| `src/features/reading/focus.test.ts` | 変更 | 「第2段階の回は空を返す」を「演出が成立するなら対象字を返す / 成立しないなら空」に置き換える |
| `src/features/reading/segments.ts` | 変更 | `toFuriganaSegments(segments, focusCharacters, badgeIndex?)` に第3引数を足す |
| `src/features/reading/segments.test.ts` | 変更 | badge 付与のケースを追加 |
| `src/features/reading/furigana.tsx` | 変更 | `FuriganaSegment` に `badge?: boolean`、`FuriganaText` に `groupForAccessibility?: boolean` を追加。★の描画 |
| `src/features/reading/conversation-view.tsx` | 変更 | props を `newKanji` から `kanji: KanjiEntry[]` に変更。演出行の吹き出しを押せるようにし、カードを重ねる |
| `src/app/conversation/[id].tsx` | 変更 | `listKanji()` を引いて `kanji` を渡す(150行未満を維持) |
| `src/content/validate.ts` | 変更 | `checkReencounterRevealLine`(error)を追加し `RULES` に登録 |
| `src/content/validate.test.ts` | 変更 | 上記のフィクスチャベースのテスト |
| `docs/content-spec.md` | 変更 | 「第2段階のデータ構造」に**演出行の書き方**を追記。error の表に1行追加 |
| `src/content/CLAUDE.md` | 変更 | 「絶対に守ること」に演出行の形式を1項目追加(残り7回を書く人が最初に読む場所のため) |

**変更しないもの(実装時にそうなっていることを確認する):**
`src/content/types.ts`、`src/content/index.ts`、`src/db/**`(スキーマ・マイグレーション・クエリ)、
`src/theme/**`、`src/features/settings/**`、`src/features/reading/conversation-list.tsx`、
`character-avatar.tsx`、`furigana-metrics.ts`、`src/app/index.tsx`、`src/app/_layout.tsx`、
`docs/requirements.md`、`docs/content-decisions.md`(flow なので書き換えない)。

## データモデルの変更

**なし。** `pnpm run db:generate` を実行せず、`src/db/migrations/` にファイルを増やさない。

必要なものは全部そろっていることを確認済み:

| 必要なもの | 既存のもの |
|---|---|
| 演出を出したかの記録 | `reveal_shown` テーブル(`kanji_id` に UNIQUE) |
| 読み書き | `hasRevealShown(kanjiId)` / `markRevealShown(kanjiId)`(`@/db` から公開済み) |
| 会話文と行 | `getSentence(id)` |
| 漢字(対象字と新出字) | `listKanji()` |

`Reencounter` / `KanjiEntry` の型も変えないので、シード・マッパー・型ガードは無変更。

## カードの出し方(実装の要)

**RN の `Modal` を使わず、`ConversationView` の中に絶対配置のオーバーレイとして置く。**

- `Modal` は別のネイティブルートに描かれるため、`react-native-safe-area-context` の inset が
  正しく取れないという既知の問題がある(下端の余白がカードで最も効く場所)。
  画面内オーバーレイなら `useSafeAreaInsets()` がそのまま使える
- `animationType="slide"` の `Modal` は暗幕ごとせり上がるので、暗幕はフェード・カードはスライドという
  要件の見え方(「カードがせり上がる」)を作れない
- 代償: **カードを開いたまま端からスワイプすると画面ごと戻れる**。カードも一緒に消えるだけで
  壊れないので受け入れる(受け入れ条件に入れる)

構造:

```
<View style={{ flex: 1 }}>
  <ScrollView> …会話… </ScrollView>
  {reveal !== null && open ? <RevealCard reveal={reveal} onClose={…} /> : null}
</View>
```

- 暗幕: `StyleSheet.absoluteFill` + `backgroundColor: theme.text` + `Animated` の opacity(0 → 0.4)。
  `Pressable` で閉じる。**色は必ずトークン経由**(規則1)
- カード: 下端に寄せ、`translateY`(高さ → 0)と opacity を `Animated.parallel` で 220ms。
  閉じるときは 160ms の逆再生後に `onClose`
- `useNativeDriver: true`。`Animated.Value` は `useRef` で持つ(React Compiler がメモ化しても壊れない)

カードの中身(すべて `theme` トークン、UI文言は英語):

```
 ┌─────────────────────────────┐
 │      日曜日                  │  ← 対象字だけ accent、他は text
 │      にちようび               │  ← textMuted
 │  ─────────────────────       │
 │      日   day, sun           │
 │   ひ   →   にち・び           │
 │  Kun         On              │
 │  ─────────────────────       │
 │  Same kanji, different       │
 │  reading!                    │
 │  The meaning stays the same. │
 │        ( Got it )            │  ← radius.pill / accent / onAccent
 └─────────────────────────────┘
```

2字の回(`時間`)は中央のブロックが2つ縦に並ぶ。footer の2行は共通で1回だけ出す
(要件の絵は意味を footer に埋めているが、2字だと繰り返しになるため意味は字の横に置いた)。

## 実装ステップ

1. `src/content/validate.ts` に `checkReencounterRevealLine` を書き、`RULES` に足す。
   `validate.test.ts` にフィクスチャを添える。**先にここをやる**のは、これが通ることが
   `revealFor()` の前提条件だから。`pnpm run validate:content` が #17 で通ることを確認する
2. `docs/content-spec.md` と `src/content/CLAUDE.md` に演出行の書き方を追記する
3. `src/features/reading/reveal.ts` に `revealFor()` を書き、`reveal.test.ts` を先に埋める
4. `src/features/reading/focus.ts` を `revealFor()` にフォールバックさせ、`focus.test.ts` を直す
5. `segments.ts` に `badgeIndex` を足し、`furigana.tsx` に `badge` / `groupForAccessibility` を足す。
   ★は `theme.accent` の小さな `Text`。**行の高さを変えない**
   (ふりがなの `height` は `furiganaMetrics` が決めており、ここが変わると全文の組みが崩れる)
6. `use-reveal-seen.ts` を書く。`useState(() => ids.some(id => !hasRevealShown(id)))` で
   「まだ出せるか」を1回だけ読み、`markSeen()` で全 id を `markRevealShown` してから state を落とす
7. `reveal-card.tsx` を書く
8. `conversation-view.tsx` を組み替える(props 変更 → 演出行の `Pressable` → オーバーレイ)
9. `src/app/conversation/[id].tsx` を `listKanji()` に差し替える
10. `pnpm run check` を通す
11. iOS シミュレータで確認(`attach` → `build` → `launch`)。下の実機チェックを全部見る
12. `reviewer` と `content-auditor`(`validate.ts` を触ったため)にかけ、通ったら `/log`

## 受け入れ条件

### コード上で確認できること

- [ ] `git diff src/content/types.ts src/content/index.ts` が空
      (**`Reencounter` と `KanjiEntry.readings` を変えずに演出が成立している**ことの証明)
- [ ] `git diff --stat src/db` が空。`src/db/migrations/` にファイルが増えていない
- [ ] `rg "#[0-9a-fA-F]{3,8}" src/features/reading src/app` が0件(絶対規則1)
- [ ] `rg "rgba?\(" src/features/reading` が0件(暗幕も含めて色は全てトークン経由)
- [ ] `rg "訓読み|音読み" src/features src/app` が0件(絶対規則7)
- [ ] `rg "expo-router" src/features` が0件
- [ ] `rg "markRevealShown" src/features src/app` が **1ファイル1箇所**
      (`use-reveal-seen.ts` のみ。記録点が散らない)
- [ ] `rg "insertReviewEvent|quizAttempts|quiz_attempts" src/features/reading` が0件
      (絶対規則5・10。演出は SRS でもクイズでもない)
- [ ] `src/app/conversation/[id].tsx` が150行未満
- [ ] `pnpm run validate:content` が error 0件で通る(#17 が新ルールを無修正で通る)

### テストで担保すること

`revealFor()` に #17 と同じ形のフィクスチャを渡したとき:

- [ ] `word: '日曜日'` / `wordKana: 'にちようび'` / `lineIndex: 1` / `badgeSegmentIndex: 0` を返す
- [ ] `kanji` が1件で、`character: '日'` / `from: 'ひ'` / `to: ['にち','び']` / `meaning` が入っている

境界:

- [ ] `stage: 2` の再登場が無い回では `null` を返す
- [ ] 演出語が**どの行にも無い**回では `null` を返す(例外を投げない)
- [ ] 演出語が**2行に現れる**回では `null` を返す(どちらか分からないまま描かない)
- [ ] 語が `{text:'日曜日', reading:'にちようび'}` の1セグメントになっている回では `null` を返す
- [ ] 対象字の `KanjiEntry` が見つからない / 訓読みが登録されていない回では `null` を返す
- [ ] `時間` 形(2字)のフィクスチャで `kanji` が2件返り、`to` が `['じ']` と `['かん']` に分かれる
- [ ] **語の範囲外にある同じ字の読みを拾わない**(`日曜日だよ。いい日だね` で `to` が `['にち','び']` のまま)
- [ ] 語中で同じ読みが2回出る場合は重複を除く

`focusCharactersFor()`:

- [ ] `newKanjiId` がある回は従来どおり新出字1字を返す(既存テストが無修正で通る)
- [ ] `newKanjiId: null` かつ演出が成立する回では対象字(`['日']`)を返す
- [ ] `newKanjiId: null` かつ演出が成立しない回では `[]` を返す

`toFuriganaSegments()`:

- [ ] 第3引数に index を渡すと**その位置のセグメントにだけ** `badge: true` が付く
- [ ] 第3引数が `undefined` / 範囲外のときは1つも `badge` が付かない
- [ ] 元の配列を書き換えない(既存の不変条件が維持される)

`checkReencounterRevealLine()`:

- [ ] 演出語が0行 / 2行に現れるフィクスチャで error を返す
- [ ] 語の範囲内に複数字のセグメントがあるフィクスチャで error を返す
- [ ] 語の範囲内に `reading` の無いセグメントがあるフィクスチャで error を返す
- [ ] #17 と同じ形のフィクスチャでは1件も返さない
- [ ] `stage: 1` の再登場には反応しない
- [ ] `pnpm run check` が通る

### 実機(iOSシミュレータ)で確認すること

**実データは #17 の1件しかない前提。2字同時の回はテストのフィクスチャでしか見られない。**

ステップ1(バッジとハイライト):

- [ ] 一覧の `17` の行(見出しが `日曜日`)を開くと、`日` が**3箇所**光る
      (1行目 `ひ` / 2行目 `にち` / 2行目 `び`)。`曜` は光らない
- [ ] **★は2行目の最初の `日` の上にだけ1つ**出る。1行目の `日` と2行目の `び` の上には出ない
- [ ] ★が付いても2行目の行の高さと折り返し位置が、★を消したときと変わらない
- [ ] 1行目の吹き出しをタップしても何も起きない

ステップ2(カード):

- [ ] 2行目の吹き出しをタップすると、暗幕がフェードインし、カードが下からせり上がる
- [ ] カードに `日曜日`(`日` だけがアクセント色) / `にちようび` / `日 day, sun` /
      `ひ → にち・び` / `Kun` / `On` /
      `Same kanji, different reading!` / `The meaning stays the same.` / `Got it` が出る
- [ ] カードに日本語のUI文言が1つも無い(出ている日本語は漢字・かなの学習コンテンツだけ)
- [ ] カードの下端が iPhone のホームインジケータに被らない
- [ ] `Got it` でも暗幕タップでもカードが閉じ、会話文に戻る
- [ ] **閉じた直後に同じ吹き出しをもう一度タップすると、カードがまた開く**(同じ画面滞在中は開き直せる)

絶対規則11:

- [ ] `Back` で一覧に戻り、**#17 をもう一度開くと ★ が消えている**。`日` は3箇所とも光ったまま
- [ ] そのとき2行目の吹き出しをタップしても**カードが出ない**
- [ ] アプリを終了して再起動しても ★ は出ない(`reveal_shown` に永続している)
- [ ] アプリを削除して入れ直すと ★ が戻り、カードがまた出せる

回帰:

- [ ] #1〜#16、#18 以降のどれを開いても ★ が出ず、吹き出しをタップしても何も起きない。
      新出漢字のハイライトは従来どおり
- [ ] ローマ字を ON にしても、ハイライト・★・カードの見え方が変わらない
- [ ] VoiceOver を有効にして2行目に触れると、日本語の本文が1回だけ読まれ、
      ボタンであることとヒントが英語で読まれる(読みと本文が交互に読まれない)
- [ ] コンソールにエラーが0件(RevenueCat の Test Store 警告と Reanimated の既知ノイズを除く)

観察のみ(直さない。次のプランの材料にする):

- [ ] 2行目の `日`/`にち`・`曜`/`よう`・`日`/`び` の字間がどう見えるかを記録する
      (ふりがなが親字より横に長い問題。`conversation-screen.md`「次に送るもの」)

## テスト方針

**ユニットテストの主戦場は `src/features/reading/reveal.ts`。**
「演出行を特定し、字ごとに変化前後の読みを取り出す」という、この機能の判断がすべてここに集まる。
入出力が純粋(会話文 + 漢字一覧 → `Reveal | null`)で、React にも DB にも触れない。
**実機で見られるのが #17 の1件だけなので、2字同時・語が行の途中・語が2行に出る、といった
残り7回で必ず起きるケースはここでしか担保できない。** 上の受け入れ条件の分量をここに厚く配分する。

次に `src/content/validate.ts` の `checkReencounterRevealLine`。
既存の `validate.test.ts` の流儀どおり**フィクスチャベース**で書き、実データを参照しない。

`segments.ts` / `focus.ts` は既存テストに追記する。

**書かないもの:**

- `reveal-card.tsx` の描画テスト。せり上がり・暗幕・下端の余白は RTL では検出できず、
  実機で見るしかない(PR #10 の教訓)
- `use-reveal-seen.ts` のテスト。`hasRevealShown` / `markRevealShown`(テスト済みの層)への
  素通しで、独自の判断は「1つでも未記録なら出す / 出したら全部記録する」だけ。
  この判断は実機の「入り直すと★が消える」で観測できる

## リスク・未確定事項

- **「演出語はちょうど1行」という制約が、残り7回の執筆を縛る。**
  ミアが復唱する回(#45「確認する」/ #55「自分で組み立てる」)は、復唱をかなで書くことになる。
  #17 が既に「きょう」をかなで書いて演出を守っている前例があり、
  「ミアが音で組み立てている」ように読めるので教材としてもむしろ自然だが、
  **書いてみて窮屈すぎるなら退路は `Reencounter` に `lineIndex` を足すこと**(8件の追記で済む)。
  その判断は第3章を書くプランで行う
- **`to`(変化後の読み)が空になる形のデータを書くと、画面が黙って素の会話文になる。**
  `revealFor()` は壊れたデータで例外を投げず `null` を返す設計(画面を落とさないため)なので、
  **気づける唯一の場所が `checkReencounterRevealLine`**。ここを緩めない
- **★の描画が行の高さを押し上げる恐れ。** ふりがなの `height` は `furiganaMetrics` が決めており、
  ★を通常のテキストとして足すと段が増える。絶対配置か、ふりがな行の中に収める必要がある。
  **実装で最初に確認するのはここ**
- **暗幕に `theme.text` を使っている。** 桜テーマでは温かい暗褐色なので問題ないが、
  v2 の「東京の夜景」(濃紺)では暗幕がほぼ見えなくなる可能性がある。
  そのときは `scrim` トークンを足す(要件5.3 の表の更新を伴うので今回はやらない)
- **カードを開いたままスワイプバックできる。** `Modal` を使わない選択の代償。
  画面ごと戻るだけで壊れない
- **一度見ると実機で見直せない。** 再確認にはアプリの削除→再インストールが要る。
  デバッグ用のリセットは足さない(スコープ外)
- **`ConversationViewProps` を `newKanji` から `kanji` に変えるのは破壊的変更**だが、
  呼び出し元は `src/app/conversation/[id].tsx` の1箇所だけ
- **第2章は `isFree: false` だが課金判定が未実装**なので #17 は素で開ける。
  paywall の回でロックが入ると、この演出は購入者にしか見えなくなる(申し送り)
- **`docs/plans/conversation-screen.md` は完了済み(凍結)なので書き換えない。**
  「次に送るもの」のうち字間を今回やらないという判断は `/log` に残す

### 絶対規則の自己点検

| 規則 | 点検 |
|---|---|
| 1 色のハードコード禁止 | ★・カード・暗幕・CTA すべて `useTheme()` 経由。暗幕も `theme.text` + opacity。`rgba(` と16進の grep を受け入れ条件に入れた |
| 2 主キーは ULID | `markRevealShown` が既存の `newId()` で採番する。新しい採番経路を作らない |
| 3 全テーブルに created_at / updated_at | スキーマ変更なし |
| 4 コンテンツとユーザー状態の分離 | コンテンツは読むだけ。書くのは `reveal_shown`(ユーザー状態)のみ |
| 5 `review_events` は追記のみ | **一切触らない。** 演出は SRS ではない |
| 6 migrations を手編集しない | 生成も編集もしない |
| 7 UI文言は英語 | カードのラベルは `Kun` / `On`、文言は要件の英語をそのまま。要件の絵の日本語ラベルは規則7 を優先(冒頭で指摘済み)。画面の日本語は漢字・かなの学習コンテンツだけ |
| 8 ライブAI生成をしない | 静的データのみ。`fetch` を書かない |
| 9 サーバーを持たない | 通信なし |
| 10 推測クイズを SRS に入れない | クイズを実装しない。`quiz_attempts` に触らない |
| 11 演出は同じ漢字につき1回だけ | `hasRevealShown` で★とタップ可否を決め、開いた瞬間に `markRevealShown`。2回目以降はハイライトのみ。実機の受け入れ条件で観測可能にした |
| 12 iOSのみ | RN 標準の `Animated` / `Pressable` のみ。Android 固有コードなし |


## 実装後の記録(2026-08-30)

### このプランの筆頭目的は達成した

**`Reencounter` も `KanjiEntry.readings` も1文字も変えずに演出が成立した。**
`git diff src/content/types.ts src/content/index.ts` は空。
「`kanjiIds` でどの字か、セグメントの `reading` でその場の読みが引ける」という見込みは正しく、
足りなかった「どの行が演出行か」は `checkReencounterRevealLine`(error)で埋めた。

残り7回に課される形式は5つに増えた(プラン時点では2つ)。詳細は
`docs/content-spec.md`「演出行の書き方」。うち**5番目(折り返し2行目に落とさない)だけは
機械で検証できず、実機で目視するしかない**。

### プランの記述で誤っていたもの

- **★を「セグメントの上に1つ」と書いたが、右に逃がす実装は成立しなかった。**
  `position: absolute, right: -7` にしたところ、実機で**隣のセグメントの読みに重なった**
  (「にち★うび」となり `曜` の「よ」が隠れた)。ふりがな付きセグメントは幅に余白が無いので、
  横方向に出す限り必ず隣に当たる。読みの**真上**に移して解決。
  プランのリスク欄は「★が行の高さを押し上げる」縦方向しか想定していなかった
- **`useRef(new Animated.Value(0)).current` は lint(`react-hooks/refs`)で落ちる。**
  `useState` の遅延初期化に変えた(コードベースの他の箇所と同じ形)

### 承認済みスコープから外れて触ったもの

無し。`src/content/types.ts` / `index.ts` / `src/db/**` / `src/theme/**` はいずれも無変更。

### レビュー指摘への対応(6件すべて反映)

1. **`segments.test.ts` に badge のテストが1件も無かった。** `segments.ts` は実装ごと
   書き換わっている(早期 return を削って単一の map に統合)のに、`badgeIndex` の分岐が
   1行も実行されていなかった。5件追加
2. **`checkReencounterRevealLine` が2箇所緩かった。** どちらも「演出が黙って壊れる」型:
   (a) 1文に第2段階を2件書くと2件目が画面に一切出ない(`revealFor` は `find` で1件しか見ない)
   (b) 第2段階の回に新出字があると**★は出てカードも開くのに、読みが変わる字が光らない**
   (`focus.ts` が `newKanjiId === null` に黙って依存していた)。両方 error にしてテストを添えた
3. **★の `top` に `fontScale` を掛けていなかった。** `furigana-metrics.ts` が
   「`fontSize` は RN が自動で拡大するが `lineHeight` と固定値は拡大しない」と明記しているのに
   同じ罠を踏んでいた。文字サイズを上げた端末で★がふりがなに重なる
4. **折り返し2行目に★が来ると直上の行に重なる**(`styles.row` に `rowGap` が無い)。
   `rowGap` を入れると58文すべての組みが変わるので、**執筆側の制約**にした
   (`content-spec.md` の5番目・`src/content/CLAUDE.md`)
5. **`importantForAccessibility` は Android 専用**で絶対規則12 違反。削除。
   iOS は隣の `accessibilityElementsHidden` だけで足りる
6. **オーバーレイに `accessibilityViewIsModal` が無く**、VoiceOver が暗幕の裏に到達できた。
   `Modal` を使わない選択の副作用

### 次に送るもの

- **2字同時の回(#38 時間 / #45 大学 / #55 外国)は実データが無く、テストのフィクスチャでしか
  見ていない。** 第3章を書く回に実機で確認すること
- **ふりがなが親字より横に長いときの字間**(`conversation-screen.md` から持ち越し)。
  今回も入れていない。#17 の演出行(`日`/`にち`・`曜`/`よう`)はこの問題が最も強く出る行だが、
  実機では気になる崩れは出ていない
- **VoiceOver とローマ字ONでの見え方は未確認。** 一度★を見ると実機で見直せない
  (再確認にはアプリの削除→再インストールが要る)
- ステップ3(樹への反映)は `features/tree/` を作る回に。`onClose` 1本に閉じてある
- 演出語が**同じ行に2回**出る場合、validator は行数しか見ないので通り、`revealFor` は
  先頭の出現を採る。決定的なので壊れないが、テストは無い
