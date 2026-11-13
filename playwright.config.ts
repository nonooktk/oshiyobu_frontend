import { defineConfig } from '@playwright/test';

// 実ブラウザの試験（設計 D-40・D-42）。npm run e2e が、接続先つきでビルドし、これを回す。
// 手元の Google Chrome を使うときは、環境変数 E2E_CHANNEL=chrome（ブラウザのダウンロードが要らない）。
// 使わないときは、先に npx playwright install chromium。
// 本物の backend が相手のときは、E2E_BACKEND_URL を渡す（e2e/backend.spec.ts）
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4390',
    channel: process.env.E2E_CHANNEL || undefined,
    headless: true,
    // 要素が見つからないとき、いつまでも待たずに失敗させる
    actionTimeout: 10_000,
  },
  webServer: [
    {
      command: 'node e2e/server.mjs',
      url: 'http://127.0.0.1:4390/index.html',
      reuseExistingServer: false,
    },
    {
      command: 'node e2e/fake-api.mjs',
      url: 'http://127.0.0.1:4391/healthz',
      reuseExistingServer: false,
    },
    {
      // 共有メーターの試験用の画面（配らない）。接続先は、偽の API
      command: 'npx vite --port 4392 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4392/e2e/harness/index.html',
      env: { VITE_API_BASE: process.env.E2E_BACKEND_URL ?? 'http://127.0.0.1:4391' },
      reuseExistingServer: false,
    },
  ],
});
