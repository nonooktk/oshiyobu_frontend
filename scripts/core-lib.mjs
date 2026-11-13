// core の写し（src/core/）と core.lock.json の共通部品（設計 D-07）。
// core:sync と core:check が使う。OS に依存しない（Node の標準だけ。改行は LF にそろえて計算する）。
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CORE_DIR = join(ROOT, 'src', 'core');
export const LOCK_PATH = join(ROOT, 'core.lock.json');
export const BACKEND_REPOSITORY = 'https://github.com/nonooktk/oshiyobu_backend';

/** ハッシュの対象から外すファイル（core:sync が置く説明。core の中身ではない） */
const EXCLUDED = new Set(['README.md']);

/** dir の下のファイルを、相対パス（/ 区切り）の順に並べて返す */
export function listFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push(relative(dir, full).split(sep).join('/'));
      }
    }
  };
  walk(dir);
  return out.filter((path) => !EXCLUDED.has(path)).sort();
}

/**
 * ファイル全体のハッシュ。相対パスの順に、「パス + NUL + 内容（改行は LF）+ NUL」を連結して SHA-256 を取る。
 * Windows の改行（CRLF）でハッシュが変わらないようにするため、内容の CRLF は LF にそろえる。
 */
export function treeSha256(dir) {
  const hash = createHash('sha256');
  for (const path of listFiles(dir)) {
    const text = readFileSync(join(dir, path), 'utf8').replace(/\r\n/g, '\n');
    hash.update(`${path}\0${text}\0`);
  }
  return hash.digest('hex');
}

/** version.ts から core の版（CORE_VERSION）を読む */
export function readCoreVersion(dir) {
  const text = readFileSync(join(dir, 'version.ts'), 'utf8');
  const match = /CORE_VERSION\s*=\s*'([^']+)'/.exec(text);
  if (!match) {
    throw new Error('version.ts に CORE_VERSION が見つかりません');
  }
  return match[1];
}

export function readLock() {
  return JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
}
