// ホームの主のボタン「預金を積み増す」から、額の入力が開く（ホームの上のシート。口座と預金の画面へは移らない）。
// 入力欄には、目指すコースの条件にちょうど届く額が、初めから入っている。足りない額は、足したあとも、あとどれだけかを自分の預金の話で出す。
// 条件に届いたら、シートが閉じて、主のボタンが「申し込む」に変わる。「口座と預金」の画面は、推し活定期が最初の入口。
import { describe, expect, it, vi } from 'vitest';
import {
  act,
  click,
  fireEvent,
  mountFan,
  passStartOnly,
  screen,
  setupFanTest,
  joinFromPlans,
} from './helpers';

setupFanTest();

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const input = () => screen.getByRole('textbox', { name: '積み増す額（円）' }) as HTMLInputElement;

describe('「口座と預金」の画面: 推し活定期が最初の入口（二重の入口にしない）', () => {
  it('推し活定期をはじめるまでは、メイン口座と預金は「先に、推し活定期をはじめます」。はじめると、預金の入力が出る', async () => {
    mountFan('?p=4');
    click('次へ');
    joinFromPlans();
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
    click(/^推しの変更/);
    await settle();
    expect(screen.queryByText('希望の市')).toBeNull();
    expect(screen.queryByRole('button', { name: '熊本市' })).toBeNull();
    expect(screen.getByText('推し')).toBeTruthy();
  });
});
