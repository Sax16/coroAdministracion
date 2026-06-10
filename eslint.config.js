// Flat config para ESLint v9. Ver https://eslint.org/docs/latest/use/configure/configuration-files
// Pendiente: migrar a eslint-config-expo cuando se publique la versión flat.
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-undef': 'off', // TS handles this
    },
  },
  {
    ignores: ['node_modules/', '.expo/', 'dist/', 'web-build/'],
  },
];
