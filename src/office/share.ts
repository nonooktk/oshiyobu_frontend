// 見込み ÷ 登録の割合（docs/office/要件.md の M-01。仕様 9.2）。
// core の 2 つの値（demandOf の expected と、metricValues の reg）を割るだけの、表示のための計算。需要の数字は作らない

/** 「6.5%」の形（小数 1 桁で四捨五入、半角の %）。登録が 0 以下なら null（割合を出さない） */
export function shareOfReg(expected: number, reg: number): string | null {
  if (!(reg > 0)) return null;
  return `${(Math.round((expected * 1000) / reg) / 10).toFixed(1)}%`;
}

/**
 * ① の一覧のゲージの右の端（%）。割合は 5 組 × 9 市で 1.2〜18.2% なので、0〜100% だと伸びが見えない。
 * 右の端を 20% に固定する（docs/office/要件.md の N23-3）
 */
export const GAUGE_MAX_SHARE = 20;

/** ゲージの長さ（0〜100。目盛りの何 % まで伸ばすか）。20% を超える割合は、右の端（100）で止める。登録が 0 以下なら null */
export function gaugeOfShare(expected: number, reg: number): number | null {
  if (!(reg > 0)) return null;
  const share = (expected * 100) / reg;
  return Math.min(100, Math.max(0, (share / GAUGE_MAX_SHARE) * 100));
}
