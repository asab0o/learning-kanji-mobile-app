> 種別: **stock** — リリースまでに残っていることの現在値。片付いたらチェックを付けて上書きする

# リリース前チェックリスト

期限は **2026/9/30**(App Store へ出しきる)。要件8章の目安では **9月上旬に機能凍結**。

**RevenueCat 公式の準備ガイドの目安は「9/16 までに審査へ提出、9/23 までに公開」**
(審査は小さな不備でも跳ね返され、往復1回に1日以上かかるため。
https://revenuecat.github.io/codelabs/shipaton-2026-prep.html)。**提出まで実質2週間を切っている。**

**ここに書くのは「出す前に必ず終わらせること」だけ。** なぜそう決めたかは `decisions/`、
やった記録は `log/`、仕様そのものは `requirements.md`。
**このファイルは理由を持たない**(リンク先に任せる)。

---

## 1. これが無いと提出できない / 審査で落ちる

- [ ] **RevenueCat の API キーを本番のものに差し替える**
      — `src/features/paywall/purchases.ts` が `test_...`(Test Store)のまま。
      **SDK 自身が「Test Store のキーで提出したアプリは審査で落ちる」と警告している**
      (2026-09-03 に React Native DevTools で確認)。App Store Connect 登録後に `appl_...` へ
- [x] **アプリ名を決める** → `Kanji Encounter` に確定。`app.json` の `name` を変更済み(#26)、
      App Store Connect にも App レコード作成済み(Bundle ID `com.asakiita.learningkanji`)
- [ ] EU圏を配信対象から外す(2026-09-06 決定)。App Store Connect の
      Pricing and Availability → Availability で EU加盟国27カ国を配信対象から
      除外する。EUに配信しない前提のため、Trader Status(DSA対応の申告)は
      不要と判断した。未設定だとデフォルトで全世界配信のため EU にも配信されて
      しまい、申告義務のバナーが消えない。除外後に一覧で EU が外れていることを
      確認する
- [x] **月額の価格を決める** → **月額 $2.99** に確定(2026-09-08、要件9章)。
      App Store Connect でサブスクを作るときにこの金額を入れる
- [x] **課金ゲートを実装する** → 完了(`docs/plans/paywall-gate.md`)。
      第1章のみ無料、第2章以降は `premium` エンタイトルメントで解放
- [ ] **アプリアイコンとスプラッシュを作る**
      — `assets/expo.icon/`(`expo-symbol 2.svg` + 青のグラデーション)と
      `app.json` の `splash-screen`(`#208AEF` / `splash-icon.png`)が
      **Expo テンプレートの既定のまま**。環境構築の `a63fd16` から一度も触っていない。
      プレースホルダのアイコンは審査で弾かれる。
      スプラッシュ = 起動してから最初の画面が出るまでの1〜2秒に出る静止画面
- [ ] **App Store Connect にサブスク商品を作る**
      — RevenueCat 側には商品(`com.asakiita.learningkanji.premium.monthly`)と
      `default` オファリング(`$rc_monthly`)が既にある。**ASC 側がまだ空**で、
      RevenueCat の product が `duration: null` なのはその反映。月額 $2.99 で作る
- [ ] **RevenueCat に本番の鍵を2つ設定する**
      — iOS アプリ(`appb622056e1b`)が `app_store_connect_api_key_configured: false` /
      `subscription_key_configured: false`。この2つが無いと本番のレシート検証と
      サブスク状態の同期ができない。ASC で App Store Connect API キーと
      In-App Purchase キーを発行して RevenueCat のアプリ設定に入れる
- [ ] **ビルドと提出の経路を決めて、1回通す**
      — `eas.json` が無く、`ios/` は gitignore(CNG)。**EAS Build と
      `expo prebuild` + Xcode アーカイブのどちらでもよいが、決めていない。**
      未知の待ち時間が一番多いのはここなので、提出物が揃う前に一度通しておく
- [ ] **プライバシーポリシーの URL を用意する**
      — `src/app/paywall.tsx` の `PRIVACY_URL` が**まだ公開されていない URL を指している**。
      Apple は購入画面からプライバシーポリシーへ到達できることを求めるので、
      404 のまま提出すると落ちる。公開したら定数1箇所を差し替える
- [ ] **開発専用の画面を始末する**
      - [x] `src/app/paywall-debug.tsx` — 削除済み(`docs/plans/paywall-gate.md`)
      - `src/app/conversations.tsx` — `__DEV__` ガード済み。**残してよい**(削除不要)

## 2. Must have のうち未実装のもの(要件5.1)

- [x] **漢字イラスト50枚**(5.1-3 / 5.4)→ 完了(2026-09-08)。
      `ILLUSTRATIONS` に50字全て登録済み。`src/content/index.ts` の `illustrationKey` との
      対応漏れ・余りともに無し
- [x] **`name` / `hear` の服の白が抜けているのを直す** → 完了(2026-09-08)。
      生画像側でシャツのシルエット(袖・裾)を閉じる線を足して再生成した。輪郭線の内側が
      紙と地続きだったのが原因(`docs/log/2026-09.md`)
- [x] **`name` / `enter` に残っていた、生画像の枠が焼き込まれた縦線を消す** → 完了(2026-09-08)。
      該当列の alpha を0にして手で消した(生画像には未反映。`scripts/illustration-cutout/README.md`
      「このツールで再生成できないアセット」に追加済み)
- [x] **推測クイズ「読めるかな?」**(5.1-6 / 4.4)→ 完了(`docs/plans/guess-quiz.md`)。**面白さの主軸**
- [x] **漢字の樹**(5.1-7 / 4.5)→ 完了(`docs/plans/kanji-tree.md`)
- [x] **簡易オンボーディング**(5.1-10)→ 完了(`docs/plans/onboarding.md`)。初回起動の3画面

**実装済み**: 会話文セット58文 / 例文表示画面 / 漢字フォーカス画面 / SRS復習 /
段階的再登場(第1・第2段階) / 1日3字の上限 / 桜テーマ / 英語UI / RevenueCat SDK の初期化 /
漢字の樹(一覧グリッド + 1字の樹) / 推測クイズ「読めるかな?」 / 簡易オンボーディング /
漢字イラスト50枚。

## 3. 出す前に実機で確かめること

- [ ] **リリースビルド(`__DEV__` が false)で開発用のものが出ないこと**
      - 入口画面の `Ignore daily limit` トグル
      - `learningkanjimobileapp://conversations`(開発用一覧)
      - イラスト未投入のプレースホルダに出る鍵名
- [ ] **旧ビルドを消さずに更新して、オンボーディングが1回だけ出ること**
      — `onboarding_completed` は後から足した列で既定 false のため、学習途中の端末にも
      1回だけ出る(仕様として許容)。**確かめるのは「1回で終わること」と
      「学習済みの進捗・復習の期日・樹の葉が1つも変わらないこと」**。
      マイグレーション(`0004`)は `ALTER TABLE ADD COLUMN` の1文で既存行に触れない
      ことをコード上は確認済みだが、旧ビルドからの移行は実機で見ていない
      (`docs/plans/onboarding.md` 実装後の記録)
- [ ] **TestFlight で少人数の外部テスト**(要件8章)。
      トロントの友人などターゲット層に触ってもらう。
      **完走は待たずに、審査提出と並行で回すと決めた(2026-09-08)。**
      1日3字の上限があるため全50字の完走に約17日かかり、9/30 に間に合わない。
      見てほしいのは**最初の数日の体験**(オンボーディング → 会話文 → 推測クイズ →
      翌日の復習が戻ってくるところ)までで、第2章以降の通読は求めない

## 4. ストア掲載に要るもの

- [ ] **差別化ポイントの一言でのコピー化**(エレベーターピッチ。要件9章)
- [ ] スクリーンショット / 説明文 / プライバシー情報

---

## ここに載せないもの

- **テーマ3種のうちノーマル / 東京の夜景** — MVP は桜のみで確定(ADR-0006)。リリースに不要
- **第4章の会話文・対象漢字の選定** — 2026-09-02 に完了(漢字50字 / 会話文58文 / 樹の語133語)
- SRS の間隔テーブル — 2026-09-02 に確定(`src/features/srs/scheduler.ts`)
