// @vitest-environment node
// 進め方と、通信の約束の検査。
//   G-19: ビルドの変数 VITE_API_BASE・VITE_SHARED_METER の意味と、それを渡す場所が、消えていない
//   G-22: 配備先の URL・トークンの形の文字列が、コード・文書・設定に書かれていない
//   G-23: CI が npm run verify を呼ぶ形のまま（手元と CI の検査がずれない）
//   G-24: テストを skip にしていない。lint・型の抑制を足していない
//   G-26: 配備（deploy.yml）が、手で起動する形のまま
// 限界: G-24 の「期待値の書き換え」は、機械では見つけられない（PR のレビューで見る）。
//   G-22 は、書かれた形が決まっているものだけ（URL の形・トークンの形）。合言葉そのものは見つけられない。
import { describe, expect, it } from 'vitest';
import { exists, guardMessage, read, walk, withExt } from './helpers';

describe('G-19: ビルドの変数（VITE_API_BASE・VITE_SHARED_METER）', () => {
  const config = read('src/shared/meter/config.ts');
  const vite = read('vite.config.ts');
  const deploy = read('.github/workflows/deploy.yml');

  it('接続先の変数 VITE_API_BASE を、画面が読んでいる。ビルドの設定と配備が、同じ変数を渡している', () => {
    const message = guardMessage('G-19', 'VITE_API_BASE の読み込み・受け渡しが消えています');
    expect(config, message).toContain('import.meta.env.VITE_API_BASE');
    expect(vite, message).toContain('VITE_API_BASE');
    expect(deploy, message).toContain('VITE_API_BASE: ${{ vars.VITE_API_BASE }}');
  });

  it('共有メーターの切り替え VITE_SHARED_METER を、画面が読んでいる。ちょうど on のときだけ共有に戻る（既定はひとり体験）', () => {
    const message = guardMessage(
      'G-19',
      'VITE_SHARED_METER の意味（ちょうど on のときだけ共有メーター）が変わっています',
    );
    expect(config, message).toContain("import.meta.env.VITE_SHARED_METER === 'on'");
    expect(vite, message).toContain('VITE_SHARED_METER');
  });
});

describe('G-22: 公開 URL・トークンの形の文字列が、書かれていない', () => {
  // 文書・コード・設定の、文字のファイル（バイナリの絵・フォント・ロックファイルは見ない）
  const TEXT_EXTS = [
    '.ts',
    '.tsx',
    '.mjs',
    '.js',
    '.json',
    '.md',
    '.yml',
    '.yaml',
    '.css',
    '.html',
    '.txt',
  ];
  const files = withExt(walk('', ['assets-src', 'public/fonts', 'package-lock.json']), TEXT_EXTS);
  // 全ファイルを 1 回だけ読む（検査ごとに読み直さない）
  const texts = new Map(files.map((path) => [path, read(path)] as const));

  const DEPLOY_URL = /azurestaticapps\.net|azurewebsites\.net/;
  const TOKEN_SHAPES: [string, RegExp][] = [
    ['GitHub のトークン（ghp_）', /\bghp_[A-Za-z0-9]{20,}/],
    ['GitHub のトークン（github_pat_）', /\bgithub_pat_[A-Za-z0-9_]{20,}/],
    ['API キー（sk-）', /\bsk-[A-Za-z0-9]{20,}/],
    ['AWS のキー', /\bAKIA[0-9A-Z]{16}\b/],
    ['秘密鍵', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ];

  it('検査の対象が見つかっている（空振りしていない）', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain('CLAUDE.md');
    expect(files).toContain('.github/workflows/deploy.yml');
    expect(files).toContain('src/shared/meter/config.ts');
  });

  it('配備先の URL（azurestaticapps・azurewebsites）が、どのファイルにも無い', () => {
    const hits = files.filter((path) => DEPLOY_URL.test(texts.get(path) ?? ''));
    expect(hits, guardMessage('G-22', `配備先の URL が書かれています（公開 URL は秘匿）`)).toEqual(
      [],
    );
  });

  it.each(TOKEN_SHAPES)('%s の形の文字列が、どのファイルにも無い', (label, shape) => {
    const hits = files.filter((path) => shape.test(texts.get(path) ?? ''));
    expect(hits, guardMessage('G-22', `${label}の形の文字列が書かれています`)).toEqual([]);
  });
});

