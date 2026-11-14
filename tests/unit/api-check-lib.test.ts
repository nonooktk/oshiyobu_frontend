// @vitest-environment node
// API の応答の判定（scripts/api-check-lib.mjs）。契約の正本は src/core/schema/meter.ts で、写しがずれていないことも確かめる
import { describe, expect, it } from 'vitest';
import {
  SLOW_MS,
  UNKNOWN_ORIGIN,
  isApiRequestUrl,
  isHealthUrl,
  isMeterUrl,
  judgeCorsAllow,
  judgeCorsDeny,
  judgeCountIncrease,
  judgeHealth,
  judgeJoin,
  judgeLiveMeter,
  judgeMeter,
  judgeNotFound,
  judgePreflight,
  judgePresenterHealth,
  judgeSoloFan,
  judgeTiming,
  meterBodyErrors,
  parseShownMs,
} from '../../scripts/api-check-lib.mjs';
import { parseJoinResponse, parseMeterResponse } from '../../src/core';
import { pageText } from '../../src/presenter/text/page';

const PID = 'terao:KGS-001';
const WEB = 'https://web.example.test';

describe('メーターの本文の形（core の parseMeterResponse と同じ決まり）', () => {
  const samples: [string, unknown][] = [
    ['正しい（reset なし）', { performanceId: PID, joined: 0, resetAt: null }],
    [
      '正しい（reset あり）',
      { performanceId: PID, joined: 12, resetAt: '2026-11-14T01:02:03.456Z' },
    ],
    ['正しい（ミリ秒なし）', { performanceId: PID, joined: 1, resetAt: '2026-11-14T01:02:03Z' }],
    [
      '知らない項目つきでも、決まった項目が正しければ通る',
      { performanceId: PID, joined: 3, resetAt: null, extra: 1 },
    ],
    ['joined が負', { performanceId: PID, joined: -1, resetAt: null }],
    ['joined が小数', { performanceId: PID, joined: 1.5, resetAt: null }],
    ['joined が文字列', { performanceId: PID, joined: '1', resetAt: null }],
    ['joined が無い', { performanceId: PID, resetAt: null }],
    ['resetAt が時刻でない文字列', { performanceId: PID, joined: 0, resetAt: 'きのう' }],
    ['resetAt が日付だけ', { performanceId: PID, joined: 0, resetAt: '2026-11-14' }],
    ['resetAt が無い', { performanceId: PID, joined: 0 }],
    ['公演が違う', { performanceId: 'terao:KGS-002', joined: 0, resetAt: null }],
    ['公演が一覧に無い', { performanceId: 'no:such', joined: 0, resetAt: null }],
    ['配列', []],
    ['null', null],
    ['文字列', 'x'],
  ];

  it.each(samples)('%s: 台本の判定と、core の検査が一致する', (_name, body) => {
    const ours = meterBodyErrors(body, PID).length === 0;
    const core = parseMeterResponse(body);
    const coreOk = core !== null && (body as { performanceId?: string }).performanceId === PID;
    expect(ours).toBe(coreOk);
  });

  it('申し込みの応答（counted つき）も、core の検査と一致する', () => {
    const good = { performanceId: PID, joined: 1, resetAt: null, counted: true };
    expect(parseJoinResponse(good)).not.toBeNull();
    expect(judgeJoin({ status: 200, body: good, performanceId: PID, expectCounted: true }).ok).toBe(
      true,
    );
    const noCounted = { performanceId: PID, joined: 1, resetAt: null };
    expect(parseJoinResponse(noCounted)).toBeNull();
    expect(
      judgeJoin({ status: 200, body: noCounted, performanceId: PID, expectCounted: true }).ok,
    ).toBe(false);
  });
});

