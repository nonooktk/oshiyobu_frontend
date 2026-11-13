// ファン向けのストア。状態（端末の中だけ）と、申し込み・演出・特典・感謝の順番（タイマー）を持つ。
// 数字・成立の判定は core の関数（domain/view.ts 経由）。通信は adapter の joinPerformance だけ（呼ぶだけで待たない。N-21）。
import {
  TEIKI,
  achievementPct,
  canApply,
  conditionOf,
  courseOffersOf,
  crossedMilestone,
  nextDepositTarget,
  PERSONA_DEFAULT_NO,
  performanceIdOf,
  personaByNo,
} from '../../core';
import type { Condition, CourseId, PerformanceId } from '../../core';
import { artistView } from '../art/registry';
import { ACT_IDS, GIFT_ACTS, initialState, venueForCity } from '../domain/state';
import type {
  AcctId,
  ActId,
  AchSpec,
  Confetto,
  FanState,
  FxSpec,
  Layer,
  Page,
  Pend,
  ShareMode,
} from '../domain/state';
import { canApplyOf, condItems, courseOf, opensList, restText, viewOf } from '../domain/view';
import type { FanView, MeterIn } from '../domain/view';
import { buildPostText, shareUrlFacebook, shareUrlX } from '../domain/share';
import { yen } from '../text/format';
import { VOICES } from '../text/voices';

/** ストアが外から受ける、条件とメーターの最新値（Provider が描画のたびに渡す）。 */
export type Env = { cond: Condition; pid: PerformanceId; meter: MeterIn };

export type Deps = {
  /** 申し込みの送信（即座に戻る。数えられる前でも画面は先に進む）。 */
  join: (pid: PerformanceId) => void;
  /** 共有メーターの取得の依頼。 */
  fetch: (reason: 'open' | 'course-select' | 'performance-changed') => void;
  /** 動きを減らす設定か。 */
  reduceMotion: () => boolean;
  /** 別タブで開く（X・Facebook）。 */
  openWindow: (url: string) => void;
  /** 文面のコピー。成功したら true。 */
  copyText: (text: string) => Promise<boolean>;
  random: () => number;
};

