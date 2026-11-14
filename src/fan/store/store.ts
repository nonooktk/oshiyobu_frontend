// ファン向けのストア。状態（端末の中だけ）と、申し込み・演出・特典・感謝の順番（タイマー）を持つ。
// 数字・成立の判定は core の関数（domain/view.ts 経由）。通信は adapter の joinPerformance だけ（呼ぶだけで待たない。N-21）。
import {
  achievementPct,
  canApply,
  conditionOf,
  courseOffersOf,
  crossedMilestone,
  performanceIdOf,
} from '../../core';
import type { Condition, CourseId, PerformanceId } from '../../core';
import { artistView } from '../art/registry';
import { ACT_IDS, FAN_VENUE_ID, GIFT_ACTS, initialState } from '../domain/state';
import type {
  AcctId,
  ActId,
  AchSpec,
  Confetto,
  FanState,
  FxKind,
  FxSpec,
  Layer,
  Page,
  Pend,
  ShareMode,
} from '../domain/state';
import {
  canApplyOf,
  condItems,
  courseOf,
  friendsToClinch,
  homeActionOf,
  restText,
  viewOf,
} from '../domain/view';
import type { FanView, MeterIn } from '../domain/view';
import { canAddDeposit } from '../domain/deposit';
import { postedText } from '../domain/share';
import type { ShareChannel } from '../domain/share';
import type { SoundCue } from '../sound';
import { yen } from '../text/format';
import {
  PRAISE_FEVER,
  PRAISE_FRIEND,
  PRAISE_JOIN,
  PRAISE_JOIN_FEVER,
  PRAISE_NOTIFY,
  PRAISE_SHARE,
  praiseJoinStage,
} from '../text/praise';
import type { Praise } from '../text/praise';
import { VOICES } from '../text/voices';

/** ストアが外から受ける、条件とメーターの最新値（Provider が描画のたびに渡す）。 */
export type Env = { cond: Condition; pid: PerformanceId; meter: MeterIn };

export type Deps = {
  /** 申し込みの送信（即座に戻る。数えられる前でも画面は先に進む）。 */
  join: (pid: PerformanceId) => void;
  /** 共有メーターの取得の依頼。pid を渡すと、見ている公演ではなく、その公演を取る（選び直して、まだ確定していない公演）。 */
  fetch: (reason: 'open' | 'course-select' | 'performance-changed', pid?: PerformanceId) => void;
  /** 動きを減らす設定か。 */
  reduceMotion: () => boolean;
  random: () => number;
  /**
   * ひとり体験（共有メーターなし。人数は端末の中だけで数える）か。省略は false（共有メーターあり）。
   * true のとき、仲間を呼ぶと、成立に届く所まで一度に増え、成立の演出が出る。
   */
  solo?: () => boolean;
  /** 称賛の音を鳴らす（鳴るかどうかは、受け取る側が決める: オフ・操作の前・使えない環境では、何もしない）。 */
  sound?: (cue: SoundCue) => void;
};

export const defaultDeps = (
  partial: Pick<Deps, 'join' | 'fetch'> & Partial<Pick<Deps, 'solo' | 'sound'>>,
): Deps => ({
  ...partial,
  reduceMotion: () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  random: Math.random,
});

const CONFETTI_COLORS = [
  'var(--yellow)',
  'var(--yellow-light)',
  'var(--sky)',
  'var(--sky-light)',
  'var(--surface)',
  'var(--primary)',
] as const;

/** 条件を変えるときの、事務所向けとの連動の値を受ける口（region 3 で使う）。 */
export type StoreOptions = { personaNo: number; deps: Deps };

