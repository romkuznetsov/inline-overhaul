"use strict";

/**
 * «Что изменилось» — словами человека, а не путями конфига.
 *
 * **Его слово 2026-09-19:** «в заметке autosave текст в `# What changed` очень
 * технический и не понятен для пользователя (`pkm.fields.order.left: list of 4
 * → list of 5`). Должно быть понятно — указывай название настроек и что
 * конкретно произошло. В этом примере я переместил field `Cat` из right block в
 * left block».
 *
 * **Откуда берутся слова.** Имя строки панели — из схемы, а схема выводится из
 * прототипа (Р8): второго списка имён здесь нет и быть не может, иначе он
 * разойдётся с панелью на первом же переименовании (У-32). Путь остаётся
 * запасным ответом — и тогда он назван тем, что он есть, а не выдан за имя.
 *
 * **Fields разбираются отдельно, потому что человек их не «настраивает», а
 * переставляет.** `pkm.fields.order.left` — это список, и «список из 4 стал
 * списком из 5» не говорит ничего: сказать надо, какое поле и куда переехало.
 * Имя поля берётся из его подписи (`labels`), той же, что человек видит в
 * панели.
 *
 * Тексты английские: заметка копии английская целиком, её читает и разбирает
 * сам плагин (10.13.46, `texts_coverage`).
 */

const __sharedUtils = require("../core/shared_utils.js");
const __schema = require("../ui/settings/schema/index.ts");

function isObj(x) { return __sharedUtils.isObj(x); }

/** Сколько строк уходит в заметку; остаток называется числом. */
const MAX_LINES = 20;

/** Ветка Fields: её правки описываются перестановками, а не значениями. */
const ORDER_PATH = "pkm.fields.order";

let __rowsByPath = null;

/**
 * Строки панели по пути настройки: имя, заголовок группы и вкладка.
 *
 * Считается один раз: схема на прогоне не меняется, а обход её тридцати восьми
 * групп на каждую строку отчёта был бы работой в цикле.
 */
function rowsByPath() {
  if (__rowsByPath) return __rowsByPath;
  const map = new Map();
  const tabs = new Map();
  for (const tab of __schema.TABS || []) tabs.set(String(tab.id), String(tab.label || tab.id));
  for (const group of __schema.SCHEMA || []) {
    for (const item of group.items || []) {
      if (!item || !item.path) continue;
      map.set(String(item.path), {
        name: String(item.name || item.id || ""),
        group: String(group.heading || ""),
        tab: tabs.get(String(group.tab)) || String(group.tab || ""),
      });
    }
  }
  __rowsByPath = map;
  return map;
}

/** Значение словами: тумблер — `on`/`off`, пустое — «empty», список — числом. */
function sayValue(v) {
  if (v === undefined) return "not set";
  if (v === null) return "empty";
  if (v === true) return "on";
  if (v === false) return "off";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim() ? v : "empty";
  if (Array.isArray(v)) return v.length + " item" + (v.length === 1 ? "" : "s");
  if (isObj(v)) return "changed";
  return String(v);
}

/** Подпись Field, как её видит человек в панели; нет подписи — сам ключ. */
function fieldLabel(order, id) {
  const labels = isObj(order) && isObj(order.labels) ? order.labels : {};
  const label = String(labels[id] || "").trim();
  return label || String(id);
}

function listOf(order, side) {
  const raw = isObj(order) ? order[side] : null;
  return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
}

/**
 * Что человек сделал с Fields: переставил между Block, добавил, убрал или
 * поменял порядок внутри Block.
 *
 * Читается пара «было» и «стало»: другого способа отличить перестановку от
 * добавления нет, а число полей само по себе не говорит ничего.
 */
