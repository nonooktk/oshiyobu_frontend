// 「ひとり体験」の実ブラウザでの通し（npm run e2e:solo）を、検収の 1 項目として回す（accept が使う）。
// はじめの画面（推し → コース）→ 推し活定期をはじめる → 預金を積み増す → 申し込む → 80% の演出 → 仲間を呼ぶ → 成立の演出 → 閉じて開き直す。偽の API への通信は 0 件であることも、その台本が確かめる。
// e2e:solo は、自分でビルド（dist-solo/）して、ページ 5297・偽の API 8798 を立てる（playwright.solo.config.ts）。
// 検収の手元の API・画面（8795・5295）とは別の番号なので、続けて回せる。
import { STATUS, makeItem } from './accept-lib.mjs';
import { isPortFree, runNpm } from './accept-run.mjs';
import { ROOT } from './core-lib.mjs';

/** e2e:solo が使う番号（playwright.solo.config.ts のページと偽の API。そちらを変えたら、ここも変える） */
export const SOLO_PORTS = [5297, 8798];
export const SOLO_LABEL = 'ひとり体験の通し（npm run e2e:solo。実ブラウザ・幅 390px）';

/** 通しを回して、項目を 1 つ返す。番号が使用中なら、回さずに「飛ばした」 */
export async function runCheckSolo({ log = console.log } = {}) {
  for (const port of SOLO_PORTS) {
    if (!(await isPortFree(port))) {
      return makeItem(
        'live.solo',
        SOLO_LABEL,
        STATUS.SKIP,
        `ポート ${port} が使用中のため飛ばした（e2e:solo が使う番号）`,
      );
    }
  }
  log('ひとり体験の通し（npm run e2e:solo）を実行します（ビルドと実ブラウザの操作。20 秒ほど）...');
  const { code, output, ms } = await runNpm(['run', 'e2e:solo'], { cwd: ROOT });
  const passed = /(\d+) passed/.exec(output)?.[1];
  const seconds = (ms / 1000).toFixed(1);
  return code === 0
    ? makeItem(
        'live.solo',
        SOLO_LABEL,
        STATUS.PASS,
        `${passed ?? '?'} 件のシナリオが通った（${seconds} 秒）`,
      )
    : makeItem(
        'live.solo',
        SOLO_LABEL,
        STATUS.FAIL,
        `終了コード ${code}（${seconds} 秒）`,
        [],
        output,
      );
}
