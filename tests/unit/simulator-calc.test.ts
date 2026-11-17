// @vitest-environment jsdom
// 収支シミュレーター（public/simulator.html）の 1 数字・2 損益（docs/office/要件.md の M-11〜M-22・V-15〜V-18。式は docs/office/仕様.md の 9.3）。
// ページの本文と script を、そのまま jsdom の中で動かして、画面に出る数字を確かめる
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

interface SimValues {
  venue: number;
  prod: number;
  travel: number;
  fee: number;
  hope: number;
  price: number;
  t1n: number;
  t1p: number;
  t2n: number;
  t2p: number;
  t3n: number;
  t3p: number;
}
interface SimVenue {
  readonly venue_id: string;
  readonly capacity: number;
  readonly capacity_tier: number;
}
interface SimResult {
  readonly line: number;
  readonly need: number;
  readonly total: number;
  readonly fits: boolean;
  readonly fee10: number;
  readonly profit: number;
  readonly profitAtLine: number;
}
interface SimApi {
  readonly select: (id: string) => void;
  readonly simFor: (venue: SimVenue) => SimValues;
  readonly simCalc: (cap: number, values: SimValues) => SimResult;
  readonly V: readonly SimVenue[];
}

// jsdom の環境では、scripts/core-lib.mjs の ROOT（import.meta.url から作る）を使えないので、リポジトリの一番上からの相対で読む
const html = readFileSync('public/simulator.html', 'utf8');
const scriptStart = html.indexOf('\n<script>\n');
const scriptEnd = html.indexOf('\n</script>\n');
const markup = html.slice(html.indexOf('<body>') + '<body>'.length, scriptStart);
const code = html.slice(scriptStart + '\n<script>\n'.length, scriptEnd);

let api: SimApi;
beforeEach(() => {
  document.body.innerHTML = markup;
  // ページの script を動かし、中の関数を受け取る（script は書き換えない）
  api = new Function(`${code}\nreturn { select, simFor, simCalc, V };`)() as SimApi;
});

const text = (selector: string): string => document.querySelector(selector)?.textContent ?? '';
const type = (key: string, value: number): void => {
  const input = document.querySelector<HTMLInputElement>(`#s-${key}`);
  if (input === null) throw new Error(`入力 #s-${key} がありません`);
  input.value = String(value);
  input.dispatchEvent(new Event('input'));
};
const labels = (): string[] =>
  [...document.querySelectorAll('.sim-in .il')].map((el) => el.textContent ?? '');

