// 事務所向け（/）の ③ 会場の候補の下の注記に、推しの名前を出さない（統括の依頼。#26 とは分けて直す）。
// 会場の候補は、core のデータで市ごとに決まった固定の一覧で、推しによって絞り込んでいない。
// そのため、注記の 2 文目は、推しに関係なく正しい固定の文にする（案 A）
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTIST_IDS, CITY_NAMES } from '../../src/core';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { ARTIST_TEXT } from '../../src/office/text/artists';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const SECOND =
  '候補は、この市の会場から最大3件です。必要人数に届くかは、会場を選ぶと「満たせるか」に出ます。';
/** ③ の見出しと同じ親の中の、最後の段落（注記） */
const note = (city: string) =>
  screen
    .getByRole('heading', { name: `${city}の会場` })
    .parentElement?.querySelector('p:last-of-type')?.textContent ?? '';

describe('事務所向けの ③ の注記', () => {
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

  it('5 組の推しと 9 市のどれでも、注記に推しの名前が出ず、2 文目は同じ固定の文', () => {
    render(<App />);
    const names = ARTIST_IDS.map((id) => ARTIST_TEXT[id].name);
    for (const id of ARTIST_IDS) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(ARTIST_TEXT[id].name) }));
      for (const city of CITY_NAMES) {
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
        const text = note(city);
        expect(text).toContain(SECOND);
        for (const name of names) expect(text).not.toContain(name);
      }
    }
  });

  it('推しを Tech0 から KRS48 に替えても、注記は変わらない', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
    const before = note('久留米市');
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    expect(note('久留米市')).toBe(before);
    expect(before).toContain(SECOND);
  });

  it('1 文目は、これまでどおり（久留米市は料金の目安・ほかの市は会場データ）', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
    expect(note('久留米市')).toContain('料金は公式サイトの公開情報にもとづく目安です');
    fireEvent.click(screen.getByRole('button', { name: /^熊本市を選ぶ/ }));
    expect(note('熊本市')).toContain('会場名・キャパは会場データ');
  });
});
