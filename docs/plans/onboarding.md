# プラン: onboarding(初回3画面の簡易オンボーディング)

作成日: 2026-09-06
ステータス: 完了
要件定義書の対応箇所: 5.1-10(簡易オンボーディング)、4章(コア体験・学習ループ。特に 4.1 / 4.4 / 4.5 / 4.6)、5.1-8(1日3字)、5.1-12(英語UI)

## 目的

初回起動時に3画面だけ挟み、「会話文の中で漢字に出会う → 復習する → 同じ漢字が読みを変えて戻ってくる」という**このアプリ固有の学習ループ**を、実際に触る前に一言ずつ伝える。3画面は強制せず、いつでも Skip で入口画面に抜けられる。2回目以降の起動では出さない。

## 先に確認したい点(要件との突き合わせ)

実装案の前に4点。方針が違うなら承認前に指摘してほしい。**要件を勝手に解釈で変えてはいない。**

1. **「3画面に何を載せるか」は要件が2通りの三つ組を持っていて、そのままでは決まらない。** 要件4章の冒頭表は **入口(会話文で出会う)/ 体験(推測クイズ)/ 可視化(漢字の樹)** の3層で差別化を説明しているが、要件4.1 の学習ループを3つに畳むと **出会う → SRSで復習 → 段階的に再登場** になる。どちらを3画面に写しても、もう一方の要素が落ちる。
   → **両方を3画面に収める案を採る**(下記のマッピング)。1画面あたり見出し1行＋本文2〜3文に収まる分量で、画面を4枚に増やさない。

   | 画面 | 見出し(案) | 載せる要件 |
   |---|---|---|
   | 1 | Meet kanji in a conversation | 4.1-1〜3(入口 = 会話文で出会う)、4.3(3キャラ) |
   | 2 | Three kanji a day, then review | 4.1-4(SRS)、5.1-8(1日3字)、4.4(推測クイズ) |
   | 3 | The same kanji comes back | **4.1-5 / 4.6(段階的再登場 = 最大の差別化)**、4.5(漢字の樹) |

2. **要件は「1日3字の上限をオンボーディングで説明せよ」とは書いていないが、画面2に1行入れたい。** ADR-0003 の上限があるため、初日に3字を終えると入口画面が「今日は終わり」になる。事前に言っておかないと**壊れていると誤解される**種類の仕様なので、ここだけは要件に無い情報を足す判断をした(承認が要る点)。
3. **3画面目の例に `空`(そら → くう)を使う。** 要件4.3 / 4.6 が挙げている例そのもの。`src/content/index.ts` を確認したところ **`空気` `空港` は `encounteredInSentenceId: null`**(どの会話文にも出ない = 樹では常につぼみ)で、かつ8つの `reencounters` 演出語(日曜日/水曜日/時間/休日/大学/学生/新聞/外国)にも含まれない。**アプリ内で後から起きる驚きを1つも先食いしない**ことを確認済み。なお画面には熟語を出さず、`空 / そら → くう` と英語の意味だけを RevealCard(要件4.6 ステップ2)と同じ形で見せる。
4. **オンボーディングで課金の話をしない。** 要件7章はサブスクを求めているが、5.1-10 は説明を求めているだけで、初回起動で購入導線を出せとは書いていない。入口画面と `paywall.tsx` に既にある導線で足りるため、ここには入れない(スコープ外)。

## スコープ外

**今回やらないこと。迷ったら足さない。**

