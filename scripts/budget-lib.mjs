// 量の検査の部品（設計 D-40・D-26）。check-budget.mjs と、テストが使う。ファイルの読み込みは、引数で渡す
import { gzipSync } from 'node:zlib';

/** 最初に読む JS と CSS の、gzip の合計の上限（N-20。バイト） */
export const FIRST_LOAD_LIMIT = 200_000;
/** ファン向けの警告の線（これを超えたら、警告を出す。D-40【仮】） */
export const FAN_WARN_LIMIT = 170_000;
/** 核の WOFF2（MOBO の 2 本 + 見出し書体の 1 本。ファン向けなど画面本体が読む）の合計の上限（バイト。最初の表示を遅らせないための仮の線） */
export const FONT_LIMIT = 400_000;
/** シミュレーターだけが読む追加の WOFF2（*-sim.woff2）の合計の上限（バイト。仮の線） */
export const FONT_SIM_LIMIT = 400_000;
/** シミュレーター用の追加の WOFF2 の名前の末尾 */
const FONT_SIM_SUFFIX = '-sim.woff2';
/** 遅れて読む塊（最初に読む側に入ってはいけない） */
export const LAZY_CHUNKS = ['fan-pages', 'fan-layers'];
/** 最初に読む側に入っていなければならない塊（D-40・I-120。あるときだけ検査する） */
export const EAGER_CHUNKS = ['fan-flow', 'fan-text'];
/** 3 ページ。manifest のキー（HTML の入り口）と、名前 */
export const PAGES = [
  { key: 'index.html', name: '事務所向け（/）' },
  { key: 'fan/index.html', name: 'ファン向け（/fan/）' },
  { key: 'presenter/index.html', name: '発表者用（/presenter/）' },
];

/** 入り口から、静的に import される JS と、その CSS を集める（遅れて読む dynamicImports は含めない） */
export function firstLoadFiles(manifest, entryKey) {
  const seen = new Set();
  const js = new Set();
  const css = new Set();
  const walk = (key) => {
    if (seen.has(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) throw new Error(`manifest に ${key} がありません`);
    if (chunk.file.endsWith('.js')) js.add(chunk.file);
    for (const file of chunk.css ?? []) css.add(file);
    for (const next of chunk.imports ?? []) walk(next);
  };
  walk(entryKey);
  return { js: [...js], css: [...css] };
}

export const gzipBytes = (buffer) => gzipSync(buffer).length;

/**
 * 検査する。manifest は dist/.vite/manifest.json の中身、read(path) は dist からの相対パスで中身（Buffer）を返す、
 * images は scripts/images-config.mjs の一覧、listBundle() は dist/bundle のファイル名の一覧を返す。
 * fonts は dist/fonts の中のファイル（{ name, bytes }）の一覧（無ければ検査しない）。
 * strictImages が真のとき、元絵の形式（jpg・png）のまま配っていることをエラーにする（deploy.yml）。偽のときは警告
 * （ファン向けが WebP に移る前の CI を、赤にしないため）。
 */
export function evaluate({
  manifest,
  read,
  images,
  listBundle,
  searchText,
  fonts = [],
  strictImages = false,
}) {
  const errors = [];
  const warnings = [];
  const report = [];
  for (const page of PAGES) {
    if (!manifest[page.key]) {
      errors.push(`${page.name}: manifest に入り口がありません`);
      continue;
    }
    const { js, css } = firstLoadFiles(manifest, page.key);
    const files = [...js, ...css];
    const gzip = files.reduce((sum, file) => sum + gzipBytes(read(file)), 0);
    report.push({ page: page.name, gzip, files: files.length });
    if (gzip > FIRST_LOAD_LIMIT) {
      errors.push(
        `${page.name}: 最初に読む JS と CSS が gzip で ${gzip} B（上限 ${FIRST_LOAD_LIMIT} B）`,
      );
    } else if (page.key === 'fan/index.html' && gzip > FAN_WARN_LIMIT) {
      warnings.push(
        `${page.name}: 最初に読む JS と CSS が gzip で ${gzip} B（警告の線 ${FAN_WARN_LIMIT} B）`,
      );
    }
    if (page.key === 'fan/index.html') {
      for (const name of LAZY_CHUNKS) {
        if (files.some((file) => file.includes(name))) {
          errors.push(`${page.name}: 遅れて読む塊 ${name} が、最初に読む側に入っています`);
        }
      }
      for (const name of EAGER_CHUNKS) {
        const exists = Object.values(manifest).some((chunk) => chunk.file.includes(name));
        if (exists && !files.some((file) => file.includes(name))) {
          errors.push(
            `${page.name}: 主な流れの塊 ${name} が、最初に読む側に入っていません（D-40・I-120）`,
          );
        }
      }
    }
  }
  // 変換後の絵が、上限以下であること（元絵の拡張子のまま配っていないこと）
  const bundle = listBundle();
  for (const image of images) {
    const stem = image.out.replace(/\.webp$/, '');
    const found = bundle.filter((name) => name.startsWith(`${stem}-`) && name.endsWith('.webp'));
    for (const name of found) {
      const bytes = read(`bundle/${name}`).length;
      if (bytes > image.maxBytes) errors.push(`${name}: ${bytes} B（上限 ${image.maxBytes} B）`);
    }
  }
  for (const name of bundle) {
    if (/\.(jpe?g|png)$/i.test(name)) {
      const message = `${name}: 元絵の形式のまま配っています（npm run images で WebP にします）`;
      (strictImages ? errors : warnings).push(message);
    }
  }
  // 書体: 核の合計と、シミュレーター用の追加の合計を、別の枠で数える。元の otf・ttf は配らない
  const woff2 = fonts.filter((font) => font.name.endsWith('.woff2'));
  const sum = (list) => list.reduce((total, font) => total + font.bytes, 0);
  const sim = woff2.filter((font) => font.name.endsWith(FONT_SIM_SUFFIX));
  const core = woff2.filter((font) => !font.name.endsWith(FONT_SIM_SUFFIX));
  const fontReport = { core: sum(core), sim: sum(sim) };
  if (fontReport.core > FONT_LIMIT) {
    errors.push(`フォント（核の WOFF2）: 合計 ${fontReport.core} B（上限 ${FONT_LIMIT} B）`);
  }
  if (fontReport.sim > FONT_SIM_LIMIT) {
    errors.push(
      `フォント（シミュレーター用の追加の WOFF2）: 合計 ${fontReport.sim} B（上限 ${FONT_SIM_LIMIT} B）`,
    );
  }
  for (const font of fonts) {
    if (/\.(otf|ttf|ttc)$/i.test(font.name)) {
      errors.push(`${font.name}: 元のフォントを配ろうとしています（WOFF2 に絞ったものだけを配る）`);
    }
  }
  // 元絵（assets-src/）を参照していないこと
  if (searchText('assets-src')) errors.push('配るファイルが assets-src/ を参照しています');
  return { errors, warnings, report, fontReport };
}
