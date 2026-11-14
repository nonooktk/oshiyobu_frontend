// ひとり体験（既定）の、実ブラウザでの通し（手元の Google Chrome・幅 390px・ポート 5297）。
// 基準の公演（人物 4・Tech0サステナアイドル × 久留米市 × Cボックス）を、
//   はじめの画面 → 申し込む（FEVER 目前の演出）→ 仲間を呼ぶ（FEVER の演出）→ 閉じて開き直す（はじめの画面・熱量は初めから）
// まで通す。API の接続先つきでビルドしてあるが、共有メーターではないので、偽の API（8798）への要求は 0 件。
// 各段の画面写真を、環境変数 SOLO_SHOTS の場所（既定は test-results/solo）に置く
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const API = 'http://127.0.0.1:8798';
const SHOTS = process.env.SOLO_SHOTS ?? 'test-results/solo';
// ファン向けの画面には、人数・達成率の数字は出ない（G-08）。ホームのゲージは「開催熱量。段階の名前。距離のことば」
const meter = (page: Page) => page.getByRole('img', { name: /^開催熱量。/ });
const layer = (page: Page, name: string) => page.locator(`[data-layer="${name}"]`);
const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
/** 偽の API が受けた要求（取得・申し込み）。接続の確認（/healthz）は数えない */
const apiRequests = async (): Promise<{ method: string; path: string }[]> =>
  ((await (await fetch(`${API}/__state`)).json()) as { log: { method: string; path: string }[] })
    .log;

test.beforeEach(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await fetch(`${API}/__control`, { method: 'POST', body: JSON.stringify({ resetState: true }) });
});

test('はじめの画面 → 申し込む（FEVER 目前）→ 仲間を呼ぶ（FEVER・開催決定）→ 閉じて開き直す（はじめの画面・初めの熱量）', async ({
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

  // ② 申し込む（FEVER 目前の演出）
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: 'この内容で申し込む' }).click();
  await expect(layer(page, 'fx').getByText('FEVER 目前！')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, '02-fx-fever-soon');
  await expect(layer(page, 'gift')).toBeVisible({ timeout: 8000 }); // 演出のあと、特典 1/3 の絵
  await shot(page, '03-gift-1');
  await layer(page, 'gift').getByRole('button', { name: '閉じる' }).click();
  await expect(meter(page)).toHaveAttribute('aria-label', '開催熱量。FEVER 目前。あと一歩');
  await shot(page, '04-home-fever-soon');

  // ③ 仲間を呼ぶ（FEVER・開催決定の演出）
  await page.getByRole('button', { name: /^次のアクション/ }).click();
  await page.getByRole('button', { name: /^仲間を呼ぶ/ }).click();
  await expect(layer(page, 'share')).toBeVisible();
  await layer(page, 'share').getByRole('button', { name: '閉じる' }).click();
  await expect(layer(page, 'fx').getByText('FEVER！')).toBeVisible({ timeout: 8000 });
  await expect(layer(page, 'fx').getByText('あなたの声が届いて、開催が決まりました')).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, '05-fx-established'); // 成立の演出の最中
  await expect(layer(page, 'gift')).toBeVisible({ timeout: 10_000 }); // 演出のあと、特典 2/3 の絵
  await layer(page, 'gift').getByRole('button', { name: '閉じる' }).click();
  // 次のアクションの画面に、開催が決まったことが出る。ホームに戻ると、ゲージが FEVER
  await expect(page.getByText('仲間に、開催が決まったことを知らせましょう')).toBeVisible();
  await page.getByRole('button', { name: '‹ ホーム' }).click();
  await expect(meter(page)).toHaveAttribute('aria-label', '開催熱量。FEVER。開催が決まりました');
  await shot(page, '06-home-fever');

  // ④ 閉じて開き直す（ブラウザに残るのは端末の番号だけ。ファン向けの状態は初めに戻る）
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/fan/?p=4');
  await expect(reopened.getByRole('heading', { name: '推しを選ぶ' })).toBeVisible();
  await shot(reopened, '07-reopen-start');
  await reopened.getByRole('button', { name: '次へ' }).click();
  await reopened.getByRole('button', { name: '次へ' }).click();
  await reopened.getByRole('button', { name: 'この内容で申し込む' }).click();
  await expect(layer(reopened, 'fx').getByText('FEVER 目前！')).toBeVisible(); // 初めから始まるので、また FEVER 目前の演出
  await layer(reopened, 'gift').getByRole('button', { name: '閉じる' }).click({ timeout: 10_000 });
  await expect(meter(reopened)).toHaveAttribute('aria-label', '開催熱量。FEVER 目前。あと一歩'); // 前回の FEVER を持ち越さない
  await shot(reopened, '08-reopen-home-fever-soon');

  // ⑤ API には、1 回も要求を送らない（API の接続先は渡されたままでも）
  expect(await apiRequests()).toEqual([]);
  expect(errors).toEqual([]);
});

test('操作が 5 分無いと、初めの状態に戻り、理由が出る（時計を進めて確かめる）', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/fan/?p=4');
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: '次へ' }).click();
  await page.getByRole('button', { name: 'この内容で申し込む' }).click();
  await page.clock.runFor(3500);
  await layer(page, 'gift').getByRole('button', { name: '閉じる' }).click();
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
  await shot(page, '09-idle-reset');
  expect(await apiRequests()).toEqual([]);
});
