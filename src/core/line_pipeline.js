"use strict";

const __sharedUtils = require("./shared_utils.js");
/* Ссылка — значение поля или слово человека: общий дом (В-141). */
const __helpers = require("./pkm_rules_runtime_helpers.js");

function resolveSeparatorsOrThrow(rules) {
  /* Правило в общем доме; имя звавшего попадает в текст отказа. */
  return __sharedUtils.resolveSeparatorsOrThrow(rules, "line_pipeline");
}

/** Поля одной стороны Order: левый Block или правый. */
function sideFields(rules, side) {
  const node = rules && rules[side === "left" ? "leftMode" : "rightMode"];
  return Array.isArray(node && node.fields) ? node.fields : [];
}

/* Маркеры элементов названной стороны (2026-09-11: сторона не зашита). */
function markersOfSide(rules, side) {
  const out = [];
  const seen = new Set();
  const behavior = rules && typeof rules.behavior === "object" && !Array.isArray(rules.behavior)
    ? rules.behavior
    : {};
  const dateRuntimeCfg = behavior && typeof behavior.dateRuntimeConfig === "object" && !Array.isArray(behavior.dateRuntimeConfig)
    ? behavior.dateRuntimeConfig
    : {};
  const byField = dateRuntimeCfg && typeof dateRuntimeCfg.byField === "object" && !Array.isArray(dateRuntimeCfg.byField)
    ? dateRuntimeCfg.byField
    : {};
  const canonical = dateRuntimeCfg && typeof dateRuntimeCfg.canonical === "object" && !Array.isArray(dateRuntimeCfg.canonical)
    ? dateRuntimeCfg.canonical
    : {};
  const fields = sideFields(rules, side);
  function pushMarker(raw) {
    const mk = String(raw || "").trim();
    if (!mk || seen.has(mk)) return;
    seen.add(mk);
    out.push(mk);
  }
  function markerFromRuntimeCfg(field) {
    const keys = [];
    function pushKey(raw) {
      const key = String(raw || "").trim();
      if (!key || keys.indexOf(key) !== -1) return;
      keys.push(key);
    }
    const fieldId = String(field && field.id || "").trim();
    const orderKey = String(field && field.orderKey || "").trim();
    pushKey(orderKey);
    pushKey(fieldId);
    for (const cKey of Object.keys(canonical)) {
      const cVal = String(canonical[cKey] || "").trim();
      if (!cVal) continue;
      if (cVal === fieldId || cVal === orderKey) {
        pushKey(cKey);
        pushKey(cVal);
      }
    }
    for (let i = 0; i < keys.length; i++) {
      const row = byField && byField[keys[i]] && typeof byField[keys[i]] === "object" ? byField[keys[i]] : null;
      if (!row) continue;
      const marker = String(row.emoji || row.marker || "").trim();
      if (marker) return marker;
    }
    return "";
  }
  for (const f of fields) {
    const mk = String(f && f.marker ? f.marker : "").trim() || markerFromRuntimeCfg(f);
    pushMarker(mk);
  }
  return out;
}

function getRightMarkers(rules) {
  return markersOfSide(rules, "right");
}

/*
 * Метки элементов, которым место в правом Block — по Order (`f.panel`), а не
 * по списку правил, где поле объявлено (`S12`, 10.13.73). Без пометки Block —
 * сторона своего списка.
 */
function markersPlacedInRightBlock(rules) {
  const out = [];
  const seen = new Set();
  const sides = [["left", sideFields(rules, "left")], ["right", sideFields(rules, "right")]];
  for (const [side, fields] of sides) {
    for (const f of fields) {
      const panel = String(f && f.panel ? f.panel : "").trim().toLowerCase();
      const placed = panel === "left" || panel === "right" ? panel : side;
      if (placed !== "right") continue;
      const marker = String(f && f.marker ? f.marker : "").trim();
      if (!marker || seen.has(marker)) continue;
      seen.add(marker);
      out.push(marker);
    }
  }
  /* Метка из конфига элементов, а не из поля. */
  for (const mk of markersOfSide(rules, "right")) {
    const owner = sideFields(rules, "right").filter((f) => String(f && f.marker ? f.marker : "").trim() === mk)[0];
    if (owner) continue;
    if (seen.has(mk)) continue;
    seen.add(mk);
    out.push(mk);
  }
  return out;
}

/**
 * Форма Fields: что в строке значение Field, а что текст. Сторона Order тут ни
 * при чём (2026-09-11): только что перенесённое значение список стороны ещё не
 * знает, поэтому `markers` — обеих сторон, `values` — значения целиком для
 * Field без префикса (дополняют признак по виду, не заменяют). Тег
 * спрашивается в `hasFieldTokens`; ссылка — значение, только если названа им
 * (`isLink`, В-141).
 */
function fieldsShape(rules) {
  const fields = sideFields(rules, "left").concat(sideFields(rules, "right"));
  const values = new Set();
  for (const f of fields) {
    const prefix = String(f && f.prefix != null ? f.prefix : "").trim();
    const list = Array.isArray(f && f.values) ? f.values : [];
    for (const v of list) {
      const raw = typeof v === "string" ? v : (v && typeof v.token === "string" ? v.token : "");
      const token = String(raw || "").trim();
      if (!token) continue;
      values.add(prefix ? prefix + token : token);
    }
  }
  const markers = markersOfSide(rules, "left").slice();
  for (const mk of markersOfSide(rules, "right")) {
    if (markers.indexOf(mk) === -1) markers.push(mk);
  }
  /* Один раз на разбор строки, не на токен. */
  return {
    markers: markers,
    values: values,
    isLink: __helpers.makeWikilinkValueTest(rules),
    stayText: __sharedUtils.typedTagsStayText(rules),
    own: fieldValueTest(rules),
  };
}

