// 書体 MOBO（本文）と Corporate Logo Rounded（見出し）の、絞った WOFF2 の共通部品。fonts-build.mjs（絞り直し）と、テスト（tests/unit/fonts.test.ts）が使う。
// Node の標準と、すでに入っている typescript だけで動く（Python は要らない）。
//   ① 画面に出る字を、ソース（src/・各 HTML）から集める（コメントは数えない）
//   ② 収録した字の一覧（public/fonts/glyphs.txt）を読み書きし、漏れを見つける
//   ③ 配る WOFF2 の中身（cmap）を読み、一覧と食い違っていないか確かめられるようにする
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliDecompressSync } from 'node:zlib';
import ts from 'typescript';

/** 配るフォントの置き場（リポジトリの根からの相対パス） */
export const FONT_DIR = 'public/fonts';
/** 核の WOFF2（400 と 700 の 2 本）。3 ページ（/・/fan/・/presenter/）とシミュレーターが読む */
export const FONT_FILES = ['MOBO-Regular.woff2', 'MOBO-Bold.woff2'];
/** 追加の WOFF2（400 と 700）。シミュレーターだけが使う字（会場の名前の漢字など）。その字が出たときだけ読み込まれる */
export const EXTRA_FILES = ['MOBO-Regular-sim.woff2', 'MOBO-Bold-sim.woff2'];
/**
 * 推し・応援の熱が出る所（ファン向けの一部）だけに当てる書体 Corporate Logo Rounded Bold ver3（LOGOTYPE.JP）の WOFF2。
 * 太さは 700 の 1 本だけ。当てる範囲が変わっても漏れが出ないよう、字は核（本文と同じ字の集合）に絞る
 */
export const DISPLAY_FILE = 'Corporate-Logo-Rounded-Bold-ver3.woff2';
/** 見出し書体の CSS の family 名（書体の正式な名前のまま。別の名前に変えない） */
export const DISPLAY_FAMILY = 'Corporate Logo Rounded Bold ver3';
export const GLYPHS_FILE = 'glyphs.txt';
/** 書体ごとのライセンス文（どちらも SIL Open Font License 1.1。名前がぶつからないよう、書体ごとに分ける） */
export const LICENSE_FILES = ['LICENSE_OFL_MOBO.txt', 'LICENSE_OFL_Corporate-Logo-Rounded.txt'];
/** シミュレーター用の @font-face（fonts:build が書く。追加の 2 本の unicode-range を持つ） */
export const SIMULATOR_CSS = 'simulator.css';

/** 収支シミュレーター（班の方の道具。画面本体とは別のページ） */
export const SIMULATOR_FILE = 'public/simulator.html';
/** 画面の字を集める、HTML の入り口（src/ の外にあるもの） */
const HTML_FILES = ['index.html', 'fan/index.html', 'presenter/index.html', SIMULATOR_FILE];

const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join('');

/**
 * 画面に出る字が見つからなくても、いつも入れる字。
 * ASCII・ひらがな・カタカナの全字（ソースに無い字を、あとから足すときの漏れを減らす）と、
 * 日付や曜日を、コードで組み立てて出すときの字。
 */
export const BASE_CHARS = [
  range(0x20, 0x7e), // ASCII（数字・英字・記号）
  range(0x3041, 0x3096), // ひらがな
  range(0x309b, 0x309e), // ゛゜ゝゞ
  range(0x30a1, 0x30fa), // カタカナ
  range(0x30fc, 0x30fe), // ー ヽ ヾ
  '　・、。〃々〆〇〈〉《》「」『』【】〒〔〕〜', // 全角の空白と、よく使う記号
  '‐‑–—―‘’“”•‥…※×÷±°·', // 句読点まわり
  '日月火水木金土年時分秒円人万千百億午前後', // 日付・時刻・金額を組み立てて出すとき
].join('');

// ---------- ① 画面の字を集める ----------

/** 字形を持たない文字（空白・制御文字・幅 0 の文字・異体字選択）は集めない */
const isBlank = (ch) => {
  const cp = ch.codePointAt(0) ?? 0;
  return (
    cp < 0x20 ||
    (cp >= 0x7f && cp <= 0x9f) ||
    (cp >= 0x200b && cp <= 0x200f) || // 幅 0 の空白・結合子・向きの印
    cp === 0x2060 || // 単語の結合子
    (cp >= 0xfe00 && cp <= 0xfe0f) || // 異体字選択子
    /\s/u.test(ch)
  );
};

