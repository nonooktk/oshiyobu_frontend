// 事務所向け（/）の画面の文字（2026-11-20。docs/office/要件.md の N5-3。G-31 の文字の PR）
// - ④ を外したので、見出しの番号を付け替えた: 開催条件 4・満たせるか 5（識別子 j5・j6 は変えない）。番号 1〜5 が、上から順にそろう
// - ① の右の市の一覧の見出し: 「人数」のとき「登録の人数」、「払える熱量」のとき「預金の支えがある熱いファン（見込み）」
// - ⑥ の出どころの文（「→ 預金の支えがある熱いファン（見込み）」）は、変えない
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pickCbox = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};
const rankHead = () => within(screen.getByTestId('city-rank')).getByText(/登録の人数|預金の支え/);

describe('事務所向けの見出しの番号と、一覧の見出し（N5-3）', () => {
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

  it('会場を選ぶと、番号の印が 1〜5 で 1 つずつそろう（4 は開催条件、5 は満たせるか。6 は無い）', () => {
    render(<App />);
    pickCbox();
    expect(document.getElementById('j5')?.querySelector('i')?.textContent).toBe('4');
    expect(document.getElementById('j6')?.querySelector('i')?.textContent).toBe('5');
    expect(document.getElementById('j5')?.textContent).toContain('開催条件');
    expect(document.getElementById('j6')?.textContent).toContain('満たせるか');
    const marks = [
      document.querySelector('main')?.querySelector('p i')?.textContent, // ① 地図
      screen.getByTestId('crowd-num').textContent, // ②
      screen.getByRole('heading', { name: '久留米市の会場' }).previousElementSibling?.textContent, // ③
      document.getElementById('j5')?.querySelector('i')?.textContent,
      document.getElementById('j6')?.querySelector('i')?.textContent,
    ];
    expect(marks).toEqual(['1', '2', '3', '4', '5']);
  });

  it('一覧の見出しは、「人数」のとき「登録の人数」、「払える熱量」のとき「預金の支えがある熱いファン（見込み）」', () => {
    render(<App />);
    expect(rankHead().textContent).toBe('登録の人数');
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(rankHead().textContent).toBe('預金の支えがある熱いファン（見込み）');
    fireEvent.click(screen.getByRole('button', { name: '人数' }));
    expect(rankHead().textContent).toBe('登録の人数');
  });

  it('⑥ の出どころの文は、指標にかかわらず「→ 預金の支えがある熱いファン（見込み）」のまま', () => {
    render(<App />);
    pickCbox();
    expect(screen.getByTestId('demand-source').textContent).toContain(
      '→ 預金の支えがある熱いファン（見込み）',
    );
  });
});
