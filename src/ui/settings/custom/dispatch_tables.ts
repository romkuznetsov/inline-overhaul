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
 * **Таблицы зеркальны с 2026-09-01** (В-12). До этого `Move right` циклировал
 * Prefix только на строке, которая ещё не элемент списка, — на буллите он
 * увеличивал отступ, и таблицы расходились строкой. Теперь этим управляет
 * `Cycle in both directions`: включён (умолчание) — направления зеркальны,
 * выключен — `Move right` только сдвигает. Таблица показывает умолчание, а
 * исключение названо в подсказке самого тумблера.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El } from "./dom.ts";
import { sayIn } from "../texts_blocks.ts";

/** Одна строка таблицы: когда — и что тогда происходит. */
interface Step {
  when: string;
  then: string;
}

interface Table {
  command: string;
  steps: readonly Step[];
}

/*
 * Тексты сняты с прототипа: он согласован, и таблицы в нём — часть согласия.
 * Здесь стоят **имена** строк каталога, а сами слова живут в `texts_blocks.ts`
 * (10.13.47): у видимого текста один дом, и второе его объявление разошлось бы
 * молча (У-32).
 */
const TABLES: readonly Table[] = [
  {
    command: "MOVE_LEFT",
    steps: [
      { when: "WHEN_SELECTED", then: "THEN_MOVE_TEXT" },
      { when: "WHEN_INDENTED", then: "THEN_UNINDENT" },
      { when: "WHEN_NO_INDENT", then: "THEN_CYCLE_BACK" },
    ],
  },
  {
    command: "MOVE_RIGHT",
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
  /*
   * Своё поддерево, а не строка настройки целиком: очистка блока снимает
   * только то, что он завёл сам (С5). Опустошать строку нельзя — она
   * принадлежит платформе, и гейт Г16 на этом ловит.
   */
  const box = el(host, "div", "io-dispatch");
  const pair = el(box, "div", "io-orderpair");
  for (const table of TABLES) {
    const col = el(pair, "div");
    el(col, "code", "io-ordercol__cap", say(table.command));
    const list = el(col, "ol", "io-order");
    for (const step of table.steps) {
      const li = el(list, "li");
      el(li, "b", undefined, say(step.when));
      el(li, "span", undefined, ARROW);
      el(li, "span", "io-order__then", say(step.then));
    }
  }
  /* Записей нет и подписок нет: снимается только своё поддерево. */
  return () => { box.empty(); };
};

/** Таблицы наружу: проверка Д2 сверяет их с исходником рантайма. */
export { TABLES as DISPATCH_TABLES };
