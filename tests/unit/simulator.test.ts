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
// 2026-11-18、統括の了承（「全部、勝手に直してよい」）で、公演のデータから音の森の 1 件を外した版に替えた（docs/office/要件.md の M-20）
const APPROVED_SCRIPT_SHA256 = 'aeb5e64b7022f34aea19c1be71e3313aedcccd9dde27aa9aaa4e6224aa661a85';

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

  it('C-02 上位コースの構成が事務所向けと違うことの注記が、見出しの下に出る（F-12・SP-17・D-21）', () => {
    // 冒頭のコメントではなく、画面に出る本文（body）の段落として置く
    const body = outside.slice(outside.indexOf('<body>'));
    const note = /<h1 class="part-h">[^<]*<\/h1>\s*<p class="hint course-note">([^<]*)<\/p>/.exec(
      body,
    );
    expect(note?.[1] ?? '（注記の段落がありません）').toContain(
      '上位コースの構成は、事務所向けと違います',
    );
  });

  it('外部の URL を読み込まない（script の外に http(s):// が無い）', () => {
    expect(outside).not.toMatch(/https?:\/\//);
  });
});
