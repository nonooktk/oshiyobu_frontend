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

画面の骨組み（F-0a）ができています。3 つのページ（事務所向け `/`・ファン向け `/fan/`・発表者用 `/presenter/`）が、見出しと札「デモ用の架空データ」だけの枠で開きます。計算・共有メーターとの連携・画面の中身は、これから作ります。

技術スタックは、Vite・React・TypeScript の静的サイトです（設計 D-01）。

## アプリの起動・テスト・ビルド

Node.js が要ります（22 LTS の 22.22.2 以降。24 LTS の 24.15.0 以降と 26 以降でも動きます）。詳しい導入は [docs/はじめに.md](docs/はじめに.md) の「C. アプリの起動・テスト・ビルド」にあります。

| やること | コマンド |
| --- | --- |
| 依存パッケージのインストール | `npm ci` |
| アプリの起動（ローカル） | `npm run dev`（<http://localhost:5173/> を開く。ファン向けは `/fan/`、発表者用は `/presenter/`） |
| テスト | `npm test` |
| lint | `npm run lint` |
| 型チェック | `npm run typecheck` |
| ビルド | `npm run build`（出力は `dist/`） |
| ビルドの確認 | `npm run preview`（ビルドした `dist/` を <http://localhost:4173/> で開く） |
| 整形 | `npm run format`（確認だけは `npm run format:check`） |
| 絵の変換 | `npm run images`（元絵 `assets-src/` → `src/assets/img/` の WebP） |
| 量・CSP の検査（ビルドのあと） | `npm run check:budget`・`npm run check:csp` |
| 実ブラウザの試験（任意） | `npm run e2e`（手元の Chrome なら `E2E_CHANNEL=chrome npm run e2e`） |

PR を出す前に、`npm ci`・`npm run lint`・`npm run typecheck`・`npm test`・`npm run build`・`npm run check:budget`・`npm run check:csp` が、エラーなしで通ることを確かめてください。

## 構成

```
.
├── CLAUDE.md                     作業の決まり（Claude Code が読む）
├── README.md                     このファイル
├── index.html                    事務所向け（/）の HTML
├── fan/index.html                ファン向け（/fan/）の HTML
├── presenter/index.html          発表者用（/presenter/）の HTML
├── src/                          画面のコード。フォルダごとの持ち主と決まりは src/README.md
├── tests/                        テスト（unit は検査・integration は画面を描くテスト）
├── public/                       そのまま配る設定（staticwebapp.config.json）
├── assets-src/                   絵の元絵（配信しない）
├── e2e/                          実ブラウザの試験（Playwright。任意）
├── scripts/                      core:sync・core:check・絵の変換・量と CSP の検査・配備後の確認
├── docs/
│   ├── はじめに.md               導入から初回の起動まで
│   ├── デプロイ手順.md           本番に反映するまでの流れと、戻し方
│   └── munderを使う場合.md       任意の付録
├── .claude/
│   ├── settings.json             Claude Code に許さない操作の設定
│   └── skills/
│       ├── start-task/           作業のはじめ方（/start-task）
│       └── pre-deploy-check/     PR を出す前・main に入れる前の確認（/pre-deploy-check）
└── .github/                      PR のひな形・レビュー担当・依存の更新設定・CI（workflows/ci.yml）
```
