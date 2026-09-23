# プラン: daily-goal-soft-cap

作成日: 2026-09-23
ステータス: 完了(2026-09-23 承認・実装。決めどころ1b は推奨の i)
要件定義書の対応箇所: 5.1-8(1日の学習量)/ 5.4(完走日数の想定)/ 4.1-5(段階的再登場の第2段階)/ 7章(無料範囲)
関連プラン(完了・凍結。書き換えない): `docs/plans/srs-lessons.md` / `docs/plans/paywall-gate.md` / `docs/plans/onboarding.md` / `docs/plans/reading-reveal.md` / `docs/plans/legibility-quick-wins.md`
関連 ADR: ADR-0003(→ 置き換え)/ ADR-0008(前提が変わる。本文は触らない)/ ADR-0011(新規)

## 目的

1日の新出漢字3字を「上限」から「目標」に変える。目標を達成したら祝って樹の伸びを見せ、続けたい人は3字ずつ先へ進めるようにする。そのうえで、第2段階(読みが変わる回)は**覚えた字の翌日以降**にしか出さない。速く進む人でも「何日か後に、覚えた字が読みを変えて戻ってくる」時間差が崩れないようにするため。

## 要件定義書との突き合わせ(実装の前に確認してほしい点)

**要件の変更であって、要件の解釈ではない。** 次の5点は ADR-0011 と要件定義書の更新で明示的に変える。

1. **5.1-8「1日の学習量上限 / 1日3字」は Must have の行そのもの。** 「目標」に変えるのは要件の変更なので、ADR-0011 と 5章(stock)の書き換えで扱う。`CLAUDE.md` の絶対規則には当たらない。
2. **ADR-0003 の理由3「習慣が付いてから課金判断」を捨てることになる。** 無料の第1章10字は、最短で初日に読み切れる(3+3+3+1)。
3. **ADR-0008 の前提「無料体験は実質約4日」が「最短1日」に変わる。** ADR-0008 の決定(境界は第1章のまま)は動かさない。前提が変わったことだけを ADR-0011 に書く。ADR-0008 本文は flow なので触らない。要件9章の「無料範囲の境界を見直すか」は未決のまま残す。
4. **5.4「全50字は約17日で完走する想定」を「3字/日のペースなら約17日、最短5日(翌日規則による)」に直す。**
5. **合意済みの仕様表には無い帰結が1つある(決めどころ1b)。** 翌日規則 B を採ると、ちょうど3字/日のペースの人でも**16日目は2字で止まり、目標3字に届かない**。シミュレーションで確認済み。D16 は #53・#54 を学んだ時点で、#55 外国(国#54 が当日)の手前で止まる。

この5点とも「課金ゲートは `gateSentences()` で入力を絞り、SRS は購読を知らない」という設計(`src/app/index.tsx` 61〜66行)とはぶつからない。

**Expo の確認**: `package.json` は expo ~57.0.11 / react-native 0.86.2。今回は既存の RN コア(`Pressable` / `Text` / `View` / `Switch`)しか使わず、新しい Expo API は入らない。バージョンの扱いは EAS のドキュメントで確認した。`eas.json` が `appVersionSource: "remote"` のとき EAS が持つのは `ios.buildNumber` だけで、ユーザーに見える `version` は `app.json` を手で上げる(決めどころ4)。

## 設計の決めどころ

### 1. 翌日規則で出せない回に当たったとき → **B: その手前でその日を止める(推奨)**

