/**
 * 課金画面。ルーティングと RevenueCat の呼び出しだけを持つ(描画は PaywallView)。
 *
 * 通信するのはここだけ(絶対規則9)。オファリングの取得・購入・復元の3つ。
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import type { PurchasesPackage } from 'react-native-purchases';

import {
  fetchOfferings,
  isEntitled,
  isUserCancelled,
  PaywallView,
  purchaseMonthly,
  restorePurchases,
  type PaywallState,
} from '@/features/paywall';

/**
 * Apple 標準の EULA。自前の利用規約を用意しない場合、App Store Connect が
 * 既定で適用するのがこれなので、購入画面から示すのもこれで整合する。
 */
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * **プライバシーポリシーの URL はまだ用意できていない。**
 * リンク先が 404 のままだと審査で落ちる。公開作業は docs/release-checklist.md の管轄で、
 * 差し替えるのはこの定数1箇所だけ。
 */
const PRIVACY_URL = 'https://asab0o.github.io/learning-kanji-mobile-app/privacy';

export default function PaywallScreen() {
  const router = useRouter();
  const [state, setState] = useState<PaywallState>('loading');
  const [monthly, setMonthly] = useState<PurchasesPackage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchOfferings()
      .then((offerings) => {
        if (cancelled) {
          return;
        }
        const current = offerings.current;
        // 実測でオファリング `default` に `$rc_monthly` があるので monthly が本線。
        // availablePackages への落とし込みは、将来パッケージを差し替えたときの保険。
        setMonthly(current?.monthly ?? current?.availablePackages[0] ?? null);
        setState('idle');
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // 取得できないこと自体は画面の「unavailable」で伝わる。原因は console に残す。
        console.warn('[paywall] could not fetch offerings:', error);
        setMonthly(null);
        setState('idle');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const back = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const onPurchase = () => {
    if (monthly === null) {
      return;
    }

    setErrorMessage(null);
    setState('purchasing');

    purchaseMonthly(monthly)
      .then(() => {
        // エンタイトルメントの反映は待たない。EntitlementProvider のリスナーが
        // CustomerInfo の更新を受けて状態を差し替えるので、戻るだけでよい。
        back();
      })
      .catch((error: unknown) => {
        setState('idle');
        // 閉じただけならエラーではない。文言を出すと「失敗した」と誤解させる。
        setErrorMessage(isUserCancelled(error) ? null : 'Purchase failed. Please try again.');
      });
  };

  const onRestore = () => {
    setErrorMessage(null);
    setState('restoring');

    restorePurchases()
      .then((info) => {
        if (isEntitled(info)) {
          // 反映はリスナーがやる。ここは閉じるだけ。
          back();
          return;
        }

        // 復元しても何も無かった場合、リスナーは状態を変えない。黙って閉じると
        // 「押したのに何も起きない」ので、戻らずに一言出す。
        setState('idle');
        setErrorMessage('Nothing to restore.');
      })
      .catch((error: unknown) => {
        console.warn('[paywall] could not restore purchases:', error);
        setState('idle');
        setErrorMessage(isUserCancelled(error) ? null : 'Could not restore. Please try again.');
      });
  };

  return (
    <PaywallView
      priceString={monthly?.product.priceString ?? null}
      state={state}
      errorMessage={errorMessage}
      onPurchase={onPurchase}
      onRestore={onRestore}
      onClose={back}
      onOpenTerms={() => void WebBrowser.openBrowserAsync(TERMS_URL)}
      onOpenPrivacy={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}
    />
  );
}
