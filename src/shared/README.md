# src/shared/

3 ページ（事務所向け・ファン向け・発表者用）で共有する部分です。持ち主は F-0 の担当で、F-2 の担当へ引き継ぎます（常に 1 人。設計 D-35）。

## 今あるもの

- `mount.tsx`: ページの入り口の共通処理（`mountPage(App)`）。3 ページに共通で要ること（ルートの受け皿 `ErrorBoundary` など）は、各ページの `main.tsx` ではなく、ここに足す
- `components/DemoBadge.tsx`: 札「デモ用の架空データ」

## F-0b が作るもの（レーン間の I/F。設計 D-35・型で固定する）

| ファイル（予定） | 内容 | 使う人 |
| --- | --- | --- |
| `link.ts` | 同じ端末の連動（`publishOffice()`・`useLinkedOffice()`・`onResetAll()`） | F-1・F-2 |
| 条件の導出 | `useEffectiveCondition()`（連動で届いた選択から、いま出す条件を導く） | F-2 |
| 共有メーター | `useSharedMeter(performanceId)`・`joinPerformance(performanceId)`・取得の契機 `requestMeterFetch(reason)` | F-2 |
| `prefetch.ts` | `startPrefetch`・`needImage`・`imageState`・`loadChunk`・`ChunkBoundary` | F-2 |
| ルートの受け皿 | `ErrorBoundary`（`mount.tsx` に置く） | 全ページ |
| 端末の番号と人物 | 端末の番号・人物 15 通りの決め方 | F-2 |

関数の形と規則は、設計.md の D-35（I/F の表）・D-18（共有メーター）・D-40（先読み）・D-44（連動）にあります。
