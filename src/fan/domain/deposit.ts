// 預金を積み増す額の入力の決まり（「口座と預金」の画面の入力欄）。
// 入力欄の文字 → 足す額（円）。1 円以上の整数だけ。全角の数字とカンマは、半角に直して受ける。
// 空・0・負・小数・文字・大きすぎる額は、足さずに、理由を返す。上限は、預金の合計が DEPOSIT_MAX を超えない所まで。
import { yen } from '../text/format';

/** 預金の合計の上限（円）。8 桁。ゲージ・金額の表示が崩れない額。 */
export const DEPOSIT_MAX = 99_999_999;

/** よく使う額の小さいボタン（円）。押すとすぐ足す。 */
export const QUICK_DEPOSITS = [10_000, 50_000, 100_000] as const;

export type DepositError =
  | { kind: 'empty' } // 空
  | { kind: 'text' } // 数字でない文字がある
  | { kind: 'decimal' } // 小数
  | { kind: 'nonPositive' } // 0 または負
  | { kind: 'tooLarge'; room: number }; // 上限を超える。room は、あと足せる額（0 以上）

export type DepositParse = { ok: true; yen: number } | { ok: false; error: DepositError };

/** あと足せる額（円）。預金が上限に届いていれば 0。 */
export const depositRoom = (current: number): number => Math.max(0, DEPOSIT_MAX - current);

/** 足せる額か（整数・1 円以上・合計が上限以内）。画面が先に断るが、ストアも同じ決まりで守る。 */
export const canAddDeposit = (amount: number, current: number): boolean =>
  Number.isSafeInteger(amount) && amount >= 1 && amount <= depositRoom(current);

/** 全角の数字・カンマ・小数点・マイナスを、半角にそろえる（ほかの文字は、そのまま） */
function toHalfWidth(raw: string): string {
  return raw
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/[－−]/g, '-');
}

/** 入力欄の文字を、足す額（円）に直す。current は、いまの預金（上限との比べに使う）。 */
export function parseDepositInput(raw: string, current: number): DepositParse {
  const room = depositRoom(current);
  const text = toHalfWidth(raw).trim();
  if (text === '') return { ok: false, error: { kind: 'empty' } };
  const negative = text.startsWith('-');
  const digits = (negative ? text.slice(1) : text).replace(/,/g, '');
  const isInteger = /^\d+$/.test(digits);
  const isDecimal = /^(\d+\.\d*|\.\d+)$/.test(digits);
  if (!isInteger && !isDecimal) return { ok: false, error: { kind: 'text' } };
  if (negative) return { ok: false, error: { kind: 'nonPositive' } };
  if (isDecimal) return { ok: false, error: { kind: 'decimal' } };
  const trimmed = digits.replace(/^0+/, '');
  if (trimmed === '') return { ok: false, error: { kind: 'nonPositive' } };
  // 桁があふれる長さは、数にせずに断る（9 桁を超えれば、上限の 99,999,999 を必ず超える）
  if (trimmed.length > 9) return { ok: false, error: { kind: 'tooLarge', room } };
  const n = Number(trimmed);
  if (n > room) return { ok: false, error: { kind: 'tooLarge', room } };
  return { ok: true, yen: n };
}

/** 足さない理由の文（入力欄のそばに出し、読み上げにも伝える）。短く、得や運のことばは使わない。 */
export function depositErrorText(error: DepositError): string {
  switch (error.kind) {
    case 'empty':
      return '金額を入れてください';
    case 'text':
      return '数字だけで入れてください';
    case 'decimal':
      return '整数で入れてください（1.5のような数は使えません）';
    case 'nonPositive':
      return '1円以上で入れてください';
    case 'tooLarge':
      return error.room > 0
        ? `預金は合計 ${yen(DEPOSIT_MAX)}までです。あと ${yen(error.room)}まで足せます`
        : `預金は合計 ${yen(DEPOSIT_MAX)}までです。これ以上は足せません`;
  }
}
