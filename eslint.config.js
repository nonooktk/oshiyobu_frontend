import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // 配らない元絵（assets-src）・ビルドの出力・backend の写し（src/core。検査は backend の側で行う）は検査しない
  globalIgnores([
    'dist',
    'dist-e2e',
    'dist-solo',
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
        { name: 'process', message: 'ブラウザの中で動くコードでは使えません' },
        { name: 'Buffer', message: 'ブラウザの中で動くコードでは使えません' },
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
