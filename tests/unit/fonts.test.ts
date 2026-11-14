// @vitest-environment node
// 書体 MOBO（本文）と Corporate Logo Rounded（見出し）の検査（public/fonts/・scripts/fonts-lib.mjs）。
// 主張「画面に出る字は、配るフォントに入っている」を、次の 2 つで守る。
//   ① 画面の字（src/・各 HTML）を集めて、収録した字の一覧（glyphs.txt）と突き合わせる
//   ② 一覧（glyphs.txt）が、実際に配る WOFF2 の中身（cmap）と一致している（一覧だけを手で直しても通らない）
// 漏れで落ちたときは、メッセージのとおり npm run fonts:build をやり直す（手順は docs/フォント.md）
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';
import {
  DISPLAY_FAMILY,
  DISPLAY_FILE,
  EXTRA_FILES,
  FONT_FILES,
  GLYPHS_FILE,
  LICENSE_FILES,
  SIMULATOR_CSS,
  SIMULATOR_FILE,
  collectChars,
  collectScreenChars,
  collectScreenCharsByFile,
  findMissingDisplayGlyphs,
  findMissingGlyphs,
  formatGlyphs,
  isEmptyCharString,
  missingMessage,
  parseGlyphs,
  parseUnicodeRange,
  readWoff2Cmap,
  readWoff2EmptyGlyphs,
  simulatorCss,
  unicodeRange,
} from '../../scripts/fonts-lib.mjs';

const FONT_DIR = join(ROOT, 'public', 'fonts');
const chars = (set: Set<string>): string => [...set].sort().join('');

describe('画面の字の集め方（collectChars）', () => {
  it('TS・TSX は、文字列・テンプレート・JSX の文を集め、コメントの字は集めない', () => {
    const source = [
      '// 行コメントの「鬱」',
      '/* ブロックコメントの「蠍」 */',
      "const a = '推し';",
      'const b = `呼ぶ${n}人`;',
      'const c = { 久留米: 1 };',
      'export const View = () => <p title="属性">本文</p>;',
    ].join('\n');
    const got = chars(collectChars(source, 'tsx'));
    for (const ch of '推呼ぶ人久留米属性本文') expect(got).toContain(ch);
    expect(got).not.toContain('鬱');
    expect(got).not.toContain('蠍');
  });

  it('文字の逃げ（\\u の表記）も、実際の字として集める', () => {
    expect(chars(collectChars("const x = '\\u9b3c';", 'ts'))).toContain('鬼');
  });

  it('CSS は、引用符の中の文字列（content の逃げ字を含む）を集め、コメントは集めない', () => {
    const css = '/* コメントの「麒」 */ .a::before { content: "麟\\2713"; }';
    const got = chars(collectChars(css, 'css'));
    expect(got).toContain('麟');
    expect(got).toContain('✓');
    expect(got).not.toContain('麒');
  });

  it('HTML は、コメントを除き、本文・属性・<script>（JS として）・<style>（CSS として）から集める', () => {
    const html = [
      '<!-- コメントの「驫」。<script> という字も書いてある -->',
      '<style>.x::after { content: "終"; } /* 「靐」 */</style>',
      '<p title="題名">本文&#x5927;&nbsp;&amp;</p>',
      '<script>const t = `札${1}枚`; // 「龘」</script>',
    ].join('\n');
    const got = chars(collectChars(html, 'html'));
    for (const ch of '終題名本文大札枚') expect(got).toContain(ch);
    for (const ch of '驫靐龘') expect(got).not.toContain(ch);
  });

  it('空白と制御文字は集めない（字形の無いもの）', () => {
    // 識別子の f だけが残る（文字列の中の空白・タブ・改行・全角の空白は残らない）
    expect([...collectChars("f(' \\t\\n\\u3000');", 'ts')]).toEqual(['f']);
  });
});

