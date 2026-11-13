// @vitest-environment node
// 反映後の確認（check-deployed。設計 D-27・I-107・I-134）の判定
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';
import { checkBundle, checkCoreVersion, checkPage } from '../../scripts/deploy-check-lib.mjs';

const good = {
  'content-encoding': 'gzip',
  'content-security-policy': "default-src 'self'",
  'x-robots-tag': 'noindex',
  'cache-control': 'no-cache',
};

describe('反映後の確認', () => {
  it('正しい応答は通る', () => {
    expect(checkPage({ path: '/fan/', status: 200, headers: good })).toEqual([]);
    expect(
      checkBundle({
        path: '/bundle/a.js',
        status: 200,
        headers: { 'cache-control': 'public, max-age=31536000, immutable' },
      }),
    ).toEqual([]);
    expect(checkCoreVersion({ health: { coreVersion: '0.1.0' }, lockVersion: '0.1.0' })).toEqual(
      [],
    );
  });

  it.each([
    ['状態が 200 でない', { status: 404, headers: good }],
    ['圧縮が付かない', { status: 200, headers: { ...good, 'content-encoding': '' } }],
    ['CSP が無い', { status: 200, headers: { ...good, 'content-security-policy': '' } }],
    ['noindex が無い', { status: 200, headers: { ...good, 'x-robots-tag': '' } }],
    [
      'HTML が no-cache でない',
      { status: 200, headers: { ...good, 'cache-control': 'public, max-age=3600' } },
    ],
  ])('%s と、不一致として出す', (_name, response) => {
    expect(checkPage({ path: '/', ...response }).length).toBeGreaterThan(0);
  });

  it('/bundle/* に immutable が無い・API の版が違う（または取れない）と、不一致として出す', () => {
    expect(
      checkBundle({ path: '/bundle/a.js', status: 200, headers: { 'cache-control': 'no-cache' } })
        .length,
    ).toBe(1);
    expect(
      checkCoreVersion({ health: { coreVersion: '0.2.0' }, lockVersion: '0.1.0' }).length,
    ).toBe(1);
    expect(checkCoreVersion({ health: null, lockVersion: '0.1.0' }).length).toBe(1);
  });

  it('deploy.yml は、手で起動したときだけ動く（main への push では動かない）。Secrets・Variables は名前だけ参照する', () => {
    const yml = readFileSync(`${ROOT}.github/workflows/deploy.yml`, 'utf8');
    const on = /^on:\n([\s\S]*?)\n\S/m.exec(yml)?.[1] ?? '';
    expect(on.trim()).toBe('workflow_dispatch:');
    expect(yml).not.toMatch(/\bpush:|pull_request/);
    expect(yml).toContain('secrets.AZURE_STATIC_WEB_APPS_API_TOKEN');
    expect(yml).toContain('vars.VITE_API_BASE');
    expect(yml).not.toMatch(/https:\/\/[a-z0-9-]+\.azurestaticapps\.net/);
  });
});
