"use strict";

/**
 * Smart Delete (PRD 10.13.32).
 *
 * `Del` в конце строки в Obsidian приклеивает следующую строку такой, какая
 * она есть: с отступом, маркером списка и чекбоксом. Человеку нужны были
 * слова, и он дожимает `Del` ещё шесть раз, вычищая мусор. Здесь первое
 * нажатие делает это само.
 *
 * **Разбор строки один на весь плагин.** Формы Prefix живут в
 * `src/core/shared_utils.js` — там же, где их спрашивает движок `Ctrl+A`.
 * Здесь они стояли своей копией до 2026-09-08, и две копии успели разойтись
 * трижды (У-32); разбор — в объяснении самого правила.
 *
 * **Решение считается отдельно от записи.** `planSmartDelete` — чистая
 * функция: на входе текст двух строк и настройки, на выходе диапазон и то, что
 * встанет на его место. Так проверке не нужен ни Obsidian, ни редактор, а
 * условия тихого отказа видны списком (У-41): их пять, и каждое возвращает
 * `null`, то есть отдаёт клавишу платформе.
 */

const __sharedUtils = require("../core/shared_utils.js");
const __linePipeline = require("../core/line_pipeline.js");
const __rulesHelpers = require("../core/pkm_rules_runtime_helpers.js");
const __rulesShape = require("../core/pkm_rules_shape.js");

/**
 * Сегменты строки для склейки. Строку без Prefix и без разделителей разбор
 * движков объявляет Block целиком: правило «значения подряд в начале — Block,
 * с первого слова текста — текст» (`demoteLeftBodyToText`, `В-211`, `В-249`)
 * он применяет только к строке с Prefix. Для `Del` это значило, что `💭 123`
 * под `#high :: 123` уезжало в левый Block вместе со словом (его пункт
 * «Новое» 2026-09-29). Такая строка разбирается с условным `- `, и он же
 * снимается с левого сегмента.
 */
function segmentsOf(line, rules) {
  const start = __sharedUtils.lineStartOf(String(line || ""));
  /* `prefix` у `lineStartOf` включает отступ: спрашивается сам знак. */
  if (start.marker || start.checkbox || start.heading || !String(start.body || "").trim()) return __linePipeline.splitSegments(line, rules);
  const seg = __linePipeline.splitSegments("- " + start.body, rules);
  return { ...seg, indent: start.indent + start.quote + start.callout, left: String(__sharedUtils.lineStartOf(String(seg.left || "")).body || "") };
}

/**
 * **Склейка двух строк с полями сливает поля в блоки** (`В-242`, его ответ
 * 2026-09-26 «слить поля в блоки»; BUGHUNT K2). Прежде `Del` в конце
 * `- #todo || a` над `- #low || b` давал `- #todo || a #low || b` — две
 * строки с полями в одной, и следующая команда поля портила её дальше.
 * Теперь склеивается текст, а значения второй строки встают в блоки первой;
 * одинаковое поле — побеждает первая строка.
 *
 * Разбор и сборка — те же, что у движков (`splitSegments`,
 * `buildFromSegments`); чьё значение — отвечает карта токенов правил
 * (`buildTagTokenKeyMap`) и метки элементов. `null` — у второй строки полей
 * нет, склейка обычная.
 */