function addChars(set, text) {
  for (const ch of text) if (!isBlank(ch)) set.add(ch);
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  middot: '·',
  hellip: '…',
  times: '×',
  yen: '¥',
  larr: '←',
  rarr: '→',
  ndash: '–',
  mdash: '—',
};

/** HTML・JSX の実体参照（&amp; &#x5927; など）を、実際の字にする */
function decodeEntities(text) {
  return text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (whole, hex, dec, name) => {
    if (hex || dec) return String.fromCodePoint(hex ? parseInt(hex, 16) : parseInt(dec, 10));
    return NAMED_ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** TS・TSX・JS: 文字列・テンプレート・JSX の文・日本語の名前（識別子）を集める。コメントは入らない */
function collectFromScript(text, kind, set) {
  const scriptKind = { ts: ts.ScriptKind.TS, tsx: ts.ScriptKind.TSX, js: ts.ScriptKind.JS }[kind];
  const file = ts.createSourceFile(
    `source.${kind}`,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const visit = (node) => {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
      case ts.SyntaxKind.TemplateHead:
      case ts.SyntaxKind.TemplateMiddle:
      case ts.SyntaxKind.TemplateTail:
      case ts.SyntaxKind.Identifier:
        addChars(set, node.text);
        break;
      case ts.SyntaxKind.JsxText:
        addChars(set, decodeEntities(node.text));
        break;
      default:
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

/** CSS の文字列（"…" と '…'）を集める。\2713 のような逃げ字は実際の字にする。コメントは入らない */
function collectFromCss(text, set) {
  const withoutComments = text.replace(/\/\*[\s\S]*?\*\//g, '');
  const unescape = (raw) =>
    raw.replace(/\\([0-9a-f]{1,6})\s?|\\([\s\S])/gi, (_whole, hex, other) =>
      hex ? String.fromCodePoint(parseInt(hex, 16)) : other,
    );
  for (const m of withoutComments.matchAll(
    /"((?:[^"\\\n]|\\[\s\S])*)"|'((?:[^'\\\n]|\\[\s\S])*)'/g,
  )) {
    addChars(set, unescape(m[1] ?? m[2] ?? ''));
  }
}

/** HTML: コメントを除き、<script> は JS として、<style> は CSS として読み、残りは本文と属性として集める */
function collectFromHtml(text, set) {
  // 先頭から順に当てる。コメントの中に書いた「<script>」の字は、コメントごと読み飛ばされる
  const parts =
    /<!--[\s\S]*?-->|<script\b[^>]*>([\s\S]*?)<\/script>|<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let last = 0;
  for (const m of text.matchAll(parts)) {
    addChars(set, decodeEntities(text.slice(last, m.index)));
    if (m[1] !== undefined) collectFromScript(m[1], 'js', set);
    if (m[2] !== undefined) collectFromCss(m[2], set);
    last = (m.index ?? 0) + m[0].length;
  }
  addChars(set, decodeEntities(text.slice(last)));
}

/** ソース 1 本の字を集める。kind は 'ts' | 'tsx' | 'js' | 'css' | 'html' */
export function collectChars(text, kind) {
  const set = new Set();
  if (kind === 'css') collectFromCss(text, set);
  else if (kind === 'html') collectFromHtml(text, set);
  else collectFromScript(text, kind, set);
  return set;
}

/** 画面の字を集めるファイルの一覧（根からの相対パス・/ 区切り・並び順は固定） */
export function screenSourceFiles(root) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(join(dir, entry.name), `${rel}/`);
      else if (/\.(tsx?|css)$/.test(entry.name)) out.push(rel);
    }
  };
  walk('src', 'src/');
  for (const file of HTML_FILES) out.push(file);
  return out.sort();
}

/** 画面に出る字を、ファイルごとに集める。ファイル → 字の集合 の対応を返す（ファイルの並びは固定） */
export function collectScreenCharsByFile(root) {
  const byFile = new Map();
  for (const file of screenSourceFiles(root)) {
    const kind = file.endsWith('.html') ? 'html' : file.slice(file.lastIndexOf('.') + 1);
    const text = readFileSync(join(root, ...file.split('/')), 'utf8');
    byFile.set(file, collectChars(text, kind));
  }
  return byFile;
}

/** 画面に出る字を、ソースから集める。字 → 最初に見つけたファイル の対応を返す */
export function collectScreenChars(root) {
  const found = new Map();
  for (const [file, set] of collectScreenCharsByFile(root)) {
    for (const ch of set) if (!found.has(ch)) found.set(ch, file);
  }
  return found;
}

const byCodePoint = (a, b) => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0);

