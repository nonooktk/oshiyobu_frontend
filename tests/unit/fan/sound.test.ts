// 称賛の音（Web Audio の合成）。鳴る場面・長さ・音量・音階と、鳴らない条件（オフ・操作の前・使えない環境）を確かめる。
// 本物の音は出さず、AudioContext の代わり（記録するだけの偽物）に渡して、作られた音を調べる。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUES, createSound } from '../../../src/fan/sound';
import type { SoundCue } from '../../../src/fan/sound';

interface Osc {
  hz: number;
  start: number;
  stop: number;
  type: string;
}
let oscillators: Osc[] = [];
let peaks: number[] = [];
let made = 0;

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  constructor() {
    made += 1;
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: (value: number) => peaks.push(value),
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
    };
  }
  createOscillator() {
    const osc: Osc = { hz: 0, start: 0, stop: 0, type: '' };
    oscillators.push(osc);
    return {
      set type(value: string) {
        osc.type = value;
      },
      frequency: {
        set value(hz: number) {
          osc.hz = hz;
        },
      },
      connect: () => undefined,
      start: (t: number) => {
        osc.start = t;
      },
      stop: (t: number) => {
        osc.stop = t;
      },
    };
  }
}

const CUE_NAMES: SoundCue[] = ['join', 'share', 'friend', 'stage', 'fever'];
/** 明るい音階（C 長調のペンタトニック。ド・レ・ミ・ソ・ラ。どの音も、この 5 つの音名のどれか） */
const PENTATONIC = [0, 2, 4, 7, 9];
const semitoneOf = (hz: number): number => {
  const fromC = 12 * Math.log2(hz / 261.6256);
  return ((Math.round(fromC) % 12) + 12) % 12;
};

beforeEach(() => {
  oscillators = [];
  peaks = [];
  made = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('鳴る条件', () => {
  it('利用者の操作の前（unlock の前）は、鳴らない。自動で音を出さない', () => {
    const sound = createSound();
    sound.play('join');
    expect(oscillators).toHaveLength(0);
    expect(made).toBe(0);
  });

  it('unlock のあと、オンなら鳴る', () => {
    const sound = createSound();
    sound.unlock();
    sound.play('join');
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('音がオフのときは鳴らない。オンに戻すと鳴る（既定はオン）', () => {
    const sound = createSound();
    expect(sound.isOn()).toBe(true);
    sound.unlock();
    sound.setOn(false);
    sound.play('fever');
    expect(oscillators).toHaveLength(0);
    sound.setOn(true);
    sound.play('fever');
    expect(oscillators.length).toBeGreaterThan(0);
  });

  it('音が使えない環境（AudioContext が無い）では、例外を出さず、何もしない', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('AudioContext', undefined);
    const sound = createSound();
    expect(() => {
      sound.unlock();
      sound.play('fever');
    }).not.toThrow();
    expect(oscillators).toHaveLength(0);
  });

  it('AudioContext を作る・鳴らす途中で例外が出ても、握りつぶして、画面を止めない', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('使えない');
        }
      },
    );
    const sound = createSound();
    expect(() => {
      sound.unlock();
      sound.play('join');
    }).not.toThrow();
  });
});

describe('音の長さ・音量・音階（統括の決定）', () => {
  it.each(CUE_NAMES)(
    '%s: 鳴らすと、長さは 1.2 秒以内（FEVER だけ 3 秒以内）。音量は控えめ',
    (cue) => {
      const sound = createSound();
      sound.unlock();
      sound.play(cue);
      const end = Math.max(...oscillators.map((o) => o.stop));
      expect(end).toBeLessThanOrEqual(cue === 'fever' ? 3 : 1.2);
      expect(end).toBeGreaterThan(0.3);
      expect(Math.max(...peaks)).toBeLessThanOrEqual(0.1);
    },
  );

  it('FEVER は、ほかより長く鳴る（2 秒より長く、3 秒以内）', () => {
    const lengths = CUE_NAMES.map((cue) => Math.max(...CUES[cue].map((n) => n.at + n.dur)));
    expect(lengths[4]).toBeGreaterThan(2);
    expect(lengths[4]).toBeLessThanOrEqual(3);
    for (const l of lengths.slice(0, 4)) expect(l).toBeLessThanOrEqual(1.2);
  });

  it('どの音も、明るい音階（ド・レ・ミ・ソ・ラ）の音。やわらかい波形（triangle）で、硬貨のような金属音ではない', () => {
    const sound = createSound();
    sound.unlock();
    for (const cue of CUE_NAMES) sound.play(cue);
    for (const osc of oscillators) {
      expect(PENTATONIC).toContain(semitoneOf(osc.hz));
      expect(osc.type).toBe('triangle');
    }
  });

  it('音は、上がっていく（行動のあとの称賛）。join・share は 2 音、friend・stage は 3 音', () => {
    expect(CUES.join).toHaveLength(2);
    expect(CUES.share).toHaveLength(2);
    expect(CUES.friend).toHaveLength(3);
    expect(CUES.stage).toHaveLength(3);
    for (const cue of ['join', 'share', 'friend', 'stage'] as const) {
      const hz = CUES[cue].map((n) => n.hz);
      expect([...hz].sort((a, b) => a - b)).toEqual(hz);
    }
  });
});