describe('API の判定', () => {
  it('/healthz: 200・ok・coreVersion が lock と同じなら合格。版が違う・200 でない・ok でないは不合格', () => {
    const body = { ok: true, coreVersion: '0.2.0' };
    expect(judgeHealth({ status: 200, body, lockVersion: '0.2.0' }).ok).toBe(true);
    const stale = judgeHealth({ status: 200, body, lockVersion: '0.3.0' });
    expect(stale.ok).toBe(false);
    expect(stale.detail).toContain('0.2.0');
    expect(stale.detail).toContain('0.3.0');
    expect(judgeHealth({ status: 503, body, lockVersion: '0.2.0' }).ok).toBe(false);
    expect(judgeHealth({ status: 200, body: { ok: false }, lockVersion: '0.2.0' }).ok).toBe(false);
    expect(judgeHealth({ status: 200, body: null, lockVersion: '0.2.0' }).ok).toBe(false);
  });

  it('メーター: 200 で形が決まりどおりなら合格。200 でない・形が違うは不合格', () => {
    const body = { performanceId: PID, joined: 0, resetAt: null };
    expect(judgeMeter({ status: 200, body, performanceId: PID }).ok).toBe(true);
    expect(judgeMeter({ status: 500, body, performanceId: PID }).ok).toBe(false);
    expect(judgeMeter({ status: 200, body: { ...body, joined: -2 }, performanceId: PID }).ok).toBe(
      false,
    );
  });

  it('存在しない公演は 404 だけが合格', () => {
    expect(judgeNotFound({ status: 404 }).ok).toBe(true);
    expect(judgeNotFound({ status: 200 }).ok).toBe(false);
    expect(judgeNotFound({ status: 500 }).ok).toBe(false);
  });

  it('CORS: 画面の接続元（または *）を許せば合格。無い・別の接続元は不合格', () => {
    expect(judgeCorsAllow({ allowOrigin: WEB, origin: WEB }).ok).toBe(true);
    expect(judgeCorsAllow({ allowOrigin: '*', origin: WEB }).ok).toBe(true);
    expect(judgeCorsAllow({ allowOrigin: '', origin: WEB }).ok).toBe(false);
    expect(judgeCorsAllow({ allowOrigin: 'https://other.example.test', origin: WEB }).ok).toBe(
      false,
    );
  });

  it('CORS: 知らない接続元は、許可の印が付かなければ合格。許す・* は不合格', () => {
    expect(judgeCorsDeny({ allowOrigin: '' }).ok).toBe(true);
    expect(judgeCorsDeny({ allowOrigin: WEB }).ok).toBe(true);
    expect(judgeCorsDeny({ allowOrigin: UNKNOWN_ORIGIN }).ok).toBe(false);
    expect(judgeCorsDeny({ allowOrigin: '*' }).ok).toBe(false);
  });

  it('CORS の事前の問い合わせ: 2xx・接続元を許す・x-presenter-key を許す、が全部そろえば合格', () => {
    const base = {
      status: 204,
      allowOrigin: WEB,
      allowHeaders: 'Content-Type, X-Presenter-Key',
      origin: WEB,
    };
    expect(judgePreflight(base).ok).toBe(true);
    expect(judgePreflight({ ...base, status: 404 }).ok).toBe(false);
    expect(judgePreflight({ ...base, allowOrigin: '' }).ok).toBe(false);
    expect(judgePreflight({ ...base, allowHeaders: 'content-type' }).ok).toBe(false);
  });

  it('応答時間: 中央値が目安を超えたら slow（合否ではなく注意）。標本が少なくても動く', () => {
    expect(SLOW_MS).toBe(1000);
    expect(judgeTiming({ times: [10, 20, 30, 40, 50] }).slow).toBe(false);
    const slow = judgeTiming({ times: [1500, 2000, 1800] });
    expect(slow.slow).toBe(true);
    expect(slow.detail).toContain('1800');
    expect(judgeTiming({ times: [5] }).slow).toBe(false);
  });

  it('申し込み: counted が期待と違えば不合格。人数は、ちょうど 1 だけ増えれば合格', () => {
    const body = { performanceId: PID, joined: 1, resetAt: null, counted: false };
    expect(judgeJoin({ status: 200, body, performanceId: PID, expectCounted: false }).ok).toBe(
      true,
    );
    expect(judgeJoin({ status: 200, body, performanceId: PID, expectCounted: true }).ok).toBe(
      false,
    );
    expect(judgeJoin({ status: 409, body, performanceId: PID, expectCounted: false }).ok).toBe(
      false,
    );
    expect(judgeCountIncrease({ before: 4, after: 5 }).ok).toBe(true);
    expect(judgeCountIncrease({ before: 4, after: 4 }).ok).toBe(false);
    expect(judgeCountIncrease({ before: 4, after: 6 }).ok).toBe(false);
  });
});

