// ファン向けの主な流れ（申し込み → 80% の演出 → 特典 → 仲間 → 感謝）の順番と数字（上層: A-15〜A-18・A-40・A-41・A-44・I-20〜I-24・I-27・I-28・I-123）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPostText } from '../../../src/fan/domain/share';
import { harness, passStart } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('基準の流れ（人物 4・tech0・久留米市・Cボックス）', () => {
  it('はじめは、どの人物（?p=1〜15）で開いても同じ状態: はじめの画面 1 / 2・口座なし・預金 0円・久留米市（初めから選んである）', () => {
    for (let no = 1; no <= 15; no += 1) {
      const h = harness(no);
      const s = h.state();
      expect(s.page, `人物 ${no}`).toBe('start');
      expect(s.start, `人物 ${no}`).toMatchObject({ step: 0, oshiId: 'tech0', seat: 'normal' });
      expect(s.city, `人物 ${no}`).toBe('久留米市');
      expect(s.venueId, `人物 ${no}`).toBe('cbox');
      expect(s.acct, `人物 ${no}`).toEqual({ pay: false, deposit: 0, times: 0 });
      expect(s.done, `人物 ${no}`).toEqual({});
      expect(h.view().status, `人物 ${no}`).toMatchObject({ supporters: 74, pct: 79, left: 19 });
    }
  });

  it('はじめる → 積み増す → 申し込むで、申し込みが確定して 75 人・80% になる', () => {
    const h = harness(4);
    passStart(h);
    expect(h.state().page).toBe('home');
    expect(h.state().course).toBe('normal');
    expect(h.joins).toEqual(['tech0:cbox']);
    expect(h.view().status).toMatchObject({ supporters: 75, pct: 80, left: 18 });
  });

  it('同じコースをもう一度押しても、何も起きない', () => {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(3500);
    h.a.closeGift();
    const before = h.state();
    h.a.applyCourse('normal');
    expect(h.state().course).toBe(before.course);
    expect(h.joins).toHaveLength(1);
  });
});

describe('共有（X・Instagram・Facebook は、外のサイトを開かず・コピーもせず、アプリの中で「投稿した」ことになる）', () => {
  /** 申し込み → 特典 1/3 を閉じる → 共有のシートを開いた状態 */
  function toShareSheet() {
    const h = harness(4);
    passStart(h);
    vi.advanceTimersByTime(700 + 2510);
    h.a.closeGift();
    h.a.openShare('share');
    return h;
  }

  it('投稿文に、推しの名前・市・開催熱量と距離のことばが入り（人数・達成率は入らない）、人物の番号・預金額・口座・URL は入らない', () => {
    const h = toShareSheet();
    const text = buildPostText(h.view());
    expect(text).toContain(
      'Tech0サステナアイドルを久留米市に呼びたい！ いま開催熱量は「FEVER 目前」です。開催まで、あと一歩です。',
    );
    expect(text).not.toMatch(/\d+人|\d+%|達成率|最低人数/);
    expect(text).not.toMatch(/p=\d|90,?000|預金|口座/);
    // 仮の URL を、班のメンバーに見せない。URL は文に入れず、ハッシュタグで終わる
    expect(text).not.toMatch(/https?:|example\.test|\/fan\//);
    expect(text.endsWith('#OSHIYOBU')).toBe(true);
  });
});

describe('サーバーの件数と 80% の判定（I-123）', () => {
  it('ほかの端末の申し込みで 80% を越えても、演出は出ない（自分の申し込みの直後だけ）', () => {
    const h = harness(4);
    h.setServer(1); // 74 → 75 人（80%）
    vi.advanceTimersByTime(5000);
    expect(h.state().layers).toEqual([]);
    expect(h.view().status.pct).toBe(80);
  });
});

describe('最低人数・コースと人数（A-65・A-66・A-68・I-19）', () => {
  it('全員が通常の席なら、93 人（サーバー 19 件）で、成立する（651,000円）', () => {
    const h = harness(4);
    h.setServer(19);
    expect(h.view().status).toMatchObject({ supporters: 93, total: 651000, established: true });
  });
});
