import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';

// App Store の公開SDKキー(project: proj67324f83 / app: appb622056e1b)。
// **公開キーなのでリポジトリに置いてよい。** SDKがクライアントに配る前提の値で、
// .ipa から誰でも取り出せる。伏せても秘匿性は増えない。
// 秘密APIキー(sk_...)と .p8 は別物で、こちらは絶対に置かない。
const REVENUECAT_IOS_API_KEY = 'appl_REDLRYUUznEtbRGHBNyMTKlzlPP';

let configured = false;

export function configurePurchases(): void {
  if (configured) {
    return;
  }
  configured = true;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
}

/**
 * ここから下は SDK への薄い委譲だけ。**判定を書かない。**
 * 「購読しているか」の判断は `./access` の `isEntitled()` が持つ(あちらは
 * ネイティブモジュールに触らないのでテストできる)。
 *
 * **どれも先頭で `configurePurchases()` を呼ぶ。** SDK は未初期化で呼ばれると
 * `UninitializedPurchasesError` で reject する(同期 throw ではないので握り潰されやすい)。
 * `learningkanjimobileapp://paywall` をコールドスタートで開くと、課金画面は
 * EntitlementProvider と同じコミットでマウントされるため、子である課金画面の effect が
 * 先に走る。順序の前提を呼び出し側に配らず、ここ1箇所に閉じる。
 * `configurePurchases()` は冪等なので重ねて呼んでも副作用がない。
 */

export function fetchOfferings(): Promise<PurchasesOfferings> {
  configurePurchases();
  return Purchases.getOfferings();
}

/** いまの購読状態。オフラインでも SDK のキャッシュから返る(要件6.1)。 */
export function getCustomerInfo(): Promise<CustomerInfo> {
  configurePurchases();
  return Purchases.getCustomerInfo();
}

/** 購入。成功しても失敗しても、状態の反映はリスナー経由で来る。 */
export function purchaseMonthly(pkg: PurchasesPackage): Promise<unknown> {
  configurePurchases();
  return Purchases.purchasePackage(pkg);
}

/** 購入の復元(Apple 審査の必須項目。要件7章)。 */
export function restorePurchases(): Promise<CustomerInfo> {
  configurePurchases();
  return Purchases.restorePurchases();
}

export function addCustomerInfoListener(listener: CustomerInfoUpdateListener): void {
  Purchases.addCustomerInfoUpdateListener(listener);
}

export function removeCustomerInfoListener(listener: CustomerInfoUpdateListener): void {
  Purchases.removeCustomerInfoUpdateListener(listener);
}

/**
 * 購入ダイアログを閉じただけか。
 *
 * SDK は購入のキャンセルも reject で返すので、これを見分けないと
 * 「閉じただけ」でエラー文言が出る。SDK は例外に `userCancelled` を立てる。
 * 例外の型は `unknown` なので、`any` を使わずに型ガードで絞る。
 */
export function isUserCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'userCancelled' in error &&
    error.userCancelled === true
  );
}
