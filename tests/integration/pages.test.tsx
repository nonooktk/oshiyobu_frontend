// 3 ページの枠（I-101 のうち、枠の段階で確かめられる部分。SP-80・N-12）
// 実際の入り口（main.tsx）を読み込んで #root に描かせ、どのページにも札が出ることを確かめる
import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pages = [
  { name: '事務所向け（/）', load: () => import('../../src/office/main') },
  { name: 'ファン向け（/fan/）', load: () => import('../../src/fan/main') },
  { name: '発表者用（/presenter/）', load: () => import('../../src/presenter/main') },
];

describe('3 ページの枠', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    // ページごとに main.tsx を実行し直す
    vi.resetModules();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(pages)('$name に、札「デモ用の架空データ」と見出しが出る', async ({ load }) => {
    await load();
    expect(await screen.findByText('デモ用の架空データ')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });

  it.each(pages)('$name のロゴに代わりの文字（alt）がある', async ({ load }) => {
    await load();
    await screen.findByText('デモ用の架空データ');
    expect(screen.getByRole('img', { name: 'OSHIYOBU' })).toBeTruthy();
  });
});
