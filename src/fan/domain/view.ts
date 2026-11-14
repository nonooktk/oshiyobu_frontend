// ファン向けの、いまの状態から決まる値（人数・達成率・成立・次のアクションなど）。
// 数字・成立の判定は core の関数だけを使う（画面の側で同じ式を書かない）。
import { TEIKI, canApply, restParts, supportStatus } from '../../core';
import type { Condition, CourseId, CourseOffer, SupportStatus } from '../../core';
import { heatOf } from './heat';
import type { Heat } from './heat';
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
  /** 開催熱量（ゲージの長さ・段階・距離のことば）。画面に出すのは、これだけ（数字は出さない。G-08）。 */
  heat: Heat;
  /** 0 ＝ 未申し込み → 1 ＝ 申し込み後 → 2 ＝ 仲間が申し込んだあと。 */
  stage: 0 | 1 | 2;
  giftCount: number;
  doneCount: number;
  /** 熱量が FEVER 目前以上か（コメントの区切り）。 */
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
  const heat = heatOf(status, cond.min);
  return {
    cond,
    fan,
    joined,
    my,
    target,
    status,
    heat,
    stage: !joined ? 0 : fan.done.friend ? 2 : 1,
    giftCount: fan.gifts.filter(Boolean).length,
    doneCount: ACT_IDS.filter((id) => fan.done[id]).length,
    soon: heat.stage >= 4,
    friendsClinch: solo && joined && friendsToClinch(fan, cond, meter) !== null,
  };
}

/** 目指すコースの預金の条件に、あといくら足りないか（自分の預金の話。0 なら足りている）。 */
export const depositGapOf = (k: CourseOffer, deposit: number): number =>
  Math.max(0, k.deposit - deposit);

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
  | { kind: 'gat'; heat: Heat }
  | { kind: 'going'; heat: Heat };
export type NextView = { head: NextHead; rows: NextRow[]; hint: string };

/** 申し込んだあとの熱量（数字は出さず、段階で伝える）。申し込むボタンの 2 行目に使う。 */
const heatAfterJoin = (v: FanView): Heat =>
  heatOf({ supporters: v.status.supporters + 1, established: false }, v.cond.min);

/** 次のアクション（SP-42）。いまできる行動の一覧と、ホームの 2 行目に出す 1 行。 */
export function nextViewOf(v: FanView): NextView {
  const { fan, status } = v;
  const { deposit: d, pay: p } = fan.acct;
  const rows: NextRow[] = [];

  if (!v.joined) {
    const t = v.target;
    if (!t) throw new Error('申し込む前は、目指すコースがあります');
    const ok = canApplyOf(v, t);
    const needMain = t.mainAccount && !p;
    const after = heatAfterJoin(v);
    const afterJoin = after.stage > v.heat.stage ? `${after.name}へ進みます` : '熱が高まります';
    // 流れ: 推し活定期をはじめる（口座が使える）→ メイン口座にする（条件にあるとき）→ 預金を積み増す → 申し込む。いまやる 1 つだけが並ぶ
    if (!fan.done.teiki) {
      rows.push({
        id: 'teiki',
        label: '推し活定期をはじめる',
        why: [
          `預金を積み増せるようになります。毎月 ${yen(TEIKI.monthlyYen)}の積立です（デモ用の操作）`,
        ],
        hint: '',
      });
    } else if (needMain) {
      rows.push({
        id: 'main',
        label: 'メイン口座にする',
        why: [`${t.name}の条件の 1 つです（預金は変わりません）`],
        hint: '',
      });
    } else if (!ok) {
      rows.push({
        id: 'deposit',
        label: '預金を積み増す',
        why: [`${t.name}まで、あと ${yen(Math.max(0, t.deposit - d))}。額は、入力で決めます`],
        hint: '',
      });
    } else {
      rows.push({
        id: 'apply',
        label: `${t.name}に申し込む`,
        why: [`${yen(t.price)}。申し込むと、${afterJoin}。申し込むと確定します`],
        hint: '',
      });
    }
    const hint = ok
      ? `申し込む → ${after.stage > v.heat.stage ? `${after.name}へ` : '熱が高まります'}（${yen(t.price)}）`
      : `${t.name}まで、残りは ${restText(t, d, p)}`;
    return { head: { kind: 'pre', course: t, items: condItems(v, t), ok }, rows, hint };
  }

  if (status.established) {
    rows.push({
      id: 'notice',
      label: '仲間に知らせる',
      why: [`いまの熱量は ${v.heat.name}。投稿文は、いまの熱量で作られます`],
      hint: '仲間に知らせる → 開催が決まったことを伝える',
    });
  } else {
    // 仲間を呼ぶと成立する（ひとり体験は、必ず成立に届く所まで増える）
    const clinch = {
      why: '仲間が申し込むと、ライブの開催が決まります',
      hint: '仲間を呼ぶ → FEVER（開催決定）へ',
    };
    const ft =
      v.friendsClinch || status.friendClinches
        ? clinch
        : { why: '仲間が申し込むと、熱が高まります', hint: '仲間を呼ぶ → 熱が高まります' };
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
        why: [`いまの熱量は ${v.heat.name}。投稿文は、いまの熱量で作り直せます`],
        hint: status.gathered
          ? 'FEVER 目前です。もう一度、仲間を呼べます'
          : 'もう一度、仲間を呼べます',
      });
    }
  }
  const head: NextHead = status.established
    ? { kind: 'est' }
    : status.gathered
      ? { kind: 'gat', heat: v.heat }
      : { kind: 'going', heat: v.heat };
  return { head, rows, hint: rows[0]?.hint ?? '' };
}

