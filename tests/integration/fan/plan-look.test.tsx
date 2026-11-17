// プランのカードの鍵と色（docs/fan/要件.md の D-14）を、画面の操作で確かめる。
//   ① 参加の前: 押せるのはベーシックだけ。上の 3 つは data-locked（鍵）がついて、中にボタンが無い
//   ② 預金でやることが済んだあと: 「プランを上げる」のシートで、上の 3 つに鍵が無く、押せる。ダイヤモンドへ直接上げられる
//   ③ ホームの背景の段（data-plan-tier）は、プランに合った値になる
//   ④ メニューのプランの画面: 預金でやることが済むまでは、上のプランに鍵。済むと、鍵が外れる
// 色そのもの（fan.module.css の「プランの色」の区画）は、jsdom では見えない。ここでは、色を引く目印（data-plan・data-locked）を見る。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppStore } from '../../../src/fan/store/FanProvider';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  act,
  click,
  fireEvent,
  fundAndApply,
  mountFan,
  passStart,
  passStartOnly,
  screen,
  setupFanTest,
  tick,
} from './helpers';

setupFanTest();

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const state = () => getAppStore().getState();
const tier = (): string | null =>
  document.querySelector('[data-plan-tier]')?.getAttribute('data-plan-tier') ?? null;
const cards = (root: ParentNode = document): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('li[data-plan]'),
];
/** プランの名前 → 鍵がかかっているか */
const locks = (root: ParentNode = document): Record<string, boolean> =>
  Object.fromEntries(cards(root).map((li) => [li.dataset.plan, li.dataset.locked === 'true']));

beforeEach(() => {
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 })); // ひとり体験（既定）
});

describe('プランのカードの鍵と色（D-14）', () => {
  it('① 参加の前は、押せるのがベーシックだけ。上の 3 つには鍵がつき、中にボタンが無い', () => {
    mountFan('?p=4');
    click('次へ');
    expect(locks()).toEqual({ normal: false, front: true, special: true, top: true });
    expect(document.querySelector('li[data-plan="normal"]')?.getAttribute('data-selected')).toBe(
      'true',
    );
    const locked = cards().filter((li) => li.dataset.locked === 'true');
    expect(locked).toHaveLength(3);
    for (const li of locked) {
      expect(li.querySelectorAll('button')).toHaveLength(0);
      expect(li.getAttribute('aria-disabled')).toBe('true');
      expect(li.querySelector('svg[aria-hidden="true"]')).not.toBeNull(); // 鍵の絵
      expect(li.textContent).toContain('ロック中'); // 読み上げ用の見えない文
    }
    expect(cards()[0]?.querySelector('svg')).toBeNull(); // ベーシックに鍵の絵は無い
    // 参加できるのは、下のボタン（ベーシックプラン）だけ
    expect(screen.getAllByRole('button', { name: /で参加する$/ })).toHaveLength(1);
  });

  it('② 預金でやることが済むと、「プランを上げる」のシートで上の 3 つに鍵が無く、押せる。ダイヤモンドへ直接上げられる', async () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    click(/^プランを上げる/);
    const sheet = screen.getByRole('dialog', { name: 'プランを上げる' });
    expect(locks(sheet)).toEqual({ front: false, special: false, top: false });
    for (const li of cards(sheet)) expect(li.querySelectorAll('button')).toHaveLength(1);
    expect(state().course).toBe('normal');
    click('ダイヤモンドプランに上げる'); // ゴールド・プラチナを飛ばして、直接
    expect(state().course).toBe('top');
    await tick(3300);
    click('閉じる');
    expect(tier()).toBe('3');
  });

  it('③ ホームの背景の段は、プランに合った値（ベーシック ＝ 0・ゴールド ＝ 1・プラチナ ＝ 2・ダイヤモンド ＝ 3）', async () => {
    mountFan('?p=4');
    passStartOnly();
    expect(state().course).toBe('normal');
    expect(tier()).toBe('0');
    fundAndApply();
    fireEvent.pointerDown(document.body);
    const seen: [string, string | null][] = [];
    for (const [plan, name] of [
      ['front', 'ゴールドプラン'],
      ['special', 'プラチナプラン'],
      ['top', 'ダイヤモンドプラン'],
    ] as const) {
      click(/^プランを上げる/);
      click(`${name}に上げる`);
      await tick(3300);
      click('閉じる');
      expect(state().course).toBe(plan);
      seen.push([plan, tier()]);
    }
    expect(seen).toEqual([
      ['front', '1'],
      ['special', '2'],
      ['top', '3'],
    ]);
  });

  it('④ メニューのプランの画面は、預金でやることが済むまで、上のプランに鍵がつく。済むと、鍵が外れる', async () => {
    mountFan('?p=4');
    passStartOnly();
    click('メニュー');
    await settle();
    click(/^プラン$/);
    await settle();
    expect(locks()).toEqual({ normal: false, front: true, special: true, top: true });
    for (const li of cards()) expect(li.querySelectorAll('button')).toHaveLength(0);
    act(() => getAppStore().actions.go('home'));
    fundAndApply();
    fireEvent.pointerDown(document.body);
    click('メニュー');
    await settle();
    click(/^プラン$/);
    await settle();
    expect(locks()).toEqual({ normal: false, front: false, special: false, top: false });
    expect(document.querySelector('li[data-plan="normal"]')?.getAttribute('data-mine')).toBe(
      'true',
    );
  });
});
