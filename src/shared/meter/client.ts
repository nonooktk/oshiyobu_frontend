import { parseJoinResponse, parseMeterResponse, parseResetResponse } from '../../core';
import type { JoinResponse, MeterResponse, PerformanceId, ResetResponse } from '../../core';

// 共有メーター API の呼び出し（設計 D-13・D-16・D-17）。画面の部品から fetch を呼ばない。通信はこのフォルダの中だけ。
// どの関数も例外を投げない（失敗は戻り値で返す）。応答は core の検査（parse…）を通ったものだけを使う。

/** 要求の待ち。超えたら打ち切り、失敗として数える（D-17。2 秒は「初期値で出す判断」で、要求は打ち切らない） */
export const REQUEST_TIMEOUT_MS = 8000;
/** 初期化（reset）の待ち（SP-67） */
export const RESET_TIMEOUT_MS = 10000;

export type Failure =
  | { readonly ok: false; readonly kind: 'timeout' | 'network' | 'invalid' }
  | {
      readonly ok: false;
      readonly kind: 'http';
      readonly status: number;
      /** 429 などで、サーバーが待つよう求めた時間（Retry-After。ミリ秒）。無ければ undefined */
      readonly retryAfterMs?: number;
    };
export type Result<T> = { readonly ok: true; readonly value: T } | Failure;

async function request(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Result<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // cookie は付けない・キャッシュしない（応答は 100 バイト前後。D-13）
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!response.ok) {
      const seconds = Number(response.headers.get('Retry-After'));
      const retryAfterMs =
        Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : undefined;
      return { ok: false, kind: 'http', status: response.status, retryAfterMs };
    }
    try {
      return { ok: true, value: await response.json() };
    } catch {
      return { ok: false, kind: 'invalid' };
    }
  } catch {
    return { ok: false, kind: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
}

function checked<T>(result: Result<unknown>, parse: (value: unknown) => T | null): Result<T> {
  if (!result.ok) {
    return result;
  }
  const value = parse(result.value);
  return value === null ? { ok: false, kind: 'invalid' } : { ok: true, value };
}

/** 公演の人数を取る（GET。独自のヘッダーも cookie も付けない単純な要求） */
export async function getMeter(
  base: string,
  performanceId: PerformanceId,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Result<MeterResponse>> {
  const url = `${base}/api/v1/performances/${performanceId}/meter`;
  return checked(await request(url, { method: 'GET' }, timeoutMs), parseMeterResponse);
}

/**
 * 申し込みを送る（POST）。本文は { deviceId } だけ。Content-Type は text/plain にして、
 * ブラウザの事前の問い合わせ（OPTIONS）を無くす（D-13・D-16 の K-17）。
 */
export async function postJoin(
  base: string,
  performanceId: PerformanceId,
  deviceId: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Result<JoinResponse>> {
  const url = `${base}/api/v1/performances/${performanceId}/joins`;
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ deviceId }),
  };
  return checked(await request(url, init, timeoutMs), parseJoinResponse);
}

/** 初期化（reset）の結果。発表者用の画面が、原因ごとに文言を出す（SP-67） */
export type ResetOutcome =
  | { readonly kind: 'ok'; readonly resetAt: string }
  | { readonly kind: 'unauthorized' }
  | { readonly kind: 'not_configured' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'network' }
  | { readonly kind: 'error'; readonly status?: number };

/** 全公演の人数を戻す（POST。合言葉は X-Presenter-Key。画面は合言葉を保存しない） */
export async function postReset(base: string, passphrase: string): Promise<ResetOutcome> {
  const result = checked<ResetResponse>(
    await request(
      `${base}/api/v1/reset`,
      { method: 'POST', headers: { 'X-Presenter-Key': passphrase } },
      RESET_TIMEOUT_MS,
    ),
    parseResetResponse,
  );
  if (result.ok) {
    return { kind: 'ok', resetAt: result.value.resetAt };
  }
  if (result.kind === 'http') {
    if (result.status === 401) return { kind: 'unauthorized' };
    if (result.status === 503) return { kind: 'not_configured' };
    return { kind: 'error', status: result.status };
  }
  return result.kind === 'timeout' || result.kind === 'network'
    ? { kind: result.kind }
    : { kind: 'error' };
}

/** 生存確認（GET /healthz）。応答までの時間（ミリ秒）を返す。発表者用の画面の「接続の確認」 */
export async function checkHealth(
  base: string,
  now: () => number = Date.now,
): Promise<{ readonly ok: boolean; readonly ms: number; readonly kind?: string }> {
  const started = now();
  const result = await request(`${base}/healthz`, { method: 'GET' }, REQUEST_TIMEOUT_MS);
  return result.ok
    ? { ok: true, ms: now() - started }
    : { ok: false, ms: now() - started, kind: result.kind };
}
