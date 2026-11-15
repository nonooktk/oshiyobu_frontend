// @vitest-environment node
// 量の検査（check-budget）のうち、音源ファイル（dist/sounds/。G-04）の上限。1 本 60 KB・合計 180 KB（3 場面 × 60 KB）。
// 作り物の manifest で、検査が効くことを確かめる（最初に読む量の検査は budget.test.ts）。
import { describe, expect, it } from 'vitest';
import { SOUND_FILE_LIMIT, SOUND_LIMIT, evaluate } from '../../scripts/budget-lib.mjs';

type Chunk = { file: string; imports?: string[]; css?: string[] };
const manifest: Record<string, Chunk> = {
  'index.html': { file: 'bundle/office.js' },
  'fan/index.html': { file: 'bundle/fan.js' },
  'presenter/index.html': { file: 'bundle/presenter.js' },
};
const run = (sounds?: { name: string; bytes: number }[]) =>
  evaluate({
    manifest,
    read: () => Buffer.alloc(100),
    images: [],
    listBundle: () => [],
    searchText: () => false,
    ...(sounds ? { sounds } : {}),
  });

describe('check-budget: 音源ファイル', () => {
  it('上限は、1 本 60 KB・合計 180 KB', () => {
    expect(SOUND_FILE_LIMIT).toBe(60_000);
    expect(SOUND_LIMIT).toBe(180_000);
  });

  it('音源を置いていない版でも動く（無ければ、検査しない）', () => {
    const result = run();
    expect(result.errors).toEqual([]);
    expect(result.soundReport).toEqual({ files: 0, total: 0 });
  });

  it('1 本が 60 KB 以下なら通る。超えたら、ファイル名を挙げてエラーにする', () => {
    expect(run([{ name: 'A-join.mp3', bytes: SOUND_FILE_LIMIT }]).errors).toEqual([]);
    const over = run([{ name: 'A-join.mp3', bytes: SOUND_FILE_LIMIT + 1 }]);
    expect(over.errors).toHaveLength(1);
    expect(over.errors[0]).toContain('A-join.mp3');
    expect(over.errors[0]).toContain(String(SOUND_FILE_LIMIT));
  });

  it('合計が 180 KB 以下なら通る。超えたら、エラーにする（1 本ずつは上限以下でも）', () => {
    const three = ['A-join.mp3', 'B-friend.mp3', 'C-fever.mp3'].map((name) => ({
      name,
      bytes: SOUND_FILE_LIMIT,
    }));
    expect(run(three).errors).toEqual([]);
    expect(run(three).soundReport).toEqual({ files: 3, total: 180_000 });
    const four = [...three, { name: 'D-extra.mp3', bytes: 1_000 }];
    const result = run(four);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('合計');
  });
});
