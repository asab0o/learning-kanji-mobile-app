# プラン: quiz-and-review-repeats

作成日: 2026-09-13
ステータス: 完了(2026-09-13 承認。確認2 は頻度を受け入れ、確認3 は案A)
要件定義書の対応箇所: 4.4(推測クイズ)/ 5.1-4(SRS復習)/ ADR-0007
関連プラン: `docs/plans/guess-quiz.md`(完了・凍結)、`docs/plans/srs-reviews.md`(完了・凍結)

## 承認の前に確認してほしい点

要件定義書と正面から矛盾する箇所はありません。ただし、承認済みの過去プランを上書きする点が1つ、実データで影響が大きい点が1つ、開発者の方針が2通りに読める点が1つあります。

### 確認1. `guess-quiz.md` 差分2 の「学習直後は条件を落として出す」を取り下げる

`guess-quiz.md` は凍結済みなので書き換えません。このプランの記録として残します。

- 取り下げる内容: 学習直後(`slot=lesson`)の出題は「今学んだ字 → その日に学んだ字 → 候補全体」の順に条件を落として必ず1問出す、という承認済みの決め
- 今回の方針: 今学んだ字を含む語が無ければ出さない
- 要件4.4 との関係: 要件は「学習直後にクイズを出す」としか書いておらず、「毎回出す」とは書いていないので矛盾はしません
- `guess-quiz.md` の受け入れ条件「1問答えると `quiz_attempts` が1行増える」も、このプランで「表示で1行増え、回答では増えない」に置き換わります

### 確認2. 学習直後のクイズが出ない回が 50回中23回ある

`pnpm exec tsx` で `pickQuizItem` を実データに当てて、各回の新出字を含む出題可能な語を数えました(直近出題の回避は含めていません)。

| 範囲 | クイズが出ない回 |
|---|---|
| 第1章(無料) | **食・上・下・家**(10回中4回) |
| 第2章 | 早・時・分・月・水・木・金・土・休 |
| 第3章 | 買・行・歩・空 |
| 第4章 | 生・聞・名・新・語・高・安 |

- 新出3字ずつ1日に区切って机上で数えると、**家・早・時 の日**と**買・行・歩 の日**は、学習直後のクイズが1日を通して1問も出ません
- 初日(人・大・小)は3回とも出るので、要件4.4 の「初日から体験が成立する」は保たれます
- この頻度で良いか、承認時に確認してください。出題を増やすには構成字の英語グロスをコンテンツに足す必要があり、今回はスコープ外です

### 確認3. 学習直後で「今学んだ字の語」が全部直近に出ていたらどうするか(要判断)

開発者の方針「出題可能な語が無いとき」は、直近出題の回避(`RECENT_ITEM_MEMORY`)を含めるかどうかで2通りに読めます。実データでは、次の組が**連続する回で同じ語しか候補にならない**ことが分かっています。

