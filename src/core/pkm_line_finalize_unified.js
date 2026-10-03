"use strict";

/*
 * Чем разделены зоны строки — один раз, в `line_pipeline.js` (У-32). Зовётся
 * `joinLineParts`, а не сборка целиком: та нормализует знак списка и на
 * `## heading` дописала бы `- `.
 */
const __linePipeline = require("./line_pipeline.js");
const __sharedUtils = require("./shared_utils.js");
const __rulesHelpers = require("./pkm_rules_runtime_helpers.js");

function resolveSeparatorsOrThrow(rules) {
  /* Правило — в общем доме; имя звавшего — для текста отказа. */
  return __sharedUtils.resolveSeparatorsOrThrow(rules, "pkm_line_finalize_unified");
}

function hasListPrefix(line) {
  return __sharedUtils.hasListPrefix(line);
}

/*
 * Знак чекбокса — ровно один, как у Obsidian:
 * `/^([>\s]*)(([*+-] |(\d+)([.)] ))(?:\[(.)\] )?)?/` в `app.js` 1.13.7 и
 * `data-task="(.)"`. Длиннее — текст человека (`- [test-transform] text`, У-91).
 */
/*
 * Разбор готового токена, не нормализация ввода (та — `normalizeCheckboxInput`
 * в `order_deep_editor_state.js`; В-118, PRD 10.13.144, 10.13.153, правило 117).
 */
function normalizeCheckboxToken(token) {
  const src = String(token || "").trim();
  if (!src) return "";
  const m = src.match(/^\[([\s\S]*)\]$/);
  if (!m) return "";
  const inner = String(m[1] || "").trim();
  if (!inner) return "[ ]";
  if (inner.length > 1) return "";
  return `[${inner}]`;
}

function getPrefixRulesUnified(rules, deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : (x) => !!x && typeof x === "object" && !Array.isArray(x);

  const behavior = rules && isObj(rules.behavior) ? rules.behavior : {};
  const src = isObj(behavior.prefixRules) ? behavior.prefixRules : {};
  const out = {
    resolver: "priority-first",
    priorityMode: "by-section",
    fieldsOrderMode: "manual",
    tagSubtagPriority: "subtag-over-tag",
    priorityTargets: [],
    priorityCheckboxes: [],
    checkboxByFieldValue: {},
  };
  if (typeof src.resolver === "string" && src.resolver.trim()) out.resolver = src.resolver.trim();
  if (typeof src.priorityMode === "string" && src.priorityMode.trim()) out.priorityMode = src.priorityMode.trim();
  if (typeof src.fieldsOrderMode === "string" && src.fieldsOrderMode.trim()) out.fieldsOrderMode = src.fieldsOrderMode.trim();
  if (typeof src.tagSubtagPriority === "string" && src.tagSubtagPriority.trim()) out.tagSubtagPriority = src.tagSubtagPriority.trim();
  if (Array.isArray(src.priorityTargets)) {
    out.priorityTargets = src.priorityTargets.map((x) => String(x || "").trim()).filter(Boolean);
  }
  if (Array.isArray(src.priorityCheckboxes)) {
    out.priorityCheckboxes = src.priorityCheckboxes
      .map((x) => normalizeCheckboxToken(x))
      .filter(Boolean);
  }
  if (isObj(src.checkboxByFieldValue)) {
    const fieldIds = Object.keys(src.checkboxByFieldValue);
    for (let i = 0; i < fieldIds.length; i++) {
      const fid = fieldIds[i];
      const row = src.checkboxByFieldValue[fid];
      if (!isObj(row)) continue;
      out.checkboxByFieldValue[fid] = {};
      const tokens = Object.keys(row);
      for (let j = 0; j < tokens.length; j++) {
        const tok = String(tokens[j] || "").trim();
        const cb = normalizeCheckboxToken(row[tokens[j]]);
        if (!tok || !cb) continue;
        out.checkboxByFieldValue[fid][tok] = cb;
      }
    }
  }
  if (!out.checkboxByFieldValue.type) out.checkboxByFieldValue.type = {};
  /*
   * `Field order source = Field order` — ручной список не читается (BUGHUNT
   * 2026-09-30, A9). У `Manual` Fields не из списка идут за ним, как в панели
   * (`fieldOrderList`).
   */
  if (out.fieldsOrderMode === "auto") out.priorityTargets = [];
  {
    /* Теги, затем ссылки: у Value-ссылки чекбокс из Prefix не ставился (`В-248`). */
    const lf = __sharedUtils.ruleFields(rules);
    for (let i = 0; i < lf.length; i++) {
      const id = lf[i] && lf[i].id ? String(lf[i].id) : "";
      if (!id) continue;
      if (!out.priorityTargets.includes(id)) out.priorityTargets.push(id);
    }
  }
  return out;
}

/**
 * Этот ли знак задачи — вид значения именно этого Field («этот знак поставили
 * мы» → можно унести). `[x]` на поле, умеющем `[ ]`, `[N]`, `[!]`, поставил
 * человек, и действие он переживает (10.13.92, 10.13.105). Один дом на панель
 * и команды (И-3, У-150).
 */
function checkboxBelongsToFieldUnified(rules, fieldId, token) {
  const want = normalizeCheckboxToken(token);
  if (!want) return false;
  const fid = String(fieldId || "").trim();
  if (!fid) return false;
  const row = getPrefixRulesUnified(rules).checkboxByFieldValue[fid];
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    if (normalizeCheckboxToken(row[keys[i]]) === want) return true;
  }
  return false;
}

/**
 * Знак задачи на строке поставило прежнее Value Field, а у нового своего нет —
 * знак уходит со значением (10.13.92) не только в конце круга, но и при шаге:
 * `- [ ] #todo` → `- #idea`, а не `- [ ] #idea` (его заказ 2026-10-03, В-162).
 * Чужой знак (`[x]` человека, `[ ]` у Value без знака) остаётся.
 */
function checkboxLeavesWithValueUnified(rules, fieldId, fromToken, toToken, lineToken) {
  const line = normalizeCheckboxToken(lineToken);
  if (!line) return false;
  const row = getPrefixRulesUnified(rules).checkboxByFieldValue[String(fieldId || "").trim()];
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const boxOf = (tok) => normalizeCheckboxToken(row[String(tok || "").trim()] || "");
  return String(fromToken || "").trim() !== String(toToken || "").trim()
    && boxOf(fromToken) === line && !boxOf(toToken);
}

/**
 * Бывают ли у Field знаки задачи вообще («мог ли занимать слот»), в отличие от
 * `checkboxBelongsToFieldUnified` («этот знак его»). `minimal` — слот у Field,
 * спрашивается этот вопрос; `off` — слот человека, второй (10.13.105).
 */
function fieldHasAnyCheckboxRuleUnified(rules, fieldId) {
  const fid = String(fieldId || "").trim();
  if (!fid) return false;
  const row = getPrefixRulesUnified(rules).checkboxByFieldValue[fid];
  if (!row || typeof row !== "object" || Array.isArray(row)) return false;
  const keys = Object.keys(row);
  for (let i = 0; i < keys.length; i++) {
    if (normalizeCheckboxToken(row[keys[i]])) return true;
  }
  return false;
}

function selectedTokenByFieldIdUnified(rules, state, fieldId, deps) {
  const getFieldById = deps && typeof deps.getFieldById === "function"
    ? deps.getFieldById
    : function(fields, id) {
      const src = Array.isArray(fields) ? fields : [];
      for (let i = 0; i < src.length; i++) {
        if (src[i] && src[i].id === id) return src[i];
      }
      return null;
    };
  const field = getFieldById({ fields: __sharedUtils.ruleFields(rules) }, fieldId);
  if (!field || !state || !state.selected) return "";
  const selectedId = String(state.selected[fieldId] || "");
  if (!selectedId) return "";
  const values = Array.isArray(field.values) ? field.values : [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    if (String(v.id || "") === selectedId || String(v.token || "") === selectedId) {
      return String(v.token || "").trim();
    }
  }
  return selectedId;
}

function resolvePrefixCheckboxUnified(rules, state, deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const cfg = getPrefixRulesUnified(rules, deps);
  const byField = cfg.checkboxByFieldValue || {};
  const ignoreByField = state && isObj(state.__prefixIgnoreFieldIds) ? state.__prefixIgnoreFieldIds : null;
  const hits = [];
  const hitByField = {};
  for (let i = 0; i < cfg.priorityTargets.length; i++) {
    const fid = cfg.priorityTargets[i];
    if (ignoreByField && ignoreByField[fid] === true) continue;
    if (!isObj(byField[fid])) continue;
    const tok = selectedTokenByFieldIdUnified(rules, state, fid, deps);
    if (!tok) continue;
    /* Панель пишет ключ Value-ссылки в скобках (`[[Man1]]`), правила — без: спрашиваются оба. */
    const row = byField[fid];
    const cb = normalizeCheckboxToken(row[tok] || (/^\[\[/.test(tok) ? "" : row["[[" + tok + "]]"]));
    if (!cb) continue;
    if (!hitByField[fid]) hitByField[fid] = cb;
  }

  const applyPair = (parentId, subId) => {
    const p = hitByField[parentId] || "";
    const s = hitByField[subId] || "";
    if (!p || !s) return;
    if (cfg.tagSubtagPriority === "tag-over-subtag") {
      delete hitByField[subId];
      return;
    }
    delete hitByField[parentId];
  };

  const modeFields = __sharedUtils.ruleFields(rules);
  for (let i = 0; i < modeFields.length; i++) {
    const childField = modeFields[i];
    if (!childField || !childField.id || !childField.dependsOn) continue;
    applyPair(String(childField.dependsOn || ""), String(childField.id || ""));
  }

  for (let i = 0; i < cfg.priorityTargets.length; i++) {
    const ff = cfg.priorityTargets[i];
    if (!hitByField[ff]) continue;
    hits.push(hitByField[ff]);
  }

  if (cfg.resolver === "priority-first") {
    if (cfg.priorityMode === "by-checkbox-list") {
      const ordered = Array.isArray(cfg.priorityCheckboxes) ? cfg.priorityCheckboxes : [];
      for (let i = 0; i < ordered.length; i++) {
        if (hits.includes(ordered[i])) return ordered[i];
      }
    }
    return hits.length ? hits[0] : "";
  }
  if (cfg.resolver === "concat-all" && hits.length) {
    const uniq = [];
    for (let i = 0; i < hits.length; i++) if (!uniq.includes(hits[i])) uniq.push(hits[i]);
    return uniq.join("");
  }
  return "";
}

/** Цитата и каллаут, снятые со строки отступом, — одним объявлением. */
function lineQuoteOfIndent(indent) {
  const start = __sharedUtils.lineStartOf(indent);
  return String(start.quote || "") + String(start.callout || "");
}

/**
 * Начало строки после действия: знак списка и чекбокс. Знак списка человека
 * переживает действие, любой из пяти (`-`, `*`, `+`, `1.`, `1)`; 10.13.92):
 * знак берётся у строки, ветки решают только чекбокс. Нет знака —
 * `parsedLine.bulletToken` равен дефису; снимает его
 * `enforceOffModeFinalPrefixUnified`, где настройка выключена.
 */
function buildPrefixUnified(parsedLine, rules, state, deps) {
  /*
   * Цитата и каллаут — впереди, нашего знака за ними нет (В-115); знак человека
   * внутри цитаты (`> - текст`) остаётся.
   */
  /* Цитата снята `splitSegments` вместе с отступом; обратно разбирает то же объявление. */
  const quote = String((parsedLine && parsedLine.quoteToken) || "")
    || lineQuoteOfIndent(parsedLine && parsedLine.indent);
  if (parsedLine && parsedLine.headingToken) {
    return `${parsedLine.headingToken} `;
  }
  const nextCb = resolvePrefixCheckboxUnified(rules, state, deps);
  const keepCb = (!nextCb && state && state.__preserveCheckboxPrefix === true && parsedLine && parsedLine.checkboxToken)
    ? normalizeCheckboxToken(parsedLine.checkboxToken)
    : "";
  const bullet = String((parsedLine && parsedLine.bulletToken) || (quote ? "" : "-"));
  /*
   * Задача бывает только за знаком списка — правило платформы (`lineStartOf`,
   * В-114). Внутри цитаты знака нет, и чекбокс значения копился в зоне значений
   * (`S41`); у заголовка — по той же причине.
   */
  if (!bullet) return "";
  let out = `${bullet} `;
  if (nextCb) out += `${nextCb} `;
  else if (keepCb) out += `${keepCb} `;
  return out;
}

function hasStandaloneCheckboxPrefix(line) {
  /* Скобки без знака списка — не задача (В-114), но начало, написанное человеком. */
  return __sharedUtils.startsWithBracketPair(line);
}

function extractOriginalPrefix(line) {
  return __sharedUtils.lineStartPrefixOf(line);
}

function reapplyOriginalPrefix(rawLine, nextLine) {
  return __sharedUtils.reapplyLineStart(rawLine, nextLine);
}

function preserveOriginalPrefixShape(rawLine, nextLine) {
  return __sharedUtils.preserveLineStartShape(rawLine, nextLine);
}

function removeSyntheticLeadingPrefix(line) {
  const src = String(line || "");
  const indent = (src.match(/^(\s*)/) || ["", ""])[1];
  let body = src.slice(indent.length);
  body = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^\[[^\]]\]\s+/, "");
  return indent + body;
}

