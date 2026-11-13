// @vitest-environment node
// core の写し（src/core/）と core.lock.json（設計 D-07・I-109）
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '../../src/core';
import { CORE_DIR, readCoreVersion, readLock, treeSha256 } from '../../scripts/core-lib.mjs';

function makeTree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'core-test-'));
  for (const [path, text] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  }
  return dir;
}

describe('core.lock.json と src/core/ の照合', () => {
  it('src/core/ が lock の treeSha256 と一致する（手で直していない）', () => {
    expect(treeSha256(CORE_DIR)).toBe(readLock().treeSha256);
  });

  it('lock の coreVersion が、src/core/version.ts の版と一致する', () => {
    expect(readLock().coreVersion).toBe(readCoreVersion(CORE_DIR));
    expect(readLock().coreVersion).toBe(CORE_VERSION);
  });
});

describe('ハッシュの決め方', () => {
  const files = { 'a.ts': 'export const a = 1;\nexport const b = 2;\n', 'calc/c.ts': 'x\n' };

  it('1 文字変えると、ハッシュが変わる', () => {
    const changed = { ...files, 'a.ts': 'export const a = 2;\nexport const b = 2;\n' };
    expect(treeSha256(makeTree(changed))).not.toBe(treeSha256(makeTree(files)));
  });

  it('ファイルの名前（パス）が変わっても、ハッシュが変わる', () => {
    const renamed = { 'a2.ts': files['a.ts'], 'calc/c.ts': files['calc/c.ts'] };
    expect(treeSha256(makeTree(renamed))).not.toBe(treeSha256(makeTree(files)));
  });

  it('Windows の改行（CRLF）でも、同じハッシュ', () => {
    const crlf = Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, v.replace(/\n/g, '\r\n')]),
    );
    expect(treeSha256(makeTree(crlf))).toBe(treeSha256(makeTree(files)));
  });

  it('src/core/README.md（core:sync が置く説明）は、ハッシュに入れない', () => {
    expect(treeSha256(makeTree({ ...files, 'README.md': '説明' }))).toBe(
      treeSha256(makeTree(files)),
    );
  });

  it('ファイルを書く順が違っても、同じハッシュ（パスの順に並べて計算する）', () => {
    const reversed = Object.fromEntries(Object.entries(files).reverse());
    expect(treeSha256(makeTree(reversed))).toBe(treeSha256(makeTree(files)));
  });
});
