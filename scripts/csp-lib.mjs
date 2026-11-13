// CSP の検査の部品（設計 D-16・D-22）。check-csp.mjs と、テストが使う
/** CSP の文字列を、指令ごとの値の一覧にする */
export function parseCsp(csp) {
  const out = {};
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) out[name] = values;
  }
  return out;
}

const REQUIRED = {
  'default-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'style-src': ["'self'"],
  'style-src-attr': ["'unsafe-inline'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"],
};

/**
 * 設定ファイル（dist/staticwebapp.config.json の中身）と、ファン向けの HTML を検査する。
 * apiOrigin は、環境の VITE_API_BASE から決めた origin（未設定なら空）。
 */
export function checkCsp({ config, fanHtml, apiOrigin }) {
  const errors = [];
  const global = config.globalHeaders?.['content-security-policy'];
  if (typeof global !== 'string') {
    return ['globalHeaders に content-security-policy がありません'];
  }
  const csp = parseCsp(global);
  for (const [name, values] of Object.entries(REQUIRED)) {
    for (const value of values) {
      if (!csp[name]?.includes(value)) errors.push(`CSP の ${name} に ${value} がありません`);
    }
  }
  for (const name of ['default-src', 'script-src', 'style-src']) {
    if (csp[name]?.includes("'unsafe-inline'") || csp[name]?.includes("'unsafe-eval'")) {
      errors.push(
        `CSP の ${name} に unsafe-inline・unsafe-eval があります（style-src-attr だけが許す）`,
      );
    }
  }
  const connect = csp['connect-src'] ?? [];
  if (!connect.includes("'self'")) errors.push("CSP の connect-src に 'self' がありません");
  const origins = connect.filter((value) => value !== "'self'");
  if (apiOrigin === '' && origins.length > 0) {
    errors.push(`接続先が未設定なのに、connect-src に ${origins.join(' ')} があります`);
  }
  if (apiOrigin !== '' && !(origins.length === 1 && origins[0] === apiOrigin)) {
    errors.push(`connect-src の接続先が、環境の接続先（${apiOrigin}）と一致しません`);
  }
  // preconnect の接続先は、connect-src と一致する（I-125）
  const pre = /<link rel="preconnect" href="([^"]+)"/.exec(fanHtml)?.[1];
  if (apiOrigin === '' && pre)
    errors.push('接続先が未設定なのに、ファン向けに preconnect があります');
  if (apiOrigin !== '' && pre !== apiOrigin)
    errors.push('ファン向けの preconnect が、接続先と一致しません');
  // シミュレーターは、script と style が埋め込みのため、別の CSP を付ける
  const simulator = config.routes?.find((route) => route.route === '/simulator.html')?.headers?.[
    'content-security-policy'
  ];
  if (typeof simulator !== 'string') {
    errors.push('/simulator.html に専用の CSP がありません');
  } else {
    const sim = parseCsp(simulator);
    if (!sim['script-src']?.includes("'unsafe-inline'"))
      errors.push('/simulator.html の CSP に script-src の unsafe-inline がありません');
    if ((sim['connect-src'] ?? []).some((value) => value !== "'self'" && value !== "'none'")) {
      errors.push('/simulator.html の CSP の connect-src に、外部の接続先があります');
    }
  }
  return errors;
}