describe('収録した字の一覧（parseGlyphs・formatGlyphs）', () => {
  const text = [
    '# 説明の行は読まない',
    '[収録]',
    'あいう',
    'abc',
    '',
    '[追加]',
    '鬱',
    '[なし]',
    '✓',
    '[見出し]',
    'あ',
    '[見出しなし]',
    '鬱',
  ].join('\n');

  it('[収録]・[追加]・[なし]・[見出し]・[見出しなし] の節に分けて読む。# の行と空行は読まない', () => {
    const { included, extra, missing, display, displayMissing } = parseGlyphs(text);
    expect(chars(included)).toBe('abcあいう');
    expect(chars(extra)).toBe('鬱');
    expect(chars(missing)).toBe('✓');
    expect(chars(display)).toBe('あ');
    expect(chars(displayMissing)).toBe('鬱');
  });

  it('節の前に字があるのは、書式の誤り', () => {
    expect(() => parseGlyphs('あ\n[収録]\nい')).toThrow('[収録]');
  });

  it('書き出したものを、読み戻すと同じになる（60 字ごとの折り返しをまたいでも）', () => {
    const many = new Set(Array.from({ length: 130 }, (_, i) => String.fromCodePoint(0x4e00 + i)));
    const listed = {
      included: many,
      extra: new Set(['鬱']),
      missing: new Set(['✓']),
      display: new Set(['あ', 'い']),
      displayMissing: new Set(['蠍']),
    };
    const back = parseGlyphs(formatGlyphs(listed));
    expect(chars(back.included)).toBe(chars(many));
    expect(chars(back.extra)).toBe('鬱');
    expect(chars(back.missing)).toBe('✓');
    expect(chars(back.display)).toBe('いあ'.split('').sort().join(''));
    expect(chars(back.displayMissing)).toBe('蠍');
  });
});

describe('一覧の書式の落とし穴（parseGlyphs・formatGlyphs）', () => {
  it('先頭が # や [ の字でも、行の頭で説明・節の印と取り違えない', () => {
    const empty = new Set<string>();
    const listed = {
      included: new Set(['#', '[', 'あ']),
      extra: empty,
      missing: empty,
      display: empty,
      displayMissing: empty,
    };
    expect(chars(parseGlyphs(formatGlyphs(listed)).included)).toBe('#[あ');
  });
});

describe('漏れの検出（findMissingGlyphs）', () => {
  it('どの節にも無い字だけを、漏れとして返す', () => {
    const listed = parseGlyphs(['[収録]', 'ab', '[追加]', '鬱', '[なし]', '✓'].join('\n'));
    const screen = new Map([
      ['a', 'src/a.ts'],
      ['鬱', 'public/simulator.html'],
      ['✓', 'src/b.css'],
      ['蠍', 'src/c.tsx'],
    ]);
    const missing = findMissingGlyphs(screen, listed);
    expect([...missing.keys()]).toEqual(['蠍']);
    expect(missing.get('蠍')).toBe('src/c.tsx');
  });

  it('メッセージに、漏れた字・見つけた場所・やり直しのコマンドが出る', () => {
    const message = missingMessage(new Map([['蠍', 'src/c.tsx']]));
    expect(message).toContain('蠍');
    expect(message).toContain('src/c.tsx');
    expect(message).toContain('npm run fonts:build');
  });
});

describe('見出し書体の漏れの検出（findMissingDisplayGlyphs）', () => {
  const listed = parseGlyphs(['[見出し]', 'ab', '[見出しなし]', '✓'].join('\n'));

  it('シミュレーター以外の字が、[見出し]・[見出しなし] のどちらにも無ければ、漏れ', () => {
    const byFile = new Map([
      ['src/a.ts', new Set(['a', '✓', '蠍'])],
      [SIMULATOR_FILE, new Set(['鬱'])], // シミュレーターの字は、見出し書体の対象外（h1 だけ）
    ]);
    const missing = findMissingDisplayGlyphs(byFile, listed);
    expect([...missing]).toEqual([['蠍', 'src/a.ts']]);
  });
});

describe('輪郭が空の字の判定（isEmptyCharString）', () => {
  // CFF の Type 2 charstring。数は 32〜246 が 1 バイト（値 + 139）。14 = endchar、21 = rmoveto、5 = rlineto
  const num = (n: number): number => n + 139;
  it('幅だけ・何も描かずに終わる字は、空', () => {
    expect(isEmptyCharString(Uint8Array.from([num(100), 14]))).toBe(true);
    expect(isEmptyCharString(Uint8Array.from([14]))).toBe(true);
  });

  it('移動・線・曲線を含む字は、空ではない', () => {
    expect(
      isEmptyCharString(Uint8Array.from([num(100), num(1), num(2), 21, num(3), num(4), 5, 14])),
    ).toBe(false);
    expect(isEmptyCharString(Uint8Array.from([num(1), 22, 14]))).toBe(false);
  });

  it('ヒント（stem・hintmask）だけで、何も描かない字は、空。hintmask の印のバイトを読み飛ばす', () => {
    // 幅 + stem 2 組（hstemhm = 18）→ hintmask（19）+ 印 1 バイト（0xff）→ endchar
    const hinted = [num(100), num(1), num(2), num(3), num(4), 18, 19, 0xff, 14];
    expect(isEmptyCharString(Uint8Array.from(hinted))).toBe(true);
    // 印のバイトの値が、命令の番号（21 = rmoveto）と同じでも、命令と取り違えない
    expect(isEmptyCharString(Uint8Array.from([num(100), num(1), num(2), 18, 19, 21, 14]))).toBe(
      true,
    );
    // 印のあとに描く字は、空ではない
    expect(
      isEmptyCharString(
        Uint8Array.from([num(100), num(1), num(2), 18, 19, 0x80, num(5), num(6), 21, 14]),
      ),
    ).toBe(false);
  });

  it('サブルーチンを呼ぶ字は、描いているとみなす（空ではない）', () => {
    expect(isEmptyCharString(Uint8Array.from([num(100), num(-107), 10, 14]))).toBe(false);
  });
});

