// 称賛の音の、音源ファイル（G-04）。申し込んだ瞬間（join）・仲間を呼んだ瞬間（friend）・最後の演出（fever）の 3 場面だけ、ファイルに差し替える。
//   ・ファイルが読めたら、ファイルの音を鳴らす（AudioBufferSourceNode。合成の音と二重にしない）
//   ・ファイルが無い・読めない・復号できない・まだ読み込み中のときは、合成の音を鳴らす（無音にしない。例外を外に出さない）
//   ・音をオフにしたら、鳴っているファイルの音も、その場で止まる
//   ・ファイルの音が鳴っている間は、合成の stage・share を重ねない
// 本物の音は出さず、AudioContext の代わり（記録するだけの偽物）に渡して、作られた音を調べる。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSound } from '../../../src/fan/sound';
import { SOUND_FILES, fetchSoundBytes } from '../../../src/fan/sound-files';
import type { SoundFileMap } from '../../../src/fan/sound-files';

class FakeBuffer {
  constructor(
    readonly duration: number,
    readonly tag: string,
  ) {}
}
interface FakeSource {
  buffer: FakeBuffer | null;
  starts: number[];
  /** stop に渡された引数（引数なし ＝ いますぐ止める）。 */
  stops: (number | undefined)[];
  disconnected: number;
}
let sources: FakeSource[] = [];
let oscillators = 0;
/** ファイルの音に付けた音量（gain.value に入れた値）。 */
let fileGains: number[] = [];
let now = 0;
let decode: (bytes: ArrayBuffer) => Promise<FakeBuffer> = () =>
  Promise.resolve(new FakeBuffer(2.2, 'decoded'));

