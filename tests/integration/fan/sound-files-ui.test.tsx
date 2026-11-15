// 称賛の音の、音源ファイル（G-04）を、画面（本物のストア・本物の音の部品）で確かめる。
// 申し込んだ瞬間（join）と、仲間を呼んだ瞬間（friend）はファイルの音。ほかの場面（最後の演出 fever など）は合成のまま。ファイルが読めなければ、合成の音。
// 本物の音は出さず、AudioContext の代わり（記録するだけの偽物）と、配信の代わり（/sounds/ の要求だけ受ける偽の fetch）を渡す。
// ひとり体験は、API を 1 回も呼ばない（音源の読み込みは、画面と同じ配信元の /sounds/ で、API ではない）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  act,
  api,
  fireEvent,
  fundAndApply,
  mountFan,
  passStartOnly,
  screen,
  setupFanTest,
  tick,
} from './helpers';

setupFanTest();

interface FakeSource {
  starts: number[];
  stops: (number | undefined)[];
}
let sources: FakeSource[] = [];
let oscillators = 0;
/** /sounds/ へ出た要求（URL）。 */
let soundRequests: string[] = [];
/** 音源の配信の応答（既定は 200）。 */
let soundStatus = 200;
/** 最初の操作のあとに読む音源（対応表の順。join が A、friend が B。fever は合成のまま） */
const FILES_READ = ['/sounds/A-join.mp3', '/sounds/B-friend.mp3'];

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 2.2 });
  }
  createBufferSource() {
    const source: FakeSource = { starts: [], stops: [] };
    sources.push(source);
    return {
      buffer: null,
      connect: () => undefined,
      disconnect: () => undefined,
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
        value: 0,
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
  soundRequests = [];
  soundStatus = 200;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  // /sounds/ への要求だけ受ける。それ以外（API）は、偽のサーバーへ回して、呼ばれたことが分かるようにする
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/sounds/')) {
        soundRequests.push(url);
        return Promise.resolve(new Response(new ArrayBuffer(8), { status: soundStatus }));
      }
      return api.fetch(input, init);
    }),
  );
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
});

/** 読み込み・復号の約束事（Promise）が終わるまで進める。 */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await tick(0);
};
const toggle = (): HTMLElement =>
  screen.getAllByRole('button', { name: '称賛の音' })[0] as HTMLElement;
/** 申し込んで、特典の絵を閉じて、「仲間を呼ぶ」を押せる状態にする（音源の読み込みは終わっている）。 */
async function readyToCallFriends(): Promise<void> {
  mountFan('?p=4');
  fireEvent.pointerDown(document.body);
  await settle();
  passStartOnly();
  fundAndApply();
  await tick(700 + 2600);
  fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
}
/** 「仲間を呼ぶ」を押す。 */
const callFriends = (): Promise<void> =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^仲間を呼ぶ/ }));
  });

describe('申し込んだ瞬間（join）は、音源ファイルの音', () => {
  it('最初の操作のあとに /sounds/A-join.mp3 と /sounds/B-friend.mp3 を 1 回ずつ読む。申し込むと join のファイルが鳴り、FEVER 目前の合成の stage は重ねない。API は呼ばない', async () => {
    mountFan('?p=4');
    expect(soundRequests).toEqual([]); // 開いただけ（最初の描画）では、読まない
    fireEvent.pointerDown(document.body);
    await settle();
    expect(soundRequests).toEqual(FILES_READ);
    passStartOnly();
    fundAndApply(); // 推し活定期（合成の stage）→ 条件に届く積み増し（合成の stage）→ 申し込み（ファイルの join）
    expect(sources).toHaveLength(1);
    const synthBefore = oscillators;
    expect(synthBefore).toBeGreaterThan(0); // 申し込む前の 2 つは、合成のまま
    await tick(700); // 0.65 秒後の FEVER 目前の stage は、ファイルの音に重ねない
    expect(oscillators).toBe(synthBefore);
    await tick(30_000);
    expect(oscillators).toBe(synthBefore);
    expect(sources).toHaveLength(1);
    expect(soundRequests).toEqual(FILES_READ); // 鳴らすたびには読まない
    expect(api.fetch).not.toHaveBeenCalled(); // ひとり体験は、API を呼ばない
  });

  it('音のボタンでオフにすると、鳴っているファイルの音も止まる（演出の最中でも）', async () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    await settle();
    passStartOnly();
    fundAndApply();
    expect(sources).toHaveLength(1);
    expect(sources[0]?.stops).not.toContain(undefined);
    await tick(700); // 演出が出ている
    // 層の下の画面は押せない。押せる音のボタン（層の上に出る）を押す
    const pressable = screen
      .getAllByRole('button', { name: '称賛の音' })
      .filter((el) => !el.closest('[inert]'));
    expect(pressable).toHaveLength(1);
    fireEvent.click(pressable[0] as HTMLElement);
    expect(sources[0]?.stops).toContain(undefined);
  });
});

