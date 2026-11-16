// 新しい流れ（docs/fan/要件.md）: 最安のプランで参加 → 預金でやること → SNSで広める／プランを上げる。
// 見ているのは、状態と流れ（ストア）。画面は tests/integration/fan/flow.test.tsx。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conditionOf } from '../../../src/core';
import { SOLO_FILL } from '../../../src/fan/domain/heat';
import {
  ENTRY_PLAN,
  PLAN_NAMES,
  PLAN_ORDER,
  backdropOf,
  depositTasksOf,
  homePhaseOf,
  isUpgrade,
  rewardOf,
  rewardsUpTo,
  taskDepositOf,
  upgradesOf,
} from '../../../src/fan/domain/plan';
import { FAN_VENUE_ID } from '../../../src/fan/domain/state';
import type { SoundCue } from '../../../src/fan/sound';
import { fundAndApply, harness, passStart, passStartOnly } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const cond = conditionOf(FAN_VENUE_ID);
const kinds = (h: ReturnType<typeof harness>): string[] => h.state().layers.map((l) => l.kind);
const phase = (h: ReturnType<typeof harness>) => homePhaseOf(h.state(), h.view().cond);

describe('プランの決まり（domain/plan.ts）', () => {
  it('順は 最安 → ゴールド → プラチナ → ダイヤモンド。core のコース 4 つと 1 対 1', () => {
    expect(PLAN_ORDER).toEqual(['normal', 'front', 'special', 'top']);
    expect(PLAN_ORDER.map((id) => PLAN_NAMES[id]).slice(1)).toEqual([
      'ゴールドプラン',
      'プラチナプラン',
      'ダイヤモンドプラン',
    ]);
    expect(cond.courses.map((k) => k.id).sort()).toEqual([...PLAN_ORDER].sort());
    expect(ENTRY_PLAN).toBe('normal');
  });
  it('上げられるのは、いまより上だけ（飛ばしてもよい）。参加の前は上げられない', () => {
    expect(isUpgrade(null, 'front')).toBe(false);
    expect(isUpgrade('normal', 'front')).toBe(true);
    expect(isUpgrade('normal', 'top')).toBe(true);
    expect(isUpgrade('front', 'front')).toBe(false);
    expect(isUpgrade('special', 'front')).toBe(false);
    expect(upgradesOf('normal')).toEqual(['front', 'special', 'top']);
    expect(upgradesOf('top')).toEqual([]);
  });
  it('特典: ゴールド ＝ 追加の画像、プラチナ ＝ 5秒の動画、ダイヤモンド ＝ 20秒の動画。最安には無い', () => {
    expect(rewardOf('normal')).toBeNull();
    expect(rewardOf('front')).toMatchObject({ kind: 'image' });
    expect(rewardOf('special')).toMatchObject({ kind: 'video', seconds: 5 });
    expect(rewardOf('top')).toMatchObject({ kind: 'video', seconds: 20 });
    expect(rewardsUpTo('top').map((r) => r.plan)).toEqual(['front', 'special', 'top']);
    expect(rewardsUpTo(null)).toEqual([]);
  });
  it('背景の段は、プランの順と同じ（0〜3）', () => {
    expect([null, ...PLAN_ORDER].map(backdropOf)).toEqual([0, 0, 1, 2, 3]);
  });
  it('預金でやることは 2 つ。預金の額は、最安のプランの core の条件', () => {
    expect(taskDepositOf(cond)).toBe(cond.courses.find((k) => k.id === 'normal')?.deposit);
    const t = depositTasksOf({ done: {}, acct: { pay: false, deposit: 0, times: 0 } }, cond);
    expect(t.map((x) => [x.id, x.ok])).toEqual([
      ['teiki', false],
      ['deposit', false],
    ]);
  });
});