describe('収支シミュレーター 300 人の区分（DRUM Be-1・キャパ 300・価格 6,000円）', () => {
  beforeEach(() => api.select('FUK-012'));

  it('V-15 1 数字は、経費 3 つ → 利益（希望額）→ チケット価格と 3 つのプラン。出演料・アーティストの利益・需要は無い', () => {
    expect(labels()).toEqual([
      '会場費',
      '制作費',
      '移動・宿泊',
      '利益（希望額）',
      'チケット価格',
      'シルバープランの数',
      'シルバープランの上乗せ金額',
      'ゴールドプランの数',
      'ゴールドプランの上乗せ金額',
      'ダイヤモンドプランの数',
      'ダイヤモンドプランの上乗せ金額',
    ]);
    const box = document.querySelector('.sim-in')?.textContent ?? '';
    for (const gone of ['出演料', 'アーティストの利益', '需要', '高い枠', '前方', 'あいさつ']) {
      expect(box).not.toContain(gone);
    }
    expect(box).toContain('最低条件ちょうど集まったとき、全体利益がこの額になります');
    expect(document.querySelector<HTMLInputElement>('#s-hope')?.value).toBe('150000');
  });

  it('3 つのプランは、シルバー < ゴールド < ダイヤモンド（事務所向けの ⑤ と同じ組み立て）', () => {
    const value = (key: string) =>
      Number(document.querySelector<HTMLInputElement>(`#s-${key}`)?.value);
    expect([value('t1p'), value('t2p'), value('t3p')]).toEqual([12000, 94000, 294000]);
    expect([value('t1n'), value('t2n'), value('t3n')]).toEqual([30, 3, 1]);
  });

  it('V-16 2 損益: 最低条件 1,500,000円、次の行に 250人 × 6,000円。全体利益が出て、出演料の入力は 2 損益にある', () => {
    expect(text('[data-sim=line]')).toBe('1,500,000円');
    expect(text('[data-sim=need]')).toBe('250人 × 6,000円');
    expect(text('[data-sim=profit]')).toBe('1,262,400円');
    const out = document.querySelector('.sim-out')?.textContent ?? '';
    expect(out).toContain('全体利益');
    expect(out).not.toContain('アーティストの利益');
    expect(out).not.toContain('損益が合う');
    expect(document.querySelector('.sim-out #s-fee')).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>('#s-fee')?.value).toBe('500000');
  });

  it('V-17 利益（希望額）を 800,000円にすると、最低条件 2,222,223円・371人 × 6,000円（キャパを超える添え書き）。入りきらないは出ない', () => {
    type('hope', 800000);
    expect(text('[data-sim=line]')).toBe('2,222,223円');
    expect(text('[data-sim=need]')).toBe('371人 × 6,000円（通常の席だけではキャパ 300 を超える）');
    expect(document.querySelector('.verdict')).toBeNull();
    expect(text('[data-sim=profit]')).toBe('1,262,400円');
  });

  it('V-18 最低条件ちょうど集まったときの全体利益は、利益（希望額）と一致する（150,000円・800,000円）', () => {
    expect(text('[data-sim=profit-at-line]')).toBe('150,000円');
    type('hope', 800000);
    expect(text('[data-sim=profit-at-line]')).toBe('800,000円');
  });

  it('満席と 3 つのプランでも最低条件に届かないときだけ、「この会場では入りきらない」が出る', () => {
    type('hope', 3000000);
    expect(text('.verdict')).toContain('この会場では入りきらない');
    expect(text('[data-sim=profit]')).toBe('0円（不成立）');
  });
});

describe('収支シミュレーターの計算（simCalc）', () => {
  it('どの区分でも、初めの値の最低条件は 2026-11-18 より前と同じ値で、最低条件ちょうどの全体利益は希望額', () => {
    const before: Record<number, number> = {
      30: 280000,
      100: 650000,
      300: 1500000,
      500: 2450000,
      1000: 4650000,
    };
    for (const tier of [30, 100, 300, 500, 1000]) {
      const venue = api.V.find((v) => v.capacity_tier === tier);
      if (venue === undefined) throw new Error(`区分 ${tier} の会場がありません`);
      const values = api.simFor(venue);
      const result = api.simCalc(venue.capacity, values);
      expect(result.line, `区分 ${tier}`).toBe(before[tier]);
      expect(result.profitAtLine, `区分 ${tier}`).toBe(values.hope);
    }
  });

  it('全体利益 ＝ 集まる合計 − 手数料 − 会場費 − 制作費 − 出演料 − 移動・宿泊費。手数料は 1 円未満を切り上げ', () => {
    const values: SimValues = {
      venue: 200000,
      prod: 300000,
      travel: 200000,
      fee: 500000,
      hope: 150000,
      price: 6000,
      t1n: 30,
      t1p: 12000,
      t2n: 3,
      t2p: 94000,
      t3n: 1,
      t3p: 294000,
    };
    const result = api.simCalc(300, values);
    expect(result.total).toBe(2736000);
    expect(result.fee10).toBe(273600);
    expect(result.profit).toBe(2736000 - 273600 - 200000 - 300000 - 500000 - 200000);
  });

  it('割り切れない希望額でも、最低条件ちょうどの全体利益は、希望額と 1 円の違いもなく一致する', () => {
    const base: SimValues = {
      venue: 123457,
      prod: 98765,
      travel: 54321,
      fee: 333333,
      hope: 0,
      price: 6500,
      t1n: 10,
      t1p: 13000,
      t2n: 3,
      t2p: 93500,
      t3n: 1,
      t3p: 293500,
    };
    for (const hope of [0, 1, 7, 99999, 800000, 1234567]) {
      expect(api.simCalc(300, { ...base, hope }).profitAtLine, `希望額 ${hope}`).toBe(hope);
    }
  });
});
