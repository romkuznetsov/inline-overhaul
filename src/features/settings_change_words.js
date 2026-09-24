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
 * Имена контролов, у которых нет строки в схеме: они живут в своих блоках, и
 * дом у них там же (10.13.47). Здесь только **соответствие** ключа конфига
 * имени контрола — самих слов тут нет ни одного, иначе они разойдутся с
 * панелью на первом же переименовании (У-32).
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
 * Ветки, у которых есть свой разбор, и обход листьев в них не заходит.
 *
 * Объявление одно: обход спрашивает его же, чем и держится согласие — ветка,
 * разобранная отдельно, не может попасть в отчёт дважды, а забытая здесь
 * ветка попала бы туда путём (У-32).
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

/**
 * Значение, равное умолчанию, у **только что заведённого** Value не строка
 * отчёта, а шум: панель пишет строку целиком, со всеми её полями, и человек
 * получал четыре «not set → empty» на каждое добавленное значение. О том, что
 * значение появилось, сказано строкой выше.
 */
function isDefaultValue(v) {
  return v === undefined || v === null || v === "" || v === "default";
}

/**
 * Правка, у которой обе стороны — умолчание, правкой не является.
 *
 * Панель пишет строку Value целиком, со всеми её полями сразу: заведя один
 * цвет, человек получал четыре строки, из которых три говорили
 * «not set → empty» и «not set → default». Это запись в файл, а не решение
 * человека, и в отчёте ей места нет.
 */
function isNoChange(from, to) {
  return isDefaultValue(from) && isDefaultValue(to);
}

/**
 * Ключи, которые плагин выводит сам, а человек их не трогает.
 *
 * `subtags` у значения родителя и `allowedParentValues` у значения ребёнка —
 * две записи одной связи, и ставит их панель, когда человек заводит дочернее
 * значение. О самом значении уже сказано строкой «added»; сказать вдобавок
 * «список из 0 стал списком из 1» значит вернуть ровно то, на что он жаловался.
 */
const DERIVED_KEYS = { subtags: true, allowedParentValues: true };

/**
 * Слова вариантов у тех настроек, где `on`/`off` — не то, что видит человек.
 *
 * Сами слова берутся у блока (10.13.47): здесь только **соответствие**
 * значения конфига ключу текста.
 */
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
  const key = String(id);
  const label = String(labels[key] || "").trim();
  if (label) return label;
  /*
   * **У дочернего Field своей подписи нет, и он зовётся именем родителя.**
   * Так его называет и команда — `Cat_sub next`, — то есть ровно тем словом,
   * которое человек видит на экране `Hotkeys`. Ключ остаётся последним
   * ответом, и тогда он назван ключом (У-80).
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
  /* Порядок внутри Block — отдельная правка, и она видна только сравнением
     списков: их состав при этом совпадает. */
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
 * Определения Fields по их `id` — из всех трёх групп разом.
 *
 * Группа (`tags`, `links`, `elements`) человеку не видна: в панели это один
 * список Fields, и разделяет их тип, а не ветка конфига. Поэтому и сверяются
 * они одним множеством.
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
 * Что человек сделал с определениями Fields и их Values.
 *
 * **Зачем отдельно от обхода листьев.** Ветка `pkm.fields.<группа>.fields` —
 * список, и обход листьев говорил о ней `10 items → 10 items`: правда, и
 * ничего не значит (его замечание 2026-09-19 к строке `S8`). Сказать надо, у
 * какого Field что изменилось, а имена контролов взять там, где их видит
 * человек.
 *
 * Отдаются **части**, а не готовые строки: собирает их отрисовка, ей же решать,
 * во что вкладывать.
 */
function fieldDefChanges(before, after) {
  const out = [];
  const was = fieldDefs(before);
  const now = fieldDefs(after);
  const orderNow = isObj(after) && isObj(after.pkm) && isObj(after.pkm.fields)
    ? after.pkm.fields.order : null;
  const orderWas = isObj(before) && isObj(before.pkm) && isObj(before.pkm.fields)
    ? before.pkm.fields.order : null;
  for (const [id, field] of now) {
    /* Заведённое поле уже названо перестановкой («added to the Left Block»), и
       перечислять заодно все его значения было бы шумом: в нём новое всё. */
    if (!was.has(id)) continue;
    const old = was.get(id);
    const label = fieldLabel(orderNow, id);
    /* Свойства самого Field: имя строки панели, а не ключ конфига. */
    const keys = Object.keys(old).concat(Object.keys(field));
    const done = Object.create(null);
    for (const key of keys) {
      if (done[key] || key === "id" || key === "values" || DERIVED_KEYS[key]) continue;
      done[key] = true;
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
      const vkeys = Object.keys(oldValue).concat(Object.keys(value));
      const vdone = Object.create(null);
      for (const key of vkeys) {
        if (vdone[key] || key === "token" || DERIVED_KEYS[key]) continue;
        vdone[key] = true;
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
  /* Снятое поле называет та же перестановка — «removed from the Left Block». */
  void orderWas;
  return out;
}

/**
 * Вид одного Value: цвет заливки, цвет надписи, показ и своя надпись.
 *
 * Эти контролы стоят **внутри** строки Value, а строка Value — внутри Field
 * (его слово: «группируй элементы, если настройки находятся в дочерних
 * контролах»). Поэтому путь `visual.tags.byTag.<Field>.<Value>.<что>` не
 * превращается в строку, а разбирается на три части — Field, Value и имя
 * контрола.
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
  const fieldIds = Object.keys(was).concat(Object.keys(now));
  const doneField = Object.create(null);
  for (const fieldId of fieldIds) {
    if (doneField[fieldId]) continue;
    doneField[fieldId] = true;
    const a = isObj(was[fieldId]) ? was[fieldId] : {};
    const b = isObj(now[fieldId]) ? now[fieldId] : {};
    const tokens = Object.keys(a).concat(Object.keys(b));
    const doneToken = Object.create(null);
    for (const token of tokens) {
      if (doneToken[token]) continue;
      doneToken[token] = true;
      const rowWas = isObj(a[token]) ? a[token] : {};
      const rowNow = isObj(b[token]) ? b[token] : {};
      const keys = Object.keys(rowWas).concat(Object.keys(rowNow));
      const doneKey = Object.create(null);
      for (const key of keys) {
        if (doneKey[key]) continue;
        doneKey[key] = true;
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
    /* Ветки, у которых есть свой разбор: их правки описываются составом, а не
       значением листа. Список один и здесь же объявлен — `describedApart`. */
    if (describedApart(path)) return;
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
      /* У только что заведённого Value поля с умолчанием — шум, а не правка:
         панель пишет строку целиком, и человек получал по четыре
         «not set → empty» на каждое добавленное значение (его слово к `S8`). */
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
  /*
   * Три источника, и порядок у них не случайный: сперва то, что человек делал
   * руками с Fields (он помнит именно это), потом строки панели по именам,
   * потом остаток числом.
   */
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
