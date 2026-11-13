// 共有メーターのクライアントが、API のエラーの名前（core の 10 種）と、知らない名前を扱えること（設計 D-13。B-2 の契約）
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_ERROR_CODES } from '../../src/core';
import { getMeter, postJoin, postReset } from '../../src/shared/meter/client';

const PID = 'tech0:cbox';
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }),
      ),
    ),
  );

afterEach(() => vi.unstubAllGlobals());

describe('API のエラーの扱い', () => {
  it('core の 10 種の名前は、すべて読める。名前は動きを変えず、例外は出ない', async () => {
    expect(API_ERROR_CODES).toHaveLength(10);
    for (const code of API_ERROR_CODES) {
      reply(500, { error: code });
      const result = await getMeter('https://api.example.test', PID);
      expect(result).toMatchObject({ ok: false, kind: 'http', status: 500, code });
    }
  });

  it('知らない名前・形の違う本文・本文なしでも、落ちない（code は null）', async () => {
    for (const body of [
      { error: 'something_new' },
      { error: 42 },
      ['x'],
      'not json',
      '',
      { hello: 1 },
    ]) {
      reply(500, body);
      const result = await postJoin('https://api.example.test', PID, 'device-aaaaaaaaaaaaaaaa');
      expect(result).toMatchObject({ ok: false, kind: 'http', status: 500, code: null });
    }
  });

  it.each([400, 401, 404, 409, 413, 415, 429, 500, 503])(
    '状態 %i は、失敗として返す（例外にしない）',
    async (status) => {
      reply(status, { error: 'invalid_body' });
      expect(await getMeter('https://api.example.test', PID)).toMatchObject({
        ok: false,
        kind: 'http',
        status,
      });
    },
  );

  it('Retry-After が読めないとき（ブラウザでは公開されない）は、retryAfterMs が無い。読めるときだけ、ミリ秒にする', async () => {
    reply(429, { error: 'rate_limited' });
    expect(
      (await getMeter('https://api.example.test', PID)) as { retryAfterMs?: number },
    ).toMatchObject({ retryAfterMs: undefined });
    reply(429, { error: 'rate_limited' }, { 'Retry-After': '3' });
    expect(
      (await getMeter('https://api.example.test', PID)) as { retryAfterMs?: number },
    ).toMatchObject({ retryAfterMs: 3000 });
  });

  it('reset の結果: 401・503 は原因ごとに分け、新しい名前（500・413・415）や知らない状態は「予期しない応答」', async () => {
    const outcome = async (status: number, body: unknown) => {
      reply(status, body);
      return postReset('https://api.example.test', 'dummy-passphrase');
    };
    expect(await outcome(401, { error: 'unauthorized' })).toEqual({ kind: 'unauthorized' });
    expect(await outcome(503, { error: 'not_configured' })).toEqual({ kind: 'not_configured' });
    for (const [status, error] of [
      [500, 'internal_error'],
      [413, 'payload_too_large'],
      [415, 'unsupported_media_type'],
      [418, 'something_new'],
    ] as const) {
      expect(await outcome(status, { error })).toEqual({ kind: 'error', status });
    }
  });
});
