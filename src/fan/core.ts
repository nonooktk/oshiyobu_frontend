// ファン向けが core を使う入り口（1 か所）。画面の側で、core と同じ式を書かない。
// 【仮】本物の core（`src/core/`。共有の部品の担当が dev に入れる）が届くまでは、backend の origin/dev（1dff053）の
// `src/core/` を、リポジトリの外（`~/repos/_oshiyobu_core_1dff053/`。git archive で書き出した読み取り用）に置いたものを指す。
// 作業フォルダの中には、core の写しを置かない。dev に入ったら、下の 1 行を `export * from '../core';` に替える（`_stub/README.md`）。
export * from '../../../_oshiyobu_core_1dff053/src/core';
