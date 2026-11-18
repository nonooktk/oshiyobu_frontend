// 新しい流れ（docs/fan/要件.md）を、画面の操作で確かめる（テスト観点の上層 ①〜⑤）。
//   ① 推しを選ぶ → 参加 → 預金でやること → SNSで広める／プランを上げる、が止まらずに通る
//   ② 上のプラン 3 つは、最初は見えるが選べない
//   ③ プランを上げると、背景と特典が変わる
//   ④ 開催熱量は 8 割付近のまま動かず、数字は出ない
//   ⑤ 参加の確認と SNS は表示だけで、外へ通信しない
// 共有の部品は本物で、サーバーだけ偽物（FakeApi）。ひとり体験は、サーバーを 1 回も呼ばない。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppStore, setSettleMsForTest } from '../../../src/fan/store/FanProvider';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  act,
  api,
  click,
  fireEvent,
  fundAndApply,
  joinFromPlans,
  layer,
  mountFan,
  passStart,
  passStartOnly,
  screen,
  setupFanTest,
  tick,
  within,
} from './helpers';

setupFanTest();

const NOTICE = '動作確認用のデモ画面です';
const BADGE = 'デモ用の架空データ';
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const state = () => getAppStore().getState();
const gauge = (): string =>
  screen.getByRole('img', { name: /^開催熱量。/ }).getAttribute('aria-label') ?? '';
const tier = (): string | null =>
  document.querySelector('[data-plan-tier]')?.getAttribute('data-plan-tier') ?? null;
const acts = (): string[] =>
  [...document.querySelectorAll('button[data-act]')].map((b) => b.getAttribute('data-act') ?? '');
const dialog = (name: string | RegExp): HTMLElement => screen.getByRole('dialog', { name });
const hasDialog = (name: string | RegExp): boolean =>
  screen.queryByRole('dialog', { name }) !== null;
/** プランを上げる: シートを開く → 押す → 特別な演出が終わるまで待つ → 特典の贈呈を閉じる */
async function upgradeTo(plan: string): Promise<void> {
  click(/^プランを上げる/);
  click(`${plan}に上げる`);
  await tick(3300);
  click('閉じる');
}

beforeEach(() => {
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 })); // ひとり体験（既定）
});

describe('① 通し: 推しを選ぶ → 参加 → 預金でやること → SNSで広める → プランを上げる', () => {
  it('画面の操作だけで、最後（ダイヤモンドプラン）まで止まらずに進む。サーバーは 1 回も呼ばない', async () => {
    mountFan('?p=4');
    click('KRS48');
    click('次へ');
    expect(screen.getByRole('heading', { name: '参加するプランを選ぶ' })).toBeTruthy();
    click(/で参加する$/);
    expect(dialog('参加しますか？').textContent).toContain('KRS48');
    click('参加する');
    expect(state().course).toBe('normal');
    expect(layer('fx')?.textContent).toContain('参加してくれてありがとう');
    await tick(2600);
    expect(acts()).toEqual(['tasks']); // 主のボタンは 1 つ
    click(/^預金でやることへ/);
    await settle();
    expect(document.querySelector('[data-tasks="todo"]')).not.toBeNull();
    click('推し活定期をはじめる');
    expect(document.querySelector('li[data-task="teiki"]')?.getAttribute('data-ok')).toBe('true');
    fireEvent.pointerDown(document.body);
    click('積み増す'); // 初めから、ちょうど届く額が入っている
    expect(document.querySelector('[data-tasks="done"]')).not.toBeNull();
    fireEvent.pointerDown(document.body);
    click('ホームへもどる');
    expect(acts()).toEqual(['share', 'upgrade']); // 済んだあとだけ、2 つ
    click(/^SNSで広める/);
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: 'X' }));
    expect(layer('fx')?.textContent).toContain('広がった！');
    await tick(3000);
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }));
    await upgradeTo('ゴールドプラン');
    await upgradeTo('プラチナプラン');
    await upgradeTo('ダイヤモンドプラン');
    expect(state().course).toBe('top');
    expect(acts()).toEqual(['share']); // いちばん上では、「プランを上げる」は出ない
    expect(api.log).toEqual([]);
  });

  it('預金でやることが済むまでは、ホームに「SNSで広める」「プランを上げる」は出ない', () => {
    mountFan('?p=4');
    passStartOnly();
    expect(acts()).toEqual(['tasks']);
    act(() => getAppStore().actions.runAcct('teiki', 'home'));
    fireEvent.pointerDown(document.body);
    expect(acts()).toEqual(['tasks']);
    expect(screen.queryByRole('button', { name: /仲間を呼ぶ/ })).toBeNull();
  });
});