describe('参加（最安のプラン。預金の条件は見ない）', () => {
  it('はじめの画面を進めると、参加の確認の枠が出る。まだ参加していない・通信もしない', () => {
    const h = harness(4, { solo: true });
    h.a.startNext();
    h.a.startNext();
    expect(kinds(h)).toEqual(['confirm']);
    expect(h.state().course).toBeNull();
    expect(h.state().page).toBe('start');
    expect(h.joins).toEqual([]);
  });
  it('上位のプランは、はじめの画面では選べない', () => {
    const h = harness(4, { solo: true });
    h.a.startNext();
    for (const id of ['front', 'special', 'top']) h.a.startPick('seat', id);
    expect(h.state().start?.seat).toBe('normal');
  });
  it('確認を閉じると、参加しないまま、はじめの画面に残る', () => {
    const h = harness(4, { solo: true });
    h.a.startNext();
    h.a.startNext();
    h.a.closeJoinConfirm();
    expect(kinds(h)).toEqual([]);
    expect(h.state().course).toBeNull();
    expect(h.state().page).toBe('start');
  });
  it('「参加する」で、預金 0円・口座なしのまま、最安のプランで参加してホームへ。称賛が 1 回出る', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    expect(h.state().course).toBe('normal');
    expect(h.state().acct).toMatchObject({ deposit: 0, pay: false });
    expect(h.state().page).toBe('home');
    expect(kinds(h)).toEqual(['fx']);
    expect(phase(h)).toBe('tasks');
    vi.advanceTimersByTime(2600);
    expect(kinds(h)).toEqual([]);
    expect(h.state().held).toBe(false);
  });
  it('「参加する」を続けて押しても、参加は 1 回だけ（演出も 1 つ）', () => {
    const h = harness(4, { solo: true });
    h.a.startNext();
    h.a.startNext();
    h.a.joinPlan();
    h.a.joinPlan();
    h.a.joinPlan();
    expect(h.joins).toHaveLength(1);
    expect(kinds(h)).toEqual(['fx']);
  });
});

describe('預金でやること → ホームの段階', () => {
  it('2 つとも済むまでは tasks。済むと grow（SNSで広める・プランを上げる）', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    vi.advanceTimersByTime(2600);
    h.a.runAcct('teiki', 'acct');
    expect(phase(h)).toBe('tasks');
    h.a.runAcct('deposit', 'acct', taskDepositOf(cond) - 1);
    expect(phase(h)).toBe('tasks');
    h.a.runAcct('deposit', 'acct', 1);
    expect(phase(h)).toBe('grow');
    expect(h.state().ach?.sub).toContain('預金でやることが、すべて済みました');
  });
  it('預金でやることが済む前は、プランを上げるシートは開かず、プランも上がらない', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    vi.advanceTimersByTime(2600);
    h.a.openUpgrade();
    h.a.upgradePlan('front');
    expect(kinds(h)).toEqual([]);
    expect(h.state().course).toBe('normal');
  });
});

describe('プランを上げる', () => {
  const ready = (sounds?: SoundCue[]) => {
    const h = harness(4, { solo: true, ...(sounds ? { sounds } : {}) });
    passStart(h);
    vi.advanceTimersByTime(4000);
    h.a.clearAch();
    return h;
  };
  it('ゴールドへ: 条件（預金・メイン口座）もそろい、特別な演出のあとに、特典の贈呈が出る', () => {
    const h = ready();
    h.a.openUpgrade();
    expect(kinds(h)).toEqual(['upgrade']);
    h.a.upgradePlan('front');
    const k = cond.courses.find((c) => c.id === 'front');
    expect(h.state().course).toBe('front');
    expect(h.state().acct.deposit).toBe(k?.deposit);
    expect(h.state().acct.pay).toBe(true);
    const top = h.state().layers.at(-1);
    expect(top?.kind === 'fx' && top.fx.kind).toBe('upgrade');
    expect(top?.kind === 'fx' && top.fx.strong).toBe(true);
    vi.advanceTimersByTime(3300);
    expect(h.state().layers).toEqual([{ kind: 'reward', plan: 'front' }]);
    h.a.closeReward();
    expect(kinds(h)).toEqual([]);
    expect(h.state().held).toBe(false);
  });
  it('飛ばしてダイヤモンドへ上げられる。上げたあとは、下のプランへは変えられない', () => {
    const h = ready();
    h.a.upgradePlan('top');
    vi.advanceTimersByTime(3300);
    h.a.closeReward();
    expect(h.state().course).toBe('top');
    h.a.upgradePlan('front');
    h.a.openUpgrade();
    expect(h.state().course).toBe('top');
    expect(kinds(h)).toEqual([]);
  });
  it('続けて押しても、上がるのは 1 段だけ（演出の最中は受けない）', () => {
    const h = ready();
    h.a.upgradePlan('front');
    h.a.upgradePlan('special');
    h.a.upgradePlan('top');
    expect(h.state().course).toBe('front');
    expect(kinds(h)).toEqual(['fx']);
  });
  it('預金が多い人は、上げても預金が減らない', () => {
    const h = ready();
    h.a.runAcct('deposit', 'acct', 5_000_000);
    h.a.clearAch();
    const before = h.state().acct.deposit;
    h.a.upgradePlan('front');
    expect(h.state().acct.deposit).toBe(before);
  });
  it('「特典を見る」で、いまのプランの特典をもう一度出せる。最安のプランでは出ない', () => {
    const h = ready();
    h.a.showReward();
    expect(kinds(h)).toEqual([]);
    h.a.upgradePlan('special');
    vi.advanceTimersByTime(3300);
    h.a.closeReward();
    h.a.showReward();
    expect(h.state().layers).toEqual([{ kind: 'reward', plan: 'special' }]);
  });
});