/**
 * フォントに入れてほしい字を、2 組に分けて返す（どちらもコードポイント順の文字列）。
 *   core  = いつも入れる字 + シミュレーター以外のソースの字。3 ページ（/・/fan/・/presenter/）が使う字は、すべてここ
 *   extra = シミュレーターだけにある字（core に無いもの）。会場の名前の漢字など。シミュレーターだけが読む
 */
export function requestedChars(root) {
  const core = new Set([...BASE_CHARS].filter((ch) => !isBlank(ch)));
  const simulator = new Set();
  for (const [file, set] of collectScreenCharsByFile(root)) {
    for (const ch of set) (file === SIMULATOR_FILE ? simulator : core).add(ch);
  }
  const extra = [...simulator].filter((ch) => !core.has(ch));
  return { core: [...core].sort(byCodePoint).join(''), extra: extra.sort(byCodePoint).join('') };
}

// ---------- ② 収録した字の一覧（glyphs.txt） ----------

const SECTION_INCLUDED = '[収録]';
const SECTION_EXTRA = '[追加]';
const SECTION_MISSING = '[なし]';
const SECTION_DISPLAY = '[見出し]';
const SECTION_DISPLAY_MISSING = '[見出しなし]';

/**
 * glyphs.txt を読む。「#」で始まる行と空行は読まない。
 *   [収録] の次の行から: 核の WOFF2（MOBO-Regular・MOBO-Bold）に収録した字
 *   [追加] の次の行から: 追加の WOFF2（*-sim）に収録した字（シミュレーターだけが使う）
 *   [なし] の次の行から: 画面で使うが MOBO に無い字（別の書体で表示される）
 *   [見出し] の次の行から: 見出し書体の WOFF2 に収録した字
 *   [見出しなし] の次の行から: 核の字のうち、見出し書体に無い字（MOBO で表示される）
 * 空白は数えない。
 */
export function parseGlyphs(text) {
  const included = new Set();
  const extra = new Set();
  const missing = new Set();
  const display = new Set();
  const displayMissing = new Set();
  let target = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (line === SECTION_INCLUDED) target = included;
    else if (line === SECTION_EXTRA) target = extra;
    else if (line === SECTION_MISSING) target = missing;
    else if (line === SECTION_DISPLAY) target = display;
    else if (line === SECTION_DISPLAY_MISSING) target = displayMissing;
    else if (target === null) {
      throw new Error(
        `glyphs.txt の書式が誤りです。字は、${SECTION_INCLUDED}・${SECTION_EXTRA}・${SECTION_MISSING}・${SECTION_DISPLAY}・${SECTION_DISPLAY_MISSING} のどれかの行のあとに書きます: ${line.slice(0, 20)}`,
      );
    } else addChars(target, line);
  }
  return { included, extra, missing, display, displayMissing };
}

// 字の行は、先頭に空白を 1 つ置く（行の頭が # や [ の字でも、説明の行・節の印と取り違えないため。空白は読み飛ばされる）
const wrap = (chars, width) => {
  const lines = [];
  for (let i = 0; i < chars.length; i += width)
    lines.push(` ${chars.slice(i, i + width).join('')}`);
  return lines;
};

/** glyphs.txt の中身を作る（fonts-build.mjs が書く。手で直さない） */
export function formatGlyphs({ included, extra, missing, display, displayMissing }) {
  const sorted = (set) => [...set].sort(byCodePoint);
  return [
    '# MOBO（本文）と Corporate Logo Rounded（見出し）を絞った WOFF2 に収録した字の一覧。',
    '# npm run fonts:build が書く。手で直さない（テストが、実際の WOFF2 の中身と突き合わせる）。',
    '# 書式: 「#」の行は説明。[収録] の次の行から、核の WOFF2 に入れた字（全ページが使う）。',
    '#       [追加] の次の行から、追加の WOFF2（*-sim）に入れた字（収支シミュレーターだけが使う）。',
    '#       [なし] の次の行から、画面で使うが MOBO に無い字（別の書体で表示される）。',
    '#       [見出し] の次の行から、見出し書体（Corporate Logo Rounded Bold ver3）に入れた字（画面の字と同じ集合に絞っている）。',
    '#       [見出しなし] の次の行から、見出し書体に無い字（見出しでも MOBO で表示される）。',
    `# 収録 ${included.size} 字・追加 ${extra.size} 字・なし ${missing.size} 字・見出し ${display.size} 字・見出しなし ${displayMissing.size} 字（空白は数えない）`,
    SECTION_INCLUDED,
    ...wrap(sorted(included), 60),
    SECTION_EXTRA,
    ...wrap(sorted(extra), 60),
    SECTION_MISSING,
    ...wrap(sorted(missing), 60),
    SECTION_DISPLAY,
    ...wrap(sorted(display), 60),
    SECTION_DISPLAY_MISSING,
    ...wrap(sorted(displayMissing), 60),
    '',
  ].join('\n');
}

