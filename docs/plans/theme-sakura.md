# プラン: theme-sakura

作成日: 2026-08-16
ステータス: 実装済み(背景画像の生成待ち)
要件定義書の対応箇所: 5.3(テーマ切り替え仕様)
決定の記録: `docs/decisions/ADR-0004-sakura-theme.md`

## Context

デザイン案（Claude Design プロジェクト「日本らしいテーマの比較設計」）の16案のうち、
**春 ／ 春泥棒** の配色・書体・装飾ロジックだけを採用する。他の案は保留。

これは新しいテーマを1つ足す話ではなく、要件定義書 5.3 が既に定義している**3テーマのうち「桜」の中身を確定させる**もの。
テーマID・表示名は要件どおり `sakura` / `Sakura` とし、「春泥棒」はデザイン案の出自としてADRに記録するだけに留める。

現状 `src/theme/` は**空**で、`docs/requirements.md` 404行目の
「テーマ3種の具体的なカラーコード ※デザイン依頼中」も未消化。
CLAUDE.md 絶対規則1「色をハードコードしない」を守るには、画面を書き始める前にトークン層が要る。
このプランでそのトークン層を桜の実配色で立ち上げ、実機で見た目を確認できる状態にする。
残り2枠（ノーマル / 東京の夜景）は保留として、型とドキュメントの上に拡張余地だけ残す。

### 前提条件（着手タイミング）

RevenueCat セットアップのセッションが**同じ作業ディレクトリで進行中**。
現在 `src/app/_layout.tsx`（本プランでも編集する）を含む未コミット差分がある。

**向こうがコミットし終わってから** `main` を更新し、`feat/theme-sakura` を切って着手する。
新規パッケージは足さないので `package.json` / `pnpm-lock.yaml` は触らない。

---

## デザイン仕様（取得済み）

```
bg #FBF4F4 / text #453B41 / sub rgba(69,59,65,.52) / accent #D2839C
bubbleA #FFFFFF / bubbleB #F6E7EC / card rgba(255,255,255,.72)
bubbleBorder rgba(210,131,156,.16) / cardBorder rgba(210,131,156,.2)
radius 19px / pillCta / bubbleShadow 0 2px 10px rgba(69,59,65,.05)
ja 'Shippori Mincho' 17.5px / line-height 2.05
focus: underline（accent色・weight600・2px下線）
装飾コンセプト: 花びらではなく「落下の軌跡」を描く / 上部に春空、下へ向かって白へ /
              一般的な桜テーマより彩度を一段落とす
```

`ios-frame.jsx` / `support.js` はデザインキャンバス側の iPhone モックとランタイムで、
アプリへ移植するものは含まれていない。

---

## 決定事項

| 論点 | 決定 | 理由 |
|---|---|---|
| テーマID | `sakura` / 表示名 `Sakura` | 要件定義書 5.3 の3テーマ構成に合わせる。デザイン案名「春泥棒」はADRにのみ残す |
| 明朝体 | **Hiragino Mincho ProN**（`HiraMinProN-W3` / `-W6`） | iOS内蔵。依存追加・フォント読込待ち・アプリサイズ増がゼロ。`package.json` を触らないので RevenueCat 作業と衝突しない。Shippori Mincho への差し替えは後から可能 |
| 背景装飾 | **画像生成AIで作る**（プロンプトを本プランで用意） | ユーザー指定。要件5.3「テーマごとの背景装飾は1〜2枚まで」の枠内、`assets/themes/sakura/` に置く |
| 英字 | System（SF） | デザインのモックでも英訳文は system-ui。UI文言は英語（絶対規則7）なので画面のほとんどが SF |
| `kunBranch` / `onBranch` | 桜に合わせて低彩度で新規に決める（下記） | デザイン案に定義が無いため。architecture.md が全テーマ必須キーとして要求している |

### トークンの形

architecture.md / CLAUDE.md が `theme.background` の形を明記しているので、**色はフラットに保つ**。
色以外（角丸・書体・影・装飾）だけをサブオブジェクトにする。

