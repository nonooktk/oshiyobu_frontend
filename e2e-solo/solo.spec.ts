// ひとり体験（既定）の、実ブラウザでの通し（手元の Google Chrome・幅 390px・ポート 5297）。
// 基準の公演（人物 4・Tech0サステナアイドル × 久留米市 × Cボックス）を、新しい流れ（docs/fan/要件.md）で通す:
//   はじめの画面 → プランの一覧（上の 3 つは選べない）→ 参加の確認 → 参加する → ホーム
//   → 預金でやること（推し活定期をはじめる・預金を積み増す）→ SNSで広める → プランを上げる（ゴールド → ダイヤモンド。背景と特典）
//   → 閉じて開き直す（はじめの画面）
// 開催熱量は、どの時点でも「FEVER 目前」・ゲージ 8 割付近のまま。大きい文字が、画面の左右に収まることも確かめる。
// API の接続先つきでビルドしてあるが、共有メーターではないので、偽の API（8798）への要求は 0 件。
// 各段の画面写真を、環境変数 SOLO_SHOTS の場所（既定は test-results/solo）に置く
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const API = 'http://127.0.0.1:8798';
const SHOTS = process.env.SOLO_SHOTS ?? 'test-results/solo';
const HEAT = '開催熱量。FEVER 目前。あと一歩';
// ファン向けの画面には、人数・達成率の数字は出ない（G-08）。ホームのゲージは「開催熱量。段階の名前。距離のことば」
const meter = (page: Page) => page.getByRole('img', { name: /^開催熱量。/ });
const layer = (page: Page, name: string) => page.locator(`[data-layer="${name}"]`);
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
/** ゲージ（横の棒）の長さ。棒の右を切り取る量（clip-path）から読む（0〜1）。 */
const gaugeFill = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const bar = document.querySelector('[data-heat] i');
    const m = bar
      ? /inset\(\s*[\d.]+(?:px)?\s+([\d.]+)%/.exec(getComputedStyle(bar).clipPath)
      : null;
    return m ? 1 - Number(m[1]) / 100 : Number.NaN;
  });
/** 演出の大きい文字が、画面の幅に収まっているか（左右がはみ出さない） */
const titleInside = async (page: Page, width: number): Promise<boolean> => {
  const box = await layer(page, 'fx').locator('b').first().boundingBox();
  return box !== null && box.x >= 0 && box.x + box.width <= width;
};
/**
 * 主のボタンを押したあと、次の押下を受けない間（0.6 秒ほど。連打・ダブルタップで 2 段進むのを止めている）を待つ。
 * 時計を止めている台本（clock）は、時計を進める。
 */
const settle = async (page: Page, clock = false, ms = 700): Promise<void> => {
  if (clock) await page.clock.runFor(ms);
  else await page.waitForTimeout(ms);
};
/** はじめの画面 → プランの一覧 → 参加の確認 →「参加する」→ ホーム（参加の称賛が終わるまで）。 */
const startToJoin = async (page: Page, shots = false, clock = false): Promise<void> => {
  const snap = async (name: string): Promise<void> => {
    if (shots) await shot(page, name);
  };
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(page.getByRole('heading', { name: '参加するプランを選ぶ' })).toBeVisible();
  await expect(page.locator('li[data-plan]')).toHaveCount(4);
  await expect(page.locator('li[data-plan][aria-disabled="true"]')).toHaveCount(3); // 上の 3 つは選べない
  await expect(page.locator('li[data-plan] button')).toHaveCount(0);
  await snap('01b-plans');
  await page.getByRole('button', { name: /で参加する$/ }).click();
  const confirm = page.getByRole('dialog', { name: '参加しますか？' });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText(/実際の決済・入出金は行われません/)).toBeVisible();
  await settle(page, clock, 400);
  await snap('02a-confirm');
  await page.getByRole('button', { name: '参加する', exact: true }).click();
  await expect(layer(page, 'fx').getByText('ようこそ！')).toBeVisible();
  await settle(page, clock, 1000);
  if (shots) expect(await titleInside(page, 390)).toBe(true); // 大きい文字が、左右にはみ出さない
  await snap('02b-fx-join');
  await settle(page, clock, 2200);
  await expect(page.getByRole('button', { name: /^預金でやることへ/ })).toBeVisible();
};
/** 偽の API が受けた要求（取得・申し込み）。接続の確認（/healthz）は数えない */
const apiRequests = async (): Promise<{ method: string; path: string }[]> =>
  ((await (await fetch(`${API}/__state`)).json()) as { log: { method: string; path: string }[] })
    .log;

