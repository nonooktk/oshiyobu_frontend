// 事務所向け（/）の ④ これまでの公演: 久留米シティプラザ Cボックス（FUK-019）の記録（要件 R-07・R-16）。
// 2026-11-16 に足した 4 件（出典は久留米シティプラザの公式の PDF）。データと比べるだけだと、データが違っていても通るため、
// 件数・日の並びは、値を直に書いて確かめる。
// 音の森ピアノコンサートは、#39 のレビューで外した（出典の名前が出演者の記載ではなく、関係者だけの催しと読めるため）。
// 2026-11-19、Issue #48 の統括の了承で、④ を画面から外した（docs/office/要件.md の N5-1。受け入れ V-28）。
// このファイルの、④ を表示する所の期待値だけを「④ が無い」に書き換えた（データの側の検査は、そのまま）
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/office/App';
import { PAST_EVENTS, VENUE_RECORDS } from '../../src/office/data';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { resetLinkForTest } from '../../src/shared/link';
import { FakeChannel } from '../helpers/fakeChannel';

const choose = (city: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
/** ④ が画面に無い（見出し・公演の一覧・文・札のどれも無い）。N5-1 */
const expectNoPast = () => {
  expect(screen.queryByRole('region', { name: 'これまでの公演' })).toBeNull();
  expect(screen.queryByTestId('past-head')).toBeNull();
  expect(screen.queryByTestId('past-list')).toBeNull();
  expect(screen.queryByTestId('past-none')).toBeNull();
};
/** core の会場 ID に当たる、データの公演（日の新しいものから） */
const eventsOf = (coreId: string) => {
  const record = VENUE_RECORDS.find((r) => r.coreVenueId === coreId);
  return PAST_EVENTS.filter((e) => e.venueId === record?.id).sort(
    (a, b) => b.date.localeCompare(a.date) || a.artist.localeCompare(b.artist, 'ja'),
  );
};
/** 久留米市 → Cボックスを選ぶ */
const openCbox = () => {
  render(<App />);
  choose('久留米市');
  fireEvent.click(screen.getByRole('button', { name: /Cボックス/ }));
};

/** Cボックスの公演の日（日の新しいものから。直に書く） */
const CBOX_DATES = ['2025-08-22', '2024-11-30', '2024-07-27', '2023-09-02'];

describe('事務所向けの ④ これまでの公演（久留米シティプラザ Cボックス）', () => {
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

  it('会場のデータは FUK-019 に当たり、公演は 4 件で、日の新しいものから並ぶ（データの側）', () => {
    expect(VENUE_RECORDS.find((r) => r.coreVenueId === 'cbox')?.id).toBe('FUK-019');
    const expected = eventsOf('cbox');
    expect(expected).toHaveLength(4);
    expect(expected.map((e) => e.date)).toEqual(CBOX_DATES);
  });

  it('N-5: 久留米市 → Cボックスを選んでも、④ は出ない', () => {
    openCbox();
    expectNoPast();
  });

  it('N-5: 出演者・日・出典のリンクは、画面に出ない', () => {
    openCbox();
    expectNoPast();
    expect(screen.queryAllByRole('link', { name: /出典/ })).toHaveLength(0);
  });

  it('N-5: 先頭の公演名「落語教育委員会ｉｎ久留米」は、画面に出ない', () => {
    openCbox();
    expect(document.body.textContent).not.toContain('落語教育委員会ｉｎ久留米');
  });

  it('画面のどこにも「音の森」は出ない（#39 のレビューで外した）', () => {
    openCbox();
    expect(document.body.textContent).not.toContain('音の森');
  });

  it('N-5: ④ の札（確認日 2026-11-16）と「記録は、まだありません」は、出ない', () => {
    openCbox();
    expectNoPast();
    expect(screen.queryByText('記録は、まだありません')).toBeNull();
  });
});
