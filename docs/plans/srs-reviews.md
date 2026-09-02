# プラン: srs-reviews(SRSの復習セッション)

作成日: 2026-09-02
ステータス: 完了
完了日: 2026-09-02
承認日: 2026-09-02
要件定義書の対応箇所: 4.1(学習ループ 4)、5.1-4(SRS復習・固定ステージ制)、6.3-4(イベントログ方式)、9章「SRSの間隔テーブル」、ADR-0003

## 目的

学び終えた漢字が**翌日以降に「意味の4択」として戻ってくる**ようにし、学習ループの 1→4 を閉じる。入口画面「今日の学習」に `Reviews` を足し、そこから復習セッションに入って1問ずつ答えると、結果が `review_events` に追記され、次に出る日が決まる。

> `docs/plans/srs-lessons.md` 末尾「次プラン `srs-reviews` の見出し」で予告した範囲。
> 申し送りの宿題3件(要件の矛盾 / `sentenceId` の埋め方 / 間隔テーブルの具体値)を本プランで決着させる。

---

## 先に決着させる点(申し送りの宿題3件)

実装案の前に3点。**要件を勝手に解釈で変えてはいない。** 方針が違うなら承認前に指摘してほしい。

### 1. 要件 4.1-4 と 5.1-4 の矛盾 → **要件本文を直し、ADR-0007 を起こす**

- 4.1-4「**文＋漢字のセット**をSRSで復習」
- 5.1-4「固定ステージ制(WaniKani式)。**出題は意味の選択式クイズのみ**」

`docs/log/2026-08.md`(08-28)で 5.1 を正とする判断は既にあるが、要件本文が未修正のため、読むたびに同じ議論が起きる。**ここで閉じる。**

→ **2026-09-02 に開発者が「5.1 が正」で承認。**

**決定案:**

- **スケジューリングの単位は漢字1字**。「文＋漢字のセット」はデータとして保持する — `review_events` は `kanji_id` と `sentence_id` の両方を持ち、どの回で出会った字かは記録に残る(下記2)
- **提示は意味の4択のみ。復習中に会話文を再表示しない**(5.1-4 が正)
- 要件 4.1-4 の文言を差し替える:
  > 4. その回で出会った漢字を SRS(間隔反復)で復習する。**出題は意味の4択のみで、会話文は再表示しない**(形式は 5.1-4)。どの文で出会った字かは記録に残す

要件定義書4章は stock で「変更したら `decisions/` に理由を残す」規定があるため、**`docs/decisions/ADR-0007-review-unit-and-format.md` を起こす**(ADR README の「要件定義書の内容を変更したとき」に該当)。「なぜ復習で会話文を出さないのか」は必ず後から疑われる種類の判断なので、log の1行では足りない。

**却下した案:** 折衷として「答え合わせのときに導入回の会話文を出す」。`ConversationView` は画面まるごとの構成で復習カードに収まらず、ふりがな描画を復習側に持ち込むと差分が一気に膨らむ。**スコープ外に送る**(v2 候補として記録)。

### 2. `review_events.sentenceId` が NOT NULL → **列ごと削除する**(2026-09-02 開発者判断)

当初案は「導入回の `sentence_id` を入れる。列は変えない」だった。開発者から
「削除したら問題があるか」と問われ、**削除するほうが正しいと判断を変えた**。

- 入れようとしていた値(その漢字の導入回)は、**`lesson_events` が `kanji_id` と `sentence_id` の
  ペアで既に持っている**。復習イベントごとに持つと、導出できる値を毎回コピーすることになる
- `lesson_events` に `kanji_id` をコピーしたのとは事情が違う。あちらはコンテンツが再シードで
  入れ替わるため**ログ単体で読めないと意味がない**という理由だった。こちらは同じ DB の
  ユーザー状態表から引ける
- **いま消すのが一番安い。** まだ配っていないので実データを持つ端末が存在しない。
  リリース後に消すとユーザーの復習履歴を移し替えることになる

**副次的な効果として、プランから部品が1つ落ちる。** `ReviewQueueItem` から `sentenceId` が消え、
`recordReview()` の引数が減り、スケジューラが導入回を引いて持ち回る処理そのものが要らなくなる。

**マイグレーション `0003` が1本出る**(`review_events` から1列削除)。
これは行の UPDATE / DELETE ではなくスキーマ変更なので、絶対規則5 には触れない。
ただし SQLite の実装次第でテーブル再作成になるため、**生成された SQL を必ず読んで確認する**。

### 3. 間隔テーブルの具体値(要件9章の未決定事項) → **6ステージ + Burned**

`src/features/srs/scheduler.ts` に名前付き定数配列で置く。**日単位**(端末ローカル日境界。`day.ts` の既存の定義に合わせる)。

