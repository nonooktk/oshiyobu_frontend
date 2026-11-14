// 音のボタンでオフにしたら、鳴り始めた音・予約した音も、その場で止まる（QA H-06・G2-13。統括の決定）。
// 称賛の音は、合図の時刻から先の音を、まとめて予約する（FEVER は 2.5 秒ぶん）。オフにしても予約が残ると、驚いた人が止められない。
// 本物の音は出さず、AudioContext の代わり（記録するだけの偽物）に渡して、作られた音の止め方を調べる。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUES, createSound } from '../../../src/fan/sound';

interface FakeOsc {
  /** stop に渡された引数（引数なし ＝ いますぐ止める）。 */
  stops: (number | undefined)[];
  disconnected: number;
}
interface FakeAmp {
  disconnected: number;
}
let oscs: FakeOsc[] = [];
let amps: FakeAmp[] = [];
let now = 0;

class FakeAudioContext {
  state = 'running';
  destination = {};
  get currentTime() {
    return now;
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    const amp: FakeAmp = { disconnected: 0 };
    amps.push(amp);
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
        cancelScheduledValues: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => {
        amp.disconnected += 1;
      },
    };
  }
  createOscillator() {
    const osc: FakeOsc = { stops: [], disconnected: 0 };
    oscs.push(osc);
    return {
      type: '',
      frequency: { value: 0 },
      connect: () => undefined,
      disconnect: () => {
        osc.disconnected += 1;
      },
      start: () => undefined,
      stop: (t?: number) => {
        osc.stops.push(t);
      },
    };
  }
}

beforeEach(() => {
  oscs = [];
  amps = [];
  now = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function ready() {
  const sound = createSound();
  sound.unlock();
  return sound;
}
/** いますぐ止める指示（引数なしの stop）が出たか。鳴らすときの stop(終わる時刻) は数えない。 */
const stoppedNow = (osc: FakeOsc): boolean => osc.stops.includes(undefined);

describe('オフにしたら、鳴っている音・予約した音が、その場で止まる', () => {
  it('FEVER の音（8 音。0.62 秒に和音が入る予約つき）を鳴らした直後にオフにすると、全部の音を止めて、出力から切り離す', () => {
    const sound = ready();
    sound.play('fever');
    expect(oscs).toHaveLength(CUES.fever.length);
    sound.setOn(false);
    expect(oscs.every(stoppedNow)).toBe(true);
    expect(oscs.every((o) => o.disconnected > 0)).toBe(true);
    expect(amps.every((a) => a.disconnected > 0)).toBe(true);
    expect(sound.isOn()).toBe(false);
  });

  it('オフのあとは、鳴らさない。オンに戻すと、また鳴る（止めた音は戻らない）', () => {
    const sound = ready();
    sound.play('friend');
    sound.setOn(false);
    const made = oscs.length;
    sound.play('fever');
    expect(oscs).toHaveLength(made); // オフの間は、何も作らない
    sound.setOn(true);
    sound.play('join');
    expect(oscs).toHaveLength(made + CUES.join.length);
    expect(oscs.slice(made).some(stoppedNow)).toBe(false); // 新しい音は止められていない
  });

  it('もう鳴り終わった音には、触らない（終わった音を覚え続けない）', () => {
    const sound = ready();
    sound.play('join'); // 0.57 秒ほどで終わる
    now = 10;
    sound.play('friend'); // 10 秒の時点で、新しい音
    sound.setOn(false);
    const [joinOscs, friendOscs] = [oscs.slice(0, CUES.join.length), oscs.slice(CUES.join.length)];
    expect(joinOscs.some(stoppedNow)).toBe(false);
    expect(friendOscs.every(stoppedNow)).toBe(true);
  });

  it('オフにするのを 2 回続けても、落ちない。何も鳴っていないときも、落ちない', () => {
    const sound = ready();
    expect(() => sound.setOn(false)).not.toThrow();
    sound.setOn(true);
    sound.play('stage');
    sound.setOn(false);
    expect(() => sound.setOn(false)).not.toThrow();
  });

  it('操作の前（unlock の前）・音が使えない環境でも、オフにして落ちない', () => {
    expect(() => createSound().setOn(false)).not.toThrow();
    vi.stubGlobal('AudioContext', undefined);
    const sound = createSound();
    sound.unlock();
    expect(() => sound.setOn(false)).not.toThrow();
  });

  it('止める操作が使えない環境（切り離し・停止が例外を出す）でも、オフにして落ちない', () => {
    class Broken extends FakeAudioContext {
      override createOscillator() {
        const osc = super.createOscillator();
        return {
          ...osc,
          disconnect: () => {
            throw new Error('disconnect');
          },
          stop: () => {
            throw new Error('stop');
          },
        };
      }
    }
    vi.stubGlobal('AudioContext', Broken);
    const sound = ready();
    sound.play('stage');
    expect(() => sound.setOn(false)).not.toThrow();
    expect(sound.isOn()).toBe(false);
  });
});