/** Value поля в виде строки: тег с решёткой и без (`##high`, У-290) и ссылка-Value. */
function fieldValueTest(rules) {
  const tokens = new Set(Object.keys(__helpers.buildTagTokenKeyMap(rules) || {}));
  for (const t of collectManagedTokens(rules)) tokens.add(t);
  const isLink = __helpers.makeWikilinkValueTest(rules);
  return function(t) { return tokens.has(t) || isLink(t); };
}

/** Есть ли в теле хоть одно значение Field. */
function hasFieldTokens(body, shape) {
  /* Знак начала строки снимается внутри вопроса, а не у спрашивающего: `##`
     заголовка подходит под образец тега (У-159, У-177, У-157). */
  const src = splitLeftPrefix(String(body || "")).body;
  if (!src) return false;
  /* Тег — значение Field при любой раскладке Order; сторону не спрашивать
     (block_placement_tests). Форма тега — общий дом (10.13.141). */
  if (new RegExp("(^|\\s)" + __sharedUtils.TAG_TOKEN_SRC).test(src)) return true;
  const tokens = __sharedUtils.lineWords(src);
  const isLink = shape && typeof shape.isLink === "function" ? shape.isLink : null;
  for (const t of tokens) {
    /* Ссылка — значение, только если названа им (В-141). */
    if (isLink && isLink(t)) return true;
    if (startsWithAnyMarker(t, shape.markers)) return true;
    if (shape.values.has(t)) return true;
  }
  return false;
}

function startsWithAnyMarker(token, markers) {
  const t = String(token || "");
  if (!t) return false;
  for (const mk of markers) {
    if (!mk) continue;
    if (t.startsWith(mk) && t.length > mk.length) return true;
  }
  return false;
}

/* Образец голой даты — общий модуль (10.13.71). */
function isDateLikeBareToken(token) {
  const t = String(token || "");
  if (!t) return false;
  return new RegExp("^(?:" + __sharedUtils.DATE_LIKE_VALUE_SRC + ")$", "u").test(t);
}

/**
 * Стоит ли за разделителем значение Block, а не слово человека. Ссылка — по
 * имени (`shape.isLink`, В-141), без формы — по виду.
 */
function isLikelyRightPayloadToken(token, markers, shape) {
  const t = String(token || "");
  if (!t) return false;
  if (__sharedUtils.isTagToken(t)) return true;
  const isLink = shape && typeof shape.isLink === "function" ? shape.isLink : null;
  if (isLink ? isLink(t) : __sharedUtils.isWikilinkToken(t)) return true;
  if (startsWithAnyMarker(t, markers)) return true;
  if (isDateLikeBareToken(t)) return true;
  return false;
}

function isLikelyDatePayloadContinuationToken(token) {
  const t = String(token || "");
  if (!t) return false;
  if (/^\d{2}[-:]\d{2}(?:[-:]\d{2})?$/.test(t)) return true;
  if (/^\d{2}$/.test(t)) return true;
  return false;
}

function stripListPrefixForBody(rawLeft) {
  /* Начало строки — общее объявление (В-114). */
  return String(__sharedUtils.lineStartOf(String(rawLeft || "").trim()).body || "").trim();
}

function isPlainTextSegmentToken(token) {
  var t = String(token || "").trim();
  if (!t) return false;
  if (__sharedUtils.isTagToken(t)) return false;
  if (__sharedUtils.isWikilinkToken(t)) return false;
  return true;
}

function hasRightPayloadInvariantShape(dates, markers) {
  var payload = String(dates || "").trim();
  if (!payload) return false;
  var parts = __sharedUtils.lineWords(payload);
  if (!parts.length) return false;
  if (startsWithAnyMarker(parts[0], markers)) return true;
  return parts.every(function(tok) {
    return isDateLikeBareToken(tok) || isLikelyDatePayloadContinuationToken(tok);
  });
}

function collapseDuplicateTextForRightPayload(seg, markers) {
  var left = String(seg && seg.left ? seg.left : "").trim();
  var text = String(seg && seg.text ? seg.text : "").trim();
  var dates = String(seg && seg.dates ? seg.dates : "").trim();
  if (!left || !text || !dates) return text;
  if (!hasRightPayloadInvariantShape(dates, markers)) return text;
  var textTokens = __sharedUtils.lineWords(text);
  if (!textTokens.length) return text;
  if (!textTokens.every(isPlainTextSegmentToken)) return text;
  var leftBody = stripListPrefixForBody(left);
  if (!leftBody) return text;
  var leftTokens = __sharedUtils.lineWords(leftBody);
  if (leftTokens.length < textTokens.length) return text;
  var leftTail = leftTokens.slice(leftTokens.length - textTokens.length).join(" ");
  if (leftTail !== text) return text;
  return "";
}

function isMarkerAnchoredDatePayloadTokens(tokens, markers) {
  const list = Array.isArray(tokens) ? tokens : [];
  if (!list.length) return false;
  const first = String(list[0] || "");
  if (!startsWithAnyMarker(first, markers)) return false;
  if (list.length === 1) return true;
  for (let i = 1; i < list.length; i++) {
    const t = String(list[i] || "");
    if (!isLikelyDatePayloadContinuationToken(t)) return false;
  }
  return true;
}

/*
 * Похоже ли левое на токены, а не на текст (Н-6, Н-8, четвёртое исключение
 * из З3): без этого `- [ ] 111 || #todo` давал left=`- [ ] 111`, и значение,
 * дописанное в Left Block, склеивалось с текстом. Тот же признак, что
 * `hasLeftTech` в `buildFromSegments`.
 */
function looksLikeLeftTokens(body, shape) {
  return hasFieldTokens(body, shape);
}

/**
 * Развести левый сегмент и текст, когда токенов слева нет; знак списка
 * остаётся слева. Только у строк со знаком списка: на пустом левом
 * `buildFromSegments` подставит `-`, и строка получила бы чужой список.
 */