export const defaultDeps = (partial: Pick<Deps, 'join' | 'fetch'>): Deps => ({
  ...partial,
  reduceMotion: () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  openWindow: (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  copyText: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
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
  let inviteTimer: ReturnType<typeof setTimeout> | null = null;
  let achTimer: ReturnType<typeof setTimeout> | null = null;
  let achFlashAt = -Infinity;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const fxEnd = new Map<number, () => void>();
  const listeners = new Set<() => void>();
  const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

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
  const view = (): FanView => {
    const pid = pidNow();
    const meter = env && env.pid === pid ? env.meter : { serverJoined: 0, counted: false };
    return viewOf(state, condNow(), meter);
  };

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

  /* ---------- 条件の達成のエフェクト（操作を止めない・押すと消える） ---------- */
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
  const showAch = (a: Omit<AchSpec, 'id' | 'ms' | 'flash' | 'confetti'>): void => {
    clearAch();
    if (state.layers.length) {
      flushAch();
      return;
    }
    const all = a.kind === 'all';
    const ms = reduce() ? (all ? 1500 : 1200) : all ? 2000 : 1600;
    // 閃光は、前の閃光から 0.35 秒以上あける（明暗の入れ替わりが 1 秒に 3 回を超えない）
    const t = now();
    const flash = !reduce() && t - achFlashAt > 350;
    if (flash) achFlashAt = t;
    set({
      ach: { ...a, id: ++seq, ms, flash, confetti: confetti(all ? 40 : 22, 0.9, 0.8, 0, 0.45) },
    });
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
    onEnd?: () => void;
  }): void => {
    const id = ++seq;
    const spec: FxSpec = {
      id,
      title: o.title,
      small: o.small,
      sub: o.sub,
      size: o.size,
      stroke: o.stroke,
      subSize: o.subSize,
      ms: o.ms,
      reduceMs: o.reduceMs,
      confetti: confetti(46, 1.6, 1.6, 0.2, 0.9),
      ...(o.say ? { say: o.say } : {}),
    };
    if (o.onEnd) fxEnd.set(id, o.onEnd);
    pushLayer({ kind: 'fx', fx: spec });
    announce(o.live);
    later(reduce() ? o.reduceMs : o.ms, () => hideFx(id));
  };
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
    else if (top.kind === 'cancel') closeCancel();
    else closeCarry();
  };

  /** 80% の演出（自分が申し込んだ直後にだけ出す。1 回だけ）。成立・人数だけ届いたときも、この 1 回で伝える。 */
  const showMilestone = (cb: () => void, withGift: boolean): void => {
    if (state.milestoneShown) {
      cb();
      return;
    }
    set({ milestoneShown: true });
    const v = view();
    const { pct, left, established, gathered } = v.status;
    const t = established
      ? { title: `${pct}%`, small: '成立！', sub: 'ライブの開催が決まりました', size: 104 }
      : gathered
        ? {
            title: `${pct}%`,
            small: '人数が集まった！',
            sub: 'あと少しの支援で決まります',
            size: 104,
          }
        : { title: '80%', small: '突破！', sub: `ライブ開催まで あと${left}人`, size: 120 };
    showFx({
      ...t,
      stroke: 12,
      subSize: 18,
      ms: 2500,
      reduceMs: 1500,
      ...(withGift ? { say: VOICES[state.oshiId].say.gift('特典 1/3') } : {}),
      live:
        (established
          ? `達成率が${pct}%に届きました。支援者は${v.status.supporters}人で、ライブの開催が決まりました。`
          : gathered
            ? `達成率が${pct}%に届きました。人数は集まりました。あと少しの支援で、開催が決まります。`
            : `80%に届きました。ライブ開催まで あと${left}人です。`) +
        (withGift ? 'ごほうびが開きました。特典 1/3。' : ''),
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
      ...(page === 'opt'
        ? { pend: { oshiId: state.oshiId, city: state.city, seat: state.seat } }
        : {}),
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
    later(reduce() ? 0 : 150, () => {
      if (!crosses()) {
        announce(
          `申し込みが確定しました。支援者は${view().status.supporters}人、達成率は${view().status.pct}%です。`,
        );
        after(false);
        return;
      }
      later(reduce() ? 0 : 500, () => {
        if (crosses()) showMilestone(() => after(true), first);
        else {
          announce(
            `申し込みが確定しました。支援者は${view().status.supporters}人、達成率は${view().status.pct}%です。`,
          );
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
    id === 'main'
      ? state.acct.pay
      : id === 'teiki'
        ? !!state.done.teiki
        : nextDepositTarget(state.acct.deposit) === undefined;

  const runAcct = (id: AcctId, from: Page): void => {
    if (acctDone(id)) return;
    clearAch();
    const v0 = view();
    const t = v0.joined ? null : v0.target;
    const d0 = state.acct.deposit;
    const p0 = state.acct.pay;
    const wasCk = t
      ? condItems(v0, t)
          .filter((i) => i.ok)
          .map((i) => i.id)
      : [];
    const wasOk = t ? canApplyOf(v0, t) : false;
    // 状態を進める（押すたびに、次に開くコースの預金までちょうど増える。擬似）
    const acct = { ...state.acct };
    if (id === 'main') acct.pay = true;
    else if (id === 'deposit') {
      acct.deposit = nextDepositTarget(d0) ?? d0;
      acct.times += 1;
    } else acct.deposit += TEIKI.monthlyYen;
    set({ acct, done: { ...state.done, [id]: true } });
    const v1 = view();
    const d1 = acct.deposit;
    const p1 = acct.pay;
    const cond = v1.cond;
    const opened = opensList(cond, d0, d1, p0, p1);
    const t1 = t ? courseOf(cond, t.id) : null;
    const nowOk = t1 ? canApplyOf(v1, t1) : false;
    const strong = !!t1 && !wasOk && nowOk;
    const crossed = cond.courses.some((k) => d0 < k.deposit && k.deposit <= d1);
    const gotCond = id === 'main' || crossed;
    const did =
      id === 'main'
        ? 'メイン口座にしました'
        : id === 'deposit'
          ? `預金が ${yen(d1)}になりました`
          : `推し活定期をはじめました（預金 ${yen(d0)} → ${yen(d1)}）`;
    let prog = '';
    if (strong && t1) prog = `${t1.name}に申し込めます`;
    else if (t1 && !nowOk) prog = `${t1.name}まで、残りは ${restText(t1, d1, p1)}`;
    else if (opened.length)
      prog = t1
        ? `${opened.join('・')}にも申し込めます`
        : `${opened.join('・')}の条件がそろいました`;
    const head = strong
      ? '条件がそろいました'
      : gotCond
        ? '条件を1つ達成！'
        : `預金が ${yen(d1 - d0)}増えました`;
    const detail = did + (prog ? '。' + prog : '');
    const nm =
      id === 'main'
        ? 'メイン口座にしました'
        : id === 'deposit'
          ? `預金 ${yen(d1)}に`
          : '推し活定期をはじめました';
    // 条件の ✓ が付く動きは、演出が薄れていく頃に始める（1 つ達成は 1.0 秒後・全部そろったときは 1.3 秒後。動きを減らす設定では 0）
    const delay = reduce() ? 0 : strong ? 1.3 : 1.0;
    const nowCk = t1
      ? condItems(v1, t1)
          .filter((i) => i.ok)
          .map((i) => i.id)
      : [];
    set({
      ckDelay: delay,
      fresh: {
        ids: nowCk.filter((x) => !wasCk.includes(x)),
        all: strong,
        act: id,
        from,
        nonce: ++seq,
      },
    });
    if (strong && t1)
      showAch({
        kind: 'all',
        title: '条件が',
        title2: 'そろいました！',
        small: nm,
        sub: `${t1.name}に申し込めます`,
      });
    else if (gotCond) showAch({ kind: 'one', title: '達成！', small: '条件を1つクリア', sub: nm });
    else
      showAch({
        kind: 'one',
        title: 'ナイス！',
        small: `預金が ${yen(d1 - d0)}増えました`,
        sub: nm,
      });
    toast(detail, 3600);
    announce(`${head}${/[！。]$/.test(head) ? '' : '。'}${detail}。`);
  };

  /* ---------- 共有 ---------- */
  const openShare = (mode: ShareMode): void => {
    pushLayer({ kind: 'share', mode });
  };
  const closeShare = (): void => {
    if (!popLayer('share')) return;
    // 閉じて 2 秒後に、デモ用の擬似の仲間が 1 人申し込む（1 回だけ。共有のメーターには送らない。決定 3）
    if (state.course !== null && !state.done.friend && !inviteTimer) {
      inviteTimer = setTimeout(() => {
        inviteTimer = null;
        friendJoins();
      }, 2000);
    }
  };
  const friendJoins = (): void => {
    if (state.course === null || state.done.friend) return;
    set({
      friends: state.friends + 1,
      called: state.called + 1,
      done: { ...state.done, friend: true },
    });
    if (state.page !== 'next') go('home');
    const s = view().status;
    toast('呼んだ仲間が申し込みました');
    announce(
      `呼んだ仲間が申し込みました。達成率は${s.pct}%です。` +
        (s.established
          ? '金額と人数がそろって、ライブの開催が決まりました。'
          : s.gathered
            ? '人数は集まりました。あと少しの支援で、開催が決まります。'
            : `ライブ開催まで あと${s.left}人です。`),
    );
    later(reduce() ? 0 : 700, () => unlockGift(2));
  };
  /** 共有ボタン。Instagram は、コピーできたか（できなければ、画面が投稿文の欄を選択状態にする。SP-90）を返す。 */
  const shareTo = async (ch: 'x' | 'fb' | 'ig'): Promise<boolean> => {
    let copied = true;
    const text = buildPostText(view());
    if (ch === 'x') {
      deps.openWindow(shareUrlX(text));
      toast('Xの投稿画面を別のタブで開きました');
    } else if (ch === 'fb') {
      deps.openWindow(shareUrlFacebook(text));
      toast('Facebookの投稿画面を別のタブで開きました');
    } else {
      const ok = await deps.copyText(text);
      copied = ok;
      toast(
        ok
          ? 'コピーしました。Instagramに貼り付けて投稿できます'
          : 'コピーできませんでした。選んだ文面を手動でコピーしてください',
      );
      if (!ok) announce('コピーできませんでした。選んだ文面を手動でコピーしてください');
    }
    if (!state.done.share) {
      set({ done: { ...state.done, share: true } });
      later(reduce() ? 0 : 400, () => unlockGift(1));
    }
    return copied;
  };

  /* ---------- はじめの画面 ---------- */
  const startPick = (kind: 'oshi' | 'city' | 'seat', v: string): void => {
    const s = state.start;
    if (!s) return;
    set({
      start: {
        ...s,
        touched: true,
        ...(kind === 'oshi' ? { oshiId: v as typeof s.oshiId } : {}),
        ...(kind === 'city' ? { city: v as typeof s.city } : {}),
        ...(kind === 'seat' ? { seat: v as typeof s.seat } : {}),
      },
    });
  };
  const STEP_TITLES = ['推しを選ぶ', '呼びたい市を選ぶ', '目指すコースを選ぶ'] as const;
  const startStep = (n: 0 | 1 | 2): void => {
    const s = state.start;
    if (!s) return;
    set({ start: { ...s, step: n } });
    announce(`${n + 1} / 3。${STEP_TITLES[n]}`);
    if (n === 2) deps.fetch('course-select');
  };
  const startBack = (): void => {
    const s = state.start;
    if (s && s.step > 0) startStep((s.step - 1) as 0 | 1);
  };
  const startNext = (): void => {
    const s = state.start;
    if (!s) return;
    if (s.step < 2) startStep((s.step + 1) as 1 | 2);
    else commitStart();
  };
  /** 選び終えたら、ホームへ。申し込めるコースは、その場で申し込みが確定する。足りない上位コースは、目指すコースとして登録する。 */
  const commitStart = (): void => {
    const s = state.start;
    if (!s) return;
    const changedPid = performanceIdOf(s.oshiId, venueForCity(state, s.city)) !== pidNow();
    set({
      oshiId: s.oshiId,
      seat: s.seat,
      city: s.city,
      venueId: venueForCity(state, s.city),
      custom: s.city !== s.baseCity,
      start: null,
    });
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
        `${artistView(state.oshiId).name}を${state.city}に呼ぶ。「${k.name}」を目指すコースにしました。申し込みはまだです。支援者は${v.status.supporters}人です。`,
      );
    }
  };

  /* ---------- リセット（デモ用）・やめる ---------- */
  const clearTimers = (): void => {
    timers.forEach(clearTimeout);
    timers.clear();
    if (inviteTimer) clearTimeout(inviteTimer);
    inviteTimer = null;
    if (achTimer) clearTimeout(achTimer);
    achTimer = null;
    fxEnd.clear();
  };
  /** ファン向けだけを、はじめの画面に戻す（人物の初めの値。共有のメーターには触らない）。 */
  const resetFan = (): void => {
    clearTimers();
    state = { ...initialState(personaNo), live: '' };
    emit();
    toast('ファン向けを、はじめの画面に戻しました', 4000);
    announce('ファン向けを、はじめの画面に戻しました');
  };
  /** 事務所向けの「デモを最初に戻す」を受けたとき（連動）。ファン向けの表示だけ戻す（事務所向けの帯が知らせる）。 */
  const resetFanQuiet = (): void => {
    clearTimers();
    state = { ...initialState(personaNo), live: '' };
    emit();
    announce('最初に戻しました');
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

  /**
   * 事務所向けと連動したとき（設計 D-44）。まだ選び直していなければ、はじめの画面の初めの値を、
   * 推し ＝ tech0・市と会場 ＝ 事務所向けの会場・預金とメイン口座 ＝ 人物 4 に取り替える（申し込み・達成・特典は取り直さない）。
   */
  const applyOffice = (venueId: Condition['venueId'] | null): void => {
    const s = state.start;
    if (venueId === null || !s || s.touched || state.custom || state.page !== 'start') return;
    const c = conditionOf(venueId);
    const p4 = personaByNo(PERSONA_DEFAULT_NO);
    set({
      oshiId: 'tech0',
      city: c.city,
      venueId,
      acct: { pay: p4.mainAccount, deposit: p4.depositYen, times: 0 },
      start: { ...s, oshiId: 'tech0', city: c.city, baseCity: c.city },
    });
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
      `申し込みをやめました。確保は解除され、負担は0円です。達成率は${view().status.pct}%です。`,
    );
  };

  /* ---------- 「推し・条件の変更」（SP-25・SP-49。デモ用の操作） ---------- */
  /** 選んでいる最中の条件（市を変えたときは、その市の会場の条件）。 */
  const pendCond = (): Condition => {
    const p = state.pend;
    if (!p) return condNow();
    return p.city === state.city ? condNow() : conditionOf(venueForCity(state, p.city));
  };
  const pickPend = (kind: 'oshi' | 'city' | 'seat', v: string): void => {
    const p = state.pend;
    if (!p) return;
    const next = {
      ...p,
      ...(kind === 'oshi' ? { oshiId: v as Pend['oshiId'] } : {}),
      ...(kind === 'city' ? { city: v as Pend['city'] } : {}),
      ...(kind === 'seat' ? { seat: v as Pend['seat'] } : {}),
    };
    // 条件がそろっていないコースは選べない（選んでいたら、通常の席に戻す）
    const pc = next.city === state.city ? condNow() : conditionOf(venueForCity(state, next.city));
    const k = pc.courses.find((c) => c.id === next.seat);
    if (!k || !canApply(k, state.acct.deposit, state.acct.pay)) next.seat = 'normal';
    set({ pend: next });
  };
  /**
   * 条件を変える。開いた特典・達成の記録・呼んだ仲間の数・口座の設定は残し、
   * 申し込み（確保額）・80% の演出の済み・擬似の仲間・公演のメーターは、新しい条件で取り直す（共有のメーターへは送らない。決定 3）。
   */
  const applyChange = (to?: {
    oshiId: Pend['oshiId'];
    venueId: Condition['venueId'];
    seat: Pend['seat'];
  }): void => {
    const p = state.pend;
    const target =
      to ?? (p ? { oshiId: p.oshiId, venueId: venueForCity(state, p.city), seat: p.seat } : null);
    if (!target) return;
    const before = view();
    const held = before.my?.price ?? 0;
    if (inviteTimer) clearTimeout(inviteTimer);
    inviteTimer = null;
    const changedPid = performanceIdOf(target.oshiId, target.venueId) !== pidNow();
    const venueCond = conditionOf(target.venueId);
    set({
      oshiId: target.oshiId,
      seat: target.seat,
      venueId: target.venueId,
      city: venueCond.city,
      custom: true,
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
        supporters: v.status.supporters,
        pct: v.status.pct,
        venueName: v.cond.venue.name,
        min: v.cond.min,
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
      serverReset,
      applyOffice,
      openCancel,
      closeCancel,
      doCancel,
      pickPend,
      pendCond,
      applyChange,
      toast,
      announce,
      friendJoins,
    },
  };
}

export type FanStore = ReturnType<typeof createFanStore>;
export type FanActions = FanStore['actions'];
