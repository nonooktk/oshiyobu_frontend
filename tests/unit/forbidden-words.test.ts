// 文言ガード（設計 D-26・I-102・SP-81・N-13）。画面に使わない語が、src と HTML に 0 件であること
// 注意: 検査の起動条件は「ファイルが見つかること」。見つからなければ、0 件でも合格にしない（空振りの防止）
import { describe, expect, it } from 'vitest';

const files = import.meta.glob(
  [
    '/src/**/*.{ts,tsx,css,md,json,html,svg}',
    '/index.html',
    '/fan/index.html',
    '/presenter/index.html',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const FORBIDDEN_WORDS = [
  '新しい口座を開く',
  '口座開設',
  '確約',
  '参加',
  '応援レース',
  '応募資格',
  '上位の体験',
];

describe('使わない語', () => {
  it('検査の対象が見つかり、中身を読めている（空振りしていない）', () => {
    const paths = Object.keys(files);
    expect(paths).toContain('/index.html');
    expect(paths).toContain('/src/shared/components/DemoBadge.tsx');
    expect(paths).toContain('/src/styles/tokens.css');
    // CSS は、テストの設定（vite.config.ts の test.css）次第で、中身が空になる。空のままだと、0 件でも検査していない
    const unreadable = Object.entries(files)
      .filter(([, text]) => typeof text !== 'string' || text.length === 0)
      .map(([path]) => path);
    expect(unreadable).toEqual([]);
  });

  it.each(FORBIDDEN_WORDS)('「%s」が、src と HTML に 0 件', (word) => {
    const hits = Object.entries(files)
      .filter(([, text]) => text.includes(word))
      .map(([path]) => path);
    expect(hits).toEqual([]);
  });
});