- 外(#26)→ 出(#27): どちらも `外出` だけ
- 来(#39)→ 年(#40): どちらも `来年` だけ
- 読(#46)→ 書(#47): どちらも `読書` だけ

| 案 | 挙動 | 評価 |
|---|---|---|
| **A(推奨)** | lesson では直近回避の条件を落とさない。今学んだ字の語がすべて直近に出ていれば、クイズを出さない | 報告された「同じ単語が2回続けて出た」を連続回でも再発させない |
| B | 今学んだ字の語に絞ってから、直近回避が全滅したら条件を落とす | #27・#40・#47 で同じ語が2回続く |

`slot=review` は今の挙動(全滅したら条件を落とす)を変えません。

---

## 目的

- 推測クイズで、たった今学んだ字と関係ない語や、直前に見た語が出ないようにする
- 復習で同じ字がもう一度出たときに、それが「間違えた字の出し直し」だと分かるようにする

## スコープ外

**推測クイズ**
- 構成字がマスタに無い語(`食事` `食堂` `上手` など)を出せるようにすること。コンテンツに構成字の英語グロスを足す変更で、確認2の出ない回を減らす本筋ですが v2 候補
- クイズを出さなかったときの表示(`No quiz this time` のようなトーストや一言)。黙って Today に戻す
- 第2段階専用の回(`newKanjiId` が null)の後にクイズを出すこと
- `slot=review` のフォールバック規則の変更
- `RECENT_ITEM_MEMORY`(10)の値の変更
- `PickQuizItemInput` を判別共用体(`{ slot: 'lesson'; focusKanjiId: string } | { slot: 'review' }`)にする型の作り直し
- `quiz_attempts` の集計、表示率、`shown` の件数を画面に出すこと
- `見学` `入学` が `大学` の演出より先に出る件(`guess-quiz.md` に残した借り)、`words` の同じ語で kana と meaning が一致するかの検証
- 漢字画面とクイズ画面にある「Today まで戻る」分岐(`canDismiss() ? dismissAll() : replace('/')`)を共通化すること

**復習**
- 出し直す位置の変更(末尾ではなく数問後に戻す等)、出し直し回数の上限
- 進捗 `n / m` に出し直しを数えることや、`x left` のような残数表示
- `Try again` の説明文、アニメーション、触覚フィードバック
- SRSの記録規則(`ReviewAnswer.first`)の変更

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/quiz/selection.ts` | 変更 | `slot=lesson` を「今学んだ字を含む語だけ。無ければ null」に変更。`focusKanjiId` が無い、またはマスタに無い lesson も null。`preferForSlot` の lesson 分岐(その日に学んだ字)を削除し、review 専用にする |
| `src/features/quiz/selection.test.ts` | 変更 | フィクスチャの既定 `slot` を `'review'` に変更し、lesson のテストを書き直す(下記「テスト方針」) |
| `src/features/quiz/load-quiz-input.ts` | 新規 | `src/app/quiz.tsx` の `read()` にある DB 読み出しと入力の組み立てを移す。`loadQuizInput({ slot, focusKanjiId, now }): PickQuizItemInput`。`@/db` に触る層なので、`record-attempt.ts` と同じくテストは付けない |
| `src/features/quiz/record-attempt.ts` | 変更 | `recordQuizAttempt` をやめ、`newQuizAttemptId()` / `recordQuizShown({ id, itemKey })` / `recordQuizAnswer({ id, result })` の3つにする |
| `src/features/quiz/index.ts` | 変更 | 上記の公開を差し替える |
| `src/app/quiz.tsx` | 変更 | `loadQuizInput` を使う。遅延初期化で `attemptId` も決め、`useEffect` で表示を記録し、`select` で結果を記録する |
| `src/app/kanji/[id].tsx` | 変更 | `completeLesson()` の後に出題の有無を判定し、無ければクイズへ行かずに Today に戻す |
| `src/db/schema.ts` | 変更 | `quizAttempts.result` の enum を `['shown', 'correct', 'incorrect']` に広げる |
| `src/db/queries/quiz-attempts.ts` | 変更 | `insertQuizAttempt` を削除。`newQuizAttemptId()` / `insertQuizShown()`(`onConflictDoNothing`)/ `updateQuizAttemptResult()`(`shown` の行だけ更新)を追加。先頭コメント「INSERT と SELECT しか書かない」を書き換える |
| `src/db/index.ts` | 変更 | 公開を差し替える。`QuizAnswerResult` 型を追加する |
| `src/features/srs/session.ts` | 変更 | 純粋関数 `isRetry(session): boolean` を追加 |
| `src/features/srs/session.test.ts` | 変更 | `isRetry` のテスト |
| `src/features/srs/components/review-session-view.tsx` | 変更 | `isRetry(session)` が true のとき、出題の漢字の上に `Try again` を出す |
| `docs/data-model.md` | 変更 | 「推測クイズは SRS と混ぜない」節に、`shown` で1行入れて結果を1回だけ更新する方針と理由を追記 |
| `src/db/CLAUDE.md` | 変更 | 規約4の直後に1行。「`quiz_attempts` は `result` の `shown` → `correct`/`incorrect` だけ UPDATE してよい」 |
| `docs/architecture.md` | 変更 | ルート一覧の `src/app/quiz.tsx` の行に `&kanji=<id>` と「lesson は該当語が無ければ開かない」を追記 |

`src/features/quiz/boundaries.test.ts` は変更しません。新しい `load-quiz-input.ts` も自動で走査対象に入り、`@/features/srs` は import しません。`src/app/review.tsx` も変更しません。

新しい依存は追加しません。Expo の新規 API も使いません。expo-router の `dismissAll` / `canDismiss` / `replace` の意味は v57 のドキュメントで確認済みです(`dismissAll` はスタックの `popToTop` 相当)。

## データモデルの変更

**スキーマの型だけを変え、マイグレーションは出ない想定です。**

- `quiz_attempts.result` の drizzle enum を `'shown' | 'correct' | 'incorrect'` に広げる
- `0000_lethal_alice.sql` の `result` は `text NOT NULL` で CHECK 制約がなく、`meta/0004_snapshot.json` の `result` も enum を記録していない(確認済み)ので、`pnpm run db:generate` で差分は出ないはずです
- **差分が出たら手で直さず、コミットせずに止めて報告する**(絶対規則6)
- 既存の行(TestFlight の `correct` / `incorrect`)はそのまま有効です

**記録方式: 1回の出題につき1行。表示時に INSERT し、回答時にその行を1回だけ UPDATE する。**

| 時点 | 書き込み |
|---|---|
| 表示時(Show choices の前) | `INSERT (id, item_key, result='shown', attempted_at=表示時刻, created_at, updated_at) ON CONFLICT(id) DO NOTHING` |
| 回答時 | `UPDATE quiz_attempts SET result=?, updated_at=? WHERE id=? AND result='shown'` |

- `attempted_at` は表示時刻のまま変えない
- `result` の遷移は `shown` → `correct`/`incorrect` の1方向・1回だけ。`WHERE result='shown'` で2回目の更新は効かない
- `listRecentQuizAttempts` は変えない。`shown` の行も直近出題として数えるのが今回の目的
- 型は分ける: `QuizResult = 'shown' | 'correct' | 'incorrect'`(読み出し用)と、`QuizAnswerResult = 'correct' | 'incorrect'`(更新の引数用)。回答時の API から `shown` を書けないようにする

**追記のみにしなかった理由**
- 表示と回答で2行になると、直近10行の窓が実質5語ぶんに縮みます。直すには選定側で重複を除く処理と、取得件数の変更が要ります
- 回答行と表示行を結び付けるには列を足す必要があり、マイグレーションが出ます
- `quiz_attempts` は SRS ではないので絶対規則5の対象外です。`src/db/CLAUDE.md` の INSERT のみの表も `lesson_events` / `review_events` だけを挙げています
- 将来の同期は `updated_at` による後勝ちで足ります。遷移が1方向1回なので、端末間で状態が戻ることはありません

## 実装ステップ

1. **`selection.ts` を変える(テストを先に書く)。** 規則は次のとおり。ふるい1〜5 は変えません。

   ```
   candidates = ふるい1〜5 を通った語
   slot === 'lesson':
     focusCharacter が無い(focusKanjiId 未指定 / マスタに無い) → null
     focused = candidates のうち focusCharacter を構成字に含む語
     fresh   = focused のうち recent に無い語
     fresh が空なら null(確認3の案A。案Bなら focused に落とす)
     それ以外は shuffle(fresh)[0]
   slot === 'review': 今のまま(fresh が空なら candidates → 今日より前に学んだ字の語へ寄せる → shuffle)
   ```

   - `preferForSlot` から lesson 分岐と `focusCharacter` 引数を消す
   - `focusKanjiId` のコメントを「lesson では必須。無ければ出題しない」に直す
   - ファイル先頭と `preferForSlot` の「寄せるだけで空にはしない」は review だけの話になるので、コメントも合わせて直す

2. **`load-quiz-input.ts` を作る。** `quiz.tsx` の `read()` から、`listSentences` / `listWords` / `listLessonEvents` / `listKanji` / `listRecentQuizAttempts` の読み出しと、`reencounterWords` / `learned` / `completedSentenceIds` の組み立てをそのまま移します。`rng` は含めません。

3. **`kanji/[id].tsx` で、遷移前に出題の有無を判定する。**

   ```
   completeLesson({ sentenceId, kanjiId: kanji.id })   // 先に書く。今学んだ字が既習に入る
   const input = loadQuizInput({ slot: 'lesson', focusKanjiId: kanji.id, now: Date.now() })
   pickQuizItem(input) === null
     ? (router.canDismiss() ? router.dismissAll() : router.replace('/'))
     : router.replace(`/quiz?slot=lesson&kanji=${kanji.id}`)
   ```

   判定の場所にこちらを選んだ理由:
   - **ちらつかない。** クイズ画面で null を見てから戻す案は、`replace` の遷移アニメでクイズ画面(`Nothing new to guess right now.`)が一瞬出てから畳まれます
   - **`dismissAll` の挙動が既存と同じ。** 会話文から漢字画面は `push` で積まれていて(`conversation/[id].tsx:77`)、戻り方は `quiz.tsx` の `done` と同じ分岐になります。遷移アニメの途中で effect から `dismissAll` を呼ぶ危うさもありません
   - **テストしやすい。** 判定は純粋な `pickQuizItem` の null / 非 null だけで、画面側に別の判定関数を作らないので、条件が二重になりません

   クイズ画面は同じ DB 状態からもう一度選び直します。この間に書き込みは無く、lesson の条件は時刻に依存しないので、ここで非 null ならクイズ画面でも非 null になります(乱数で語が変わるだけ)。`itemKey` を URL で渡す案は、ディープリンクから任意の語を出せてしまうので採りません。

4. **スキーマとクエリを変える。**
   - `schema.ts` の enum を広げ、`pnpm run db:generate` を実行して `src/db/migrations/` に差分が出ないことを確かめる
   - `quiz-attempts.ts` を上の「データモデルの変更」の形にし、`db/index.ts` の公開を差し替える
   - `newQuizAttemptId()` はクエリ層に置いて `@/db` から公開する。`@/db/id` を DB の外から import させないため

5. **`record-attempt.ts` と `quiz.tsx` を変える。**
   - `read()` を `loadQuizInput` → `pickQuizItem` → `buildQuizChoices` に置き換え、遅延初期化の戻り値に `attemptId: item === null ? null : newQuizAttemptId()` を足す。StrictMode で初期化関数が2回呼ばれても、使われるのは片方だけなので問題ありません
   - 表示の記録は `useEffect(() => { if (item !== null && attemptId !== null) recordQuizShown({ id: attemptId, itemKey: item.itemKey }); }, [attemptId, item])` に置く
     - **`useState` の初期化関数や setState の updater の中では書かない**(`review.tsx` のコメントのとおり)
     - effect の中で setState しないので `react-hooks/set-state-in-effect` にも当たらない
     - StrictMode で effect が2回走っても、同じ `id` への `ON CONFLICT DO NOTHING` なので1行だけ入る。ref のフラグではなく DB の一意性で冪等にしてあり、React の内部挙動に依存しない
   - スワイプバックや Back で抜けても、表示時点で行が入っているので記録は残る
   - `select` は `recordQuizAnswer({ id: attemptId, result })` の後に `setSelected`。既存の `selected !== null` ガードは残す
   - コメントの「記録するのは『この語を出した』ことだけ」を、表示時と回答時の2段に書き直す

6. **復習の `Try again`。**
   - `session.ts` に次を足す

     ```ts
     export function isRetry(session: ReviewSession): boolean
     // current === null → false
     // answered === null → answeredKanjiIds.includes(current.kanji.id)
     // answered !== null → !answered.first
     ```

   - `answered` で分けるのが要点です。最初の回答の直後は `answeredKanjiIds` にもう字が入っているので、`includes` だけで判定すると**初回の答え合わせ中に `Try again` が出てしまいます**
   - `review-session-view.tsx` の `styles.prompt` 内、漢字の上に `<Text>Try again</Text>` を置く。色は `theme.accent`、小さめの文字。`theme.negative` は使わない(罰に見せないため)。答え合わせ中も出したままにして、ラベルの点滅を避ける

7. `docs/data-model.md` / `src/db/CLAUDE.md` / `docs/architecture.md` を更新する。

8. `pnpm run check` を通し、シミュレータで受け入れ条件を確認する。確認3の判断結果と、`guess-quiz.md` 差分2 の取り下げは「実装後の記録」に残す。

## 受け入れ条件

### 実機(iOS シミュレータ)で確認するもの

**学習直後のクイズ**
- [ ] 第1章 #1(人)で `Got it` を押すとクイズ画面が開き、`人間` が出る
- [ ] 第1章 #4(日)で `Got it` を押すと、`日本` か `日本語` が出る
- [ ] 第1章 #5(食)で `Got it` を押すと、**クイズ画面を一瞬も経ずに** Today に戻る。`人間` / `大雨` / `小川` / `日本` / `日本語` は出ない。#6(上)、#7(下)、#10(家)も同じ
- [ ] 上の Today で左端からスワイプしても、漢字画面や会話文に戻らない(スタックが畳まれている)
- [ ] (案Aの場合。第3章は開発専用の `learningkanjimobileapp://conversations` から開く)#26(外)で `外出` が出た直後に #27(出)を終えると、クイズは出ずに Today に戻る

**表示時の記録**
- [ ] 復習終了画面の `Bonus: guess a word` から語X を表示し、`Show choices` を押さずに `Back` で抜ける。もう一度 `Bonus: guess a word` から入ると、X 以外の語が出る(候補が2語以上ある状態で)
- [ ] 同じ手順を、`Back` の代わりに左端からのスワイプバックで行っても、X 以外の語が出る
- [ ] シミュレータの DB ファイルに `sqlite3` で SELECT だけを発行して確かめる。語を表示して `Back` で抜けると、`quiz_attempts` が**1行だけ**増え、その `result` は `shown`
- [ ] 表示から回答まで進めると、`quiz_attempts` の行数は表示時から増えず、同じ行の `result` が `correct` か `incorrect` になり、`updated_at` が `created_at` より大きい
- [ ] クイズを表示または回答しても、`review_events` の行数と Today の `n due` は変わらない

**復習の Try again**
- [ ] 復習3件で、1件目をわざと間違えて `Next` を進めると、その字が後ろでもう一度出たときに、漢字の上に `Try again` が出る
- [ ] その `Try again` は、答え合わせ中(`Next` を押す前)も出たまま
- [ ] 初めて出る字には、正解・不正解のどちらの答え合わせ中にも `Try again` は出ない
- [ ] 出し直しが出ても、進捗の分母(`n / 3` の 3)は変わらない

### 静的確認・自動テスト

- [ ] `pnpm run db:generate` を実行した後、`git status --porcelain src/db/migrations` の出力が空(新しいマイグレーションが生成されない)
- [ ] `rg "#[0-9a-fA-F]{3,8}|rgba?\(" src/features/srs/components/review-session-view.tsx src/app/quiz.tsx src/app/kanji` が0件(絶対規則1)
- [ ] `rg "update\(reviewEvents\)|delete\(reviewEvents\)" src` が0件(絶対規則5)
- [ ] `rg "update\(quizAttempts\)" src` が `src/db/queries/quiz-attempts.ts` の1箇所だけで、その WHERE に `result = 'shown'` の条件がある
- [ ] `rg "insertQuizAttempt|recordQuizAttempt" src` が0件(書き込み口が表示時と回答時の2つに置き換わっている)
- [ ] `boundaries.test.ts` が通る(`load-quiz-input.ts` を含め、クイズ側から `@/features/srs` / `recordReview` / `insertReviewEvent` / `reviewEvents` に触れていない)
- [ ] 追加した UI 文言は `Try again` だけで英語(絶対規則7)
- [ ] `selection.test.ts` / `session.test.ts` の、下記「テスト方針」に挙げたケースがすべてある
- [ ] `pnpm run check` が通る

## テスト方針

**`src/features/quiz/selection.test.ts`**(フィクスチャのみ。実データに依存させない)

- フィクスチャ `input()` の既定 `slot` を `'review'` に変える
  - 理由: 既存テストの多く(ふるい1〜5、直近回避、rng)は `focusKanjiId` なしの lesson で書かれていて、新しい規則ではすべて null になる。ふるいは slot 共通なので review で見れば意味は変わらない
- lesson、今学んだ字を含む語がある → その語が返る(既存テストを維持)
- lesson、今学んだ字の語が無く、その日に学んだ別の字の語はある → **null**(既存の「その日に学んだ字を優先する」「その日に学んだ字の語に落ちる」の2件を書き直す)
- lesson、`focusKanjiId` なし(候補はある)→ null
- lesson、`focusKanjiId` がマスタに無い → null
- lesson、今学んだ字の語の一部が直近に出ている → 直近に無い方が返る
- lesson、今学んだ字の語が全部直近に出ている → null(案A。案Bならその語が返る)
- review、候補が全部直近に出ている → 条件を落として1問返す(既存を維持)
- review で `focusKanjiId` を渡しても無視される(既存を維持)

**`src/features/srs/session.test.ts`**(`isRetry`)

- 作ったばかりのセッション → false
- 初めて出た字を不正解にした直後(答え合わせ中)→ false
- その字が `advanceReviewSession` で戻って `current` になった → true
- 戻ってきた字に回答した後(`answered.first === false`)→ true
- 1件目を不正解にし、次に出た**別の字**(初出)→ false
- 全問終えて `current === null` → false

**テストを書かないもの**
- `load-quiz-input.ts` / `record-attempt.ts` / `quiz-attempts.ts`。`@/db/client` に到達して SQLite を開くので、Jest では動かさない(既存方針)
- 冪等性(ON CONFLICT、`WHERE result='shown'`)は実機の `sqlite3` での確認と、静的確認の `rg` で担保する
- 画面(遷移、`Try again` の見た目)は手動確認でよい

## リスク・未確定事項

- **確認3(案A か 案B か)が未決定。** 実装ステップ1とテスト1件の期待値だけが変わる
- **確認2: 学習直後のクイズが50回中23回出なくなり、1問も出ない日がある。** 開発者の方針の帰結で、要件4.4 とは矛盾しない。TestFlight で「クイズの存在に気づかない」という声が出たら、構成字グロスの追加(スコープ外)で候補を増やすのが筋
- **案Aでは、上の23回に加えて直近回避でも出ない回がある。** `外出` / `来年` / `読書` のペアの2回目、`人間`(人#1 → 間#13)のように直近10件の窓に残っている語。正確な回数は、復習後のクイズがどれだけ挟まるかで変わるので机上では出せない
- **`pnpm run db:generate` で差分が出る可能性。** drizzle-kit(^0.31.10)が enum を CHECK 制約として出力するようになっていたら、差分が出る。その場合は手で直さず、コミットせずに止めて報告する(SQLite で CHECK を足すとテーブルの作り直しになるため)
- **漢字画面での判定とクイズ画面の出題は、別々に DB を読む。** 間に書き込みが無く、lesson の条件が時刻に依存しないことが前提。将来 lesson に時刻依存の条件を足すとこの前提が崩れ、クイズ画面に `Nothing new to guess right now.` が出うる(落ちはしない)
- **表示の記録は、描画後の effect で入る。** 描画直後から effect が走るまでの間にアプリが落ちると、その表示は記録されない。影響は「同じ語がもう一度出うる」だけなので許容する
- **`quiz_attempts` に UPDATE を1種類持ち込む。** `quiz-attempts.ts` の「INSERT と SELECT しか書かない」、`data-model.md`、`src/db/CLAUDE.md` の3箇所をそろえて直す。そろえないと、次のレビューで「規約違反」として差し戻される
- **`Try again` の色を `theme.accent` にした。** テーマを足す回(ADR-0006 で MVP は単一テーマ)に、アクセント色の上で十分目立つかを見直す必要がある。新しいトークンは足さない
- **絶対規則の自己点検**

  | 規則 | 状況 |
  |---|---|
  | 1(色) | `Try again` は `theme.accent`。他に色は増やさない |
  | 2(ULID) | `newQuizAttemptId()` は既存の `newId()` |
  | 3(timestamps) | 既存の列を使う。UPDATE 時に `updated_at` を更新する |
  | 4(コンテンツとユーザー状態の分離) | 読むのは `words` / `kanji` / `sentences`、書くのは `quiz_attempts` だけ |
  | 5(review_events は追記のみ) | `review_events` は変更しない。UPDATE は SRS ではない `quiz_attempts` だけ |
  | 6(マイグレーション) | 生成なし。差分が出たら止める |
  | 7(UI文言は英語) | `Try again` のみ追加 |
  | 8・9(ライブAI・サーバー) | 該当なし |
  | 10(クイズを SRS に入れない) | クイズ側から SRS への依存は作らない。`boundaries.test.ts` を維持。`Try again` は復習側だけの変更 |
  | 11(読み変化の演出) | 触れない |
  | 12(iOSのみ) | Android 固有コードなし |

## 実装後の記録

**判断**

- 確認2: 学習直後のクイズが50回中23回出ない頻度を、開発者が受け入れた
- 確認3: 案A。学習直後は直近回避の条件を落とさない
- `guess-quiz.md` 差分2 の「学習直後は条件を落として必ず1問出す」は、このプランで取り下げた(凍結済みのプランなので、あちらは書き換えていない)

**`pnpm run db:generate` の出力**

- `No schema changes, nothing to migrate`
- `git status --porcelain src/db/migrations` の出力は空

**実機(iPhone 17 Pro シミュレータ、Metro 経由の Debug ビルド)で確認したもの**

- 小(#3)で `Got it` → クイズ画面が開き `小川` が出た
- 日(#4)で `Got it` → `日本` が出た
- 食(#5)で `Got it` → Today に戻り、`quiz_attempts` は増えなかった。`lesson_events` は1件増えた
- その Today で左端からスワイプしても、画面は Today のままだった
- クイズを表示した時点で `quiz_attempts` に `result='shown'` の行が1行だけ入った。開発ビルドは StrictMode で effect が2回走るが、行は1行だった
- 回答すると行数は変わらず、同じ行の `result` が `correct` になり、`updated_at` が `created_at` より大きくなった
- 日本 を答えずに `Back` で抜けても、`shown` の行が残った
- 復習後の `Bonus: guess a word` で `大雨` が出て、答えずにスワイプバックで抜けた。次に入ると(復習が0件になったので `learningkanjimobileapp:///quiz?slot=review` で開いた)`日本語` が出た。`大雨` も、直近の `日本` も避けられた
- クイズの表示や回答では `review_events` は増えなかった(復習で答えた2件だけ)
- 復習2件で、1件目の `人` をわざと間違えた
  - 初回の答え合わせ中は `Try again` が出なかった
  - 次に出た別の字 `大` にも `Try again` は出なかった(正解の答え合わせ中も出なかった)
  - `人` が戻ってきたら漢字の上に `Try again` が出て、答え合わせ中も出たままだった
  - 進捗は `1 / 2` で、分母は変わらなかった
  - 出し直しの正解は `review_events` に書かれなかった(`人 incorrect` と `大 correct` の2件だけ)

**実機で未確認のもの**

- 上(#6)・下(#7)・家(#10)でクイズが出ないこと。同じ理由の 食 で確かめたので、残りはユニットテストと実データのシミュレーションで担保した
- #1(人)で `人間` が出ること。シミュレータでは学習済みだったため
- 外(#26)→ 出(#27)でクイズが出ないこと(案A)。第3章は購読が必要なので実機では通していない。`selection.test.ts` の「全部直近に出ていたら出さない」で担保した
- 「クイズ画面を一瞬も経ずに」戻ること。遷移後のスクリーンショットでしか見ておらず、コマ送りの確認はしていない

**レビュー**

reviewer は「要修正」を返した。指摘は3件で、どれもコメントとドキュメントの修正だった。

- `selection.ts` のコメントに古い関数名 `preferForSlot` が残っていた → 直した
- `architecture.md` の「漢字画面が開かずに」が誤読しやすかった → 直した
- この「実装後の記録」がまだ空だった → この節を書いた

**ついでに気づいたもの(スコープ外なので直していない)**

- `kanji/[id].tsx` と `quiz.tsx` に、Today まで畳む分岐(`canDismiss() ? dismissAll() : replace('/')`)が重複している。プランでもスコープ外にしたもの
