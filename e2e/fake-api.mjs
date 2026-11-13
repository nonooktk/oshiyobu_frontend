// 共有メーター API の代わり（実ブラウザの試験用の偽のサーバー。設計 D-13 の応答の形）。
// 試験が /__control で、遅れ・停止・状態を変える。公演は、60 件の一覧の形（<推し>:<会場>）だけ受ける
import { createServer } from 'node:http';

const port = Number(process.env.E2E_API_PORT ?? 4391);
// 試験用のダミーの合言葉（実物ではない）
const PASSPHRASE = 'e2e-dummy-passphrase-123';
const state = {
  joined: {},
  devices: {},
  resetAt: null,
  latency: 0,
  down: false,
  status: 0,
  retryAfter: null,
  exposeRetryAfter: false,
  log: [],
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-presenter-key',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-max-age': '600',
};
const json = (res, code, body, extra = {}) =>
  res
    .writeHead(code, {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...cors,
      ...extra,
    })
    .end(JSON.stringify(body));
const read = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';
  if (method === 'OPTIONS') return void res.writeHead(204, cors).end();
  if (url.pathname === '/__control') {
    const patch = JSON.parse((await read(req)) || '{}');
    if (patch.resetState) Object.assign(state, { joined: {}, devices: {}, resetAt: null, log: [] });
    for (const key of ['latency', 'down', 'status', 'retryAfter', 'exposeRetryAfter'])
      if (key in patch) state[key] = patch[key];
    if ('joined' in patch) state.joined[patch.joinedPid ?? 'tech0:cbox'] = patch.joined;
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/__state') return json(res, 200, { ...state });
  if (url.pathname === '/healthz') return json(res, 200, { ok: true, coreVersion: '0.1.0' });
  state.log.push({ method, path: url.pathname, at: Date.now() });
  if (state.down) return void req.socket.destroy();
  await new Promise((resolve) => setTimeout(resolve, state.latency));
  if (state.status) {
    // 本物の API は Retry-After を CORS で公開していない（ブラウザからは読めない）。試験が exposeRetryAfter で、公開する場合も試せる
    const extra = state.retryAfter ? { 'retry-after': String(state.retryAfter) } : {};
    if (state.retryAfter && state.exposeRetryAfter)
      extra['access-control-expose-headers'] = 'retry-after';
    return json(res, state.status, {}, extra);
  }
  const m = /^\/api\/v1\/performances\/([^/]+)\/(meter|joins)$/.exec(url.pathname);
  if (m && method === 'GET' && m[2] === 'meter')
    return json(res, 200, {
      performanceId: m[1],
      joined: state.joined[m[1]] ?? 0,
      resetAt: state.resetAt,
    });
  if (m && method === 'POST' && m[2] === 'joins') {
    const { deviceId } = JSON.parse((await read(req)) || '{}');
    const seen = (state.devices[m[1]] ??= {});
    const counted = !seen[deviceId];
    if (counted) {
      seen[deviceId] = true;
      state.joined[m[1]] = (state.joined[m[1]] ?? 0) + 1;
    }
    return json(res, 200, {
      performanceId: m[1],
      joined: state.joined[m[1]] ?? 0,
      counted,
      resetAt: state.resetAt,
    });
  }
  if (url.pathname === '/api/v1/reset' && method === 'POST') {
    const key = String(req.headers['x-presenter-key'] ?? '');
    if (key !== PASSPHRASE) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return json(res, 401, { error: 'unauthorized' });
    }
    Object.assign(state, { joined: {}, devices: {}, resetAt: new Date().toISOString() });
    return json(res, 200, { resetAt: state.resetAt });
  }
  json(res, 404, { error: 'not_found' });
}).listen(port, '127.0.0.1', () => console.log(`偽の API: http://127.0.0.1:${port}`));
