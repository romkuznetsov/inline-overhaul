"use strict";

/**
 * Smart Enter (PRD 10.13.88).
 *
 * Заказ заказчика 2026-09-12: «`Enter` в строке, когда курсор находится до
 * сепаратора 2. Дефолтное поведение — перенос текста на следующую строку. Я
 * хочу, чтобы при `smart Enter = on` вместо этого вставлялась новая пустая
 * строка, а предыдущая (из которой был нажат enter) оставалась неизменной».
 *
 * То есть его строка — не абзац, а запись: разорвав её пополам, `Enter` уносит
 * правый Block от левого, и обе половины перестают быть записями. Здесь он не
 * рвёт, а добавляет следующую.
 *
 * **Решение считается отдельно от записи.** `planSmartEnter` — чистая функция:
 * на входе текст строки, место курсора, границы слота текста и настройки, на
 * выходе то, что встанет новой строкой. Так проверке не нужен ни Obsidian, ни
 * редактор, а условия тихого отказа видны списком (У-41): их четыре, и каждое
 * возвращает `null`, то есть отдаёт клавишу платформе.
 *
 * **Где кончается наш случай.** Границы слота текста считает
 * `getTextSlotBounds` в `src/core/pkm_macro_shared.js` — то же правило, которым
 * их считает курсор после команды и прыжок по заголовкам. Своего разбора
 * строки здесь нет и быть не должно (У-32): второе объявление «где второй
 * разделитель» разошлось бы с первым молча.
 *
 * **Насколько широко клавиша действует, решает человек** (`scope`, заказ
 * заказчика 2026-09-13, 10.13.91). `line` — вся строка есть одна запись, и
 * место курсора в ней не важно; `text` — только слот текста, а в зонах значений
 * клавиша снова принадлежит Obsidian. Слот в обоих случаях считает та же
 * функция: правило «где текст человека» объявлено один раз.
 */

const __sharedUtils = require("../core/shared_utils.js");
const __macroShared = require("../core/pkm_macro_shared.js");
const __rulesShape = require("../core/pkm_rules_shape.js");

/**
 * Знак списка для новой строки.
 *
 * **Правило о чужой разметке спрашивается у платформы** (У-91): Obsidian на
 * `Enter` повторяет маркер, увеличивает номер на единицу и ставит **пустой**
 * чекбокс — новая строка не может быть сделанной задачей. Здесь то же самое.
 *
 * Положений три — решение заказчика 2026-09-13:
 *
 *   - `same` — повторить знак целиком (умолчание);
 *   - `none` — знака нет вовсе;
 *   - `number-only` — знака нет, **кроме** номера: нумерованный список не
 *     теряет счёт. Чекбокс при этом уходит вместе с маркером: «нет» относится
 *     ко всему, кроме нумерации, и это его же слово.
 *
 * Пусто означает «знака нет»: у строки без списка повторять нечего.
 */
function nextMarkerFor(lineText, mode) {
  const how = String(mode == null ? "same" : mode);
  if (how === "none") return "";
  const p = __sharedUtils.lineMarkerOf(lineText);
  if (!p.marker) return "";
  if (how === "number-only" && !p.ordered) return "";
  let marker = p.marker;
  if (p.ordered) {
    marker = marker.replace(/^(\d+)/, function (whole) {
      const n = Number(whole);
      return Number.isFinite(n) ? String(n + 1) : whole;
    });
  }
  if (how === "number-only") {
    /* Остаётся только счёт: чекбокс уходит вместе с остальным знаком. */
    return marker.replace(/\s*\[[^\]]\]\s*/, " ");
  }
  /* Чекбокс уезжает пустым: знак внутри скобок ровно один (A34, У-91). */
  marker = marker.replace(/\[[^\]]\]/, "[ ]");
  return marker;
}

/**
 * Решение о нажатии `Enter`.
 *
 * `null` означает «это не наш случай»: клавиша уходит платформе такой, какой
 * была. Условия отказа:
 *
 *   1. функция выключена;
 *   2. строка пуста или в ней один знак списка — `Enter` на ней выходит из
 *      списка; строка без разделителей плагина — целиком слот текста;
 *   3. при `scope = "text"` — курсор вне слота текста: в зоне значений клавиша
 *      снова принадлежит Obsidian;
 *   4. курсор не один или что-то выделено (это решается выше, в обработчике:
 *      сюда такой случай не доходит).
 *
 * **Отказа «курсор за вторым разделителем» здесь больше нет, и это починка.**
 * Он стоял литералом с 2026-09-13, и объяснение к нему — «там рвать нечего» —
 * оказалось неверным: рвать там есть что, саму запись. Заказчик принёс это
 * замечанием в тот же день: «курсор находился на сепараторе 2, а также в right
 * block — не ок (поведение обычного enter)». Где клавиша работает, решает
 * теперь `scope`, и прежнее поведение ни одному из его положений не равно.
 */
