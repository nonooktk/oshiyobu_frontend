// npm run check:live — 画面が、API と実際に通信できていることを、実ブラウザ（手元の Google Chrome）で確かめる。
//
//   手元の画面（既定）: VITE_API_BASE を向けてビルド（dist-accept/）し、手元で配って開く
//     VITE_API_BASE=<API の接続先> npm run check:live
//   公開中の画面: SWA_BASE_URL（公開中の画面の URL）を環境変数で渡すと、それを開く
//     SWA_BASE_URL=<画面の URL> VITE_API_BASE=<API の接続先> npm run check:live
//
// /・/fan/?p=4・/presenter/ を開き、次を確かめる（申し込みのボタンは押さない）:
//   ・コンソールのエラーが 0 件 ・失敗した通信が 0 件 ・札「デモ用の架空データ」がある
//   ・/fan/ から、メーターの取得（GET …/meter）が出て 200 が返り、応答が CORS で許されている
//     （CSP と CORS を通って、ブラウザから API に届いている証拠）
// URL は出力に出さない（<SWA>・<LOCAL>・<API> に置き換える）。Chrome の指定は、環境変数 ACCEPT_CHANNEL（既定 chrome。
//   chromium にすると、Playwright 同梱のブラウザ）。手元の画面の番号は --web-port（既定 5295）。
//   終了コード: 0 = すべて合格 / 1 = 不合格あり / 2 = 不合格はないが飛ばした項目がある
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { normalizeApiBase } from '../src/shared/meter/apiBase.ts';
import {
  DEFAULT_WEB_PORT,
  STATUS,
  exitCodeOf,
  makeItem,
  maskUrls,
  renderReport,
} from './accept-lib.mjs';
import { isMain, isPortFree, runNpm, startBackground, waitForHttp } from './accept-run.mjs';
import { isMeterUrl, judgeLiveMeter } from './api-check-lib.mjs';
import { ROOT } from './core-lib.mjs';

/** 開く 3 ページ（?p=4 は、基準の人物 4 の指定。e2e/csp.spec.ts と同じ） */
const PAGES = [
  { id: 'live.page.office', label: '/ （事務所向け）', path: '/', fan: false },
  { id: 'live.page.fan', label: '/fan/?p=4（ファン向け）', path: '/fan/?p=4', fan: true },
  { id: 'live.page.presenter', label: '/presenter/（発表者用）', path: '/presenter/', fan: false },
];
const BADGE = 'デモ用の架空データ';
const SETTLE_MS = 2500;
const METER_WAIT_MS = 10_000;

/** 1 ページを開いて、読み取りだけ確かめる。結果は { errors, failed, meter, badge } */
async function inspectPage(browser, { base, path, fan, mask }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 812 } });
  try {
    const page = await context.newPage();
    const errors = [];
    const failed = [];
    const meter = [];
    const meterFailures = [];
    const clip = (text) => mask(text).replace(/\s+/g, ' ').slice(0, 140);
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(clip(message.text()));
    });
    page.on('pageerror', (error) => errors.push(clip(`pageerror: ${error.message}`)));
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? '';
      failed.push(clip(`失敗 ${request.url()} ${reason}`));
      if (isMeterUrl(request.url())) meterFailures.push(clip(reason));
    });
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(clip(`${response.status()} ${response.url()}`));
      if (isMeterUrl(response.url()) && response.request().method() === 'GET') {
        meter.push({
          status: response.status(),
          allowOrigin: response.headers()['access-control-allow-origin'] ?? '',
          origin: new URL(response.url()).origin,
        });
      }
    });
    // ファン向けは、開いた直後に出るメーターの取得を待つ（出なければ、待ち切って、不合格にする）
    const meterSeen = fan
      ? page
          .waitForResponse((response) => isMeterUrl(response.url()), { timeout: METER_WAIT_MS })
          .catch(() => null)
      : null;
    await page.goto(`${base}${path}`, { waitUntil: 'load' });
    if (meterSeen) await meterSeen;
    await page.waitForTimeout(SETTLE_MS);
    const badge = (await page.locator('body').innerText()).includes(BADGE);
    return { errors, failed, meter, meterFailures, badge };
  } finally {
    await context.close();
  }
}

/** 1 ページの結果を、1 行の項目にする */
function pageItem({ id, label }, result) {
  const problems = [];
  if (result.errors.length > 0) {
    problems.push(`コンソールのエラー ${result.errors.length} 件（先頭: ${result.errors[0]}）`);
  }
  if (result.failed.length > 0) {
    problems.push(`失敗した通信 ${result.failed.length} 件（先頭: ${result.failed[0]}）`);
  }
  if (!result.badge) problems.push(`札「${BADGE}」がありません`);
  return problems.length === 0
    ? makeItem(id, label, STATUS.PASS, `エラー 0・失敗した通信 0・札あり`)
    : makeItem(id, label, STATUS.FAIL, problems.join('／'));
}

