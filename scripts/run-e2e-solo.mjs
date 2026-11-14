// 「ひとり体験」の実ブラウザの台本を回す（npm run e2e:solo）。配備と同じ形でビルドし（dist-solo/）、Playwright を回す。
//   画面写真を、決めた場所に置く: SOLO_SHOTS=<フォルダ> npm run e2e:solo
// API の接続先は渡す（配備で渡されたままの状態）。共有メーター（VITE_SHARED_METER）は渡さない（既定のひとり体験で作る）
import { spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = { ...process.env, VITE_API_BASE: 'http://127.0.0.1:8798' };
delete env.VITE_SHARED_METER;
const run = (command, args) => {
  // Windows の npm.cmd・npx.cmd は、shell 経由でないと、新しい Node では起動できない（EINVAL）
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run(npm, ['run', 'build', '--', '--outDir', 'dist-solo', '--emptyOutDir']);
run(npx, ['playwright', 'test', '-c', 'playwright.solo.config.ts', ...process.argv.slice(2)]);
