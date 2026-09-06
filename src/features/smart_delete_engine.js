"use strict";

/**
 * Smart Delete (PRD 10.13.32).
 *
 * `Del` в конце строки в Obsidian приклеивает следующую строку такой, какая
 * она есть: с отступом, маркером списка и чекбоксом. Человеку нужны были
 * слова, и он дожимает `Del` ещё шесть раз, вычищая мусор. Здесь первое
 * нажатие делает это само.
 *
 * **Разбор строки один на весь плагин.** Формы Prefix взяты у
 * `enhanced_select_all_engine.js` и стоят здесь одним объявлением: два списка
 * одних и тех же правил расходятся молча (У-32).
 *
 * **Решение считается отдельно от записи.** `planSmartDelete` — чистая
 * функция: на входе текст двух строк и настройки, на выходе диапазон и то, что
 * встанет на его место. Так проверке не нужен ни Obsidian, ни редактор, а
 * условия тихого отказа видны списком (У-41): их четыре, и каждое возвращает
 * `null`, то есть отдаёт клавишу платформе.
 */

/** Отступ: ведущие пробелы и табуляции. */
const INDENT = /^[ \t]*/;

/**
 * Prefix строки, по одному шагу за раз.
 *
 * Цитата снимается столько раз, сколько её поставили (`> > текст`), маркер
 * списка и чекбокс — как одно целое, номер и решётки заголовка — по одному
 * разу: `1. 2.` в начале строки бывает текстом, а не двумя номерами.
 */
const QUOTE = /^>[ \t]?/;
const BULLET = /^[-*+][ \t]+(?:\[[ xX]\][ \t]+)?/;
const ORDERED = /^\d+[.)][ \t]+/;
const HEADING = /^#{1,6}[ \t]+/;

/**
 * Сколько символов в начале строки занимает мусор: отступ и, если просили,
 * Prefix. Возвращается смещение, а не остаток строки: вызывающему нужен
 * диапазон для замены, а не копия текста.
 */
function junkLengthOf(text, dropPrefix) {
  const src = String(text || "");
  let at = src.match(INDENT)[0].length;

  if (dropPrefix) {
    for (;;) {
      const rest = src.slice(at);
      const quote = rest.match(QUOTE);
      if (quote) {
        at += quote[0].length;
        at += src.slice(at).match(INDENT)[0].length;
        continue;
      }
      break;
    }
    const rest = src.slice(at);
    const mark = rest.match(BULLET) || rest.match(ORDERED) || rest.match(HEADING);
    if (mark) at += mark[0].length;
  }

  /* Что бы ни сняли, пробелы за снятым тоже мусор. */
  at += src.slice(at).match(INDENT)[0].length;
  return at;
}

/**
 * Решение о нажатии `Del`.
 *
 * `null` означает «это не наш случай»: клавиша уходит платформе такой, какой
 * была. Четыре условия отказа:
 *
 *   1. функция выключена;
 *   2. справа от курсора в строке есть что-то, кроме пробелов;
 *   3. ниже нет строки;
 *   4. курсор не один или что-то выделено (это решается выше, в обработчике:
 *      сюда такой случай не доходит).
 */
function planSmartDelete(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;

  const text = String(o.lineText || "");
  const ch = Math.max(0, Math.min(Number(o.ch) || 0, text.length));
  if (String(text.slice(ch)).trim() !== "") return null;
  if (typeof o.nextLineText !== "string") return null;

  const next = o.nextLineText;
  const junk = junkLengthOf(next, o.dropPrefix !== false);
  const arriving = next.slice(junk);

  /*
   * От следующей строки после снятия ничего не осталось: пустая строка, голый
   * буллит, одинокая решётка. Она уходит целиком, курсор остаётся на месте, и
   * следующее нажатие берётся за строку под ней.
   */
  if (arriving.trim() === "") {
    return { fromCh: ch, toCh: next.length, insert: "", cursorCh: ch, emptied: true };
  }

  const left = text.slice(0, ch);
  const needsSpace = o.joinWithSpace !== false
    && left.trim() !== ""
    && !/[ \t]$/.test(left);

  return {
    fromCh: ch,
    toCh: junk,
    insert: needsSpace ? " " : "",
    cursorCh: ch,
    emptied: false,
  };
}

