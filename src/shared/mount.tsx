import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/base.css';

/**
 * 3 ページの入り口の共通処理。#root に、そのページの App を描く。
 * 3 ページに共通で要ること（ルートの受け皿 ErrorBoundary など。設計 D-40）は、各ページの main.tsx でなく、ここに足す。
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
      <App />
    </StrictMode>,
  );
}
