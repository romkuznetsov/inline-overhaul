/**
 * Оформление редактора со стороны конфига: цвета и стиль тегов, метки элементов,
 * разбор строки на токены, вид TagWheel, каретка, полоса приоритета, CSS.
 * CodeMirror сюда не заходит — его зовёт `src/ui/editor/decorations.js`.
 * Вынесено из `main.js` (A3, PRD раздел 11). Модули — литеральным `require` (У-89).
 */
const __sharedUtils = require("./shared_utils.js");
const __priorityStripEngine = require("./priority_strip_engine.js");
/* Значение поля или слово человека и правила движков — общие дома, без копий (В-141, У-32). */
const __rulesShape = require("./pkm_rules_shape.js");
const __rulesHelpers = require("./pkm_rules_runtime_helpers.js");
const __linePipeline = require("./line_pipeline.js");
const __pkmOrderConfig = require("./pkm_order_config.js");
const __doneMarker = require("./done_marker_config.js");

/* Обёртки с прежними именами: тела переехавших функций не переписываются (У-11). */
function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

function normalizeHexColorInput(value) {
  const src = String(value || "").trim().toLowerCase();
  if (!src) return "";
  return /^#[0-9a-f]{6}$/.test(src) ? src : "";
}

/**
 * Чёрный или белый — у кого контраст с заливкой выше. Нужен, когда заливка задана,
 * а цвет текста пуст (иначе светлый текст темы на светлой заливке, цикл 118).
 * Пусто — заливка не разобралась.
 */
function readableTextOn(fill) {
  const hex = normalizeHexColorInput(fill);
  if (!hex) return "";
  const lin = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const l = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  /* Контраст с чёрным (l + 0.05) / 0.05 против белого 1.05 / (l + 0.05). */
  return (l + 0.05) * (l + 0.05) >= 0.0525 ? "#000000" : "#ffffff";
}

function getTagwheelHeaderColorsFromConfig(cfg) {
  const wheel = isObj(readCfgPath(cfg, "visual.tagWheel")) ? readCfgPath(cfg, "visual.tagWheel") : {};
  return {
    defaultTextColor: normalizeHexColorInput(wheel.textColor),
    /* Цвет активного Field: пусто — он красится как остальные (10.13.15). */
    activeTextColor: normalizeHexColorInput(wheel.activeTextColor),
    /* Цвет ячейки с уже выбранным значением: пусто — как остальные неактивные (2026-09-17). */
    chosenValueColor: normalizeHexColorInput(wheel.chosenValueColor),
    fillColor: normalizeHexColorInput(wheel.fillColor),
    showPrefix: wheel.showMarkers !== false,
    /* Имена всех Field полужирным, не только активного (2026-10-01). */
    boldFieldNames: wheel.boldFieldNames === true,
    /* `Highlight the tagWheel line` = off гасит только фон: метка `==…==` стоит всегда (В-287). */
    highlight: wheel.highlightLine !== false,
  };
}

function buildTagwheelPlaceholderSetFromConfig(cfg) {
  const out = new Set();
  const order = isObj(readCfgPath(cfg, "pkm.fields.order")) ? readCfgPath(cfg, "pkm.fields.order") : {};
  const labels = isObj(order.labels) ? order.labels : {};
  for (const key of Object.keys(labels)) {
    const value = String(labels[key] || "").trim();
    if (value) out.add(value);
  }
  const fields = isObj(readCfgPath(cfg, "pkm.fields")) ? readCfgPath(cfg, "pkm.fields") : {};
  const modes = [
    isObj(fields.tags) ? fields.tags : {},
    isObj(fields.links) ? fields.links : {},
  ];
  for (const mode of modes) {
    const fields = Array.isArray(mode.fields) ? mode.fields : [];
    for (const field of fields) {
      const id = String(field && field.id || "").trim();
      const placeholder = String(field && field.placeholder || "").trim();
      if (id) out.add(id);
      if (placeholder) out.add(placeholder);
    }
  }
  return out;
}

/**
 * Вид тегов на путях версии 2 (`visual.tags.*`, `visual.tagBars.*`). Имена полей
 * ответа — контракт с виджетами и проверками. Прозрачность в v2 — проценты
 * `0..100` (PRD 8.1в), наружу отдаётся доля `0..1` для CSS.
 */
function getTagVisualsFromConfig(cfg) {
  const tags = isObj(readCfgPath(cfg, "visual.tags")) ? readCfgPath(cfg, "visual.tags") : {};
  const ui = isObj(cfg && cfg.ui) ? cfg.ui : {};
  const strip = __priorityStripEngine.normalizeStripConfig(
    isObj(readCfgPath(cfg, "visual.tagBars")) ? readCfgPath(cfg, "visual.tagBars") : {});
  const pctToShare = (v, f) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return f;
    return Math.max(0, Math.min(1, n / 100));
  };
  return {
    opacityLeft: pctToShare(tags.opacityLeft, 1),
    opacityRight: pctToShare(tags.opacityRight, 1),
    /* Кегль у каждой стороны свой (2026-09-19, пункт 2): их читают разные зоны строки. */
    tagTextSizeLeftPct: Number.isFinite(Math.trunc(Number(tags.textSizePctLeft)))
      ? Math.max(50, Math.min(140, Math.trunc(Number(tags.textSizePctLeft))))
      : 100,
    tagTextSizeRightPct: Number.isFinite(Math.trunc(Number(tags.textSizePctRight)))
      ? Math.max(50, Math.min(140, Math.trunc(Number(tags.textSizePctRight))))
      : 100,
    tagBubbleWidthPct: Number.isFinite(Math.trunc(Number(tags.bubbleWidthPct)))
      ? Math.max(20, Math.min(140, Math.trunc(Number(tags.bubbleWidthPct))))
      : 100,
    tagBubbleHeightPct: Number.isFinite(Math.trunc(Number(tags.bubbleHeightPct)))
      ? Math.max(20, Math.min(140, Math.trunc(Number(tags.bubbleHeightPct))))
      : 100,
    emptyBubbleSizePct: Number.isFinite(Math.trunc(Number(tags.emptyBubblePct)))
      ? Math.max(10, Math.min(180, Math.trunc(Number(tags.emptyBubblePct))))
      : 100,
    tagShapePct: Number.isFinite(Math.trunc(Number(tags.cornersPct)))
      ? Math.max(0, Math.min(100, Math.trunc(Number(tags.cornersPct))))
      : 0,
    byTag: isObj(tags.byTag) ? tags.byTag : {},
    userTags: isObj(tags.userTags) ? tags.userTags : {},
    /* Ссылка, показанная своим текстом (2026-09-20): платформа не знает, что под узлом
       ссылка, — предпросмотр и перетаскивание возвращает плагин по тумблеру. */
    linkShownHover: readCfgPath(cfg, "visual.tags.linkShown.hoverPreview") === true,
    linkShownDrag: readCfgPath(cfg, "visual.tags.linkShown.draggable") === true,
    /*
     * Два цвета ссылки, показанной как написано (`З-37`, `В-174`, «а») — значение
     * поля `[[имя]]`; ветка своя, не та, что у ссылки, заменённой текстом.
     * Пусто — цвет темы (У-60).
     */
    linkTargetColor: normalizeHexColorInput(readCfgPath(cfg, "visual.tags.linkAsWritten.targetColor")),
    linkBracketsColor: normalizeHexColorInput(readCfgPath(cfg, "visual.tags.linkAsWritten.bracketsColor")),
    /*
     * Та же пара у гиперссылки — отдельные контролы (2026-09-22, тест 4). Перенос
     * прежнего значения — `config_migration_v2` (У-17).
     */
    hyperlinkTargetColor: normalizeHexColorInput(readCfgPath(cfg, "visual.tags.hyperlink.targetColor")),
    hyperlinkBracketsColor: normalizeHexColorInput(readCfgPath(cfg, "visual.tags.hyperlink.bracketsColor")),
    /* Адрес в круглых скобках — свой контрол (2026-09-22). Голый адрес красит `Hyperlink target color`. */
    hyperlinkAddressColor: normalizeHexColorInput(readCfgPath(cfg, "visual.tags.hyperlink.addressColor")),
    separator1TextColor: normalizeHexColorInput(tags.separator1TextColor) || normalizeHexColorInput(ui.separator1TextColor),
    separator2TextColor: normalizeHexColorInput(tags.separator2TextColor) || normalizeHexColorInput(ui.separator2TextColor),
    stripActive: strip.active === true,
    strip,
  };
}

/*
 * Классы пузыря тега — одно объявление на код и стили (Р7, правила — `styles.css`,
 * «Оформление заметки»). `io-bubble` занят пузырём Value панели (У-103).
 */
const TAG_BUBBLE_CLASS = "io-tagbubble";
const TAG_BUBBLE_EMPTY_CLASS = "io-tagbubble--empty";
const TAG_BUBBLE_FILLED_CLASS = "io-tagbubble--filled";
/*
 * Пузырь без своей заливки рисуется видом тега темы: переменные `--tag-*`, которыми
 * Obsidian рисует `a.tag` и `.cm-hashtag` (`app.css` 1.13.7); цикл 89. У Minimal
 * фон тега `transparent` и вид держит рамка — так и задумано.
 */
const TAG_BUBBLE_THEME_CLASS = "io-tagbubble--theme";
/* Свой цвет рамки (`Side`, цикл 89): рамка есть и там, где тема её не рисует. */
const TAG_BUBBLE_SIDE_CLASS = "io-tagbubble--side";

/** `#FFFFFF` в заливке или рамке значит «прозрачно» (цикл 89). Одно объявление на заметку и панель (У-32). */
function isClearColor(value) {
  return normalizeHexColorInput(value) === "#ffffff";
}
/* Пузырь, по которому можно щёлкнуть: это тег, и у него есть поиск. */
const TAG_BUBBLE_CLICKABLE_CLASS = "io-tagbubble--clickable";
/* Значение поля-ссылки, показанное своим текстом (2026-09-20, пункт 14): ведёт себя
   и рисуется как ссылка в Block. */
const LINK_SHOWN_CLASS = "io-linkshown";

/**
 * Ширина пустого пузыря при 100 %. То же число в `.io-bubble--empty` (`styles.css`);
 * сходство сторожит `tag_visual_render_tests.ts` (И-2.3).
 */
const TAG_EMPTY_BUBBLE_BASE_PX = 30;

/** Запасной кегль редактора, когда мерить нечем: 16 — умолчание Obsidian (`--font-text-size`, `app.css` 1.13.7). */
const TAG_TEXT_FALLBACK_PX = 16;

/** Кегль редактора числом; мусор и пустота дают запасной ответ. */
function baseTextPx(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : TAG_TEXT_FALLBACK_PX;
}

