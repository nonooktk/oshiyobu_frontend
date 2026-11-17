// 事務所向け（/）の ① 地図: 鹿児島市の名前と数字の範囲も押せる（鹿児島市の丸が押しにくかった件）と、② の番号の印。
// - 名前の字は押しても反応しない（pointer-events: none）ので、名前の範囲に透明な四角（data-hit="label"）を置いた
// - 四角は鹿児島市だけ（9 市に広げると、佐賀市の名前が長崎市の丸に、推しによっては久留米市と大分市の名前どうしが重なった）
// - 四角は、よその市の押せる範囲（丸の周りの円・名前の四角）と重ならない（推し 5 組 × 指標 2 つの、どの組でも）
// - ② の印は、ラベルの外に置く（入力の名前は「集まる人数」のまま）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTISTS } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

type Rect = { x: number; y: number; w: number; h: number };
type Circle = { cx: number; cy: number; r: number };

const cityButton = (city: string) =>
  screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) });
const num = (el: Element, name: string) => Number(el.getAttribute(name));
const rectOf = (g: Element): Rect | null => {
  const el = g.querySelector('rect[data-hit="label"]');
  if (el === null) return null;
  return { x: num(el, 'x'), y: num(el, 'y'), w: num(el, 'width'), h: num(el, 'height') };
};
const dotOf = (g: Element): Circle => {
  const el = g.querySelector('circle[data-hit="dot"]');
  if (el === null) throw new Error('丸の押せる範囲が無い');
  return { cx: num(el, 'cx'), cy: num(el, 'cy'), r: num(el, 'r') };
};
const rectsMeet = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rectMeetsCircle = (a: Rect, c: Circle) => {
  const nx = Math.min(Math.max(c.cx, a.x), a.x + a.w);
  const ny = Math.min(Math.max(c.cy, a.y), a.y + a.h);
  return (c.cx - nx) ** 2 + (c.cy - ny) ** 2 < c.r ** 2;
};
const nameOf = (g: Element) => g.getAttribute('aria-label')?.split('を選ぶ')[0] ?? '';

describe('事務所向けの ① 地図の押せる範囲と、② の番号の印', () => {
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

  it('鹿児島市の名前の範囲を押すと、鹿児島市が選ばれる', () => {
    render(<App />);
    const g = cityButton('鹿児島市');
    expect(g.getAttribute('aria-pressed')).toBe('false');
    const label = g.querySelector('rect[data-hit="label"]');
    expect(label).not.toBeNull();
    fireEvent.click(label!);
    expect(cityButton('鹿児島市').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('heading', { name: '鹿児島市の会場' })).toBeTruthy();
  });

  it('名前の四角は鹿児島市だけにあり、丸の右（名前の置き場）の側にある。ほかの 8 市には無い', () => {
    render(<App />);
    const groups = screen.getAllByRole('button', { name: /を選ぶ。登録者/ });
    expect(groups).toHaveLength(9);
    const withBox = groups.filter((g) => rectOf(g) !== null).map(nameOf);
    expect(withBox).toEqual(['鹿児島市']);
    const g = cityButton('鹿児島市');
    const box = rectOf(g)!;
    const dot = dotOf(g);
    expect(box.w).toBeGreaterThan(0);
    expect(box.h).toBeGreaterThan(0);
    // 名前は丸の右に置く。四角は丸の中心より右から始まり、丸の中心の上は覆わない（丸を押したときは、これまでどおり丸の円で受ける）
    expect(box.x).toBeGreaterThan(dot.cx);
  });

  it.each(ARTISTS.flatMap((a) => (['reg', 'hot'] as const).map((m) => [a.id, m] as const)))(
    '%s・%s: どの市の名前の四角も、よその市の押せる範囲（円・四角）と重ならない',
    (artistId, metric) => {
      officeStore.setState({ artistId, metric });
      render(<App />);
      const groups = screen.getAllByRole('button', { name: /を選ぶ。登録者/ });
      const hits = groups.map((g) => ({ name: nameOf(g), box: rectOf(g), dot: dotOf(g) }));
      expect(hits.filter((h) => h.box !== null)).toHaveLength(1);
      const meets: string[] = [];
      for (const a of hits) {
        if (a.box === null) continue;
        for (const b of hits) {
          if (a === b) continue;
          if (rectMeetsCircle(a.box, b.dot)) meets.push(`${a.name}の名前 × ${b.name}の丸`);
          if (b.box !== null && rectsMeet(a.box, b.box))
            meets.push(`${a.name}の名前 × ${b.name}の名前`);
        }
      }
      expect(meets).toEqual([]);
    },
  );

  it('② の番号の印「2」が ② の行（① 地図の下。2026-11-18 に帯から移した。M-02）に出て、入力の名前は「集まる人数」のまま', () => {
    render(<App />);
    const mark = within(screen.getByTestId('crowd-row')).getByTestId('crowd-num');
    expect(mark.textContent).toBe('2');
    expect(mark.getAttribute('aria-hidden')).toBe('true');
    expect(mark.closest('label')).toBeNull();
    expect(screen.getByRole('spinbutton', { name: '集まる人数' }).getAttribute('id')).toBe(
      'crowd-in',
    );
  });
});