function removeStandaloneHeadingMarkers(line) {
  const src = String(line || "");
  if (!src) return src;
  return src.replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1").replace(/\s{2,}/g, " ").trimEnd();
}

function applyPrefixPolicy(rawLine, builtLine, options) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = String(opts.mode || "resolved").trim().toLowerCase();
  if (mode === "preserve-original") return preserveOriginalPrefixShape(rawLine, builtLine);
  if (mode === "reapply-original") return reapplyOriginalPrefix(rawLine, builtLine);
  return String(builtLine || "");
}

/**
 * Пустой слот под текст (два пробела до разделителя, 10.13.34) переживает
 * склейку начала строки. Разделитель — из настроек, не литерал `||` (У-182);
 * знак и задача — у общего объявления начала строки (форм у знака пять).
 */
function restoreEmptyTextSlotAfterPrefix(line, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const src = String(line || "");
  const start = __sharedUtils.lineStartOf(src);
  /* Слот — только при задаче за знаком: без неё склейка начало не разрывала. */
  if (!start.marker || !start.checkbox) return src;
  const rest = src.slice(start.at);
  if (rest.indexOf(sep.sep1) !== 0) return src;
  return src.slice(0, start.at).replace(/[ \t]+$/, "") + "  " + rest;
}

function applyResolvedPrefixToLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  if (!line) return line;
  const rules = opts.rules;
  const parsedLine = opts.parsedLine;
  const state = opts.state;
  const allowHeadingRewrite = opts.allowHeadingRewrite === true;
  const prefixState = opts.prefixState && typeof opts.prefixState === "object" ? opts.prefixState : state;
  const buildPrefix = typeof opts.buildPrefix === "function" ? opts.buildPrefix : null;
  if (!buildPrefix) throw new Error("applyResolvedPrefixToLine requires buildPrefix dependency");
  if (/^\s*#{1,6}\s+/.test(line) && !allowHeadingRewrite) return line;

  const nextPrefix = String(buildPrefix(parsedLine, rules, prefixState) || "").trim();
  if (!nextPrefix) return line;

  /*
   * Отступ, цитата и каллаут — впереди, наш знак за ними: иначе `- ` перед `>`
   * ломал цитату (В-115).
   */
  const outerStart = __sharedUtils.lineStartOf(line);
  const indent = outerStart.outer;
  let body = line.slice(indent.length);
  if (allowHeadingRewrite) {
    while (/^#{1,6}(?:\s+|$)/.test(body)) body = body.replace(/^#{1,6}(?:\s+|$)/, "");
    body = body.replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1");
  }
  /* Знак и задача снимаются общим объявлением (В-114). */
  const innerStart = __sharedUtils.lineStartOf(body);
  if (innerStart.marker) {
    body = body.slice(innerStart.marker.length + innerStart.checkbox.length);
  }
  body = body.trim();
  let out = `${indent}${nextPrefix}${nextPrefix && body ? " " : ""}${body}`;

  out = restoreEmptyTextSlotAfterPrefix(out, rules);
  return out;
}

function escapeRx(s) {
  /* Дом — `escapeRe` в `shared_utils.js` (У-32): своя копия на `0`/`false` давала пустую альтернативу. */
  return __sharedUtils.escapeRe(s);
}

function getRightMarkersUnified(rules) {
  const out = [];
  const seen = new Set();
  function pushMarker(raw) {
    const mk = String(raw || "").trim();
    if (!mk || seen.has(mk)) return;
    seen.add(mk);
    out.push(mk);
  }

  const fields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields)
    ? rules.rightMode.fields
    : [];
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior)
    ? rules.behavior
    : {};
  const cfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const byField = cfg && typeof cfg.byField === "object" && !Array.isArray(cfg.byField)
    ? cfg.byField
    : {};
  const canonical = cfg && typeof cfg.canonical === "object" && !Array.isArray(cfg.canonical)
    ? cfg.canonical
    : {};

  let i;
  for (i = 0; i < fields.length; i++) {
    const field = fields[i] || {};
    const fieldId = String(field.id || "").trim();
    const orderKey = String(field.orderKey || "").trim();
    pushMarker(field.marker);

    const candidateKeys = [];
    if (fieldId) candidateKeys.push(fieldId);
    if (orderKey && candidateKeys.indexOf(orderKey) === -1) candidateKeys.push(orderKey);
    const canonicalKeys = Object.keys(canonical);
    let j;
    for (j = 0; j < canonicalKeys.length; j++) {
      const ck = String(canonicalKeys[j] || "").trim();
      const cv = String(canonical[ck] || "").trim();
      if (!cv) continue;
      if (cv === fieldId || cv === orderKey) {
        if (candidateKeys.indexOf(ck) === -1) candidateKeys.push(ck);
        if (candidateKeys.indexOf(cv) === -1) candidateKeys.push(cv);
      }
    }
    for (j = 0; j < candidateKeys.length; j++) {
      const row = byField && byField[candidateKeys[j]] && typeof byField[candidateKeys[j]] === "object"
        ? byField[candidateKeys[j]]
        : null;
      if (!row) continue;
      pushMarker(row.emoji);
      pushMarker(row.marker);
    }
  }

  /*
   * Четвёртый источник — шов навигации, живой (10.13.158): `rules.dates.markers`
   * пишут только три вызова в `navigation_runtime.js` (`trailingMarkers`). Без
   * чтения слепнут прыжки и шаг внутри строки (`S4`).
   */
  const datesMarkers = Array.isArray(rules && rules.dates && rules.dates.markers)
    ? rules.dates.markers
    : [];
  for (i = 0; i < datesMarkers.length; i++) pushMarker(datesMarkers[i]);
  return out;
}

/**
 * «Токен — наше значение, а не слово человека» — одно объявление: тег, ссылка,
 * метка элемента, голая дата, время (10.13.158). Метки собираются раз на вызов:
 * `getRightMarkersUnified` обходит все поля.
 */
function makeFieldValueTokenTest(rules) {
  const markers = getRightMarkersUnified(rules);
  const markerAlt = markers.length ? markers.map(escapeRx).join("|") : "(?!)";
  const markerRe = new RegExp("^(?:" + markerAlt + ")");
  /* Ссылка — по имени, не по форме (В-141): `makeWikilinkValueTest` (У-32). */
  const isLinkValue = __rulesHelpers.makeWikilinkValueTest(rules);
  return function isFieldValueToken(token) {
    const t = String(token || "").trim();
    if (!t) return false;
    return __sharedUtils.isTagToken(t)
      || isLinkValue(t)
      || markerRe.test(t)
      || /^\d{4}-\d{2}-\d{2}$/.test(t)
      || /^\d{2}:\d{2}$/.test(t);
  };
}

