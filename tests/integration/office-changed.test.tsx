// 事務所向け（/）の、変わった数字の強調（要件 R-14・受け入れ V-08。仕様 2.2）
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
/** その数字が強調されているか（data-testid の要素を包む強調の枠があるか） */
const isChanged = (testId: string) =>
  screen.getByTestId(testId).closest('[data-changed="true"]') !== null;
const prevOf = (key: string) => document.querySelector(`[data-prev="${key}"]`)?.textContent ?? null;

let fetchSpy: ReturnType<typeof vi.fn>;

describe('事務所向けの、変わった数字の強調', () => {
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

  it('初めて会場を選んだときは、どの数字も強調しない', () => {
    render(<App />);
    pickBase();
    expect(document.querySelector('[data-changed="true"]')).toBeNull();
    expect(document.querySelector('[data-prev]')).toBeNull();
  });

  it('V-08 推しを切り替えると、見込みに強調と「前 187人」が出る。到達ライン・必要人数は強調しない。数字そのものの文字は変えない', () => {
    render(<App />);
    pickBase();
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    expect(isChanged('expected')).toBe(true);
    expect(prevOf('expected')).toMatch(/^前 187人（[+−]\d+）$/);
    expect(screen.getByTestId('expected').textContent).toBe('120人'); // 前の値は、数字の要素の外に出す
    expect(isChanged('line')).toBe(false);
    expect(isChanged('need')).toBe(false);
    expect(isChanged('verdict')).toBe(true);
    expect(prevOf('level')).toBe('前 高');
    expect(isChanged('quad-hotRich')).toBe(true);
    expect(prevOf('quadHotRich')).toMatch(/^[+−]\d+$/);
  });

  it('V-08 費用の区分が違う会場に選び直すと、到達ライン・必要人数が強調され、前の推しのときの強調は消える', () => {
    render(<App />);
    // 福岡市の DRUM SON（区分 100）→ 推しを替える → music hall fragile（区分 30）
    fireEvent.click(screen.getByRole('button', { name: /^福岡市を選ぶ/ }));
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    expect(isChanged('expected')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /music hall fragile/ }));
    expect(isChanged('line')).toBe(true);
    expect(isChanged('need')).toBe(true);
    expect(prevOf('line')).toMatch(/^前 [\d,]+円（[+−][\d,]+）$/);
    expect(isChanged('expected')).toBe(false);
    expect(prevOf('expected')).toBeNull();
  });

  it('費用の区分が同じ会場に選び直したときは、数字が変わらないので、⑤ は強調しない', () => {
    render(<App />);
    pickBase(); // 久留米シティプラザ Cボックス（区分 100）
    fireEvent.click(screen.getByRole('button', { name: /RISE UP/ })); // 区分 100
    expect(isChanged('line')).toBe(false);
    expect(isChanged('need')).toBe(false);
  });

  it('数字の変わらない操作（地図の指標の切り替え）では、強調と前の値をそのまま残す', () => {
    render(<App />);
    pickBase();
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    const before = prevOf('expected');
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(prevOf('expected')).toBe(before);
    expect(isChanged('expected')).toBe(true);
  });

  it('「事務所向けだけ戻す」のあとは、強調しない。通信は 0 件', () => {
    render(<App />);
    pickBase();
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    fireEvent.click(screen.getByRole('button', { name: '事務所向けだけ戻す' }));
    pickBase();
    expect(document.querySelector('[data-changed="true"]')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
