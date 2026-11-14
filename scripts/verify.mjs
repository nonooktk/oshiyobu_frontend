// npm run verify — CI（ci.yml）と配備（deploy.yml）が通している検査を、手元で順に実行する。
// 検査の中身は accept-lib.mjs の VERIFY_STEPS（CI も npm run verify でこれを呼ぶ。手元と CI がずれない）。
// 1 つ落ちても止めずに、ほかの検査も回し、最後に「どれが落ちたか・次に見る場所」を日本語でまとめる。
//   終了コード: 0 = すべて合格 / 1 = 不合格あり
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STATUS,
  VERIFY_STEPS,
  diagnoseTestOutput,
  listFailedTests,
  exitCodeOf,
  formatDuration,
  makeItem,
  parseTestCounts,
  renderReport,
  satisfiesNodeRange,
} from './accept-lib.mjs';
import { isMain, runNpm } from './accept-run.mjs';
import { ROOT } from './core-lib.mjs';

/** 前提: Node の版が、package.json の engines の範囲か。範囲の外でも動くことはあるので、不合格にはせず「注意」にする */
function nodeItem() {
  const range = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).engines?.node ?? '';
  // 表示では、|| を「または」にする（表の区切りと紛れないため）
  const shown = range.replace(/\s*\|\|\s*/g, ' または ');
  const inRange = satisfiesNodeRange(process.version, range);
  if (inRange === true) {
    return makeItem('verify.node', 'Node の版', STATUS.PASS, `${process.version}（要: ${shown}）`);
  }
  const reason =
    inRange === false
      ? `${process.version} は範囲の外です（要: ${shown}）。動いても、CI と同じ結果とは限りません`
      : `範囲を読めません（${shown}）`;
  return makeItem('verify.node', 'Node の版', STATUS.WARN, reason);
}

/** 検査を順に実行して、項目の配列を返す。echo が真なら、各検査の出力をそのまま流す */
export async function runVerify({ echo = true, log = console.log } = {}) {
  const items = [nodeItem()];
  // 依存が入っていないと、どの検査も落ちる。先に、原因をはっきり言う
  if (!existsSync(join(ROOT, 'node_modules', 'vitest'))) {
    items.push(
      makeItem('verify.deps', '依存のインストール', STATUS.FAIL, 'node_modules がありません'),
    );
    for (const step of VERIFY_STEPS) {
      items.push(makeItem(step.id, step.label, STATUS.SKIP, '依存が入っていないため飛ばした'));
    }
    return items;
  }
  const notPassed = new Set();
  for (const step of VERIFY_STEPS) {
    if (step.after && notPassed.has(step.after)) {
      notPassed.add(step.id);
      items.push(makeItem(step.id, step.label, STATUS.SKIP, `${step.after} が落ちたため飛ばした`));
      continue;
    }
    log(`\n=== npm ${step.args.join(' ')} ===`);
    const { code, output, ms } = await runNpm(step.args, { cwd: ROOT, echo });
    if (code === 0) {
      const counts = step.id === 'test' ? parseTestCounts(output) : null;
      const detail = counts
        ? `テスト ${counts.passed} 件が通った（${formatDuration(ms)}）`
        : formatDuration(ms);
      items.push(makeItem(step.id, step.label, STATUS.PASS, detail));
    } else {
      notPassed.add(step.id);
      const isTest = step.id === 'test';
      const counts = isTest ? parseTestCounts(output) : null;
      // 落ちたテストが 0 件でも終了コードが 0 でないときは、実行そのものの失敗（ワーカーが起動しない、など）
      const detail =
        counts && counts.failed > 0
          ? `テスト ${counts.failed} 件が落ちた・${counts.passed} 件が通った（${formatDuration(ms)}）`
          : `終了コード ${code}（${formatDuration(ms)}）`;
      const failed = isTest ? listFailedTests(output) : [];
      const hints = isTest
        ? [
            ...(failed.length > 0 ? [`落ちたテスト: ${failed.join(' ／ ')}`] : []),
            ...diagnoseTestOutput(output),
          ]
        : [];
      // vitest の終わりの集計の行は、失敗の中身ではないので、末尾から外す
      const tail = isTest ? output.split(/\n\s*Test Files\s/)[0] : output;
      items.push(makeItem(step.id, step.label, STATUS.FAIL, detail, hints, tail));
    }
  }
  return items;
}

if (isMain(import.meta.url)) {
  const items = await runVerify();
  console.log(
    `\n${renderReport([{ title: '手元の検査（npm run verify。CI と同じ検査）', items }])}`,
  );
  process.exit(exitCodeOf(items));
}
