// 事務所向け（/）の ① 市の一覧（要件 R-02・R-03。仕様 1.4）。
// 9 市を、預金の支えがある熱いファンの見込み（core の demandOf(推し, 市).expected）の多い市から並べ、
// 登録者数（core の metricValues(推し, 'reg')）を並べて出す。数字は core の値のまま。行を押すと、その市を選べる
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTISTS, CITIES, demandOf, metricValues } from '../../src/core';
import type { ArtistId } from '../../src/core';
import { App } from '../../src/office/App';
import { cityRankOf } from '../../src/office/components/CityRank';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { ARTIST_TEXT } from '../../src/office/text/artists';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const rank = () => screen.getByTestId('city-rank');
const rows = () => within(rank()).getAllByRole('button');
/** 一覧の行に出ている市の名前（上から） */
const shownNames = () => rows().map((b) => b.querySelector('span:nth-child(2)')?.textContent);
const people = (n: number) => `${n.toLocaleString('ja-JP')}人`;
/** 見込みの多い市から（同じ数は CITIES の並び）。core の値だけで作る */
const expectedOrder = (id: ArtistId) =>
  CITIES.map((c, i) => ({ name: c.name, e: demandOf(id, c.name).expected, i }))
    .sort((a, b) => b.e - a.e || a.i - b.i)
    .map((r) => r.name);

describe('事務所向けの ① 市の一覧', () => {
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

  it('見出しは「預金の支えがある熱いファン（見込み）」で、「数字は架空」を添える', () => {
    render(<App />);
    expect(within(rank()).getByText('預金の支えがある熱いファン（見込み）')).toBeTruthy();
    expect(screen.getByTestId('rank-fict').textContent).toBe('数字は架空');
    // 全画面の札の文と ① の札の文は、一覧の中で繰り返さない
    expect(rank().textContent).not.toContain('デモ用の架空データ');
    expect(rank().textContent).not.toContain('架空（デモ用）');
  });

  it.each(ARTISTS.map((a) => [a.id]))(
    '%s: 9 市を、見込みの多い市から並べ、「人数」のときは登録者数だけを core の値のまま出す（見込みと割合は読み上げに。N-2）',
    (id) => {
      officeStore.setState({ artistId: id });
      render(<App />);
      expect(rows()).toHaveLength(9);
      expect(shownNames()).toEqual(expectedOrder(id));
      const regs = metricValues(id, 'reg');
      rows().forEach((button, n) => {
        const name = expectedOrder(id)[n] as (typeof CITIES)[number]['name'];
        const reg = regs[CITIES.findIndex((c) => c.name === name)] ?? -1;
        const expected = demandOf(id, name).expected;
        // 2026-11-19、Issue #48 の統括の了承で、「人数」（初めの指標）のときは、行に登録の人数だけを出すようにした
        // （N-2。docs/office/要件.md の N23-1）。元は、見込みの人数（people(expected)）も行に出ていた
        expect(button.textContent).toBe(`${n + 1}${name}登録 ${people(reg)}`);
        // 2026-11-18（M-01）: 読み上げの名前の最後に、見込みが登録の何 % か（小数 1 桁で四捨五入）を足した
        const share = `${(Math.round((expected * 1000) / reg) / 10).toFixed(1)}%`;
        expect(button.getAttribute('aria-label')).toBe(
          `${n + 1} ${name} 見込み ${people(expected)} 登録 ${people(reg)} 登録の ${share}`,
        );
      });
    },
  );

  it('並べる関数は、core の値をそのまま返す（足し算をしない）', () => {
    for (const a of ARTISTS) {
      const regs = metricValues(a.id, 'reg');
      for (const row of cityRankOf(a.id)) {
        expect(row.expected).toBe(demandOf(a.id, row.name).expected);
        expect(row.reg).toBe(regs[CITIES.findIndex((c) => c.name === row.name)]);
      }
    }
  });

  it('行の名前に「を選ぶ」を入れない（地図の丸の名前とぶつからない）', () => {
    render(<App />);
    for (const button of rows()) {
      expect(button.getAttribute('aria-label')).not.toContain('を選ぶ');
    }
    for (const c of CITIES) {
      expect(screen.getAllByRole('button', { name: new RegExp(`^${c.name}を選ぶ`) })).toHaveLength(
        1,
      );
    }
  });

  it('行を押すと、その市を選べる。選んでいる市の行は押された状態になり、地図の丸も同じ', () => {
    render(<App />);
    const row = within(rank()).getByRole('button', { name: /^\d+ 熊本市 / });
    expect(row.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(row, { detail: 1 });
    expect(screen.getByRole('heading', { name: '熊本市の会場' })).toBeTruthy();
    expect(row.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^熊本市を選ぶ/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const others = rows().filter((b) => b !== row);
    expect(others.every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('地図の丸で市を選ぶと、一覧の行も押された状態になる', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^長崎市を選ぶ/ }));
    expect(
      within(rank())
        .getByRole('button', { name: /^\d+ 長崎市 / })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('推しを替えると、並びが、その推しの見込みの順に替わる（同じ画面のまま）', () => {
    render(<App />);
    expect(shownNames()).toEqual(expectedOrder('tech0'));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(ARTIST_TEXT.riji.name) }));
    expect(shownNames()).toEqual(expectedOrder('riji'));
  });

  it('「人数」と「払える熱量」を切り替えても、一覧は見込みの順のまま', () => {
    render(<App />);
    const before = shownNames();
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(shownNames()).toEqual(before);
  });

  it('キーボードで押すと（detail が 0）、会場の先頭にフォーカスが移る。マウスでは移らない', () => {
    render(<App />);
    const firstVenue = (city: string) =>
      within(screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement)
        .getAllByRole('button')
        .at(0);
    const mouseRow = within(rank()).getByRole('button', { name: /^\d+ 大分市 / });
    mouseRow.focus();
    fireEvent.click(mouseRow, { detail: 1 });
    expect(document.activeElement).toBe(mouseRow);
    const keyRow = within(rank()).getByRole('button', { name: /^\d+ 福岡市 / });
    keyRow.focus();
    fireEvent.click(keyRow, { detail: 0 });
    expect(document.activeElement).toBe(firstVenue('福岡市'));
  });
});
