// 事務所向け（/）の ⑤ の「収支シミュレーター」のリンクに、「条件を調整」の 4 つの値を付ける（N-15。Issue #53 の統括の了承 2026-11-20）。
// - 直した値が、そのままリンクの cost に入る（会場費・制作費・移動・宿泊・利益の順）
// - シミュレーターの受け取る範囲（0〜999,999,999 円）の外の値があるときは、cost を付けない（会場の ID は付ける）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simulatorHref } from '../../src/office/adjust';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const link = () =>
  within(screen.getByTestId('judge'))
    .getByRole('link', { name: '収支シミュレーター' })
    .getAttribute('href');
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const pickCbox = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
  fireEvent.click(screen.getByText('条件を調整'));
};

describe('事務所向けの ⑤ から、条件を調整の値をシミュレーターへ渡す（N-15）', () => {
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

  it('V-37 会場費を 100,000円・利益を 400,000円に直すと、リンクの cost に、その値が入る', () => {
    render(<App />);
    pickCbox();
    type('会場費', '100000');
    type('利益', '400000');
    expect(link()).toBe('/simulator.html?venue=FUK-019&cost=100000,100000,120000,400000');
  });

  it('入力が検査に通らないあいだは、反映済みの値を渡す', () => {
    render(<App />);
    pickCbox();
    type('制作費', 'abc');
    expect(link()).toBe('/simulator.html?venue=FUK-019&cost=60000,100000,120000,305000');
  });

  it('シミュレーターの受け取る範囲（9 桁）を超える値があると、cost を付けない（会場の ID だけ）', () => {
    render(<App />);
    pickCbox();
    type('会場費', '1000000000');
    expect(link()).toBe('/simulator.html?venue=FUK-019');
  });

  it('リンクを作る関数は、範囲の端（0 円・999,999,999 円）を受け、範囲の外・整数でない値では cost を付けない', () => {
    const v = { venue: 0, prod: 999999999, travel: 0, hope: 0 };
    expect(simulatorHref('FUK-019', v)).toBe('/simulator.html?venue=FUK-019&cost=0,999999999,0,0');
    expect(simulatorHref('FUK-019', { ...v, venue: -1 })).toBe('/simulator.html?venue=FUK-019');
    expect(simulatorHref('FUK-019', { ...v, venue: 1.5 })).toBe('/simulator.html?venue=FUK-019');
  });
});
