// ファン向けの「閉じたら戻す」「5 分で戻す」の時計とイベント（ひとり体験のとき。時刻は偽の時計で進める）。
// 閉じる・再読み込み・別のページへ ＝ pagehide。bfcache から戻る ＝ pageshow の persisted。
// 最後の操作 ＝ pointerdown・keydown・touchstart・scroll・wheel（画面が見える状態に戻ったことは、操作に数えない）
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFanLifecycle } from '../../../src/fan/store/lifecycle';

const IDLE_MS = 300_000; // 仕様: 5 分（300 秒）
const TEXT = 'しばらく操作がなかったので、最初に戻しました';

let resetForIdle: ReturnType<typeof vi.fn<() => boolean>>;
let resetQuiet: ReturnType<typeof vi.fn<() => void>>;
let notice: ReturnType<typeof vi.fn<(text: string) => void>>;
let life: { dispose: () => void };

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};
const operate = (type: string) => window.dispatchEvent(new Event(type));
const pageshow = (persisted: boolean) =>
  window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  resetForIdle = vi.fn(() => true);
  resetQuiet = vi.fn();
  notice = vi.fn();
  life = createFanLifecycle({ resetForIdle, resetQuiet, notice });
});
afterEach(() => {
  life.dispose();
  vi.useRealTimers();
});

describe('5 分で戻す（最後の操作から 300 秒）', () => {
  it('操作が無いまま 300 秒たつと、初めの状態に戻し、理由を伝える。299 秒では戻さない', () => {
    vi.advanceTimersByTime(IDLE_MS - 1000);
    expect(resetForIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(resetForIdle).toHaveBeenCalledTimes(1);
    expect(notice).toHaveBeenCalledWith(TEXT);
  });

  it.each(['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'])(
    '%s で、時計が最初から数え直しになる',
    (type) => {
      vi.advanceTimersByTime(IDLE_MS - 1000);
      operate(type);
      vi.advanceTimersByTime(IDLE_MS - 1000);
      expect(resetForIdle).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(resetForIdle).toHaveBeenCalledTimes(1);
    },
  );

  it('操作が続くかぎり、戻さない（4 分ごとに操作して 20 分）', () => {
    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(240_000);
      operate('pointerdown');
    }
    expect(resetForIdle).not.toHaveBeenCalled();
  });

  it('戻したあと、また操作が無くても、もう一度は戻さない（操作があるまで 1 回だけ）。操作したあとは、また 300 秒で戻す', () => {
    vi.advanceTimersByTime(IDLE_MS);
    expect(resetForIdle).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(IDLE_MS * 3);
    expect(resetForIdle).toHaveBeenCalledTimes(1);
    operate('keydown');
    vi.advanceTimersByTime(IDLE_MS);
    expect(resetForIdle).toHaveBeenCalledTimes(2);
  });

  it('戻すものが無い（はじめの画面のまま）ときは、理由を出さない', () => {
    resetForIdle.mockReturnValue(false);
    vi.advanceTimersByTime(IDLE_MS);
    expect(resetForIdle).toHaveBeenCalledTimes(1);
    expect(notice).not.toHaveBeenCalled();
  });
});

describe('画面が裏に回っている間', () => {
  it('時計は進む。裏で 300 秒たったあと、見える状態に戻ったとき、タイマーが止められていても、その場で戻す', () => {
    const timers = vi.getTimerCount();
    expect(timers).toBeGreaterThan(0);
    setVisibility('hidden');
    // ブラウザがタイマーを止めた（発火しない）ことにする: 時刻だけを進める
    vi.setSystemTime(Date.now() + IDLE_MS + 1000);
    expect(resetForIdle).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(resetForIdle).toHaveBeenCalledTimes(1);
    expect(notice).toHaveBeenCalledWith(TEXT);
  });

  it('裏でタイマーが発火して戻した場合、状態は裏で戻し、理由は、見える状態に戻ったときに伝える', () => {
    setVisibility('hidden');
    vi.advanceTimersByTime(IDLE_MS);
    expect(resetForIdle).toHaveBeenCalledTimes(1);
    expect(notice).not.toHaveBeenCalled();
    setVisibility('visible');
    expect(notice).toHaveBeenCalledWith(TEXT);
    expect(resetForIdle).toHaveBeenCalledTimes(1);
  });

  it('見える状態に戻ったこと自体は、操作に数えない（戻っても、300 秒の時計は延びない）', () => {
    vi.advanceTimersByTime(IDLE_MS - 10_000);
    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(10_000);
    expect(resetForIdle).toHaveBeenCalledTimes(1);
  });

  it('裏に回っても 300 秒たっていなければ、戻さない', () => {
    vi.advanceTimersByTime(100_000);
    setVisibility('hidden');
    setVisibility('visible');
    expect(resetForIdle).not.toHaveBeenCalled();
  });
});

describe('閉じたら戻す', () => {
  it('pagehide（閉じる・再読み込み・別のページへ）で、初めの状態に戻す', () => {
    window.dispatchEvent(new Event('pagehide'));
    expect(resetQuiet).toHaveBeenCalledTimes(1);
  });

  it('bfcache から戻ったとき（pageshow の persisted）も、初めの状態に戻す。ふつうの表示（persisted でない）では何もしない', () => {
    pageshow(false);
    expect(resetQuiet).not.toHaveBeenCalled();
    pageshow(true);
    expect(resetQuiet).toHaveBeenCalledTimes(1);
  });

  it('bfcache から戻ったあとは、5 分の時計も最初から数え直す', () => {
    vi.advanceTimersByTime(IDLE_MS - 1000);
    pageshow(true);
    vi.advanceTimersByTime(IDLE_MS - 1000);
    expect(resetForIdle).not.toHaveBeenCalled();
  });
});

describe('やめるとき', () => {
  it('dispose のあとは、イベントにも時計にも反応しない', () => {
    life.dispose();
    window.dispatchEvent(new Event('pagehide'));
    pageshow(true);
    vi.advanceTimersByTime(IDLE_MS * 2);
    expect(resetQuiet).not.toHaveBeenCalled();
    expect(resetForIdle).not.toHaveBeenCalled();
  });
});
