// @vitest-environment jsdom
// 収支シミュレーター（public/simulator.html）が、事務所向けの ⑤「条件を調整」の 4 つの値（?cost=会場費,制作費,移動・宿泊,利益）を受け取る
// （N-15。Issue #53 の統括の了承 2026-11-20。docs/office/要件.md の 14 節）。
// - 会場（?venue=）を受け取れたときだけ読む。その会場の入力の初めの値にし、最低条件は事務所向けの到達ラインと同じになる
// - 統括の条件 2: 値は数字として検査し、範囲（0〜999,999,999 円の整数がちょうど 4 つ）に合ったときだけ使う。合わなければ、区分の初めの値
// - URL の文字は、画面に書き出さない（入力欄に入るのは、数字に直した値だけ）
// ページの本文と script を、そのまま jsdom の中で動かす（simulator-venue-param.test.ts と同じ読み方。script は書き換えない）
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { costsOfTier, lineOf, VENUES } from '../../src/core';
import { hopeOf, lineWithFee, simulatorHref } from '../../src/office/adjust';

interface SimVenue {
  readonly venue_id: string;
  readonly venue_name: string;
  readonly capacity: number;
}

const html = readFileSync('public/simulator.html', 'utf8');
const scriptStart = html.indexOf('\n<script>\n');
const scriptEnd = html.indexOf('\n</script>\n');
const markup = html.slice(html.indexOf('<body>') + '<body>'.length, scriptStart);
const code = html.slice(scriptStart + '\n<script>\n'.length, scriptEnd);

/** ?以降を付けてページを開き直し、script を動かす */
function open(search: string): { V: readonly SimVenue[]; select: (id: string) => void } {
  window.history.replaceState(null, '', `/simulator.html${search}`);
  document.body.innerHTML = markup;
  return new Function(`${code}\nreturn { V, select };`)() as {
    V: readonly SimVenue[];
    select: (id: string) => void;
  };
}
/** 「1 数字」の入力欄の値（会場費・制作費・移動・宿泊・利益） */
const inputs = (): number[] =>
  ['venue', 'prod', 'travel', 'hope'].map((k) =>
    Number(document.querySelector<HTMLInputElement>(`#s-${k}`)?.value),
  );
const people = (): number => Number(document.querySelector<HTMLInputElement>('#n')?.value);
const simLine = (): string => document.querySelector('[data-sim="line"]')?.textContent ?? '';
const yen = (n: number): string => `${n.toLocaleString('ja-JP')}円`;
const selectedName = (): string | undefined =>
  document.querySelector('#vlist .vrow[aria-selected="true"] .vname')?.textContent ?? undefined;

/** 区分 100 の初めの値（Cボックス） */
const CBOX_DEFAULT = [60000, 100000, 120000, 305000];

afterEach(() => {
  window.history.replaceState(null, '', '/');
  document.body.innerHTML = '';
});

