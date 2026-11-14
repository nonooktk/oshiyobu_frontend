// npm run check:live — 画面が、API と実際に通信できていることを、実ブラウザ（手元の Google Chrome）で確かめる。
//
//   手元の画面（既定）: VITE_API_BASE を向けてビルド（dist-accept/）し、手元で配って開く
//     VITE_API_BASE=<API の接続先> npm run check:live
//   公開中の画面: SWA_BASE_URL（公開中の画面の URL）を環境変数で渡すと、それを開く
//     SWA_BASE_URL=<画面の URL> VITE_API_BASE=<API の接続先> npm run check:live
//   共有メーター（VITE_SHARED_METER=on）でビルドした画面を確かめるとき: --shared
//     （手元の画面は、VITE_SHARED_METER=on を付けてビルドする。公開中の画面は、そのビルドのはずとして確かめる）
//
// /・/fan/?p=4・/presenter/ を開き、次を確かめる:
//   ・コンソールのエラーが 0 件 ・失敗した通信が 0 件 ・札が 2 枚ある（「動作確認用のデモ画面です」「デモ用の架空データ」）
//   ・既定（ひとり体験）: /fan/ は API への通信が 0 件。/presenter/ の「接続を確認する」を押すと、GET /healthz が出て 200 が返り、
//     応答が CORS で許され、画面に「応答 N ms」が出る（CSP と CORS を通って、ブラウザから API に届いている証拠）。リセットは押さない
//   ・--shared: /fan/ から、メーターの取得（GET …/meter）が出て 200 が返り、応答が CORS で許されている。接続の確認も同じ
//   申し込みのボタンは押さない。
// URL は出力に出さない（<SWA>・<LOCAL>・<API> に置き換える）。Chrome の指定は、環境変数 ACCEPT_CHANNEL（既定 chrome。
//   chromium にすると、Playwright 同梱のブラウザ）。手元の画面の番号は --web-port（既定 5295）。
//   終了コード: 0 = すべて合格 / 1 = 不合格あり / 2 = 不合格はないが飛ばした項目がある
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { pageText } from '../src/presenter/text/page.ts';
import { normalizeApiBase } from '../src/shared/meter/apiBase.ts';
import {
  DEFAULT_WEB_PORT,
  STATUS,
  exitCodeOf,
  makeItem,
  maskUrls,
  renderReport,
} from './accept-lib.mjs';
import {
  isMain,
  isPortFree,
  onInterrupt,
  runNpm,
  startBackground,
  waitForHttp,
} from './accept-run.mjs';
import {
  isApiRequestUrl,
  isHealthUrl,
  isMeterUrl,
  judgeLiveMeter,
  judgePresenterHealth,
  judgeSoloFan,
  parseShownMs,
} from './api-check-lib.mjs';
import { ROOT } from './core-lib.mjs';

/** 開く 3 ページ（?p=4 は、基準の人物 4 の指定。e2e/csp.spec.ts と同じ） */
const PAGES = [
  { id: 'live.page.office', label: '/ （事務所向け）', path: '/', fan: false },
  { id: 'live.page.fan', label: '/fan/?p=4（ファン向け）', path: '/fan/?p=4', fan: true },
  {
    id: 'live.page.presenter',
    label: '/presenter/（発表者用）',
    path: '/presenter/',
    fan: false,
    presenter: true,
  },
];
/** 全画面に出す札 2 枚（src/shared/components/DemoBadge.tsx の文言。消さない決まり） */
const BADGES = ['動作確認用のデモ画面です', 'デモ用の架空データ'];
/** 接続の確認の結果の文（src/presenter/text/page.ts）。「応答 N ms」の N を読む前後の文字を、文言から取り出す */
const MS_MARK = 1234567;
const [HEALTH_PREFIX, HEALTH_SUFFIX] = pageText.healthOk(MS_MARK).split(String(MS_MARK));
const SETTLE_MS = 2500;
const METER_WAIT_MS = 10_000;

/**
 * 1 ページを開いて、確かめる。申し込みもリセットも押さない（発表者用だけ、「接続を確認する」を押す）。
 * 結果は { errors, failed, meter, meterFailures, apiRequests, health, missingBadges }
 */
