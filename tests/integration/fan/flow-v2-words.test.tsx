// メニューの下の画面を、新しい流れの言い方と操作にそろえたことを確かめる。
//   ① 古い言い方（申し込む・コース・仲間を呼ぶ・特典 n/3・目指す）が、通しのどの画面にも出ない
//   ② 参加をやめたあと、プランへ直接入る道が無い（プランを選ぶ画面へ戻るだけ）
//   ③ 特典を閉じたら、ホームの主のボタンにフォーカスが戻る
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppStore, setSettleMsForTest } from '../../../src/fan/store/FanProvider';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  act,
  click,
  fundAndApply,
  mountFan,
  passStartOnly,
  screen,
  setupFanTest,
  tick,
} from './helpers';

setupFanTest();

const OLD = /申し込|コース|仲間を呼|仲間が|特典 ?\d\/3|開いた特典|目指す/;
const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const state = () => getAppStore().getState();
const MENU = ['貢献', 'プラン', '口座と預金', '支援の状況', 'しくみ', '推しの変更', '情報の扱い'];

/** メニューと、その下の画面を一巡して、画面の文字を集める。 */
async function walkMenu(tag: string, seen: [string, string][]): Promise<void> {
  click('メニュー');
  await settle();
  seen.push([`${tag} メニュー`, document.body.textContent ?? '']);
  for (const title of MENU) {
    click(title === 'プラン' ? /^プラン$/ : new RegExp(`^${title}`));
    await settle();
    seen.push([`${tag} ${title}`, document.body.textContent ?? '']);
    click('‹ メニュー');
  }
  click('参加をやめる');
  await settle();
  seen.push([`${tag} やめる確認`, document.body.textContent ?? '']);
}

beforeEach(() => {
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 })); // ひとり体験（既定）
  setSettleMsForTest(0);
});

describe('① 古い言い方が、通しのどの画面にも出ない', () => {
  it('参加の直後・預金でやることが済んだあと・参加をやめたあと', async () => {
    const seen: [string, string][] = [];
    mountFan();
    passStartOnly();
    seen.push(['参加の直後 ホーム', document.body.textContent ?? '']);
    await walkMenu('参加の直後', seen);
    click('やめない（戻る）');
    click('‹ ホーム');

    fundAndApply();
    seen.push(['済んだあと ホーム', document.body.textContent ?? '']);
    act(() => getAppStore().actions.go('next'));
    await settle();
    seen.push(['済んだあと 次のアクション', document.body.textContent ?? '']);
    act(() => getAppStore().actions.go('home'));
    await walkMenu('済んだあと', seen);
    act(() => getAppStore().actions.doCancel());
    await tick(100);
    seen.push(['やめたあと ホーム', document.body.textContent ?? '']);
    await walkMenu('やめたあと', seen);

    expect(seen.length).toBeGreaterThanOrEqual(28);
    const hits = seen.flatMap(([scene, text]) => {
      const m = text.match(OLD);
      return m ? [`${scene}: ${m[0]}`] : [];
    });
    expect(hits).toEqual([]);
  });
});

describe('② 参加をやめたあと、プランへ直接入る道が無い', () => {
  it('プランの画面と口座の画面には「参加するプランを選ぶ」だけが出て、押すとプランを選ぶ画面へ戻る', async () => {
    mountFan();
    passStartOnly();
    fundAndApply();
    act(() => getAppStore().actions.doCancel());
    expect(state().course).toBeNull();

    click('メニュー');
    await settle();
    click(/^プラン$/);
    await settle();
    expect(document.querySelectorAll('li[data-plan]')).toHaveLength(4);
    expect(document.querySelectorAll('li[data-plan] button')).toHaveLength(0);
    click('‹ メニュー');
    click(/^口座と預金$/);
    await settle();
    expect(document.querySelector('[data-tasks="closed"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: '推し活定期をはじめる' })).toBeNull();
    click('参加するプランを選ぶ');
    expect(state().page).toBe('start');
    expect(state().course).toBeNull();
  });

  it('次のアクションは、「参加するプランを選ぶ」の 1 つだけ', async () => {
    mountFan();
    passStartOnly();
    act(() => getAppStore().actions.doCancel());
    act(() => getAppStore().actions.go('next'));
    await settle();
    const rows = [...document.querySelectorAll('button')].filter((b) =>
      b.textContent?.startsWith('参加するプランを選ぶ'),
    );
    expect(rows).toHaveLength(1);
    act(() => rows[0]?.click());
    await tick(400);
    expect(state().page).toBe('start');
  });
});

describe('③ 特典を閉じたあとのフォーカス', () => {
  it('プランを上げて特典を閉じると、ホームの主のボタンにフォーカスが戻る', async () => {
    mountFan();
    passStartOnly();
    fundAndApply();
    click(/^プランを上げる/);
    click('ゴールドプランに上げる');
    await tick(3300);
    click('閉じる');
    const active = document.activeElement;
    expect(active?.getAttribute('data-act')).toMatch(/^(upgrade|share)$/);
  });

  it('貢献の画面に、プランごとの特典が 3 つ並び、受け取った分だけ印がつく', async () => {
    mountFan();
    passStartOnly();
    fundAndApply();
    act(() => getAppStore().actions.upgradePlan('special'));
    await tick(3300);
    click('閉じる');
    click('メニュー');
    await settle();
    click(/^貢献$/);
    await settle();
    const rows = [...document.querySelectorAll('[data-reward-row]')];
    expect(rows.map((r) => r.getAttribute('data-reward-row'))).toEqual(['front', 'special', 'top']);
    expect(rows.map((r) => /受け取りました/.test(r.textContent ?? ''))).toEqual([
      true,
      true,
      false,
    ]);
  });
});