describe('② 上のプラン 3 つは、最初は見えるが選べない', () => {
  it('プランは 4 つ並ぶ。選べるのは最安の 1 つで、上の 3 つは、押す場所が無い', () => {
    mountFan('?p=4');
    click('次へ');
    const items = [...document.querySelectorAll('li[data-plan]')];
    expect(items.map((li) => li.getAttribute('data-plan'))).toEqual([
      'normal',
      'front',
      'special',
      'top',
    ]);
    expect(items.map((li) => li.getAttribute('aria-disabled'))).toEqual([
      null,
      'true',
      'true',
      'true',
    ]);
    for (const name of ['ゴールドプラン', 'プラチナプラン', 'ダイヤモンドプラン'])
      expect(screen.getByText(name)).toBeTruthy();
    expect(document.querySelectorAll('li[data-plan] button, li[data-plan] img')).toHaveLength(0);
    expect(screen.getAllByText('参加のあとに、上げられます')).toHaveLength(3);
  });

  it('確認の枠で「もどる」を押すと、参加しないまま、プランの一覧に残る', () => {
    mountFan('?p=4');
    click('次へ');
    click(/で参加する$/);
    click('もどる');
    expect(hasDialog('参加しますか？')).toBe(false);
    expect(state().course).toBeNull();
    expect(screen.getByRole('heading', { name: '参加するプランを選ぶ' })).toBeTruthy();
  });
});

describe('③ プランを上げると、背景と特典が変わる', () => {
  it('背景の段が 0 → 1 → 2 → 3 と上がり、そのたびに、そのプランの特典の贈呈が出る', async () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    expect(tier()).toBe('0');
    const seen: [string | null, string][] = [];
    for (const [plan, kind, label] of [
      ['ゴールドプラン', 'image', '追加の画像'],
      ['プラチナプラン', 'video', '3秒の動画'],
      ['ダイヤモンドプラン', 'video', '6秒の動画'],
    ] as const) {
      click(/^プランを上げる/);
      click(`${plan}に上げる`);
      expect(layer('fx')?.textContent).toContain('プランアップ！');
      await tick(3300);
      const reward = dialog(`${plan}の特典`);
      expect(reward.textContent).toContain(label);
      expect(reward.querySelector('[data-reward]')?.getAttribute('data-reward')).toBe(kind);
      click('閉じる');
      seen.push([tier(), screen.getByText(plan).textContent ?? '']);
    }
    expect(seen.map((s) => s[0])).toEqual(['1', '2', '3']);
  });

  it('プランを上げるシートには、いまより上のプランだけが並ぶ。飛ばして上げられる', async () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    click(/^プランを上げる/);
    const names = (): (string | null)[] =>
      [...dialog('プランを上げる').querySelectorAll('li[data-plan]')].map((li) =>
        li.getAttribute('data-plan'),
      );
    expect(names()).toEqual(['front', 'special', 'top']);
    click('プラチナプランに上げる');
    await tick(3300);
    click('閉じる');
    click(/^プランを上げる/);
    expect(names()).toEqual(['top']);
  });

  it('「特典を見る」で、いまのプランの特典を、もう一度見られる', async () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: '特典を見る' })).toBeNull(); // 最安のプランには無い
    await upgradeTo('ゴールドプラン');
    click('特典を見る');
    expect(dialog('ゴールドプランの特典')).toBeTruthy();
  });
});

describe('④ 開催熱量は 8 割付近のまま動かず、数字は出ない', () => {
  it('参加の直後・預金でやることのあと・SNS のあと・プランを上げたあとで、メーターの読み上げもゲージの長さも同じ', async () => {
    mountFan('?p=4');
    passStartOnly();
    const fill = (): string =>
      (document.querySelector('[style*="--g"]') as HTMLElement | null)?.style.getPropertyValue(
        '--g',
      ) ?? '';
    const seen = [[gauge(), fill()]];
    fundAndApply();
    fireEvent.pointerDown(document.body);
    seen.push([gauge(), fill()]);
    click(/^SNSで広める/);
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: 'X' }));
    await tick(3000);
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }));
    seen.push([gauge(), fill()]);
    await upgradeTo('ダイヤモンドプラン');
    seen.push([gauge(), fill()]);
    expect(new Set(seen.map((s) => s.join('|'))).size).toBe(1);
    expect(seen[0]?.[0]).toBe('開催熱量。FEVER 目前。あと一歩');
    expect(seen[0]?.[0]).not.toMatch(/[0-9０-９]/);
    expect(getAppStore().view().status.established).toBe(false);
  });
});

