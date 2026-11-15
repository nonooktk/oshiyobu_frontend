// 事務所向けの読み上げで、同じ数字を 2 回読まない（#26 の統括の指摘 ④）。
// 推し・会場を替えたとき、強調の読み上げ（ChangeLive。「見込み 187人から 120人。成立の見込み 高から 中。」）が読む数字は、
// 操作の知らせ（store の live）からは外す。強調の読み上げが読まないとき（数字が変わらない・初めて会場を選んだ）は、今までどおり読む
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTIST_IDS, CITY_NAMES, venuesOf } from '../../src/core';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { ARTIST_TEXT } from '../../src/office/text/artists';
import { verdictText } from '../../src/office/text/labels';
import { viewOf } from '../../src/office/view';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const act = () => officeStore.getState();
const pickBase = () => {
  act().pickCity('久留米市');
  act().pickVenue('cbox');
};
const levelNow = () => viewOf(act())?.level ?? '高';

describe('操作の知らせと、強調の読み上げが、同じ数字を 2 回読まない', () => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    FakeChannel.reset();
    resetLinkForTest();
    officeStore.setState(initialOfficeState());
  });
  afterEach(() => {
    resetLinkForTest();
    vi.unstubAllGlobals();
  });

  it('推しを替えて見込みと札が変わると、操作の知らせは「…に切り替えました。」だけ', () => {
    pickBase();
    act().setArtist('krs48');
    expect(act().changes.keys).toEqual(expect.arrayContaining(['expected', 'level']));
    expect(act().live).toBe(`${ARTIST_TEXT.krs48.name}に切り替えました。`);
  });

  it('どの推しに替えても、強調の読み上げが読む数字は、操作の知らせに入らない。読まない数字は入る', () => {
    for (const id of ARTIST_IDS) {
      if (id === initialOfficeState().artistId) continue; // 同じ推し（替えていない）
      officeStore.setState(initialOfficeState());
      pickBase();
      act().setArtist(id);
      const keys = act().changes.keys;
      expect(act().live.includes('見込みは')).toBe(!keys.includes('expected'));
      expect(act().live.includes(`${verdictText(levelNow())}。`)).toBe(!keys.includes('level'));
    }
  });

  it('会場を選ぶ前に推しを替えたときは、今までどおり名前だけ', () => {
    act().setArtist('krs48');
    expect(act().live).toBe(`${ARTIST_TEXT.krs48.name}に切り替えました。`);
  });

  it('初めて会場を選んだとき（強調しない）は、今までどおり札も読む', () => {
    pickBase();
    expect(act().live).toBe(
      `久留米シティプラザ Cボックスを選びました。${verdictText(levelNow())}。`,
    );
  });

  it('会場を選び直したとき、札が変わったら札は読まない。変わらなければ読む（全部の市・推し・会場の組）', () => {
    let both = 0;
    for (const city of CITY_NAMES) {
      const venues = venuesOf(city);
      for (const id of ARTIST_IDS) {
        for (let i = 1; i < venues.length; i += 1) {
          officeStore.setState(initialOfficeState());
          act().setArtist(id);
          act().pickCity(city);
          act().pickVenue(venues[0]!.id);
          act().pickVenue(venues[i]!.id);
          const levelSaid = act().changes.keys.includes('level');
          if (levelSaid) both += 1;
          expect(act().live.startsWith(`${venues[i]!.name}を選びました。`)).toBe(true);
          expect(act().live.includes(`${verdictText(levelNow())}。`)).toBe(!levelSaid);
        }
      }
    }
    expect(both).toBeGreaterThan(0); // 札が変わる組が、少なくとも 1 つある（試せている）
  });

  it('線を動かしたあとに推しを替えても、同じ数字は 2 回読まない', () => {
    pickBase();
    act().setQuadLine('deposit', 25);
    act().setArtist('krs48');
    expect(act().live).toBe(`${ARTIST_TEXT.krs48.name}に切り替えました。`);
  });
});
