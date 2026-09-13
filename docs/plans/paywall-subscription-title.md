# プラン: paywall-subscription-title

作成日: 2026-09-13
ステータス: 完了(2026-09-13 承認。Paid Apps Agreement は 2026-09-11 から Active を ASC で確認済み)
要件定義書の対応箇所: 5.1-11 / 7章(収益化)
関連プラン: `docs/plans/paywall-gate.md`(完了・凍結)

## 目的

App Store 審査の Guideline 2.1(Information Needed)で求められた条件を課金画面で満たす。条件は、サブスクの**名称・期間・価格**と、利用規約・プライバシーポリシーへのリンクが画面上ではっきり読めること。今足りないのは名称だけなので、これを最小の差分で足し、ビルド5として 9/15 朝までに TestFlight に上げる。

## 要件定義書との突き合わせ

**要件と矛盾する点は無い。** 要件7章の「月額の単一プランのみ」「無料トライアルは設定しない」は今の表示のまま守られている。`docs/plans/paywall-gate.md` の「金額をベタ書きしない」も崩さない(名称と期間は固定文字列にするが、金額は今までどおり `priceString` を使う)。

実装に効く確認結果:

- `react-native-purchases` ^10.7.0 の型を実物で確認した。`PurchasesStoreProduct.title: string`(空文字もあり得る)と `subscriptionPeriod: string | null`(ISO 8601。月額なら `P1M`)がある
- Apple の要件では、名称は「in-app purchase の商品名と同じでよい」。ASC の表示名は `Full Access`(`docs/release-checklist.md` 59行目、`docs/store-listing.md` の SUBSCRIPTION 節)

## 設計の決めどころ

### 1. 名称をどこから持ってくるか → アプリ内の固定文字列 `Full Access`(推奨)

| 観点 | A. StoreKit の `product.title` | **B. 固定文字列 `Full Access`** |
|---|---|---|
| 空になるリスク | **ある。** ASC で作ってから反映まで24時間以上かかることがあり、その間は空で返る事例が RevenueCat のコミュニティで報告されている | 無い |
| オファリングが取れないとき | **何も出せない。** シミュレータは今この状態 | 常に出る |
| ローカライズ違い | App Store の地域・言語設定に従う。ASC に日本語ローカライズがあると日本語で出て、絶対規則7(UI文言は英語)とぶつかる | 常に英語 |
| ASC 表示名との一致 | 自動で一致する | 手で揃える。ずれるリスクは決めどころ3のコメントと受け入れ条件の照合で抑える |
| 確かめやすさ | TestFlight 実機でしか見られない | シミュレータで確認でき、grep でも検証できる |

**B を推奨。** 審査の録画で落とせないのは「名称が確実に出ていること」。A は、まさにその録画を撮る端末の状態(反映待ち・Agreement・言語)次第で空になり得る。

A で取れなければ B を出す**両方持ち**の案も捨てる。出どころが2つあると画面ごとに表示が変わり、どちらが出ているかを確かめる手間が増えるだけだから。

### 2. 期間の書き方 → `/ month` は残し、小さい文字の注記に `1-month` を明示する

- `${priceString} / month` は単位あたりの価格として読める。ただ Apple は名称・期間・価格を**別々の項目**として挙げている。価格が取れないときは価格の行ごと消えるので、期間の表示も無くなる
- そこで、**価格が取れなくても常に出ている注記**の先頭に期間を置く。文言は次のとおり
  - 変更前: `Renews automatically until cancelled. Cancel anytime in the App Store.`
  - 変更後: `1-month subscription, renews automatically until cancelled. Cancel anytime in the App Store.`
- `subscriptionPeriod` から組み立てる案は、決めどころ1と同じ理由で採らない。要件7章が月額の単一プランに固定しているので、動的にする利点が無い

### 3. 配置

- 名称は**価格ブロック(`priceBlock`)の先頭**に、状態に関係なく常に出す。「名称 → 価格 → 期間を含む注記」が1か所にまとまり、審査の人が録画の1コマで3点を読み取れる
- 見出し `Keep going with all 4 chapters` と特典3行は**変えない**
- 名称の文字列は `paywall-view.tsx` のモジュール内の定数にする。コメントに次の2点を書く
  - **なぜ `product.title` を使わないか**(空になる・言語が変わる・オファリングが取れないと消える)
  - **ASC の表示名と `docs/store-listing.md` の2か所と揃える必要があること**

