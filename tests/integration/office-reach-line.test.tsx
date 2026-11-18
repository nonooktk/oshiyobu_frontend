// 事務所向け（/）の ⑤ 開催条件の到達ライン（docs/office/要件.md の M-07・V-23。2026-11-18）。
// 1 行目に「<到達ライン>で開催できます」を一番大きく、2 行目に「<必要人数> × <価格>」。金額の書き方（650,000円）は変えない
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pickBase = () => {
  fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
  fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
};

describe('事務所向けの ⑤ の到達ライン', () => {
  beforeEach(() => {
    officeStore.setState(initialOfficeState());
    vi.stubGlobal('fetch', vi.fn());
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    resetLinkForTest();
  });
  afterEach(() => {
    cleanup();
    resetLinkForTest();
    vi.unstubAllGlobals();
  });

  it('V-23 基準（Tech0・久留米市・Cボックス）で、1 行目が「650,000円で開催できます」、2 行目が「93人 × 7,000円」', () => {
    render(<App />);
    pickBase();
    const first = screen.getByTestId('cond-line');
    const second = screen.getByTestId('cond-sub');
    expect(first.textContent).toContain('650,000円で開催できます');
    expect(first.textContent).not.toContain('93人');
    expect(second.textContent).toMatch(/93人\s*×\s*7,000円/);
    // 1 行目が先、2 行目があと
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 金額の書き方は 1,500,000円 の形のまま（data-testid="line" の中は金額だけ）
    expect(within(first).getByTestId('line').textContent).toBe('650,000円');
  });

  it('キャパの札は 2 行目にある', () => {
    render(<App />);
    pickBase();
    expect(screen.getByTestId('cond-sub').textContent).toContain('キャパ');
    expect(screen.getByTestId('cond-line').textContent).not.toContain('キャパ');
  });
});
