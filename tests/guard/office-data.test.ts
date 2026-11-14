// @vitest-environment node
// G-30: 事務所向け専用のデータ置き場（src/office/data/）の検査。
//   足す実在のデータには、出典の URL と確認した日を付ける。個人の情報を入れない。損益・判定・需要の計算に使わない。
//   ① 置かれたデータの全部に、https:// で始まる出典の URL と、YYYY-MM-DD の確認日がある。公演の会場が、会場の配列にある
//   ② メールアドレス・電話番号の形の文字が無い（データの値と、置き場のファイルの文字）
//   ③ 置き場のファイルが、決めた名前だけである（データの検査が届かないファイルを置かない）
//   ④ src/core/・src/fan/ などが、置き場を読んでいない。計算（view.ts・scatter.ts・store.ts、core の計算の関数を呼ぶ部品）に使っていない
// データが空でも通る。検査の関数は、悪い例（出典なし・日付の形の誤り・個人の情報）を見つけられることを、自分で確かめる。
// 限界: 「画面で、実在のデータと架空の数字の区別が分かる」ことと、出典の URL が実際に開けることは、見つけられない（PR のレビューで見る）。
import { posix } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAST_EVENTS, VENUE_RECORDS } from '../../src/office/data';
import type { PastEvent, VenueRecord } from '../../src/office/data';
import { guardMessage, read, stripComments, walk, withExt } from './helpers';

const DATA_DIR = 'src/office/data';
/** 置き場に置いてよいファイル（これ以外は、データの検査が届かないので、管理者が決める） */
const ALLOWED_FILES = ['README.md', 'events.ts', 'index.ts', 'types.ts', 'venues.ts'];

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
/** 日本の電話番号の形（市外局番 - 局番 - 番号。+81 つき）。区切りのある形だけを見る */
const PHONE = /(?:\+81[-\s]?|(?<![\d-])0)\d{1,4}[-\s]\d{1,4}[-\s]\d{3,4}(?!\d)/;

