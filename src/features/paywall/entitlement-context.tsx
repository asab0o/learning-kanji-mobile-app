/**
 * 購読状態の配布層(要件定義書 7章 / 6.1)。
 *
 * 真実は Apple / RevenueCat が持つ。**SQLite には写さない** —
 * 写すと期限切れの反映漏れが起き、`user_settings` を「同期対象のユーザー状態」として
 * 扱っている設計(絶対規則4)にも混ざる。オフラインの担保は SDK の `CustomerInfo`
 * キャッシュに任せる(要件6.1「購入後の有料範囲アクセスはオフラインでも可能」)。
 *
 * Context にしているのは、購読状態を読むのが入口画面・会話文画面・paywall の3箇所で、
 * フックだけにするとそれぞれが別々に `getCustomerInfo()` を叩いてちらつくため
 * (`@/features/settings` の SettingsProvider と同じ理由)。
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CustomerInfo } from 'react-native-purchases';

import { isEntitled } from './access';
import {
  addCustomerInfoListener,
  configurePurchases,
  getCustomerInfo,
  removeCustomerInfoListener,
} from './purchases';

/**
 * 購読状態の3値。
 *
 * `unknown` を持つのは、SDK の応答を待つ間に「未購読」と断定しないため。
 * **出す文はロック側に倒す**(有料の文を一瞬でも見せない)が、
 * **解放の導線は出さない**(購読者に `Unlock` が一瞬光るのを防ぐ)。
 * この非対称が `unknown` を `locked` と別に持つ理由。
 */
export type EntitlementStatus = 'unknown' | 'locked' | 'unlocked';

interface EntitlementValue {
  status: EntitlementStatus;
  /** 有料範囲を開けてよいか。判定中は false(ロック側に倒す)。 */
  unlocked: boolean;
}

const EntitlementContext = createContext<EntitlementValue | undefined>(undefined);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<EntitlementStatus>('unknown');

  useEffect(() => {
    let active = true;

    const apply = (info: CustomerInfo | null) => {
      if (active) {
        setStatus(isEntitled(info) ? 'unlocked' : 'locked');
      }
    };

    // **順序の担保そのものは `purchases.ts` にある**(SDK 委譲4本が先頭で configure する)。
    // ここでの呼び出しは、アプリ起動時に一度通しておくための保険。
    // どちらか片方を消したくなったら、消してよいのは**こちら**。
    // ラッパ側を消すと、課金画面をコールドスタートで開いた経路が壊れる
    // (課金画面も この provider の子なので effect が先に走る)。
    configurePurchases();

    getCustomerInfo()
      .then(apply)
      .catch((error: unknown) => {
        // 初回起動でオフライン等。ロック側に倒す。購読者がこの状況に落ちることは、
        // 購入自体が通信を要するため実質起こらない。
        console.warn('[paywall] could not read the subscription state:', error);
        apply(null);
      });

    // 購入・復元・期限切れは、アプリが前面にある間ここから届く。
    // これがあるので画面側から refresh() を呼ぶ必要がない。
    const listener = (info: CustomerInfo) => {
      apply(info);
    };
    addCustomerInfoListener(listener);

    return () => {
      active = false;
      removeCustomerInfoListener(listener);
    };
  }, []);

  const value = useMemo(() => ({ status, unlocked: status === 'unlocked' }), [status]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlement(): EntitlementValue {
  const value = useContext(EntitlementContext);

  if (value === undefined) {
    throw new Error('useEntitlement must be used inside <EntitlementProvider>.');
  }

  return value;
}
