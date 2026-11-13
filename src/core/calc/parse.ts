import { MAX_COST_YEN } from './cost';

/** 入力の検査の結果。理由の文言は frontend の仕事（core は理由の種類と、文言に写す値を返す）。 */
export type ParseResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly reason: 'blank' }
  | { readonly ok: false; readonly reason: 'invalid_format'; readonly input: string }
  | {
      readonly ok: false;
      readonly reason: 'out_of_range';
      readonly input: string;
      readonly value: number;
    }
  | { readonly ok: false; readonly reason: 'too_large'; readonly input: string };

/** 全角の数字（０〜９）を半角に直し、前後の空白（全角を含む）を取る。 */
function normalize(input: string): string {
  return input
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .trim();
}

/**
 * 最低人数の入力の検査（決定 13。仕様 SP-16・SP-70）。受け付けるのは、1 以上・キャパ以下の整数だけ。
 * 全角の数字は半角に直す。空欄は、打ち直しの途中として、理由を出さない（blank）。
 */
export function parseMinPeople(input: string, capacity: number): ParseResult {
  const text = normalize(input);
  if (text === '') {
    return { ok: false, reason: 'blank' };
  }
  if (!/^\d+$/.test(text)) {
    return { ok: false, reason: 'invalid_format', input: text };
  }
  const value = Number(text);
  if (value < 1 || value > capacity) {
    return { ok: false, reason: 'out_of_range', input: text, value };
  }
  return { ok: true, value };
}

/**
 * 費用の入力の検査（決定 13。仕様 SP-71）。受け付けるのは、0 以上の整数だけ（0 円は許す）。
 * 空欄は 0 円にせず、直させる。全角の数字は半角に直す。
 * 欄を離れると 3 桁区切りに整える（書き直せるよう、区切りの「,」「，」は受ける）。
 */
export function parseCost(input: string): ParseResult {
  const trimmed = normalize(input);
  if (trimmed === '') {
    return { ok: false, reason: 'blank' };
  }
  const text = trimmed.replace(/[,，]/g, '');
  if (!/^\d+$/.test(text)) {
    return { ok: false, reason: 'invalid_format', input: trimmed };
  }
  const value = Number(text);
  if (value > MAX_COST_YEN) {
    return { ok: false, reason: 'too_large', input: trimmed };
  }
  return { ok: true, value };
}
