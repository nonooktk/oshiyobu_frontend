// 絵と遅れて読む塊の管理（設計 D-40・I-114〜I-121 のうち、部品としての動き）
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHUNK_RETRY_MS,
  ChunkBoundary,
  configurePrefetch,
  imageState,
  loadChunk,
  needImage,
  resetPrefetchForTest,
  startPrefetch,
} from '../../src/shared/prefetch';

let meterBusy = false;
vi.mock('../../src/shared/meter', () => ({ isMeterBusy: () => meterBusy }));

/** 画像の代わり。decode の完了・失敗を、テストが決める */
class FakeImage {
  static all: FakeImage[] = [];
  src = '';
  fetchPriority = '';
  private done: { ok: () => void; ng: () => void } | null = null;
  constructor() {
    FakeImage.all.push(this);
  }
  decode(): Promise<void> {
    return new Promise((ok, ng) => {
      this.done = { ok, ng: () => ng(new Error('読めません')) };
    });
  }
  finish(): void {
    this.done?.ok();
  }
  fail(): void {
    this.done?.ng();
  }
}

const flush = () => act(async () => {});
const IMAGES = { a: '/a.webp', b: '/b.webp', c: '/c.webp' };

describe('絵の先読み', () => {
  beforeEach(() => {
    FakeImage.all = [];
    meterBusy = false;
    vi.stubGlobal('Image', FakeImage);
    vi.useFakeTimers();
    resetPrefetchForTest();
    configurePrefetch({ images: IMAGES, plan: { tech0: ['a', 'b'], krs48: ['c'] }, chunks: {} });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('頼む前は missing。頼むと loading、読み終えると ready（高い優先度で頼む）', async () => {
    expect(imageState('a')).toBe('missing');
    needImage('a', 'high');
    expect(imageState('a')).toBe('loading');
    expect(FakeImage.all[0]).toMatchObject({ src: '/a.webp', fetchPriority: 'high' });
    FakeImage.all[0]?.finish();
    await flush();
    expect(imageState('a')).toBe('ready');
  });

  it('読み済みの絵は、もう一度頼まない', async () => {
    needImage('a');
    FakeImage.all[0]?.finish();
    await flush();
    needImage('a');
    expect(FakeImage.all).toHaveLength(1);
  });

  it('読めなかった絵は missing に戻る。例外もエラーの文言も出さない', async () => {
    needImage('a');
    FakeImage.all[0]?.fail();
    await flush();
    expect(imageState('a')).toBe('missing');
  });

  it('登録していない絵を頼んでも、何も起きない', () => {
    expect(() => needImage('nothing')).not.toThrow();
    expect(imageState('nothing')).toBe('missing');
    expect(FakeImage.all).toHaveLength(0);
  });

  it('先読みは、その人の推しの絵を、1 つずつ、低い優先度で読む', async () => {
    startPrefetch('tech0');
    await vi.advanceTimersByTimeAsync(10);
    expect(FakeImage.all).toHaveLength(1);
    expect(FakeImage.all[0]).toMatchObject({ src: '/a.webp', fetchPriority: 'low' });
    FakeImage.all[0]?.finish();
    await vi.advanceTimersByTimeAsync(10);
    expect(FakeImage.all).toHaveLength(2);
    expect(FakeImage.all[1]?.src).toBe('/b.webp');
  });

  it('推しを選び直したら、新しい推しの絵を読み、前の推しの残りは読まない', async () => {
    startPrefetch('tech0');
    await vi.advanceTimersByTimeAsync(10);
    startPrefetch('krs48');
    await vi.advanceTimersByTimeAsync(10);
    FakeImage.all[0]?.finish();
    await vi.advanceTimersByTimeAsync(10);
    expect(FakeImage.all.map((image) => image.src)).toEqual(['/a.webp', '/c.webp']);
  });

  it('API の通信が飛んでいる間は、先読みを始めない。空いたら始める', async () => {
    meterBusy = true;
    startPrefetch('tech0');
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeImage.all).toHaveLength(0);
    meterBusy = false;
    await vi.advanceTimersByTimeAsync(200);
    expect(FakeImage.all).toHaveLength(1);
  });
});

describe('遅れて読む塊', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetPrefetchForTest();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('失敗したら、2・4・8・16 秒後、以後 30 秒おきに再試行する（止めない）', async () => {
    const loader = vi.fn(() => Promise.reject(new Error('404')));
    configurePrefetch({ images: {}, plan: {}, chunks: { 'fan-pages': loader } });
    void loadChunk('fan-pages');
    await vi.advanceTimersByTimeAsync(0);
    expect(loader).toHaveBeenCalledTimes(1);
    let elapsed = 0;
    let calls = 1;
    for (const interval of [...CHUNK_RETRY_MS, 30000]) {
      await vi.advanceTimersByTimeAsync(interval - 1);
      expect(loader).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1);
      calls += 1;
      elapsed += interval;
      expect(loader).toHaveBeenCalledTimes(calls);
    }
    expect(elapsed).toBe(2000 + 4000 + 8000 + 16000 + 30000 + 30000);
  });

  it('途中で成功したら、読めた塊を返し、再試行をやめる。同じ塊を 2 回頼んでも、読むのは 1 本', async () => {
    let attempts = 0;
    const loader = vi.fn(() =>
      ++attempts < 3 ? Promise.reject(new Error('失敗')) : Promise.resolve({ ok: true }),
    );
    configurePrefetch({ images: {}, plan: {}, chunks: { x: loader } });
    const first = loadChunk('x');
    expect(loadChunk('x')).toBe(first);
    await vi.advanceTimersByTimeAsync(2000 + 4000);
    await expect(first).resolves.toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(60000);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('枠を先に出し、塊が届いたら中身を埋める。エラーの文言は出さない', async () => {
    let arrive: (module: { label: string }) => void = () => {};
    configurePrefetch({
      images: {},
      plan: {},
      chunks: { pages: () => new Promise((resolve) => (arrive = resolve as typeof arrive)) },
    });
    render(
      <ChunkBoundary<{ label: string }> name="pages" frame={<p>枠</p>}>
        {(module) => <p>{module.label}</p>}
      </ChunkBoundary>,
    );
    expect(screen.getByText('枠')).toBeTruthy();
    await act(async () => {
      arrive({ label: '中身' });
    });
    expect(screen.getByText('中身')).toBeTruthy();
    expect(screen.queryByText('枠')).toBeNull();
  });

  it('中身の描画で例外が出ても、枠を残し、白い画面にしない。1 秒後に描き直す', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let broken = true;
    configurePrefetch({ images: {}, plan: {}, chunks: { pages: () => Promise.resolve({}) } });
    render(
      <ChunkBoundary name="pages" frame={<p>枠</p>}>
        {() => {
          if (broken) throw new Error('描画の失敗');
          return <p>中身</p>;
        }}
      </ChunkBoundary>,
    );
    await act(async () => {});
    expect(screen.getByText('枠')).toBeTruthy();
    expect(screen.queryByText('描画の失敗')).toBeNull();
    broken = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('中身')).toBeTruthy();
  });
});
