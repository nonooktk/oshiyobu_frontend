// 同じ端末の連動（設計 D-44）の部品。いま伝えるのは「デモを最初に戻す」（resetAll）だけ。
// 事務所向けで選んだ会場・費用・最低人数は、ファン向けへ伝えない（統括の決定 2026-11-14。ファン向けの条件が変わらないことは、
// tests/integration/fan/office-isolation.test.tsx が、画面で確かめる）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LINK_CHANNEL_NAME, createLink } from '../../src/shared/link';
import { FakeChannel, asBroadcastChannel } from '../helpers/fakeChannel';

describe('連動（BroadcastChannel）', () => {
  beforeEach(() => {
    FakeChannel.reset();
  });

  const open = () => ({
    office: createLink(asBroadcastChannel),
    fan: createLink(asBroadcastChannel),
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

  it('受け口を外したら、呼ばれない', () => {
    const { office, fan } = open();
    const onFan = vi.fn();
    const off = fan.onResetAll(onFan);
    off();
    office.broadcastResetAll();
    expect(onFan).not.toHaveBeenCalled();
  });

  it('resetAll 以外のメッセージは、受けても何も起きない（昔の版の選択・hello・形の違うもの。落ちない）', () => {
    const { fan } = open();
    const onFan = vi.fn();
    fan.onResetAll(onFan);
    const other = new FakeChannel(LINK_CHANNEL_NAME);
    other.postMessage({
      type: 'office',
      selection: { venueId: 'cbox', costs: {}, minPeople: 80 },
    });
    other.postMessage({ type: 'hello' });
    other.postMessage({ type: 'unknown' });
    other.postMessage('resetAll');
    other.postMessage(null);
    other.postMessage(['resetAll']);
    expect(onFan).not.toHaveBeenCalled();
  });

  it('連動は、resetAll のほかを、何も送らない（事務所向けの選択も、ファン向けの hello も流れない）', () => {
    const { office, fan } = open();
    const seen: unknown[] = [];
    new FakeChannel(LINK_CHANNEL_NAME).addEventListener('message', (e) => seen.push(e.data));
    fan.onResetAll(() => {});
    office.onResetAll(() => {});
    office.broadcastResetAll();
    expect(seen).toEqual([{ type: 'resetAll' }]);
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
      const handler = vi.fn();
      expect(() => {
        link.onResetAll(handler);
        link.broadcastResetAll();
        link.close();
      }).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    }
  });
});
