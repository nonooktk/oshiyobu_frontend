// 額の入力のシートの「収まり」（QA H-05・G2-14）。
// 上層: 幅 320 の低い画面でも、「閉じる」が常に見える（スクロールの外へ出ない）。「+10,000」を 1 回押しても、下のボタンが動かない
//       （続けて押した 2 回目が外れない）。
// jsdom は、見た目の大きさを測れない。ここでは、そのための作り（見出しの重複を出さない・行の場所を取っておく・「閉じる」を下端に貼る）を確かめる。
// 実際の大きさ（幅 320・375・390 の画面でのスクロール量・「閉じる」の位置・ボタンの動き）は、実ブラウザで測る（完了報告に載せる）。
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import { act, click, fireEvent, mountFan, screen, setupFanTest, within } from './helpers';

setupFanTest();

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const sheet = (): HTMLElement => screen.getByRole('dialog', { name: '預金を積み増す' });

async function toDepositSheet(): Promise<void> {
  mountFan('?p=4');
  click('次へ');
  click('このコースを目指して始める');
  fireEvent.click(screen.getByRole('button', { name: /^推し活定期をはじめる/ }));
  fireEvent.pointerDown(document.body);
  fireEvent.click(screen.getByRole('button', { name: /^預金を積み増す/ }));
  await settle();
}

beforeEach(() => {
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
});

describe('シートの中は、縦を詰める（見出し・説明・枠を、シートの枠と重ねない）', () => {
  it('見出し（預金を積み増す）は、シートの枠に 1 つだけ。カードの見出し（h3）と説明は出さない', async () => {
    await toDepositSheet();
    expect(within(sheet()).getAllByText('預金を積み増す')).toHaveLength(1);
    expect(within(sheet()).queryByRole('heading', { level: 3 })).toBeNull();
    expect(within(sheet()).queryByText('積み増す額を決めます。')).toBeNull();
    // 入力・足すボタン・よく使う額・閉じるは、そろっている
    expect(within(sheet()).getByRole('textbox', { name: '積み増す額（円）' })).toBeTruthy();
    expect(within(sheet()).getByRole('button', { name: '10,000円を積み増す' })).toBeTruthy();
    expect(within(sheet()).getByRole('button', { name: '閉じる' })).toBeTruthy();
  });
});

describe('「✓ n回積み増しました」の行は、初めから場所を取っておく（下のボタンが動かない）', () => {
  /** 入力欄のラベルの、すぐ上の行（「✓ n回積み増しました」の行）。 */
  const doneRow = (): Element | null =>
    within(sheet()).getByText('積み増す額（円）').closest('form')?.previousElementSibling ?? null;

  it('積み増す前から、行の要素がある（読み上げには出さない）。積み増すと、同じ要素に文が入る', async () => {
    await toDepositSheet();
    const before = doneRow();
    expect(before).not.toBeNull();
    expect(before?.getAttribute('aria-hidden')).toBe('true');
    expect(before?.textContent?.trim()).toBe('');
    fireEvent.click(within(sheet()).getByRole('button', { name: '10,000円を積み増す' }));
    const after = doneRow();
    expect(after).toBe(before); // 作り直していない（行が増えて、下のボタンが下がることがない）
    expect(after?.textContent).toBe('✓ 1回積み増しました');
    expect(after?.getAttribute('aria-hidden')).toBeNull(); // 文が入ったら、読み上げにも出す
  });
});

describe('「閉じる」は、スクロールの外へ出ない', () => {
  it('シートの「閉じる」の行に、下端へ貼る指定（position: sticky）がある。背景も付いて、下の内容が透けない', async () => {
    await toDepositSheet();
    const close = within(sheet()).getByRole('button', { name: '閉じる' });
    const row = close.parentElement as HTMLElement;
    const css = readFileSync('src/fan/fan.module.css', 'utf8');
    const stick = /\.sheetBtnsStick\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(stick).toMatch(/position:\s*sticky/);
    expect(stick).toMatch(/bottom:/);
    expect(stick).toMatch(/background:\s*var\(--surface\)/);
    // その指定が、この行に付いている（クラス名は CSS Modules が付け替える。名前に sheetBtnsStick を含む）
    expect(row.className).toMatch(/sheetBtnsStick/);
  });
});
