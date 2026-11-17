// 事務所向け（/）の条件の帯（要件 R-15・受け入れ V-10）。境目（預金額・熱量）を ⑥ から帯へ移した。
// 初めの位置に戻すは ⑥ に、条件を調整（費用・最低人数）は ⑤ に残す（既存のテスト I-07 が、費用の入力の知らせを、
// 判定の区画の中で探すため。担当者の決定。R-15 は一部）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pickBase = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};
const band = () => screen.getByTestId('cond-band');

describe('事務所向けの条件の帯', () => {
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

  it('帯は初めからある（札「条件」）。境目は、会場を選ぶまで出ない', () => {
    render(<App />);
    expect(within(band()).getByText('条件')).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('会場を選ぶと、境目（スライダーと数字の入力）が帯の中に出て、⑥ の中には無い', () => {
    render(<App />);
    pickBase();
    for (const name of ['預金額', '熱量']) {
      expect(within(band()).getByRole('slider', { name })).toBeTruthy();
      expect(within(band()).getByRole('spinbutton', { name })).toBeTruthy();
    }
    expect(within(screen.getByTestId('judge')).queryByRole('slider')).toBeNull();
  });

  it('帯の境目を動かすと、⑥ の 4 象限が目安に変わり、⑥ の「初めの位置に戻す」で戻る', () => {
    render(<App />);
    pickBase();
    fireEvent.change(within(band()).getByRole('slider', { name: '預金額' }), {
      target: { value: '25' },
    });
    expect(screen.getByTestId('quad-estimate')).toBeTruthy();
    const reset = within(screen.getByTestId('judge')).getByRole('button', {
      name: '初めの位置に戻す',
    });
    fireEvent.click(reset);
    expect(screen.queryByTestId('quad-estimate')).toBeNull();
  });

  it('「条件を調整」（費用・最低人数）は、⑤ に残り、帯には無い', () => {
    render(<App />);
    pickBase();
    expect(within(band()).queryByText('条件を調整')).toBeNull();
    expect(within(screen.getByTestId('judge')).getByText('条件を調整')).toBeTruthy();
  });
});