function mergeLinesWithFields(upper, lower, rules) {
  if (!rules || !rules.io) return null;
  const a = segmentsOf(upper, rules);
  const b = segmentsOf(lower, rules);
  const bLeft = String(__sharedUtils.lineStartOf(String(b.left || "")).body || "").trim();
  const bDates = String(b.dates || "").trim();
  if (!bLeft && !bDates) return null;
  const keyMap = __rulesHelpers.buildTagTokenKeyMap(rules, __rulesHelpers.getDefaultTagTokenKeyMapOptions()) || {};
  const markers = [].concat(rules.leftMode && rules.leftMode.fields || [], rules.rightMode && rules.rightMode.fields || [])
    .filter((f) => f && f.marker).map((f) => ({ marker: String(f.marker), id: String(f.id || "") }));
  const fieldOf = (t) => {
    const hit = markers.find((m) => t.startsWith(m.marker));
    if (hit) return hit.id;
    return keyMap[t] || null;
  };
  const merge = (mine, theirs) => {
    const own = __sharedUtils.lineWords(mine);
    const taken = new Set(own.map(fieldOf).filter(Boolean));
    const add = __sharedUtils.lineWords(theirs).filter((t) => { const f = fieldOf(t); return !f || !taken.has(f); });
    return own.concat(add).join(" ");
  };
  const aStart = __sharedUtils.lineStartOf(String(a.left || ""));
  const left = __linePipeline.joinLeftPrefix(String(aStart.prefix || "").trimEnd(), merge(String(aStart.body || ""), bLeft));
  const text = [String(a.text || "").trim(), String(b.text || "").trim()].filter(Boolean).join(" ");
  const dates = merge(String(a.dates || ""), bDates);
  const line = __linePipeline.buildFromSegments({ indent: a.indent, left: left.trim(), text, dates }, rules);
  return { line, textEnd: String(a.text || "").trim() };
}

/**
 * Сколько символов в начале строки занимает мусор: отступ и, если просили,
 * Prefix. Возвращается смещение, а не остаток строки: вызывающему нужен
 * диапазон для замены, а не копия текста.
 */
function junkLengthOf(text, dropPrefix) {
  return __sharedUtils.linePrefixLength(text, dropPrefix);
}

/**
 * Решение о нажатии `Del`.
 *
 * `null` означает «это не наш случай»: клавиша уходит платформе такой, какой
 * была. Пять условий отказа:
 *
 *   1. функция выключена;
 *   2. справа от курсора в строке есть что-то, кроме пробелов;
 *   3. ниже нет строки;
 *   4. курсор не один или что-то выделено (это решается выше, в обработчике:
 *      сюда такой случай не доходит);
 *   5. **строка, на которой стоит курсор, пуста** — снимать Prefix у
 *      приезжающей строки не за чем.
 */