function extractHeadingPrefix(line) {
  const src = String(line || "");
  const m = src.match(/^(\s*#{1,6})\s+/);
  return m ? String(m[1] || "") : "";
}

function reapplyHeadingPrefix(rawLine, nextLine) {
  const headingPrefix = extractHeadingPrefix(rawLine);
  if (!headingPrefix) return String(nextLine || "");
  const src = String(nextLine || "");
  const indent = (String(rawLine || "").match(/^(\s*)/) || ["", ""])[1];
  let body = src.replace(/^\s*/, "");
  /*
   * Знак заголовка кончается одним пробелом, как у платформы и `lineStartOf`:
   * `\s+` съедал пустой слот под текст (10.13.34; У-147 — видно при разных
   * разделителях).
   */
  while (/^#{1,6}(?:[ \t]|$)/.test(body)) body = body.replace(/^#{1,6}(?:[ \t]|$)/, "");
  /* Пробелы за знаком — слот строки, в уборку не идут. */
  const slot = (body.match(/^[ \t]*/) || [""])[0];
  body = body.slice(slot.length);
  /*
   * Чекбокс снимается только вместе со знаком списка: `#### [ ] test` —
   * заголовок с текстом `[ ] test` (У-91, 10.13.94).
   */
  const withoutList = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  if (withoutList !== body) {
    body = withoutList.replace(/^\[[^\]]\]\s+/, "");
  }
  body = body.replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1");
  body = body.replace(/\s{2,}/g, " ").trim();
  return body
    ? `${indent}${headingPrefix.trim()} ${slot}${body}`
    : `${indent}${headingPrefix.trim()} `;
}

function applyModePrefixImmutability(rawLine, builtLine, options) {
  const opts = options && typeof options === "object" ? options : {};
  const preserveOff = opts.preserveOff === true;
  const preserveMinimalHeading = opts.preserveMinimalHeading === true;
  let out = String(builtLine || "");
  const raw = String(rawLine || "");
  const rawHasHeading = !!extractHeadingPrefix(raw);
  if (preserveOff) {
    if (rawHasHeading) return reapplyHeadingPrefix(raw, out);
    return out;
  }
  if (preserveMinimalHeading && rawHasHeading) {
    return reapplyHeadingPrefix(raw, out);
  }
  return out;
}

/**
 * Деление строки на зоны — дом `splitSegments` (тот же, что зовёт `tagwheel.js`).
 * Единственный разделитель при одинаковых разделителях — второй (У-153), иначе
 * правый Block читался текстом (`G3`, 2026-09-16; мера — `tools/line_matrix.js`).
 * Разделители в аргументах оставлены — их передают десять мест. Форма ответа
 * прежняя: цитата и каллаут, унесённые домом в `indent` (10.13.118),
 * возвращаются в левую зону, иначе знак списка вставал внутрь `>  -  :: #/1`.
 */
function splitThreeSegments(line, rules, sep1, sep2) {
  const src = String(line || "");
  const s1 = String(sep1 == null ? "" : sep1);
  const s2 = String(sep2 == null ? "" : sep2);
  /*
   * Дом — только когда разделители совпали (У-153): при разных позиция и есть
   * ответ. Шире нельзя: догадка дома о правом Block без второго разделителя
   * давала `-  :: 📅… 12` из `- 12` (2026-09-13).
   */
  if (s1 && s1 === s2) {
    const seg = __linePipeline.splitSegments(src, rules);
    return {
      indent: (src.match(/^(\s*)/) || ["", ""])[1],
      left: String(seg.indent || "") + String(seg.left || ""),
      text: String(seg.text || ""),
      dates: String(seg.dates || ""),
    };
  }
  const i1 = s1 ? src.indexOf(s1) : -1;
  if (i1 === -1) {
    return {
      indent: (src.match(/^(\s*)/) || ["", ""])[1],
      left: src,
      text: "",
      dates: "",
    };
  }
  const i2 = s2 ? src.indexOf(s2, i1 + s1.length) : -1;
  if (i2 === -1) {
    return {
      indent: (src.match(/^(\s*)/) || ["", ""])[1],
      left: src.slice(0, i1),
      text: src.slice(i1 + s1.length),
      dates: "",
    };
  }
  return {
    indent: (src.match(/^(\s*)/) || ["", ""])[1],
    left: src.slice(0, i1),
    text: src.slice(i1 + s1.length, i2),
    dates: src.slice(i2 + s2.length),
  };
}

function collapseSeparatorsForMinimalOff(line, rules) {
  const src = String(line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (src.indexOf(sep1) === -1 && src.indexOf(sep2) === -1) return src;
  const seg = splitThreeSegments(src, rules, sep1, sep2);
  const merged = [String(seg.left || "").trim(), String(seg.text || "").trim(), String(seg.dates || "").trim()]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return String(seg.indent || "") + merged;
}

function collapseSeparatorForFullNoSource(line, rules) {
  const src = String(line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  if (src.indexOf(sep1) === -1) return src;
  const seg = splitThreeSegments(src, rules, sep1, resolveSeparatorsOrThrow(rules).sep2);
  const left = String(seg.left || "").trim();
  const text = String(seg.text || "").trim();
  const dates = String(seg.dates || "").trim();
  if (dates) return src;
  const out = [left, text].filter(Boolean).join(" ").trim();
  return String(seg.indent || "") + out;
}

function applyMixedPostPolicies(rawLine, line, rules, policy) {
  const p = policy && typeof policy === "object" ? policy : {};
  let out = String(line || "");
  if (p.applyMinimalSeparatorCollapse) {
    out = collapseSeparatorsForMinimalOff(out, rules);
  }
  if (p.applyFullNoSourceCollapse) {
    out = collapseSeparatorForFullNoSource(out, rules);
  }
  if (p.applyMinimalPrefixPreserve) {
    out = applyPrefixPolicy(rawLine, out, { mode: "preserve-original" });
  }
  return out;
}

function resolveCursorByPolicy(options) {
  const opts = options && typeof options === "object" ? options : {};
  const finalLine = String(opts.finalLine || "");
  const rules = opts.rules;
  const policy = String(opts.cursorPolicy || "current_position").trim().toLowerCase();
  const getTextEnd = typeof opts.getCursorAtTextEnd === "function"
    ? opts.getCursorAtTextEnd
    : function defaultTextEnd(line) { return String(line || "").length; };
  const remapByDiff = typeof opts.remapCursorByLineDiff === "function"
    ? opts.remapCursorByLineDiff
    : function defaultRemap(_from, to) { return String(to || "").length; };
  if (policy === "text_end") return getTextEnd(finalLine, rules);
  if (policy === "line_end") return finalLine.length;
  if (opts.bootstrapToTextEndWhenSourceEmpty === true && !String(opts.originalLine || "").trim()) {
    return Math.max(0, Math.min(finalLine.length, Number(getTextEnd(finalLine, rules)) || 0));
  }
  let nextCh = remapByDiff(String(opts.originalLine || ""), finalLine, Number(opts.originalCursorCh || 0));
  if (nextCh >= finalLine.length) {
    const textEnd = getTextEnd(finalLine, rules);
    if (textEnd < finalLine.length) nextCh = textEnd;
  }
  return Math.max(0, Math.min(finalLine.length, Number(nextCh) || 0));
}

function normalizeSeparatorTopology(line, rules) {
  const src = String(line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || !sep2) return src;
  let out = src;
  if (sep1 === sep2) {
    const repeatedTail = new RegExp(`(?:\\s*${escapeRx(sep1)}\\s*){2,}$`);
    if (repeatedTail.test(out)) {
      out = out.replace(repeatedTail, ` ${sep1} `);
    }
    return out.replace(/\s+$/g, " ");
  }
  const seg = splitThreeSegments(out, rules, sep1, sep2);
  if (String(seg.dates || "").trim()) return out;
  const trailingSep2 = new RegExp(`\\s*${escapeRx(sep2)}\\s*$`);
  if (trailingSep2.test(out)) {
    out = out.replace(trailingSep2, "");
  }
  return out;
}

function hasAnySeparator(lineInput, rulesInput) {
  const s = String(lineInput || "");
  const sep = resolveSeparatorsOrThrow(rulesInput);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  return (sep1 && s.indexOf(sep1) !== -1) || (sep2 && s.indexOf(sep2) !== -1);
}

function normalizeSingleSeparatorLayout(line, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const s = String(line || "");
  const lead = (s.match(/^(\s*)/) || ["", ""])[1];
  const body = s.slice(lead.length);
  const idx = body.indexOf(sep1);
  if (idx === -1) return s;
  const left = body.slice(0, idx).trim();
  let right = body.slice(idx + sep1.length).trim();
  if (sep1 === sep2 && right.startsWith(sep1)) {
    const rest = right.slice(sep1.length).trim();
    const base = left || "-";
    return lead + (rest ? `${base} ${sep1}  ${sep2} ${rest}` : `${base} ${sep1}  ${sep2} `);
  }
  while (right.startsWith(sep1)) right = right.slice(sep1.length).trim();
  if (!left) return lead + (right ? `- ${sep1} ${right}` : `- ${sep1} `);
  /*
   * Пустой слот держится у любого знака начала строки, не только у `-`
   * (10.13.156, 10.13.34): на заголовке он схлопывался. Спрашивается
   * `lineStartOf` (У-177).
   */
  const leftStart = __sharedUtils.lineStartOf(left);
  if (!String(leftStart.body || "").trim()) {
    return lead + (right ? `${left}  ${sep1} ${right}` : `${left}  ${sep1} `);
  }
  return lead + (right ? `${left} ${sep1} ${right}` : `${left} ${sep1} `);
}

function removeConfiguredSeparators(line, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  let out = String(line || "");
  function strip(sep) {
    const s = String(sep || "");
    if (!s) return;
    const rx = new RegExp(`\\s*${escapeRx(s)}\\s*`, "g");
    out = out.replace(rx, " ");
  }
  strip(sep1);
  if (sep2 !== sep1) strip(sep2);
  return out.replace(/\s{2,}/g, " ").trim();
}

function stripTrailingConfiguredSeparators(line, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  let out = String(line || "");
  function trimSep(sep) {
    const s = String(sep || "");
    if (!s) return;
    const rx = new RegExp(`(?:\\s*${escapeRx(s)}\\s*)+$`, "g");
    out = out.replace(rx, "");
  }
  trimSep(sep1);
  if (sep2 !== sep1) trimSep(sep2);
  return out.replace(/\s+$/g, "");
}

function hasCheckboxListPrefix(line) {
  const body = String(line || "").replace(/^\s*/, "");
  return /^([-*+]|\d+[\.)])\s+\[[^\]]\](\s|$)/.test(body);
}

/* Копия снята (10.13.94, У-150): правило — `splitLeftPrefix` в `line_pipeline.js`. */
function splitLeftPrefix(raw) {
  return __linePipeline.splitLeftPrefix(raw);
}

/* «Начало строки + тело» — общий дом в `line_pipeline.js`; копия сведена при нулевом расхождении (10.13.145). */
function joinLeftPrefix(prefix, body) {
  return __linePipeline.joinLeftPrefix(prefix, body);
}

function normalizeMinimalOffFinalLine(rawLine, finalLine, rules, options) {
  const raw = String(rawLine || "");
  const opts = options && typeof options === "object" ? options : {};
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const seg = splitThreeSegments(finalLine, rules, sep1, sep2);
  const leftParts = splitLeftPrefix(seg.left);
  const mergedBody = [String(leftParts.body || "").trim(), String(seg.text || "").trim(), String(seg.dates || "").trim()]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  let out = joinLeftPrefix(leftParts.prefix, mergedBody);
  out = removeConfiguredSeparators(out, rules);
  out = stripTrailingConfiguredSeparators(out, rules);
  if (!/^\s*#{1,6}\s+/.test(raw) && (hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw))) {
    const rawHasList = hasListPrefix(raw);
    const rawHasCheckbox = hasCheckboxListPrefix(raw) || hasStandaloneCheckboxPrefix(raw);
    const outHasList = hasListPrefix(out);
    const outHasCheckbox = hasCheckboxListPrefix(out) || hasStandaloneCheckboxPrefix(out);
    const clearedOwnCheckbox = opts.clearedOwnCheckbox === true;
    const shouldKeepCheckbox = clearedOwnCheckbox
      ? false
      : (typeof opts.shouldKeepCheckbox === "boolean"
        ? opts.shouldKeepCheckbox
        : rawHasCheckbox);
    const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
    const outIndent = (out.match(/^(\s*)/) || ["", ""])[1];
    const shouldReapplyPrefix = !outHasList
      || rawIndent !== outIndent
      || (clearedOwnCheckbox && outHasCheckbox)
      || (shouldKeepCheckbox && !outHasCheckbox);
    if (shouldReapplyPrefix) {
      if (shouldKeepCheckbox) {
        out = reapplyOriginalPrefix(raw, out);
      } else if (rawHasList) {
        const markerMatch = String(raw || "")
          .replace(/^\s*/, "")
          .match(/^((?:[-*+]|\d+[\.)]))(?:\s+\[[^\]]\])?/);
        const marker = markerMatch ? String(markerMatch[1] || "").trim() : "-";
        const body = String(out || "")
          .replace(/^\s*/, "")
          .replace(/^([-*+]|\d+[\.)])\s+/, "")
          .replace(/^\[[^\]]\]\s+/, "")
          .trimStart();
        out = body ? `${rawIndent}${marker} ${body}` : `${rawIndent}${marker}`;
      } else {
        out = rawIndent + String(out || "")
          .replace(/^\s*/, "")
          .replace(/^\[[^\]]\]\s+/, "");
      }
    }
  }
  if (!out.trim() && raw.trim()) {
    const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
    out = rawIndent;
  }
  const normalized = String(out || "");
  const indent = (normalized.match(/^(\s*)/) || ["", ""])[1];
  const body = normalized.slice(indent.length).replace(/\s{2,}/g, " ").trimEnd();
  return indent + body;
}

function normalizeMinimalPriorityNoSeparatorLine(line, rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  let out = removeConfiguredSeparators(line, rules);
  if (opts.stripTrailing === true) out = stripTrailingConfiguredSeparators(out, rules);
  return out.replace(/\s{2,}/g, " ").trim();
}

