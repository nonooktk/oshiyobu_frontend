// 最初に読む JS と CSS（gzip で 200 KB 以下）と、変換後の絵の大きさを、ビルドの成果物（dist/）で検査する（設計 D-40・D-26）。
//   npm run build の後に、npm run check:budget
// 最初の画面に出る絵の合計（300 KB 以下）は、実ブラウザの通信の記録で測る（e2e/perf.spec.ts。I-87）
import { readdirSync, readFileSync } from 'node:fs';
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

const { errors, warnings, report } = evaluate({
  manifest,
  read,
  images: IMAGES,
  listBundle: () => readdirSync(join(dist, 'bundle')),
  searchText: (needle) =>
    walkText(dist)
      .filter((file) => !file.endsWith('manifest.json'))
      .some((file) => readFileSync(file, 'utf8').includes(needle)),
});

for (const row of report)
  console.log(`${row.page}: 最初に読む JS と CSS ${row.files} 本・gzip ${row.gzip} B`);
for (const warning of warnings) console.warn(`警告: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`エラー: ${error}`);
  console.error('check-budget に失敗しました');
  process.exit(1);
}
console.log('check-budget OK');