- **スワイプでめくるページャ / アニメーション演出。** `PagerView` も `react-native-reanimated` も使わない。`Next` / `Back` のボタンと画面ローカルの `step` state だけで進む
- **チュートリアル的な操作練習**(オンボーディングの中で本物の会話文を読ませる・本物のクイズを1問解かせる)。文章と静的な例示だけにする
- **オンボーディング専用のイラスト・アニメ画像の新規制作。** 既存の `assets/characters/*.png`(3枚)だけを使い回す。要件5.4 のアセット枚数を増やさない
- **設定画面からのオンボーディング再表示。** そもそも設定画面が無い(`RomajiToggle` は会話文画面の中にある)。「もう一度見る」導線は作らない
- **名前入力 / 学習目標の設定 / 言語選択 / 通知の許可要求 / ATT ダイアログ**
- **課金の訴求**(上記4)。オンボーディングから `paywall` へ送らない
- **オンボーディング内でのローマ字設定の案内・トグル。** 既定 OFF のまま(要件5.2)
- **`Stack.Protected` を使ったルート再編**(`(app)` グループ化)。理由は「実装ステップ」1に書く
- **漢字の樹の空状態文言の見直し**(`docs/plans/kanji-tree.md` の申し送り「オンボーディングが入ったら見直す可能性」)。**判断: 見直さない。** `You haven't met any kanji yet.` はオンボーディング後も正しい
- **オンボーディングを見た人と見なかった人で挙動を変えること**(A/B、初回だけ上限を緩める等)

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/onboarding/steps.ts` | 新規 | **純粋データ。** 3ステップの文言(英語)と、3画面目の日本語サンプル(`空` / `そら` / `くう`)。React も `@/theme` も `@/db` も import しない。`@/features/srs/lessons` の `DAILY_NEW_KANJI_LIMIT` だけを import して本文に埋める |
| `src/features/onboarding/steps.test.ts` | 新規 | 上記の不変条件(下記「テスト方針」) |
| `src/features/onboarding/components/onboarding-view.tsx` | 新規 | 表示専用。`step` は内部の `useState`。`expo-router` も `@/db` も import しない。`onDone` だけを受ける |
| `src/features/onboarding/index.ts` | 新規 | 公開API。`OnboardingView` と `ONBOARDING_STEPS` |
| `src/app/onboarding.tsx` | 新規 | ルート。`OnboardingView` を置き、`onDone` で完了フラグを立てて `router.replace('/')` |
| `src/app/index.tsx` | 変更 | 先頭で `useOnboardingCompleted()` を読み、未完了なら `<Redirect href="/onboarding" />` を返す(既存の hooks はすべてこの return より上で呼ぶ) |
| `src/db/schema.ts` | 変更 | `userSettings` に `onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).notNull().default(false)` を追加 |
| `src/db/migrations/0004_*.sql` と `meta/` | 新規(生成物) | `pnpm run db:generate` の出力。**手で編集しない**(絶対規則6) |
| `src/db/mappers.ts` | 変更 | `UserSettings` に `onboardingCompleted: boolean` を追加し、`toUserSettings()` で写す |
| `src/db/mappers.test.ts` | 変更 | 既存の `toUserSettings` テスト2件のフィクスチャに新しい列を足し、既定 `false` を assert |
| `src/db/queries/user-settings.ts` | 変更 | 既定行の作成値と `updateUserSettings()` の `set()` に `onboardingCompleted` を追加 |
| `src/features/settings/settings-context.tsx` | 変更 | `onboardingCompleted` と `completeOnboarding()` を配る(`romajiEnabled` と同じ流儀) |
| `src/features/settings/index.ts` | 変更 | `useOnboardingCompleted` / `useCompleteOnboarding` を公開 |
| ~~`src/features/reading/index.ts`~~ | 変更なし | 当初はバレルに `CharacterAvatar` を足す予定だったが、`@/features/reading/character-avatar` を直接 import する形にしたので不要になった(下記「実装後の記録」2) |
| `docs/architecture.md` | 変更 | 「現在のルート」に `src/app/onboarding.tsx` を追加 |
| `docs/release-checklist.md` | 変更 | 「簡易オンボーディング(5.1-10)」にチェックを付け、実装済み一覧に移す。**あわせて下記「付記」の EU 配信の項目を書き換える** |

**変更しないと明記するもの**: `src/app/_layout.tsx`(ルートは expo-router が自動で拾う。Provider の並びも変えない)、`src/db/seed.ts`(コンテンツ側は無関係)、`src/features/srs/`(`DAILY_NEW_KANJI_LIMIT` を読むだけ)、`src/theme/`(新しいトークンは要らない)、`docs/data-model.md`(`user_settings` の列を列挙していないため差分なし)、`package.json`(新規依存なし = ネイティブ再ビルド不要)。

## データモデルの変更

**あり。マイグレーションを1本生成する(`0004_*.sql`)。**

- `user_settings` に `onboarding_completed`(integer / boolean モード / NOT NULL / DEFAULT false)を1列追加する。SQLite の `ALTER TABLE ... ADD COLUMN` になる(`0003` で `DROP COLUMN` を通した実績があるので同じ経路)
- **置き場所として `user_settings` を選んだ理由**: これは端末で生成されるユーザー状態(絶対規則4)であり、履歴に意味がない1個の真偽値。`user_settings` は「ここだけは UPDATE してよい表」(`docs/data-model.md`)で、まさに同じ性質の `romaji_enabled` が既に載っている。**専用テーブルも `reveal_shown` 方式のイベント表も作らない**(1行1列のために表を増やす価値がない)
- **`lesson_events` の有無で代用しない。** 「1回でも学んだ人はオンボーディング済み」と推定すると、Skip した直後の新規ユーザーが翌起動でまた見ることになる。フラグを持つ以外に正しく表せない
- **既存の行は `false` になる**ので、すでにインストール済みの端末(TestFlight のテスターや開発機)ではアップデート後に1回だけオンボーディングが出る。これは仕様として受け入れる(リスク欄に再掲)
- `review_events` / `quiz_attempts` には一切触れない

## 実装ステップ

1. **ブランチを切る。** `git fetch` → `main` を最新にして `feat/onboarding`。現在の `fix/kanji-images` から派生させない。
   **ルーティング方式の決定(先に確認済み)**: Expo Router の現行ドキュメント(SDK 57 の Authentication)は `Stack.Protected guard={...}` を推奨しているが、**採らない**。あれを使うには `_layout.tsx` の `<Stack>` に全ルートを `Stack.Screen` として列挙するか `(app)` グループへ全画面を移す必要があり、いまの `<Stack>` は子を1つも持たない自動構成のため、変更範囲がオンボーディング1機能に見合わない。**既に `src/app/conversation/[id].tsx` が採用している `<Redirect href="..." />` 方式に揃える。**
2. `src/db/schema.ts` に列を足し、`pnpm run db:generate` を実行。生成された `0004_*.sql` を**読んで**、`ALTER TABLE user_settings ADD ...` の1文だけであることを確認する(手で編集しない)。
3. `src/db/mappers.ts` / `src/db/queries/user-settings.ts` を列に合わせて更新し、`mappers.test.ts` のフィクスチャを直す。
4. `src/features/settings/settings-context.tsx` に `onboardingCompleted` と `completeOnboarding()` を足す。`romajiEnabled` と同じく**遅延初期化で1回だけ読み**、書き込みは `updateUserSettings()` の戻り値で state を更新する(React Compiler にメモ化されるため描画中にクエリを呼ばない)。`index.ts` から `useOnboardingCompleted` / `useCompleteOnboarding` を公開。
5. `src/features/onboarding/steps.ts` を書く。形は次の通り(色を持たせない = 絶対規則1)。
   ```
   OnboardingStep = {
     id: 'meet' | 'review' | 'return';
     title: string;   // 英語
     body: string;    // 英語
     sample?: { kanji: string; kun: string; on: string; gloss: string }; // 'return' だけ
   }
   ```
   文言の初稿(実機で微調整可):
   - `meet` — **Meet kanji in a conversation** / "Every lesson is a short chat between Mia, her host grandma, and Sora the cat. You meet a new kanji inside the talk, not in a list."
   - `review` — **Three kanji a day, then review** / "You learn up to 3 new kanji a day, then meet them again in short reviews. Sometimes we show you a word you have never seen and let you guess what it means."
   - `return` — **The same kanji comes back** / "Later it returns inside a new word with a new reading. The sound changes, the meaning stays. Every kanji you meet grows its own tree of words." / sample: `空` / `そら` / `くう` / `sky / empty`
6. `src/features/onboarding/components/onboarding-view.tsx` を書く。
   - `ScrollView` + `useSafeAreaInsets`。背景は透明のまま(背景装飾は `_layout.tsx` が敷いている)
   - 上段: 進捗ドット3つ(現在 = `theme.accent`、他 = `theme.border`)と、右に `Skip`(**ステップ1・2でだけ出す**。最終画面は `Start learning` が同じ行き先なので二重にしない)。**固定ヘッダーは作らない**(`docs/architecture.md` の現行方針に従い `ScrollView` の中に置く)
   - 中央: `title` / `body` / ステップ固有の視覚要素
     - `meet` — `CharacterAvatar` を3つ横並び(`mia` / `grandma` / `sora`、size 56)
     - `review` — 数字の `3` を `theme.accent` の大きい文字＋ `kanji a day` のキャプション
     - `return` — `空` を大きく置き、下に `そら`(`theme.kunBranch`)→ `くう`(`theme.onBranch`)と `sky / empty`。**訓=緑 / 音=青は樹(4.5)と同じ色の意味づけ**なのでトークンをそのまま使う。日本語のテキストには `accessibilityLanguage="ja-JP"`
   - 下段: 主CTA(`Next` / 最終画面は `Start learning`)。ステップ2・3には `Back`(画面内の `step` を戻すだけで、ルーターは触らない)
   - **色リテラルを1つも書かない**(絶対規則1)
7. `src/app/onboarding.tsx` を書く。`onDone` で `completeOnboarding()` → `router.replace('/')`。**`push` ではなく `replace`** にして戻れないようにする。
8. `src/app/index.tsx` の先頭で `useOnboardingCompleted()` を読み、既存の hooks をすべて呼び切ったあとに `if (!onboardingCompleted) return <Redirect href="/onboarding" />;` を置く(hooks の呼び出し順を変えない)。
9. `pnpm run check` を通す。型付きルート(`.expo/types/router.d.ts`)が `/onboarding` を知らないと `Redirect href` が型エラーになるので、`pnpm exec expo start` を数秒だけ回して再生成する(`docs/plans/kanji-tree.md` の申し送り)。
10. シミュレータ(MCP の `attach` → `build` → `launch`)で確認。既存の DB を消してから起動し、下記の受け入れ条件を上から順に見る。
11. `docs/architecture.md` / `docs/release-checklist.md` を更新し、`/log` に判断を残す。

## 受け入れ条件

- [x] アプリを削除して入れ直した初回起動で、入口画面(Today)ではなく**オンボーディングの1画面目**が最初に出る
- [x] 1画面目に3人の顔アイコン(Mia / grandma / Sora)が並び、見出しが `Meet kanji in a conversation` である
- [x] 2画面目に「1日に学ぶ新しい漢字は3字まで」と読める文言が出る(数字の `3` が本文に含まれる)
- [x] 3画面目に `空` と `そら → くう` と `sky / empty` が出る。**`そら` は `theme.kunBranch`、`くう` は `theme.onBranch` の色で描かれ、漢字の樹の枝の色と一致する**
- [x] `Next` を2回押すと3画面目に着き、主CTA の文言が `Start learning` に変わる
- [x] `Start learning` を押すと入口画面に遷移し、**iOS のスワイプバックでもオンボーディングに戻れない**(`replace` になっている)
- [x] 1画面目と2画面目には `Skip` が出ている。1画面目で `Skip` を押すだけで入口画面に着く(残り2画面を見せられない)
- [x] `Skip` で抜けた直後にアプリを完全終了して再起動すると、オンボーディングは出ず**入口画面が直接出る**
- [x] `Start learning` で抜けた場合も同様に、再起動でオンボーディングが出ない
- [x] 2画面目・3画面目の `Back` を押すと1つ前の画面に戻る。このとき**入口画面には遷移しない**(画面内の状態が戻るだけ)
- [ ] すでに学習履歴のある端末(アプリを消さずにこのビルドを入れた場合)では、**次の起動で1回だけ**オンボーディングが出て、抜けたあとは二度と出ない。学習済みの進捗・復習の期日・樹の葉は1つも変わらない
- [x] オンボーディングの画面上の文言がすべて英語。日本語が出るのは3画面目のサンプル(`空` / `そら` / `くう`)だけ(絶対規則7)
- [x] `src/features/onboarding/` と `src/app/onboarding.tsx` を grep して、`#` で始まる色リテラルが1つも無い(絶対規則1)
- [x] `src/features/onboarding/` が `@/db` も `expo-router` も import していない(app 層が遷移を持つ = `docs/architecture.md`)
- [x] マイグレーションがちょうど1本だけ増えている(`src/db/migrations/0004_*.sql`)。中身は `user_settings` への列追加1文で、`review_events` / `quiz_attempts` / コンテンツ系の表に触れていない
- [x] `pnpm run check` が通り、`src/features/onboarding/steps.test.ts` が実行されている

