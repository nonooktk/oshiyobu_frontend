# oshiyobu_frontend

OSHIYOBU（推しを地元に呼ぶ仕組み）のデモ画面を作るリポジトリです。

> **デモ用です。** 画面に出す人数・金額・日程・人物は、すべてデモ用の架空のものです。会場の名前とキャパは、公開されている情報を使っています。

## 対になるリポジトリ

| リポジトリ | 中身 |
| --- | --- |
| **oshiyobu_frontend**（ここ） | 画面 |
| [oshiyobu_backend](https://github.com/nonooktk/oshiyobu_backend) | 計算・デモデータ・人物 15 通りのデータ・共有メーターの小さな API・そのテスト |

backend には、共有メーターの小さな API があります。預かるのは人数だけで、個人の情報は預かりません。画面は、backend の計算とデータを、版を固定して取り込みます。画面はサーバーにつながらなくても初期値で動く作りなので、API の応答の形を変えるときは、backend とセットで進めます。backend の中身は、このリポジトリでは変えません。

## はじめ方

- 初めて触る人は、[docs/はじめに.md](docs/はじめに.md) の手順に沿って、道具の導入から Claude Code の起動まで進めてください（Mac と Windows の両方に対応しています）。
- 作業の決まりは [CLAUDE.md](CLAUDE.md) にあります。Claude Code はこのファイルを自動で読みます。
- 本番に反映するまでの流れは [docs/デプロイ手順.md](docs/デプロイ手順.md) にあります。

## 今の状態

技術スタックは、設計の確定後に決めます。決まるまでは、アプリのコードも `package.json` もありません。アプリの起動コマンドは、決まりしだい [docs/はじめに.md](docs/はじめに.md) に追記します。

## 構成

```
.
├── CLAUDE.md                     作業の決まり（Claude Code が読む）
├── README.md                     このファイル
├── docs/
│   ├── はじめに.md               導入から初回の起動まで
│   ├── デプロイ手順.md           本番に反映するまでの流れと、戻し方
│   └── munderを使う場合.md       任意の付録
├── .claude/
│   ├── settings.json             Claude Code に許さない操作の設定
│   └── skills/
│       ├── start-task/           作業のはじめ方（/start-task）
│       └── pre-deploy-check/     PR を出す前・main に入れる前の確認（/pre-deploy-check）
└── .github/                      PR のひな形・レビュー担当・依存の更新設定
```