async function inspectPage(browser, { base, path, fan, presenter, shared, mask, apiOrigin }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 812 } });
  try {
    const page = await context.newPage();
    const pageOrigin = new URL(base).origin;
    const errors = [];
    const failed = [];
    const meter = [];
    const meterFailures = [];
    const apiRequests = [];
    const health = { responses: [], failures: [], shownMs: null };
    const clip = (text) => mask(text).replace(/\s+/g, ' ').slice(0, 140);
    const toApi = (url) => isApiRequestUrl(url, { apiOrigin, pageOrigin });
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(clip(message.text()));
    });
    page.on('pageerror', (error) => errors.push(clip(`pageerror: ${error.message}`)));
    // API への通信は、URL ではなく、メソッドとパスだけを持つ（出力に URL を出さない）
    page.on('request', (request) => {
      if (toApi(request.url())) {
        apiRequests.push({ method: request.method(), path: new URL(request.url()).pathname });
      }
    });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? '';
      failed.push(clip(`失敗 ${request.url()} ${reason}`));
      if (isMeterUrl(request.url())) meterFailures.push(clip(reason));
      if (toApi(request.url()) && isHealthUrl(request.url())) health.failures.push(clip(reason));
    });
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(clip(`${response.status()} ${response.url()}`));
      const seen = {
        status: response.status(),
        allowOrigin: response.headers()['access-control-allow-origin'] ?? '',
        origin: new URL(response.url()).origin,
      };
      if (isMeterUrl(response.url()) && response.request().method() === 'GET') meter.push(seen);
      if (toApi(response.url()) && isHealthUrl(response.url())) health.responses.push(seen);
    });
    // 共有メーターのファン向けは、開いた直後に出るメーターの取得を待つ（出なければ、待ち切って、不合格にする）
    const meterSeen =
      fan && shared
        ? page
            .waitForResponse((response) => isMeterUrl(response.url()), { timeout: METER_WAIT_MS })
            .catch(() => null)
        : null;
    await page.goto(`${base}${path}`, { waitUntil: 'load' });
    if (meterSeen) await meterSeen;
    await page.waitForTimeout(SETTLE_MS);
    if (presenter) {
      // 「接続を確認する」だけを押す（リセットの 2 段の確認には、触れない）
      const healthSeen = page
        .waitForResponse((response) => isHealthUrl(response.url()), { timeout: METER_WAIT_MS })
        .catch(() => null);
      await page.getByRole('button', { name: pageText.check }).click();
      await healthSeen;
      await page
        .getByText(new RegExp(`${HEALTH_PREFIX}|${pageText.healthNg}`))
        .first()
        .waitFor({ timeout: METER_WAIT_MS })
        .catch(() => null);
      health.shownMs = parseShownMs(
        await page.locator('body').innerText(),
        HEALTH_PREFIX,
        HEALTH_SUFFIX,
      );
    }
    const text = await page.locator('body').innerText();
    const missingBadges = BADGES.filter((badge) => !text.includes(badge));
    return { errors, failed, meter, meterFailures, apiRequests, health, missingBadges };
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
  for (const badge of result.missingBadges) problems.push(`札「${badge}」がありません`);
  return problems.length === 0
    ? makeItem(id, label, STATUS.PASS, 'エラー 0・失敗した通信 0・札 2 枚あり')
    : makeItem(id, label, STATUS.FAIL, problems.join('／'));
}

/**
 * 画面と API の通信を確かめて、{ items } を返す。
 *   publishedBase があれば、公開中の画面を開く。無ければ、apiBase を向けてビルドした画面を、手元で配って開く
 *   apiBase は、API の接続先（origin）。手元の画面には必須（ビルドに入れる）。公開中の画面では、通信先の確認に使う
 *   shared が真なら、共有メーター（VITE_SHARED_METER=on）でビルドした画面として確かめる。偽（既定）は、ひとり体験
 */
export async function runCheckLive({
  apiBase = '',
  publishedBase = '',
  webPort = DEFAULT_WEB_PORT,
  channel = 'chrome',
  shared = false,
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
  // 自分が起動した配るサーバーとブラウザは、終わったときも、中断されたときも、自分で止める
  const closeAll = async () => {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.stop();
  };
  const unregister = onInterrupt(closeAll);
  try {
    let base = publishedBase;
    if (!published) {
      log(
        `手元の画面をビルドします（API の接続先を入れ、${shared ? '共有メーター（VITE_SHARED_METER=on）' : 'ひとり体験（既定）'}で dist-accept/ に出力）...`,
      );
      // 共有メーターかどうかは、このビルドの指定だけで決める（自分の環境変数の VITE_SHARED_METER は、持ち込まない）
      const buildEnv = { ...process.env, VITE_API_BASE: apiBase };
      if (shared) buildEnv.VITE_SHARED_METER = 'on';
      else delete buildEnv.VITE_SHARED_METER;
      const build = await runNpm(
        ['run', 'build', '--', '--outDir', 'dist-accept', '--emptyOutDir'],
        {
          cwd: ROOT,
          env: buildEnv,
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
    const pageOrigin = new URL(base).origin;
    let fanResult = null;
    let presenterResult = null;
    for (const spec of PAGES) {
      const result = await inspectPage(browser, {
        base,
        path: spec.path,
        fan: spec.fan,
        presenter: spec.presenter === true,
        shared,
        mask,
        apiOrigin: apiBase,
      });
      items.push(pageItem(spec, result));
      if (spec.fan) fanResult = result;
      if (spec.presenter) presenterResult = result;
    }
    const verdict = (judged) => (judged.ok ? STATUS.PASS : STATUS.FAIL);
    if (shared) {
      const judged = judgeLiveMeter({
        responses: fanResult?.meter ?? [],
        failures: fanResult?.meterFailures ?? [],
        pageOrigin,
        apiOrigin: apiBase,
      });
      items.push(
        makeItem(
          'live.meter',
          '/fan/ からメーターの取得が出て 200・CORS で許されている（共有メーター）',
          verdict(judged),
          judged.detail,
        ),
      );
    } else {
      const judged = judgeSoloFan({ apiRequests: fanResult?.apiRequests ?? [] });
      items.push(
        makeItem(
          'live.fan.solo',
          '/fan/ は API への通信が 0 件（ひとり体験）',
          verdict(judged),
          judged.detail,
        ),
      );
    }
    const health = presenterResult?.health ?? { responses: [], failures: [], shownMs: null };
    const judgedHealth = judgePresenterHealth({ ...health, pageOrigin, apiOrigin: apiBase });
    items.push(
      makeItem(
        'live.presenter.health',
        '/presenter/ の「接続を確認する」: /healthz が 200・CORS で許され、応答の時間が出る',
        verdict(judgedHealth),
        judgedHealth.detail,
      ),
    );
    return items;
  } finally {
    unregister();
    await closeAll();
  }
}

if (isMain(import.meta.url)) {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        api: { type: 'string' },
        'web-port': { type: 'string' },
        shared: { type: 'boolean', default: false },
      },
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
    shared: values.shared,
  });
  console.log(`\n${renderReport([{ title: '画面と API の通信（npm run check:live）', items }])}`);
  process.exit(exitCodeOf(items));
}
