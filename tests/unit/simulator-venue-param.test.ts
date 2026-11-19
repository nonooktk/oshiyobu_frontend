// @vitest-environment jsdom
// 収支シミュレーター（public/simulator.html）が、事務所向けの ⑤ のリンクから会場の ID（?venue=）を受け取る（N-11。Issue #50 の統括の了承 2026-11-19）。
// - 事務所向けの会場 11 件のどれで来ても、人数がその会場の規模（キャパ）から始まり、その会場が一覧の一番上で選ばれている
// - 統括の条件 1: venue の値は、シミュレーターの会場の一覧（DATA）と照らして、合ったときだけ使う（合わなければ、今までどおり 300 人から）
// - 統括の条件 2: URL の値を、そのまま画面に書き出さない（画面に出るのは、一覧の側の会場の名前）
// ページの本文と script を、そのまま jsdom の中で動かす（simulator-calc.test.ts と同じ読み方。script は書き換えない）
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { VENUES } from '../../src/core';

interface SimVenue {
  readonly venue_id: string;
  readonly venue_name: string;
  readonly capacity: number;
  readonly event_count: number;
}

const html = readFileSync('public/simulator.html', 'utf8');
const scriptStart = html.indexOf('\n<script>\n');
const scriptEnd = html.indexOf('\n</script>\n');
const markup = html.slice(html.indexOf('<body>') + '<body>'.length, scriptStart);
const code = html.slice(scriptStart + '\n<script>\n'.length, scriptEnd);

/** ?以降を付けてページを開き直し、script を動かす。会場の一覧（V）を受け取る */
function open(search: string): readonly SimVenue[] {
  window.history.replaceState(null, '', `/simulator.html${search}`);
  document.body.innerHTML = markup;
  return (new Function(`${code}\nreturn { V };`)() as { V: readonly SimVenue[] }).V;
}

const people = (): number => Number(document.querySelector<HTMLInputElement>('#n')?.value);
const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('#vlist .vrow')];
const firstRow = (): HTMLElement => {
  const row = rows()[0];
  if (row === undefined) throw new Error('会場の一覧が空です');
  return row;
};
const nameOf = (row: HTMLElement): string => row.querySelector('.vname')?.textContent ?? '';
const selectedName = (): string | undefined =>
  rows()
    .filter((row) => row.getAttribute('aria-selected') === 'true')
    .map(nameOf)[0];
const setPeople = (n: number): void => {
  const input = document.querySelector<HTMLInputElement>('#n');
  if (input === null) throw new Error('人数の入力がありません');
  input.value = String(n);
  input.dispatchEvent(new Event('change'));
};

/** 事務所向けで、シミュレーターへの入口が出る会場（core の simulatorVenueId を持つもの） */
const FROM_OFFICE = VENUES.flatMap((venue) =>
  venue.simulatorVenueId === undefined ? [] : [[venue.name, venue.simulatorVenueId] as const],
);

afterEach(() => {
  window.history.replaceState(null, '', '/');
  document.body.innerHTML = '';
});

describe('収支シミュレーター: 事務所向けから会場を受け取る（N-11）', () => {
  it('事務所向けの入口がある会場は 11 件で、どれもシミュレーターの会場の一覧にある', () => {
    const V = open('');
    expect(FROM_OFFICE).toHaveLength(11);
    for (const [, id] of FROM_OFFICE) {
      expect(
        V.some((v) => v.venue_id === id),
        id,
      ).toBe(true);
    }
  });

  it.each(FROM_OFFICE)(
    '%s（%s）で来ると、人数がその会場のキャパから始まり、その会場が一覧の一番上で選ばれている',
    (_name, id) => {
      const V = open(`?venue=${id}`);
      const venue = V.find((v) => v.venue_id === id);
      if (venue === undefined) throw new Error(`${id} が一覧にありません`);
      expect(people()).toBe(venue.capacity);
      expect(nameOf(firstRow())).toBe(venue.venue_name);
      expect(firstRow().getAttribute('aria-selected')).toBe('true');
      expect(selectedName()).toBe(venue.venue_name);
      // 2 損益の見出しにも、一覧の側の会場の名前が出る
      expect(document.querySelector('#sim .vname-s')?.textContent).toBe(venue.venue_name);
    },
  );

  it('ID が無いときは、今までどおり 300 人から始まる（一番上の会場が選ばれる）', () => {
    open('');
    expect(people()).toBe(300);
    expect(firstRow().getAttribute('aria-selected')).toBe('true');
  });

  it('条件 1: 一覧に無い ID・空の値・大文字小文字の違う ID は使わない（300 人から。一覧はそのまま）', () => {
    open('');
    const plain = rows().map(nameOf);
    for (const search of ['?venue=ZZZ-999', '?venue=', '?venue=fuk-020', '?other=FUK-020']) {
      open(search);
      expect(people(), search).toBe(300);
      expect(rows().map(nameOf), search).toEqual(plain);
    }
  });

  it('条件 2: URL の値は、画面に書き出さない（合わない値でも、合う値でも）', () => {
    const bad = '<img src=x onerror=alert(1)>';
    open(`?venue=${encodeURIComponent(bad)}`);
    expect(document.body.innerHTML).not.toContain('onerror');
    expect(document.body.textContent).not.toContain(bad);
    // ページにもとからある画像はロゴだけ。URL の値から画像が作られていない
    expect([...document.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([
      'assets/logo-wide.png',
    ]);
    // 合う値のときに画面に出るのは、一覧の側の名前（ID の文字列そのものは、画面の文字に出ない）
    open('?venue=FUK-020');
    expect(document.body.textContent).not.toContain('FUK-020');
    expect(selectedName()).toBe('music hall fragile（旧SQUARE GARDEN）');
  });

  it('近さが同じ会場があっても、受け取った会場が先に来る（メディキット。キャパ 300 の会場が 8 件）', () => {
    const V = open('?venue=MYZ-004');
    expect(V.filter((v) => v.capacity === 300 && v.event_count > 0).length).toBeGreaterThan(1);
    expect(nameOf(firstRow())).toBe(V.find((v) => v.venue_id === 'MYZ-004')?.venue_name);
  });

  it('人数を変えると、受け取った会場の優先は外れ、今までどおりの近い順に戻る', () => {
    open('');
    const plain300 = rows().map(nameOf);
    open('?venue=MYZ-004');
    setPeople(300);
    expect(rows().map(nameOf)).toEqual(plain300);
    expect(firstRow().getAttribute('aria-selected')).toBe('true');
  });

  it('公演の記録が無い会場で来ても、その会場を選ぶ（「公演の記録がある会場だけ」を外す）', () => {
    const V = open('');
    const noEvents = V.find((v) => v.event_count === 0 && v.capacity >= 10 && v.capacity <= 1500);
    if (noEvents === undefined) throw new Error('公演の記録が無い会場が見つかりません');
    open(`?venue=${noEvents.venue_id}`);
    expect(people()).toBe(Math.round(noEvents.capacity));
    expect(selectedName()).toBe(noEvents.venue_name);
    expect(nameOf(firstRow())).toBe(noEvents.venue_name);
    expect(document.querySelector('#onlyev')?.getAttribute('aria-pressed')).toBe('false');
  });
});
