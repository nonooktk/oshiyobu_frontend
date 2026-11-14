// @vitest-environment node
// 量の検査（check-budget。設計 D-40・I-91・I-92・I-120）。作り物の manifest で、検査が効くことを確かめる
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  FIRST_LOAD_LIMIT,
  FONT_LIMIT,
  FONT_SIM_LIMIT,
  evaluate,
  firstLoadFiles,
} from '../../scripts/budget-lib.mjs';

type Chunk = { file: string; imports?: string[]; dynamicImports?: string[]; css?: string[] };
const manifest = (over: Record<string, Chunk> = {}): Record<string, Chunk> => ({
  'index.html': { file: 'bundle/office.js', imports: ['_vendor.js'], css: ['bundle/office.css'] },
  'fan/index.html': { file: 'bundle/fan.js', imports: ['_vendor.js'], dynamicImports: ['lazy.js'] },
  'presenter/index.html': { file: 'bundle/presenter.js', imports: ['_vendor.js'] },
  '_vendor.js': { file: 'bundle/vendor.js' },
  'lazy.js': { file: 'bundle/fan-pages-x.js' },
  ...over,
});
const files =
  (sizes: Record<string, number>) =>
  (path: string): Buffer => {
    const size = sizes[path] ?? 100;
    return randomBytes(size); // 圧縮されにくい中身。gzip 後も、ほぼ同じ大きさ
  };
const run = (
  m: ReturnType<typeof manifest>,
  sizes: Record<string, number> = {},
  bundle: string[] = [],
  strictImages = true,
) =>
  evaluate({
    strictImages,
    manifest: m,
    read: files(sizes),
    images: [{ out: 'big-768.webp', maxBytes: 1000 }],
    listBundle: () => bundle,
    searchText: () => false,
  });

describe('check-budget', () => {
  it('最初に読む側だけを数える（遅れて読む塊は数えない）', () => {
    const { js } = firstLoadFiles(manifest(), 'fan/index.html');
    expect(js).toEqual(['bundle/fan.js', 'bundle/vendor.js']);
  });

  it('上限（gzip で 200 KB）以下なら通る。超えたらエラーにする', () => {
    expect(run(manifest(), { 'bundle/vendor.js': 150_000 }).errors).toEqual([]);
    const over = run(manifest(), { 'bundle/vendor.js': FIRST_LOAD_LIMIT + 5_000 });
    expect(over.errors.length).toBe(3);
    expect(over.errors[0]).toContain('上限');
  });

  it('ファン向けが 170 KB を超えたら、警告を出す（エラーにはしない）', () => {
    const result = run(manifest(), { 'bundle/vendor.js': 175_000 });
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('ファン向け'))).toBe(true);
  });

  it('遅れて読む塊（fan-pages）が最初に読む側に入っていたら、エラー', () => {
    const bad = manifest({ 'fan/index.html': { file: 'bundle/fan.js', imports: ['lazy.js'] } });
    expect(run(bad).errors.some((error) => error.includes('fan-pages'))).toBe(true);
  });

  it('主な流れの塊（fan-flow）があるのに、最初に読む側に入っていなければ、エラー', () => {
    const bad = manifest({ 'flow.js': { file: 'bundle/fan-flow-x.js' } });
    expect(run(bad).errors.some((error) => error.includes('fan-flow'))).toBe(true);
    const good = manifest({
      'flow.js': { file: 'bundle/fan-flow-x.js' },
      'fan/index.html': { file: 'bundle/fan.js', imports: ['_vendor.js', 'flow.js'] },
    });
    expect(run(good).errors).toEqual([]);
  });

  it('変換後の絵が上限を超えたら、エラー。元絵の形式（jpg・png）のまま配っても、エラー', () => {
    const big = run(manifest(), { 'bundle/big-768-abc.webp': 2000 }, ['big-768-abc.webp']);
    expect(big.errors.some((error) => error.includes('big-768-abc.webp'))).toBe(true);
    const raw = run(manifest(), {}, ['photo-abc.jpg']);
    expect(raw.errors.some((error) => error.includes('元絵'))).toBe(true);
  });

  it('元絵の形式のまま配っていても、strictImages でなければ（CI）、警告にとどめる', () => {
    const result = run(manifest(), {}, ['photo-abc.jpg'], false);
    expect(result.errors).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('元絵'))).toBe(true);
  });

  it('assets-src を参照していたら、エラー', () => {
    const result = evaluate({
      manifest: manifest(),
      read: files({}),
      images: [],
      listBundle: () => [],
      searchText: (needle) => needle === 'assets-src',
    });
    expect(result.errors.some((error) => error.includes('assets-src'))).toBe(true);
  });
});

// フォント（dist/fonts/）の量。核（全ページが読む 2 本）と、シミュレーター用の追加（*-sim.woff2）を、別の枠で数える
describe('check-budget: フォント', () => {
  const runFonts = (fonts: { name: string; bytes: number }[]) =>
    evaluate({
      manifest: manifest(),
      read: files({}),
      images: [],
      listBundle: () => [],
      searchText: () => false,
      fonts,
    });

  it('核の WOFF2（MOBO 2 本 + 見出し書体 1 本）の合計が上限（400,000 B）以下なら通る。超えたらエラー', () => {
    expect(FONT_LIMIT).toBe(400_000);
    const ok = runFonts([
      { name: 'MOBO-Regular.woff2', bytes: 120_000 },
      { name: 'MOBO-Bold.woff2', bytes: 130_000 },
      { name: 'Corporate-Logo-Rounded-Bold-ver3.woff2', bytes: 150_000 },
    ]);
    expect(ok.errors).toEqual([]);
    const over = runFonts([
      { name: 'MOBO-Regular.woff2', bytes: 120_000 },
      { name: 'MOBO-Bold.woff2', bytes: 130_000 },
      { name: 'Corporate-Logo-Rounded-Bold-ver3.woff2', bytes: 150_001 },
    ]);
    expect(over.errors).toHaveLength(1);
    expect(over.errors[0]).toContain('400000');
  });

  it('シミュレーター用の追加（-sim.woff2）は、核の枠に入れず、別の枠で数える', () => {
    const fonts = [
      { name: 'MOBO-Regular.woff2', bytes: 100_000 },
      { name: 'MOBO-Bold.woff2', bytes: 100_000 },
      { name: 'MOBO-Regular-sim.woff2', bytes: 150_000 },
      { name: 'MOBO-Bold-sim.woff2', bytes: 150_000 },
    ];
    expect(runFonts(fonts).errors).toEqual([]);
    const over = runFonts([...fonts, { name: 'MOBO-Bold-sim.woff2', bytes: FONT_SIM_LIMIT }]);
    expect(over.errors.some((error) => error.includes('シミュレーター'))).toBe(true);
  });

  it('元のフォント（otf・ttf）を配ろうとしていたら、エラー（合計が小さくても）', () => {
    const result = runFonts([{ name: 'MOBO-Regular.otf', bytes: 10 }]);
    expect(result.errors.some((error) => error.includes('MOBO-Regular.otf'))).toBe(true);
  });

  it('フォントを置いていなくても（fonts を渡さなくても）、他の検査は今までどおり', () => {
    expect(runFonts([]).errors).toEqual([]);
  });
});
