import { Component, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { ArtistId } from '../core';
import { isMeterBusy } from './meter';

// 絵と、遅れて読む画面（JS の塊）の管理（設計 D-40・D-35）。
// ・最初の画面が操作できるようになったあと、手が空いている間に、その人の推しの絵と、メニュー配下の画面を先読みする
// ・特典が開くときは、needImage で高い優先度で頼む。読めていなければ、F-2 が代わりの絵を出す（空白の枠を出さない）
// ・遅れて読む塊は、失敗しても止めず、間隔を空けて自動で再試行する。エラーの文言も白い画面も出さない

export type ImageId = string;
export type ImagePriority = 'high' | 'low';
/** ready: 読み込んで復号まで済んだ／loading: 頼んで待っている／missing: 読めていない（まだ頼んでいない・失敗） */
export type ImageState = 'ready' | 'loading' | 'missing';

export interface PrefetchConfig {
  /** 絵の ID → URL（F-2 が、取り込んだ絵のファイルの URL を渡す） */
  readonly images: Readonly<Record<ImageId, string>>;
  /** 推しごとの先読みの順（必要になる順。D-40 の表）。最初の画面で読む絵は含めない */
  readonly plan: Readonly<Partial<Record<ArtistId, readonly ImageId[]>>>;
  /** 遅れて読む塊の名前 → 読み込みの関数（import() を返す）。先読みは、ここに書いた順 */
  readonly chunks: Readonly<Record<string, () => Promise<unknown>>>;
}

/** 失敗した塊の再試行の間隔（ミリ秒）。以後は最後の値（30 秒）の間隔 */
export const CHUNK_RETRY_MS = [2000, 4000, 8000, 16000, 30000] as const;
/** 先読みを始めるまでの、手が空くのを待つ上限（ミリ秒） */
export const IDLE_TIMEOUT_MS = 2000;

let config: PrefetchConfig = { images: {}, plan: {}, chunks: {} };
const imageStates = new Map<ImageId, ImageState>();
const heldImages = new Map<ImageId, HTMLImageElement>();
const chunkModules = new Map<string, unknown>();
const chunkLoading = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
let version = 0;
let generation = 0;

const notify = (): void => {
  version += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** 絵と塊の一覧を登録する。起動のとき 1 回 */
export function configurePrefetch(next: PrefetchConfig): void {
  config = next;
}

export function imageState(id: ImageId): ImageState {
  return imageStates.get(id) ?? 'missing';
}

/** 絵の状態を、読み込みの完了で描き直されるように読む（フック） */
export function useImageState(id: ImageId): ImageState {
  useSyncExternalStore(subscribe, () => version);
  return imageState(id);
}

function loadImage(id: ImageId, priority: ImagePriority): Promise<void> {
  const url = config.images[id];
  if (url === undefined) {
    return Promise.resolve();
  }
  const state = imageState(id);
  if (state === 'ready') {
    return Promise.resolve();
  }
  const image = new Image();
  image.fetchPriority = priority;
  imageStates.set(id, 'loading');
  notify();
  image.src = url;
  return image
    .decode()
    .then(() => {
      heldImages.set(id, image);
      imageStates.set(id, 'ready');
    })
    .catch(() => {
      // 読めなかった。エラーは出さず、代わりの絵に任せる（N-23）
      if (imageStates.get(id) === 'loading') {
        imageStates.set(id, 'missing');
      }
    })
    .finally(notify);
}

/** 特典が開くときに呼ぶ。高い優先度で絵を頼む。読み済みなら何もしない（読めなければ、代わりの絵を出す） */
export function needImage(id: ImageId, priority: ImagePriority = 'high'): void {
  if (imageState(id) === 'ready' || (imageState(id) === 'loading' && priority === 'low')) {
    return;
  }
  void loadImage(id, priority);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 遅れて読む塊を読む。失敗したら 2・4・8・16 秒後、以後 30 秒おきに自動で再試行する（成功まで止めない） */
export function loadChunk(name: string): Promise<unknown> {
  if (chunkModules.has(name)) {
    return Promise.resolve(chunkModules.get(name));
  }
  const running = chunkLoading.get(name);
  if (running) {
    return running;
  }
  const loader = config.chunks[name];
  if (loader === undefined) {
    return Promise.resolve(undefined);
  }
  const task = (async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        const module = await loader();
        chunkModules.set(name, module);
        notify();
        return module;
      } catch {
        const index = Math.min(attempt, CHUNK_RETRY_MS.length - 1);
        await wait(CHUNK_RETRY_MS[index] ?? 30000);
      }
    }
  })();
  chunkLoading.set(name, task);
  return task;
}

