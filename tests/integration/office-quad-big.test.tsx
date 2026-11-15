// 事務所向け（/）の 4 象限で、線を動かしている間は、右上の大きい数字を出さない（#24 の統括の指摘。案 2）。
// 大きい数字（core の見込み）と、カードの「いま呼べる 約N人」（目安）が、同じ画面で食い違わないようにする
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demandOf } from '../../src/core';
import { App } from '../../src/office/App';
import { quadPeopleAt } from '../../src/office/scatter';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pickBase = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};
const text = (testId: string) => screen.getByTestId(testId).textContent;
const big = () => screen.queryByTestId('quad-big');

describe('事務所向けの 4 象限の、右上の大きい数字', () => {
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

  it('線が初めの位置のときは、大きい数字と説明が出て、カードの「いま呼べる」と同じ値', () => {
    render(<App />);
    pickBase();
    const expected = demandOf('tech0', '久留米市').expected;
    expect(big()?.textContent).toContain(`${expected}人`);
    expect(big()?.textContent).toContain('熱量が高く、資金もある');
    expect(text('quad-hotRich')).toBe(`${expected}人`);
  });

  it('線を動かすと、大きい数字と説明を出さず、「いま呼べる 約N人」だけになる。見込み（横棒）と札は core の値のまま', () => {
    render(<App />);
    pickBase();
    const before = { expected: text('expected'), verdict: text('verdict') };
    fireEvent.change(screen.getByRole('slider', { name: '預金額' }), { target: { value: '25' } });
    expect(big()).toBeNull();
    expect(screen.queryByText('熱量が高く、資金もある')).toBeNull();
    const moved = quadPeopleAt('tech0', '久留米市', { deposit: 25, heat: 3 }).people.hotRich;
    expect(text('quad-hotRich')).toBe(`約${moved}人`);
    // core の見込みは、⑥ の横棒に「見込み 187人」のまま出ている
    expect(text('expected')).toBe(before.expected);
    expect(screen.getByTestId('expected').parentElement?.textContent).toBe(
      `見込み ${before.expected}`,
    );
    expect(text('verdict')).toBe(before.verdict);
  });

  it('「初めの位置に戻す」で、大きい数字が戻る', () => {
    render(<App />);
    pickBase();
    fireEvent.change(screen.getByRole('slider', { name: '熱量' }), { target: { value: '4' } });
    expect(big()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '初めの位置に戻す' }));
    expect(big()).not.toBeNull();
  });
});