function demoteLeftBodyToText(leftRaw, shape, noFirstSeparator) {
  const parts = splitLeftPrefix(leftRaw);
  if (!parts.prefix || !parts.body) return null;
  if (!looksLikeLeftTokens(parts.body, shape)) return { left: parts.prefix, text: parts.body };
  /* Первый разделитель есть — граница там; слово внутри зоны значений доводит
     `normalizeStructuredSlots`, ей нужен пустой слот текста. */
  if (!noFirstSeparator) return null;
  /*
   * Block — только значения подряд в начале тела, с первого слова текста —
   * текст (`В-211`, 10.13.265). Значение Field посреди и в конце текста —
   * слово человека (`В-235`, `В-249`); голое Value из списка узнаёт только
   * список.
   */
  const words = __sharedUtils.lineWords(parts.body);
  const rest = stripLeadingRun(parts.body, shape.markers, shape.values);
  if (!rest) return null;
  const head = words.slice(0, words.length - __sharedUtils.lineWords(rest).length).join(" ");
  if (!shape.stayText) {
    /* Выключенный `Keep typed tags in text`: Value поля из текста уезжает в Block. */
    const restWords = __sharedUtils.lineWords(rest);
    const text = restWords.filter(function(t) { return !shape.own(t); });
    if (!text.length) return null;
    const moved = restWords.filter(function(t) { return shape.own(t); });
    return { left: joinLeftPrefix(parts.prefix, [head].concat(moved).filter(Boolean).join(" ")), text: text.join(" ") };
  }
  return { left: joinLeftPrefix(parts.prefix, head), text: rest };
}

function splitSegments(rawLine, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const raw = String(rawLine || "");
  /* Цитата и каллаут — внешнее оформление: снимаются вместе с отступом и
     возвращаются тем же `indent` (10.13.118, В-115). */
  const outer = __sharedUtils.lineStartOf(raw);
  const indent = outer.indent + outer.quote + outer.callout;
  const s = raw.slice(indent.length).trim();
  const markers = getRightMarkers(rules);
  const shape = fieldsShape(rules);

  if (sep1 === sep2) {
    const parts = s.split(sep1).map(function(x) { return String(x || "").trim(); });
    if (parts.length <= 1) {
      const demoted = demoteLeftBodyToText(s, shape, true);
      if (demoted) return { indent: indent, left: demoted.left, text: demoted.text, dates: "" };
      return { indent: indent, left: s, text: "", dates: "" };
    }
    if (parts.length === 2) {
      let textOnly = parts[1] || "";
      let rightOnly = "";
      if (textOnly) {
        const tokens = __sharedUtils.lineWords(textOnly);
        const isRightPayload = (tokens.length > 0
          && tokens.every(function(t) {
            return isLikelyRightPayloadToken(t, markers, shape);
          }))
          || isMarkerAnchoredDatePayloadTokens(tokens, markers);
        if (isRightPayload) {
          rightOnly = textOnly;
          textOnly = "";
        }
      }
      /* Текста нет, а слева — не токены: значит слева и есть текст. */
      if (!textOnly) {
        /* За разделителем правый Block — это второй разделитель (`В-211`). */
        const demoted = demoteLeftBodyToText(parts[0] || "", shape, Boolean(rightOnly));
        if (demoted) return { indent: indent, left: demoted.left, text: demoted.text, dates: rightOnly };
      }
      return { indent: indent, left: parts[0] || "", text: textOnly, dates: rightOnly };
    }
    return {
      indent: indent,
      left: parts[0] || "",
      text: parts[1] || "",
      dates: parts.slice(2).join(" ").trim(),
    };
  }

  /* Первого разделителя нет, а второй есть: зоны тегов нет (2026-09-11). */
  const i1 = s.indexOf(sep1);
  if (i1 === -1 && sep2 && sep2 !== sep1) {
    const j = s.indexOf(sep2);
    if (j !== -1) {
      const head = String(s.slice(0, j) || "").trim();
      const tail = String(s.slice(j + sep2.length) || "").trim();
      /* Слева значения Field — зона тегов без текста. Спрашивается тело, а не
         голова: `##` заголовка подходит под образец тега (10.13.94). */
      const headParts = splitLeftPrefix(head);
      if (looksLikeLeftTokens(headParts.body, shape)) {
        /* Значение посреди текста — как у строки без разделителей (`В-211`). */
        const demoted = demoteLeftBodyToText(head, shape, true);
        if (demoted) return { indent: indent, left: demoted.left, text: demoted.text, dates: tail };
        return { indent: indent, left: head, text: "", dates: tail };
      }
      /* `:: 👤111`: перед вторым разделителем пусто. Без этой ветки вся строка
         с разделителем уходила в левое, и каждый круг дописывал `::`
         (2026-09-12). Знак списка подставит сборка. */
      if (!head) {
        return { indent: indent, left: "", text: "", dates: tail };
      }
      /* Без знака списка слева текст: то же накопление `::` (2026-09-12);
         знак подставит сборка, если настройка разрешает. */
      const parts = splitLeftPrefix(head);
      return { indent: indent, left: parts.prefix, text: parts.body, dates: tail };
    }
  }
  let left = i1 === -1 ? s : s.slice(0, i1).trim();
  const after1 = i1 === -1 ? "" : s.slice(i1 + sep1.length).trim();
  const i2 = after1.indexOf(sep2);
  let text = i2 === -1 ? after1.trim() : after1.slice(0, i2).trim();
  let dates = i2 === -1 ? "" : after1.slice(i2 + sep2.length).trim();

  if (i2 === -1 && text) {
    const parts = __sharedUtils.lineWords(text);
    const isRightPayload = (parts.length > 0
      && parts.every(function(t) {
        return isLikelyRightPayloadToken(t, markers, shape);
      }))
      || isMarkerAnchoredDatePayloadTokens(parts, markers);
    if (isRightPayload) {
      dates = text;
      text = "";
    }
  }

  /* Текста нет, слева не токены — слева текст. */
  if (!text) {
    const demoted = demoteLeftBodyToText(left, shape, i1 === -1);
    if (demoted) {
      left = demoted.left;
      text = demoted.text;
    }
  }

  return { indent: indent, left: left, text: text, dates: dates };
}

