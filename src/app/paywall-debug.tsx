/**
 * 開発用の一時画面。RevenueCat の受け入れ確認のためだけに存在する。
 *
 * **paywall UI を実装する回で削除すること**(docs/plans/paywall-sdk-init.md)。
 * 本番の導線からは辿れず、`learningkanjimobileapp://paywall-debug` で直接開く。
 * DB 基盤の受け入れ確認に使っていた `db-debug`(会話文画面の実装で退役)と同じ作り。
 *
 * ここで見たいのは1つだけ:「Test Store のオファリングが端末に降りてくること」。
 * `fetchOfferings()` はネイティブモジュールを叩くのでユニットテストでは
 * モックしかできず、実際に `$rc_monthly` が返るかは実機/シミュレータでしか分からない。
 */

import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchOfferings } from '@/features/paywall';
import { useTheme } from '@/theme';

interface PackageRow {
  packageId: string;
  productId: string;
  price: string;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; offeringId: string | null; packages: PackageRow[] };

/**
 * 本番ビルドでは何も出さない。
 *
 * フックを持つ本体を内側に分けているのは、`__DEV__` の判定をフックより先に置くため
 * (本番でも DB クエリを含む初期化が走ってしまうため)。
 */
export default function PaywallDebugScreen() {
  if (!__DEV__) {
    return null;
  }

  return <PaywallDebug />;
}

function PaywallDebug() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchOfferings()
      .then((offerings) => {
        if (cancelled) {
          return;
        }
        const current = offerings.current;
        setState({
          status: 'ready',
          offeringId: current?.identifier ?? null,
          packages: (current?.availablePackages ?? []).map((pkg) => ({
            packageId: pkg.identifier,
            productId: pkg.product.identifier,
            price: pkg.product.priceString,
          })),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        gap: 16,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: '600' }}>Offerings</Text>

      {state.status === 'loading' ? (
        <Text style={{ color: theme.textMuted, fontSize: 15 }}>Loading…</Text>
      ) : state.status === 'error' ? (
        <Text style={{ color: theme.text, fontSize: 15 }}>Failed: {state.message}</Text>
      ) : (
        <View style={{ gap: 16 }}>
          <Row label="current offering" value={state.offeringId ?? '(none)'} theme={theme} />
          <Row label="packages" value={String(state.packages.length)} theme={theme} />
          {state.packages.map((pkg) => (
            <View key={pkg.packageId} style={{ gap: 4 }}>
              <Text style={{ color: theme.accent, fontSize: 17, fontWeight: '600' }}>
                {pkg.packageId}
              </Text>
              <Row label="product" value={pkg.productId} theme={theme} />
              <Row label="price" value={pkg.price} theme={theme} />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: theme.textMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: theme.text, fontSize: 14, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
