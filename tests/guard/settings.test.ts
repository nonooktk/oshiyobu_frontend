// @vitest-environment node
// Claude Code の設定（.claude/settings.json）の検査。守りの 2 段目（止める）が、消されていないこと。
//   G-17・G-24: 「変えてはいけない場所」（文書の要点の印 guard:blocked）への書き込みが、Edit の拒否に入っている
//   G-25・G-26: main・dev への push、force push、配備・Secrets・Azure の命令が、拒否に入っている
//   1 段目の台本が、SessionStart の hook に登録されている
// 設定が消えていると落ちる（設定を書き換えられた場合の見張り）。落ちたら、直さずに、管理者へ。
import { describe, expect, it } from 'vitest';
import { DOC_PATH, blockedPaths, exists, guardMessage, read } from './helpers';

interface HookEntry {
  type?: string;
  command?: string;
  timeout?: number;
}
interface Settings {
  disableAllHooks?: boolean;
  permissions?: { deny?: string[]; ask?: string[]; allow?: string[]; defaultMode?: string };
  hooks?: { SessionStart?: { matcher?: string; hooks?: HookEntry[] }[] };
}

const settings = JSON.parse(read('.claude/settings.json')) as Settings;
const deny = settings.permissions?.deny ?? [];

/** 文書の「変えてはいけない場所」を、Edit の拒否の書き方（プロジェクトの一番上からのパス）にする */
const toEditRule = (path: string): string =>
  path.endsWith('/') ? `Edit(/${path}**)` : `Edit(/${path})`;

describe('Claude Code の設定（.claude/settings.json）', () => {
  it('拒否の一覧を読めている（空振りしていない）', () => {
    expect(deny.length).toBeGreaterThan(20);
  });

  it('「変えてはいけない場所」への書き込み（Edit）が、文書と同じ範囲で拒否されている', () => {
    const blocked = blockedPaths(read(DOC_PATH));
    expect(
      blocked.length,
      guardMessage('G-24', '文書の「変えてはいけない所」を読めません'),
    ).toBeGreaterThanOrEqual(9);
    const wanted = blocked.map(toEditRule);

    const missing = wanted.filter((rule) => !deny.includes(rule));
    expect(
      missing,
      guardMessage(
        'G-17',
        `.claude/settings.json の拒否（permissions.deny）から、${missing.join('・')} が消えています`,
      ),
    ).toEqual([]);

    const extra = deny.filter((rule) => rule.startsWith('Edit(') && !wanted.includes(rule));
    expect(
      extra,
      guardMessage(
        'G-24',
        `文書に無い Edit の拒否 ${extra.join('・')} があります（文書と設定を、そろえてください）`,
      ),
    ).toEqual([]);
  });

  it('「変えてはいけない場所」の実体が、リポジトリにある（パスの書き間違いで、拒否が空振りしていない）', () => {
    // .claude/settings.local.json は、各自の手元にだけ作られるので、実在を求めない
    const real = blockedPaths(read(DOC_PATH)).filter(
      (path) => path !== '.claude/settings.local.json',
    );
    const missing = real.filter((path) => !exists(path));
    expect(
      missing,
      guardMessage('G-24', `${missing.join('・')} が、リポジトリに見つかりません`),
    ).toEqual([]);
  });

  describe.each(['Bash', 'PowerShell'])('%s の拒否', (shell) => {
    const rules: [string, string, string][] = [
      ['G-25', 'git push * main', 'main への push'],
      ['G-25', 'git push *:main', 'main への push（:main の書き方）'],
      ['G-25', 'git push * dev', 'dev への push'],
      ['G-25', 'git push *:dev', 'dev への push（:dev の書き方）'],
      ['G-25', 'git push *--force*', 'force push'],
      ['G-25', 'git push -f*', 'force push（-f）'],
      ['G-25', 'git push', '引数のない push'],
      ['G-25', 'git reset *--hard*', 'git reset --hard'],
      ['G-25', 'git clean *', 'git clean'],
      ['G-25', 'git checkout -f*', 'git checkout -f'],
      ['G-26', 'gh secret *', 'GitHub の Secrets'],
      ['G-26', 'gh variable *', 'GitHub の Variables'],
      ['G-26', 'gh workflow run *', '配備の起動'],
      ['G-26', 'az *', 'Azure'],
      ['G-17', 'npm run core:sync *', 'core の置き直し'],
    ];
    it.each(rules)('%s: %s（%s）が拒否に入っている', (id, pattern, what) => {
      expect(
        deny,
        guardMessage(
          id,
          `.claude/settings.json の拒否に、${what}（${shell}(${pattern})）がありません`,
        ),
      ).toContain(`${shell}(${pattern})`);
    });
  });

  it('作業の始めに要点を出す台本（scripts/claude-brief.mjs）が、SessionStart の hook に登録されている', () => {
    const commands = (settings.hooks?.SessionStart ?? [])
      .flatMap((group) => group.hooks ?? [])
      .filter((hook) => hook.type === 'command')
      .map((hook) => hook.command ?? '');
    expect(
      commands.some((command) => command.includes('scripts/claude-brief.mjs')),
      guardMessage('G-24', '.claude/settings.json の SessionStart から、台本の登録が消えています'),
    ).toBe(true);
    expect(exists('scripts/claude-brief.mjs')).toBe(true);
  });

  it('G-24: 既存のテスト・実ブラウザの試験の編集（Edit）が、確認の対象（ask）に入っている', () => {
    const ask = settings.permissions?.ask ?? [];
    const wanted = [
      'Edit(/tests/unit/**)',
      'Edit(/tests/integration/**)',
      'Edit(/tests/helpers/**)',
      'Edit(/e2e/**)',
      'Edit(/e2e-solo/**)',
    ];
    const missing = wanted.filter((rule) => !ask.includes(rule));
    expect(
      missing,
      guardMessage(
        'G-24',
        `.claude/settings.json の確認（permissions.ask）から、${missing.join('・')} が消えています（既存のテストの編集に、確認が出なくなります）`,
      ),
    ).toEqual([]);
    for (const rule of wanted)
      expect(deny, `${rule} は、拒否でなく確認にしています`).not.toContain(rule);
  });

  it('hooks 全体を止める設定（disableAllHooks）や、確認を飛ばす既定のモードが、共有の設定に入っていない', () => {
    expect(settings.disableAllHooks).not.toBe(true);
    expect(settings.permissions?.defaultMode).not.toBe('bypassPermissions');
  });
});
