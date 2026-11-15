// 事務所向け（/）の 4 象限の線を動かす操作（要件 R-12・受け入れ V-07）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demandOf } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const KEYS = ['hotRich', 'hotPoor', 'coolRich', 'coolPoor'] as const;
const pickBase = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};
const text = (testId: string) => screen.getByTestId(testId).textContent ?? '';
const num = (testId: string) => Number(text(testId).replace(/[^0-9]/g, ''));
const slider = (name: string) => screen.getByRole('slider', { name });
const total = () => KEYS.reduce((s, k) => s + num(`quad-${k}`), 0);

let fetchSpy: ReturnType<typeof vi.fn>;

describe('事務所向けの 4 象限の線を動かす', () => {
  beforeEach(() => {
    officeStore.setState(initialOfficeState());
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    resetLinkForTest();
  });
  afterEach(() => {
    cleanup();
    resetLinkForTest();
    vi.unstubAllGlobals();
  });

  it('動かすと「目安（デモ）」が出て、右上の人数が変わり、4 つの合計は変わらない。見込み・札・上乗せは変わらない', () => {
    render(<App />);
    pickBase();
    expect(screen.queryByTestId('quad-estimate')).toBeNull();
    const before = {
      expected: text('expected'),
      verdict: text('verdict'),
      uplift: text('uplift-total'),
      hotRich: num('quad-hotRich'),
    };
    fireEvent.change(slider('預金額'), { target: { value: '40' } });
    expect(screen.getByTestId('quad-estimate').textContent).toContain('目安（デモ）');
    expect(text('quad-hotRich')).toMatch(/^約\d+人$/);
    expect(num('quad-hotRich')).toBeLessThan(before.hotRich);
    const moved = total();
    fireEvent.change(slider('熱量'), { target: { value: '3.5' } });
    expect(total()).toBe(moved);
    // 点線の脇に、今の値が数字で出る（説明の語は足さない）
    const figure = screen.getByRole('img', { name: /のファンの散布図/ });
    expect(within(figure).getByText('40万円')).toBeTruthy();
    expect(within(figure).getByText('3.5')).toBeTruthy();
    expect(text('expected')).toBe(before.expected);
    expect(text('verdict')).toBe(before.verdict);
    expect(text('uplift-total')).toBe(before.uplift);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('「初めの位置に戻す」で core の人数に戻り、「目安」が消える', () => {
    render(<App />);
    pickBase();
    const reset = screen.getByRole('button', { name: '初めの位置に戻す' });
    expect((reset as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(slider('預金額'), { target: { value: '30' } });
    expect((reset as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(reset);
    expect(screen.queryByTestId('quad-estimate')).toBeNull();
    const demand = demandOf('tech0', '久留米市');
    for (const key of KEYS) expect(text(`quad-${key}`)).toBe(`${demand.people[key]}人`);
  });

  it('数字の入力は、欄を離れたときに反映し、範囲の外は端に収める', () => {
    render(<App />);
    pickBase();
    const field = screen.getByRole('spinbutton', { name: '熱量' }) as HTMLInputElement;
    fireEvent.change(field, { target: { value: '9' } });
    expect(screen.queryByTestId('quad-estimate')).toBeNull(); // 打っている途中は、まだ反映しない
    fireEvent.blur(field);
    expect((slider('熱量') as HTMLInputElement).value).toBe('5');
    expect(field.value).toBe('5');
    expect(screen.getByTestId('quad-estimate')).toBeTruthy();
  });

  it('推しや市を切り替えても、線の位置は残る。「事務所向けだけ戻す」で初めに戻る', () => {
    render(<App />);
    pickBase();
    fireEvent.change(slider('預金額'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /^福岡市を選ぶ/ }));
    expect(officeStore.getState().quadLine).toEqual({ deposit: 25, heat: 3 });
    fireEvent.click(screen.getByRole('button', { name: '事務所向けだけ戻す' }));
    expect(officeStore.getState().quadLine).toEqual({ deposit: 15, heat: 3 });
  });

  it('情報の扱いに、線の位置が出る', () => {
    render(<App />);
    pickBase();
    fireEvent.change(slider('預金額'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: '情報の扱い' }));
    const items = within(screen.getByRole('dialog')).getByTestId('priv-items').textContent ?? '';
    expect(items).toContain('熱量と資金: 預金額 25万円・熱量 3');
  });
});