/**
 * То же самое с другой стороны: `Backspace` в начале строки (10.13.32 Д9).
 *
 * Заказчик выбрал **отдельный тумблер**, отказавшись от общего на обе клавиши,
 * поэтому у `Backspace` своё условие включения и своё умолчание.
 *
 * Разница с `Del` одна и она в том, чей мусор снимается: наверх едет **эта**
 * строка, и отступ с Prefix снимаются у неё же. Предыдущая строка своё
 * оформление сохраняет: это её оформление, а не мусор.
 */
function planSmartBackspace(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;
  if (typeof o.prevLineText !== "string") return null;

  const text = String(o.lineText || "");
  const ch = Math.max(0, Math.min(Number(o.ch) || 0, text.length));
  const junk = junkLengthOf(text, o.dropPrefix !== false);

  /* Слева от курсора есть настоящий текст — клавиша не наша. */
  if (ch > junk) return null;

  const prev = o.prevLineText;
  const arriving = text.slice(junk);

  /*
   * От этой строки ничего не осталось: она уходит целиком, курсор встаёт в
   * конец предыдущей. Хвост предыдущей при этом не трогается — она не
   * двигается, и подстригать её не за что.
   */
  if (arriving.trim() === "") {
    return { fromCh: prev.length, toCh: text.length, insert: "", cursorCh: prev.length, emptied: true };
  }

  const kept = prev.replace(/[ \t]+$/, "");
  const needsSpace = o.joinWithSpace !== false && kept.trim() !== "";
  const insert = needsSpace ? " " : "";

  return {
    fromCh: kept.length,
    toCh: junk,
    insert,
    /* Курсор встаёт вплотную к приехавшему тексту, а не перед пробелом. */
    cursorCh: kept.length + insert.length,
    emptied: false,
  };
}

/**
 * Обработчик клавиши. Всё, что связано с редактором, живёт здесь; решение —
 * в чистой функции выше.
 */
function handleSmartKeymap(plugin, back) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const sd = cfg && cfg.editor && cfg.editor.smartDelete ? cfg.editor.smartDelete : null;
  if (!sd) return false;
  /*
   * У каждой клавиши свой тумблер, и они не подчинены друг другу (Д11).
   * Сперва `Backspace` был подчинён `Smart Delete`; заказчик 2026-09-05
   * попросил включать их независимо, поэтому здесь спрашивается ровно один
   * ключ — тот, что отвечает за нажатую клавишу.
   */
  if (back ? sd.onBackspace !== true : sd.enabled !== true) return false;

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
    if (back ? line <= 0 : line >= editor.lastLine()) return false;

    const common = {
      enabled: true,
      lineText: String(editor.getLine(line) || ""),
      ch: Number(cursor.ch) || 0,
      dropPrefix: sd.dropPrefix !== false,
      joinWithSpace: sd.joinWithSpace !== false,
    };
    const plan = back
      ? planSmartBackspace({ ...common, prevLineText: String(editor.getLine(line - 1) || "") })
      : planSmartDelete({ ...common, nextLineText: String(editor.getLine(line + 1) || "") });
    if (!plan) return false;

    /* Диапазон всегда идёт от верхней строки к нижней, чем бы его ни считали. */
    const top = back ? line - 1 : line;
    editor.replaceRange(
      plan.insert,
      { line: top, ch: plan.fromCh },
      { line: top + 1, ch: plan.toCh }
    );
    editor.setCursor({ line: top, ch: plan.cursorCh });
    return true;
  } catch (e) {
    console.error("[inline-overhaul][smart-delete]", e);
    return false;
  }
}

function handleSmartDeleteKeymap(plugin) {
  return handleSmartKeymap(plugin, false);
}

function handleSmartBackspaceKeymap(plugin) {
  return handleSmartKeymap(plugin, true);
}

module.exports = {
  junkLengthOf,
  planSmartDelete,
  planSmartBackspace,
  handleSmartDeleteKeymap,
  handleSmartBackspaceKeymap,
};
