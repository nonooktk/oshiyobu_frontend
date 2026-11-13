// ファン向けの画面のテストの共通部品。通信は無い（共有メーターは、仮の I/F のメモリの値）。
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { stubResetImages, stubResetMeters } from '../../../src/fan/adapter';
import { App } from '../../../src/fan/App';

/** 各テストの前後の掃除（タイマー・端末の番号・共有メーター・描いた画面）。 */
export function setupFanTest(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    stubResetMeters();
    stubResetImages();
  });
  afterEach(() => {
    cleanup();
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

/** はじめの画面の「次へ」を 3 回押して、ホームへ。 */
export function passStart(): void {
  click('次へ');
  click('次へ');
  click('この内容で申し込む');
}

/** 特典の絵（層）を閉じる。 */
export async function closeGiftAfterFx(): Promise<void> {
  await tick(700 + 2600);
  click('閉じる');
}

export const layer = (name: string): HTMLElement | null =>
  document.querySelector(`[data-layer="${name}"]`);

export const homeActionButtons = (): string[] =>
  screen
    .getAllByRole('button')
    .map((b) => b.textContent?.trim() ?? '')
    .filter((t) => !/^メニュー$|^リセット/.test(t));

export { act, cleanup, fireEvent, screen, within };
