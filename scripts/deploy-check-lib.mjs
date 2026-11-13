// 反映後の確認の部品（設計 D-27）。check-deployed.mjs と、テストが使う
export const PAGES = ['/', '/fan/', '/presenter/', '/simulator.html'];

/** 1 ページの応答（状態・ヘッダー）を検査する。headers は小文字のキーの連想配列 */
export function checkPage({ path, status, headers }) {
  const errors = [];
  if (status !== 200) errors.push(`${path}: 状態が ${status} です（200 が要ります）`);
  if (!['gzip', 'br'].includes(headers['content-encoding'] ?? '')) {
    errors.push(`${path}: Content-Encoding（gzip か br）が付いていません`);
  }
  if (!(headers['content-security-policy'] ?? '').includes("default-src 'self'")) {
    errors.push(`${path}: CSP が付いていません`);
  }
  if (headers['x-robots-tag'] !== 'noindex')
    errors.push(`${path}: X-Robots-Tag: noindex が付いていません`);
  if (path !== '/simulator.html' && headers['cache-control'] !== 'no-cache') {
    errors.push(
      `${path}: HTML の Cache-Control が no-cache ではありません（${headers['cache-control'] ?? 'なし'}）`,
    );
  }
  return errors;
}

/** ハッシュつきファイル（/bundle/*）の応答を検査する */
export function checkBundle({ path, status, headers }) {
  const errors = [];
  if (status !== 200) errors.push(`${path}: 状態が ${status} です`);
  if (!(headers['cache-control'] ?? '').includes('immutable'))
    errors.push(`${path}: Cache-Control に immutable がありません`);
  return errors;
}

/** API の /healthz の coreVersion が、lock の版と一致するか */
export function checkCoreVersion({ health, lockVersion }) {
  return health?.coreVersion === lockVersion
    ? []
    : [
        `API の coreVersion（${health?.coreVersion ?? '取得できません'}）が、core.lock.json の版（${lockVersion}）と一致しません`,
      ];
}