describe('G-23: CI が npm run verify を呼ぶ', () => {
  it('package.json の verify と、CI（ci.yml）の呼び出しが、そろっている', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> })
      .scripts;
    const message = guardMessage(
      'G-23',
      'CI が npm run verify を呼ぶ形が崩れています（手元と CI の検査が、ずれます）',
    );
    expect(scripts.verify, message).toBe('node scripts/verify.mjs');
    expect(read('.github/workflows/ci.yml'), message).toContain('npm run verify');
  });
});

describe('G-24: テストを skip にしていない・抑制を足していない', () => {
  const testFiles = withExt(walk('tests', ['tests/guard']), ['.ts', '.tsx']);
  const sourceFiles = withExt(walk('src', ['src/core']), ['.ts', '.tsx']);

  // it.skip・it.only・it.todo・test.fixme・describe.skipIf など、実行されなくなる・絞られる書き方
  const SKIP =
    /\b(?:it|test|describe)\.(?:skip|skipIf|only|todo|fixme|fails)\b|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(/;
  const SUPPRESS = /eslint-disable|@ts-ignore|@ts-nocheck|@ts-expect-error/;

  it('検査の対象が見つかっている（空振りしていない）', () => {
    expect(testFiles.length).toBeGreaterThan(30);
    expect(testFiles).toContain('tests/unit/forbidden-words.test.ts');
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  it('tests/ に、skip・only・todo・fixme が 0 件', () => {
    const hits = testFiles.filter((path) => SKIP.test(read(path)));
    expect(
      hits,
      guardMessage(
        'G-24',
        'テストを skip・only・todo にしています（直すのは画面の側。テストが古いと思ったら、管理者へ）',
      ),
    ).toEqual([]);
  });

  it('src/ と tests/ に、lint・型の抑制（eslint-disable・@ts-ignore など）が 0 件', () => {
    const hits = [...sourceFiles, ...testFiles].filter((path) => SUPPRESS.test(read(path)));
    expect(
      hits,
      guardMessage(
        'G-24',
        'lint や型の抑制コメントを足しています（抑制せずに、指摘を直す。直せないときは、管理者へ）',
      ),
    ).toEqual([]);
  });

  it('この検査は、skip と抑制を見つけられる（見張りが働いている）', () => {
    for (const sample of [
      "it.skip('a', () => {})",
      "describe.only('a', () => {})",
      "it.skipIf(x)('a', f)",
      "xit('a', f)",
      "test.todo('a')",
    ]) {
      expect(SKIP.test(sample), sample).toBe(true);
    }
    expect(SKIP.test("it('skip という語を含む題', () => {})")).toBe(false);
    for (const sample of ['// eslint-disable-next-line', '// @ts-ignore', '/* @ts-nocheck */']) {
      expect(SUPPRESS.test(sample), sample).toBe(true);
    }
  });
});

describe('G-26: 配備は、手で起動する形のまま', () => {
  it('deploy.yml の起動の条件（on:）が workflow_dispatch だけ', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const match = /^on:\s*\n((?:[ \t]+.*\n|\s*\n)+)/m.exec(deploy);
    expect(match, guardMessage('G-26', 'deploy.yml の「on:」を読めません')).not.toBeNull();
    const triggers = (match?.[1] ?? '')
      .split('\n')
      .map((line) => /^ {2}([a-z_]+):?/.exec(line)?.[1])
      .filter((name): name is string => name !== undefined);
    expect(
      triggers,
      guardMessage(
        'G-26',
        'deploy.yml が、手で起動する形（workflow_dispatch だけ）でなくなっています。勝手に配備されます',
      ),
    ).toEqual(['workflow_dispatch']);
    expect(exists('.github/workflows/deploy.yml')).toBe(true);
  });
});
