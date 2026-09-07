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
       * Ошибка, а не предупреждение, с 2026-09-07, поздний вечер.
       *
       * На первом прогоне линтер нашёл пять обращений к именам вне области
       * видимости: четыре в `settings_sections_renderer.js` (файл удалён в
       * фазе 3) и одно в `status_date.js` (мост модулей снят 2026-09-07).
       * Шестое, `macroPath` в `pkm_runtime_v2.js:113`, нашлось тогда, когда
       * `main.js` перестал быть исключением, и починено в тот же вечер
       * (дефект A42): в тексте исключения стояло имя, которого в области
       * видимости нет, — вместо причины человек получил бы `ReferenceError`
       * из обработчика ошибки.
       *
       * Мест не осталось ни одного, и правило поднято: следующее такое имя
       * уронит проверку, а не будет копиться.
       */
      "no-undef": "error",
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
