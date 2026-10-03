"use strict";

/**
 * «Что изменилось» в заметке автокопии — словами человека, а не путями
 * конфига (2026-09-19).
 *
 * Имя строки панели — из схемы, выводимой из прототипа (Р8): второго списка
 * имён быть не должно (У-32). Путь — запасной ответ и назван путём. Fields
 * описываются перестановками (какое поле куда переехало), имя — из `labels`.
 * Тексты английские: заметку копии разбирает сам плагин (10.13.46, `texts_coverage`).
 */

const __sharedUtils = require("../core/shared_utils.js");
const __schema = require("../ui/settings/schema/index.ts");
const __blockTexts = require("../ui/settings/texts_blocks.ts");

function isObj(x) { return __sharedUtils.isObj(x); }

/** Сколько строк уходит в заметку; остаток называется числом. */
const MAX_LINES = 20;

/** Ветка Fields: её правки описываются перестановками, а не значениями. */
const ORDER_PATH = "pkm.fields.order";

/** Ветка определений Fields: её правки описываются составом, а не числом. */
const FIELDS_ROOT = "pkm.fields";
const FIELD_GROUPS = ["tags", "links", "elements"];

/** Ветка вида одного Value: её правки принадлежат Value, а Value — Field. */
const VISUAL_BYTAG = "visual.tags.byTag";

/**
 * Имена контролов без строки в схеме — живут в своих блоках (10.13.47); здесь
 * только соответствие ключа конфига имени контрола, слов нет (У-32).
 */
const FIELD_EDITOR = (__blockTexts.BLOCK_TEXTS || {})["field-editor"] || {};
const VALUE_VISUAL_NAMES = {
  fillColor: "VALUE_FILL_COLOR",
  textColor: "VALUE_TEXT_COLOR",
  borderColor: "VALUE_SIDE_COLOR",
  visibility: "VALUE_SHOWN_NAME",
  customText: "VALUE_CUSTOM_NAME",
};
const FIELD_PROP_NAMES = {
  placeholder: "SHORT_NAME_NAME",
  enabled: "ACTIVE_NAME",
  dependsOn: "PREREQ_PICK_NAME",
  disabledForParentValues: "PREREQ_VALUE_NAME",
  enabledForParentValues: "PREREQ_VALUE_NAME",
  freeOfParent: "CHILD_NAME",
  addsParentValue: "CHILD_PARENT_NAME",
  showOnAlt: "CHILD_NAME",
  parentIsNavigator: "CHILD_NAV_NAME",
  yamlKey: "YAML_NAME",
  yamlCardinality: "YAML_KIND_NAME",
  yamlValueRule: "YAML_FORM_NAME",
  format: "ELEMENT_FORMAT_NAME",
  marker: "ELEMENT_EMOJI_NAME",
};

/**
 * Ветки со своим разбором — обход листьев в них не заходит. Объявление одно:
 * ветка не попадёт в отчёт дважды, забытая — попадёт путём (У-32).
 */
function describedApart(path) {
  if (path === ORDER_PATH || path === VISUAL_BYTAG) return true;
  for (const group of FIELD_GROUPS) {
    if (path === FIELDS_ROOT + "." + group + ".fields") return true;
  }
  return false;
}

/** Имя контрола по ключу конфига; нет имени — ключ, названный ключом. */
function controlName(map, key) {
  const textKey = map[key];
  const text = textKey ? String(FIELD_EDITOR[textKey] || "") : "";
  return text ? "«" + text + "»" : "`" + String(key) + "`";
}

/** Умолчание у только что заведённого Value — шум: панель пишет строку целиком. */
function isDefaultValue(v) {
  return v === undefined || v === null || v === "" || v === "default";
}

/** Обе стороны — умолчание: это запись панели целой строкой, а не правка человека. */
function isNoChange(from, to) {
  return isDefaultValue(from) && isDefaultValue(to);
}

/**
 * Ключи, которые выводит плагин: `subtags` у родителя и `allowedParentValues`
 * у ребёнка — две записи одной связи, ставит их панель. Значение уже названо «added».
 */
const DERIVED_KEYS = { subtags: true, allowedParentValues: true };

