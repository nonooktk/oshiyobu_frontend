// @vitest-environment node
// 収支シミュレーター（public/simulator.html。班の方の道具）の検査（設計 D-21・I-101・I-31〜I-35 の前提）
// 計算とデータ（script）は、統括が了承した版のまま置く（ハッシュで固定）。変えるときは、統括の了承を得て、ハッシュを替える
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';

const html = readFileSync(`${ROOT}public/simulator.html`, 'utf8');
// 行頭の <script> から </script> まで（冒頭のコメントに書いてある文字列の <script> は含めない）
const script = /\n<script>\n[\s\S]*\n<\/script>\n/.exec(html)?.[0] ?? '';
const outside = html.replace(script, '');

// script 全体（<script> から </script> まで）の SHA-256。
// 元（mock/simulator.html。2026-11-13 時点）は c081c662503f88d89957c860021276fc87bbfce96cbba98aa173a2d8aceb22e7。
// 2026-11-18、統括の了承（「全部、勝手に直してよい」）で、公演のデータから音の森の 1 件を外した版（aeb5e64b…）に替え、
// 続けて 1 数字・2 損益の計算と並びを変えた版（3159ef80…。M-11〜M-22）に替え、
// 追加の直しで、入力の名前「利益」とプラン名「プラチナプラン」にした版（6ad7e684…。M-23・M-24）に替え、
// 追加の直し（2）で、出演料を外した版（b4e00c3d…。M-26。計算の検査は simulator-calc.test.ts・simulator-no-fee.test.ts）に替え、
// 2026-11-19、Issue #50 の統括の了承で、事務所向けから会場の ID（?venue=）を受け取る版に替えた（N-11。計算とデータは変えていない。
// 受け取りの検査は simulator-venue-param.test.ts）
const APPROVED_SCRIPT_SHA256 = '95fe5e702497b8118bc6151c14a9559cc5a27978bada58c1c22159608e46d477';

describe('収支シミュレーター', () => {
  it('計算とデータ（script）が、統括の了承した版のまま（ハッシュが一致する。2026-11-18）', () => {
    expect(script.length).toBeGreaterThan(300000);
    expect(createHash('sha256').update(script).digest('hex')).toBe(APPROVED_SCRIPT_SHA256);
  });

  it('札「デモ用の架空データ」が出る（N-12・SP-80）。「DEMO」の古い札は無い', () => {
    expect(outside).toContain('<span class="demo-chip">デモ用の架空データ</span>');
    expect(outside).not.toContain('>DEMO<');
    expect(outside).not.toContain('見た目だけ・中身なし');
  });

  it('戻るリンクは、事務所向け（/）を指す', () => {
    expect(outside).toContain('href="/"');
    expect(outside).not.toContain('index.html#office');
  });

  it('見出しの下に、上位コースの構成が事務所向けと違うことの注記を出さない（2026-11-18 に構成をそろえた。M-12・M-13）', () => {
    // C-02 の注記（F-12・SP-17・D-21）は、3 つのプランを事務所向けの ⑤ と同じ組み立てにしたので外した
    const body = outside.slice(outside.indexOf('<body>'));
    expect(body).toMatch(/<h1 class="part-h">[^<]*<\/h1>/);
    expect(body).not.toContain('course-note');
    expect(body).not.toContain('上位コースの構成は、事務所向けと違います');
  });

  it('外部の URL を読み込まない（script の外に http(s):// が無い）', () => {
    expect(outside).not.toMatch(/https?:\/\//);
  });
});
