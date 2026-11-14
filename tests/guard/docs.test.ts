// @vitest-environment node
// 守ること（docs/守ること.md）の検査。文書の主張と、仕掛け（テスト・命令・設定・台本・CLAUDE.md）を結ぶ。
//   ① 表の各番号に書いた検査（テストのファイル・npm run の命令）が、実在する
//   ④ 「0. 要点」と、CLAUDE.md の「0. 守ること」・台本（scripts/claude-brief.mjs）が、食い違っていない
// 落ちたときは、番号と「管理者へ」の案内を出す。この検査を直して通すのではなく、食い違いの原因（文書か仕掛けの変更）を管理者に伝える。
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DOC_PATH,
  ROOT,
  backticks,
  between,
  blockedPaths,
  briefBlock,
  claudeMdSection0,
  exists,
  guardMessage,
  read,
  ruleRows,
} from './helpers';

const doc = read(DOC_PATH);
const rows = ruleRows(doc);
const packageScripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> })
  .scripts;

/** 台本を動かして、標準出力・終了コードを返す */
function runBrief(script: string, env: Record<string, string>): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [script], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, status: 0 };
  } catch (error) {
    const failed = error as { stdout?: string; status?: number };
    return { stdout: failed.stdout ?? '', status: failed.status ?? 1 };
  }
}

describe('① 表の番号と、落ちる検査', () => {
  it('番号の表を読めている（空振りしていない）。番号は G-01 から、重ならず、昇順', () => {
    expect(rows.length).toBeGreaterThanOrEqual(27);
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size, '番号が重なっています').toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
    expect(ids[0]).toBe('G-01');
    for (const row of rows) expect(row.cells, row.id).toHaveLength(5);
  });

  it.each(rows.map((row) => [row.id, row.cells[3] ?? ''] as const))(
    '%s: 「落ちる検査」に書いたテストのファイルと命令が実在する。書いていなければ「歯止めなし」と書いてある',
    (id, cell) => {
      const tokens = backticks(cell);
      const testFiles = tokens.filter((token) => /^tests\/.+\.test\.tsx?$/.test(token));
      const commands = tokens
        .map((token) => /^npm run ([\w:.-]+)/.exec(token)?.[1])
        .filter((name): name is string => name !== undefined);
      const otherPaths = tokens.filter(
        (token) =>
          /^[\w.-]+(\/[\w.-]+)+$/.test(token) &&
          /\.(ya?ml|mjs|json|md)$/.test(token) &&
          !testFiles.includes(token),
      );

      const missingFiles = [...testFiles, ...otherPaths].filter((path) => !exists(path));
      expect(
        missingFiles,
        guardMessage(id, `文書に書いたファイル ${missingFiles.join('・')} が、見つかりません`),
      ).toEqual([]);

      const missingCommands = commands.filter((name) => !(name in packageScripts));
      expect(
        missingCommands,
        guardMessage(
          id,
          `文書に書いた命令 npm run ${missingCommands.join('・')} が、package.json にありません`,
        ),
      ).toEqual([]);

      const hasCheck = testFiles.length > 0 || commands.length > 0;
      expect(
        hasCheck || cell.includes('歯止めなし'),
        guardMessage(
          id,
          '「落ちる検査」に、テストのファイルか命令も「歯止めなし」も書かれていません',
        ),
      ).toBe(true);
    },
  );

  it.each(rows.map((row) => [row.id, row.cells[3] ?? ''] as const))(
    '%s: tests/guard/ のテストを挙げているなら、そのファイルの中に、この番号がある',
    (id, cell) => {
      const guardFiles = backticks(cell).filter((token) =>
        /^tests\/guard\/.+\.test\.ts$/.test(token),
      );
      for (const file of guardFiles) {
        if (!exists(file)) continue; // 実在しないことは、上の検査が言う
        expect(
          read(file).includes(id),
          guardMessage(
            id,
            `${file} が、この番号を検査していません（文書とテストの対応が崩れています）`,
          ),
        ).toBe(true);
      }
    },
  );
});