/** YYYY-MM-DD が、実在する日付か */
function isCalendarDate(text: string): boolean {
  if (!DATE_FORMAT.test(text)) return false;
  const [y, m, d] = text.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** 出典の URL として使えるか（https:// で始まる・ユーザー情報を含まない） */
function isSourceUrl(text: string): boolean {
  if (!text.startsWith('https://')) return false;
  try {
    const url = new URL(text);
    return (
      url.protocol === 'https:' && url.hostname.includes('.') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

/** 個人の情報に見える形が、文字の中にあるか */
const looksPersonal = (text: string): boolean => EMAIL.test(text) || PHONE.test(text);

/** 置かれたデータの問題を集める。today は、確認日が未来でないことを見るための日（YYYY-MM-DD） */
function validateData(
  venues: readonly VenueRecord[],
  events: readonly PastEvent[],
  today: string,
): string[] {
  const problems: string[] = [];
  const limit = new Date(`${today}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000; // 時差の分、1 日だけゆるめる
  const checkedOnProblem = (label: string, value: string): void => {
    if (!isCalendarDate(value))
      problems.push(`${label}: 確認日 ${value} が YYYY-MM-DD の実在の日付でない`);
    else if (new Date(`${value}T00:00:00Z`).getTime() > limit)
      problems.push(`${label}: 確認日 ${value} が未来の日付`);
  };
  const urlProblem = (label: string, value: string): void => {
    if (!isSourceUrl(value))
      problems.push(`${label}: 出典の URL が https:// で始まる公開のページでない（${value}）`);
  };
  const textProblem = (label: string, field: string, value: string | undefined): void => {
    if (value !== undefined && looksPersonal(value))
      problems.push(`${label}: ${field} に、個人の情報に見える形がある`);
  };

  const ids = new Set<string>();
  venues.forEach((venue, index) => {
    const label = `会場 ${index + 1}（${venue.id}）`;
    if (venue.id.trim() === '') problems.push(`${label}: id が空`);
    if (ids.has(venue.id)) problems.push(`${label}: id が重なっている`);
    ids.add(venue.id);
    if (venue.name.trim() === '') problems.push(`${label}: 名前が空`);
    if (!Number.isInteger(venue.capacity) || venue.capacity <= 0)
      problems.push(`${label}: 収容人数が 1 以上の整数でない`);
    if (venue.capacityBasis.trim() === '')
      problems.push(`${label}: 収容人数が何の値か（capacityBasis）が空`);
    urlProblem(label, venue.sourceUrl);
    checkedOnProblem(label, venue.checkedOn);
    for (const [field, value] of [
      ['name', venue.name],
      ['city', venue.city],
      ['capacityBasis', venue.capacityBasis],
      ['type', venue.type],
    ] as const)
      textProblem(label, field, value);
  });
  events.forEach((event, index) => {
    const label = `公演 ${index + 1}（${event.artist} ${event.date}）`;
    if (!ids.has(event.venueId))
      problems.push(`${label}: 会場 ${event.venueId} が、会場の配列にない`);
    if (event.artist.trim() === '') problems.push(`${label}: 出演者が空`);
    if (!isCalendarDate(event.date))
      problems.push(`${label}: 日付 ${event.date} が YYYY-MM-DD の実在の日付でない`);
    urlProblem(label, event.sourceUrl);
    checkedOnProblem(label, event.checkedOn);
    for (const [field, value] of [
      ['artist', event.artist],
      ['title', event.title],
      ['genre', event.genre],
    ] as const)
      textProblem(label, field, value);
  });
  return problems;
}

const today = new Date().toISOString().slice(0, 10);

describe('G-30: 置かれた実在のデータ（出典の URL・確認日・個人の情報）', () => {
  it('全部の会場・公演に、https:// の出典の URL と、実在する YYYY-MM-DD の確認日がある。個人の情報に見える形が無い（データが空でも通る）', () => {
    const problems = validateData(VENUE_RECORDS, PAST_EVENTS, today);
    // データの行の問題は、担当者が直せる（出典の URL と確認日を付ける・個人の情報を外す）。決まりそのものを変えたいときだけ、管理者へ
    expect(
      problems,
      '【G-30 に反しています】置かれた実在のデータに、出典・確認日・個人の情報の決まりに反する行があります。' +
        '該当の行に、出典の URL と確認日を付ける、または個人の情報を外してください（出典を確かめられない行は、外す）。' +
        '決まりそのものを変えたいときは、変えずに、管理者（統括）へ相談してください（docs/守ること.md の G-30）。',
    ).toEqual([]);
  });

  it('この検査は、悪い例（出典なし・http・日付の誤り・未来の日付・個人の情報・会場のない公演）を見つけられる（見張りが働いている）', () => {
    const venue: VenueRecord = {
      id: 'T-1',
      name: '試験の会場',
      pref: '福岡県',
      city: '福岡市',
      capacity: 100,
      capacityBasis: '公式の値',
      type: 'ホール',
      sourceUrl: 'https://example.com/a',
      checkedOn: '2026-11-14',
    };
    const event: PastEvent = {
      venueId: 'T-1',
      artist: '試験の団体',
      date: '2026-10-01',
      sourceUrl: 'https://example.com/b',
      checkedOn: '2026-11-14',
    };
    // 良い例は、問題なし
    expect(validateData([venue], [event], '2026-11-15')).toEqual([]);
    // 悪い例は、1 つずつ見つかる
    const bad = (v: Partial<VenueRecord>, e: Partial<PastEvent> = {}): string[] =>
      validateData([{ ...venue, ...v }], [{ ...event, ...e }], '2026-11-15');
    expect(bad({ sourceUrl: '' })).toHaveLength(1);
    expect(bad({ sourceUrl: 'http://example.com/a' })).toHaveLength(1);
    expect(bad({ sourceUrl: 'https://user:pass@example.com/a' })).toHaveLength(1);
    expect(bad({ checkedOn: '' })).toHaveLength(1);
    expect(bad({ checkedOn: '2026/11/14' })).toHaveLength(1);
    expect(bad({ checkedOn: '2026-02-30' })).toHaveLength(1);
    expect(bad({ checkedOn: '2027-01-01' })).toHaveLength(1);
    expect(bad({ name: '連絡は info@example.com' })).toHaveLength(1);
    expect(bad({ capacityBasis: '電話 092-123-4567' })).toHaveLength(1);
    expect(bad({}, { artist: '連絡先 090-1234-5678' })).toHaveLength(1);
    expect(bad({}, { sourceUrl: '' })).toHaveLength(1);
    expect(bad({}, { date: '10/01' })).toHaveLength(1);
    expect(bad({}, { venueId: 'ない会場' })).toHaveLength(1);
    expect(bad({ capacity: 0 })).toHaveLength(1);
    // 出典の URL の中の数字の並びは、電話番号とは見なさない
    expect(bad({ sourceUrl: 'https://example.com/2026-11-14/092-123-4567' })).toEqual([]);
  });
});

describe('G-30: 置き場のファイルと、読み込みの決まり', () => {
  const dataFiles = walk(DATA_DIR);
  const sources = withExt(walk('src'), ['.ts', '.tsx']).filter(
    (path) => !path.startsWith(`${DATA_DIR}/`),
  );

  it('置き場のファイルが、決めた 5 つだけ（検査が届かないファイルを置かない。足したいときは管理者へ）', () => {
    const names = dataFiles.map((path) => path.slice(DATA_DIR.length + 1)).sort();
    expect(
      names,
      guardMessage(
        'G-30',
        `src/office/data/ のファイルが、決めた 5 つ（${ALLOWED_FILES.join('・')}）と違います（データの検査が届かないファイルは置かない）`,
      ),
    ).toEqual(ALLOWED_FILES);
  });

  it('置き場のファイルの文字に、メールアドレス・電話番号の形が無い', () => {
    const hits = dataFiles.filter((path) => looksPersonal(read(path)));
    expect(
      hits,
      guardMessage(
        'G-30',
        '置き場のファイルに、個人の情報に見える形（メールアドレス・電話番号）があります',
      ),
    ).toEqual([]);
  });

  it('置き場のファイルは、core を型だけで読む（計算の関数・データを読まない）', () => {
    const hits = withExt(dataFiles, ['.ts'])
      .filter((path) => coreValueImports(stripComments(read(path))).length > 0)
      .map((path) => path);
    expect(
      hits,
      guardMessage('G-30', '置き場のファイルが、core の値を読んでいます（型だけにする）'),
    ).toEqual([]);
  });

  it('検査の対象が見つかっている（空振りしていない）', () => {
    expect(sources.length).toBeGreaterThan(50);
    expect(sources).toContain('src/office/view.ts');
    expect(sources).toContain('src/office/scatter.ts');
    expect(sources).toContain('src/office/store.ts');
    expect(sources).toContain('src/fan/domain/view.ts');
    expect(sources.some((path) => path.startsWith('src/core/'))).toBe(true);
  });

  it('src/core/・src/fan/・src/shared/・src/presenter/ が、置き場を読んでいない', () => {
    const hits = sources
      .filter((path) => /^src\/(core|fan|shared|presenter)\//.test(path))
      .filter((path) => importsOfficeData(path, stripComments(read(path))));
    expect(
      hits,
      guardMessage('G-30', '事務所向けのデータ置き場を、事務所向けの画面の外が読んでいます'),
    ).toEqual([]);
  });

  it('計算（view.ts・scatter.ts・store.ts）が、置き場を読んでいない', () => {
    const hits = ['src/office/view.ts', 'src/office/scatter.ts', 'src/office/store.ts'].filter(
      (path) => importsOfficeData(path, stripComments(read(path))),
    );
    expect(
      hits,
      guardMessage(
        'G-30',
        '損益・判定・需要の計算に、実在のデータを使っています（表示にだけ使う）',
      ),
    ).toEqual([]);
  });

  it('置き場を読む部品が、core の計算の関数を呼んでいない（表示にだけ使う）', () => {
    const calc = calcNames();
    expect(calc.length, 'core の計算の関数の一覧を読めていません').toBeGreaterThan(10);
    const hits = sources
      .filter((path) => path.startsWith('src/office/'))
      .map((path) => ({ path, text: stripComments(read(path)) }))
      .filter(({ path, text }) => importsOfficeData(path, text))
      .flatMap(({ path, text }) =>
        coreValueImports(text)
          .filter((name) => calc.includes(name))
          .map((name) => `${path}: ${name}`),
      );
    expect(
      hits,
      guardMessage(
        'G-30',
        '置き場のデータを読む部品が、core の計算の関数を呼んでいます（計算と表示を、別の部品に分ける）',
      ),
    ).toEqual([]);
  });

  it('この検査は、置き場の読み込みと、core の値の読み込みを見つけられる（見張りが働いている）', () => {
    const office = 'src/office/components/Venues.tsx';
    expect(importsOfficeData(office, "import { VENUE_RECORDS } from '../data';")).toBe(true);
    expect(importsOfficeData(office, "import { VENUE_RECORDS } from '../data/venues';")).toBe(true);
    expect(importsOfficeData('src/fan/a.ts', "import { x } from '../office/data';")).toBe(true);
    expect(importsOfficeData(office, "const m = await import('../data');")).toBe(true);
    expect(importsOfficeData(office, "import { x } from '../metadata';")).toBe(false);
    // core の中の ./data は、core 自身のデータで、置き場ではない
    expect(importsOfficeData('src/core/index.ts', "export { COST } from './data/costs';")).toBe(
      false,
    );
    expect(importsOfficeData('src/office/view.ts', "import { x } from './data';")).toBe(true);
    expect(coreValueImports("import { conditionOf, type Condition } from '../../core';")).toEqual([
      'conditionOf',
    ]);
    expect(coreValueImports("import type { Condition } from '../../core';")).toEqual([]);
    expect(coreValueImports("import { supportStatus as s } from '../core';")).toEqual([
      'supportStatus',
    ]);
    expect(coreValueImports("import { displayedCount } from '../../core/calc/meter';")).toEqual([
      'displayedCount',
    ]);
  });
});

/**
 * このファイルの文字（ソース）が、事務所向けのデータ置き場（src/office/data/）を読んでいるか。
 * 読み込みの相対パスを、ファイルの場所から解いて、置き場の中かを見る（core の中の ./data は、core 自身のデータ）。
 */
function importsOfficeData(path: string, text: string): boolean {
  const specs = [...text.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)].map(
    (match) => match[1] ?? '',
  );
  return specs.some((spec) => {
    if (!spec.startsWith('.')) return false;
    const target = posix.normalize(posix.join(posix.dirname(path), spec));
    return target === DATA_DIR || target.startsWith(`${DATA_DIR}/`);
  });
}

/** この文字（ソース）が、core から、型でなく値として読んでいる名前（import type と、type つきの名前は除く） */
function coreValueImports(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(
    /import\s+(?!type\b)\{([^}]*)\}\s*from\s*['"][^'"]*\/core(?:\/[^'"]*)?['"]/g,
  )) {
    for (const part of (match[1] ?? '').split(',')) {
      const item = part.trim();
      if (item === '' || /^type\s/.test(item)) continue;
      names.push((item.split(/\s+as\s+/)[0] ?? '').trim());
    }
  }
  return names;
}

/** core が公開している計算の関数の名前（src/core/index.ts の ./calc/ からの export） */
function calcNames(): string[] {
  const index = read('src/core/index.ts');
  const names: string[] = [];
  for (const match of index.matchAll(/export\s*\{([^}]*)\}\s*from\s*'\.\/calc\/[^']+'/g)) {
    for (const part of (match[1] ?? '').split(',')) {
      const name = part.trim();
      if (name !== '') names.push(name);
    }
  }
  return names;
}
