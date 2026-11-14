// @vitest-environment node
// 色の決まりの検査（G-14）。色は tokens.css（src/styles/tokens.css）にあるものだけ。新しい色を足さない。
//   ① tokens.css の色のトークンの名前が、いまの一覧と同じ（新しい色のトークンを足したら落ちる）
//   ② 画面の CSS・TS・TSX に、色の値（#xxxxxx・rgb()・hsl() など）を直接書いていない
// 例外: すでに書かれている白（#fff）と、マスクの #000。これは tokens の --surface に置き換えると決まりに沿う（置き換えは歓迎）。
//   例外を広げる（ほかの色を許す）ときは、管理者が、この検査と docs/守ること.md を一緒に変える。
// 値を変える（既存のトークンの色を変える）ことは、この検査の対象にしない。色の見た目は、担当者が調整できる。
import { describe, expect, it } from 'vitest';
import { guardMessage, read, stripComments, walk, withExt } from './helpers';

/** tokens.css の色のトークン（G-14 を決めたときの一覧）。足すときは、管理者が、ここと文書を変える */
const COLOR_TOKENS = [
  '--primary',
  '--primary-dark',
  '--sky',
  '--sky-light',
  '--yellow',
  '--yellow-light',
  '--ink',
  '--ink-soft',
  '--surface',
  '--bg-b',
  '--bg-c',
  '--line',
  '--gray-300',
  '--success',
  '--success-ink',
  '--warning',
  '--warning-ink',
  '--error',
  '--error-ink',
  '--heat-1',
  '--heat-2',
  '--heat-3',
  '--heat-4',
  '--heat-5',
  '--scrim',
];

/** 値が色に見えるトークンの名前を集める */
const colorTokensIn = (css: string): string[] =>
  [
    ...stripComments(css).matchAll(
      /^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|color\()/gm,
    ),
  ]
    .map((match) => match[1] ?? '')
    .sort();

/** 例外として許す色（白と黒。すでに書かれているもの） */
const ALLOWED_LITERALS = new Set(['#fff', '#ffffff', '#000', '#000000']);

const CSS_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\bcolor\(/g;
/** TS・TSX では、文字列の全体が色の値のものだけを見る（'#OSHIYOBU' のような、ハッシュタグの文を拾わない） */
const CODE_LITERAL = /(['"`])(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^'"`]*)\1/g;

const scanned = walk('src', ['src/core', 'src/styles/tokens.css']);
const cssFiles = withExt(scanned, ['.css']);
const codeFiles = withExt(scanned, ['.ts', '.tsx']);

describe('色の決まり（G-14）', () => {
  it('検査の対象が見つかり、色のトークンを読めている（空振りしていない）', () => {
    expect(cssFiles).toContain('src/fan/fan.module.css');
    expect(cssFiles).toContain('src/office/office.module.css');
    expect(codeFiles).toContain('src/fan/store/store.ts');
    expect(colorTokensIn(read('src/styles/tokens.css')).length).toBeGreaterThan(20);
  });

  it('tokens.css の色のトークンが、決めた一覧と同じ（新しい色を足していない）', () => {
    const actual = colorTokensIn(read('src/styles/tokens.css'));
    const added = actual.filter((name) => !COLOR_TOKENS.includes(name));
    expect(
      added,
      guardMessage(
        'G-14',
        `tokens.css に新しい色のトークン ${added.join('・')} を足しています（色を足すのは、管理者へ）`,
      ),
    ).toEqual([]);
    const removed = COLOR_TOKENS.filter((name) => !actual.includes(name));
    expect(
      removed,
      guardMessage('G-14', `tokens.css から色のトークン ${removed.join('・')} が消えています`),
    ).toEqual([]);
  });

  it('画面の CSS に、色の値を直接書いていない（白 #fff とマスクの #000 だけ例外）', () => {
    const hits: string[] = [];
    for (const path of cssFiles) {
      for (const match of stripComments(read(path)).matchAll(CSS_LITERAL)) {
        if (!ALLOWED_LITERALS.has(match[0].toLowerCase())) hits.push(`${path}: ${match[0]}`);
      }
    }
    expect(
      hits,
      guardMessage(
        'G-14',
        `CSS に色の値を直接書いています。tokens.css の var(--名前) を使ってください`,
      ),
    ).toEqual([]);
  });

  it('TS・TSX に、色の値を直接書いていない（style への直書きなど）', () => {
    const hits: string[] = [];
    for (const path of codeFiles) {
      for (const match of stripComments(read(path)).matchAll(CODE_LITERAL)) {
        if (!ALLOWED_LITERALS.has((match[2] ?? '').toLowerCase()))
          hits.push(`${path}: ${match[2]}`);
      }
    }
    expect(
      hits,
      guardMessage(
        'G-14',
        'TS・TSX に色の値を直接書いています。tokens.css の var(--名前) を使ってください',
      ),
    ).toEqual([]);
  });

  it('この検査は、色の直書きを見つけられる（見張りが働いている）', () => {
    const sample = '.a { color: #123456; background: rgba(0, 0, 0, 0.5); border-color: #FFF; }';
    const found = [...sample.matchAll(CSS_LITERAL)]
      .map((match) => match[0])
      .filter((literal) => !ALLOWED_LITERALS.has(literal.toLowerCase()));
    expect(found).toEqual(['#123456', 'rgba(']);
    expect(colorTokensIn(':root {\n  --new: #abcdef;\n  --space: 4px;\n}\n')).toEqual(['--new']);
    expect([...`const x = '#abc123';`.matchAll(CODE_LITERAL)].map((match) => match[2])).toEqual([
      '#abc123',
    ]);
  });
});
