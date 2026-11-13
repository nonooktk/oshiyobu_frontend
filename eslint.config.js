import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // 配らない元絵（assets-src）・ビルドの出力・backend の写し（src/core。検査は backend の側で行う）は検査しない
  globalIgnores(['dist', 'coverage', 'assets-src', 'src/core']),
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
      ],
    },
  },
  {
    files: ['vite.config.ts', 'eslint.config.js', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
]);
