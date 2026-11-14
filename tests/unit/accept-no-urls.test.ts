// @vitest-environment node
// 検収の台本と文書に、公開の URL・秘匿値を書かない（CLAUDE.md の「秘匿値」・docs/検収.md）
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../scripts/core-lib.mjs';

describe('台本と文書に、公開の URL を書かない', () => {
  const files = [
    'scripts/accept-lib.mjs',
    'scripts/accept-run.mjs',
    'scripts/accept.mjs',
    'scripts/api-check-lib.mjs',
    'scripts/check-api.mjs',
    'scripts/check-live.mjs',
    'scripts/check-solo.mjs',
    'scripts/local-api.mjs',
    'scripts/verify.mjs',
    'CLAUDE.md',
    'docs/検収.md',
  ];
  it.each(files)('%s に、配備先の URL（azurestaticapps・azurewebsites）が無い', (file) => {
    const text = readFileSync(`${ROOT}${file}`, 'utf8');
    expect(text).not.toMatch(/azurestaticapps\.net|azurewebsites\.net/);
  });
});
