import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Phase 1 policy rules (see docs/tasks/phase-01-scaffolding-and-theming.md):
//
// 1. No raw HTML targets in styled-components — every `styled(...)` must wrap a
//    Mantine component or layout primitive (Box / Group / Stack / Paper / Card / …).
//    `styled.div`, `styled.span`, `styled.button`, `styled.a`, etc. are forbidden.
//
// 2. No hard-coded colors anywhere outside `src/theme/` — every color resolves
//    through the Primer-derived Mantine theme. Hex / rgb() / rgba() / hsl() / hsla()
//    literals in source files (TS/TSX/JS/JSX/CSS-in-JS) fail the build.

// HTML tag list shared by both `styled.div` (member access) and
// `styled('div')` (call form) selectors. Keep these in lockstep.
const RAW_HTML_TAGS =
  '^(div|span|button|a|p|h1|h2|h3|h4|h5|h6|ul|ol|li|section|article|header|' +
  'footer|nav|aside|main|form|label|input|textarea|select|option|table|tr|td|' +
  'th|thead|tbody|tfoot|img|svg|figure|figcaption|details|summary|dialog|' +
  'fieldset|legend)$';

const STYLED_HTML_MESSAGE =
  'styled-components must wrap a Mantine component or layout primitive ' +
  '(e.g. styled(Box), styled(Card), styled(Group)). Raw HTML targets like ' +
  "styled.div / styled('div') are not allowed (see " +
  'docs/tasks/phase-01-scaffolding-and-theming.md).';

const noRawStyledHtml = [
  // styled.div`...`, styled.span`...`, etc.
  {
    selector: `MemberExpression[object.name='styled'][property.name=/${RAW_HTML_TAGS}/]`,
    message: STYLED_HTML_MESSAGE,
  },
  // styled('div')`...`, styled('span')`...`, etc. — the call form slips
  // through MemberExpression matching.
  {
    selector: `CallExpression[callee.name='styled'][arguments.0.type='Literal'][arguments.0.value=/${RAW_HTML_TAGS}/]`,
    message: STYLED_HTML_MESSAGE,
  },
];

// Hex colors: #abc, #aabbcc, #aabbccdd. Allow inside src/theme/ only.
// Note: the selector engine (esquery) takes regex *source* between the
// `=/.../` delimiters, so backslashes here must be single (`\b`), not
// JS-escaped (`\\b`).
const hexColorPattern = '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})';
const cssColorFnPattern = '(?:rgb|rgba|hsl|hsla)\\s*\\(';

const noHardCodedColors = [
  {
    selector: `Literal[value=/${hexColorPattern}/]`,
    message:
      'Hard-coded hex colors are forbidden outside src/theme/. Resolve colors through the ' +
      'Primer-derived Mantine theme (theme.colors / theme.other / cssVariables).',
  },
  {
    selector: `Literal[value=/${cssColorFnPattern}/]`,
    message:
      'Hard-coded rgb/rgba/hsl/hsla colors are forbidden outside src/theme/. Resolve colors ' +
      'through the Primer-derived Mantine theme.',
  },
  {
    selector: `TemplateElement[value.cooked=/${hexColorPattern}/]`,
    message:
      'Hard-coded hex colors are forbidden outside src/theme/. Resolve colors through the ' +
      'Primer-derived Mantine theme.',
  },
  {
    selector: `TemplateElement[value.cooked=/${cssColorFnPattern}/]`,
    message:
      'Hard-coded rgb/rgba/hsl/hsla colors are forbidden outside src/theme/. Resolve colors ' +
      'through the Primer-derived Mantine theme.',
  },
];

// `defineConfig` is ESLint core's flat-config helper (replaces the deprecated
// `tseslint.config()` from typescript-eslint v8 — see
// https://typescript-eslint.io/packages/typescript-eslint/#config-deprecated).
// `globalIgnores` is the flat-config-native way to declare repo-wide ignore
// patterns (replaces the bare `{ ignores: [...] }` config object).
export default defineConfig(
  globalIgnores(['dist', 'node_modules', 'coverage', 'playwright-report']),
  {
    extends: [js.configs.recommended, tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'no-restricted-syntax': [
        'error',
        ...noRawStyledHtml,
        ...noHardCodedColors,
      ],
      // We rely on TS for unused-import detection too; keep TS rule loud.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Theme module is the *only* place hex/rgb literals are allowed (the source
  // of truth for Primer → Mantine token mapping).
  {
    files: ['src/theme/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...noRawStyledHtml],
    },
  },
  prettier,
);
