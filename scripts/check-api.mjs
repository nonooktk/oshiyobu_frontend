// npm run check:api — 画面から見た API（backend）が、決まり（契約）どおりに答えるかを確かめる。Node の fetch だけで動く。
//
//   VITE_API_BASE=<API の接続先> npm run check:api -- --web-origin <画面の接続元>
//   npm run check:api -- --api <API の接続先> --web-origin <画面の接続元> [--write]
//
// 接続先は --api か環境変数 VITE_API_BASE（GitHub の Variable VITE_API_BASE と同じ値）。
// 画面の接続元（CORS の確認に使う）は --web-origin か、環境変数 SWA_BASE_URL（公開中の画面の URL）。渡されなければ、CORS の項目は「飛ばした」。
// 確かめること: ① /healthz が 200 で coreVersion が core.lock.json と同じ ② メーターの取得が 200 で形が決まりどおり
//   ③ 存在しない公演は 404 ④ CORS（画面の接続元だけ許す。reset の事前の問い合わせも通る）⑤ 応答の時間（目安を超えたら「注意」。合否にしない）
// 書き込み（申し込み joins）は、既定では送らない。--write を付けたときだけ、試験用の公演（TEST_PERFORMANCE_ID）に、
//   新しい試験用の端末の番号で 1 回送り、counted の動きと人数が 1 だけ増えることを確かめる。発表に使う公演には、絶対に送らない。
//   reset は送らない。URL は出力に出さない（<API>・<SWA> などに置き換える）。
//   終了コード: 0 = すべて合格 / 1 = 不合格あり / 2 = 不合格はないが飛ばした項目がある
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { normalizeApiBase } from '../src/shared/meter/apiBase.ts';
import {
  STATUS,
  TEST_PERFORMANCE_ID,
  assertTestPerformance,
  exitCodeOf,
  makeItem,
  maskUrls,
  renderReport,
} from './accept-lib.mjs';
import { isMain } from './accept-run.mjs';
import {
  UNKNOWN_ORIGIN,
  judgeCorsAllow,
  judgeCorsDeny,
  judgeCountIncrease,
  judgeHealth,
  judgeJoin,
  judgeMeter,
  judgeNotFound,
  judgePreflight,
  judgeTiming,
} from './api-check-lib.mjs';
import { readLock } from './core-lib.mjs';

/** 通信の失敗を、URL を含めない 1 行にする */
function describeError(error, timeoutMs) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return `${timeoutMs / 1000} 秒以内に応答がありません`;
  }
  const code = error?.cause?.code ?? error?.code;
  return code ? `接続できません（${code}）` : '接続できません';
}

const passFail = (id, label, judged) =>
  makeItem(id, label, judged.ok ? STATUS.PASS : STATUS.FAIL, judged.detail);

/**
 * API を確かめて、項目の配列を返す。
 * apiBase は origin（normalizeApiBase を通したもの）。webOrigin は画面の接続元（無ければ CORS の項目を飛ばす）。
 * fetchImpl は、テストが差し替える
 */
