import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';
import { normalizeApiBase } from './src/shared/meter/apiBase.ts';

// 3 ページ（事務所向け・ファン向け・発表者用）の HTML。複数ページのビルドの入り口（設計 D-01）
const page = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// ファン向けの HTML に、API への接続を先に張る指示（preconnect）を入れる（設計 D-16 の K-03・K-17）。
// 最初の取得・申し込みが、新しい接続の約 3 往復を待たないため。接続先が未設定なら入れない。
// 共有メーターを使うとき（VITE_SHARED_METER=on）だけ入れる。既定のひとり体験は、ファン向けが API を呼ばないので入れない。
// 接続先は、ビルド時の環境変数 VITE_API_BASE（秘密ではない。.env は読まず、環境の値だけを使う）
function preconnectApi(): Plugin {
  const origin = normalizeApiBase(process.env.VITE_API_BASE);
  const shared = process.env.VITE_SHARED_METER === 'on';
  return {
    name: 'oshiyobu-preconnect-api',
    transformIndexHtml(_html, context) {
      if (origin === '' || !shared || !context.path.startsWith('/fan/')) {
        return [];
      }
      return [
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: origin, crossorigin: '' },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// 配信の設定（public/staticwebapp.config.json）の CSP の connect-src に、API の接続先を足す（設計 D-16）。
// 接続先は、ビルド時の環境変数 VITE_API_BASE。未設定なら、'self' だけのまま（サーバーなしで動く）。
function swaConnectSrc(): Plugin {
  const origin = normalizeApiBase(process.env.VITE_API_BASE);
  let outDir = '';
  return {
    name: 'oshiyobu-swa-connect-src',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (origin === '') return;
      const file = join(outDir, 'staticwebapp.config.json');
      const config = JSON.parse(readFileSync(file, 'utf8')) as {
        globalHeaders: Record<string, string>;
      };
      const key = 'content-security-policy';
      config.globalHeaders[key] = (config.globalHeaders[key] ?? '').replace(
        "connect-src 'self'",
        `connect-src 'self' ${origin}`,
      );
      writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  plugins: [react(), preconnectApi(), swaConnectSrc()],
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
    // CSS の中身も読み込む。false だと、CSS が空の文字列になり、文言ガード（forbidden-words）が CSS を検査できない
    css: true,
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
