// 動きを減らす設定のとき、トースト（小さい通知）の「下から上がる」動きも止める（QA H-06）。
// jsdom は、動きを再生しない。CSS の指定（動きを減らす設定のブロックの中に、トーストの指定があり、位置を動かさない）を読んで確かめる。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/fan/fan.module.css', 'utf8');

/** `@media (prefers-reduced-motion: reduce) { ... }` の中身（波括弧の対応を数えて取り出す）。 */
function reducedMotionBlock(source: string): string {
  const start = source.indexOf('@media (prefers-reduced-motion: reduce)');
  if (start < 0) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return '';
}
/** ブロックの中の `.toast { ... }` の中身。 */
const toastRule = (block: string): string =>
  new RegExp(String.raw`(?:^|[\s,}])\.toast\s*\{([^}]*)\}`).exec(block)?.[1] ?? '';

describe('動きを減らす設定のトースト', () => {
  it('通常のトーストは、下から 8px 上がる動き（toastIn）で出る', () => {
    expect(css).toMatch(/\.toast\s*\{[^}]*animation:\s*toastIn/);
    expect(css).toMatch(/@keyframes toastIn\s*\{[^}]*translateY\(8px\)/);
  });

  it('動きを減らす設定では、位置を動かさず、すっと現れるだけ（fadeIn。translate を使わない）', () => {
    const rule = toastRule(reducedMotionBlock(css));
    expect(rule).toMatch(/animation:\s*fadeIn/);
    expect(rule).not.toMatch(/translate|transform/);
    const fadeIn = /@keyframes fadeIn\s*\{([^]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(fadeIn).toMatch(/opacity/);
    expect(fadeIn).not.toMatch(/translate|transform|scale/);
  });

  it('この検査は、指定が無いときに落ちる（見張りが働いている）', () => {
    const without = reducedMotionBlock(css).replace(/\.toast\s*\{[^}]*\}/, '');
    expect(toastRule(without)).toBe('');
    expect(toastRule('')).toBe('');
  });
});
