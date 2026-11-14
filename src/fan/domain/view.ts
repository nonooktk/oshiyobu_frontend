// ファン向けの、いまの状態から決まる値（人数・達成率・成立・次のアクションなど）。
// 数字・成立の判定は core の関数だけを使う（画面の側で同じ式を書かない）。
import { TEIKI, canApply, nextDepositTarget, restParts, supportStatus } from '../../core';
import type { Condition, CourseId, CourseOffer, SupportStatus } from '../../core';
import type { Seg } from '../text/format';
import { yen } from '../text/format';
import type { HomeKey } from '../text/voices';
import { ACT_IDS } from './state';
import type { Fan } from './state';

/** 共有メーターから受ける値（サーバーの件数と、自分が数えられた印）。 */
export type MeterIn = { serverJoined: number; counted: boolean };

export type FanView = {
  cond: Condition;
  fan: Fan;
  joined: boolean;
  /** 申し込んだコース。 */
  my: CourseOffer | null;
  /** 目指すコース（申し込む前だけ。登録していなければ、希望のコース）。 */
  target: CourseOffer | null;
  status: SupportStatus;
  /** 0 ＝ 未申し込み → 1 ＝ 申し込み後 → 2 ＝ 仲間が申し込んだあと。 */
  stage: 0 | 1 | 2;
  giftCount: number;
  doneCount: number;
  /** 達成率が 80% 以上か（コメントの区切り）。 */
  soon: boolean;
  /** ひとり体験で、仲間を呼べば成立に届くか（次のアクションの予告に使う。共有メーターありは false）。 */
  friendsClinch: boolean;
};

export const courseOf = (cond: Condition, id: CourseId): CourseOffer => {
  const found = cond.courses.find((k) => k.id === id);
  if (!found) throw new RangeError(`知らないコースです: ${id}`);
  return found;
};

/** 成立の判定（core の supportStatus）に、この端末の状態を渡す。 */
const statusOf = (fan: Fan, cond: Condition, meter: MeterIn): SupportStatus =>
  supportStatus(cond, {
    serverJoined: meter.serverJoined,
    counted: meter.counted,
    joined: fan.course !== null,
    pseudoFriends: fan.friends,
    myCoursePrice: fan.course !== null ? courseOf(cond, fan.course).price : 0,
  });

/**
 * ひとり体験で、仲間を呼んだときに足す人数。いまの状態から、擬似の仲間を 1 人ずつ増やして、
 * core の成立の判定（人数と金額の両方。仲間は通常の席の価格で数える）が真になる、最小の人数を返す。
 * 会場の席数を超えても届かないときは null（嘘の人数にしない）。
 */
export function friendsToClinch(fan: Fan, cond: Condition, meter: MeterIn): number | null {
  for (let n = 0; ; n += 1) {
    const status = statusOf({ ...fan, friends: fan.friends + n }, cond, meter);
    if (status.established) return n;
    if (status.supporters > cond.venue.cap) return null;
  }
}

/** solo は、ひとり体験（共有メーターなし）か。仲間を呼ぶと成立に届く所まで増える（次のアクションの予告に使う）。 */
export function viewOf(fan: Fan, cond: Condition, meter: MeterIn, solo = false): FanView {
  const joined = fan.course !== null;
  const my = fan.course !== null ? courseOf(cond, fan.course) : null;
  const targetId = joined ? null : (fan.aim ?? fan.seat);
  const target = targetId !== null ? courseOf(cond, targetId) : null;
  const status = statusOf(fan, cond, meter);
  return {
    cond,
    fan,
    joined,
    my,
    target,
    status,
    stage: !joined ? 0 : fan.done.friend ? 2 : 1,
    giftCount: fan.gifts.filter(Boolean).length,
    doneCount: ACT_IDS.filter((id) => fan.done[id]).length,
    soon: status.pct >= 80,
    friendsClinch: solo && joined && friendsToClinch(fan, cond, meter) !== null,
  };
}

export const canApplyOf = (v: FanView, k: CourseOffer): boolean =>
  canApply(k, v.fan.acct.deposit, v.fan.acct.pay);

/** 足りないものの言い方（「預金 10,000円・メイン口座」）。 */
export function restText(k: CourseOffer, deposit: number, pay: boolean): string {
  return restParts(k, deposit, pay)
    .map((p) => (p.kind === 'deposit' ? `預金 ${yen(p.yen)}` : 'メイン口座'))
    .join('・');
}

