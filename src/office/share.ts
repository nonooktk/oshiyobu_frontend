// 見込み ÷ 登録の割合（docs/office/要件.md の M-01。仕様 9.2）。
// core の 2 つの値（demandOf の expected と、metricValues の reg）を割るだけの、表示のための計算。需要の数字は作らない

/** 「6.5%」の形（小数 1 桁で四捨五入、半角の %）。登録が 0 以下なら null（割合を出さない） */
export function shareOfReg(expected: number, reg: number): string | null {
  if (!(reg > 0)) return null;
  return `${(Math.round((expected * 1000) / reg) / 10).toFixed(1)}%`;
}