function planSmartDelete(opts) {
  const o = opts && typeof opts === "object" ? opts : {};
  if (!o.enabled) return null;

  const text = String(o.lineText || "");
  const ch = Math.max(0, Math.min(Number(o.ch) || 0, text.length));
  if (String(text.slice(ch)).trim() !== "") return null;
  if (typeof o.nextLineText !== "string") return null;
  /*
   * Пустая строка: клавиша уходит платформе целиком, и следующая строка
   * приезжает такой, какая написана, — со своим отступом и своим номером.
   *
   * Замечание заказчика 2026-09-08: три строки, `1. text`, пустая, `2. text`;
   * `Del` на пустой давал `text`, а он ждал `2. text`. Функция снимала Prefix
   * у приезжающей строки **всегда**, и это верно ровно тогда, когда своя
   * строка что-то содержит: тогда её слова и слова снизу становятся одной
   * строкой. На пустой строке склеивать нечего, и снимать номер незачем.
   *
   * Решение о судьбе отступа его же, 2026-09-08: «строка целиком, как
   * написана» — вложенность сохраняется.
   */
  if (text.slice(0, ch).trim() === "") return null;

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
    /*
     * **Несколько кареток — каждая своим шагом** (BUGHUNT K15). Прежде клавиша
     * при второй каретке молча уходила платформе, и строки склеивались родным
     * `Del` (`- a- b`). Теперь план считается у каждой каретки на одной строке,
     * правки идут снизу вверх — нижняя не сдвигает верхних, — а каретки
     * встают туда, куда их поставил план, с поправкой на склеенные выше строки.
     * Хоть у одной каретки план не сложился — клавиша вся уходит платформе:
     * половина кареток по-нашему, половина по-родному была бы хуже обоих.
     */
    const sels = typeof editor.listSelections === "function" && Array.isArray(editor.listSelections())
      ? editor.listSelections() : [{ head: editor.getCursor() }];
    const heads = sels.map((x) => (x && (x.head || x.anchor)) || editor.getCursor())
      .map((h) => ({ line: Number(h.line), ch: Number(h.ch) || 0 }));
    if (!heads.length || heads.some((h) => !Number.isFinite(h.line))) return false;
    if (new Set(heads.map((h) => h.line)).size !== heads.length) return false;

    /* Правила движков — ради склейки строк с полями (`В-242`). */
    let rules = null;
    try { rules = __rulesShape.buildRulesForEngines(cfg); } catch (_) { rules = null; /* проба: полуготовый конфиг — склейка обычная */ }
    const plans = [];
    const getLine = (n) => editor.getLine(n);
    for (const h of heads) {
      const line = h.line;
      if (back ? line <= 0 : line >= editor.lastLine()) return false;
      /* Код, ограда, таблица, frontmatter, линия — не строки текста: клавиша
         родная, иначе строка прилипает к `---` или ` ``` ` (BUGHUNT 2026-09-30, B11, B12). */
      const upperNo = back ? line - 1 : line;
      if (__sharedUtils.isCodeOrTableLine(getLine, upperNo) || __sharedUtils.isCodeOrTableLine(getLine, upperNo + 1)) return false;
      const common = {
        enabled: true,
        lineText: String(editor.getLine(line) || ""),
        ch: h.ch,
        dropPrefix: sd.dropPrefix !== false,
        joinWithSpace: sd.joinWithSpace !== false,
      };
      const plan = back
        ? planSmartBackspace({ ...common, prevLineText: String(editor.getLine(line - 1) || "") })
        : planSmartDelete({ ...common, nextLineText: String(editor.getLine(line + 1) || "") });
      if (!plan) return false;
      /* Диапазон всегда идёт от верхней строки к нижней, чем бы его ни считали. */
      const top = back ? line - 1 : line;
      if (!plan.emptied && rules) {
        const upper = String(editor.getLine(top) || "");
        const lower = String(editor.getLine(top + 1) || "");
        const merged = mergeLinesWithFields(upper, lower, rules);
        if (merged) {
          const slot = merged.line.indexOf(merged.textEnd);
          const caret = merged.textEnd && slot >= 0 ? slot + merged.textEnd.length : merged.line.length;
          plans.push({ top, plan: { fromCh: 0, toCh: lower.length, insert: merged.line, cursorCh: caret, whole: upper.length } });
          continue;
        }
      }
      plans.push({ top, plan });
    }
    plans.sort((x, y) => y.top - x.top);
    const carets = plans.slice().reverse().map(({ top, plan }, i) => ({ line: top - i, ch: plan.cursorCh }));
    if (plans.length === 1) {
      const { top, plan } = plans[0];
      editor.replaceRange(plan.insert, { line: top, ch: plan.fromCh }, { line: top + 1, ch: plan.toCh });
      editor.setCursor(carets[0]);
      return true;
    }
    /*
     * Несколько кареток — **одной транзакцией**: одно нажатие, одна ступень
     * отмены (BUGHUNT 2026-09-30, B13). `replaceRange` на каждую каретку давал
     * столько ступеней, сколько кареток. Изменения транзакции платформа
     * считает в координатах исходного документа, выделения — в новом
     * (`transaction` в `app.js` 1.13.7).
     */
    editor.transaction({
      changes: plans.slice().reverse().map(({ top, plan }) => ({
        from: { line: top, ch: plan.fromCh }, to: { line: top + 1, ch: plan.toCh }, text: plan.insert,
      })),
      selections: carets.map((c) => ({ from: c })),
    });
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
  mergeLinesWithFields,
  junkLengthOf,
  planSmartDelete,
  planSmartBackspace,
  handleSmartDeleteKeymap,
  handleSmartBackspaceKeymap,
};
