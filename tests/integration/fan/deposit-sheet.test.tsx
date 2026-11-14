// ホームの主のボタン「預金を積み増す」から、額の入力が開く（ホームの上のシート。口座と預金の画面へは移らない）。
// 入力欄には、目指すコースの条件にちょうど届く額が、初めから入っている。足りない額は、足したあとも、あとどれだけかを自分の預金の話で出す。
// 条件に届いたら、シートが閉じて、主のボタンが「申し込む」に変わる。「口座と預金」の画面は、推し活定期が最初の入口。
import { describe, expect, it, vi } from 'vitest';
import {
  act,
  click,
  fireEvent,
  layer,
  mountFan,
  passStartOnly,
  screen,
  setupFanTest,
  within,
} from './helpers';

setupFanTest();

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const input = () => screen.getByRole('textbox', { name: '積み増す額（円）' }) as HTMLInputElement;
const home = () => document.querySelector('[data-act]')?.getAttribute('data-act') ?? '';

async function toDepositSheet(seat?: string): Promise<void> {
  mountFan('?p=4');
  click('次へ');
  if (seat) {
    const card = screen
      .getAllByRole('button')
      .find((b) => b.hasAttribute('aria-pressed') && (b.textContent ?? '').includes(seat));
    fireEvent.click(card as HTMLElement);
  }
  click('このコースを目指して始める');
  fireEvent.click(screen.getByRole('button', { name: /^推し活定期をはじめる/ }));
  fireEvent.pointerDown(document.body);
  if (seat) {
    fireEvent.click(screen.getByRole('button', { name: /^メイン口座にする/ }));
    fireEvent.pointerDown(document.body);
  }
  fireEvent.click(screen.getByRole('button', { name: /^預金を積み増す/ }));
  await settle();
}

describe('主のボタン「預金を積み増す」→ 額の入力のシート', () => {
  it('ホームの上に、額の入力が開く。口座と預金の画面へは移らない。初めから、条件にちょうど届く額（通常の席 20,000円）が入っている', async () => {
    await toDepositSheet();
    expect(layer('sheet')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: '口座と預金' })).toBeNull();
    expect(input().value).toBe('20000');
    expect(
      within(layer('sheet') as HTMLElement).getByText(/通常の席まで、預金はあと 20,000円/),
    ).toBeTruthy();
    // よく使う額のボタンも使える
    expect(screen.getByRole('button', { name: '10,000円を積み増す' })).toBeTruthy();
  });

  it('前方の席を目指すときは、100,000円が入っている。そのまま足すと、シートが閉じて、主のボタンが「申し込む」になる', async () => {
    await toDepositSheet('前方の席');
    expect(input().value).toBe('100000');
    fireEvent.click(screen.getByRole('button', { name: '積み増す' }));
    expect(layer('sheet')).toBeNull();
    expect(home()).toBe('apply');
    expect(layer('ach')?.textContent).toContain('積み増しありがとう。');
    expect(layer('ach')?.textContent).toContain('申し込めるようになりました');
  });

  it('額を変えて足りない額（5,000円）を入れると、シートは開いたまま、あとの額（自分の預金の話）が出る。足して届くと閉じる', async () => {
    await toDepositSheet();
    fireEvent.change(input(), { target: { value: '5,000' } });
    fireEvent.click(screen.getByRole('button', { name: '積み増す' }));
    expect(layer('sheet')).not.toBeNull();
    expect(home()).toBe('deposit');
    expect(
      within(layer('sheet') as HTMLElement).getByText(/通常の席まで、預金はあと 15,000円/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '10,000円を積み増す' }));
    fireEvent.click(screen.getByRole('button', { name: '10,000円を積み増す' }));
    expect(layer('sheet')).toBeNull(); // 5,000 + 10,000 + 10,000 = 25,000円（条件の 20,000円に届いた）
    expect(home()).toBe('apply');
  });

  it('決まりに外れた額（abc）は、足さずに理由を出す。シートは開いたまま', async () => {
    await toDepositSheet();
    fireEvent.change(input(), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: '積み増す' }));
    expect(screen.getByRole('alert').textContent).toBe('数字だけで入れてください');
    expect(layer('sheet')).not.toBeNull();
  });
});

describe('「口座と預金」の画面: 推し活定期が最初の入口（二重の入口にしない）', () => {
  it('推し活定期をはじめるまでは、メイン口座と預金は「先に、推し活定期をはじめます」。はじめると、預金の入力が出る', async () => {
    mountFan('?p=4');
    click('次へ');
    click('このコースを目指して始める');
    click('メニュー');
    await settle();
    click(/^口座と預金/);
    await settle();
    expect(screen.getByText('口座をお持ちでない方の入口')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: '積み増す額（円）' })).toBeNull();
    fireEvent.click(
      screen.getAllByRole('button', { name: '推し活定期をはじめる' })[0] as HTMLElement,
    );
    expect(input().value).toBe('20000');
  });
});

describe('市を選ぶ入口は、ファン向けのどこにも無い', () => {
  it('推し・条件の変更に、希望の市の選択が無い。会場は久留米のまま', async () => {
    mountFan('?p=4');
    passStartOnly();
    click('メニュー');
    await settle();
    click(/^推し・条件の変更/);
    await settle();
    expect(screen.queryByText('希望の市')).toBeNull();
    expect(screen.queryByRole('button', { name: '熊本市' })).toBeNull();
    expect(screen.getByText('推し')).toBeTruthy();
  });
});