function buildFromSegments(seg, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const indent = String(seg && seg.indent ? seg.indent : "");
  let left = String(seg && seg.left ? seg.left : "").trim();
  let text = String(seg && seg.text ? seg.text : "").trim();
  const dates = String(seg && seg.dates ? seg.dates : "").trim();
  const markers = getRightMarkers(rules);
  /* Внутри цитаты нашего знака списка нет (В-115, `S41`). */
  const outerQuote = String(__sharedUtils.lineStartOf(indent).quote || "");

  if (!left && !outerQuote) left = "-";
  /* Есть ли слева значение Field — один признак (У-32), и спрашивается тело,
     а не сегмент: `##` заголовка подходит под образец тега (10.13.94). */
  const leftParts = splitLeftPrefix(left);
  const hasLeftTech = hasFieldTokens(leftParts.body, fieldsShape(rules));
  if (hasLeftTech && !leftParts.prefix && !outerQuote) {
    left = ("- " + left).trim();
  }

  if (dates) {
    text = collapseDuplicateTextForRightPayload({ left: left, text: text, dates: dates }, markers);
  }

  /* Без зоны тегов правый Block отделяется вторым разделителем (2026-09-11). */
  if (dates || text) {
    return joinLineParts({ indent: indent, left: left, text: text, dates: dates },
      { sep1: sep1, sep2: sep2, hasLeftTokens: hasLeftTech });
  }
  if (hasLeftTech) return indent + left + " " + sep1 + " ";

  /*
   * Осталось одно начало строки — знак списка и заголовка сохраняет пробел:
   * у Obsidian знак списка — знак и пробел (`([*+-] |(\d+)([.)] ))` в `app.js`),
   * `-` без пробела — текст; так же решётки заголовка (10.13.155, У-157, У-91,
   * У-185). Цитата и каллаут едут отступом.
   */
  const startOnly = __sharedUtils.lineStartOf(left);
  if ((startOnly.marker || startOnly.heading) && !startOnly.body) return indent + left + " ";
  return indent + left;
}

/** В левом сегменте только начало строки; спрашивается `splitLeftPrefix` (10.13.106, 10.13.107). */
function isBareLinePrefix(left) {
  const src = String(left || "").trim();
  if (!src) return false;
  const parts = splitLeftPrefix(src);
  return !!parts.prefix && !String(parts.body || "").trim();
}

/**
 * Единственное объявление того, чем разделены зоны строки (У-150): зона
 * значений слева — за ней первый разделитель; текст пуст, а справа есть —
 * пустой слот в два пробела (10.13.34); зоны значений нет — правый Block
 * отделяется вторым (10.13.68). Зовут сборка здесь и TagWheel.
 */
function joinLineParts(parts, opts) {
  const indent = String(parts && parts.indent ? parts.indent : "");
  const left = String(parts && parts.left ? parts.left : "").trim();
  const text = String(parts && parts.text ? parts.text : "").trim();
  const dates = String(parts && parts.dates ? parts.dates : "").trim();
  const sep1 = String(opts && opts.sep1 ? opts.sep1 : "");
  const sep2 = String(opts && opts.sep2 ? opts.sep2 : sep1);
  const hasLeft = !!(opts && opts.hasLeftTokens);
  /* Пустая левая зона (внутри цитаты, В-115) — без пробела. */
  const head = left ? left + " " : "";

  if (dates && text) {
    if (hasLeft) return indent + left + " " + sep1 + " " + text + " " + sep2 + " " + dates;
    return indent + head + text + " " + sep2 + " " + dates;
  }
  if (dates) {
    if (hasLeft) return indent + left + " " + sep1 + "  " + sep2 + " " + dates;
    /* Слот держится, где слева только начало строки (10.13.107). Спрашивается
       вся голова: цитата и каллаут живут в отступе. Хвостовой пробел отступа
       снимается — слот и есть два пробела. */
    const headStart = (indent + left).replace(/[^\S\n]+$/, "");
    if (isBareLinePrefix(headStart)) return headStart + "  " + sep2 + " " + dates;
    return indent + head + sep2 + " " + dates;
  }
  if (text) {
    if (hasLeft) return indent + left + " " + sep1 + " " + text;
    return indent + head + text;
  }
  return indent + left;
}


/** Что в начале левого сегмента принадлежит платформе — `lineStartOf` (10.13.118, В-114, В-115). */
function splitLeftPrefix(raw) {
  var src = String(raw || "").trim();
  var start = __sharedUtils.lineStartOf(src);
  return { prefix: String(start.prefix || "").trim(), body: String(start.body || "").trim() };
}

function joinLeftPrefix(prefix, body) {
  var p = String(prefix || "").trim();
  var b = String(body || "").trim();
  if (p && b) return p + " " + b;
  if (p) return p;
  return b;
}

function stripPrefixKeepIndent(line, removeCheckbox) {
  /* Здесь только выбор, снимать ли задачу со знаком списка. */
  const start = __sharedUtils.lineStartOf(line);
  const kept = removeCheckbox ? "" : start.checkbox;
  return start.indent + start.quote + start.callout + start.heading + kept + start.body;
}

function escapeRx(s) {
  /* Одно объявление — `escapeRe` (У-32). */
  return __sharedUtils.escapeRe(s);
}

