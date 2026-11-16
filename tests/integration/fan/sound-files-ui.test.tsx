// 称賛の音の、音源ファイル（G-04）を、画面（本物のストア・本物の音の部品）で確かめる。
// 申し込んだ瞬間（join）・仲間を呼んだ瞬間（friend）・最後の演出（fever）はファイルの音。ほかの場面（段階が上がる音・SNS 投稿など）は合成のまま。ファイルが読めなければ、合成の音。
// 本物の音は出さず、AudioContext の代わり（記録するだけの偽物）と、配信の代わり（/sounds/ の要求だけ受ける偽の fetch）を渡す。
// ひとり体験は、API を 1 回も呼ばない（音源の読み込みは、画面と同じ配信元の /sounds/ で、API ではない）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  api,
  fireEvent,
  fundAndApply,
  mountFan,
  passStartOnly,
  screen,
  setupFanTest,
  tick,
  click,
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
/** 404 にする音源（URL）。ここに入れたファイルだけ、読めない（それ以外は soundStatus）。 */
let soundMissing: string[] = [];
/** 最初の操作のあとに読む音源（対応表の順。join が A、friend が B、fever が C） */
const FILES_READ = ['/sounds/A-join.mp3', '/sounds/B-friend.mp3', '/sounds/C-fever.mp3'];

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
  soundMissing = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  // /sounds/ への要求だけ受ける。それ以外（API）は、偽のサーバーへ回して、呼ばれたことが分かるようにする
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/sounds/')) {
        soundRequests.push(url);
        const status = soundMissing.includes(url) ? 404 : soundStatus;
        return Promise.resolve(new Response(new ArrayBuffer(8), { status }));
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

describe('申し込んだ瞬間（join）は、音源ファイルの音', () => {
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

describe('音源ファイルの 3 場面（G-04）: 参加 ＝ A、SNS で広めた瞬間 ＝ B、プランを上げた瞬間 ＝ C', () => {
  it('それぞれの瞬間に、ファイルの音が 1 つずつ鳴る。その場面では、合成の音を重ねない。API は呼ばない', async () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    await settle();
    expect(soundRequests).toEqual(FILES_READ);
    click('次へ');
    click(/で参加する$/);
    expect(sources).toHaveLength(0); // 確認の枠を出しただけでは鳴らない
    const osc0 = oscillators;
    click('参加する');
    expect(sources).toHaveLength(1); // A（join）
    expect(oscillators).toBe(osc0);
    await tick(2600);
    fundAndApply();
    fireEvent.pointerDown(document.body);
    const osc1 = oscillators;
    click(/^SNSで広める/);
    click('X');
    expect(sources).toHaveLength(2); // B（friend）
    expect(oscillators).toBe(osc1);
    await tick(3000);
    click('閉じる');
    const osc2 = oscillators;
    click(/^プランを上げる/);
    click('ゴールドプランに上げる');
    expect(sources).toHaveLength(3); // C（fever）
    expect(oscillators).toBe(osc2);
    expect(api.log).toEqual([]);
  });
});

describe('ファイルが読めないときは、いまの合成の音（画面は何事もなく進む）', () => {
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