| 観点 | A. 保留して後ろへ進む | **B. 手前で止める** |
|---|---|---|
| 会話文の順番 | 入れ替わる(#55 が #56 の後になる。#51→#52 の逆順の仕掛けも崩れうる) | 崩れない |
| 一気読み | 解消しない(1日で #56〜#58 まで進める) | 最短5日に分かれる |
| 止まる理由 | — | 内容由来(「国が明日戻る」)。数字の上限にはならない |
| 1日の新出の最大 | 50 | **16**(D1)。翌日の復習が50件まとめて来る最悪ケースが起きない |

シミュレーション(`lesson_events` から字ごとの初回学習日を出し、`isSameLocalDay` の基準で判定)の結果。

- 一気読み: D1 #1〜#16 / D2 #17〜#29 / D3 #30〜#44 / D4 #45〜#54 / D5 #55〜#58
- 3字/日: D1〜D15 は今と同じ。**D16 だけ #53・#54 で止まり(2字)、D17 が #55〜#58**。完走は今と同じ17日

#### 1b. 目標に届く前に翌日規則で止まった日(上の D16)

- **i. 「2 of 3」をそのまま出し、翌日に戻る字を一言添える(推奨)。** ストリーク(連続記録)も計測も無いので、未達でも罰が無い。嘘をつかない
- ii. 待ちで止まった日は目標達成として扱う。表示が「達成」なのに2字しか学んでいない
- iii. 目標未達のときだけ A 方式で飛ばす。規則が2つになり、テストも説明も倍になる

### 2. 無料枠の境界 → **ラベルを実際に開く字数に合わせ、尽きたら既存の Unlock カードへ(推奨)**

- **A(推奨)**: リンクの文言を `Learn ${moreCount} more kanji` にする。`moreCount` は「押したら新たに並ぶ新出字の数」を純粋関数でシミュレーションして出す。第1章の4回目は `Learn 1 more kanji` と表示される。#10 まで終えると `allDone` が true になり、今ある `Unlock the next 3 chapters` カード(exhausted 表示)がそのまま行き止まりを受け止める。翌日規則の手前で字数が減る場合(例: #16 の1字だけ)も同じ仕組みで正しい数が出る
- B: 常に `Learn 3 more kanji` と出し、実際には1字しか開かない。ラベルが事実と違う
- C: 残りが3字未満になったら「もう」を出さず、Unlock カードにする。残り1字が翌日に回り、合意仕様の「アクセス可能な範囲内で制限なし」に反する
- (却下)D: 無料ユーザーには「もう」を出さず、ADR-0003 の理由3を無料だけ維持する。合意仕様(未購読なら第1章の範囲内で追加できる)に反する

**ADR-0011 に書くこと**: ADR-0003 の理由3を捨てること。無料体験が最短1日になること(ADR-0008 の前提の変化)。代わりに得るもの(1.0.0 の「初日の3字でやることが無くなる」への対応と、「購読した当日は有料の中身に届かない」問題の解消。`docs/log/2026-09.md` の未回収の借り)。

### 3. 目標達成後の見せ方 → **祝いと樹が主役、「もう」は控えめなテキストリンク(推奨)**

一覧の中で、目標分の行の直後に `GoalCard` を置く。追加で開いた行(`beyondGoal`)はカードの**下**に並ぶ。押した直後、カードのすぐ下に3行が現れる形になり、「目標は3のまま、その先はおまけ」が位置で伝わる。

- 見出し `Daily goal met`
- 今日学んだ新出字を並べる(`theme.type.minchoBold` / `theme.accent`、`accessibilityLanguage="ja-JP"`)
- 本文 `${met} of ${total} kanji on your tree`(`metKanjiCount` / `totalKanjiCount` は既に渡っている)
- 主導線 `See your kanji tree` → `onOpenTrees`
- 副導線(控えめ): `Learn ${moreCount} more kanji`。`theme.textMuted`、13〜14pt、`hitSlop`。**今日の未完了がゼロで、`moreCount > 0` で、翌日待ちでないときだけ**出す
- 翌日待ちなら副導線の代わりに `国 comes back tomorrow in a new word.`(2字なら `A and B come back ...`)を出す

アニメーション(樹が伸びる演出)は作らない(スコープ外)。

却下: 祝いと「もう」を同格のボタン2つにする案(勧めているように見える)、「もう」をカード全体のタップにする案(誤タップで先に進む)。

### 4. バージョン 1.1.0 と What's New → **このプランに含めない。リリース作業に回す(推奨)**

- 次の提出には #52(legibility-quick-wins)とこの機能が両方入るので、What's New は1機能のプランに収まらない
- 1.0.0(build 5)は承認・公開済みなので、次の提出は新しいバージョン(1.1.0)として出すことが確定している。version の引き上げと What's New は、提出の直前にリリース作業として1か所でまとめて行う
- `app.json` は並行セッションで衝突しやすい1行
- このプランで扱うのは、**アプリの動作と食い違う文面**(store-listing の Description、オンボーディング)の修正と、`docs/release-checklist.md` への積み残しまで

### 5. 「もう3字」を押した状態の持ち方 → **その日だけの UI 状態 + `lesson_events` からの導出を併用(推奨)**

- 開いている枠 `opened` = max(① 目標3、② 学んだ字数から導出した値、③ 当日の押下要求)
  - ② は 目標 + 3 × ceil(max(0, 今日学んだ字数 − 目標) / 3)。今日5字学んだ状態でアプリを落としても、6枠目(追加の残り1字)は開いたまま残る
  - ③ は `src/app/index.tsx` の `useState<MoreLessonsRequest | null>`(`{ requestedAt, openedCount }`)。`requestedAt` が今日でなければ純粋関数の側で無視するので、日をまたいでも前日の押下が残らない
- 消えるのは「押した直後、1字も学ばずにアプリを落とした」場合だけで、そのときは `Learn 3 more kanji` がもう一度出る。許容する
- 学習フローの戻りは `router.dismissAll()`(`src/app/kanji/[id].tsx` 67行 / `src/app/quiz.tsx` 94行)で、Today はマウントされたまま state が残る。フォールバックの `router.replace('/')`(ディープリンクから入ったとき)で再マウントしても、② があるので実害は上と同じ範囲に収まる
- 却下: `user_settings` に永続化する案。マイグレーションが要り、将来の同期で「その日だけの状態」を同期対象に入れる意味が無い

## スコープ外

- **バージョン番号(`app.json` の `version`)の引き上げと What's New の文面**(決めどころ4。`docs/release-checklist.md` に積むだけ)
- **サポートページ(`gh-pages` ブランチの `support/index.html`)の FAQ「Why can't I learn more than three kanji a day?」の書き換え。** 別ブランチで、1.1.0 の公開と同時に変えないと 1.0.0 の挙動と食い違う。release-checklist に積む
- ASC への Description の入力(release-checklist に積む)
- 目標字数や「もう」の字数をユーザーが変えられる設定(要件5.5 と ADR-0003 の却下理由のまま)
- ストリーク・連続日数・達成履歴の保存と表示
- 樹が伸びるアニメーション、祝いの演出(紙吹雪など)
- 通知・リマインダー(要件5.5)
- 復習(`planTodaysReviews`)の上限や順序の変更。元から上限は無く、変えない
- 推測クイズの出題条件(学習直後の枠)の変更
- 無料範囲の境界そのものの見直し(要件9章の未決事項のまま)
- 端末の時計の巻き戻し検出(既存の方針のまま)
- 挙動に関わらない古いコメントの掃除: `src/app/conversations.tsx` 10行、`src/features/reading/conversation-list.tsx` 6行、`src/features/srs/scheduler.ts` 22行(「3字/日」は目標ペースとしてまだ正しい)
- 開発トグルで学んだ字が打ち切り位置より後ろにあると、トグルを戻したときに done 行が一覧から消える既存の挙動(開発時だけ起きる)
- 新規テーブル・マイグレーション

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/srs/lessons.ts` | 変更 | `DAILY_NEW_KANJI_LIMIT` → `DAILY_NEW_KANJI_GOAL`、`MORE_NEW_KANJI_STEP` を新設。`planTodaysLessons` の入出力を変える。翌日規則を入れる。`requestMoreLessons` を新設 |
| `src/features/srs/lessons.test.ts` | 変更(書き直し) | 上限前提のテストを目標・追加・翌日規則のテストに置き換える。実データでの日程シミュレーションを1ブロック足す |
| `src/features/srs/index.ts` | 変更 | エクスポート名の更新(`DAILY_NEW_KANJI_GOAL` / `MORE_NEW_KANJI_STEP` / `requestMoreLessons` / 新しい型) |
| `src/features/srs/components/today-view.tsx` | 変更 | 見出しの進捗表示、目標分と追加分の行の分割、`GoalCard`、翌日待ちの一言、`Notice` の整理、開発トグルの置き換え |
| `src/features/srs/day.ts` | 変更 | 冒頭コメントの `Come back tomorrow.` への言及を直す(コメントのみ) |
| `src/app/index.tsx` | 変更 | `ignoreLimit` → `devUnrestricted`、押下要求の `useState`、`onLearnMore` の受け渡し |
| `src/features/onboarding/steps.ts` | 変更 | 2画面目の見出しと本文を「目標」の言い方にする |
| `src/features/onboarding/steps.test.ts` | 変更 | 定数名の更新、「goal を含み、up to を含まない」の検査 |
| `src/features/onboarding/components/onboarding-view.tsx` | 変更 | 大きい数字の下の `kanji a day` を目標の言い方に。`DailyLimit` → `DailyGoal`、コメント |
| `src/features/paywall/access.test.ts` | 変更 | 「上限は3字」のコメントを直す。「もう」でも有料の文が入らない検査を1件足す |
| `docs/decisions/ADR-0011-daily-goal-soft-cap.md` | 新規 | 上限→目標、翌日規則 B、無料枠への影響、却下案 |
| `docs/decisions/ADR-0003-daily-kanji-limit.md` | 変更 | **4行目のステータスだけ** `置き換え済み(→ADR-0011)` に。本文は触らない |
| `docs/requirements.md` | 変更 | 5.1-8 の行、5.4 の完走日数、冒頭の最終更新日 |
| `docs/store-listing.md` | 変更 | Description の `Three new kanji, no more.` の行 |
| `docs/architecture.md` | 変更 | 28行(srs の担当)、113行(`index.tsx` の説明) |
| `docs/release-checklist.md` | 変更 | 120行(実装済みの表記)、127行(開発トグル名)、次回提出の積み残し4件を追加 |
| `README.md` | 変更 | 106行・113行(1日3字の説明と開発トグル名) |
| `docs/plans/daily-goal-soft-cap.md` | 新規 | このプラン |

## データモデルの変更

**なし。** マイグレーションも不要。

- 字ごとの「最初に学んだ時刻」は既存の `lesson_events`(`kanji_id` / `completed_at`)から出す
- 「もう」の押下はその日だけの UI 状態で、永続化しない(決めどころ5)
- `review_events` には読み書きとも触れない(絶対規則5)

## 実装ステップ

1. **ADR-0011 を書き、ADR-0003 のステータス行を差し替え、`docs/requirements.md` 5章を更新する。** 理由を先に固める。ADR-0011 に入れるもの:
   - 背景(1.0.0 のフィードバック)
   - 決定(目標3 / 3字ずつ追加 / 翌日規則 B / 1b-i)
   - 理由(一気読みでも最大16字/日、最短5日。`docs/content-decisions.md` 5章の「同章内の第2段階」の未解決点が、最低1日空く形で緩和される)
   - 却下案(A / 1b-ii・iii / 決めどころ2の B・C・D / 永続化)
   - トレードオフ(ADR-0003 理由3の放棄、ADR-0008 の前提「約4日」が最短1日に、計測手段が無いこと)
2. **`src/features/srs/lessons.ts` を書き換える(テストを先に書く)。** 入出力の形:
   ```ts
   export const DAILY_NEW_KANJI_GOAL = 3;
   export const MORE_NEW_KANJI_STEP = 3;
   export interface MoreLessonsRequest { requestedAt: number; openedCount: number }
   export interface TodaysLessonItem { sentence: Sentence; done: boolean; beyondGoal: boolean }
   export interface TodaysLessons {
     items: TodaysLessonItem[];
     learnedToday: number;
     goal: number;          // 表示用。追加しても変わらない
     goalMet: boolean;      // learnedToday >= goal
     opened: number;        // 今日開いている新出字の枠(目標 + 追加)
     moreCount: number;     // 次に「もう」を押すと新たに並ぶ新出字の数
     waitingFor: { sentence: Sentence; kanjiIds: string[] } | null; // 翌日規則で止まった回と、当日学んだために待っている字
     allDone: boolean;
   }
   // 入力: sentences / completions / now / moreRequest?: MoreLessonsRequest | null / unrestricted?: boolean
   export function requestMoreLessons(lessons: TodaysLessons, now: number): MoreLessonsRequest
   ```
   走査の規則(`order` 昇順):
   - 今日より前に終えた回は飛ばす
   - 今日終えた回は done で載せる
   - 新出字の無い回は、`stage === 2` の `kanjiIds` がすべて「学び終えていて、最初に学んだ時刻が今日ではない(`!isSameLocalDay`)」なら枠を使わずに載せる。そうでなければ `waitingFor` を立てて打ち切る
   - 新出字の回は、`learnedToday` から数えた使用枠が `opened` に達していたら打ち切る(現行と同じく `used = learnedToday` から数える)
   - `beyondGoal` は order 順に数えた新出字の通し番号が goal を超えた行と、その後ろに載る第2段階の行につける
   - `moreCount` は同じ走査を `opened + STEP` で回し、増えた新出字の件数で出す
   - `unrestricted` のときは枠も翌日規則も外し、`moreCount = 0`
   - 「最初に学んだ時刻」は `earliestCompletionBySentence` と同じく最古の1件で決める
3. **`src/features/srs/index.ts` のエクスポートを更新する。**
4. **`src/features/paywall/access.test.ts` を直す**(コメント + 1件追加)。
5. **`src/app/index.tsx`**: `ignoreLimit` を `devUnrestricted` に改名する。`moreRequest` の `useState` を足し、`onLearnMore={() => setMoreRequest(requestMoreLessons(lessons, snapshot.now))}` を渡す(`requestedAt` を `snapshot.now` にするのは、表示している計画と同じ「今日」に揃えるため)。開発トグルは `__DEV__` のときだけ渡す。
6. **`src/features/srs/components/today-view.tsx`**:
   - 見出しは、目標前 `${learnedToday} of ${goal} kanji today`、達成後 `Goal met · ${learnedToday} kanji today`
   - 行を `beyondGoal` で2群に分け、間に `GoalCard` を置く(決めどころ3)
   - `Notice` から `"You're done for today. Come back tomorrow."` を削除する(新しい出力では到達しない)
   - 翌日待ちで目標未達のとき(1b-i)は `That's all for today. 国 comes back tomorrow in a new word.`
   - 開発トグルのラベルは `Ignore daily goal and next-day rule`
   - 色はすべて既存トークン(`theme.text` / `textMuted` / `accent` / `surfaceVeil` / `border`)
7. **オンボーディング**: 見出しは例えば `Aim for 3 kanji a day`。本文は例えば `Your daily goal is 3 new kanji. Want more? Keep going. Each one comes back in short reviews, and sometimes ...`(後半は現行のまま)。大きい数字の下は `kanji a day, as a goal`。どちらも定数から組み立てる。
8. **ドキュメント**: `docs/store-listing.md` の該当行を例えば `- A goal of three new kanji, and more if you want them. Each arrives in its own conversation.` にする。`docs/architecture.md` と `README.md` を直す。`docs/release-checklist.md` に次の4件を足す:
   - 1.1.0 の version 引き上げ
   - What's New の文面(#52 + 本機能)
   - ASC の Description 差し替え
   - gh-pages のサポート FAQ 差し替え
9. **`pnpm run check`、続いてシミュレータで受け入れ条件を確認する。**

## 受け入れ条件

### 機械的に検証するもの

- [ ] `pnpm run check` が通る
- [ ] `src/db/migrations/` と `src/db/schema.ts` に差分が無い
- [ ] 変更した `.ts` / `.tsx` に `#` で始まる色リテラルと `rgb(` が増えていない
- [ ] `src/` に `DAILY_NEW_KANJI_LIMIT` / `Ignore daily limit` / `Come back tomorrow` の文字列が残っていない
- [ ] `docs/store-listing.md` に `no more` が残っていない
- [ ] `git diff docs/decisions/ADR-0003-daily-kanji-limit.md` がステータス行1行の変更だけ
- [ ] `docs/decisions/ADR-0011-daily-goal-soft-cap.md` があり、ADR-0003 の理由3を捨てることと、無料体験が最短1日になることが書いてある
- [ ] `lessons.test.ts` の実データのブロックで、次の2つが成り立つ
  - 毎日すべて学ぶ場合の日割りが D1 #1〜#16 / D2 #17〜#29 / D3 #30〜#44 / D4 #45〜#54 / D5 #55〜#58
  - 毎日3字の場合、D16 が #53・#54 で `waitingFor` が #55、D17 が #55〜#58

### シミュレータで確認するもの(開発ビルド。第2章以降は Test Store で購読した状態)

- [ ] 学習記録が空の状態で Today を開くと、#1〜#3 の3行と見出し `0 of 3 kanji today` が出て、`Learn ... more kanji` は出ない
- [ ] #1〜#3 を終えて戻ると、見出しが `Goal met · 3 kanji today` になる。3行の下に `Daily goal met` カードが出て、今日の3字と `See your kanji tree` と `Learn 3 more kanji` がある
- [ ] `See your kanji tree` を押すと漢字一覧(`/trees`)が開く
- [ ] `Learn 3 more kanji` を押すと、カードの**下**に #4〜#6 が並び、見出しは `Goal met · 3 kanji today` のまま(`of 6` にならない)。未完了がある間は `Learn ... more kanji` が消えている
- [ ] 未購読で今日 #1〜#9 を終えた状態では、リンクが `Learn 1 more kanji` になる。押して #10 を終えると `Learn ... more kanji` は出ず、`Unlock the next 3 chapters` カードが出る
- [ ] 未購読の状態で「もう」を何度押しても、第2章の回(#11 以降)は一覧に1件も出ない
- [ ] 購読状態で同じ日に #16 まで終えると、#17(日曜日)は一覧に出ない。カードに `日 comes back tomorrow in a new word.` が出て、`Learn ... more kanji` は出ない
- [ ] 追加分のうち1字を学んだ状態でアプリを終了して開き直すと、同じ日のうちは残り2字の行がまだ並んでいる
- [ ] 開発トグル `Ignore daily goal and next-day rule` を ON にすると、#16 の直後に #17 が並ぶ(翌日規則が外れる)。OFF に戻すと元の並びになる
- [ ] 目標達成カード・見出し・リンク・待ちの一言など、新しく出た UI 文言がすべて英語(日本語は漢字1字の表示だけ)
- [ ] オンボーディング2画面目の見出しと本文に `goal` が含まれ、`up to` が含まれない
- [ ] 推測クイズは学習直後に今までどおり出る(追加分の字でも出る)。クイズの結果で Today の見出しの字数が変わらない

### 日をまたいで確認するもの(シミュレータを翌日まで残すか実機。論理はユニットテストで担保済み)

- [ ] 前日に9字学んでいても、翌日の見出しは `0 of 3 kanji today` で、新出字の行は3行
- [ ] 前日に「もう」を押して未着手のまま日付が変わった場合、翌日の Today は3行だけ(前日の追加分が持ち越されない)
- [ ] 前日 #16 で止まった翌日、一覧の先頭が #17(日曜日)
- [ ] 追加で学んだ字も、翌日に `Reviews: n due` の件数に入っている

### リリースビルドで確認するもの

- [ ] `__DEV__` が false のビルドで `Ignore daily goal and next-day rule` が出ない(`docs/release-checklist.md` 3章の項目名も差し替わっている)

## テスト方針

**主戦場は `src/features/srs/lessons.test.ts`**(純粋関数)。ほとんどはフィクスチャで組む(抽出規則を見るため)。

- 目標: 空なら3件 / 今日2字済みなら未完了1件 / 3字済みで `goalMet` と `moreCount = 3`
- 追加: 当日の `moreRequest` で3件増え、`beyondGoal` が付く / 前日の `moreRequest` は無視される / 押下要求が無くても今日5字済みなら追加の残り1件が並ぶ(導出)
- 翌日: 前日に9字学んでいても今日3件で、`goal` は3のまま
- 境界: 入力の残りが1字なら `moreCount = 1` / 使い切ると `moreCount = 0` で `allDone`
- 翌日規則:
  - 対象字が前日なら並ぶ(枠は使わない)
  - 当日なら並ばず `waitingFor` が立ち、後続の新出字の回も並ばない
  - 2字のうち1字だけ当日なら待ちになり、`kanjiIds` は当日の1字だけ
  - 対象字が「今日並んでいるが未完了」でも待ちになる
  - 23:59 に学んで翌 00:01 なら並ぶ
  - 目標に届く前に待ちで止まると `goalMet = false` かつ `moreCount = 0`
- `moreCount` は途中の待ちで頭打ちになる(新出1字 → 待ち → 新出2字の並びで1)
- `unrestricted`: 待ちも枠も外れて全件並ぶ
- `requestMoreLessons`: `openedCount = opened + 3`、`requestedAt = now`
- 既存から引き継ぐ: 二重記録 / 後日の読み返し / 第2段階を終えても枠が減らない / `allDone`
- **実データのシミュレーション1ブロック**(`@/content` の `sentences`。DB には届かない)。既存のコメントは「実データを入力にしない」方針だが、ここで守りたいのはコンテンツの間隔という性質そのものなので例外にする。理由をテストのコメントに書く

ほかのテスト:

- `access.test.ts`: `gateSentences` の出力に `moreRequest` を渡しても有料の文が入らない
- `steps.test.ts`: 定数名の更新、`goal` を含み `up to` を含まない

UI(`today-view.tsx` のカードの配置・リンクの出し分け)は上のシミュレータ確認で見る。コンポーネントテストは書かない。

## リスク・未確定事項

- **計測手段が無い**(絶対規則9、要件5.5・7章「RevenueCat 内蔵の計測のみ」)。検証ループは持たない。懸念(購読者が数日で読み切り、低評価や返金につながる)は、**RevenueCat の返金と初回期間内の解約**、**ASC の評価・レビュー**で見る。B により最短でも5日かかることが唯一の歯止め
- **無料体験が最短1日で終わる。** 転換を早める方向にも、「習慣が付く前に課金画面に当たる」方向にも働きうる。どちらかは上記の手段でしか見えない(ADR-0011 に明記)
- **復習の山**: 一気読みでは D1 の16字が翌日にまとめて復習に来る。50字一括(50件)よりは小さいが、3字/日の定常ピーク(12件/日)より大きい。平均(4〜5件/日)は変わらない
- **D16 の目標未達(1b)を開発者が許容するか。** 許容しないなら ii か iii に変えるので、テストの期待値が変わる
- **Description の変更は、次のバージョン(1.1.0)の提出と一緒でないと反映されない。** このブランチをマージしても、ストアの文面は 1.1.0 を提出するまで 1.0.0 のまま(1.0.0 の挙動とは一致しているので問題ない)。アプリとストアの食い違い(Guideline 2.3)が起きないよう、**1.1.0 を提出するときに一緒に差し替える**(release-checklist に積む)。サポートページも同じタイミング
- **並行セッション**: `app.json` の version を触らないのは衝突を避けるため(決めどころ4)
- **端末の時計を巻き戻すと、翌日規則も目標も回避できる。** 既存の方針(`src/features/srs/day.ts` 冒頭)のまま検出しない。逆に未来の時刻の記録があると `!isSameLocalDay` で「前日以前」と見なされるので、詰まる方向には倒れない
- **0時またぎ**: 判定は学び終えた時刻のローカル日(`isSameLocalDay`)。23:59 に学んだ字の第2段階は 0:00 以降に出る。「寝て起きたら」の意図(`day.ts` のコメント)とは数分単位でずれうるが、復習の出題日と同じ基準なので揃えておく。Today を開いたまま日をまたいだ場合は、次のフォーカスで `read()` が `now` を取り直すまで前日の計画のまま(現行と同じ)
- **押下直後の状態は再起動で失われる**(決めどころ5)。1字でも学べば導出で戻る
- **UI の最終文言**(カード・オンボーディング・Description)は実装時に英語の自然さを整えてよい。ただし「goal を含む / up to を含まない / no more を含まない」と、受け入れ条件に書いた見出し・リンクの形は守る

## 実装後の記録

**スコープに足したもの(開発者が承認)**

- `docs/requirements.md` 9章(未決定事項)に「第1段階の再登場をどう満たすか」を1項目追加した。このプランの検討中に、50字中23字が導入後どの会話にも再登場せず、第1段階の `reencounters` が0件だと分かった。翌日規則(第2段階の時期)とは独立した問題なので、このプランでは直さず課題として残す

**プランから変えたこと**

- オンボーディングの大きい数字の下は、プラン案の `kanji a day, as a goal` ではなく `kanji a day — a goal, not a limit` にした。1.0.0 を触った人に「上限ではなくなった」ことが一目で伝わるように
- `lessons.test.ts` は 28件(プランのテスト方針に加え、reviewer の指摘で `beyondGoal` の2件を足した)

**機械的な確認**

- `pnpm run check` が通った。受け入れ条件の機械的な8項目はすべて満たす(reviewer が実行して確認)
- 実データの日割り: 一気読み D1 #1〜#16 / D2 #17〜#29 / D3 #30〜#44 / D4 #45〜#54 / D5 #55〜#58、3字/日 D16 が #53・#54 で `waitingFor` #55、D17 が #55〜#58。architect のシミュレーションと一致
- reviewer の判定は合格(要修正0件)。軽微な3件(テスト名の「limit」、`index.tsx` の古いコメント、`beyondGoal` のテスト不足)は直した

**シミュレータ(iPhone 17e、Release、アンインストールして新規状態)で確認したもの**

学習記録は sqlite で当日の `lesson_events` を入れて再現した。

- オンボーディング2画面目: `Aim for 3 kanji a day` / `kanji a day — a goal, not a limit` / 本文に goal があり up to が無い
- 空の状態: `0 of 3 kanji today`、#1〜#3 の3行、`Learn … more kanji` は出ない
- 3字後: `Goal met · 3 kanji today`。3行の下に `Daily goal met` カード(人 大 小 / `3 of 50 kanji on your tree` / `See your kanji tree` / `Learn 3 more kanji`)
- `Learn 3 more kanji` を押す: カードの下に #4〜#6 が並び、見出しは `Goal met · 3 kanji today` のまま。リンクは消える
- #4 を学んでアプリを終了し開き直す: #5・#6 が残る(学んだ字数からの導出)
- #9 まで学ぶ: `Learn 1 more kanji`。押すと #10 だけが並び、第2章は出ない
- #10 後: リンクが消え、`Unlock the next 3 chapters` カードが出る
- `See your kanji tree` で漢字一覧が開く

**未確認のもの**

- **購読状態の項目(#16 の後に #17 が出ず `日 comes back tomorrow in a new word.` が出る)。** シミュレータで購入するには Sandbox アカウントのサインインが要り、実装側では行えない。論理は実データのユニットテストで担保。**TestFlight の実機(購読済み)で確かめる**
- 開発トグル `Ignore daily goal and next-day rule`(Debug ビルドが要る。`unrestricted` はユニットテストで担保)
- 日をまたぐ4項目(ユニットテストで担保)
- リリースビルドで開発トグルが出ないこと(`__DEV__` の分岐は既存と同じ形)
- 推測クイズが学習直後にこれまでどおり出ること(差分はクイズに触れていない)

**PR 後に直したもの(開発者の実機確認で発見)**

- **`Daily goal met` の g と y の下端が切れていた。** ヒラギノ明朝に `lineHeight` を指定しないと、行の箱が欧文のディセンダの分だけ足りない。同じ画面で同じ書式の `Unlock the next 3 chapters`(p)にも同じ問題があったので、2つの見出しに `lineHeight: 24` を付けた。シミュレータで両方が切れずに出ることを拡大して確認した
- 同じ原因で、既存の Today 見出し `Today` の y も切れている(1.0.0 から)。このプランの外なので直していない

**気づいたこと(直していない)**

- **購読した当日、押していない枠が開くことがある。** 未購読で今日 #1〜#10 を学ぶと、開いた枠は導出で12になる(3 + 3×3)。購入するとすぐ #11・#12 が並ぶ。最後の `Learn 1 more kanji` も1回ぶん(3字)の枠を開いているので、ラベルの1字より多く開く。「購読した当日に有料の中身に届く」方向なので害は無いと判断した
- **Today を開いたまま翌朝に戻ると、前日の `… comes back tomorrow` が出たまま**になる(`useFocusEffect` はバックグラウンドからの復帰では走らない)。既存と同じ挙動だが、以前の `Come back tomorrow.` より文面が具体的なぶん目立つ
- **樹の情報が同じ画面に2回出る**(GoalCard の `N of M kanji on your tree` と、その下の `Kanji tree  N of M` の行)。ホームの情報設計の見直し(フィードバック#10・#11)で扱う
- `comesBackTomorrow()` の文は英文の中に漢字1字が入る形で、`accessibilityLanguage` を付けていない。VoiceOver ではその字が英語の音声で読まれうる

