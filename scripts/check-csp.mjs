// 配るファイルの CSP を検査する（設計 D-16。外部への通信が無いこと〈N-07〉を、構造で守る）。
//   npm run build の後に、npm run check:csp
// 接続先は、ビルドと同じ環境変数 VITE_API_BASE から決める（未設定なら、サーバーなし）。
// 共有メーターを使うかは、ビルドと同じ環境変数 VITE_SHARED_METER（on のときだけ。既定はひとり体験で、ファン向けに preconnect を入れない）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './core-lib.mjs';
import { checkCsp } from './csp-lib.mjs';
import { normalizeApiBase } from '../src/shared/meter/apiBase.ts';

const dist = join(ROOT, process.env.DIST_DIR ?? 'dist');
const errors = checkCsp({
  config: JSON.parse(readFileSync(join(dist, 'staticwebapp.config.json'), 'utf8')),
  fanHtml: readFileSync(join(dist, 'fan', 'index.html'), 'utf8'),
  apiOrigin: normalizeApiBase(process.env.VITE_API_BASE),
  sharedMeter: process.env.VITE_SHARED_METER === 'on',
});
if (errors.length > 0) {
  for (const error of errors) console.error(`エラー: ${error}`);
  console.error('check-csp に失敗しました');
  process.exit(1);
}
console.log('check-csp OK');