function alignMinimalNoSeparatorPrefix(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const finalLine = String(opts.finalLine || "");
  if (!finalLine) return finalLine;
  if (/^\s*#{1,6}\s+/.test(rawLine)) return finalLine;

  const resolvedPrefix = String(opts.resolvedPrefix || "").trim();
  const targetFieldId = String(opts.targetFieldId || "").trim();
  const selectedToken = String(opts.selectedToken || "").trim();
  const prefixRules = opts.prefixRules && typeof opts.prefixRules === "object" ? opts.prefixRules : {};

  let desiredCheckbox = ((resolvedPrefix.match(/\[[^\]]\]/) || [""])[0] || "").trim();
  if (!desiredCheckbox && targetFieldId && selectedToken) {
    const byField = prefixRules.checkboxByFieldValue && typeof prefixRules.checkboxByFieldValue === "object"
      ? prefixRules.checkboxByFieldValue
      : {};
    const row = byField[targetFieldId] && typeof byField[targetFieldId] === "object" ? byField[targetFieldId] : null;
    if (row) {
      desiredCheckbox = String(row[selectedToken] || row[selectedToken.replace(/^#/, "")] || "").trim();
    }
  }
  if (!desiredCheckbox) return finalLine;

  const currentCheckbox = ((finalLine.match(/\[[^\]]\]/) || [""])[0] || "").trim();
  const indent = opts.preserveIndent === true
    ? ((rawLine.match(/^(\s*)/) || ["", ""])[1] || "")
    : "";
  const finalIndent = ((finalLine.match(/^(\s*)/) || ["", ""])[1] || "");
  if (currentCheckbox === desiredCheckbox) {
    if (opts.preserveIndent === true && indent !== finalIndent && hasListPrefix(finalLine)) {
      return indent + finalLine.replace(/^\s*/, "");
    }
    return finalLine;
  }

  /* Начало строки — общим объявлением: `1) текст` тоже список (Д2 ревизии). */
  const bodyStart = __sharedUtils.lineStartOf(finalLine);
  const body = String(bodyStart.body || "").trim();
  return `${indent}- ${desiredCheckbox}${body ? " " + body : ""}`;
}

function relocateOffEntriesToRightPanel(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  if (!line) return line;
  const rules = opts.rules;
  const entries = Array.isArray(opts.offEntries) ? opts.offEntries : [];
  if (!entries.length) return line;

  const buildFromSegments = typeof opts.buildFromSegments === "function"
    ? opts.buildFromSegments
    : null;
  if (!buildFromSegments) throw new Error("pkm_line_finalize_unified: buildFromSegments required");

  const removeTokens = typeof opts.removeTokens === "function"
    ? opts.removeTokens
    : function defaultRemoveTokens(seg, tokens) {
      const src = String(seg || "").trim();
      if (!src) return src;
      const set = {};
      const list = Array.isArray(tokens) ? tokens : [];
      for (let i = 0; i < list.length; i++) {
        const t = String(list[i] || "").trim();
        if (!t) continue;
        set[t] = true;
      }
      if (!Object.keys(set).length) return src;
      return __sharedUtils.lineWords(src).filter((t) => !set[t]).join(" ").trim();
    };

  const appendToken = typeof opts.appendToken === "function"
    ? opts.appendToken
    : function defaultAppendToken(seg, token) {
      const s = String(seg || "").trim();
      const t = String(token || "").trim();
      if (!t) return s;
      if (!s) return t;
      return `${s} ${t}`;
    };

  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const seg = splitThreeSegments(line, rules, sep1, sep2);
  const leftParts = splitLeftPrefix(seg.left);

  const offTokens = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    const direct = String(e.token || "").trim();
    if (direct) offTokens.push(direct);
    const map = Array.isArray(e.tokens) ? e.tokens : [];
    for (let j = 0; j < map.length; j++) {
      const t = String(map[j] || "").trim();
      if (t) offTokens.push(t);
    }
  }
  const uniq = [];
  const seen = {};
  for (let i = 0; i < offTokens.length; i++) {
    const t = String(offTokens[i] || "").trim();
    if (!t || seen[t]) continue;
    seen[t] = true;
    uniq.push(t);
  }

  const leftBody = removeTokens(leftParts.body, uniq);
  /*
   * Value в тексте — слово человека (`В-235`): при `Keep typed tags in text`
   * фраза не трогается, как в `relocateTokenSetByPanel` (цикл 104).
   */
  if (!__sharedUtils.typedTagsStayText(rules)) seg.text = removeTokens(seg.text, uniq);
  seg.dates = removeTokens(seg.dates, uniq);
  for (let i = 0; i < entries.length; i++) {
    const tok = String(entries[i] && entries[i].token ? entries[i].token : "").trim();
    if (!tok) continue;
    seg.dates = appendToken(seg.dates, tok);
  }
  seg.left = joinLeftPrefix(leftParts.prefix, leftBody);
  return buildFromSegments(seg, rules, sep1, sep2);
}

function applyFullNoSourceNormalization(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  let finalLine = String(opts.finalLine || "");
  if (!finalLine) return finalLine;

  if (!hasListPrefix(rawLine) && hasListPrefix(finalLine)) {
    finalLine = removeSyntheticLeadingPrefix(finalLine);
  }
  const sepRaw = resolveSeparatorsOrThrow(rules).sep1;
  if (rawLine.indexOf(sepRaw) === -1) {
    finalLine = applyMixedPostPolicies(rawLine, finalLine, rules, {
      applyFullNoSourceCollapse: true,
    });
  }
  return finalLine;
}

function applyOffSelectionPostPolicies(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  let finalLine = String(opts.finalLine || "");
  if (!finalLine) return finalLine;

  const offEntries = Array.isArray(opts.offEntries) ? opts.offEntries : [];
  const offHasLeft = opts.offHasLeft === true;
  const offHasRight = opts.offHasRight === true;

  if (offHasLeft) {
    const extractOriginalText = typeof opts.extractOriginalText === "function"
      ? opts.extractOriginalText
      : null;
    const enforceTextSegmentForLeftTag = typeof opts.enforceTextSegmentForLeftTag === "function"
      ? opts.enforceTextSegmentForLeftTag
      : null;
    if (!extractOriginalText || !enforceTextSegmentForLeftTag) {
      throw new Error("pkm_line_finalize_unified: off-left policy helpers required");
    }
    const originalText = extractOriginalText(rawLine, rules);
    return enforceTextSegmentForLeftTag(finalLine, rules, originalText);
  }

  if (offHasRight) {
    return relocateOffEntriesToRightPanel({
      line: finalLine,
      rules,
      offEntries,
      removeTokens: opts.removeTokens,
      appendToken: opts.appendToken,
      buildFromSegments: opts.buildFromSegments,
    });
  }

  return finalLine;
}

function applyUnifiedPostFinalize(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  const mode = String(opts.mode || "off").trim().toLowerCase();
  let line = String(opts.line || "");

  line = applyMixedPostPolicies(rawLine, line, rules, opts.mixedPolicy || {});
  line = applyModePrefixImmutability(rawLine, line, {
    preserveOff: opts.preserveOff === true,
    preserveMinimalHeading: opts.preserveMinimalHeading === true,
  });
  line = applyFinalLineInvariants({
    rawLine,
    line,
    rules,
    mode,
  });
  return line;
}

function applyCycleEndAndInvariants(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rules = opts.rules;
  const rawLine = String(opts.rawLine || "");
  const mode = String(opts.mode || "off").trim().toLowerCase();
  const cyclePost = applyCycleEndPostProcessing({
    finalLine: String(opts.finalLine || ""),
    rules,
    cycleEndBehavior: opts.cycleEndBehavior,
    parsedLine: opts.parsedLine,
    parseLine: opts.parseLine,
    isBulletLikeEmptyResult: opts.isBulletLikeEmptyResult,
    isOrphanCheckboxBulletLine: opts.isOrphanCheckboxBulletLine,
    buildBulletOnlyLine: opts.buildBulletOnlyLine,
    shouldKeepBulletLine: opts.shouldKeepBulletLine,
    enforceNoContentFinalization: opts.enforceNoContentFinalization,
    isNoContentParsed: opts.isNoContentParsed,
    stripPrefixWhenSourceHasNoPrefix: opts.stripPrefixWhenSourceHasNoPrefix,
    sourceHasPrefix: opts.sourceHasPrefix,
    stripPrefixKeepIndent: opts.stripPrefixKeepIndent,
  });
  const lineAfterCycle = String(cyclePost && cyclePost.finalLine != null ? cyclePost.finalLine : opts.finalLine || "");
  let finalLine = applyFinalLineInvariants({
    rawLine,
    line: lineAfterCycle,
    rules,
    mode,
  });
  /*
   * `Clear line`: опустевшая строка становится пустой, отступ и цитата
   * остаются (`В-260`, BUGHUNT A18, У-184); знак списка и задача — нет. Дом
   * зовут все три дороги.
   */
  const cleared = isClearedLine(finalLine, opts, cyclePost && cyclePost.cycleEndBehavior);
  if (cleared) finalLine = outerShapeOf(rawLine);
  return {
    finalLine,
    applyKeepBullet: !!(cyclePost && cyclePost.applyKeepBullet),
    /* Очищена `Clear line`: позвавший не возвращает ей начало строки. */
    cleared,
  };
}

/** Внешнее оформление строки: отступ, цитата, каллаут (У-184). */
function outerShapeOf(line) {
  const start = __sharedUtils.lineStartOf(String(line || ""));
  return String(start.indent || "") + String(start.quote || "") + String(start.callout || "");
}

/**
 * Строка опустела при `Clear line` (ни значений, ни дат, ни текста, не
 * заголовок): начало уходит (`В-260`).
 */
function isClearedLine(line, opts, cycleEndBehavior) {
  /* Конец круга уже нормализован `applyCycleEndPostProcessing` (Н-21 ревизии 2026-10-03). */
  if (cycleEndBehavior !== "clear-prefix") return false;
  if (typeof (opts && opts.parseLine) !== "function") return false;
  const parsed = opts.parseLine(String(line || ""), opts.rules) || {};
  if (parsed.headingToken) return false;
  if (Array.isArray(parsed.tags) && parsed.tags.length) return false;
  return !String(parsed.dates || "").trim() && !String(parsed.text || "").trim();
}

function isSimplePlainRaw(rawLine, rules, options) {
  const opts = options && typeof options === "object" ? options : {};
  const requireNoSeparator = opts.requireNoSeparator === true;
  const hasStandaloneCheckboxPrefix = typeof opts.hasStandaloneCheckboxPrefix === "function"
    ? opts.hasStandaloneCheckboxPrefix
    : function defaultHasStandaloneCheckboxPrefix(line) {
      return /^\s*\[[^\]]\](\s|$)/.test(String(line || ""));
    };
  const hasAnySeparatorFn = typeof opts.hasAnySeparator === "function"
    ? opts.hasAnySeparator
    : function defaultHasAnySeparator(lineInput, rulesInput) {
      return hasAnySeparator(lineInput, rulesInput);
    };
  const rawTrim = String(rawLine || "").trim();
  if (!rawTrim) return false;
  if (/^#{1,6}\s+/.test(rawTrim)) return false;
  if (/^([-*+]|\d+[\.)])(\s|$)/.test(rawTrim)) return false;
  if (hasStandaloneCheckboxPrefix(rawTrim)) return false;
  if (requireNoSeparator && hasAnySeparatorFn(rawTrim, rules)) return false;
  return true;
}

function reflowNoContentPanelLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const parsedFinal = opts.parsedFinal && typeof opts.parsedFinal === "object" ? opts.parsedFinal : {};
  const parsedBase = opts.parsedBase && typeof opts.parsedBase === "object" ? opts.parsedBase : {};
  const rules = opts.rules;
  const panelName = String(opts.panelName || "right").trim().toLowerCase();
  const tags = Array.isArray(parsedFinal.tags) ? parsedFinal.tags : [];
  const text = String(parsedFinal.text || "").trim();
  const dates = String(parsedFinal.dates || "").trim();
  if (tags.length || text || !dates) return null;
  const indent = String(parsedBase.indent || "");
  const bullet = String(parsedBase.bulletToken || "-").trim() || "-";
  const cb = String(parsedBase.checkboxToken || "").trim();
  const leftPrefix = cb ? `${bullet} ${cb}` : `${bullet}`;
  const sep1 = resolveSeparatorsOrThrow(rules).sep1;
  if (panelName === "left") return `${indent}${leftPrefix} ${dates} ${sep1} `;
  return `${indent}${leftPrefix} ${sep1} ${dates}`;
}

