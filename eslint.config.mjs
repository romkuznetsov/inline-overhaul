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
      /*
       * `caughtErrorsIgnorePattern` — Д-3 разбора готовности, 2026-09-08.
       *
       * Без него каждый `catch (_)` давал предупреждение, и таких было **136
       * из 178**. Настоящих неиспользуемых объявлений — 42, и в отчёте из
       * двухсот строк их не видел никто. Предупреждение, которое есть всегда,
       * не сообщает ничего — ровно тот механизм, которым в этом проекте
       * дважды пропускали настоящие находки.
       *
       * Имя `_` у пойманного исключения — это не «забыли использовать», а
       * «причина здесь не нужна»: правило, какой отказ говорит вслух, а какой
       * молчит, — предмет Д-4 и живёт в `CLAUDE.md`, а не в линтере.
       */
      "no-unused-vars": ["warn", {
        args: "none",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "no-empty": ["warn", { allowEmptyCatch: true }],
      "no-cond-assign": ["error", "except-parens"],
      "no-control-regex": "off",
      "no-prototype-builtins": "off",
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
      /*
       * `const` и `let` вместо `var` — правило каталога Obsidian П18.
       *
       * Ошибка, а не предупреждение, но **не везде**: шесть движков ниже
       * выведены из-под правила, и это решение, а не забывчивость.
       * `var` там 1389 объявлений, файлы под З3, и принятое правило Р4
       * прямо говорит, что существующие движки не переписываются.
       * Механическая замена в самом дефектном и хуже всего покрытом коде
       * покупает стиль, а платит риском: `var` живёт в функции, `let` — в
       * блоке, и у замыкания в цикле смысл при этом меняется.
       *
       * Во всём остальном коде правило работает: 75 объявлений вне З3
       * переведены 2026-09-11, и новых не заведёшь.
       */
      "no-var": "error",

      /*
       * **Выключено 2026-09-11, и это решение, а не забывчивость.** Правило
       * ловило 37 мест, все одного рода: лишний обратный слэш в регулярном
       * выражении. На поведение он не влияет **никогда** — правило вкусовое.
       *
       * Половина этих мест — не шум, а подсказка читателю: `[\-?:]` и
       * `[^A-Za-z0-9\[]` со слэшем читаются, без него надо вспоминать, что
       * скобка внутри класса значит саму себя. Править выражения так, чтобы
       * они стали хуже читаться, — плохой обмен в проекте, который за
       * читаемость платит.
       *
       * Вторая половина лежала в движках под З3, и там цена ещё выше:
       * исключение к запрету ради красоты — тот же обмен, от которого
       * отказались по шву TagWheel (PRD 15.7).
       *
       * **А шум прячет следующее настоящее предупреждение** (Д-3): 42 живых
       * пункта однажды уже были не видны за ним. Поэтому правило гасится
       * целиком, и `npm run lint` снова значит «есть настоящее».
       */
      "no-useless-escape": "off",
    },
  },

  // движки под З3: правило Р4 — существующий JS не переписывается
  {
    files: [
      "pkm_v2/**/*.js",
      "pkm_runtime_v2.js",
      "navigation_runtime.js",
      "src/core/line_pipeline.js",
      "src/core/status_*.js",
      "src/core/token_graph_unified.js",
    ],
    rules: { "no-var": "off" },
  },

  // новый код: строже, плюс запреты из раздела 3.3
  ...tseslint.configs.recommended.map(c => ({ ...c, files: ["**/*.ts"] })),
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",     // обвязка тестов моками
      /* То же, что у `.js`: `catch (_)` — это решение, а не забытое имя (Д-3). */
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
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
