# Git トポロジービューアー

[English](README.md)

必要な粒度でリポジトリの **コミット DAG** を確認するための VS Code 拡張機能です。ブランチとタグはコミットに付くラベルとして扱い、ビューアーがブランチ間の親子関係を作り出すことはありません。

## 機能

- 縦方向に表示する **トポロジー**、**コンパクト**、**すべて** の 3 モード。
- 線形のコミット範囲を個別に展開・折りたたみ。
- ローカルブランチとタグ、必要に応じたリモートブランチとブランチフィルター。
- マージベース、固有コミット、行統計、変更ファイルを含む参照比較。
- ブランチ、タグ、リモート参照をクリックしてコミット履歴を確認。コミットを展開するとファイル単位の追加・削除を確認できます。
- VS Code 標準の差分エディターで開く、読み取り専用のブランチ／コミット差分。チェックアウトは必要ありません。
- VS Code の Git 拡張、`gitTopology.gitPath`、`PATH` の順に Git CLI を検出。

## ビューアーを開く

Git リポジトリを含むフォルダーを開き、左側のアクティビティバーにある **Git トポロジー** アイコンから **Git トポロジービューアーを開く** を選びます。コマンドパレットの **Git トポロジー: ビューアーを開く** からも実行できます。

## ローカルで実行する

```powershell
npm install
npm run build
```

このフォルダーを VS Code で開き、**F5** を押します。Extension Development Host で Git リポジトリを開いた後、アクティビティバーの **Git トポロジー** アイコンを使います。

### Webview スモークテスト

固定バージョンの Chromium を一度インストールしてから、本番用 Webview バンドルをレンダリングし、参照比較を実行してスクリーンショットを保存します。

```powershell
npm run smoke:install
npm run smoke:webview
```

スクリーンショットは `artifacts/webview-smoke.png` に出力されます。環境、テストの自動検証、目視確認のチェックリスト、トラブルシューティングは `.agents/skills/git-topology-webview-smoke-test/` にあります。

## サンプル

![Git Topology Viewer のサンプル](docs/images/webview-smoke.png)

![コミット履歴と変更ファイル](docs/images/smoke-branch-log.png)

## 設計

拡張機能は、最初に `git for-each-ref` と `git rev-list` を使って SHA、親コミット、参照の要約を読み込みます。不変の DAG をモード別のビューグラフに変換してレイアウトします。比較結果とファイル内容は、必要になったときだけ Git CLI から読み込みます。