## テスト方針

**この機能はほぼ表示だけで、純粋ロジックが薄い。** ユニットテストは `steps.ts` の不変条件に絞り、見た目と遷移は上の受け入れ条件をシミュレータで目視確認する。

`src/features/onboarding/steps.test.ts`

1. ステップがちょうど3件で、`id` が `meet` / `review` / `return` の順に並ぶ(要件5.1-10「3画面程度」を機械で固定する)
2. すべてのステップの `title` と `body` が空でない
3. **すべての `title` / `body` が ASCII 印字可能文字だけでできている**(絶対規則7 の機械チェック。日本語を混ぜたら落ちる)
4. `sample` を持つのは `return` だけで、その `kanji` / `kun` / `on` は非 ASCII を含む(= 日本語のサンプルはここに隔離されている)
5. `review` の `body` に `String(DAILY_NEW_KANJI_LIMIT)` が含まれる(ADR-0003 で上限を変えたら文言も直す、を強制する)。`@/features/srs/lessons` を直接 import する(`@/features/srs` のバレルは `@/db` に到達するため)

**`@/db` を import しない**(`@/db/client` は import しただけで SQLite を開く)。

`src/db/mappers.test.ts` に1件追加: 新しい列が無い前提のフィクスチャを直したうえで、`onboarding_completed: false` の行が `onboardingCompleted: false` に写ること。

