// 配備のあとの自動の確認（設計 D-27。deploy.yml が回す）。
//   SWA_BASE_URL=<配備先の URL> VITE_API_BASE=<API の接続先> node scripts/check-deployed.mjs
// 配備先の URL は、ログに出さない（Actions の Secret。11/18 の承認まで、URL を公開の場所に書かない。D-22）。パスだけを出す
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './core-lib.mjs';
import { PAGES, checkBundle, checkCoreVersion, checkPage } from './deploy-check-lib.mjs';

const base = (process.env.SWA_BASE_URL ?? '').replace(/\/+$/, '');
const api = (process.env.VITE_API_BASE ?? '').replace(/\/+$/, '');
if (base === '') {
  console.error('SWA_BASE_URL が設定されていません');
  process.exit(1);
}
const lockVersion = JSON.parse(readFileSync(join(ROOT, 'core.lock.json'), 'utf8')).coreVersion;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const get = async (url) => {
  const response = await fetch(url, {
    headers: { 'accept-encoding': 'gzip, br' },
    redirect: 'manual',
  });
  return { response, headers: Object.fromEntries(response.headers) };
};

async function runOnce() {
  const errors = [];
  let fan = '';
  for (const path of PAGES) {
    const { response, headers } = await get(`${base}${path}`);
    errors.push(...checkPage({ path, status: response.status, headers }));
    if (path === '/fan/') fan = await response.text();
  }
  // ハッシュつきファイルを 1 本確かめる（ファン向けの HTML が読む JS）
  const bundle = /src="(\/bundle\/[^"]+\.js)"/.exec(fan)?.[1];
  if (bundle) {
    const { response, headers } = await get(`${base}${bundle}`);
    errors.push(...checkBundle({ path: bundle, status: response.status, headers }));
  } else {
    errors.push('/fan/: /bundle/ の JS の読み込みが見つかりません');
  }
  if (api !== '') {
    const health = await fetch(`${api}/healthz`)
      .then((r) => r.json())
      .catch(() => null);
    errors.push(...checkCoreVersion({ health, lockVersion }));
  }
  return errors;
}

// 配備の反映に少し時間がかかることがあるので、15 秒おきに最大 10 回確かめる
let errors = [];
for (let attempt = 1; attempt <= 10; attempt += 1) {
  try {
    errors = await runOnce();
  } catch (error) {
    errors = [`確認できませんでした（${error instanceof Error ? error.message : String(error)}）`];
  }
  if (errors.length === 0) break;
  console.log(`確認 ${attempt} 回目: ${errors.length} 件の不一致。15 秒後にやり直します`);
  await wait(15_000);
}
if (errors.length > 0) {
  for (const error of errors) console.error(`エラー: ${error}`);
  console.error('反映後の確認に失敗しました');
  process.exit(1);
}
console.log(
  `反映後の確認 OK（${PAGES.join('・')}・/bundle/*${api === '' ? '' : '・API の coreVersion'}）`,
);
