# src/fan/_stub/（仮の置き場。本物が dev に入ったら消す）

ファン向けの作業が、共有の部品（F-0b）と core（B-1 → `src/core/`）の到着を待つあいだの、仮の置き場です。
消すときの手順は、このファイルの下にあります。コミットするのは、このファイルと `shared/` の仮実装だけです。

- core: 作業フォルダの中には置いていません。`src/fan/core.ts` が、backend の `origin/dev`（1dff053）の `src/core/` を `git archive` で書き出した
  リポジトリの外の場所（`~/repos/_oshiyobu_core_1dff053/`）を指します。本物の `src/core/` が dev に入ったら、`src/fan/core.ts` の 1 行を `'../core'` に替えます。
- `shared.ts`: レーン間の I/F（設計 D-35）の仮の実装。`useSharedMeter`・`joinPerformance`・`useEffectiveCondition`・`prefetch`・端末の番号。
  本物（`src/shared/`）が dev に入ったら、`src/fan/adapter.ts` の import だけを替えて、このファイルを消します。