/** Слова вариантов, где `on`/`off` — не то, что видно; слова у блока (10.13.47), здесь соответствие. */
const FIELD_PROP_WORDS = {
  freeOfParent: { true: "CHILD_ALWAYS", false: "CHILD_AFTER_PARENT" },
  addsParentValue: { true: "CHILD_PARENT_ADD", false: "CHILD_PARENT_KEEP" },
  showOnAlt: { true: "CHILD_ALT", false: "CHILD_AFTER_PARENT" },
  parentIsNavigator: { true: "CHILD_NAV_ON", false: "CHILD_NAV_OFF" },
};

/** Значение словами панели, если у этой настройки они свои. */
function sayFieldValue(key, v) {
  const words = FIELD_PROP_WORDS[key];
  if (words) {
    const textKey = words[String(v === true)];
    const text = textKey ? String(FIELD_EDITOR[textKey] || "") : "";
    if (text) return text;
  }
  return sayValue(v);
}

let __rowsByPath = null;

/** Строки панели по пути: имя, группа, вкладка. Считается один раз — схема не меняется. */
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
  /* Ветки, которые пишет свой блок, а не строка схемы: имя — заголовок группы (BUGHUNT D15). */
  /* ponytail: список руками; вывести из блоков, когда таких веток станет больше одной-двух. */
  for (const [p, groupId] of [["editor.binder.rows", "binder"]]) {
    const group = (__schema.SCHEMA || []).find((g) => g && g.id === groupId);
    if (group && !map.has(p)) map.set(p, { name: String(group.heading || ""), group: String(group.heading || ""), tab: tabs.get(String(group.tab)) || String(group.tab || "") });
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
  const key = String(id);
  const label = String(labels[key] || "").trim();
  if (label) return label;
  /*
   * У дочернего Field своей подписи нет — зовётся именем родителя, как команда
   * `Cat_sub next` на экране `Hotkeys`. Ключ — последний ответ (У-80).
   */
  if (/_sub$/.test(key)) {
    const parent = String(labels[key.slice(0, -4)] || "").trim();
    if (parent) return parent + "_sub";
  }
  return key;
}

function listOf(order, side) {
  const raw = isObj(order) ? order[side] : null;
  return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
}

/**
 * Что сделано с Fields: перестановка между Block, добавление, снятие, порядок
 * внутри Block. Отличить перестановку от добавления можно только парой «было/стало».
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
      out.push({ fieldId: id, label: fieldLabel(after, id), own: "added to " + block(side) });
    } else if (had !== side) {
      out.push({
        fieldId: id,
        label: fieldLabel(after, id),
        own: "moved from " + block(had) + " to " + block(side),
      });
    }
  }
  for (const [id, side] of wasSide) {
    if (!nowSide.has(id)) {
      out.push({ fieldId: id, label: fieldLabel(before, id), own: "removed from " + block(side) });
    }
  }
  /* Порядок внутри Block виден только сравнением списков: состав совпадает. */
  for (const side of sides) {
    const was = listOf(before, side).filter((id) => nowSide.get(id) === side);
    const now = listOf(after, side).filter((id) => wasSide.get(id) === side);
    if (was.length === now.length && was.length > 1 && was.join(" ") !== now.join(" ")) {
      /* Порядок принадлежит Block, а не одному Field: строка общая. */
      out.push({ plain: "Fields of " + block(side) + " reordered: "
        + now.map((id) => fieldLabel(after, id)).join(", ") });
    }
  }
  return out;
}

/**
 * Определения Fields по `id` из всех трёх групп (`tags`, `links`, `elements`)
 * одним множеством: в панели это один список.
 */
function fieldDefs(cfg) {
  const out = new Map();
  const fields = isObj(cfg) && isObj(cfg.pkm) && isObj(cfg.pkm.fields) ? cfg.pkm.fields : {};
  for (const group of FIELD_GROUPS) {
    const list = isObj(fields[group]) && Array.isArray(fields[group].fields)
      ? fields[group].fields : [];
    for (const f of list) {
      if (!isObj(f)) continue;
      const id = String(f.id || "").trim();
      if (id) out.set(id, f);
    }
  }
  return out;
}

/** Значения Field по токену: состав списка, а не его длина. */
function valuesByToken(field) {
  const out = new Map();
  const list = isObj(field) && Array.isArray(field.values) ? field.values : [];
  for (const v of list) {
    if (!isObj(v)) continue;
    const token = String(v.token || "").trim();
    if (token) out.set(token, v);
  }
  return out;
}

