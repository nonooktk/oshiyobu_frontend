// 画面の枠の部品: 札の帯・詳細の画面の帯（戻る）・トースト・読み上げの領域・層の共通の動き。
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DemoBadge } from '../../shared/components/DemoBadge';
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';

/** 全画面に出す札「デモ用の架空データ」の帯（SP-80）。 */
export function Strip() {
  return (
    <div className={styles.strip}>
      <DemoBadge />
    </div>
  );
}

/** 詳細の画面の帯。戻るは、来た所（ホームかメニュー）へ。ホームから来たときだけ、右に「メニュー」を出す（決定 24）。 */
export function DetailHead({ title }: { title: string }) {
  const { state, actions } = useFan();
  const fromMenu = state.origin === 'more';
  return (
    <div className={styles.dHead}>
      <button type="button" className={styles.back} onClick={() => actions.go(state.origin)}>
        {fromMenu ? '‹ メニュー' : '‹ ホーム'}
      </button>
      <h2>{title}</h2>
      {fromMenu ? null : (
        <button type="button" className={styles.toMenu} onClick={() => actions.go('more')}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          メニュー
        </button>
      )}
    </div>
  );
}

/** 詳細の画面 1 枚（札の帯・戻る帯・中身）。 */
export function DetailPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <Strip />
      <DetailHead title={title} />
      <div className={styles.dBody}>{children}</div>
    </div>
  );
}

export function Toast() {
  const { state } = useFan();
  if (!state.toast) return null;
  return (
    <div
      className={state.page === 'home' ? `${styles.toast} ${styles.toastTop}` : styles.toast}
      key={state.toast.id}
      aria-hidden="true"
    >
      {state.toast.text}
    </div>
  );
}

/** 画面には出さず、読み上げだけで伝える領域（演出は装飾なので、ここで別に伝える）。 */
export function LiveRegion() {
  const { state } = useFan();
  return (
    <p className={styles.srOnly} role="status" aria-live="polite">
      {state.live}
    </p>
  );
}

/**
 * 層（シート・特典・演出）の動き: 開く前にいた要素を覚えて、閉じたらそこへフォーカスを戻す。
 * 戻せないときは、いまの画面の先頭の操作へ。
 */
export function useReturnFocus(): void {
  const [from] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  useEffect(
    () => () => {
      const el = from instanceof HTMLElement ? from : null;
      if (el && el.isConnected && !el.closest('[inert]')) el.focus({ preventScroll: true });
    },
    [from],
  );
}
