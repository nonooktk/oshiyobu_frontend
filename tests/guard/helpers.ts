// 守ることの検査（tests/guard/）の共通の部品。ファイルを読む・歩く・落ちたときの文を作る。
// このフォルダは、管理者だけが変える場所（docs/守ること.md の「1. 線引き」。.claude/settings.json で書き込みを止めている）。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** リポジトリの一番上（末尾に区切りつき） */
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** 正本の文書 */
export const DOC_PATH = 'docs/守ること.md';

export const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');
export const exists = (rel: string): boolean => existsSync(join(ROOT, rel));

/** 歩かないフォルダ（依存・ビルドの出力・git の管理ファイル・backend の写し） */
const ALWAYS_SKIP = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-e2e',
  'dist-solo',
  'dist-accept',
  'coverage',
  'test-results',
  'playwright-report',
]);

/**
 * フォルダの下のファイルを、リポジトリの一番上からの相対パス（/ 区切り）で集める。
 * skip には、歩かないフォルダ・ファイルの相対パスの先頭（例: 'src/core'）を渡す。
 */
export function walk(dir: string, skip: readonly string[] = []): string[] {
  const out: string[] = [];
  const visit = (rel: string): void => {
    for (const entry of readdirSync(join(ROOT, rel), { withFileTypes: true })) {
      const path = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (ALWAYS_SKIP.has(entry.name)) continue;
      if (skip.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) continue;
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) out.push(path);
    }
  };
  visit(dir);
  return out.sort();
}

/** 拡張子で絞る（例: ['.ts', '.tsx']） */
export const withExt = (paths: readonly string[], exts: readonly string[]): string[] =>
  paths.filter((path) => exts.some((ext) => path.endsWith(ext)));

/**
 * コメントを消す（ブロックコメントと、行頭か空白のあとの `//` 以降）。
 * `http://` のように、直前が `:` の `//` は消さない。語の検査で、コメントの中の説明を拾わないため。
 */
export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** 落ちたときの文。どの決まりか（番号）と、管理者へ頼む案内を出す */
export function guardMessage(id: string, what: string): string {
  return `【${id} に反しています】${what}。直さずに、管理者（統括）へ相談してください（docs/守ること.md の ${id}）。`;
}

/** 印（HTML のコメント）の間の文を取り出す。印が無ければ null */
export function between(text: string, start: string, end: string): string | null {
  const from = text.indexOf(start);
  const to = text.indexOf(end);
  if (from < 0 || to < 0 || to < from) return null;
  return text.slice(from + start.length, to);
}

/** 文の中の、バッククォートで囲んだ語を集める */
export function backticks(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? '');
}

export interface RuleRow {
  /** 番号（G-01 など） */
  id: string;
  /** 表の列（番号・守ること・理由・落ちる検査・変えたいとき） */
  cells: string[];
}

/** 正本の「2. 守ること」の表から、番号つきの行を集める */
export function ruleRows(doc: string): RuleRow[] {
  const rows: RuleRow[] = [];
  for (const line of doc.split(/\r?\n/)) {
    const match = /^\|\s*(G-\d{2})\s*\|/.exec(line);
    if (!match) continue;
    rows.push({
      id: match[1] ?? '',
      cells: line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    });
  }
  return rows;
}

/** 正本の「0. 要点」の中の、変えてはいけない場所（印 guard:blocked の間のバッククォートの語） */
export function blockedPaths(doc: string): string[] {
  const block = between(doc, '<!-- guard:blocked:start -->', '<!-- guard:blocked:end -->');
  return block === null ? [] : backticks(block);
}

/** 正本の「0. 要点」（印 claude-brief の間） */
export const briefBlock = (doc: string): string | null =>
  between(doc, '<!-- claude-brief:start -->', '<!-- claude-brief:end -->');

/** CLAUDE.md の「0. 守ること」の節（次の「## 1.」の手前まで） */
export function claudeMdSection0(claudeMd: string): string | null {
  const from = claudeMd.indexOf('## 0. 守ること');
  if (from < 0) return null;
  const rest = claudeMd.slice(from);
  const next = rest.search(/^## 1\./m);
  return next < 0 ? rest : rest.slice(0, next);
}
