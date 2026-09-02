# プラン: srs-lessons(今日の学習 3字 + 漢字フォーカス画面)

作成日: 2026-09-02
ステータス: 完了
完了日: 2026-09-02
要件定義書の対応箇所: 4.1(学習ループ 3〜4 の入口)、5.1-3(漢字フォーカス画面)、5.1-8(1日の学習量上限)、6.3-4(イベントログ方式)、ADR-0003

## 目的

入口画面を「今日の学習」に置き換え、**1日3字までの新出漢字を、会話文 → 漢字フォーカス画面 → 完了記録 の順に進められる**ようにする。SRS が復習対象を取り出すための入口(「いつ・何を学んだか」の追記ログ)をここで作る。ステージ計算と復習セッションは次プラン `srs-reviews` の担当。

> **`/plan-feature srs`(SRS復習 ＋ 漢字フォーカス画面)の依頼を2本に分割したうちの1本目。**
> 分けた理由: 現状「その漢字を学んだ」を記録する経路が1つも無く、**先にレッスン側を作らないと
> 復習側は偽データを手で注入しないと受け入れ確認すらできない**(依存が一方向)。
> 純粋ロジックも別物(こちらは日境界+順序走査、あちらはステージ畳み込み+間隔テーブル)で、
> 合算すると新規10ファイル超・画面3枚・マイグレーション1本になり、1本のレビューに載せるには大きい。

## 先に確認したい点(要件・既存データとの食い違い)

実装案の前に 6 点。方針が違うなら承認前に指摘してほしい。**要件を勝手に解釈で変えてはいない。**

1. **「学んだ」を記録する場所が既存スキーマに無い。** `review_events` は結果が `correct | incorrect` の 2 値で、導入を表せない。`correct` を入れて代用するとステージ計算が最初から 1 段ずれる。
   → **`lesson_events` 表を新設**(追記のみ、`kanji_id` は第2段階専用回のため nullable)。要件 6.3-4 の方針内で、絶対規則5 とも矛盾しない。`review_events` には今回 1 行も書かない。
2. **要件 4.1-4「文＋漢字のセットをSRSで復習」と 5.1-4「意味の選択式クイズのみ」が矛盾。** 既に 5.1 を正とする判断が `docs/log/2026-08.md`(08-28)にあるので踏襲するが、要件本文は未修正。**修正か ADR かは次プランで決める**(本プランでは要件本文を触らない)。
3. **「1日3字」は新規のみに掛かる、と解釈する。** 要件本文には明記がなく、ADR-0003 の根拠から読み取ったもの。復習件数には上限を掛けない。
4. **第2段階専用の回(`newKanjiId: null`、現在4回)は 3字の枠を消費しない。** 消費させると最大の差別化要素(段階的再登場)が枠に押し出されて後日に流れる。
5. **「今日」の境界は端末ローカルの午前0時**とする。要件・ADR ともに定義が無いため本プランで決める(理由は「Come back tomorrow」が説明できる最も単純な境界だから)。決めた事実は `/log` に残す。ADR は起こさない想定。
6. **ADR-0003 の宿題「テスト時に上限を外すデバッグ設定」は `__DEV__` 限定で入れる。** リリースビルド(TestFlight を含む)には出ない。TestFlight で完走テストをしたい場合は `DAILY_NEW_KANJI_LIMIT` を変えたビルドを配る運用になる。
   → **2026-09-02 に開発者が `__DEV__` 限定で確定。** 製品コードにゲートを1つも残さないことを優先し、テスターの完走短縮が要るときは定数を変えたビルドを別に配る。

## スコープ外

**今回作らないもの(明示的に次回以降へ送る)**

