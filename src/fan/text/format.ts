// 数字・金額の書き方（画面の言葉。計算ではない）。
export const yen = (n: number): string => `${n.toLocaleString('ja-JP')}円`;
/** 1 万円単位の短い書き方（預金のゲージの目盛り）。 */
export const manYen = (n: number): string => `${(n / 10000).toLocaleString('ja-JP')}万円`;

/** 折り返さずにひとまとまりで見せたい語（例: 「74人 → 75人」）。 */
export type Seg = string | { nw: string };