describe('ファイルが読めないときは、いまの合成の音（画面は何事もなく進む）', () => {
  it('配信が 404 のとき: 申し込むと、合成の join が鳴る。ファイルの音は鳴らない', async () => {
    soundStatus = 404;
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    await settle();
    expect(soundRequests).toEqual(FILES_READ);
    passStartOnly();
    expect(() => fundAndApply()).not.toThrow();
    expect(sources).toHaveLength(0);
    expect(oscillators).toBeGreaterThan(0);
    await tick(700);
    expect(document.querySelector('[data-layer="fx"]')).not.toBeNull(); // 申し込みの演出まで進んだ
  });

  it('音がオフのあいだは読まない。オンに戻して次の操作をすると読む', async () => {
    mountFan('?p=4');
    fireEvent.click(toggle()); // オフ（操作の前なので、まだ unlock されない）
    fireEvent.pointerDown(document.body);
    await settle();
    expect(soundRequests).toEqual([]);
    fireEvent.click(toggle()); // オン
    await settle();
    expect(soundRequests).toEqual(FILES_READ);
  });
});

describe('仲間を呼んだ瞬間（friend）は B のファイルの音。ほかの場面（成立の fever・SNS 投稿・段階が上がる音）は、合成のまま（C が届くまで）', () => {
  it('仲間を呼ぶ（friend）は B のファイルが鳴り、成立（fever）は、ファイルが無いので、合成の音で鳴る', async () => {
    await readyToCallFriends();
    const before = oscillators;
    expect(sources).toHaveLength(1); // ここまでのファイルの音は、join の 1 回だけ
    await callFriends();
    expect(sources).toHaveLength(2); // friend は B のファイルの音
    expect(oscillators).toBe(before); // 合成の friend は鳴らさない（二重にしない）
    await tick(2600);
    expect(oscillators).toBeGreaterThan(before); // fever は合成の音（止めない）
    expect(sources).toHaveLength(2); // ファイルの音は増えない
  });

  it('「動きを減らす」設定でも、仲間を呼ぶと B のファイルが鳴り、1.8 秒後に fever の合成が鳴る（B が鳴っている間でも、止めない）', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: /reduce/.test(q), media: q }));
    await readyToCallFriends();
    await callFriends();
    const afterCall = oscillators;
    expect(sources).toHaveLength(2); // friend は B のファイルの音
    await tick(1799);
    expect(oscillators).toBe(afterCall); // fever の前
    await tick(1);
    expect(oscillators).toBeGreaterThan(afterCall); // fever（合成）
    expect(sources).toHaveLength(2);
  });

  it('仲間を呼んだ直後（演出の最中）に、音のボタンでオフにすると、鳴っている B のファイルの音も止まる', async () => {
    await readyToCallFriends();
    await callFriends();
    expect(sources).toHaveLength(2);
    expect(sources[1]?.stops).not.toContain(undefined);
    // 層の下の画面は押せない。押せる音のボタン（層の上に出る）を押す
    const pressable = screen
      .getAllByRole('button', { name: '称賛の音' })
      .filter((el) => !el.closest('[inert]'));
    expect(pressable).toHaveLength(1);
    fireEvent.click(pressable[0] as HTMLElement);
    expect(sources[1]?.stops).toContain(undefined);
  });
});
