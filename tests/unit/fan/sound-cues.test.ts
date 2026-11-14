// 称賛の音を鳴らす場面（統括の決定）: 利用者が行動した直後の称賛と、段階が上がった瞬間・FEVER の瞬間だけ。待っている間は鳴らさない。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SoundCue } from '../../../src/fan/sound';
import { harness, passStart } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('鳴る時点の一覧', () => {
  it('申し込んだ直後に join、0.65 秒後の FEVER 目前の演出で stage。そのあと待っても、追加では鳴らない', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    expect(sounds).toEqual([]); // 開いただけでは鳴らない
    passStart(h);
    expect(sounds).toEqual(['join']);
    vi.advanceTimersByTime(700);
    expect(sounds).toEqual(['join', 'stage']);
    vi.advanceTimersByTime(60_000); // 待っている間
    expect(sounds).toEqual(['join', 'stage']);
  });

  it('投稿した直後に share', async () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    passStart(h);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    sounds.length = 0;
    h.a.openShare('share');
    h.a.shareTo('ig');
    expect(sounds).toEqual(['share']);
  });

  it('仲間を呼んだ直後に friend、成立（FEVER の瞬間）で fever', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    passStart(h);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    sounds.length = 0;
    h.a.openShare('friend');
    h.a.closeShare();
    vi.advanceTimersByTime(2000);
    expect(sounds).toEqual(['friend']);
    vi.advanceTimersByTime(700);
    expect(sounds).toEqual(['friend', 'fever']);
  });

  it('コースの変更（申し込み済みのまま）・申し込みをやめる・リセットでは、鳴らさない', () => {
    const sounds: SoundCue[] = [];
    const h = harness(4, { solo: true, sounds });
    passStart(h);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    sounds.length = 0;
    h.a.openCancel();
    h.a.doCancel();
    h.a.resetFan();
    vi.advanceTimersByTime(10_000);
    expect(sounds).toEqual([]);
  });

  it('音のオン・オフは、リセットで変わらない（既定はオン）', () => {
    const h = harness(4, { solo: true });
    expect(h.state().soundOn).toBe(true);
    h.a.toggleSound();
    expect(h.state().soundOn).toBe(false);
    h.a.resetFan();
    expect(h.state().soundOn).toBe(false);
  });
});
