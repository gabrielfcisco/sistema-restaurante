import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
export default tseslint.config(
  { ignores: ['**/dist/**', '**/release/**', '**/generated/**', 'legacy/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx,mjs,cjs}'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // Preloads sandboxed do Electron precisam usar o require limitado do runtime.
  { files: ['apps/*/electron/preload.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } }
);