describe('熱量（ひとり体験）は「FEVER 目前」・ゲージ 8 割のまま動かない', () => {
  it('開いた直後から、参加・預金・SNS・プランを上げる、のどの時点でも同じ', () => {
    const h = harness(4, { solo: true });
    const seen: [string, number][] = [];
    const rec = (): void => {
      const v = h.view().heat;
      seen.push([v.name, Math.round(v.fill * 1000) / 1000]);
    };
    rec();
    passStartOnly(h);
    vi.advanceTimersByTime(2600);
    rec();
    fundAndApply(h);
    rec();
    h.a.clearAch();
    h.a.openShare('share');
    h.a.shareTo('x');
    vi.advanceTimersByTime(3000);
    h.a.closeShare();
    rec();
    h.a.upgradePlan('top');
    vi.advanceTimersByTime(3300);
    rec();
    expect(new Set(seen.map((s) => s.join('/'))).size).toBe(1);
    expect(seen[0]).toEqual(['FEVER 目前', SOLO_FILL]);
    expect(h.view().status.established).toBe(false);
  });
});

describe('音（G-04）: 参加 ＝ join、SNS で広めた瞬間 ＝ friend、プランを上げた瞬間 ＝ fever', () => {
  it('それぞれ、その瞬間に 1 回だけ。待っている間は鳴らない', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    h.a.startNext();
    h.a.startNext();
    expect(sounds).toEqual([]);
    h.a.joinPlan();
    expect(sounds).toEqual(['join']);
    vi.advanceTimersByTime(60_000);
    expect(sounds).toEqual(['join']);
    fundAndApply(h);
    h.a.clearAch();
    sounds.length = 0;
    h.a.openShare('share');
    h.a.shareTo('x');
    expect(sounds).toEqual(['friend']);
    vi.advanceTimersByTime(3000);
    h.a.shareTo('ig'); // 2 回目は、称賛の音ではなく、行動の音
    expect(sounds).toEqual(['friend', 'share']);
    h.a.closeShare();
    sounds.length = 0;
    h.a.upgradePlan('front');
    expect(sounds).toEqual(['fever']);
    vi.advanceTimersByTime(60_000);
    expect(sounds).toEqual(['fever']);
  });
});

describe('SNS で広める', () => {
  it('最初の 1 回だけ称賛の演出が出る。2 回目からは、トーストだけ。特典の絵（古い作り）は開かない', () => {
    const h = harness(4, { solo: true });
    passStart(h);
    vi.advanceTimersByTime(4000);
    h.a.clearAch();
    h.a.openShare('share');
    h.a.shareTo('x');
    expect(kinds(h)).toEqual(['share', 'fx']);
    expect(h.state().done.share).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(kinds(h)).toEqual(['share']);
    h.a.shareTo('fb');
    expect(kinds(h)).toEqual(['share']);
    expect(h.state().gifts).toEqual([false, false, false]);
  });
});

describe('リセット・やめる', () => {
  it('リセットで、プラン・預金・層・段階が、すべて初めに戻る', () => {
    const h = harness(4, { solo: true });
    passStart(h);
    vi.advanceTimersByTime(4000);
    h.a.upgradePlan('top');
    h.a.resetFan();
    const s = h.state();
    expect(s.course).toBeNull();
    expect(s.acct).toEqual({ pay: false, deposit: 0, times: 0 });
    expect(s.done).toEqual({});
    expect(s.layers).toEqual([]);
    expect(s.page).toBe('start');
    expect(s.held).toBe(false);
    vi.advanceTimersByTime(10_000); // 残っていたタイマーで、特典の層が出てこない
    expect(h.state().layers).toEqual([]);
  });
  it('参加をやめたあとは、「参加するプランを選ぶ」で、プランを選ぶ画面に戻れる', () => {
    const h = harness(4, { solo: true });
    passStartOnly(h);
    vi.advanceTimersByTime(2600);
    h.a.openCancel();
    h.a.doCancel();
    expect(phase(h)).toBe('start');
    h.a.rejoin();
    expect(h.state().page).toBe('start');
    expect(h.state().start?.step).toBe(1);
    h.a.startNext();
    expect(kinds(h)).toEqual(['confirm']);
  });
});
