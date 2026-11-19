// 事務所向け（/）の ⑤「条件を調整」を、収支シミュレーターと同じ項目にした（2026-11-20。Issue #53 の統括の了承。N-13。
// docs/office/要件.md の 13 節。受け入れ V-33〜V-36）。
// - 入力は、会場費・制作費・移動・宿泊（組「費用」）と、利益（組「利益」）と、最低人数。出演料・アーティストの利益・注記は無い
// - 利益の欄に「到達ラインちょうど集まったとき、全体利益がこの額になります」を添える
// - 利益の初めの値は、シミュレーターと同じ（Cボックス〈区分 100〉で 305,000円）。到達ラインは 650,000円・93人のまま
// - 提案の 1 枚の内訳（5 項目）の形は変えない
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
const openAdjust = () => fireEvent.click(screen.getByText('条件を調整'));
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) =>
  fireEvent.change(input(label), { target: { value } });
const text = (testId: string) => screen.getByTestId(testId).textContent ?? '';

describe('事務所向けの ⑤「条件を調整」（N-13）', () => {
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

  it('V-33 入力は、会場費・制作費・移動・宿泊・利益・最低人数。出演料・アーティストの利益・注記「費用は仮の金額です」は無い', () => {
    render(<App />);
    pick('久留米市', /久留米シティプラザ Cボックス/);
    openAdjust();
    const judge = screen.getByTestId('judge');
    const labels = [...judge.querySelectorAll('details label')].map((l) => l.textContent);
    expect(labels).toEqual(['会場費', '制作費', '移動・宿泊', '利益', '最低人数']);
    expect(judge.textContent).not.toContain('出演料');
    expect(judge.textContent).not.toContain('アーティストの利益');
    expect(judge.textContent).not.toContain('費用は仮の金額です');
  });

  it('V-34 組の見出しは「費用」と「利益」。利益の欄に添え書きがあり、読み上げでも欄に結び付く', () => {
    render(<App />);
    pick('久留米市', /久留米シティプラザ Cボックス/);
    openAdjust();
    const details = screen.getByTestId('judge').querySelector('details') as HTMLElement;
    expect(within(details).getByText('費用')).toBeTruthy();
    expect(within(details).getAllByText('利益').length).toBeGreaterThan(0);
    const note = within(details).getByText(
      '到達ラインちょうど集まったとき、全体利益がこの額になります',
    );
    expect(input('利益').getAttribute('aria-describedby')).toContain(note.id);
  });

  it.each([
    ['久留米市', /久留米シティプラザ Cボックス/, '305,000', '650,000円', '93人'],
    ['福岡市', /music hall fragile/, '112,000', '280,000円', '40人'],
    ['福岡市', /DRUM Be-1/, '650,000', '1,500,000円', '250人'],
  ])(
    'V-35 %s・%s: 利益の初めの値は %s 円（シミュレーターと同じ）。到達ライン %s・必要人数 %s は変わらない',
    (city, venue, hope, line, need) => {
      render(<App />);
      pick(city, venue);
      openAdjust();
      expect(input('利益').value).toBe(hope);
      expect(text('line')).toBe(line);
      expect(text('need')).toBe(need);
    },
  );

  it('V-36 利益を 400,000円にすると、到達ラインは ⌈（280,000 ＋ 400,000）÷ 0.9⌉ ＝ 755,556円・必要人数 108人', () => {
    render(<App />);
    pick('久留米市', /久留米シティプラザ Cボックス/);
    openAdjust();
    type('利益', '400000');
    expect(text('line')).toBe('755,556円');
    expect(text('need')).toBe('108人');
    fireEvent.blur(input('利益'));
    expect(input('利益').value).toBe('400,000');
  });

  it('利益の欄も、費用と同じ検査（空・負・小数は反映せず、理由を出す）', () => {
    render(<App />);
    pick('久留米市', /久留米シティプラザ Cボックス/);
    openAdjust();
    type('利益', '-1');
    expect(within(screen.getByTestId('judge')).getAllByRole('alert').length).toBeGreaterThan(0);
    expect(text('line')).toBe('650,000円');
  });

  it('提案の 1 枚の内訳は、直す前は今のまま（出演料 250,000円・アーティストの利益 120,000円・合計 650,000円）', () => {
    render(<App />);
    pick('久留米市', /久留米シティプラザ Cボックス/);
    fireEvent.click(screen.getByRole('button', { name: '提案を見る' }));
    const cost = within(screen.getByRole('dialog')).getByTestId('pp-cost').textContent ?? '';
    for (const expected of ['出演料250,000円', 'アーティストの利益120,000円', '合計650,000円']) {
      expect(cost).toContain(expected);
    }
  });

  it('直したあとの提案の 1 枚の内訳は、出演料 0円・アーティストの利益 ＝ 到達ライン − 費用 3 つ（合計は到達ライン）', () => {
    render(<App />);
    pick('久留米市', /久留米シティプラザ Cボックス/);
    openAdjust();
    type('会場費', '100000');
    fireEvent.click(screen.getByRole('button', { name: '提案を見る' }));
    const cost = within(screen.getByRole('dialog')).getByTestId('pp-cost').textContent ?? '';
    for (const expected of ['出演料0円', 'アーティストの利益374,445円', '合計694,445円']) {
      expect(cost).toContain(expected);
    }
  });
});