export function createFanStore({ personaNo, deps }: StoreOptions) {
  let state: FanState = initialState(personaNo);
  let env: Env | null = null;
  let seq = 0;
  /** 仲間を呼んでいる最中か（押し続けても、1 回ぶんしか進めない）。 */
  let calling = false;
  let achTimer: ReturnType<typeof setTimeout> | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const fxEnd = new Map<number, () => void>();
  const listeners = new Set<() => void>();

  const emit = (): void => listeners.forEach((l) => l());
  const set = (patch: Partial<FanState>): void => {
    state = { ...state, ...patch };
    emit();
  };
  const later = (ms: number, fn: () => void): void => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const reduce = (): boolean => deps.reduceMotion();

  /** いまの条件。Provider が渡した条件が、いまの会場のものでなければ、会場の標準の条件を使う。 */
  const condNow = (): Condition =>
    env && env.cond.venueId === state.venueId ? env.cond : conditionOf(state.venueId);
  const pidNow = (): PerformanceId => performanceIdOf(state.oshiId, state.venueId);
  const solo = (): boolean => deps.solo?.() ?? false;
  /** 称賛の音（行動の直後と、段階が上がった・FEVER の瞬間だけ） */
  const sound = (cue: SoundCue): void => deps.sound?.(cue);
  /** いまの公演のメーター（Provider が渡した値が、いまの公演のものでなければ、取れていない扱い） */
  const meterNow = (): MeterIn =>
    env && env.pid === pidNow() ? env.meter : { serverJoined: 0, counted: false };
  const view = (): FanView => viewOf(state, condNow(), meterNow(), solo());

  /* ---------- 小さな部品 ---------- */
  // 同じ文が続くときは、末尾の見えない印（ZWSP）を付け替えて、読み上げの領域の中身を変える（2 回目も伝わる）
  const announce = (text: string): void => {
    set({ live: state.live === text ? `${text}\u200b` : text });
  };
  const toast = (text: string, ms = 3000): void => {
    const id = ++seq;
    set({ toast: { id, text } });
    later(ms, () => {
      if (state.toast?.id === id) set({ toast: null });
    });
  };
  const confetti = (
    n: number,
    dur: number,
    durSpan: number,
    delay: number,
    delaySpan: number,
  ): Confetto[] =>
    reduce()
      ? []
      : Array.from({ length: n }, (_, i) => ({
          left: Math.round(deps.random() * 100),
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? 'var(--yellow)',
          dur: Number((dur + deps.random() * durSpan).toFixed(2)),
          delay: Number((delay + deps.random() * delaySpan).toFixed(2)),
        }));

  /* ---------- 行動の直後の短い称賛（控えめな札。操作を止めない・押すと消える） ---------- */
  const endAch = (): void => {
    if (achTimer) clearTimeout(achTimer);
    achTimer = null;
    if (state.ach) set({ ach: null });
  };
  /** 押して飛ばしたとき: 待っていた ✓ の動きを、すぐ始める。 */
  const flushAch = (): void => {
    if (state.fresh) set({ ckDelay: 0, fresh: { ...state.fresh, nonce: ++seq } });
  };
  const clearAch = (): void => {
    const had = state.ach !== null;
    endAch();
    if (had) flushAch();
  };
  const showAch = (a: Pick<AchSpec, 'title' | 'sub'>): void => {
    clearAch();
    if (state.layers.length) {
      flushAch();
      return;
    }
    const ms = reduce() ? 2000 : 2600;
    set({ ach: { ...a, id: ++seq, ms } });
    achTimer = setTimeout(endAch, ms);
  };

  /* ---------- 重ねる層 ---------- */
  const pushLayer = (layer: Layer): void => {
    clearAch();
    set({ layers: [...state.layers, layer] });
  };
  const popLayer = (kind: Layer['kind']): Layer | null => {
    const i = state.layers.map((l) => l.kind).lastIndexOf(kind);
    if (i < 0) return null;
    const layer = state.layers[i] ?? null;
    set({ layers: state.layers.filter((_, j) => j !== i) });
    return layer;
  };

  const showFx = (o: {
    kind: FxKind;
    /** 派手にするか（帯・揺れ。FEVER の瞬間だけ）。 */
    strong?: boolean;
    /** ホームの上で、ゲージの手前までを暗くするか（称賛の演出）。 */
    overHome?: boolean;
    title: string;
    small: string;
    sub: string;
    size: number;
    stroke: number;
    subSize: number;
    say?: string;
    ms: number;
    reduceMs: number;
    live: string;
    /** 読み上げを遅らせるとき（ミリ秒）。先に伝えた文を、上書きしない。 */
    liveAfter?: number;
    onEnd?: () => void;
  }): number => {
    const id = ++seq;
    const strong = o.strong ?? false;
    const spec: FxSpec = {
      id,
      kind: o.kind,
      strong,
      overHome: o.overHome ?? false,
      title: o.title,
      small: o.small,
      sub: o.sub,
      size: o.size,
      stroke: o.stroke,
      subSize: o.subSize,
      ms: o.ms,
      reduceMs: o.reduceMs,
      confetti: confetti(strong ? 110 : 56, 1.6, 1.6, 0.2, 0.9),
      ...(o.say ? { say: o.say } : {}),
    };
    if (o.onEnd) fxEnd.set(id, o.onEnd);
    pushLayer({ kind: 'fx', fx: spec });
    if (o.liveAfter === undefined) announce(o.live);
    else later(o.liveAfter, () => announce(o.live));
    later(reduce() ? o.reduceMs : o.ms, () => hideFx(id));
    return id;
  };
  /**
   * 称賛の演出（行動の直後）。大きい文字 → 褒めことばのカード（あなたがしたこと → それで何が進んだか）→ 推しのひとこと。
   * 強さは標準。派手（帯・揺れ）にするのは、FEVER の瞬間（strong）だけ。ゲージの手前までを暗くして、ゲージの伸びを見せる。
   */
  const showPraise = (o: {
    kind: FxKind;
    praise: Praise;
    strong?: boolean;
    /** ゲージの手前までを暗くするか（既定は true。投稿のシートの上など、ゲージが見えないときは false）。 */
    overHome?: boolean;
    size: number;
    say?: string;
    ms: number;
    reduceMs: number;
    live: string;
    liveAfter?: number;
    onEnd?: () => void;
  }): number =>
    showFx({
      kind: o.kind,
      overHome: o.overHome ?? true,
      ...(o.strong ? { strong: true } : {}),
      title: o.praise.title,
      small: o.praise.small,
      sub: o.praise.sub,
      size: o.size,
      stroke: o.strong ? 12 : 10,
      subSize: 18,
      ms: o.ms,
      reduceMs: o.reduceMs,
      live: o.live,
      ...(o.liveAfter !== undefined ? { liveAfter: o.liveAfter } : {}),
      ...(o.say ? { say: o.say } : {}),
      ...(o.onEnd ? { onEnd: o.onEnd } : {}),
    });
  /** 演出を閉じて、次（絵）へ進む。押して飛ばしたときも、時間が来たときも同じ。 */
  const hideFx = (id?: number): void => {
    const top = state.layers[state.layers.length - 1];
    if (!top || top.kind !== 'fx' || (id !== undefined && top.fx.id !== id)) return;
    set({ layers: state.layers.slice(0, -1) });
    const cb = fxEnd.get(top.fx.id);
    fxEnd.delete(top.fx.id);
    if (cb) later(0, cb);
  };

  /* ---------- 特典・感謝 ---------- */
  const GIFT_SUB = ['絵が少し見える', '絵がもっと広く見える', '絵の全体が見える'] as const;
  const showGift = (replay: boolean): void => {
    const v = view();
    if (v.giftCount === 0) return;
    pushLayer({ kind: 'gift', replay });
    const o = artistView(state.oshiId);
    announce(
      `特典 ${v.giftCount}/3 ${replay ? 'は開いています' : 'が開きました'}。${o.name}から: ${sayOf(state.lastGift)}`,
    );
  };
  const sayOf = (act: ActId): string => {
    const s = VOICES[state.oshiId].say;
    return act === 'share' ? s.share() : act === 'friend' ? s.friend() : s.join(condNow().city);
  };
  const unlockGift = (i: 0 | 1 | 2, merged = false): void => {
    if (state.gifts[i]) return;
    const gifts = [...state.gifts] as [boolean, boolean, boolean];
    gifts[i] = true;
    set({ gifts, lastGift: GIFT_ACTS[i] });
    if (merged) {
      showGift(false);
      return;
    }
    const k = view().giftCount;
    showFx({
      kind: 'gift',
      title: 'ごほうび',
      small: `特典 ${k}/3 が開いた！`,
      sub: GIFT_SUB[k - 1] ?? GIFT_SUB[0],
      size: 72,
      stroke: 8,
      subSize: 20,
      ms: 2200,
      reduceMs: 1500,
      live: `ごほうびが開きました。特典 ${k}/3。`,
      onEnd: () => showGift(false),
    });
  };
  const closeGift = (): void => {
    const layer = popLayer('gift');
    if (!layer || layer.kind !== 'gift') return;
    // 3 つ目の特典の絵を閉じた直後に、感謝のメッセージを 1 回だけ出す（決定 25）
    if (!layer.replay && view().giftCount === 3 && !state.thanksShown) {
      set({ thanksShown: true });
      pushLayer({ kind: 'thanks' });
      announce(`${artistView(state.oshiId).name}から、感謝のメッセージが届きました。`);
    }
  };
  const closeThanks = (): void => {
    popLayer('thanks');
  };
  /** Esc: いちばん上の層を閉じる。 */
  const escape = (): void => {
    const top = state.layers[state.layers.length - 1];
    if (!top) return;
    if (top.kind === 'fx') hideFx(top.fx.id);
    else if (top.kind === 'gift') closeGift();
    else if (top.kind === 'thanks') closeThanks();
    else if (top.kind === 'share') closeShare();
    else if (top.kind === 'deposit') closeDeposit();
    else if (top.kind === 'cancel') closeCancel();
    else closeCarry();
  };

  /** FEVER 目前の演出（自分が申し込んで、FEVER 目前に届いた直後にだけ出す。1 回だけ）。 */
  const showMilestone = (cb: () => void, withGift: boolean): void => {
    if (state.milestoneShown) {
      cb();
      return;
    }
    set({ milestoneShown: true });
    showReached(cb, withGift, 'join');
  };
  /**
   * 称賛の演出の中身（FEVER 目前・FEVER）。申し込んだ直後と、仲間を呼んで成立したときが使う。
   * 褒めるのは行動だけ（あなたがしたこと → それで何が進んだか）。数字は出さない（G-08）。
   * FEVER の瞬間だけ派手（帯・揺れ）。申し込みのときの推しのひとことは、開いた特典を伝える。仲間を呼んだときは、仲間のことを伝える。
   */
  const showReached = (cb: () => void, withGift: boolean, by: 'join' | 'friend'): void => {
    const v = view();
    const established = v.status.established;
    sound(established ? 'fever' : 'stage');
    const praise = established
      ? by === 'friend'
        ? PRAISE_FEVER
        : PRAISE_JOIN_FEVER
      : praiseJoinStage(v.heat.name);
    const say = withGift
      ? VOICES[state.oshiId].say.gift('特典 1/3')
      : established && by === 'friend'
        ? VOICES[state.oshiId].say.friend()
        : undefined;
    showPraise({
      kind: established ? 'fever' : 'stage',
      praise,
      strong: established,
      size: established ? 80 : 64,
      ...(say ? { say } : {}),
      ms: established ? 3600 : 2500,
      reduceMs: established ? 2000 : 1500,
      live:
        (established
          ? 'FEVER。あなたの声が届いて、ライブの開催が決まりました。'
          : 'FEVER 目前。あなたの一歩で、ここまで来ました。') +
        (withGift ? 'ごほうびが開きました。特典 1/3。' : ''),
      onEnd: cb,
    });
  };
  /** 段階が上がらない（または 80% を越えない）申し込みの直後の称賛。特典 1/3 のごほうびを、推しのひとことで伝える。 */
  const showJoinPraise = (cb: () => void, stageUp: boolean): void => {
    const praise = stageUp ? praiseJoinStage(view().heat.name) : PRAISE_JOIN;
    showPraise({
      kind: stageUp ? 'stage' : 'join',
      praise,
      size: 64,
      say: VOICES[state.oshiId].say.gift('特典 1/3'),
      ms: 2500,
      reduceMs: 1500,
      live: `申し込みありがとう。${praise.sub}。ごほうびが開きました。特典 1/3。`,
      onEnd: cb,
    });
  };

  /* ---------- 申し込み ---------- */
  const go = (page: Page, opt: { scrollTo?: string } = {}): void => {
    void opt;
    const prev = state.page;
    const origin =
      page === 'home' || page === 'more'
        ? page
        : prev === 'home' || prev === 'more'
          ? prev
          : state.origin;
    let homeIdx = state.homeIdx;
    if (page === 'home') {
      const k = view().giftCount;
      if (k === 0) homeIdx = -1;
      else {
        const all = Array.from({ length: k }, (_, i) => i);
        const pool = k > 1 ? all.filter((i) => i !== homeIdx) : all;
        homeIdx = pool[Math.floor(deps.random() * pool.length)] ?? 0;
      }
    }
    set({
      page,
      origin,
      homeIdx,
      fresh: null,
      ...(page === 'opt' ? { pend: { oshiId: state.oshiId, seat: state.seat } } : {}),
    });
  };

  const applyCourse = (id: CourseId): void => {
    clearAch();
    const v = view();
    const k = courseOf(v.cond, id);
    if (!canApplyOf(v, k) || state.course === id) return;
    const first = !state.done.join;
    const had = v.joined;
    set({ course: id, aim: null, done: { ...state.done, join: true } });
    if (!had) sound('join'); // 申し込んだ直後の称賛（新しい申し込みだけ。コースの変更は鳴らさない）
    if (!had) deps.join(pidNow()); // 新しい申し込みだけ送る（コースの変更・やめる・申し込み直しは数え直さない。決定 3）
    go('home');
    const after = (merged: boolean): void => {
      if (first) unlockGift(0, merged);
      else
        toast(
          had
            ? `コースを「${k.name}」に変えました。確保は${yen(k.price)}になりました`
            : `もう一度申し込みました。確保は${yen(k.price)}になりました`,
        );
    };
    // 申し込みの直後に 80% を越えるか。越えるときだけ、0.5 秒あとの時点で、最後に取れたサーバーの人数で判定し直す（K-02）
    const crosses = (): boolean => {
      if (had || state.milestoneShown) return false;
      const s = view().status;
      const cond = condNow();
      return crossedMilestone(achievementPct(s.supporters - 1, cond.min), s.pct);
    };
    const stage0 = v.heat.stage;
    later(reduce() ? 0 : 150, () => {
      if (!crosses()) {
        // 最初の申し込みは、称賛の演出のあとに特典 1/3 へ。コースの変更・申し込み直しは、トーストだけ
        if (first) showJoinPraise(() => after(true), view().heat.stage > stage0);
        else {
          announce(`申し込みが確定しました。熱量は${view().heat.name}です。`);
          after(false);
        }
        return;
      }
      later(reduce() ? 0 : 500, () => {
        if (crosses()) showMilestone(() => after(true), first);
        else {
          announce(`申し込みが確定しました。熱量は${view().heat.name}です。`);
          after(false);
        }
      });
    });
  };

  const aimCourse = (id: CourseId): void => {
    set({ aim: id });
    const k = courseOf(view().cond, id);
    toast(`「${k.name}」を目指すコースにしました。条件がそろったら、申し込めます`);
  };

  /* ---------- 口座と預金の 3 つの行動 ---------- */
  const acctDone = (id: AcctId): boolean =>
    id === 'main' ? state.acct.pay : id === 'teiki' ? !!state.done.teiki : false;

  /**
   * 口座と預金の行動を進める。流れは、推し活定期をはじめる（デモの中で、口座が使える状態になる）→ 預金を積み増す → 申し込む。
   * 預金は、amount（円）を渡して、その額だけ足す（利用者が入れた額）。足せない額（整数でない・1 円未満・合計が上限を超える）は、
   * 何も変えない（画面が先に理由を出して断る）。口座を使う行動（預金・メイン口座）は、推し活定期をはじめたあとだけ。
   * 足したあとは、短い称賛（控えめ）を出す。条件に届いたときは、預金の入力のシートを閉じる。
   */
  const runAcct = (id: AcctId, from: Page, amount?: number): void => {
    if (
      id === 'deposit'
        ? amount === undefined || !canAddDeposit(amount, state.acct.deposit)
        : acctDone(id)
    )
      return;
    if (id !== 'teiki' && !state.done.teiki) return;
    clearAch();
    const v0 = view();
    const t = v0.joined ? null : v0.target;
    const wasCk = t
      ? condItems(v0, t)
          .filter((i) => i.ok)
          .map((i) => i.id)
      : [];
    const wasOk = t ? canApplyOf(v0, t) : false;
    // 状態を進める（擬似）。推し活定期は、口座が使える状態にするだけ（預金は変えない）
    const acct = { ...state.acct };
    if (id === 'main') acct.pay = true;
    else if (id === 'deposit') {
      acct.deposit += amount ?? 0;
      acct.times += 1;
    }
    set({ acct, done: { ...state.done, [id]: true } });
    const v1 = view();
    const t1 = t ? courseOf(v1.cond, t.id) : null;
    const reached = !!t1 && !wasOk && canApplyOf(v1, t1);
    const nowCk = t1
      ? condItems(v1, t1)
          .filter((i) => i.ok)
          .map((i) => i.id)
      : [];
    const rest = t1 && !reached && !canApplyOf(v1, t1) ? restText(t1, acct.deposit, acct.pay) : '';
    // 画面に出す文（トースト・読み上げ）と、短い称賛（行動 → それで何が進んだか）
    const toastText =
      id === 'teiki'
        ? '推し活定期をはじめました。デモ用の操作で、実際の手続きは行われません'
        : id === 'main'
          ? 'メイン口座にしました（デモ用の操作）'
          : `${yen(amount ?? 0)}を積み増しました（預金 ${yen(acct.deposit)}）`;
    const praise =
      id === 'teiki'
        ? { title: 'はじめてくれてありがとう。', sub: '預金を積み増せるようになりました' }
        : {
            title: id === 'main' ? 'メイン口座にしてくれてありがとう。' : '積み増しありがとう。',
            sub: reached
              ? '申し込めるようになりました'
              : t1
                ? `${t1.name}まで、残りは ${rest}`
                : '申し込みの条件が 1 つそろいました',
          };
    // 条件の ✓ が付く動きは、称賛が薄れていく頃に始める（動きを減らす設定では 0）
    set({
      ckDelay: reduce() ? 0 : reached ? 1.3 : 1.0,
      fresh: {
        ids: nowCk.filter((x) => !wasCk.includes(x)),
        all: reached,
        act: id,
        from,
        nonce: ++seq,
      },
    });
    if (reached) popLayer('deposit'); // 条件に届いたら、額の入力を閉じて、ホームの「申し込む」へ
    sound('share');
    showAch(praise);
    toast(toastText, 3600);
    announce(`${praise.title}${praise.sub}。${toastText}。`);
  };
  /** 預金を積み増す額の入力（シート）。ホームの主のボタンと、次のアクションの画面から開く。 */
  const openDeposit = (): void => {
    if (!state.done.teiki || state.layers.some((l) => l.kind === 'deposit')) return;
    pushLayer({ kind: 'deposit' });
  };
  const closeDeposit = (): void => {
    popLayer('deposit');
  };

  /* ---------- 仲間を呼ぶ・共有 ---------- */
  const openShare = (mode: ShareMode): void => {
    pushLayer({ kind: 'share', mode });
  };
  const closeShare = (): void => {
    popLayer('share');
  };
  /**
   * 仲間を呼ぶ（ホームの主のボタン）。共有のシートは開かず、すぐ進む。
   * 押した直後に称賛（「届いた！」）→ ゲージが伸びる（終わりに近いほど速く伸びる）→ 成立のときは FEVER の瞬間の演出、まで一続き。
   * ひとり体験は、成立に届く所まで一度に増える（少なくとも 1 人。届かない公演は 1 人）。共有メーターありは、1 人ずつ。
   * 申し込む前は呼べない。成立のあと（と、呼んだあと）は、もう一度は呼べない。人数は、ゲージが伸びきったときに変わる（内部の数字）。
   */
  const callFriends = (): void => {
    if (calling || state.course === null || state.done.friend) return;
    if (view().status.established || state.layers.length) return;
    calling = true;
    clearAch();
    if (state.page !== 'home') go('home'); // ゲージが見える画面で伸ばす
    const v0 = view();
    const add = solo() ? Math.max(1, friendsToClinch(state, condNow(), meterNow()) ?? 1) : 1;
    const v1 = viewOf({ ...state, friends: state.friends + add }, condNow(), meterNow(), solo());
    const reach = v1.status.established;
    const ms = reduce() ? (reach ? 1800 : 1500) : reach ? 2600 : 1200;
    sound('friend');
    set({ gaugeRun: reduce() ? null : { from: v0.heat.fill, to: v1.heat.fill, ms, nonce: ++seq } });
    const fxId = showPraise({
      kind: 'friend',
      praise: PRAISE_FRIEND,
      size: 64,
      ms,
      reduceMs: ms,
      live: '仲間を呼んでくれてありがとう。あなたの声が届いて、熱が高まっています。',
    });
    later(ms, () => {
      hideFx(fxId); // 「届いた！」が残っていれば、ここで閉じる（飛ばしていても、ゲージの伸びは続いている）
      calling = false;
      if (state.course === null) {
        set({ gaugeRun: null }); // 伸びている間に、申し込みをやめた・条件を変えた
        return;
      }
      set({
        gaugeRun: null,
        friends: state.friends + add,
        called: state.called + add,
        done: { ...state.done, friend: true },
      });
      // 成立したときは、FEVER の瞬間の演出を出してから、特典 3/3 に進む
      if (view().status.established) showReached(() => unlockGift(2), false, 'friend');
      else {
        announce(`呼んだ仲間が申し込みました。熱量は${view().heat.name}です。`);
        unlockGift(2);
      }
    });
  };
  /** 仲間に知らせる（成立のあと）。短い称賛だけ。人数・状態は変えない。 */
  const notifyFriends = (): void => {
    if (state.course === null || !view().status.established || state.layers.length) return;
    sound('share');
    showPraise({
      kind: 'notify',
      praise: PRAISE_NOTIFY,
      size: 64,
      say: VOICES[state.oshiId].say.share(),
      ms: 2600,
      reduceMs: 2000,
      live: '知らせてくれてありがとう。あなたの声が、仲間に届きました。',
    });
  };
  /**
   * 共有ボタン（SNS への投稿。ゲージは動かさない）。外のサイトは開かず、コピーもせず、押したら投稿したことにする
   * （デモなので、実際には投稿しない。統括の決定 2026-11-14）。投稿したことを画面と読み上げで伝え、音を鳴らす。
   * 最初の 1 回だけ、共有した印を付け、短い称賛のあとに特典 2/3 が開く。
   */
  const shareTo = (ch: ShareChannel): void => {
    const text = postedText(ch);
    toast(text);
    sound('share');
    announce(`${text}。`); // トーストは読み上げの対象外なので、読み上げの領域でも伝える
    if (!state.done.share) {
      set({ done: { ...state.done, share: true } });
      showPraise({
        kind: 'share',
        praise: PRAISE_SHARE,
        overHome: false, // 投稿のシートの上（ゲージは見えない）
        size: 64,
        say: VOICES[state.oshiId].say.share(),
        ms: 2600,
        reduceMs: 2000,
        live: '投稿してくれてありがとう。応援が広がっています。',
        liveAfter: 900,
        onEnd: () => unlockGift(1),
      });
    }
  };
  /** ホームの主のボタン。ゲージの下の 1 つの行動を、その場で進める（別の画面で選ばせない）。 */
  const homePrimary = (): void => {
    const v = view();
    const a = homeActionOf(v);
    switch (a.id) {
      case 'apply':
        if (v.target) applyCourse(v.target.id);
        break;
      case 'main':
      case 'teiki':
        runAcct(a.id, 'home');
        break;
      case 'deposit':
        openDeposit(); // 額の入力がすぐ出る（目指すコースにちょうど届く額が、初めから入っている）
        break;
      case 'friend':
        callFriends();
        break;
      case 'notice':
        notifyFriends();
        break;
      case 'share':
        openShare('share');
        break;
      case 'again':
        openShare('friend');
        break;
    }
  };

  /* ---------- はじめの画面（推し → コースの 2 つ。市は久留米市に固定） ---------- */
  const startPick = (kind: 'oshi' | 'seat', v: string): void => {
    const s = state.start;
    if (!s) return;
    set({
      start: {
        ...s,
        touched: true,
        ...(kind === 'oshi' ? { oshiId: v as typeof s.oshiId } : {}),
        ...(kind === 'seat' ? { seat: v as typeof s.seat } : {}),
      },
    });
  };
  const STEP_TITLES = ['推しを選ぶ', '目指すコースを選ぶ'] as const;
  const startStep = (n: 0 | 1): void => {
    const s = state.start;
    if (!s) return;
    set({ start: { ...s, step: n } });
    announce(`${n + 1} / 2。${STEP_TITLES[n]}`);
    // 2/2 で取るのは、これから申し込む公演（見ている公演は古いままのことがある。G2-04）
    if (n === 1) deps.fetch('course-select', performanceIdOf(s.oshiId, FAN_VENUE_ID));
  };
  const startBack = (): void => {
    const s = state.start;
    if (s && s.step > 0) startStep(0);
  };
  const startNext = (): void => {
    const s = state.start;
    if (!s) return;
    if (s.step < 1) startStep(1);
    else commitStart();
  };
  /**
   * 選び終えたら、ホームへ。初めは預金 0円・口座なしなので、まだ申し込めない。選んだコースは、目指すコースとして登録する
   * （ホームの主のボタンが、推し活定期をはじめる → 預金を積み増す → 申し込む、と案内する）。
   * 条件がそろっているコースは、その場で申し込みが確定する（事務所向けから戻ってきたときなど。普段は通らない）。
   */
  const commitStart = (): void => {
    const s = state.start;
    if (!s) return;
    const changedPid = performanceIdOf(s.oshiId, FAN_VENUE_ID) !== pidNow();
    set({ oshiId: s.oshiId, seat: s.seat, venueId: FAN_VENUE_ID, start: null });
    if (changedPid) deps.fetch('performance-changed');
    go('home');
    const k = courseOffersOf(state.venueId).find((c) => c.id === s.seat);
    if (!k) return;
    if (canApply(k, state.acct.deposit, state.acct.pay)) applyCourse(k.id);
    else {
      set({ aim: k.id });
      toast(`「${k.name}」を目指すコースにしました。申し込みは、条件がそろってからです`, 4200);
      const v = view();
      announce(
        `${artistView(state.oshiId).name}を${state.city}に呼ぶ。「${k.name}」を目指すコースにしました。申し込みはまだです。熱量は${v.heat.name}です。`,
      );
    }
  };

  /* ---------- リセット（デモ用）・やめる ---------- */
  const clearTimers = (): void => {
    timers.forEach(clearTimeout);
    timers.clear();
    calling = false;
    if (achTimer) clearTimeout(achTimer);
    achTimer = null;
    fxEnd.clear();
  };
  /** 初めの状態に戻す（人物の初めの値。タイマーを止めて、状態を作り直す。共有のメーターには触らない）。 */
  const backToStart = (): void => {
    clearTimers();
    state = { ...initialState(personaNo), live: '', soundOn: state.soundOn }; // 音のオン・オフは、リセットで変えない
    emit();
  };
  /** ファン向けだけを、はじめの画面に戻す（「リセット（デモ用）」）。 */
  const resetFan = (): void => {
    backToStart();
    toast('ファン向けを、はじめの画面に戻しました', 4000);
    announce('ファン向けを、はじめの画面に戻しました');
  };
  /** 事務所向けの「デモを最初に戻す」を受けたとき（連動）。ファン向けの表示だけ戻す（事務所向けの帯が知らせる）。 */
  const resetFanQuiet = (): void => {
    backToStart();
    announce('最初に戻しました');
  };
  /**
   * 操作が無いまま時間がたったとき（ひとり体験）。はじめの画面のまま何も選んでいなければ、戻すものが無いので何もしない。
   * それ以外は、ファン向けを初めの状態に戻す（理由の表示は、画面が見えるときに、呼んだ側が出す）。戻したか、を返す。
   */
  const resetForIdle = (): boolean => {
    const s = state.start;
    if (state.page === 'start' && s !== null && s.step === 0 && !s.touched) return false;
    backToStart();
    return true;
  };

  /**
   * 共有のメーターが初めに戻された（reset）と検知したとき（設計 D-18 の規則 10）。
   * 数えられていた自分の申し込みは「未申し込み」に戻し（同じコースを押し直して申し込める）、擬似の仲間の加算を消す。
   * まだ数えられていない申し込み（未送信・再送中）は消さない。達成した行動・開いた特典・呼んだ仲間・口座・演出の済みは変えない。
   */
  const serverReset = (counted: boolean): void => {
    set({ friends: 0, ...(counted ? { course: null } : {}) });
    if (counted) announce('共有のメーターが初めに戻りました。もう一度申し込めます。');
  };

  const openCancel = (): void => pushLayer({ kind: 'cancel' });
  const closeCarry = (): void => {
    if (!popLayer('carry')) return;
    go('home');
  };
  const closeCancel = (): void => {
    popLayer('cancel');
  };
  const doCancel = (): void => {
    if (state.course === null || view().status.established) {
      closeCancel();
      return;
    }
    popLayer('cancel');
    set({ course: null, aim: null });
    go('home');
    const say = VOICES[state.oshiId].say.quit();
    toast(
      `申し込みをやめました。確保は解除され、負担は0円です。もう一度申し込めます。${artistView(state.oshiId).name}より「${say}」`,
      5000,
    );
    announce(
      `申し込みをやめました。確保は解除され、負担は0円です。熱量は${view().heat.name}です。`,
    );
  };

  /* ---------- 「推し・条件の変更」（SP-25・SP-49。デモ用の操作） ---------- */
  /** 選んでいる最中の条件（市は久留米市に固定なので、いまの条件のまま）。 */
  const pendCond = (): Condition => condNow();
  const pickPend = (kind: 'oshi' | 'seat', v: string): void => {
    const p = state.pend;
    if (!p) return;
    const next = {
      ...p,
      ...(kind === 'oshi' ? { oshiId: v as Pend['oshiId'] } : {}),
      ...(kind === 'seat' ? { seat: v as Pend['seat'] } : {}),
    };
    // 条件がそろっていないコースは選べない（選んでいたら、通常の席に戻す）
    const k = condNow().courses.find((c) => c.id === next.seat);
    if (!k || !canApply(k, state.acct.deposit, state.acct.pay)) next.seat = 'normal';
    set({ pend: next });
  };
  /**
   * 条件を変える。開いた特典・達成の記録・呼んだ仲間の数・口座の設定は残し、
   * 申し込み（確保額）・80% の演出の済み・擬似の仲間・公演のメーターは、新しい条件で取り直す（共有のメーターへは送らない。決定 3）。
   */
  const applyChange = (): void => {
    const target = state.pend;
    if (!target) return;
    const before = view();
    const held = before.my?.price ?? 0;
    const changedPid = performanceIdOf(target.oshiId, FAN_VENUE_ID) !== pidNow();
    set({
      oshiId: target.oshiId,
      seat: target.seat,
      course: null,
      aim: null,
      friends: 0,
      milestoneShown: false,
      pend: null,
    });
    if (changedPid) deps.fetch('performance-changed');
    const v = view();
    const nk = courseOf(v.cond, target.seat);
    set({
      carry: {
        oshiName: artistView(state.oshiId).name,
        city: state.city,
        gifts: v.giftCount,
        doneCount: v.doneCount,
        doneNames: ACT_IDS.filter((id) => state.done[id]),
        called: state.called,
        deposit: state.acct.deposit,
        pay: state.acct.pay,
        held,
        seatPrice: nk.price,
        heatName: v.heat.name,
        venueName: v.cond.venue.name,
      },
    });
    pushLayer({ kind: 'carry' });
    announce('条件を変えました。引き継いだものの一覧を出しています。');
  };

  return {
    getState: (): FanState => state,
    subscribe: (l: () => void): (() => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    setEnv: (e: Env): void => {
      env = e;
    },
    view,
    dispose: clearTimers,
    pendCond,
    actions: {
      go,
      applyCourse,
      aimCourse,
      runAcct,
      acctDone,
      openShare,
      closeShare,
      shareTo,
      homePrimary,
      openDeposit,
      closeDeposit,
      callFriends,
      notifyFriends,
      closeGift,
      closeThanks,
      closeCarry,
      escape,
      showGift,
      hideFx,
      clearAch,
      startPick,
      startBack,
      startNext,
      resetFan,
      resetFanQuiet,
      resetForIdle,
      serverReset,
      openCancel,
      closeCancel,
      doCancel,
      pickPend,
      pendCond,
      applyChange,
      toast,
      announce,
      toggleSound: (): void => set({ soundOn: !state.soundOn }),
    },
  };
}

export type FanStore = ReturnType<typeof createFanStore>;
export type FanActions = FanStore['actions'];
