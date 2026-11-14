// npm run api:local — 手元で API（backend）を立てる。検収を、管理者に頼らず手元で閉じて行うための台本。
//
//   npm run api:local [-- --api-port 8795 --web-port 5295]
//
// core.lock.json が指すコミットの backend を、一時フォルダ（OS の一時置き場）に取得して、ビルドし、起動する
// （画面が取り込んでいる core と同じ版の API になる。取得とビルドは、同じコミットなら使い回す）。
// 画面の接続元（CORS）は http://127.0.0.1:<web-port> だけ。合言葉は設定しない（reset は使えない）。データは一時フォルダに置き、止めると消える。
// 止めるのは Ctrl + C。この台本が起動したプロセスだけを止める。npm run accept -- --local-api も、これを使う。
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEFAULT_API_PORT, DEFAULT_WEB_PORT } from './accept-lib.mjs';
import {
  isMain,
  isPortFree,
  runCommand,
  runNpm,
  startBackground,
  waitForHttp,
} from './accept-run.mjs';
import { BACKEND_REPOSITORY, readLock } from './core-lib.mjs';

const lastLines = (text, count = 4) => text.trim().split('\n').slice(-count).join(' / ');

/** lock のコミットの backend を dir に取得してビルドする（ビルド済みなら何もしない） */
async function prepareBackend(dir, lock, log) {
  if (existsSync(join(dir, 'dist', 'server', 'server.mjs'))) return;
  // 途中で止まった残りがあれば、作り直す（dir は、この台本が決めた一時フォルダの中だけ）
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  log('backend を取得します（core.lock.json のコミット）...');
  const steps = [
    ['init', '-q'],
    ['fetch', '-q', '--depth', '1', lock.repository ?? BACKEND_REPOSITORY, lock.commit],
    ['checkout', '-q', 'FETCH_HEAD'],
  ];
  for (const args of steps) {
    const result = await runCommand('git', args, { cwd: dir });
    if (result.code !== 0) {
      throw new Error(`git ${args[0]} に失敗しました: ${lastLines(result.output)}`);
    }
  }
  log('backend の依存を入れます（npm ci。初回は 1 分ほどかかります）...');
  const install = await runNpm(['ci', '--no-audit', '--no-fund'], { cwd: dir });
  if (install.code !== 0) throw new Error(`npm ci に失敗しました: ${lastLines(install.output)}`);
  log('backend をビルドします...');
  const build = await runNpm(['run', 'build'], { cwd: dir });
  if (build.code !== 0)
    throw new Error(`backend のビルドに失敗しました: ${lastLines(build.output)}`);
}

/**
 * 手元の API を起動する。{ origin, webOrigin, stop } を返す。stop() は、起動した API だけを止めて、データを消す。
 * 失敗したときは、日本語の理由つきの例外を投げる
 */
export async function startLocalApi({
  port = DEFAULT_API_PORT,
  webPort = DEFAULT_WEB_PORT,
  log = console.log,
} = {}) {
  const lock = readLock();
  if (!(await isPortFree(port))) {
    throw new Error(`ポート ${port} は、すでに使われています（--api-port で別の番号を）`);
  }
  const dir = join(tmpdir(), 'oshiyobu-accept-backend', lock.commit.slice(0, 12));
  await prepareBackend(dir, lock, log);
  const dataDir = mkdtempSync(join(tmpdir(), 'oshiyobu-accept-data-'));
  const webOrigin = `http://127.0.0.1:${webPort}`;
  const server = startBackground(process.execPath, [join(dir, 'dist', 'server', 'server.mjs')], {
    cwd: dir,
    env: {
      ...process.env,
      PORT: String(port),
      CORS_ORIGINS: webOrigin,
      DATA_DIR: dataDir,
      NODE_ENV: 'production',
      // 合言葉は設定しない（空は「未設定」として扱われ、reset は無効になる）
      PRESENTER_PASSPHRASE: '',
    },
  });
  const stop = async () => {
    await server.stop();
    rmSync(dataDir, { recursive: true, force: true });
  };
  const origin = `http://127.0.0.1:${port}`;
  if (!(await waitForHttp(`${origin}/healthz`, { isAlive: server.isAlive, timeoutMs: 20_000 }))) {
    const output = server.output();
    await stop();
    throw new Error(`手元の API が起動しませんでした: ${lastLines(output)}`);
  }
  return { origin, webOrigin, stop };
}

if (isMain(import.meta.url)) {
  let values;
  try {
    ({ values } = parseArgs({
      options: { 'api-port': { type: 'string' }, 'web-port': { type: 'string' } },
      allowPositionals: false,
    }));
  } catch (error) {
    console.error(`引数が正しくありません: ${error.message}`);
    process.exit(1);
  }
  let api;
  try {
    api = await startLocalApi({
      port: Number(values['api-port'] ?? DEFAULT_API_PORT),
      webPort: Number(values['web-port'] ?? DEFAULT_WEB_PORT),
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log(`手元の API を起動しました: ${api.origin}`);
  console.log(`画面の接続元として許しているのは ${api.webOrigin} だけです。止めるときは Ctrl + C`);
  const shutdown = async () => {
    await api.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await new Promise(() => {});
}
