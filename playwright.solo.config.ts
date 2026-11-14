import { defineConfig } from '@playwright/test';

// 「ひとり体験」（既定）の実ブラウザの台本（npm run e2e:solo）。手元の Google Chrome で、幅 390px の画面を操作する。
// 配備と同じ形でビルドする: API の接続先は渡すが、共有メーター（VITE_SHARED_METER）は渡さない（scripts/run-e2e-solo.mjs）。
// ポートは、ページ 5297・偽の API 8798（ほかの試験・ほかの人の作業と重ならない値。使用中なら、起動に失敗して止まる）
// 画面写真の置き場は、環境変数 SOLO_SHOTS（既定は test-results/solo）
const PAGE_PORT = 5297;
const API_PORT = 8798;

export default defineConfig({
  testDir: 'e2e-solo',
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PAGE_PORT}`,
    channel: 'chrome',
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    // 要素が見つからないとき、いつまでも待たずに失敗させる
    actionTimeout: 10_000,
  },
  webServer: [
    {
      command: 'node e2e/server.mjs',
      url: `http://127.0.0.1:${PAGE_PORT}/index.html`,
      env: { E2E_PORT: String(PAGE_PORT), E2E_DIST: 'dist-solo' },
      reuseExistingServer: false,
    },
    {
      // 偽の API。ひとり体験は、ここへ 1 回も要求を送らないことを、台本が確かめる
      command: 'node e2e/fake-api.mjs',
      url: `http://127.0.0.1:${API_PORT}/healthz`,
      env: { E2E_API_PORT: String(API_PORT) },
      reuseExistingServer: false,
    },
  ],
});
