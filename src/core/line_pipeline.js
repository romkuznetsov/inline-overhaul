"use strict";

function resolveSeparatorsOrThrow(rules) {
  var io = rules && typeof rules.io === "object" && !Array.isArray(rules.io) ? rules.io : null;
  var sep1 = io && io.separator1 != null ? String(io.separator1).trim() : "";
  var sep2 = io && io.separator2 != null ? String(io.separator2).trim() : "";
  if (!sep1 || !sep2) {
    throw new Error("line_pipeline: rules.io.separator1 and rules.io.separator2 are required");
  }
  return { sep1: sep1, sep2: sep2 };
}

/** Поля одной стороны Order: левый Block или правый. */
function sideFields(rules, side) {
  const node = rules && rules[side === "left" ? "leftMode" : "rightMode"];
  return Array.isArray(node && node.fields) ? node.fields : [];
}

/*
 * Маркеры элементов **названной** стороны.
 *
 * Здесь стояло `getRightMarkers`, и сторона была зашита. Она же потом
 * подавалась в признак «слева токены, а не текст» — то есть левый сегмент
 * проверялся правыми маркерами (замечание заказчика 2026-09-11: «тут не важны
 * теги и дата, а field order — любой field type может быть где угодно»).
 */
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

/**
 * Что в этой настройке вообще является значением Field, а что — текстом.
 *
 * **Сторона Order здесь ни при чём, и это стоило одной неверной правки.**
 * Заказчик сказал 2026-09-11: «тут не важны теги и дата, а field order — любой
 * field type может быть где угодно», и первая моя правка прочла это как «у
 * левого сегмента спрашивать левую сторону». Проверка поведения покраснела
 * первым же прогоном: ссылку, которую инструмент **только что** перенёс в
 * левый Block, левая сторона правил ещё не знает — Order сказал «слева», а
 * список полей стороны остался прежним. Признак стороне не принадлежит:
 * вопрос ровно один — значение это Field или текст человека.
 *
 * Спрашивается состав **всех** Fields:
 *   - `markers` — метки элементов, **обеих** сторон. Прежде брались только
 *     правые, и элемент, уведённый в левый Block, признаком не считался;
 *   - `values` — записанные значения целиком, для Field без префикса.
 *
 * Решётку и двойную скобку форма не описывает: они значения Field при любой
 * раскладке, и спрашиваются прямо в `hasFieldTokens`. Список значений
 * **дополняет** признак, а не заменяет его: Field со свободным вводом даёт
 * значение, которого в списке нет, и оно обязано остаться узнанным по виду.
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
  return { markers: markers, values: values };
}

/** Есть ли в теле хоть одно значение Field. */
function hasFieldTokens(body, shape) {
  const src = String(body || "").trim();
  if (!src) return false;
  /*
   * Решётка и двойная скобка — значения Field при любой раскладке Order, и
   * спрашивать у настройки, «принимает ли сторона теги», нельзя: Field,
   * только что переставленный в другой Block, в её списке ещё не значится.
   * Это поймала проверка поведения, а не чтение (block_placement_tests).
   */
  if (/(^|\s)#\S+/.test(src)) return true;
  if (/(^|\s)\[\[[^\]]+\]\]/.test(src)) return true;
  const tokens = src.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
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

function isDateLikeBareToken(token) {
  const t = String(token || "");
  if (!t) return false;
  return /^\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(t)
    || /^\d{2}:\d{2}(?::\d{2})?$/.test(t);
}

function isLikelyRightPayloadToken(token, markers) {
  const t = String(token || "");
  if (!t) return false;
  if (/^#\S+$/.test(t)) return true;
  if (/^\[\[[^\]]+\]\]$/.test(t)) return true;
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
  var left = String(rawLeft || "").trim();
  left = left.replace(/^\s*(?:[-*+]|\d+[\.)])(?:\s+|$)/, "");
  left = left.replace(/^\s*\[[^\]]\](?:\s+|$)/, "");
  return left.trim();
}

function isPlainTextSegmentToken(token) {
  var t = String(token || "").trim();
  if (!t) return false;
  if (/^#\S+$/.test(t)) return false;
  if (/^\[\[[^\]]+\]\]$/.test(t)) return false;
  return true;
}

