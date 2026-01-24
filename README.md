# MyTask

GAS (Google Apps Script) + Google Sheets で動作する、完全無料・プライベートなカンバンタスク管理アプリケーションです。
既存のツールに満足できないエンジニアが、**「スプレッドシートをDBにする」** というアプローチで自作しました。

![Demo](https://dummy-image-url/demo.gif)
*(※ここにデモGIFなどを貼ると分かりやすいです)*

## Features

- **完全無料 & プライベート**: データは全てあなたの Google Drive (スプレッドシート) に保存されます。
- **カンバンボード**: ドラッグ＆ドロップでタスクを直感的に操作。
- **リッチテキスト同期**: 太字や文字色が、Webアプリとスプレッドシート間で双方向に完全同期。
- **Google Tasks 連携**: カレンダーのタスクを一括インポート。
- **モダンなUI**: Glassmorphism を取り入れた、GASとは思えないリッチなデザイン。

## Requirement

- Google アカウント
- Google Chrome (推奨)

## Installation

### 1. スプレッドシートの準備
1. 新規スプレッドシートを作成します。
2. デフォルトのシート名を `MasterData` に変更します。
3. A列に、アプリへのアクセスを許可するメールアドレスを入力します。
   - `A1: your-email@example.com`
4. スプレッドシートの ID (URLの `/d/` と `/edit` の間の文字列) を控えておきます。

### 2. GASプロジェクトの作成
1. Google Drive で「Google Apps Script」プロジェクトを新規作成します。
2. 以下のファイルをプロジェクトに追加・上書きします。
   - `Code.js` -> `Code.gs`
   - `index.html`
   - `appsscript.json` (プロジェクト設定からマニフェストファイルを表示して上書き)
   
   ※ `dist` フォルダ内のファイルを使用するか、`clasp` でプッシュしてください。

### 3. 設定ファイルの更新
1. `AppConfig.js.sample` を `AppConfig.js` にリネームします。
2. `SPREADSHEET_ID` を手順1で控えたIDに書き換えます。

```javascript
const CONFIG = {
    SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE', 
    // ...
```

### 4. デプロイ
1. GASエディタ右上の「デプロイ」→「新しいデプロイ」を選択。
2. 種類: 「ウェブアプリ」。
3. 次のユーザーとして実行: 「自分」。
4. アクセスできるユーザー: 「全員」または「自分のみ」。
5. 発行されたURLにアクセス！

## Development

開発者向けの手順です。

### Prerequisites
- Node.js
- clasp (`npm install -g @google/clasp`)

### Setup
```bash
# Clone repository
git clone https://github.com/your-username/MyTask.git
cd MyTask

# Login to Google
clasp login

# Create new GAS project (or clone existing)
clasp create --type webapp --title "MyTask"
# OR
clasp clone <scriptId>
```

### Deploy
```bash
# Push Code
clasp push

# Deploy
clasp deploy
```

## License

MIT License