- **SRS のステージ計算・間隔テーブル・次回出題日・復習セッションUI・意味の4択**(→ `docs/plans/srs-reviews.md`)。今回 `review_events` に書き込む経路は一切作らない
- `kanji_progress` キャッシュ表。`lesson_events` + `review_events` から導出できる。必要になってから足す
- 推測クイズ「読めるかな?」(4.4)と、学習直後の出題枠。`quiz_attempts` にも触らない
- 漢字の樹・漢字一覧グリッド(4.5)、およびフォーカス画面から樹への導線
- **フォーカス画面での語(`words`)一覧の表示。** 葉/つぼみは樹の担当で、ここに出すと二重になる
- 章ロック・課金ゲート(要件7)。`isFree` は今回も読まない。第2〜3章が素で読める状態は継続する(既知の借り)
- オンボーディング(5.1-10)、通知・リマインダー、連続日数、統計画面
- 学習量をユーザーが設定できるようにすること(ADR-0003 で却下済み)
- **コンテンツの修正。** `来` の読み、`話` の葉、第4章17文の投入は content ブランチの作業
- 会話文画面の固定ヘッダー化(`docs/architecture.md` の検討中項目)。CTA は `ScrollView` の中の末尾に置く
- 端末の時計を巻き戻された場合の検出、タイムゾーン移動時の再計算
- 4.6 ステップ3(樹への反映アニメーション)
- 漢字イラスト50枚の生成・`assets/kanji/` への配置

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/db/schema.ts` | 変更 | ユーザー状態セクションに `lesson_events` を追加 |
| `src/db/migrations/0002_*.sql` | 新規(生成物) | `pnpm run db:generate` の出力。**手で触らない**。CREATE TABLE のみ |
| `src/db/queries/lesson-events.ts` | 新規 | `insertLessonEvent` / `listLessonEvents` / `hasCompletedSentence`(**INSERT と SELECT のみ**) |
| `src/db/index.ts` | 変更 | 上記 3 関数と型を公開 |
| `src/db/CLAUDE.md` | 変更 | ユーザー状態テーブルの表に `lesson_events` を追記 |
| `src/features/srs/index.ts` | 新規 | 公開API。他 feature / app 層はここ経由でのみ触る |
| `src/features/srs/day.ts` | 新規 | `startOfLocalDay` / `isSameLocalDay`(純粋・React非依存) |
| `src/features/srs/day.test.ts` | 新規 | 日境界のテスト |
| `src/features/srs/lessons.ts` | 新規 | `DAILY_NEW_KANJI_LIMIT` と `planTodaysLessons()`(純粋) |
| `src/features/srs/complete-lesson.ts` | 新規 | `completeLesson()`(DB書き込みの薄い包み)。**実装時に `lessons.ts` から分けた** — 同居させると `lessons.test.ts` が `@/db` を経由して `@/db/client` に到達し、import しただけで SQLite が開く。プランのテスト方針(「テストから DB 接続に到達させない」)を満たすための分割 |
| `src/features/srs/lessons.test.ts` | 新規 | 抽出ロジックのテスト(フィクスチャベース) |
| `src/features/srs/components/today-view.tsx` | 新規 | 「今日の学習」画面のUI。ルーティングを知らない |
| `src/features/reading/kanji-focus.tsx` | 新規 | 漢字フォーカス画面のUI(要件5.1-3)。`onComplete` は任意 |
| `src/features/reading/kanji-illustration.tsx` | 新規 | `illustrationSource(key)` とプレースホルダ描画 |
| `src/features/reading/kanji-illustration.test.ts` | 新規 | 未登録キー → null を返すこと |
| `src/features/reading/index.ts` | 変更 | `KanjiFocus` を公開 |
| `src/features/reading/conversation-view.tsx` | 変更 | 末尾に任意の CTA(`onContinue`)を追加。**それ以外は触らない** |
| `src/features/reading/conversation-list.tsx` | 変更 | 先頭コメントを「開発用の一覧」に更新(暫定の入口画面ではなくなる) |
| `src/app/index.tsx` | 変更 | 会話文一覧 → 「今日の学習」に置き換え。`useFocusEffect` で再クエリ |
| `src/app/conversations.tsx` | 新規 | **開発用**の会話文一覧(`__DEV__` 以外では null)。第4章の検品に要る |
| `src/app/conversation/[id].tsx` | 変更 | CTA のコールバックを渡す(新出字あり → フォーカス画面へ / 無し → 完了して戻る) |
| `src/app/kanji/[id].tsx` | 新規 | 漢字フォーカス画面のルート。`lesson=1` のときだけ完了 CTA を出す |
| `docs/data-model.md` | 変更 | ユーザー状態の表に `lesson_events` を追記し、追記のみである理由を書く |
| `docs/architecture.md` | 変更 | 「現在のルート」一覧を更新 |

## データモデルの変更

**マイグレーション `0002_*.sql` を新規生成する(CREATE TABLE 1 本のみ)。**

### `lesson_events`(ユーザー状態・将来の同期対象・追記のみ)

| 列 | 型 | 備考 |
|---|---|---|
| `id` | text PK | ULID |
| `sentence_id` | text NOT NULL | 完了した会話文 |
| `kanji_id` | text | **nullable**。第2段階専用の回は新出字が無い |
| `completed_at` | integer NOT NULL | UNIX ms |
| `created_at` / `updated_at` | integer NOT NULL | 絶対規則3 |

インデックス: `lesson_events(sentence_id)` / `lesson_events(completed_at)`。

**UNIQUE を張らない。** `reveal_shown` は「出したか」のフラグだが、こちらは履歴。同じ回を読み直したときに履歴を壊さない(制約違反で落とさない)ほうが追記ログの意図に合う。二重計上は 2 段で防ぐ:

1. 書き込み側 — 既に完了記録がある文には INSERT しない(`markRevealShown` と同じ形)
2. 読み出し側 — 畳み込みで**文ごとに最も古い1件**だけを採る

`ALTER TABLE` を含まないので、既存端末(`reveal_shown` や `user_settings` に行がある状態)にそのまま当たる。`0001` で踏んだ「行がある表への NOT NULL 列追加」の問題は起きない。

## 実装ステップ

1. `src/db/schema.ts` のユーザー状態セクションに `lessonEvents` を足し、`pnpm run db:generate` を実行。生成 SQL を**読んで**確認する(CREATE TABLE のみで、既存表への ALTER が出ていないこと)。編集はしない
2. `src/db/queries/lesson-events.ts` を書く。`insertLessonEvent`(既存記録があれば何もしない)/ `listLessonEvents`(`completed_at`, `id` の昇順)/ `hasCompletedSentence`。**UPDATE / DELETE を書かない**。`src/db/index.ts` から公開する
3. `src/features/srs/day.ts` に `startOfLocalDay(ts)` / `isSameLocalDay(a, b)` を書き、テストを添える。`Date` のローカルメソッドで実装し、テストもローカル時刻で組み立てて TZ 非依存にする
4. `src/features/srs/lessons.ts` に `DAILY_NEW_KANJI_LIMIT = 3`(ADR-0003。マジックナンバーを散らさない)と `planTodaysLessons()` を書く。純粋関数で、入力は `{ sentences, completions, now, limit }`、出力は次の形

   ```
   { items: { sentence, done }[], learnedToday: number, remaining: number, allDone: boolean }
   ```

   走査規則は「`order` 昇順に見て、**今日より前に完了した回は飛ばす**。新出字のある回は枠を1つ使い、枠を使い切った状態で次の新出字の回に当たったらそこで打ち切る。新出字の無い回(第2段階専用)は枠を使わずに含める」。`learnedToday` は**今日の完了記録に含まれる異なり漢字数**
5. `src/features/srs/complete-lesson.ts` に `completeLesson({ sentenceId, kanjiId })` を置く(`insertLessonEvent` の薄い包み)。DB 書き込みの入口を srs に集めておくと、`review_events` と混ぜていないことをレビューで一目で確認できる。**`lessons.ts` と別ファイルにする**(同居させるとテストが SQLite を開く)
6. `lessons.test.ts` を書く(下記「テスト方針」の表)
7. `src/features/reading/kanji-illustration.tsx` に `ILLUSTRATIONS: Record<string, number>` を**空のまま**置き、`illustrationSource(key): number | null` と描画コンポーネントを書く。画像が無いときは `theme.surfaceVeil` + `theme.border` の枠を出し、**キー名の表示は `__DEV__` のときだけ**にする(ユーザーに「準備中」を見せない)。`assets/temp/` は `.gitignore` 済みなので参照しない
8. `src/features/reading/kanji-focus.tsx` を書く。出すのは **漢字 / イラスト(または枠) / 意味 / 読み(訓は `theme.kunBranch`、音は `theme.onBranch`、ローマ字は設定 ON のときだけ)** と、`onComplete` があるときだけ出す CTA。文言はすべて英語、色は `useTheme()` 経由
9. `src/app/kanji/[id].tsx` を作る。`getKanji(id)` で引き、`lesson` パラメータがあるときだけ `onComplete` を渡す。完了時は `completeLesson()` → `router.dismissAll()` 相当で入口に戻す(戻り先は `/`)
10. `conversation-view.tsx` に任意 prop `onContinue?: () => void` を足し、スレッドの下に CTA を1つ置く。ラベルは新出字があれば `Study this kanji`、無ければ `Got it`。**ヘッダー周りは触らない**(未コミットの作業と衝突させない)
11. `src/app/conversation/[id].tsx` で `onContinue` を渡す。新出字あり → `/kanji/[id]?lesson=1` へ push、無し → `completeLesson({ sentenceId, kanjiId: null })` して `/` に戻る
12. `src/features/srs/components/today-view.tsx` を書く。見出し `Today`、進捗 `2 of 3 kanji today`、カード一覧(完了済みは印を付ける)、空のときの文言、全文完了時の文言。`__DEV__` のときだけ `Ignore daily limit` トグルを出し、`limit` に `Number.POSITIVE_INFINITY` を渡す
13. `src/app/index.tsx` を「今日の学習」に差し替える。データは `useFocusEffect` + `useCallback` で**画面に戻るたびに読み直す**(`useState` の遅延初期化だけだと完了が反映されない)。旧一覧は `src/app/conversations.tsx` に移し `__DEV__` 以外では `null` を返す
14. `docs/data-model.md` / `docs/architecture.md` / `src/db/CLAUDE.md` を更新する
15. `pnpm run check` を通し、シミュレータで受け入れ条件を確認する

## 受け入れ条件

**今日の学習**

- [x] アプリを起動すると入口画面に `Today` が出て、**新出漢字のある回が3件**並ぶ。第2段階専用の回(`newKanjiId: null`)がその3件の途中にあるときは、**4件目として一緒に並ぶ**(3の枠を消費しない)
- [x] 進捗表示が `0 of 3` から始まる
- [x] 1件目の会話文を開き、最下部の `Study this kanji` を押すと漢字フォーカス画面が開き、その回の新出字(#1 なら `人`)と意味 `person` が出る
- [x] フォーカス画面の `Got it` を押すと入口画面に戻り、その回のカードが完了表示になり、進捗が `1 of 3` になる
- [x] 3件ぶん完了させると、未完了のカードが無くなり `You're done for today. Come back tomorrow.` が出る。**アプリを再起動しても4件目は出てこない**
- [ ] 端末の日付を翌日に進めて起動すると、続きの3件が並び、進捗が `0 of 3` に戻る
- [x] 第2段階専用の回を開くと CTA は `Got it` で、押すと完了になり、その日の3字の枠は減らない
- [x] 完了済みの回を開発用一覧(`learningkanjimobileapp://conversations`)から開き直して CTA を押しても、入口画面の進捗と並びが変わらない
- [x] `__DEV__` ビルドで `Ignore daily limit` を ON にすると未完了の回がすべて並び、OFF に戻すと3件に戻る
- [ ] 41文すべてを完了させると、入口画面が `You've finished every conversation for now.` を出し、クラッシュしない