function computeTagVisualStyle(textSizePct, bubbleWidthPct, bubbleHeightPct, shapePct, basePx) {
  const textSize = Number.isFinite(Math.trunc(Number(textSizePct))) ? Math.max(50, Math.min(140, Math.trunc(Number(textSizePct)))) : 100;
  const bubbleWidth = Number.isFinite(Math.trunc(Number(bubbleWidthPct))) ? Math.max(20, Math.min(140, Math.trunc(Number(bubbleWidthPct)))) : 100;
  const bubbleHeight = Number.isFinite(Math.trunc(Number(bubbleHeightPct))) ? Math.max(20, Math.min(140, Math.trunc(Number(bubbleHeightPct)))) : 100;
  const shape = Number.isFinite(Math.trunc(Number(shapePct))) ? Math.max(0, Math.min(100, Math.trunc(Number(shapePct)))) : 0;
  const textScale = textSize / 100;
  const bubbleScaleX = bubbleWidth / 100;
  const bubbleScaleY = bubbleHeight / 100;
  const t = shape / 100;
  const eased = t <= 0.5
    ? (t / 0.5) * 0.45
    : (0.45 + ((t - 0.5) / 0.5) * 0.55);
  const radiusPx = Math.max(0, Math.round(16 * (1 - eased)));
  return {
    textSize,
    bubbleWidth,
    bubbleHeight,
    shape,
    borderRadiusPx: radiusPx,
    /*
     * Нижние границы опущены (2026-09-09), умолчания при сотне прежние.
     * Поле дробное, не целое: округление до точки замораживало нижнюю треть шкалы (V1).
     */
    horizontalPaddingPx: Math.max(0, Math.round(6 * bubbleScaleX * 100) / 100),
    verticalPaddingPx: Math.max(0, Math.round(3 * bubbleScaleY * 100) / 100),
    /*
     * Кегль — от кегля редактора (мера `getComputedStyle(view.contentDOM).fontSize`),
     * не от литерала: на 100 % пузырь пишется тем же кеглем, что текст рядом
     * (2026-09-19, У-227). Без меры — `TAG_TEXT_FALLBACK_PX`.
     * Дробно: кегль строки бывает нецелым (заголовок темы `16.8`).
     */
    fontSizePx: Math.max(6, Math.round(baseTextPx(basePx) * textScale * 100) / 100),
    /* Междустрочие идёт за высотой пузыря только вниз от сотни: иначе на низком
       пузыре текст не упирается в границу. */
    lineHeight: 1 + 0.2 * Math.min(1, bubbleScaleY),
  };
}

function formatFieldTokenForVisual(field, rawToken) {
  const tok = String(rawToken || "").trim();
  if (!tok) return "";
  /* Ключ вида поля-ссылки собирается тем же помощником, что в панели (2026-09-20,
     пункт 14); спрашивается вывод поля, а не форма значения. */
  if (__rulesHelpers.resolveFieldOutputMode(field, null) === "wikilink") {
    return __sharedUtils.wikilinkVisualToken(tok);
  }
  if (__sharedUtils.startsWithTagToken(tok)) return tok;
  const pref = typeof field?.prefix === "string" ? field.prefix : "#";
  if (!pref && /^\/\S+/.test(tok)) return `#${tok}`;
  return `${pref}${tok}`;
}

/** Годится ли строка ключом вида: тег или ссылка (2026-09-20). */
function isVisualTokenKey(token) {
  const key = String(token || "").trim();
  if (!key) return false;
  return __sharedUtils.startsWithTagToken(key) || __sharedUtils.isWikilinkToken(key);
}

function buildFieldTagVisualMap(cfg) {
  const out = {};
  const visuals = getTagVisualsFromConfig(cfg);
  const byTag = visuals.byTag;
  const fields = collectPkmFieldDefinitions(cfg);
  for (const field of fields) {
    const fieldId = String(field && field.id || "").trim();
    if (!fieldId) continue;
    const map = isObj(byTag[fieldId]) ? byTag[fieldId] : {};
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (const row of values) {
      const raw = typeof row === "string" ? row : String(row && row.token || "");
      const token = formatFieldTokenForVisual(field, raw);
      if (!isVisualTokenKey(token)) continue;
      const visual = isObj(map[token]) ? map[token] : null;
      if (!visual) continue;
      const nextRow = normalizeRuntimeTagVisualRow(visual);
      if (!Object.prototype.hasOwnProperty.call(out, token)) {
        out[token] = nextRow;
      } else {
        out[token] = pickStrongerTagVisualRow(out[token], nextRow, 20, 20);
      }
      const tokenNorm = normalizeVisualTokenKey(token);
      if (tokenNorm) {
        if (!Object.prototype.hasOwnProperty.call(out, tokenNorm)) {
          out[tokenNorm] = nextRow;
        } else {
          out[tokenNorm] = pickStrongerTagVisualRow(out[tokenNorm], nextRow, 20, 20);
        }
      }
    }
  }
  return out;
}

function buildGlobalTagVisualMap(cfg) {
  const out = {};
  const visuals = getTagVisualsFromConfig(cfg);
  const byTag = isObj(visuals.byTag) ? visuals.byTag : {};
  const fieldIds = Object.keys(byTag);
  for (let fi = 0; fi < fieldIds.length; fi++) {
    const fieldId = String(fieldIds[fi] || "").trim();
    if (!fieldId) continue;
    const fieldRows = isObj(byTag[fieldId]) ? byTag[fieldId] : {};
    const tokens = Object.keys(fieldRows);
    for (let ti = 0; ti < tokens.length; ti++) {
      const token = String(tokens[ti] || "").trim();
      if (!isVisualTokenKey(token)) continue;
      const row = isObj(fieldRows[token]) ? normalizeRuntimeTagVisualRow(fieldRows[token]) : null;
      if (!row) continue;
      if (!Object.prototype.hasOwnProperty.call(out, token)) {
        out[token] = row;
      } else {
        out[token] = pickStrongerTagVisualRow(out[token], row, 15, 15);
      }
      const tokenNorm = normalizeVisualTokenKey(token);
      if (tokenNorm) {
        if (!Object.prototype.hasOwnProperty.call(out, tokenNorm)) {
          out[tokenNorm] = row;
        } else {
          out[tokenNorm] = pickStrongerTagVisualRow(out[tokenNorm], row, 15, 15);
        }
      }
    }
  }
  return out;
}

function readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap) {
  const keyExact = String(token || "").trim();
  const keyNorm = normalizeVisualTokenKey(keyExact);
  const fromFieldExact = keyExact && isObj(fieldMap && fieldMap[keyExact]) ? normalizeRuntimeTagVisualRow(fieldMap[keyExact]) : null;
  const fromFieldNorm = keyNorm && isObj(fieldMap && fieldMap[keyNorm]) ? normalizeRuntimeTagVisualRow(fieldMap[keyNorm]) : null;
  const fromField = fromFieldExact || fromFieldNorm || null;

  const fromGlobalExact = keyExact && isObj(globalMap && globalMap[keyExact]) ? normalizeRuntimeTagVisualRow(globalMap[keyExact]) : null;
  const fromGlobalNorm = keyNorm && isObj(globalMap && globalMap[keyNorm]) ? normalizeRuntimeTagVisualRow(globalMap[keyNorm]) : null;
  const fromGlobal = fromGlobalExact || fromGlobalNorm || null;

  const fromUserExact = keyExact && isObj(userTags && userTags[keyExact]) ? normalizeRuntimeTagVisualRow(userTags[keyExact]) : null;
  const fromUserNorm = keyNorm && isObj(userTags && userTags[keyNorm]) ? normalizeRuntimeTagVisualRow(userTags[keyNorm]) : null;
  const fromUser = fromUserExact || fromUserNorm || null;

  const fieldOrGlobal = fromField && fromGlobal
    ? pickStrongerTagVisualRow(fromField, fromGlobal, 20, 15)
    : (fromField || fromGlobal || null);

  if (fieldOrGlobal && fromUser) return pickStrongerTagVisualRow(fieldOrGlobal, fromUser, 20, 10);
  return fieldOrGlobal || fromUser || null;
}

function normalizeRuntimeTagVisualRow(row) {
  const src = isObj(row) ? row : {};
  const visibilityRaw = String(src.visibility || "default").trim().toLowerCase();
  const visibility = ["default", "empty", "custom"].includes(visibilityRaw) ? visibilityRaw : "default";
  return {
    fillColor: normalizeHexColorInput(src.fillColor),
    textColor: normalizeHexColorInput(src.textColor),
    borderColor: normalizeHexColorInput(src.borderColor),
    visibility,
    customText: String(src.customText || "").trim(),
  };
}

function scoreTagVisualRow(row, sourceRank) {
  const safe = normalizeRuntimeTagVisualRow(row);
  const effective = resolveEffectiveTagVisualMode(safe);
  let score = effective === "custom" ? 30 : (effective === "empty" ? 20 : 10);
  if (effective === "custom" && safe.customText) score += 5;
  if (safe.fillColor) score += 2;
  if (safe.textColor) score += 1;
  if (safe.borderColor) score += 1;
  score += Number.isFinite(Number(sourceRank)) ? Number(sourceRank) : 0;
  return score;
}

function pickStrongerTagVisualRow(a, b, sourceRankA, sourceRankB) {
  const ra = normalizeRuntimeTagVisualRow(a);
  const rb = normalizeRuntimeTagVisualRow(b);
  const sa = scoreTagVisualRow(ra, sourceRankA);
  const sb = scoreTagVisualRow(rb, sourceRankB);
  if (sb > sa) return rb;
  return ra;
}

function resolveEffectiveTagVisualMode(row) {
  const mode = ["default", "empty", "custom"].includes(String(row && row.visibility || "default").trim().toLowerCase())
    ? String(row && row.visibility || "default").trim().toLowerCase()
    : "default";
  if (mode !== "custom") return mode;
  return String(row && row.customText || "").trim() ? "custom" : "empty";
}

/**
 * Чем печатается каждый токен вместо себя — один дом для пузыря и коробки скроллера.
 * Правило — `resolveEffectiveTagVisualMode` (`custom` только при заданном тексте);
 * карта собирается заранее, у скроллера строки нет (У-32).
 */
function buildTagCustomTextMap(cfg) {
  const out = {};
  const visuals = getTagVisualsFromConfig(cfg);
  const userTags = visuals.userTags;
  const fieldMap = buildFieldTagVisualMap(cfg);
  const globalMap = buildGlobalTagVisualMap(cfg);
  const tokens = new Set();
  for (const key of Object.keys(fieldMap)) tokens.add(key);
  for (const key of Object.keys(globalMap)) tokens.add(key);
  if (isObj(userTags)) for (const key of Object.keys(userTags)) tokens.add(key);
  for (const token of tokens) {
    const row = readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap);
    if (!row) continue;
    if (resolveEffectiveTagVisualMode(row) !== "custom") continue;
    const text = String(row.customText || "").trim();
    if (text) out[token] = text;
  }
  return out;
}

function buildTagTokenSetForField(cfg, selectedFieldId) {
  const out = new Set();
  const fid = String(selectedFieldId || "").trim();
  if (!fid) return out;
  const pushStrict = (value) => {
    const tok = String(value || "").trim();
    if (!tok || tok.charAt(0) !== "#") return;
    out.add(tok);
  };
  const fields = collectPkmFieldDefinitions(cfg);
  for (const field of fields) {
    const id = String(field && field.id || "").trim();
    if (id !== fid && id !== `${fid}_sub`) continue;
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (const row of values) {
      const raw = typeof row === "string" ? row : String(row && row.token || "");
      pushStrict(raw);
      const token = formatFieldTokenForVisual(field, raw);
      pushStrict(token);
    }
  }
  const byTag = isObj(readCfgPath(cfg, "visual.tags.byTag")) ? readCfgPath(cfg, "visual.tags.byTag") : {};
  const fieldMaps = [];
  if (isObj(byTag[fid])) fieldMaps.push(byTag[fid]);
  if (isObj(byTag[`${fid}_sub`])) fieldMaps.push(byTag[`${fid}_sub`]);
  for (const mp of fieldMaps) {
    for (const token of Object.keys(mp)) pushStrict(token);
  }
  return out;
}

