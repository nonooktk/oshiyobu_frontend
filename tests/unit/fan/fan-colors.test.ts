// ファン向けの色の差し替え（src/styles/tokens.css の :root[data-page='fan']）の検査。2026-11-18、統括の承認で足した。
// 主張: 色はファン向けだけ差し替え、名前は増やさず、文字と白い文字は読める明暗差を保つ。
//   ① 差し替えるのは、:root にすでにある名前だけ（新しい名前の色を足していない）
//   ② ファン向けの値で、文字の色（--ink・--ink-soft・--primary・--success-ink・--warning-ink・--error-ink）が、
//      --surface（白）と --bg-c の上で 4.5:1 以上
//   ③ 白（--surface）の文字が、--primary と --sky の上で 4.5:1 以上（主のボタンの両端）
import { describe, expect, it } from 'vitest';

const files = import.meta.glob(['/src/styles/tokens.css'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const tokens = (files['/src/styles/tokens.css'] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');

/** 規則の中身（--名前: 値;）を、名前 → 値の表にする */
const declarations = (body: string): Record<string, string> =>
  Object.fromEntries(
    [...body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [
      match[1] ?? '',
      (match[2] ?? '').trim(),
    ]),
  );

const rootBody = /:root\s*\{([^}]*)\}/.exec(tokens)?.[1] ?? '';
const fanBody = /:root\[data-page='fan'\]\s*\{([^}]*)\}/.exec(tokens)?.[1] ?? '';
const rootValues = declarations(rootBody);
const fanOverrides = declarations(fanBody);
/** ファン向けの画面で実際に効く値（:root の値を、ファン向けの規則が上書きしたもの） */
const fanValues = { ...rootValues, ...fanOverrides };

/** #rrggbb の相対輝度（WCAG 2.x） */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`#rrggbb の色ではありません: ${hex}`);
  const n = Number.parseInt(match[1] ?? '', 16);
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** 2 色の明暗差（1〜21）。前景と背景の順は問わない */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const colorOf = (name: string): string => fanValues[name] ?? '';

describe('ファン向けの色の差し替え（tokens.css）', () => {
  it('検査の対象を読めている（空振りしていない）', () => {
    expect(Object.keys(rootValues)).toContain('--primary');
    expect(Object.keys(fanOverrides)).toContain('--font');
    expect(Object.keys(fanOverrides)).toContain('--primary');
    expect(Object.keys(fanOverrides)).toContain('--sky');
  });

  it('差し替えるのは、:root にすでにある名前だけ（新しい名前を足していない）', () => {
    const added = Object.keys(fanOverrides).filter((name) => !(name in rootValues));
    expect(added).toEqual([]);
  });

  it('主のボタンの両端の色（--sky・--primary）を、ファン向けで差し替えている（事務所向け・発表者用の値と違う）', () => {
    expect(fanOverrides['--primary']).not.toBe(rootValues['--primary']);
    expect(fanOverrides['--sky']).not.toBe(rootValues['--sky']);
  });

  it.each(['--ink', '--ink-soft', '--primary', '--success-ink', '--warning-ink', '--error-ink'])(
    '%s は、--surface（白）と --bg-c の上で 4.5:1 以上',
    (name) => {
      for (const bg of ['--surface', '--bg-c']) {
        expect(contrast(colorOf(name), colorOf(bg)), `${name} on ${bg}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    },
  );

  it.each(['--primary', '--sky'])('--surface（白）の文字は、%s の上で 4.5:1 以上', (name) => {
    expect(
      contrast(colorOf('--surface'), colorOf(name)),
      `--surface on ${name}`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('明暗差の計算は、基準の値に合っている（白と黒は 21:1・同じ色は 1:1）', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#336699', '#336699')).toBeCloseTo(1, 5);
  });
});
