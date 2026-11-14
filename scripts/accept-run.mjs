// 検収の台本が使う、プロセスと待ち受けの部品（Node の標準だけ。bash・Python に頼らない。Windows でも動く）。
import { spawn } from 'node:child_process';
import net from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** この台本が、直接動かされたか（import されたのではないか） */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  const same = (a, b) =>
    process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  return same(resolve(process.argv[1]), fileURLToPath(metaUrl));
}

/**
 * npm の呼び方。`npm run …` から動いているときは、npm_execpath（npm-cli.js）を node で動かす。
 * Windows の npm.cmd を直接動かすと、Node の新しい版では EINVAL で動かないため。
 * 直接 node で動かしたときは、npm（Windows では npm.cmd を shell 経由）にする
 */
export function npmCommand() {
  const execpath = process.env.npm_execpath ?? '';
  if (/\.[cm]?js$/.test(execpath)) {
    return { command: process.execPath, prefix: [execpath], shell: false };
  }
  const win = process.platform === 'win32';
  return { command: win ? 'npm.cmd' : 'npm', prefix: [], shell: win };
}

const tail = (text, maxBytes) => (text.length > maxBytes ? text.slice(-maxBytes) : text);

/**
 * コマンドを動かし、終わるまで待つ。出力（標準出力と標準エラー）は、末尾 maxBytes 文字を output に残す。
 * echo が真なら、出力を、そのまま画面にも流す。起動できないときは、code 127 と、その理由を返す
 */
export function runCommand(command, args, options = {}) {
  const { cwd, env, shell = false, echo = false, maxBytes = 200_000 } = options;
  return new Promise((resolvePromise) => {
    const started = Date.now();
    let output = '';
    const child = spawn(command, args, { cwd, env, shell, stdio: ['ignore', 'pipe', 'pipe'] });
    const onData = (chunk) => {
      if (echo) process.stdout.write(chunk);
      output = tail(output + chunk.toString('utf8'), maxBytes);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (error) => {
      resolvePromise({ code: 127, output: `${output}\n起動できません: ${error.message}`, ms: 0 });
    });
    child.on('close', (code) => {
      resolvePromise({ code: code ?? 1, output, ms: Date.now() - started });
    });
  });
}

/** npm を動かす（npm run lint のような args を渡す） */
export function runNpm(args, options = {}) {
  const { command, prefix, shell } = npmCommand();
  return runCommand(command, [...prefix, ...args], { shell, ...options });
}

/** 127.0.0.1 の port が空いているか（すでに何かが待ち受けていれば false） */
export function isPortFree(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    server.once('error', () => resolvePromise(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolvePromise(true)));
  });
}

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/** url が 200 を返すまで待つ。isAlive() が偽になったら（相手のプロセスが落ちたら）すぐやめる */
export async function waitForHttp(url, { timeoutMs = 20_000, isAlive = () => true } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && isAlive()) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.status === 200) return true;
    } catch {
      // まだ起動していない
    }
    await wait(250);
  }
  return false;
}

/**
 * 裏でずっと動かすプロセスを起動する。stop() は、この起動したプロセスだけを PID で止める。
 * 出力は、末尾だけ output() で読める（失敗したときの手がかり）
 */
export function startBackground(command, args, options = {}) {
  const { cwd, env, maxBytes = 20_000 } = options;
  let output = '';
  let exited = false;
  const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = (chunk) => {
    output = tail(output + chunk.toString('utf8'), maxBytes);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('error', (error) => {
    output += `\n起動できません: ${error.message}`;
    exited = true;
  });
  const closed = new Promise((resolvePromise) => {
    child.on('close', () => {
      exited = true;
      resolvePromise();
    });
  });
  return {
    pid: child.pid,
    isAlive: () => !exited,
    output: () => output,
    async stop() {
      if (exited) return;
      child.kill();
      await Promise.race([closed, wait(5000)]);
    },
  };
}

// 中断（Ctrl + C など）されたときに、自分が起動したものを片づけるための登録。
// 起動した API・配るサーバー・ブラウザは、中断されても残さない（終わったら、返り値の関数で登録を外す）
const interruptCleanups = new Set();
let interruptInstalled = false;

export function onInterrupt(cleanup) {
  interruptCleanups.add(cleanup);
  if (!interruptInstalled) {
    interruptInstalled = true;
    const handler = async () => {
      for (const fn of [...interruptCleanups]) {
        try {
          await fn();
        } catch {
          // 片づけに失敗しても、ほかの片づけを続ける
        }
      }
      process.exit(130);
    };
    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }
  return () => interruptCleanups.delete(cleanup);
}
