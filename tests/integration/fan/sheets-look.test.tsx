// 参加の確認・プランを上げる・特典の 3 つの窓の見た目の作り込み（見た目だけの変更）で、
// テストと発表の通し確認が頼りにしている目印・札・文が、消えずに残っていることを確かめる。
//   ① 3 つの窓に、取っ手（飾り。読み上げない）と札 2 枚がある
//   ② 参加の確認: 目印・推しの名前・プランの名前・確保する額・「実際の決済・入出金は行われません」・ボタン 2 つ
//   ③ プランを上げる: 行は上のプランだけで、各行にボタン 1 つ・特典の行・宝石の印（上のプランほど多い）
//   ④ 特典: 額縁にプランの印（data-reward-plan）・素材の種類（data-reward）・素材が無い間の仮の表示
// 色・形そのものは jsdom では見えない。ここでは、見た目を引く目印と、画面に出る文を見る。
import { describe, expect, it } from 'vitest';
import {
  click,
  fireEvent,
  mountFan,
  passStart,
  screen,
  setupFanTest,
  tick,
  within,
} from './helpers';

setupFanTest();

const NOTICE = '動作確認用のデモ画面です';
const BADGE = 'デモ用の架空データ';
const dialog = (name: string): HTMLElement => screen.getByRole('dialog', { name });

/** 窓の取っ手（飾り）。CSS Modules のクラス名は、もとの名前を含む */
const grip = (el: HTMLElement): Element | null => el.querySelector('[class*="sheetGrip"]');

/** 窓に、取っ手と札 2 枚がある */
function expectSheetFrame(el: HTMLElement): void {
  const g = grip(el);
  expect(g).not.toBeNull();
  expect(g?.getAttribute('aria-hidden')).toBe('true');
  expect(el.textContent).toContain(NOTICE);
  expect(el.textContent).toContain(BADGE);
}

describe('参加の確認・プランを上げる・特典の窓の見た目（目印・札・文が残る）', () => {
  it('② 参加の確認: 取っ手と札 2 枚。推し・プランの名前・確保する額・決済が無い一文・ボタン 2 つが残る', () => {
    mountFan('?p=4');
    click('次へ');
    click(/で参加する$/);
    const d = dialog('参加しますか？');
    expectSheetFrame(d);
    const body = d.querySelector('[data-layer-body="confirm"]');
    expect(body).not.toBeNull();
    expect(body?.textContent).toContain('Tech0サステナアイドルを久留米市に呼ぶ'); // ?p=4 の初めの推し
    expect(body?.textContent).toContain('ベーシックプラン');
    expect(body?.textContent).toContain('参加のときに確保する額');
    expect(body?.textContent).toMatch(/[\d,]+円/);
    expect(body?.textContent).toContain('実際の決済・入出金は行われません');
    expect(within(d).getByRole('button', { name: '参加する' })).toBeTruthy();
    expect(within(d).getByRole('button', { name: 'もどる' })).toBeTruthy();
  });

  it('③ プランを上げる: 取っ手と札 2 枚。上のプラン 3 つに、ボタン 1 つ・特典の行・宝石の印（1・2・3 個）', () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    click(/^プランを上げる/);
    const d = dialog('プランを上げる');
    expectSheetFrame(d);
    expect(d.querySelector('[data-layer-body="upgrade"]')).not.toBeNull();
    const rows = [...d.querySelectorAll<HTMLElement>('li[data-plan]')];
    expect(rows.map((li) => li.dataset.plan)).toEqual(['front', 'special', 'top']);
    const gems = rows.map((li) => {
      expect(li.querySelectorAll('button')).toHaveLength(1);
      expect(li.textContent).toContain('特典');
      const mark = li.querySelector('[class*="upGems"]');
      expect(mark?.getAttribute('aria-hidden')).toBe('true');
      return mark?.querySelectorAll('svg').length ?? 0;
    });
    expect(gems).toEqual([1, 2, 3]);
  });

  it('④ 特典: 取っ手と札 2 枚。額縁にプランの印・素材の種類の目印・素材が無い間の仮の表示が出る', async () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    for (const [plan, name, kind, label] of [
      ['front', 'ゴールドプラン', 'image', '追加の画像'],
      ['special', 'プラチナプラン', 'video', '3秒の動画'],
      ['top', 'ダイヤモンドプラン', 'video', '6秒の動画'],
    ] as const) {
      click(/^プランを上げる/);
      click(`${name}に上げる`);
      await tick(3300);
      const d = dialog(`${name}の特典`);
      expectSheetFrame(d);
      const body = d.querySelector('[data-layer-body="reward"]');
      expect(body?.getAttribute('data-reward')).toBe(kind);
      const frame = body?.querySelector('[data-reward-plan]');
      expect(frame?.getAttribute('data-reward-plan')).toBe(plan);
      expect(body?.textContent).toContain(`${label}が届きました。`);
      // 素材がまだ無いので、推しの絵（仮の表示）と、その一文が出る
      expect(frame?.querySelector('img')).not.toBeNull();
      expect(frame?.textContent).toContain(`${label}（準備中の仮の表示）`);
      click('閉じる');
    }
  });

  it('① 取っ手は 3 つの窓だけ。窓の外（ホーム）には出ない', () => {
    mountFan('?p=4');
    passStart();
    fireEvent.pointerDown(document.body);
    expect(document.querySelector('[class*="sheetGrip"]')).toBeNull();
  });
});