/** 画面に出る字のうち、一覧（[収録]・[追加]・[なし] のどれにも）に無い字を返す。字 → 見つけたファイル */
export function findMissingGlyphs(screen, listed) {
  const missing = new Map();
  for (const [ch, file] of screen) {
    if (!listed.included.has(ch) && !listed.extra.has(ch) && !listed.missing.has(ch)) {
      missing.set(ch, file);
    }
  }
  return missing;
}

/**
 * 見出し書体の一覧（[見出し]・[見出しなし]）に無い字を返す。字 → 見つけたファイル。
 * 見出し書体を当てる場所だけの字は機械では集められず、当てる範囲も変わりうるので、シミュレーター以外のソースの字すべてを対象にする
 * （シミュレーターには、見出し書体を当てない）。
 */
export function findMissingDisplayGlyphs(byFile, listed) {
  const missing = new Map();
  for (const [file, set] of byFile) {
    if (file === SIMULATOR_FILE) continue;
    for (const ch of set) {
      if (!listed.display.has(ch) && !listed.displayMissing.has(ch) && !missing.has(ch)) {
        missing.set(ch, file);
      }
    }
  }
  return missing;
}

/** 漏れたときの文。何をすればよいかまで書く */
export function missingMessage(missing) {
  const shown = [...missing].slice(0, 30).map(([ch, file]) => `「${ch}」（${file}）`);
  const more = missing.size > shown.length ? ` ほか ${missing.size - shown.length} 字` : '';
  return [
    `画面に出る字のうち ${missing.size} 字が、フォントの一覧（${FONT_DIR}/${GLYPHS_FILE}）にありません: ${shown.join(' ')}${more}`,
    'フォントを絞り直してください: npm run fonts:build -- --src <MOBO のフォルダ> --display-src <Corporate Logo Rounded のフォルダ>',
    '（Python と fonttools が要ります。元のフォントの入手先と手順は docs/フォント.md。絞り直しができないときは、字の一覧を添えてコーディネーターに頼みます）',
  ].join('\n');
}

// ---------- ②' シミュレーター用の @font-face（simulator.css） ----------

/** コードポイントの並びを、CSS の unicode-range（U+4E00-4E03,U+4E08 の形）にする */
export function unicodeRange(chars) {
  const cps = [...new Set([...chars].map((ch) => ch.codePointAt(0) ?? 0))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < cps.length;) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === (cps[j] ?? 0) + 1) j++;
    const hex = (n) => n.toString(16).toUpperCase();
    parts.push(i === j ? `U+${hex(cps[i] ?? 0)}` : `U+${hex(cps[i] ?? 0)}-${hex(cps[j] ?? 0)}`);
    i = j + 1;
  }
  return parts.join(',');
}

/** unicode-range の文字列を、コードポイントの集合に戻す（テスト用） */
export function parseUnicodeRange(range) {
  const set = new Set();
  for (const part of range.split(',')) {
    const m = /^\s*U\+([0-9A-F]+)(?:-([0-9A-F]+))?\s*$/i.exec(part);
    if (!m) throw new Error(`unicode-range が読めません: ${part}`);
    const from = parseInt(m[1] ?? '', 16);
    const to = m[2] ? parseInt(m[2], 16) : from;
    for (let cp = from; cp <= to; cp++) set.add(cp);
  }
  return set;
}

/**
 * unicode-range の行を、prettier（printWidth 100）が整える形に折り返す。
 * 生成した simulator.css が npm run format:check を通るようにするため（prettier の出力と同じ形）
 */
function wrapRange(range) {
  const items = range.split(',');
  const indent = '    ';
  const lines = [];
  let line = indent;
  items.forEach((item, i) => {
    const piece = i === items.length - 1 ? `${item};` : `${item},`;
    const next = line === indent ? `${line}${piece}` : `${line} ${piece}`;
    if (next.length > 100 && line !== indent) {
      lines.push(line);
      line = `${indent}${piece}`;
    } else line = next;
  });
  lines.push(line);
  return ['  unicode-range:', ...lines];
}

