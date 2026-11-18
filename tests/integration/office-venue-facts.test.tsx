// 事務所向け（/）の ③ 会場の候補の、実在の情報（要件 R-05・R-16。受け入れ V-03。仕様 4.3〜4.5）。会場のボタンの名前は core の名前のまま。
// 2026-11-18（統括の了承「全部、勝手に直してよい」。docs/office/要件.md の M-04・V-22）: 選んだ会場の詳しい欄
// （公式の名前・住所の市区・収容人数の根拠・出典・確認日）を外した。見出しの横の実在の札は残す。出典のリンクの検査は ④ のリンクで行う
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { VENUE_RECORDS } from '../../src/office/data';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const choose = (city: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
const side = (city: string) =>
  screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement;
const record = (coreId: string) => {
  const found = VENUE_RECORDS.find((r) => r.coreVenueId === coreId);
  if (found === undefined) throw new Error(`データに無い会場: ${coreId}`);
  return found;
};

describe('事務所向けの ③ の実在の情報', () => {
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

  it('③ の見出しの横に、実在の札（出典あり・確認日）が出る。見出しの名前は「<市>の会場」のまま', () => {
    render(<App />);
    choose('福岡市');
    const dates = ['FUK-020', 'FUK-016', 'FUK-012'].map((id) => record(id).checkedOn).sort();
    const chip = within(side('福岡市')).getByTestId('real-chip');
    expect(chip.textContent).toBe(`実在の公開情報（出典あり・確認日 ${dates.at(-1)}）`);
    expect(screen.getByRole('heading', { name: '福岡市の会場' })).toBeTruthy();
  });

  it('V-22 会場を選んでも、詳しい欄（公式の名前〜出典・確認日）は出ない。ボタンの名前は core のまま', () => {
    render(<App />);
    choose('福岡市');
    const button = screen.getByRole('button', { name: /music hall fragile/ });
    fireEvent.click(button);
    expect(screen.queryByTestId('venue-facts')).toBeNull();
    expect(screen.queryByTestId('official-name')).toBeNull();
    const fragile = record('FUK-020');
    expect(side('福岡市').textContent).not.toContain(fragile.capacityBasis);
    expect(side('福岡市').textContent).not.toContain('公式の名前');
    expect(within(side('福岡市')).queryByRole('link')).toBeNull();
    expect(button.textContent).toContain('music hall fragile');
  });

  it('出典のリンク（④ これまでの公演）は、新しいタブで開く（target と rel）。読み上げ用に「新しいタブで開きます」を添える', () => {
    render(<App />);
    choose('久留米市');
    fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
    const links = within(screen.getByTestId('past-list')).getAllByRole('link', { name: /出典/ });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.textContent).toContain('（新しいタブで開きます）');
    }
  });

  it('データの無い会場（RISE UP・Ohana Cafe）を選んでも、③ に「出典は、まだありません」は出ない。会場が全部データに無い市（長崎市）は、札を出さない', () => {
    render(<App />);
    choose('久留米市');
    fireEvent.click(screen.getByRole('button', { name: /RISE UP/ }));
    expect(side('久留米市').textContent).not.toContain('出典は、まだありません');
    choose('長崎市');
    expect(within(side('長崎市')).queryByTestId('real-chip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ohana Cafe/ }));
    expect(side('長崎市').textContent).not.toContain('出典は、まだありません');
  });

  it('詳しい欄を出しても、見出しの親の中の会場（li とボタン）の数は変わらない（I-03・C-05 の前提）', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    expect(side('福岡市').querySelectorAll('li')).toHaveLength(3);
    expect(within(side('福岡市')).getAllByRole('button')).toHaveLength(3);
  });
});
