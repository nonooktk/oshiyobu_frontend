// 事務所向け（/）の右の列の並び（docs/office/要件.md の M-06・M-25・V-23。2026-11-18）。
// ⑤ 開催条件が上、⑥ 満たせるかが下（位置の入れ替え。60 通りの測り直しで V-14 に収まったので、番号の付け替えにはしない）
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const pick = (city: string, venue: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
  fireEvent.click(screen.getByRole('button', { name: venue }));
};
const follows = (a: Node, b: Node) =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('事務所向けの ⑤⑥ の並び', () => {
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

  it('V-23 ⑤ 開催条件が上、⑥ 満たせるかが下。見出しの番号は 5・6 のまま', () => {
    render(<App />);
    pick('久留米市', /久留米シティプラザ Cボックス/);
    const judge = screen.getByTestId('judge');
    const five = within(judge).getByText('開催条件').closest('p') as HTMLElement;
    const six = within(judge).getByText('満たせるか').closest('p') as HTMLElement;
    expect(five.id).toBe('j5');
    expect(six.id).toBe('j6');
    expect(five.textContent).toContain('5');
    expect(six.textContent).toContain('6');
    expect(follows(five, six)).toBe(true);
  });

  it('シミュレーターに無い会場（RISE UP）の注記と、提案できない理由は、ボタンの組の外に出る（⑤ の高さを詰める）', () => {
    render(<App />);
    pick('久留米市', /RISE UP/);
    const note = within(screen.getByTestId('judge')).getByText(
      'この会場は、収支シミュレーターにありません',
    );
    const proposal = within(screen.getByTestId('judge')).getByRole('button', {
      name: '提案を見る',
    });
    expect(proposal.parentElement?.contains(note)).toBe(false);
  });
});
