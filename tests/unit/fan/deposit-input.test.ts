// 預金を積み増す額の入力の決まり（統括の依頼:「預金を増やす部分ですが、額面を自由に指定できるようにしてほしい」）。
// 入力欄の文字 → 足す額（円）。1 円以上の整数だけ。全角の数字とカンマは、半角に直して受ける。
// 空・0・負・小数・文字・大きすぎる額は、足さずに、理由を短く返す。上限は、預金の合計が 99,999,999 円を超えない所まで。
import { describe, expect, it } from 'vitest';
import {
  DEPOSIT_MAX,
  QUICK_DEPOSITS,
  depositErrorText,
  parseDepositInput,
} from '../../../src/fan/domain/deposit';

const NOW = 15_000; // 人物 1 の預金

describe('預金の合計の上限', () => {
  it('99,999,999 円（8 桁。表示が崩れない額）', () => {
    expect(DEPOSIT_MAX).toBe(99_999_999);
  });
});

describe('足せる入力（半角の整数に直して受ける）', () => {
  it.each([
    ['1', 1, '1 円（最小）'],
    ['5000', 5000, '半角の数字'],
    ['５０００', 5000, '全角の数字'],
    ['1,000', 1000, '半角のカンマ'],
    ['１，０００', 1000, '全角の数字と全角のカンマ'],
    ['1,00,0', 1000, 'カンマの位置は問わない（外して数える）'],
    ['  5000  ', 5000, '前後の空白（全角の空白を含む）'],
    ['　５，０００　', 5000, '前後の全角の空白'],
    ['007', 7, '先頭の 0'],
    ['99,984,999', 99_984_999, '合計がちょうど上限（15,000 + 99,984,999 = 99,999,999）'],
  ])('%j → %i（%s）', (raw, yenValue) => {
    expect(parseDepositInput(raw, NOW)).toEqual({ ok: true, yen: yenValue });
  });
});

describe('足さない入力（理由の種類）', () => {
  it.each([
    ['', 'empty', '空'],
    ['   ', 'empty', '空白だけ'],
    ['　', 'empty', '全角の空白だけ'],
    ['0', 'nonPositive', '0'],
    ['００', 'nonPositive', '全角の 00'],
    ['000', 'nonPositive', '0 が並ぶだけ'],
    ['-5', 'nonPositive', '負'],
    ['－5', 'nonPositive', '全角のマイナスの負'],
    ['−1,000', 'nonPositive', '数学のマイナス（U+2212）の負'],
    ['-0', 'nonPositive', '負の 0'],
    ['1.5', 'decimal', '小数'],
    ['１．５', 'decimal', '全角の小数'],
    ['0.5', 'decimal', '1 円未満の小数'],
    ['.5', 'decimal', '整数の部分が無い小数'],
    ['5.', 'decimal', '小数点で終わる'],
    ['abc', 'text', '文字'],
    ['10円', 'text', '数字のあとに文字'],
    ['1 000', 'text', '数字のあいだの空白'],
    ['+5', 'text', '先頭の +'],
    ['1e3', 'text', '指数の書き方'],
    ['あ１', 'text', '全角の数字の前に文字'],
    [',', 'text', 'カンマだけ'],
    ['-', 'text', 'マイナスだけ'],
  ])('%j → %s（%s）', (raw, kind) => {
    const r = parseDepositInput(raw, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe(kind);
  });

  it('上限のちょうど 1 円超は、足せる残りを添えて断る（99,984,999 までなら足せる → 99,985,000 は不可）', () => {
    const r = parseDepositInput('99,985,000', NOW);
    expect(r).toEqual({ ok: false, error: { kind: 'tooLarge', room: 99_984_999 } });
  });

  it('桁があふれる入力（精度を越える長さ）も、計算せずに「大きすぎる」', () => {
    const r = parseDepositInput('9'.repeat(40), NOW);
    expect(r).toEqual({ ok: false, error: { kind: 'tooLarge', room: 99_984_999 } });
  });

  it('預金がすでに上限なら、1 円でも不可（残りは 0）', () => {
    expect(parseDepositInput('1', DEPOSIT_MAX)).toEqual({
      ok: false,
      error: { kind: 'tooLarge', room: 0 },
    });
  });

  it('預金が上限をひとつ下回るなら、1 円は足せる。2 円は不可（残り 1）', () => {
    expect(parseDepositInput('1', DEPOSIT_MAX - 1)).toEqual({ ok: true, yen: 1 });
    expect(parseDepositInput('2', DEPOSIT_MAX - 1)).toEqual({
      ok: false,
      error: { kind: 'tooLarge', room: 1 },
    });
  });
});

describe('理由の文（入力欄のそばに出し、読み上げにも伝える。短く・得や運のことばを使わない）', () => {
  it('種類ごとの文', () => {
    expect(depositErrorText({ kind: 'empty' })).toBe('金額を入れてください');
    expect(depositErrorText({ kind: 'text' })).toBe('数字だけで入れてください');
    expect(depositErrorText({ kind: 'decimal' })).toBe(
      '整数で入れてください（1.5のような数は使えません）',
    );
    expect(depositErrorText({ kind: 'nonPositive' })).toBe('1円以上で入れてください');
    expect(depositErrorText({ kind: 'tooLarge', room: 99_984_999 })).toBe(
      '預金は合計 99,999,999円までです。あと 99,984,999円まで足せます',
    );
    expect(depositErrorText({ kind: 'tooLarge', room: 0 })).toBe(
      '預金は合計 99,999,999円までです。これ以上は足せません',
    );
  });

  it('G-04: 得・運を褒める語、使わない語を含まない', () => {
    const all = [
      depositErrorText({ kind: 'empty' }),
      depositErrorText({ kind: 'text' }),
      depositErrorText({ kind: 'decimal' }),
      depositErrorText({ kind: 'nonPositive' }),
      depositErrorText({ kind: 'tooLarge', room: 5 }),
      depositErrorText({ kind: 'tooLarge', room: 0 }),
    ].join('');
    for (const w of ['増える', 'お得', 'もらえる', '獲得', 'ボーナス', '口座開設', '確約'])
      expect(all.includes(w), w).toBe(false);
  });
});

describe('よく使う額（小さいボタン）', () => {
  it('+10,000・+50,000・+100,000。どれも 1 円以上の整数で、上限の中に収まる', () => {
    expect([...QUICK_DEPOSITS]).toEqual([10_000, 50_000, 100_000]);
    for (const n of QUICK_DEPOSITS)
      expect(parseDepositInput(String(n), 0)).toEqual({ ok: true, yen: n });
  });
});