```ts
// src/theme/tokens.ts
export type ThemeId = 'sakura'; // 将来: | 'normal' | 'tokyoNight'

export interface Theme {
  id: ThemeId;
  name: string;          // UI表示は英語（絶対規則7）→ 'Sakura'
  dark: boolean;

  // ── 色（フラット）
  background: string;    // #FBF4F4
  surface: string;       // #FFFFFF     相手の吹き出し
  surfaceAlt: string;    // #F6E7EC     自分の吹き出し
  surfaceVeil: string;   // rgba(255,255,255,.72)  装飾を透かすカード
  text: string;          // #453B41
  textMuted: string;     // rgba(69,59,65,.52)
  accent: string;        // #D2839C
  onAccent: string;      // #FFFBF3     accent 面の上に載る文字
  border: string;        // rgba(210,131,156,.2)
  kunBranch: string;     // #7E9A6B     訓読み＝緑系（新規決定）
  onBranch: string;      // #7F9BBA     音読み＝青系（新規決定・装飾の春空 #C5D6E8 を一段濃く）

  // ── 色以外
  radius: { bubble: number; card: number; pill: number };   // 19 / 19 / 999
  type: {
    mincho: string;       // 'HiraMinProN-W3'
    minchoBold: string;   // 'HiraMinProN-W6'
    jaSize: number;       // 17.5
    jaLineHeight: number; // 36  (17.5 × 2.05 を pt 化)
  };
  shadow: { bubble: ViewStyle };   // iOS の shadowColor/Offset/Opacity/Radius に展開済み
  backdrop: { source: ImageSourcePropType; opacity: number } | null;
}
```

`kunBranch` / `onBranch` は私の提案値。枝の線・ラベル用（本文サイズでは使わない）。
シミュレータで見て気に入らなければトークン1行の差し替えで済む。

---

## 実装

### 新規ファイル

| ファイル | 内容 |
|---|---|
| `src/theme/tokens.ts` | `Theme` / `ThemeId` 型のみ |
| `src/theme/themes/sakura.ts` | 桜の実値 |
| `src/theme/themes/index.ts` | `themes: Record<ThemeId, Theme>` |
| `src/theme/theme-context.tsx` | `ThemeProvider` / `useTheme()`。Context のみ（切替UIは後続） |
| `src/theme/backdrop.tsx` | `<ThemeBackdrop />`。`theme.backdrop` が `null` なら何も描かない |
| `src/theme/theme-preview.tsx` | デザインのモック相当のプレビューUI。**本物の会話画面ができたら捨てる**前提 |
| `src/theme/themes.test.ts` | 全テーマが全キーを持つことの検証 |
| `src/components/furigana.tsx` | ふりがな表示（読みを上に小さく重ねる最小実装） |

### 背景装飾の扱い

画像はこれから生成するため、**今回は器だけ作って `backdrop: null` で起動する**。
`<ThemeBackdrop />` は `expo-image`（既存依存）で全画面に敷き、`pointerEvents="none"` で背面に置く。
画像ができたら `assets/themes/sakura/backdrop.png` を置いて `sakura.ts` の1行を差し替えるだけで有効になる。

### 既存ファイルの変更

- **`src/app/_layout.tsx`** — `ThemeProvider` で `Stack` を包み、その裏に `<ThemeBackdrop />` を敷く。
  `screenOptions` に `contentStyle: { backgroundColor: 'transparent' }` を足して装飾を全画面で透かす
  （要件5.3「全画面で同じ装飾を使い回す」）。
  **RevenueCat セッションが入れた `configurePurchases()` の `useEffect` はそのまま残す。**
- **`src/app/index.tsx`** — `<ThemePreview />` を置くだけにする（絶対規則: `src/app/` にロジックを置かない）

### プレビュー画面の中身

デザインのモックを RN に写す: ヘッダー＋話者3人の吹き出し（ふりがな＋英訳）＋
フォーカスカード（大きい「歩」・イラスト枠・熟語）＋ ピル形CTA。

**UI文言は英語**（絶対規則7）。ヘッダーは `Conversation 04 · A walk with Sora`、
CTA は `Practice writing this kanji`。日本語のままにするのは会話文・漢字・読みだけ。

### ドキュメント

