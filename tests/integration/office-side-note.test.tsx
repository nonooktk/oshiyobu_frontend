// 事務所向け（/）の ③ 会場の候補の下の注記。
// これまで（統括の依頼。#26）: 注記に推しの名前を出さず、2 文目は推しに関係なく正しい固定の文にする（案 A）。
// 2026-11-18（統括の了承「全部、勝手に直してよい」。docs/office/要件.md の M-04・V-22）: 注記の 2 文（久留米市の公開料金の出どころの文を含む）を外した。
// 外したあとも、推しや市を替えて、注記（と推しの名前）が ③ に出てこないことを確かめる
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTIST_IDS, CITY_NAMES } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { ARTIST_TEXT } from '../../src/office/text/artists';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

/** 外した注記の文（どれも ③ に出ない） */
const REMOVED = [
  '空き日は架空です',
  '料金は公式サイトの公開情報にもとづく目安です',
  '会場名・キャパは会場データ',
  '候補は、この市の会場から最大3件です',
  '必要人数に届くかは、会場を選ぶと「満たせるか」に出ます',
];
/** ③ の見出しと同じ親（③ の区画）の文 */
const side = (city: string) =>
  screen.getByRole('heading', { name: `${city}の会場` }).parentElement?.textContent ?? '';

describe('事務所向けの ③ の注記（2026-11-18 に外した）', () => {
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

  it('5 組の推しと 9 市のどれでも、③ に注記の文が出ず、推しの名前も出ない', () => {
    render(<App />);
    const names = ARTIST_IDS.map((id) => ARTIST_TEXT[id].name);
    for (const id of ARTIST_IDS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(ARTIST_TEXT[id].name) }));
      for (const city of CITY_NAMES) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
        const text = side(city);
        for (const removed of REMOVED) expect(text).not.toContain(removed);
        for (const name of names) expect(text).not.toContain(name);
      }
    }
  }, 15000);

  it('V-22 久留米市（公開料金のある市）でも、公開料金の出どころの文は出ない。カードの「公開料金の目安」は残る', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
    const text = side('久留米市');
    expect(text).not.toContain('2026-11-12 確認');
    expect(text).toContain('公開料金の目安');
  });

  it('「おすすめ順で並べています」は、今回は入れない（字が核のフォントに無いため）', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^熊本市を選ぶ/ }));
    expect(side('熊本市')).not.toContain('おすすめ');
  });
});
