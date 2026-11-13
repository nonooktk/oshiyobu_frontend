// 速さと応答の測定（N-19〜N-21。I-79〜I-82・I-87・I-90・I-93。設計 D-40・SP-93〜SP-96）
// 弱い回線（下り 200,000 B/秒・上り 93,750 B/秒・遅延 150 ms）と CPU 4 倍で、ビルドした成果物を測る。
// 手元の配信には TLS の往復が無いので、冷たい読み込みには、設計の見込み 0.45 秒（往復 3 回）を足して判定する（D-40）
import { expect, test } from '@playwright/test';
import { readyTime, throttle } from './helpers';
import { mkdirSync, writeFileSync } from 'node:fs';

const TLS_ALLOWANCE_MS = 450;
const PAGES = [
  { name: '事務所向け', path: '/', cold: 4000, warm: 2000 },
  { name: 'ファン向け', path: '/fan/?p=4', cold: 3000, warm: 1500 },
] as const;
const results: Record<string, unknown> = {};

async function measure(page: import('@playwright/test').Page, url: string) {
  await page.goto(url, { waitUntil: 'load' });
  const ready = await readyTime(page, 20_000);
  // 描画のあとに頼まれる絵は、読み終えてから通信の記録に載る。静かになるまで待ってから数える
  await page.waitForLoadState('networkidle');
  return page.evaluate((readyAt) => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const isCode = (e: PerformanceResourceTiming) => /\.(js|css)(\?|$)/.test(e.name);
    const isImage = (e: PerformanceResourceTiming) => /\.(webp|png|jpe?g)(\?|$)/.test(e.name);
    // 最初の画面までに読んだもの: ready の印までに頼んだもの（描画の直後に頼む絵のため、100 ms の余裕を見る）
    const first = (e: PerformanceResourceTiming) =>
      readyAt === null || e.startTime <= readyAt + 100;
    const sum = (list: PerformanceResourceTiming[]) =>
      list.reduce((total, entry) => total + entry.encodedBodySize, 0);
    const code = entries.filter((e) => isCode(e) && first(e));
    const images = entries.filter((e) => isImage(e));
    return {
      ready: readyAt,
      load: nav.loadEventEnd,
      codeBytes: sum(code) + nav.encodedBodySize,
      codeRequests: code.length,
      imageBytes: sum(images.filter(first)),
      imageRequests: images.filter(first).length,
      imageBytesAll: sum(images),
      all: entries.map((e) => `${e.name.split('/').pop()}:${e.initiatorType}:${e.encodedBodySize}`),
      images: images.map(
        (e) => `${e.name.split('/').pop()} 開始${Math.round(e.startTime)}ms ${e.encodedBodySize}B`,
      ),
      transferred: entries.reduce((total, e) => total + (e.transferSize || 0), 0),
    };
  }, ready);
}

for (const target of PAGES) {
  test(`${target.name}: 弱い回線・CPU 4 倍で、冷たい読み込みと 2 回目以降を測る`, async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await throttle(context, page);
    const cold = await measure(page, target.path);
    const coldAt = cold.ready ?? cold.load;
    // 2 回目以降: キャッシュを残したまま開き直す（HTML は毎回確かめる。ハッシュつきファイルはキャッシュ）
    const warm = await measure(page, target.path);
    const warmAt = warm.ready ?? warm.load;
    results[target.name] = { cold, warm, 印あり: cold.ready !== null };
    mkdirSync('e2e/results', { recursive: true });
    writeFileSync('e2e/results/perf.json', JSON.stringify(results, null, 2));
    console.log(
      `${target.name}: ${JSON.stringify({ coldMs: Math.round(coldAt), warmMs: Math.round(warmAt), ...cold, warmTransferred: warm.transferred })}`,
    );
    if (cold.ready === null) {
      test.info().annotations.push({
        type: '注意',
        description: 'oshiyobu:ready が打たれていないため、load の時刻で測った',
      });
    }
    expect(coldAt + TLS_ALLOWANCE_MS).toBeLessThanOrEqual(target.cold);
    expect(warmAt).toBeLessThanOrEqual(target.warm);
    expect(cold.codeBytes).toBeLessThanOrEqual(200_000);
    expect(cold.imageBytes).toBeLessThanOrEqual(300_000);
    expect(warm.transferred).toBeLessThan(cold.transferred / 4);
    await context.close();
  });
}

test('事務所向け: 押してから見た目が変わるまで 100 ms 以内（弱い回線・CPU 4 倍。N-21・I-93）', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await readyTime(page);
  await throttle(context, page);
  // 押した瞬間（click の取り込み）から、画面が最初に変わった次の描画までを、ページの中で測る
  const arm = () =>
    page.evaluate(() => {
      const w = window as unknown as { __lap: Promise<number> };
      w.__lap = new Promise<number>((resolve) => {
        let start = 0;
        document.addEventListener('click', () => (start = performance.now()), {
          capture: true,
          once: true,
        });
        const observer = new MutationObserver(() => {
          observer.disconnect();
          requestAnimationFrame(() => resolve(performance.now() - start));
        });
        observer.observe(document.body, { subtree: true, childList: true, attributes: true });
      });
    });
  const lap = () => page.evaluate(() => (window as unknown as { __lap: Promise<number> }).__lap);
  const press = async (click: () => Promise<void>) => {
    await arm();
    await click();
    return lap();
  };
  const laps: Record<string, number> = {};
  // 丸の中心（押せる範囲の円）を押す。ラベルを含む外枠の中心では、隣の市に当たることがある
  laps['市（地図の丸）'] = await press(() =>
    page.locator('g[role=button][aria-label^="久留米市を選ぶ"] > circle').first().click(),
  );
  laps['会場'] = await press(() => page.getByRole('button', { name: /Cボックス/ }).click());
  laps['指標の切り替え'] = await press(() =>
    page.getByRole('button', { name: '払える熱量', exact: true }).click(),
  );
  laps['条件を調整'] = await press(() => page.getByText('条件を調整').click());
  laps['提案を見る'] = await press(() => page.getByRole('button', { name: '提案を見る' }).click());
  await page.keyboard.press('Escape');
  // 札が「低」の組にすると、提案は開けなくなる（aria-disabled）ので、最後に切り替える
  laps['組の切り替え'] = await press(() =>
    page.getByRole('button', { name: /てらお少年/ }).click(),
  );
  console.log(
    `押してから見た目が変わるまで（ミリ秒）: ${JSON.stringify(Object.fromEntries(Object.entries(laps).map(([k, v]) => [k, Math.round(v)])))}`,
  );
  for (const [name, ms] of Object.entries(laps)) {
    expect(ms, name).toBeLessThanOrEqual(100);
  }
  await context.close();
});