/**
 * Разделители строки: первый — слева, последний — справа (S7, У-32). При
 * одинаковых разделителях это разные места.
 */
function lineSeparatorBounds(lineText, sep1, sep2) {
  const text = String(lineText || "");
  const s1 = String(sep1 || "").trim();
  const s2 = String(sep2 || "").trim();
  const i1 = s1 ? text.indexOf(s1) : -1;
  const i2 = s2 ? text.lastIndexOf(s2) : -1;
  return {
    first: i1,
    firstEnd: i1 >= 0 ? i1 + s1.length : -1,
    last: i2,
    lastEnd: i2 >= 0 ? i2 + s2.length : -1,
  };
}

/**
 * Конец Left Block: у первого разделителя или раньше, у первого слова текста.
 * Ответ — у разбора строки `splitLine` (`В-211`, `demoteLeftBodyToText`):
 * по положению отвечать нельзя (тест 6, цикл 89).
 */
function leftZoneEnd(src, at, splitLine) {
  if (at.first < 0 || at.first !== at.last || typeof splitLine !== "function") return at.first;
  /* Открытая панель `==…==` за разделителем — тоже правый Block (тест 3, цикл 90):
     спрашивается голова строки без разделителя. */
  const wheel = tagwheelPanelSpanInLine(src);
  const panelAfter = !!wheel && wheel.start >= at.firstEnd;
  const seg = splitLine(panelAfter ? src.slice(0, at.first) : src);
  if (!seg || !seg.text || (!panelAfter && !seg.dates)) return at.first;
  const word = String(seg.text).split(/\s+/)[0];
  for (let i = src.indexOf(word); i >= 0 && i < at.first; i = src.indexOf(word, i + 1)) {
    if (i === 0 || /\s/.test(src[i - 1])) return i;
  }
  return at.first;
}

/**
 * Есть ли у строки правый Block — у разбора строки, не по положению (тест 2,
 * цикл 103; `В-235`: значение посреди текста — слово человека).
 */
function lineHasRightZone(src, at, splitLine) {
  if (at.last < 0) return false;
  if (at.first !== at.last || typeof splitLine !== "function") return true;
  /* Открытая панель за разделителем — правый Block (см. `leftZoneEnd`). */
  const wheel = tagwheelPanelSpanInLine(src);
  if (wheel && wheel.start >= at.firstEnd) return true;
  const seg = splitLine(src);
  return !seg || !!seg.dates;
}

/** Разбор строки движками для слоя оформления; `null`, если правила не собрались. */
function buildLineSplitFromConfig(cfg) {
  try {
    const rules = __rulesShape.buildRulesForEngines(cfg);
    return function splitLine(text) {
      try { return __linePipeline.splitSegments(text, rules); } catch (_) { return null; }
    };
  } catch (_) {
    return null;
  }
}

function resolveTagVisualZone(lineText, tokenStart, sep1, sep2) {
  const at = lineSeparatorBounds(lineText, sep1, sep2);
  if (at.first >= 0 && tokenStart < at.first) return "left";
  if (at.last >= 0 && tokenStart > at.last) return "right";
  return "middle";
}

function normalizeVisualTokenKey(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  return raw.toLowerCase();
}

function rangeIntersects(aFrom, aTo, bFrom, bTo) {
  const af = Number(aFrom || 0);
  const at = Number(aTo || 0);
  const bf = Number(bFrom || 0);
  const bt = Number(bTo || 0);
  if (at <= af || bt <= bf) return false;
  return af < bt && bf < at;
}

function escapeRegExp(src) {
  /* `escapeRe` из `shared_utils.js` (У-32): копия отдавала пустую альтернативу на `0`/`false`. */
  return __sharedUtils.escapeRe(src);
}

function isRenderableStripContext(text, sep1, sep2, tokenSet) {
  const src = String(text || "");
  const trimmed = src.trim();
  if (!trimmed) return false;
  const listLineRx = /^\s*(?:[-*+]\s+|\d+\.\s+)(?:\[[^\]]\]\s+)?/;
  if (listLineRx.test(src)) return true;
  const set = tokenSet instanceof Set ? tokenSet : new Set();
  if (!set.size) return false;
  const rx = __sharedUtils.tagTokenScanner();
  let m;
  while ((m = rx.exec(src)) !== null) {
    const token = String(m[0] || "").trim();
    if (token && set.has(token)) return true;
  }
  return false;
}

function isHardLineBlockBoundary(text) {
  const src = String(text || "");
  const trimmed = src.trim();
  if (!trimmed) return true;
  if (/^---+$/.test(trimmed)) return true;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  return false;
}

/**
 * Хвост токена эмодзи-элемента — из ФОРМАТА поля, не «всё до пробела»
 * (C35, 2026-09-02). Образец — у `shared_utils`, там же, где запись значения
 * (S7, У-32): у `Random characters` формат `111111` без букв.
 */
function elementTailPatternFromFormat(format, commandRaw) {
  return __sharedUtils.buildElementTailRegexSource(format, commandRaw);
}

/**
 * Эмодзи-элементы из конфига: метка и образец хвоста. Пары, а не метки:
 * без формата поля длину хвоста не посчитать.
 */
function buildElementMarkersFromConfig(cfg) {
  const byField = isObj(readCfgPath(cfg, "pkm.fields.elements.byField"))
    ? readCfgPath(cfg, "pkm.fields.elements.byField")
    : {};
  const out = [];
  const seen = new Set();
  for (const key of Object.keys(byField)) {
    const row = isObj(byField[key]) ? byField[key] : {};
    /* Element в режиме списка (`В-247`): каждое Value — своя метка, целым словом. */
    const list = __pkmOrderConfig.elementListValues(row);
    if (list) {
      for (const value of list) {
        if (seen.has(value)) continue;
        seen.add(value);
        out.push({ marker: value, tail: "(?=\\s|$)" });
      }
      continue;
    }
    const marker = String(row.emoji || "").trim();
    if (!marker || seen.has(marker)) continue;
    seen.add(marker);
    /* Команда поля решает, чем заполнены слоты образца; без неё `Random characters` не описать. */
    const inc = isObj(row.increment) ? row.increment : {};
    out.push({ marker, tail: elementTailPatternFromFormat(row.format, inc.command) });
  }
  /* Длинные метки первыми: короткая не должна откусывать начало длинной. */
  out.sort((a, b) => b.marker.length - a.marker.length);
  return out;
}

/**
 * Всё, что плагин поставил в строку: теги, ссылки, элементы (И-2.2).
 * Пересечения: побеждает начавшийся раньше, при равном начале — длиннее
 * (`#` внутри `[[#heading]]` — часть ссылки).
 */
function scanLineVisualTokens(text, sep1, sep2, elementMarkers, blockKinds, isLinkValue, splitLine) {
  const src = String(text || "");
  const found = [];
  /* Знак заголовка `##` тегом не становится (2026-09-13); длина знака — из `shared_utils`. */
  const headingLen = __sharedUtils.headingPrefixLength(src);
  const pushAll = (rx, kind) => {
    let m;
    while ((m = rx.exec(src)) !== null) {
      const raw = String(m[0] || "");
      const token = raw.trim();
      if (!token) continue;
      if (m.index < headingLen) continue;
      found.push({ token, kind, index: m.index, end: m.index + token.length });
    }
  };
  pushAll(/\[\[[^\][\n]+\]\]/g, "link");
  const markers = Array.isArray(elementMarkers) ? elementMarkers : [];
  for (const entry of markers) {
    /* Метка бывает и строкой: так её отдавала прежняя форма списка. */
    const marker = typeof entry === "string" ? entry : String(entry && entry.marker || "");
    const tail = typeof entry === "string" ? "" : String(entry && entry.tail || "");
    if (!marker) continue;
    /* Хвост из формата поля (C35); формата нет — до пробела. */
    pushAll(new RegExp(escapeRegExp(marker) + (tail || "\\S+"), "g"), "element");
  }
  pushAll(__sharedUtils.tagTokenScanner(), "tag");

  found.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return (b.end - b.index) - (a.end - a.index);
  });

  const at = lineSeparatorBounds(src, sep1, sep2);
  const leftEnd = leftZoneEnd(src, at, splitLine);
  const hasRight = lineHasRightZone(src, at, splitLine);
  const out = [];
  let claimedTo = -1;
  for (const entry of found) {
    if (entry.index < claimedTo) continue;
    /* Между первым словом текста и разделителем — текст, а не Left Block (`leftZoneEnd`). */
    const byPlace = entry.index >= leftEnd && entry.index < at.first
      ? "middle"
      : resolveTagVisualZone(src, entry.index, sep1, sep2);
    /* Разделитель прочитан первым — за ним текст, а не правый Block (`lineHasRightZone`). */
    const zone = byPlace === "right" && !hasRight ? "middle" : byPlace;
    out.push({
      token: entry.token,
      kind: entry.kind,
      index: entry.index,
      end: entry.end,
      zone: blockValueZone(
        zone,
        entry.kind,
        blockKinds,
        entry.token,
        isLinkValue,
      ),
    });
    claimedTo = entry.end;
  }
  return out;
}

/**
 * Размеры `Inline appearance` — только для Left/Right Block, одно объявление на
 * обе отрисовки (У-159, правило 80, 2026-09-12). Скругление — вид, не размер:
 * оно едет к пузырю где угодно, как цвет.
 */
function tagVisualSizingForZone(zone, visuals) {
  const inBlock = zone === "left" || zone === "right";
  const num = (value, fallback) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
  };
  /* Единственное место, где известна зона, — величина стороны берётся здесь. */
  const sidePct = zone === "left"
    ? num(visuals && visuals.tagTextSizeLeftPct, 100)
    : zone === "right"
      ? num(visuals && visuals.tagTextSizeRightPct, 100)
      : 100;
  return {
    inBlock,
    /* На границе Block кончается только кегль (`Text size`); остальные ползунки действуют и в тексте. */
    textSizePct: inBlock ? sidePct : 100,
    bubbleWidthPct: num(visuals && visuals.tagBubbleWidthPct, 100),
    bubbleHeightPct: num(visuals && visuals.tagBubbleHeightPct, 100),
    emptyBubblePct: num(visuals && visuals.emptyBubbleSizePct, 100),
  };
}

/**
 * Строка плагина — в ней есть его разделитель (2026-09-12). Без этой границы
 * пузыри перекрасили бы теги во всём хранилище.
 */
function lineBelongsToPlugin(lineText, sep1, sep2) {
  const at = lineSeparatorBounds(lineText, sep1, sep2);
  return at.first >= 0 || at.last >= 0;
}

/**
 * Значения в Block стоят серединой строки, не низом (`G4`, 2026-09-16) — и
 * ссылки, и элементы, не только пузырь. Класс, а не инлайн-стиль (Р7, У-125);
 * величины едут стилем, они считаются на отрисовке.
 */
const BLOCK_VALUE_CLASS = "io-blockvalue";

/* Куски ссылки как написано (`З-37`) — одно объявление на код и стили (У-103).
   `io-link__*` заняты предпросмотром панели. */
