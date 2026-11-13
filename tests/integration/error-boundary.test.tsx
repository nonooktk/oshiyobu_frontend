// ルートの受け皿（設計 D-40・I-121）。描画で例外が出ても、白い画面にしない。状態は残る
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary, REMOUNT_INTERVAL_MS } from '../../src/shared/mount';

// React の外のストア（Zustand と同じ位置づけ）。描き直しても残る
const store = { count: 7, renders: 0, broken: true };

function stumble(): void {
  store.renders += 1;
  if (store.broken) {
    throw new Error('描画の失敗（テスト）');
  }
}

function Counter() {
  stumble();
  return <p>回数 {store.count}</p>;
}

const mount = () =>
  render(
    <ErrorBoundary>
      <Counter />
    </ErrorBoundary>,
  );

describe('ErrorBoundary（ルート）', () => {
  beforeEach(() => {
    Object.assign(store, { count: 7, renders: 0, broken: true });
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('例外のあいだ、エラーの文言も白い画面の文字も出さず、コンソールには出す', () => {
    const { container } = mount();
    expect(container.textContent).toBe('');
    expect(console.error).toHaveBeenCalled();
  });

  it('原因が直ったあと 1 秒で中身を作り直し、外の状態（申し込み・人数）は残っている', () => {
    mount();
    store.broken = false;
    act(() => {
      vi.advanceTimersByTime(REMOUNT_INTERVAL_MS);
    });
    expect(screen.getByText('回数 7')).toBeTruthy();
  });

  it('同じ例外が続いても、描き直しは 1 秒に 1 回まで', () => {
    mount();
    const first = store.renders;
    act(() => {
      vi.advanceTimersByTime(REMOUNT_INTERVAL_MS - 1);
    });
    expect(store.renders).toBe(first);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    const second = store.renders;
    expect(second).toBeGreaterThan(first);
    act(() => {
      vi.advanceTimersByTime(REMOUNT_INTERVAL_MS - 1);
    });
    expect(store.renders).toBe(second);
  });
});
