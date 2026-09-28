/**
 * Выбиралка Prefix у Value — его пункт 2026-09-28 в «Новое пишите сюда»:
 * «при нажатии на io-values-col-prefix открывалось окно с подсказками всех
 * возможных префиксов `- [ ]`, `- [N]` и т.д. и сразу показывалось как этот
 * префикс будет выглядеть в строке (вид префиксов меняется в зависимости от
 * темы)… примерно как ты сделал подсказчик для выбора emoji».
 *
 * **Вид рисует тема, а не мы.** Образец — та же разметка, которой Obsidian
 * рисует задачу в режиме чтения: `li.task-list-item[data-task]` с
 * `input.task-list-item-checkbox[data-task]` внутри `.markdown-rendered`.
 * Правила темы (у него Minimal) ложатся на неё сами; своего цвета у образца
 * нет. Знак внутри скобок — ровно один (правило 24).
 *
 * Поле остаётся полем: вписать свой знак можно по-прежнему, выбиралка только
 * кладёт `[x]` в поле тем же путём, что и набор.
 */

import { el, btn, type El, type ElInput } from "./dom.ts";
import { attachPopup } from "./char_picker.ts";

/**
 * Знаки задач, которые рисуют темы с «альтернативными чекбоксами» (Minimal,
 * Things, ITS): набор и имена — из документации Minimal. Тема, которая знака
 * не знает, рисует его обычной отмеченной задачей — это и видно в образце.
 */
export const CHECKBOX_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  [" ", "To do"], ["x", "Done"], ["/", "In progress"], ["-", "Canceled"],
  [">", "Forwarded"], ["<", "Scheduling"], ["?", "Question"], ["!", "Important"],
  ["*", "Star"], ["\"", "Quote"], ["l", "Location"], ["b", "Bookmark"],
  ["i", "Information"], ["S", "Savings"], ["I", "Idea"], ["p", "Pro"],
  ["c", "Con"], ["f", "Fire"], ["k", "Key"], ["w", "Win"],
  ["u", "Up"], ["d", "Down"],
];

export interface PrefixPickerOpts {
  say: (name: string) => string;
  /** Текст рядом с чекбоксом в образце — имя Value. */
  sample: string;
  /** `[x]` или пусто — «без чекбокса». */
  onPick: (token: string) => void;
  holdKeys?: (onEscape: () => void) => () => void;
}

/** Строка задачи разметкой Obsidian: её красит тема. */
function drawTask(host: El, ch: string, text: string): void {
  /* Класс платформы отдельно: по нему тема узнаёт отрисованную заметку. */
  const md = el(host, "div", "io-pfx__md");
  md.addClass("markdown-rendered");
  const ul = md.createEl("ul", { cls: "contains-task-list" });
  const done = ch !== " ";
  const task = done ? ch : "";
  const li = ul.createEl("li", { cls: "task-list-item" + (done ? " is-checked" : ""), attr: { "data-task": task } });
  const box = li.createEl("input", {
    cls: "task-list-item-checkbox", type: "checkbox", attr: { "data-task": task, tabindex: "-1", "aria-hidden": "true" },
  }) as ElInput & { checked?: boolean };
  if (done) box.checked = true;
  li.createEl("span", { text });
}

/** Повесить выбиралку на поле Prefix; `host` — строка таблицы Values. */
export function attachPrefixPicker(input: ElInput, host: El, o: PrefixPickerOpts): { close: () => void } {
  const panel = el(host, "div", "io-pfx");
  panel.hidden = true;
  panel.tabIndex = -1;
  const draw = (): void => {
    panel.empty();
    el(panel, "div", "io-pfx__hint", o.say("PREFIX_PICK_HINT"));
    const grid = el(panel, "div", "io-pfx__grid");
    const none = btn(grid, "io-pfx__item", { label: o.say("PREFIX_PICK_NONE") });
    const plain = el(none, "div", "io-pfx__md");
    plain.addClass("markdown-rendered");
    /* Знак списка — своим узлом: строка образца — флекс, и `::marker` у неё не рисуется. */
    const li = plain.createEl("ul").createEl("li");
    li.createEl("span", { cls: "io-pfx__bullet", text: "•" });
    li.createEl("span", { text: o.sample });
    el(none, "span", "io-pfx__code", o.say("PREFIX_PICK_NONE"));
    none.addEventListener("click", (() => { o.onPick(""); close(); }) as never);
    for (const [ch, name] of CHECKBOX_PREFIXES) {
      const token = "[" + ch + "]";
      const cell = btn(grid, "io-pfx__item", { label: token + " " + name });
      /* Три в ряд режут длинное имя многоточием — целиком оно во всплывающей подписи. */
      cell.setAttribute("title", token + " " + name);
      drawTask(cell, ch, o.sample);
      el(cell, "span", "io-pfx__code", token + " " + name);
      cell.addEventListener("click", (() => { o.onPick(token); close(); }) as never);
    }
  };
  const { close } = attachPopup(input, panel, { draw, ...(o.holdKeys ? { holdKeys: o.holdKeys } : {}) });
  return { close };
}
