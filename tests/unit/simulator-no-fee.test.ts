// @vitest-environment jsdom
// 収支シミュレーター（public/simulator.html）から出演料を外した（docs/office/要件.md の M-26。2026-11-18 の追加の直し（2））。
// 出演料は利益に含まれる。最低条件 ＝ 切り上げ（（経費 ＋ 利益）÷ 0.9）、全体利益 ＝ 集まる合計 − 手数料 − 会場費 − 制作費 − 移動・宿泊費。
// 利益の初めの値は、区分ごとに「いまの出演料 ＋ いまの利益」で、最低条件はどの区分もこれまでと同じ値のまま
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

interface SimVenue {
  readonly venue_id: string;
  readonly capacity: number;
  readonly capacity_tier: number;
}
interface SimApi {
  readonly select: (id: string) => void;
  readonly simFor: (venue: SimVenue) => Record<string, number>;
  readonly simCalc: (
    cap: number,
    values: Record<string, number>,
  ) => { readonly line: number; readonly profitAtLine: number };
  readonly V: readonly SimVenue[];
}

// jsdom の環境では、リポジトリの一番上からの相対で読む（simulator-calc.test.ts と同じ）
const html = readFileSync('public/simulator.html', 'utf8');
const scriptStart = html.indexOf('\n<script>\n');
const markup = html.slice(html.indexOf('<body>') + '<body>'.length, scriptStart);
const code = html.slice(scriptStart + '\n<script>\n'.length, html.indexOf('\n</script>\n'));

let api: SimApi;
beforeEach(() => {
  document.body.innerHTML = markup;
  api = new Function(`${code}\nreturn { select, simFor, simCalc, V };`)() as SimApi;
});

/** 区分ごとの、2026-11-18 の追加の直し（2）より前の値（出演料・利益・最低条件） */
const BEFORE: Record<number, { fee: number; hope: number; line: number }> = {
  30: { fee: 100000, hope: 12000, line: 280000 },
  100: { fee: 250000, hope: 55000, line: 650000 },
  300: { fee: 500000, hope: 150000, line: 1500000 },
  500: { fee: 800000, hope: 255000, line: 2450000 },
  1000: { fee: 1500000, hope: 535000, line: 4650000 },
};

describe('収支シミュレーターから出演料を外した（M-26）', () => {
  it('画面（1 数字・2 損益・内訳）に「出演料」が無く、入力欄も無い', () => {
    api.select('FUK-012');
    expect(document.querySelector('#sim')?.textContent).not.toContain('出演料');
    expect(document.querySelector('#s-fee')).toBeNull();
    // 帯グラフにも、出演料の区画は無い
    expect(document.querySelector('.seg[title^="出演料"]')).toBeNull();
  });

  it('区分ごとの初めの値: 利益 ＝ いまの出演料 ＋ いまの利益。出演料の値は持たない。最低条件は、これまでと同じ', () => {
    for (const [tier, before] of Object.entries(BEFORE)) {
      const venue = api.V.find((v) => v.capacity_tier === Number(tier));
      if (venue === undefined) throw new Error(`区分 ${tier} の会場がありません`);
      const values = api.simFor(venue);
      expect(values.hope, `区分 ${tier}`).toBe(before.fee + before.hope);
      expect(values.fee, `区分 ${tier}`).toBeUndefined();
      const result = api.simCalc(venue.capacity, values);
      expect(result.line, `区分 ${tier}`).toBe(before.line);
      expect(result.profitAtLine, `区分 ${tier}`).toBe(values.hope);
    }
  });

  it('300 人の区分: 利益の初めの値は 650,000円で、最低条件 1,500,000円', () => {
    api.select('FUK-012');
    expect(document.querySelector<HTMLInputElement>('#s-hope')?.value).toBe('650000');
    expect(document.querySelector('[data-sim=line]')?.textContent).toBe('1,500,000円');
  });

  it('300 人の区分で利益を 800,000円にすると、最低条件 1,666,667円、最低条件ちょうどの全体利益 800,000円', () => {
    api.select('FUK-012');
    const input = document.querySelector<HTMLInputElement>('#s-hope');
    if (input === null) throw new Error('利益の入力がありません');
    input.value = '800000';
    input.dispatchEvent(new Event('input'));
    expect(document.querySelector('[data-sim=line]')?.textContent).toBe('1,666,667円');
    expect(document.querySelector('[data-sim=profit-at-line]')?.textContent).toBe('800,000円');
  });
});