/** ホームの主のボタンの行動。押すと、その行動がその場で進む（別の画面へ移って選ばせない）。 */
export type HomeActionId =
  'apply' | 'main' | 'deposit' | 'teiki' | 'friend' | 'share' | 'notice' | 'again';
export type HomeAction = {
  id: HomeActionId;
  /** ボタンの 1 行目（行動そのもの）。 */
  label: string;
  /** 2 行目（押すと何が進むか）。 */
  sub: string;
  /** 読み上げ用の、押したあとの説明。 */
  hint: string;
};

/**
 * ホームの主のボタン（ゲージのすぐ下）。ゲージが進むために、いま何をすればよいかを、行動そのもので示す。
 * 場面: ①預金などが足りない → 預金を積み増す ②条件がそろっている → 申し込む ③申し込んだ → 仲間を呼ぶ ④成立した → 仲間に知らせる。
 * 一覧（次のアクション）の先頭の行と同じ順で決める（先頭に出る行動を、そのままホームの主のボタンにする）。
 */
export function homeActionOf(v: FanView): HomeAction {
  const first = nextViewOf(v).rows[0];
  const id = first?.id ?? 'deposit';
  switch (id) {
    case 'apply': {
      const after = heatAfterJoin(v);
      const up = after.stage > v.heat.stage;
      return {
        id,
        label: '申し込む',
        sub: up ? `→ ${after.name}へ` : '→ 熱量が高まります',
        hint: up ? `押すと、${after.name}へ進みます` : '押すと、熱量が高まります',
      };
    }
    case 'main':
      return {
        id,
        label: 'メイン口座にする',
        sub: '→ 申し込めるようになります',
        hint: '押すと、メイン口座にします（擬似）',
      };
    case 'teiki':
      return {
        id,
        label: '推し活定期をはじめる',
        sub: '→ 預金を積み増せるようになります',
        hint: '押すと、推し活定期をはじめます。デモ用の操作で、実際の手続きは行われません',
      };
    case 'friend': {
      const clinch = v.friendsClinch || v.status.friendClinches;
      return {
        id,
        label: '仲間を呼ぶ',
        sub: clinch ? '→ FEVER（開催決定）へ' : '→ 熱が高まります',
        hint: clinch ? '押すと、FEVER（開催決定）へ進みます' : '押すと、熱が高まります',
      };
    }
    case 'share':
      return {
        id,
        label: 'SNSに投稿する',
        sub: '→ 応援が広がります',
        hint: '押すと、投稿のシートが開きます',
      };
    case 'notice':
      return {
        id,
        label: '仲間に知らせる',
        sub: '→ 開催が決まったことを伝える',
        hint: '押すと、開催が決まったことを仲間に伝えます',
      };
    case 'again':
      return {
        id,
        label: 'もう一度、仲間を呼ぶ',
        sub: '→ 投稿のシートで、声をかけられます',
        hint: '押すと、投稿のシートが開きます',
      };
    default:
      // 預金（口座と預金の画面で、積み増す額を決める）
      return {
        id: 'deposit',
        label: '預金を積み増す',
        sub: '→ 申し込めるようになります',
        hint: '押すと、積み増す額の入力が開きます',
      };
  }
}

/** ホームのコメントのキー（SP-30）。 */
export function homeKeyOf(v: FanView): HomeKey {
  if (v.status.established) return 'reached';
  if (v.status.gathered) return 'gathered';
  if (v.stage === 0) return v.soon ? 'preSoon' : 'pre';
  if (v.stage === 1) return v.soon ? 'postSoon' : 'post';
  return 'friend';
}
