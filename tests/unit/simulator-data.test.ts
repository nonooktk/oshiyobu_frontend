// @vitest-environment node
// 収支シミュレーター（public/simulator.html）の会場と公演のデータ（DATA）の検査（docs/office/要件.md の M-20。2026-11-18）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';

interface SimEvent {
  readonly date: string;
  readonly artist: string;
  readonly event_title: string;
}
interface SimVenue {
  readonly venue_id: string;
  readonly event_count: number;
  readonly latest_event: string;
  readonly events: readonly SimEvent[];
}

const html = readFileSync(`${ROOT}public/simulator.html`, 'utf8');
const line = html.split('\n').find((l) => l.startsWith('const DATA = ')) ?? '';
const data = JSON.parse(line.replace(/^const DATA = /, '').replace(/;\s*$/, '')) as {
  readonly venues: readonly SimVenue[];
};

describe('収支シミュレーターの公演のデータ', () => {
  it('DATA を読める（会場が 100 件以上）', () => {
    expect(data.venues.length).toBeGreaterThan(100);
  });

  it('音の森の 1 件（問い合わせ先の個人の名前が出演者の欄にあった行）が、DATA に無い', () => {
    expect(line).not.toContain('音の森');
    // 個人の名前は、DATA の外（冒頭のコメントなど）にも書かない
    expect(html).not.toContain('戒重守');
  });

  it('久留米シティプラザ Cボックス（FUK-019）の公演は 4 件で、件数の欄と一致する', () => {
    const cbox = data.venues.find((venue) => venue.venue_id === 'FUK-019');
    expect(cbox?.events).toHaveLength(4);
    expect(cbox?.event_count).toBe(4);
    expect(cbox?.latest_event).toBe('2025-08-22');
  });

  it('どの会場も、件数の欄（event_count）が、公演の数と一致する', () => {
    const mismatched = data.venues
      .filter((venue) => venue.event_count !== venue.events.length)
      .map((venue) => venue.venue_id);
    expect(mismatched).toEqual([]);
  });
});
