// @vitest-environment node
// 特典の動画の決まり（docs/守ること.md の G-15）。
//   ① 動画（MP4・WebM）は、1 本 4 MB・合計 5 MB まで（スマホの回線でも、待たせない）
//   ② 動画の置き場は public/ の下だけ（画面と同じ配信元から読む。外から読み込まない。G-16）
//   ③ <video> には muted と playsInline を付ける（iPhone で、画面の中で自動で始まるようにする）
// 動画が 1 本も無い間も、検査は通る（素材は、あとから置く）。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, guardMessage } from './helpers';

export const VIDEO_LIMIT_EACH = 4 * 1024 * 1024;
export const VIDEO_LIMIT_TOTAL = 5 * 1024 * 1024;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = ['public', 'src', 'assets-src']
  .map((d) => join(ROOT, d))
  .filter((d) => {
    try {
      return statSync(d).isDirectory();
    } catch {
      return false;
    }
  })
  .flatMap((d) => walk(d));
const videos = files.filter((f) => VIDEO_EXT.test(f));
const sources = files.filter((f) => /src\/.*\.tsx$/.test(f));

describe('特典の動画（G-15）', () => {
  it('検査の対象（画面のソース）が見つかっている（空振りしていない）', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('動画は、public/ の下にだけ置く。形式は MP4 か WebM', () => {
    const bad = videos
      .map((f) => relative(ROOT, f))
      .filter((f) => !f.startsWith('public/') || !/\.(mp4|webm)$/i.test(f));
    expect(
      bad,
      guardMessage('G-15', `置き場か形式が決まりに合わない動画: ${bad.join('・')}`),
    ).toEqual([]);
  });

  it('動画は、1 本 4 MB・合計 5 MB まで', () => {
    const sizes = videos.map((f) => ({ f: relative(ROOT, f), size: statSync(f).size }));
    const big = sizes.filter((v) => v.size > VIDEO_LIMIT_EACH).map((v) => v.f);
    expect(big, guardMessage('G-15', `1 本の上限を超えた動画: ${big.join('・')}`)).toEqual([]);
    const total = sizes.reduce((a, v) => a + v.size, 0);
    expect(total, guardMessage('G-15', '動画の合計が上限を超えた')).toBeLessThanOrEqual(
      VIDEO_LIMIT_TOTAL,
    );
  });

  it('<video> には、muted と playsInline を付ける。外の URL を src に書かない', () => {
    const bad: string[] = [];
    for (const f of sources) {
      const text = readFileSync(f, 'utf8');
      for (const m of text.matchAll(/<video\b[^>]*>/g)) {
        const tag = m[0];
        if (!/\bmuted\b/.test(tag) || !/\bplaysInline\b/.test(tag) || /src=["']https?:/.test(tag))
          bad.push(`${relative(ROOT, f)}: ${tag.slice(0, 60)}`);
      }
    }
    expect(bad, guardMessage('G-15', `決まりに合わない <video>: ${bad.join(' ／ ')}`)).toEqual([]);
  });
});
