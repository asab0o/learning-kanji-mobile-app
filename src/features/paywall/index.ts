/**
 * 課金の公開API。`src/app/` からはここだけを import する。
 *
 * **`purchases` は `react-native-purchases` に到達する。** ユニットテストからは
 * `@/features/paywall/access` のように純粋モジュールを直接 import すること
 * (`@/features/srs/index.ts` の境界コメントと同じ)。
 */

export { gateSentences, isEntitled, isSentenceUnlocked, PREMIUM_ENTITLEMENT_ID } from './access';
export type { EntitlementSnapshot, GatedSentences, GateSentencesInput } from './access';
export {
  addCustomerInfoListener,
  configurePurchases,
  fetchOfferings,
  getCustomerInfo,
  isUserCancelled,
  purchaseMonthly,
  removeCustomerInfoListener,
  restorePurchases,
} from './purchases';
export { EntitlementProvider, useEntitlement } from './entitlement-context';
export type { EntitlementStatus } from './entitlement-context';
export { PaywallView } from './components/paywall-view';
export type { PaywallState } from './components/paywall-view';
