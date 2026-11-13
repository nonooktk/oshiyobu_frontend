// 共有メーターの、実ブラウザでの動き（止まったとき・遅いとき・戻ったとき・2 台。I-46〜I-62・I-124・I-126・I-133 の一部）
// 試験用の画面（e2e/harness）が useSharedMeter を使い、偽の API（e2e/fake-api.mjs）に、本物の fetch・タイマーでつなぐ。
// 時間は偽物にしない（実時間）。そのため、1 本ごとに数秒〜30 秒かかる
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { apiState, control } from './helpers';

const HARNESS = 'http://127.0.0.1:4392/e2e/harness/index.html';
type Snapshot = {
  joined: number;
  status: string;
  mineCounted: boolean;
  resetEpoch: number;
  resets: number;
  busy: boolean;
};
const snapshot = async (page: Page): Promise<Snapshot> =>
  JSON.parse((await page.getByTestId('state').textContent()) ?? '{}');
const until = (page: Page, test: (s: Snapshot) => boolean, timeout = 15_000) =>
  expect.poll(async () => test(await snapshot(page)), { timeout, intervals: [100] }).toBe(true);

test.beforeEach(async () => {
  await control({
    resetState: true,
    latency: 0,
    down: false,
    status: 0,
    retryAfter: null,
    exposeRetryAfter: false,
  });
});

test('API が止まっていても、画面は動き、エラーを出さない。初期値のまま（I-46・I-48・I-51）', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await control({ down: true });
  await page.goto(HARNESS);
  await until(page, (s) => s.status === 'failing', 20_000);
  expect(await snapshot(page)).toMatchObject({ joined: 0, mineCounted: false });
  await page.getByRole('button', { name: '申し込む' }).click();
  expect(errors).toEqual([]);
});

test('遅延 800 ms でも、応答を使う。取得は重ならず、1.8 秒以上あく（I-53・I-54）', async ({
  page,
}) => {
  await control({ latency: 800, joined: 12 });
  await page.goto(HARNESS);
  await until(page, (s) => s.joined === 12 && s.status === 'ok', 15_000);
  await page.waitForTimeout(20_000);
  const gets = (await apiState()).log.filter((r) => r.method === 'GET').map((r) => r.at);
  expect(gets.length).toBeGreaterThan(5);
  gets.slice(1).forEach((at, i) => expect(at - (gets[i] ?? 0)).toBeGreaterThanOrEqual(1800));
  expect(gets.length).toBeLessThanOrEqual(17); // 20 秒に 34 回/分の線
});

test('応答が 2 秒より遅くても（5 秒）、8 秒までは待って使う（I-124）', async ({ page }) => {
  await control({ latency: 5000, joined: 7 });
  await page.goto(HARNESS);
  await until(page, (s) => s.joined === 7, 20_000);
  expect((await snapshot(page)).status).toBe('ok');
});

test('回線が戻ったら、サーバーの人数に追いつく（止まっている間は最後の値のまま。I-55・I-58）', async ({
  page,
}) => {
  await control({ joined: 3 });
  await page.goto(HARNESS);
  await until(page, (s) => s.joined === 3);
  await control({ down: true, joined: 9 });
  await page.waitForTimeout(12_000);
  expect(await snapshot(page)).toMatchObject({ joined: 3, status: 'failing' });
  await control({ down: false });
  await until(page, (s) => s.joined === 9 && s.status === 'ok', 15_000); // 失敗の間隔の上限は 10 秒
});

test('申し込みは裏で送られ、reset を検知すると、数えた印が消える（I-126・I-64 の画面側）', async ({
  page,
}) => {
  await page.goto(HARNESS);
  await page.getByRole('button', { name: '申し込む' }).click();
  await until(page, (s) => s.mineCounted && s.joined === 1);
  await control({ resetState: true });
  await fetch('http://127.0.0.1:4391/api/v1/reset', {
    method: 'POST',
    headers: { 'x-presenter-key': 'e2e-dummy-passphrase-123' },
  });
  await until(
    page,
    (s) => !s.mineCounted && s.resetEpoch === 1 && s.resets === 1 && s.joined === 0,
    8000,
  );
});

test('429 で Retry-After が読めないとき（本物の API はブラウザに公開しない）は、決まった間隔（2 → 4 → 8 秒）に戻る。画面は最後の値のまま（I-49）', async ({
  page,
}) => {
  await control({ joined: 4 });
  await page.goto(HARNESS);
  await until(page, (s) => s.joined === 4);
  const before = (await apiState()).log.filter((r) => r.method === 'GET').length;
  await control({ status: 429, retryAfter: 8, exposeRetryAfter: false });
  await page.waitForTimeout(22_000);
  const gets = (await apiState()).log
    .filter((r) => r.method === 'GET')
    .map((r) => r.at)
    .slice(before);
  const gaps = gets.slice(1, 4).map((at, i) => at - (gets[i] ?? 0));
  expect(gaps.length).toBe(3);
  [2000, 4000, 8000].forEach((ladder, i) =>
    expect(Math.abs((gaps[i] ?? 0) - ladder)).toBeLessThan(500),
  );
  expect((await snapshot(page)).joined).toBe(4);
});

test('429 の Retry-After を、サーバーが公開しているときは尊重する（読めるときだけ。I-49）', async ({
  page,
}) => {
  await control({ joined: 4 });
  await page.goto(HARNESS);
  await until(page, (s) => s.joined === 4);
  const before = (await apiState()).log.filter((r) => r.method === 'GET').length;
  await control({ status: 429, retryAfter: 12, exposeRetryAfter: true });
  await page.waitForTimeout(30_000);
  const gets = (await apiState()).log
    .filter((r) => r.method === 'GET')
    .map((r) => r.at)
    .slice(before);
  expect(gets.length).toBeGreaterThanOrEqual(2);
  gets.slice(1).forEach((at, i) => expect(at - (gets[i] ?? 0)).toBeGreaterThanOrEqual(11_500));
});

test('2 台: A が申し込むと、B のメーターに 3 秒未満で届く。別の公演には届かない（I-61・I-62）', async ({
  browser,
}) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  const other = await (await browser.newContext()).newPage();
  await b.goto(HARNESS);
  await other.goto(`${HARNESS}?pid=krs48:FUK-012`);
  await a.goto(HARNESS);
  await until(b, (s) => s.status === 'ok');
  for (let trial = 0; trial < 3; trial += 1) {
    await control({ resetState: true });
    await until(b, (s) => s.joined === 0 && s.status === 'ok', 10_000);
    await a.getByRole('button', { name: '申し込む' }).click();
    const started = Date.now();
    await until(a, (s) => s.mineCounted, 5000);
    await until(b, (s) => s.joined === 1, 4000);
    expect(Date.now() - started).toBeLessThan(3000 + 800);
  }
  expect((await snapshot(other)).joined).toBe(0);
});
