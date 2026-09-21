"use strict";

/**
 * Smart paste (`З-31` и `З-32`).
 *
 * **Имя его, и оно поменялось 2026-09-21**: «сразу хочу изменить название на
 * Smart paste в `З-31` и `З-32`». Прежнее — `Smart insert`.
 *
 * Два его случая, и оба под одним выключателем (`В-165`, 2026-09-15):
 *
 *   1. «я вырезал нумерованный список из другого листа и вставил сюда. список
 *      начался с номера 9. Я хочу, чтобы он начинался с 1 (в случае если я
 *      вставляю список не под имеющимся - тогда список должен продолжаться)»;
 *   2. вставка `1. text` в строку `2. ` даёт `2. text`, а в `2. aaa` —
 *      `2. aaa text`.
 *
 * **Продолжение счёта пишем не мы, и это измерено, а не выведено.** Нумерацию
 * списков Obsidian правит фильтром транзакций внутри `app.js` (У-245,
 * правило 167), и проба этим самым фильтром (`tools/renumber_bench.js`,
 * раздел вставки) показала: список, поданный **пронумерованным с единицы**,
 * фильтр продолжает ровно там же и ровно так же, как продолжал список с
 * девятки. То есть половина его требования — уже поведение платформы, и своего
 * правила «под списком ли это» здесь нет и быть не должно (правило 101): мы
 * только приводим вставку к счёту с единицы, остальное делает она.
 *
 * Отсюда и форма записи: обычная правка редактором, **не** `Editor.setValue`.
 * Тот ставит `userEvent: "set"`, а на нём фильтр из себя выходит и нумерацию
 * не трогает вовсе — измерено тем же прогоном.
 *
 * **Решение считается отдельно от записи**, как у `Smart Enter`:
 * `planSmartPaste` — чистая функция, на входе текст из буфера, строка, в
 * которую вставляют, и место курсора; на выходе то, что уйдёт в документ, или
 * `null` — «это не наш случай, клавиша платформы».
 */

const __sharedUtils = require("../core/shared_utils.js");

/**
 * Что уйдёт в документ вместо того, что лежит в буфере.
 *
 * `null` означает «мы не вмешиваемся»: вставка идёт обычным путём Obsidian.
 * Условий отказа четыре, и каждое возвращает `null`:
 *
 *   1. функция выключена;
 *   2. в буфере пусто;
 *   3. в буфере одна строка без знака списка, и строка, в которую вставляют,
 *      знака не несёт — то есть ни одна из двух половин не про этот случай;
 *   4. **посчитанное совпало с тем, что и так лежит в буфере.** Это главное
 *      условие: вставка, у которой нумерация уже с единицы и знака стыковать
 *      не с чем, ничем от обычной не отличается, и перехватывать её незачем.
 */
function planSmartPaste(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;

  const pasted = String(o.pasted == null ? "" : o.pasted);
  if (!pasted) return null;

  const lineText = String(o.lineText == null ? "" : o.lineText);
  const ch = Math.max(0, Math.min(Number(o.ch) || 0, lineText.length));

  let lines = pasted.split("\n");

  /*
   * Половина вторая (`З-32`): первая строка вставки теряет свой знак списка,
   * если строка, в которую вставляют, знак уже несёт и курсор стоит **за**
   * ним. Иначе человек получает `2. 1. text` — два знака подряд, и второй
   * Obsidian уже не считает знаком.
   *
   * Снимается ровно начало строки — отступ, цитата, знак и чекбокс, — тем же
   * разбором, которым его считает `Smart Enter`: второе объявление «что такое
   * начало строки» разошлось бы с первым молча (У-32).
   */
  const target = __sharedUtils.lineMarkerOf(lineText);
  let joined = false;
  if (target.marker && ch >= target.at) {
    const head = __sharedUtils.lineMarkerOf(lines[0]);
    if (head.marker) {
      lines[0] = String(lines[0]).slice(head.at);
      joined = true;
    }
  }

  /*
   * Половина первая (`З-31`): нумерованные пункты вставки считаются с
   * единицы. Считает это `renumberOrderedWindow` — тот же дом, которым
   * плагин считает номера после переноса строк. Уровень у каждого пункта
   * свой, и подсписок внутри вставки тоже начинается с единицы.
   */
  lines = __sharedUtils.renumberOrderedWindow(lines, 0, lines.length - 1);

  let insert = lines.join("\n");

  /*
   * Стык: снятый знак оставил бы `2. aaatext`. Пробел ставится **только**
   * там, где слева от курсора есть непробельный знак, — тогда его примеры
   * выходят оба: `2. ` + `1. text` даёт `2. text`, `2. aaa` + `1. text` даёт
   * `2. aaa text`.
   */
  if (joined && insert) {
    const before = lineText.slice(0, ch);
    if (before && !/\s$/.test(before) && !/^\s/.test(insert)) insert = " " + insert;
  }

  if (insert === pasted) return null;
  return { insert };
}

/**
 * Обработчик события вставки. Всё, что связано с редактором, живёт здесь.
 *
 * Возвращает `true`, если вставку взял на себя плагин: вызывающий на этом
 * гасит событие. `false` означает «обычная вставка Obsidian».
 *
 * **`evt.defaultPrevented` спрашивается первым** — так велит сам тип события
 * в `obsidian.d.ts`: «Check for `evt.defaultPrevented` before attempting to
 * handle this event». Вставку могли уже забрать, и вторая поверх неё была бы
 * дефектом, а не функцией.
 */
function handleSmartPaste(plugin, evt, editor) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const sp = cfg && cfg.editor && cfg.editor.smartPaste ? cfg.editor.smartPaste : null;
  if (!sp || sp.enabled !== true) return false;
  if (!evt || evt.defaultPrevented) return false;
  if (!editor || typeof editor.replaceSelection !== "function") return false;

  try {
    const data = evt.clipboardData;
    /* Буфера может не быть вовсе — это проба платформы, а не отказ. */
    if (!data || typeof data.getData !== "function") return false;
    /* Картинку и файл мы не трогаем: у них своего текста нет. */
    const pasted = String(data.getData("text/plain") || "").replace(/\r\n?/g, "\n");
    if (!pasted) return false;

    /*
     * Строка и место, куда придётся вставка, — **начало** выделения: там, где
     * оно кончается, текста после вставки уже не будет.
     */
    const from = typeof editor.getCursor === "function" ? editor.getCursor("from") : null;
    const line = Number(from && from.line);
    if (!Number.isFinite(line)) return false;

    const plan = planSmartPaste({
      enabled: true,
      pasted,
      lineText: String(editor.getLine(line) || ""),
      ch: Number(from.ch) || 0,
    });
    if (!plan) return false;

    evt.preventDefault();
    /*
     * Обычная правка редактором: выделенное заменяется, история получает свою
     * ступень, а фильтр нумерации Obsidian отрабатывает поверх — именно он
     * продолжает счёт там, где вставка легла под список.
     */
    editor.replaceSelection(plan.insert);
    return true;
  } catch (e) {
    console.error("[inline-overhaul][smart-paste]", e);
    return false;
  }
}

module.exports = {
  planSmartPaste,
  handleSmartPaste,
};
