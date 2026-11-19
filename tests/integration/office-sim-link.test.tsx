// 事務所向け（/）の ⑤ の「収支シミュレーター」のリンクに、選んだ会場の ID を付ける（N-11。Issue #50 の統括の了承 2026-11-19）。
// - 入口がある 11 会場のどれを選んでも、リンクは /simulator.html?venue=<core の simulatorVenueId>
//   （Cボックスは、core の id が cbox で、シミュレーターの ID は FUK-019。core の id ではなく simulatorVenueId を使う）
// - 入口の無い会場（RISE UP）は、これまでどおり入口を出さない
// - 市を選ぶ前の入口（③ の欄）は、会場が無いので ID を付けない
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VENUES } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const simulatorLink = () =>
  within(screen.getByTestId('judge')).queryByRole('link', { name: '収支シミュレーター' });

describe('事務所向けの ⑤ から収支シミュレーターへ、選んだ会場を渡す（N-11）', () => {
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

  it('9 市の 12 会場を順に選ぶと、入口のある 11 会場のリンクは、その会場の ID 付き。RISE UP には入口が無い', () => {
    render(<App />);
    const seen: Record<string, string | null> = {};
    for (const dot of screen.getAllByRole('button', { name: /を選ぶ。登録者/ })) {
      fireEvent.click(dot);
      const heading = screen.getByRole('heading', { level: 3, name: /の会場$/ });
      for (const button of heading.parentElement?.querySelectorAll('li button') ?? []) {
        fireEvent.click(button);
        const name = button.querySelector('span')?.textContent ?? '';
        seen[name] = simulatorLink()?.getAttribute('href') ?? null;
      }
    }
    const expected = Object.fromEntries(
      VENUES.map((venue) => [
        venue.name,
        venue.simulatorVenueId === undefined
          ? null
          : `/simulator.html?venue=${venue.simulatorVenueId}`,
      ]),
    );
    expect(seen).toEqual(expected);
    expect(Object.values(seen).filter((href) => href !== null)).toHaveLength(11);
    expect(seen['久留米シティプラザ Cボックス']).toBe('/simulator.html?venue=FUK-019');
  });

  it('市を選ぶ前の入口は、会場の ID を付けない（/simulator.html のまま）', () => {
    render(<App />);
    const link = screen.getByRole('link', { name: '収支シミュレーター' });
    expect(link.getAttribute('href')).toBe('/simulator.html');
  });
});
