// 称賛の音（統括の決定）。基本は Web Audio で合成する（外部の読み込みなし）。
// 申し込んだ瞬間・仲間を呼んだ瞬間・最後の演出（join・friend・fever）の 3 場面だけ、音源ファイル（public/sounds/。対応表は sound-files.ts）に差し替える（G-04）。
//   ファイルが無い・読めない・復号できない・まだ読み込み中のときは、いまの合成の音を鳴らす（無音にしない。例外を外に出さない）。
//   ファイルは、AudioContext に載せて鳴らす（fetch → decodeAudioData → AudioBufferSourceNode）。<audio> は使わない。
//   理由: 音のオフで鳴っている音も予約した音もその場で止める・演出の最中も音のボタンを押せる・最初の操作で音を解く、を、合成と同じ経路で保つため。
// 鳴らすのは、利用者が行動した直後の称賛と、段階が上がった瞬間・FEVER の瞬間だけ（待っている間は鳴らさない）。
// 短く（1 秒前後。FEVER は 2〜3 秒まで。ファイルは 2.2〜2.5 秒）、音量は控えめ、明るい音階（メジャーペンタトニック。遊技や賭けを連想させる音にしない。G-04）。
// 鳴る条件: ①音がオン ②利用者の操作のあと（自動再生の制限に従う。unlock が呼ばれたあと）③音が使える環境。どれかが欠けたら、黙って何もしない。
// 「動きを減らす」設定とは別に扱う（音のオン・オフは、画面の音ボタン）。
// オフにしたら、鳴り始めた音・予約した音（ファイルの音も）も、その場で止める（演出の最中でも、音のボタンは押せる）。
import { FILE_CUES, SOUND_FILES, fetchSoundBytes } from './sound-files';
import type { FileCue, SoundFileMap } from './sound-files';

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

/**
 * ファイルの音が鳴っている間は、重ねない合成の場面（段階が上がる音・行動の音）。
 * join のファイルは、C の全音音階の駆け上がり（C・D・E・F#・G#・A#）が C 長調の和音（E・G・C）に解決し、残響に G#・A# が残る（変換のとき、周波数を測った）。
 * 0.65 秒後の合成の stage（E・G・C の分散和音）は、残響の G# と半音でぶつかり、にごりうる。そのため、ファイルがある場面では重ねない。
 * FEVER の音（合成）は、ファイルの音が鳴っていても止めない（FEVER の瞬間を、無音にしない）。ファイルが読めないときの join・friend の合成も、同じ。
 * friend のファイル（B）は、FEVER の合成と重なることがある（「動きを減らす」設定）。拍手には音程が無く、にごりにくい。重なる長さ・音量の数値は、台帳 public/sounds/ledger.md。
 */
const HELD_BACK_BY_FILE: readonly SoundCue[] = ['stage', 'share'];

const isFileCue = (cue: SoundCue): cue is FileCue => (FILE_CUES as readonly string[]).includes(cue);

type AudioCtor = new () => AudioContext;