**漢字フォーカス画面**

- [x] イラスト画像が1枚も無い状態(`ILLUSTRATIONS` が空)でフォーカス画面を開くと、**枠のプレースホルダが出て画面が落ちない**
- [ ] リリースビルド相当(`__DEV__` が false)ではプレースホルダに文字が出ない ※開発ビルドしか焼いていないため未確認
- [x] `山` のフォーカス画面に訓 `やま` が `theme.kunBranch`、音 `さん` が `theme.onBranch` の色で並ぶ
- [x] ローマ字設定を ON にすると読みの下にヘボン式が出る。OFF では出ない
- [x] `learningkanjimobileapp://kanji/<id>`(`lesson` なし)で開くと完了 CTA が出ず、`Back` だけが出る

**規則の遵守(静的確認)**

- [x] `rg "insertReviewEvent" src/features src/app` が 0 件(今回 SRS のステージ計算をしないので `review_events` に書かない — 絶対規則5・10)
- [x] `rg "update\(lessonEvents\)|delete\(lessonEvents\)" src` が 0 件
- [x] `rg "#[0-9a-fA-F]{3,8}" src/features/srs src/features/reading/kanji-focus.tsx src/features/reading/kanji-illustration.tsx src/app/kanji` が 0 件(絶対規則1)
- [x] 新規に追加した画面の表示文字列に日本語が含まれない。出る日本語は学習コンテンツ(漢字・かな・会話文)だけ(絶対規則7)
- [x] `rg "expo-router" src/features/srs src/features/reading/kanji-focus.tsx` が 0 件(feature はルーティングを知らない)
- [x] `git diff` に `src/db/migrations/` への手編集が含まれない(絶対規則6)