/** 自分の状態の札（「あと 10,000円・メイン口座」「メイン口座がまだです」）。 */
export function needTag(k: CourseOffer, deposit: number, pay: boolean): string {
  const parts = restParts(k, deposit, pay);
  const dep = parts.find((p) => p.kind === 'deposit');
  const main = parts.some((p) => p.kind === 'main');
  return dep && dep.kind === 'deposit'
    ? `あと ${yen(dep.yen)}${main ? '・メイン口座' : ''}`
    : 'メイン口座がまだです';
}

/** コースの枠の言い方。 */
export function slotsText(k: CourseOffer, cond: Condition, mine: boolean): string {
  return k.id === 'normal'
    ? `会場の席数（${cond.venue.cap}${cond.venue.unit}）まで`
    : `残り ${k.slots - (mine ? 1 : 0)}${k.unit}（全${k.slots}${k.unit}）`;
}

/** 預金が d0 → d1、メイン口座が p0 → p1 に変わったときに、新しく申し込めるようになるコースの名前。 */
export function opensList(
  cond: Condition,
  d0: number,
  d1: number,
  p0: boolean,
  p1: boolean,
): string[] {
  return cond.courses.filter((k) => !canApply(k, d0, p0) && canApply(k, d1, p1)).map((k) => k.name);
}

/** まだ申し込めないコースのうち、いちばん手前のコース。 */
export const nextLocked = (cond: Condition, d: number, p: boolean): CourseOffer | undefined =>
  cond.courses.find((k) => !canApply(k, d, p));

/** 押す前に出す「開くコース」（口座と預金の画面）。 */
export function opensText(
  cond: Condition,
  d0: number,
  d1: number,
  p0: boolean,
  p1: boolean,
): string {
  const names = opensList(cond, d0, d1, p0, p1);
  if (names.length) return names.join('・');
  const nx = nextLocked(cond, d1, p1);
  return nx ? `なし（${nx.name}は、${restText(nx, d1, p1)}が必要）` : 'なし';
}

/** 押す前に出す一文（次のアクションの画面）。 */
export function opensSentence(
  cond: Condition,
  d0: number,
  d1: number,
  p0: boolean,
  p1: boolean,
): string {
  const names = opensList(cond, d0, d1, p0, p1);
  if (names.length) return `${names.join('・')}に申し込めるようになります`;
  const nx = nextLocked(cond, d1, p1);
  return nx
    ? `申し込めるコースは増えません（${nx.name}は、${restText(nx, d1, p1)}が必要）`
    : '申し込めるコースは増えません';
}

/** 条件のチェック（□ → ✓）。 */
export type CondItem = { id: 'main' | 'dep'; ok: boolean; text: string };
export function condItems(v: FanView, k: CourseOffer): CondItem[] {
  const { deposit, pay } = v.fan.acct;
  const short = Math.max(0, k.deposit - deposit);
  const items: CondItem[] = [];
  if (k.mainAccount) {
    items.push({ id: 'main', ok: pay, text: pay ? 'メイン口座にした' : 'メイン口座にする' });
  }
  items.push({
    id: 'dep',
    ok: short === 0,
    text:
      short === 0
        ? `預金 ${yen(k.deposit)}以上（いま ${yen(deposit)}）`
        : `預金 あと ${yen(short)}（いま ${yen(deposit)}／${yen(k.deposit)}以上）`,
  });
  return items;
}

export type NextRowId =
  'apply' | 'main' | 'deposit' | 'teiki' | 'notice' | 'friend' | 'share' | 'again';
export type NextRow = { id: NextRowId; label: string; why: readonly Seg[]; hint: string };
export type NextHead =
  | { kind: 'pre'; course: CourseOffer; items: CondItem[]; ok: boolean }
  | { kind: 'est' }
  | { kind: 'gat'; pct: number; fill: number }
  | { kind: 'going'; left: number; pct: number; fill: number };
export type NextView = { head: NextHead; rows: NextRow[]; hint: string };

