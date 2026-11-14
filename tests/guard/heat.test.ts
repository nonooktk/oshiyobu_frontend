// @vitest-environment node
// 開催熱量まわりの検査。
//   G-08: ファン向けに、人数・最低人数・残りの人数・達成率の数字・目標の金額を出さない（ソースの文字列を見る）
//   G-29: 熱量の段階の名前・境目・曲線・距離のことばを、src/fan/domain/heat.ts の 1 か所で決める
// 画面を巡回して、実際に出る文と読み上げ用の属性を見る検査は、tests/integration/fan/no-numbers.test.tsx（G-08）。
// こちらは、巡回で届かない場面（新しい画面・まれな状態）に、数字を言う語が書かれていないかを、コードで見る。
// 範囲: src/fan/ の ts・tsx（コメントは除く）。事務所向け・発表者用は、数字で判断する画面なので対象外。
// 限界: 語の形で見つける。言い換え（「あと十人」など）と、出してよい数字（自分が払うコースの金額・預金・席数・日付・n/3・1 / 3）の
//   取り違えは見つけられない（巡回の検査と、PR のレビューで見る）。
// 起動条件: 検査の対象が見つかり、中身を読めていること（0 件で通る空振りの防止）。
import { describe, expect, it } from 'vitest';
import { guardMessage, read, stripComments, walk, withExt } from './helpers';

const files = withExt(walk('src/fan'), ['.ts', '.tsx']);
const code = files.map((path) => ({ path, text: stripComments(read(path)) }));

/** ファン向けのコードに書かない語（G-08）。人数・割合・金額の目標を言う語 */
const NUMBER_WORDS = ['最低人数', '達成率', '到達ライン', '目標の金額', '支援者'];
/** 「数字 + 人」（テンプレートの `${n}人` を含む）。「人物」は人数ではないので除く */
const NUMBER_PEOPLE = /[0-9０-９}]\s*人(?!物)/;

const hitsOf = (test: (text: string) => boolean): string[] =>
  code.filter(({ text }) => test(text)).map(({ path }) => path);

describe('G-08: ファン向けのソースに、人数・達成率・目標の金額を言う語が無い', () => {
  it('検査の対象が見つかり、中身を読めている（空振りしていない）', () => {
    const paths = code.map(({ path }) => path);
    expect(paths).toContain('src/fan/domain/heat.ts');
    expect(paths).toContain('src/fan/domain/view.ts');
    expect(paths).toContain('src/fan/store/store.ts');
    expect(paths).toContain('src/fan/text/voices.ts');
    expect(paths.length).toBeGreaterThan(30);
    expect(code.filter(({ text }) => text.length === 0).map(({ path }) => path)).toEqual([]);
  });

  it.each(NUMBER_WORDS)('「%s」が、ファン向けのコードに 0 件', (word) => {
    expect(
      hitsOf((text) => text.includes(word)),
      guardMessage(
        'G-08',
        `ファン向けに「${word}」と書いています（人数・達成率・目標の金額は出さない。開催熱量で見せる）`,
      ),
    ).toEqual([]);
  });

  it('「数字 + 人」（あと 5 人・75 人 など）が、ファン向けのコードに 0 件', () => {
    expect(
      hitsOf((text) => NUMBER_PEOPLE.test(text)),
      guardMessage('G-08', 'ファン向けに「数字 + 人」と書いています（人数は出さない）'),
    ).toEqual([]);
  });

  it('この検査は、数字を言う語を見つけられる（見張りが働いている）', () => {
    for (const sample of ['あと5人', 'あと ${left}人', '75人', '１８人', '${n} 人']) {
      expect(NUMBER_PEOPLE.test(sample), sample).toBe(true);
    }
    for (const sample of ['人物 4', '${no}人物', '特典 1/3', '7,000円', 'あと 10,000円']) {
      expect(NUMBER_PEOPLE.test(sample), sample).toBe(false);
    }
    expect(NUMBER_WORDS.filter((word) => '達成率 80% 最低人数'.includes(word))).toEqual([
      '最低人数',
      '達成率',
    ]);
  });
});

describe('G-29: 熱量の定義は src/fan/domain/heat.ts の 1 か所', () => {
  const DEFINITIONS =
    /\b(?:const|let|var)\s+(STAGE_BOUNDS|STAGE_NAMES|DISTANCE_WORDS|HEAT_EXPONENT)\b/;

  it('境目・名前・ことば・曲線の定義が、heat.ts にあり、ほかのファイルに無い', () => {
    const message = guardMessage(
      'G-29',
      '熱量の境目・名前・ことば・曲線は src/fan/domain/heat.ts の 1 か所で決める（ほかの場所で作り直さない）',
    );
    const heat = code.find(({ path }) => path === 'src/fan/domain/heat.ts');
    expect(heat, message).toBeDefined();
    for (const name of ['STAGE_BOUNDS', 'STAGE_NAMES', 'DISTANCE_WORDS', 'HEAT_EXPONENT']) {
      expect(heat?.text, `${name} が heat.ts にありません。${message}`).toMatch(
        new RegExp(`\\bexport const ${name}\\b`),
      );
    }
    const elsewhere = code
      .filter(({ path }) => path !== 'src/fan/domain/heat.ts')
      .filter(({ text }) => DEFINITIONS.test(text))
      .map(({ path }) => path);
    expect(elsewhere, message).toEqual([]);
  });

  it('この検査は、定義の作り直しを見つけられる（見張りが働いている）', () => {
    expect(DEFINITIONS.test('const STAGE_BOUNDS = [0.4, 0.6, 0.9];')).toBe(true);
    expect(DEFINITIONS.test('import { STAGE_BOUNDS } from "./heat";')).toBe(false);
  });
});
