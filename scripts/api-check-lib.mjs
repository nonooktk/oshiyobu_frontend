// API の応答を、決まり（backend の API 契約）と照らして判定する部品。通信はしない。
// check-api.mjs・check-live.mjs・テストが使う。どの判定も { ok, detail }（detail は 1 行の日本語）を返す。
//
// 契約の正本は src/core/schema/meter.ts（parseMeterResponse・parseJoinResponse）。そこは TypeScript で、
// Node の台本からは直接読めないため、同じ決まりをここに写している。ずれていないことは、
// tests/unit/api-check-lib.test.ts が、core の検査の関数と突き合わせて確かめる。
import { checkCoreVersion } from './deploy-check-lib.mjs';

/** 応答時間の目安（ミリ秒）。超えたら「注意」を出す（合否にはしない） */
export const SLOW_MS = 1000;
/** 「知らない接続元」の例。API が許さないことを確かめるのに使う（実在しない名前） */
export const UNKNOWN_ORIGIN = 'https://evil.example';

/** サーバーが返す時刻の形（src/core/schema/meter.ts の ISO_UTC と同じ） */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const own = (record, key) => (Object.hasOwn(record, key) ? record[key] : undefined);

/** GET meter（と、申し込みの応答）の本文の形の違いを、文の配列で返す。空なら、決まりどおり */
export function meterBodyErrors(body, performanceId) {
  if (!isRecord(body)) return ['本文が JSON の連想配列ではありません'];
  const errors = [];
  if (own(body, 'performanceId') !== performanceId) {
    errors.push(`performanceId が、問い合わせた公演（${performanceId}）と違います`);
  }
  const joined = own(body, 'joined');
  if (typeof joined !== 'number' || !Number.isSafeInteger(joined) || joined < 0) {
    errors.push('joined が 0 以上の整数ではありません');
  }
  const resetAt = own(body, 'resetAt');
  const validTime =
    typeof resetAt === 'string' && ISO_UTC.test(resetAt) && !Number.isNaN(Date.parse(resetAt));
  if (resetAt !== null && !validTime) {
    errors.push('resetAt が null でも ISO 8601（UTC）の時刻でもありません');
  }
  return errors;
}

const verdict = (errors, okDetail) =>
  errors.length === 0 ? { ok: true, detail: okDetail } : { ok: false, detail: errors.join('。') };

/** GET /healthz: 200・ok: true・coreVersion が core.lock.json の版と同じ */
export function judgeHealth({ status, body, lockVersion }) {
  if (status !== 200) return { ok: false, detail: `状態が ${status} です（200 が要ります）` };
  if (!isRecord(body) || body.ok !== true) {
    return { ok: false, detail: '本文の ok が true ではありません' };
  }
  const errors = checkCoreVersion({ health: body, lockVersion });
  return verdict(errors, `coreVersion ${lockVersion}（core.lock.json と同じ）`);
}

/** GET meter: 200 で、本文が決まりどおり */
export function judgeMeter({ status, body, performanceId }) {
  if (status !== 200) return { ok: false, detail: `状態が ${status} です（200 が要ります）` };
  const errors = meterBodyErrors(body, performanceId);
  return verdict(errors, `joined=${body?.joined}・resetAt=${body?.resetAt ?? 'なし'}`);
}

/** 存在しない公演: 404 */
export function judgeNotFound({ status }) {
  return status === 404
    ? { ok: true, detail: '404' }
    : { ok: false, detail: `状態が ${status} です（404 が要ります）` };
}

/** CORS（画面の接続元を許す）: Access-Control-Allow-Origin が、その接続元（または *）になる */
export function judgeCorsAllow({ allowOrigin, origin }) {
  if (allowOrigin === origin || allowOrigin === '*') {
    return { ok: true, detail: '許可されている（Access-Control-Allow-Origin が接続元と同じ）' };
  }
  return {
    ok: false,
    detail: allowOrigin
      ? 'Access-Control-Allow-Origin が接続元と違います'
      : 'Access-Control-Allow-Origin が付いていません',
  };
}

/** CORS（知らない接続元は許さない）: Allow-Origin が無い（知らない接続元・* にならない） */
export function judgeCorsDeny({ allowOrigin, unknownOrigin = UNKNOWN_ORIGIN }) {
  if (allowOrigin === '*') return { ok: false, detail: 'どの接続元でも許しています（*）' };
  if (allowOrigin === unknownOrigin) return { ok: false, detail: '知らない接続元を許しています' };
  return { ok: true, detail: '許されない（Access-Control-Allow-Origin が付かない）' };
}

