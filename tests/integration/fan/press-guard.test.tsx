// 主のボタン（と副のボタン）の連打・ダブルタップ・Enter の押しっぱなし（QA の指摘 G2-12。ひとり体験）。
// 上層: 1 回の操作で進むのは 1 段だけ。押した瞬間に、同じ場所のボタンが次の段の名前に変わっても、
//       続けて押した 2 回目は、次の段を押したことにならない（人数・預金が二重に変わらない・称賛の音が重ならない）。
//       押したあと、行動の称賛・演出が終わるまで（演出が出ない段は 0.6 秒ほど）は、次の押下を受けない。終われば、また押せる。
// 実ブラウザでの連打（Enter の押しっぱなしを含む）は、実ブラウザの確認で別に見る（jsdom は、Enter から click を起こさない）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conditionOf } from '../../../src/core';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import { CUES } from '../../../src/fan/sound';
import { getAppStore, setSettleMsForTest } from '../../../src/fan/store/FanProvider';
import { SETTLE_MS } from '../../../src/fan/store/store';
import {
  act,
  click,
  closeGiftAfterFx,
  fireEvent,
  layer,
  mountFan,
  openNextPage,
  passStartOnly,
  screen,
  setupFanTest,
  tick,
} from './helpers';

setupFanTest();

/** 鳴らした音の数（記録するだけの AudioContext の偽物）。 */
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
  setSettleMsForTest(SETTLE_MS); // この検査は、押したあとに受けない間を、本番と同じ長さで確かめる
  oscillators = 0;
  vi.stubGlobal('AudioContext', FakeAudioContext);
  setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
});

const store = () => getAppStore();
const cond = conditionOf('cbox'); // 基準の公演（久留米市・Cボックス）の内部の人数。画面には出ない
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
const actOf = (): string | null => primary().getAttribute('data-act');
/** 同じボタンを、間を置かずに n 回押す（ダブルタップ・連打）。 */
const hammer = (target: HTMLElement, n: number): void => {
  for (let i = 0; i < n; i += 1) fireEvent.click(target);
};
/** 「次のアクション」の画面の、いまできること の先頭の行。 */
const firstRow = (): HTMLElement => {
  const row = screen.getByText('いまできること').parentElement?.querySelector('button');
  if (!row) throw new Error('先頭の行がありません');
  return row;
};
const secondary = (): HTMLButtonElement =>
  screen.getByRole('button', { name: /^SNSに投稿する/ }) as HTMLButtonElement;

/** 音を出せる状態にして、ホームまで進める（推し活定期はまだ）。 */
function toHome(search = '?p=4'): void {
  mountFan(search);
  fireEvent.pointerDown(document.body);
  passStartOnly();
}
/** 推し活定期をはじめて、預金を条件に届く額まで積み増した状態（主のボタンは「申し込む」）。通常の席。 */
async function toApply(): Promise<void> {
  toHome();
  click(/^推し活定期をはじめる/);
  await tick(700);
  act(() => {
    store().actions.runAcct('deposit', 'home', 20_000);
    store().actions.clearAch();
  });
  await tick(700);
}
/** 申し込んで、称賛と特典の絵を閉じた状態（主のボタンは「仲間を呼ぶ」）。 */
async function toFriend(): Promise<void> {
  await toApply();
  click(/^申し込む/);
  await closeGiftAfterFx();
  await tick(700);
}
/** 仲間を呼んで、成立（FEVER）の称賛と特典の絵まで閉じた状態（主のボタンは「仲間に知らせる」）。 */
async function toNotice(): Promise<void> {
  await toFriend();
  click(/^仲間を呼ぶ/);
  await tick(2600 + 3600 + 2200 + 20);
  click('閉じる'); // 特典の絵
  await tick(700);
}

