// 事務所向け（/）の ③ 会場の候補に、実在の情報（公式の名前・住所の市区・収容人数の根拠・出典・確認日）を添える
// （要件 R-05・R-16。受け入れ V-03。仕様 4.3〜4.5）。会場のボタンの名前は core の名前のまま
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

  it('会場を選ぶと、その会場だけに詳しい欄が出て、公式の名前（Music hall Fragile）と出典が見える。ボタンの名前は core のまま', () => {
    render(<App />);
    choose('福岡市');
    expect(screen.queryByTestId('venue-facts')).toBeNull();
    const button = screen.getByRole('button', { name: /music hall fragile/ });
    fireEvent.click(button);
    const facts = screen.getAllByTestId('venue-facts');
    expect(facts).toHaveLength(1);
    const fragile = record('FUK-020');
    expect(within(facts[0]!).getByTestId('official-name').textContent).toBe(fragile.name);
    expect(facts[0]!.textContent).toContain(fragile.city);
    expect(facts[0]!.textContent).toContain(fragile.capacityBasis);
    expect(facts[0]!.textContent).toContain(`確認日 ${fragile.checkedOn}`);
    // ボタンは core の名前のまま。詳しい欄はボタンの外
    expect(button.textContent).toContain('music hall fragile');
    expect(button.contains(facts[0]!)).toBe(false);
  });

  it('出典のリンクは、新しいタブで開く（target と rel）。読み上げ用に「新しいタブで開きます」を添える', () => {
    render(<App />);
    choose('久留米市');
    fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
    const link = within(screen.getByTestId('venue-facts')).getByRole('link', { name: /出典/ });
    expect(link.getAttribute('href')).toBe(record('cbox').sourceUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('（新しいタブで開きます）');
  });

  it('データの無い会場（RISE UP・Ohana Cafe）は、「出典は、まだありません」。会場が全部データに無い市（長崎市）は、札を出さない', () => {
    render(<App />);
    choose('久留米市');
    fireEvent.click(screen.getByRole('button', { name: /RISE UP/ }));
    expect(screen.getByTestId('venue-facts').textContent).toBe('出典は、まだありません');
    expect(within(screen.getByTestId('venue-facts')).queryByRole('link')).toBeNull();
    choose('長崎市');
    expect(within(side('長崎市')).queryByTestId('real-chip')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ohana Cafe/ }));
    expect(screen.getByTestId('venue-facts').textContent).toBe('出典は、まだありません');
  });

  it('詳しい欄を出しても、見出しの親の中の会場（li とボタン）の数は変わらない（I-03・C-05 の前提）', () => {
    render(<App />);
    choose('福岡市');
    fireEvent.click(screen.getByRole('button', { name: /DRUM SON/ }));
    expect(side('福岡市').querySelectorAll('li')).toHaveLength(3);
    expect(within(side('福岡市')).getAllByRole('button')).toHaveLength(3);
  });
});
