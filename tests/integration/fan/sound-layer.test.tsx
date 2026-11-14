// 演出・シートなどの層が出ている最中も、音のボタンは押せる（QA G2-13・H-06。統括の決定）。
// 層が出ているあいだ、下の画面（帯の音のボタンを含む）は押せなくなる（inert）。そこで、層の上に、同じ音のボタンをもう 1 つ出す。
// オフにしたら、そのあとに鳴るはずの音も鳴らない。層が閉じたら、層の上のボタンは消えて、帯の 1 つだけに戻る。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  click,
  closeGiftAfterFx,
  fireEvent,
  layer,
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
        cancelScheduledValues: () => undefined,
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
  oscillators = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
});

const toggles = (): HTMLElement[] => screen.getAllByRole('button', { name: '称賛の音' });
/** 押せる（下の画面が inert になっていない）音のボタン */
const pressable = (): HTMLElement[] => toggles().filter((el) => !el.closest('[inert]'));

describe('層が出ている最中の音のボタン', () => {
  it('層が無いときは、帯の 1 つだけ。押せる', () => {
    mountFan('?p=4');
    expect(toggles()).toHaveLength(1);
    expect(pressable()).toHaveLength(1);
  });

  it('演出の最中は、下の画面の音のボタンは押せないが、層の上に、押せる音のボタンが 1 つ出る（読み上げの名前も同じ）', async () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    passStart();
    await tick(700); // 申し込みの称賛（FEVER 目前）の演出
    expect(layer('fx')).not.toBeNull();
    expect(toggles()).toHaveLength(2);
    expect(pressable()).toHaveLength(1);
    expect(pressable()[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(pressable()[0]?.closest('[data-layer="fx"]')).toBeNull(); // 演出の中ではなく、演出の外に重ねている
  });

  it('演出の最中にオフにすると、すぐオフになり、そのあとの音は鳴らない。演出は閉じない', async () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    passStart(); // 申し込んだ直後の音（join）は鳴る。FEVER 目前の音（stage）は 0.65 秒あと
    await tick(300);
    const before = oscillators;
    expect(before).toBeGreaterThan(0);
    fireEvent.click(pressable()[0] as HTMLElement); // 演出の前（称賛を待っている間）でも、押せる
    await tick(700); // 称賛の演出が出る
    expect(layer('fx')).not.toBeNull();
    expect(pressable()[0]?.getAttribute('aria-pressed')).toBe('false');
    await tick(10_000);
    expect(oscillators).toBe(before); // オフにしたあとは、鳴らない（FEVER 目前の音も）
  });

  it('層が閉じると、層の上のボタンは消えて、帯の 1 つだけに戻る。オフのまま', async () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    passStart();
    await tick(700);
    fireEvent.click(pressable()[0] as HTMLElement);
    await closeGiftAfterFx();
    expect(layer('fx')).toBeNull();
    expect(layer('gift')).toBeNull();
    expect(toggles()).toHaveLength(1);
    expect(pressable()[0]?.getAttribute('aria-pressed')).toBe('false');
    // もう一度押すと、オンに戻る
    fireEvent.click(pressable()[0] as HTMLElement);
    expect(pressable()[0]?.getAttribute('aria-pressed')).toBe('true');
    click(/^仲間を呼ぶ/);
    expect(oscillators).toBeGreaterThan(0);
  });
});
