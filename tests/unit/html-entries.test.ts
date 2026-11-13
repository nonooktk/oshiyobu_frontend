// 3 ページの HTML（入り口）の検査。検索に載せない設定（D-22）と、外部の読み込みが無いこと（N-07）
import { describe, expect, it } from 'vitest';
import { PAGES } from '../helpers/pages';

const htmlFiles = import.meta.glob(['/index.html', '/fan/index.html', '/presenter/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('3 ページの HTML', () => {
  it('3 ページとも存在する（検査が空振りしていない）', () => {
    expect(Object.keys(htmlFiles).sort()).toEqual(PAGES.map((page) => page.html).sort());
  });

  describe.each(PAGES)('$html', ({ html: path, entry }) => {
    const html = htmlFiles[path] ?? '';

    it('日本語のページで、スマホの幅に合わせる', () => {
      expect(html).toContain('<html lang="ja">');
      expect(html).toContain(
        '<meta name="viewport" content="width=device-width, initial-scale=1" />',
      );
    });

    it('検索に載せない（noindex の meta。ヘッダーは staticwebapp.config.json で付ける）', () => {
      expect(html).toContain('<meta name="robots" content="noindex" />');
    });

    it('自分のページの入り口（main.tsx）だけを読み込む', () => {
      expect(html).toContain(`<script type="module" src="${entry}"></script>`);
      expect(html).toContain('<div id="root"></div>');
    });

    it('外部の URL を読み込まない（src・href は、同じサイトの絶対パスだけ）', () => {
      const urls = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map((m) => m[1] ?? '');
      const external = urls.filter((url) => !/^\/(?!\/)/.test(url));
      expect(external).toEqual([]);
    });
  });
});
