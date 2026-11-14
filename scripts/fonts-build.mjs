// 書体 MOBO（本文）と Corporate Logo Rounded（見出し）を絞り直す
// （npm run fonts:build -- --src <MOBO のフォルダ> --display-src <Corporate Logo Rounded のフォルダ>）。
// 画面に出る字を集め（Node）→ 元の OTF から切り出して WOFF2 にし（Python・fonttools）→ 一覧と @font-face を書く（Node）。
// 画面の字が増えたとき（テスト tests/unit/fonts.test.ts が「漏れ」で落ちたとき）にだけ、やり直す。普段は動かさない。
// 詳しい手順・元のフォントの入手先・ライセンスは docs/フォント.md。
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT_LIMIT } from './budget-lib.mjs';
import { ROOT } from './core-lib.mjs';
import {
  DISPLAY_FILE,
  EXTRA_FILES,
  FONT_DIR,
  FONT_FILES,
  GLYPHS_FILE,
  SIMULATOR_CSS,
  collectScreenChars,
  findMissingGlyphs,
  formatGlyphs,
  readWoff2Cmap,
  requestedChars,
  simulatorCss,
} from './fonts-lib.mjs';

const USAGE = `使い方: npm run fonts:build -- --src <MOBO のフォルダ> --display-src <Corporate Logo Rounded のフォルダ>
  --src          MOBO のフォルダ（MOBO-Regular.otf・MOBO-Bold.otf・LICENSE_OFL.txt が入っている所）。環境変数 MOBO_SRC でも渡せる
  --display-src  見出し書体のフォルダ（Corporate-Logo-Rounded-Bold-ver3.otf・SIL_Open_Font_License_1.1.txt が入っている所）。環境変数 CORP_SRC でも渡せる
  --python       使う Python の命令（既定: Mac は python3、Windows は py または python）
要るもの: Python 3.8 以上と fonttools・brotli（python3 -m pip install fonttools brotli）
元のフォントの入手先・手順は docs/フォント.md`;

