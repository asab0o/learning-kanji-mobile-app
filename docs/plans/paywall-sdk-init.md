# プラン: paywall-sdk-init

作成日: 2026-08-16
ステータス: 完了
要件定義書の対応箇所: 7章(収益化要件/RevenueCat)

## 目的

`react-native-purchases` SDKを`features/paywall/`に組み込み、Test StoreのAPIキーで
`Purchases.configure()`とオファリング取得(`getOfferings()`)まで動く状態にする。
RevenueCatダッシュボード側(プロジェクト・iOSアプリ・Test Store・商品・エンタイトルメント・
オファリング)は別セッションで作成済み。

## スコープ外

- オファリングを画面に表示するUI・購入ボタン・購入処理(`purchasePackage`)
- 章のロック判定・`CustomerInfo`のエンタイトルメント確認
- 復元購入ボタン
- 本番(App Store)APIキーへの切り替え

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/paywall/purchases.ts` | 新規 | `configurePurchases()` / `fetchOfferings()`。Test Store APIキー保持、二重configureガード |
| `src/features/paywall/purchases.test.ts` | 新規 | `react-native-purchases`をモックしたユニットテスト |
| `src/features/paywall/index.ts` | 新規 | 公開API re-export |
| `src/app/_layout.tsx` | 変更 | マウント時に`useEffect`で`configurePurchases()`を1回呼ぶ |

## データモデルの変更

なし。

## 実装ステップ

1. `purchases.ts`にTest Store APIキー定数(`test_kJIHcBOQPJHMqpkGFdcSAVRaTDd`)を持たせ、
   `configurePurchases()`(二重初期化ガード付き、`__DEV__`時のみ`setLogLevel(LOG_LEVEL.DEBUG)`)と
   `fetchOfferings()`を実装
2. `purchases.test.ts`で、正しいAPIキーでconfigureされること・複数回呼んでも1回しか
   configureされないこと・`fetchOfferings()`が`getOfferings()`の戻り値をそのまま返すことを検証
3. `index.ts`で両関数を公開API化
4. `_layout.tsx`の`useEffect`から`configurePurchases()`を呼ぶ

## 受け入れ条件

- [x] `purchases.ts`がTest Store APIキーを定数保持し、本番切り替え時の差し替え箇所がコメントで明記されている
- [x] `configurePurchases()`を複数回呼んでも`Purchases.configure`は1回しか呼ばれない
- [x] `fetchOfferings()`が`Purchases.getOfferings()`の戻り値をそのまま返す
- [x] `_layout.tsx`はマウント時に1回だけ`configurePurchases()`を呼び、画面ロジックは増えていない
- [x] `pnpm run check`(typecheck/lint/test/content)が通る
- [x] iOSシミュレータでネイティブビルドし、`fetchOfferings()`の`current.availablePackages`に
      `$rc_monthly`が1件返ることを確認する

## 実機確認の結果(2026-08-29)

iPhone 17 Pro シミュレータ(iOS 26)で確認した。`current` は `default`、
`availablePackages` は1件で、`$rc_monthly` / `premium_monthly_test` / USD 2.99 が返る。

確認のために `src/app/paywall-debug.tsx` を足した。`db-debug` と同じ作りの開発用一時画面で、
`__DEV__` でしか描画せず、本番の導線からは辿れない(`learningkanjimobileapp://paywall-debug`)。
**paywall UI を実装する回で削除すること。**
`fetchOfferings()` はネイティブモジュールを叩くのでユニットテストではモックしかできず、
実際にオファリングが降りてくるかは画面を出さないと分からないため。

**気づいたこと**: RevenueCat が起動時に `ui_config` の取得に失敗して警告を2件出す
(`Unable to merge remote config blob data for topic 'ui_config'`)。
ダッシュボードに paywall を1つも作っていないためで、`getOfferings()` 自体は成功している。
**RevenueCatUI のテンプレート paywall を使うなら、先にダッシュボード側の設定が要る。**
自前UIで作るなら無視してよい。paywall UI の回で判断すること。

## テスト方針

`purchases.ts`はReactを持たない薄いSDKラッパーなので、`purchases.test.ts`で
`react-native-purchases`をモックしたユニットテストのみとし、UIは今回追加していないため
手動確認は不要(パイウォールUIを作る回で改めて実機確認する)。

## リスク・未確定事項

- `react-native-purchases`はネイティブモジュールのためExpo Goでは実データが取れない
  (Preview API Modeはモックデータのみ)。実オファリング疎通確認にはprebuild後のネイティブ
  ビルドが必要(受け入れ条件の未実施項目)
- 本番APIキーへの切り替えはApp Store Connect登録後の別タスク