/** 音が使える環境なら、AudioContext の作り方を返す（無ければ null）。 */
function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export interface SoundOptions {
  /** 場面 → 音源ファイル（既定は sound-files.ts の対応表）。テストが差し替える */
  files?: SoundFileMap;
  /** 音源ファイルのバイト列を読む関数（既定は、同じ配信元から読む）。テストが差し替える */
  loadBytes?: (url: string) => Promise<ArrayBuffer>;
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

/** 鳴っている最中・予約した音（オフにしたとき、その場で止めるために覚える）。合成の音（オシレーター）も、ファイルの音も、同じ形で覚える。 */
interface Playing {
  readonly source: AudioScheduledSourceNode;
  readonly amp: GainNode;
  /** 鳴り終わる時刻（AudioContext の時計）。 */
  readonly end: number;
  /** ファイルの音か（鳴っている間、合成の stage・share を重ねないために覚える）。 */
  readonly file: boolean;
}

export function createSound(options: SoundOptions = {}): Sound {
  const files = options.files ?? SOUND_FILES;
  const loadBytes = options.loadBytes ?? fetchSoundBytes;
  let on = true;
  let ctx: AudioContext | null = null;
  let unsupported = false;
  let playing: Playing[] = [];
  /** 復号できたファイルの音（場面 → 音）。まだ無い場面は、合成の音を鳴らす。 */
  const buffers = new Map<FileCue, AudioBuffer>();
  let loadStarted = false;

  /** 鳴っている音・予約した音を、すぐ止めて、出力から切り離す（止められない環境でも、例外は出さない）。 */
  const silence = (): void => {
    const items = playing;
    playing = [];
    for (const { source, amp } of items) {
      try {
        source.stop();
      } catch {
        // 止められなくても、切り離せば鳴らない
      }
      try {
        amp.disconnect();
        source.disconnect();
      } catch {
        // 切り離せない環境でも、先へ進む
      }
    }
  };

  /** 1 つの場面のファイルを、読んで、復号する。どこで失敗しても、合成の音のまま（例外は外に出さない）。 */
  const load = async (audio: AudioContext, cue: FileCue, url: string): Promise<void> => {
    try {
      const decoded = await audio.decodeAudioData(await loadBytes(url));
      if (decoded) buffers.set(cue, decoded);
    } catch {
      // 読めない・復号できない・まだ無い: 合成の音を鳴らす
    }
  };
  /**
   * 音源ファイルを読み始める（1 回だけ）。最初の操作のあと（unlock のあと）・音がオンのときだけ。
   * 最初の描画のあとで、画面の表示を遅らせない。失敗しても、画面は動く。
   */
  const startLoading = (): void => {
    const audio = ctx;
    if (loadStarted || !on || audio === null) return;
    loadStarted = true;
    for (const cue of FILE_CUES) {
      const file = files[cue];
      if (file !== undefined) void load(audio, cue, file.url);
    }
  };

  /** ファイルの音を鳴らす。鳴らせたら true（できなかったときは、false を返して、合成の音に切り替える）。 */
  const playFile = (
    audio: AudioContext,
    buffer: AudioBuffer,
    gain: number,
    t0: number,
  ): boolean => {
    try {
      const source = audio.createBufferSource();
      const amp = audio.createGain();
      source.buffer = buffer;
      amp.gain.value = gain;
      source.connect(amp);
      amp.connect(audio.destination);
      source.start(t0);
      playing.push({ source, amp, end: t0 + buffer.duration, file: true });
      return true;
    } catch {
      return false;
    }
  };

  /** 合成の音を鳴らす（場面ごとの音列を、まとめて予約する）。 */
  const playSynth = (audio: AudioContext, cue: SoundCue, t0: number): void => {
    for (const note of CUES[cue]) {
      const start = t0 + note.at;
      const end = start + note.dur;
      const source = audio.createOscillator();
      const amp = audio.createGain();
      source.type = 'triangle'; // やわらかい音
      source.frequency.value = note.hz;
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.linearRampToValueAtTime(note.gain ?? VOLUME, start + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, end);
      source.connect(amp);
      amp.connect(audio.destination);
      source.start(start);
      source.stop(end + 0.02);
      playing.push({ source, amp, end: end + 0.02, file: false });
    }
  };

  return {
    setOn(next) {
      on = next;
      if (next)
        startLoading(); // オフのあいだは読まない。オンに戻したときに読む
      else silence(); // オフにしたら、鳴り始めた音・予約した音も、その場で止める
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
        return;
      }
      startLoading(); // 最初の操作のあとに、音源ファイルを読み始める（読めるまでは、合成の音）
    },
    play(cue) {
      const audio = ctx;
      if (!on || audio === null) return; // オフ・操作の前・使えない環境
      try {
        if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
        const t0 = audio.currentTime;
        playing = playing.filter((p) => p.end > t0); // もう鳴り終わった音は、覚えておかない
        const file = isFileCue(cue) ? files[cue] : undefined;
        const buffer = isFileCue(cue) ? buffers.get(cue) : undefined;
        if (file !== undefined && buffer !== undefined && playFile(audio, buffer, file.gain, t0)) {
          return; // ファイルの音。合成の音を重ねない
        }
        // ファイルの音が鳴っている間は、段階が上がる音・行動の音を重ねない（にごるため）
        if (HELD_BACK_BY_FILE.includes(cue) && playing.some((p) => p.file)) return;
        playSynth(audio, cue, t0);
      } catch {
        // 音が出せなくても、画面は何事もなく進む
      }
    },
  };
}