const LINK_TARGET_CLASS = "io-linkwritten__target";

const LINK_BRACKETS_CLASS = "io-linkwritten__mark";

/**
 * Скобка, цель, скобка ссылки как написано. Цель и подпись — `wikilinkTargetOf`;
 * токен не `[[…]]` кусков не даёт (У-209).
 */
function writtenLinkParts(token, from, to) {
  const src = String(token == null ? "" : token);
  if (to - from !== src.length) return null;
  if (src.length < 5) return null;
  if (src.slice(0, 2) !== "[[" || src.slice(-2) !== "]]") return null;
  return {
    openFrom: from, openTo: from + 2,
    targetFrom: from + 2, targetTo: to - 2,
    closeFrom: to - 2, closeTo: to,
  };
}

/*
 * Гиперссылки в любой заметке (`В-181`, 2026-09-22): `[подпись](адрес)` и голый
 * адрес (`scheme://`, `mailto:`, `www.`). Wikilink не входит — его красит дорога
 * Field. О Block этот разбор не решает ничего: только два цвета.
 * Длина схемы ограничена 15 знаками: открытый `*` перед `://` давал 251 мс на
 * перерисовку строки в 22 тыс. знаков, с пределом — 1,4 мс.
 */
const BARE_LINK_RE = /(?:[A-Za-z][A-Za-z0-9+.-]{0,14}:\/\/|mailto:|www\.)[^\s<>"'`]+/g;
const MD_LINK_RE = /(!?)\[([^\][\n]*)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g;
/* Хвостовые знаки предложения, а не адреса. Список закрытый: `/`, `#`, `=` остаются. */
const LINK_TAIL_MARKS = ".,;:!?" + String.fromCharCode(34) + "')]}»";

/** Отрезки, закрытые обратными кавычками: внутри кода ссылок не бывает. */
function inlineCodeSpans(src) {
  const out = [];
  const re = /`+/g;
  let open = null;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (!open) { open = { at: m.index, len: m[0].length }; continue; }
    if (m[0].length !== open.len) continue;
    out.push({ start: open.at, end: m.index + m[0].length });
    open = null;
  }
  return out;
}

function insideAny(spans, at) {
  for (const s of spans) if (at >= s.start && at < s.end) return true;
  return false;
}

/**
 * Ссылки строки: отрезок подписи (цвет текста ссылки) и отрезки разметки (цвет
 * скобок). Голый адрес — без подписи.
 */
function scanHyperlinksInLine(text) {
  const src = String(text || "");
  const code = inlineCodeSpans(src);
  const out = [];
  const claimed = [];
  const free = (start, end) => {
    if (insideAny(code, start)) return false;
    for (const c of claimed) if (start < c.end && end > c.start) return false;
    return true;
  };
  /* Wikilink — чужая дорога: его отрезки закрываются до всякого разбора. */
  const wiki = /\[\[[^\][\n]*\]\]/g;
  let w;
  while ((w = wiki.exec(src)) !== null) claimed.push({ start: w.index, end: w.index + w[0].length });

  let m;
  MD_LINK_RE.lastIndex = 0;
  while ((m = MD_LINK_RE.exec(src)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!free(start, end)) continue;
    /* `![…](…)` — вставка картинки, а не ссылка: читать там нечего. */
    if (m[1]) { claimed.push({ start, end }); continue; }
    const labelFrom = start + 1 + m[1].length;
    const labelTo = labelFrom + String(m[2] || "").length;
    /* Адрес отделён от скобок (2026-09-22): кусков три — `[`, `](`, `)`. Границы — от
       известных `labelTo`/`end`, не вторым разбором (У-32). */
    const addressFrom = Math.min(labelTo + 2, end);
    const addressTo = Math.max(addressFrom, end - 1);
    out.push({
      kind: "md",
      start,
      end,
      labelFrom,
      labelTo,
      marks: [
        { from: start, to: labelFrom },
        { from: labelTo, to: addressFrom },
        { from: addressTo, to: end },
      ],
      address: { from: addressFrom, to: addressTo },
    });
    claimed.push({ start, end });
  }

  BARE_LINK_RE.lastIndex = 0;
  while ((m = BARE_LINK_RE.exec(src)) !== null) {
    let end = m.index + m[0].length;
    while (end > m.index && LINK_TAIL_MARKS.indexOf(src[end - 1]) >= 0) end--;
    if (end <= m.index) continue;
    if (!free(m.index, end)) continue;
    /* Голый адрес — адрес, а не подпись: красит `hyperlink-address-color` (2026-09-22,
       решение сменил он сам после `В-191`); `labelFrom` равен `labelTo`. */
    out.push({
      kind: "bare",
      start: m.index,
      end,
      labelFrom: m.index,
      labelTo: m.index,
      marks: [],
      address: { from: m.index, to: end },
    });
    claimed.push({ start: m.index, end });
  }

  out.sort((a, b) => a.start - b.start);
  return out;
}

/** Нужен ли этому куску класс «значение в Block». Ответ один на все дороги. */
function blockValueClassFor(entry, visuals) {
  return tagVisualSizingForZone(String(entry && entry.zone || ""), visuals).inBlock
    ? BLOCK_VALUE_CLASS
    : "";
}

/**
 * Прозрачность блока и кегль для токена без своего цвета — стилем, не подменой:
 * подмена `[[Note]]` своим узлом забрала бы у ссылки клик. Текст между
 * разделителями не трогается (2026-09-01).
 */
function blockValueStyleVars(entry, visuals, basePx) {
  const sizing = tagVisualSizingForZone(String(entry && entry.zone || ""), visuals);
  if (!sizing.inBlock) return { inBlock: false, opacity: null, fontSizePx: null, risePx: null };
  const opacityRaw = Number(entry && entry.zoneOpacity);
  const sizePct = Number(sizing.textSizePct);
  const opacity = Number.isFinite(opacityRaw) && opacityRaw < 1 ? opacityRaw : null;
  if (!Number.isFinite(sizePct) || sizePct === 100) {
    return { inBlock: true, opacity, fontSizePx: null, risePx: null };
  }
  /* Та же функция, что у пузыря: иначе текст в блоке разъедется с пузырём. */
  const st = computeTagVisualStyle(sizePct, 100, 100, 0, basePx);
  /* Подъём тот же, что у пузыря (2026-09-19): на сотне базовая линия, мельче —
     подъём на половину разницы кеглей; одно правило на ссылку и элемент (У-206). */
  const rise = Math.round((baseTextPx(basePx) - st.fontSizePx) / 2 * 100) / 100;
  return { inBlock: true, opacity, fontSizePx: st.fontSizePx, risePx: rise || null };
}

/**
 * То же строкой стиля — для отрезка, который рисует платформа. Величины — из
 * `blockValueStyleVars`; у заменённой ссылки они едут переменными `--io-*` (Р7).
 */
function buildBlockStyleCss(entry, visuals, basePx) {
  const vars = blockValueStyleVars(entry, visuals, basePx);
  if (!vars.inBlock) return "";
  const parts = [];
  if (vars.opacity !== null) parts.push("opacity: " + vars.opacity + ";");
  if (vars.fontSizePx !== null) parts.push("font-size: " + vars.fontSizePx + "px;");
  if (vars.risePx !== null) parts.push("vertical-align: " + vars.risePx + "px;");
  return parts.join(" ");
}

function formatTagwheelDisplayToken(token, showPrefix) {
  let src = String(token || "");
  let t = src.trim();
  if (!t) return src;
  /* Цель ссылки — из общего дома: копии по-разному отбрасывали подпись после черты. */
  const linkTarget = __sharedUtils.wikilinkTargetOf(t);
  if (linkTarget) return linkTarget;
  if (showPrefix) return src;
  if (/^#\//.test(t)) return t.replace(/^#\//, "");
  if (__sharedUtils.startsWithTagToken(t)) return t.replace(/^#/, "");
  if (/^[^A-Za-zА-Яа-я0-9\[]+/.test(t)) {
    let stripped = t.replace(/^[^A-Za-zА-Яа-я0-9\[]+/, "");
    if (/^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2}|\d)/.test(stripped)) return stripped;
  }
  return t;
}

/*
 * Виджет подмены платформа рисует рядом с `span.cm-highlight`, а не внутри, и
 * заливку полосы он не получает (стенд `MD7`, цикл 110) — даётся переменной
 * `--io-twfill` на строке `io-twline`.
 */
const TAGWHEEL_FILL_STYLE_CSS = [
  ".markdown-source-view.mod-cm6 .inline-overhaul-tw-token {",
  "  font: inherit;",
  "  color: var(--io-tw-token-color, inherit);",
  "  background-color: var(--io-twfill, var(--text-highlight-bg));",
  "}",
].join("\n");

/*
 * Классы своего слоя каретки — одно объявление на стили и слой: разойдутся —
 * каретки не видно при зелёных проверках (У-32, У-56). `io-caret` занят кареткой
 * предпросмотра панели (У-65).
 */
const CARET_LAYER_CLASS = "io-editor-caretlayer";

const CARET_MARKER_CLASS = "io-editor-caret";

/* Классы подсветки прыжка (Н5) свои: `io-jumpline`/`io-jumpflash` заняты
   предпросмотром панели (У-103). */
const JUMP_FLASH_LAYER_CLASS = "io-editor-jumplayer";

const JUMP_FLASH_MARKER_CLASS = "io-editor-jumpflash";

/**
 * Каретка: цвет, толщина и мерцание (10.13.33).
 *
 * Цвет — три объявления: `.cm-cursor` (`border-left`), `caret-color` для родной
 * каретки браузера при выключенном `drawSelection` и переменная `--caret-color`.
 * Толщина двигает и `margin-left` (у Obsidian `1.2px`/`-0.6px` — центр на границе
 * символа), иначе каретка уезжает вправо (`app.js` 1.13.7, У-44).
 * Главный пустой отрезок редактор заметки не рисует (его копия `drawSelection`:
 * `range.empty ? !isMain : drawRangeCursor`) — это родная каретка, у неё из CSS
 * только `caret-color` (2026-09-06). Поэтому форма заводит свой слой
 * (`createCaretLayerExtension`) и гасит родную; `.cm-cursor` — за выделением и
 * вторыми курсорами.
 * Мерцание — на `.cm-cursorLayer`: CodeMirror пишет `animationDuration` инлайном,
 * отсюда `!important`; «не мигает» — снятая анимация, ноль замер бы невидимым.
 * Селекторы прибиты к `.markdown-source-view` — поля панели и поиск не трогаются (Ц4).
 */
function buildCaretStyleCss(look) {
  const cfg = isObj(look) ? look : {};
  const value = String(cfg.color || "").trim();
  const width = Number(cfg.width);
  const blinkMs = Number(cfg.blinkMs);
  const out = [];

  if (value) {
    out.push(
      ".markdown-source-view.mod-cm6 {",
      "  --caret-color: " + value + ";",
      "}",
      ".markdown-source-view.mod-cm6 .cm-content {",
      "  caret-color: " + value + ";",
      "}"
    );
  }
  if (value || Number.isFinite(width)) {
    out.push(
      ".markdown-source-view.mod-cm6 .cm-cursor,",
      ".markdown-source-view.mod-cm6 .cm-cursor-primary,",
      ".markdown-source-view.mod-cm6 .cm-dropCursor {"
    );
    if (value) out.push("  border-left-color: " + value + ";");
    if (Number.isFinite(width)) {
      out.push("  border-left-width: " + width + "px;");
      out.push("  margin-left: " + (-width / 2) + "px;");
    }
    out.push("}");
  }
  if (Number.isFinite(blinkMs)) {
    out.push(".markdown-source-view.mod-cm6 .cm-cursorLayer {");
    out.push(blinkMs > 0
      ? "  animation-duration: " + blinkMs + "ms !important;"
      : "  animation: none !important;");
    out.push("}");
  }
  if (Number.isFinite(width) || Number.isFinite(blinkMs)) {
    const w = Number.isFinite(width) ? width : 2;
    out.push(
      /* Родная каретка гасится, только когда её заменяет своя. */
      ".markdown-source-view.mod-cm6 .cm-content {",
      "  caret-color: transparent;",
      "}",
      ".markdown-source-view.mod-cm6 ." + CARET_LAYER_CLASS + " {",
      "  pointer-events: none;",
      "  display: none;",
      "}",
      ".markdown-source-view.mod-cm6 ." + CARET_LAYER_CLASS + " ." + CARET_MARKER_CLASS + " {",
      /* Цвет — переменной: его объявляет первая половина группы (У-32); нет её — тема. */
      "  border-left: " + w + "px solid var(--caret-color);",
      "  margin-left: " + (-w / 2) + "px;",
      "  pointer-events: none;",
      "}",
      ".markdown-source-view.mod-cm6 .cm-focused > .cm-scroller > ." + CARET_LAYER_CLASS + " {",
      "  display: block;",
      Number.isFinite(blinkMs) && blinkMs > 0
        ? "  animation: steps(1) io-caret-blink " + blinkMs + "ms infinite;"
        : "  animation: none;",
      "}"
    );
  }
  return out.join("\n");
}

/**
 * Скорость 1..10 в миллисекунды (Ц7). Пятёрка — нынешний `cursorBlinkRate` 1200
 * Obsidian и умолчание слайдера. Ноль сюда не доходит: «не мигает» — снятие анимации.
 */
function caretBlinkMsFromSpeed(speed) {
  const s = Number.isFinite(speed) ? Math.max(1, Math.min(10, speed)) : 5;
  return 2200 - s * 200;
}

/**
 * Включён ли модуль `Visual` (`В-253`, 2026-10-01). Выключенный гасит всё, что рисует
 * вкладка Visual; цвета tagWheel и коробки скроллера остаются. Спрашивают геттеры
 * здесь и входы двух слоёв `decorations.js` (BUGHUNT D5). Нет ключа — включён.
 */
function visualModuleOn(cfg) {
  return readCfgPath(cfg, "features.visual.enabled") !== false;
}

/**
 * Вид каретки: цвет включает `enabled`, толщину и мерцание — `shapeEnabled` (Ц6).
 * Выключенная половина не объявляет ничего — берёт тема.
 */
function caretLookFromConfig(cfg) {
  const caret = isObj(readCfgPath(cfg, "visual.caret")) ? readCfgPath(cfg, "visual.caret") : {};
  const look = { color: "", width: NaN, blinkMs: NaN };
  if (!visualModuleOn(cfg)) return look;
  if (caret.enabled === true) look.color = normalizeHexColorInput(caret.color);
  if (caret.shapeEnabled === true) {
    const width = Number(caret.width);
    look.width = Number.isFinite(width) ? width : 2;
    const speed = Number(caret.blinkSpeed);
    look.blinkMs = Number.isFinite(speed) && speed <= 0 ? 0 : caretBlinkMsFromSpeed(speed);
  }
  return look;
}

/**
 * Подсветка места прыжка из конфига (Н5): границы — как у нормализации, цвет —
 * общим приведением. Пустой цвет — «взять у темы» (У-60).
 */
function jumpFlashLookFromConfig(cfg) {
  const flash = isObj(readCfgPath(cfg, "visual.jumpFlash"))
    ? readCfgPath(cfg, "visual.jumpFlash")
    : {};
  const num = (raw, dflt) => {
    const n = Math.trunc(Number(raw));
    return Number.isFinite(n) ? n : dflt;
  };
  return {
    enabled: flash.enabled === true && visualModuleOn(cfg),
    inLine: flash.inLine === true,
    color: normalizeHexColorInput(flash.color),
    radius: num(flash.radius, 18),
    fadeMs: num(flash.fadeMs, 450),
    quietMs: num(flash.quietMs, 0),
  };
}

/** Включена ли форма каретки: тот же тумблер, что и у блока стилей (У-32). */
function caretShapeActive(plugin) {
  try {
    return Number.isFinite(caretLookFromConfig(plugin.getConfig()).width);
  } catch (_) {
    return false;
  }
}

/**
 * Стоит ли каретка в конце непустой строки, за которой может стоять виджет
 * (критичный дефект 2026-09-06). `forRange` меряет пустой отрезок справа
 * (`coordsAtPos(head, assoc || 1)`), а справа от конца строки — виджет
 * `Floating button` (`side: 1`, `resolveInline`), и каретка уезжала на `Distance
 * from the text` (`app.js` 1.13.7, У-44). Поэтому на конце строки мерить слева.
 */
function caretSitsAtLineEnd(state, head) {
  try {
    const line = state.doc.lineAt(head);
    return line.to === head && line.to > line.from;
  } catch (_) {
    /* Разбор строки — дело состояния редактора. Нет его — меряем как раньше. */
    return false;
  }
}

/* ---- заливка Left и Right Block (З-7) --------------------------------- */

/**
 * Заливка блоков — свой слой прямоугольников за текстом, как выделение CodeMirror
 * (2026-09-08). Не `Decoration.mark`: длинный отрезок платформа режет по границам
 * токенов, и скругление с полями разваливаются (У-68).
 */
const BLOCK_FILL_LAYER_CLASS = "io-blockfill-layer";
const BLOCK_FILL_MARKER_CLASS = "io-blockfill-marker";

/** Умолчание прозрачности подложки: видно, но текст читается поверх. */
const BLOCK_FILL_DEFAULT_OPACITY_PCT = 12;

/**
 * Умолчания выхода подложки за написанное. Оба больше нуля: иначе блок из одного
 * тега прячет подложку под пузырём (S7, 2026-09-09).
 */
const BLOCK_FILL_DEFAULT_HEIGHT_PCT = 60;
/** Умолчание ширины — середина шкалы, «до разделителя» (S7, 2026-09-09). */
const BLOCK_FILL_DEFAULT_WIDTH_PCT = 50;

/**
 * Шкала высоты — доля свободного места до краёв строки, а не точки: в точках
 * верх шкалы был мёртв (2026-09-09). Ноль — ровно по написанному, сотня — вся
 * зрительная строка; соседние полосы не наезжают.
 */
const BLOCK_FILL_MAX_HEIGHT_PCT = 100;

/**
 * Доля написанного в зрительной строке — запас, когда платформа не отдала
 * `heightOracle.textHeight`.
 */
const BLOCK_FILL_TEXT_HEIGHT_SHARE = 0.7;

/**
 * Какой Block получает полосу (З-12, 2026-09-19), умолчание `both`. Значения —
 * имена зон разбора строки. Второй дом умолчания — схема панели (правило 106).
 */
const BLOCK_FILL_DIRECTIONS = ["left", "right", "both"];
const BLOCK_FILL_DEFAULT_DIRECTION = "both";

/**
 * Получает ли сторона полосу — одно правило на слой и предпросмотр (У-217).
 * Незнакомое значение — `both`: полоса украшение.
 */
function blockFillZoneWanted(direction, zone) {
  const dir = String(direction || "").trim();
  const known = BLOCK_FILL_DIRECTIONS.indexOf(dir) !== -1 ? dir : BLOCK_FILL_DEFAULT_DIRECTION;
  if (known === "both") return true;
  return known === String(zone || "").trim();
}

/**
 * Целое из конфига в границах; мусор и пустота — умолчание. `null` и `""`
 * отсекаются до `Number`: тот дал бы ноль, а ноль — законное значение.
 */
function blockFillIntOr(raw, min, max, fallback) {
  if (raw === null || raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** Что о заливке говорит конфиг: включена ли, цвет, густота и выход за написанное. */
function blockFillLookFromConfig(cfg) {
  const src = isObj(readCfgPath(cfg, "visual.tags.blockFill"))
    ? readCfgPath(cfg, "visual.tags.blockFill")
    : {};
  const pct = Number(src.opacity);
  return {
    enabled: src.enabled === true && visualModuleOn(cfg),
    /* Пусто = цвет темы (У-60), подставляется в правиле стилей. */
    color: normalizeHexColorInput(src.color),
    opacity: Number.isFinite(pct)
      ? Math.max(0, Math.min(100, Math.trunc(pct))) / 100
      : BLOCK_FILL_DEFAULT_OPACITY_PCT / 100,
    /* Высота — доля свободного места: ноль по написанному, сотня — вся строка. */
    heightPct: blockFillIntOr(src.heightPct, 0, BLOCK_FILL_MAX_HEIGHT_PCT, BLOCK_FILL_DEFAULT_HEIGHT_PCT),
    /* Ширина — доля расстояния до разделителя. */
    widthPct: blockFillIntOr(src.widthPct, 0, 100, BLOCK_FILL_DEFAULT_WIDTH_PCT),
    /* Сторона (З-12); решает `blockFillZoneWanted`. */
    direction: BLOCK_FILL_DIRECTIONS.indexOf(String(src.direction || "").trim()) !== -1
      ? String(src.direction).trim()
      : BLOCK_FILL_DEFAULT_DIRECTION,
  };
}

/**
 * Горизонтальный выход подложки, точки. Шкала с переломом на середине (S7,
 * 2026-09-09): `nearPx` — до ближней границы разделителя (50 % — у разделителя),
 * `farPx` — до дальней (100 % — включая его). Доли измеренного; мера не измерена
 * или отрицательна — своей части шкалы нет.
 */
function blockFillPadXPx(look, nearPx, farPx) {
  const pct = Math.min(100, Math.max(0, Number(look && look.widthPct)));
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  const near = Number(nearPx);
  const nearOk = Number.isFinite(near) && near > 0 ? near : 0;
  if (pct <= 50) return (nearOk * pct) / 50;
  const far = Number(farPx);
  /* Разделитель всегда шире промежутка; обратное — замер не удался. */
  const sep = Number.isFinite(far) && far > nearOk ? far - nearOk : 0;
  return nearOk + (sep * (pct - 50)) / 50;
}

/** Высота накрытого подложкой — одно объявление для высоты и вертикали (`G4`, У-32). */
function blockFillWrittenHeightPx(rowHeightPx, textHeightPx, bubbleHeightPx) {
  const lineH = Number(rowHeightPx);
  const textH = Number(textHeightPx);
  const bubbleH = Number(bubbleHeightPx);
  return Math.max(
    Number.isFinite(textH) && textH > 0 ? textH : lineH * BLOCK_FILL_TEXT_HEIGHT_SHARE,
    Number.isFinite(bubbleH) && bubbleH > 0 ? bubbleH : 0,
  );
}

/**
 * Высота подложки — одна на все строки (S7, 2026-09-09). Считается, не мерится:
 * `RectangleMarker.forRange` берёт ящики краёв отрезка, а ящик ссылки Obsidian выше.
 * Слагаемые: `textHeightPx`, `bubbleHeightPx`, доля `heightPct` свободного места
 * поровну вверх и вниз; прижим к высоте зрительной строки — своей у каждой строки,
 * не `defaultLineHeight`.
 */
function blockFillBandHeightPx(look, rowHeightPx, textHeightPx, bubbleHeightPx) {
  const lineH = Number(rowHeightPx);
  if (!Number.isFinite(lineH) || lineH <= 0) return 0;
  /* `written` — значения Block, кегль приводит звавший (`blockFillWrittenTextHeightPx`). */
  const written = blockFillWrittenHeightPx(lineH, textHeightPx, bubbleHeightPx);
  /* Прижим последним: ловит и написанное выше строки (крупный пузырь). */
  const pct = Math.max(0, Math.min(BLOCK_FILL_MAX_HEIGHT_PCT, Number(look && look.heightPct) || 0));
  const room = Math.max(0, lineH - written);
  return Math.max(1, Math.min(lineH, written + (room * pct) / 100));
}

/**
 * Можно ли верить насчитанному числу зрительных строк: им делится высота строки,
 * и недосчёт опускает подложку (2026-09-13). Насчитали меньше, чем умещается по
 * умолчанию редактора, — не верить; столько же или больше — верить (У-133).
 * Ряды — по нижней границе, не округлением. Мер нет — верить счёту.
 */
function blockFillRowCountTrusted(counted, blockHeight, lineHeight) {
  const rows = Math.trunc(Number(counted) || 0);
  const height = Number(blockHeight);
  const lineH = Number(lineHeight);
  if (!(rows > 0)) return false;
  if (!Number.isFinite(height) || height <= 0) return true;
  if (!Number.isFinite(lineH) || lineH <= 0) return true;
  return rows >= Math.floor(height / lineH);
}

/**
 * Высота написанного в Block — с кеглем значений (`Tags text size`), а не слова
 * человека: иначе подложка выше значений и середины не совпадают (`G4`,
 * 2026-09-16). От настроек, не от содержимого: полоса одинакова во всех строках.
 */
function blockFillWrittenTextHeightPx(visuals, textHeightPx, zone) {
  const v = isObj(visuals) ? visuals : {};
  const textH = Number(textHeightPx);
  if (!Number.isFinite(textH) || textH <= 0) return textH;
  const share = tagVisualSizingForZone(String(zone || ""), v).textSizePct;
  return textH * share / 100;
}

/**
 * Высота пузыря от настроек. Кегль — тега (`var(--tag-size)`, У-260), не строки:
 * иначе вернётся `G4` (правило 87). Нет кегля тега — кегль строки. Размер пузыря
 * объявлен один раз, со стилем (У-32).
 */
function blockFillBubbleHeightPx(visuals, zone, basePx, tagBasePx) {
  const v = isObj(visuals) ? visuals : {};
  const forBubble = Number.isFinite(Number(tagBasePx)) && Number(tagBasePx) > 0 ? Number(tagBasePx) : basePx;
  const st = computeTagVisualStyle(
    tagVisualSizingForZone(String(zone || ""), v).textSizePct,
    v.tagBubbleWidthPct, v.tagBubbleHeightPct, 0, forBubble);
  return st.fontSizePx * st.lineHeight + st.verticalPaddingPx * 2;
}


/**
 * Конец знака начала строки (отступ, цитата, маркер, чекбокс, решётки) без пробела
 * за ним: в пробел подложке расти можно, на чекбокс нельзя. Правило — `shared_utils`.
 */
function blockFillPrefixGlyphEnd(text) {
  const src = String(text || "");
  const at = __sharedUtils.linePrefixLength(src, true);
  let end = Math.max(0, Math.min(src.length, at));
  while (end > 0 && (src[end - 1] === " " || src[end - 1] === "\t")) end -= 1;
  return end;
}

/**
 * Род значений каждого Block по порядку Fields: полоса принадлежит Block, и в
 * Block без значений красить нечем (2026-09-17, ссылка `Inline to note`).
 * Спрашивается Order, не видимое в панели (правило 107, В-137); дочерние поля —
 * род родителя. `wikilink` порядка = `link` разбора, перевод один.
 * Метка `Inline to note` принадлежит Block по имени, не по роду (2026-09-18,
 * `Source marker position`).
 */
function buildBlockKindsFromConfig(cfg) {
  const order = isObj(readCfgPath(cfg, "pkm.fields.order"))
    ? readCfgPath(cfg, "pkm.fields.order")
    : {};
  const types = isObj(order.types) ? order.types : {};
  const kindOf = (raw) => {
    const name = String(raw || "").trim().toLowerCase();
    if (name === "wikilink" || name === "link") return "link";
    if (name === "element") return "element";
    if (name === "tag") return "tag";
    return "";
  };
  const kindsOf = (list) => {
    const out = new Set();
    for (const raw of Array.isArray(list) ? list : []) {
      const key = String(raw || "").trim();
      if (!key) continue;
      const kind = kindOf(types[key] !== undefined ? types[key] : types[key.replace(/_sub$/, "")]);
      if (kind) out.add(kind);
    }
    return out;
  };
  /* Метка обработанной строки и её сторона — из `getSourceMarksFromConfig`, одним разбором (У-32). */
  const marks = getSourceMarksFromConfig(cfg);
  const own = { left: new Set(), right: new Set() };
  const markToken = String(marks && marks.token || "").trim();
  if (marks && marks.moduleOn && markToken) {
    const side = String(readCfgPath(cfg, "transform.inline2note.sourceProcessing.panel") || "right")
      .trim().toLowerCase() === "left" ? "left" : "right";
    own[side].add(markToken);
  }
  /* Метка отмеченной строки не из Values встаёт временным Field в свой Block
     (`checkbox_done_marker.js`) и принадлежит ему по имени (правило 141). */
  const doneToken = String(marks && marks.doneToken || "").trim();
  if (doneToken && !__doneMarker.fieldOfMarker(cfg, doneToken)) {
    own[__doneMarker.readDoneMarker(cfg).panel].add(doneToken);
  }
  return { left: kindsOf(order.left), right: kindsOf(order.right), own: own };
}

/** Стоит ли в этом Block наш собственный токен — тот, что кладёт туда плагин. */
function blockOwnsToken(blockKinds, zone, token) {
  const own = isObj(blockKinds) && isObj(blockKinds.own) ? blockKinds.own[zone] : null;
  const t = String(token || "").trim();
  if (!t) return false;
  return own instanceof Set ? own.has(t) : (Array.isArray(own) ? own.indexOf(t) >= 0 : false);
}

/**
 * Бывают ли в этом Block значения такого рода. Ответа «не спрашивали» нет нарочно:
 * молчаливое «да» вернуло бы дефект (У-56).
 */
function blockHoldsKind(blockKinds, zone, kind) {
  const side = isObj(blockKinds) ? blockKinds[zone] : null;
  if (side instanceof Set) return side.has(kind);
  return Array.isArray(side) ? side.indexOf(kind) >= 0 : false;
}

/**
 * Зона токена — та, где он стоит, если в этом Block такие значения бывают; иначе
 * середина (2026-09-17: кегль Block только для values). Одно правило для полосы,
 * кегля и прозрачности (У-213, правило 135). Цена: при пустом левом Block написанное
 * слева — текст. «Не спросили» = «не бывает» (У-56).
 */
function blockValueZone(zone, kind, blockKinds, token, isLinkValue) {
  const side = String(zone || "");
  if (side !== "left" && side !== "right") return side;
  /* Свой токен принадлежит Block по имени: его ставит плагин (`Inline to note` в пустом левом Block). */
  if (blockOwnsToken(blockKinds, side, token)) return side;
  if (!blockHoldsKind(blockKinds, side, kind)) return "middle";
  /*
   * Для ссылки рода мало (2026-09-18): слот текста за первым разделителем по
   * положению неотличим от правого Block. Спрашивается, названа ли ссылка значением
   * поля (В-141). Тег остаётся значением по роду (`#processed`).
   */
  if (kind === "link" && typeof isLinkValue === "function" && !isLinkValue(token)) return "middle";
  return side;
}

/**
 * Признак «ссылка — значение поля» для слоя оформления; дом признака — у движков.
 * Строится раз на проход отрисовки (0,2 мс), от строки не зависит.
 */
let wikilinkTestFailureReported = false;

function buildWikilinkValueTestFromConfig(cfg) {
  try {
    return __rulesHelpers.makeWikilinkValueTest(__rulesShape.buildRulesForEngines(cfg));
  } catch (e) {
    /*
     * Оформление не роняет заметку (семья «украшение»): отказ — в журнал раз за сеанс,
     * слой отвечает по-прежнему. Сюда доходит только конфиг без `migrateConfig`.
     */
    if (!wikilinkTestFailureReported) {
      wikilinkTestFailureReported = true;
      console.error("[inline-overhaul] правила для признака ссылки не собрались: "
        + (e && e.message ? e.message : e) + "; оформление Block вернулось к роду значения");
    }
    return function isFieldWikilinkValueFallback(token) {
      return __sharedUtils.isWikilinkToken(String(token || "").trim());
    };
  }
}

/**
 * Отрезки под подложкой (З-7). Зоны — из `scanLineVisualTokens`, без второго
 * разбора (У-32). От первого значения блока до последнего; значений нет — отрезка нет.
 */
function blockFillSpansInLine(text, sep1, sep2, elementMarkers, blockKinds, isLinkValue, splitLine) {
  const src = String(text || "");
  /* Принадлежность значения Block решает `blockValueZone` при разборе строки; у
     движков ответ свой (10.13.187). */
  const tokens = scanLineVisualTokens(src, sep1, sep2, elementMarkers, blockKinds, isLinkValue, splitLine);
  const at = lineSeparatorBounds(src, sep1, sep2);
  /* Разделитель прочитан вторым — Left Block кончается у текста (`leftZoneEnd`). */
  const leftEnd = leftZoneEnd(src, at, splitLine);
  const out = [];
  for (const zone of ["left", "right"]) {
    let start = -1;
    let end = -1;
    for (const hit of tokens) {
      if (hit.zone !== zone) continue;
      if (start < 0 || hit.index < start) start = hit.index;
      if (hit.end > end) end = hit.end;
    }
    if (start < 0 || end <= start) continue;
    /*
     * Промежуток до разделителя — мера `Band width` (S7): сотня — вплотную.
     * Слева он за блоком, справа перед ним; пустой — законно (нет пробела).
     */
    const gapFrom = zone === "left" ? end : at.lastEnd;
    const gapTo = zone === "left" ? leftEnd : start;
    /* Дальняя граница разделителя — вторая половина шкалы `Band width`: на сотне он включён. */
    const sepFar = zone === "left" ? (leftEnd === at.first ? at.firstEnd : leftEnd) : at.last;
    out.push({
      zone,
      start,
      end,
      gapFrom: gapTo > gapFrom ? gapFrom : -1,
      gapTo: gapTo > gapFrom ? gapTo : -1,
      sepFar: gapTo > gapFrom && sepFar >= 0 ? sepFar : -1,
      /* Конец знака префикса без пробелов: полоса начинается после префикса при любом
         ползунке. Правило — `shared_utils` (У-32). */
      prefixEnd: blockFillPrefixGlyphEnd(src),
    });
  }
  return out;
}

/**
 * Правила стилей подложки; тумблер выключен — пусто. Цвет и густота — на
 * прямоугольнике, не на слое: слой один на редактор.
 */
function buildBlockFillStyleCss(look) {
  const cfg = isObj(look) ? look : {};
  if (cfg.enabled !== true) return "";
  const color = String(cfg.color || "").trim();
  const opacity = Number.isFinite(Number(cfg.opacity)) ? Number(cfg.opacity) : 0;
  return [
    ".markdown-source-view.mod-cm6 ." + BLOCK_FILL_LAYER_CLASS + " {",
    "  pointer-events: none;",
    "}",
    ".markdown-source-view.mod-cm6 ." + BLOCK_FILL_LAYER_CLASS + " ." + BLOCK_FILL_MARKER_CLASS + " {",
    /* Своего цвета нет — тема. */
    "  background-color: " + (color || "var(--text-accent)") + ";",
    "  opacity: " + opacity + ";",
    "  border-radius: var(--radius-s);",
    "  pointer-events: none;",
    "}",
  ].join("\n");
}

function caretLayerRangeFor(plugin, state) {
  if (!caretShapeActive(plugin)) return null;
  const main = state && state.selection ? state.selection.main : null;
  if (!main || main.empty !== true) return null;
  if (!caretSitsAtLineEnd(state, main.head)) return main;
  /* Меняется только сторона измерения: `forRange` читает пустой отрезок по `empty`,
     `head`, `assoc`; `EditorSelection` здесь из чужой копии состояния. */
  return { empty: true, head: main.head, anchor: main.head, from: main.head, to: main.head, assoc: -1 };
}

const STRIP_LINE_STYLE_CSS = [
  ".markdown-source-view.mod-cm6 .cm-line.io-strip-line {",
  "  position: relative;",
  "  border-radius: 2px;",
  "  overflow: visible !important;",
  "}",
  ".markdown-source-view.mod-cm6 .cm-line.io-strip-line::before {",
  "  content: \"\";",
  "  position: absolute;",
  "  pointer-events: none;",
  /*
   * Зазор между полосами соседних строк (B22, 2026-09-02) — переменная от адаптера:
   * слайдер `Gap between Bars`, `Join Bars in a tree` (PRD 10.13.16); её же читает
   * предпросмотр (У-32). Запас равен умолчанию.
   */
  "  top: var(--io-strip-line-gap, 2px);",
  "  bottom: var(--io-strip-line-gap, 2px);",
  "  width: var(--io-strip-thickness, 2px);",
  "  left: calc(-1 * var(--io-strip-x1, 20px));",
  "  background: var(--io-strip-c1, transparent);",
  "  box-shadow: var(--io-strip-shadow2, none), var(--io-strip-shadow3, none);",
  "  border-radius: 1px;",
  "}",
  /* Правила `io-strip-hidden-token`/`io-strip-hidden-space` сняты 2026-09-03:
     классы не ставил никто (`docs/dev/AWAITING_OWNER_CHECK.md`, раздел 8). */
].join("\n");

/**
 * Метка панели TagWheel на строке. `==…==` — разметка человека, не панель
 * (2026-09-04); метка панели — активная ячейка `**[текст]**` (`renderControlLine`,
 * `tagwheel_core.js`), тем же выражением, что красит её (У-32). Читается из текста,
 * не из состояния окна: оно устаревает. Панели без активной ячейки не бывает
 * (`buildGroupDisplay`).
 */
const TAGWHEEL_ACTIVE_CELL_RE = /\*\*\[([\s\S]+?)\]\*\*/;

/** Отрезок панели: границы, внутренность, признак — одно объявление на слои пузырей и панели. */
function tagwheelPanelSegmentInLine(text) {
  const src = String(text || "");
  const openIdx = src.indexOf("==");
  const closeIdx = openIdx >= 0 ? src.indexOf("==", openIdx + 2) : -1;
  if (openIdx < 0 || closeIdx <= openIdx) return null;
  const innerAt = openIdx + 2;
  if (closeIdx <= innerAt) return null;
  const segment = src.slice(innerAt, closeIdx);
  if (!TAGWHEEL_ACTIVE_CELL_RE.test(segment)) return null;
  return { start: openIdx, end: closeIdx + 2, innerAt, closeIdx, segment };
}

/**
 * Отрезок панели TagWheel: слой пузырей внутри него не рисует; `null` — панели нет.
 * Одно правило на два слоя (B2, 2026-09-02, У-32). Цвета не спрашиваются
 * (2026-09-20, У-216): при пустых цветах пузырь вставал поверх разметки панели.
 */
function tagwheelPanelSpanInLine(text) {
  const seg = tagwheelPanelSegmentInLine(text);
  if (!seg) return null;
  return { start: seg.start, end: seg.end };
}

/** Есть ли что оформлять в панели — для отрезков и раннего выхода сборки (У-32). */
function tagwheelPanelPaints(colors) {
  if (!colors) return false;
  return Boolean(colors.fillColor) || Boolean(colors.defaultTextColor)
    || Boolean(colors.activeTextColor) || Boolean(colors.chosenValueColor)
    || colors.boldFieldNames === true || colors.showPrefix === false || colors.highlight === false;
}

/**
 * Что оформляется в панели TagWheel на строке — чистая функция, без CodeMirror.
 * Один виджет на весь `==…==` ломался о ссылки и разметку Obsidian (B2,
 * 2026-09-02), поэтому `replace` подменяет только один токен, остальное — пометки.
 *
 * Виды отрезков:
 *   `fill`    — фон панели;
 *   `text`    — цвет неактивных ячеек, на весь отрезок;
 *   `name`    — полужирное имя неактивного поля (`Bold Field names`);
 *   `active`  — цвет и начертание активной ячейки;
 *   `replace` — один токен: без приставки при спрятанных решётках, целиком у
 *               тега при показанных.
 */
function tagwheelPanelSpans(text, colors, placeholders) {
  const out = [];
  /* Ни цвета, ни спрятанных решёток — нечего: полужирную активную ячейку рисует Obsidian. */
  if (!tagwheelPanelPaints(colors)) return out;
  /* Панель — по своей метке (`tagwheelPanelSegmentInLine`). */
  const seg = tagwheelPanelSegmentInLine(text);
  if (!seg) return out;

  const innerAt = seg.innerAt;
  /* `seg.closeIdx` не нужен (A3). */
  const segment = seg.segment;
  const known = placeholders instanceof Set ? placeholders : new Set();
  const fillColor = String(colors && colors.fillColor || "");
  const textColor = String(colors && colors.defaultTextColor || "");
  const activeColor = String(colors && colors.activeTextColor || "") || textColor;
  const chosenColor = String(colors && colors.chosenValueColor || "");
  const showPrefix = !(colors && colors.showPrefix === false);
  /* Виджет подмены цвет не наследует: берёт стиль самой внутренней цветной пометки над ним (BUGHUNT D6). */
  const coverColor = (from, to) => {
    const cover = out.filter((s) => /(?:^|;)\s*color:/.test(s.style || "") && s.start <= from && s.end >= to)
      .sort((x, y) => TAGWHEEL_SPAN_RANK[y.kind] - TAGWHEEL_SPAN_RANK[x.kind])[0];
    return cover ? String((/(?:^|;)\s*color:\s*([^;]+);/.exec(cover.style) || [])[1] || "").trim() : "";
  };

  /*
   * Пометка на всю строку с переменной `--io-twfill`; заливку рисует перекрашенная
   * подсветка `span.cm-highlight`/`span.cm-formatting-highlight` (`styles.css`), а не
   * свой `mark`: тот режется о теги, код и `**` (2026-09-05, `12.png`, У-68).
   * Той же пометкой гасятся фон и рамка тегов и кода внутри панели.
   */
  out.push({
    kind: "line",
    start: seg.start,
    end: seg.end,
    style: colors.highlight === false ? "--io-twfill: transparent;" : fillColor ? "--io-twfill: " + fillColor + ";" : "",
  });
  /* Цвет неактивных — на весь отрезок: резать на ячейки — второй разбор панели (У-4). */
  if (textColor) {
    out.push({ kind: "text", start: seg.start, end: seg.end, style: "color: " + textColor + ";" });
  }

  /*
   * Активная ячейка `**[текст]**` (`renderControlLine`, `tagwheel_core.js`): цвет
   * всегда, не только у плейсхолдера (B2, 2026-09-02); `!important` — полужирным её
   * делает и Obsidian.
   * Выбранные значения (2026-09-17) красятся дополнением: из отрезка вычитаются имя
   * поля и активная ячейка, ячейки не режутся (У-4). Имя поля — только по обратным
   * кавычкам `buildGroupDisplay`, не по образцу имён (У-201).
   */
  if (chosenColor) {
    const keep = [];
    const codeRe = /`[^`]*`/g;
    let hit;
    while ((hit = codeRe.exec(segment)) !== null) {
      keep.push([hit.index, hit.index + String(hit[0] || "").length]);
    }
    const activeHit = TAGWHEEL_ACTIVE_CELL_RE.exec(segment);
    TAGWHEEL_ACTIVE_CELL_RE.lastIndex = 0;
    if (activeHit) {
      keep.push([activeHit.index, activeHit.index + String(activeHit[0] || "").length]);
    }
    keep.sort((x, y) => x[0] - y[0]);
    let at = 0;
    const paint = (from, to) => {
      if (to <= from) return;
      out.push({
        kind: "chosen",
        start: innerAt + from,
        end: innerAt + to,
        style: "color: " + chosenColor + ";",
      });
    };
    for (const range of keep) {
      if (range[0] > at) paint(at, range[0]);
      if (range[1] > at) at = range[1];
    }
    paint(at, segment.length);
  }

  /* Имена неактивных Field полужирным (2026-10-01) — по тем же кавычкам; `!important` — как у активной. */
  if (colors && colors.boldFieldNames === true) {
    const nameRe = /`[^`]*`/g;
    let hit;
    while ((hit = nameRe.exec(segment)) !== null) {
      out.push({
        kind: "name",
        start: innerAt + hit.index,
        end: innerAt + hit.index + String(hit[0] || "").length,
        style: "font-weight: 700 !important;",
      });
    }
  }

  const active = TAGWHEEL_ACTIVE_CELL_RE.exec(segment);
  if (active) {
    const inner = String(active[1] || "");
    const bracketAt = String(active[0] || "").indexOf("[");
    const start = innerAt + active.index + bracketAt + 1;
    const end = start + inner.length;
    if (end > start) {
      const bold = known.has(inner.trim());
      out.push({
        kind: "active",
        start,
        end,
        style: (activeColor ? "color: " + activeColor + ";" : "")
          + "font-weight: " + (bold ? "700" : "400") + " !important;",
      });
    }
  }

  /*
   * Спрятанные решётки (`Show tag markers` off): подменяется один токен.
   * Показанные тоже подменяются у тега после пробела: Live Preview прячет решётку
   * внутри `==…==` (`app.js` 1.13.7, набор `a3`, класс `formatting`; цикл 109).
   */
  {
    /* Тег кончается на разметке панели: иначе `#low]**` заходил на скобку (Д-7). */
    const tokenRe = /`([^`]+)`|(#[^\s\]*`]+)/g;
    let m;
    while ((m = tokenRe.exec(segment)) !== null) {
      const raw = String(m[1] || m[2] || "");
      const start = innerAt + m.index + String(m[0] || "").indexOf(raw);
      const end = start + raw.length;
      if (end <= start) continue;
      const shown = showPrefix
        ? (m[2] && /\s/.test(text.charAt(start - 1)) ? raw : "")
        : formatTagwheelDisplayToken(raw, false);
      if (!shown || (!showPrefix && shown === raw)) continue;
      out.push({ kind: "replace", start, end, text: shown, color: coverColor(start, end) });
    }
  }

  /*
   * Ссылка в активной ячейке (BUGHUNT A10): `**[[[Цель|Подпись]]]**` Obsidian читает
   * с целью `[Цель` — скобки ячейки со ссылкой накрываются виджетом, подпись —
   * `wikilinkShownOf`. Неактивную Obsidian рисует верно.
   */
  {
    const linkRe = /\[\[[^\[\]]+\]\]/g;
    let m;
    while ((m = linkRe.exec(segment)) !== null) {
      const after = m.index + m[0].length;
      if (segment.charAt(after) !== "]") continue;
      /* Ячейка — от своей `[` до `]` за ссылкой: при `Custom + default` перед ссылкой
         свой текст (`[PA [[Project A]]]`, H1.2). */
      const open = segment.lastIndexOf("[", m.index - 1);
      const label = open >= 0 ? segment.slice(open + 1, m.index) : "";
      if (open < 0 || /[[\]`*]/.test(label)) continue;
      const shown = __sharedUtils.wikilinkShownOf(m[0]);
      if (!shown) continue;
      const start = innerAt + open;
      const end = innerAt + after + 1;
      out.push({ kind: "replace", start, end, text: "[" + label + shown + "]", color: coverColor(start + 1, end - 1) });
    }
  }

  return out;
}

/** Порядок наложения: строка, общий цвет, имя поля, активная ячейка, подмена токена. */
const TAGWHEEL_SPAN_RANK = { line: -1, text: 1, chosen: 2, name: 2, active: 3, replace: 4 };

/**
 * Переменные темы для панели TagWheel без заданного цвета (PRD 10.13.23 Ц2, H4).
 * То же объявление — в `src/ui/settings/custom/theme_colors.ts`; совпадение держит
 * пин `tag_visual_render_tests.ts` (У-32). `--text-highlight-bg` — фон `==…==`
 * Obsidian. Цвета текста — свои переменные `styles.css` (контраст тёмной темы, H1.5).
 */
const TAGWHEEL_THEME_COLOR_VARS = {
  defaultTextColor: "--io-tw-text",
  activeTextColor: "--io-tw-active",
  fillColor: "--text-highlight-bg",
}

/**
 * Цвета, которыми панель красится: пустое — переменная темы (10.13.23 Ц2), цвет
 * человека сильнее (Ц6). Отдельно от `getTagwheelHeaderColorsFromConfig`: там
 * «пусто» = «не задано». Ключи переносятся, а не перечисляются: перечень терял
 * `Chosen Value text color` (2026-09-17); сторож — `tag_visual_render_tests.ts`.
 */
function resolveTagwheelPaintColors(colors) {
  const src = isObj(colors) ? colors : {};
  const themed = (value, variable) => {
    const own = String(value || "").trim();
    return own || ("var(" + variable + ")");
  };
  /* У `Chosen Value text color` темы нет нарочно: «пусто» = «как неактивные». */
  const out = { showPrefix: src.showPrefix !== false };
  /* Цвет с названной темой есть всегда: пустая панель читаема (10.13.23 Ц2). */
  for (const key of Object.keys(TAGWHEEL_THEME_COLOR_VARS)) {
    out[key] = themed(src[key], TAGWHEEL_THEME_COLOR_VARS[key]);
  }
  for (const key of Object.keys(src)) {
    if (key === "showPrefix" || Object.prototype.hasOwnProperty.call(out, key)) continue;
    /* Тумблер остаётся тумблером: строка `"false"` читалась бы как «да». */
    out[key] = typeof src[key] === "boolean" ? src[key] : String(src[key] || "").trim();
  }
  return out;
}

/** Отметки строки (10.13.12): подсветка обработанной и `Floating button` — один проход на обе. */
function getSourceMarksFromConfig(cfg) {
  const i2n = isObj(readCfgPath(cfg, "transform.inline2note")) ? readCfgPath(cfg, "transform.inline2note") : {};
  const sp = isObj(i2n.sourceProcessing) ? i2n.sourceProcessing : {};
  const visual = isObj(sp.visual) ? sp.visual : {};
  const token = String(sp.token || "").trim();
  const moduleOn = readCfgPath(cfg, "features.transform.enabled") === true
    && readCfgPath(cfg, "transform.inline2note.enabled") === true;
  const pct = Number(visual.opacity);
  /* Метка отмеченной строки (`done-marker`) — тот же род отметки (Tags & PKM). */
  const dm = isObj(readCfgPath(cfg, "pkm.behavior.doneMarker")) ? readCfgPath(cfg, "pkm.behavior.doneMarker") : {};
  const dmVisual = isObj(dm.visual) ? dm.visual : {};
  const doneToken = __doneMarker.readDoneMarker(cfg).token;
  const donePct = Number(dmVisual.opacity);
  const pkmOn = readCfgPath(cfg, "features.pkm.enabled") === true && !!doneToken;
  return {
    doneToken,
    doneHighlight: pkmOn && dmVisual.enabled === true,
    doneStrike: pkmOn && dm.strike === true,
    doneColor: normalizeHexColorInput(dmVisual.color),
    doneOpacity: Number.isFinite(donePct) ? Math.max(0, Math.min(100, Math.trunc(donePct))) / 100 : 0.65,
    moduleOn,
    /* Метка — единственный признак обработанной строки (Н2); нет — подсветки нет (Н3). */
    token,
    highlight: moduleOn && !!token && visual.enabled === true,
    color: normalizeHexColorInput(visual.color),
    /* Доля для CSS; в конфиге процент (Н5). */
    opacity: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.trunc(pct))) / 100 : 0.65,
    button: moduleOn && i2n.floatingButton === true,
    /* Отступ кнопки (2026-09-04) уже нормализован в `transform_feature.js` (У-32). */
    buttonGap: Number(i2n.floatingButtonGap),
  };
}

/**
 * Метка стоит в строке отдельным токеном, а не куском слова: `#processed`
 * не должен зажигать строку со словом `#processed-later`.
 */
function lineHasProcessedToken(text, token) {
  const needle = String(token || "").trim();
  if (!needle) return false;
  const rx = new RegExp("(^|\\s)" + escapeRegExp(needle) + "(?=$|\\s)");
  return rx.test(String(text || ""));
}

/**
 * Определения Fields подряд: теги (`pkm.fields.tags`), затем ссылки и элементы
 * (`pkm.fields.links`). Ветки названы по типу Field, не по стороне (В9).
 */
function collectPkmFieldDefinitions(cfg) {
  const fields = isObj(readCfgPath(cfg, "pkm.fields")) ? readCfgPath(cfg, "pkm.fields") : {};
  return []
    .concat(Array.isArray(fields.tags && fields.tags.fields) ? fields.tags.fields : [])
    .concat(Array.isArray(fields.links && fields.links.fields) ? fields.links.fields : []);
}

module.exports = {
  visualModuleOn,
  normalizeHexColorInput,
  readableTextOn,
  getTagwheelHeaderColorsFromConfig,
  buildTagwheelPlaceholderSetFromConfig,
  getTagVisualsFromConfig,
  TAG_EMPTY_BUBBLE_BASE_PX,
  TAG_TEXT_FALLBACK_PX,
  baseTextPx,
  TAG_BUBBLE_CLASS,
  TAG_BUBBLE_EMPTY_CLASS,
  TAG_BUBBLE_FILLED_CLASS,
  TAG_BUBBLE_THEME_CLASS,
  TAG_BUBBLE_SIDE_CLASS,
  isClearColor,
  TAG_BUBBLE_CLICKABLE_CLASS,
  LINK_SHOWN_CLASS,
  computeTagVisualStyle,
  formatFieldTokenForVisual,
  isVisualTokenKey,
  buildFieldTagVisualMap,
  buildGlobalTagVisualMap,
  readTagVisualRowByTokenMaps,
  buildTagCustomTextMap,
  normalizeRuntimeTagVisualRow,
  scoreTagVisualRow,
  pickStrongerTagVisualRow,
  resolveEffectiveTagVisualMode,
  buildTagTokenSetForField,
  resolveTagVisualZone,
  lineSeparatorBounds,
  normalizeVisualTokenKey,
  rangeIntersects,
  escapeRegExp,
  isRenderableStripContext,
  isHardLineBlockBoundary,
  elementTailPatternFromFormat,
  buildElementMarkersFromConfig,
  scanLineVisualTokens,
  buildBlockKindsFromConfig,
  blockOwnsToken,
  buildWikilinkValueTestFromConfig,
  buildLineSplitFromConfig,
  blockValueZone,
  buildBlockStyleCss,
  blockValueStyleVars,
  tagVisualSizingForZone,
  BLOCK_VALUE_CLASS,
  blockValueClassFor,
  LINK_TARGET_CLASS,
  LINK_BRACKETS_CLASS,
  writtenLinkParts,
  scanHyperlinksInLine,
  lineBelongsToPlugin,
  formatTagwheelDisplayToken,
  TAGWHEEL_FILL_STYLE_CSS,
  BLOCK_FILL_LAYER_CLASS,
  BLOCK_FILL_MARKER_CLASS,
  BLOCK_FILL_DEFAULT_OPACITY_PCT,
  BLOCK_FILL_DEFAULT_HEIGHT_PCT,
  BLOCK_FILL_DEFAULT_WIDTH_PCT,
  BLOCK_FILL_MAX_HEIGHT_PCT,
  BLOCK_FILL_TEXT_HEIGHT_SHARE,
  BLOCK_FILL_DIRECTIONS,
  BLOCK_FILL_DEFAULT_DIRECTION,
  blockFillZoneWanted,
  blockFillLookFromConfig,
  blockFillSpansInLine,
  blockFillPadXPx,
  blockFillBandHeightPx,
  blockFillRowCountTrusted,
  blockFillBubbleHeightPx,
  blockFillWrittenTextHeightPx,
  blockFillPrefixGlyphEnd,
  buildBlockFillStyleCss,
  CARET_LAYER_CLASS,
  CARET_MARKER_CLASS,
  buildCaretStyleCss,
  caretBlinkMsFromSpeed,
  caretLookFromConfig,
  caretShapeActive,
  jumpFlashLookFromConfig,
  JUMP_FLASH_LAYER_CLASS,
  JUMP_FLASH_MARKER_CLASS,
  caretSitsAtLineEnd,
  caretLayerRangeFor,
  STRIP_LINE_STYLE_CSS,
  TAGWHEEL_ACTIVE_CELL_RE,
  tagwheelPanelSegmentInLine,
  tagwheelPanelSpanInLine,
  tagwheelPanelPaints,
  tagwheelPanelSpans,
  TAGWHEEL_SPAN_RANK,
  TAGWHEEL_THEME_COLOR_VARS,
  resolveTagwheelPaintColors,
  getSourceMarksFromConfig,
  lineHasProcessedToken,
  collectPkmFieldDefinitions,
};