**書かないテスト**: `OnboardingView` のレンダリングテスト、`SettingsProvider` の結合テスト。どちらも受け入れ条件の目視で足りる。

## リスク・未確定事項

- **文言は初稿。** ストアのスクリーンショットにも使う面なので、最終的な英文は開発者が実機を見て決める。プランの文言をそのまま最終とみなさない
- **`<Redirect>` 方式なので deep link はオンボーディングを飛ばせる。** `learningkanjimobileapp://conversation/<id>` を直接開くと入口画面を経由しないため、フラグが false のままでも本編に入れる。本番の導線にこの入口は無く(開発専用の `conversations.tsx` と ULID を知っている前提のリンクだけ)、実害が無いので許容する。厳密に塞ぐなら `Stack.Protected` への再編が要る(スコープ外)
- **`index.tsx` は Redirect を返す前に SQLite を読む。** 未完了のときも `listSentences()` 等が1回走る(同期・数百行)。無駄だが体感できる遅延ではないので、hooks の順序を崩してまで避けない
- **既存インストールの端末で1回オンボーディングが出る。** 列の既定値が false なので、学習途中のテスターにも表示される。進捗には影響しないが、TestFlight の配布時にひとこと添えるとよい
- **スプラッシュ → オンボーディングの繋ぎ。** マイグレーションとシードが終わるまで `_layout.tsx` は `<Stack>` を描かない(テーマの地と背景装飾だけが見える)。初回起動はシードが走るぶんこの間が最も長いので、実機で不自然な白飛びや二度描きが無いか見る
- **型付きルートの再生成が要る。** `.expo/types/router.d.ts` が `/onboarding` を知らないと `<Redirect href="/onboarding" />` が型エラーになる。`pnpm exec expo start` を数秒回して再生成する(この Metro は Fast Refresh が効かない既知の面倒がある)
- **3画面に4つの要素(会話・SRS・クイズ・樹)を詰めている。** 情報が多すぎて読み飛ばされる可能性があるが、画面を増やすと 5.1-10 の「3画面程度」から外れる。実機で読んで詰まるようなら、**画面を増やす前に文を削る**
- **`CharacterAvatar` を `src/features/reading` から公開して onboarding が使う**(feature 間の import)。前例はある(`reading` → `settings`)が、依存方向としては新規。`assets/characters/*.png` の構図を差し替えると `FaceCrop` の数値ごと見直しが要る点は既存の注意書きどおり

