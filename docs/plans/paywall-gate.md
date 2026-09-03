# プラン: paywall-gate

作成日: 2026-09-03
ステータス: 完了
要件定義書の対応箇所: 5.1-11 / 7章(収益化)/ 6.1(オフライン)/ 8章(機能凍結)

## 目的

第1章(#1〜#10)を無料、第2章以降を月額サブスクで解放する。無料の範囲を学び終えた学習者が、
その場で価格と内容を見て購入でき、再インストール後は「購入の復元」で元に戻せる状態にする。

---

## 要件定義書との突き合わせ(実装案の前に置く指摘)

読み合わせた結果、**要件と矛盾する設計は見つからなかった**。ただし要件どおりに実装すると
以下2点が起きる。**要件を解釈で変えないため、事実として先に置く。**

1. **無料体験は実質「約4日」になる。**
   第1章は会話文10本・新出漢字10字。1日3字の上限(ADR-0003)があるので、最短4日で
   無料分を使い切る。要件7章の「第1章まるごと無料が実質のトライアル」という想定と、
   日数の体感は一致しない可能性がある。**境界を動かすのは要件7章の変更なので、今回は動かさない。**

2. **「読みが変わった」演出(要件4.6 / 段階的再登場の第2段階)は無料範囲に1つも無い。**
   `reencounters` を持つ会話文は58本中8本で、**最初が #17(第2章)**。
   つまり最重要の差別化(要件5.1-5)を、無料の学習者は一度も見ないままゲートに当たる。
   これも境界の問題なので実装では解かず、**paywall のコピーで「この先に何があるか」を
   言葉で見せる**ことで受ける。
   **承認時の決定(2026-09-03): この件は `docs/decisions/ADR-0008-free-tier-boundary.md` に
   理由を残し、`docs/requirements.md` 9章に「無料範囲の境界を見直すか」を未チェックで積む。**
   プランは完了時に凍結されるため、プランのリスク欄だけでは後から辿れない。

実装に効く確認結果:

- 価格は要件9章で未決定 → **paywall に金額をベタ書きしない**(`product.priceString` を描く)
- 要件7章「無料トライアルは設定しない」→ paywall のコピーに `Free trial` を出さない
- 要件6.1「購入後の有料範囲アクセスはオフラインでも可能」→ RevenueCat SDK の
  `CustomerInfo` キャッシュに乗る。**アプリ側で購読状態を SQLite に写さない**

### ダッシュボードの実測値(2026-09-03 に RevenueCat API で確認)

着手前に確認すべきとされていた識別子は**確定済み**。プランに埋め込む。

| 項目 | 値 |
|---|---|
| プロジェクト | `proj67324f83` (Kanji Learning App) |
| **エンタイトルメント `lookup_key`** | **`premium`** (`entl987a7fb645`) |
| オファリング | `default` / `is_current: true` / `paywall_id: null` |
| パッケージ | `$rc_monthly` → SDK の `current.monthly` で取れる |
| `premium` に紐付く商品 | `com.asakiita.learningkanji.premium.monthly`(本番 App Store)と `premium_monthly_test`(Test Store)の**2件** |

ここから2つ言える。

- **本番キーに差し替えるときコード変更は要らない。** 両方の商品が同じ `premium` に
  紐付いているので、`PREMIUM_ENTITLEMENT_ID = 'premium'` のままで本番も通る
- **`paywall_id: null` = ダッシュボードに paywall が未作成。** RevenueCatUI を採ると
  そのデザイン作業が丸ごと増える(決めどころ3の判断材料)

---

## 設計の決めどころ

### 1. ゲートをどこに置くか

| 案 | 内容 | 評価 |
|---|---|---|
| A | 「今日の学習」のキューだけ。`planTodaysLessons()` の**入力の文の配列**をロック済みで絞る | 申し送り(`docs/plans/srs-lessons.md`)どおりに収まる。ただし deep link は素通り |
| B | 会話文画面(`src/app/conversation/[id].tsx`)の入口だけ | 押した後にロックを知る導線になり、Today に「この先がある」ことを出せない |
| C | **両方**(A を本線、B を保険) | +10行程度。deep link / 古いナビゲーションスタックを塞げる |

**推奨: C。** 本線は A。`planTodaysLessons()` が「文の配列 → 文の配列」の形を保ったまま
被せられるので、SRS 側を一切書き換えずに済む。
B を足すのは、`learningkanjimobileapp://conversation/<id>` が実在の入口である以上、
画面側にも1枚ガードを置かないと「有料の会話文が読める URL」が残るため。
B は `isSentenceUnlocked()` を呼んで paywall に差し替えるだけで、ロジックは増えない。

**漢字フォーカス画面(`src/app/kanji/[id].tsx`)にはガードを置かない。** 会話文からしか
辿れず、樹はまだ無い。樹を作る回で改めて見る(スコープ外に記載)。

### 2. 未購読者が第2章以降の復習をどう扱うか

| 案 | 内容 | 採否 |
|---|---|---|
| A | **学習済みの字は購読状態に関係なく復習に出す**(`planTodaysReviews` を変更しない) | **採用** |
| B | いまアンロック中の文で導入された字だけ復習に出す | **捨てる。** 購読が切れた瞬間に、学んだ字が復習キューから消える。「学んだ事実」はユーザー状態でありコンテンツではない(絶対規則4の分離)。学習者から見ると**進捗を取り上げられた**ように見える。Apple の審査でも「既に対価を払って得たものを失う」挙動は説明を要求されやすい |
| C | 復習は出すが、購読切れの間はステージを進めない | **捨てる。** `review_events` は追記のみで、畳み込みは購読状態を知らない。ここに購読という**時間で変わる外部状態**を持ち込むと、同じイベント列から違うステージが出る。絶対規則5の「現在状態は `review_events` から導出する」が壊れる。実装量も一番多い |

**推奨: A。** 追加コスト**ゼロ**(`planTodaysReviews({ kanji, lessons, reviews, now })` は
`lesson_events` を起点にしており、購読状態を見ないままで正しい)。
復習は意味の4択なので、**有料の会話文の本文は1文字も出ない**。
「学んだ字の復習は続く / 新しい章は開かない」という切り分けは、無料と有料の境界としても説明しやすい。

### 3. paywall UI を自前で作るか、RevenueCatUI を入れるか

| 案 | 内容 | 評価 |
|---|---|---|
| A | **自前 UI**(`react-native-purchases` v10.7.0 のみ) | 新規依存なし。prebuild の作り直しなし。テーマトークンで塗れる |
| B | `react-native-purchases-ui` を追加し `presentPaywall()` | 新規ネイティブ依存 → prebuild が要る。**さらにダッシュボードで paywall を1枚デザインする作業が必須**(実測 `paywall_id: null`)。配色はダッシュボード側に散り、テーマと二重管理になる |

**推奨: A(自前)。承認済み(2026-09-03)。** 売る対象は月額1本・パッケージ1件だけで、必要な部品は
見出し・箇条書き3行・価格・購入ボタン・Restore・法務リンクだけ。
`react-native-purchases` はネイティブ依存としてすでに入っており、**`ios/` は
`.gitignore` 済み(CNG)なので、依存を足さなければ prebuild の作り直しは発生しない**。
B は残り時間(9/30)に対してダッシュボード作業とネイティブビルドのやり直しが増える。

**config plugin:** `react-native-purchases` は config plugin を必要としない(autolinking のみ)。
`app.json` の `plugins` は**変更しない**。`expo-web-browser`(`~57.0.2` 導入済み・未使用)も
config plugin は任意で、今回は既定のまま。

### 4. 購入の復元(Restore)をどこに置くか

| 案 | 内容 | 評価 |
|---|---|---|
| A | 設定画面を新設して置く | 画面が1枚増える。いま設定に置くものは Romaji トグル1つだけ(会話文ヘッダーに実装済み)で、割に合わない |
| B | **paywall 画面に置く**+ Today に paywall への常設の入口 | 画面0枚追加。Apple が求める「購入 UI から復元できる」を満たす |
| C | RevenueCatUI の Customer Center | 決めどころ3で B を捨てた時点で無し |

**推奨: B。** ただし条件が1つある。**未購読のあいだ、Today に paywall への入口を常時出すこと。**
「無料分を学び終えたときだけ出す」にすると、再インストールした購読者は第1章を4日やり直すまで
Restore に辿り着けない。常設の入口(控えめな1行)で塞ぐ。

### 5. 購入前後で `Reviews` / `Today` の見え方がどう変わるか

| | 未購読(`locked`) | 購読中(`unlocked`) | 判定中(`unknown`) |
|---|---|---|---|
| Today のカード | 第1章の未完了分のみ(第2章以降は**一覧に現れない**) | 全58文が対象。いまと同じ | 第1章のみ(= locked と同じ) |
| 解放の入口 | 常に出す。無料分を終えていたら**大きいカード**、それ以外は控えめな1行 | **出さない** | **出さない**(購読者に一瞬出るちらつきを避ける) |
| 「今日ぶんが終わった」文言 | 無料分を学び切ったら文言ではなく解放カードを出す | いまと同じ | いまと同じ |
| Reviews の行 | **変わらない**(決めどころ2-A) | 変わらない | 変わらない |
| 復習セッション | 変わらない | 変わらない | 変わらない |

購入直後は `addCustomerInfoUpdateListener` → Context 更新 → Today に戻り、
`useFocusEffect` の読み直しと Context の再描画が重なって**その場で第2章の回が現れる**。

### 6. エンタイトルメント状態の保持と、オフライン/応答待ちの振る舞い

- **Context で持つ**(`architecture.md`「状態管理」: 専用ライブラリを足さない)。
  フックだけにすると Today・会話文画面・paywall の3箇所が別々に `getCustomerInfo()` を叩き、
  ちらつきの原因になる。
- **SQLite には書かない。** 購読状態はユーザー状態ではなく Apple / RevenueCat が持つ真実で、
  写すと期限切れの反映漏れが起きる。オフラインの担保は SDK の `CustomerInfo` キャッシュに任せる
  (要件6.1 が求める「購入後の有料範囲アクセスはオフラインでも可能」はこれで満たす)。
- 状態は3値: `'unknown' | 'locked' | 'unlocked'`。
  - **起動直後・応答待ちは `unknown`。ロック側に倒す**(= 有料の文は出さない)。
    ただし**無料分は `unknown` でも常に見せる**。第1章しか出ないので、
    未購読者にとっては何も待たされない。
  - **`unknown` の間は解放カード・ロック表示を一切出さない。** 購読者に `Unlock` が
    一瞬光る事故を防ぐ。SDK のキャッシュ応答は通常1秒未満。
  - `getCustomerInfo()` が reject(初回起動でオフライン等)したら `locked` に落とす。
    購読者がオフラインで初回起動する状況は、購入がそもそも通信を要するため成立しない。

---

## スコープ外

**今回やらないこと。** 迷ったら足さない。

- **設定画面の新設**(決めどころ4)。Restore は paywall 画面のみ
- **RevenueCatUI(`react-native-purchases-ui`)の導入**、およびダッシュボード側の paywall デザイン
- **paywall のモーダル表示**(`presentation: 'modal'`)。通常の push で出す
- **本番 API キー(`appl_...`)への差し替え**。`docs/release-checklist.md` の管轄
  (実測のとおり、差し替えてもエンタイトルメント識別子は `premium` のままでよい)
- **月額価格の決定**。paywall は `product.priceString` を描くだけ
- **年額・買い切り・無料トライアル・イントロ価格**(要件7章で不採用)
- **漢字フォーカス画面(`src/app/kanji/[id].tsx`)のガード**。会話文からしか辿れない。樹を作る回で見る
- **開発用一覧(`src/app/conversations.tsx`)からのロック除外表示**。`__DEV__` 限定なので触らない
- **`__DEV__` 限定の「強制アンロック」トグル/定数**。Test Store の購入と再インストールで
  両方の状態を作れるので足さない
- **購読の解約/管理画面への導線**(`Purchases.showManageSubscriptions()` 等)。
  App Store の設定から解約できるため、MVP では出さない
- **プライバシーポリシー本文の作成とホスティング**。URL を置く場所だけ作り、
  URL 確定は `docs/release-checklist.md` に項目として積む
- **ロックされた第2章以降を「鍵付きで一覧に見せる」演出**。今回は**一覧から消す**
- **段階的再登場・推測クイズ・漢字の樹への影響**(いずれも未実装 or 影響なし)

---

## 変更するファイル

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `src/features/paywall/access.ts` | 新規 | **純粋ロジック。`react-native-purchases` も `@/db` も import しない。** `PREMIUM_ENTITLEMENT_ID`、`isEntitled()`、`isSentenceUnlocked()`、`gateSentences()` |
| `src/features/paywall/access.test.ts` | 新規 | 上記のユニットテスト |
| `src/features/paywall/entitlement-context.tsx` | 新規 | `EntitlementProvider` / `useEntitlement()`。configure → `getCustomerInfo()` → `addCustomerInfoUpdateListener()` |
| `src/features/paywall/components/paywall-view.tsx` | 新規 | paywall の UI。`expo-router` を import しない(`onClose` / `onPurchased` を props で受ける) |
| `src/app/paywall.tsx` | 新規 | ルート。オファリング取得と画面遷移だけ |
| `src/features/paywall/purchases.ts` | 変更 | `getCustomerInfo()` / `purchasePackage()` / `restorePurchases()` / リスナー登録・解除の薄いラッパを追加 |
| `src/features/paywall/purchases.test.ts` | 変更 | 追加分のモックテスト |
| `src/features/paywall/index.ts` | 変更 | 公開 API の re-export を追加 |
| `src/app/_layout.tsx` | 変更 | `configurePurchases()` の `useEffect` を撤去し、`EntitlementProvider` を敷く |
| `src/app/index.tsx` | 変更 | `gateSentences()` を挟んで `planTodaysLessons()` に渡す。`planTodaysReviews()` は**変更しない** |
| `src/features/srs/components/today-view.tsx` | 変更 | `lockedCount` / `onUnlock` を受け、解放カード(2段階の強さ)を描く |
| `src/app/conversation/[id].tsx` | 変更 | ロック中の会話文を開いたら paywall へ差し替える保険 |
| `src/features/reading/conversation-list.tsx` | 変更 | 冒頭コメントの「章のロックは paywall の回の担当」を現状に合わせて直す(開発用一覧は意図的に絞らない、と明記) |
| `src/app/paywall-debug.tsx` | **削除** | `docs/plans/paywall-sdk-init.md` の約束(今回がその回) |
| `docs/architecture.md` | 変更 | ルート一覧: `paywall.tsx` を追加、`paywall-debug.tsx` を削除。`features/paywall/` の担当欄を現状に合わせる |
| `docs/release-checklist.md` | 変更 | 「課金ゲートを実装する」「`paywall-debug.tsx` を削除する」をチェック。**「プライバシーポリシーの URL を用意する」を新規に積む** |
| `docs/decisions/ADR-0008-free-tier-boundary.md` | 新規 | 無料範囲が「読みが変わった」演出を含まないと知った上で、MVP では境界を動かさない判断とその理由 |
| `docs/requirements.md` | 変更 | 9章の未決定事項に「無料範囲の境界を見直すか(→ ADR-0008)」を未チェックで追加 |

> `src/features/srs/` の**純粋ロジック(`lessons.ts` / `scheduler.ts`)は1行も変更しない。**
> `docs/plans/srs-lessons.md` の申し送りどおり、入力の配列を絞る形で収まる。

---

## データモデルの変更

**なし。** マイグレーション不要。

- `sentences.is_free` は既にあり、`toSentence()` が `Sentence.isFree` に載せている。**読むだけ。**
- 購読状態は SQLite に持たない(前述)。`user_settings` にも足さない。
- `review_events` / `lesson_events` の書き方は変わらない(絶対規則5に触れない)。

---

## 実装ステップ

1. **`src/features/paywall/access.ts`(純粋ロジック)を書く。**
   - `export const PREMIUM_ENTITLEMENT_ID = 'premium';`(ダッシュボード実測値)
   - `isEntitled(info)`: 引数は SDK 型ではなく構造的な最小型
     (`{ entitlements: { active: Record<string, unknown> } } | null`)。
     こうすると `react-native-purchases` を import せずに済み、テストが素のオブジェクトで書ける
   - `isSentenceUnlocked(sentence, unlocked)`: `sentence.isFree || unlocked`
   - `gateSentences({ sentences, unlocked })` → `{ unlocked: Sentence[]; lockedCount: number }`
     `order` の並びを壊さない
2. **`access.test.ts`** を書く(観点はテスト方針)。
3. **`purchases.ts` に SDK ラッパを足す。**
   `getCustomerInfo()` / `restorePurchases()` / `purchasePackage(pkg)` /
   `addCustomerInfoUpdateListener` `removeCustomerInfoUpdateListener` の薄い委譲。
   **ここに判定ロジックを書かない**(判定は `access.ts`)。
   購入のキャンセルは SDK が例外に `userCancelled` を立てるので、
   `isUserCancelled(error)` だけここに置く(型ガードで絞る。`any` 禁止)。
4. **`entitlement-context.tsx` を書く。**
   - `useState<'unknown' | 'locked' | 'unlocked'>('unknown')`
   - `useEffect` で `configurePurchases()` → `getCustomerInfo()` →
     `addCustomerInfoUpdateListener()`。アンマウントでリスナーを外す。
     **`configurePurchases()` をここに移すのは順序のため**: 子の effect は親より先に走るので、
     `_layout.tsx` の `useEffect` に残すと provider の `getCustomerInfo()` が
     configure より先に走る。`configurePurchases()` は二重呼び出しガード済み
   - 公開するのは `useEntitlement(): { status, unlocked }`(`unlocked = status === 'unlocked'`)
   - `refresh()` は公開しない。リスナーで足りる
5. **`_layout.tsx`** の `useEffect` を消し、`<SettingsProvider>` の内側(= `Stack` の外側)に
   `<EntitlementProvider>` を置く
6. **`components/paywall-view.tsx` を書く。**
   - props: `packageInfo`(価格文字列とパッケージ)、`state`(`idle`/`purchasing`/`restoring`)、
     `errorMessage`、`onPurchase`、`onRestore`、`onClose`、`onOpenUrl`
   - **色は全て `useTheme()` のトークン**(絶対規則1)。CTA は `theme.accent` / `theme.onAccent`、
     カードは `theme.surfaceVeil`、角丸は `theme.radius.pill` / `theme.radius.card`
   - **UI 文言(英語)案:**
     - 見出し: `Keep going with all 4 chapters`
     - 箇条書き:
       - `48 more conversations, 40 more kanji`
       - `Watch a kanji you know change its reading in a new scene`(要件4.6 の予告)
       - `Reviews and your kanji trees keep growing`
     - 価格行: `` `${priceString} / month` ``(**金額をベタ書きしない**)
     - 自動更新の明示: `Renews automatically until cancelled. Cancel anytime in the App Store.`
     - ボタン: `Subscribe` / 実行中は `Purchasing…`
     - 復元: `Restore purchases` / 実行中は `Restoring…` / 何も無ければ `Nothing to restore.`
     - 失敗: `Purchase failed. Please try again.`(キャンセル時は**何も出さない**)
     - オファリング取得失敗: `Subscriptions are unavailable right now.`(Restore は押せるまま)
     - リンク: `Terms of Use` / `Privacy Policy`
     - 閉じる: `Not now`
7. **`src/app/paywall.tsx` を書く。**
   `fetchOfferings()` → `current.monthly ?? current.availablePackages[0] ?? null` を state に持つ
   (実測で `$rc_monthly` があるので `current.monthly` が本線)。
   購入は `purchasePackage()`、復元は `restorePurchases()`。成功したら
   `router.canGoBack() ? router.back() : router.replace('/')`。
   **エンタイトルメントの反映は待たない**(リスナーが Context を更新する)。
   `Terms of Use` / `Privacy Policy` は `WebBrowser.openBrowserAsync(url)`。
   URL 定数はこのファイル上部に置き、**Terms は Apple 標準 EULA
   (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`)**、
   Privacy Policy は確定するまで定数を1箇所にまとめ、release-checklist に項目を積む。
8. **`src/app/index.tsx`** で `useEntitlement()` を読み、
   `gateSentences()` の結果を `planTodaysLessons({ sentences: gated.unlocked, ... })` に渡す。
   `planTodaysReviews()` の呼び出しは**触らない**。
   `TodayView` に `lockedCount`(`status === 'unknown'` のときは 0)と
   paywall を開くコールバックを渡す。
9. **`today-view.tsx`** に解放の表示を足す。
   - `lockedCount > 0 && 今日ぶん完了` → カード形(`Unlock the next 3 chapters`)。
     このとき既存の「すべて終わった」文言は**出さない**(嘘になる)
   - `lockedCount > 0 && 未完了` → 末尾に控えめな1行(`Unlock all chapters`)
   - `lockedCount === 0` → 何も出さない
10. **`conversation/[id].tsx`** に保険のガード。
    文が取れていて `!isSentenceUnlocked(sentence, unlocked)` かつ `status !== 'unknown'` なら
    paywall へ差し替える(判定中は現状維持で待つ)。
11. **`src/app/paywall-debug.tsx` を削除**し、`docs/architecture.md` のルート一覧を更新する。
12. **`docs/release-checklist.md`** を更新(該当2項目にチェック、プライバシーポリシー URL を追加)。
13. **`docs/decisions/ADR-0008-free-tier-boundary.md` を書く。**
    背景に「`reencounters` の初出が #17 = 第2章であり、無料範囲に要件4.6 の演出が1つも無い」、
    決定に「MVP では要件7章の境界を動かさず、paywall のコピーで予告する」、
    結果に「転換率が paywall のコピー頼みになる。TestFlight の反応を見て再検討する」。
    あわせて `docs/requirements.md` 9章に
    `- [ ] 無料範囲の境界を見直すか(第1章に「読みが変わった」演出が無い → ADR-0008)` を追加。
14. `pnpm run check` を通す。

---

## 受け入れ条件

- [ ] **未購読で起動すると、Today のカードは第1章(#1〜#10)の回しか出ない。**
      第2章以降の回は、上限の枠が余っていても一覧に現れない
- [ ] **未購読で第1章10本すべてを学び終えると、Today に `Unlock` のカードが出る。**
      このとき「すべて終わった」の文言は出ない
- [ ] **未購読で第1章をまだ終えていなくても、Today の末尾から paywall を開ける**
      (再インストールした購読者が Restore に辿り着ける)
- [ ] **購読中は Today に `Unlock` の表示が一切出ない**
- [ ] **paywall にダッシュボードの価格が出る**(`$2.99 / month`)。
      コードに金額のリテラルが無い(`grep '2.99' src/` が空)
- [ ] **paywall に `Restore purchases`、`Terms of Use`、`Privacy Policy`、自動更新の一文がある**
- [ ] **Test Store で購入を完了すると、paywall を閉じた直後の Today に第2章の回が現れる**
      (アプリの再起動を要しない)
- [ ] **購入ダイアログをキャンセルしても、エラー文言が出ず paywall のままになる**
- [ ] **`learningkanjimobileapp://conversation/<第2章の会話文ID>` を未購読で開くと
      paywall に差し替わり、会話文の本文が1行も表示されない**
- [ ] **第2章の漢字を学んだあと未購読状態に戻しても、その字は復習キューに出続ける**
      (`planTodaysReviews` の結果が購読状態で変わらない)
- [ ] **`src/app/paywall-debug.tsx` が存在しない。**
      `learningkanjimobileapp://paywall-debug` を開くと unmatched route になる
- [ ] **エンタイトルメント判定中(`unknown`)に `Unlock` がちらつかない**
- [ ] **色のリテラルが新規ファイルに無い**(`#` 始まりの色・`rgba(` が無い。絶対規則1)
- [ ] **新規 UI 文言がすべて英語**(絶対規則7)
- [ ] **`access.ts` が `react-native-purchases` と `@/db` のどちらも import していない**
- [ ] **`src/features/srs/lessons.ts` と `scheduler.ts` に差分が無い**
- [ ] **`docs/decisions/ADR-0008-free-tier-boundary.md` が存在し、
      `docs/requirements.md` 9章から参照されている**
- [ ] `pnpm run check` が通る

---

## テスト方針

**ユニットテスト(`src/features/paywall/access.test.ts`)** — ここが主戦場。

- `isEntitled`: `active` に `premium` がある → true / 空 → false / `null` → false /
  **別の ID だけがある → false**(識別子のタイポで全解放される事故を止める)
- `isSentenceUnlocked`: `isFree: true` は未購読でも true / `isFree: false` は未購読で false /
  購読中は両方 true
- `gateSentences`: 未購読で第1章だけが残り `lockedCount` が残りの本数になる /
  購読中は全件・`lockedCount === 0` / **入力の並び順が保たれる** / 空配列で落ちない
- `gateSentences` の結果を `planTodaysLessons()` に食わせ、
  **未購読では第2章以降が結果に入らない**ことを1本だけ結合的に検証する
  (申し送りの「配列をフィルタする形で被せられる」が実際に成立していることの証明)

**`purchases.test.ts`(追記)** — `react-native-purchases` をモックして委譲を確認。
`getCustomerInfo` / `restorePurchases` / `purchasePackage` の戻り値がそのまま返ること、
`isUserCancelled` が `userCancelled: true` の例外だけ true を返すこと。

**テストを書かないもの**: `entitlement-context.tsx`、`paywall-view.tsx`、`src/app/` 配下。
ネイティブモジュールの応答に依存するため、モックで固めても実機の事実を保証しない。下記の手動確認で見る。

**手動確認(iOS シミュレータ / Test Store)** — 手順は `README.md`「iOSシミュレータで動かす」。

1. **未購読の状態を作る**: アプリを削除してから再インストールする
   (RevenueCat の匿名 App User ID が作り直され、Test Store の購入が付いていない状態になる)
2. 第1章を10本学ぶ(1日上限を無視する開発用スイッチで1日に通せる)→ 解放カードが出る
3. paywall で購入 → 戻ると第2章の回が出る → **#17 の「読みが変わった」演出まで到達する**
4. アプリを削除 → 再インストール → 第1章の途中で末尾のリンクから paywall →
   `Restore purchases` → 購読中の表示に戻る
5. 機内モードで起動し、購読中の表示が維持されること(SDK キャッシュ。要件6.1)
6. 未購読で `learningkanjimobileapp://conversation/<第2章のID>` を開く

**日付が絡む確認はしない。** 課金ゲートは日付に依存しない。

---

## リスク・未確定事項

- ~~エンタイトルメントの識別子が未確認~~ → **解消。`premium`(2026-09-03 に API で実測)。**
  本番商品と Test Store 商品の両方が `premium` に紐付いているので、
  本番キー差し替え時もコード変更は要らない
- **プライバシーポリシーの URL が無い。** Apple はサブスクの購入画面から
  プライバシーポリシーと利用規約(EULA)へ到達できることを求める。
  **リンクの UI は今回のスコープ、URL の中身は release-checklist のスコープ。**
  リンク先が 404 のまま提出すると審査で落ちる
- **Test Store は本番の StoreKit を通らない。** 実際の購入シート・サブスク管理・
  復元の挙動は、本番キー(`appl_...`)+ App Store Connect の登録後にしか確かめられない。
  今回の実機確認で分かるのは「アプリ側の状態遷移が正しいこと」まで
- **無料範囲が差別化を含まない**(冒頭の指摘2)。ゲート自体は要件どおりだが、
  転換率は paywall のコピー頼みになる。TestFlight の反応を見て、要件7章の境界を
  見直すかどうかは別途判断する(このプランでは動かさない)。
  **忘れないための受け皿は ADR-0008 と 9章の未決定事項**(実装ステップ13)
- **`unknown` → `unlocked` の遷移で、購読者の Today が「10本 → 58本の候補」に切り替わる。**
  実機では一瞬だが、遅い回線ではカードが増えるのが見える。
  ロック側に倒す方針(要件7章を守る)の代償として受け入れる
- **購読の期限切れは、アプリが前面にある間にリスナー経由で反映される。**
  バックグラウンドから復帰した瞬間の再取得は入れていない(SDK 側のキャッシュ更新に任せる)。
  切れた直後に第2章が数分開けたままになる可能性がある。MVP では許容する

---

## 実装後の記録

### レビューで直したこと(2026-09-03)

`reviewer` が「要修正」で返した3件。いずれも設計ではなく局所の欠陥だった。

1. **判定中(`unknown`)に「You've finished every conversation for now.」が出ていた。**
   `TodayView` の `lockedCount` に、判定中も 0 を渡していたのが原因。
   0 は「ロックが無い(= 購読中)」という**確定した事実**なので、判定中と同一視すると
   「未購読 × 無料ぶんを学び切った」人に、確定までの数百ms だけ嘘の文言が出る。
   `Unlock` のちらつきは潰したのに、逆側の非対称が残っていた。
   → `lockedCount?: number | 'unknown'` に変え、判定中は `allDone` の文言も出さない。
   **教訓: 「無い」と「まだ分からない」を同じ値で表さない。**

   あわせて `suppressAllDone` の根拠を `showUnlock` から `hasLocked` に分けた。
   `showUnlock` は `onUnlock !== undefined` を含むので、導線を渡さない呼び出し側では
   嘘の文言が復活する。**「導線を出せるか」と「全部終えたと言えるか」は別の問い。**
   `showUnlock` に戻さないこと。

2. **`configurePurchases()` の呼び出し順が、課金画面のコールドスタートで崩れていた。**
   `configure` を `EntitlementProvider` に置いたのは「子の effect が親より先に走る」ためだが、
   **`src/app/paywall.tsx` も同じ provider の子**。`learningkanjimobileapp://paywall` を
   コールドスタートで開くと `fetchOfferings()` のほうが先に走り、SDK が
   `UninitializedPurchasesError` で reject する。同期 throw ではないので `catch` に落ちて
   握り潰され、画面が「Subscriptions are unavailable right now.」のまま固まる。
   → `purchases.ts` の SDK 委譲4本すべての先頭で `configurePurchases()` を呼ぶ
   (冪等なので副作用なし)。**順序の前提を呼び出し側に配らず、1箇所に閉じた。**
   呼び出し順まで見る回帰テストを `purchases.test.ts` に追加した。

3. **`conversation-list.tsx` のコメントが事実と食い違っていた。**
   「ロック中の回も開けるほうが都合がよい」と書いたが、開発用一覧は
   `/conversation/[id]` に push するので、**未購読では第2〜4章の回はガードに当たって開けない**。
   → コメントを事実に直し、検品には Test Store の購入が要ることを明記した。

あわせて `isUserCancelled()` の不要な `as` を外した(コメントが「型ガードで絞る」と
言っているのに `as` が残っていた。TS は `'userCancelled' in error` で絞れる)。

### シミュレータでの確認結果(2026-09-03、iPhone 17 Pro / iOS 26.5)

**受け入れ条件17項目をすべて確認済み。** Test Store のシミュレート購入で通した。

| 条件 | 結果 |
|---|---|
| 1. 未購読で第1章の回しか出ない | ✓ 人/大/小 の3件のみ |
| 2. 無料分を学び切ると Unlock カード、「全部終えた」は出ない | ✓ カードのみ表示 |
| 3. 未完了でも末尾から paywall を開ける | ✓ `Unlock all chapters` |
| 4. 購読中は Unlock が出ない | ✓ 購入直後に消えた |
| 5. 価格はストア由来 | ✓ `USD 2.99 / month` |
| 6. Restore / 法務リンク / 自動更新の明示 | ✓ 4点とも表示 |
| 7. 購入直後に第2章が開く(再起動不要) | ✓ deep link で Conversation 11 が開いた |
| 8. キャンセルでエラー文言が出ない | ✓ 画面は無変化、`Subscribe` に復帰 |
| 9. ロック中の deep link が paywall に差し替わる | ✓ 本文は1行も出ない |
| 10. 学んだ字は復習に出続ける | ✓ 第1章完了後に `Reviews 10 due` |
| 11〜17 | ✓(機械的検証・レビュー済み) |

確認の手順で分かったこと。

- **未購読状態に戻すのはアンインストールで足りる。** Test Store は匿名IDに紐づくので、
  再インストールで新しいIDになり未購読に戻る。SQLite も一緒に消えるため学習履歴もリセットされる
- **受け入れ条件2 は `lesson_events` に完了記録を直接入れて確認した。**
  第1章10文を通しで学ぶには1日3字の上限で4日かかるため。
  `id` に `TESTFIXTURE` を前置してあるので、消すときは
  `delete from lesson_events where id like 'TESTFIXTURE%';`
- **`Ignore daily limit` トグルはタップでは動かず、`touch_path` のドラッグで動く。**
  `docs/log/2026-09.md` の 09-02 に既に書いてあった(`Switch` はドラッグのみ、
  `Pressable` は普通のタップで動く)。読まずに30分足踏みした。
  **上限を外しても未購読では第2章が1件も出ない**ことまで確認できたので、
  「日次上限で隠れているだけ」ではないことの証明になった(受け入れ条件1の補強)
- LogBox に `[RevenueCat] Purchase was cancelled` の赤バナーが出るが、これは SDK 自身の
  ログを開発ビルドの LogBox が拾っているもので、**アプリの UI ではない**(リリースビルドには出ない)

### 次に触る人へ

- **プライバシーポリシーの URL(`src/app/paywall.tsx` の `PRIVACY_URL`)は
  まだ公開されていない URL を指している。** 404 のまま提出すると審査で落ちる。
  `docs/release-checklist.md` に項目として積んである
- **第2章以降を実機で検品するには Test Store で購入しておくこと。**
  アンインストールで未購読に戻せる
