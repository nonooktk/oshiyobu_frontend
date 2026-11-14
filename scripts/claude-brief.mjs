// 作業の始めに、docs/守ること.md の「要点」を出す台本。
// Claude Code の SessionStart の hook（.claude/settings.json）が呼ぶ。標準出力が、そのまま Claude Code に読まれる。
// Node だけで動く（bash・Python は要らない。Mac も Windows も同じ）。
//   使い方（手で確かめるとき）: node scripts/claude-brief.mjs
// 要点は docs/守ること.md の「<!-- claude-brief:start -->」から「<!-- claude-brief:end -->」の間。ここに二重には書かない。
// どんな場合も終了コード 0 で終わる（この台本が落ちて、作業の始めを止めないため。読めないときは、そう伝える）。
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const START = '<!-- claude-brief:start -->';
const END = '<!-- claude-brief:end -->';
const DOC = join('docs', '守ること.md');

/** パスを、比べられる形にする（実体のパスに直し、Windows の大文字小文字の違いを消す） */
function normalize(path) {
  let real = resolve(path);
  try {
    real = realpathSync(real);
  } catch {
    // 実在しないパスは、そのまま比べる
  }
  return process.platform === 'win32' ? real.toLowerCase() : real;
}

/** 要点の印の間の行を取り出す。HTML のコメントの行と空行は捨てる。印が無ければ null */
function extractBrief(markdown) {
  const start = markdown.indexOf(START);
  const end = markdown.indexOf(END);
  if (start < 0 || end < 0 || end < start) return null;
  const lines = markdown
    .slice(start + START.length, end)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '' && !/^<!--.*-->$/.test(line.trim()));
  return lines.length > 0 ? lines : null;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const out = [];

  let brief = null;
  try {
    brief = extractBrief(readFileSync(join(root, DOC), 'utf8'));
  } catch {
    brief = null;
  }

  if (brief === null) {
    out.push(
      `【守ること】${DOC.replaceAll('\\', '/')} の要点を読めませんでした。作業を始める前に、必ず、そのファイルを全部読んでください。`,
      '読めないあいだは、見た目（色・余白・絵・文言・レイアウト）以外を変えず、迷ったら止まって、担当者に聞いてください。',
    );
  } else {
    out.push('【守ること】作業の前に読む（正本: docs/守ること.md）', ...brief);
  }

  // 拒否の設定（.claude/settings.json）は、リポジトリの一番上で起動したときに効く。違う場所なら、警告する
  const started = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (normalize(started) !== normalize(root)) {
    out.push(
      `注意: Claude Code を ${started} で起動しています。リポジトリの一番上（${root}）で起動し直してください。そうしないと、書き込みを止める設定が効かないことがあります。`,
    );
  }

  process.stdout.write(`${out.join('\n')}\n`);
}

// 読み手が先に閉じても（パイプの EPIPE）、エラーで落ちない
process.stdout.on('error', () => {});

try {
  main();
} catch {
  // 台本の不具合で、作業の始めを止めない
  process.stdout.write('【守ること】docs/守ること.md を読んでから、作業を始めてください。\n');
}
