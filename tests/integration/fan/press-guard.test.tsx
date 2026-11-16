// 主のボタン（と副のボタン）の連打・ダブルタップ・Enter の押しっぱなし（QA の指摘 G2-12。ひとり体験）。
// 上層: 1 回の操作で進むのは 1 段だけ。押した瞬間に、同じ場所のボタンが次の段の名前に変わっても、
//       続けて押した 2 回目は、次の段を押したことにならない（人数・預金が二重に変わらない・称賛の音が重ならない）。
//       押したあと、行動の称賛・演出が終わるまで（演出が出ない段は 0.6 秒ほど）は、次の押下を受けない。終われば、また押せる。
// 実ブラウザでの連打（Enter の押しっぱなしを含む）は、実ブラウザの確認で別に見る（jsdom は、Enter から click を起こさない）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import { FakeAudioContext, audioLog } from '../../helpers/fakeAudio';
import { getAppStore, setSettleMsForTest } from '../../../src/fan/store/FanProvider';
import { SETTLE_MS } from '../../../src/fan/store/store';
import { fireEvent, mountFan, openNextPage, passStartOnly, screen, setupFanTest } from './helpers';

setupFanTest();

/** 鳴らした音の数（記録するだけの AudioContext の偽物）。 */
beforeEach(() => {
  setSettleMsForTest(SETTLE_MS); // この検査は、押したあとに受けない間を、本番と同じ長さで確かめる
  audioLog.oscillators = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
});

const store = () => getAppStore();
// 基準の公演（久留米市・Cボックス）の内部の人数。画面には出ない
/** 額の入力のシート（層）の枚数。 */
const depositSheets = (): number =>
  store()
    .getState()
    .layers.filter((l) => l.kind === 'deposit').length;
/** ホームの主のボタン（作り直されない 1 つの要素。ダブルタップは、同じ場所への連続した押下） */
const primary = (): HTMLButtonElement => {
  const b = document.querySelector<HTMLButtonElement>('button[data-act]');
  if (!b) throw new Error('ホームの主のボタンがありません');
  return b;
};
/** 「次のアクション」の画面の、いまできること の先頭の行。 */
const firstRow = (): HTMLElement => {
  const row = screen.getByText('いまできること').parentElement?.querySelector('button');
  if (!row) throw new Error('先頭の行がありません');
  return row;
};

/** 音を出せる状態にして、ホームまで進める（推し活定期はまだ）。 */
function toHome(search = '?p=4'): void {
  mountFan(search);
  fireEvent.pointerDown(document.body);
  passStartOnly();
}

describe.each([2, 5])('主のボタンを間を置かずに %i 回押す', (n) => {
  it('「次のアクション」の画面の行も、同じ。同じ場所の行を押すと、「推し活定期をはじめる」は 1 段だけ進む', () => {
    toHome();
    openNextPage();
    // 押した行は、次の行に入れ替わる。押す場所（一覧の先頭）は同じ
    for (let i = 0; i < n; i += 1) fireEvent.click(firstRow());
    expect(store().getState().done.teiki).toBe(true);
    expect(depositSheets()).toBe(0); // 2 回目に、次の行（預金を積み増す）が押されていない
    expect(store().getState().acct.times).toBe(0);
  });
});

describe('Enter の押しっぱなし（キーのリピート）', () => {
  const repeatIsStopped = (el: HTMLElement): boolean =>
    fireEvent.keyDown(el, { key: 'Enter', repeat: true }) === false;
  const firstIsKept = (el: HTMLElement): boolean =>
    fireEvent.keyDown(el, { key: 'Enter', repeat: false }) === true;

  it('リピートの keydown は、click を起こさないよう止める。最初の 1 回は止めない', () => {
    toHome();
    expect(firstIsKept(primary())).toBe(true);
    expect(repeatIsStopped(primary())).toBe(true);
    // Space は、キーを離したときに 1 回だけ click になる（keydown のリピートでは何も起きない）ので、対象にしない
    expect(fireEvent.keyDown(primary(), { key: ' ', repeat: true })).toBe(true);
  });
});