**マイグレーション**

- [x] 旧バージョンで演出カードを一度見た状態(`reveal_shown` に行がある)から新バージョンに上げても、その回で演出カードが再び出ない = ユーザー状態が保たれている
- [x] `pnpm run check`(typecheck / lint / test / content)が通る

**ユニットテスト**

- [x] `startOfLocalDay()` が同じ日の 00:00 と 23:59 に同じ値を返し、翌日には別の値を返す
- [x] `planTodaysLessons()` が、完了記録が空のとき先頭から新出字3件ぶんを返す
- [x] 今日すでに2字ぶん完了しているとき、返る未完了の新出字の回が1件になる
- [x] 昨日3字ぶん完了している状態では、今日また3件返る
- [x] 新出字のある回の間に第2段階専用の回がある並びで、返る件数が4件(うち新出字3件)になる
- [x] 同じ文の完了記録が2件あっても `learnedToday` が1しか増えない
- [x] すべての文が完了済みのとき `allDone === true` かつ `items` が空になる
- [x] `illustrationSource('mountain')` が `null` を返す(マップが空のため)

## テスト方針

**Jest では SQLite を動かさない**(`docs/plans/db-foundation.md` の方針を継承)。テストは純粋ロジックに集中させる。

| 対象 | 見るもの |
|---|---|
| `src/features/srs/day.test.ts` | 日境界。ローカル時刻で組み立ててTZ非依存にする |
| `src/features/srs/lessons.test.ts` | 抽出規則。**フィクスチャで組む**(実データ `src/content/index.ts` に依存させない。第4章が入るたびに壊れるため) |
| `src/features/reading/kanji-illustration.test.ts` | 未登録キーで `null`(＝プレースホルダ経路)になること |