function composeMinimalHeadingLine(options) {
  const opts = options && typeof options === "object" ? options : {};
  const indent = String(opts.indent || "");
  const headingToken = String(opts.headingToken || "").trim();
  const left = String(opts.left || "").trim();
  const text = String(opts.text || "").trim();
  const right = String(opts.right || "").trim();
  const sepOn = opts.sepOn !== false;
  const sep1 = String(opts.sep1 || "").trim();
  if (!sep1) throw new Error("pkm_line_finalize_unified: sep1 is required");
  const headingPrefix = headingToken ? `${indent}${headingToken} ` : indent;
  if (sepOn) {
    if (left && right) return `${headingPrefix}${left} ${sep1} ${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`.trimEnd();
    if (left) return `${headingPrefix}${left}${text ? ` ${sep1} ${text}` : ""}`.trimEnd();
    if (right) return `${headingPrefix}${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`.trimEnd();
    return `${headingPrefix}${text}`.trimEnd();
  }
  if (left && right) return `${headingPrefix}${left} ${text}${text ? ` ${right}` : right ? right : ""}`.trimEnd();
  if (left) return `${headingPrefix}${left}${text ? ` ${text}` : ""}`.trimEnd();
  if (right) return `${headingPrefix}${text}${text ? ` ${right}` : right}`.trimEnd();
  return `${headingPrefix}${text}`.trimEnd();
}

function applyMinimalSelectionNormalization(options) {
  const opts = options && typeof options === "object" ? options : {};
  const deps = opts.deps && typeof opts.deps === "object" ? opts.deps : {};
  const parseLine = typeof deps.parseLine === "function" ? deps.parseLine : null;
  const buildPrefix = typeof deps.buildPrefix === "function" ? deps.buildPrefix : null;
  const resolveFreeRoamBehavior = typeof deps.resolveFreeRoamBehavior === "function" ? deps.resolveFreeRoamBehavior : null;
  const splitThreeSegments = typeof deps.splitThreeSegments === "function" ? deps.splitThreeSegments : null;
  const resolveOrderKeyForField = typeof deps.resolveOrderKeyForField === "function" ? deps.resolveOrderKeyForField : null;
  const resolvePanelKeyForField = typeof deps.resolvePanelKeyForField === "function" ? deps.resolvePanelKeyForField : null;
  const resolveFieldFreeRoamMode = typeof deps.resolveFieldFreeRoamMode === "function" ? deps.resolveFieldFreeRoamMode : null;
  const resolvePanelForField = typeof deps.resolvePanelForField === "function" ? deps.resolvePanelForField : null;
  const selectedTokenForField = typeof deps.selectedTokenForField === "function" ? deps.selectedTokenForField : null;
  const makeFieldById = typeof deps.makeFieldById === "function" ? deps.makeFieldById : null;
  if (!parseLine || !buildPrefix || !resolveFreeRoamBehavior || !splitThreeSegments || !resolveOrderKeyForField || !resolvePanelKeyForField || !resolveFieldFreeRoamMode || !resolvePanelForField || !selectedTokenForField || !makeFieldById) {
    throw new Error("applyMinimalSelectionNormalization requires full dependency set");
  }

  const finalLine = String(opts.line || "");
  const stateRules = opts.rules;
  const parsedBase = opts.parsedBase && typeof opts.parsedBase === "object" ? opts.parsedBase : null;
  if (!parsedBase) return finalLine;
  const orderCfg = opts.orderCfg;
  const session = opts.session && typeof opts.session === "object" ? opts.session : {};
  const preserveExistingTokens = opts.preserveExistingTokens === true;
  const prefixState = opts.prefixState !== undefined ? opts.prefixState : session;
  const behavior = resolveFreeRoamBehavior(orderCfg);
  const sepOn = behavior.minimalSeparator !== false;
  const sep1 = stateRules && stateRules.io && stateRules.io.separator1 != null ? String(stateRules.io.separator1) : "";
  const sep2 = stateRules && stateRules.io && stateRules.io.separator2 != null ? String(stateRules.io.separator2) : "";

  if (hasListPrefix(opts.originalLine)) {
    if (!sep1 || !sep2) return finalLine;
    if (sepOn) return finalLine;
    const segList = splitThreeSegments(finalLine, stateRules, sep1, sep2);
    const mergedList = [String(segList.left || "").trim(), String(segList.text || "").trim(), String(segList.dates || "").trim()]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return String(segList.indent || "") + mergedList;
  }

  const leftFields = stateRules && stateRules.leftMode && Array.isArray(stateRules.leftMode.fields)
    ? stateRules.leftMode.fields
    : [];
  const byId = makeFieldById(leftFields);
  const leftTokens = [];
  const rightTokens = [];
  const subFmtNow = stateRules && stateRules.behavior && typeof stateRules.behavior.subtagFormat === "string"
    ? String(stateRules.behavior.subtagFormat).toLowerCase().trim()
    : "separate";
  let i;
  for (i = 0; i < leftFields.length; i++) {
    const field = leftFields[i];
    if (!field || !field.id) continue;
    const orderKey = resolveOrderKeyForField(field);
    if (!orderKey) continue;
    if (subFmtNow === "combined" && field.dependsOn) continue;
    const panelKey = resolvePanelKeyForField(field, byId);
    const mode = resolveFieldFreeRoamMode(orderCfg, panelKey);
    if (mode !== "minimal") continue;
    const panel = resolvePanelForField(orderCfg, panelKey, "right");
    const token = selectedTokenForField(field, session, stateRules, byId);
    if (!token) continue;
    if (panel === "left") leftTokens.push(token);
    else rightTokens.push(token);
  }
  if (!leftTokens.length && !rightTokens.length) return finalLine;

  if (!sepOn && preserveExistingTokens) {
    const segKeep = splitThreeSegments(finalLine, stateRules, sep1, sep2);
    const merged = [String(segKeep.left || "").trim(), String(segKeep.text || "").trim(), String(segKeep.dates || "").trim()]
      .filter(Boolean)
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return String(segKeep.indent || "") + merged;
  }

  const parsedFinal = parseLine(finalLine, stateRules);
  let text = String(parsedBase.text || "").trim();
  if (!text) text = String(parsedFinal && parsedFinal.text ? parsedFinal.text : "").trim();
  const indent = String(parsedBase.indent || "");
  let resolvedPrefix = String(buildPrefix(parsedFinal, stateRules, prefixState) || "").trim();
  if (!resolvedPrefix) resolvedPrefix = String(buildPrefix(parsedBase, stateRules, prefixState) || "").trim();

  function withResolvedPrefix(body) {
    const b = String(body || "").trimEnd();
    if (!resolvedPrefix) return (indent + b).trimEnd();
    return (indent + resolvedPrefix + (b ? (" " + b) : "")).trimEnd();
  }

  const left = leftTokens.join(" ").trim();
  const right = rightTokens.join(" ").trim();
  if (String(parsedBase.headingToken || "").trim()) {
    return composeMinimalHeadingLine({
      indent,
      headingToken: String(parsedBase.headingToken || "").trim(),
      left,
      text,
      right,
      sepOn,
      sep1,
    });
  }

  if (sepOn) {
    if (left && right) return withResolvedPrefix(`${left} ${sep1} ${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`);
    if (left) return withResolvedPrefix(`${left}${text ? ` ${sep1} ${text}` : ""}`);
    if (right) return withResolvedPrefix(`${text}${text ? ` ${sep1} ${right}` : right ? `${sep1} ${right}` : ""}`);
    return withResolvedPrefix(text);
  }
  if (left && right) return withResolvedPrefix(`${left} ${text}${text ? ` ${right}` : right ? right : ""}`);
  if (left) return withResolvedPrefix(`${left}${text ? ` ${text}` : ""}`);
  if (right) return withResolvedPrefix(`${text}${text ? ` ${right}` : right}`);
  return withResolvedPrefix(text);
}

function collapseEmptyLeftSeparatorToText(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  const parsedFinal = opts.parsedFinal && typeof opts.parsedFinal === "object" ? opts.parsedFinal : {};
  const rules = opts.rules;
  const tags = Array.isArray(parsedFinal.tags) ? parsedFinal.tags : [];
  const text = String(parsedFinal.text || "").trim();
  const dates = String(parsedFinal.dates || "").trim();
  if (tags.length || !text || dates) return line;
  const sep1 = resolveSeparatorsOrThrow(rules).sep1;
  if (!sep1) return line;
  const leftEmptyRx = new RegExp(`^\\s*(?:[-*+]|\\d+[\\.)])(?:\\s+\\[[^\\]]+\\])?\\s*${escapeRx(sep1)}\\s+`);
  if (!leftEmptyRx.test(line)) return line;
  if (typeof opts.shouldCollapse === "function" && opts.shouldCollapse(parsedFinal, line) !== true) return line;
  const indent = (line.match(/^(\s*)/) || ["", ""])[1];
  return indent + text;
}

function removeTokenWholeLine(line, token) {
  const src = String(line || "");
  const tok = String(token || "").trim();
  if (!tok) return src;
  const rx = new RegExp(`(^|\\s)${escapeRx(tok)}(?=\\s|$)`, "g");
  return src.replace(rx, "$1").replace(/\s{2,}/g, " ").replace(/\s+$/g, "");
}

function insertTokenAtIndex(src, token, idx) {
  const line = String(src || "");
  const tok = String(token || "").trim();
  if (!tok) return line;
  const at = Math.max(0, Math.min(Number(idx) || 0, line.length));
  const left = line.slice(0, at);
  const right = line.slice(at);
  const needLeft = left.length > 0 && !/\s$/.test(left);
  const needRight = right.length > 0 && !/^\s/.test(right);
  return left + (needLeft ? " " : "") + tok + (needRight ? " " : "") + right;
}

function resolveInsertIndexByPlacement(src, cursorAt, placement) {
  const line = String(src || "");
  const at = Math.max(0, Math.min(Number(cursorAt) || 0, line.length));
  const mode = String(placement || "smart").toLowerCase().trim();
  if (mode === "line_start") return 0;
  if (mode === "line_end") return line.length;
  if (mode === "cursor") return at;
  const isWord = function isWord(ch) { return /\S/.test(ch); };
  if (!line.length) return 0;
  if (at <= 0) return 0;
  if (at >= line.length) return line.length;
  const leftWord = isWord(line.charAt(at - 1));
  const rightWord = isWord(line.charAt(at));
  if (!leftWord && !rightWord) return at;
  let start = at;
  if (leftWord) {
    start = at - 1;
    while (start > 0 && isWord(line.charAt(start - 1))) start -= 1;
  }
  let end = at;
  if (rightWord) {
    while (end < line.length && isWord(line.charAt(end))) end += 1;
  }
  if (mode === "left") return start;
  if (mode === "right") return end;
  const distLeft = at - start;
  const distRight = end - at;
  return distLeft <= distRight ? start : end;
}

