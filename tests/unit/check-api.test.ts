// @vitest-environment node
// npm run check:api の本体（scripts/check-api.mjs の runCheckApi）。backend の動きをまねた小さな API（この試験の中だけ）に対して動かす。
// 確かめること: 合否の出方・書き込みは --write のときだけ・書き込む先は試験用の公演だけ（発表に使う公演には送らない）・URL を出力に出さない
import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { exitCodeOf } from '../../scripts/accept-lib.mjs';
import type { Item } from '../../scripts/accept-lib.mjs';
import { runCheckApi } from '../../scripts/check-api.mjs';

const WEB = 'http://127.0.0.1:5295';
const KNOWN = new Set(['terao:KGS-001', 'tech0:cbox']);

type Seen = { method: string; path: string };
type FakeOptions = {
  coreVersion?: string;
  /** 許す接続元。'*' は、どの接続元も許す。空なら、CORS の印を付けない */
  allow?: string[] | '*';
};

/** backend の API の動きを、必要なところだけまねた小さなサーバー */
function startFake(options: FakeOptions = {}) {
  const { coreVersion = '0.2.0', allow = [WEB] } = options;
  const seen: Seen[] = [];
  const joined = new Map<string, number>();
  const devices = new Map<string, Set<string>>();
  const body = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let text = '';
      req.on('data', (chunk) => (text += chunk));
      req.on('end', () => resolve(text));
    });
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    seen.push({ method: req.method ?? '', path: url.pathname });
    const origin = String(req.headers.origin ?? '');
    const cors: Record<string, string> = {};
    if (allow === '*') cors['access-control-allow-origin'] = '*';
    else if (origin !== '' && allow.includes(origin)) cors['access-control-allow-origin'] = origin;
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', ...cors });
      res.end(JSON.stringify(value));
    };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors,
        'access-control-allow-headers': 'content-type, x-presenter-key',
      });
      res.end();
      return;
    }
    if (url.pathname === '/healthz') return json(200, { ok: true, coreVersion });
    const match = /^\/api\/v1\/performances\/([^/]+)\/(meter|joins)$/.exec(url.pathname);
    const id = match?.[1] ?? '';
    if (!match || !KNOWN.has(id)) return json(404, { error: 'unknown_performance' });
    const view = () => ({ performanceId: id, joined: joined.get(id) ?? 0, resetAt: null });
    if (req.method === 'GET' && match[2] === 'meter') return json(200, view());
    if (req.method === 'POST' && match[2] === 'joins') {
      const { deviceId } = JSON.parse((await body(req)) || '{}') as { deviceId: string };
      const set = devices.get(id) ?? new Set<string>();
      devices.set(id, set);
      const counted = !set.has(deviceId);
      if (counted) {
        set.add(deviceId);
        joined.set(id, (joined.get(id) ?? 0) + 1);
      }
      return json(200, { ...view(), counted });
    }
    return json(404, { error: 'not_found' });
  });
  return new Promise<{ origin: string; seen: Seen[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({
        origin: `http://127.0.0.1:${port}`,
        seen,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

const statusOf = (items: Item[], id: string) => items.find((item) => item.id === id)?.status;
const closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (closers.length > 0) await closers.pop()?.();
});
async function withFake(options?: FakeOptions) {
  const fake = await startFake(options);
  closers.push(fake.close);
  return fake;
}

describe('check:api（API の確認）', () => {
  it('決まりどおりの API なら、すべて合格。終了コードは 0。書き込みは 1 件も送らない', async () => {
    const fake = await withFake();
    const items = await runCheckApi({ apiBase: fake.origin, webOrigin: WEB, lockVersion: '0.2.0' });
    expect(items.map((item) => [item.id, item.status])).toEqual([
      ['api.health', 'pass'],
      ['api.meter', 'pass'],
      ['api.notfound', 'pass'],
      ['api.cors.allow', 'pass'],
      ['api.cors.deny', 'pass'],
      ['api.cors.preflight', 'pass'],
      ['api.timing', 'pass'],
    ]);
    expect(exitCodeOf(items)).toBe(0);
    expect(fake.seen.filter((s) => s.method === 'POST')).toEqual([]);
  });

  it('--write のときだけ、試験用の公演に 2 回送り（1 回目 true・2 回目 false・人数 +1）、発表の公演には触れない', async () => {
    const fake = await withFake();
    const items = await runCheckApi({
      apiBase: fake.origin,
      webOrigin: WEB,
      write: true,
      lockVersion: '0.2.0',
    });
    expect(items.filter((i) => i.id.startsWith('api.write')).map((i) => i.status)).toEqual([
      'pass',
      'pass',
      'pass',
    ]);
    const posts = fake.seen.filter((s) => s.method === 'POST');
    expect(posts).toHaveLength(2);
    for (const post of posts) expect(post.path).toBe('/api/v1/performances/terao:KGS-001/joins');
    expect(fake.seen.some((s) => s.path.includes('tech0'))).toBe(false);
    expect(fake.seen.some((s) => s.path.endsWith('/reset') && s.method === 'POST')).toBe(false);
  });

  it('coreVersion が lock と違えば、api.health が不合格（終了コード 1）。詳細に両方の版が出る', async () => {
    const fake = await withFake({ coreVersion: '0.1.0' });
    const items = await runCheckApi({ apiBase: fake.origin, webOrigin: WEB, lockVersion: '0.2.0' });
    expect(statusOf(items, 'api.health')).toBe('fail');
    const detail = items.find((i) => i.id === 'api.health')?.detail ?? '';
    expect(detail).toContain('0.1.0');
    expect(detail).toContain('0.2.0');
    expect(exitCodeOf(items)).toBe(1);
  });

  it('画面の接続元を許していない API は、api.cors.allow と preflight が不合格', async () => {
    const fake = await withFake({ allow: ['https://another.example.test'] });
    const items = await runCheckApi({ apiBase: fake.origin, webOrigin: WEB, lockVersion: '0.2.0' });
    expect(statusOf(items, 'api.cors.allow')).toBe('fail');
    expect(statusOf(items, 'api.cors.deny')).toBe('pass');
    expect(statusOf(items, 'api.cors.preflight')).toBe('fail');
    expect(exitCodeOf(items)).toBe(1);
  });

  it('どの接続元も許す API（*）は、api.cors.deny が不合格', async () => {
    const fake = await withFake({ allow: '*' });
    const items = await runCheckApi({ apiBase: fake.origin, webOrigin: WEB, lockVersion: '0.2.0' });
    expect(statusOf(items, 'api.cors.allow')).toBe('pass');
    expect(statusOf(items, 'api.cors.deny')).toBe('fail');
  });

  it('画面の接続元が渡されなければ、CORS の 3 項目は「飛ばした」。判定は未完了（終了コード 2）', async () => {
    const fake = await withFake();
    const items = await runCheckApi({ apiBase: fake.origin, lockVersion: '0.2.0' });
    expect(
      ['api.cors.allow', 'api.cors.deny', 'api.cors.preflight'].map((id) => statusOf(items, id)),
    ).toEqual(['skip', 'skip', 'skip']);
    expect(exitCodeOf(items)).toBe(2);
  });

  it('API に接続できなければ、api.health が不合格で、残りは飛ばす。理由に URL を出さない', async () => {
    const origin = 'https://secret-api-host.example.test';
    const refused = () =>
      Promise.reject(
        Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }),
      );
    const items = await runCheckApi({
      apiBase: origin,
      webOrigin: WEB,
      lockVersion: '0.2.0',
      fetchImpl: refused as unknown as typeof fetch,
    });
    expect(statusOf(items, 'api.health')).toBe('fail');
    expect(items.filter((i) => i.status === 'skip').length).toBe(items.length - 1);
    expect(exitCodeOf(items)).toBe(1);
    const text = JSON.stringify(items);
    expect(text).toContain('ECONNREFUSED');
    expect(text).not.toContain('secret-api-host');
  });

  it('どの項目の詳細にも、API の接続先も、画面の接続元も出ない', async () => {
    const fake = await withFake();
    const items = await runCheckApi({
      apiBase: fake.origin,
      webOrigin: WEB,
      write: true,
      lockVersion: '0.2.0',
    });
    const text = items.map((i) => `${i.label} ${i.detail}`).join('\n');
    expect(text).not.toContain(fake.origin);
    expect(text).not.toContain(WEB);
  });

  it('API が止まった（時間切れ）ときは、秒数だけを出す', async () => {
    const never = (_url: unknown, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason));
      });
    const items = await runCheckApi({
      apiBase: 'http://127.0.0.1:9',
      webOrigin: WEB,
      lockVersion: '0.2.0',
      timeoutMs: 50,
      fetchImpl: never as unknown as typeof fetch,
    });
    expect(statusOf(items, 'api.health')).toBe('fail');
    expect(items[0]?.detail).toContain('応答がありません');
  });
});