/** 読み込み済みの塊（まだなら undefined）。読み込みの完了で描き直す（フック） */
export function useChunk<T>(name: string): T | undefined {
  useSyncExternalStore(subscribe, () => version);
  return chunkModules.get(name) as T | undefined;
}

/** 通信が空くまで待つ（API の GET・POST が飛んでいる間は、先読みを始めない） */
async function untilIdle(): Promise<void> {
  while (isMeterBusy()) {
    await wait(100);
  }
}

function whenIdle(task: () => void): void {
  const idle = globalThis.requestIdleCallback;
  if (typeof idle === 'function') {
    idle(task, { timeout: IDLE_TIMEOUT_MS });
  } else {
    setTimeout(task, 0);
  }
}

/**
 * 先読みを始める（最初の画面が操作できてから 1 秒後に呼ぶ）。1 つずつ、低い優先度で、
 * その人の推しの絵 → 遅れて読む塊（登録した順）の順に読む。推しを選び直したら、新しい推しの分を最優先にして、やり直す
 */
export function startPrefetch(artistId: ArtistId): void {
  generation += 1;
  const mine = generation;
  whenIdle(() => {
    void (async () => {
      for (const id of config.plan[artistId] ?? []) {
        if (mine !== generation) return;
        await untilIdle();
        await loadImage(id, 'low');
      }
      for (const name of Object.keys(config.chunks)) {
        if (mine !== generation) return;
        await untilIdle();
        await loadChunk(name);
      }
    })();
  });
}

interface GuardProps {
  readonly frame: ReactNode;
  readonly children: ReactNode;
}

/** 描画で例外が出たら、枠だけを出して残す（エラーの文言も白い画面も出さない）。1 秒後に描き直す */
class RenderGuard extends Component<GuardProps, { failed: boolean }> {
  state = { failed: false };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(error);
    this.timer = setTimeout(() => this.setState({ failed: false }), 1000);
  }

  componentWillUnmount(): void {
    if (this.timer !== null) clearTimeout(this.timer);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.frame : this.props.children;
  }
}

interface ChunkBoundaryProps<T> {
  /** registerChunks に登録した塊の名前 */
  readonly name: string;
  /** 中身が来るまで（失敗が続くあいだも）出す枠。ヘッダー・戻るなどの操作を残す */
  readonly frame: ReactNode;
  /** 塊が読めたあとの中身 */
  readonly children: (module: T) => ReactNode;
}

function ChunkContent<T>({
  module,
  render,
}: {
  readonly module: T;
  readonly render: (module: T) => ReactNode;
}): ReactNode {
  return render(module);
}

/** 遅れて読む画面の枠。先読みが済んでいなければ、枠を先に出し、中身が来たら埋める */
export function ChunkBoundary<T>({ name, frame, children }: ChunkBoundaryProps<T>): ReactNode {
  const module = useChunk<T>(name);
  useEffect(() => {
    void loadChunk(name);
  }, [name]);
  if (module === undefined) {
    return frame;
  }
  // children(module) は、受け皿の内側で呼ぶ（中身の描画の例外を、受け皿が受けるため）
  return (
    <RenderGuard frame={frame}>
      <ChunkContent module={module} render={children} />
    </RenderGuard>
  );
}

/** テスト用: 状態を初期に戻す */
export function resetPrefetchForTest(): void {
  config = { images: {}, plan: {}, chunks: {} };
  imageStates.clear();
  heldImages.clear();
  chunkModules.clear();
  chunkLoading.clear();
  generation += 1;
  notify();
}