`lessons.test.ts` は `@/db` を import しない。**テストから DB 接続に到達させない**のが条件。

UI(今日の学習・フォーカス画面)は手動確認でよい。手順は「受け入れ条件」がそのままチェックリストになる。確認は MCP の `attach` → `build` → `launch` で行う(`disclaimer` の残骸で落ちたときの手順は CLAUDE.md)。日付をまたぐ確認はシミュレータの日付設定を進めて行う。

## リスク・未確定事項

- ~~**`src/features/reading/conversation-view.tsx` に未コミットの変更がある**(固定ヘッダーの検討中)。CTA の追加はスレッド末尾のみに限定するが、同時に触ると衝突する。~~ → **2026-09-02 に開発者判断で破棄。** 直前のコミット 2f0016b が「トグルが常に最上部にあるため何も起きず、捨てた」と既に記録しており、作業ツリーのコメントはその記録と矛盾していた。固定ヘッダーを入れる回で改めて足す
- **`__DEV__` 限定のデバッグ設定は TestFlight に載らない**(2026-09-02 に確定)。テスターの完走(3字/日で約17日)を早めたいなら `DAILY_NEW_KANJI_LIMIT` を変えたビルドを別に配る必要がある。機能凍結前に外部テストの日程を決めるとき、この制約を思い出すこと
- **端末の時計を戻すと上限を回避できる。** MVP では検出しない(サーバーを持たない構成のため厳密な防止は不可能)
- **漢字イラスト50枚が未生成。** 埋まらないままリリースすると、要件5.1-3 の「意味＋象徴イラスト」が枠だけになる。**このプランはイラスト制作をブロックしないが、機能凍結前の必須作業として残る**
- **第4章17文が未投入なので41文で打ち止めになる。** 完走表示は出るが、リリースまでに投入されなければ「50字」の要件を満たさない
- **`来` の訓読み `く` と導入回 #39 の `き` の食い違いは今回やらない。** `く` は `来る` の辞書形の読みで正しく、`readings` の先頭の訓読みは `revealFor()` が「変わる前の読み」として使うため、増やす/変える修正は演出を壊すリスクがある。学習者に橋を架けるなら「読みの横に代表語を出す」形になり、それは語一覧 = `tree` の担当
- **`話`(はなし) の葉は調査の結果、修正不要。** #25 に出るのは `話す` で、その葉は既に #25 を指している。名詞の `話` は41文のどこにも出ておらず、つぼみのままが正しい。借りとしては閉じてよい(記録は `/log` に残す)
- **`lesson_events` の追加でユーザー状態表が4→5になる。** 将来の同期対象が1つ増えるが、追記のみなので競合解決は不要のまま
- **章ロックが無いため、今日のキューは第2章以降にもそのまま入っていく。** 既知の借りの継続。paywall のプランが `planTodaysLessons()` の入力(文の配列)をフィルタする形で被せられるよう、関数の入出力を文の配列に保っておく