| ステージ | 次に出るまで | 学んでから |
|---|---|---|
| 1 | 1日 | 翌日 |
| 2 | 2日 | 3日目 |
| 3 | 4日 | 7日目 |
| 4 | 7日 | 14日目 |
| 5 | 14日 | 28日目 |
| 6 | 30日 | 58日目 |
| 7 (Burned) | 出さない | 6回連続正解で卒業 |

```
REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30]   // stage 1..6
BURNED_STAGE = 7
```

- **正解でステージ+1、不正解でステージ−1(下限1)。** WaniKani の「ステージによって下げ幅が変わる」規則は入れない(定数1本で説明できるほうが調整しやすい)
- 次回出題日 = `addLocalDays(startOfLocalDay(直近イベントの時刻), REVIEW_INTERVAL_DAYS[stage-1])`
- **出題判定は「次回出題日 ≤ 今日」** なので、放置ぶんは繰り越して溜まる(上限は掛けない = 前回の解釈どおり)

> **当日復習(ステージ1の間隔を0日にする案)は 2026-09-02 に開発者が却下。**
> 学んだ直後に同じ字が出る作業感を避ける。**初日の `Reviews` は空**で、復習は翌日から始まる。

**正解でも不正解でも、次回出題日は「新しいステージの間隔ぶん先」。** 例外を作らない。

```
correct   → min(stage + 1, BURNED_STAGE)
incorrect → max(stage - 1, 1)
due       → addLocalDays(今日, REVIEW_INTERVAL_DAYS[新stage - 1])   // どちらも同じ
```

**「不正解は当日に戻す」案は 2026-09-02 に却下した。** 間違えた字はセッション中は
キュー末尾に戻って出し直されるので(`session.ts`)、当日に戻す規則が効くのは
**間違えたまま画面を閉じた場合だけ**。そのときに `Reviews` の件数が 0 にならず残るのは、
**レッスン側の「今日ぶんを終えたら空になる」性質と食い違う**
(`You're done for today. Come back tomorrow.`)。このアプリの模型は
1日3字・端末ローカル午前0時・翌日再開で一貫しており、復習だけ当日に引き戻す理由がない。

TestFlight で「1日に何度も開く」使われ方が見えたら、そのとき戻す。

**1日何件出るかの見積もり(申し送り事項):**

定常状態では各ステージが1日あたり「新出の投入速度」ぶんの復習を生むので、**3字/日 × 6ステージ ≒ 18件/日**。不正解の出し直しを2割見て **18〜22件/日**(同じセッション内の出し直しを含む)。1問8秒として3分弱で、ADR-0003 が守ろうとした「雪崩による離脱」の範囲内。

立ち上がりは 1日目0件(復習は翌日から)→ 2日目3件 → 15日目で約15件 → 30日目で約18件。50字を学び終える17日目以降は新規が止まるので、そこから減っていく。

**キューの上限は「学び終えた漢字の数」で構造的に頭打ちになる。** 1字につき現在ステージは1つなので、1日にキューへ入るのは1字1件まで。1ヶ月放置して戻ってきても**最大50件**であって無限には増えない。

値は定数配列1本なので、TestFlight の感触で差し替えられる(要件9章「後から調整可能」)。**要件9章のチェックボックスを閉じる。値そのものはコードとコメントに置き、理由は `scheduler.ts` のコメントと `/log` に残す**(9章の注記どおり、要件本文には理由を書かない)。

---

## スコープ外

**今回作らないもの(明示的に次回以降へ送る)**

