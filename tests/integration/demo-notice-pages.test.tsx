// 「動作確認用のデモ画面です」の表示（全ページ）。いまの札「デモ用の架空データ」と並べて出す。札は消さない。
// 実際の入り口（main.tsx）を読み込んで #root に描かせ、3 ページのどれにも出ることを確かめる
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoBadge } from '../../src/shared/components/DemoBadge';
import { App as OfficeApp } from '../../src/office/App';

const NOTICE = '動作確認用のデモ画面です';
const BADGE = 'デモ用の架空データ';

const pages = [
  { name: '事務所向け（/）', load: () => import('../../src/office/main') },
  { name: 'ファン向け（/fan/）', load: () => import('../../src/fan/main') },
  { name: '発表者用（/presenter/）', load: () => import('../../src/presenter/main') },
];

describe('札の部品（DemoBadge）', () => {
  afterEach(cleanup);

  it('「動作確認用のデモ画面です」と、これまでの札「デモ用の架空データ」の両方を出す', () => {
    render(<DemoBadge />);
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByText(BADGE)).toBeTruthy();
  });

  it('置き場所の className は、これまでどおり、札「デモ用の架空データ」に付く', () => {
    render(<DemoBadge className="place-right" />);
    expect(screen.getByText(BADGE).classList.contains('place-right')).toBe(true);
  });
});

describe('3 ページに、動作確認用の表示が出る', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each(pages)(
    '$name に、「動作確認用のデモ画面です」と札「デモ用の架空データ」が並ぶ',
    async ({ load }) => {
      await load();
      expect(await screen.findByText(NOTICE)).toBeTruthy();
      expect(screen.getByText(BADGE)).toBeTruthy();
    },
  );
});

describe('事務所向けの重ねて出す枠（情報の扱い）', () => {
  afterEach(cleanup);

  it('画面と、重ねて出す枠の両方に出る', () => {
    render(<OfficeApp />);
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '情報の扱い' }));
    expect(screen.getAllByText(NOTICE)).toHaveLength(2);
    expect(screen.getAllByText(BADGE)).toHaveLength(2);
  });
});
