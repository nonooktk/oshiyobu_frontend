// 事務所向け（/）の ①⑤⑥ に、架空の札「架空（デモ用）」を付ける。⑤ には「会場の名前は実在・数字は架空」を添える
// （要件 R-16。仕様 4.3）。全画面の札「デモ用の架空データ」の文は、画面に 1 回だけのまま（I-101・G-09）
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

describe('事務所向けの ①⑤⑥ の架空の札', () => {
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

  it('① の札は、初めから出ている（地図の指標を替えても残る）', () => {
    render(<App />);
    expect(screen.getByTestId('fict-1').textContent).toBe('架空（デモ用）');
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(screen.getByTestId('fict-1').textContent).toBe('架空（デモ用）');
  });

  it('会場を選ぶと、⑤⑥ にも札が出て、⑤ に「会場の名前は実在・数字は架空」が出る', () => {
    render(<App />);
    expect(screen.queryByTestId('fict-5')).toBeNull();
    expect(screen.queryByTestId('fict-6')).toBeNull();
    pickBase();
    expect(screen.getByTestId('fict-5').textContent).toBe('架空（デモ用）');
    expect(screen.getByTestId('fict-6').textContent).toBe('架空（デモ用）');
    expect(screen.getByTestId('mix-note').textContent).toBe('会場の名前は実在・数字は架空');
  });

  it('札は見出しの外にあり、⑤⑥ の区画の名前（見出しの文字）は変わらない', () => {
    render(<App />);
    pickBase();
    expect(document.getElementById('j5')?.textContent).not.toContain('架空');
    expect(document.getElementById('j6')?.textContent).not.toContain('架空');
    expect(screen.getByRole('region', { name: /開催条件/ })).toBeTruthy();
    expect(screen.getByRole('region', { name: /満たせるか/ })).toBeTruthy();
  });

  it('全画面の札「デモ用の架空データ」の文は、会場を選んだあとも、画面に 1 回だけ', () => {
    render(<App />);
    pickBase();
    expect(screen.getAllByText('デモ用の架空データ')).toHaveLength(1);
    expect(screen.getAllByText('架空（デモ用）')).toHaveLength(3);
  });
});
