// 本物の backend（API）が相手のときの、共有メーターの動き（契約の確認。設計 D-13・SP-61〜SP-63）。
// 環境変数 E2E_BACKEND_URL（backend の origin）と E2E_PASSPHRASE（backend に渡した試験用の合言葉。どこにも書かない）があるときだけ回す。
//   例: PRESENTER_PASSPHRASE=… CORS_ORIGINS=http://127.0.0.1:4392 PORT=4395 node dist/server/server.mjs（backend のフォルダで）
//       E2E_BACKEND_URL=http://127.0.0.1:4395 E2E_PASSPHRASE=… E2E_CHANNEL=chrome npx playwright test e2e/backend.spec.ts
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const BACKEND = process.env.E2E_BACKEND_URL ?? '';
const PASSPHRASE = process.env.E2E_PASSPHRASE ?? '';
const HARNESS = 'http://127.0.0.1:4392/e2e/harness/index.html';
type Snapshot = {
  joined: number;
  status: string;
  mineCounted: boolean;
  resetEpoch: number;
  resets: number;
};
const snapshot = async (page: Page): Promise<Snapshot> =>
  JSON.parse((await page.getByTestId('state').textContent()) ?? '{}');
const until = (page: Page, check: (s: Snapshot) => boolean, timeout = 15_000) =>
  expect.poll(async () => check(await snapshot(page)), { timeout, intervals: [100] }).toBe(true);

test.skip(
  BACKEND === '' || PASSPHRASE === '',
  'E2E_BACKEND_URL と E2E_PASSPHRASE があるときだけ回す（本物の backend が相手）',
);

const reset = (key: string) =>
  fetch(`${BACKEND}/api/v1/reset`, { method: 'POST', headers: { 'x-presenter-key': key } });

test.beforeEach(async () => {
  expect((await reset(PASSPHRASE)).status).toBe(200);
});

test('生存確認と、取得・申し込み・reset の検知が、本物の API で動く（CORS・エラーなし）', async ({
  browser,
}) => {
  const health = await (await fetch(`${BACKEND}/healthz`)).json();
  expect(health).toMatchObject({ ok: true });
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const errors: string[] = [];
  for (const page of [a, b]) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  }
  await a.goto(HARNESS);
  await b.goto(HARNESS);
  await until(a, (s) => s.status === 'ok' && s.joined === 0);
  await a.getByRole('button', { name: '申し込む' }).click();
  await until(a, (s) => s.mineCounted && s.joined === 1);
  const started = Date.now();
  await until(b, (s) => s.joined === 1, 5000);
  expect(Date.now() - started).toBeLessThan(3500);
  // もう一度押しても、数は増えない（端末の番号で冪等）
  await a.getByRole('button', { name: '申し込む' }).click();
  await a.waitForTimeout(3000);
  expect((await snapshot(a)).joined).toBe(1);
  // 発表者の reset（正しい合言葉）。両方が 3 秒ほどで初期値に戻り、reset を検知する
  expect((await reset(PASSPHRASE)).status).toBe(200);
  await until(a, (s) => s.joined === 0 && !s.mineCounted && s.resetEpoch === 1, 8000);
  await until(b, (s) => s.joined === 0 && s.resetEpoch === 1, 8000);
  expect(errors.filter((e) => !e.includes('favicon'))).toEqual([]);
});

test('間違った合言葉の reset は、401 で拒否され、人数は変わらない。知らない公演は 404', async ({
  page,
}) => {
  await page.goto(HARNESS);
  await page.getByRole('button', { name: '申し込む' }).click();
  await until(page, (s) => s.mineCounted && s.joined === 1);
  const denied = await reset(`${PASSPHRASE}-x`);
  expect(denied.status).toBe(401);
  expect((await denied.json()) as { error: string }).toMatchObject({ error: 'unauthorized' });
  await page.waitForTimeout(2500);
  expect((await snapshot(page)).joined).toBe(1);
  const unknown = await fetch(`${BACKEND}/api/v1/performances/nobody:nowhere/meter`);
  expect(unknown.status).toBe(404);
});

test('不正な申し込み（本文の形・種類・大きさ）は拒否される。画面は落ちない', async () => {
  const url = `${BACKEND}/api/v1/performances/tech0:cbox/joins`;
  expect(
    (
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=UTF-8' },
        body: '{"deviceId":"short"}',
      })
    ).status,
  ).toBe(400);
  expect(
    (await fetch(url, { method: 'POST', headers: { 'content-type': 'text/xml' }, body: '<a/>' }))
      .status,
  ).toBe(415);
  expect(
    (
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'x'.repeat(2000),
      })
    ).status,
  ).toBe(413);
});