## スコープ外

- **審査メモ(App Review への返信)の文面と、画面録画そのもの。** 録画は開発者が TestFlight の実機で撮る
- **有料コンテンツの日次上限の扱い**(購読した当日は有料の中身に届かない件)
- **Today まで戻る処理の共通化**(`kanji/[id].tsx` と `quiz.tsx` の重複)
- **`product.title` / `subscriptionPeriod` を使った動的表示**と、取れなかったときに固定文字列へ切り替える仕組み(決めどころ1・2で捨てた案)
- **見出しや特典コピーの書き換え**と、課金画面のレイアウト全体の見直し
- **`paywall-view.tsx` の描画テスト。** 純粋ロジックを足さないため
- **ASC 側の変更。** 表示名とローカライズは変えない。どのローカライズが登録されているかの確認だけは、リスク欄に置く
- **`docs/store-listing.md` の変更。** すでに `Full Access` / `per month` で揃っている
- **`docs/release-checklist.md` へのビルド5の記録。** 作業録とチェックリストの更新で別に扱う
- 完了済みプラン `docs/plans/paywall-gate.md` の書き換え(凍結済み)

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/paywall/components/paywall-view.tsx` | 変更 | 名称の定数を足し、`priceBlock` の先頭に常に表示する。注記の文言の先頭に `1-month subscription, ` を足す |
| `docs/plans/paywall-subscription-title.md` | 新規 | このプラン |

`src/app/paywall.tsx` と `src/features/paywall/index.ts` は**変更しない**。props も増やさない。

## データモデルの変更

なし(マイグレーション不要)。

## 実装ステップ

1. `paywall-view.tsx` に名称の定数(値は `Full Access`)を置き、決めどころ3のコメントを添える
2. `priceBlock` の中の先頭に、名称の `Text` を置く。読み込み中のスピナー / 価格 / unavailable を切り替える三項分岐の**外側**に置く
   - 色は `theme.text`。色のリテラルは書かない(絶対規則1)
   - 字の大きさは価格(20)より小さく、注記(12)より大きい範囲で決める
   - 書体は既存の `theme.type` を使ってよい
3. 注記を決めどころ2の文言に差し替える。上にある「自動更新の明示は審査要件」のコメントに、期間もここで明示する理由を一言足す
4. `pnpm run check` を通す
5. シミュレータで、受け入れ条件の「シミュレータで確認するもの」を確認する
6. PR をマージしたら EAS でビルド5を作り、`eas submit` で TestFlight に上げる。実機で「TestFlight 実機で確認するもの」を確認する

## 受け入れ条件

### 機械的に検証するもの

- [ ] `grep -rn "product.title\|subscriptionPeriod" src/` の結果が空(決めどころ1・2の決定が守られている)
- [ ] `grep -rn "2.99" src/` の結果が空(金額を書かない決定が崩れていない)
- [ ] `grep -rn "Full Access" src/` の結果が `paywall-view.tsx` の1か所だけで、表記(大文字小文字・空白)が `docs/release-checklist.md` と `docs/store-listing.md` の `Full Access` と完全に一致する
- [ ] `git diff main -- src/app/paywall.tsx src/features/paywall/index.ts` が空
- [ ] 差分に色のリテラル(`#` で始まる値や `rgba(`)が無い
- [ ] 足した UI 文言がすべて英語
- [ ] `pnpm run check` が通る

### シミュレータで確認するもの

オファリングは取れない前提(`docs/log/2026-09.md` 09-12 のエントリの Paid Apps Agreement の件)。

- [ ] `learningkanjimobileapp://paywall` を開いた直後、スピナーが回っている間に、スピナーの上に `Full Access` が出ている
- [ ] オファリングが取れないとき、上から `Full Access`、`Subscriptions are unavailable right now.`、`1-month subscription, renews automatically until cancelled. Cancel anytime in the App Store.` の順に並び、`Subscribe` は押せないまま
- [ ] (シミュレータで取れた場合のみ)`Full Access` の直下に `<ストアの価格> / month` が出る
- [ ] `Restore purchases`、`Terms of Use`、`Privacy Policy`、`Legal Notice (Japan)`、`Not now` が変更前と同じ文言で残っている
- [ ] 手元で使える一番小さい画面のシミュレータで、`Full Access` がほかの要素と重ならず、スクロールで `Not now` まで届く

### TestFlight 実機(ビルド5)で確認するもの

