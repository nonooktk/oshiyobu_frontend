// 最初に読む JS と CSS（gzip で 200 KB 以下）と、変換後の絵の大きさを、ビルドの成果物（dist/）で検査する（設計 D-40・D-26）。
//   npm run build の後に、npm run check:budget
//   --strict-images: 元絵の形式（jpg・png）のまま配っていたら、エラーにする（deploy.yml と npm run verify〈CI も呼ぶ〉が付ける。単独で実行するときは警告だけ）
// 書体（dist/fonts/）: 核の WOFF2 の合計と、シミュレーター用の追加の合計を、別の枠で検査する（budget-lib.mjs の FONT_LIMIT・FONT_SIM_LIMIT）
// 最初の画面に出る絵の合計（300 KB 以下）は、実ブラウザの通信の記録で測る（e2e/perf.spec.ts。I-87）
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './core-lib.mjs';
import { evaluate } from './budget-lib.mjs';
import { IMAGES } from './images-config.mjs';

const dist = join(ROOT, process.env.DIST_DIR ?? 'dist');
const read = (path) => readFileSync(join(dist, path));
const manifest = JSON.parse(read('.vite/manifest.json').toString('utf8'));
const walkText = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walkText(join(dir, entry.name))
      : /\.(js|css|html|json)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

// dist/fonts の中身（無ければ空。フォントを置かない版でも動く）
const fontDir = join(dist, 'fonts');
const fonts = existsSync(fontDir)
  ? readdirSync(fontDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => ({ name: entry.name, bytes: readFileSync(join(fontDir, entry.name)).length }))
  : [];

const { errors, warnings, report, fontReport } = evaluate({
  strictImages:
    process.argv.includes('--strict-images') || process.env.BUDGET_STRICT_IMAGES === '1',
  manifest,
  read,
  fonts,
  images: IMAGES,
  listBundle: () => readdirSync(join(dist, 'bundle')),
  searchText: (needle) =>
    walkText(dist)
      .filter((file) => !file.endsWith('manifest.json'))
      .some((file) => readFileSync(file, 'utf8').includes(needle)),
});

for (const row of report)
  console.log(`${row.page}: 最初に読む JS と CSS ${row.files} 本・gzip ${row.gzip} B`);
if (fonts.length > 0) {
  console.log(
    `書体（WOFF2）: 核 ${fontReport.core} B（全ページ）・シミュレーター用の追加 ${fontReport.sim} B`,
  );
}
for (const warning of warnings) console.warn(`警告: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`エラー: ${error}`);
  console.error('check-budget に失敗しました');
  process.exit(1);
}
console.log('check-budget OK');
