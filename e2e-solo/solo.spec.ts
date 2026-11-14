// ひとり体験（既定）の、実ブラウザでの通し（手元の Google Chrome・幅 390px・ポート 5297）。
// 基準の公演（人物 4・Tech0サステナアイドル × 久留米市 × Cボックス）を、
//   はじめの画面 → 申し込む（FEVER 目前の称賛）→ ホームの主のボタン「仲間を呼ぶ」（届いた！ → ゲージが加速して伸びる → FEVER の瞬間）
//   → 閉じて開き直す（はじめの画面・熱量は初めから）
// まで通す。共有のシートは経由しない。大きい文字が、画面の左右に収まることも確かめる。API の接続先つきでビルドしてあるが、共有メーターではないので、偽の API（8798）への要求は 0 件。
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
/** 偽の API が受けた要求（取得・申し込み）。接続の確認（/healthz）は数えない */
const apiRequests = async (): Promise<{ method: string; path: string }[]> =>
  ((await (await fetch(`${API}/__state`)).json()) as { log: { method: string; path: string }[] })
    .log;

test.beforeEach(async () => {
  mkdirSync(SHOTS, { recursive: true });
  await fetch(`${API}/__control`, { method: 'POST', body: JSON.stringify({ resetState: true }) });
});

test('はじめの画面 → 申し込む（FEVER 目前）→ 仲間を呼ぶ（届いた！ → ゲージが加速 → FEVER・開催決定）→ 閉じて開き直す（はじめの画面・初めの熱量）', async ({
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
  await page.waitForTimeout(1200);
  await expect(layer(page, 'fx').getByText('申し込みありがとう。あなたの一歩で、')).toBeVisible();
  await expect(layer(page, 'fx').getByText('FEVER 目前まで来ました')).toBeVisible();
  expect(await titleInside(page, 390)).toBe(true); // 大きい文字が、左右にはみ出さない
  await shot(page, '02-fx-fever-soon');
  await expect(layer(page, 'gift')).toBeVisible({ timeout: 8000 }); // 演出のあと、特典 1/3 の絵
  await shot(page, '03-gift-1');
  await layer(page, 'gift').getByRole('button', { name: '閉じる' }).click();
  await expect(meter(page)).toHaveAttribute('aria-label', '開催熱量。FEVER 目前。あと一歩');
  await shot(page, '04-home-fever-soon');

  // ③ 仲間を呼ぶ（ホームの主のボタン。共有のシートは出ない）→ 届いた！ → ゲージが終わりに近いほど速く伸びる → FEVER の瞬間
  await expect(page.getByRole('button', { name: /^SNSに投稿する（任意）/ })).toBeVisible(); // 副のボタン（申し込んだあとから）
  await page.getByRole('button', { name: /^仲間を呼ぶ/ }).click();
  await expect(layer(page, 'share')).toHaveCount(0);
  await expect(layer(page, 'fx').getByText('届いた！')).toBeVisible();
  const samples = await page.evaluate(
    () =>
      new Promise<{ t: number; g: number }[]>((resolve) => {
        const out: { t: number; g: number }[] = [];
        const t0 = performance.now();
        const bar = document.querySelector('[data-heat] i');
        const tick = (): void => {
          const t = performance.now() - t0;
          const m = bar
            ? /inset\(\s*[\d.]+(?:px)?\s+([\d.]+)%/.exec(getComputedStyle(bar).clipPath)
            : null;
          out.push({ t, g: m ? 1 - Number(m[1]) / 100 : Number.NaN });
          if (t < 2400) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
  );
  await shot(page, '05-friend-reach');
  const at = (ms: number): number => samples.find((p) => p.t >= ms)?.g ?? Number.NaN;
  const early = at(1200) - at(0); // 前半の伸び
  const late = at(2400) - at(1200); // 後半の伸び
  expect(early).toBeGreaterThanOrEqual(0);
  expect(late).toBeGreaterThan(early * 2); // 終わりに近いほど速く伸びる
  await expect(layer(page, 'fx').getByText('FEVER！', { exact: true })).toBeVisible({
    timeout: 8000,
  });
  await expect(layer(page, 'fx').getByText('あなたの声が届いて、開催が決まりました')).toBeVisible();
  await page.waitForTimeout(900);
  expect(await titleInside(page, 390)).toBe(true); // FEVER の大きい文字が、左右にはみ出さない
  expect(await gaugeFill(page)).toBeGreaterThan(0.99); // ゲージは満タン
  await shot(page, '06-fx-established'); // FEVER の瞬間の演出の最中
  await expect(layer(page, 'gift')).toBeVisible({ timeout: 10_000 }); // 演出のあと、特典 2/3 の絵
  await layer(page, 'gift').getByRole('button', { name: '閉じる' }).click();
  // ホームは FEVER。主のボタンは、仲間に知らせる（もう一度は呼べない）
  await expect(meter(page)).toHaveAttribute('aria-label', '開催熱量。FEVER。開催が決まりました');
  await expect(page.getByRole('button', { name: /^仲間を呼ぶ/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^仲間に知らせる/ })).toBeVisible();
  await shot(page, '07-home-fever');

  // ④ 閉じて開き直す（ブラウザに残るのは端末の番号だけ。ファン向けの状態は初めに戻る）
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto('/fan/?p=4');
  await expect(reopened.getByRole('heading', { name: '推しを選ぶ' })).toBeVisible();
  await shot(reopened, '08-reopen-start');
  await reopened.getByRole('button', { name: '次へ' }).click();
  await reopened.getByRole('button', { name: '次へ' }).click();
  await reopened.getByRole('button', { name: 'この内容で申し込む' }).click();
  await expect(layer(reopened, 'fx').getByText('FEVER 目前！')).toBeVisible(); // 初めから始まるので、また FEVER 目前の演出
  await layer(reopened, 'gift').getByRole('button', { name: '閉じる' }).click({ timeout: 10_000 });
  await expect(meter(reopened)).toHaveAttribute('aria-label', '開催熱量。FEVER 目前。あと一歩'); // 前回の FEVER を持ち越さない
  await shot(reopened, '09-reopen-home-fever-soon');

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
  await shot(page, '10-idle-reset');
  expect(await apiRequests()).toEqual([]);
});
