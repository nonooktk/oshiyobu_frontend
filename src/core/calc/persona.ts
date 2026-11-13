import { PERSONA_COUNT } from '../data/personas';
import type { Persona } from '../data/personas';
import { performanceIdOf } from '../schema/performance';
import type { PerformanceId, VenueId } from '../types';
import { defaultVenueIdOf } from './condition';

/** 文字列を UTF-8 のバイト列にする（TextEncoder が無い環境でも、同じ結果にするため）。 */
function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/** FNV-1a（32 ビット）。文字列を UTF-8 のバイト列として混ぜる。結果は 0 以上の整数。 */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of utf8Bytes(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * 端末の番号から、人物の番号（1〜15）を決める ＝ FNV-1a（32 ビット）を 15 で割った余り + 1（決定 2・6。設計 D-19）。
 * 保存せず、端末の番号が変わらない限り、何度でも同じ人物になる（再読み込みで引き直さない）。
 */
export function personaNoOf(deviceId: string): number {
  return (fnv1a32(deviceId) % PERSONA_COUNT) + 1;
}

/**
 * `/fan/?p=番号` の指定を、人物の番号にする。1〜15 の数字だけ受け、それ以外（範囲外・数字でない・小数・空）は無視する
 * （undefined。端末の番号で決める）。受入テストとリハーサル用で、QR には使わない（設計 D-19）。
 */
export function personaNoFromParam(param: string | null | undefined): number | undefined {
  if (param === null || param === undefined || !/^\d+$/.test(param)) {
    return undefined;
  }
  const no = Number(param);
  return no >= 1 && no <= PERSONA_COUNT ? no : undefined;
}

/** 人物の番号を決める。`?p=` の指定が有効ならそれ、なければ端末の番号から決める。 */
export function resolvePersonaNo(deviceId: string, param: string | null | undefined): number {
  return personaNoFromParam(param) ?? personaNoOf(deviceId);
}

/** 人物の公演の会場 ＝ 地元の市の既定の会場（久留米市は Cボックス）。 */
export function personaVenueId(persona: Persona): VenueId {
  return defaultVenueIdOf(persona.city);
}

/** 人物の公演 ID（推しと会場の組）。1〜9 は `tech0:cbox`。 */
export function personaPerformanceId(persona: Persona): PerformanceId {
  return performanceIdOf(persona.artistId, personaVenueId(persona));
}
