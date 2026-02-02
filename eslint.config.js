// =============================================================================
// Ross Built Construction Management Software - ESLint Configuration
// Server-side Node.js linting rules
// =============================================================================

import js from "@eslint/js";
import globals from "globals";

export default [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "client/**",  // Client has its own eslint config
      "dist/**",
      "build/**",
      "coverage/**",
      "*.min.js",
    ],
  },

  // Base configuration for all JavaScript files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      // Use recommended rules as base
      ...js.configs.recommended.rules,

      // -----------------------------------------------------------------------
      // Error Prevention - Catch common mistakes
      // -----------------------------------------------------------------------
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "no-undef": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-empty": ["error", { allowEmptyCatch: true }],

      // -----------------------------------------------------------------------
      // Best Practices - Encourage better code
      // -----------------------------------------------------------------------
      "eqeqeq": ["warn", "smart"],
      "no-var": "warn",
      "prefer-const": ["warn", { destructuring: "all" }],
      "no-throw-literal": "error",
      "no-return-await": "warn",

      // -----------------------------------------------------------------------
      // Style - Consistent formatting (not too strict)
      // -----------------------------------------------------------------------
      "semi": ["warn", "always"],
      "quotes": ["warn", "single", {
        avoidEscape: true,
        allowTemplateLiterals: true
      }],
      "comma-dangle": ["warn", "always-multiline"],
      "no-trailing-spaces": "warn",
      "eol-last": ["warn", "always"],

      // -----------------------------------------------------------------------
      // Node.js Specific
      // -----------------------------------------------------------------------
      "no-process-exit": "off",  // Allow process.exit in scripts
      "no-console": "off",  // Allow console.log for server logging

      // -----------------------------------------------------------------------
      // Async/Await
      // -----------------------------------------------------------------------
      "require-await": "off",  // Allow async without await (for consistency)
      "no-async-promise-executor": "error",
    },
  },

  // Configuration for test files (more relaxed)
  {
    files: ["tests/**/*.js", "**/*.spec.js", "**/*.test.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        test: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-console": "off",
    },
  },

  // Configuration for scripts directory
  {
    files: ["server/scripts/**/*.js"],
    rules: {
      "no-console": "off",
      "no-process-exit": "off",
    },
  },
];
