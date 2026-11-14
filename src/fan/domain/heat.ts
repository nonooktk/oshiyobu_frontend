// 開催熱量（ファン向けの見せ方。統括の決定）。人数の割合 p（支援者 ÷ 最低人数）を、数字を出さずに、
// 「ゲージの長さ・段階の名前・距離のことば」へ変える。画面に出すのは、ここが返すものだけ。
// ひとり体験（既定）は、人数でなく、自分の行動の進みから段階を決める（soloHeatOf。行動のたびに段階が 1 つずつ上がる）。
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

/** ひとり体験で、段階を決める「自分の行動の進み」。 */
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
 * ひとり体験の、行動の進み → 段階（統括の決定 2026-11-14）。行動のたびに、段階が 1 つずつ上がる:
 * 開く＝点火 → 推し活定期をはじめる＝あたたまってきた → 条件に届く積み増し＝ヒートアップ → 申し込む＝FEVER 目前 → 仲間を呼ぶ＝FEVER。
 * 届かない額の積み増し・メイン口座は、段階は上げず、段階の中でゲージを少し伸ばす（どの行動でも、ゲージが伸びる）。
 * p は、人数の割合と同じ尺（境目・曲線は heatOf と同じ）。FEVER（段階 5）は、成立のときだけ。
 */
const SOLO_P = {
  /** 開いた直後（点火）。ゲージが見える長さ。 */
  open: STAGE_BOUNDS[0] * 0.6,
  /** 推し活定期をはじめた（あたたまってきた）。 */
  started: STAGE_BOUNDS[0],
  /** 条件がそろった（ヒートアップ）。 */
  ready: STAGE_BOUNDS[1],
  /** 申し込んだ（FEVER 目前）。 */
  joined: (STAGE_BOUNDS[2] + 1) / 2,
  /** 仲間を呼んだが成立に届かないとき（FEVER 目前の中で、もう少し伸ばす）。 */
  called: STAGE_BOUNDS[2] + (1 - STAGE_BOUNDS[2]) * 0.75,
} as const;
/** 条件の達成度に比例して、段階 2（あたたまってきた）の中で伸ばす割合（残りは、条件がそろった瞬間に、段階 3 へ上げる）。 */
const SOLO_ROOM = 0.95;

export function soloHeatOf(s: SoloProgress): Heat {
  if (s.established) return heatFromP(1, true);
  const ready = Math.min(1, Math.max(0, s.ready));
  const p = s.called
    ? SOLO_P.called
    : s.joined
      ? SOLO_P.joined
      : !s.started
        ? SOLO_P.open
        : ready >= 1
          ? SOLO_P.ready
          : SOLO_P.started + ready * (SOLO_P.ready - SOLO_P.started) * SOLO_ROOM;
  return heatFromP(p, false);
}