- **推測クイズ「読めるかな?」**(4.4)。要件は「SRS復習セッション中」にも出すとしているが、**今回は接続しない**。復習セッションは `review_events` だけを書き、`quiz_attempts` に一切触れない(絶対規則10)。クイズ側のプランが**セッションの前後に別画面として差し込む**形で被せられるよう、`ReviewSessionView` はクイズを知らないままにする
- **復習中の会話文の再表示**(上記1)。答え合わせに出すのは 字 / 意味 / 読み だけ
- **`kanji_progress` キャッシュ表**(下記「データモデルの変更」で見積もり済み。今回も置かない)
- **ステージ名・進捗バー・「Burned」表示などのステータスUI。** 進捗の可視化は漢字の樹(4.5)の担当で、ここに出すと二重になる
- **復習の件数上限・優先度付き並び替え・「今日はここまで」の分割**
- **「次の復習は明日」のような次回予告表示**
- **復習リマインダー通知・連続日数・統計**(5.5 で Deferred 済み)
- **答え合わせのイラスト表示**(50枚が未生成のため。枠だけ出しても意味がない)
- **正解時の自動送り・効果音・触覚フィードバック**(`expo-haptics` を新たに入れない)
- 漢字の樹 / 課金ゲート / オンボーディング / 漢字イラスト生成
- 章ロック。復習キューは章を見ない(既知の借りの継続)
- 端末の時計の巻き戻し検出、タイムゾーン移動時の再計算
- `lessons.ts` のリファクタ(「文ごとの最古1件」と「漢字ごとの最古1件」の共通化はしない。動いているものを触らない)

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/db/schema.ts` | 変更 | `reviewEvents` から `sentenceId` を削除 |
| `src/db/migrations/0003_*.sql` | 新規(生成物) | `pnpm run db:generate` の出力。**手で触らない**。生成 SQL を読んで確認する |
| `src/db/queries/review-events.ts` | 変更 | `ReviewEvent` / `NewReviewEvent` から `sentenceId` を落とす |
| `src/features/srs/scheduler.ts` | 新規 | **純粋。**`REVIEW_INTERVAL_DAYS` / `BURNED_STAGE` / `foldKanjiStates()` / `planTodaysReviews()` |
| `src/features/srs/scheduler.test.ts` | 新規 | ステージ遷移・次回出題日・キュー抽出 |
| `src/features/srs/choices.ts` | 新規 | **純粋。**`buildMeaningChoices()`(意味4択の生成) |
| `src/features/srs/choices.test.ts` | 新規 | 選択肢の中身と決定性 |
| `src/features/srs/session.ts` | 新規 | **純粋。**セッションの状態遷移(`createReviewSession` / `answerReviewSession` / `advanceReviewSession`) |
| `src/features/srs/session.test.ts` | 新規 | 出し直し規則と進捗カウント |
| `src/features/srs/record-review.ts` | 新規 | `recordReview()`(`insertReviewEvent` の薄い包み)。**`@/db` に触るのはここだけ** |
| `src/features/srs/day.ts` | 変更 | `addLocalDays(timestamp, days)` を追加(DST を跨いでも壁時計の日付で n 日後になる) |
| `src/features/srs/day.test.ts` | 変更 | `addLocalDays` のテスト(月跨ぎ・年跨ぎ) |
| `src/features/srs/index.ts` | 変更 | 上記の公開。純粋モジュールは個別 import 可のまま |
| `src/features/srs/components/review-session-view.tsx` | 新規 | 復習セッションのUI。ルーティングも DB も知らない |
| `src/features/srs/components/today-view.tsx` | 変更 | 先頭に `Reviews` セクションを追加(任意 prop)。既存のレッスン部分は触らない |
| `src/app/review.tsx` | 新規 | 復習セッションのルート。DB読み書きとセッション状態を持つ |
| `src/app/index.tsx` | 変更 | `listReviewEvents()` を読み、`planTodaysReviews()` の結果を `TodayView` に渡す。`/review` へ push |
| `src/theme/tokens.ts` | 変更 | 色トークン `positive` / `negative` を追加(正誤の表示。絶対規則1) |
| `src/theme/themes/sakura.ts` | 変更 | 上記2色の値 |
| `src/theme/themes.test.ts` | 変更 | `COLOR_KEYS` に2つ追加 |
| `docs/requirements.md` | 変更 | 4.1-4 の文言差し替え、9章「SRSの間隔テーブル」にチェック |
| `docs/decisions/ADR-0007-review-unit-and-format.md` | 新規 | 復習の単位は漢字1字 / 提示は意味の4択 / 会話文を再表示しない |
| `docs/data-model.md` | 変更 | `review_events.sentence_id` に**導入回**を入れると明記 |
| `docs/architecture.md` | 変更 | 「現在のルート」に `/review` を追加 |

**新しい依存は追加しない。** 使うのは React Native の `Pressable` / `ScrollView` / `Text` / `View` と `expo-router` だけで、いずれも本リポジトリで既に使っている(expo ~57.0.11 / expo-router ~57.0.11 / react-native 0.86.2)。Expo の新規APIを持ち込まないので、v57 ドキュメントの新規確認箇所は無い。

## データモデルの変更

**`review_events` から `sentence_id` を削除する。マイグレーション `0003` が1本出る。**

変更後の `review_events` は id / kanji_id / result / reviewed_at / created_at / updated_at。
`insertReviewEvent` / `listReviewEvents` は `db-foundation` の時点で揃っているので、
型から1フィールド落とすだけで済む。

**この列は「どの会話文の復習か」を持つつもりで NOT NULL で作られた**(要件4.1-4 の
「文＋漢字のセット」の素朴な読み)。上記1で提示を意味の4択に確定したため、
復習イベントに入れるべき会話文が存在しなくなった。入れるとすれば導入回の ID だが、
それは `lesson_events` から常に引ける導出値なので持たない。

`docs/data-model.md` に、**「どの文で出会った字か」は `lesson_events` が持つ**と明記する。

### `kanji_progress` を今回も置かない理由(見積もり)

- 1字を Burned まで持っていくのに要るイベントは7件。不正解の出し直しを含めても1字あたり10件程度
- 50字ぶんで**多くて500〜600行**。`listReviewEvents()` の全件 SELECT + `Map` への畳み込みは実測を待つまでもなくミリ秒未満
- 畳み込みは入口画面(`useFocusEffect`)と復習セッション開始時の2箇所でしか走らない
- キャッシュを置くと「再計算のタイミング」という不具合の温床が1つ増える(絶対規則5 のキャッシュ整合性)

**行数が数万に達したら再考する。** MVP の規模では到達しない。

## 実装ステップ

1. `docs/decisions/ADR-0007-review-unit-and-format.md` を書き、`docs/requirements.md` 4.1-4 の文言を差し替える。9章の「SRSの間隔テーブル」にチェックを付ける。**実装前にここを閉じる**(後回しにすると実装が「解釈」になる)
2. `src/db/schema.ts` の `reviewEvents` から `sentenceId` を消し、`pnpm run db:generate` を実行。
   **生成 SQL を読んで確認する**(テーブル再作成になっている場合、既存行が移し替えられることを見る)。
   `src/db/queries/review-events.ts` の `ReviewEvent` / `NewReviewEvent` からも落とす
3. `src/features/srs/day.ts` に `addLocalDays(timestamp, days)` を足す。`new Date(y, m, d + days)` で組み立てる。**`timestamp + days * 86400000` にしない** — DST のある地域(想定読者にトロント在住者がいる)で境界が1時間ずれる。`day.test.ts` に月跨ぎ・年跨ぎのテストを足す
4. `src/features/srs/scheduler.ts` を書く(純粋・`@/db` を import しない)
   - `REVIEW_INTERVAL_DAYS = [1, 2, 4, 7, 14, 30]` と `BURNED_STAGE = 7`。値の根拠(定常18件/日、キューは学習済み字数で頭打ち、当日復習を入れない判断)をコメントに残す
   - `foldKanjiStates({ lessons, reviews })` → `Map<kanjiId, { stage, dueDay, burned }>`
     - 起点: `lesson_events` に `kanji_id` を持つ最古の行がある字だけが対象。**`lesson_events` に無い字は、`review_events` があっても対象にしない**(不整合なデータで落ちない)
     - 初期ステージ1、基準時刻は導入回の `completedAt`
     - イベントは **`reviewedAt` → `id` の昇順に並べ直してから**畳み込む(入力順に依存しない。ULID は同一ミリ秒でも単調増加する)
     - `correct` → `min(stage + 1, BURNED_STAGE)` / `incorrect` → `max(stage - 1, 1)`
     - 次回出題日は**どちらも**新ステージの間隔ぶん先。例外を作らない
   - `planTodaysReviews({ kanji, lessons, reviews, now })` → `{ items: ReviewQueueItem[]; dueCount: number }`
     - `ReviewQueueItem = { kanji: KanjiEntry; stage: number; dueDay: number }`
     - Burned を除外し、`dueDay <= startOfLocalDay(now)` のものだけ。並びは `dueDay` 昇順 → `kanji.order` 昇順(決定的に。シャッフルはセッション側の仕事)
   - `LessonCompletion` は `lessons.ts` の既存型を再利用。`ReviewRecord`(`{ id, kanjiId, result, reviewedAt }`)は `@/db` の型に依存しないためここで再定義する(`LessonCompletion` と同じ流儀)
5. `scheduler.test.ts` を書く。**フィクスチャで組む**(`src/content/index.ts` に依存させない)
6. `src/features/srs/choices.ts` を書く(純粋)
   - `buildMeaningChoices({ target, pool, rng = Math.random }): string[]`
   - 規則: ① 対象自身を除く ② **同じ形の意味を優先**(`'to '` で始まる = 動詞かどうかで揃える。動詞の正解に名詞の誤答3つを並べると、字を知らなくても答えが浮く) ③ 同じ形が足りなければ残りから補う ④ 意味の重複を排除 ⑤ 4件に届かなければ**届いたぶんだけ返す**(例外を投げない)
   - `pool` は呼び出し側が「**学習済みの字を先、足りなければマスタ全件**」の順で渡す(初日は学習済みが3字しかなく、それだけでは4択にならない)
   - シャッフルは `rng` を注入。**正解が常に先頭に来ない**ことをテストで縛る
   - 先頭コメントに「**要件4.4 の推測クイズの誤答生成とは別物**(あちらは片方の漢字だけ合っている紛らわしい熟語訳)。共通化しない」と書く
7. `choices.test.ts` を書く
8. `src/features/srs/session.ts` を書く(純粋)
   - 状態: `{ queue: ReviewQueueItem[]; current: ReviewQueueItem | null; choices: string[]; answered: { selected: string; correct: boolean } | null; answeredCount: number; total: number }`
   - `createReviewSession({ items, pool, rng })` — キューをシャッフルして先頭を `current` にし、選択肢を作る
   - `answerReviewSession(state, selected)` — `answered` を埋めるだけ。**DB は書かない**(呼び出し側が書く)
   - `advanceReviewSession(state)` — 正解なら退場して `answeredCount + 1`、**不正解ならキューの末尾に戻す**。次の `current` の選択肢を**その時点で作り直す**(位置で覚えられないようにする)
   - `total` は最初のキュー長で固定。出し直しで分母が動くと進捗表示が壊れる
9. `session.test.ts` を書く
10. `src/features/srs/record-review.ts` を書く。`recordReview({ kanjiId, result })` → `insertReviewEvent` を呼ぶだけ。**`scheduler.ts` / `choices.ts` / `session.ts` と同居させない**(テストが `@/db/client` に到達して SQLite を開くため。`complete-lesson.ts` と同じ理由)
11. `src/theme/tokens.ts` に `positive` / `negative` を足し、`sakura.ts` に値を入れ、`themes.test.ts` の `COLOR_KEYS` に追加する。**名前は意味で付ける**(`green` / `red` にしない。東京の夜景テーマでも意味が壊れないように)
12. `src/features/srs/components/review-session-view.tsx` を書く
    - 出題: 見出し `Reviews`、進捗 `3 / 12`、`Back`、大きな漢字1字、問い `What does this mean?`、4択のボタン
    - 答え合わせ: 正解の選択肢を `theme.positive`、外した選択肢を `theme.negative` で示し、その下に読み(訓 `theme.kunBranch` / 音 `theme.onBranch`、ローマ字は設定 ON のときだけ)を出す。`Next` を押して次へ
    - 終了時: `All reviews done.` と `Back to today`
    - **自動送りにしない。** 正解でも一度読みを見せる(「意味の核」を毎回見せるのがこのアプリの主張。タイマーを持ち込まない副次的な利点もある)
    - props は `state` / `onSelect` / `onNext` / `onQuit` のみ。`expo-router` も `@/db` も import しない
13. `src/app/review.tsx` を書く。`listKanji()` / `listLessonEvents()` / `listReviewEvents()` を読み、`planTodaysReviews()` → `createReviewSession()` を **`useState` の遅延初期化で1回だけ**行う(セッション中にキューが作り直されないように)。`onSelect` で `recordReview()` を呼び、`answerReviewSession()` で状態を進める。**1問答えるたびに書く**(途中でやめても結果が残る)
14. `today-view.tsx` に `Reviews` セクションを足す。任意 prop `reviewDueCount?: number` と `onOpenReviews?: () => void`。`> 0` のときは押せるカード(`Reviews` / `N due`)、`0` のときは押せない一言 `No reviews due.`。**レッスンの上に置く**(復習が先、新規は後)
15. `src/app/index.tsx` の `read()` に `listReviewEvents()` を足し、`planTodaysReviews()` の結果を渡す。`onOpenReviews` で `/review` に push
16. `docs/requirements.md` / `docs/data-model.md` / `docs/architecture.md` を更新する
17. `pnpm run check` を通し、シミュレータで受け入れ条件を確認する

## 受け入れ条件

**入口画面**

- [ ] 復習対象が1件も無い状態で起動すると、`Today` の上に `No reviews due.` が出て、押しても何も起きない
- [ ] 今日の3字を学び終えて入口画面に戻っても、`Reviews` は `No reviews due.` のまま(当日復習を入れない判断)
- [ ] **端末の日付を翌日に進めて起動すると `3 due` になる**
- [ ] `Reviews` を押すと復習画面が開く

**復習セッション**

- [ ] 復習画面に漢字が1字だけ大きく出て、**選択肢が4つ**並ぶ。会話文は出ない
- [ ] 選択肢の1つは必ずその漢字の意味(`人` なら `person`)で、残り3つは別の漢字の意味
- [ ] 正解を選ぶと、その選択肢が `theme.positive` の色になり、下にその字の読み(訓/音)が出て、`Next` が現れる
- [ ] 不正解を選ぶと、選んだ選択肢が `theme.negative`、正解の選択肢が `theme.positive` で示される
- [ ] **不正解にした字は、同じセッションの後ろにもう一度出る**。進捗の分母(`n / 12` の 12)は増えない
- [ ] 全問終えると `All reviews done.` が出て、`Back to today` で入口画面に戻る
- [ ] 入口画面の `Reviews` の件数が、正解にした字のぶんだけ減っている
- [ ] 3件中1件だけ答えて `Back` で抜けると、入口画面の `Reviews` は `2 due` になる(**1問ごとに保存されている**)
- [ ] その状態でアプリを再起動しても `2 due` のまま

**スケジューリング(外から見える形で)**

- [ ] ステージ1の字に**正解する**と、その字は同じ日にもう一度復習に出てこない(セッションを開き直しても出ない)
- [ ] ステージ1の字を**不正解にして**セッションを抜けると、開き直してもその日はもう出ない(翌日に戻る)。**同じセッション中には出し直される**
- [ ] 正解してステージ2になった字は、**日付を1日進めても戻ってこない**(間隔2日)。もう1日進めると戻ってくる

**規則の遵守(静的確認)**

- [ ] `rg "quizAttempts|insertQuizAttempt" src/features/srs src/app/review.tsx` が 0 件(絶対規則10。復習とクイズを混ぜない)
- [ ] `rg "update\(reviewEvents\)|delete\(reviewEvents\)" src` が 0 件(絶対規則5)
- [ ] `rg "^import .*'@/db" src/features/srs/scheduler.ts src/features/srs/choices.ts src/features/srs/session.ts` が 0 件(純粋モジュールから DB に到達しない)
  - **実装時に条件を書き直した。** 元は `rg "@/db"` だったが、これは「なぜ import しないか」を
    説明したコメント自体を拾ってしまい、**規則を書き残すほど条件が満たせなくなる**。
    見たいのは import 文の有無なので、そこだけを見る形にした
- [ ] `rg "expo-router" src/features/srs` が 0 件(feature はルーティングを知らない)
- [ ] `rg "#[0-9a-fA-F]{3,8}" src/features/srs src/app/review.tsx` が 0 件(絶対規則1)
- [ ] 新規に追加した画面の表示文字列に日本語が含まれない。出る日本語は学習コンテンツ(漢字・かな)だけ(絶対規則7)
- [ ] `src/db/migrations/0003_*.sql` が `pnpm run db:generate` の生成物であり、手編集の跡が無い(絶対規則6)
- [ ] 旧バージョンで復習を1件記録した状態から新バージョンに上げても、その記録が残っている(`Reviews` の件数が変わらない)
- [ ] `docs/requirements.md` 4.1-4 が「意味の4択のみ・会話文を再表示しない」に更新され、`docs/decisions/ADR-0007-*.md` がその理由を持っている

**ユニットテスト**

- [ ] `addLocalDays()` が月跨ぎ(2/28 → 3/1)と年跨ぎ(12/31 → 1/1)で正しい壁時計日を返す
- [ ] 今日導入した字は、復習イベント0件のとき**今日のキューに入らず、翌日のキューに入る**
- [ ] `lesson_events` に無い字は、`review_events` があってもキューに入らない
- [ ] ステージ1で正解するとステージ2になり、当日のキューから消えて**2日後**の対象になる
- [ ] ステージ2で不正解にするとステージ1に下がり、**翌日**の対象になる(ステージ1の間隔=1日)
- [ ] ステージ1で不正解にしてもステージ0にならない(下限1)。次回出題日は**翌日**
- [ ] 6回連続で正解した字は Burned になり、以後どの日のキューにも入らない
- [ ] 3日前が出題日だった字が、今日のキューにまだ入っている(繰り越し)
- [ ] `review_events` の配列を時系列と逆順に渡しても、畳み込み結果が同じになる
- [ ] `buildMeaningChoices()` が4件を返し、その中にちょうど1件だけ正解の意味が入る
- [ ] `rng` を固定すると出力が決定的になり、**正解が常に先頭には来ない**
- [ ] 対象が動詞(`to eat`)で、プールに動詞が3件以上あるとき、誤答3件がすべて動詞になる
- [ ] プールが3件しか無いとき、例外を投げずに3件以下の選択肢を返す
- [ ] `answerReviewSession()` → `advanceReviewSession()` で、正解した項目は退場して `answeredCount` が1増える
- [ ] 不正解の項目はキューの末尾に戻り、`total` は変わらず、もう一度出題できる
- [ ] 戻ってきた項目の選択肢にも正解の意味が含まれる
- [ ] 全項目を正解にすると `current` が null になる

## テスト方針

**Jest では SQLite を動かさない**(`db-foundation` からの継承)。テストは純粋ロジックに集中させる。

| 対象 | 見るもの |
|---|---|
| `src/features/srs/day.test.ts` | `addLocalDays` の月跨ぎ・年跨ぎ。ローカル時刻で組み立ててTZ非依存にする |
| `src/features/srs/scheduler.test.ts` | ステージ遷移・次回出題日・キュー抽出。**フィクスチャで組む**(実データ `src/content/index.ts` に依存させない) |
| `src/features/srs/choices.test.ts` | 選択肢の中身・同じ形の優先・`rng` 注入時の決定性 |
| `src/features/srs/session.test.ts` | 出し直し規則と進捗カウント |

`scheduler.test.ts` / `choices.test.ts` / `session.test.ts` は `@/db` を import しない。**テストから DB 接続に到達させない**のが条件。

UI(復習セッション・入口の Reviews)は手動確認でよい。手順は「受け入れ条件」がそのままチェックリストになる。確認は MCP の `attach` → `build` → `launch`(`disclaimer` の残骸で落ちたときの手順は CLAUDE.md)。日付を跨ぐ確認はシミュレータの日付設定を進めて行う。

**前回の申し送り:** 開発ビルドで出る LogBox の警告バナー(`Open debugger to view warnings.`)を、この回で必ず読んで潰す。`expo start` のターミナル出力かシミュレータの開発メニューから debugger を開けば読める。

## リスク・未確定事項

- **初日は `Reviews` が空のままになる。** 当日復習を入れない判断(開発者)の帰結で、
  学習ループが1周して見えるのは2日目から。**デモや TestFlight の初回起動では復習が体験できない**。
  そこを見せたくなったら `REVIEW_INTERVAL_DAYS[0]` を `0` にするだけで戻せる。
  **値を変えても他の設計は動かない**ことが、この配列を1箇所に置いた理由
- **実機での確認に日付の変更が要る。** 復習が翌日からになるため、シミュレータの設定アプリで
  日付を進めないと `Reviews` が出ない。**これは `srs-lessons` で未確認のまま残した項目**なので、
  今回はここで実際にやって手順を残す
- **Burned(6回正解)には誰も到達しないままリリースされる。** 最短でも導入から58日かかる。Burned の分岐は**ユニットテストでしか通らない**ため、実機の受け入れ条件に含めていない
- **1日18件という見積もりは机上の値。** 実際の体感は TestFlight で初めて分かる。重すぎたら間隔を伸ばす(ステージ数を減らす)方向で調整する
- **復習に会話文を出さない判断は、要件4.1-4 の素朴な読みと衝突する。** ADR-0007 で閉じるが、外部テストで「文の中で見たい」という声が出たら、答え合わせの下に導入回への導線を1本足すのが最小の対応になる(v2 候補)
- **推測クイズを復習セッション中に出す接続(要件4.4)が未着手のまま残る。** クイズ側のプランは `planTodaysReviews()` の結果を入力に取り、セッションの前後に別画面を差し込む形にすること。**`ReviewSessionView` の中にクイズを混ぜない**(絶対規則10 が守られていることをレビューで確認できなくなる)
- **複数端末同期を入れたとき、畳み込みの順序が結果を決める。** `reviewedAt` → `id`(ULID)の昇順に並べ直してから畳み込むことで、マージ順に依存しないようにしてある。ここを崩すとステージが端末ごとにずれる
- **端末の時計を戻すと復習を前倒しできる。** MVP では検出しない(サーバーを持たない構成のため)
- **色トークンを2つ増やす。** テーマを追加する回に `positive` / `negative` の値を決める必要が生まれる(`themes.test.ts` の「全テーマが同じキー集合を持つ」が守らせる)
- **残りの Must have は依然として クイズ(4.4) / 樹(4.5) / 課金ゲート(7章) / オンボーディング(5.1-10) / 漢字イラスト50枚。** 機能凍結目安(9月上旬)を過ぎているので、**このプランは復習が1周することだけを見て、それ以上を足さない**

## 実装後の記録(2026-09-02)

### 実機(iOSシミュレータ iPhone 17 Pro / iOS 26.5)で確認したもの

- 初回起動で `No reviews due.`(当日復習を入れない判断どおり)
- `Reviews / 3 due` が `Today` の**上**に出る
- 復習画面: 1字＋4択。**会話文は出ない**。進捗 `0 / 3`
- 選択肢の形がそろっている(名詞の出題に名詞の誤答3件)
- 不正解: 選んだものが `theme.negative`、正解が `theme.positive`、残りは沈む。
  下に読み(訓=緑 / 音=青)とローマ字、`Next`。進捗は動かない
- 正解: 正解だけ緑。読みが出る
- **1問ごとに保存されている**: 不正解1件・正解1件を答えて `Next` を押さずに `Back` で抜けたら、
  入口画面が `2 due`(正解した字だけ消えた)
- **`0003` が既存DBに当たってもユーザー状態が保たれた**(レッスンの `3 of 3` と Done 表示が維持)

**日付が絡む条件は、`REVIEW_INTERVAL_DAYS` の先頭を一時的に `0` にして当日出題させ、
確認後に `1` へ戻す方法で見た。**

### **シミュレータでは端末の日付を変えられない**(重要)

`srs-lessons` で「未確認」のまま残した「端末の日付を翌日に進める」条件は、
**やらなかったのではなく、できない**ことが分かった。

**iOSシミュレータの Settings → General に Date & Time が存在しない。**
シミュレータはホストMacの時計をそのまま使う。Macの時計を変えるのは開発機全体に
影響するので行わない。

→ **日付を跨ぐ受け入れ条件は、今後も実機では確認できない。**
`day.test.ts`(TZ非依存)と `scheduler.test.ts` で担保し、
実機では上記のとおり定数を一時的に変える方法で見る。
**この手順を `README.md` の「iOSシミュレータで動かす」に書き足すこと**(次回の申し送り)。

### 実機で未確認のもの

- 日付を跨いだときの挙動(上記のとおり不可能)
- **Burned(6回正解)**。最短58日かかるためユニットテストのみ
- 全問終えたときの `All reviews done.` 画面
- アプリ再起動後も件数が保たれること

### 未解決のまま残したもの

- ~~LogBox の警告バナーが読めない~~ → **2026-09-03 に開発者が React Native DevTools で読み、解決。**
  **3件とも RevenueCat SDK の警告で、このプラン(および `srs-lessons`)の変更とは無関係だった。**

  1. Test Store の API キーを使っている警告
  2. `ui_config` のリモート設定をマージできない
  3. `ui_config` の組み立てに失敗した

  2・3 は RevenueCat ダッシュボード側の paywall UI 設定が未作成なため。
  paywall UI を作る回で消える見込み。**放置してよい。**

  **1 は放置してはいけない。** 警告文が
  「Apps submitted with a Test Store API key will be rejected during App Review」
  と言っており、**キーを差し替えないまま提出すると審査で落ちる**。
  キーは `src/features/paywall/purchases.ts:5` にベタ書きされていて、
  同ファイルにも「App Store Connect登録後、本番のappl_...キーに差し替える」とある。
  → **リリース前の必須作業として、どこか消えない場所に記録すること**(開発者に確認中)

  読めなかった経路の記録(次に同じことが起きたときのため): バナーのタップは何も開かない /
  RN inspector の CDP(`localhost:8081/json/list`)は接続できてもイベントが流れない /
  `xcrun simctl spawn ... log show` は UIKit のノイズだけで JS の console は出ない /
  `prefs:root=` の Settings ディープリンクは拒否される。
  **React Native DevTools を開くのが唯一の手段だった。**

### プランから外れた点

1. **受け入れ条件の静的チェックを書き直した**(`rg "@/db"` → `rg "^import .*'@/db"`)。
   元の条件は「なぜ import しないか」を説明したコメント自体を拾い、
   **規則を書き残すほど条件が満たせなくなる**
2. **「1字につき記録するのは最初の回答だけ」という規則を追加した**(下記 reviewer の指摘2)。
   プランに無かった規則だが、無いと降格が一度も効かない

### reviewer の指摘と対応

- **`setSession` の更新関数の中で DB に書いていた。** React の更新関数は純粋である前提で
  再実行されうる(このリポジトリは `reactCompiler: true`)。1回の回答で `review_events` に
  2行入り、**正解でステージが 1 → 3 に飛ぶ**。判定と書き込みを更新関数の外に出した
- **同一セッション内の出し直しで正解すると、不正解のペナルティが完全に消えていた。**
  `incorrect` → `correct` の2件が畳み込まれてステージが元に戻るため、
  **降格が一度も効かず、精度に関係なく全字が最短58日で Burned に到達する**。
  → **1字につき記録するのは最初の回答だけ**にした(`ReviewAnswer.first`)。
  出し直しは復習であって再採点ではない。規則は app 層ではなく純粋な `session.ts` に置き、
  テスト2件を添えた
- **`choices.ts` のプールの契約が実装と食い違っていた**(「学習済みを先に渡す」と書いてあるが、
  丸ごとシャッフルするので並び順は結果に影響しない)。コメントを実装に合わせた
- **`day.ts` のコメントに事実でない記述があった**(「ミアの読者にはトロント在住者がいる」。
  ミアは会話文の主人公であって媒体ではない)。DST 対策の理由を事実に直した
- `today-view.tsx` で件数があるのに `onOpen` が無いと「0件」と嘘をつく分岐、
  `choices.test.ts` の題名と検証内容のずれ、`listKanji()` の二重呼び出しも直した
