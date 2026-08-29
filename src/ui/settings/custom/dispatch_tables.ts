/**
 * Разбор `Move left` и `Move right` (PRD 10.6, фаза 3c).
 *
 * Это документация поведения, а не настройка (Д1): две таблицы «что делает
 * команда, смотря по тому, что выделено и где стоит курсор». Ни одной записи в
 * конфиг здесь нет и быть не должно.
 *
 * **Д2: таблицы обязаны совпадать с поведением** `navigation_runtime.js`,
 * функция `indentLine`. Совпадение не на честном слове: проверка
 * `dispatch_tables_tests.ts` читает исходник рантайма и падает, если порядок
 * ветвей в нём разошёлся с порядком строк здесь. Тронул поведение — правь
 * таблицу тем же коммитом (Д3).
 *
 * Асимметрия строк — не опечатка, а факт: `Move left` циклирует Prefix всегда,
 * когда отступ нулевой; `Move right` — только если строка ещё не элемент
 * списка, иначе увеличивает отступ.
 */

import type { CustomRender } from "../types.ts";
import { el, type El } from "./dom.ts";

/** Одна строка таблицы: когда — и что тогда происходит. */
interface Step {
  when: string;
  then: string;
}

interface Table {
  command: string;
  steps: readonly Step[];
}

/* Тексты сняты с прототипа: он согласован, и таблицы в нём — часть согласия. */
const TABLES: readonly Table[] = [
  {
    command: "Move left",
    steps: [
      { when: "part of a line is selected", then: "move that text" },
      { when: "the line is indented", then: "remove one indent level" },
      { when: "no indent", then: "cycle the prefix backwards" },
    ],
  },
  {
    command: "Move right",
    steps: [
      { when: "part of a line is selected", then: "move that text" },
      { when: "a list item, or already indented", then: "add one indent level" },
      { when: "anything else", then: "cycle the prefix forwards" },
    ],
  },
];

/** Стрелка между условием и следствием: она же читается вслух как «тогда». */
const ARROW = " → ";

/** Разбор `Move left` / `Move right` — две таблицы рядом (10.6). */
export const dispatchTables: CustomRender = (host: El) => {
  /*
   * Своё поддерево, а не строка настройки целиком: очистка блока снимает
   * только то, что он завёл сам (С5). Опустошать строку нельзя — она
   * принадлежит платформе, и гейт Г16 на этом ловит.
   */
  const box = el(host, "div", "io-dispatch");
  const pair = el(box, "div", "io-orderpair");
  for (const table of TABLES) {
    const col = el(pair, "div");
    el(col, "code", "io-ordercol__cap", table.command);
    const list = el(col, "ol", "io-order");
    for (const step of table.steps) {
      const li = el(list, "li");
      el(li, "b", undefined, step.when);
      el(li, "span", undefined, ARROW);
      el(li, "span", "io-order__then", step.then);
    }
  }
  /* Записей нет и подписок нет: снимается только своё поддерево. */
  return () => { box.empty(); };
};

/** Таблицы наружу: проверка Д2 сверяет их с исходником рантайма. */
export { TABLES as DISPATCH_TABLES };
