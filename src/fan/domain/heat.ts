// 開催熱量（ファン向けの見せ方。統括の決定）。人数の割合 p（支援者 ÷ 最低人数）を、数字を出さずに、
// 「ゲージの長さ・段階の名前・距離のことば」へ変える。画面に出すのは、ここが返すものだけ。
// ひとり体験（既定）は、「FEVER 目前」・ゲージ 8 割付近のまま動かさない（soloHeatOf。統括の決定 2026-11-16）。
// 共有メーターあり（VITE_SHARED_METER=on）は、これまでどおり、人数の割合から決める（heatOf）。どちらも、境目・曲線・名前は、このファイル 1 か所。
// 人数・最低人数・残りの人数・達成率・金額は、ファン向けの画面に出さない（G-08）。
// 計算の元は core の supportStatus（人数と金額の判定。ここでは変えない）。曲線の式・境目・名前は、このファイル 1 か所。
import type { SupportStatus } from '../../core';

/** ゲージの長さ ＝ p の 2 乗。正比例にしない（終わりに近いほど速く伸びる。統括が、モックの「中間」を選んだ）。 */
export const HEAT_EXPONENT = 2;
/** 段階 2・3・4 に上がる境目（p）。段階 5（FEVER）は、人数と金額がそろった（成立した）とき。 */
export const STAGE_BOUNDS = [0.5, 0.7, 0.8] as const;

export type HeatStage = 1 | 2 | 3 | 4 | 5;

/** 段階の名前（統括が案 A を選んだ）。 */
export const STAGE_NAMES: Record<HeatStage, string> = {
  1: '点火',
  2: 'あたたまってきた',
  3: 'ヒートアップ',
  4: 'FEVER 目前',
  5: 'FEVER',
};

/** 距離のことば（段階ごとに 1 つ。案 A）。 */
export const DISTANCE_WORDS: Record<HeatStage, string> = {
  1: 'はじまったところ',
  2: 'だんだん近づいてきた',
  3: 'もう少し',
  4: 'あと一歩',
  5: '開催が決まりました',
};

export interface Heat {
  readonly stage: HeatStage;
  /** 段階の名前（「点火」〜「FEVER」）。 */
  readonly name: string;
  /** 距離のことば。 */
  readonly distance: string;
  /** ゲージの長さ（0〜1）。FEVER のときだけ 1。 */
  readonly fill: number;
  /** 次の段階の位置（ゲージの中の星。0〜1）。FEVER では無い。 */
  readonly next: number | null;
}

/** p から曲線を通した、ゲージの長さ（0〜1。p は 1 を上限にする）。 */
export const gaugeOf = (p: number): number => Math.min(1, Math.max(0, p)) ** HEAT_EXPONENT;

/** FEVER の手前のゲージの上限（人数が届いても、金額が足りないときは、満タンにしない）。 */
const BEFORE_FEVER = 0.97;

/** p（人数の割合に当たる値）から、段階・名前・ことば・ゲージの長さを出す。人数（heatOf）と、ひとり体験の行動の進み（soloHeatOf）が共有する。 */
function heatFromP(p: number, established: boolean): Heat {
  const [b2, b3, b4] = STAGE_BOUNDS;
  const stage: HeatStage = established ? 5 : p >= b4 ? 4 : p >= b3 ? 3 : p >= b2 ? 2 : 1;
  const nextP = stage === 1 ? b2 : stage === 2 ? b3 : stage === 3 ? b4 : null;
  return {
    stage,
    name: STAGE_NAMES[stage],
    distance: DISTANCE_WORDS[stage],
    fill: stage === 5 ? 1 : Math.min(gaugeOf(p), BEFORE_FEVER),
    next: stage === 5 ? null : nextP === null ? 1 : gaugeOf(nextP),
  };
}

/**
 * 人数と成立の判定から、熱量を出す（共有メーターあり。人数の割合から決める）。
 * 段階 5（FEVER）は成立（人数と金額の両方）のとき。人数だけ届いて金額が足りないときは、段階 4（FEVER 目前）のまま。
 */
export function heatOf(
  status: Pick<SupportStatus, 'supporters' | 'established'>,
  min: number,
): Heat {
  return heatFromP(min >= 1 ? status.supporters / min : 0, status.established);
}

/** ひとり体験の「自分の行動の進み」（いまは熱量に使わない。呼ぶ側の形を変えないために残す）。 */
export interface SoloProgress {
  /** 成立した（core の判定。人数と金額の両方）。FEVER は、このときだけ。 */
  readonly established: boolean;
  /** 申し込んだ。 */
  readonly joined: boolean;
  /** 仲間を呼んだ（成立に届かなかったときだけ、成立前のまま、ここに来る）。 */
  readonly called: boolean;
  /** 推し活定期をはじめた。 */
  readonly started: boolean;
  /** 申し込みの条件の達成度（0〜1。1 ＝ いま申し込める。メイン口座・預金の達成度の平均）。 */
  readonly ready: number;
}

/**
 * ひとり体験のゲージの長さ（統括の決定 2026-11-16）。1 人の利用者の場面を切り取るデモなので、
 * 開催熱量は「FEVER 目前」のまま動かさない（行動で段階は上がらない。数字は出さない）。
 */
export const SOLO_FILL = 0.8;

export function soloHeatOf(_s: SoloProgress): Heat {
  // ゲージの長さ ＝ p の HEAT_EXPONENT 乗なので、長さから p を逆算する（境目・名前は heatFromP と共有）
  return heatFromP(SOLO_FILL ** (1 / HEAT_EXPONENT), false);
}