function normalizeFullTagLineByEntries(options) {
  const opts = options && typeof options === "object" ? options : {};
  const entries = Array.isArray(opts.entries) ? opts.entries : [];
  const removeTokenWholeLineFn = typeof opts.removeTokenWholeLine === "function"
    ? opts.removeTokenWholeLine
    : removeTokenWholeLine;
  const resolveInsertIndexByPlacementFn = typeof opts.resolveInsertIndexByPlacement === "function"
    ? opts.resolveInsertIndexByPlacement
    : resolveInsertIndexByPlacement;
  const insertTokenAtIndexFn = typeof opts.insertTokenAtIndex === "function"
    ? opts.insertTokenAtIndex
    : insertTokenAtIndex;
  const remapCursorByLineDiff = typeof opts.remapCursorByLineDiff === "function"
    ? opts.remapCursorByLineDiff
    : function defaultRemap(_from, to) { return String(to || "").length; };

  let out = String(opts.line || "");
  let cursor = Math.max(0, Number(opts.cursorCh || 0));
  const placement = String(opts.placement || "smart").toLowerCase().trim();

  let i;
  for (i = 0; i < entries.length; i++) {
    const item = entries[i] && typeof entries[i] === "object" ? entries[i] : {};
    const tok = String(item.token || "").trim();
    if (!tok) continue;
    const allTokens = Array.isArray(item.tokens) ? item.tokens : [];
    let cleaned = out;
    let j;
    for (j = 0; j < allTokens.length; j++) cleaned = removeTokenWholeLineFn(cleaned, allTokens[j]);
    cleaned = removeTokenWholeLineFn(cleaned, tok);
    cursor = remapCursorByLineDiff(out, cleaned, cursor);
    out = cleaned;
    const idx = resolveInsertIndexByPlacementFn(out, cursor, placement);
    const inserted = insertTokenAtIndexFn(out, tok, idx);
    const posAfter = idx + tok.length + ((idx > 0 && !/\s$/.test(out.slice(0, idx))) ? 1 : 0);
    cursor = remapCursorByLineDiff(inserted, inserted, posAfter);
    out = inserted;
  }

  return {
    line: (function normalizeWithIndent(src, originalLine) {
      const raw = String(src || "");
      const baseIndent = (String(originalLine || "").match(/^(\s*)/) || ["", ""])[1];
      const body = raw.replace(/^\s*/, "").replace(/\s{2,}/g, " ").replace(/\s+$/g, "");
      return baseIndent + body;
    })(out, opts.line),
    cursorCh: Math.max(0, Math.trunc(Number(cursor) || 0)),
  };
}

function normalizeStructuredSlots(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const line = String(opts.line || "");
  const rules = opts.rules;
  const mode = String(opts.mode || "off").trim().toLowerCase();
  if (mode !== "off" && mode !== "minimal" && mode !== "full") return line;
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || line.indexOf(sep1) === -1) return line;

  const seg = splitThreeSegments(line, rules, sep1, sep2);
  const headingFromRaw = extractHeadingPrefix(rawLine);
  const headingFromLine = extractHeadingPrefix(line);
  const leftWithoutList = String(seg.left || "")
    .replace(/^\s*(?:[-*+]|\d+[\.)])\s+/, "")
    .replace(/^\s*\[[^\]]\]\s+/, "");
  /*
   * Знак заголовка — знак и пробел (З3 № 110). Дом отдаёт зону без пробела у
   * разделителя, поэтому граница подставляется явно: иначе `- ## :: 111` не
   * становилось `## 111`.
   */
  const headingFromLeft = extractHeadingPrefix(leftWithoutList + " ");
  const headingPrefix = headingFromRaw || headingFromLine || headingFromLeft;
  if (!headingPrefix) return line;

  let left = String(seg.left || "").replace(/\s+$/g, "");
  let text = String(seg.text || "").trim();
  const dates = String(seg.dates || "").trim();

  const leftBody = left
    .replace(/^\s*#{1,6}(?:\s+|$)/, "")
    .replace(/^\s*(?:[-*+]|\d+[\.)])\s+/, "")
    .replace(/^\s*\[[^\]]\]\s+/, "")
    .replace(/(^|\s)#{1,6}(?=\s|$)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();

  /* Общий признак «наш токен»: им же пользуются правило заголовка, деление зоны и `pkm_macro_shared.js`. */
  const isControlToken = makeFieldValueTokenTest(rules);

  /*
   * Слово человека приклеивается к знаку заголовка, значения — нет (10.13.156):
   * `#  :: слово` → `# слово`, но `# #work #aaa` → `# #work #aaa :: `.
   * Спрашивается «все ли токены — значения» (`isControlToken`), а не «есть ли
   * значение»: иначе расходилось со сборкой (У-157). При одинаковых
   * разделителях правый Block читается текстом (У-147) — это основной случай
   * (2026-09-15).
   */
  /*
   * Признак — местный `isControlToken`, не `hasFieldTokens`: дата-значение —
   * два токена (`📅2026-09-15` и `13:16`), признак сборки второй не узнаёт.
   * Цена: метки читаются из разных мест конфига (`rules.dates.markers` против
   * сторон Order); сведение — отдельная работа в очереди, оба ответа закреплены
   * проверками.
   */
  const textTokensAll = __sharedUtils.lineWords(text);
  const textIsAllFieldValues = textTokensAll.length > 0 && textTokensAll.every(isControlToken);
  if (text && !leftBody && !dates && !textIsAllFieldValues) {
    return `${headingPrefix} ${text}`.replace(/\s{2,}/g, " ").trimEnd();
  }

  if (text) return line;

  const tokens = __sharedUtils.lineWords(leftBody);
  if (!tokens.length) return line;

  let splitAt = tokens.length;
  while (splitAt > 0 && !isControlToken(tokens[splitAt - 1])) splitAt -= 1;
  if (splitAt === tokens.length) return line;

  const leftTokens = tokens.slice(0, splitAt);
  const textTokens = tokens.slice(splitAt);
  text = textTokens.join(" ").trim();
  left = headingPrefix + (leftTokens.length ? (" " + leftTokens.join(" ")) : "");

  let out = left;
  out += ` ${sep1}`;
  if (text) out += ` ${text}`;
  if (dates) out += ` ${sep2} ${dates}`;
  return out.replace(/\s{2,}/g, " ").trimEnd();
}

function splitLeftDecorators(rawLeft) {
  /* Части начала строки — `lineStartOf`, с цитатой и каллаутом (10.13.118). */
  const start = __sharedUtils.lineStartOf(rawLeft);
  return {
    indent: start.indent,
    quoteToken: String(start.quote || "") + String(start.callout || ""),
    headingToken: String(start.heading || "").trim(),
    listToken: String(start.marker || "").trim(),
    checkboxToken: String(start.checkbox || "").trim(),
    body: String(start.body || "").trim(),
  };
}

function joinLeftDecorators(parts, body) {
  const p = parts && typeof parts === "object" ? parts : {};
  const indent = String(p.indent || "");
  /*
   * Снятое на входе возвращается на выходе — и цитата (У-184, `S41`): иначе
   * `> [[test]] текст` терял `>`. Пробел за знаком цитаты ставится здесь, если
   * его нет.
   */
  const quote = String(p.quoteToken || "");
  const tokens = [];
  if (p.headingToken) tokens.push(String(p.headingToken));
  if (p.listToken) tokens.push(String(p.listToken));
  if (p.checkboxToken) tokens.push(String(p.checkboxToken));
  const tail = String(body || "").trim();
  if (tail) tokens.push(tail);
  const rest = tokens.join(" ").trim();
  if (!quote) return indent + rest;
  if (!rest) return indent + quote;
  return indent + (/[^\S\n]$/.test(quote) ? quote : quote + " ") + rest;
}

function enforceSourcePrefixInvariant(rawLine, line) {
  const raw = String(rawLine || "");
  const out = String(line || "");
  if (!out.trim()) return out;
  const rawHasPrefix = hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw);
  if (!rawHasPrefix) return out;
  const outHasPrefix = hasListPrefix(out) || hasStandaloneCheckboxPrefix(out);
  if (outHasPrefix) return out;
  return reapplyOriginalPrefix(raw, out);
}

function stripSyntheticPrefixForPlainSource(rawLine, line) {
  const raw = String(rawLine || "");
  const out = String(line || "");
  if (!out.trim()) return out;
  const rawHasPrefix = hasListPrefix(raw) || hasStandaloneCheckboxPrefix(raw) || /^\s*#{1,6}\s+/.test(raw);
  if (rawHasPrefix) return out;
  if (!hasListPrefix(out) && !hasStandaloneCheckboxPrefix(out)) return out;
  const rawIndent = (raw.match(/^(\s*)/) || ["", ""])[1];
  let body = out.replace(/^\s*/, "");
  body = body.replace(/^([-*+]|\d+[\.)])\s+/, "");
  body = body.replace(/^\[[^\]]\]\s+/, "");
  return rawIndent + body;
}

/**
 * Слово человека уходит из зоны значений в свой слот, и когда слот занят
 * (`З-39`): `- [[test1]] :: текст` → `- #high :: [[test1]] текст` —
 * перенесённое встаёт перед написанным. Условия: в левой зоне есть значение,
 * после последнего значения — не значения, перенос не с первого слова
 * (`lastControlIdx >= 0`).
 */
function normalizeLeftTextSpill(options) {
  const opts = options && typeof options === "object" ? options : {};
  const line = String(opts.line || "");
  const rules = opts.rules;
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || line.indexOf(sep1) === -1) return line;

  const seg = splitThreeSegments(line, rules, sep1, sep2);
  const keptText = String(seg.text || "").trim();

  const leftParts = splitLeftDecorators(seg.left);
  const body = String(leftParts.body || "").trim();
  if (!body) return line;
  const tokens = __sharedUtils.lineWords(body);
  if (tokens.length < 2) return line;

  const isControlToken = makeFieldValueTokenTest(rules);

  let lastControlIdx = -1;
  let i;
  for (i = 0; i < tokens.length; i++) {
    if (isControlToken(tokens[i])) lastControlIdx = i;
  }
  if (lastControlIdx < 0 || lastControlIdx >= tokens.length - 1) return line;

  const spill = tokens.slice(lastControlIdx + 1);
  if (!spill.length || spill.some(isControlToken)) return line;
  const controlTokens = tokens.slice(0, lastControlIdx + 1);
  if (!controlTokens.length) return line;

  const nextLeft = joinLeftDecorators(leftParts, controlTokens.join(" "));
  const moved = spill.join(" ").trim();
  if (!moved) return line;
  const nextText = keptText ? moved + " " + keptText : moved;

  let out = nextLeft + " " + sep1;
  out += " " + nextText;
  if (String(seg.dates || "").trim()) out += " " + sep2 + " " + String(seg.dates || "").trim();
  return out.trimEnd();
}

/**
 * Сколько знаков с начала занимает один элемент со значением. Длину решает
 * формат поля (`tailByMarker`, `getDateMarkersFromRules`), не рукописный
 * образец (У-150): `- 12` уходило в значение даты (2026-09-13). Формата нет —
 * метка и одно слово. Ноль и меньше — не наш элемент.
 */
/* Общий вид значения без формата: слово и время через `:`, `-` или `.`. */
const LEGACY_ELEMENT_TAIL_SRC = "\\S+(?:[ ]\\d{2}[-:.]\\d{2}(?:[-:.]\\d{2})?)*";