describe('収支シミュレーター: 「条件を調整」の値を受け取る（N-15）', () => {
  it('Cボックスで、事務所向けで直した値を受け取ると、入力がその値になり、最低条件は事務所向けの到達ラインと同じ', () => {
    const v = { venue: 100000, prod: 100000, travel: 120000, hope: 305000 };
    open('?venue=FUK-019&cost=100000,100000,120000,305000');
    expect(inputs()).toEqual([100000, 100000, 120000, 305000]);
    expect(simLine()).toBe(yen(lineWithFee(v))); // 694,445円（事務所向けの ⑤ と同じ）
    expect(simLine()).toBe('694,445円');
    expect(people()).toBe(144); // 会場と人数の引き継ぎ（N-11）は、そのまま
    expect(selectedName()).toBe('久留米シティプラザ Cボックス');
  });

  it.each(VENUES.filter((v) => v.simulatorVenueId !== undefined).map((v) => [v.name, v] as const))(
    '%s: 事務所向けのリンクのとおりに開くと、4 つの値と最低条件が、事務所向けの ⑤ と同じ',
    (_name, venue) => {
      const costs = costsOfTier(venue.tier);
      const v = { venue: costs.venue, prod: costs.prod, travel: costs.travel, hope: hopeOf(costs) };
      const href = simulatorHref(venue.simulatorVenueId ?? '', v);
      open(href.slice('/simulator.html'.length));
      expect(inputs()).toEqual([v.venue, v.prod, v.travel, v.hope]);
      expect(simLine()).toBe(yen(lineOf(costs))); // 事務所向けの到達ライン（初めの値）と同じ
    },
  );

  it('利益も直して受け取ると、その値が入る（最低条件は ⌈（費用 3 つ ＋ 利益）÷ 0.9⌉）', () => {
    open('?venue=FUK-019&cost=60000,100000,120000,400000');
    expect(inputs()).toEqual([60000, 100000, 120000, 400000]);
    expect(simLine()).toBe('755,556円');
  });

  it('V-38 会場費 100,000円・利益 400,000円で開くと、最低条件は ⌈720,000 ÷ 0.9⌉ ＝ 800,000円（事務所向けの到達ラインと同じ）', () => {
    const v = { venue: 100000, prod: 100000, travel: 120000, hope: 400000 };
    open('?venue=FUK-019&cost=100000,100000,120000,400000');
    expect(inputs()).toEqual([100000, 100000, 120000, 400000]);
    expect(simLine()).toBe('800,000円');
    expect(simLine()).toBe(yen(lineWithFee(v)));
  });

  it('0 円と、9 桁（999,999,999）は受ける', () => {
    open('?venue=FUK-019&cost=0,0,0,0');
    expect(inputs()).toEqual([0, 0, 0, 0]);
    open('?venue=FUK-019&cost=999999999,0,0,0');
    expect(inputs()).toEqual([999999999, 0, 0, 0]);
  });

  it.each([
    ['数が 3 つ', '1,2,3'],
    ['数が 5 つ', '1,2,3,4,5'],
    ['負', '-1,2,3,4'],
    ['小数', '1.5,2,3,4'],
    ['文字', 'a,b,c,d'],
    ['10 桁', '1000000000,1,1,1'],
    ['空', ''],
    ['空の項目', '1,,3,4'],
    ['空白', ' 1,2,3,4'],
    ['全角の数字', '０,1,2,3'],
    ['カンマ以外の区切り', '60000;100000;120000;305000'],
    ['指数', '1e5,1,1,1'],
    ['タグ', '<img src=x onerror=alert(1)>'],
  ])(
    '条件 2: %s（%s）は使わない。区分の初めの値のまま、会場と人数の引き継ぎは生かす',
    (_label, raw) => {
      open(`?venue=FUK-019&cost=${encodeURIComponent(raw)}`);
      expect(inputs()).toEqual(CBOX_DEFAULT);
      expect(simLine()).toBe('650,000円');
      expect(people()).toBe(144);
      expect(selectedName()).toBe('久留米シティプラザ Cボックス');
      expect(document.body.innerHTML).not.toContain('onerror');
    },
  );

  it('会場を受け取れないとき（無い・一覧に無い ID）は、cost も使わない（300 人から。一番上の会場の初めの値）', () => {
    open('');
    const plain = inputs();
    for (const search of ['?cost=1,2,3,4', '?venue=ZZZ-999&cost=1,2,3,4']) {
      open(search);
      expect(people(), search).toBe(300);
      expect(inputs(), search).toEqual(plain);
    }
  });

  it('URL の文字は、画面の文字に書き出さない（入力欄の値は、数字に直した値）', () => {
    open('?venue=FUK-019&cost=100000,100000,120000,305000');
    expect(document.body.textContent).not.toContain('100000,100000,120000,305000');
    expect(document.body.innerHTML).not.toContain('cost=');
  });

  it('受け取った値は、その会場にだけ入る（ほかの会場を選ぶと、その会場の区分の初めの値）', () => {
    const { select } = open('?venue=FUK-019&cost=100000,100000,120000,305000');
    select('FUK-016'); // DRUM SON（同じ区分 100）
    expect(inputs()).toEqual(CBOX_DEFAULT);
    select('FUK-019');
    expect(inputs()).toEqual([100000, 100000, 120000, 305000]);
  });
});
