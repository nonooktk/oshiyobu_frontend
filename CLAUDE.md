# CLAUDE.md（oshiyobu_frontend）

OSHIYOBU（推しを地元に呼ぶ仕組みのデモ）の、**画面**のリポジトリです。対になるリポジトリは [oshiyobu_backend](https://github.com/nonooktk/oshiyobu_backend)（計算・デモデータ・人物 15 通りのデータ・共有メーターの小さな API・そのテスト）です。

このファイルは短く保ちます。手順の詳細は `docs/` にあります。

## 1. 基本

- すべて日本語で書き、日本語で答える。コマンドは、コピペでそのまま動く形で示す。
- **計画 → 承認 → 実装** の順で進める。何を・なぜ・どう変えるかを日本語で書き出し、担当者の「OK」「進めてください」「Aで」「同意です」が出るまで、ファイルを変えない。
- 作業の始めは `/start-task`、PR を出す前と main に入れる前は `/pre-deploy-check`、「検収して」と言われたら `/accept`（手順は「8. 検収のしかた」）を使う。
- 困ったら、止まって聞く。推測で進めない。エラーは、**全文**を省略せずに貼る。

## 2. 触ってよい範囲

- このリポジトリの中だけ。ほかのフォルダやリポジトリのファイルを、頼まれずに読んだり書いたりしない。
- **backend の計算・データ・API は変えない。** 変えたいときは、変えずに止まって、担当者に backend への依頼を勧める。API の応答の形を変えるときは、backend とセットで進める（画面はサーバーにつながらなくても初期値で動く作りにする）。
- `.github/` と `.claude/settings.json` は、頼まれたときだけ直す。
- 例外: 検収のために、backend を OS の一時フォルダに取得して手元で起動する作業は、`npm run accept -- --local-api`（と `npm run api:local`）が行う。backend を自分で clone したり、中を読んだり、変えたりしない。

## 3. git の決まり

- **main に直接入れない。** 作業はブランチで行い、PR を出す。
- 強制 push をしない。`git reset --hard`・`git checkout -f`・`git clean` を使わない。
- commit の前に、対象ファイルの一覧を担当者に見せて、確認を取る。`git add -A` と `git add .` は使わず、ファイルを指定して足す。
- push の前にも、確認を取る。push するのは作業ブランチだけ（`git push -u origin <ブランチ名>`）。
- これらの操作は `.claude/settings.json` で拒否している。拒否されたら、迂回せずに、担当者に伝えて止まる。

## 4. デプロイ

デプロイは、次の順に進める。順番を飛ばさない。

1. ローカルで確認する
2. PR を出す
3. CI が緑になる
4. プレビューで確認する
5. 承認を得る
6. main に入れる（承認者が GitHub の画面で行う）
7. 自動で反映される
8. 反映後に確認する

- **`az`・`swa` などで、手元から直接デプロイしない。** `gh pr merge` も使わない。
- 各段の担当と、出るものは `docs/デプロイ手順.md`。デプロイ先の具体は、設計の確定後に追記される。

## 5. 秘匿値

- `.env` と `*.env` は、読まない・コミットしない・内容を文章に書き写さない。
- トークン・鍵・パスワード・個人のメールアドレスを、コード・画像・PR・ログに書かない。
- `.env` の値を編集するのは統括だけ。キー名を足したいときは、統括に依頼する（値は渡さない）。

## 6. 画面の決まり

- **全画面に、札を 2 枚出す: 「動作確認用のデモ画面です」と「デモ用の架空データ」。** どちらも消さない。画面を足したら、同じ表示（`DemoBadge`）を足す。
- 次の語は、画面の文言に使わない: **「新しい口座を開く」「口座開設」「確約」**。口座に触れる言い方は、「今の口座に推しを登録する」「推し活定期」にする。
- 画面に出す人数・金額・日程・人物は、**すべてデモ用の架空のもの**。会場の名前とキャパは、公開されている情報を使っている。
- 実在の個人を示す情報を、足さない。会場は、公開情報の範囲だけを使う。

## 7. 技術スタック

Vite 8・React 19・TypeScript（strict）の静的サイト（3 ページ: `/` 事務所向け・`/fan/` ファン向け・`/presenter/` 発表者用）です。状態は Zustand、見た目は CSS Modules と `src/styles/tokens.css`、テストは Vitest・Testing Library（実ブラウザの試験は任意の Playwright）、lint は ESLint・整形は Prettier、Node は 22 LTS の 22.22.2 以降（24 LTS の 24.15.0 以降と 26 以降でも動く）です。

- 計算とデータは、backend の core の写し（`src/core/`）です。**手で直しません**（backend で直し、`npm run core:sync` で置きます。置くのは統括かコーディネーター）。
- 起動・テスト・ビルドのコマンドは `docs/はじめに.md` の C 節にあります。PR を出す前に、`npm ci` のあと `npm run verify`（CI と同じ検査を順に回す命令。中身は「8. 検収のしかた」）が通ることを確かめます。
- `src/` のフォルダごとの持ち主と決まりは `src/README.md` にあります。依存は、増やす前に必要性・出所・ライセンス・既知の脆弱性を確かめます（ランタイムの依存は `react`・`react-dom`・`zustand` の 3 つ）。

## 8. 検収のしかた

「検収して」と言われたら、`/accept`（`.claude/skills/accept/SKILL.md`）を使い、この節の手順で進める。確かめるのは次の 2 つ。

1. 手元で回す検査（CI と同じもの）が、すべて通る。
2. 画面が API（backend）と実際に通信できている。

出力の読み方、命令ごとの指定、落ちたときの詳しい表は `docs/検収.md` にある。

### 8.1 前提

- Node は `.nvmrc`（22）と `package.json` の `engines`（22.22.2 以降の 22 系・24.15.0 以降の 24 系・26 以降）に合わせる。範囲の外でも動くことはあるが、`npm run verify` が「注意」を出す。結果が CI（Node 22）と同じになるとは限らない。範囲の外で何か落ちたら、まず Node を入れ替える（Node 20 では、TypeScript のファイルを読むスクリプトも、テストの実行も動かない）。
- 最初に `npm ci` を実行する。実ブラウザで確かめる命令（`check:live`・`accept`）には、手元の Google Chrome が要る。
- bash も Python も要らない。命令は Mac も Windows も同じ。

### 8.2 命令

| 命令 | 確かめること |
| --- | --- |
| `npm run verify` | lint・型・整形・テスト・ビルド・`check:budget --strict-images`・`check:csp`・`core:check`。CI や配備で回る検査と同じ（CI もこの命令を呼ぶ） |
| `npm run check:api` | API の `/healthz`（`coreVersion` が `core.lock.json` と一致するか）・メーターの形・404・CORS・応答の時間。`-- --write` を付けたときだけ、試験用の公演に申し込みを送り、冪等性と人数の増え方も確かめる |
| `npm run check:live` | 実ブラウザ（Chrome）で `/`・`/fan/?p=4`・`/presenter/` を開き、エラー 0・失敗した通信 0・札 2 枚あり、を確かめる。**既定（ひとり体験）**: `/fan/` は API への通信が 0 件。`/presenter/` の「接続を確認する」を押すと、`/healthz` が 200 で返り、CORS で許され、画面に応答の時間が出る（CSP と CORS を通って、ブラウザから API に届いた証拠。リセットは押さない）。**`-- --shared`**（共有メーターでビルドした画面）: `/fan/` からのメーター取得が 200 で返る |
| `npm run api:local` | 手元で API を立てる（`core.lock.json` で固定した版の backend。`Ctrl + C` で止める） |
| `npm run accept` | `verify` → `check:api` → `check:live` → ひとり体験の通し（`npm run e2e:solo`。実ブラウザで、はじめの画面 → 申し込む → 80% → 仲間を呼ぶ → 成立。20 秒ほど）を順に回し、最後に項目ごとの表を出す。**検収の入口**。`-- --skip-solo` で通しを飛ばせる（その項目は「飛ばした」になり、未完了） |

### 8.3 API の接続先の渡し方

- **手元だけで閉じる（標準）**: `npm run accept -- --local-api`。手元で API を立て（初回は 1〜2 分かかる）、画面をつなぎ、申し込みの動きまで確かめる。終わると自動で止まる。
- **ファン向けは、既定では「ひとり体験」**（人数を端末の中だけで数え、API を呼ばない。`VITE_API_BASE` があっても同じ。発表者用の「接続を確認する」とリセットだけが API を使う）。**共有メーター（全員の申し込みを API で集める形。ビルド時に `VITE_SHARED_METER=on`）に戻した画面を検収するときだけ、`--shared` を付ける**（`npm run accept -- --local-api --shared`。公開中の画面なら `npm run accept -- --shared`）。`--shared` では、手元の画面を `VITE_SHARED_METER=on` でビルドし、`/fan/` からのメーター取得を確かめる。ひとり体験の通しは、共有メーターの画面には当てはまらないので回さない。
- **公開中の API・画面**: 値は管理者に聞く。API の接続先は GitHub の Variable `VITE_API_BASE` と同じ値、画面の URL は Secret `SWA_BASE_URL` と同じ値になる。これらを環境変数に入れて `npm run accept` を回す。

  Mac:

  ```
  export VITE_API_BASE="<API の接続先>"
  export SWA_BASE_URL="<画面の URL>"
  npm run accept
  unset VITE_API_BASE SWA_BASE_URL
  ```

  Windows（PowerShell）:

  ```
  $env:VITE_API_BASE = "<API の接続先>"
  $env:SWA_BASE_URL = "<画面の URL>"
  npm run accept
  Remove-Item Env:VITE_API_BASE, Env:SWA_BASE_URL
  ```

- 値は環境変数にだけ入れ、命令の引数では渡さない（npm が命令を出力に表示するため）。**画面の公開 URL は秘匿**なので、文書・PR・commit・ログ・チャットへの貼り付けに書かない。出力では `<SWA>`・`<API>` に伏せてある。
- API の接続先を渡さないと、通信の確認は「飛ばした」になり、判定は「未完了」になる。**未完了を「合格」と報告しない。**
- 公開中の API に `--write` を付けてよいのは、管理者が指示したときだけ。

### 8.4 結果の読み方

- 表の結果は、合格・不合格・飛ばした・注意のどれかになる。「注意」は合否に数えない知らせ。
- 最後の「判定」と終了コード: 0 = すべて合格、1 = 不合格あり、2 = 不合格はないが「飛ばした」がある。
- 不合格があると、表の下に「次に見る場所」と、落ちた検査の出力の末尾が出る。
- 出力の例（`npm run accept -- --local-api` が全部通ったときの最後の行）:

  ```
  判定: 合格（合格 25・不合格 0・飛ばした 0・注意 0）
  ```

  API の接続先を渡さずに `npm run accept` を回したときの最後の行は、`判定: 未完了 — 飛ばした項目があるため、合格ではありません（合格 10・不合格 0・飛ばした 2・注意 0）`（終了コード 2）。

### 8.5 落ちたときの見分け方

| 落ちたもの | 原因 | 直す所 |
| --- | --- | --- |
| `core:check`・テストの `core-lock` | `src/core/` を手で変えた | 変えた所を戻す（戻す前に担当者に確かめる）。必要な変更は管理者へ |
| テストの `fonts` | 画面に新しい字を足した（書体の字の漏れ） | `docs/フォント.md` の「5.」。絞り直しには Python と元のフォントが要る。無ければ、漏れた字の一覧を添えて管理者へ |
| テストの `type-scale` | `font-size` に px を直接書いた | `src/styles/tokens.css` の段のトークン（`--fs-*`）を使う |
| テストの `forbidden-words`・`demo-badge` | 使わない語を書いた／札（2 枚のどちらか）を消した | 「6. 画面の決まり」に合わせる |
| `check:budget` | 絵が WebP でない／最初に読む量が上限を超えた | `npm run images` を回す。依存や大きなコードを足していないか見る |
| `check:csp` | 外部の読み込み・外部への通信を足した | 足したものを外す |
| `lint`・`typecheck`・`format:check` | 書き方・型・整形の違反 | 出力の最初のエラーから直す。整形は `npm run format` で直せる |
| `check:api` の `/healthz`（接続できない） | 接続先の値が違う／API が止まっている | 管理者に値を確かめる |
| `check:api` の `coreVersion` の不一致 | backend が先に進んだ（または lock が古い） | 自分で `core:sync` しない。管理者へ |
| `check:api` の CORS | 画面の接続元が、API の許可と合っていない | 管理者へ（手元の API なら `--local-api` でやり直す） |
| `check:live` のコンソールのエラー・失敗した通信 | エラーの文言で見分ける。CSP の違反なら外部の読み込み、CORS なら接続元、404 なら存在しないファイルが原因 | CSP の違反と 404 は、担当者が外部の読み込みや参照を直す。CORS は管理者へ |
| `check:live` の「`/fan/` は API への通信が 0 件」 | ひとり体験（既定）のはずが、ファン向けが API を呼んでいる。`VITE_SHARED_METER=on` がビルドに入っている／`src/shared/meter/config.ts` を変えた | 環境変数・GitHub の Variable を確かめる。共有メーターで動かす意図なら `--shared` で確かめる（意図がなければ、管理者へ） |
| `check:live` の「`/presenter/` の接続を確認する」 | `/healthz` が 200 で返らない／CORS で許されない／画面に応答の時間が出ない。`VITE_API_BASE` がビルドに入っていない、API が止まっている、接続元が違う、のどれか | 接続先の値と API は管理者に確かめる。画面の文言を変えたなら、`scripts/check-live.mjs` の読み取りも合わせる |
| `check:live` の「札が 2 枚ある」（各ページ） | `DemoBadge` を消した・文言を変えた | 「6. 画面の決まり」のとおりに戻す |
| `accept` の「ひとり体験の通し」 | はじめの画面 → 申し込む → 80% → 仲間を呼ぶ → 成立、のどこかが落ちている。ファン向けの画面・文言の変更が原因のことが多い | 出力の末尾の落ちた手順と、画面写真（`test-results/solo`）を見る。`e2e-solo/solo.spec.ts` の期待値は勝手に変えない |
| `accept` の「ひとり体験の通し」が「飛ばした」 | e2e:solo が使うポート（5297・8798）が使用中 | 使っているものを確かめる（自分が起動したものだけを止める）。または `--skip-solo` |
| `check:live --shared` の「メーターの取得」 | 取得の通信が出ない／200 で返らない／CORS で許可されない。多くは、`VITE_API_BASE` がビルドに入っていない、`check:csp` が落ちている、API が止まっている、接続元が違う、のどれか | `check:csp` を先に直す。API と接続元は管理者に確かめる |
| `check:live` の「ブラウザの起動」 | Chrome が入っていない | Google Chrome を入れる |
| 「Node の版」の注意 | Node が範囲の外にある | Node を入れ替えてから、やり直す |

### 8.6 直してよい所と、管理者に頼む所

- **担当者が直してよい**: 画面のコード・文言・CSS・絵（`src/`。ただし `src/core/` は除く）、新しいテスト、文書。既存テストの検査内容（期待値・入力・skip など）は勝手に変えない。変えたくなったら、変更せずに手を止め、理由を添えて担当者に伝える（担当者が管理者に相談する）。
- **管理者（統括）に頼む**: API（backend）と計算、`src/core/` と `core.lock.json`、GitHub の Secrets・Variables（API の接続先・画面の URL を含む）、配備の起動、合言葉、CORS の設定、`.github/`・`.claude/settings.json`、main へのマージ。

### 8.7 この作りはデモ用に限る

- API の接続先は、公開される JS と配信の設定（CSP の `connect-src`）に入るため、秘密にならない。
- 申し込みは、ブラウザが作る端末の番号だけで数えている。ログインも本人確認もないので、番号を作り直せば人数を増やせる。
- 本番（実際の金銭や個人を扱う使い方）に使うなら、認証・不正対策・上限・個人情報の扱いを作り直す。検収に合格しても、これらは保証されない。

### 8.8 サーバーを止めるとき・PR の前に

- 手元でサーバーを起動したら、止めるのは**自分が起動したプロセスだけ**にして、PID を指定して止める（Mac: `kill <PID>`、PowerShell: `Stop-Process -Id <PID>`）。`pkill`・`killall`・ポート番号だけを指定した一括の停止は使わない。ほかの人のサーバーを止めないため。`accept` と `check:live` は、起動したサーバーを自分で止める。
- PR を出す前に、`npm run verify` を通す。API を使う変更（`src/shared/meter/` など）は、`npm run accept -- --local-api` も通す。

## 9. 参照

| 知りたいこと | 見るもの |
| --- | --- |
| 導入から初回の起動まで（Mac・Windows） | `docs/はじめに.md` |
| 検収（`verify`・`check:api`・`check:live`・`accept`）の出力の読み方・落ちたときの表 | `docs/検収.md` |
| 本番に反映するまでの流れと、戻し方 | `docs/デプロイ手順.md` |
| 書体と文字の大きさの決まり・字を足したときの手順 | `docs/フォント.md` |
| 作業のはじめ方 | `.claude/skills/start-task/SKILL.md` |
| PR を出す前・main に入れる前の確認 | `.claude/skills/pre-deploy-check/SKILL.md` |
| 検収の進め方 | `.claude/skills/accept/SKILL.md` |
| 複数のエージェントを画面で見る道具（任意） | `docs/munderを使う場合.md` |
