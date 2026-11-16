// 事務所向け（/）の強調で、会場を替えたときは、前の操作の強調と「前」を残さない（#26 の統括の指摘）。
// 前の推しのときに出た「前 187人」を、今の会場の数字と比べたように見せない。
// （今のデータでは、同じ市の会場をどう替えても、上乗せなど少なくとも 1 つの数字が変わる。
//   数字が 1 つも変わらない会場替えのときに消す守りは store.ts にあるが、画面では起きないので、ここでは試さない）
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pickBase = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};
const isChanged = (testId: string) =>
  screen.getByTestId(testId).closest('[data-changed="true"]') !== null;
const prevOf = (key: string) => document.querySelector(`[data-prev="${key}"]`)?.textContent ?? null;

describe('事務所向けの強調: 会場を替えたとき', () => {
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

  it('会場を替えると、前の推しのときの「見込み」の強調と「前」が消え、会場で変わった数字だけが強調される', () => {
    render(<App />);
    pickBase(); // 久留米シティプラザ Cボックス（区分 100）
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    expect(isChanged('expected')).toBe(true);
    expect(prevOf('expected')).not.toBeNull();
    const before = screen.getByTestId('expected').textContent;
    // 区分 100 のまま（到達ライン・必要人数は同じ）。キャパが違うので、上乗せだけが変わる
    fireEvent.click(screen.getByRole('button', { name: /RISE UP/ }));
    expect(screen.getByTestId('expected').textContent).toBe(before);
    expect(isChanged('expected')).toBe(false);
    expect(prevOf('expected')).toBeNull();
    expect(isChanged('verdict')).toBe(false);
    expect(isChanged('uplift-total')).toBe(true);
    expect(screen.getByTestId('change-live').textContent).not.toContain('見込み');
  });

  it('会場を替えたあと、推しを替えると、また「見込み」を強調する', () => {
    render(<App />);
    pickBase();
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    fireEvent.click(screen.getByRole('button', { name: /RISE UP/ }));
    fireEvent.click(screen.getByRole('button', { name: /Tech0/ }));
    expect(isChanged('expected')).toBe(true);
  });

  it('数字の変わらない操作（地図の指標の切り替え）では、これまでどおり強調を残す', () => {
    render(<App />);
    pickBase();
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(isChanged('expected')).toBe(true);
  });
});