test.beforeEach(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await fetch(`${API}/__control`, { method: 'POST', body: JSON.stringify({ resetState: true }) });
});

test('はじめの画面 → 参加 → 預金でやること → SNSで広める → プランを上げる（背景と特典）→ 閉じて開き直す（はじめの画面）', async ({
  context,
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // ① はじめの画面
  await page.goto('/fan/?p=4');
  await expect(page.getByRole('heading', { name: '推しを選ぶ' })).toBeVisible();
  await expect(page.getByText('動作確認用のデモ画面です')).toBeVisible();
  await shot(page, '01-start');

  // ② プランの一覧 → 参加の確認 → 参加する
  await startToJoin(page, true);
  await expect(meter(page)).toHaveAttribute('aria-label', HEAT);
  const fill0 = await gaugeFill(page);
  expect(fill0).toBeGreaterThan(0.75);
  expect(fill0).toBeLessThan(0.85); // ゲージは 8 割付近
  await expect(page.locator('button[data-act]')).toHaveCount(1); // 主のボタンは 1 つ
  await shot(page, '03-home-tasks');

  // ③ 預金でやること（推し活定期をはじめる → 預金を積み増す）
  await page.getByRole('button', { name: /^預金でやることへ/ }).click();
  await expect(page.locator('[data-tasks="todo"]')).toBeVisible();
  await page.getByRole('button', { name: '推し活定期をはじめる', exact: true }).click();
  await expect(page.locator('li[data-task="teiki"][data-ok="true"]')).toBeVisible();
  await expect(layer(page, 'ach').getByText('はじめてくれてありがとう。')).toBeVisible();
  await shot(page, '04a-tasks-teiki');
  await expect(page.getByRole('textbox', { name: '積み増す額（円）' })).toHaveValue('20000'); // ちょうど届く額
  await page.getByRole('button', { name: '積み増す', exact: true }).click();
  await expect(page.locator('[data-tasks="done"]')).toBeVisible();
  await expect(layer(page, 'ach').getByText(/預金でやることが、すべて済みました/)).toBeVisible();
  await shot(page, '04b-tasks-done');
  await page.getByRole('button', { name: 'ホームへもどる' }).click();
  await expect(page.locator('button[data-act="share"]')).toBeVisible();
  await expect(page.locator('button[data-act="upgrade"]')).toBeVisible(); // 済んだあとだけ、2 つ
  await page.waitForTimeout(1500);
  await shot(page, '05-home-grow');

  // ④ SNSで広める（外へは出ない）
  await page.locator('button[data-act="share"]').click();
  await expect(layer(page, 'share')).toBeVisible();
  await layer(page, 'share').getByRole('button', { name: 'X', exact: true }).click();
  await expect(layer(page, 'fx').getByText('広がった！')).toBeVisible();
  await page.waitForTimeout(900);
  expect(await titleInside(page, 390)).toBe(true);
  await shot(page, '06-fx-share');
  await page.waitForTimeout(2600);
  await layer(page, 'share').getByRole('button', { name: '閉じる' }).click();
  await settle(page);

  // ⑤ プランを上げる（ゴールド → 特別な演出 → 特典の贈呈 → 背景が変わる）
  await page.locator('button[data-act="upgrade"]').click();
  const sheet = page.getByRole('dialog', { name: 'プランを上げる' });
  await expect(sheet.locator('li[data-plan]')).toHaveCount(3);
  await page.waitForTimeout(400);
  await shot(page, '07-upgrade-sheet');
  await page.getByRole('button', { name: 'ゴールドプランに上げる' }).click();
  await expect(layer(page, 'fx').getByText('プランアップ！')).toBeVisible();
  await page.waitForTimeout(900);
  expect(await titleInside(page, 390)).toBe(true);
  await shot(page, '08-fx-upgrade');
  const reward = page.getByRole('dialog', { name: 'ゴールドプランの特典' });
  await expect(reward).toBeVisible({ timeout: 8000 });
  await expect(reward.getByText(/追加の画像/).first()).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, '09-reward-gold');
  await reward.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('[data-plan-tier="1"]')).toBeVisible();
  await settle(page);
  await shot(page, '10-home-gold');

  // ⑥ 飛ばして、ダイヤモンドへ。いちばん上では、「プランを上げる」は出ない
  await page.locator('button[data-act="upgrade"]').click();
  await page.getByRole('button', { name: 'ダイヤモンドプランに上げる' }).click();
  const top = page.getByRole('dialog', { name: 'ダイヤモンドプランの特典' });
  await expect(top).toBeVisible({ timeout: 8000 });
  await expect(top.getByText(/6秒の動画/).first()).toBeVisible();
  await page.waitForTimeout(400);
  await shot(page, '11-reward-diamond');
  await top.getByRole('button', { name: '閉じる' }).click();
  await expect(page.locator('[data-plan-tier="3"]')).toBeVisible();
  await expect(page.locator('button[data-act="upgrade"]')).toHaveCount(0);
  await expect(meter(page)).toHaveAttribute('aria-label', HEAT); // 熱量は、最後まで動かない
  expect(Math.abs((await gaugeFill(page)) - fill0)).toBeLessThan(0.01);
  await settle(page);
  await shot(page, '12-home-diamond');

  // ⑦ 閉じて開き直す（ブラウザに残るのは端末の番号だけ。ファン向けの状態は初めに戻る）
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/fan/?p=4');
  await expect(reopened.getByRole('heading', { name: '推しを選ぶ' })).toBeVisible();
  await shot(reopened, '13-reopen-start');
  await startToJoin(reopened);
  await expect(reopened.locator('[data-plan-tier="0"]')).toBeVisible(); // 前回のプランを持ち越さない
  await expect(reopened.locator('button[data-act="upgrade"]')).toHaveCount(0);

  // ⑧ API には、1 回も要求を送らない（API の接続先は渡されたままでも）
  expect(await apiRequests()).toEqual([]);
  expect(errors).toEqual([]);
});

test('操作が 5 分無いと、初めの状態に戻り、理由が出る（時計を進めて確かめる）', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/fan/?p=4');
  await startToJoin(page, false, true);
  await expect(meter(page)).toBeVisible();
  // 偽の時計で時間を一気に飛ばすと、画面が scroll を起こすことがある（実時間で 40 秒見ても起きない）。scroll も「操作」に数えるので、
  // 10 秒ずつ進めて、戻るまで見る（最大 900 秒）。最後の操作から 290 秒までは、必ず戻らない
  const start = page.getByRole('heading', { name: '推しを選ぶ' });
  for (let seconds = 10; seconds <= 900 && !(await start.isVisible()); seconds += 10) {
    await page.clock.runFor(10_000);
    if (seconds <= 290) await expect(start).toBeHidden();
  }
  await expect(start).toBeVisible();
  await expect(
    page.getByText('しばらく操作がなかったので、最初に戻しました').first(),
  ).toBeVisible();
  await shot(page, '10-idle-reset');
  expect(await apiRequests()).toEqual([]);
});
