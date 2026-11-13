import { MILESTONE } from '../data/constants';
import type { Condition } from './condition';

/** 80% の節目（達成率。%）。 */
const MILESTONE_PCT = MILESTONE * 100;

/**
 * 達成率（%）＝ ⌊支援者 × 100 ÷ 最低人数⌋（切り捨て。決定 11）。100% を超えたら、数字はそのまま。
 * 最低人数が 1 未満のときは、0 で割らずに 0 を返す（最低人数は conditionOf と parseMinPeople が 1 以上に保つ）。
 */
export function achievementPct(supporters: number, min: number): number {
  return min >= 1 ? Math.floor((supporters * 100) / min) : 0;
}

/** 棒の長さ（%）＝ min(100, 支援者 ÷ 最低人数 × 100)。100% を超えても、棒は 100% で止める（決定 11）。 */
export function barFill(supporters: number, min: number): number {
  return min >= 1 ? Math.min(100, (supporters / min) * 100) : 0;
}

/** あと N 人 ＝ max(0, 最低人数 − 支援者)。 */
export function peopleLeft(supporters: number, min: number): number {
  return min >= 1 ? Math.max(0, min - supporters) : 0;
}

/**
 * 80% の演出を出すか。80% 未満から 80% 以上になったときだけ真（決定 10）。
 * 呼ぶのは、自分が申し込んだ直後だけ。引数は達成率（%）。
 */
export function crossedMilestone(beforePct: number, afterPct: number): boolean {
  return beforePct < MILESTONE_PCT && afterPct >= MILESTONE_PCT;
}

/** 共有メーターと、この端末の状態（設計 D-18 の規則 4）。 */
export interface MeterState {
  /** サーバーの件数（申し込みの件数。0 から）。取れていなければ 0。 */
  readonly serverJoined: number;
  /** 自分の申し込みがサーバーに数えられた印（応答の counted）。 */
  readonly counted: boolean;
  /** いま申し込み済みか。 */
  readonly joined: boolean;
  /** 擬似の仲間の人数（端末の中だけ）。 */
  readonly pseudoFriends: number;
}

/** ほかの端末の人数 ＝ max(0, サーバーの件数 − （自分が数えられていれば 1））。 */
function othersCount(state: MeterState): number {
  return Math.max(0, state.serverJoined - (state.counted ? 1 : 0));
}

/**
 * 表示する人数（支援者）＝ 初めの支援者 ＋ ほかの端末の人数 ＋ 自分の申し込み ＋ 擬似の仲間。
 * ほかの端末の人数 ＝ max(0, サーバーの件数 − （自分が数えられていれば 1））。
 * 申し込みをやめても、サーバーは減らさない（決定 3）ので、数えられた印は残り、自分の分だけ −1 になる。
 */
export function displayedCount(start: number, state: MeterState): number {
  return start + othersCount(state) + (state.joined ? 1 : 0) + state.pseudoFriends;
}

/** 成立の判定に使う、この端末の状態。 */
export interface SupportState extends MeterState {
  /** 申し込み済みのとき、選んだコースの金額（円）。未申し込み（joined が false）のときは使わない。 */
  readonly myCoursePrice: number;
}

export interface SupportStatus {
  /** 支援者（表示する人数）。 */
  readonly supporters: number;
  /** 支援の合計（円）。 */
  readonly total: number;
  /** 人数の条件: 支援者 ≧ 最低人数。 */
  readonly peopleOk: boolean;
  /** 金額の条件: 支援の合計 ≧ 到達ライン。 */
  readonly amountOk: boolean;
  /** 成立 ＝ 人数の条件と金額の条件の両方。 */
  readonly established: boolean;
  /** 人数だけ届いた ＝ 人数の条件を満たし、金額の条件を満たさない。 */
  readonly gathered: boolean;
  /** あと N 人。 */
  readonly left: number;
  /** 達成率（%）。 */
  readonly pct: number;
  /** 棒の長さ（%）。 */
  readonly fill: number;
  /** 仲間が 1 人（通常の席）申し込んだら、成立するか。 */
  readonly friendClinches: boolean;
}

/**
 * 成立の判定（仕様 SP-26。判定は各端末で行う。決定 1）。
 * 支援の合計 ＝ （初めの支援者 ＋ ほかの端末の人数）× 通常の席の価格 ＋ 自分のコースの金額 ＋ 擬似の仲間 × 通常の席の価格。
 * サーバーは件数だけを持つので、ほかの端末の申し込みは通常の席の価格で数え、自分の申し込みだけ選んだコースの金額で数える（A2）。
 * 上位コースに申し込んでも、人数は 1 人ぶん。金額は、そのコースの金額で数える。
 */
export function supportStatus(
  condition: Pick<Condition, 'start' | 'price' | 'line' | 'min'>,
  state: SupportState,
): SupportStatus {
  const { start, price, line, min } = condition;
  const supporters = displayedCount(start, state);
  const total =
    (start + othersCount(state)) * price +
    (state.joined ? state.myCoursePrice : 0) +
    state.pseudoFriends * price;
  const peopleOk = supporters >= min;
  const amountOk = total >= line;
  return {
    supporters,
    total,
    peopleOk,
    amountOk,
    established: peopleOk && amountOk,
    gathered: peopleOk && !amountOk,
    left: peopleLeft(supporters, min),
    pct: achievementPct(supporters, min),
    fill: barFill(supporters, min),
    friendClinches: supporters + 1 >= min && total + price >= line,
  };
}

/**
 * 最低人数が必要人数より少ないときの注意の金額（円）。
 * 「通常の席だけだと、最低人数に届いても金額が足りません（あと {到達ライン − 最低人数 × 通常の席の価格}ぶんは上位コースなどで補う必要があります）」。
 * 最低人数が必要人数以上のときは null（注意を出さない。仕様 SP-15）。
 */
export function minPeopleGapYen(
  condition: Pick<Condition, 'line' | 'price' | 'need' | 'min'>,
): number | null {
  return condition.min < condition.need ? condition.line - condition.min * condition.price : null;
}