describe('⑤ 参加の確認と SNS は表示だけで、外へ通信しない', () => {
  it('確認の枠に「実際の決済・入出金は行われません」と出る。押しても、サーバーも外のサイトも呼ばない', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    mountFan('?p=4');
    click('次へ');
    click(/で参加する$/);
    expect(dialog('参加しますか？').textContent).toContain('実際の決済・入出金は行われません');
    click('参加する');
    await tick(2600);
    fundAndApply();
    fireEvent.pointerDown(document.body);
    click(/^SNSで広める/);
    expect(layer('share')?.textContent).toContain('実際には投稿されません');
    for (const name of ['X', 'Instagram', 'Facebook'])
      fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name }));
    expect(open).not.toHaveBeenCalled();
    expect(api.log).toEqual([]);
  });

  it('参加の確認・プランを上げるシート・特典の贈呈・演出にも、2 枚の札が出る', async () => {
    mountFan('?p=4');
    click('次へ');
    click(/で参加する$/);
    const both = (el: Element | null): void => {
      expect(el?.textContent).toContain(NOTICE);
      expect(el?.textContent).toContain(BADGE);
    };
    both(dialog('参加しますか？'));
    click('参加する');
    both(layer('fx'));
    await tick(2600);
    fundAndApply();
    fireEvent.pointerDown(document.body);
    click(/^プランを上げる/);
    both(dialog('プランを上げる'));
    click('ゴールドプランに上げる');
    both(layer('fx'));
    await tick(3300);
    both(dialog('ゴールドプランの特典'));
  });
});

describe('連打・ダブルタップで、二重に進まない', () => {
  it.each([2, 5])('「参加する」を %i 回続けて押しても、参加は 1 回・演出は 1 つ', (n) => {
    mountFan('?p=4');
    click('次へ');
    click(/で参加する$/);
    const yes = screen.getByRole('button', { name: '参加する' });
    for (let i = 0; i < n; i += 1) fireEvent.click(yes);
    expect(document.querySelectorAll('[data-layer="fx"]')).toHaveLength(1);
    expect(state().done.join).toBe(true);
  });

  it.each([2, 5])('ホームの「プランを上げる」を %i 回続けて押しても、シートは 1 枚', (n) => {
    setSettleMsForTest(600);
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    const b = screen.getByRole('button', { name: /^プランを上げる/ });
    for (let i = 0; i < n; i += 1) fireEvent.click(b);
    expect(state().layers.filter((l) => l.kind === 'upgrade')).toHaveLength(1);
  });

  it('プランを上げた演出の最中は、ホームのボタンを押しても進まない。演出のあとは、また押せる', async () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    click(/^プランを上げる/);
    click('ゴールドプランに上げる');
    act(() => {
      const a = getAppStore().actions;
      a.press(a.openUpgrade);
      a.upgradePlan('top');
      a.press(() => a.openShare('share'));
    });
    expect(state().course).toBe('front');
    expect(state().layers.map((l) => l.kind)).toEqual(['fx']);
    await tick(3300);
    click('閉じる');
    click(/^プランを上げる/);
    expect(hasDialog('プランを上げる')).toBe(true);
  });
});

describe('リセット・閉じる', () => {
  it('ダイヤモンドプランまで進めても、「リセット（デモ用）」で、はじめの画面・最安のプランの前に戻る', async () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    await upgradeTo('ダイヤモンドプラン');
    click(/^リセット/);
    expect(state()).toMatchObject({ page: 'start', course: null, layers: [] });
    expect(state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
    expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
  });

  it('閉じる（pagehide）と、初めの状態に戻る', () => {
    mountFan('?p=4');
    passStart();
    act(() => void window.dispatchEvent(new Event('pagehide')));
    expect(state()).toMatchObject({ page: 'start', course: null });
  });

  it('プランの一覧・確認の枠は、Esc で閉じられる', () => {
    mountFan('?p=4');
    click('次へ');
    joinFromPlans();
    fundAndApply();
    fireEvent.pointerDown(document.body);
    click(/^プランを上げる/);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(hasDialog('プランを上げる')).toBe(false);
  });
});