function hasRightPayloadInvariantShape(dates, markers) {
  var payload = String(dates || "").trim();
  if (!payload) return false;
  var parts = payload.split(/\s+/).filter(Boolean);
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
  var textTokens = text.split(/\s+/).filter(Boolean);
  if (!textTokens.length) return text;
  if (!textTokens.every(isPlainTextSegmentToken)) return text;
  var leftBody = stripListPrefixForBody(left);
  if (!leftBody) return text;
  var leftTokens = leftBody.split(/\s+/).filter(Boolean);
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
 * Похоже ли содержимое левого сегмента на токены, а не на текст (находки Н-6 и
 * Н-8, 2026-08-28; четвёртое исключение из З3).
 *
 * Зачем это здесь. Левый сегмент — зона токенов до первого разделителя. Когда
 * токенов в строке нет, разбор всё равно считал левым сегментом всё до
 * разделителя, то есть сам текст: `- [ ] 111 || #todo` разбиралось как
 * left=`- [ ] 111`, text=``. Пока в левый сегмент никто не дописывал, это не
 * мешало. Как только ссылка или элемент поехали в Left Block, дописывание
 * склеивало их с текстом: `- [ ] 111 [[test1]] ||  || #todo`.
 *
 * Проверка та же, что в `buildFromSegments` (`hasLeftTech`): сборка строки уже
 * различала эти два случая, а разбор — нет, и два разборщика одной строки
 * расходились. `parseLine` в `tagwheel_core.js` про текст отвечал верно, а
 * `splitSegments` — нет.
 */
function looksLikeLeftTokens(body, shape) {
  return hasFieldTokens(body, shape);
}

/**
 * Развести левый сегмент и текст, когда токенов в левом сегменте нет.
 * Маркер списка (`- [ ] `) остаётся слева: он принадлежит строке, а не зоне.
 *
 * Развязка делается **только у строк с маркером списка**, и это не
 * осторожность ради осторожности. Без маркера левый сегмент стал бы пустым, а
 * `buildFromSegments` на пустом левом сегменте подставляет `-` — то есть
 * строка без списка получила бы список, которого в ней не было. Строки
 * плагина — пункты списка, и разбирается ровно тот случай, который сломан.
 */
function demoteLeftBodyToText(leftRaw, shape) {
  const parts = splitLeftPrefix(leftRaw);
  if (!parts.prefix || !parts.body) return null;
  if (looksLikeLeftTokens(parts.body, shape)) return null;
  return { left: parts.prefix, text: parts.body };
}

function splitSegments(rawLine, rules) {
  const sep = resolveSeparatorsOrThrow(rules);
  const sep1 = sep.sep1;
  const sep2 = sep.sep2;
  const raw = String(rawLine || "");
  const indent = (raw.match(/^(\s*)/) || ["", ""])[1];
  const s = raw.trim();
  const markers = getRightMarkers(rules);
  const shape = fieldsShape(rules);

  if (sep1 === sep2) {
    const parts = s.split(sep1).map(function(x) { return String(x || "").trim(); });
    if (parts.length <= 1) {
      const demoted = demoteLeftBodyToText(s, shape);
      if (demoted) return { indent: indent, left: demoted.left, text: demoted.text, dates: "" };
      return { indent: indent, left: s, text: "", dates: "" };
    }
    if (parts.length === 2) {
      let textOnly = parts[1] || "";
      let rightOnly = "";
      if (textOnly) {
        const tokens = textOnly.split(/\s+/).filter(Boolean);
        const isRightPayload = (tokens.length > 0
          && tokens.every(function(t) {
            return isLikelyRightPayloadToken(t, markers);
          }))
          || isMarkerAnchoredDatePayloadTokens(tokens, markers);
        if (isRightPayload) {
          rightOnly = textOnly;
          textOnly = "";
        }
      }
      /* Текста нет, а слева — не токены: значит слева и есть текст. */
      if (!textOnly) {
        const demoted = demoteLeftBodyToText(parts[0] || "", shape);
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

  /*
   * **Первого разделителя в строке нет, а второй есть.**
   *
   * Прежде разбор в этом случае не искал второй вовсе: весь текст уезжал в
   * левый сегмент вместе с разделителем, и сборка приклеивала дату **первым**
   * разделителем — `- [ ] 1244 :: || 📅…` (замечание заказчика 2026-09-11).
   * Зоны тегов в такой строке просто нет: слева знак списка, дальше текст.
   *
   * Развязка делается только у строк со знаком списка — по той же причине,
   * что и в `demoteLeftBodyToText`: на пустом левом сегменте сборка
   * подставляет `-`, то есть строка без списка получила бы список.
   */
  const i1 = s.indexOf(sep1);
  if (i1 === -1 && sep2 && sep2 !== sep1) {
    const j = s.indexOf(sep2);
    if (j !== -1) {
      const head = String(s.slice(0, j) || "").trim();
      const tail = String(s.slice(j + sep2.length) || "").trim();
      /*
       * Слева значения Field — значит это зона тегов, а текста в строке нет:
       * первому разделителю взяться неоткуда, раз его в строке нет.
       */
      if (looksLikeLeftTokens(head, shape)) {
        return { indent: indent, left: head, text: "", dates: tail };
      }
      const parts = splitLeftPrefix(head);
      if (parts.prefix) {
        return { indent: indent, left: parts.prefix, text: parts.body, dates: tail };
      }
    }
  }
  let left = i1 === -1 ? s : s.slice(0, i1).trim();
  const after1 = i1 === -1 ? "" : s.slice(i1 + sep1.length).trim();
  const i2 = after1.indexOf(sep2);
  let text = i2 === -1 ? after1.trim() : after1.slice(0, i2).trim();
  let dates = i2 === -1 ? "" : after1.slice(i2 + sep2.length).trim();

  if (i2 === -1 && text) {
    const parts = text.split(/\s+/).filter(Boolean);
    const isRightPayload = (parts.length > 0
      && parts.every(function(t) {
        return isLikelyRightPayloadToken(t, markers);
      }))
      || isMarkerAnchoredDatePayloadTokens(parts, markers);
    if (isRightPayload) {
      dates = text;
      text = "";
    }
  }

  /* Та же развязка, что и у совпадающих разделителей: текста нет, слева не
     токены — значит слева текст. */
  if (!text) {
    const demoted = demoteLeftBodyToText(left, shape);
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

  if (!left) left = "-";
  /*
   * Признак объявлен один раз — `hasSideTokens`. До 2026-09-11 он стоял здесь
   * второй копией, написанной по виду токена, и расходился с разбором молча
   * (У-32). Спрашивается одно: есть ли слева хоть одно значение Field.
   */
  const hasLeftTech = hasFieldTokens(left, fieldsShape(rules));
  const hasListPrefix = /^(-|\*|\+)(\s|$)|^\d+\.(?:\s|$)/.test(left);
  if (hasLeftTech && !hasListPrefix) {
    left = ("- " + left).trim();
  }

  if (dates) {
    text = collapseDuplicateTextForRightPayload({ left: left, text: text, dates: dates }, markers);
  }

  /*
   * **Какой разделитель отделяет правый Block — решает наличие левого.**
   *
   * Зона тегов слева есть — строка полная: `теги sep1 текст sep2 правый`.
   * Зоны тегов нет — первому разделителю в строке взяться неоткуда, и правый
   * Block отделяется **вторым**: `текст sep2 правый`. До 2026-09-11 здесь в
   * обоих случаях стоял `sep1`, и на разведённых разделителях это было видно
   * глазом: `- [ ] 1244 || 📅…` вместо `- [ ] 1244 :: 📅…`.
   */
  if (dates && text) {
    if (hasLeftTech) return indent + left + " " + sep1 + " " + text + " " + sep2 + " " + dates;
    return indent + left + " " + text + " " + sep2 + " " + dates;
  }
  if (dates) {
    /*
     * **Текста в строке нет, и слот под него виден пробелом** (исключение 20 к
     * З3, 10.13.34). Пустой слот отмечается **двумя** пробелами между
     * разделителями — так человек видит, куда встанет слово.
     *
     * Здесь стояло `if (sep1 === sep2)`: двойной пробел ставился только при
     * совпадающих разделителях, а при разных строка получалась `#todo || ::`
     * вместо `#todo ||  ::`. Замечание заказчика 2026-09-11, и это тот же
     * класс, что два предыдущих: правило написано так, что на совпадающих
     * разделителях оно верно, а на разведённых — нет (У-147).
     */
    if (hasLeftTech) return indent + left + " " + sep1 + "  " + sep2 + " " + dates;
    /*
     * Зоны тегов в строке нет вовсе — ни значений Field, ни текста: остался
     * знак списка. Правый Block отделяется **вторым** разделителем, как и
     * всюду, где левого Block нет. Прежде здесь стоял первый, и на
     * совпадающих разделителях разницы не было видно: заказчик получил
     * `- [ ]  || 📅…` вместо `- [ ]  :: 📅…` (2026-09-11).
     */
    if (/^[-*+]\s+\[[^\]]\]$/.test(left)) return indent + left + "  " + sep2 + " " + dates;
    if (left === "-") return indent + left + "  " + sep2 + " " + dates;
    /* Слева текст, а не значения Field: тот же второй разделитель. */
    return indent + left + " " + sep2 + " " + dates;
  }
  if (text) {
    if (hasLeftTech) return indent + left + " " + sep1 + " " + text;
    return indent + left + " " + text;
  }
  return hasLeftTech ? (indent + left + " " + sep1 + " ") : (indent + left);
}

function splitLeftPrefix(raw) {
  var src = String(raw || "").trim();
  var m = src.match(/^((?:[-*+]|\d+\.)(?:\s+\[[^\]]\])?)(?:\s+|$)(.*)$/);
  if (!m) return { prefix: "", body: src };
  return { prefix: String(m[1] || "").trim(), body: String(m[2] || "").trim() };
}

function joinLeftPrefix(prefix, body) {
  var p = String(prefix || "").trim();
  var b = String(body || "").trim();
  if (p && b) return p + " " + b;
  if (p) return p;
  return b;
}

function stripPrefixKeepIndent(line, removeCheckbox) {
  const s = String(line || "");
  const indent = (s.match(/^(\s*)/) || ["", ""])[1];
  let body = s.slice(indent.length);
  body = body.replace(/^[-*+](?:\s+|$)/, "");
  body = body.replace(/^\d+\.(?:\s+|$)/, "");
  if (removeCheckbox) body = body.replace(/^\[[^\]]\]\s+/, "");
  return indent + body;
}

function escapeRx(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function enforceTextSegmentForLeftTag(line, rules, originalText) {
  const textRaw = String(originalText || "").trim();
  if (!textRaw) return String(line || "");
  const seg = splitSegments(line, rules);
  let left = seg.left;
  let text = seg.text;
  let dates = seg.dates;
  const esc = escapeRx(textRaw);
  const rxWhole = new RegExp("(^|\\s)" + esc + "(?=\\s|$)", "g");
  left = String(left || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  text = String(text || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  dates = String(dates || "").replace(rxWhole, " ").replace(/\s+/g, " ").trim();
  text = textRaw;
  return buildFromSegments({ indent: seg.indent, left: left, text: text, dates: dates }, rules);
}

/**
 * Токены значений, объявленные в документе правил, — и только они.
 *
 * Нужен, чтобы отличить управляемый токен от хештега человека. Наивное «всё,
 * что начинается с # или [[» стирало из текста и его собственные теги, и все
 * 45 проверок при этом оставались зелёными (У-51): чужих тегов в фикстурах нет
 * ни одного.
 *
 * Форм значения в документе две, и обе живые: в фикстуре проверок `values` —
 * массив строк, в заметке правил, которую пишет плагин, — объекты с `token`.
 * Код, читающий одну форму, на другой молча не делает ничего.
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

function extractOriginalTextFromRawLine(rawLine, rules) {
  const seg = splitSegments(rawLine, rules);
  if (String(seg.text || "").trim()) return String(seg.text || "").trim();
  let left = String(seg.left || "").trim();
  left = left.replace(/^\s*[-*+](?:\s+|$)/, "");
  left = left.replace(/^\s*\d+\.(?:\s+|$)/, "");
  left = left.replace(/^\[[^\]]\](?:\s+|$)/, "");
  const markers = getRightMarkers(rules);
  while (true) {
    const mTag = left.match(/^(#\S+)\s*/);
    if (mTag) { left = left.slice(mTag[0].length).trim(); continue; }
    const mWiki = left.match(/^(\[\[[^\]]+\]\])\s*/);
    if (mWiki) { left = left.slice(mWiki[0].length).trim(); continue; }
    let consumedMarker = false;
    for (const mk of markers) {
      const rx = new RegExp("^(" + escapeRx(mk) + "\\S+)\\s*");
      const mDate = left.match(rx);
      if (!mDate) continue;
      left = left.slice(mDate[0].length).trim();
      consumedMarker = true;
      break;
    }
    if (consumedMarker) continue;
    const mDateLike = left.match(/^(\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?|\d{2}:\d{2}(?::\d{2})?)\s*/);
    if (mDateLike) { left = left.slice(mDateLike[0].length).trim(); continue; }
    break;
  }
  /*
   * Цикл выше снимает токены только **с начала** тела, и токен, стоящий после
   * прозы, уезжал в «исходный текст» вместе с ней. Дальше
   * `enforceTextSegmentForLeftTag` вычищает эту фразу из сегментов целиком, но
   * перестановка токена к тому моменту уже разбила фразу — вычищать нечего, и
   * проза попадала в строку дважды (A18). Поэтому объявленные токены снимаются
   * по всему телу, а не только с начала.
   */
  const managed = collectManagedTokens(rules);
  if (managed.size) {
    left = left
      .split(/\s+/)
      .filter(Boolean)
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
  if (!left) left = "-";

  if (token) {
    if (targetPanel === "left") left = left === "-" ? `- ${token}` : `${left} ${token}`.trim();
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

function removeDateTimeMarkers(options) {
  var opts = options && typeof options === "object" ? options : {};
  var text = String(opts.text || "");
  var markers = Array.isArray(opts.markers) ? opts.markers : [];
  var dateIso = String(opts.dateIso || "\\d{4}-\\d{2}-\\d{2}");
  var timeHm = String(opts.timeHm || "\\d{2}:\\d{2}");
  var out = text;
  var i;
  for (i = 0; i < markers.length; i++) {
    var mk = String(markers[i] || "").trim();
    if (!mk) continue;
    var rx = new RegExp("(^|\\s)" + escapeRx(mk) + "(?:" + dateIso + "|" + timeHm + "|[^\\s]+)(?=\\s|$)", "g");
    out = out.replace(rx, " ");
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
  var tokens = body.split(/\s+/).filter(Boolean);
  if (!tokens.length) return line;
  var markers = getRightMarkers(rules);
  var cut = tokens.length;
  while (cut > 0) {
    var tok = String(tokens[cut - 1] || "").trim();
    var isDateTail = startsWithAnyMarker(tok, markers) || isDateLikeBareToken(tok);
    if (!isDateTail) break;
    cut -= 1;
  }
  if (cut === tokens.length) return line;
  if (cut === 0 && !String(leftParts.prefix || "").trim()) return line;

  var leftKeep = tokens.slice(0, cut).join(" ").trim();
  var tail = tokens.slice(cut).join(" ").trim();
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
  var parsedText = String(opts.parsedText || "");
  var isDateLikeToken = typeof opts.isDateLikeToken === "function"
    ? opts.isDateLikeToken
    : function defaultIsDateLikeToken(token) {
      var t = String(token || "");
      return /^\d{4}-\d{2}(?:-\d{2})?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(t)
        || /^\d{2}:\d{2}(?::\d{2})?$/.test(t);
    };
  var dateIso = String(opts.dateIso || "\\d{4}-\\d{2}-\\d{2}");
  var timeHm = String(opts.timeHm || "\\d{2}:\\d{2}");
  var kinds = Array.isArray(opts.kinds) ? opts.kinds : ["dateOffset", "nowTime", "estimatedCycle", "genericElement"];
  var defaultMarkers = Array.isArray(opts.defaultMarkers) ? opts.defaultMarkers : [];

  var segRaw = splitSegments(rawLine, rules);
  var out = String(segRaw && segRaw.text ? segRaw.text : "").trim();
  if (!out) {
    var left = String(segRaw && segRaw.left ? segRaw.left : "").trim();
    left = left.replace(/^\s*[-*+](?:\s+|$)/, "");
    left = left.replace(/^\s*\d+\.\s+/, "");
    left = left.replace(/^\[[^\]]\](?:\s+|$)/, "");
    while (true) {
      var mTag = left.match(/^(#\S+)\s*/);
      if (mTag) { left = left.slice(mTag[0].length).trim(); continue; }
      var mWiki = left.match(/^(\[\[[^\]]+\]\])\s*/);
      if (mWiki) { left = left.slice(mWiki[0].length).trim(); continue; }
      var firstToken = String(left || "").split(/\s+/).filter(Boolean)[0] || "";
      if (isDateLikeToken(firstToken)) { left = left.slice(firstToken.length).trim(); continue; }
      break;
    }
    out = left.trim();
    if (!out || out === "-") return "";
  }

  var rightTokens = String(segRaw && segRaw.dates ? segRaw.dates : "").split(/\s+/).filter(Boolean);
  out = removeExactTokens(out, rightTokens);
  var markers = collectDateLikeMarkersFromRules({
    rules: rules,
    kinds: kinds,
    defaultMarkers: defaultMarkers,
  });
  out = removeDateTimeMarkers({
    text: out,
    markers: markers,
    dateIso: dateIso,
    timeHm: timeHm,
  });
  if (!parsedText) return out;
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
  var text = stripTokens(seg.text, allTokens);
  var dates = stripTokens(seg.dates, allTokens);

  if (selectedToken && selectedToken.indexOf("/") !== -1 && removeCombinedByParentToken) {
    var parentTok = String(selectedToken).split("/")[0];
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
    var valueRx = String(getValueRx(field) || "").trim();
    if (!valueRx) continue;
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
