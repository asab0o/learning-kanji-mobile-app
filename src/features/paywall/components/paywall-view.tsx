/**
 * 課金画面(要件定義書 7章 / 5.1-11)。
 *
 * 売るのは月額の単一プランだけなので、RevenueCatUI(`react-native-purchases-ui`)は
 * 入れず自前で描く。新規のネイティブ依存を足さずに済み、色をテーマトークンで
 * 統一できる(絶対規則1)。判断の経緯は docs/plans/paywall-gate.md の決めどころ3。
 *
 * ここは描くだけ。オファリングの取得・購入・遷移は `src/app/paywall.tsx` が持つ。
 */

import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

/** 画面が今何をしているか。押下中の二重発火を防ぐためにも使う。 */
export type PaywallState = 'idle' | 'loading' | 'purchasing' | 'restoring';

interface PaywallViewProps {
  /**
   * 表示する価格。`product.priceString` をそのまま渡す。
   * **金額をこのファイルに書かない**(価格は要件9章で未決定、ストアが正)。
   */
  priceString: string | null;
  state: PaywallState;
  /** 失敗の一言。キャンセルのときは null を渡す(何も出さない)。 */
  errorMessage: string | null;
  onPurchase: () => void;
  onRestore: () => void;
  onClose: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
}

export function PaywallView({
  priceString,
  state,
  errorMessage,
  onPurchase,
  onRestore,
  onClose,
  onOpenTerms,
  onOpenPrivacy,
}: PaywallViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const busy = state === 'purchasing' || state === 'restoring';
  // 価格が引けていないものは買えない。Restore は押せるままにする
  // (オファリングが取れなくても、購入済みの復元は別経路で通るため)。
  const canPurchase = priceString !== null && !busy;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Text
        style={{
          fontFamily: theme.type.minchoBold,
          fontSize: 26,
          lineHeight: 36,
          color: theme.text,
        }}
      >
        Keep going with all 4 chapters
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surfaceVeil,
            borderColor: theme.border,
            borderRadius: theme.radius.card,
          },
        ]}
      >
        <Benefit text="48 more conversations, 40 more kanji" />
        <Benefit text="Watch a kanji you know change its reading in a new scene" />
        <Benefit text="Reviews and your kanji trees keep growing" />
      </View>

      <View style={styles.priceBlock}>
        {state === 'loading' ? (
          <ActivityIndicator color={theme.accent} />
        ) : priceString === null ? (
          <Text style={[styles.unavailable, { color: theme.textMuted }]}>
            Subscriptions are unavailable right now.
          </Text>
        ) : (
          <Text style={{ fontSize: 20, color: theme.text }}>{`${priceString} / month`}</Text>
        )}
        {/*
          自動更新であることの明示は Apple の審査要件。
          無料トライアルは設定していないので(要件7章)、その文言は出さない。
        */}
        <Text style={[styles.fineprint, { color: theme.textMuted }]}>
          Renews automatically until cancelled. Cancel anytime in the App Store.
        </Text>
      </View>

      {errorMessage === null ? null : (
        <Text style={[styles.error, { color: theme.negative }]}>{errorMessage}</Text>
      )}

      <Pressable
        onPress={onPurchase}
        disabled={!canPurchase}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPurchase }}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: theme.accent,
            borderRadius: theme.radius.pill,
            opacity: !canPurchase ? 0.45 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={{ color: theme.onAccent, fontSize: 16 }}>
          {state === 'purchasing' ? 'Purchasing…' : 'Subscribe'}
        </Text>
      </Pressable>

      <Pressable onPress={onRestore} disabled={busy} accessibilityRole="button" hitSlop={10}>
        <Text style={[styles.link, { color: theme.accent, opacity: busy ? 0.45 : 1 }]}>
          {state === 'restoring' ? 'Restoring…' : 'Restore purchases'}
        </Text>
      </Pressable>

      {/*
        購入画面から利用規約とプライバシーポリシーに到達できることは Apple の審査要件。
        リンク先の URL は src/app/paywall.tsx に置く。
      */}
      <View style={styles.legalRow}>
        <Pressable onPress={onOpenTerms} accessibilityRole="link" hitSlop={10}>
          <Text style={[styles.legal, { color: theme.textMuted }]}>Terms of Use</Text>
        </Pressable>
        <Text style={[styles.legal, { color: theme.border }]}>·</Text>
        <Pressable onPress={onOpenPrivacy} accessibilityRole="link" hitSlop={10}>
          <Text style={[styles.legal, { color: theme.textMuted }]}>Privacy Policy</Text>
        </Pressable>
      </View>

      <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" hitSlop={10}>
        <Text style={[styles.link, { color: theme.textMuted, opacity: busy ? 0.45 : 1 }]}>
          Not now
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Benefit({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <View style={styles.benefit}>
      <Text style={{ color: theme.accent, fontSize: 15 }}>•</Text>
      <Text style={[styles.benefitText, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 20,
  },
  card: {
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  benefit: {
    flexDirection: 'row',
    gap: 10,
  },
  benefitText: {
    fontSize: 15,
    lineHeight: 22,
    flexShrink: 1,
  },
  priceBlock: {
    gap: 6,
    alignItems: 'center',
  },
  unavailable: {
    fontSize: 15,
    textAlign: 'center',
  },
  fineprint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  error: {
    fontSize: 13,
    textAlign: 'center',
  },
  cta: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  link: {
    fontSize: 14,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  legal: {
    fontSize: 12,
  },
});