function markerAnchoredPayloadLength(raw, rules) {
  const payload = String(raw || "").trim();
  if (!payload) return -1;
  const markers = getRightMarkersUnified(rules);
  const tails = (__rulesHelpers.getDateMarkersFromRules(rules) || {}).tailByMarker || {};
  let best = -1;
  let i;
  for (i = 0; i < markers.length; i++) {
    const mk = String(markers[i] || "");
    if (!mk || !payload.startsWith(mk) || payload.length <= mk.length) continue;
    const tail = String(tails[mk] || "").trim();
    /*
     * Формат поля — главный ответ; без полей — общий вид. Альтернативы «две
     * цифры» нет: под неё подходил текст человека `12`.
     */
    const sources = __sharedUtils.elementValueSources(tail, mk)
      .concat(tail ? [] : [LEGACY_ELEMENT_TAIL_SRC]);
    const len = __sharedUtils.longestValueLengthAt(payload, mk.length, sources);
    if (len === null) continue;
    const total = mk.length + len;
    if (total > best) best = total;
  }
  return best;
}

/** Весь кусок целиком — один элемент со значением. */
function hasMarkerAnchoredRightPayload(raw, rules) {
  const payload = String(raw || "").trim();
  if (!payload) return false;
  return markerAnchoredPayloadLength(payload, rules) === payload.length;
}

function stripListDecoratorsForPlainText(raw) {
  let out = String(raw || "").trim();
  out = out.replace(/^\s*(?:[-*+]|\d+[\.)])(?:\s+|$)/, "");
  out = out.replace(/^\s*\[[^\]]\](?:\s+|$)/, "");
  return out.trim();
}

function extractTrailingMarkerPayloadFromText(rawText, rules) {
  const src = String(rawText || "").trim();
  if (!src) return { text: "", payload: "" };
  const parts = __sharedUtils.lineWords(src);
  if (!parts.length) return { text: "", payload: "" };
  let start = -1;
  let i;
  for (i = 0; i < parts.length; i++) {
    const tail = parts.slice(i).join(" ").trim();
    if (hasMarkerAnchoredRightPayload(tail, rules)) {
      start = i;
      break;
    }
  }
  if (start === -1) return { text: src, payload: "" };
  const text = parts.slice(0, start).join(" ").trim();
  const payload = parts.slice(start).join(" ").trim();
  return { text, payload };
}

function startsWithAnyDateMarker(token, rules) {
  const t = String(token || "").trim();
  if (!t) return false;
  const markers = getRightMarkersUnified(rules);
  let i;
  for (i = 0; i < markers.length; i++) {
    const mk = markers[i];
    if (mk && t.startsWith(mk) && t.length > mk.length) return true;
  }
  return false;
}

/**
 * В каком Block стоит поле токена: `panel` проставляет `applyOrderToRules`
 * (PRD 10.13.70). Метка — самая длинная из подошедших. Поле без `panel` —
 * пусто, прежнее поведение.
 */
function panelOfMarkerToken(token, rules) {
  const t = String(token || "").trim();
  if (!t) return "";
  let bestMarker = "";
  let bestPanel = "";
  for (const field of __sharedUtils.ruleFields(rules)) {
    const marker = String((field && field.marker) || "").trim();
    if (!marker || !t.startsWith(marker)) continue;
    if (marker.length <= bestMarker.length) continue;
    bestMarker = marker;
    bestPanel = String((field && field.panel) || "").trim().toLowerCase();
  }
  return bestPanel;
}

function enforceRightPayloadSeparatorInvariant(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rules = opts.rules;
  const rawLine = String(opts.rawLine || "");
  const line = String(opts.line || "");
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  if (!sep1 || line.indexOf(sep1) === -1) return line;

  const seg = splitThreeSegments(line, rules, sep1, sep2);
  let left = String(seg.left || "").trimEnd();
  let text = String(seg.text || "").trim();
  let dates = String(seg.dates || "").trim();

  if (!dates && text) {
    const extracted = extractTrailingMarkerPayloadFromText(text, rules);
    if (extracted.payload) {
      text = extracted.text;
      dates = extracted.payload;
    }
  }

  if (!dates && text && hasMarkerAnchoredRightPayload(text, rules)) {
    dates = text;
    text = "";
  }

  if (!dates && text) {
    const leftParts = splitLeftPrefix(left);
    const leftBody = String(leftParts.body || "").trim();
    const leftTokens = __sharedUtils.lineWords(leftBody);
    const textTokens = __sharedUtils.lineWords(text);
    let markerIdx = -1;
    let i;
    for (i = leftTokens.length - 1; i >= 0; i--) {
      if (startsWithAnyDateMarker(leftTokens[i], rules)) {
        markerIdx = i;
        break;
      }
    }
    if (markerIdx >= 0) {
      /*
       * Склеивается только значение, разорванное разделителем (`YYYY-MM-DD
       * hh:mm`, PRD 10.13.71): если формат дотягивается дальше того, что слева.
       * Целое значение слева — значит за разделителем текст человека (`- 12`).
       */
      const leftTail = leftTokens.slice(markerIdx).join(" ").trim();
      const candidate = leftTokens.slice(markerIdx).concat(textTokens).join(" ").trim();
      const reach = markerAnchoredPayloadLength(candidate, rules);
      if (reach > leftTail.length) {
        dates = candidate.slice(0, reach).trim();
        text = candidate.slice(reach).trim();
        left = joinLeftPrefix(leftParts.prefix, leftTokens.slice(0, markerIdx).join(" ").trim());
      }
    }
  }

  if (!dates && !text) {
    const leftParts = splitLeftPrefix(left);
    const leftBody = String(leftParts.body || "").trim();
    if (leftBody) {
      const extractedLeft = extractTrailingMarkerPayloadFromText(leftBody, rules);
      /*
       * Значение, которому по Order место слева, вправо не уезжает (2026-09-12).
       * Уборка ищет значение целиком во всех трёх сегментах (10.13.72), поэтому
       * запрет снова безопасен (10.13.70).
       */
      /*
       * Запрет уносить вправо левую по Order метку снят 2026-09-12: перенос
       * входит в уборку старого значения (PRD 10.13.70). Правильное место — где
       * движок ищет старое значение.
       */
      if (extractedLeft.payload && panelOfMarkerToken(extractedLeft.payload, rules) !== "left") {
        dates = extractedLeft.payload;
        left = joinLeftPrefix(leftParts.prefix, extractedLeft.text || "");
      }
    }
  }
  if (!dates) return line;

  const rawPlain = stripListDecoratorsForPlainText(rawLine);
  if (rawPlain) {
    const doubled = rawPlain + " " + rawPlain;
    const leftPlain = stripListDecoratorsForPlainText(left);
    if (leftPlain === doubled) {
      const prefix = splitLeftPrefix(left).prefix;
      left = joinLeftPrefix(prefix, rawPlain);
    }
    /*
     * Спрашивается удвоенный текст, а не зона: при совпадающих разделителях
     * `- 11 11 :: ➕…` делится домом иначе (У-177).
     */
    if (stripListDecoratorsForPlainText(text) === doubled) text = rawPlain;
  }

  const indent = String(seg.indent || "");
  const baseLeft = String(left || "").trim() || "-";
  if (text || dates) {
    /* Признак «значения или текст» и пустой слот — в `joinLineParts` (10.13.34, 10.13.68). */
    return __linePipeline.joinLineParts({ indent, left: baseLeft, text, dates }, {
      sep1,
      sep2,
      hasLeftTokens: __linePipeline.hasFieldTokens(baseLeft, __linePipeline.fieldsShape(rules)),
    });
  }
  return line;
}

function applyFinalLineInvariants(options) {
  const opts = options && typeof options === "object" ? options : {};
  const rawLine = String(opts.rawLine || "");
  const rules = opts.rules;
  const mode = String(opts.mode || "off").trim().toLowerCase();
  let out = String(opts.line || "");
  out = enforceSourcePrefixInvariant(rawLine, out);
  out = normalizeLeftTextSpill({ line: out, rules });
  out = enforceRightPayloadSeparatorInvariant({ rawLine, line: out, rules });
  out = normalizeStructuredSlots({ rawLine, line: out, rules, mode });
  out = normalizeSeparatorTopology(out, rules);
  out = enforceSourcePrefixInvariant(rawLine, out);
  out = stripSyntheticPrefixForPlainSource(rawLine, out);
  return out;
}

function applyCycleEndPostProcessing(options) {
  const opts = options && typeof options === "object" ? options : {};
  const parseLine = typeof opts.parseLine === "function" ? opts.parseLine : function noParse() { return {}; };
  const isBulletLike = typeof opts.isBulletLikeEmptyResult === "function"
    ? opts.isBulletLikeEmptyResult
    : function noBullet() { return false; };
  const isOrphanCheckbox = typeof opts.isOrphanCheckboxBulletLine === "function"
    ? opts.isOrphanCheckboxBulletLine
    : function noOrphan() { return false; };
  const buildBullet = typeof opts.buildBulletOnlyLine === "function"
    ? opts.buildBulletOnlyLine
    : function noBuild() { return "- "; };
  const stripPrefixKeepIndent = typeof opts.stripPrefixKeepIndent === "function"
    ? opts.stripPrefixKeepIndent
    : null;
  const shouldClearToEmptyLine = typeof opts.shouldClearToEmptyLine === "function"
    ? opts.shouldClearToEmptyLine
    : function defaultShouldClear() { return false; };
  const shouldKeepBulletLine = typeof opts.shouldKeepBulletLine === "function"
    ? opts.shouldKeepBulletLine
    : function defaultKeepBulletLine(line) {
      return /^\s*(?:[-*+]|\d+[\.\)])\s*$/.test(String(line || ""));
    };
  const isNoContent = typeof opts.isNoContentParsed === "function"
    ? opts.isNoContentParsed
    : function defaultNoContent(parsed) {
      if (!parsed || parsed.headingToken) return false;
      const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
      if (tags.length) return false;
      if (String(parsed.text || "").trim()) return false;
      if (String(parsed.dates || "").trim()) return false;
      return true;
    };
  const parsedLine = opts.parsedLine;
  const rules = opts.rules;
  const cycleEndRaw = String(opts.cycleEndBehavior || "").trim().toLowerCase();
  const cycleEndBehavior = (
    cycleEndRaw === "clear-prefix"
    || cycleEndRaw === "off"
    || cycleEndRaw === "of"
    || cycleEndRaw === "none"
    || cycleEndRaw.indexOf("clear") !== -1
    || cycleEndRaw.indexOf("empty") !== -1
  )
    ? "clear-prefix"
    : "keep-bullet";
  let finalLine = String(opts.finalLine || "");
  let parsedAfter = parseLine(finalLine, rules);

  /* Разделитель — из настроек (У-186). Образец — внутри ветки: без разделителей
     дом отказывает вслух, а «конец круга не трогаем» отказа не заслуживает. */
  const onlyBulletAndSeparators = () => new RegExp(
    "^-\\s*(?:" + __sharedUtils.separatorAltSrc(rules, "pkm_line_finalize_unified") + "\\s*)*$"
  );
  if (cycleEndBehavior === "clear-prefix" && onlyBulletAndSeparators().test(String(finalLine || "").trim())) {
    finalLine = "";
    parsedAfter = parseLine(finalLine, rules);
  }

  /*
   * `Clear line` чистит только опустевшую строку (BUGHUNT F15 = S14): начало
   * строки — человека (`В-239`); знак плагина снимает
   * `stripPrefixWhenSourceHasNoPrefix` ниже.
   */
  if (cycleEndBehavior === "clear-prefix" && shouldClearToEmptyLine(finalLine, parsedAfter)) {
    finalLine = "";
    parsedAfter = parseLine(finalLine, rules);
  }

  if (
    cycleEndBehavior === "clear-prefix"
    && opts.stripPrefixWhenSourceHasNoPrefix === true
    && !opts.sourceHasPrefix
    && (!Array.isArray(parsedAfter && parsedAfter.tags) || !parsedAfter.tags.length)
    && !String(parsedAfter && parsedAfter.dates ? parsedAfter.dates : "").trim()
    && stripPrefixKeepIndent
  ) {
    /* У источника знака не было — чекбокс поставил плагин: снимается весь знак (BUGHUNT F15). */
    finalLine = stripPrefixKeepIndent(finalLine, true);
    parsedAfter = parseLine(finalLine, rules);
  }

  if (opts.enforceNoContentFinalization === true && isNoContent(parsedAfter)) {
    finalLine = cycleEndBehavior === "clear-prefix" ? "" : buildBullet(parsedLine);
    parsedAfter = parseLine(finalLine, rules);
  }

  if (isBulletLike(finalLine, parsedAfter, rules) || isOrphanCheckbox(finalLine)) {
    finalLine = cycleEndBehavior === "clear-prefix" ? "" : buildBullet(parsedLine);
    parsedAfter = parseLine(finalLine, rules);
  }

  const applyKeepBullet = cycleEndBehavior !== "clear-prefix" && shouldKeepBulletLine(finalLine);

  return { finalLine, parsedAfter, cycleEndBehavior, applyKeepBullet };
}