- [ ] 前提: ASC の Paid Apps Agreement が `Active` になっている(なっていなければ以下は確認できないので、その旨を報告する)
- [ ] 課金画面に `Full Access`、`<Sandbox アカウントの地域の通貨での価格> / month`、`1-month subscription, ...` の注記が同時に見えている(審査の録画に使える状態)
- [ ] `Subscribe` を押して出る StoreKit の購入シートで、サブスク名が `Full Access`、期間が月額と表示される(課金画面の名称と Apple 側の表示名が一致していることの確認)
- [ ] `Terms of Use` で Apple 標準の EULA が、`Privacy Policy` で `https://asab0o.github.io/learning-kanji-mobile-app/privacy` が開く
- [ ] 購入シートを閉じると、エラー文言は出ずに課金画面に戻る(変更で壊れていないことの確認)

## テスト方針

**ユニットテストは追加しない。** 足すのは固定文字列1つと文言の差し替えだけで、分岐する純粋ロジックが無いため。`paywall-gate.md` のテスト方針でも、`paywall-view.tsx` はテスト対象から外している。

守りたい決定(`product.title` を使わない・金額を書かない・名称の表記)は、受け入れ条件の grep で見る。表示はシミュレータと TestFlight 実機で手動確認する。

## リスク・未確定事項

- **一番大きいのはコードの外で、Paid Apps Agreement の状態。** `Active` でないと TestFlight でもオファリングが空になり、課金画面に価格が出ない。**名称を足しても、録画に価格が映らなければ 2.1 には答えられない。** ビルド5を上げる前に ASC で状態を確かめる
- **ASC 表示名との二重管理。** 表示名を変えたら、`paywall-view.tsx`、`docs/store-listing.md`、ASC の3か所を揃える必要がある。定数のコメントでこの3か所を指し示す
- **ASC に登録されているローカライズが未確認。** 英語以外(特に日本語)のローカライズで別の表示名が入っていると、その地域の購入シートでは課金画面と違う名称が出る。アプリの変更ではなく ASC の画面で確認する項目。TestFlight 実機の条件2で、少なくとも自分の端末の地域では確かめられる
- **Apple が注記の小さい文字の期間を「はっきり表示」と見なさない可能性。** 価格の行の `/ month`(20pt)が同じ情報を大きく出しているので、これで足りると判断した。再度指摘されたら、名称の行に期間を並べる案(例 `Full Access · 1 month`)に切り替える
- **Sandbox での価格表記は、テスト用 Apple アカウントの地域の通貨になる**(円など)。`priceString` をそのまま出しているための正常な挙動で、不具合ではない
- **ビルド5の日程。** EAS のビルドは待ち時間込みで約7分だったが、そのあと Apple 側の処理待ちがある。9/15 朝に間に合わせるには、9/14 中にマージとビルドを済ませるのが安全

## 実装後の記録

**Paid Apps Agreement**

- ASC の Business → Agreements で `Active`(Effective Date 2026-09-11)を開発者が確認した。9/12 の作業録の時点では未同意だったもの

**シミュレータ(iPhone 17 Pro、Metro 経由の Debug ビルド)で確認したもの**

- `learningkanjimobileapp:///paywall` で開いた。**オファリングが取れて価格まで出た**(Agreement が Active になったため。プランの「取れない前提」は外れた)
- 上から `Full Access`、`$2.99 / month`、`1-month subscription, renews automatically until cancelled. Cancel anytime in the App Store.`、`Subscribe` の順に並んだ
- `Restore purchases`、`Terms of Use`、`Privacy Policy`、`Legal Notice (Japan)`、`Not now` は変更前と同じ文言で残っていた

**機械的な確認**

- grep の4項目(`product.title` / `subscriptionPeriod` / `2.99` / `Full Access` の件数)と、`src/app/paywall.tsx`・`src/features/paywall/index.ts` に差分が無いことを確認した
- `pnpm run check` が通った
- reviewer の判定は合格。JSX の折り返しを実際に変換し、文言が `App Store.` と空白1つでつながることも確認された

**未確認のもの**

- 読み込み中(スピナーが回っている間)の表示と、オファリングが取れないときの並び。シミュレータで取れてしまい、再現できなかった(コード上は名称が分岐の外にある)
- 一番小さい画面での重なり
- TestFlight 実機(ビルド5)の5項目すべて。特に、購入シートのサブスク名が `Full Access` になっているか