class FakeAudioContext {
  state = 'running';
  destination = {};
  get currentTime() {
    return now;
  }
  resume() {
    return Promise.resolve();
  }
  decodeAudioData(bytes: ArrayBuffer) {
    return decode(bytes);
  }
  createBufferSource() {
    const source: FakeSource = { buffer: null, starts: [], stops: [], disconnected: 0 };
    sources.push(source);
    return {
      set buffer(value: FakeBuffer | null) {
        source.buffer = value;
      },
      connect: () => undefined,
      disconnect: () => {
        source.disconnected += 1;
      },
      start: (t: number) => {
        source.starts.push(t);
      },
      stop: (t?: number) => {
        source.stops.push(t);
      },
    };
  }
  createGain() {
    return {
      gain: {
        set value(v: number) {
          fileGains.push(v);
        },
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }
  createOscillator() {
    oscillators += 1;
    return {
      type: '',
      frequency: { value: 0 },
      connect: () => undefined,
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
  }
}

beforeEach(() => {
  sources = [];
  oscillators = 0;
  fileGains = [];
  now = 0;
  decode = () => Promise.resolve(new FakeBuffer(2.2, 'decoded'));
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.restoreAllMocks(); // 偽物のクラスの関数に仕込んだ差し替えを、次のテストへ持ち越さない
  vi.unstubAllGlobals();
});

/** 読み込みと復号の約束事（Promise）が終わるまで待つ。 */
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const bytes = (): Promise<ArrayBuffer> => Promise.resolve(new ArrayBuffer(8));
/** join だけ、ファイルがある（ファイルが 1 つだけの対応表の検査に使う。B が届く前の対応表と同じ形）。 */
const JOIN_ONLY: SoundFileMap = { join: { url: '/sounds/A-join.mp3', gain: 0.11 } };

/** unlock して、ファイルの読み込みを終わらせた状態の音。 */
async function ready(files: SoundFileMap = JOIN_ONLY, loadBytes = vi.fn(bytes)) {
  const sound = createSound({ files, loadBytes });
  sound.unlock();
  await flush();
  return { sound, loadBytes };
}

describe('ファイルが読めたとき、その場面はファイルの音を鳴らす', () => {
  it('join: AudioBufferSourceNode で鳴らす。合成の音（オシレーター）は鳴らさない。音量は対応表の値', async () => {
    const { sound } = await ready();
    sound.play('join');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.buffer?.tag).toBe('decoded');
    expect(sources[0]?.starts).toEqual([0]);
    expect(oscillators).toBe(0);
    expect(fileGains).toEqual([0.11]);
  });

  it('いま鳴らす時刻（AudioContext の時計）から鳴らす', async () => {
    const { sound } = await ready();
    now = 12.5;
    sound.play('join');
    expect(sources[0]?.starts).toEqual([12.5]);
  });

  it('対応表に 1 行足した場面は、ファイルで鳴る（B・C を足すときは、ファイルと台帳と対応表だけ）', async () => {
    const { sound } = await ready({
      join: { url: '/sounds/A-join.mp3', gain: 0.11 },
      friend: { url: '/sounds/B-friend.mp3', gain: 0.1 },
      fever: { url: '/sounds/C-fever.mp3', gain: 0.1 },
    });
    sound.play('friend');
    sound.play('fever');
    expect(sources).toHaveLength(2);
    expect(oscillators).toBe(0);
    expect(fileGains).toEqual([0.1, 0.1]);
  });

  it('ファイルを読むのは、場面ごとに 1 回だけ（鳴らすたびには読まない）。unlock を何度呼んでも、1 回', async () => {
    const loadBytes = vi.fn(bytes);
    const { sound } = await ready(JOIN_ONLY, loadBytes);
    sound.unlock();
    sound.unlock();
    sound.play('join');
    sound.play('join');
    await flush();
    expect(loadBytes).toHaveBeenCalledTimes(1);
    expect(loadBytes).toHaveBeenCalledWith('/sounds/A-join.mp3');
  });
});

describe('ファイルが使えないときは、いまの合成の音を鳴らす（無音にしない。例外を出さない）', () => {
  it('ファイルを持たない場面（join だけの対応表での friend・fever、ファイルの対象ではない stage・share）は、合成のまま', async () => {
    const { sound } = await ready();
    for (const cue of ['friend', 'fever', 'stage', 'share'] as const) {
      const before = oscillators;
      sound.play(cue);
      expect(oscillators, cue).toBeGreaterThan(before);
    }
    expect(sources).toHaveLength(0);
  });

  it('まだ読み込み中（読み終わる前）は、合成の音。読み終わったあとは、ファイルの音', async () => {
    let finish: (value: ArrayBuffer) => void = () => undefined;
    const pending = vi.fn(() => new Promise<ArrayBuffer>((resolve) => (finish = resolve)));
    const sound = createSound({ files: JOIN_ONLY, loadBytes: pending });
    sound.unlock();
    sound.play('join');
    expect(oscillators).toBeGreaterThan(0);
    expect(sources).toHaveLength(0);
    finish(new ArrayBuffer(8));
    await flush();
    oscillators = 0;
    sound.play('join');
    expect(sources).toHaveLength(1);
    expect(oscillators).toBe(0);
  });

  it('復号できないとき（decodeAudioData が失敗）は、合成の音', async () => {
    decode = () => Promise.reject(new Error('復号できない'));
    const { sound } = await ready();
    expect(() => sound.play('join')).not.toThrow();
    expect(oscillators).toBeGreaterThan(0);
    expect(sources).toHaveLength(0);
  });

  it.each([
    ['読み込みが失敗する（404・通信できない）', () => Promise.reject(new Error('読めない'))],
    [
      '読み込みの関数が、すぐ例外を出す',
      () => {
        throw new Error('すぐ失敗');
      },
    ],
  ])('%s: 合成の音。例外を出さない', async (_name, loadBytes) => {
    const { sound } = await ready(JOIN_ONLY, vi.fn(loadBytes));
    expect(() => sound.play('join')).not.toThrow();
    expect(oscillators).toBeGreaterThan(0);
    expect(sources).toHaveLength(0);
  });

  it('復号の関数が無い環境（decodeAudioData が無い AudioContext）は、合成の音', async () => {
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        constructor() {
          super();
          Object.defineProperty(this, 'decodeAudioData', { value: undefined });
        }
      },
    );
    const { sound } = await ready();
    expect(() => sound.play('join')).not.toThrow();
    expect(oscillators).toBeGreaterThan(0);
  });

  it('ファイルを鳴らす途中で例外が出たとき（AudioBufferSourceNode が作れない）も、合成の音に切り替える', async () => {
    const { sound } = await ready();
    vi.spyOn(FakeAudioContext.prototype, 'createBufferSource').mockImplementation(() => {
      throw new Error('作れない');
    });
    expect(() => sound.play('join')).not.toThrow();
    expect(oscillators).toBeGreaterThan(0);
  });

  it('対応表が空なら、何も読まない。合成だけで鳴る（ファイルの無い版）', async () => {
    const { sound, loadBytes } = await ready({});
    sound.play('join');
    expect(loadBytes).not.toHaveBeenCalled();
    expect(oscillators).toBeGreaterThan(0);
  });
});