function fieldsMoves(before, after) {
  const out = [];
  const sides = ["left", "right"];
  const wasSide = new Map();
  const nowSide = new Map();
  for (const side of sides) {
    for (const id of listOf(before, side)) wasSide.set(id, side);
    for (const id of listOf(after, side)) nowSide.set(id, side);
  }
  const block = (side) => (side === "left" ? "the Left Block" : "the Right Block");
  for (const [id, side] of nowSide) {
    const had = wasSide.get(id);
    if (!had) {
      out.push("Field «" + fieldLabel(after, id) + "» added to " + block(side));
    } else if (had !== side) {
      out.push("Field «" + fieldLabel(after, id) + "» moved from " + block(had)
        + " to " + block(side));
    }
  }
  for (const [id, side] of wasSide) {
    if (!nowSide.has(id)) {
      out.push("Field «" + fieldLabel(before, id) + "» removed from " + block(side));
    }
  }
  /* Порядок внутри Block — отдельная правка, и она видна только сравнением
     списков: их состав при этом совпадает. */
  for (const side of sides) {
    const was = listOf(before, side).filter((id) => nowSide.get(id) === side);
    const now = listOf(after, side).filter((id) => wasSide.get(id) === side);
    if (was.length === now.length && was.length > 1 && was.join(" ") !== now.join(" ")) {
      out.push("Fields of " + block(side) + " reordered: "
        + now.map((id) => fieldLabel(after, id)).join(", "));
    }
  }
  return out;
}

/** Путь к строке панели: имя, группа и вкладка — то, что человек видит. */
function sayPath(path) {
  const row = rowsByPath().get(path);
  if (row) return "«" + row.name + "» (" + row.tab + " → " + row.group + ")";
  /* Строки в панели нет — говорим путь и **называем** его путём, а не выдаём
     за имя настройки: честнее, чем придуманное слово (У-80). */
  return "setting `" + path + "`";
}

/**
 * Листья, у которых значение стало другим.
 *
 * Обход общий на обе стороны: ключ, которого не стало, — такая же правка, как
 * ключ, которого не было.
 */
function changedLeaves(before, after) {
  const out = [];
  const seen = Object.create(null);
  const walk = (a, b, path) => {
    if (path === ORDER_PATH) return;
    /*
     * Ветка, которой на одной стороне не было, разбирается **по листьям**, а
     * не называется одним словом: «advanced: not set → changed» не говорит
     * человеку ничего, а «Autosave: off → on» говорит. Отсутствующая сторона
     * читается пустой ветвью — так же, как её читает сам конфиг.
     */
    const aObj = isObj(a) || (a === undefined && isObj(b));
    const bObj = isObj(b) || (b === undefined && isObj(a));
    const leaf = !aObj || !bObj;
    if (leaf) {
      if (JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b)) return;
      if (seen[path]) return;
      seen[path] = true;
      out.push({ path, from: a, to: b });
      return;
    }
    const done = Object.create(null);
    const left = isObj(a) ? a : {};
    const right = isObj(b) ? b : {};
    for (const key of Object.keys(left).concat(Object.keys(right))) {
      if (done[key]) continue;
      done[key] = true;
      walk(left[key], right[key], path ? path + "." + key : key);
    }
  };
  walk(isObj(before) ? before : {}, isObj(after) ? after : {}, "");
  return out;
}

/**
 * Строки «что изменилось» для заметки копии.
 *
 * Порядок: сперва перестановки Fields (человек помнит именно их), потом
 * настройки по именам строк панели, потом — остаток числом.
 */
function describeConfigChange(before, after, limit) {
  const max = Math.max(1, Math.trunc(Number(limit) || 0) || MAX_LINES);
  const beforeOrder = isObj(before) && isObj(before.pkm) && isObj(before.pkm.fields)
    ? before.pkm.fields.order : null;
  const afterOrder = isObj(after) && isObj(after.pkm) && isObj(after.pkm.fields)
    ? after.pkm.fields.order : null;
  const lines = fieldsMoves(beforeOrder, afterOrder);
  for (const leaf of changedLeaves(before, after)) {
    lines.push(sayPath(leaf.path) + ": " + sayValue(leaf.from) + " → " + sayValue(leaf.to));
  }
  if (lines.length <= max) return lines;
  const rest = lines.length - max;
  return lines.slice(0, max).concat(["and " + rest + " more change" + (rest === 1 ? "" : "s")]);
}

module.exports = {
  MAX_LINES,
  ORDER_PATH,
  rowsByPath,
  sayValue,
  sayPath,
  fieldsMoves,
  changedLeaves,
  describeConfigChange,
};