describe('unicode-range（unicodeRange・parseUnicodeRange）', () => {
  it('続くコードポイントは 1 つの範囲にまとめ、離れたものは分ける', () => {
    expect(unicodeRange('乁七丂丁一')).toBe('U+4E00-4E03,U+4E41');
  });

  it('書き出したものを読み戻すと、元の字になる', () => {
    const text = '一丁七万乁龘鬱';
    const back = parseUnicodeRange(unicodeRange(text));
    expect([...back].sort((a, b) => a - b)).toEqual(
      [...text].map((ch) => ch.codePointAt(0) ?? 0).sort((a, b) => a - b),
    );
  });

  it('simulator.css の面は、核 2 つ（全部の字）のあとに、追加 2 つ（範囲つき）を置く。見出し書体は入れない', () => {
    const css = simulatorCss('鬱蠍');
    const faces = css.split('@font-face').slice(1);
    expect(faces).toHaveLength(4);
    expect(faces.map((face) => /url\('\/fonts\/([^']+)'\)/.exec(face)?.[1])).toEqual([
      ...FONT_FILES,
      ...EXTRA_FILES,
    ]);
    expect(faces.map((face) => face.includes('unicode-range'))).toEqual([false, false, true, true]);
    for (const face of faces) expect(face).toContain('font-display: swap');
    expect(css).not.toContain(DISPLAY_FILE);
  });
});