describe('読み込みの始まり（最初の描画を遅らせない。操作のあと・音がオンのときだけ）', () => {
  it('利用者の操作（unlock）の前は、読み込まない。音を作る（AudioContext）のも、操作のあと', () => {
    const loadBytes = vi.fn(bytes);
    const sound = createSound({ files: JOIN_ONLY, loadBytes });
    sound.play('join');
    expect(loadBytes).not.toHaveBeenCalled();
    expect(oscillators).toBe(0);
    expect(sources).toHaveLength(0);
  });

  it('音がオフのあいだは読み込まない。オンに戻したときに読む', async () => {
    const loadBytes = vi.fn(bytes);
    const sound = createSound({ files: JOIN_ONLY, loadBytes });
    sound.setOn(false);
    sound.unlock();
    await flush();
    expect(loadBytes).not.toHaveBeenCalled();
    sound.setOn(true);
    await flush();
    expect(loadBytes).toHaveBeenCalledTimes(1);
    sound.play('join');
    expect(sources).toHaveLength(1);
  });

  it('音が使えない環境（AudioContext が無い）では、読み込まない', async () => {
    vi.stubGlobal('AudioContext', undefined);
    const loadBytes = vi.fn(bytes);
    const sound = createSound({ files: JOIN_ONLY, loadBytes });
    sound.unlock();
    await flush();
    expect(loadBytes).not.toHaveBeenCalled();
    expect(() => sound.play('join')).not.toThrow();
  });
});

describe('音をオフにしたら、鳴っているファイルの音も、その場で止まる', () => {
  it('ファイルの音を鳴らした直後にオフにすると、止めて（引数なしの stop）、出力から切り離す', async () => {
    const { sound } = await ready();
    sound.play('join');
    sound.setOn(false);
    expect(sources[0]?.stops).toContain(undefined);
    expect(sources[0]?.disconnected).toBeGreaterThan(0);
    expect(sound.isOn()).toBe(false);
  });

  it('オフのあとは、ファイルの音も鳴らさない。オンに戻すと、また鳴る', async () => {
    const { sound } = await ready();
    sound.setOn(false);
    sound.play('join');
    expect(sources).toHaveLength(0);
    expect(oscillators).toBe(0);
    sound.setOn(true);
    sound.play('join');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.stops).not.toContain(undefined);
  });

  it('もう鳴り終わったファイルの音（長さ 2.2 秒を過ぎた）には、触らない', async () => {
    const { sound } = await ready();
    sound.play('join'); // 時刻 0 から 2.2 秒
    now = 10;
    sound.play('join');
    sound.setOn(false);
    expect(sources[0]?.stops).not.toContain(undefined);
    expect(sources[1]?.stops).toContain(undefined);
  });

  it('止める操作が使えない環境（停止・切り離しが例外を出す）でも、オフにして落ちない', async () => {
    const { sound } = await ready();
    vi.spyOn(FakeAudioContext.prototype, 'createBufferSource').mockImplementation(() => ({
      buffer: null,
      connect: () => undefined,
      disconnect: () => {
        throw new Error('disconnect');
      },
      start: () => undefined,
      stop: () => {
        throw new Error('stop');
      },
    }));
    sound.play('join');
    expect(() => sound.setOn(false)).not.toThrow();
    expect(sound.isOn()).toBe(false);
  });
});

