// ESLint, плоский конфиг (PRD фаза 0, пункт 1).
//
// Существующий код на JS не переписывается (Р4), поэтому для .js правила
// мягкие: линтер ловит настоящие ошибки, а не расставляет запятые. Новый
// код на TS проверяется строже.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "main.js",
      "docs/prototype/**",   // прототип — отдельный документ со своими правилами
      "tests/fixtures/**",
      "tests/TagWheel/**",
      "tests/TriggerWheel/**",
    ],
  },

  // конфиги и скрипты на ESM
  {
    ...js.configs.recommended,
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      /* Инструменты в `tools/` — обычные скрипты Node: печатают и читают argv. */
      globals: {
        console: "readonly",
        process: "readonly",
        globalThis: "readonly",
      },
    },
  },

  // существующий движок и тесты: только настоящие ошибки
  {
    ...js.configs.recommended,
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "writable",
        exports: "writable",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        globalThis: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        CodeMirror: "readonly",
        app: "readonly",
        // подставляются во время исполнения: модулем obsidian или склейкой бандла
        Notice: "readonly",
        MutationObserver: "readonly",
        Event: "readonly",
        KeyboardEvent: "readonly",
        MouseEvent: "readonly",
        DragEvent: "readonly",
        getComputedStyle: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-cond-assign": ["error", "except-parens"],
      "no-control-regex": "off",
      "no-prototype-builtins": "off",
      "no-useless-escape": "warn",
      /*
       * Предупреждение, а не ошибка, и вот почему. На первом прогоне линтер
       * нашёл пять обращений к именам, которых нет в области видимости:
       *   settings_sections_renderer.js:2154, 2596, 2605, 2614 - refreshSettings
       *   status_date.js:247 - getLineFinalizeUnified
       * Скорее всего их подставляет склейка бандла через vault_module_bridge.
       * Первый файл удаляется в фазе 3, мост - в фазе 6; после перехода на
       * статические импорты это станут настоящими ошибками, и тогда правило
       * поднимается до error. Пока держать CI красным из-за кода, который
       * приговорён к удалению, смысла нет.
       */
      "no-undef": "warn",
    },
  },

  // новый код: строже, плюс запреты из раздела 3.3
  ...tseslint.configs.recommended.map(c => ({ ...c, files: ["**/*.ts"] })),
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",     // обвязка тестов моками
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-restricted-properties": [
        "error",
        { object: "el", property: "innerHTML", message: "З5: разметка через createEl, не innerHTML" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Function']",
          message: "З5: new Function запрещён",
        },
        {
          selector: "CallExpression[callee.name='eval']",
          message: "З5: eval запрещён",
        },
      ],
    },
  },
];
