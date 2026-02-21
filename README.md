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
- **レイアウト調整**: カラム幅のドラッグリサイズや、表示・非表示のトグル機能。

## Requirement

- Google アカウント
- Google Chrome (推奨)

## Installation

### 1. スプレッドシートの準備
1. 新規スプレッドシートを作成します。
2. デフォルトのシート名を `AccessControl` に変更します。
3. A列に、アプリへのアクセスを許可するメールアドレスを入力します。
   - `A1: your-email@example.com`
   ![スプレッドシート作成](https://private-user-images.githubusercontent.com/1687923/552958867-49d54280-c5da-4fe5-b750-10b31bae4fec.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzE2MzYzNTQsIm5iZiI6MTc3MTYzNjA1NCwicGF0aCI6Ii8xNjg3OTIzLzU1Mjk1ODg2Ny00OWQ1NDI4MC1jNWRhLTRmZTUtYjc1MC0xMGIzMWJhZTRmZWMucG5nP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQVZDT0RZTFNBNTNQUUs0WkElMkYyMDI2MDIyMSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNjAyMjFUMDEwNzM0WiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9YWZmNTA3NTcyYmM1ODM5MWM1YWVlNmYyOWI3NTgzZTM0ZDMyZWQyNWI4NzlkZDg0NTFkOTdlODg1YjY1NWU5YSZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QifQ.BCKIHXQZWYg64s-rzW6UtUONJvsD0FSNeldY3s1-Esg)
4. スプレッドシートの ID (URLの `/d/` と `/edit` の間の文字列) を控えておきます。

> **Note**: `TaskList` シートはアプリの初回起動時に自動生成されます。

### 2. GASプロジェクトの作成
1. Google Drive で「Google Apps Script」プロジェクトを新規作成します。
2. 本リポジトリの `dist` フォルダ内にある以下のファイルをプロジェクトに追加・上書きします（`bundler.js` を実行することで生成されます）。
   - `Code.gs` (GASエディタ上の `コード.gs`)
   - `index.html`
3. プロジェクト設定から「appsscript.json マニフェストファイルをエディタで表示する」にチェックを入れ、`appsscript.json` の内容を上書きします。

※ 開発環境がある場合は `clasp` も利用可能です。

### 3. 設定ファイルの更新
1. ファイルを個別に登録した場合は、`AppConfig.js.sample` を `AppConfig.js` にリネームします。(※`Code.js`で直接書き込んだ場合は不要です)
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

## Development(claspによるデプロイ)

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
### Deploy (clasp)
```bash
# Push Code
clasp push

# Deploy
clasp deploy
```
## Development(GASエディタによるデプロイ)

### Prerequisites
- Node.js

### Build & Bundle

複数のソースファイルを1つの `Code.gs` と `index.html` にまとめます。

```bash
node bundler.js
```
生成された `dist/` 配下のファイルをGASエディタへ貼り付けてください。


## License

MIT License
