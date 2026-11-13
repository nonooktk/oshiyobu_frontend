// 量の検査の部品（設計 D-40・D-26）。check-budget.mjs と、テストが使う。ファイルの読み込みは、引数で渡す
import { gzipSync } from 'node:zlib';

/** 最初に読む JS と CSS の、gzip の合計の上限（N-20。バイト） */
export const FIRST_LOAD_LIMIT = 200_000;
/** ファン向けの警告の線（これを超えたら、警告を出す。D-40【仮】） */
export const FAN_WARN_LIMIT = 170_000;
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
 * strictImages が真のとき、元絵の形式（jpg・png）のまま配っていることをエラーにする（deploy.yml）。偽のときは警告
 * （ファン向けが WebP に移る前の CI を、赤にしないため）。
 */
export function evaluate({ manifest, read, images, listBundle, searchText, strictImages = false }) {
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
  // 元絵（assets-src/）を参照していないこと
  if (searchText('assets-src')) errors.push('配るファイルが assets-src/ を参照しています');
  return { errors, warnings, report };
}
