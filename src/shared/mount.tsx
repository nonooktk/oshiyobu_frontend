import { Component, Fragment, StrictMode, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/base.css';

/** 同じ例外が続いても、描き直しは、この間隔に 1 回まで（CPU を使い続けない。設計 D-40） */
export const REMOUNT_INTERVAL_MS = 1000;

interface State {
  /** 例外を受けて、描き直しを待っている間は true（何も出さない） */
  readonly failed: boolean;
  /** 描き直すたびに増やす。key に使い、中身を作り直す（Zustand などの外の状態は残る） */
  readonly attempt: number;
}

/**
 * ルートの受け皿（設計 D-40）。描画で例外が出ても、白い画面にしない（エラーの文言は出さず、コンソールには出す）。
 * 状態（申し込み・人数）は、React の外のストア（Zustand）にあるので残ったまま、1 秒後に中身を作り直す。
 * 同じ例外が続いても、描き直しは 1 秒に 1 回まで。
 */
export class ErrorBoundary extends Component<{ readonly children: ReactNode }, State> {
  state: State = { failed: false, attempt: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    console.error(error);
    this.timer ??= setTimeout(() => {
      this.timer = null;
      this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
    }, REMOUNT_INTERVAL_MS);
  }

  componentWillUnmount(): void {
    if (this.timer !== null) clearTimeout(this.timer);
  }

  render(): ReactNode {
    return this.state.failed ? null : (
      <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
    );
  }
}

/**
 * 3 ページの入り口の共通処理。#root に、そのページの App を描く。
 * 3 ページに共通で要ること（ルートの受け皿など）は、各ページの main.tsx でなく、ここに足す。
 */
export function mountPage(App: ComponentType): void {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error(
      '#root が見つかりません。HTML の入り口に <div id="root"></div> があるか確認してください',
    );
  }
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