export async function runCheckApi({
  apiBase,
  webOrigin = '',
  write = false,
  lockVersion,
  fetchImpl = fetch,
  timeoutMs = 10_000,
  samples = 3,
}) {
  const call = async (path, { method = 'GET', headers = {}, body } = {}) => {
    const started = performance.now();
    try {
      const response = await fetchImpl(`${apiBase}${path}`, {
        method,
        headers,
        body,
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        // 本文が JSON でないとき。判定の側が「形が違う」と言う
      }
      const ms = performance.now() - started;
      return { ok: true, status: response.status, headers: response.headers, body: json, ms };
    } catch (error) {
      return { ok: false, error: describeError(error, timeoutMs), ms: performance.now() - started };
    }
  };
  const meterPath = `/api/v1/performances/${TEST_PERFORMANCE_ID}/meter`;
  const items = [];
  const times = [];

  // ① /healthz。ここで接続できなければ、残りは確かめようがない
  const health = await call('/healthz');
  if (!health.ok) {
    items.push(
      makeItem(
        'api.health',
        '/healthz が 200・coreVersion が lock と同じ',
        STATUS.FAIL,
        health.error,
      ),
    );
    for (const [id, label] of [
      ['api.meter', 'メーターの取得が 200・形が決まりどおり'],
      ['api.notfound', '存在しない公演は 404'],
      ['api.cors.allow', 'CORS: 画面の接続元を許す'],
      ['api.cors.deny', 'CORS: 知らない接続元は許さない'],
      ['api.cors.preflight', 'CORS: reset の事前の問い合わせ（OPTIONS）が通る'],
      ['api.timing', '応答の時間'],
    ]) {
      items.push(makeItem(id, label, STATUS.SKIP, '/healthz に接続できないため飛ばした'));
    }
    return items;
  }
  times.push(health.ms);
  items.push(
    passFail(
      'api.health',
      '/healthz が 200・coreVersion が lock と同じ',
      judgeHealth({ status: health.status, body: health.body, lockVersion }),
    ),
  );

  // ② メーターの取得（応答時間の標本も兼ねて、数回取る）
  const first = await call(meterPath);
  if (first.ok) {
    times.push(first.ms);
    for (let i = 1; i < samples; i += 1) {
      const more = await call(meterPath);
      if (more.ok) times.push(more.ms);
    }
    items.push(
      passFail(
        'api.meter',
        'メーターの取得が 200・形が決まりどおり',
        judgeMeter({ status: first.status, body: first.body, performanceId: TEST_PERFORMANCE_ID }),
      ),
    );
  } else {
    items.push(
      makeItem('api.meter', 'メーターの取得が 200・形が決まりどおり', STATUS.FAIL, first.error),
    );
  }

  // ③ 存在しない公演
  const missing = await call('/api/v1/performances/no:such/meter');
  if (missing.ok) times.push(missing.ms);
  items.push(
    missing.ok
      ? passFail('api.notfound', '存在しない公演は 404', judgeNotFound({ status: missing.status }))
      : makeItem('api.notfound', '存在しない公演は 404', STATUS.FAIL, missing.error),
  );

  // ④ CORS。画面の接続元が渡されていなければ飛ばす
  const corsRows = [
    ['api.cors.allow', 'CORS: 画面の接続元を許す'],
    ['api.cors.deny', 'CORS: 知らない接続元は許さない'],
    ['api.cors.preflight', 'CORS: reset の事前の問い合わせ（OPTIONS）が通る'],
  ];
  if (webOrigin === '') {
    for (const [id, label] of corsRows) {
      items.push(
        makeItem(
          id,
          label,
          STATUS.SKIP,
          '画面の接続元が渡されていない（--web-origin か SWA_BASE_URL）',
        ),
      );
    }
  } else {
    const allowed = await call(meterPath, { headers: { Origin: webOrigin } });
    const denied = await call(meterPath, { headers: { Origin: UNKNOWN_ORIGIN } });
    const preflight = await call('/api/v1/reset', {
      method: 'OPTIONS',
      headers: {
        Origin: webOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-presenter-key',
      },
    });
    const header = (result, name) => result.headers?.get(name) ?? '';
    const judged = [
      allowed.ok
        ? judgeCorsAllow({
            allowOrigin: header(allowed, 'access-control-allow-origin'),
            origin: webOrigin,
          })
        : { ok: false, detail: allowed.error },
      denied.ok
        ? judgeCorsDeny({ allowOrigin: header(denied, 'access-control-allow-origin') })
        : { ok: false, detail: denied.error },
      preflight.ok
        ? judgePreflight({
            status: preflight.status,
            allowOrigin: header(preflight, 'access-control-allow-origin'),
            allowHeaders: header(preflight, 'access-control-allow-headers'),
            origin: webOrigin,
          })
        : { ok: false, detail: preflight.error },
    ];
    corsRows.forEach(([id, label], index) => items.push(passFail(id, label, judged[index])));
  }

  // ⑤ 応答の時間（合否にしない）
  const timing = judgeTiming({ times });
  items.push(
    makeItem('api.timing', '応答の時間', timing.slow ? STATUS.WARN : STATUS.PASS, timing.detail),
  );

  // 書き込み（--write のときだけ）。試験用の公演に、毎回新しい端末の番号で送る
  if (write) items.push(...(await runWriteChecks({ call })));
  return items;
}

/** 申し込み（joins）の確認。発表に使う公演には、送らない（assertTestPerformance が止める） */
async function runWriteChecks({ call }) {
  const performanceId = TEST_PERFORMANCE_ID;
  assertTestPerformance(performanceId);
  const base = `/api/v1/performances/${performanceId}`;
  const rows = [
    ['api.write.first', '申し込み 1 回目: counted が true'],
    ['api.write.second', '同じ端末の 2 回目: counted が false'],
    ['api.write.count', '人数が 1 だけ増える'],
  ];
  const skipAll = (reason) => rows.map(([id, label]) => makeItem(id, label, STATUS.SKIP, reason));
  const before = await call(`${base}/meter`);
  if (!before.ok || before.status !== 200 || typeof before.body?.joined !== 'number') {
    return skipAll('申し込みの前の人数を取れなかったため飛ばした');
  }
  // 端末の番号は、毎回新しく作る（16〜64 字の英数字・_・-。個人に結びつかない乱数）
  const post = (deviceId) =>
    call(`${base}/joins`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ deviceId }),
    });
  const deviceId = `accept-${randomUUID()}`;
  const firstJoin = await post(deviceId);
  const secondJoin = await post(deviceId);
  const after = await call(`${base}/meter`);
  const judge = (result, expectCounted) =>
    result.ok
      ? judgeJoin({ status: result.status, body: result.body, performanceId, expectCounted })
      : { ok: false, detail: result.error };
  return [
    passFail(rows[0][0], rows[0][1], judge(firstJoin, true)),
    passFail(rows[1][0], rows[1][1], judge(secondJoin, false)),
    after.ok && typeof after.body?.joined === 'number'
      ? passFail(
          rows[2][0],
          rows[2][1],
          judgeCountIncrease({ before: before.body.joined, after: after.body.joined }),
        )
      : makeItem(rows[2][0], rows[2][1], STATUS.FAIL, '申し込みのあとの人数を取れませんでした'),
  ];
}

