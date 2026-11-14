// @vitest-environment node
// 検収の共通部品（scripts/accept-lib.mjs）の判定。合否のまとめ方・URL の伏せ字・発表の公演を拒む判定・CI との一致
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  GUIDES,
  STATUS,
  TEST_PERFORMANCE_ID,
  VERIFY_STEPS,
  assertTestPerformance,
  diagnoseTestOutput,
  displayWidth,
  exitCodeOf,
  guidanceLines,
  isPresentationPerformance,
  listFailedTests,
  makeItem,
  maskUrls,
  parseTestCounts,
  renderReport,
  satisfiesNodeRange,
  verdictOf,
} from '../../scripts/accept-lib.mjs';
import type { Item, Status } from '../../scripts/accept-lib.mjs';
import { ROOT } from '../../scripts/core-lib.mjs';

const item = (status: Status, id = 'x', label = '項目', detail = ''): Item =>
  makeItem(id, label, status, detail);

describe('合否のまとめ方（合格・不合格・飛ばした・注意）', () => {
  it('すべて合格（注意を含む）なら合格で、終了コードは 0', () => {
    const items = [item('pass'), item('warn'), item('pass')];
    expect(verdictOf(items)).toBe('pass');
    expect(exitCodeOf(items)).toBe(0);
  });

  it('不合格が 1 つでもあれば不合格で、終了コードは 1（飛ばした項目があっても不合格）', () => {
    expect(exitCodeOf([item('pass'), item('fail')])).toBe(1);
    expect(exitCodeOf([item('skip'), item('fail')])).toBe(1);
    expect(verdictOf([item('fail')])).toBe('fail');
  });

  it('飛ばした項目があれば、未完了で、終了コードは 2（合格と紛れない）', () => {
    const items = [item('pass'), item('skip')];
    expect(verdictOf(items)).toBe('incomplete');
    expect(exitCodeOf(items)).toBe(2);
    const report = renderReport([{ title: '節', items }]);
    expect(report).toContain('判定: 未完了');
    expect(report).not.toContain('判定: 合格');
  });
});

describe('表の出力', () => {
  const items = [
    makeItem('lint', 'lint', STATUS.PASS, '5.1 秒'),
    makeItem('test', 'テスト', STATUS.FAIL, '終了コード 1', ['fonts.test: 字の漏れ']),
    makeItem('api.target', 'API の接続先', STATUS.SKIP, '渡されていない'),
    makeItem('verify.node', 'Node の版', STATUS.WARN, 'v25.5.0（要: ^22 || ^24）'),
  ];
  const report = renderReport([{ title: '手元の検査', items }]);

  it('項目ごとに、結果（合格／不合格／飛ばした／注意）が出る', () => {
    for (const label of ['合格', '不合格', '飛ばした', '注意']) expect(report).toContain(label);
    expect(report).toContain('判定: 不合格（合格 1・不合格 1・飛ばした 1・注意 1）');
  });

  it('表の区切り（|）は逃がす。表の行は、全角を 2 桁と数えて、桁がそろう', () => {
    expect(report).toContain('^22 \\|\\| ^24');
    const rows = report.split('\n').filter((line) => line.startsWith('| '));
    const widths = new Set(rows.map((row) => displayWidth(row)));
    expect(widths.size).toBe(1);
  });

  it('落ちた項目と、飛ばした項目に、次に見る場所が出る。落ちたテストのファイルごとの案内も出る', () => {
    expect(report).toContain('次に見る場所:');
    expect(report).toContain('[不合格] テスト:');
    expect(report).toContain('fonts.test: 字の漏れ');
    expect(report).toContain('[飛ばした] API の接続先:');
    expect(report).toContain('[注意] Node の版:');
  });

  it('落ちた項目の出力の末尾を、最後に添える（20 行まで）', () => {
    const output = Array.from({ length: 30 }, (_, i) => `行${i + 1}`).join('\n');
    const failed = makeItem('build', 'ビルド', STATUS.FAIL, '終了コード 1', [], output);
    const text = renderReport([{ title: '節', items: [failed] }]);
    expect(text).toContain('--- ビルド の出力の末尾（20 行）---');
    expect(text).toContain('行30');
    expect(text).not.toContain('行10\n');
  });
});

