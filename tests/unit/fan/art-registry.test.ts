// 推しの絵の置き場の検査（設計 D-40）。縮めた版の使い分けと、先読みの登録（登録がずれると、先読みが黙って何もしない）。
import { describe, expect, it } from 'vitest';
import { ARTIST_IDS } from '../../../src/core';
import {
  ARTISTS_VIEW,
  PREFETCH_IMAGES,
  PREFETCH_PLAN,
  giftSources,
} from '../../../src/fan/art/registry';

describe('先読みの登録', () => {
  it('先読みの順に書いた絵は、すべて絵の一覧にある（ずれると、先読みが黙って何もしない）', () => {
    for (const id of ARTIST_IDS) {
      for (const url of PREFETCH_PLAN[id] ?? []) {
        expect(PREFETCH_IMAGES[url], `${id}: ${url}`).toBe(url);
      }
    }
  });

  it('tech0 は幅 768 の 2・3 枚目、krs48・riji・terao は特典の切り抜き用の幅 1152 の 1 枚、平成の俺は先読み無し', () => {
    expect(PREFETCH_PLAN.tech0).toEqual(ARTISTS_VIEW.tech0.art.imgs?.slice(1));
    for (const id of ['krs48', 'riji', 'terao'] as const) {
      expect(PREFETCH_PLAN[id]).toEqual([ARTISTS_VIEW[id].art.big]);
      expect(ARTISTS_VIEW[id].art.big).toMatch(/1152/);
    }
    expect(PREFETCH_PLAN.heisei ?? []).toEqual([]);
  });
});

describe('縮めた版の使い分け', () => {
  it('最初の画面・ホーム・カードは幅 768、丸い絵は幅 192（ファイル名で確かめる）。元絵（jpg）を配らない', () => {
    for (const id of ARTIST_IDS) {
      const a = ARTISTS_VIEW[id];
      const urls = [
        a.circle.src,
        ...(a.art.imgs ?? []),
        a.art.img,
        a.art.big,
        ...Object.values(a.cards).map((c) => c.src),
      ];
      for (const url of urls) if (url) expect(url, `${id}: ${url}`).toMatch(/\.webp$/);
      expect(a.circle.src).toMatch(/artist-/);
    }
    expect(ARTISTS_VIEW.krs48.art.img).toMatch(/768/);
    expect(ARTISTS_VIEW.heisei.art.img).toMatch(/heisei-full/);
  });

  it('特典の絵: tech0 は 1・2・3 枚目。ほかの 3 組は 1・2 段目が幅 1152 の切り抜き・3 段目が全体（幅 768）。代わりの絵は最初の画面の絵', () => {
    const t = ARTISTS_VIEW.tech0;
    expect([0, 1, 2].map((i) => giftSources(t, i).whole)).toEqual(t.art.imgs);
    for (const id of ['krs48', 'riji', 'terao'] as const) {
      const a = ARTISTS_VIEW[id];
      expect(giftSources(a, 0)).toMatchObject({ cutout: a.art.big, whole: null, base: a.art.img });
      expect(giftSources(a, 1).cutout).toBe(a.art.big);
      expect(giftSources(a, 2)).toMatchObject({ whole: a.art.img, cutout: null });
    }
  });
});
