/**
 * Разбор `Move left` и `Move right` (PRD 10.6, фаза 3c) — документация
 * поведения, не настройка (Д1): записей в конфиг здесь нет.
 * Д2: таблицы обязаны совпадать с `indentLine` в `navigation_runtime.js` —
 * `dispatch_tables_tests.ts` сверяет порядок ветвей; правка поведения — правка
 * таблицы тем же коммитом (Д3). Зеркальность — умолчание `Cycle in both
 * directions` (В-12); исключение названо в подсказке тумблера.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, tipBelow, type El } from "./dom.ts";
import { sayIn } from "../texts_blocks.ts";

/** Одна строка таблицы: когда — и что тогда происходит. */
interface Step {
  when: string;
  then: string;
}

interface Table {
  command: string;
  /** Имя строки каталога с подсказкой подписи (2026-09-08). */
  tip: string;
  steps: readonly Step[];
}

/* Тексты сняты с прототипа; здесь имена строк каталога, слова — в
 * `texts_blocks.ts` (10.13.47, У-32). */
const TABLES: readonly Table[] = [
  {
    command: "MOVE_LEFT",
    tip: "MOVE_LEFT_TIP",
    steps: [
      { when: "WHEN_SELECTED", then: "THEN_MOVE_TEXT" },
      { when: "WHEN_INDENTED", then: "THEN_UNINDENT" },
      { when: "WHEN_NO_INDENT", then: "THEN_CYCLE_BACK" },
    ],
  },
  {
    command: "MOVE_RIGHT",
    tip: "MOVE_RIGHT_TIP",
    steps: [
      { when: "WHEN_SELECTED", then: "THEN_MOVE_TEXT" },
      { when: "WHEN_INDENTED", then: "THEN_INDENT" },
      { when: "WHEN_NO_INDENT", then: "THEN_CYCLE_ON" },
    ],
  },
];

/** Стрелка между условием и следствием: она же читается вслух как «тогда». */
const ARROW = " → ";

/** Разбор `Move left` / `Move right` — две таблицы рядом (10.6). */
export const dispatchTables: CustomRender = (host: El, ctx: SettingsCtx) => {
  const say = sayIn("left-right-order", ctx);
  /* Своё поддерево, а не строка целиком: строка принадлежит платформе (С5, Г16). */
  const box = el(host, "div", "io-dispatch");
  const pair = el(box, "div", "io-orderpair");
  /* Тело подсказки — под парой, не в колонке: колонка от 268 точек (У-105). */
  const capTips = el(box, "div", "io-tabletipslot");
  const showTips = Boolean(ctx.get("general.help.showTips"));
  const showIds = Boolean(ctx.get("advanced.showSettingIds"));
  const closers: Array<() => void> = [];
  for (const table of TABLES) {
    const col = el(pair, "div");
    const cap = el(col, "div", "io-ordercol__caprow");
    const name = say(table.command);
    el(cap, "code", "io-ordercol__cap", name);
    closers.push(tipBelow({
      head: cap,
      host: capTips,
      text: say(table.tip),
      label: name,
      id: "io-dispatch-" + table.command.toLowerCase().replace(/_/g, "-") + "-tip",
      showTips, showIds,
    }));
    const list = el(col, "ol", "io-order");
    for (const step of table.steps) {
      const li = el(list, "li");
      el(li, "b", undefined, say(step.when));
      el(li, "span", undefined, ARROW);
      el(li, "span", "io-order__then", say(step.then));
    }
  }
  /* Записей нет и подписок нет: снимается своё поддерево и открытые подсказки. */
  return () => {
    for (const close of closers) { try { close(); } catch { /* узла уже нет */ } }
    box.empty();
  };
};

/** Таблицы наружу: проверка Д2 сверяет их с исходником рантайма. */
export { TABLES as DISPATCH_TABLES };