/**
 * Исходный текст возвращается в свой слот и ничего оттуда не выносит (В-163):
 * у панели слот шире исходного текста (ссылка, слово из левой зоны). Стоит в
 * слоте исходный текст — слот не трогаем, нет — кладём исходный.
 */
function enforceTextSegmentForLeftTag(line, rules, originalText) {
  const textRaw = String(originalText || "").trim();
  if (!textRaw) return String(line || "");
  const seg = splitSegments(line, rules);
  let left = seg.left;
  let text = seg.text;
  let dates = seg.dates;
  const esc = escapeRx(textRaw);
  const rxWhole = new RegExp("(^|\\s)" + esc + "(?=\\s|$)", "g");
  const slot = String(text || "").replace(/\s+/g, " ").trim();
  const slotKeepsText = new RegExp("(^|\\s)" + esc + "(?=\\s|$)").test(slot);
  left = String(left || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  text = String(text || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  dates = String(dates || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  text = slotKeepsText ? slot : textRaw;
  return buildFromSegments({ indent: seg.indent, left: left, text: text, dates: dates }, rules);
}

/**
 * Токены значений из правил, и только они: отличить управляемый токен от
 * хештега человека (У-51). Обе формы `values` живые — строки и `{token}`.
 */
function collectManagedTokens(rules) {
  const out = new Set();
  const modes = [rules && rules.leftMode, rules && rules.rightMode];
  for (const mode of modes) {
    const fields = mode && Array.isArray(mode.fields) ? mode.fields : [];
    for (const field of fields) {
      const prefix = field && typeof field.prefix === "string" ? field.prefix : "#";
      const values = field && Array.isArray(field.values) ? field.values : [];
      for (const v of values) {
        const token = String((typeof v === "string" ? v : (v && v.token)) || "").trim();
        if (!token) continue;
        out.add(token);
        if (!/^(#|\[\[)/.test(token)) out.add(prefix + token);
      }
    }
  }
  return out;
}

/**
 * Снимает с начала тела подряд идущие значения (тег, ссылка, значение
 * элемента целиком, голая дата) и отдаёт текст. Общий для
 * `extractOriginalTextFromRawLine` и `demoteLeftBodyToText` (`В-211`, 10.13.265).
 */
function stripLeadingValues(body, markers) {
  let left = String(body || "").trim();
  while (true) {
    /* Формы тега и ссылки — общий дом (10.13.141). */
    const mTag = left.match(new RegExp("^(" + __sharedUtils.TAG_TOKEN_SRC + ")\\s*"));
    if (mTag) { left = left.slice(mTag[0].length).trim(); continue; }
    const mWiki = left.match(new RegExp("^(" + __sharedUtils.WIKILINK_TOKEN_SRC + ")\\s*"));
    if (mWiki) { left = left.slice(mWiki[0].length).trim(); continue; }
    let consumedMarker = false;
    /* Значение целиком, а не до пробела: формат бывает с пробелом (10.13.71). */
    for (const mk of markers) {
      if (!left.startsWith(mk)) continue;
      const valueLen = __sharedUtils.longestValueLengthAt(
        left,
        mk.length,
        __sharedUtils.elementValueSources("", mk)
      );
      if (valueLen === null) continue;
      left = left.slice(mk.length + valueLen).trim();
      consumedMarker = true;
      break;
    }
    if (consumedMarker) continue;
    const mDateLike = left.match(/^(\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?|\d{2}:\d{2}(?::\d{2})?)\s*/);
    if (mDateLike) { left = left.slice(mDateLike[0].length).trim(); continue; }
    break;
  }
  return left;
}

/**
 * Чередует формы (`stripLeadingValues`) и Value списка без формы (`В-247`,
 * `🙂‍↕️да`), пока с начала есть что снять. Общий для
 * `extractOriginalTextFromRawLine` и `demoteLeftBodyToText` (Н-23).
 */
function stripLeadingRun(text, markers, known) {
  let rest = text;
  for (;;) {
    const w = __sharedUtils.lineWords(stripLeadingValues(rest, markers));
    let k = 0;
    while (k < w.length && known.has(w[k])) k++;
    const next = w.slice(k).join(" ");
    if (next === rest) return rest;
    rest = next;
  }
}

function extractOriginalTextFromRawLine(rawLine, rules) {
  const seg = splitSegments(rawLine, rules);
  if (String(seg.text || "").trim()) {
    /* Выключенный `Keep typed tags in text`: значения поля уезжают в Block и
       в исходный текст не входят, иначе вернутся во фразу дублем. */
    if (__sharedUtils.typedTagsStayText(rules)) return String(seg.text || "").trim();
    const own = fieldValueTest(rules);
    return __sharedUtils.lineWords(seg.text).filter(function(t) { return !own(t); }).join(" ").trim();
  }
  let left = String(seg.left || "").trim();
  /* Начало строки — общее объявление. */
  left = String(__sharedUtils.lineStartOf(left).body || "").trim();
  const managed = collectManagedTokens(rules);
  left = stripLeadingRun(left, getRightMarkers(rules), managed);
  /* Объявленные токены снимаются по всему телу, не только с начала: иначе
     проза попадала в строку дважды (A18). */
  if (managed.size) {
    left = __sharedUtils.lineWords(left)
      .filter(function(t) { return !managed.has(t); })
      .join(" ");
  }
  left = left.trim();
  if (left === "-") return "";
  return left;
}

function relocateMarkerTokenByPanel(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var marker = String(opts.marker || "").trim();
  var targetPanel = String(opts.targetPanel || "right").trim().toLowerCase() === "left" ? "left" : "right";
  if (!marker) return line;
  var removeMarkerTokens = typeof opts.removeMarkerTokens === "function" ? opts.removeMarkerTokens : null;
  var takeFirstToken = typeof opts.takeFirstToken === "function" ? opts.takeFirstToken : null;
  if (!removeMarkerTokens) throw new Error("line_pipeline relocateMarkerTokenByPanel: removeMarkerTokens required");
  if (!takeFirstToken) throw new Error("line_pipeline relocateMarkerTokenByPanel: takeFirstToken required");

  var seg = splitSegments(line, rules);
  var indent = String(seg.indent || "");
  var left = String(seg.left || "");
  var text = String(seg.text || "");
  var dates = String(seg.dates || "");

  var canFallback = opts.useFallbackFromLine !== false;
  var hasOverride = Object.prototype.hasOwnProperty.call(opts, "tokenOverride");
  var token = hasOverride ? String(opts.tokenOverride || "") : "";
  if (!token && canFallback && !hasOverride) {
    token =
      String(takeFirstToken(left, marker) || "")
      || String(takeFirstToken(text, marker) || "")
      || String(takeFirstToken(dates, marker) || "");
  }

  left = String(removeMarkerTokens(left, marker) || "").trim();
  text = String(removeMarkerTokens(text, marker) || "").trim();
  dates = String(removeMarkerTokens(dates, marker) || "").trim();

  /* Знак списка пустой левой зоне подставляет только `buildFromSegments`:
     он знает про цитату (`S41`, У-150). */
  if (token) {
    if (targetPanel === "left") left = `${left} ${token}`.trim();
    else dates = dates ? `${token} ${dates}` : token;
  }

  return buildFromSegments({ indent: indent, left: left, text: text, dates: dates }, rules);
}

function clearMarkerFromLine(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var marker = String(opts.marker || "").trim();
  if (!marker) return line;
  var removeMarkerTokens = typeof opts.removeMarkerTokens === "function" ? opts.removeMarkerTokens : null;
  if (!removeMarkerTokens) throw new Error("line_pipeline clearMarkerFromLine: removeMarkerTokens required");
  var seg = splitSegments(line, rules);
  return buildFromSegments({
    indent: String(seg.indent || ""),
    left: String(removeMarkerTokens(seg.left, marker) || "").trim(),
    text: String(removeMarkerTokens(seg.text, marker) || "").trim(),
    dates: String(removeMarkerTokens(seg.dates, marker) || "").trim(),
  }, rules);
}

function removeExactTokens(text, tokens) {
  var out = String(text || "");
  var list = Array.isArray(tokens) ? tokens : [];
  var i;
  for (i = 0; i < list.length; i++) {
    var tok = String(list[i] || "").trim();
    if (!tok) continue;
    var rx = new RegExp("(^|\\s)" + escapeRx(tok) + "(?=\\s|$)", "g");
    out = out.replace(rx, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function detectMarkerPanel(options) {
  var opts = options && typeof options === "object" ? options : {};
  var rawLine = String(opts.line || "");
  var rules = opts.rules;
  var marker = String(opts.marker || "").trim();
  if (!marker) return "none";
  var seg = splitSegments(rawLine, rules);
  var leftPart = String(seg && seg.left ? seg.left : "");
  var rightPart = [String(seg && seg.text ? seg.text : "").trim(), String(seg && seg.dates ? seg.dates : "").trim()]
    .filter(Boolean)
    .join(" ");
  var rx = new RegExp(escapeRx(marker) + "(?:[^\\s]+)?");
  var hasLeft = rx.test(leftPart);
  var hasRight = rx.test(rightPart);
  if (hasLeft && hasRight) return "both";
  if (hasLeft) return "left";
  if (hasRight) return "right";
  return "none";
}

function resolvePanelByMarkerPresence(options) {
  var opts = options && typeof options === "object" ? options : {};
  var panelByOrder = String(opts.panelByOrder || "right").trim().toLowerCase() === "left" ? "left" : "right";
  return panelByOrder;
}

function getPanelSearchText(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var panel = String(opts.panel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  var seg = splitSegments(line, rules);
  if (panel === "left") return String(seg && seg.left ? seg.left : "");
  return [String(seg && seg.text ? seg.text : "").trim(), String(seg && seg.dates ? seg.dates : "").trim()]
    .filter(Boolean)
    .join(" ");
}

/**
 * Снять из текста значения перечисленных меток. Хвост метки — из её формата
 * (`tailByMarker`), конец значения решает общий обход: формат бывает в два
 * слова (10.13.71).
 */
function removeDateTimeMarkers(options) {
  var opts = options && typeof options === "object" ? options : {};
  var text = String(opts.text || "");
  var markers = Array.isArray(opts.markers) ? opts.markers : [];
  var tails = opts.tailByMarker && typeof opts.tailByMarker === "object" && !Array.isArray(opts.tailByMarker)
    ? opts.tailByMarker
    : {};
  var out = text;
  var i;
  for (i = 0; i < markers.length; i++) {
    var mk = String(markers[i] || "").trim();
    if (!mk) continue;
    out = __sharedUtils.removeMarkerValueTokens(out, mk, __sharedUtils.elementValueSources(tails[mk], mk));
  }
  return out.replace(/\s+/g, " ").trim();
}

function collectDateLikeMarkersFromRules(options) {
  var opts = options && typeof options === "object" ? options : {};
  var rules = opts.rules;
  var fields = Array.isArray(rules && rules.rightMode && rules.rightMode.fields) ? rules.rightMode.fields : [];
  var kinds = Array.isArray(opts.kinds) ? opts.kinds.map(function(k) { return String(k || "").trim(); }) : [];
  var allowed = {};
  var i;
  for (i = 0; i < kinds.length; i++) {
    var kk = kinds[i];
    if (!kk) continue;
    allowed[kk] = true;
  }
  var out = [];
  var seen = {};
  for (i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (!f) continue;
    var marker = String(f.marker || "").trim();
    if (!marker || seen[marker]) continue;
    if (kinds.length) {
      var kind = String(f.kind || "").trim();
      if (!allowed[kind]) continue;
    }
    seen[marker] = true;
    out.push(marker);
  }
  if (out.length) return out;
  var fallback = Array.isArray(opts.defaultMarkers)
    ? opts.defaultMarkers.map(function(m) { return String(m || "").trim(); }).filter(Boolean)
    : [];
  return fallback;
}

function removeTokensAcrossSegments(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var tokens = Array.isArray(opts.tokens) ? opts.tokens : [];
  if (!tokens.length) return line;
  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);
  var leftBody = removeExactTokens(leftParts.body, tokens);
  var text = removeExactTokens(seg.text, tokens);
  var dates = removeExactTokens(seg.dates, tokens);
  return buildFromSegments({
    indent: seg.indent,
    left: joinLeftPrefix(leftParts.prefix, leftBody),
    text: text,
    dates: dates,
  }, rules);
}

function normalizeRightPayloadTailToDates(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);
  var body = String(leftParts.body || "").trim();
  if (!body) return line;
  /* Тело разбирается значениями, а не словами: `YYYY-MM-DD hh:mm` — два слова,
     конец значения — `longestValueLengthAt` (10.13.71, `S12`). */
  var rightMarkers = markersPlacedInRightBlock(rules);
  var allMarkers = markersOfSide(rules, "left").concat(markersOfSide(rules, "right"));
  var parts = [];
  var pos = 0;
  while (pos < body.length) {
    if (/\s/.test(body.charAt(pos))) { pos += 1; continue; }
    var takenMarker = "";
    var takenLen = 0;
    for (var mi = 0; mi < allMarkers.length; mi++) {
      var mk = String(allMarkers[mi] || "");
      if (!mk || body.indexOf(mk, pos) !== pos) continue;
      var valueLen = __sharedUtils.longestValueLengthAt(
        body,
        pos + mk.length,
        __sharedUtils.elementValueSources("", mk)
      );
      if (valueLen === null) continue;
      if (mk.length + valueLen > takenLen) {
        takenMarker = mk;
        takenLen = mk.length + valueLen;
      }
    }
    if (takenLen > 0) {
      parts.push({ text: body.slice(pos, pos + takenLen), rightPlaced: rightMarkers.indexOf(takenMarker) !== -1 });
      pos += takenLen;
      continue;
    }
    var wordEnd = body.indexOf(" ", pos);
    if (wordEnd === -1) wordEnd = body.length;
    var word = body.slice(pos, wordEnd);
    parts.push({ text: word, rightPlaced: isDateLikeBareToken(word) });
    pos = wordEnd;
  }
  if (!parts.length) return line;
  var cut = parts.length;
  while (cut > 0 && parts[cut - 1].rightPlaced) cut -= 1;
  if (cut === parts.length) return line;
  if (cut === 0 && !String(leftParts.prefix || "").trim()) return line;

  var leftKeep = parts.slice(0, cut).map(function (p) { return p.text; }).join(" ").trim();
  var tail = parts.slice(cut).map(function (p) { return p.text; }).join(" ").trim();
  if (!tail) return line;

  var nextLeft = joinLeftPrefix(leftParts.prefix, leftKeep);
  var nextDates = [tail, String(seg.dates || "").trim()].filter(Boolean).join(" ").trim();
  if (!String(nextLeft || "").trim()) return line;
  return buildFromSegments({
    indent: seg.indent,
    left: nextLeft,
    text: seg.text,
    dates: nextDates,
  }, rules);
}

function cleanOriginalTextForLeftDate(options) {
  var opts = options && typeof options === "object" ? options : {};
  var rawLine = String(opts.rawLine || "");
  var rules = opts.rules;
  var tailByMarker = opts.tailByMarker && typeof opts.tailByMarker === "object" && !Array.isArray(opts.tailByMarker)
    ? opts.tailByMarker
    : {};
  var kinds = Array.isArray(opts.kinds) ? opts.kinds : ["dateOffset", "nowTime", "estimatedCycle", "genericElement"];
  var defaultMarkers = Array.isArray(opts.defaultMarkers) ? opts.defaultMarkers : [];

  var segRaw = splitSegments(rawLine, rules);
  /* Текст человека — одно правило, `extractOriginalTextFromRawLine`
     (`S12`, У-150, A18, 10.13.71). */
  var out = extractOriginalTextFromRawLine(rawLine, rules);
  if (!out) return "";

  var rightTokens = __sharedUtils.lineWords(segRaw && segRaw.dates ? segRaw.dates : "");
  out = removeExactTokens(out, rightTokens);
  var markers = collectDateLikeMarkersFromRules({
    rules: rules,
    kinds: kinds,
    defaultMarkers: defaultMarkers,
  });
  out = removeDateTimeMarkers({
    text: out,
    markers: markers,
    tailByMarker: tailByMarker,
  });
  return out;
}

function relocateTokenSetByPanel(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var targetPanel = String(opts.targetPanel || "left").trim().toLowerCase() === "right" ? "right" : "left";
  var selectedToken = String(opts.selectedToken || "").trim();
  var allTokens = Array.isArray(opts.allTokens) ? opts.allTokens.map(function(t) { return String(t || "").trim(); }).filter(Boolean) : [];
  var stripTokens = typeof opts.stripTokens === "function" ? opts.stripTokens : null;
  var removeCombinedByParentToken = typeof opts.removeCombinedByParentToken === "function"
    ? opts.removeCombinedByParentToken
    : null;
  var rightToText = opts.rightToText === true;
  if (!stripTokens) throw new Error("line_pipeline relocateTokenSetByPanel: stripTokens required");
  var reorderLeft = typeof opts.reorderLeft === "function" ? opts.reorderLeft : function passthrough(v) { return String(v || "").trim(); };
  var reorderRight = typeof opts.reorderRight === "function" ? opts.reorderRight : function passthrough(v) { return String(v || "").trim(); };

  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);
  var leftBody = stripTokens(leftParts.body, allTokens);
  /* Значение посреди текста — слово человека (`В-235`), кроме `rightToText`:
     там в тексте стоит прежнее наше. */
  var text = (rightToText || !__sharedUtils.typedTagsStayText(rules)) ? stripTokens(seg.text, allTokens) : String(seg.text || "").trim();
  var dates = stripTokens(seg.dates, allTokens);

  /* Пара «родитель/ребёнок» — общий признак: `#/1` парой не считается (У-150). */
  var combined = __sharedUtils.splitCombinedTagToken(selectedToken);
  if (combined && removeCombinedByParentToken) {
    var parentTok = combined.parent;
    leftBody = removeCombinedByParentToken(leftBody, parentTok);
    text = removeCombinedByParentToken(text, parentTok);
    dates = removeCombinedByParentToken(dates, parentTok);
  }

  if (selectedToken) {
    if (targetPanel === "right") {
      if (rightToText) text = text ? (text + " " + selectedToken) : selectedToken;
      else dates = dates ? (dates + " " + selectedToken) : selectedToken;
    }
    else leftBody = leftBody ? (leftBody + " " + selectedToken) : selectedToken;
  }

  var orderedLeft = reorderLeft(leftBody);
  var orderedRight = reorderRight(dates);
  return buildFromSegments({
    indent: seg.indent,
    left: joinLeftPrefix(leftParts.prefix, orderedLeft),
    text: text,
    dates: orderedRight,
  }, rules);
}

function relocateMarkerSetByFieldOrder(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var fields = Array.isArray(opts.fields) ? opts.fields : [];
  var getOrderKey = typeof opts.getOrderKey === "function" ? opts.getOrderKey : null;
  var getPanelForKey = typeof opts.getPanelForKey === "function" ? opts.getPanelForKey : null;
  var getValueRx = typeof opts.getValueRx === "function" ? opts.getValueRx : null;
  var removeMarkerTokens = typeof opts.removeMarkerTokens === "function" ? opts.removeMarkerTokens : null;
  var takeFirstToken = typeof opts.takeFirstToken === "function" ? opts.takeFirstToken : null;
  if (!getOrderKey) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: getOrderKey required");
  if (!getPanelForKey) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: getPanelForKey required");
  if (!getValueRx) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: getValueRx required");
  if (!removeMarkerTokens) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: removeMarkerTokens required");
  if (!takeFirstToken) throw new Error("line_pipeline relocateMarkerSetByFieldOrder: takeFirstToken required");

  var out = line;
  var seen = {};
  var i;
  for (i = 0; i < fields.length; i++) {
    var field = fields[i];
    if (!field || !field.marker) continue;
    var marker = String(field.marker || "").trim();
    if (!marker) continue;
    var key = String(getOrderKey(field) || "").trim();
    if (!key) continue;
    var dedup = key + "::" + marker;
    if (seen[dedup]) continue;
    seen[dedup] = true;
    /* `null` — не элемент, не трогаем; `""` — элемент без образца, конец
       значения решает общий обход (10.13.71). */
    var valueRxRaw = getValueRx(field);
    if (valueRxRaw === null || valueRxRaw === undefined) continue;
    var valueRx = String(valueRxRaw || "").trim();
    var panel = String(getPanelForKey(key) || "right").trim().toLowerCase() === "left" ? "left" : "right";
    out = relocateMarkerTokenByPanel({
      line: out,
      rules: rules,
      marker: marker,
      targetPanel: panel,
      removeMarkerTokens: function(segLine, mk) {
        return removeMarkerTokens(segLine, mk, valueRx);
      },
      takeFirstToken: function(segLine, mk) {
        return takeFirstToken(segLine, mk, valueRx);
      },
    });
  }
  return out;
}

function removeCombinedByParentTokens(options) {
  var opts = options && typeof options === "object" ? options : {};
  var line = String(opts.line || "");
  var rules = opts.rules;
  var parentTokens = Array.isArray(opts.parentTokens)
    ? opts.parentTokens.map(function(t) { return String(t || "").trim(); }).filter(Boolean)
    : [];
  if (!parentTokens.length) return line;

  var seg = splitSegments(line, rules);
  var leftParts = splitLeftPrefix(seg.left);

  function stripCombined(src) {
    var out = String(src || "");
    var i;
    for (i = 0; i < parentTokens.length; i++) {
      var p = parentTokens[i];
      if (!p) continue;
      var rx = new RegExp("(^|\\s)" + escapeRx(p) + "\\/\\S+(?=\\s|$)", "g");
      out = out.replace(rx, " ");
    }
    return out.replace(/\s+/g, " ").trim();
  }

  seg.left = joinLeftPrefix(leftParts.prefix, stripCombined(leftParts.body));
  seg.text = stripCombined(seg.text);
  seg.dates = stripCombined(seg.dates);
  return buildFromSegments(seg, rules);
}

module.exports = {
  splitSegments,
  buildFromSegments,
  joinLineParts,
  fieldsShape,
  hasFieldTokens,
  splitLeftPrefix,
  joinLeftPrefix,
  stripPrefixKeepIndent,
  enforceTextSegmentForLeftTag,
  extractOriginalTextFromRawLine,
  relocateMarkerTokenByPanel,
  clearMarkerFromLine,
  removeExactTokens,
  detectMarkerPanel,
  resolvePanelByMarkerPresence,
  getPanelSearchText,
  removeDateTimeMarkers,
  collectDateLikeMarkersFromRules,
  removeTokensAcrossSegments,
  normalizeRightPayloadTailToDates,
  cleanOriginalTextForLeftDate,
  relocateTokenSetByPanel,
  relocateMarkerSetByFieldOrder,
  removeCombinedByParentTokens,
};
