// 事務所向け（/）の ① 地図の市の名前が重ならない（2026-11-20。N-10 で名前の文字を 21 にした）。
// 実ブラウザで、9 市の名前（名前と数字の 2 行）の描いた範囲（getBBox）が、どの 2 市でも重ならないことを、
// 推し 5 組 × 指標 2 つで確かめる（jsdom では字の幅を測れないので、ここで確かめる）。
// 22 にすると、KKRS48 の「人数」で久留米市と大分市の名前が重なったので、21 にした
import { expect, test } from '@playwright/test';

test('① 地図: 推し 5 組 × 指標 2 つで、9 市の名前が重ならない', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/', { waitUntil: 'networkidle' });
  const artists = page.locator('[role=group][aria-labelledby=artist-label] button');
  const count = await artists.count();
  expect(count).toBe(5);
  const hits: string[] = [];
  for (let a = 0; a < count; a++) {
    await artists.nth(a).click();
    const artist = (await artists.nth(a).innerText()).trim();
    for (const metric of ['人数', '払える熱量']) {
      await page.getByRole('button', { name: metric, exact: true }).click();
      const found = await page.evaluate(() => {
        const items = [
          ...document.querySelectorAll('svg[aria-labelledby=map-title] g[role=button]'),
        ].map((g) => {
          const text = g.querySelector('text') as SVGTextElement;
          const box = text.getBBox();
          const m = text.transform.baseVal.consolidate()?.matrix;
          return {
            name: (g.getAttribute('aria-label') ?? '').split('を選ぶ')[0] ?? '',
            x: box.x + (m?.e ?? 0),
            y: box.y + (m?.f ?? 0),
            w: box.width,
            h: box.height,
          };
        });
        const out: string[] = [];
        for (const p of items)
          for (const q of items)
            if (
              p.name < q.name &&
              p.x < q.x + q.w &&
              q.x < p.x + p.w &&
              p.y < q.y + q.h &&
              q.y < p.y + p.h
            )
              out.push(`${p.name} × ${q.name}`);
        return { n: items.length, out };
      });
      expect(found.n).toBe(9);
      hits.push(...found.out.map((x) => `${artist}・${metric}: ${x}`));
    }
  }
  expect(hits).toEqual([]);
});
