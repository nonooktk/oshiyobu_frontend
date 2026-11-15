import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** 画面のコードはブラウザの中で動く。Node の道具を使わない（下の 2 つの設定が、同じ文を使う） */
const browserOnlyGlobals = [
  { name: 'process', message: 'ブラウザの中で動くコードでは使えません' },
  { name: 'Buffer', message: 'ブラウザの中で動くコードでは使えません' },
];

export default defineConfig([
  // 配らない元絵（assets-src）・ビルドの出力・backend の写し（src/core。検査は backend の側で行う）は検査しない
  globalIgnores([
    'dist',
    'dist-e2e',
    'dist-solo',
    'dist-accept',
    'coverage',
    'assets-src',
    'src/core',
    'test-results',
    'playwright-report',
    'e2e/results',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  jsxA11y.flatConfigs.recommended,
  {
    // 使わない引数は、先頭に _ を付ければ許す
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    // 画面のコードはブラウザの中で動く。Node の道具を使わない（テストと設定は別）
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...browserOnlyGlobals,
        // 通信は src/shared/meter/ の中だけ（設計 D-41 の規則 1。画面の部品から fetch を呼ばない）
        { name: 'fetch', message: '通信は src/shared/meter/ の中だけで行います' },
      ],
    },
  },
  {
    files: ['src/shared/meter/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    // 音源ファイル（public/sounds/）を、画面と同じ配信元から読む 1 か所だけ、fetch を使ってよい（G-04。API への通信ではない）。
    // API への通信は、これまでどおり src/shared/meter/ の中だけ。fetch を呼ぶ場所は、tests/guard/sound-files.test.ts が見張る
    files: ['src/fan/sound-files.ts'],
    rules: { 'no-restricted-globals': ['error', ...browserOnlyGlobals] },
  },
  {
    files: [
      'vite.config.ts',
      'eslint.config.js',
      'playwright.config.ts',
      'playwright.solo.config.ts',
      'scripts/**/*.mjs',
      'e2e/**/*.mjs',
    ],
    languageOptions: { globals: globals.node },
  },
]);
