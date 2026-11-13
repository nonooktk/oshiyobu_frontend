// backend の core（src/core/）を、固定したコミットの写しとして、このリポジトリの src/core/ に置く（設計 D-07）。
// 版を上げる人が実行する。担当者は実行しない（src/core/ と core.lock.json は手で直さない）。
//
//   npm run core:sync -- <backend のコミット ID（40 桁）>
//       GitHub から、そのコミットの src/core/ を取り出す
//   npm run core:sync -- --from ../oshiyobu_backend
//       backend の作業ツリーから写す（開発中の確認用）。lock のコミット ID は local になり、
//       core:check が CI で拒否する（main には入らない）
//   --repo <URL かパス>   取り出す元のリポジトリを変える（コミット ID の指定のとき。試験用）
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  BACKEND_REPOSITORY,
  CORE_DIR,
  LOCK_PATH,
  readCoreVersion,
  treeSha256,
} from './core-lib.mjs';

const README = `# src/core/

backend の core（計算とデータ）の、固定したコミットの写しです。**自動で置かれたファイルです。手で直しません。**

- 直したいときは、backend で直して、\`npm run core:sync\` で置き直します（設計 D-07）
- 手で直すと、\`npm run core:check\` が落ちます（CI も落ちます）
- このファイルは、\`core:sync\` が置き換えます
`;

function parseArgs(argv) {
  const args = { from: null, repo: BACKEND_REPOSITORY, commit: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') {
      args.from = argv[(i += 1)];
    } else if (arg === '--repo') {
      args.repo = argv[(i += 1)];
    } else if (/^[0-9a-f]{40}$/.test(arg)) {
      args.commit = arg;
    } else {
      throw new Error(
        `引数を読めません: ${arg}（コミット ID は、40 桁の完全な ID で指定します。GitHub は短い ID を受けません）`,
      );
    }
  }
  if (!args.from && !args.commit) {
    throw new Error(
      '使い方: npm run core:sync -- <コミット ID>   または   -- --from <backend のフォルダ>',
    );
  }
  return args;
}

/** コミットを取得して、その src/core/ を dest に取り出す。取得したコミットの完全な ID を返す */
function extractFromCommit(repo, commit, dest) {
  const work = mkdtempSync(join(tmpdir(), 'oshiyobu-core-'));
  try {
    const git = (...gitArgs) =>
      execFileSync('git', gitArgs, { cwd: work, encoding: 'utf8' }).trim();
    git('init', '-q');
    git('fetch', '-q', '--depth', '1', repo, commit);
    const full = git('rev-parse', 'FETCH_HEAD');
    const tarPath = join(work, 'core.tar');
    execFileSync('git', ['archive', '--format=tar', '-o', tarPath, 'FETCH_HEAD', 'src/core'], {
      cwd: work,
    });
    execFileSync('tar', ['-xf', tarPath, '-C', work]);
    cpSync(join(work, 'src', 'core'), dest, { recursive: true });
    return full;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const staging = mkdtempSync(join(tmpdir(), 'oshiyobu-core-new-'));
  try {
    let commit;
    if (args.from) {
      const source = join(resolve(args.from), 'src', 'core');
      if (!existsSync(source)) {
        throw new Error(`${source} がありません`);
      }
      cpSync(source, staging, { recursive: true });
      commit = 'local';
    } else {
      commit = extractFromCommit(args.repo, args.commit, staging);
    }
    // 置き換え: 古い src/core/ の中身を消してから、新しい分を写す
    mkdirSync(CORE_DIR, { recursive: true });
    for (const name of readdirSync(CORE_DIR)) {
      rmSync(join(CORE_DIR, name), { recursive: true, force: true });
    }
    cpSync(staging, CORE_DIR, { recursive: true });
    writeFileSync(join(CORE_DIR, 'README.md'), README);
    const lock = {
      source: 'oshiyobu_backend',
      repository: BACKEND_REPOSITORY,
      commit,
      coreVersion: readCoreVersion(CORE_DIR),
      treeSha256: treeSha256(CORE_DIR),
    };
    writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`core を置きました: commit=${lock.commit} version=${lock.coreVersion}`);
    if (commit === 'local') {
      console.log(
        '注意: commit が local です。core:check が CI で拒否するため、main には入れられません。',
      );
    }
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(
    `core:sync に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
