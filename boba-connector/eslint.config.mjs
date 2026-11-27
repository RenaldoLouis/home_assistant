import js from '@eslint/js';

export default [
  js.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: Object.fromEntries(
    ['process','console','URL','URLSearchParams','fetch','Buffer','setTimeout','structuredClone'].map(name => [name, 'readonly'])
  ) }, rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
];