describe('画面（ブラウザ）から見たメーターの取得', () => {
  it('メーターの URL を見分ける', () => {
    expect(isMeterUrl('https://api.example.test/api/v1/performances/terao:KGS-001/meter')).toBe(
      true,
    );
    expect(isMeterUrl('http://127.0.0.1:8795/api/v1/performances/tech0:cbox/meter?x=1')).toBe(true);
    expect(isMeterUrl('https://api.example.test/api/v1/performances/tech0:cbox/joins')).toBe(false);
    expect(isMeterUrl('https://api.example.test/healthz')).toBe(false);
  });

  const ok = { status: 200, allowOrigin: WEB, origin: 'https://api.example.test' };
  it('取得が出て、200 で、接続元が許されていれば合格', () => {
    expect(judgeLiveMeter({ responses: [ok], pageOrigin: WEB }).ok).toBe(true);
    expect(judgeLiveMeter({ responses: [{ ...ok, allowOrigin: '*' }], pageOrigin: WEB }).ok).toBe(
      true,
    );
  });

  it('取得が出ていない・200 でない・接続元を許していない・指定した API に出ていないは、不合格', () => {
    expect(judgeLiveMeter({ responses: [], pageOrigin: WEB }).ok).toBe(false);
    expect(judgeLiveMeter({ responses: [{ ...ok, status: 503 }], pageOrigin: WEB }).ok).toBe(false);
    expect(judgeLiveMeter({ responses: [{ ...ok, allowOrigin: '' }], pageOrigin: WEB }).ok).toBe(
      false,
    );
    const elsewhere = judgeLiveMeter({
      responses: [ok],
      pageOrigin: WEB,
      apiOrigin: 'https://another.example.test',
    });
    expect(elsewhere.ok).toBe(false);
    expect(
      judgeLiveMeter({ responses: [ok], pageOrigin: WEB, apiOrigin: 'https://api.example.test' })
        .ok,
    ).toBe(true);
  });
});

describe('ひとり体験（既定）のファン向け: API への通信が 0 件', () => {
  const API = 'https://api.example.test';
  const PAGE = 'https://web.example.test';
  const opts = { apiOrigin: API, pageOrigin: PAGE };

  it('API への通信かどうかを、API の接続先か、画面とは別の origin の /api/v1/・/healthz で見分ける', () => {
    expect(isApiRequestUrl(`${API}/api/v1/performances/tech0:cbox/meter`, opts)).toBe(true);
    expect(isApiRequestUrl(`${API}/healthz`, opts)).toBe(true);
    // 接続先が分からないとき（公開中の画面で VITE_API_BASE を渡さなかった）も、パスで見分ける
    expect(
      isApiRequestUrl('https://other.example.test/api/v1/performances/x:y/joins', {
        pageOrigin: PAGE,
      }),
    ).toBe(true);
    expect(isApiRequestUrl('https://other.example.test/healthz', { pageOrigin: PAGE })).toBe(true);
  });

  it('画面自身の配信（同じ origin）・外の通信・URL でないものは、API への通信に数えない', () => {
    expect(isApiRequestUrl(`${PAGE}/fan/index.html`, opts)).toBe(false);
    expect(isApiRequestUrl(`${PAGE}/healthz`, opts)).toBe(false);
    expect(isApiRequestUrl('https://fonts.example.test/a.woff2', opts)).toBe(false);
    expect(isApiRequestUrl('data:image/png;base64,AAAA', opts)).toBe(false);
    expect(isApiRequestUrl('URLではない', opts)).toBe(false);
  });

  it('0 件なら合格。1 件でもあれば不合格で、先頭の通信の種類とパスだけを出す（URL は出さない）', () => {
    expect(judgeSoloFan({ apiRequests: [] }).ok).toBe(true);
    const bad = judgeSoloFan({
      apiRequests: [
        { method: 'GET', path: '/api/v1/performances/tech0:cbox/meter' },
        { method: 'POST', path: '/api/v1/performances/tech0:cbox/joins' },
      ],
    });
    expect(bad.ok).toBe(false);
    expect(bad.detail).toContain('2 件');
    expect(bad.detail).toContain('GET /api/v1/performances/tech0:cbox/meter');
    expect(bad.detail).not.toContain('https://');
  });
});

