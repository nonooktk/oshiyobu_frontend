// 事務所向けの「変わった数字」を見つける仕組み（要件 R-14・仕様 2.2）。画面ではなく、関数と状態の動きを見る
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeChannel } from '../helpers/fakeChannel';
import { initialOfficeState, officeStore, snapshotOfState } from '../../src/office/store';
import { CHANGE_KEYS, changedKeys } from '../../src/office/view';
import type { Snapshot } from '../../src/office/view';
import { resetLinkForTest } from '../../src/shared/link';

const base: Snapshot = Object.fromEntries(CHANGE_KEYS.map((k) => [k, 1])) as Snapshot;
const act = () => officeStore.getState();
const keys = () => [...act().changes.keys].sort();

describe('changedKeys（前と今を比べる）', () => {
  it('どちらかが null（初めて判定が出た・判定が消えた）なら、何も変わっていない扱い', () => {
    expect(changedKeys(null, base)).toEqual([]);
    expect(changedKeys(base, null)).toEqual([]);
    expect(changedKeys(null, null)).toEqual([]);
  });

  it('値が違う名前だけを返す（文字の札も比べる）', () => {
    expect(changedKeys(base, { ...base, expected: 2, level: '高' })).toEqual(['expected', 'level']);
    expect(changedKeys(base, { ...base })).toEqual([]);
  });
});

describe('状態の changes（操作のたびに前と比べる）', () => {
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

  const pickBase = () => {
    act().pickCity('久留米市');
    act().pickVenue('cbox');
  };

  it('初めて会場を選んだときは、強調しない', () => {
    pickBase();
    expect(snapshotOfState(act())).not.toBeNull();
    expect(act().changes.keys).toEqual([]);
    expect(act().changes.prev).toBeNull();
  });

  it('推しを替えると、見込み・札・4 象限は変わり、到達ライン・必要人数・価格・上乗せは変わらない。前の値が残る', () => {
    pickBase();
    act().setArtist('krs48');
    const changed = keys();
    expect(changed).toContain('expected');
    expect(changed).toContain('quadHotRich');
    for (const k of ['line', 'need', 'price', 'upliftTotal'] as const) {
      expect(changed).not.toContain(k);
    }
    expect(act().changes.prev?.expected).toBe(187);
    expect(act().changes.seq).toBe(1);
  });

  it('数字の変わらない操作（指標の切り替え・枠を開く）では、強調をそのまま残す', () => {
    pickBase();
    act().setArtist('krs48');
    const before = act().changes;
    act().setMetric('hot');
    act().openModal('privacy');
    act().closeModal();
    expect(act().changes).toBe(before);
  });

  it('費用を変えると、到達ライン・必要人数は変わり、見込みは変わらない', () => {
    pickBase();
    act().setCostInput('venue', '200000');
    const changed = keys();
    expect(changed).toContain('line');
    expect(changed).toContain('need');
    expect(changed).not.toContain('expected');
  });

  it('線を動かすと、4 象限だけが変わる', () => {
    pickBase();
    act().setQuadLine('deposit', 40);
    const changed = keys();
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.every((k) => k.startsWith('quad'))).toBe(true);
  });

  it('市を変える（判定が消える）と、強調は消える。次に会場を選んでも強調しない', () => {
    pickBase();
    act().setArtist('krs48');
    act().pickCity('福岡市');
    expect(act().changes.keys).toEqual([]);
    act().pickVenue('FUK-020'); // 福岡市の会場（core のデータ）
    expect(snapshotOfState(act())).not.toBeNull();
    expect(act().changes.keys).toEqual([]);
  });

  it('「事務所向けだけ戻す」のあとは、強調しない', () => {
    pickBase();
    act().setArtist('krs48');
    act().resetOffice();
    expect(act().changes.keys).toEqual([]);
    expect(act().changes.prev).toBeNull();
  });
});