## 次プラン `srs-reviews` の見出しだけ(今回は書かない)

- `src/features/srs/scheduler.ts` — ステージ遷移と次回出題日。間隔テーブルは名前付き定数配列(要件9章「後から調整可能」)
- `src/features/srs/queue.ts` — `lesson_events` + `review_events` を畳み込んで「今日の復習」を出す
- `src/features/srs/choices.ts` — 意味4択の誤答生成(**推測クイズの `quiz/distractors.ts` とは別物**)
- 復習セッションUI と、`review_events` への追記(`sentence_id` は導入回の ID を入れる方針を先に決める)
- 「今日の学習」画面に Reviews セクションを足す

## 実装後の記録(2026-09-02)

### 実機(iOSシミュレータ iPhone 17 Pro / iOS 26.5)で確認したもの

上のチェックボックスが付いているものすべて。学習ループを端から端まで通した
(Today → 会話文 → フォーカス → 完了 → 進捗更新 → 3字で打ち止め → 再起動しても維持)。
二重計上の防止も、完了済みの回をディープリンクで開き直して CTA を押しても
進捗が動かないことで確認した。

**旧DBの上に 0002 が当たることも確認済み。** 既存端末には `user_settings` に
ローマ字ONの行が残っていて、更新後もその設定が保たれた(= ユーザー状態を消していない)。

### 実機で未確認のもの(PR 本文にも書くこと)

- **端末の日付を翌日に進めたときの挙動。** シミュレータの日付変更が要るため未実施。
  日境界のロジックは `day.test.ts`(TZ非依存)と `lessons.test.ts` が担保している
- **41文すべてを完了したときの表示。** 分岐は `today-view.tsx` にあり `allDone` はテスト済み
- **リリースビルド(`__DEV__` が false)でプレースホルダに文字が出ないこと。**
  `kanji-illustration.tsx` の `__DEV__` ガードで構造上は担保

### 未解決のまま残したもの

- **開発ビルドで LogBox の警告バナー(`Open debugger to view warnings.`)が出る。**
  内容を読めておらず、**このプランの変更が原因かどうかも切り分けられていない**。
  RN の inspector(`http://localhost:8081/json/list` の CDP)に繋いでも
  `Runtime.consoleAPICalled` が1件も流れてこず、系統立てて読む手段が無かった。
  シミュレータの開発メニューから debugger を開くか、`expo start` を動かしている
  ターミナルの出力を読めば分かる。**次にこのアプリを触る回で必ず潰すこと**
  (放置すると「元からあった」ことにされて誰も読まなくなる)

### プランから外れた点

1. **`completeLesson()` を `lessons.ts` ではなく `complete-lesson.ts` に置いた。**
   同居させると `lessons.test.ts` が `@/db` → `@/db/client` に到達し、
   import しただけで SQLite が開く。プラン自身のテスト方針を満たすための分割
2. **`kanji-illustration.tsx` は `@/theme` バレルではなく `@/theme/theme-context` を直接 import。**
   バレルが `backdrop.tsx` 経由で `expo-image` を引き込み、テストが落ちるため
   (`backdrop.tsx` / `furigana.tsx` / `character-avatar.tsx` が既にやっている慣行)

### reviewer の指摘と対応

- **第2段階専用の回だけ `router.replace('/')` で戻していた** →
  スタックが `[入口, 入口]` になり繰り返すたび積み上がる。`kanji/[id].tsx` と同じ
  `canDismiss() → dismissAll()` に揃え、**実機で「#17 を完了 → 入口でスワイプバックしても
  何も出ない」ことまで確認した**
- **CTA のラベルが `newKanji`(実体)、遷移が `newKanjiId`(生のID)で分岐していた** →
  両方 `newKanjiId` に揃えた。`today-view.tsx` も同様にし、マスタから引けない字が
  「第2段階の回」と同じ見た目にならないようにした
- **「昨日3字ぶん終えても今日また3件返る」テストが、フィクスチャ5文では
  2件しか返らず題名通りに検証していなかった** → フィクスチャを7文にした
- 指摘のうち「`hasCompletedSentence` が公開APIとして未使用」「`components/` サブディレクトリが
  `reading/` とフラットさで不揃い」「初回マウントで `read()` が2回走る」は今回は触っていない
