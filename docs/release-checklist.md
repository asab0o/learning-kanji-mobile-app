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

- [x] **RevenueCat の API キーを本番のものに差し替える** → 完了(2026-09-09)。
      `src/features/paywall/purchases.ts` を App Store アプリ(`appb622056e1b`)の
      `appl_...` 公開キーに変更した
- [x] **アプリ名を決める** → `Kanji Encounter` に確定。`app.json` の `name` を変更済み(#26)、
      App Store Connect にも App レコード作成済み(Bundle ID `com.asakiita.learningkanji`)
- [ ] **EU圏を配信対象から外す**(2026-09-06 決定)。App Store Connect の
      Pricing and Availability → Availability で **EU加盟国27カ国**を除外する。
      Trader Status(DSA対応の申告)を不要にするため。未設定だとデフォルトで全世界配信になり、
      申告義務のバナーが消えない。**英国・スイス・ノルウェーは EU ではないので外さない**
      (ASC の「Europe」トグルでまとめて選ぶと巻き込まれる)。
      **日本は外さない**(`decisions/ADR-0009-sell-in-japan-with-tokushoho.md`)。
      - **サブスク商品側の Availability は全地域のままにする。** 除外リストを2箇所で持つと
        ズレるため、「どこで売るか」はアプリ側1箇所で決める。
        2026-09-09 に商品側が全地域 `true` であることを確認済み
      - **アプリ側の Availability は API から読めない。** ASC の画面で見るしかない
      - 除外後に一覧で EU が外れていること、英国が残っていることを確認する
- [x] **特定商取引法に基づく表記を用意する** → 公開済み(2026-09-09)。
      https://asab0o.github.io/learning-kanji-mobile-app/tokushoho/
      住所・電話番号は「請求があれば遅滞なく開示」で省略。課金画面からリンク済み
- [ ] **サブスクをアプリのバージョンと一緒に審査へ出す**
      — **各種類の最初の自動更新サブスクは、新しいアプリバージョンと一緒に提出する必要がある**
      (Apple のヘルプ)。サブスクの画面で「Add for Review」→ submission に
      **アプリのバージョンとサブスクリプショングループを含める**。
      **ここを忘れるとアプリだけ審査に出て、通ったのに購入できない状態になる**
- [x] **月額の価格を決める** → **月額 $2.99** に確定(2026-09-08、要件9章)。
      App Store Connect でサブスクを作るときにこの金額を入れる
- [x] **課金ゲートを実装する** → 完了(`docs/plans/paywall-gate.md`)。
      第1章のみ無料、第2章以降は `premium` エンタイトルメントで解放
- [x] **アプリアイコンとスプラッシュを作る** → 完了(2026-09-09、#34 / #35 / #37)。
      アイコンは猫のソラ(`sora.png`)を加工せずそのまま、スプラッシュは絵から採った
      `#F4EDDD` 背景 + 600px の `splash-icon.png`。テンプレの `assets/expo.icon/` と
      `app.json` の `ios.icon` は削除済み
- [x] **App Store Connect にサブスク商品を作る** → 作成済み(2026-09-09 に確認)。
      `kanji-premium-monthly` / グループ `premium-monthly` / ONE_MONTH / US $2.99。
      他地域の価格、表示名 "Full Access"、審査用スクリーンショットとメモ、
      グループの表示名 "Kanji Encounter" まで入っている。
      プライバシーポリシー URL も入り、**2026-09-09 時点で `READY_TO_SUBMIT`**
      (RevenueCat 経由で確認。`MISSING_METADATA` は解消済み)
- [x] **RevenueCat に本番の鍵を2つ設定する** → 設定済み(2026-09-09)。
      `app_store_connect_api_key_configured` / `subscription_key_configured` とも true、
      Vendor Number も登録済み。これで RevenueCat から ASC の商品を直接読めるようになった
- [x] **ビルドと提出の経路を決めて、1回通す** → **EAS Build に確定**(2026-09-09)。
      `eas.json` の `production` が store 配布、ビルド番号は EAS 側で自動採番。
      キュー待ち込み6分45秒で .ipa まで出て、証明書とプロファイルも自動で通った。
      `ios/` は gitignore のまま(CNG)。手元で `expo prebuild` するときは
      `LANG=en_US.UTF-8` を付ける(無いと `pod install` が落ちる)
- [x] **アイコン差し替え後の .ipa を焼き直す** → 完了(2026-09-10)。
      EAS build #2 / `05be9a3`(#41 マージ後の main)。build #1 は `fedeb6c` の
      アイコン差し替え前だった。**まだ TestFlight には上げていない**(`eas submit`)
- [x] **プライバシーポリシーの URL を用意する** → 公開済み(2026-09-09)。
      https://asab0o.github.io/learning-kanji-mobile-app/privacy
      ページの実体は `gh-pages` ブランチ(`privacy/index.html`)。**main には無い。**
      `docs/` から配信すると内部ドキュメント一式がそのままサイトになるため、
      履歴を共有しない別ブランチにした。`src/app/paywall.tsx` の `PRIVACY_URL` は
      元からこの URL を指していたので差し替え不要だった
- [ ] **公開した URL を App Store Connect の2箇所に入れる**
      - [x] サブスク商品の Privacy Policy URL — 入力済み(2026-09-09 に RevenueCat 経由で確認)
      - [ ] App Information 側のアプリ本体の Privacy Policy URL — **未確認**。
            ここは API から読めないので ASC の画面で見る
- [ ] **Paid Applications Agreement が有効か確認する**
      — ASC の Business → Agreements。**これが未締結だと、どの環境でも
      StoreKit から商品を引けない**(offerings が空になる)。
      シミュレータで offerings が引けなかったときの候補の1つとして未確認のまま
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
      - `learningkanjimobileapp://kanji-list`(同上。**書き漏れていた3つ目のルート**)
      - イラスト未投入のプレースホルダに出る鍵名
- [x] **旧ビルドを消さずに更新して、オンボーディングが1回だけ出ること**
      → シミュレータで検証済み(2026-09-10)。`62f9262`(0004 導入前)の JS で
      DB を作り、漢字2字を学習してから main の JS に差し替えた。
      マイグレーションは4本→5本、`onboarding_completed` が既定 false で追加され、
      `user_settings` の既存行は `updated_at` まで無変更。`lesson_events` /
      `quiz_attempts` も一致。オンボーディングは1回出て、再起動では出ない。
      **実機の TestFlight 更新では未確認**(JS の差し替えで再現したため、
      アプリ本体の入れ替えは経由していない)
- [ ] **TestFlight で購入が通ること**。**シミュレータでは確認できない**
      (`Error fetching offerings` / 「None of the products ... could be fetched」。
      RevenueCat 側の設定は確認済み: `default` offering が current、`$rc_monthly` に
      App Store の商品が紐付いている)。課金画面 → 購入 → 第2章が開く → Restore まで見る
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