describe('④ 「0. 要点」と、CLAUDE.md・台本・設定が、食い違っていない', () => {
  const brief = briefBlock(doc);
  const blocked = blockedPaths(doc);
  const consult = backticks(
    between(doc, '<!-- guard:consult:start -->', '<!-- guard:consult:end -->') ?? '',
  );
  const claudeSection = claudeMdSection0(read('CLAUDE.md'));

  it('要点の印と、変えてはいけない場所・相談する場所の印が、文書にある（空振りしていない）', () => {
    expect(
      brief,
      guardMessage('G-24', '「0. 要点」の印（claude-brief）が、文書にありません'),
    ).not.toBeNull();
    expect(
      blocked.length,
      guardMessage('G-24', '「変えてはいけない所」の印が、文書にありません'),
    ).toBeGreaterThanOrEqual(9);
    expect(
      consult.length,
      guardMessage('G-24', '「先に相談する所」の印が、文書にありません'),
    ).toBeGreaterThanOrEqual(4);
  });

  it('要点に出てくる番号は、すべて表にある', () => {
    const ids = new Set(rows.map((row) => row.id));
    const cited = [...(brief ?? '').matchAll(/G-\d{2}/g)].map((match) => match[0]);
    expect(cited.length).toBeGreaterThan(0);
    const unknown = cited.filter((id) => !ids.has(id));
    expect(
      unknown,
      guardMessage('G-24', `要点が、表に無い番号 ${unknown.join('・')} を挙げています`),
    ).toEqual([]);
  });

  it('CLAUDE.md の「0. 守ること」に、変えてはいけない場所・相談する場所・正本の文書が、そろっている', () => {
    expect(
      claudeSection,
      guardMessage('G-24', 'CLAUDE.md に「0. 守ること」の節がありません'),
    ).not.toBeNull();
    const section = claudeSection ?? '';
    const missing = [...blocked, ...consult, DOC_PATH].filter((token) => !section.includes(token));
    expect(
      missing,
      guardMessage(
        'G-24',
        `CLAUDE.md の「0. 守ること」に、${missing.join('・')} がありません（文書と食い違っています）`,
      ),
    ).toEqual([]);
    // 10〜15 行の短い節（くわしくは docs/守ること.md）
    const lines = section
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('## '));
    expect(lines.length).toBeLessThanOrEqual(15);
  });

  it('台本の出力に、要点の全部の行（変えてはいけない場所を含む）が出る。20 行以内。落ちない', () => {
    const { stdout, status } = runBrief(join(ROOT, 'scripts/claude-brief.mjs'), {
      CLAUDE_PROJECT_DIR: ROOT.replace(/[\\/]$/, ''),
    });
    expect(
      status,
      guardMessage('G-24', '台本 scripts/claude-brief.mjs が、エラーで終わりました'),
    ).toBe(0);
    const outLines = stdout.split('\n').filter((line) => line.trim() !== '');
    expect(
      outLines.length,
      guardMessage('G-24', '台本の出力が 20 行を超えています'),
    ).toBeLessThanOrEqual(20);
    expect(stdout).not.toContain('注意:');
    const briefLines = (brief ?? '')
      .split('\n')
      .filter((line) => line.trim() !== '' && !/^<!--.*-->$/.test(line.trim()));
    const missing = briefLines.filter((line) => !outLines.includes(line.trimEnd()));
    expect(missing, guardMessage('G-24', '台本の出力が、文書の要点と食い違っています')).toEqual([]);
    for (const path of blocked) expect(stdout, path).toContain(path);
  });

  it('台本は、起動した場所がリポジトリの一番上でないとき、警告を出す', () => {
    const other = mkdtempSync(join(tmpdir(), 'guard-brief-start-'));
    try {
      const { stdout, status } = runBrief(join(ROOT, 'scripts/claude-brief.mjs'), {
        CLAUDE_PROJECT_DIR: other,
      });
      expect(status).toBe(0);
      expect(stdout).toContain('注意:');
      expect(stdout).toContain('一番上');
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('台本は、正本が無い・印が無いときも、落ちずに、読めなかったと伝える', () => {
    const temp = mkdtempSync(join(tmpdir(), 'guard-brief-nodoc-'));
    try {
      mkdirSync(join(temp, 'scripts'));
      mkdirSync(join(temp, 'docs'));
      copyFileSync(join(ROOT, 'scripts/claude-brief.mjs'), join(temp, 'scripts/claude-brief.mjs'));
      const script = join(temp, 'scripts/claude-brief.mjs');
      const env = { CLAUDE_PROJECT_DIR: temp };

      const noDoc = runBrief(script, env);
      expect(noDoc.status).toBe(0);
      expect(noDoc.stdout).toContain('読めませんでした');

      writeFileSync(join(temp, 'docs/守ること.md'), '# 印が無い文書\n', 'utf8');
      const noMarker = runBrief(script, env);
      expect(noMarker.status).toBe(0);
      expect(noMarker.stdout).toContain('読めませんでした');
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});

describe('G-08: 有効になっていて、歯止めが、ファン向けの画面を巡回する検査に結ばれている', () => {
  const row = rows.find((item) => item.id === 'G-08');

  it('G-08 の行から「予定」が外れ、要点にも「予定（G-08）」が残っていない', () => {
    expect(row, guardMessage('G-08', '表に G-08 の行がありません')).toBeDefined();
    expect(row?.cells[1], guardMessage('G-08', 'G-08 の行に「予定」が残っています')).not.toContain(
      '予定',
    );
    expect(
      briefBlock(doc) ?? '',
      guardMessage('G-08', '要点に「予定（G-08）」が残っています'),
    ).not.toContain('予定（G-08）');
  });

  it('「落ちる検査」に、巡回の検査（no-numbers）とソースの検査（tests/guard/heat.test.ts）が書かれ、巡回の検査の中に番号がある', () => {
    const cell = row?.cells[3] ?? '';
    const message = guardMessage('G-08', '落ちる検査の書き方が、実際の検査とずれています');
    expect(cell, message).not.toContain('歯止めなし');
    expect(backticks(cell), message).toContain('tests/integration/fan/no-numbers.test.tsx');
    expect(backticks(cell), message).toContain('tests/guard/heat.test.ts');
    expect(read('tests/integration/fan/no-numbers.test.tsx'), message).toContain('G-08');
  });
});