describe('落ちたときの案内', () => {
  const ids: [string, Status][] = [
    ...VERIFY_STEPS.map((step): [string, Status] => [step.id, 'fail']),
    ['verify.node', 'warn'],
    ['verify.deps', 'fail'],
    ['api.target', 'skip'],
    ['api.local', 'fail'],
    ['api.health', 'fail'],
    ['api.meter', 'fail'],
    ['api.notfound', 'fail'],
    ['api.cors.allow', 'fail'],
    ['api.cors.allow', 'skip'],
    ['api.cors.deny', 'fail'],
    ['api.cors.preflight', 'fail'],
    ['api.timing', 'warn'],
    ['api.write.first', 'fail'],
    ['api.write.second', 'fail'],
    ['api.write.count', 'fail'],
    ['live.target', 'skip'],
    ['live.build', 'fail'],
    ['live.browser', 'fail'],
    ['live.page.office', 'fail'],
    ['live.page.fan', 'fail'],
    ['live.page.presenter', 'fail'],
    ['live.meter', 'fail'],
  ];

  it.each(ids)('%s（%s）に、案内がある', (id, status) => {
    expect(guidanceLines([item(status, id)]).length).toBeGreaterThan(0);
  });

  it('案内の本文に、URL・合言葉・トークンらしい値を書いていない', () => {
    const text = JSON.stringify(GUIDES);
    expect(text).not.toMatch(/https?:\/\/[a-z0-9-]+\.[a-z]/i);
    expect(text).not.toMatch(/ghp_|github_pat_|sk-/);
  });

  it('vitest の FAIL の行から、落ちたテストのファイルに当たる案内を出す（知らないファイルは出さない）', () => {
    const output = [
      ' FAIL  tests/unit/type-scale.test.ts > 文字の大きさ > px の直書きが無い',
      ' FAIL  tests/unit/fonts.test.ts > 画面の字 > 漏れが 0 字',
      ' FAIL  tests/unit/unknown-thing.test.ts > どれか',
    ].join('\n');
    const hints = diagnoseTestOutput(output);
    expect(hints).toHaveLength(2);
    expect(hints[0]).toContain('type-scale.test');
    expect(hints[1]).toContain('docs/フォント.md');
    expect(diagnoseTestOutput('Tests 3 passed')).toEqual([]);
  });

  it('落ちたテストの一覧を、重なりを除いて集める（件数の上限つき）', () => {
    const output = [
      ' FAIL  tests/unit/a.test.ts > 一つ目',
      ' FAIL  tests/unit/a.test.ts > 一つ目',
      ' FAIL  tests/unit/b.test.ts > 二つ目',
      ' ✓ tests/unit/c.test.ts',
    ].join('\n');
    expect(listFailedTests(output)).toEqual([
      'tests/unit/a.test.ts > 一つ目',
      'tests/unit/b.test.ts > 二つ目',
    ]);
    expect(listFailedTests(output, 1)).toHaveLength(1);
    expect(listFailedTests('すべて通った')).toEqual([]);
  });

  it('テストの件数を、vitest の出力から読む（色の指定つきでも読める）', () => {
    expect(parseTestCounts('      Tests  451 passed (451)')).toEqual({
      failed: 0,
      skipped: 0,
      passed: 451,
    });
    expect(parseTestCounts('\u001b[2m      Tests \u001b[22m 1 failed | 450 passed (451)')).toEqual({
      failed: 1,
      skipped: 0,
      passed: 450,
    });
    expect(parseTestCounts('何も出ていない')).toBeNull();
  });
});

describe('URL の伏せ字', () => {
  const api = 'https://api-secret-host.example.test';
  const web = 'https://web-secret-host.example.test:8443';
  const targets = [
    { url: api, as: '<API>' },
    { url: web, as: '<SWA>' },
  ];

  it('origin・パスつきの URL・host（ポートつき）を、置き換える。大文字小文字は区別しない', () => {
    const text = `a ${api}/healthz b ${web} c API-SECRET-HOST.example.test d web-secret-host.example.test:8443`;
    const masked = maskUrls(text, targets);
    expect(masked).toBe('a <API>/healthz b <SWA> c <API> d <SWA>');
    expect(masked).not.toMatch(/secret-host/i);
  });

  it('何度出てきても、すべて置き換える。関係のない文字は、そのまま', () => {
    const masked = maskUrls(`${api} と ${api}/x と https://example.org/y`, targets);
    expect(masked).toBe('<API> と <API>/x と https://example.org/y');
  });

  it('空の URL・URL でない値は、無視する（落ちない）', () => {
    expect(maskUrls('そのまま', [{ url: '', as: '<API>' }])).toBe('そのまま');
    expect(maskUrls('そのまま', [{ url: 'URLではない', as: '<API>' }])).toBe('そのまま');
  });

  it('同じ host でポートだけ違う 2 つ（手元の API と画面）も、取り違えずに置き換える', () => {
    const masked = maskUrls('GET http://127.0.0.1:8795/healthz from http://127.0.0.1:5295', [
      { url: 'http://127.0.0.1:8795', as: '<API>' },
      { url: 'http://127.0.0.1:5295', as: '<LOCAL>' },
    ]);
    expect(masked).toBe('GET <API>/healthz from <LOCAL>');
  });
});

