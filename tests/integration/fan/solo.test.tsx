// ひとり体験（既定。VITE_SHARED_METER なし）の、画面での動き。
// 申し込む（75 人・80%）→ 仲間を呼ぶ（93 人・成立）→ 閉じたら初めに戻る → 5 分で戻る → 人物に入るたびに初めの状態。
// 共有メーターあり（VITE_SHARED_METER=on の形。通信する接続先つきのエンジン）では、閉じても 5 分たっても戻さない。
// 共有の部品は本物で、サーバーだけ偽物（FakeApi）。ひとり体験は、サーバーを 1 回も呼ばない
import { beforeEach, describe, expect, it } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import { getAppStore, resetAppStoreForTest } from '../../../src/fan/store/FanProvider';
import { STORAGE_KEYS } from '../../../src/shared/device';
import {
  act,
  api,
  cleanup,
  click,
  closeGiftAfterFx,
  fireEvent,
  mountFan,
  passStart,
  screen,
  setupFanTest,
  tick,
} from './helpers';

setupFanTest();

const IDLE_MS = 300_000;
const IDLE_TEXT = 'しばらく操作がなかったので、最初に戻しました';
const shell = () => document.querySelector('div[data-page]')?.getAttribute('data-page');
const supporters = () => getAppStore().view().status.supporters;
/** 閉じる・再読み込み・別のページへ（ブラウザが pagehide を出す） */
const closePage = () => act(() => void window.dispatchEvent(new Event('pagehide')));
/** 開き直し（ページごと作り直す。ストアも、画面も、新しくなる） */
const reopen = (search: string) => {
  cleanup();
  resetAppStoreForTest();
  mountFan(search);
};

const solo = () => setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
const shared = () =>
  setMeterEngineForTest(
    createMeterEngine({ apiBase: 'https://api.example.test', random: () => 0.5 }),
  );

describe('ひとり体験（既定）', () => {
  beforeEach(solo);

  it('閉じる（pagehide）と、初めの状態に戻る。次に開くと、はじめの画面で、74 人から', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    expect(shell()).toBe('home');
    closePage();
    expect(shell()).toBe('start');
    reopen('?p=4');
    expect(shell()).toBe('start');
    expect(getAppStore().getState().course).toBeNull();
    expect(supporters()).toBe(74);
  });

  it('bfcache から戻ったとき（pageshow の persisted）も、初めの状態から始まる', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    act(() => void window.dispatchEvent(new Event('pagehide')));
    act(() => void window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })));
    expect(shell()).toBe('start');
    expect(supporters()).toBe(74);
  });

  it('5 分（300 秒）操作が無いと、初めの状態に戻り、理由が出る。最後の操作から 299 秒では戻らない', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    fireEvent.pointerDown(document.body); // 最後の操作
    await tick(IDLE_MS - 1000);
    expect(shell()).toBe('home');
    await tick(1000);
    expect(shell()).toBe('start');
    expect(supporters()).toBe(74);
    expect(screen.getAllByText(IDLE_TEXT).length).toBeGreaterThan(0);
  });

  it('操作（押す）があれば、時計は数え直しになる', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    await tick(IDLE_MS - 20_000);
    fireEvent.pointerDown(document.body);
    await tick(IDLE_MS - 1000);
    expect(shell()).toBe('home');
    await tick(1000);
    expect(shell()).toBe('start');
  });

  it('はじめの画面のまま 5 分たっても、理由は出さない（戻すものが無い）', async () => {
    mountFan('?p=4');
    await tick(IDLE_MS + 1000);
    expect(shell()).toBe('start');
    expect(screen.queryByText(IDLE_TEXT)).toBeNull();
  });

  it('「リセット（デモ用）」は、これまでどおり、初めの状態に戻す', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click(/^リセット（デモ用）/);
    expect(shell()).toBe('start');
    expect(supporters()).toBe(74);
  });
});

describe('人物（アカウント）に入るたびに、その人物の初めの状態から始まる', () => {
  beforeEach(solo);

  it('同じ人物に入り直しても、前の申し込みは無い。ブラウザに残るのは、端末の番号だけ', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    reopen('?p=4');
    expect(getAppStore().getState()).toMatchObject({ course: null, called: 0 });
    expect(Object.keys(localStorage)).toEqual([...STORAGE_KEYS]);
    expect(Object.keys(sessionStorage)).toEqual([]);
  });
});

describe('共有メーターあり（VITE_SHARED_METER=on の形）は、これまでどおり', () => {
  beforeEach(shared);

  it('閉じても、bfcache から戻っても、5 分たっても、戻さない', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    closePage();
    act(() => void window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })));
    await tick(IDLE_MS * 2);
    expect(shell()).toBe('home');
    expect(getAppStore().getState().course).toBe('normal');
  });

  it('申し込みは、サーバーへ送る（ひとり体験のときだけ、送らない）', async () => {
    mountFan('?p=4');
    passStart();
    await tick(10);
    expect(api.posts()).toHaveLength(1);
  });
});
