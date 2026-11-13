// あとから読む画面（メニュー配下・やめる確認・引き継ぎ。設計 D-40 の fan-pages・fan-layers）の読み込みと受け皿。
// 【仮】共有の部品の `loadChunk`・`ChunkBoundary`（F-0b）が dev に入るまでの、同じ決まりの仮の実装:
// 読み込みに失敗したら、2・4・8・16 秒後、以後は 30 秒おきに、成功まで自動で再試行する。
// その間、枠と操作は残し、エラーの文言も白い画面も出さない。描画で例外が出たときも、枠を残して中身を空にし、再試行する。
import { Component, useEffect, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';

const RETRY_SECONDS = [2, 4, 8, 16] as const;

export function useChunk<T>(load: () => Promise<T>): T | null {
  const [mod, setMod] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let n = 0;
    const attempt = (): void => {
      load()
        .then((m) => {
          if (!cancelled) setMod(m);
        })
        .catch(() => {
          const wait = RETRY_SECONDS[n] ?? 30;
          n += 1;
          if (!cancelled) timer = setTimeout(attempt, wait * 1000);
        });
    };
    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load]);
  return mod;
}

type BoundaryProps = { children: ReactNode; retryKey: string };
type BoundaryState = { failed: number };

/** 描画の例外を受ける。中身を空にして、1 秒後に描き直す（CPU を使い続けない）。 */
export class ChunkBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: 0 };
  private timer: ReturnType<typeof setTimeout> | undefined;
  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: 1 };
  }
  componentDidCatch(error: unknown): void {
    console.error('[fan] 画面の描画で例外が出ました。中身を空にして、1 秒後に描き直します', error);
    this.timer = setTimeout(() => this.setState({ failed: 0 }), 1000);
  }
  componentWillUnmount(): void {
    if (this.timer) clearTimeout(this.timer);
  }
  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** 遅れて読む「中身」を、読めたら出す。読めるまでは空（枠は呼び出し側が出している）。 */
export function LazyBody<P extends object>({
  load,
  props,
  name,
  fallback = null,
}: {
  load: () => Promise<{ default: ComponentType<P> }>;
  props: P;
  name: string;
  /** 読めるまで出すもの（操作を残すため）。 */
  fallback?: ReactNode;
}) {
  const mod = useChunk(load);
  if (!mod) return <>{fallback}</>;
  const Body = mod.default;
  return (
    <ChunkBoundary retryKey={name}>
      <Body {...props} />
    </ChunkBoundary>
  );
}