function applyTrailingSeparatorPolicy(options) {
  const opts = options && typeof options === "object" ? options : {};
  const ensureTrailing = typeof opts.ensureTrailingSeparatorSpace === "function"
    ? opts.ensureTrailingSeparatorSpace
    : null;
  const freeRoamMode = String(opts.freeRoamMode || "off").trim().toLowerCase();
  const mixedMinimalSeparatorOff = opts.mixedMinimalSeparatorOff === true;
  const skipNormalization = opts.skipNormalization === true;
  const line = String(opts.line || "");
  const rules = opts.rules;
  const parsedFinal = opts.parsedFinal;
  if (!ensureTrailing) return line;
  if (skipNormalization) return line;
  if (freeRoamMode === "full" || mixedMinimalSeparatorOff) return line;
  return ensureTrailing(line, rules, parsedFinal);
}

function resolveMixedSelectionPolicy(selectedEntries, freeRoamBehavior) {
  const entries = Array.isArray(selectedEntries) ? selectedEntries : [];
  const fr = freeRoamBehavior && typeof freeRoamBehavior === "object" ? freeRoamBehavior : {};
  const hasOffSelected = entries.some((e) => e && e.mode === "off");
  const hasFullSelected = entries.some((e) => e && e.mode === "full");
  const hasMinimalSelected = entries.some((e) => e && e.mode === "minimal");
  const isMinimalOnlySelected = hasMinimalSelected && !hasOffSelected && !hasFullSelected;
  const minimalPrefixIgnoreFieldIds = {};
  if (fr.minimalPrefix === false && hasMinimalSelected) {
    entries.forEach((e) => {
      if (!e || e.mode !== "minimal") return;
      const fid = String(e.id || "").trim();
      if (!fid) return;
      minimalPrefixIgnoreFieldIds[fid] = true;
    });
  }
  return {
    hasOffSelected,
    hasFullSelected,
    hasMinimalSelected,
    isMinimalOnlySelected,
    applyMinimalSeparatorCollapse: hasMinimalSelected && !hasFullSelected && fr.minimalSeparator === false,
    applyMinimalPrefixPreserve: isMinimalOnlySelected && fr.minimalPrefix === false,
    minimalPrefixIgnoreFieldIds,
  };
}

function resolveEffectiveSelectionPolicy(options) {
  const opts = options && typeof options === "object" ? options : {};
  const selectedEntries = Array.isArray(opts.selectedEntries) ? opts.selectedEntries : [];
  const freeRoamBehavior = opts.freeRoamBehavior && typeof opts.freeRoamBehavior === "object"
    ? opts.freeRoamBehavior
    : {};
  const activeModeRaw = String(opts.activeMode || "").trim().toLowerCase();
  const activeMode = (activeModeRaw === "off" || activeModeRaw === "minimal" || activeModeRaw === "full")
    ? activeModeRaw
    : "";
  const entries = selectedEntries.slice();
  if (activeMode) {
    const hasMode = entries.some((e) => e && String(e.mode || "").trim().toLowerCase() === activeMode);
    if (!hasMode) entries.push({ id: "__active__", mode: activeMode });
  }
  return resolveMixedSelectionPolicy(entries, freeRoamBehavior);
}

function resolveOffPrefixFlagsUnified(options) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = String(opts.mode || "off").trim().toLowerCase();
  const hasOwnCheckbox = opts.hasOwnCheckbox === true;
  const clearedOwnCheckbox = opts.clearedOwnCheckbox === true;
  const freeRoamBehavior = opts.freeRoamBehavior && typeof opts.freeRoamBehavior === "object"
    ? opts.freeRoamBehavior
    : {};

  /*
   * `Insert only` + `use Field Prefix`: чекбокс человека остаётся, когда у Value
   * своего нет (BUGHUNT 2026-09-30, E2). Неизменность строки — только у `Strict`.
   */
  if (mode === "minimal") {
    return { preserveCheckboxPrefix: !hasOwnCheckbox && !clearedOwnCheckbox, forceBulletPrefix: false, preserveOffImmutability: false };
  }
  if (mode !== "off") {
    return { preserveCheckboxPrefix: false, forceBulletPrefix: false, preserveOffImmutability: false };
  }
  if (hasOwnCheckbox) {
    return { preserveCheckboxPrefix: false, forceBulletPrefix: false, preserveOffImmutability: false };
  }
  if (clearedOwnCheckbox) {
    return { preserveCheckboxPrefix: false, forceBulletPrefix: true, preserveOffImmutability: false };
  }
  /*
   * `Strict: add a bullet` — «добавить, когда нечего», а не «заменить»
   * (10.13.92): знак ставится только строке без начала, `- [ ] test` не трогается.
   */
  const offPrefixOn = !!(freeRoamBehavior && freeRoamBehavior.offPrefix === true);
  if (offPrefixOn) {
    return { preserveCheckboxPrefix: true, forceBulletPrefix: true, preserveOffImmutability: false };
  }
  return { preserveCheckboxPrefix: true, forceBulletPrefix: false, preserveOffImmutability: true };
}

/**
 * Вернуть пустой слот текста (10.13.34), если склейка префикса его схлопнула
 * (`-  :: 👤111` → `- :: 👤111`, 2026-09-12). Пересобирается тем же сборщиком
 * только строка с пустым текстом и непустым правым Block.
 */
function restoreEmptyTextSlot(line, rules) {
  const io = rules && typeof rules.io === "object" && !Array.isArray(rules.io) ? rules.io : null;
  if (!io) return line;
  const seg = __linePipeline.splitSegments(line, rules);
  if (!String(seg && seg.dates ? seg.dates : "").trim()) return line;
  if (String(seg && seg.text ? seg.text : "").trim()) return line;
  return __linePipeline.buildFromSegments(seg, rules);
}

function enforceOffModeFinalPrefixUnified(options) {
  const opts = options && typeof options === "object" ? options : {};
  const mode = String(opts.mode || "off").trim().toLowerCase();
  const line = String(opts.line || "");
  const rawLine = String(opts.rawLine || "");
  if (mode !== "off" || /^\s*#{1,6}\s+/.test(rawLine)) return line;
  if (String(opts.cycleEndBehavior || "").trim().toLowerCase() === "clear-prefix" && typeof opts.parseLine === "function") {
    const parsed = opts.parseLine(line, opts.rules);
    const tags = Array.isArray(parsed && parsed.tags) ? parsed.tags : [];
    const dates = String(parsed && parsed.dates ? parsed.dates : "").trim();
    const text = String(parsed && parsed.text ? parsed.text : "").trim();
    if (!tags.length && !dates && text) return line;
    /* Очищенная `Clear line` строка знак списка не получает (`В-260`). */
    if (!tags.length && !dates && !text && !hasListPrefix(line)) return line;
  }
  const flags = resolveOffPrefixFlagsUnified(opts);
  if (opts.preserveSyntheticPrefix === true) {
    if (hasListPrefix(line)) return line;
    const prefix = String(opts.resolvedPrefix || "").trim();
    if (!prefix) return line;
    const outer = __sharedUtils.lineStartOf(line);
    if (outer.quote) return line;
    const indent = outer.indent;
    const body = line.slice(indent.length).trimStart();
    return restoreEmptyTextSlot(`${indent}${prefix}${body ? " " + body : ""}`, opts.rules);
  }
  if (flags.preserveOffImmutability && !hasListPrefix(rawLine)) {
    return removeSyntheticLeadingPrefix(line);
  }
  if (hasListPrefix(line)) return line;
  const resolvedPrefix = String(opts.resolvedPrefix || "").trim();
  const fallbackPrefix = resolvedPrefix || (opts.hasOwnCheckbox === true ? "- [ ]" : (flags.forceBulletPrefix ? "-" : ""));
  if (!fallbackPrefix) return line;
  /* Отступ, цитата, каллаут — впереди; наш знак за ними, внутри цитаты — нет (В-115). */
  const outer = __sharedUtils.lineStartOf(line);
  if (outer.quote) return line;
  const indent = outer.indent;
  const body = line.slice(indent.length).trimStart();
  return restoreEmptyTextSlot(`${indent}${fallbackPrefix}${body ? " " + body : ""}`, opts.rules);
}

module.exports = {
  normalizeCheckboxToken,
  /* «Наше значение или слово человека» — дом на весь рантайм (и `pkm_macro_shared.js`). */
  makeFieldValueTokenTest,
  /* Наружу — чтобы расхождение объявлений меток мерил `node tools/form_divergence.js`. */
  getRightMarkersUnified,
  getPrefixRulesUnified,
  selectedTokenByFieldIdUnified,
  checkboxBelongsToFieldUnified,
  checkboxLeavesWithValueUnified,
  fieldHasAnyCheckboxRuleUnified,
  resolvePrefixCheckboxUnified,
  buildPrefixUnified,
  hasListPrefix,
  hasStandaloneCheckboxPrefix,
  hasCheckboxListPrefix,
  extractOriginalPrefix,
  reapplyOriginalPrefix,
  preserveOriginalPrefixShape,
  removeSyntheticLeadingPrefix,
  removeStandaloneHeadingMarkers,
  applyPrefixPolicy,
  applyResolvedPrefixToLine,
  restoreEmptyTextSlotAfterPrefix,
  applyModePrefixImmutability,
  applyMixedPostPolicies,
  normalizeSeparatorTopology,
  hasAnySeparator,
  normalizeSingleSeparatorLayout,
  removeConfiguredSeparators,
  stripTrailingConfiguredSeparators,
  normalizeMinimalOffFinalLine,
  normalizeMinimalPriorityNoSeparatorLine,
  alignMinimalNoSeparatorPrefix,
  relocateOffEntriesToRightPanel,
  applyFullNoSourceNormalization,
  applyOffSelectionPostPolicies,
  applyUnifiedPostFinalize,
  applyCycleEndAndInvariants,
  isSimplePlainRaw,
  normalizeStructuredSlots,
  applyFinalLineInvariants,
  panelOfMarkerToken,
  reflowNoContentPanelLine,
  composeMinimalHeadingLine,
  applyMinimalSelectionNormalization,
  collapseEmptyLeftSeparatorToText,
  normalizeFullTagLineByEntries,
  removeTokenWholeLine,
  insertTokenAtIndex,
  resolveInsertIndexByPlacement,
  resolveCursorByPolicy,
  applyCycleEndPostProcessing,
  applyTrailingSeparatorPolicy,
  resolveMixedSelectionPolicy,
  resolveEffectiveSelectionPolicy,
  resolveOffPrefixFlagsUnified,
  enforceOffModeFinalPrefixUnified,
};
