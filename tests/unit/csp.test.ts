// @vitest-environment node
// CSP の検査（check-csp。設計 D-16・I-106・I-125）と、配る設定ファイルの CSP
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';
import { checkCsp, parseCsp } from '../../scripts/csp-lib.mjs';

const config = JSON.parse(readFileSync(`${ROOT}public/staticwebapp.config.json`, 'utf8')) as {
  globalHeaders: Record<string, string>;
  routes: { route: string; headers: Record<string, string> }[];
};
const clone = () => structuredClone(config);
const ORIGIN = 'https://api.example.test';
const withOrigin = () => {
  const c = clone();
  c.globalHeaders['content-security-policy'] = c.globalHeaders['content-security-policy']!.replace(
    "connect-src 'self'",
    `connect-src 'self' ${ORIGIN}`,
  );
  return c;
};

describe('CSP', () => {
  it('設定ファイルの CSP が、設計 D-16 の指令をそろえている（接続先は未設定）', () => {
    expect(checkCsp({ config, fanHtml: '<html></html>', apiOrigin: '' })).toEqual([]);
    const csp = parseCsp(config.globalHeaders['content-security-policy']!);
    expect(csp['connect-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toBeUndefined(); // default-src 'self' に従う（埋め込みの script を許さない）
  });

  it('接続先があるとき、connect-src と preconnect の両方が、その origin と一致する', () => {
    const html = `<link rel="preconnect" href="${ORIGIN}" crossorigin="">`;
    expect(checkCsp({ config: withOrigin(), fanHtml: html, apiOrigin: ORIGIN })).toEqual([]);
    expect(checkCsp({ config, fanHtml: html, apiOrigin: ORIGIN }).length).toBeGreaterThan(0);
    expect(
      checkCsp({ config: withOrigin(), fanHtml: '', apiOrigin: ORIGIN }).length,
    ).toBeGreaterThan(0);
  });

  it('接続先が未設定のとき、外部の origin や preconnect があれば、エラー', () => {
    expect(checkCsp({ config: withOrigin(), fanHtml: '', apiOrigin: '' }).length).toBeGreaterThan(
      0,
    );
    expect(
      checkCsp({ config, fanHtml: `<link rel="preconnect" href="${ORIGIN}">`, apiOrigin: '' })
        .length,
    ).toBeGreaterThan(0);
  });

  it('ひとり体験（共有メーターなし）では、接続先があっても、ファン向けに preconnect を入れない。connect-src は発表者用のために残す', () => {
    const html = `<link rel="preconnect" href="${ORIGIN}" crossorigin="">`;
    const solo = { apiOrigin: ORIGIN, sharedMeter: false };
    expect(checkCsp({ config: withOrigin(), fanHtml: '<html></html>', ...solo })).toEqual([]);
    expect(checkCsp({ config: withOrigin(), fanHtml: html, ...solo }).length).toBeGreaterThan(0);
    // 共有メーターあり（VITE_SHARED_METER=on）は、これまでどおり preconnect が要る
    expect(
      checkCsp({ config: withOrigin(), fanHtml: html, apiOrigin: ORIGIN, sharedMeter: true }),
    ).toEqual([]);
  });

  it('埋め込みの script・style を許す指定（unsafe-inline）を、全体の CSP に入れたら、エラー', () => {
    const bad = clone();
    bad.globalHeaders['content-security-policy'] += "; script-src 'self' 'unsafe-inline'";
    expect(checkCsp({ config: bad, fanHtml: '', apiOrigin: '' }).length).toBeGreaterThan(0);
  });

  it('/simulator.html だけが、埋め込みの script・style を許す別の CSP を持つ。外部へは通信しない', () => {
    const sim = parseCsp(
      config.routes.find((r) => r.route === '/simulator.html')!.headers['content-security-policy']!,
    );
    expect(sim['script-src']).toContain("'unsafe-inline'");
    expect(sim['connect-src']).toEqual(["'self'"]);
    const bad = clone();
    delete bad.routes.find((r) => r.route === '/simulator.html')!.headers[
      'content-security-policy'
    ];
    expect(checkCsp({ config: bad, fanHtml: '', apiOrigin: '' }).length).toBeGreaterThan(0);
  });
});
