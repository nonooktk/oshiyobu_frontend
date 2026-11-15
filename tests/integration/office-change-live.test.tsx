// 事務所向け（/）の、変わった数字の読み上げ（要件 R-14。仕様 2.2「読み上げ用の知らせに、変わった項目を足す」）
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { changeLiveText } from '../../src/office/text/labels';
import { CHANGE_KEYS } from '../../src/office/view';
import type { Snapshot } from '../../src/office/view';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const live = () => screen.getByTestId('change-live');

describe('changeLiveText（読み上げの文）', () => {
  const base = Object.fromEntries(CHANGE_KEYS.map((k) => [k, 1])) as Snapshot;

  it('前の値と今の値を、画面の見出しと同じ語で並べる', () => {
    const prev = { ...base, expected: 187, level: '高', line: 650000 };
    const now = { ...base, expected: 120, level: '中', line: 280000 };
    expect(changeLiveText(['expected', 'level', 'line'], prev, now)).toBe(
      '見込み 187人から 120人。成立の見込み 高から 中。到達ライン 650,000円から 280,000円。',
    );
  });

  it('前の値が無いときは、空', () => {
    expect(changeLiveText(['expected'], null, base)).toBe('');
  });
});

describe('事務所向けの、変わった数字の読み上げ', () => {
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

  it('読み上げの枠は aria-live で、初めは空。推しを替えると、見込みの前と今が入る。到達ラインは入らない', () => {
    render(<App />);
    expect(live().getAttribute('aria-live')).toBe('polite');
    fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
    fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
    expect(live().textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    expect(live().textContent).toContain('見込み 187人から 120人。');
    expect(live().textContent).toContain('成立の見込み 高から 中。');
    expect(live().textContent).not.toContain('到達ライン');
  });

  it('「事務所向けだけ戻す」のあとは、空に戻る', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^久留米市を選ぶ/ }));
    fireEvent.click(screen.getByRole('button', { name: /久留米シティプラザ Cボックス/ }));
    fireEvent.click(screen.getByRole('button', { name: /KRS48/ }));
    fireEvent.click(screen.getByRole('button', { name: '事務所向けだけ戻す' }));
    expect(live().textContent).toBe('');
  });
});