describe('ファイルの音が鳴っている間は、合成の stage・share を重ねない（FEVER の音と、ファイルの音は、いつも鳴らす）', () => {
  it('join のファイルの音が鳴っている間（0.65 秒後の FEVER 目前の stage）は、合成の stage を鳴らさない', async () => {
    const { sound } = await ready();
    sound.play('join');
    now = 0.65;
    sound.play('stage');
    expect(oscillators).toBe(0);
    sound.play('share');
    expect(oscillators).toBe(0);
  });

  it('ファイルの音が鳴り終わったあと（2.2 秒を過ぎたあと）は、合成の stage も share も鳴る', async () => {
    const { sound } = await ready();
    sound.play('join');
    now = 2.3;
    sound.play('stage');
    expect(oscillators).toBeGreaterThan(0);
    const before = oscillators;
    sound.play('share');
    expect(oscillators).toBeGreaterThan(before);
  });

  it('join のファイルの音が鳴っている間でも、FEVER・friend の音（join だけの対応表では合成）は鳴らす', async () => {
    const { sound } = await ready();
    sound.play('join');
    now = 1.8;
    for (const cue of ['fever', 'friend'] as const) {
      const before = oscillators;
      sound.play(cue);
      expect(oscillators, cue).toBeGreaterThan(before);
    }
  });

  it('ファイルを使えなかった join（合成）のあとの stage は、いままでどおり鳴る（重ねない決まりは、ファイルの音があるときだけ）', async () => {
    decode = () => Promise.reject(new Error('復号できない'));
    const { sound } = await ready();
    sound.play('join'); // 合成（0.57 秒）
    now = 0.65;
    const before = oscillators;
    sound.play('stage');
    expect(oscillators).toBeGreaterThan(before);
  });
});

describe('対応表（SOUND_FILES）', () => {
  it('いまは join（A）と friend（B）。fever（C）は、ファイルが届くまで、ない（合成のまま）', () => {
    expect(Object.keys(SOUND_FILES)).toEqual(['join', 'friend']);
    expect(SOUND_FILES.join?.url).toBe('/sounds/A-join.mp3');
    expect(SOUND_FILES.friend?.url).toBe('/sounds/B-friend.mp3');
    expect(SOUND_FILES.fever).toBeUndefined();
  });

  it('音量は、ほかの合成の音と大きく違わない（変換のとき、ピークを -1 dBFS 前後にそろえてあるので、音量の値が、そのまま出力のピーク。合成の音の上限 0.1 と同じ程度）', () => {
    for (const file of Object.values(SOUND_FILES)) {
      expect(file.gain).toBeGreaterThan(0.05);
      expect(file.gain).toBeLessThanOrEqual(0.12);
    }
  });
});

describe('ファイルを読む（fetchSoundBytes）。画面と同じ配信元から読み、API は呼ばない', () => {
  it('成功したら、バイト列を返す。読む先は、渡した URL（同じ配信元の /sounds/）だけ', async () => {
    const fetchMock = vi.fn((_url: string) =>
      Promise.resolve(new Response(new Uint8Array([1, 2, 3]))),
    );
    vi.stubGlobal('fetch', fetchMock);
    const got = await fetchSoundBytes('/sounds/A-join.mp3');
    expect(Array.from(new Uint8Array(got))).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/sounds/A-join.mp3');
  });

  it.each([404, 500])('HTTP %i は、失敗にする（壊れた中身を復号に渡さない）', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not found', { status }))),
    );
    await expect(fetchSoundBytes('/sounds/A-join.mp3')).rejects.toThrow();
  });

  it('通信できないとき（ネットワークの失敗）は、失敗にする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(fetchSoundBytes('/sounds/A-join.mp3')).rejects.toThrow();
  });
});
