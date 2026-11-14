// npm run accept — 検収を 1 つにまとめた入口。verify → check:api → check:live の順に実行して、最後に項目ごとの表を出す。
//
//   手元だけで閉じる（担当者の標準）:  npm run accept -- --local-api
//     core.lock.json の版の API を手元で立て（npm run api:local と同じ）、手元の画面をつないで、申し込みの動きまで確かめる
//   公開中の API・画面を確かめる（管理者が値を渡したとき）:
//     VITE_API_BASE=<API の接続先> SWA_BASE_URL=<画面の URL> npm run accept
//   手元の画面から、すでにある API を確かめる:  VITE_API_BASE=<API の接続先> npm run accept
//     （その API が、手元の画面の接続元 http://127.0.0.1:<web-port> を CORS で許していないと、不合格になる）
//
// API の接続先が渡されていなければ、通信の確認は「飛ばした」と出す（判定は「未完了」。合格とは紛れない）。
// --write: 試験用の公演に、申し込みを 1 回送って確かめる（--local-api のときは自動でつく。公開中の API には、管理者の指示があるときだけ）。
// 終了コード: 0 = すべて合格 / 1 = 不合格あり / 2 = 不合格はないが、飛ばした項目がある（合格ではない）
import { parseArgs } from 'node:util';
import { normalizeApiBase } from '../src/shared/meter/apiBase.ts';
import {
  DEFAULT_API_PORT,
  DEFAULT_WEB_PORT,
  STATUS,
  exitCodeOf,
  makeItem,
  maskUrls,
  renderReport,
} from './accept-lib.mjs';
import { isMain } from './accept-run.mjs';
import { runCheckApi } from './check-api.mjs';
import { runCheckLive } from './check-live.mjs';
import { readLock } from './core-lib.mjs';
import { startLocalApi } from './local-api.mjs';
import { runVerify } from './verify.mjs';

if (isMain(import.meta.url)) {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        'local-api': { type: 'boolean', default: false },
        write: { type: 'boolean', default: false },
        api: { type: 'string' },
        'api-port': { type: 'string' },
        'web-port': { type: 'string' },
      },
      allowPositionals: false,
    }));
  } catch (error) {
    console.error(`引数が正しくありません: ${error.message}`);
    process.exit(1);
  }
  const webPort = Number(values['web-port'] ?? DEFAULT_WEB_PORT);
  const channel = process.env.ACCEPT_CHANNEL || 'chrome';
  let local = null;
  const stopLocal = async () => {
    if (local) await local.stop();
    local = null;
  };
  process.on('SIGINT', async () => {
    await stopLocal();
    process.exit(130);
  });

  // ① 手元の検査
  console.log('【1/3】手元の検査（npm run verify）を実行します');
  const verifyItems = await runVerify({ echo: true });

  // ② どの API・画面を相手にするか決める
  let apiBase = '';
  let publishedBase = '';
  let webOrigin = `http://127.0.0.1:${webPort}`;
  let write = values.write;
  const earlyItems = [];
  if (values['local-api']) {
    console.log('\n手元の API を立てます（初回は、取得とビルドに 1 分ほどかかります）...');
    try {
      local = await startLocalApi({
        port: Number(values['api-port'] ?? DEFAULT_API_PORT),
        webPort,
      });
      apiBase = local.origin;
      write = true;
    } catch (error) {
      earlyItems.push(makeItem('api.local', '手元の API を立てる', STATUS.FAIL, error.message));
    }
  } else {
    apiBase = normalizeApiBase(values.api ?? process.env.VITE_API_BASE);
    publishedBase = normalizeApiBase(process.env.SWA_BASE_URL);
    if (publishedBase !== '') webOrigin = publishedBase;
  }
  const masks = [
    { url: apiBase, as: '<API>' },
    { url: publishedBase, as: '<SWA>' },
  ];

  try {
    // ③ API の確認
    console.log('\n【2/3】API の確認（npm run check:api）を実行します');
    const apiItems =
      apiBase === ''
        ? earlyItems.length > 0
          ? earlyItems
          : [
              makeItem(
                'api.target',
                'API の接続先',
                STATUS.SKIP,
                'VITE_API_BASE（か --api）が渡されていない。--local-api なら手元の API で確かめられる',
              ),
            ]
        : await runCheckApi({
            apiBase,
            webOrigin,
            write,
            lockVersion: readLock().coreVersion,
          });

    // ④ 画面と API の通信
    console.log('\n【3/3】画面と API の通信（npm run check:live）を実行します');
    const liveItems =
      earlyItems.length > 0
        ? [
            makeItem(
              'live.target',
              '画面と API の通信',
              STATUS.SKIP,
              '手元の API を立てられなかったため飛ばした',
            ),
          ]
        : await runCheckLive({ apiBase, publishedBase, webPort, channel });

    const sections = [
      { title: '手元の検査（npm run verify。CI と同じ検査）', items: verifyItems },
      { title: 'API の確認（npm run check:api）', items: apiItems },
      { title: '画面と API の通信（npm run check:live）', items: liveItems },
    ].map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, detail: maskUrls(item.detail, masks) })),
    }));
    console.log(`\n${renderReport(sections)}`);
    const code = exitCodeOf(sections.flatMap((section) => section.items));
    await stopLocal();
    process.exit(code);
  } finally {
    await stopLocal();
  }
}
