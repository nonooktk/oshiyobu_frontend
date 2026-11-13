// 同じ端末の連動（設計 D-44・I-110〜I-113 のうち、連動の部品）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conditionOf, costsOfTier } from '../../src/core';
import {
  PUBLISH_DEBOUNCE_MS,
  createLink,
  parseOfficeSelection,
  type OfficeSelection,
} from '../../src/shared/link';
import { effectiveCondition } from '../../src/shared/condition';
import { FakeChannel, asBroadcastChannel } from '../helpers/fakeChannel';

const base = conditionOf('cbox');
const select = (patch: Partial<OfficeSelection> = {}): OfficeSelection => ({
  venueId: 'cbox',
  costs: base.costs,
  minPeople: null,
  ...patch,
});

describe('連動（BroadcastChannel）', () => {
  beforeEach(() => {
    FakeChannel.reset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const open = () => ({
    office: createLink(asBroadcastChannel),
    fan: createLink(asBroadcastChannel, () => 1234),
  });

  it('事務所向けの選択が、100 ms でまとめて、ファン向けに届く（途中の値は送らない）', () => {
    const { office, fan } = open();
    fan.subscribe(() => {});
    office.publishOffice(select({ minPeople: 70 }));
    office.publishOffice(select({ minPeople: 80 }));
    vi.advanceTimersByTime(PUBLISH_DEBOUNCE_MS - 1);
    expect(fan.getLinked()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(fan.getLinked()?.selection.minPeople).toBe(80);
    expect(fan.getLinked()?.receivedAt).toBe(1234);
  });

  it('あとから開いたファン向けが hello を送ると、事務所向けがいまの選択を返す', () => {
    const office = createLink(asBroadcastChannel);
    office.publishOffice(select({ minPeople: 80 }));
    vi.advanceTimersByTime(PUBLISH_DEBOUNCE_MS);
    // 選択を送ったあとで、ファン向けを開く（この時点では、まだ何も届いていない）
    const fan = createLink(asBroadcastChannel);
    expect(fan.getLinked()).toBeNull();
    fan.subscribe(() => {});
    expect(fan.getLinked()?.selection.minPeople).toBe(80);
  });

  it('購読している画面に、届いたことを知らせる。解除したら知らせない', () => {
    const { office, fan } = open();
    const listener = vi.fn();
    const unsubscribe = fan.subscribe(listener);
    office.publishOffice(select());
    vi.advanceTimersByTime(PUBLISH_DEBOUNCE_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    office.publishOffice(select({ minPeople: 5 }));
    vi.advanceTimersByTime(PUBLISH_DEBOUNCE_MS);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('「デモを最初に戻す」（resetAll）は、ファン向けの受け口を呼ぶ。送った事務所向け自身は呼ばない', () => {
    const { office, fan } = open();
    const onFan = vi.fn();
    const onOffice = vi.fn();
    fan.onResetAll(onFan);
    office.onResetAll(onOffice);
    office.broadcastResetAll();
    expect(onFan).toHaveBeenCalledTimes(1);
    expect(onOffice).not.toHaveBeenCalled();
  });

  it('形の違うメッセージ（知らない会場・負の費用・小数の最低人数）は捨てる。落ちない', () => {
    const { fan } = open();
    fan.subscribe(() => {});
    const attacker = new FakeChannel('oshiyobu-link-v1');
    attacker.postMessage({
      type: 'office',
      selection: { venueId: 'nowhere', costs: base.costs, minPeople: null },
    });
    attacker.postMessage({
      type: 'office',
      selection: select({ costs: { ...base.costs, fee: -1 } }),
    });
    attacker.postMessage({ type: 'office', selection: select({ minPeople: 1.5 }) });
    attacker.postMessage('office');
    attacker.postMessage(null);
    expect(fan.getLinked()).toBeNull();
  });

  it('BroadcastChannel が使えない・作れないときも、エラーにせず、連動しないだけ', () => {
    for (const ctor of [
      undefined,
      class {
        constructor() {
          throw new Error('使えません');
        }
      } as unknown as typeof BroadcastChannel,
    ]) {
      const link = createLink(ctor);
      expect(() => {
        link.subscribe(() => {});
        link.publishOffice(select());
        vi.advanceTimersByTime(PUBLISH_DEBOUNCE_MS);
        link.broadcastResetAll();
      }).not.toThrow();
      expect(link.getLinked()).toBeNull();
    }
  });
});

describe('選択の検査', () => {
  it('正しい選択はそのまま読める', () => {
    expect(parseOfficeSelection(select({ minPeople: 80 }))).toEqual(select({ minPeople: 80 }));
  });
  it('最低人数 0・会場キャパ超えなどの範囲は、core の検査（parseMinPeople）の役目。ここは形だけを見る', () => {
    expect(parseOfficeSelection(select({ minPeople: 0 }))).toBeNull();
    expect(parseOfficeSelection(select({ minPeople: 100000 }))?.minPeople).toBe(100000);
  });
});

describe('いま出す条件（同じ会場のときだけ連動。決定 14）', () => {
  const linked = (selection: OfficeSelection) => ({ selection, receivedAt: 0 });

  it('連動が無いとき、基準の条件（到達ライン 650,000 円・必要人数と最低人数 93 人）', () => {
    const c = effectiveCondition('cbox', null);
    expect([c.line, c.need, c.min]).toEqual([650000, 93, 93]);
  });

  it('同じ会場の選択は反映する（最低人数 80。到達ラインと必要人数は変わらない）', () => {
    const c = effectiveCondition('cbox', linked(select({ minPeople: 80 })));
    expect([c.line, c.need, c.min]).toEqual([650000, 93, 80]);
  });

  it('費用を書き換えた選択は反映する（会場費 +100,000 円 → 到達ライン 750,000 円・必要人数 108 人）', () => {
    const costs = { ...costsOfTier(100), venue: costsOfTier(100).venue + 100000 };
    const c = effectiveCondition('cbox', linked(select({ costs })));
    expect(c.line).toBe(base.line + 100000);
    expect(c.need).toBe(Math.ceil((base.line + 100000) / base.price));
  });

  it('別の会場を出しているときは、反映しない（標準の条件のまま）', () => {
    const c = effectiveCondition('KMM-002', linked(select({ minPeople: 80 })));
    expect(c).toEqual(conditionOf('KMM-002'));
  });
});
