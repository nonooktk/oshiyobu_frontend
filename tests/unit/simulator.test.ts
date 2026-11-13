// @vitest-environment node
// 収支シミュレーター（public/simulator.html。班の方の道具）の検査（設計 D-21・I-101・I-31〜I-35 の前提）
// 計算とデータ（script）は、元のまま置く。変えてよいのは、script の外の表示（帯の文言・札・戻るリンク）だけ
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';

const html = readFileSync(`${ROOT}public/simulator.html`, 'utf8');
// 行頭の <script> から </script> まで（冒頭のコメントに書いてある文字列の <script> は含めない）
const script = /\n<script>\n[\s\S]*\n<\/script>\n/.exec(html)?.[0] ?? '';
const outside = html.replace(script, '');

// 元（mock/simulator.html。2026-11-13 時点）の script 全体（<script> から </script> まで）の SHA-256
const ORIGINAL_SCRIPT_SHA256 = 'c081c662503f88d89957c860021276fc87bbfce96cbba98aa173a2d8aceb22e7';

describe('収支シミュレーター', () => {
  it('計算とデータ（script）が、元のまま（ハッシュが一致する）', () => {
    expect(script.length).toBeGreaterThan(300000);
    expect(createHash('sha256').update(script).digest('hex')).toBe(ORIGINAL_SCRIPT_SHA256);
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

  it('外部の URL を読み込まない（script の外に http(s):// が無い）', () => {
    expect(outside).not.toMatch(/https?:\/\//);
  });
});
