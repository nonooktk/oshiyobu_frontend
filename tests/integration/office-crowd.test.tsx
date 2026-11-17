// 事務所向け（/）の ② 集まる人数（要件 R-04・R-06。受け入れ V-02。仕様 1.4）。
// 人数を決めると、③ の会場の候補を、キャパが人数に近い会場から出し、各カードに「キャパ ÷ 人数」を出す。
// 人数は会場の出し方にだけ使い、成立の最低人数とは別（確認 8）。⑤⑥ の数字は変わらず、強調もしない
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { venuesOf } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const choose = (city: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
const side = (city: string) =>
  screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement;
/** ③ の会場のボタンの名前（上から） */
const shown = (city: string) =>
  [...side(city).querySelectorAll('li > button')].map((b) => b.querySelector('span')?.textContent);
/** キャパが人数に近い順（同じ近さは、もとの順） */
const nearest = (city: Parameters<typeof venuesOf>[0], crowd: number) =>
  [...venuesOf(city)]
    .sort((a, b) => Math.abs(a.cap - crowd) - Math.abs(b.cap - crowd))
    .map((v) => v.name);
const crowdInput = () => screen.getByRole('spinbutton', { name: '集まる人数' }) as HTMLInputElement;
const preset = (n: number) =>
  within(screen.getByTestId('cond-band')).getByRole('button', { name: String(n) });

describe('事務所向けの ② 集まる人数', () => {
  beforeEach(() => {
    officeStore.setState(initialOfficeState());
    vi.stubGlobal('fetch', vi.fn());
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    resetLinkForTest();
  });
  afterEach(() => {
    cleanup();
    resetLinkForTest();
    vi.unstubAllGlobals();
  });

  it('② は条件の帯の中にあり、初めは決めていない。③ は core の順のまま、規模感は出ない', () => {
    render(<App />);
    expect(within(screen.getByTestId('cond-band')).getByText('集まる人数')).toBeTruthy();
    expect(crowdInput().value).toBe('');
    choose('福岡市');
    expect(shown('福岡市')).toEqual(venuesOf('福岡市').map((v) => v.name));
    expect(screen.queryByTestId('venue-ratio')).toBeNull();
  });

  it('V-02 よく使う値（300）を押すと、キャパが近い会場から出て、各カードに「キャパ ÷ 人数」が出る。候補の数は変わらない', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(preset(300));
    expect(preset(300).getAttribute('aria-pressed')).toBe('true');
    expect(shown('福岡市')).toEqual(nearest('福岡市', 300));
    expect(side('福岡市').querySelectorAll('li')).toHaveLength(venuesOf('福岡市').length);
    const ratios = screen.getAllByTestId('venue-ratio').map((e) => e.textContent);
    const caps = [...venuesOf('福岡市')]
      .sort((a, b) => Math.abs(a.cap - 300) - Math.abs(b.cap - 300))
      .map((v) => v.cap);
    expect(ratios).toEqual(caps.map((cap) => `キャパ ${cap} ÷ 300人 = ${(cap / 300).toFixed(2)}`));
    expect(screen.getByText(/集まる人数を 300人にしました/)).toBeTruthy();
  });

  it('押されている値をもう一度押すと、決めないに戻り、core の順に戻る', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(preset(300));
    fireEvent.click(preset(300));
    expect(officeStore.getState().crowd).toBeNull();
    expect(shown('福岡市')).toEqual(venuesOf('福岡市').map((v) => v.name));
    expect(screen.queryByTestId('venue-ratio')).toBeNull();
  });

  it('数字の入力は、欄を離れると反映する。空にすると決めないに戻る。受け付けない値（0・1.5・-5・20000）は、いまの値のまま', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.change(crowdInput(), { target: { value: '150' } });
    expect(officeStore.getState().crowd).toBeNull(); // 打っている途中は、まだ反映しない
    fireEvent.blur(crowdInput());
    expect(officeStore.getState().crowd).toBe(150);
    expect(shown('福岡市')).toEqual(nearest('福岡市', 150));
    // 数字の入力（type="number"）は、数字でない文字を空として扱う（ブラウザの決まり）ので、ここでは数字の誤りだけを試す
    for (const bad of ['0', '1.5', '-5', '20000']) {
      fireEvent.change(crowdInput(), { target: { value: bad } });
      fireEvent.blur(crowdInput());
      expect(officeStore.getState().crowd).toBe(150);
    }
    fireEvent.change(crowdInput(), { target: { value: '' } });
    fireEvent.keyDown(crowdInput(), { key: 'Enter' });
    expect(officeStore.getState().crowd).toBeNull();
  });

  it('市を替えても人数は残り、「事務所向けだけ戻す」で消える', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(preset(100));
    choose('久留米市');
    expect(officeStore.getState().crowd).toBe(100);
    expect(shown('久留米市')).toEqual(nearest('久留米市', 100));
    fireEvent.click(screen.getByRole('button', { name: '事務所向けだけ戻す' }));
    expect(officeStore.getState().crowd).toBeNull();
  });

  it('人数を変えても、⑤⑥ の数字は変わらず、強調もしない（確認 8）', () => {
    render(<App />);
    choose('久留米市');
    fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
    const before = ['expected', 'line', 'need', 'verdict'].map(
      (id) => screen.getByTestId(id).textContent,
    );
    fireEvent.click(preset(1000));
    expect(
      ['expected', 'line', 'need', 'verdict'].map((id) => screen.getByTestId(id).textContent),
    ).toEqual(before);
    expect(document.querySelector('[data-changed="true"]')).toBeNull();
  });

  it('「情報の扱い」に、集まる人数が出る', () => {
    render(<App />);
    fireEvent.click(preset(30));
    fireEvent.click(screen.getByRole('button', { name: '情報の扱い' }));
    expect(screen.getByTestId('priv-items').textContent).toContain('集まる人数: 30人');
  });
});