describe('発表者用の「接続を確認する」', () => {
  const WEB = 'https://web.example.test';
  const API = 'https://api.example.test';
  const ok = { status: 200, allowOrigin: WEB, origin: API };
  const base = { responses: [ok], shownMs: 32, pageOrigin: WEB, apiOrigin: API };

  it('/healthz の URL を見分ける', () => {
    expect(isHealthUrl(`${API}/healthz`)).toBe(true);
    expect(isHealthUrl(`${API}/healthz/x`)).toBe(false);
    expect(isHealthUrl(`${API}/api/v1/performances/a:b/meter`)).toBe(false);
  });

  it('200・CORS で許される・画面に応答の時間が出る、がそろえば合格', () => {
    const judged = judgePresenterHealth(base);
    expect(judged.ok).toBe(true);
    expect(judged.detail).toContain('応答 32 ms');
    expect(judgePresenterHealth({ ...base, responses: [{ ...ok, allowOrigin: '*' }] }).ok).toBe(
      true,
    );
  });

  it('通信が出ていない・失敗した・指定した API に出ていない・200 でない・CORS で許されない・時間が出ないは、不合格', () => {
    expect(judgePresenterHealth({ ...base, responses: [], shownMs: null }).ok).toBe(false);
    const failed = judgePresenterHealth({
      ...base,
      responses: [],
      failures: ['net::ERR_CONNECTION_REFUSED'],
      shownMs: null,
    });
    expect(failed.ok).toBe(false);
    expect(failed.detail).toContain('ERR_CONNECTION_REFUSED');
    expect(judgePresenterHealth({ ...base, apiOrigin: 'https://another.example.test' }).ok).toBe(
      false,
    );
    expect(judgePresenterHealth({ ...base, responses: [{ ...ok, status: 503 }] }).ok).toBe(false);
    expect(judgePresenterHealth({ ...base, responses: [{ ...ok, allowOrigin: '' }] }).ok).toBe(
      false,
    );
    const noTime = judgePresenterHealth({ ...base, shownMs: null });
    expect(noTime.ok).toBe(false);
    expect(noTime.detail).toContain('応答の時間');
  });

  it('画面の文から「応答 N ms」の N を読む（前後の文字は、画面の文言から取る）', () => {
    const prefix = 'つながっています（応答 ';
    const suffix = ' ms）';
    expect(
      parseShownMs(`接続を確認する\nつながっています（応答 32 ms）\n操作の違い`, prefix, suffix),
    ).toBe(32);
    expect(parseShownMs('つながっていません', prefix, suffix)).toBeNull();
    expect(parseShownMs('つながっています（応答 abc ms）', prefix, suffix)).toBeNull();
    expect(parseShownMs('つながっています（応答 32', prefix, suffix)).toBeNull();
  });

  it('いまの画面の文言（src/presenter/text/page.ts）からも、時間を読める（画面の文言を変えたら、ここで気づく）', () => {
    const mark = 1234567;
    const [prefix, suffix] = pageText.healthOk(mark).split(String(mark));
    expect(prefix).toBeTruthy();
    expect(parseShownMs(pageText.healthOk(98), prefix as string, suffix as string)).toBe(98);
    expect(pageText.check).toBe('接続を確認する');
  });
});