- **`docs/テーマ背景プロンプト定義.md`（新規）** — 下記の背景装飾プロンプト一式。
  既存の `docs/画風プロンプト定義.md` と同じ書式（方向性の表 → ベースプロンプト → パレット → テスト生成 → 制作フロー）で書く
- `docs/requirements.md` 5.3 — 桜の実カラーコードを記載、残り2枠は保留と明記。404行目のチェックリストを部分消化に更新
- `docs/architecture.md` — トークン一覧を実際の形（`surfaceVeil` / `onAccent` / `radius` / `type` / `shadow` / `backdrop` 追加）に更新
- `docs/decisions/ADR-0004-sakura-theme.md` — 桜の中身を春泥棒案で確定した理由 / なぜ Hiragino Mincho か /
  なぜ装飾を生成画像にしたか / `kunBranch`・`onBranch` を独自に決めた経緯

---

## 背景装飾の生成プロンプト（`docs/テーマ背景プロンプト定義.md` の中身）

既存の画風プロンプト定義から **「純黒を使わない」「文字・漢字を明示的に排除する」** の2原則を引き継ぐ。
ただし漢字イラストとは用途が別物（主役ではなく地）なので、パレットもテスト基準も別に持つ。

### 満たすべき制約

| 制約 | 値 | 出典 |
|---|---|---|
| 枚数 | 1枚 | 要件5.3「桜=舞う花びらのパターン1枚」 |
| サイズ | 縦長 9:19.5（1179×2556 相当） | iPhone フルブリード |
| 濃度 | そのまま敷けるくらい淡く。濃く出たら実装側 opacity 0.15〜0.25 で調整 | 要件5.3「薄く敷く」 |
| 中央 | 主役を置かない・空ける | 会話文と漢字イラストが上に載るため |
| 最暗色 | charcoal `#453B41` 相当まで。純黒禁止 | 画風プロンプト定義 §3 |

### ベースプロンプト

```
A very pale, minimal vertical background image for a mobile app screen.

The top quarter holds a faint spring-sky wash in soft dusty blue (#C5D6E8), dissolving
into a warm off-white (#FBF4F4) by about 25% down. The remaining three quarters stay
almost empty warm off-white.

Across the canvas, three or four extremely thin near-vertical hairlines, tilted about
20 degrees from vertical, drawn in muted dusty rose (#D2839C) at very low opacity.
These are the falling paths of cherry petals — the trails, not the petals.

Five or six small cherry blossom petals, simple soft ellipses in the same muted dusty
rose, scattered sparsely near the left and right edges, never in the centre.

Overall impression: quiet, restrained, faded — the moment after the blossoms have
already fallen, not a cherry tree in full bloom. Extremely low contrast, no focal point,
large empty areas. Flat with a fine grain paper texture. Desaturated: one step less
saturated than a typical sakura theme.

--ar 9:19.5
--no text, letters, japanese characters, kanji, watermark, tree branches, tree trunk,
full cherry tree in bloom, dense petal storm, high saturation, strong contrast,
vignette, dark corners, borders, frames, centered subject, photorealistic, 3d render,
drop shadows, neon, pure black
```

Midjourney以外（DALL-E / Imagen 等）を使う場合、`--ar` は出力サイズ指定に、
`--no` 以降は「Do not include: ...」の自然文に置き換える。

### パレット（この背景専用）

| 役割 | 色 | HEX |
|---|---|---|
| 地 | warm off-white | `#FBF4F4` |
| 上部の空 | soft dusty blue | `#C5D6E8` |
| 花びら・軌跡 | muted dusty rose | `#D2839C` |
| 最暗色（使うとしても極薄） | charcoal | `#453B41` |

**純黒 `#000000` は使わない。** 4色以外を足さない — 色数が増えるほど上に載るテキストの視認性が落ちる。

### 合格ライン（生成物の検証）

生成しただけで採用しない。以下を実機で確認して初めて採用する。

1. **本文が読めるか** — `#453B41` の明朝17.5pt を背景の一番濃い箇所の上に置いて読めること。**これが本当の合格ライン**
2. **白い吹き出しが浮くか** — `#FFFFFF` の吹き出しと `#FBF4F4` の地が判別できること（差が小さいので潰れやすい）
3. **軌跡が残るか** — opacity を下げたときに斜めのヘアラインが最初に消えるので、消えたら生成をやり直す
4. **中央が空いているか** — 漢字イラストが載る画面中央に模様が来ていないこと
5. **スクロールしても破綻しないか** — 全画面固定で敷くため、どの画面でも同じ絵が見える

