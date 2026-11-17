// 事務所向け（/）の ① 地図で「払える熱量」に切り替えたときの数字（docs/office/要件.md の M-03・V-21。2026-11-18）。
// 市の数字は、見込みの人数（core の demandOf(推し, 市).expected）に「人」を付けて出す。丸の色は、払える熱量の段のまま
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTISTS, CITIES, demandOf, metricValues } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const people = (n: number) => `${n.toLocaleString('ja-JP')}人`;
/** 地図の、その市の丸の数字（名前の下の行） */
const shownOf = (city: string): string => {
  const hit = screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) });
  return hit.querySelectorAll('text tspan')[1]?.textContent ?? '';
};
const toHot = () => fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));

describe('事務所向けの ① 地図の「払える熱量」の数字', () => {
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

  it('V-21 Tech0 で「払える熱量」にすると、福岡市の数字は「311人」（見込みの人数）', () => {
    render(<App />);
    toHot();
    expect(shownOf('福岡市')).toBe('311人');
  });

  it.each(ARTISTS.map((a) => [a.id]))(
    '%s: 「払える熱量」では 9 市すべてが見込みの人数、「人数」では登録者数（どちらも「人」付き）',
    (id) => {
      officeStore.setState({ artistId: id });
      render(<App />);
      const regs = metricValues(id, 'reg');
      CITIES.forEach(({ name }, i) => {
        expect(shownOf(name)).toBe(people(regs[i] ?? -1));
      });
      toHot();
      CITIES.forEach(({ name }) => {
        expect(shownOf(name)).toBe(people(demandOf(id, name).expected));
      });
    },
  );
});