function planSmartEnter(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;

  const text = String(o.lineText || "");
  const p = __sharedUtils.lineMarkerOf(text);
  /*
   * **Строка без разделителей — целиком слот текста** (его пункт «Новое»
   * 2026-09-29: «smart enter не работает на plain text и списке без values в
   * left/right block»). Прежде такая строка нашей не считалась, и клавиша
   * уходила платформе. Пустая строка и пустой пункт списка остаются ей:
   * `Enter` на них выходит из списка.
   */
  let bounds = o.textSlot;
  if (!bounds || typeof bounds.end !== "number") {
    if (!text.slice(p.at).trim()) return null;
    bounds = { start: p.at, end: text.length };
  }

  const ch = Math.max(0, Math.min(Number(o.ch) || 0, text.length));
  if (String(o.scope || "line") === "text") {
    const from = typeof bounds.start === "number" ? bounds.start : 0;
    if (ch < from || ch > bounds.end) return null;
  }

  /*
   * Отступ остаётся при **любом** положении, знак списка — по настройке.
   * Отступ Prefix-ом не зовётся ни в панели, ни в PRD: строка на третьем
   * уровне вложенности не имеет права прыгнуть к левому краю оттого, что
   * человек выбрал «без знака».
   */
  const marker = nextMarkerFor(text, o.newLinePrefix);
  const newLineText = p.indent + p.quote + marker;
  return { newLineText, cursorCh: newLineText.length };
}

/**
 * Обработчик клавиши. Всё, что связано с редактором, живёт здесь; решение —
 * в чистой функции выше.
 */
function handleSmartEnterKeymap(plugin) {
  if (plainEnter) return false;
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const se = cfg && cfg.editor && cfg.editor.smartEnter ? cfg.editor.smartEnter : null;
  if (!se || se.enabled !== true) return false;

  const editor = plugin && typeof plugin.getActiveEditor === "function" ? plugin.getActiveEditor() : null;
  if (!editor) return false;

  try {
    if (typeof editor.somethingSelected === "function" && editor.somethingSelected()) return false;
    if (typeof editor.listSelections === "function") {
      const sels = editor.listSelections();
      if (Array.isArray(sels) && sels.length > 1) return false;
    }

    const cursor = editor.getCursor();
    const line = Number(cursor && cursor.line);
    if (!Number.isFinite(line)) return false;

    const lineText = String(editor.getLine(line) || "");
    /* Код и таблица — не запись: там `Enter` рвёт строку (R4). */
    if (__sharedUtils.isCodeOrTableLine((n) => editor.getLine(n), line)) return false;
    /*
     * Правила — те же, что получают движки (`buildRulesForEngines`): не
     * только разделители человека, но и его Fields. Без Fields одиночный
     * разделитель нельзя признать вторым — `- текст || 📅…` читалась слотом
     * текста за датой, и `Text only` отдавал клавишу платформе (BUGHUNT K4).
     */
    const lf = cfg.pkm && cfg.pkm.lineFormat ? cfg.pkm.lineFormat : {};
    if (!lf.separator1 || !lf.separator2) return false;
    const rules = __rulesShape.buildRulesForEngines(cfg);

    const plan = planSmartEnter({
      enabled: true,
      lineText,
      ch: Number(cursor.ch) || 0,
      textSlot: __macroShared.getTextSlotBounds(lineText, rules),
      newLinePrefix: se.newLinePrefix,
      scope: se.scope,
    });
    if (!plan) return false;

    /*
     * Новая строка вставляется **за** нынешней, и нынешняя не трогается вовсе:
     * замена идёт нулевым диапазоном в её конце. Так в истории отмен остаётся
     * одна ступень — вставка, — а строка человека в неё не попадает.
     */
    const end = { line, ch: lineText.length };
    editor.replaceRange("\n" + plan.newLineText, end, end);
    editor.setCursor({ line: line + 1, ch: plan.cursorCh });
    return true;
  } catch (e) {
    console.error("[inline-overhaul][smart-enter]", e);
    return false;
  }
}

/* Идёт проход обычного `Enter` за `Shift+Enter` — Smart Enter в нём не участвует. */
let plainEnter = false;

/**
 * `Shift+Enter` — обычный `Enter` платформы, когда включены Smart Enter и
 * `Shift+Enter as usual Enter` (его слово 2026-09-30: сперва «всегда», следом
 * «сделай контрол»). `runEnter` прогоняет обработчики `Enter` без Shift; в
 * остальных случаях клавиша не наша, и `Shift+Enter` остаётся платформенным.
 */
function handlePlainEnterKeymap(plugin, runEnter) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const se = cfg && cfg.editor && cfg.editor.smartEnter ? cfg.editor.smartEnter : null;
  if (!se || se.enabled !== true || se.shiftPlainEnter !== true || typeof runEnter !== "function") return false;
  plainEnter = true;
  try {
    return runEnter() === true;
  } finally {
    plainEnter = false;
  }
}

module.exports = {
  nextMarkerFor,
  planSmartEnter,
  handleSmartEnterKeymap,
  handlePlainEnterKeymap,
};
