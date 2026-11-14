// ファン向けの文字の大きさの段（src/styles/tokens.css の --fs-*・--lh-*・--ls-text）の検査。
// 主張: 画面の文字の大きさは、少ない段（hero・figure・title・lead・body・note）だけで決め、中間の半端な大きさを残さない。
//   ① 段の値: となり合う段の比が 1.2 倍以上、note は 12px 以上、行間・字間は決めた範囲
//   ② src/fan の CSS の font-size は、段のトークンだけ（演出の中の大きさだけ、段の外）
//   ③ 使っていない段（死んだトークン）が無い
import { describe, expect, it } from 'vitest';

const files = import.meta.glob(
  ['/src/styles/tokens.css', '/src/fan/**/*.css', '/src/fan/**/*.tsx'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = stripComments(files['/src/styles/tokens.css'] ?? '');
const token = (name: string): string =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim() ?? '';
const px = (name: string): number => Number.parseFloat(token(name));

/** 段の並び（大きい順）。hero は演出の大きい数字 */
const TIERS = ['hero', 'figure', 'title', 'lead', 'body', 'note'] as const;

const CSS_FILES = Object.keys(files).filter(
  (path) => path.startsWith('/src/fan/') && path.endsWith('.css'),
);

/** 規則（セレクタと中身）を、入れ子の @container の中も含めて、すべて取り出す */
function rulesOf(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: (m[1] ?? '').trim().replace(/\s+/g, ' '), body: m[2] ?? '' });
  }
  return out;
}

// 演出（80%・成立・条件達成・セリフの吹き出しの絵）の中の大きさ。段の外（見え方を変えない）
const EFFECT = /^\.(ttl|fxSub|fxSay|sayAv|ach)/;

describe('文字の大きさの段（tokens.css）', () => {
  it('段のトークンがすべてあり、px で書かれている', () => {
    for (const tier of TIERS) {
      expect(token(`--fs-${tier}`), `--fs-${tier}`).toMatch(/^\d+(\.\d+)?px$/);
    }
  });

  it('となり合う段の比は 1.2 倍以上（段が近すぎて、違いが見えなくならない）', () => {
    for (let i = 0; i < TIERS.length - 1; i++) {
      const big = px(`--fs-${TIERS[i]}`);
      const small = px(`--fs-${TIERS[i + 1]}`);
      expect(big / small, `${TIERS[i]} / ${TIERS[i + 1]}`).toBeGreaterThanOrEqual(1.2);
    }
  });

  it('いちばん小さい段（note）は 12px 以上。タイトルは 26〜30px（統括の指示の範囲）', () => {
    expect(px('--fs-note')).toBeGreaterThanOrEqual(12);
    expect(px('--fs-title')).toBeGreaterThanOrEqual(26);
    expect(px('--fs-title')).toBeLessThanOrEqual(30);
  });

  it('行間は、見出し・ボタン 1.3 前後、本文 1.6 前後、説明文・注記 1.6〜1.7。字間は 0.02〜0.04em', () => {
    expect(Number(token('--lh-tight'))).toBeCloseTo(1.3, 1);
    expect(Number(token('--lh-body'))).toBeCloseTo(1.6, 1);
    expect(Number(token('--lh-note'))).toBeGreaterThanOrEqual(1.6);
    expect(Number(token('--lh-note'))).toBeLessThanOrEqual(1.7);
    const ls = Number.parseFloat(token('--ls-text'));
    expect(ls).toBeGreaterThanOrEqual(0.02);
    expect(ls).toBeLessThanOrEqual(0.04);
    expect(token('--ls-text')).toMatch(/em$/);
  });
});

describe('ファン向けの CSS（src/fan）は、段のトークンで文字の大きさを決める', () => {
  it('検査の対象が見つかり、規則を読めている（空振りしていない）', () => {
    expect(CSS_FILES).toContain('/src/fan/fan.module.css');
    expect(CSS_FILES).toContain('/src/fan/pages/pages.module.css');
    const total = CSS_FILES.flatMap((path) => rulesOf(files[path] ?? '')).filter((r) =>
      /font-size:/.test(r.body),
    );
    expect(total.length).toBeGreaterThan(80);
  });

  it('font-size は var(--fs-段) だけ。px の直書きは、演出の中（.ttl・.fxSub・.fxSay・.sayAv・.ach*）だけ', () => {
    const bad: string[] = [];
    for (const path of CSS_FILES) {
      for (const rule of rulesOf(files[path] ?? '')) {
        for (const m of rule.body.matchAll(/font-size:\s*([^;]+);/g)) {
          const value = (m[1] ?? '').trim();
          const isToken = /^var\(--fs-(hero|figure|title|lead|body|note)\)$/.test(value);
          const isFxVar =
            /^var\(--(fx|ach)-[a-z]+, [^)]+\)$/.test(value) ||
            /^var\(--fx-size, var\(--fs-hero\)\)$/.test(value);
          if (!isToken && !(EFFECT.test(rule.selector) && (isFxVar || /^\d+px$/.test(value)))) {
            bad.push(`${path.split('/').pop()}: ${rule.selector} → ${value}`);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('TSX に、文字の大きさの直書き（style の fontSize）が無い', () => {
    const hits = Object.entries(files)
      .filter(([path]) => path.endsWith('.tsx'))
      .filter(([, text]) => /fontSize/.test(text))
      .map(([path]) => path);
    expect(hits).toEqual([]);
  });

  it('使っていない段が無い（hero・figure・title・lead・body・note のどれも、どこかで使っている）', () => {
    const all = CSS_FILES.map((path) => stripComments(files[path] ?? '')).join('\n');
    for (const tier of TIERS) {
      expect(all, `--fs-${tier}`).toContain(`var(--fs-${tier})`);
    }
  });

  it('行間の直書きは、1 行の固定（px）と、数字・アイコンの 1〜1.2 だけ。数行の文は、行間のトークン（--lh-*）', () => {
    const bad: string[] = [];
    for (const path of CSS_FILES) {
      for (const rule of rulesOf(files[path] ?? '')) {
        for (const m of rule.body.matchAll(/line-height:\s*([^;]+);/g)) {
          const value = (m[1] ?? '').trim();
          if (EFFECT.test(rule.selector)) continue; // 演出の中は、段の外
          const ok =
            /^var\(--lh-(tight|body|note)\)$/.test(value) ||
            /^\d+px$/.test(value) ||
            /^(1|1\.05|1\.1|1\.15|1\.2)$/.test(value);
          if (!ok) bad.push(`${path.split('/').pop()}: ${rule.selector} → ${value}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
