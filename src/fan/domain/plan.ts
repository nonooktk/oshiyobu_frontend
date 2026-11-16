// ファン向けの「プラン」の見せ方（新しい流れ。docs/fan/要件.md）。
// プランは、core のコース 4 つをそのまま使う（金額・条件は core のまま。ここでは変えない）。
// 順番・名前・特典・ホームの段階は、このファイル 1 か所で決める。
import type { Condition, CourseId } from '../../core';
import type { Fan } from './state';

/** プランの順（下から上）。最初に選べるのは、先頭（最安）だけ。 */
export const PLAN_ORDER: readonly CourseId[] = ['normal', 'front', 'special', 'top'];
/** 最初に参加するプラン（最安）。 */
export const ENTRY_PLAN: CourseId = 'normal';

/** プランの名前（画面に出す名前。最安のプランの名前は仮）。 */
export const PLAN_NAMES: Readonly<Record<CourseId, string>> = {
  normal: 'スタンダードプラン',
  front: 'ゴールドプラン',
  special: 'プラチナプラン',
  top: 'ダイヤモンドプラン',
};

export const planRank = (id: CourseId): number => PLAN_ORDER.indexOf(id);

/** いまのプランより上のプランか（上げられるのは、上だけ。飛ばして上げてもよい）。 */
export const isUpgrade = (from: CourseId | null, to: CourseId): boolean =>
  from !== null && planRank(to) > planRank(from);

/** いまのプランより上のプランの一覧（下から順）。 */
export const upgradesOf = (from: CourseId | null): readonly CourseId[] =>
  from === null ? [] : PLAN_ORDER.filter((id) => planRank(id) > planRank(from));

/** プランを上げたときに贈る特典（最安のプランには無い）。動画の長さは秒。 */
export type Reward =
  | { plan: CourseId; kind: 'image'; label: string }
  | { plan: CourseId; kind: 'video'; seconds: 3 | 6; label: string };

export function rewardOf(id: CourseId): Reward | null {
  switch (id) {
    case 'front':
      return { plan: id, kind: 'image', label: '追加の画像' };
    case 'special':
      return { plan: id, kind: 'video', seconds: 3, label: '3秒の動画' };
    case 'top':
      return { plan: id, kind: 'video', seconds: 6, label: '6秒の動画' };
    default:
      return null;
  }
}

/** いまのプランまでに受け取った特典（下から順）。 */
export const rewardsUpTo = (id: CourseId | null): readonly Reward[] =>
  id === null
    ? []
    : PLAN_ORDER.filter((p) => planRank(p) <= planRank(id))
        .map(rewardOf)
        .filter((r): r is Reward => r !== null);

/** 預金でやること（参加のあとに済ませる 2 つ）。 */
export type DepositTaskId = 'teiki' | 'deposit';
export type DepositTask = { id: DepositTaskId; ok: boolean; label: string };

/** 預金でやることの、預金の額の目安（最安のプランの、core の預金の条件）。 */
export const taskDepositOf = (cond: Condition): number =>
  cond.courses.find((k) => k.id === ENTRY_PLAN)?.deposit ?? 0;

export function depositTasksOf(fan: Pick<Fan, 'done' | 'acct'>, cond: Condition): DepositTask[] {
  const need = taskDepositOf(cond);
  return [
    { id: 'teiki', ok: fan.done.teiki === true, label: '推し活定期をはじめる' },
    { id: 'deposit', ok: fan.acct.deposit >= need, label: '預金を積み増す' },
  ];
}

export const tasksDone = (fan: Pick<Fan, 'done' | 'acct'>, cond: Condition): boolean =>
  depositTasksOf(fan, cond).every((t) => t.ok);

/**
 * ホームの段階。start ＝ まだ参加していない／tasks ＝ 参加した。預金でやることが残っている／
 * grow ＝ 済んだ。「SNSで広める」と「プランを上げる」を出す。
 */
export type HomePhase = 'start' | 'tasks' | 'grow';
export function homePhaseOf(
  fan: Pick<Fan, 'course' | 'done' | 'acct'>,
  cond: Condition,
): HomePhase {
  if (fan.course === null) return 'start';
  return tasksDone(fan, cond) ? 'grow' : 'tasks';
}

/** ホームの背景の段（プランが上がるほど豪華になる。0 ＝ 最安・未参加）。 */
export const backdropOf = (id: CourseId | null): 0 | 1 | 2 | 3 =>
  (id === null ? 0 : Math.max(0, planRank(id))) as 0 | 1 | 2 | 3;

/** 画面に出す「達成した行動」（新しい流れで行う 4 つ。参加 → 預金でやること 2 つ → SNSで広める）。 */
export const SHOWN_ACTS = ['join', 'teiki', 'deposit', 'share'] as const;
export const shownDoneOf = (done: Fan['done']): readonly (typeof SHOWN_ACTS)[number][] =>
  SHOWN_ACTS.filter((id) => done[id] === true);
