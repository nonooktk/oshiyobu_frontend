// 事務所向け（/）の ⑥ 満たせるか: 横棒（必要 ／ 見込み）と凡例を外した（統括の追加の修正依頼 2026-11-19 の N-7）。
// 4 象限の図（熱量と資金）は残す。core の見込みの数字（data-testid="expected"）は、⑥ の判定の札の横に出す
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
const six = () => document.querySelector('section[aria-labelledby="j6"]') as HTMLElement;

describe('事務所向けの ⑥ の横棒を外した（N-7）', () => {
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

  it('⑥ に横棒（図の読み上げ「払える熱いファンの見込みは…」）と凡例「払える熱いファン」「必要」が無い', () => {
    render(<App />);
    pickBase();
    expect(six()).not.toBeNull();
    expect(within(six()).queryByRole('img', { name: /払える熱いファンの見込みは/ })).toBeNull();
    expect(six().textContent).not.toContain('必要 93人');
    expect(within(six()).queryByText('払える熱いファン')).toBeNull();
  });

  it('見込みの数字（187人）は ⑥ の中に残り、4 象限の図（熱量と資金）も残る', () => {
    render(<App />);
    pickBase();
    expect(within(six()).getByTestId('expected').textContent).toBe('187人');
    expect(within(six()).getByTestId('quad-hotRich')).toBeTruthy();
  });
});