describe('書き込みの相手（発表に使う公演を拒む）', () => {
  it('試験用の公演だけが通る', () => {
    expect(() => assertTestPerformance(TEST_PERFORMANCE_ID)).not.toThrow();
    expect(TEST_PERFORMANCE_ID).toBe('terao:KGS-001');
  });

  it.each(['tech0:cbox', ' tech0:cbox ', 'TECH0:CBOX', 'tech0:KGS-001'])(
    '発表に使う公演（%s）には、書き込まない',
    (id) => {
      expect(isPresentationPerformance(id)).toBe(true);
      expect(() => assertTestPerformance(id)).toThrow('発表に使う公演');
    },
  );

  it.each(['', 'terao:KGS-002', 'terao:cbox', 'nobody:nowhere', 'terao:KGS-001/../x'])(
    '試験用でない公演（%s）にも、書き込まない',
    (id) => {
      expect(() => assertTestPerformance(id)).toThrow();
    },
  );
});

describe('Node の版の範囲（package.json の engines.node）', () => {
  const range = '^22.22.2 || ^24.15.0 || >=26.0.0';
  it.each([
    ['v22.22.2', true],
    ['22.23.2', true],
    ['v24.15.0', true],
    ['v24.22.1', true],
    ['v26.0.0', true],
    ['v27.1.0', true],
    ['v22.22.1', false],
    ['v23.11.0', false],
    ['v24.14.9', false],
    ['v25.5.0', false],
    ['v20.20.2', false],
  ])('%s は、範囲に入る: %s', (version, expected) => {
    expect(satisfiesNodeRange(version, range)).toBe(expected);
  });

  it('範囲や版を読めなければ、null（判定できない）', () => {
    expect(satisfiesNodeRange('v22.22.2', '22 または 24')).toBeNull();
    expect(satisfiesNodeRange('何か', range)).toBeNull();
  });

  it('いまの package.json の範囲を、読める', () => {
    const engines = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')).engines.node;
    expect(satisfiesNodeRange('v22.22.2', engines)).toBe(true);
  });
});

describe('npm run verify の中身は、CI・配備の検査と食い違わない', () => {
  const read = (path: string) => readFileSync(`${ROOT}${path}`, 'utf8');
  const stepIds = VERIFY_STEPS.map((step) => step.id);

  it('ci.yml は、検査を 1 つずつ並べず、npm run verify を呼ぶ', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/^\s*- run: npm run verify\s*$/m);
    expect(ci).not.toMatch(
      /^\s*- run: npm run (lint|typecheck|test|build|check:\w+|core:check)\b/m,
    );
  });

  it('deploy.yml が回す検査は、すべて verify の中にある（check:budget は --strict-images つき）', () => {
    const deploy = read('.github/workflows/deploy.yml');
    const commands = [...deploy.matchAll(/^\s*- run: npm run ([\w:]+)(.*)$/gm)].map((m) => ({
      name: m[1] as string,
      rest: m[2] as string,
    }));
    expect(commands.length).toBeGreaterThan(0);
    for (const { name } of commands) expect(stepIds).toContain(name);
    expect(
      commands.some((c) => c.name === 'check:budget' && c.rest.includes('--strict-images')),
    ).toBe(true);
    const budget = VERIFY_STEPS.find((step) => step.id === 'check:budget');
    expect(budget?.args).toContain('--strict-images');
  });

  it('verify の各段は、package.json に同じ名前の script がある。build のあとの検査は、build に依存する', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    for (const step of VERIFY_STEPS) expect(scripts[step.id]).toBeTruthy();
    expect(scripts.verify).toBe('node scripts/verify.mjs');
    const after = VERIFY_STEPS.filter((step) => step.after).map((step) => step.id);
    expect(after).toEqual(['check:budget', 'check:csp']);
  });
});
