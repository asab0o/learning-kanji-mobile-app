import Purchases, { LOG_LEVEL, type PurchasesOfferings } from 'react-native-purchases';

// Test Store公開キー(project: proj67324f83 / app: app952b72089c)。
// App Store Connect登録後、本番のappl_...キーに差し替える。
const REVENUECAT_IOS_API_KEY = 'test_kJIHcBOQPJHMqpkGFdcSAVRaTDd';

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

export function fetchOfferings(): Promise<PurchasesOfferings> {
  return Purchases.getOfferings();
}