## 付記: このプランと無関係な、同じPRに含めるドキュメント修正

オンボーディングとは無関係だが、開発者の指示により同じPRで `docs/release-checklist.md` の
「EU Trader Status を申告する」の項目を以下に置き換える。

```
- [ ] EU圏を配信対象から外す(2026-09-06 決定)。App Store Connect の
      Pricing and Availability → Availability で EU加盟国27カ国を配信対象から
      除外する。EUに配信しない前提のため、Trader Status(DSA対応の申告)は
      不要と判断した。未設定だとデフォルトで全世界配信のため EU にも配信されて
      しまい、申告義務のバナーが消えない。除外後に一覧で EU が外れていることを
      確認する
```


## 実装後の記録

実装日: 2026-09-07 / ブランチ `feat/onboarding` / レビュー: `reviewer` 合格(コードの要修正なし)

### プランからの逸脱2点

1. **`Back` を主CTA の**上**に置いた**(プラン実装ステップ6は「主CTA、その下に Back」と書いていた)。
   実機で見ると、文字だけの `Back` を最下端に置くとホームインジケータの**ジェスチャ帯**に
   当たり判定が入って押しにくい。`paddingBottom: insets.bottom + 28` で安全領域は取れているが、
   ジェスチャ帯は安全領域では守られない。「下段に CTA と Back を置く」構成自体は変えていない。
