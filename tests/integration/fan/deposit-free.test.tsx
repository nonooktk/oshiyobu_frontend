// 預金を積み増す額を、利用者が自由に入れられる（画面。「口座と預金」の画面）。統括の依頼:「額面を自由に指定できるようにしてほしい」。
// 入力欄（数字のキーボード）・足すボタン・よく使う額の小さいボタン。入力の決まり（1 円以上の整数。全角・カンマは直して受ける）に外れたら、
// 足さずに、理由を入力欄のそばに出し、読み上げにも伝える（role="alert"・aria-invalid・aria-describedby）。
// 足したあとは、預金の額とコースの条件がその場で変わる。閉じる・5 分・リセットで、預金も初めの額に戻る。
import { describe, expect, it, vi } from 'vitest';
import { getAppStore } from '../../../src/fan/store/FanProvider';
import {
  act,
  click,
  fireEvent,
  mountFan,
  openNextPage,
  screen,
  setupFanTest,
  within,
  joinFromPlans,
} from './helpers';

setupFanTest();

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};

/**
 * はじめの画面を進めて、推し活定期をはじめ、預金を seed 円にした状態（初めは口座なし・預金 0円。全人物で同じ）で、
 * 「口座と預金」の画面まで進む。seed の積み増しは、ストアの操作で入れる（画面の操作は、このファイルのテストと heat-flow が確かめる）。
 */
async function toAcct(search = '?p=1', seed = 15_000): Promise<void> {
  mountFan(search);
  click('次へ');
  joinFromPlans();
  act(() => {
    const { actions } = getAppStore();
    actions.runAcct('teiki', 'home');
    if (seed > 0) actions.runAcct('deposit', 'home', seed);
    actions.clearAch();
  });
  click('メニュー');
  await settle();
  click(/^口座と預金/);
  await settle();
}
const input = () => screen.getByRole('textbox', { name: '積み増す額（円）' }) as HTMLInputElement;
const type = (value: string): void => void fireEvent.change(input(), { target: { value } });
const addButton = () => screen.getByRole('button', { name: '積み増す' });
const add = (value: string): void => {
  type(value);
  fireEvent.click(addButton());
};
const quick = (label: string) => screen.getByRole('button', { name: `${label}円を積み増す` });

describe('入力欄の部品（スマホで数字のキーボードが出る・説明・仮の預金であること）', () => {
  it('ラベルつきの入力欄。数字のキーボード（inputmode="numeric"）・自動入力なし。初めから、目指すコースにちょうど届く額（あと 5,000円）が入っていて、エラーの印は無い', async () => {
    await toAcct();
    const el = input();
    expect(el.getAttribute('inputmode')).toBe('numeric');
    expect(el.getAttribute('type')).toBe('text'); // type="number" は、全角・カンマを受けられない
    expect(el.getAttribute('autocomplete')).toBe('off');
    expect(el.value).toBe('5000');
    expect(el.getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('入力欄のそばに、「デモ用の仮の預金で、実際の入金は行われない」説明があり、入力欄の説明（aria-describedby）になっている', async () => {
    await toAcct();
    const ids = (input().getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    expect(ids.length).toBeGreaterThan(0);
    const text = ids.map((id) => document.getElementById(id)?.textContent ?? '').join('');
    expect(text).toContain('デモ用の仮の預金です。実際の入金は行われません');
    expect(text).toContain('1円以上の整数');
    expect(text).toContain('合計 99,999,999円まで');
  });

  it('よく使う額の小さいボタンが 3 つ（+10,000・+50,000・+100,000）', async () => {
    await toAcct();
    for (const n of ['10,000', '50,000', '100,000']) {
      expect(quick(n).textContent).toBe(`+${n}`);
    }
  });
});

describe('足す → 預金の額と、コースの条件が、その場で変わる（人物 1）', () => {
  it('押す前に、いまの入力で「こうなります」（預金 ◯◯円 → ◯◯円・開くコース）が出る。入力が足せる額のときだけ', async () => {
    await toAcct();
    type('');
    expect(screen.queryByText('押すと、こうなります', { selector: '#ac-deposit p' })).toBeNull();
    type('5,000');
    const card = document.getElementById('ac-deposit') as HTMLElement;
    expect(within(card).getByText('押すと、こうなります')).toBeTruthy();
    expect(within(card).getByText('15,000円 → 20,000円')).toBeTruthy();
    type('abc');
    expect(within(card).queryByText('押すと、こうなります')).toBeNull();
  });
});

describe('足さない入力: 理由を入力欄のそばに出し、読み上げにも伝える', () => {
  it.each([
    ['', '金額を入れてください'],
    ['   ', '金額を入れてください'],
    ['abc', '数字だけで入れてください'],
    ['10円', '数字だけで入れてください'],
    ['0', '1円以上で入れてください'],
    ['-5', '1円以上で入れてください'],
    ['1.5', '整数で入れてください（1.5のような数は使えません）'],
    ['99,985,000', '預金は合計 99,999,999円までです。あと 99,984,999円まで足せます'],
  ])('%j → 足さずに「%s」', async (value, message) => {
    await toAcct();
    add(value);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(getAppStore().getState().acct.deposit).toBe(15_000); // 預金は変わらない
    expect(screen.getByText('✓ 1回積み増しました')).toBeTruthy(); // 初めの 15,000円の 1 回のまま（増えていない）
    // 入力欄の印と説明: aria-invalid・aria-describedby に、理由の文の要素が入る
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(input().getAttribute('aria-describedby')?.split(' ')).toContain(alert.id);
    // 入力欄のそば（同じ枠の中）に出る
    expect((document.getElementById('ac-deposit') as HTMLElement).contains(alert)).toBe(true);
  });

  it('同じ入力をもう一度送っても、理由は読み上げ直される（要素が作り直される）', async () => {
    await toAcct();
    add('abc');
    const first = screen.getByRole('alert');
    fireEvent.click(addButton());
    const second = screen.getByRole('alert');
    expect(second).not.toBe(first);
    expect(second.textContent).toBe(first.textContent);
  });

  it('エラーのあとも、入力した文字は残る（直して送れる）', async () => {
    await toAcct();
    add('1.5');
    expect(input().value).toBe('1.5');
  });
});

describe('上限（預金の合計が 99,999,999円を超えない）', () => {
  it('上限に近いとき、収まらないよく使う額のボタンだけが押せない', async () => {
    await toAcct();
    add('99,880,000'); // 15,000 + 99,880,000 = 99,895,000。残り 104,999円
    expect((quick('10,000') as HTMLButtonElement).disabled).toBe(false);
    expect((quick('100,000') as HTMLButtonElement).disabled).toBe(false);
    add('5,000'); // 残り 99,999円
    expect((quick('50,000') as HTMLButtonElement).disabled).toBe(false);
    expect((quick('100,000') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('次のアクションの「預金を積み増す」は、決まった額（＋◯◯円）ではなく、額の入力を開く', () => {
  it('押すと、額の入力のシートが開き、目指すコースにちょうど届く額（5,000円）が初めから入っている', async () => {
    mountFan('?p=1');
    click('次へ');
    joinFromPlans();
    act(() => {
      const { actions } = getAppStore();
      actions.runAcct('teiki', 'home');
      actions.runAcct('deposit', 'home', 15_000);
      actions.clearAch();
    });
    openNextPage();
    expect(screen.queryByRole('button', { name: /＋/ })).toBeNull(); // 決まった額の近道は無い
    fireEvent.click(screen.getByRole('button', { name: /^預金を積み増す/ }));
    await settle();
    expect(input().value).toBe('5000');
  });
});