/** URL（origin 以外が付いていても）を origin にする。URL でなければ空 */
export function originOf(raw) {
  return normalizeApiBase(raw);
}

if (isMain(import.meta.url)) {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        api: { type: 'string' },
        'web-origin': { type: 'string' },
        write: { type: 'boolean', default: false },
      },
      allowPositionals: false,
    }));
  } catch (error) {
    console.error(`引数が正しくありません: ${error.message}`);
    process.exit(1);
  }
  const apiBase = normalizeApiBase(values.api ?? process.env.VITE_API_BASE);
  const fromFlag = originOf(values['web-origin']);
  const webOrigin = fromFlag || originOf(process.env.SWA_BASE_URL);
  const masks = [
    { url: apiBase, as: '<API>' },
    { url: webOrigin, as: fromFlag ? '<WEB>' : '<SWA>' },
  ];
  let items;
  if (apiBase === '') {
    items = [
      makeItem(
        'api.target',
        'API の接続先',
        STATUS.SKIP,
        'VITE_API_BASE（か --api）が渡されていない',
      ),
    ];
  } else {
    console.log(
      `API の確認を始めます（接続先: <API>。画面の接続元: ${webOrigin ? '指定あり' : '指定なし'}）`,
    );
    items = await runCheckApi({
      apiBase,
      webOrigin,
      write: values.write,
      lockVersion: readLock().coreVersion,
    });
  }
  const masked = items.map((item) => ({ ...item, detail: maskUrls(item.detail, masks) }));
  console.log(`\n${renderReport([{ title: 'API の確認（npm run check:api）', items: masked }])}`);
  process.exit(exitCodeOf(masked));
}