/**
 * simulator.css の中身。シミュレーター（public/simulator.html）が、<link> で読む。
 * 核の 2 面（全部の字）のあとに、追加の 2 面（unicode-range つき）を置く。同じ書体・同じ太さの面は、
 * あとに書いた面が先に使われるので、追加の字だけが追加の WOFF2 から出て、読み込まれるのもその字が出たときだけ。
 */
export function simulatorCss(extra) {
  const face = (file, weight, rangeLine) =>
    [
      '@font-face {',
      "  font-family: 'MOBO';",
      `  font-weight: ${weight};`,
      '  font-style: normal;',
      '  font-display: swap;',
      `  src: url('/${FONT_DIR.replace(/^public\//, '')}/${file}') format('woff2');`,
      ...(rangeLine ? wrapRange(rangeLine) : []),
      '}',
    ].join('\n');
  const range = unicodeRange(extra);
  return [
    '/* npm run fonts:build が書く。手で直さない。収支シミュレーター（/simulator.html）だけが読む。',
    '   核の 2 本（MOBO-Regular・MOBO-Bold）に入れていない字（会場の名前の漢字など）は、追加の 2 本（*-sim）から出る。',
    '   追加の 2 本は、その字が画面に出たときだけ読み込まれる（unicode-range）。 */',
    face(FONT_FILES[0], 400),
    face(FONT_FILES[1], 700),
    face(EXTRA_FILES[0], 400, range),
    face(EXTRA_FILES[1], 700, range),
    '',
  ].join('\n');
}

// ---------- ③ WOFF2 の中身（cmap）を読む ----------

// WOFF2 の表の名前の既定の並び（W3C WOFF2 §5.1）。フラグの下位 6 ビットが、この番号
// prettier-ignore
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

/** WOFF2 の cmap が持つコードポイントの集合を返す。表は 1 本の brotli にまとまっているので、Node の標準で開ける */
export function readWoff2Cmap(buffer) {
  if (buffer.subarray(0, 4).toString('latin1') !== 'wOF2') throw new Error('WOFF2 ではありません');
  const numTables = buffer.readUInt16BE(12);
  const compressedSize = buffer.readUInt32BE(20);
  let pos = 48;
  const readBase128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = buffer[pos++] ?? 0;
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return value;
    }
    throw new Error('WOFF2 の表の長さが読めません');
  };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buffer[pos++] ?? 0;
    const index = flags & 0x3f;
    let tag;
    if (index === 63) {
      tag = buffer.subarray(pos, pos + 4).toString('latin1');
      pos += 4;
    } else tag = KNOWN_TAGS[index] ?? '';
    const version = flags >> 6;
    const length = readBase128();
    // glyf・loca は version 0 が「変換あり」。それ以外は version 0 が「変換なし」
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    tables.push({ tag, size: transformed ? readBase128() : length });
  }
  const data = brotliDecompressSync(buffer.subarray(pos, pos + compressedSize));
  let offset = 0;
  for (const table of tables) {
    if (table.tag === 'cmap') return readCmap(data.subarray(offset, offset + table.size));
    offset += table.size;
  }
  throw new Error('WOFF2 に cmap がありません');
}

/** cmap の形式 4（BMP）と 12（全面）を読む */
function readCmap(cmap) {
  const found = new Set();
  const count = cmap.readUInt16BE(2);
  for (let i = 0; i < count; i++) {
    const at = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(at);
    if (format === 4) {
      const segCount = cmap.readUInt16BE(at + 6) / 2;
      const end = at + 14;
      const start = end + segCount * 2 + 2;
      const delta = start + segCount * 2;
      const rangeOffset = delta + segCount * 2;
      for (let s = 0; s < segCount; s++) {
        const first = cmap.readUInt16BE(start + s * 2);
        const last = cmap.readUInt16BE(end + s * 2);
        const d = cmap.readUInt16BE(delta + s * 2);
        const r = cmap.readUInt16BE(rangeOffset + s * 2);
        for (let c = first; c <= last && c < 0xffff; c++) {
          let glyph = 0;
          if (r === 0) glyph = (c + d) & 0xffff;
          else {
            const raw = cmap.readUInt16BE(rangeOffset + s * 2 + r + (c - first) * 2);
            glyph = raw === 0 ? 0 : (raw + d) & 0xffff;
          }
          if (glyph !== 0) found.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(at + 12);
      for (let g = 0; g < groups; g++) {
        const base = at + 16 + g * 12;
        const first = cmap.readUInt32BE(base);
        const last = cmap.readUInt32BE(base + 4);
        const glyph = cmap.readUInt32BE(base + 8);
        for (let c = first; c <= last; c++) if (glyph + (c - first) !== 0) found.add(c);
      }
    }
  }
  return found;
}
