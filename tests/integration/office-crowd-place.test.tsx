// 事務所向け（/）の ② 集まる人数の置き場所（docs/office/要件.md の M-02・V-20。2026-11-18）。
// ② は、条件の帯ではなく、① 地図のすぐ下（③④ の上）にある。条件の帯には、境目だけが残る
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const follows = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('事務所向けの ② の置き場所', () => {
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

  it('V-20 ② は、① 地図（svg）のあと、③④ の行の前にある', () => {
    render(<App />);
    const row = screen.getByTestId('crowd-row');
    const map = document.getElementById('map-title')?.closest('svg') as SVGSVGElement;
    const lower = screen.getByTestId('lower-row');
    expect(follows(map, row)).toBe(true);
    expect(follows(row, lower)).toBe(true);
    expect(within(row).getByRole('spinbutton', { name: '集まる人数' })).toBeTruthy();
  });

  it('V-20 条件の帯には、② が無い。会場を選ぶと、境目（預金額・熱量）だけが出る', () => {
    render(<App />);
    const band = screen.getByTestId('cond-band');
    expect(within(band).queryByRole('spinbutton', { name: '集まる人数' })).toBeNull();
    expect(within(band).queryByTestId('crowd-num')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
    const side = screen.getByRole('heading', { name: '久留米市の会場' })
      .parentElement as HTMLElement;
    const first = within(side).getAllByRole('button').at(0);
    if (first === undefined) throw new Error('久留米市に会場がありません');
    fireEvent.click(first);
    expect(
      within(band)
        .getAllByRole('spinbutton')
        .map((el) => el.getAttribute('aria-label') ?? el.id),
    ).toHaveLength(2);
    expect(within(band).getByRole('slider', { name: '預金額' })).toBeTruthy();
    expect(within(band).getByRole('slider', { name: '熱量' })).toBeTruthy();
  });
});
