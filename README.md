# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

> **注意: この README の「Get started」以降は `create-expo-app` の雛形のまま**で、
> このプロジェクトの実態と合っていない(パッケージマネージャは pnpm、画面は `app/` ではなく
> `src/app/`、`npm run reset-project` にいたってはこのリポジトリに存在しない)。
> 開発の入口は `CLAUDE.md` と `docs/README.md`。

---

## iOSシミュレータで動かす

**Android は対象外**(絶対規則12)。実機ではなくシミュレータで確認する。

### 1. Metro を起動する(初回だけ)

Debug ビルドは JS をここから取るので、**先に動いていないとアプリが白いまま**になる。

```bash
pnpm exec expo start --port 8081
```

**起動しっぱなしになるので別ターミナルで開く。** 既に動いているかは次で分かる。

```bash
curl -s http://localhost:8081/status
```

`packager-status:running` が返れば起動済み。立て直す必要はない。

### 2. ビルドしてシミュレータに入れる

**Claude に頼む場合**は MCP のシミュレータツールを `attach` → `build` → `launch` の順で使う。
`attach` を最初に呼ぶのは、ライブパネルを先に開いて**開発者が画面を見られる状態にしてから**
ビルドを始めるため。手順の詳細と、落ちたときの復旧は `CLAUDE.md`「コマンド」節。

**自分で動かす場合**は次の1行でよい(Metro の起動も込み)。

```bash
pnpm run ios
```

### 3. 任意の会話文・漢字を開く

入口画面は**1日3字**しか出さない(ADR-0003)ので、確認したい回に上から辿り着けないことがある。
直接開く手段が2つある。

- **開発用の会話文一覧**: `learningkanjimobileapp://conversations`(`__DEV__` ビルドのみ)
- **ディープリンク**: `learningkanjimobileapp://conversation/<会話文のULID>` /
  `learningkanjimobileapp://kanji/<漢字のULID>`。ULID は `src/content/index.ts` の `S` / `K` マップ

入口画面の `Ignore daily limit` トグル(開発ビルドのみ)を ON にすると、未完了の回が全件並ぶ。

### 4. 止める

止め忘れて困るのは Metro と `disclaimer` の2つだけ。シミュレータ自体は開いたままでよい。

```bash
lsof -ti :8081 | xargs kill          # Metro を止める(ターミナルにいるなら Ctrl+C)
xcrun simctl terminate booted com.asakiita.learningkanji   # アプリだけ終了
xcrun simctl shutdown booted         # シミュレータごと落とす
```

ライブパネルだけ閉じたいときは MCP ツールの `detach`。シミュレータもアプリも動き続ける。

**`attach` / `launch` が `disclaimer exited with code 143` で落ちたら、前のセッションの
残骸が残っている。**

```bash
ps aux | grep "Helpers/disclaimer" | grep -v grep
```

`log stream` を含む行があれば kill する。**MCP ツールの故障ではないので `simctl` 直叩きに
逃げないこと**(逃げるとライブパネルに何も映らず、開発者が画面を見られない)。
経緯は `docs/log/2026-08.md` の 08-30。

### 第2段階の演出を確認するとき

「読みが変わった」演出をする8回(#17 / #30 / #38 / #41 / #45 / #48 / #51 / #55)は、
**演出語が吹き出しの折り返し2行目に落ちていないか**を必ず実機で見る。
★はふりがなの上に絶対配置で出るため、2行目に来ると直上の行に重なる。
**これだけは機械で検証できない**(`docs/content-spec.md`「演出行の書き方」5)。

演出は同じ漢字につき1回しか出ない(絶対規則11)。もう一度見たいときはアプリを削除して
入れ直す(`xcrun simctl uninstall booted com.asakiita.learningkanji`)。

---

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
