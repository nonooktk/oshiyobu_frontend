// 配る成果物（dist-e2e/）を、手元で配るだけの小さなサーバー（実ブラウザの速さの測定用。設計 D-40）。
// 本番の配信と同じに近づける: ① 圧縮（gzip）② 配信の設定（staticwebapp.config.json）のヘッダー ③ HTML の再確認（ETag・304）
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(process.cwd(), process.env.E2E_DIST ?? 'dist-e2e');
const port = Number(process.env.E2E_PORT ?? 4390);
const config = JSON.parse(readFileSync(join(root, 'staticwebapp.config.json'), 'utf8'));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg']);

/** 配信の設定の route を、要求のパスに当てる（先頭の一致だけ。末尾 * の前方一致と、完全一致） */
function routeHeaders(path) {
  for (const route of config.routes ?? []) {
    const pattern = route.route;
    const hit = pattern.endsWith('*')
      ? path.startsWith(pattern.slice(0, -1))
      : path === pattern ||
        (pattern.endsWith('/index.html') && path === pattern.slice(0, -'index.html'.length));
    if (hit) return route.headers ?? {};
  }
  return {};
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/\\/g, '/');
  if (path.endsWith('/')) path += 'index.html';
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }
  const ext = extname(file);
  const body = readFileSync(file);
  const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
  const headers = {
    ...config.globalHeaders,
    ...routeHeaders(path),
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    etag,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers).end();
    return;
  }
  const wantsGzip =
    COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  const out = wantsGzip ? gzipSync(body) : body;
  if (wantsGzip) headers['content-encoding'] = 'gzip';
  headers['content-length'] = out.length;
  res.writeHead(200, headers).end(out);
}).listen(port, '127.0.0.1', () => console.log(`配信: http://127.0.0.1:${port}（${root}）`));