describe('配るフォント（public/fonts/）', () => {
  const read = (name: string): Buffer => readFileSync(join(FONT_DIR, name));
  // 一覧は、テストの中で読む（ファイルが無いとき、ほかのテストまで巻き込んで止めない）
  const listed = () => parseGlyphs(readFileSync(join(FONT_DIR, GLYPHS_FILE), 'utf8'));
  const cps = (set: Set<string>): number[] => [...set].map((ch) => ch.codePointAt(0) ?? 0);
  const isBlankCp = (cp: number): boolean => /\s/u.test(String.fromCodePoint(cp));
  const explain = (list: number[]): string[] => list.map((cp) => String.fromCodePoint(cp));

  it('置いてあるのは、WOFF2 5 本・simulator.css・ライセンス 2 本・一覧だけ（元の otf・ttf を入れない）', () => {
    expect(readdirSync(FONT_DIR).sort()).toEqual(
      [
        ...FONT_FILES,
        DISPLAY_FILE,
        ...EXTRA_FILES,
        SIMULATOR_CSS,
        GLYPHS_FILE,
        ...LICENSE_FILES,
      ].sort(),
    );
  });

  it.each(LICENSE_FILES)(
    'ライセンス文 %s（SIL Open Font License 1.1）が、フォントと一緒にある',
    (name) => {
      expect(read(name).toString('utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    },
  );

  it.each(FONT_FILES)(
    '核 %s は WOFF2 で、[収録] の字をすべて持ち、それ以外の字は持たない',
    (name) => {
      const buffer = read(name);
      expect(buffer.subarray(0, 4).toString('latin1')).toBe('wOF2');
      const cmap = readWoff2Cmap(buffer);
      const { included } = listed();
      expect(explain(cps(included).filter((cp) => !cmap.has(cp)))).toEqual([]);
      const known = new Set(cps(included));
      expect(explain([...cmap].filter((cp) => !known.has(cp) && !isBlankCp(cp)))).toEqual([]);
    },
  );

  it.each(EXTRA_FILES)('追加 %s は、[追加] の字だけを持つ（核と重ならない）', (name) => {
    const cmap = readWoff2Cmap(read(name));
    const { extra, included } = listed();
    expect(explain(cps(extra).filter((cp) => !cmap.has(cp)))).toEqual([]);
    const known = new Set(cps(extra));
    expect(explain([...cmap].filter((cp) => !known.has(cp) && !isBlankCp(cp)))).toEqual([]);
    expect(explain(cps(extra).filter((cp) => cps(included).includes(cp)))).toEqual([]);
  });

  it('見出し書体は WOFF2 で、[見出し] の字をすべて持ち、それ以外の字は持たない', () => {
    const buffer = read(DISPLAY_FILE);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('wOF2');
    const cmap = readWoff2Cmap(buffer);
    const { display } = listed();
    expect(explain(cps(display).filter((cp) => !cmap.has(cp)))).toEqual([]);
    const known = new Set(cps(display));
    expect(explain([...cmap].filter((cp) => !known.has(cp) && !isBlankCp(cp)))).toEqual([]);
  });

  it('[見出しなし] の字は、見出し書体に入っていない（入っているなら [見出し] へ移す）', () => {
    const cmap = readWoff2Cmap(read(DISPLAY_FILE));
    expect(explain(cps(listed().displayMissing).filter((cp) => cmap.has(cp)))).toEqual([]);
  });

  it('[なし] の字は、4 本のどれにも入っていない（入っているなら [収録]・[追加] へ移す）', () => {
    const all = [...FONT_FILES, ...EXTRA_FILES].map((name) => readWoff2Cmap(read(name)));
    const wrong = cps(listed().missing).filter((cp) => all.some((cmap) => cmap.has(cp)));
    expect(explain(wrong)).toEqual([]);
  });

  it.each([...FONT_FILES, ...EXTRA_FILES, DISPLAY_FILE])(
    '%s は、輪郭が空の字（形が無く、幅だけの字）を 1 つも持たない（空白類を除く）',
    (name) => {
      expect(explain([...readWoff2EmptyGlyphs(read(name))])).toEqual([]);
    },
  );

  it('MOBO の Bold に形が無い字（‹ › ‼ など）は、MOBO では出さない（[なし]。端末の書体で出す）', () => {
    const { missing, included, extra } = listed();
    for (const ch of '‹›‼·–—•ゕゖ') {
      expect(missing.has(ch), `${ch} が [なし] にある`).toBe(true);
      expect(included.has(ch) || extra.has(ch), `${ch} が [収録]・[追加] に無い`).toBe(false);
    }
  });

  it('simulator.css は、一覧と今のソースから作った中身と、一字一句同じ（手で直していない）', () => {
    expect(readFileSync(join(FONT_DIR, SIMULATOR_CSS), 'utf8')).toBe(
      simulatorCss([...listed().extra].join('')),
    );
  });

  it('simulator.css の unicode-range は、[追加] の字とぴったり同じ', () => {
    const css = readFileSync(join(FONT_DIR, SIMULATOR_CSS), 'utf8');
    const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].map((m) => m[1] ?? '');
    expect(ranges).toHaveLength(2);
    for (const range of ranges) {
      const got = [...parseUnicodeRange(range)].sort((a, b) => a - b);
      expect(got).toEqual(cps(listed().extra).sort((a, b) => a - b));
    }
  });
});

describe('画面に出る字が、フォントに入っている', () => {
  const screen = collectScreenChars(ROOT);
  const listed = () =>
    parseGlyphs(readFileSync(join(ROOT, 'public', 'fonts', GLYPHS_FILE), 'utf8'));

  it('検査の対象が見つかり、字を集められている（空振りしていない）', () => {
    expect(screen.size).toBeGreaterThan(300);
    const files = [...collectScreenCharsByFile(ROOT).keys()];
    expect(files).toContain(SIMULATOR_FILE);
    expect(files).toContain('index.html');
    expect(files).toContain('fan/index.html');
    expect(files.some((file) => file.startsWith('src/core/'))).toBe(true);
  });

  it('漏れが 0 字（漏れたら npm run fonts:build をやり直す）', () => {
    const missing = findMissingGlyphs(screen, listed());
    expect(missing.size, missingMessage(missing)).toBe(0);
  });

  it('見出し書体の一覧にも、画面の字（シミュレーター以外）が、漏れなく載っている', () => {
    const missing = findMissingDisplayGlyphs(collectScreenCharsByFile(ROOT), listed());
    expect(missing.size, missingMessage(missing)).toBe(0);
  });

  it('3 ページ（src・各 index.html）の字は、核の 2 本だけで足りる（追加の 2 本は、シミュレーターだけが読む）', () => {
    const { extra } = listed();
    const stray = [...collectScreenCharsByFile(ROOT)]
      .filter(([file]) => file !== SIMULATOR_FILE)
      .flatMap(([file, set]) =>
        [...set].filter((ch) => extra.has(ch)).map((ch) => `${ch}（${file}）`),
      );
    expect(stray).toEqual([]);
  });
});

describe('書体の指定（CSS・HTML）', () => {
  const read = (path: string): string => readFileSync(join(ROOT, ...path.split('/')), 'utf8');

  it('--font の先頭が MOBO。うしろに、今までの並びを残す（絞った外の字・読み込み前の表示に使う）', () => {
    const tokens = read('src/styles/tokens.css');
    expect(tokens).toMatch(/--font:\s*'MOBO',\s*'Noto Sans JP',\s*'Hiragino Sans'/);
    const simulator = read(SIMULATOR_FILE);
    expect(simulator).toMatch(/--font:\s*"MOBO",\s*"Noto Sans JP",\s*"Hiragino Sans"/);
  });

  it('@font-face は、MOBO の 400・700 と、見出し書体の 700 の 3 面で、font-display: swap。読み先は、同じサイトの /fonts/ だけ', () => {
    const css = read('src/styles/fonts.css').replace(/\/\*[\s\S]*?\*\//g, ''); // コメントは除く
    const faces = css.split('@font-face').slice(1);
    expect(faces).toHaveLength(3);
    expect(faces.map((face) => /font-weight:\s*(\d+)/.exec(face)?.[1])).toEqual([
      '400',
      '700',
      '700',
    ]);
    expect(faces.map((face) => /font-family:\s*'([^']+)'/.exec(face)?.[1])).toEqual([
      'MOBO',
      'MOBO',
      DISPLAY_FAMILY,
    ]);
    for (const face of faces) expect(face).toContain('font-display: swap');
    expect(faces.map((face) => /url\('\/fonts\/([^']+)'\)/.exec(face)?.[1])).toEqual([
      ...FONT_FILES,
      DISPLAY_FILE,
    ]);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('--font-fan は、先頭が Corporate Logo Rounded。MOBO を並べない（ファン向けが MOBO を読み込まないため）', () => {
    const tokens = read('src/styles/tokens.css');
    const stack = /--font-fan:\s*([^;]+);/.exec(tokens)?.[1] ?? '';
    expect(stack.trim().startsWith(`'${DISPLAY_FAMILY}'`)).toBe(true);
    expect(stack).not.toContain('MOBO');
    expect(stack).toContain("'Noto Sans JP'"); // この書体に無い字（✓）は、端末の書体で出す
    expect(read(SIMULATOR_FILE)).not.toContain('--font-fan');
  });

  it('ファン向けの書体は、根の要素（html）の data-page="fan" のときだけ --font を差し替える 1 か所。fan の main.tsx が付ける', () => {
    const tokens = read('src/styles/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = /:root\[data-page='fan'\]\s*\{([^}]*)\}/.exec(tokens)?.[1] ?? '';
    expect(rule).toMatch(/--font:\s*var\(--font-fan\)/);
    expect(tokens.match(/--font:\s*var\(--font-fan\)/g)).toHaveLength(1);
    expect(read('src/fan/main.tsx')).toContain("document.documentElement.dataset.page = 'fan'");
    // 事務所向け・発表者用は、data-page を付けない（MOBO のまま）
    expect(read('src/office/main.tsx')).not.toContain('dataset.page');
    expect(read('src/presenter/main.tsx')).not.toContain('dataset.page');
    // ファン向けの CSS は、差し替えを持たない（根の要素の --font を、そのまま使う）
    expect(read('src/fan/fan.module.css').replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain(
      '--font-fan',
    );
  });

  it('ファン向けの書体は、事務所向け・発表者用・シミュレーター・部品の共通の土台には効かせない', () => {
    const others = [
      'src/office/office.module.css',
      'src/presenter/App.module.css',
      'src/shared/components/DemoBadge.module.css',
      'src/styles/base.css',
    ];
    for (const path of others) {
      expect(read(path), path).not.toContain('--font-fan');
      expect(read(path), path).not.toContain('Corporate Logo');
    }
    // 全ページの --font は、MOBO のまま（ファン向けだけが、.shell で差し替える）
    expect(read('src/styles/tokens.css')).toMatch(/--font:\s*'MOBO'/);
  });

  it('tokens.css が fonts.css を取り込む（3 ページは、tokens.css を読む）', () => {
    expect(read('src/styles/tokens.css')).toMatch(/@import\s+['"]\.\/fonts\.css['"]/);
  });

  it('シミュレーターは、simulator.css を <link> で読む', () => {
    expect(read(SIMULATOR_FILE)).toContain(
      `<link rel="stylesheet" href="/fonts/${SIMULATOR_CSS}">`,
    );
  });
});
