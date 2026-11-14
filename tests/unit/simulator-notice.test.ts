// @vitest-environment node
// 収支シミュレーター（public/simulator.html）にも、「動作確認用のデモ画面です」を、いまの札と並べて出す。札は消さない。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';

const html = readFileSync(`${ROOT}public/simulator.html`, 'utf8');
// script（計算とデータ）の外だけを見る（simulator.test.ts と同じ取り方）
const script = /\n<script>\n[\s\S]*\n<\/script>\n/.exec(html)?.[0] ?? '';
const outside = html.replace(script, '');

describe('収支シミュレーターの表示', () => {
  it('上の帯に、「動作確認用のデモ画面です」が、札「デモ用の架空データ」と並んで出る', () => {
    const banner = /<div class="mock-banner"[^>]*>(.*?)<\/div>/s.exec(outside)?.[1] ?? '';
    expect(banner).toContain('<span class="demo-chip">動作確認用のデモ画面です</span>');
    expect(banner).toContain('<span class="demo-chip">デモ用の架空データ</span>');
  });
});
