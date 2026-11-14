// ファン向けの画面のテストの共通部品。
// 共有の部品は本物（共有メーターの仕組み・先読み・連動）を使い、サーバーだけを偽物（FakeApi）にする。
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { App } from '../../../src/fan/App';
import { setupFanPrefetch } from '../../../src/fan/prefetch';
import { getAppStore, resetAppStoreForTest } from '../../../src/fan/store/FanProvider';
import { forgetDeviceIdForTest } from '../../../src/shared/device';
import { resetLinkForTest } from '../../../src/shared/link';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import { resetPrefetchForTest } from '../../../src/shared/prefetch';
import { FakeApi } from '../../helpers/fakeApi';

/** 絵がまだ届かない状態（jsdom の Image には decode が無い。読み込みを終わらせない）。 */
export class PendingImage {
  fetchPriority = 'auto';
  set src(_url: string) {}
  decode(): Promise<void> {
    return new Promise(() => undefined);
  }
}
/** 絵が届く状態。 */
export class ReadyImage extends PendingImage {
  override decode(): Promise<void> {
    return Promise.resolve();
  }
}

/** 各テストの偽のサーバー（beforeEach で作り直す）。 */
export let api: FakeApi;

/** 各テストの前後の掃除（タイマー・端末の番号・共有メーター・先読み・ストア・描いた画面）。 */
export function setupFanTest(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    api = new FakeApi();
    vi.stubGlobal('fetch', api.fetch);
    vi.stubGlobal('Image', PendingImage);
    localStorage.clear();
    forgetDeviceIdForTest();
    resetLinkForTest();
    setMeterEngineForTest(
      createMeterEngine({ apiBase: 'https://api.example.test', random: () => 0.5 }),
    );
    resetPrefetchForTest();
    setupFanPrefetch();
    resetAppStoreForTest();
  });
  afterEach(() => {
    cleanup();
    resetAppStoreForTest();
    setMeterEngineForTest(null);
    resetLinkForTest();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

/** `/fan/?p=N` で開く（受入テストとリハーサルの開き方。設計 D-19）。 */
export function mountFan(search = '?p=4') {
  window.history.replaceState({}, '', `/fan/${search}`);
  return render(<App />);
}

export async function tick(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

export const btn = (name: string | RegExp) => screen.getByRole('button', { name });
export const click = (name: string | RegExp): void => {
  fireEvent.click(btn(name));
};

/** はじめの画面を進めて、ホームへ（目指すコースは通常の席。まだ申し込めない: 口座なし・預金 0円）。 */
export function passStartOnly(): void {
  click('次へ');
  click('このコースを目指して始める');
}

/**
 * ホームから、申し込むところまで（主のボタンの流れ）。推し活定期をはじめる → 預金を積み増す（条件にちょうど届く額）→ 申し込む。
 * 預金の入力のシートは、別のテスト（heat-flow）で、画面の操作として確かめる。ここでは、ストアの操作で足す。
 */
export function fundAndApply(): void {
  click(/^推し活定期をはじめる/);
  act(() => {
    const store = getAppStore();
    const t = store.view().target;
    if (t?.mainAccount) store.actions.runAcct('main', 'home');
    const gap = t ? Math.max(0, t.deposit - store.getState().acct.deposit) : 0;
    if (gap > 0) store.actions.runAcct('deposit', 'home', gap);
    store.actions.clearAch();
  });
  click(/^申し込む/);
}

/** はじめの画面を進めて、申し込むところまで（人物ごとの違いは無い）。 */
export function passStart(): void {
  passStartOnly();
  fundAndApply();
}

/** 特典の絵（層）を閉じる。 */
export async function closeGiftAfterFx(): Promise<void> {
  await tick(700 + 2600);
  click('閉じる');
}

export const layer = (name: string): HTMLElement | null =>
  document.querySelector(`[data-layer="${name}"]`);

/**
 * 「次のアクション」の画面を開く。ホームの主のボタンは、行動そのもの（申し込む・仲間を呼ぶ など）になり、この画面へは移らない。
 * この画面（いまできること の一覧）は、貢献・支援の状況・しくみの画面の「次のアクション」から開く。ここでは、ストアの操作で開く。
 */
export function openNextPage(): void {
  act(() => {
    getAppStore().actions.go('next');
  });
}

export const homeActionButtons = (): string[] =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
    // 帯の「メニュー」「リセット」と、文字を持たない音のボタン（称賛の音）は、行動のボタンに数えない
    .filter((t) => t !== '' && !/^メニュー$|^リセット/.test(t));

export { act, cleanup, fireEvent, screen, within };
