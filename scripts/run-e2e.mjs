// 実ブラウザの試験を回す（npm run e2e）。偽の API の接続先を埋めてビルドし（dist-e2e/）、Playwright を回す。
//   手元の Google Chrome を使う: E2E_CHANNEL=chrome npm run e2e   （ブラウザのダウンロードが要らない）
//   一部だけ回す: npm run e2e -- e2e/csp.spec.ts
import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
// 共有メーターの試験なので、共有メーターありでビルドする（既定は、ファン向けが API を呼ばない「ひとり体験」）
const env = { ...process.env, VITE_API_BASE: 'http://127.0.0.1:4391', VITE_SHARED_METER: 'on' };
const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(npm, ['run', 'build', '--', '--outDir', 'dist-e2e', '--emptyOutDir']);
run(npx, ['playwright', 'test', ...process.argv.slice(2)]);
