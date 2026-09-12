> 種別: **stock** — App Store の掲載内容の現在値。差し替えたら上書きする

# App Store 掲載内容

**このファイルは提出済みの文面を持つ。** ASC に入れる前の下書きではなく、
**いま出ているもの / 次に出すもの**を書く。掲載文を変えたらここも変える。

Promotional Text だけは**審査なしで差し替えられる**ので、季節やキャンペーンで
動かしてよい。それ以外はバージョン提出と一緒でないと変えられない。

## 入れる場所と上限

| 欄 | 上限 | いまの値 |
|---|---|---|
| App Name | 30 | `Kanji Encounter` |
| Subtitle | 30 | 下記(26字) |
| Promotional Text | 170 | 下記(156字) |
| Keywords | 100 | 下記(86字) |
| Description | 4000 | 下記 |
| Support URL | — | https://asab0o.github.io/learning-kanji-mobile-app/support/ |
| Privacy Policy URL | — | https://asab0o.github.io/learning-kanji-mobile-app/privacy |

## Subtitle

```
Meet kanji in conversation
```

スクリーンショット1枚目の見出しと同じ語彙。アプリ名と続けて読むと何のアプリか分かる。

## Promotional Text

```
Chapter one is free: ten kanji, ten conversations. Meet a character inside a scene, review it the next day, and watch its reading change when it comes back.
```

## Keywords

```
japanese,jlpt,n5,furigana,hiragana,srs,spaced,review,vocabulary,reading,beginner,study
```

**`kanji` を入れていない。** アプリ名に入っており、Apple は名前・サブタイトル・キーワードを
別に索引するので、同じ語を重ねると枠が無駄になる。

## Description

```
Kanji Encounter teaches the first fifty kanji the way you actually meet them: inside a conversation.

Mia has just arrived at her host grandmother's house. Sora the cat is asleep in a basket. Every lesson is a short exchange between the three of them, and somewhere in it sits a character you have not met before — with furigana above it, an English line below, and romaji if you want it.

Then it comes back. Days later the same kanji turns up inside a different word, and its reading has changed. 日 becomes 日曜日. 時 and 間 become 時間. The app stops and shows you what just happened, because that moment is the one that makes kanji feel like meaning rather than shapes.

WHAT A DAY LOOKS LIKE
- Three new kanji, no more. Each arrives in its own conversation.
- Reviews return on their own schedule, spacing out as you get them right.
- A short guess after a lesson — can you read this? It never counts against you.
- Every character you have met grows a tree of the words it appears in.

FIFTY KANJI, FIFTY PICTURES
Each character has its own watercolour illustration, drawn for this app.

WHAT IS NOT HERE
- No account. Nothing to sign up for, nothing to remember.
- No ads, no tracking.
- No backend of ours. The only network traffic is the subscription check.

FREE AND PAID
Chapter one — ten kanji, ten conversations — is free. Chapters two to four unlock with Full Access.

SUBSCRIPTION
Full Access, USD 2.99 per month, auto-renewing until cancelled. Cancel anytime in the App Store.
Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://asab0o.github.io/learning-kanji-mobile-app/privacy
```

**サブスクの期間と価格を説明文に書くのはガイドライン 3.1.2 の要求。** 法務リンクは
課金画面(`src/app/paywall.tsx`)と同じ URL にしてある。片方だけ変えない。

## エレベーターピッチ(要件9章)

```
単語帳ではなく会話文の中で漢字に出会い、再会したときに読みが変わる瞬間を体験するアプリ
```

英語で言うとき:

```
A kanji app where you meet the character inside a conversation, then watch its reading change when it comes back.
```

## スクリーンショット

**1320 × 2868**(iPhone 6.9インチ)。これを入れておけば小さい端末には Apple が縮小して使う。
iPad は不要(`supportsTablet` を有効にしていないため)。

**並べる順。検索結果に出るのは最初の2〜3枚**なので、そこに差別化を置く。

| 順 | 画面 | 見出し |
|---|---|---|
| 1 | 会話文(#1) | Meet kanji inside a conversation |
| 2 | 種明かしカード(#17 の★をタップ) | Watch a reading change |
| 3 | 漢字フォーカス(小) | A picture for every kanji |
| 4 | 1字の樹(人) | Every kanji grows a tree of words |
| 5 | 推測クイズ(大雨) | Guess before you know |

**装飾版を選んだ**(2026-09-12)。素のスクショと2種類作って比べた結果で、理由は
**「読みが変わる」カードは見出しが無いと何のモーダルか分からない**こと。

### 作り直すときの条件

- シミュレータは **iPhone 17 Pro Max**(スクリーンショットがちょうど 1320 × 2868)
- **ステータスバー上端 190px を落とす。** ショットごとに時刻が違うため。
  App Store では一般的な処理で、落とすと締まる
- 背景は桜テーマのトークンから: 上 `#F6E7EC`(surfaceAlt)→ 下 `#FBF4F4`(background) の縦グラデ。
  文字 `#453B41`(text)、罫 `#D2839C`(accent)
- 見出しは Georgia 92px、2行、中央揃え。下に 120px の細い罫
- スクリーンショットは幅80%・角丸56px・影つきで、下端は画面外へ抜く
- **有料章の画面を撮るには課金状態が必要。** Test Store キーに一時差し替えして
  テスト購入する(`docs/release-checklist.md` の手順)。**進捗は `lesson_events` に
  直接 INSERT すると速い**(樹に葉を並べるのにタップで学習する必要はない)
