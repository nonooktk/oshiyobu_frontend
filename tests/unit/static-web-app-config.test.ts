// 配信の設定（public/staticwebapp.config.json の下書き。設計 D-22・D-40）の検査
// 主張「検索に載せない」「直しが必ず届く」「2 回目以降が速い」は、設定ファイルに書いたことを、ここで固定する。
// （実際に配信先で効いていることは、配備のあとの確認で見る。D-27・I-107）
import { describe, expect, it } from 'vitest';
import { PAGES } from '../helpers/pages';

const files = import.meta.glob('/public/staticwebapp.config.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const text = files['/public/staticwebapp.config.json'] ?? '';

type Config = {
  routes?: { route: string; headers?: Record<string, string> }[];
  globalHeaders?: Record<string, string>;
};
const config: Config = text ? (JSON.parse(text) as Config) : {};
const headersOf = (route: string) => config.routes?.find((r) => r.route === route)?.headers;

describe('配信の設定', () => {
  it('設定ファイルがあり、JSON として読める。20 KB 以下（配信先の上限）', () => {
    expect(text.length).toBeGreaterThan(0);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(20 * 1024);
  });

  it('全ページに「検索に載せない」ヘッダー（X-Robots-Tag: noindex）を付ける', () => {
    expect(config.globalHeaders?.['x-robots-tag']).toBe('noindex');
  });

  it('ハッシュつきのファイル（/bundle/*）は、1 年・変わらない扱いでキャッシュする', () => {
    expect(headersOf('/bundle/*')?.['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('書体（/fonts/*）は、1 日キャッシュする。ファイル名にハッシュが無いので、変わらない扱い（immutable）にはしない', () => {
    const value = headersOf('/fonts/*')?.['cache-control'];
    expect(value).toBe('public, max-age=86400');
    expect(value).not.toContain('immutable');
  });

  it("CSP は、書体の読み込み先を、同じサイト（default-src 'self'）だけにしている（font-src で外へ広げない）", () => {
    const csp = config.globalHeaders?.['content-security-policy'] ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('font-src');
  });

  // HTML を毎回確かめるから、直しが必ず届く（D-40）。
  // route は、index.html の完全一致で書く。末尾に * を付けた書き方（/fan/* など）は /fan/ に一致しないため
  it.each(PAGES)('$html は、毎回確かめる（no-cache）', ({ html }) => {
    expect(headersOf(html)?.['cache-control']).toBe('no-cache');
  });

  it('毎回確かめる（no-cache）のは、3 ページの HTML だけ', () => {
    const noCache = (config.routes ?? [])
      .filter((r) => r.headers?.['cache-control'] === 'no-cache')
      .map((r) => r.route)
      .sort();
    expect(noCache).toEqual(PAGES.map((page) => page.html).sort());
  });
});