### 制作フロー

1. 上記プロンプトで3〜4枚生成し、並べて一番「静か」なものを選ぶ
2. 合格ライン5項目をシミュレータで確認
3. 濃すぎる場合は生成をやり直さず、まず `sakura.ts` の `backdrop.opacity` で調整する
4. `assets/themes/sakura/backdrop.png` として配置し、`sakura.ts` の `backdrop` を差し替える

---

## 検証

1. `pnpm run check`（typecheck + lint + test + content検証）が通ること
2. iOS シミュレータ MCP: `attach` → `build` → `launch` → スクリーンショット。
   デザインのモックと並べて、配色・角丸・行間・下線ハイライトを目視で突き合わせる
   （背景装飾は画像が来るまで無しの状態で確認）
3. `themes.test.ts` — `themes` の全エントリが `Theme` の全キーを持ち、空文字が無いこと
4. `reviewer` サブエージェントで差分をレビュー（CLAUDE.md 作業フロー5）

## プランからの変更点(レビュー指摘を受けて)

- **ふりがなとプレビューの置き場所を `src/features/reading/` にした。**
  プランでは `src/components/furigana.tsx` と `src/theme/theme-preview.tsx` としていたが、
  architecture.md の features 表が「ふりがな」を reading の担当と明記しており、
  CLAUDE.md のディレクトリ表も `src/theme/` を「トークン定義と Context」に限っているため
- **行の高さの計算を `furigana-metrics.ts` に切り出し、テストを添えた。**
  純粋ロジックにテストを添える規約(CLAUDE.md)の対象だったため。
  端末の文字サイズ倍率(`fontScale`)を行の高さに掛ける処理もここで入れた
  (掛けないと文字サイズを上げた端末でふりがなが切れる)
- **`StatusBar` を `ThemedShell` に足した。**
  `userInterfaceStyle: "automatic"` のため、端末をダークモードにすると
  明色の地の上にステータスバーが明色で描かれて読めなくなる
- **プレビューの会話文を『会話文集.md』32番の原稿どおりに差し替えた。**
  当初はデザインモックの創作台詞を入れていた。`src/content/` の外なので
  `validate:content` に引っかからず、原稿と信じてコピーされる危険があった

## 実機確認で見つけて直したもの

シミュレータ(iPhone 17 Pro / iOS 26.5)で確認し、2件のバグを直した。

- **画面の地が `#FBF4F4` ではなく `#F2F2F2` になっていた。**
  expo-router の既定テーマが背景に `rgb(242, 242, 242)` を持っており、
  これが `contentStyle: { backgroundColor: 'transparent' }` より下の層で
  不透明に塗られていた。expo-router が再エクスポートしている `ThemeProvider` に
  背景を透明にしたテーマを渡して解決。
  **背景装飾を敷いても同じ理由で隠れるところだったので、画像が来る前に見つかってよかった箇所。**
- **アバターが吹き出しではなく英訳の高さに揃っていた。**
  「吹き出し＋英訳」を1つの列にして行の下端に揃えていたため。
  吹き出しとアバターだけを行にし、英訳はその下に置く形に変えた。

確認できたこと:

- 配色は実測でトークンどおり(地 `#FBF4F4` / 吹き出し `#F6E7EC` / CTA `#D2839C`)
- Hiragino Mincho ProN が意図どおり明朝で出る。英字にも明朝がかかるが違和感はない
- ふりがなが本文の上に正しく載り、学習中の漢字の下線ハイライトも出る
- 端末をダークモードにしてもステータスバーの時刻が読める(`StatusBar` の対応が効いている)

## 明示的に今回やらないこと

- テーマ切替UI（テーマが1つしかないため）
- 残り2テーマ（ノーマル / 東京の夜景）の定義
- Shippori Mincho の同梱
- 背景画像そのものの生成（プロンプトを渡すところまで）
- 本物の会話画面・SRS・樹（`theme-preview.tsx` はその場つなぎ）
