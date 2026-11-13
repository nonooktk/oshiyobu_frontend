// src/core/ が、core.lock.json の指すコミットの写しのままか確かめる（設計 D-07）。
//
//   npm run core:check             src/core/ のハッシュが lock の treeSha256 と一致するか。
//                                  CI（環境変数 CI が設定されている）では、commit が local の lock も拒否する
//   npm run core:check -- --remote lock のコミットを GitHub から取得して、同じハッシュになるか（配備前の確認）
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BACKEND_REPOSITORY,
  CORE_DIR,
  readCoreVersion,
  readLock,
  treeSha256,
} from './core-lib.mjs';

const fail = (message) => {
  console.error(`core:check に失敗しました: ${message}`);
  process.exit(1);
};

const remote = process.argv.includes('--remote');
const strict = remote || Boolean(process.env.CI);

let lock;
try {
  lock = readLock();
} catch {
  fail('core.lock.json を読めません。`npm run core:sync` で置いてください');
}

const actual = treeSha256(CORE_DIR);
if (actual !== lock.treeSha256) {
  fail(
    'src/core/ が core.lock.json と一致しません。src/core/ は手で直しません。' +
      'backend で直して、`npm run core:sync` で置き直してください',
  );
}
if (readCoreVersion(CORE_DIR) !== lock.coreVersion) {
  fail('src/core/version.ts の版が core.lock.json の coreVersion と違います');
}
if (strict && lock.commit === 'local') {
  fail(
    'lock の commit が local です。backend のコミットを指定して `npm run core:sync` し直してください',
  );
}

if (remote) {
  const work = mkdtempSync(join(tmpdir(), 'oshiyobu-core-remote-'));
  try {
    const git = (...args) => execFileSync('git', args, { cwd: work, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('fetch', '-q', '--depth', '1', lock.repository ?? BACKEND_REPOSITORY, lock.commit);
    execFileSync(
      'git',
      ['archive', '--format=tar', '-o', join(work, 'core.tar'), 'FETCH_HEAD', 'src/core'],
      { cwd: work },
    );
    execFileSync('tar', ['-xf', join(work, 'core.tar'), '-C', work]);
    const staging = join(work, 'staging');
    cpSync(join(work, 'src', 'core'), staging, { recursive: true });
    if (treeSha256(staging) !== lock.treeSha256) {
      fail('lock のコミットの内容と、src/core/ が一致しません（lock が別の内容を指しています）');
    }
  } catch (error) {
    fail(
      `lock のコミットを取得できません: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

console.log(
  `core:check OK: commit=${lock.commit} version=${lock.coreVersion}${remote ? '（remote 照合済み）' : ''}`,
);