describe.each([2, 5])('主のボタンを間を置かずに %i 回押す', (n) => {
  it('「推し活定期をはじめる」: 1 段だけ進む。額の入力のシートは開かず、預金は動かない', () => {
    toHome();
    expect(actOf()).toBe('teiki');
    hammer(primary(), n);
    expect(actOf()).toBe('deposit'); // 1 段進んだ（2 段目の「預金を積み増す」は押されていない）
    expect(depositSheets()).toBe(0);
    expect(store().getState().acct).toEqual({ pay: false, deposit: 0, times: 0 });
  });

  it('「メイン口座にする」（前方の席）: 1 段だけ進む', async () => {
    mountFan('?p=4');
    fireEvent.pointerDown(document.body);
    click('次へ');
    click(/前方の席/);
    click('このコースを目指して始める');
    click(/^推し活定期をはじめる/);
    await tick(700);
    expect(actOf()).toBe('main');
    hammer(primary(), n);
    expect(actOf()).toBe('deposit'); // メイン口座にして、預金の段へ（額のシートは開かない）
    expect(depositSheets()).toBe(0);
    expect(store().getState().acct.pay).toBe(true);
    expect(store().getState().acct.deposit).toBe(0);
  });

  it('「預金を積み増す」: 額のシートは 1 枚だけ', async () => {
    toHome();
    click(/^推し活定期をはじめる/);
    await tick(700);
    expect(actOf()).toBe('deposit');
    hammer(primary(), n);
    expect(depositSheets()).toBe(1);
  });

  it('「申し込む」: 申し込みだけ進む。仲間を呼ぶ・FEVER へは進まず、称賛の音は申し込みの分だけ', async () => {
    await toApply();
    expect(actOf()).toBe('apply');
    const before = oscillators;
    hammer(primary(), n);
    await tick(10_000);
    const s = store().getState();
    expect(s.course).toBe('normal');
    expect(s.done.friend).toBeUndefined(); // 仲間は呼ばれていない
    expect(s.called).toBe(0);
    expect(s.friends).toBe(0);
    expect(store().view().status.established).toBe(false); // FEVER（開催決定）へは進んでいない
    expect(store().view().status.supporters).toBe(cond.start + 1);
    // 申し込みの音（join）と、FEVER 目前の音（stage）だけ。仲間（friend）・FEVER の音は鳴らない
    expect(oscillators - before).toBe(CUES.join.length + CUES.stage.length);
  });

  it('「仲間を呼ぶ」: 1 回だけ進む（音・人数が二重にならない）', async () => {
    await toFriend();
    expect(actOf()).toBe('friend');
    const before = oscillators;
    hammer(primary(), n);
    await tick(10_000);
    expect(store().view().status.established).toBe(true);
    expect(store().view().status.supporters).toBe(cond.min); // 成立に届く人数だけ。二重に足されない
    expect(store().getState().called).toBe(cond.min - (cond.start + 1));
    expect(oscillators - before).toBe(CUES.friend.length + CUES.fever.length);
  });

  it('「仲間に知らせる」: 称賛は 1 回だけ', async () => {
    await toNotice();
    expect(actOf()).toBe('notice');
    const before = oscillators;
    hammer(primary(), n);
    await tick(10_000);
    expect(oscillators - before).toBe(CUES.share.length);
  });

  it('副のボタン「SNSに投稿する（任意）」: 投稿のシートは 1 枚だけ', async () => {
    await toFriend();
    hammer(secondary(), n);
    expect(document.querySelectorAll('[data-layer="share"]')).toHaveLength(1);
  });

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

describe('押せない間と、押せるようになるとき', () => {
  it('押したあと 0.6 秒ほどは受けず、それを過ぎると次の段を押せる（固まったままにならない）', async () => {
    toHome();
    fireEvent.click(primary()); // 推し活定期
    expect(primary().getAttribute('aria-busy')).toBe('true'); // 押せない間は、そのことが分かる
    fireEvent.click(primary()); // 受けない
    expect(depositSheets()).toBe(0);
    await tick(700);
    expect(primary().getAttribute('aria-busy')).not.toBe('true');
    fireEvent.click(primary()); // 預金を積み増す
    expect(depositSheets()).toBe(1);
  });

  it('申し込みは、称賛・演出が終わるまで、次の押下を受けない（演出を閉じると、また押せる）', async () => {
    await toApply();
    fireEvent.click(primary()); // 申し込む
    await tick(5000); // 称賛が出て、特典の絵に進んでいる（層が出ている間は、ホームは押せない）
    expect(store().getState().layers.length).toBeGreaterThan(0);
    store().actions.press(store().actions.homePrimary); // 押せない（層が出ている）
    expect(store().getState().done.friend).toBeUndefined();
    expect(store().getState().called).toBe(0);
    click('閉じる'); // 特典の絵
    await tick(700);
    expect(actOf()).toBe('friend');
    fireEvent.click(primary()); // 受ける
    expect(layer('fx')?.textContent).toContain('届いた！');
  });

  it('申し込みの称賛が出る前（押した直後の隙間）に押しても、先へ進まない', async () => {
    await toApply();
    fireEvent.click(primary()); // 申し込む（称賛は 0.15〜0.65 秒後に出る）
    await tick(300);
    expect(actOf()).toBe('friend'); // ボタンの名前は、もう次の段
    fireEvent.click(primary());
    await tick(300);
    fireEvent.click(primary());
    await tick(10_000);
    expect(store().getState().called).toBe(0);
    expect(store().view().status.established).toBe(false);
  });
});

describe('Enter の押しっぱなし（キーのリピート）', () => {
  it('リピートの keydown は、click を起こさないよう止める。最初の 1 回は止めない', () => {
    toHome();
    expect(fireEvent.keyDown(primary(), { key: 'Enter', repeat: false })).toBe(true);
    expect(fireEvent.keyDown(primary(), { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(primary(), { key: ' ', repeat: true })).toBe(false);
  });

  it('副のボタンと、次のアクションの行も、同じ', async () => {
    await toFriend();
    expect(fireEvent.keyDown(secondary(), { key: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(secondary(), { key: 'Enter', repeat: false })).toBe(true);
    openNextPage();
    const row = screen.getAllByRole('button', { name: /^仲間を呼ぶ/ })[0] as HTMLButtonElement;
    expect(fireEvent.keyDown(row, { key: 'Enter', repeat: true })).toBe(false);
  });
});
