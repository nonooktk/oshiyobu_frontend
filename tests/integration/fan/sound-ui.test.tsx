// 称賛の音のボタンと、鳴る・鳴らない条件（画面）。本物の音は出さず、AudioContext の代わりに記録するだけの偽物を渡す。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  click,
  fireEvent,
  fundAndApply,
  mountFan,
  passStart,
  screen,
  setupFanTest,
  tick,
} from './helpers';

setupFanTest();

let oscillators = 0;
class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume() {
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
    };
  }
  createOscillator() {
    oscillators += 1;
    return {
      type: '',
      frequency: { value: 0 },
      connect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
    };
  }
}

const toggle = () => screen.getByRole('button', { name: '称賛の音' });

beforeEach(() => {
  oscillators = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
});

describe('音のボタン', () => {
  it('はじめの画面・ホームの上の帯に、常にある。既定はオン。押すとオフ、もう一度でオン', () => {
    mountFan('?p=4');
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle());
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    passStart();
    expect(toggle()).toBeTruthy(); // ホームにも
  });

  it('押せる大きさ（高さ 44px 以上）の指定がある', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/fan/fan.module.css', 'utf8');
    const block = /\.soundBtn\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(block).toMatch(/width:\s*var\(--tap\)/);
    expect(block).toMatch(/height:\s*var\(--tap\)/);
  });
});

describe('鳴る・鳴らない条件', () => {
  it('利用者の操作（pointerdown）の前は、鳴らない。操作のあと、申し込むと鳴る', async () => {
    mountFan('?p=4');
    click('次へ');
    click('このコースを目指して始める');
    fundAndApply(); // click だけ（pointerdown が無い = 操作の前）
    expect(oscillators).toBe(0);
    await tick(10_000);
    expect(oscillators).toBe(0);
  });

  it('pointerdown のあと、申し込むと称賛の音が鳴る。待っている間は、増えない', async () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    click('次へ');
    click('このコースを目指して始める');
    fundAndApply();
    expect(oscillators).toBeGreaterThan(0);
    await tick(700);
    const afterStage = oscillators;
    await tick(30_000);
    expect(oscillators).toBe(afterStage);
  });

  it('音をオフにすると鳴らない。オンに戻すと鳴る', () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    fireEvent.click(toggle());
    click('次へ');
    click('このコースを目指して始める');
    fundAndApply();
    expect(oscillators).toBe(0);
  });

  it('音が使えない環境（AudioContext が無い）でも、申し込みまで何事もなく進む', async () => {
    vi.stubGlobal('AudioContext', undefined);
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    expect(() => passStart()).not.toThrow();
    await tick(3000);
    expect(oscillators).toBe(0);
  });
});
