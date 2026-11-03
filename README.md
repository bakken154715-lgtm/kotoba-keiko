# ことば稽古

考えを言葉にする力を鍛える、自分用のiPhone向けWebアプリ(PWA)です。サーバーはなく、記録とAPIキーは端末の中だけに保存します。

## 練習モード

- 書いて答える: お題に文章で答えて、5つの観点で採点と添削を受ける
- 話して答える: 録音をAIで文字にして、話し方の指摘と一緒に採点する
- 瞬発力: 制限時間内に言葉をできるだけ出す
- 深掘り対話: AIの質問に答えてモヤモヤを掘り下げ、自分の言葉でまとめる

## PCで動かす

```bash
npm install
```

```bash
npm run dev
```

APIキーがなくても、設定で「見本の採点を使う」をオンにすると画面の流れを試せます。

```bash
npm test
```

```bash
npm run build
```

## iPhoneで使う

録音とホーム画面への追加にはHTTPSが必要なので、GitHub Pagesに公開します。

1. GitHubにリポジトリを作り、このフォルダの内容を `main` に送る
2. リポジトリの Settings > Pages で Source を「GitHub Actions」にする
3. 公開されたURLをiPhoneのSafariで開き、共有メニューの「ホーム画面に追加」を選ぶ
4. アプリの設定に [Google AI Studio](https://aistudio.google.com/apikey) で作ったAPIキーを入力する

## 注意

- Gemini APIの無料枠で送った文章と録音は、Googleの製品改善に使われます。機密や個人情報は書かないでください。
- 無料枠の回数上限は [AI Studioのレート制限ページ](https://aistudio.google.com/rate-limit) で確認できます。
- 記録はブラウザの中にあるので、設定の「記録を書き出す」でときどき控えを取ってください。
- APIキーをリポジトリに入れないでください。
