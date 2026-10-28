// ESLint flat config. Formatting is Prettier's job; eslint-config-prettier turns off clashing rules.
import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const unusedVars = [
  "error",
  { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
];

export default defineConfig([
  globalIgnores([
    "dist/**",
    "extension/dist/**",
    "dev-dist/**",
    "coverage/**",
    "docs/**",
    "supabase/**",
    "src/lib/supabase/database.types.ts",
    ".claude/**",
  ]),

  // Application code: type-aware strict rules, React hooks, Fast Refresh and accessibility.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVars,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Chrome extension (extension/): the same type-aware strict rules, browser and extension globals.
  {
    files: ["extension/src/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.webextensions },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVars,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Tests may use non-null assertions, fake async APIs without awaiting anything, and defensive
  // checks for things jsdom lacks (the DOM types claim they always exist).
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**/*.{ts,tsx}", "extension/src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },

  // Tooling: config files and Node scripts (no type-aware rules; they are not in an app tsconfig).
  {
    files: ["*.{js,mjs,cjs,ts}", "scripts/**/*.{js,mjs}", "extension/vite.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-unused-vars": unusedVars },
  },

  prettier,
]);
