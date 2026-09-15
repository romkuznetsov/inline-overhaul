"use strict";

const __sharedUtils = require("./shared_utils.js");

function resolveSeparatorsOrThrow(rules) {
  /* Правило одно, и живёт оно в общем доме; сюда приезжает только имя
     звавшего — его человек увидит в тексте отказа. */
  return __sharedUtils.resolveSeparatorsOrThrow(rules, "line_pipeline");
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

/*
 * Метки элементов, которым место в **правом** Block — по Order, а не по тому,
 * в каком списке правил поле объявлено.
 *
 * Разница не теоретическая: элемент, уведённый человеком в левый Block,
 * объявлен всё в том же правом списке, и `getRightMarkers` его метку отдаёт.
 * Правая доводка строки на этом уносила значение обратно вправо сразу после
 * того, как его поставили слева (замечание `S12` 2026-09-12; тот же класс, что
 * 10.13.73 — «Block элемента спрашивается у правил»).
 *
 * Поле без пометки Block остаётся на стороне своего списка: Order про него
 * ничего не сказал.
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
  /* Метка может приезжать не полем, а конфигом элементов: тогда её знает
     общий сборщик меток стороны. */
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
  /*
   * **Знак начала строки снимается здесь, а не у спрашивающего** (У-159,
   * У-177).
   *
   * Вопрос «есть ли слева значения Field» задавали двое: сборка строки
   * спрашивала его о **теле** левого сегмента, а доводка — обо **всём** левом
   * сегменте вместе со знаком начала строки. Расходились они на заголовке:
   * образец «что такое тег» — решётка плюс непробел — ложится на `##`
   * целиком, и доводка объявляла зону значений непустой там, где в ней ничего
   * нет. Команда писала `## :: текст :: 📅…`, а разбор той же строки первый
   * разделитель убирал — то есть плагин не мог прочесть написанное им самим
   * (У-157). На `# текст` этого не видно: одна решётка под образец не
   * подходит.
   *
   * Снятие стоит **внутри вопроса**: пока оно жило у спрашивающего, второй
   * спрашивающий про него не знал и знать не мог.
   */
  const src = splitLeftPrefix(String(body || "")).body;
  if (!src) return false;
  /*
   * Решётка и двойная скобка — значения Field при любой раскладке Order, и
   * спрашивать у настройки, «принимает ли сторона теги», нельзя: Field,
   * только что переставленный в другой Block, в её списке ещё не значится.
   * Это поймала проверка поведения, а не чтение (block_placement_tests).
   */
  /* Формы тега и ссылки — общий дом; текст обоих образцов совпадает с
     прежним до знака (10.13.141). */
  if (new RegExp("(^|\\s)" + __sharedUtils.TAG_TOKEN_SRC).test(src)) return true;
  if (new RegExp("(^|\\s)" + __sharedUtils.WIKILINK_TOKEN_SRC).test(src)) return true;
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

/* Как выглядит голое значение даты — объявлено один раз, в общем модуле
   (PRD 10.13.71). Здесь стояла копия того же образца. */
function isDateLikeBareToken(token) {
  const t = String(token || "");
  if (!t) return false;
  return new RegExp("^(?:" + __sharedUtils.DATE_LIKE_VALUE_SRC + ")$", "u").test(t);
}

function isLikelyRightPayloadToken(token, markers) {
  const t = String(token || "");
  if (!t) return false;
  if (__sharedUtils.isTagToken(t)) return true;
  if (__sharedUtils.isWikilinkToken(t)) return true;
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
  /* Начало строки спрашивается у общего объявления: свои две строки знали
     скобки **без** знака списка и снимали текст человека (В-114). */
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
  /*
   * **Цитата и каллаут снимаются со строки вместе с отступом** (10.13.118).
   * Они — внешнее оформление строки, а не часть зоны значений: место у них
   * впереди всего, и трогать их нам нельзя. Сняв их сюда, весь разбор ниже
   * работает с внутренней строкой, а собирает их обратно `buildFromSegments`
   * тем же `indent`. Пока они оставались в левом сегменте, `> текст` после шага
   * по полю переставала быть цитатой, а каллаут разваливался (В-115).
   */
  const outer = __sharedUtils.lineStartOf(raw);
  const indent = outer.indent + outer.quote + outer.callout;
  const s = raw.slice(indent.length).trim();
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
       *
       * **Спрашивается тело, а не голова целиком** (2026-09-13, 10.13.94):
       * знак начала строки принадлежит платформе и значением Field быть не
       * может. На знаке заголовка это было видно прямо — `##` подходит под
       * наше правило «что такое тег», и `#### [ ] test :: #/1` объявлялся
       * строкой, где слева одни значения, а текста человека нет вовсе.
       */
      const headParts = splitLeftPrefix(head);
      if (looksLikeLeftTokens(headParts.body, shape)) {
        return { indent: indent, left: head, text: "", dates: tail };
      }
      /*
       * **Перед вторым разделителем нет ничего.** Так выглядит строка, у
       * которой заполнен только правый Block, а знак списка ещё не поставлен:
       * `:: 👤111`. Прежде эта ветка кончалась ничем, и разбор ниже объявлял
       * левым сегментом **всю строку вместе с разделителем**. Сборка добавляла
       * к такому «левому» ещё один разделитель, и каждый круг «разобрать —
       * собрать» дописывал по одному: заказчик получал
       * `- :: :: :: :: :: 👤111` (замечание 2026-09-12).
       *
       * Пустой левый сегмент здесь законен: знак списка подставит сборка, как
       * подставляет его всем таким строкам.
       */
      if (!head) {
        return { indent: indent, left: "", text: "", dates: tail };
      }
      /*
       * **Знака списка может не быть вовсе, и это обычный случай.** Человек
       * встаёт на пустую строку, печатает слово и жмёт команду — знак ставит
       * сам плагин и только если человек попросил (`Strict: add a bullet`).
       * Прежде без знака эта ветка кончалась ничем, и разбор ниже объявлял
       * левым сегментом **всю строку вместе с разделителем**: слово человека
       * становилось зоной значений Field. Сборка приписывала к такому
       * «левому» ещё один разделитель, и каждый круг «разобрать — собрать»
       * дописывал по одному — заказчик получал `- 1231 :: :: 👤111` командой и
       * `- 1231 :: :: :: :: :: 🤣…` панелью (замечание 2026-09-12, ночь).
       *
       * Это тот же случай, что абзацем выше, только слева не пусто, а стоит
       * текст: пустой левый сегмент здесь законен, знак списка подставит
       * сборка — и ровно тогда, когда настройка это разрешает.
       */
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
  /* Внутри цитаты нашего знака списка нет — его слово по В-115. Цитату строка
     несёт отступом, и разбирает его то же одно объявление. */
  const outerQuote = String(__sharedUtils.lineStartOf(indent).quote || "");

  /*
   * **Пустой левой зоне знак списка подставляется не всегда.**
   *
   * Внутри цитаты его быть не должно: на выходе из цикла значений строка
   * `> [!note] #note :: важное` давала `> [!note] - важное` — знак появлялся
   * там, где человек его не ставил. Его слово по `S41`: «вместо value остаётся
   * префикс `> -`, а должно быть `>`». У заголовка этого не случалось только
   * потому, что его знак стоит в самой левой зоне и она не пуста.
   */
  if (!left && !outerQuote) left = "-";
  /*
   * Признак объявлен один раз — `hasSideTokens`. До 2026-09-11 он стоял здесь
   * второй копией, написанной по виду токена, и расходился с разбором молча
   * (У-32). Спрашивается одно: есть ли слева хоть одно значение Field.
   *
   * **Спрашивается это у тела, а не у сегмента целиком** (2026-09-13,
   * 10.13.94): знак начала строки принадлежит платформе, и решать по нему,
   * «есть ли слева значения», нельзя. На знаке заголовка это было видно
   * прямо: `##` подходит под наше правило «что такое тег», и строка-заголовок
   * получала и разделитель при пустой зоне значений, и знак списка впереди
   * себя. Своего образца начала строки здесь тоже больше нет — он один,
   * `splitLeftPrefix`.
   */
  const leftParts = splitLeftPrefix(left);
  const hasLeftTech = hasFieldTokens(leftParts.body, fieldsShape(rules));
  if (hasLeftTech && !leftParts.prefix && !outerQuote) {
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
  if (dates || text) {
    return joinLineParts({ indent: indent, left: left, text: text, dates: dates },
      { sep1: sep1, sep2: sep2, hasLeftTokens: hasLeftTech });
  }
  if (hasLeftTech) return indent + left + " " + sep1 + " ";

  /*
   * **Осталось одно начало строки — и знак списка обязан сохранить свой
   * пробел** (10.13.155, У-157 и У-91).
   *
   * Сборка снимает пробелы по краям (`left` обрезан выше), и на строке, где
   * кроме начала ничего нет, это меняет чужую разметку: у Obsidian знак
   * списка — это знак **и пробел за ним** (`([*+-] |(\d+)([.)] ))` в `app.js`),
   * и `-` без пробела пунктом списка не является вовсе — это обычный текст.
   *
   * Находка обхода строки: после второго нажатия обе дороги пишут `"- "`, а
   * разобрать и собрать это заново давало `"-"` — то есть плагин не переживал
   * собственную запись, и следующая пересборка убрала бы человеку пункт
   * списка. Накопления нет, глазу не видно, и потому это жило шесть случаев
   * из 154, пока обход не научился нажимать дважды.
   *
   * **И знак заголовка — тот же случай, найденный стендом, а не обходом.**
   * `node tools/line_bench.js cmd tttt-next "# #aaa"` отдаёт `"# "`, и эта
   * строка собственный разбор тоже не переживала. Обход её не показывал
   * потому, что заголовка с одним значением в его корпусе не было — форма
   * дописана туда тем же заходом (У-185). У Obsidian заголовок — решётки
   * **и пробел**, ровно как у знака списка.
   *
   * Спрашивается признак **у общего дома**, а не по виду строки: пробел
   * дописывается там, где знак начала есть, а тела за ним нет. У цитаты и
   * каллаута своего пробела нет — они приезжают отступом, — и у голого текста
   * не меняется ничего.
   */
  const startOnly = __sharedUtils.lineStartOf(left);
  if ((startOnly.marker || startOnly.heading) && !startOnly.body) return indent + left + " ";
  return indent + left;
}

/**
 * В левом сегменте стоит только начало строки — и ничего больше.
 *
 * Спрашивается у общего разборщика начала (`splitLeftPrefix`), а не образцом:
 * знаков списка пять, чекбокс бывает за каждым, и своя копия правила знала
 * два (10.13.106, 10.13.107).
 */
function isBareLinePrefix(left) {
  const src = String(left || "").trim();
  if (!src) return false;
  const parts = splitLeftPrefix(src);
  return !!parts.prefix && !String(parts.body || "").trim();
}

/**
 * **Чем разделены зоны строки — объявлено здесь, и только здесь.**
 *
 * Правило простое, и вся его сложность в том, что зон может не быть:
 *
 *   - зона значений Field слева есть — за ней идёт первый разделитель;
 *   - зона текста пуста, а справа что-то есть — между разделителями остаётся
 *     **пустой слот**, два пробела: так человек видит, куда встанет слово
 *     (10.13.34);
 *   - зоны значений слева нет вовсе — первому разделителю взяться неоткуда, и
 *     правый Block отделяется **вторым** (10.13.68).
 *
 * **Почему функция отдельная.** Правило было объявлено трижды: здесь, в
 * `pkm_line_finalize_unified.js` и своим способом в `assembleFinalLine`
 * TagWheel. 2026-09-11 я починил одно из трёх и объявил работу сделанной —
 * заказчик получил строку, собранную другим путём, и написал «результат
 * становится всё хуже». Он был прав. Сборка строки делает и другое —
 * нормализует знак списка, — поэтому вынесено **только само правило**, и оба
 * места зовут его.
 */
function joinLineParts(parts, opts) {
  const indent = String(parts && parts.indent ? parts.indent : "");
  const left = String(parts && parts.left ? parts.left : "").trim();
  const text = String(parts && parts.text ? parts.text : "").trim();
  const dates = String(parts && parts.dates ? parts.dates : "").trim();
  const sep1 = String(opts && opts.sep1 ? opts.sep1 : "");
  const sep2 = String(opts && opts.sep2 ? opts.sep2 : sep1);
  const hasLeft = !!(opts && opts.hasLeftTokens);
  /*
   * **Рядом с пустой левой зоной пробела не ставится.**
   *
   * Пустой она бывает ровно внутри цитаты: наш знак списка туда не
   * подставляется (В-115), и склейка `indent + left + " " + text` оставляла
   * два пробела за знаком цитаты — `> [!note]   важное`. Во всех остальных
   * случаях левая зона непуста, и склейка прежняя.
   */
  const head = left ? left + " " : "";

  if (dates && text) {
    if (hasLeft) return indent + left + " " + sep1 + " " + text + " " + sep2 + " " + dates;
    return indent + head + text + " " + sep2 + " " + dates;
  }
  if (dates) {
    if (hasLeft) return indent + left + " " + sep1 + "  " + sep2 + " " + dates;
    /* Слот держится там, где слева **только начало строки** — знак списка,
       номер, чекбокс за ними. Здесь стоял свой образец, знавший `[-*+]` и
       голый дефис: у строки `* ` и `1. [ ] ` слот схлопывался, и человек не
       видел, куда встанет слово (10.13.107). Вопрос задаётся общим
       `splitLeftPrefix`, у которого форма знака одна на весь плагин. */
    /*
     * **Начало строки бывает и в отступе, и спрашивать надо всю голову.**
     *
     * Заголовок стоит в левой зоне (`##`), а цитата и каллаут — в отступе, и
     * левая зона при них пуста. Образец, спрошенный у одной левой зоны,
     * держал слот заголовку и схлопывал его цитате: `> ` давала `> :: #123`,
     * а `## ` — `##  :: #123`. Заказчик назвал ожидаемое сам, и оно —
     * заголовочное: «ожидал `>  :: 📅…`». Хвостовой пробел головы снимается:
     * у отступа он есть (`> `), у знака списка нет (`-`), а слот и есть те
     * два пробела, которые ставятся здесь.
     */
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


/**
 * Что в начале левого сегмента принадлежит **платформе**, а что нам.
 *
 * **Своего образца здесь больше нет** (10.13.118): вопрос задаётся общему
 * объявлению — `lineStartOf` в `shared_utils.js`. Оно и есть ответ на «что
 * принадлежит платформе»: отступ, цитата, каллаут, заголовок, знак списка и
 * задача за ним. Раньше образец стоял тут, и о цитате он не знал вовсе, а
 * скобки без знака списка считал задачей — оба его замечания, В-114 и В-115,
 * пришли отсюда.
 */
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
  /* Части начала берутся у общего объявления; здесь остаётся только выбор,
     снимать ли задачу вместе со знаком списка. */
  const start = __sharedUtils.lineStartOf(line);
  const kept = removeCheckbox ? "" : start.checkbox;
  return start.indent + start.quote + start.callout + start.heading + kept + start.body;
}

function escapeRx(s) {
  /* Правило объявлено один раз — `escapeRe` в `shared_utils.js` (У-32).
     Своя копия стояла здесь и расходилась с ним на `0` и `false`:
     `String(s || "")` отдавала пустую строку, то есть пустую
     альтернативу регулярного выражения, а та совпадает со всем. */
  return __sharedUtils.escapeRe(s);
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
  /* Начало строки снимается общим объявлением: три своих образца знали
     только дефис, только точку и скобки без знака списка. */
  left = String(__sharedUtils.lineStartOf(left).body || "").trim();
  const markers = getRightMarkers(rules);
  while (true) {
    /* Формы тега и ссылки — общий дом (10.13.141). */
    const mTag = left.match(new RegExp("^(" + __sharedUtils.TAG_TOKEN_SRC + ")\\s*"));
    if (mTag) { left = left.slice(mTag[0].length).trim(); continue; }
    const mWiki = left.match(new RegExp("^(" + __sharedUtils.WIKILINK_TOKEN_SRC + ")\\s*"));
    if (mWiki) { left = left.slice(mWiki[0].length).trim(); continue; }
    let consumedMarker = false;
    /* Значение берётся целиком, а не «до пробела»: у элемента с пробелом в
       формате второе слово иначе оставалось и объявлялось текстом
       человека (PRD 10.13.71). */
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

  /*
   * **Знак списка пустой левой зоне здесь не подставляется.**
   *
   * Здесь стояло `if (!left) left = "-"` — вторая копия правила, которое
   * объявлено в `buildFromSegments` и спрашивает там про цитату. Копия про
   * цитату не знала, и внутри каллаута шаг по элементу ставил знак списка:
   * `> ` превращалась в `> -  :: 📅…`. Его слово по `S41` (2026-09-14):
   * «в пустом коллауте активировал значение из right block — `> -  :: 📅…`,
   * ожидал `>  :: 📅…`». Починка одного объявления из двух и есть У-150: круг
   * значений по полю слева уже вёл себя верно, а по элементу справа — нет.
   *
   * Пустую зону разбирает тот, кто строку собирает: там знак подставляется
   * ровно там, где начала строки нет вовсе, и там же он приписывается к
   * значению, вставшему слева.
   */
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
 * Снять из текста значения перечисленных меток.
 *
 * **Образец значения больше не написан здесь руками.** Стояли три
 * альтернативы — дата, время, слово до пробела, — и каждая в одно слово.
 * Значение формата `YYYY-MM-DD hh:mm` занимает два, и хвост `21:32`
 * оставался в тексте: дальше он объявлялся текстом человека и возвращался
 * в строку (PRD 10.13.71, ряд заказчика от 2026-09-12). Теперь хвост
 * каждой метки приезжает из её формата — `tailByMarker`, — а где кончается
 * значение, решает общий обход.
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
  /*
   * Тело разбирается **значениями**, а не словами: значение элемента с
   * пробелом в формате (`YYYY-MM-DD hh:mm`) занимает два слова, и второе из
   * них само похоже на время. Пока разбор шёл по словам, хвост значения
   * левого элемента уезжал вправо один, без своей метки (10.13.71, `S12`
   * 2026-09-12).
   *
   * Где кончается значение — спрашивается у общего объявления
   * (`longestValueLengthAt`), а не у образца, написанного здесь.
   */
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
  /*
   * **Что в строке текст человека — правило одно**, и живёт оно в
   * `extractOriginalTextFromRawLine`. Здесь стояло второе объявление, и оно
   * было наивнее: свой обход снимал токены только **с начала** тела и
   * останавливался на первом незнакомом. Всё, что стояло за значением
   * элемента, объявлялось прозой — шаг по дате уносил теги заказчика за
   * разделитель, а вторым нажатием и в правый Block (`S12` 2026-09-12, У-150).
   *
   * Зрелое объявление снимает объявленные токены **по всему телу** (A18) и
   * знает, где кончается значение элемента с пробелом в формате (10.13.71).
   */
  var out = extractOriginalTextFromRawLine(rawLine, rules);
  if (!out) return "";

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
  var text = stripTokens(seg.text, allTokens);
  var dates = stripTokens(seg.dates, allTokens);

  /*
   * Уборка родительско-дочерних записей нужна только тогда, когда выбранное
   * значение и правда пара «родитель и ребёнок». Признак спрашивается у
   * общего объявления: здесь стояло своё, и оно считало парой любой токен с
   * косой чертой (У-150). У заказчика значения важности записаны решёткой и
   * косой чертой сразу за ней — родителем получалась одна решётка, и уборка
   * выносила из строки все теги разом.
   */
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
    /*
     * Два разных вопроса, и прежде они были склеены в один. `null` значит
     * «это не элемент, не трогаем его вовсе»; пустая строка — «элемент, но
     * своего образца у него нет», и тогда где кончается значение, решает
     * общий обход. Пока признаком служило «образец непустой», поле без
     * формата молча не переносилось вовсе (PRD 10.13.71).
     */
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
