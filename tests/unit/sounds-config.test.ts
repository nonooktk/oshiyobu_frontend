// 音源ファイル（/sounds/*。G-04）の配信の設定。ファイル名にハッシュが無いので、書体（/fonts/*）と同じく、変わらない扱い（immutable）にはしない。
// 配信の設定そのものの検査は static-web-app-config.test.ts。ここは、音源の route だけを確かめる。
// 実際に配信先で効いていることは、配備のあとの確認で見る。
import { describe, expect, it } from 'vitest';

const files = import.meta.glob('/public/staticwebapp.config.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
const config = JSON.parse(files['/public/staticwebapp.config.json'] ?? '{}') as {
  routes?: { route: string; headers?: Record<string, string> }[];
};
const headers = config.routes?.find((route) => route.route === '/sounds/*')?.headers;

describe('配信の設定: 音源（/sounds/*）', () => {
  it('1 時間キャッシュする。変わらない扱い（immutable）にはしない', () => {
    expect(headers?.['cache-control']).toBe('public, max-age=3600');
  });
});
