import type { PerformanceId } from '../types';
import { isPerformanceId } from './performance';

/**
 * 共有メーター API の入出力の型と検査（設計 D-13）。API のテストと画面のクライアントのテストが、同じ関数を使う。
 * API が預かるのは人数だけで、個人の情報は含まない（決定 1）。
 */

/** 端末の番号の形。個人に結びつかない乱数（UUID など）。 */
export const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** 文字列が、端末の番号として使える形か。 */
export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

/** API のエラーの種類（設計 D-13）。 */
export const API_ERROR_CODES = [
  'unknown_performance', // 404: 公演 ID が一覧に無い
  'invalid_body', // 400: 本文が決まった形でない
  'cap_reached', // 409: 公演ごと・全体の上限（joined を添える）
  'rate_limited', // 429: 同じ端末の番号の連打（Retry-After を付ける）
  'unauthorized', // 401: 合言葉が違う
  'not_configured', // 503: 合言葉が未設定・短い（reset を無効にしている）
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** GET /api/v1/performances/{pid}/meter の応答。 */
export interface MeterResponse {
  readonly performanceId: PerformanceId;
  /** 申し込みの件数（reset のあとの件数で、0 から数える。開始人数 74 を含まない。設計 D-11）。 */
  readonly joined: number;
  /** 最後に reset した時刻（ISO 8601）。一度も reset していなければ null。画面は、この値の変化で reset を検知する。 */
  readonly resetAt: string | null;
}

/** POST /api/v1/performances/{pid}/joins の応答。 */
export interface JoinResponse extends MeterResponse {
  /** この申し込みを数えたか。同じ端末の 2 回目は false（数は増えない）。 */
  readonly counted: boolean;
}

/** POST /api/v1/reset の応答。 */
export interface ResetResponse {
  readonly resetAt: string;
}

/** サーバーが返す時刻の形（Date#toISOString。ミリ秒は省いてもよい）。 */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 自分の項目だけを読む（プロトタイプから受け継いだ項目は数えない）。 */
function own(record: Record<string, unknown>, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function isIsoTime(value: unknown): value is string {
  return typeof value === 'string' && ISO_UTC.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * GET meter の応答を検査する。型が違えば null（画面は無視して、落ちない）。
 * 知らない項目は捨て、決まった 3 項目だけを返す。申し込みの応答（counted つき）も、この 3 項目として読める。
 */
export function parseMeterResponse(value: unknown): MeterResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const performanceId = own(value, 'performanceId');
  const joined = own(value, 'joined');
  const resetAt = own(value, 'resetAt');
  if (!isPerformanceId(performanceId)) {
    return null;
  }
  if (typeof joined !== 'number' || !Number.isSafeInteger(joined) || joined < 0) {
    return null;
  }
  if (resetAt !== null && !isIsoTime(resetAt)) {
    return null;
  }
  return { performanceId, joined, resetAt };
}

/** POST joins の応答を検査する。counted（真偽値）が要る。型が違えば null。 */
export function parseJoinResponse(value: unknown): JoinResponse | null {
  const meter = parseMeterResponse(value);
  if (meter === null || !isRecord(value)) {
    return null;
  }
  const counted = own(value, 'counted');
  return typeof counted === 'boolean' ? { ...meter, counted } : null;
}

/** POST reset の応答を検査する。resetAt は必ず時刻（null は受けない）。型が違えば null。 */
export function parseResetResponse(value: unknown): ResetResponse | null {
  if (!isRecord(value)) {
    return null;
  }
  const resetAt = own(value, 'resetAt');
  return isIsoTime(resetAt) ? { resetAt } : null;
}