function parseArgs(argv) {
  const args = {
    src: process.env.MOBO_SRC ?? '',
    displaySrc: process.env.CORP_SRC ?? '',
    python: '',
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') args.src = argv[++i] ?? '';
    else if (argv[i] === '--display-src') args.displaySrc = argv[++i] ?? '';
    else if (argv[i] === '--python') args.python = argv[++i] ?? '';
    else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      console.error(`知らない引数です: ${argv[i]}\n${USAGE}`);
      process.exit(2);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.src === '' || args.displaySrc === '') {
  console.error(
    `--src（MOBO のフォルダ）と --display-src（見出し書体のフォルダ）が要ります。\n${USAGE}`,
  );
  process.exit(2);
}

const { core, extra } = requestedChars(ROOT);
console.log(
  `入れたい字: 核 ${[...core].length} 字・シミュレーターだけの追加 ${[...extra].length} 字`,
);

const work = mkdtempSync(join(tmpdir(), 'oshiyobu-fonts-'));
try {
  const coreFile = join(work, 'core.txt');
  const extraFile = join(work, 'extra.txt');
  const reportFile = join(work, 'report.json');
  writeFileSync(coreFile, core);
  writeFileSync(extraFile, extra);

  const pythons = args.python
    ? [args.python]
    : process.platform === 'win32'
      ? ['py', 'python']
      : ['python3', 'python'];
  const script = fileURLToPath(new URL('./fonts-subset.py', import.meta.url));
  const scriptArgs = [
    script,
    '--src',
    resolve(args.src),
    '--display-src',
    resolve(args.displaySrc),
    '--core-chars',
    coreFile,
    '--extra-chars',
    extraFile,
    '--out',
    join(ROOT, FONT_DIR),
    '--report',
    reportFile,
  ];
  let status = null;
  for (const python of pythons) {
    const result = spawnSync(python, scriptArgs, {
      stdio: 'inherit',
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    });
    if (result.error && result.error.code === 'ENOENT') continue; // この名前の Python は無い。次の名前を試す
    status = result.status;
    break;
  }
  if (status === null) {
    console.error(
      `Python が見つかりません（${pythons.join('・')} を試しました）。Python 3 を入れてください。\n${USAGE}`,
    );
    process.exit(1);
  }
  if (status !== 0) process.exit(status);

  // Python が返した結果から、一覧と @font-face を書く
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const listed = {
    included: new Set([...report.included]),
    extra: new Set([...report.extra]),
    missing: new Set([...report.missing]),
    display: new Set([...report.display]),
    displayMissing: new Set([...report.displayMissing]),
  };
  writeFileSync(join(ROOT, FONT_DIR, GLYPHS_FILE), formatGlyphs(listed));
  writeFileSync(join(ROOT, FONT_DIR, SIMULATOR_CSS), simulatorCss(report.extra));

  // 書いた WOFF2 の中身（cmap）が、一覧と合っていることを、その場で確かめる（テストと同じ見方）
  const problems = [];
  const cmapOf = (name) => readWoff2Cmap(readFileSync(join(ROOT, FONT_DIR, name)));
  for (const name of FONT_FILES) {
    const cmap = cmapOf(name);
    for (const ch of listed.included)
      if (!cmap.has(ch.codePointAt(0))) problems.push(`${name} に「${ch}」がありません`);
  }
  for (const name of EXTRA_FILES) {
    const cmap = cmapOf(name);
    for (const ch of listed.extra)
      if (!cmap.has(ch.codePointAt(0))) problems.push(`${name} に「${ch}」がありません`);
  }
  const displayCmap = cmapOf(DISPLAY_FILE);
  for (const ch of listed.display)
    if (!displayCmap.has(ch.codePointAt(0)))
      problems.push(`${DISPLAY_FILE} に「${ch}」がありません`);
  const stillMissing = findMissingGlyphs(collectScreenChars(ROOT), listed);
  for (const [ch, file] of stillMissing)
    problems.push(`画面の「${ch}」（${file}）が一覧にありません`);
  if (problems.length > 0) {
    console.error(`書き出した WOFF2 と一覧が合いません:\n  ${problems.slice(0, 20).join('\n  ')}`);
    process.exit(1);
  }

  const sizeOf = (names) => names.reduce((sum, name) => sum + (report.sizes[name] ?? 0), 0);
  console.log('');
  console.log(
    `収録した字: 核 ${listed.included.size} 字・追加 ${listed.extra.size} 字・MOBO に無い字 ${listed.missing.size} 字`,
  );
  if (listed.missing.size > 0)
    console.log(`  MOBO に無い字（別の書体で表示される）: ${[...listed.missing].join(' ')}`);
  console.log(
    `見出し書体: ${listed.display.size} 字を収録・見出し書体に無い字 ${listed.displayMissing.size} 字（MOBO で表示される）`,
  );
  if (listed.displayMissing.size > 0)
    console.log(`  見出し書体に無い字: ${[...listed.displayMissing].join(' ')}`);
  for (const [name, bytes] of Object.entries(report.sizes)) console.log(`  ${name}: ${bytes} B`);
  const coreBytes = sizeOf([...FONT_FILES, DISPLAY_FILE]);
  console.log(
    `核の合計（MOBO 2 本 + 見出し書体 1 本）${coreBytes} B（上限 ${FONT_LIMIT} B）・シミュレーター用の追加の合計 ${sizeOf(EXTRA_FILES)} B`,
  );
  if (coreBytes > FONT_LIMIT)
    console.warn(
      '警告: 核の合計が上限を超えています。npm run check:budget が落ちます（docs/フォント.md「大きさの上限」）',
    );
  console.log(
    '次に: npm test（字の漏れの検査）と npm run build・npm run check:budget を通してください',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
