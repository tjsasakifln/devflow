// @ts-check

import plugin from '@typescript-eslint/eslint-plugin';

// Apply a files filter (src/**/*.ts) to each item in the flat/recommended config
const tsRecommended = plugin.configs['flat/recommended'].map((config) => ({
  ...config,
  files: ['src/**/*.ts'],
}));

/** @type {import('eslint').Linter.Config[]} */
export default [
  // ── Global ignores ──
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  },

  // ── @typescript-eslint/recommended (flat config) ──
  ...tsRecommended,

  // ── Custom rules overlay ──
  {
    files: ['src/**/*.ts'],
    rules: {
      // no-console: warn (will be elevated to error in D-SYS-12)
      'no-console': 'warn',

      // Additional basic style rules
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