/**
 * Что сделано с определениями Fields и их Values. Отдельно от обхода листьев:
 * там список дал бы `10 items → 10 items` (S8). Отдаёт части, собирает отрисовка.
 */
/** Ключи обеих сторон без повторов, в порядке первого появления (У-21 ревизии 09-26). */
function keysOf(a, b) {
  return [...new Set(Object.keys(a).concat(Object.keys(b)))];
}

function fieldDefChanges(before, after) {
  const out = [];
  const was = fieldDefs(before);
  const now = fieldDefs(after);
  const orderNow = isObj(after) && isObj(after.pkm) && isObj(after.pkm.fields)
    ? after.pkm.fields.order : null;
  for (const [id, field] of now) {
    /* Заведённое поле названо перестановкой; перечислять его значения — шум. */
    if (!was.has(id)) continue;
    const old = was.get(id);
    const label = fieldLabel(orderNow, id);
    /* Свойства самого Field: имя строки панели, а не ключ конфига. */
    for (const key of keysOf(old, field)) {
      if (key === "id" || key === "values" || DERIVED_KEYS[key]) continue;
      if (JSON.stringify(old[key]) === JSON.stringify(field[key])) continue;
      if (isNoChange(old[key], field[key])) continue;
      out.push({
        fieldId: id,
        label,
        own: controlName(FIELD_PROP_NAMES, key) + ": "
          + sayFieldValue(key, old[key]) + " → " + sayFieldValue(key, field[key]),
      });
    }
    const valuesWas = valuesByToken(old);
    const valuesNow = valuesByToken(field);
    for (const [token, value] of valuesNow) {
      if (!valuesWas.has(token)) {
        out.push({ fieldId: id, label, token, state: "added" });
        continue;
      }
      const oldValue = valuesWas.get(token);
      for (const key of keysOf(oldValue, value)) {
        if (key === "token" || DERIVED_KEYS[key]) continue;
        if (JSON.stringify(oldValue[key]) === JSON.stringify(value[key])) continue;
        if (isNoChange(oldValue[key], value[key])) continue;
        out.push({
          fieldId: id,
          label,
          token,
          line: controlName(VALUE_VISUAL_NAMES, key) + ": "
            + sayValue(oldValue[key]) + " → " + sayValue(value[key]),
        });
      }
    }
    for (const token of valuesWas.keys()) {
      if (!valuesNow.has(token)) out.push({ fieldId: id, label, token, state: "removed" });
    }
  }
  /* Снятое поле называет перестановка — «removed from the Left Block». */
  return out;
}

/**
 * Вид одного Value: заливка, надпись, показ, своя надпись. Контролы внутри
 * строки Value внутри Field — путь `visual.tags.byTag.<Field>.<Value>.<что>`
 * разбирается на Field, Value и имя контрола.
 */
function valueVisualChanges(before, after) {
  const out = [];
  const pick = (cfg) => {
    const visual = isObj(cfg) && isObj(cfg.visual) ? cfg.visual : {};
    const tags = isObj(visual.tags) ? visual.tags : {};
    return isObj(tags.byTag) ? tags.byTag : {};
  };
  const was = pick(before);
  const now = pick(after);
  const orderNow = isObj(after) && isObj(after.pkm) && isObj(after.pkm.fields)
    ? after.pkm.fields.order : null;
  for (const fieldId of keysOf(was, now)) {
    const a = isObj(was[fieldId]) ? was[fieldId] : {};
    const b = isObj(now[fieldId]) ? now[fieldId] : {};
    for (const token of keysOf(a, b)) {
      const rowWas = isObj(a[token]) ? a[token] : {};
      const rowNow = isObj(b[token]) ? b[token] : {};
      for (const key of keysOf(rowWas, rowNow)) {
        if (JSON.stringify(rowWas[key]) === JSON.stringify(rowNow[key])) continue;
        if (isNoChange(rowWas[key], rowNow[key])) continue;
        out.push({
          fieldId,
          label: fieldLabel(orderNow, fieldId),
          token,
          from: rowWas[key],
          to: rowNow[key],
          line: controlName(VALUE_VISUAL_NAMES, key) + ": "
            + sayValue(rowWas[key]) + " → " + sayValue(rowNow[key]),
        });
      }
    }
  }
  return out;
}

