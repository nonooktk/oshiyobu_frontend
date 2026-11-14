// @vitest-environment node
// 事務所向けの実在データの置き場（src/office/data/）は、フォントの字の漏れの検査の対象から外す（統括の決定 2026-11-14）。
// 実在の名前（会場・公演）は漢字の種類が多く、配るフォントに足すと量の上限を超えるため。MOBO に無い字は、端末の書体で出る。
// 確かめること: ① 置き場に、一覧に無い字を入れても、漏れの検査（tests/unit/fonts.test.ts）が落ちない
//             ② 置き場の外に入れたら、いままでどおり漏れとして見つかる
//             ③ 絞る字の集合（npm run fonts:build）にも、置き場の字を入れない
// 本物のリポジトリの置き場には、字を足さない。一時のフォルダに、リポジトリと同じ形の根を作って確かめる。
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';
import {
  FONT_EXCLUDED_DIRS,
  collectScreenChars,
  collectScreenCharsByFile,
  findMissingDisplayGlyphs,
  findMissingGlyphs,
  parseGlyphs,
  requestedChars,
  screenSourceFiles,
} from '../../scripts/fonts-lib.mjs';

/** 一覧（glyphs.txt）に載っていない、珍しい字（実在の名前に出てくる種類） */
const RARE = '驫';
const ASCII_ONLY = parseGlyphs('[収録]\nabc');

const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** リポジトリと同じ形の根を、一時のフォルダに作る（各 HTML の入り口は、字の無い 1 行）。 */
function makeRoot(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'oshiyobu-fonts-'));
  roots.push(root);
  const all: Record<string, string> = {
    'index.html': '<p>a</p>',
    'fan/index.html': '<p>a</p>',
    'presenter/index.html': '<p>a</p>',
    'public/simulator.html': '<p>a</p>',
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    const path = join(root, ...rel.split('/'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}
const withRare = (rel: string): Record<string, string> => ({
  [rel]: `export const name = '${RARE}';\n`,
});

describe('字を集める対象から、実在データの置き場を外す', () => {
  it('外す置き場は src/office/data/ だけ', () => {
    expect(FONT_EXCLUDED_DIRS).toEqual(['src/office/data/']);
  });

  it('置き場（直下・下のフォルダ）のファイルは対象に入らない。置き場の外は、これまでどおり入る', () => {
    const root = makeRoot({
      ...withRare('src/office/data/venues.ts'),
      ...withRare('src/office/data/nested/deep/events.ts'),
      ...withRare('src/office/App.tsx'),
      ...withRare('src/fan/a.ts'),
      ...withRare('src/office/data2/x.ts'), // 名前が似ているだけの別のフォルダは、外さない
      ...withRare('src/office/database.ts'),
    });
    const files = screenSourceFiles(root);
    expect(files.filter((f) => f.startsWith('src/office/data/'))).toEqual([]);
    for (const kept of [
      'src/office/App.tsx',
      'src/fan/a.ts',
      'src/office/data2/x.ts',
      'src/office/database.ts',
    ]) {
      expect(files).toContain(kept);
    }
  });

  it('本物のリポジトリでも、置き場のファイルは 1 本も対象に入らない（置き場には、実際にファイルがある）', () => {
    const files = screenSourceFiles(ROOT);
    expect(files.some((f) => f.startsWith('src/office/'))).toBe(true); // 事務所向けの画面は対象のまま
    expect(files.filter((f) => f.startsWith('src/office/data/'))).toEqual([]);
    // 空振りの防止: 置き場に、実際に .ts がある（外していなければ、対象に入っていたはずのもの）
    expect(readdirSync(join(ROOT, 'src', 'office', 'data')).some((f) => f.endsWith('.ts'))).toBe(
      true,
    );
  });
});

describe('置き場に、一覧に無い字を入れても、漏れの検査は落ちない', () => {
  it('置き場の字は、漏れに出ない', () => {
    const root = makeRoot(withRare('src/office/data/venues.ts'));
    expect(findMissingGlyphs(collectScreenChars(root), ASCII_ONLY).has(RARE)).toBe(false);
    expect(findMissingDisplayGlyphs(collectScreenCharsByFile(root), ASCII_ONLY).has(RARE)).toBe(
      false,
    );
  });

  it('置き場の外（事務所向けの画面・ファン向け・CSS）に入れたら、これまでどおり漏れとして見つかる', () => {
    for (const rel of ['src/office/App.tsx', 'src/fan/a.ts', 'src/office/data2/x.ts']) {
      const root = makeRoot(withRare(rel));
      const missing = findMissingGlyphs(collectScreenChars(root), ASCII_ONLY);
      expect(missing.get(RARE), rel).toBe(rel);
    }
    const css = makeRoot({ 'src/office/office.module.css': `.a::before { content: '${RARE}'; }` });
    expect(findMissingGlyphs(collectScreenChars(css), ASCII_ONLY).has(RARE)).toBe(true);
  });

  it('置き場と外の両方に同じ字があるとき、見つかるのは外のファイル', () => {
    const root = makeRoot({
      ...withRare('src/office/data/venues.ts'),
      ...withRare('src/office/App.tsx'),
    });
    expect(findMissingGlyphs(collectScreenChars(root), ASCII_ONLY).get(RARE)).toBe(
      'src/office/App.tsx',
    );
  });
});

describe('fonts:build が絞る字の集合にも、置き場の字は入れない', () => {
  it('置き場だけにある字は、核にも、追加（シミュレーター用）にも入らない', () => {
    const root = makeRoot(withRare('src/office/data/venues.ts'));
    const { core, extra } = requestedChars(root);
    expect(core).not.toContain(RARE);
    expect(extra).not.toContain(RARE);
  });

  it('置き場の外の字は、これまでどおり核に入る', () => {
    const root = makeRoot(withRare('src/office/App.tsx'));
    expect(requestedChars(root).core).toContain(RARE);
  });
});