/** CORS の事前の問い合わせ（発表者用の reset が使う OPTIONS）: 2xx・接続元を許す・x-presenter-key を許す */
export function judgePreflight({ status, allowOrigin, allowHeaders, origin }) {
  const errors = [];
  if (status < 200 || status >= 300) errors.push(`状態が ${status} です（2xx が要ります）`);
  if (allowOrigin !== origin && allowOrigin !== '*') {
    errors.push('Access-Control-Allow-Origin が接続元と違う（または無い）');
  }
  if (
    !String(allowHeaders ?? '')
      .toLowerCase()
      .includes('x-presenter-key')
  ) {
    errors.push('Access-Control-Allow-Headers に x-presenter-key がありません');
  }
  return verdict(errors, '通る（OPTIONS。reset 自体は送っていません）');
}

/** 応答時間（ミリ秒の配列）。目安を超えても不合格にはせず、「注意」にする */
export function judgeTiming({ times, limitMs = SLOW_MS }) {
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  const detail = `中央値 ${Math.round(median)} ms・最大 ${Math.round(max)} ms（目安 ${limitMs} ms 以内・${sorted.length} 回）`;
  return { slow: median > limitMs, detail };
}

/** 申し込み（POST joins）の応答: 200・本文が決まりどおり・counted が期待どおり */
export function judgeJoin({ status, body, performanceId, expectCounted }) {
  if (status !== 200) return { ok: false, detail: `状態が ${status} です（200 が要ります）` };
  const errors = meterBodyErrors(body, performanceId);
  if (!isRecord(body) || typeof body.counted !== 'boolean') {
    errors.push('counted が真偽値ではありません');
  } else if (body.counted !== expectCounted) {
    errors.push(`counted が ${body.counted} です（${expectCounted} が要ります）`);
  }
  return verdict(errors, `counted: ${expectCounted}`);
}

/** 申し込みのあとの人数: 前の人数より、ちょうど 1 だけ増えている */
export function judgeCountIncrease({ before, after }) {
  return after === before + 1
    ? { ok: true, detail: `${before} → ${after}（1 だけ増えた）` }
    : { ok: false, detail: `${before} → ${after}（1 だけ増えるはずです）` };
}

// ---------------------------------------------------------------------------
// 画面（ブラウザ）から見た API への通信
// ---------------------------------------------------------------------------
/** 共有メーターの取得の URL か（/api/v1/performances/<公演>/meter） */
export function isMeterUrl(url) {
  return /\/api\/v1\/performances\/[^/?#]+\/meter(?:[?#]|$)/.test(String(url));
}

/**
 * 画面が出したメーターの取得（responses: [{ status, allowOrigin, origin }]。origin は取得先）を判定する。
 * apiOrigin（あれば）は、取得が、その API に出ていることの確認に使う。failures は、通信そのものが失敗した取得（接続できない・CORS で止められた）の理由。
 * 取得が出ていて、200 が返り、応答に Access-Control-Allow-Origin（画面の origin か *）が付いていれば、
 * CSP（connect-src）と CORS を通って、ブラウザから API に届いている証拠になる
 */
export function judgeLiveMeter({ responses, pageOrigin, apiOrigin = '', failures = [] }) {
  if (responses.length === 0) {
    return failures.length > 0
      ? { ok: false, detail: `メーターの取得が失敗しました（${failures[0]}）` }
      : { ok: false, detail: 'メーターの取得（GET …/meter）が出ていません' };
  }
  if (apiOrigin !== '' && !responses.some((r) => r.origin === apiOrigin)) {
    return {
      ok: false,
      detail:
        '取得が、指定した API の接続先に出ていません（ビルドに入った VITE_API_BASE が違う？）',
    };
  }
  const bad = responses.find((r) => r.status !== 200);
  if (bad) return { ok: false, detail: `メーターの取得に、状態 ${bad.status} が返りました` };
  const noCors = responses.find((r) => r.allowOrigin !== pageOrigin && r.allowOrigin !== '*');
  if (noCors) {
    return {
      ok: false,
      detail: '応答に、画面の接続元を許す Access-Control-Allow-Origin がありません',
    };
  }
  return { ok: true, detail: `取得 ${responses.length} 回・すべて 200・CORS で許されている` };
}
