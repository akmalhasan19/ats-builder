import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'artifacts/**',
      'public/fonts/**',
      '.husky/_/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/unit/**/*.{ts,tsx}', 'tests/fixtures/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
    settings: {
      'jsx-a11y': { polymorphicPropName: 'asChild' },
    },
  },
  {
    files: [
      'vite.config.ts',
      'vitest.setup.ts',
      'playwright.config.ts',
      'scripts/**/*.{ts,tsx}',
      'tests/e2e/**/*.ts',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Primitif vendored shadcn/ui mengekspor cva variants berdampingan dengan
    // komponennya; itu konvensi upstream, bukan pelanggaran DX.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['buttonVariants', 'tabsListVariants'] },
      ],
    },
  },
  prettierConfig,
)
