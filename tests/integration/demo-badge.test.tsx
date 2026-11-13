// 「デモ用の架空データ」の札（N-12・SP-80）。部品としての動き
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DemoBadge } from '../../src/shared/components/DemoBadge';

afterEach(cleanup);

describe('DemoBadge', () => {
  it('「デモ用の架空データ」と表示する', () => {
    render(<DemoBadge />);
    expect(screen.getByText('デモ用の架空データ')).toBeTruthy();
  });

  it('置き場所を決めるための className を受け取る', () => {
    render(<DemoBadge className="place-right" />);
    expect(screen.getByText('デモ用の架空データ').classList.contains('place-right')).toBe(true);
  });
});
