// 称賛の音（統括の決定）。音の素材ファイルは使わず、Web Audio で合成する（外部の読み込みなし・量は増やさない）。
// 鳴らすのは、利用者が行動した直後の称賛と、段階が上がった瞬間・FEVER の瞬間だけ（待っている間は鳴らさない）。
// 短く（1 秒前後。FEVER は 2〜3 秒まで）、音量は控えめ、明るい音階（メジャーペンタトニック。遊技や賭けを連想させる音にしない。G-04）。
// 鳴る条件: ①音がオン ②利用者の操作のあと（自動再生の制限に従う。unlock が呼ばれたあと）③音が使える環境。どれかが欠けたら、黙って何もしない。
// 「動きを減らす」設定とは別に扱う（音のオン・オフは、画面の音ボタン）。

/** 音を鳴らす場面。 */
export type SoundCue = 'join' | 'share' | 'friend' | 'stage' | 'fever';

interface Note {
  /** 鳴らし始める時刻（秒。合図からの相対）。 */
  readonly at: number;
  readonly hz: number;
  /** 長さ（秒）。 */
  readonly dur: number;
  /** 音量（0〜1）。省略は VOLUME。 */
  readonly gain?: number;
}

/** 音量（控えめ）。 */
const VOLUME = 0.08;
/** 明るい音階の周波数（C 長調のペンタトニック: ド・レ・ミ・ソ・ラ）。 */
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.51;

/** 場面ごとの音（短い上昇の音列）。FEVER だけ、和音が長く残る（3 秒以内）。 */
export const CUES: Record<SoundCue, readonly Note[]> = {
  join: [
    { at: 0, hz: E5, dur: 0.22 },
    { at: 0.12, hz: G5, dur: 0.45 },
  ],
  share: [
    { at: 0, hz: D5, dur: 0.2 },
    { at: 0.1, hz: A5, dur: 0.4 },
  ],
  friend: [
    { at: 0, hz: C5, dur: 0.2 },
    { at: 0.12, hz: E5, dur: 0.2 },
    { at: 0.24, hz: G5, dur: 0.5 },
  ],
  stage: [
    { at: 0, hz: E5, dur: 0.2 },
    { at: 0.13, hz: G5, dur: 0.2 },
    { at: 0.26, hz: C6, dur: 0.6 },
  ],
  fever: [
    { at: 0, hz: C5, dur: 0.25 },
    { at: 0.12, hz: E5, dur: 0.25 },
    { at: 0.24, hz: G5, dur: 0.25 },
    { at: 0.36, hz: C6, dur: 0.25 },
    { at: 0.48, hz: E6, dur: 0.3 },
    { at: 0.62, hz: C5, dur: 1.9, gain: 0.04 },
    { at: 0.62, hz: G5, dur: 1.9, gain: 0.04 },
    { at: 0.62, hz: C6, dur: 1.9, gain: 0.04 },
  ],
};

type AudioCtor = new () => AudioContext;

/** 音が使える環境なら、AudioContext の作り方を返す（無ければ null）。 */
function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export interface Sound {
  /** 音のオン・オフ（既定はオン）。 */
  setOn: (on: boolean) => void;
  isOn: () => boolean;
  /** 利用者の操作（押す・キーを押す）の中で呼ぶ。以後、鳴らせる。使えない環境では何もしない。 */
  unlock: () => void;
  /** 称賛の音を鳴らす。条件が欠けていれば、黙って何もしない（例外を出さない）。 */
  play: (cue: SoundCue) => void;
}

export function createSound(): Sound {
  let on = true;
  let ctx: AudioContext | null = null;
  let unsupported = false;
  return {
    setOn(next) {
      on = next;
    },
    isOn: () => on,
    unlock() {
      if (ctx !== null || unsupported) return;
      try {
        const Ctor = audioCtor();
        if (Ctor === null) {
          unsupported = true;
          return;
        }
        ctx = new Ctor();
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      } catch {
        unsupported = true;
        ctx = null;
      }
    },
    play(cue) {
      const audio = ctx;
      if (!on || audio === null) return; // オフ・操作の前・使えない環境
      try {
        if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
        const t0 = audio.currentTime;
        for (const note of CUES[cue]) {
          const start = t0 + note.at;
          const end = start + note.dur;
          const osc = audio.createOscillator();
          const amp = audio.createGain();
          osc.type = 'triangle'; // やわらかい音
          osc.frequency.value = note.hz;
          amp.gain.setValueAtTime(0.0001, start);
          amp.gain.linearRampToValueAtTime(note.gain ?? VOLUME, start + 0.015);
          amp.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(amp);
          amp.connect(audio.destination);
          osc.start(start);
          osc.stop(end + 0.02);
        }
      } catch {
        // 音が出せなくても、画面は何事もなく進む
      }
    },
  };
}