/** 次のアクション（SP-42）。いまできる行動の一覧と、ホームの 2 行目に出す 1 行。 */
export function nextViewOf(v: FanView): NextView {
  const { fan, cond, status } = v;
  const { deposit: d, pay: p } = fan.acct;
  const rows: NextRow[] = [];

  if (!v.joined) {
    const t = v.target;
    if (!t) throw new Error('申し込む前は、目指すコースがあります');
    const ok = canApplyOf(v, t);
    const needMain = t.mainAccount && !p;
    const to = nextDepositTarget(d);
    if (ok) {
      rows.push({
        id: 'apply',
        label: `${t.name}に申し込む`,
        why: [
          `${yen(t.price)}。支援者 `,
          { nw: `${status.supporters}人 → ${status.supporters + 1}人` },
          '。申し込むと確定します',
        ],
        hint: '',
      });
    }
    const mainRow: NextRow = {
      id: 'main',
      label: 'メイン口座にする',
      why: [
        needMain
          ? `${t.name}の条件の 1 つです（預金は変わりません）`
          : `${cond.courses
              .filter((k) => k.mainAccount)
              .map((k) => k.name)
              .join('・')}の条件の 1 つです（預金は変わりません）`,
      ],
      hint: '',
    };
    if (!p && needMain) rows.push(mainRow);
    if (to !== undefined) {
      rows.push({
        id: 'deposit',
        label: `預金を積み増す ＋${yen(to - d)}`,
        why: [{ nw: `預金 ${yen(d)} → ${yen(to)}` }, `。${opensSentence(cond, d, to, p, p)}`],
        hint: '',
      });
    }
    if (!fan.done.teiki) {
      rows.push({
        id: 'teiki',
        label: '推し活定期をはじめる',
        why: [
          `毎月 ${yen(TEIKI.monthlyYen)}。`,
          { nw: `預金 ${yen(d)} → ${yen(d + TEIKI.monthlyYen)}` },
        ],
        hint: '',
      });
    }
    if (!p && !needMain) rows.push(mainRow);
    const hint = ok
      ? `${t.name}（${yen(t.price)}）に申し込めます`
      : `${t.name}まで、残りは ${restText(t, d, p)}`;
    return { head: { kind: 'pre', course: t, items: condItems(v, t), ok }, rows, hint };
  }

  const L = status.left;
  if (status.established) {
    rows.push({
      id: 'notice',
      label: '仲間に知らせる',
      why: [`いまの達成率は ${status.pct}%。投稿文は、いまの数字で作られます`],
      hint: '仲間に知らせましょう',
    });
  } else {
    // 仲間を呼ぶと成立する（ひとり体験は、必ず成立に届く所まで増える）
    const clinch = {
      why: '仲間が申し込むと、ライブの開催が決まります',
      hint: '仲間を呼ぶと、ライブの開催が決まります',
    };
    const ft = v.friendsClinch
      ? clinch
      : L >= 2
        ? {
            why: `仲間が申し込むと、あと${L}人が${L - 1}人になります`,
            hint: `仲間を呼ぶと、あと${L}人が${L - 1}人に`,
          }
        : status.friendClinches
          ? clinch
          : L === 1
            ? { why: '仲間が申し込むと、人数が集まります', hint: '仲間を呼ぶと、人数が集まります' }
            : { why: '仲間が申し込むと、支援が増えます', hint: '仲間を呼ぶと、支援が増えます' };
    const gc = v.giftCount;
    if (!fan.done.friend)
      rows.push({ id: 'friend', label: '仲間を呼ぶ', why: [ft.why], hint: ft.hint });
    if (!fan.done.share) {
      rows.push({
        id: 'share',
        label: 'SNSで広める',
        why: [`投稿文が自動で入ります${gc < 3 ? `。広めると、特典 ${gc + 1}/3 が開きます` : ''}`],
        hint: gc < 3 ? `SNSで広めると、特典 ${gc + 1}/3 が開きます` : 'SNSで広められます',
      });
    }
    if (!rows.length) {
      rows.push({
        id: 'again',
        label: 'もう一度、仲間を呼ぶ',
        why: [`いまの達成率は ${status.pct}%。投稿文は、いまの数字で作り直せます`],
        hint: status.gathered
          ? '人数は集まりました。もう一度、仲間を呼べます'
          : `あと${L}人。もう一度、仲間を呼べます`,
      });
    }
  }
  const head: NextHead = status.established
    ? { kind: 'est' }
    : status.gathered
      ? { kind: 'gat', pct: status.pct, fill: status.fill }
      : { kind: 'going', left: L, pct: status.pct, fill: status.fill };
  return { head, rows, hint: rows[0]?.hint ?? '' };
}

/** ホームのコメントのキー（SP-30）。 */
export function homeKeyOf(v: FanView): HomeKey {
  if (v.status.established) return 'reached';
  if (v.status.gathered) return 'gathered';
  if (v.stage === 0) return v.soon ? 'preSoon' : 'pre';
  if (v.stage === 1) return v.soon ? 'postSoon' : 'post';
  return 'friend';
}
