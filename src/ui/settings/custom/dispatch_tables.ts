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
import { el, tipBelow, type El } from "./dom.ts";
import { sayIn } from "../texts_blocks.ts";

/** Одна строка таблицы: когда — и что тогда происходит. */
interface Step {
  when: string;
  then: string;
}

interface Table {
  command: string;
  /**
   * Имя строки каталога с подсказкой подписи. Подсказка есть у обеих —
   * заказ заказчика 2026-09-08: «tip ко всем элементам, у которых еще нет».
   */
  tip: string;
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
  /*
   * Своё поддерево, а не строка настройки целиком: очистка блока снимает
   * только то, что он завёл сам (С5). Опустошать строку нельзя — она
   * принадлежит платформе, и гейт Г16 на этом ловит.
   */
  const box = el(host, "div", "io-dispatch");
  const pair = el(box, "div", "io-orderpair");
  /*
   * Тело подсказки раскрывается ПОД парой, а не внутри колонки: колонка тут
   * от 268 точек, и прозе в ней тесно — ровно тот дефект, за который заказчик
   * присылал скриншот подсказок шириной с имя настройки (У-105).
   */
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