2. **`CharacterAvatar` をバレルではなく `@/features/reading/character-avatar` から直接 import した。**
   `@/features/reading` のバレルは `conversation-view` → `use-reveal-seen` 経由で `@/db` に到達し、
   `@/db/client` は import しただけで SQLite を開く。同じファイルが `@/features/srs/lessons` を
   深く取っているのと理由が同じ。結果として `src/features/reading/index.ts` は変更なしで済んだ。

### 実機で確認したもの(iPhone 17 Pro シミュレータ、アプリ削除 → 再インストール)

受け入れ条件のうち、チェック済みの15項目。初回起動の割り込み、3画面の中身、`Next` / `Back` /
`Skip` / `Start learning` の遷移、`push` ではなく `replace` にしたのでスワイプバックで
戻れないこと、Skip 後・完了後ともに再起動でオンボーディングが出ないことを目視で確認した。

### 実機で確認していないもの

**「すでに学習履歴のある端末でアップデートすると1回だけ出る」だけが未確認。**
新スキーマで作った DB でしか試せておらず、旧ビルドからの移行は動かしていない。
`reviewer` がマイグレーションと `_journal.json` の差分から「既存の 0000-0003 が
再実行される経路は無く、`ALTER TABLE ADD COLUMN` は既存行に触れない」ことを確認しているが、
**実機での確認は `docs/release-checklist.md` の「出す前に実機で確かめること」に送った。**

### 送りにした小さな指摘(今回は直さない)

- ステップ切り替えで `ScrollView` の位置を先頭に戻していない。Dynamic Type を上げて
  本文がスクロールするときだけ、次の画面が途中から見える可能性がある
- `Skip` / `Back` のタップ領域が縦約41pt で 44pt をわずかに下回る。`quiz-view.tsx` の
  既存の書き方に合わせた結果なので、直すなら画面横断でやる