/** Путь к строке панели: имя, группа и вкладка — то, что человек видит. */
function sayPath(path) {
  const row = rowsByPath().get(path);
  if (row) return "«" + row.name + "» (" + row.tab + (row.group === row.name ? "" : " → " + row.group) + ")";
  /* Строки в панели нет — путь, названный путём (У-80). */
  return "setting `" + path + "`";
}

/** Листья с другим значением; ключ, которого не стало, — такая же правка. */
function changedLeaves(before, after) {
  const out = [];
  const walk = (a, b, path) => {
    /* Ветки со своим разбором — `describedApart`. */
    if (describedApart(path)) return;
    /*
     * Ветка, которой на одной стороне нет, разбирается по листьям («Autosave:
     * off → on», а не «advanced: not set → changed»); пустая сторона — пустая ветвь.
     */
    const aObj = isObj(a) || (a === undefined && isObj(b));
    const bObj = isObj(b) || (b === undefined && isObj(a));
    const leaf = !aObj || !bObj;
    if (leaf) {
      if (JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b)) return;
      out.push({ path, from: a, to: b });
      return;
    }
    const left = isObj(a) ? a : {};
    const right = isObj(b) ? b : {};
    for (const key of keysOf(left, right)) {
      walk(left[key], right[key], path ? path + "." + key : key);
    }
  };
  walk(isObj(before) ? before : {}, isObj(after) ? after : {}, "");
  return out;
}

/**
 * Строки «что изменилось» для заметки копии: перестановки Fields, настройки по
 * именам строк панели, остаток числом.
 */
function renderFieldParts(parts) {
  const groups = new Map();
  const plain = [];
  for (const part of parts) {
    if (!isObj(part)) continue;
    if (part.plain) { plain.push(String(part.plain)); continue; }
    const id = String(part.fieldId || "");
    if (!id) continue;
    let group = groups.get(id);
    if (!group) {
      group = { label: String(part.label || id), own: [], values: new Map() };
      groups.set(id, group);
    }
    if (part.label) group.label = String(part.label);
    if (part.token) {
      const token = String(part.token);
      let value = group.values.get(token);
      if (!value) { value = { state: "", lines: [] }; group.values.set(token, value); }
      if (part.state) value.state = String(part.state);
      if (part.line) value.lines.push({ text: String(part.line), to: part.to });
      continue;
    }
    if (part.own) group.own.push(String(part.own));
  }

  const out = [];
  for (const group of groups.values()) {
    for (const value of group.values.values()) {
      /* У заведённого Value поля с умолчанием — шум: панель пишет строку целиком (S8). */
      if (value.state === "added") value.lines = value.lines.filter((l) => !isDefaultValue(l.to));
    }
    const lonely = group.own.length === 1 && group.values.size === 0;
    if (lonely) { out.push("Field «" + group.label + "» " + group.own[0]); continue; }
    if (!group.own.length && !group.values.size) continue;
    out.push("Field «" + group.label + "»");
    for (const line of group.own) out.push("\t" + line);
    for (const [token, value] of group.values) {
      if (!value.state && !value.lines.length) continue;
      out.push("\tValue «" + token + "»" + (value.state ? " " + value.state : ""));
      for (const line of value.lines) out.push("\t\t" + line.text);
    }
  }
  return out.concat(plain);
}

function describeConfigChange(before, after, limit) {
  const max = Math.max(1, Math.trunc(Number(limit) || 0) || MAX_LINES);
  const beforeOrder = isObj(before) && isObj(before.pkm) && isObj(before.pkm.fields)
    ? before.pkm.fields.order : null;
  const afterOrder = isObj(after) && isObj(after.pkm) && isObj(after.pkm.fields)
    ? after.pkm.fields.order : null;
  /* Порядок: Fields (их человек помнит), строки панели, остаток числом. */
  const lines = renderFieldParts([]
    .concat(fieldsMoves(beforeOrder, afterOrder))
    .concat(fieldDefChanges(before, after))
    .concat(valueVisualChanges(before, after)));
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
  sayFieldValue,
  isNoChange,
  sayPath,
  fieldsMoves,
  fieldDefChanges,
  valueVisualChanges,
  describedApart,
  renderFieldParts,
  changedLeaves,
  describeConfigChange,
};
