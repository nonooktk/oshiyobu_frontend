// 外部への通信が無いこと・CSP が効いていること（N-07。I-106。設計 D-16）
import { expect, test } from '@playwright/test';
import { API } from './helpers';

const PAGES = ['/', '/fan/?p=4', '/presenter/', '/simulator.html'];
const ALLOWED = new Set(['http://127.0.0.1:4390', API]);

for (const path of PAGES) {
  test(`${path}: CSP の違反・コンソールのエラー・外部への通信が 0 件`, async ({ page }) => {
    const violations: string[] = [];
    const errors: string[] = [];
    const origins = new Set<string>();
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __csp: string[] }).__csp.push(
          `${event.violatedDirective} ${event.blockedURI}`,
        );
      });
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    // 404 などの応答は、どの URL かまで残す（I-84: 404 が 0 件）
    page.on(
      'response',
      (response) =>
        response.status() >= 400 && errors.push(`${response.status()} ${response.url()}`),
    );
    page.on('request', (request) => origins.add(new URL(request.url()).origin));
    const response = await page.goto(path, { waitUntil: 'networkidle' });
    expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
    expect(response?.headers()['x-robots-tag']).toBe('noindex');
    // 触れる範囲を触る（事務所向け: 市・会場・提案・情報の扱い）
    if (path === '/') {
      await page.getByRole('button', { name: /^久留米市を選ぶ/ }).click();
      await page.getByRole('button', { name: /Cボックス/ }).click();
      await page.getByRole('button', { name: '提案を見る' }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: '情報の扱い' }).click();
    }
    violations.push(
      ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
    );
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    expect([...origins].filter((origin) => !ALLOWED.has(origin))).toEqual([]);
  });
}

test('CSP が有効な証拠: 外部の script を差し込むと、止められ、違反が記録される（通信は出ない）', async ({
  page,
}) => {
  const external: string[] = [];
  const blocked: string[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).hostname === 'example.com') external.push(response.url());
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).hostname === 'example.com') blocked.push(request.url());
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __csp: string[] }).__csp.push(event.violatedDirective);
    });
  });
  await page.goto('/');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'https://example.com/x.js';
    document.head.appendChild(script);
  });
  await page.waitForTimeout(500);
  const violated = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(violated.length).toBeGreaterThan(0);
  expect(external).toEqual([]); // 応答が返っていない（外へ出ていない）
  expect(blocked.length).toBeGreaterThan(0); // 要求は、ブラウザが止めた
});
