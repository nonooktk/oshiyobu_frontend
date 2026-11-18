// 演出・シートなどの層が出ている最中も、音のボタンは押せる（QA G2-13・H-06。統括の決定）。
// 層が出ているあいだ、下の画面（帯の音のボタンを含む）は押せなくなる（inert）。そこで、層の上に、同じ音のボタンをもう 1 つ出す。
// オフにしたら、そのあとに鳴るはずの音も鳴らない。層が閉じたら、層の上のボタンは消えて、帯の 1 つだけに戻る。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import { FakeAudioContext, audioLog } from '../../helpers/fakeAudio';
import { mountFan, screen, setupFanTest } from './helpers';

setupFanTest();

beforeEach(() => {
  audioLog.oscillators = 0;
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
});
