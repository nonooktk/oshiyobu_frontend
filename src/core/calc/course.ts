import { COURSES } from '../data/courses';
import type { CourseOffer } from './condition';

/** 足りないもの 1 つ。言い方（「預金 10,000円」「メイン口座」）は frontend の文言。 */
export type RestPart =
  { readonly kind: 'deposit'; readonly yen: number } | { readonly kind: 'main' };

/** 足りない預金（円）＝ max(0, コースの預金の条件 − 預金）。0 ならそろっている。 */
export function depShort(course: Pick<CourseOffer, 'deposit'>, deposit: number): number {
  return Math.max(0, course.deposit - deposit);
}

/** メイン口座が足りないか ＝ コースがメイン口座を要求し、まだメイン口座にしていない。 */
export function mainShort(course: Pick<CourseOffer, 'mainAccount'>, mainAccount: boolean): boolean {
  return course.mainAccount && !mainAccount;
}

/**
 * 申し込めるか ＝ 預金の条件を満たし、メイン口座の条件も満たす（仕様 SP-27）。
 * 「推し活定期をはじめる」は条件にしない（預金を増やす行動）。
 */
export function canApply(
  course: Pick<CourseOffer, 'deposit' | 'mainAccount'>,
  deposit: number,
  mainAccount: boolean,
): boolean {
  return depShort(course, deposit) === 0 && !mainShort(course, mainAccount);
}

/** 足りないもの（預金 → メイン口座の順）。そろっていれば空。 */
export function restParts(
  course: Pick<CourseOffer, 'deposit' | 'mainAccount'>,
  deposit: number,
  mainAccount: boolean,
): readonly RestPart[] {
  const parts: RestPart[] = [];
  const short = depShort(course, deposit);
  if (short > 0) {
    parts.push({ kind: 'deposit', yen: short });
  }
  if (mainShort(course, mainAccount)) {
    parts.push({ kind: 'main' });
  }
  return parts;
}

/**
 * 「預金を積み増す」で到達する額 ＝ 預金より大きい、コースの預金の条件のうち最小（仕様 SP-33）。
 * 開くコースが無ければ undefined（デモでは、これ以上積み増せない）。
 */
export function nextDepositTarget(deposit: number): number | undefined {
  return COURSES.map((course) => course.deposit)
    .sort((a, b) => a - b)
    .find((target) => target > deposit);
}
