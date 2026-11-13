import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 3 ページ（事務所向け・ファン向け・発表者用）の HTML。複数ページのビルドの入り口（設計 D-01）
const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // 複数ページなので、SPA 用の「どの URL でも / を返す」動きは使わない（存在しない URL は 404 にする）
  appType: 'mpa',
  build: {
    // ハッシュつきファイルを /bundle/ に置く。配信側のキャッシュ設定（public/staticwebapp.config.json）の対象（設計 D-40）
    assetsDir: 'bundle',
    // 絵はファイルのまま配る（JS・CSS に埋め込まない。N-20 の JS・CSS の量を、絵で増やさないため）
    assetsInlineLimit: 0,
    // 最初に読む JS・CSS の量の検査（F-3 の check-budget）が読む一覧
    manifest: true,
    rolldownOptions: {
      input: {
        office: page('index.html'),
        fan: page('fan/index.html'),
        presenter: page('presenter/index.html'),
      },
      output: {
        // JS の分け方（設計 D-40「JS の分け方」）。今は共有の vendor だけ。
        // fan-main・fan-flow・fan-text・fan-pages・fan-layers・core は、持ち主のレーンが画面を作るときに、ここへ足す。
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|zustand)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    // 画面を描くテスト（R）と、ファイルを検査するテスト（V）を同じ設定で動かす（テスト設計「使い方」）
    environment: 'jsdom',
    css: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