/**
 * 画面と API の通信を確かめて、{ items } を返す。
 *   publishedBase があれば、公開中の画面を開く。無ければ、apiBase を向けてビルドした画面を、手元で配って開く
 *   apiBase は、API の接続先（origin）。手元の画面には必須（ビルドに入れる）。公開中の画面では、取得先の確認に使う
 */
export async function runCheckLive({
  apiBase = '',
  publishedBase = '',
  webPort = DEFAULT_WEB_PORT,
  channel = 'chrome',
  log = console.log,
}) {
  const published = publishedBase !== '';
  if (!published && apiBase === '') {
    return [
      makeItem(
        'live.target',
        '画面と API の通信',
        STATUS.SKIP,
        'VITE_API_BASE（手元の画面）か SWA_BASE_URL（公開中の画面）が渡されていない',
      ),
    ];
  }
  const items = [];
  let server = null;
  let browser = null;
  try {
    let base = publishedBase;
    if (!published) {
      log('手元の画面をビルドします（API の接続先を入れて dist-accept/ に出力）...');
      const build = await runNpm(
        ['run', 'build', '--', '--outDir', 'dist-accept', '--emptyOutDir'],
        {
          cwd: ROOT,
          env: { ...process.env, VITE_API_BASE: apiBase },
        },
      );
      if (build.code !== 0) {
        items.push(
          makeItem(
            'live.build',
            '手元の画面のビルド',
            STATUS.FAIL,
            `終了コード ${build.code}`,
            [],
            build.output,
          ),
        );
        return items;
      }
      if (!(await isPortFree(webPort))) {
        items.push(
          makeItem(
            'live.build',
            '手元の画面を配る',
            STATUS.FAIL,
            `ポート ${webPort} は、すでに使われています（--web-port で別の番号を）`,
          ),
        );
        return items;
      }
      base = `http://127.0.0.1:${webPort}`;
      server = startBackground(process.execPath, [join(ROOT, 'e2e', 'server.mjs')], {
        cwd: ROOT,
        env: { ...process.env, E2E_DIST: 'dist-accept', E2E_PORT: String(webPort) },
      });
      if (
        !(await waitForHttp(`${base}/index.html`, { isAlive: server.isAlive, timeoutMs: 15_000 }))
      ) {
        items.push(
          makeItem(
            'live.build',
            '手元の画面を配る',
            STATUS.FAIL,
            '配るサーバーが起動しませんでした',
            [],
            server.output(),
          ),
        );
        return items;
      }
    }
    const mask = (text) =>
      maskUrls(text, [
        { url: apiBase, as: '<API>' },
        { url: base, as: published ? '<SWA>' : '<LOCAL>' },
      ]);
    try {
      browser = await chromium.launch({
        channel: channel === 'chromium' ? undefined : channel,
        headless: true,
      });
    } catch (error) {
      const first = String(error.message).split('\n')[0];
      items.push(
        makeItem(
          'live.browser',
          'ブラウザ（Chrome）の起動',
          STATUS.FAIL,
          mask(first).slice(0, 160),
        ),
      );
      return items;
    }
    log(
      `ブラウザで ${PAGES.length} ページを開きます（${published ? '公開中の画面' : '手元の画面'}）...`,
    );
    let fanResult = null;
    for (const spec of PAGES) {
      const result = await inspectPage(browser, { base, path: spec.path, fan: spec.fan, mask });
      items.push(pageItem(spec, result));
      if (spec.fan) fanResult = result;
    }
    const judged = judgeLiveMeter({
      responses: fanResult?.meter ?? [],
      failures: fanResult?.meterFailures ?? [],
      pageOrigin: new URL(base).origin,
      apiOrigin: apiBase,
    });
    items.push(
      makeItem(
        'live.meter',
        '/fan/ からメーターの取得が出て 200・CORS で許されている',
        judged.ok ? STATUS.PASS : STATUS.FAIL,
        judged.detail,
      ),
    );
    return items;
  } finally {
    if (browser) await browser.close();
    if (server) await server.stop();
  }
}

if (isMain(import.meta.url)) {
  let values;
  try {
    ({ values } = parseArgs({
      options: { api: { type: 'string' }, 'web-port': { type: 'string' } },
      allowPositionals: false,
    }));
  } catch (error) {
    console.error(`引数が正しくありません: ${error.message}`);
    process.exit(1);
  }
  const apiBase = normalizeApiBase(values.api ?? process.env.VITE_API_BASE);
  const publishedBase = normalizeApiBase(process.env.SWA_BASE_URL);
  const webPort = Number(values['web-port'] ?? DEFAULT_WEB_PORT);
  const items = await runCheckLive({
    apiBase,
    publishedBase,
    webPort,
    channel: process.env.ACCEPT_CHANNEL || 'chrome',
  });
  console.log(`\n${renderReport([{ title: '画面と API の通信（npm run check:live）', items }])}`);
  process.exit(exitCodeOf(items));
}
