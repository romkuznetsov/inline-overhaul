/**
 * Оформление редактора: что об этом говорит конфиг.
 *
 * Здесь всё, что читает настройки и собирает из них данные и строки CSS, —
 * цвета и стиль тегов, метки элементов, разбор строки на токены, вид панели
 * TagWheel, каретка, полоса приоритета, метки обработанной строки. CodeMirror
 * сюда не заходит: он живёт в `src/ui/editor/decorations.js`, и тот зовёт этот
 * модуль, а не наоборот.
 *
 * **Откуда взялось.** Вынесено из `main.js` 2026-09-07, кусок второй разбора
 * A3 (PRD, раздел 11). Деление посчитано обходом ссылок: сюда попало то, что
 * `cmView`/`cmState` не трогает вовсе. Тела функций при переезде не правились.
 *
 * Модули — литеральным `require`, по одному на модуль (У-89).
 */
const __sharedUtils = require("./shared_utils.js");
const __priorityStripEngine = require("./priority_strip_engine.js");

/* Те же однострочные обёртки, что были в `main.js`: тела переехавших функций
   зовут их этими именами, и переписывать тела ради переезда нельзя (У-11). */
function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

function normalizeHexColorInput(value) {
  const src = String(value || "").trim().toLowerCase();
  if (!src) return "";
  return /^#[0-9a-f]{6}$/.test(src) ? src : "";
}

function getTagwheelHeaderColorsFromConfig(cfg) {
  const wheel = isObj(readCfgPath(cfg, "visual.tagWheel")) ? readCfgPath(cfg, "visual.tagWheel") : {};
  return {
    defaultTextColor: normalizeHexColorInput(wheel.textColor),
    /* Цвет активного Field: пусто — он красится как остальные (10.13.15). */
    activeTextColor: normalizeHexColorInput(wheel.activeTextColor),
    fillColor: normalizeHexColorInput(wheel.fillColor),
    showPrefix: wheel.showMarkers !== false,
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
 * Вид тегов на путях версии 2 (`visual.tags.*`, `visual.tagBars.*`).
 *
 * Имена возвращаемых полей — контракт с виджетами и с проверками, поэтому
 * остались прежними; поменялось только то, откуда берутся значения.
 *
 * **Прозрачность меняет единицы.** В версии 1 это доля `0..1`, в версии 2 —
 * проценты `0..100` (PRD 8.1в). Наружу отдаётся по-прежнему доля: её кладут
 * прямо в CSS.
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
    tagTextSizePct: Number.isFinite(Math.trunc(Number(tags.textSizePct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(tags.textSizePct))))
      : 100,
    tagBubbleWidthPct: Number.isFinite(Math.trunc(Number(tags.bubbleWidthPct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(tags.bubbleWidthPct))))
      : 100,
    tagBubbleHeightPct: Number.isFinite(Math.trunc(Number(tags.bubbleHeightPct)))
      ? Math.max(80, Math.min(140, Math.trunc(Number(tags.bubbleHeightPct))))
      : 100,
    emptyBubbleSizePct: Number.isFinite(Math.trunc(Number(tags.emptyBubblePct)))
      ? Math.max(50, Math.min(180, Math.trunc(Number(tags.emptyBubblePct))))
      : 100,
    tagShapePct: Number.isFinite(Math.trunc(Number(tags.cornersPct)))
      ? Math.max(0, Math.min(100, Math.trunc(Number(tags.cornersPct))))
      : 0,
    byTag: isObj(tags.byTag) ? tags.byTag : {},
    userTags: isObj(tags.userTags) ? tags.userTags : {},
    separator1TextColor: normalizeHexColorInput(tags.separator1TextColor) || normalizeHexColorInput(ui.separator1TextColor),
    separator2TextColor: normalizeHexColorInput(tags.separator2TextColor) || normalizeHexColorInput(ui.separator2TextColor),
    stripActive: strip.active === true,
    strip,
  };
}

/**
 * Ширина пустого пузыря при 100 %.
 *
 * То же число стоит в панели: `.io-bubble--empty` в `styles.css` считает
 * `calc(30px * var(--io-empty-x))`. Два места, одно число — за их сходством
 * следит `tag_visual_render_tests.ts`, потому что разъехавшиеся формулы уже
 * стоили заказчику настройки, которая «ни на что не влияет» (И-2.3).
 */
const TAG_EMPTY_BUBBLE_BASE_PX = 30;

function computeTagVisualStyle(textSizePct, bubbleWidthPct, bubbleHeightPct, shapePct) {
  const textSize = Number.isFinite(Math.trunc(Number(textSizePct))) ? Math.max(80, Math.min(140, Math.trunc(Number(textSizePct)))) : 100;
  const bubbleWidth = Number.isFinite(Math.trunc(Number(bubbleWidthPct))) ? Math.max(80, Math.min(140, Math.trunc(Number(bubbleWidthPct)))) : 100;
  const bubbleHeight = Number.isFinite(Math.trunc(Number(bubbleHeightPct))) ? Math.max(80, Math.min(140, Math.trunc(Number(bubbleHeightPct)))) : 100;
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
    horizontalPaddingPx: Math.max(2, Math.round(6 * bubbleScaleX)),
    verticalPaddingPx: Math.max(1, Math.round(3 * bubbleScaleY)),
    fontSizePx: Math.max(10, Math.round(14 * textScale)),
    lineHeight: 1.2,
  };
}

function formatFieldTokenForVisual(field, rawToken) {
  const tok = String(rawToken || "").trim();
  if (!tok) return "";
  if (/^#\S+/.test(tok)) return tok;
  const pref = typeof field?.prefix === "string" ? field.prefix : "#";
  if (!pref && /^\/\S+/.test(tok)) return `#${tok}`;
  return `${pref}${tok}`;
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
      if (!/^#\S+/.test(token)) continue;
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
      if (!token || token.charAt(0) !== "#") continue;
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
 * Где на строке стоят разделители: первый — слева, последний — справа.
 *
 * Одно объявление на всех, кто про них спрашивает: зона токена и промежуток от
 * блока до разделителя (S7). Второй такой же поиск разошёлся бы с этим молча
 * (У-32) — а разойтись тут есть на чём: слева берётся **первое** вхождение, а
 * справа **последнее**, и при одинаковых разделителях это разные места.
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
  return String(src || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRenderableStripContext(text, sep1, sep2, tokenSet) {
  const src = String(text || "");
  const trimmed = src.trim();
  if (!trimmed) return false;
  const listLineRx = /^\s*(?:[-*+]\s+|\d+\.\s+)(?:\[[^\]]\]\s+)?/;
  if (listLineRx.test(src)) return true;
  const set = tokenSet instanceof Set ? tokenSet : new Set();
  if (!set.size) return false;
  const rx = /#\S+/g;
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
 * Хвост токена эмодзи-элемента, выведенный из ФОРМАТА поля.
 *
 * Зачем не «всё до пробела». Сканер искал элемент именно так, и формат из
 * нескольких слов обрывался на первом же: у `📅YYYY-MM-DD hh:mm` оформлялась
 * только дата, а `hh:mm` оставалось без прозрачности блока и без размера
 * текста (замечание заказчика C35, 2026-09-02).
 *
 * Формат разбирается буквами: подряд идущие буквы образца (`YYYY`, `MM`, `hh`)
 * становятся столькими же цифрами, пробел — пробелом, остальное — собой. Так
 * хвост знает свою длину и не съедает следующий токен: жадное «до пробела»
 * съело бы и `#work`, если бы тот стоял без пробела.
 */
function elementTailPatternFromFormat(format) {
  const src = String(format || "").trim();
  if (!src) return "";
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/[A-Za-z]/.test(ch)) {
      let n = 0;
      while (i < src.length && /[A-Za-z]/.test(src[i])) { i += 1; n += 1; }
      out += "\\d{" + n + "}";
      continue;
    }
    if (ch === " ") { out += "[ ]"; i += 1; continue; }
    out += escapeRegExp(ch);
    i += 1;
  }
  return out;
}

/**
 * Эмодзи-элементы, какие завёл человек: метка и то, чем записан её хвост.
 *
 * Берутся из конфига, а не из списка литералов: элемент — это Field, и его
 * метку человек меняет в панели.
 *
 * Отдаются пары, а не одни метки: без формата длину хвоста посчитать нечем, а
 * формат живёт у поля.
 */
function buildElementMarkersFromConfig(cfg) {
  const byField = isObj(readCfgPath(cfg, "pkm.fields.elements.byField"))
    ? readCfgPath(cfg, "pkm.fields.elements.byField")
    : {};
  const out = [];
  const seen = new Set();
  for (const key of Object.keys(byField)) {
    const row = isObj(byField[key]) ? byField[key] : {};
    const marker = String(row.emoji || "").trim();
    if (!marker || seen.has(marker)) continue;
    seen.add(marker);
    out.push({ marker, tail: elementTailPatternFromFormat(row.format) });
  }
  /* Длинные метки первыми: короткая не должна откусывать начало длинной. */
  out.sort((a, b) => b.marker.length - a.marker.length);
  return out;
}

/**
 * Всё, что плагин сам поставил в строку: теги, ссылки и элементы.
 *
 * До этого сканер искал только `#\S+`, и настройки блока — прозрачность и
 * размер текста — доставались одним тегам: эмодзи-элемент `📅2026-09-01` и
 * ссылка `[[Note]]` в разбор не попадали вовсе (замечание И-2.2).
 *
 * Пересечения снимаются: `#` внутри ссылки (`[[#heading]]`) — часть ссылки, а
 * не отдельный тег. Побеждает тот, кто начался раньше, а при равном начале —
 * тот, кто длиннее.
 */
function scanLineVisualTokens(text, sep1, sep2, elementMarkers) {
  const src = String(text || "");
  const found = [];
  const pushAll = (rx, kind) => {
    let m;
    while ((m = rx.exec(src)) !== null) {
      const raw = String(m[0] || "");
      const token = raw.trim();
      if (!token) continue;
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
    /*
     * Хвост берётся из формата поля, а не «всё до пробела»: формат из
     * нескольких слов иначе обрывается на первом (C35). Формата нет —
     * остаётся прежнее правило: гадать о длине честнее, чем выдумать её.
     */
    pushAll(new RegExp(escapeRegExp(marker) + (tail || "\\S+"), "g"), "element");
  }
  pushAll(/#\S+/g, "tag");

  found.sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return (b.end - b.index) - (a.end - a.index);
  });

  const out = [];
  let claimedTo = -1;
  for (const entry of found) {
    if (entry.index < claimedTo) continue;
    out.push({
      token: entry.token,
      kind: entry.kind,
      index: entry.index,
      end: entry.end,
      zone: resolveTagVisualZone(src, entry.index, sep1, sep2),
    });
    claimedTo = entry.end;
  }
  return out;
}

/**
 * Прозрачность блока и размер текста для токена, у которого нет своего цвета.
 *
 * Токен со своим цветом получает и то и другое через пузырь
 * (`TagVisualTokenWidget`); всем остальным нужна декорация **стилем**, а не
 * подменой: заменить `[[Note]]` своим узлом значит забрать у ссылки клик.
 *
 * Текст между разделителями не трогается — это ваш текст, а не запись
 * плагина (решение заказчика 2026-09-01).
 */
function buildBlockStyleCss(entry, visuals) {
  const zone = String(entry && entry.zone || "");
  if (zone !== "left" && zone !== "right") return "";
  const opacity = Number(entry && entry.zoneOpacity);
  const sizePct = Number(visuals && visuals.tagTextSizePct);
  const parts = [];
  if (Number.isFinite(opacity) && opacity < 1) parts.push("opacity: " + opacity + ";");
  if (Number.isFinite(sizePct) && sizePct !== 100) {
    /* Размер берётся той же функцией, что и у пузыря: иначе текст в блоке
       разъедется с текстом в пузыре при одной и той же настройке. */
    parts.push("font-size: " + computeTagVisualStyle(sizePct, 100, 100, 0).fontSizePx + "px;");
  }
  return parts.join(" ");
}

function formatTagwheelDisplayToken(token, showPrefix) {
  var src = String(token || "");
  var t = src.trim();
  if (!t) return src;
  var m = t.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (m) return m[1];
  if (showPrefix) return src;
  if (/^#\//.test(t)) return t.replace(/^#\//, "");
  if (/^#\S+/.test(t)) return t.replace(/^#/, "");
  if (/^[^A-Za-zА-Яа-я0-9\[]+/.test(t)) {
    var stripped = t.replace(/^[^A-Za-zА-Яа-я0-9\[]+/, "");
    if (/^(\d{4}-\d{2}-\d{2}|\d{2}:\d{2}|\d)/.test(stripped)) return stripped;
  }
  return t;
}

/*
 * Фон панели рисуется пометкой на самом отрезке, поэтому правила для него
 * здесь больше нет. Осталось одно: токен, у которого спрятана приставка,
 * должен читаться как обычный текст строки.
 */
const TAGWHEEL_FILL_STYLE_CSS = [
  ".markdown-source-view.mod-cm6 .inline-overhaul-tw-token {",
  "  font: inherit;",
  "  color: inherit;",
  "  background: transparent;",
  "}",
].join("\n");

/*
 * Имена своего слоя каретки и её метки — **одно объявление на оба места**.
 * Их называют блок стилей и сам слой, и разойдись они, слой получил бы класс,
 * которого нет ни в одном правиле: каретки не видно, а обе проверки зелёные
 * (У-32, У-56). `io-caret` тут занят — так называется каретка предпросмотра в
 * панели, и её глобальное правило накрыло бы метки слоя своей высотой и своим
 * мерцанием (У-65).
 */
const CARET_LAYER_CLASS = "io-editor-caretlayer";

const CARET_MARKER_CLASS = "io-editor-caret";

/**
 * Каретка: цвет, толщина и мерцание (10.13.33).
 *
 * **Цвет — три объявления, и это не перестраховка.** Obsidian рисует каретку
 * сам — `.cm-cursor` с `border-left`, — но при выключенном `drawSelection`
 * работает родная каретка браузера, а ею командует `caret-color`. Плюс
 * переменная темы `--caret-color`: её читают собственные правила Obsidian и
 * часть тем.
 *
 * **Толщина — это `border-left-width`, и вместе с ней двигается `margin-left`.**
 * У Obsidian стоит `borderLeft: 1.2px` и парный `marginLeft: -0.6px`, то есть
 * половина толщины: он центрирует каретку на границе символа. Поставить одну
 * толщину и не тронуть сдвиг значит уронить каретку вправо тем сильнее, чем
 * она толще (прочитано в `app.js` 1.13.7, а не выведено из типов — У-44).
 *
 * **И толщина, и мерцание бьют только по нарисованной каретке, а на строке
 * без выделения её нет.** Замечание заказчика 2026-09-06: «работает только
 * когда я выделяю текст». Причина прочитана в `app.js` 1.13.7, а не выведена.
 * В сборке Obsidian лежат **две** копии `drawSelection` CodeMirror, и слой
 * каретки у них разный:
 *
 *   - копия, отданную плагинам (`drawSelection` из `@codemirror/view`), рисует
 *     `.cm-cursor` и для пустого отрезка;
 *   - копия, на которой собран сам редактор заметки, спрашивает
 *     `range.empty ? !isMain : drawRangeCursor` — то есть **главный пустой
 *     отрезок она не рисует вовсе**. Курсор на строке без выделения — родная
 *     каретка браузера, а у неё из CSS настраивается только `caret-color`.
 *
 * Отсюда и «цвет работает, а толщина нет». Поэтому включённая форма заводит
 * **свой слой** (`io-editor-caretlayer`, см. `createCaretLayerExtension`) и гасит
 * родную каретку: `.cm-cursor` остаётся за выделением и за вторыми курсорами,
 * своя каретка — за строкой без выделения. Оба правила описывают одну вещь и
 * стоят рядом.
 *
 * **Мерцание живёт на слое, а не на самой каретке.** CodeMirror пишет
 * длительность прямо в `style` узла `.cm-cursorLayer`
 * (`animationDuration = cursorBlinkRate + "ms"`), а инлайновый стиль правилу
 * не уступает — отсюда `!important`. «Не мигает» — это снятая анимация, а не
 * нулевая длительность: ноль в CSS означает «мгновенно», а не «никогда», и
 * каретка от него замерла бы невидимой.
 *
 * Селекторы прибиты к `.markdown-source-view`: каретка в полях самой панели
 * настроек и в поиске остаётся тем, чем была (Ц4).
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
      /* Родная каретка гасится ровно тогда, когда её заменяет своя: ширина и
         мерцание у неё браузерные, и CSS их не задаёт. */
      ".markdown-source-view.mod-cm6 .cm-content {",
      "  caret-color: transparent;",
      "}",
      ".markdown-source-view.mod-cm6 ." + CARET_LAYER_CLASS + " {",
      "  pointer-events: none;",
      "  display: none;",
      "}",
      ".markdown-source-view.mod-cm6 ." + CARET_LAYER_CLASS + " ." + CARET_MARKER_CLASS + " {",
      /* Цвет берётся переменной, а не литералом: за цвет отвечает первая
         половина группы, и объявлять его тут значило бы объявить одно правило
         дважды (У-32). Своей переменной нет — берётся тема Obsidian. */
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
 * Скорость мерцания 1..10 в миллисекунды (Ц7).
 *
 * Пятёрка — ровно то, чем Obsidian мерцает сейчас (`cursorBlinkRate` 1200),
 * поэтому она же умолчание слайдера: включённый тумблер сам по себе мерцание
 * не меняет, пока человек не подвинул ползунок. Ноль сюда не доходит — он
 * значит «не мигает вовсе» и решается снятием анимации.
 */
function caretBlinkMsFromSpeed(speed) {
  const s = Number.isFinite(speed) ? Math.max(1, Math.min(10, speed)) : 5;
  return 2200 - s * 200;
}

/**
 * Вид каретки из конфига. Две половины группы независимы: цвет включает
 * `enabled`, толщину и мерцание — `shapeEnabled` (Ц6). Выключенная половина
 * не объявляет ничего, и тогда своё берёт тема.
 */
function caretLookFromConfig(cfg) {
  const caret = isObj(readCfgPath(cfg, "visual.caret")) ? readCfgPath(cfg, "visual.caret") : {};
  const look = { color: "", width: NaN, blinkMs: NaN };
  if (caret.enabled === true) look.color = normalizeHexColorInput(caret.color);
  if (caret.shapeEnabled === true) {
    const width = Number(caret.width);
    look.width = Number.isFinite(width) ? width : 2;
    const speed = Number(caret.blinkSpeed);
    look.blinkMs = Number.isFinite(speed) && speed <= 0 ? 0 : caretBlinkMsFromSpeed(speed);
  }
  return look;
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
 * Стоит ли каретка в конце строки, за которой может стоять виджет.
 *
 * **Замечание заказчика 2026-09-06, критичный дефект:** «при heading-jumps и
 * просто при печати каретка смещена вправо, приклеена к началу
 * `i2n-floating button`, текст возникает слева от неё; при выключенной кнопке
 * поведение нормальное».
 *
 * Причина прочитана в `app.js` 1.13.7, а не выведена (У-44). `forRange` меряет
 * пустой отрезок как `coordsAtPos(head, assoc || 1)`, то есть по умолчанию
 * **справа** от позиции. Справа от конца строки стоит не текст, а виджет
 * `Floating button`: он объявлен `side: 1` на `line.to`, и разбор строки при
 * положительной стороне выбирает именно его (`p > l || 32 & flags && t <= 1` в
 * `resolveInline`). Меряется левая граница кнопки, а она отстоит от текста на
 * `Distance from the text`, — отсюда и сдвиг ровно в этот отступ, и текст,
 * появляющийся слева от каретки.
 *
 * Поэтому на конце непустой строки каретка меряется **слева**: там последний
 * символ текста, то есть то самое место, где стоит родная каретка браузера.
 * Виджета за строкой может и не быть — тогда обе стороны дают одно и то же и
 * правка не меняет ничего.
 *
 * Дефект видит только тот, у кого включены обе функции: без своего слоя
 * каретку рисует браузер по позиции в DOM, а не по измерению.
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

/**
 * Что рисует свой слой: главный **пустой** отрезок и только он.
 *
 * Решение вынесено отдельно, потому что оно и есть предмет: непустой отрезок и
 * вторые курсоры Obsidian рисует сам, и нарисовать их ещё раз значит поставить
 * на строку две каретки. Проверяется без окна — окна тут и не будет.
 */
/* ---- заливка Left и Right Block (З-7) --------------------------------- */

/**
 * Заливка блоков рисуется **своим слоем прямоугольников за текстом** — так же,
 * как CodeMirror рисует выделение. Решение заказчика 2026-09-08 из трёх
 * разобранных способов.
 *
 * Почему не сплошной фон отрезком: `Decoration.mark` на длинный отрезок
 * платформа режет по своим границам, и каждый наш токен внутри — тоже граница.
 * Разваливается не фон, а скругление и вертикальные поля: на каждом куске они
 * свои. Этим куплен дефект подсветки панели TagWheel (У-68).
 */
const BLOCK_FILL_LAYER_CLASS = "io-blockfill-layer";
const BLOCK_FILL_MARKER_CLASS = "io-blockfill-marker";

/** Умолчание прозрачности подложки: видно, но текст читается поверх. */
const BLOCK_FILL_DEFAULT_OPACITY_PCT = 12;

/**
 * Умолчания того, на сколько подложка выходит за написанное.
 *
 * **Оба больше нуля нарочно** (замечание заказчика по S7, 2026-09-09).
 * Подложка ровно по написанному лежит под пузырём тега, а у пузыря свой
 * непрозрачный цвет — то есть блок из одного тега подложки не показывает
 * вовсе: «если символов в block мало (например, стоит 1 тег), то полоска не
 * появляется». Умолчание, при котором функция невидима, — это не умолчание.
 */
const BLOCK_FILL_DEFAULT_HEIGHT_PX = 3;
const BLOCK_FILL_DEFAULT_WIDTH_PCT = 60;

/**
 * Целое из конфига в границах шкалы; мусор и пустота дают умолчание.
 *
 * `null` и пустая строка отсекаются до `Number`: он превращает и то и другое в
 * ноль, а ноль здесь — законное значение настройки. То есть ключ, выставленный
 * в `null` рукой, читался бы как «человек попросил ноль» — и функция тихо
 * становилась бы невидимой, ровно тем дефектом, который этими величинами и
 * лечится.
 */
function blockFillIntOr(raw, min, max, fallback) {
  if (raw === null || raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * Что о заливке говорит конфиг: включена ли, каким цветом, насколько густо и
 * насколько больше написанного.
 */
function blockFillLookFromConfig(cfg) {
  const src = isObj(readCfgPath(cfg, "visual.tags.blockFill"))
    ? readCfgPath(cfg, "visual.tags.blockFill")
    : {};
  const pct = Number(src.opacity);
  return {
    enabled: src.enabled === true,
    /* Пусто = взять у темы. В значение это не влезает (У-60): смысл живёт на
       шве, а не в цвете, и подставляется он в самом правиле стилей. */
    color: normalizeHexColorInput(src.color),
    opacity: Number.isFinite(pct)
      ? Math.max(0, Math.min(100, Math.trunc(pct))) / 100
      : BLOCK_FILL_DEFAULT_OPACITY_PCT / 100,
    /* Высота — в точках: своей границы снаружи у неё нет. */
    heightPx: blockFillIntOr(src.heightPx, 0, 10, BLOCK_FILL_DEFAULT_HEIGHT_PX),
    /* Ширина — в долях расстояния до разделителя: границу назвал заказчик, и
       она зависит от строки, а не от шкалы. */
    widthPct: blockFillIntOr(src.widthPct, 0, 100, BLOCK_FILL_DEFAULT_WIDTH_PCT),
  };
}

/**
 * На сколько подложка выходит за написанное по горизонтали, в точках.
 *
 * **Заказчик назвал границу сам:** «в крайнем правом положении она должна
 * границей достигать начала сепаратора (и быть зеркальной с обратной стороны
 * этого block)». Отсюда доля, а не точки: расстояние до разделителя — это
 * ширина одного пробела на его шрифте, и шкала в точках была бы почти вся
 * мёртвой.
 *
 * Промежутка нет или его нечем измерить — нет и выхода за написанное:
 * подложка кончается на последнем значении, как кончалась. Придумать
 * расстояние вместо измеренного значило бы заехать на разделитель.
 */
function blockFillPadXPx(look, gapPx) {
  const pct = Number(look && look.widthPct);
  const gap = Number(gapPx);
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  if (!Number.isFinite(gap) || gap <= 0) return 0;
  return (gap * Math.min(100, Math.max(0, pct))) / 100;
}

/**
 * Части отрезка, сгруппированные по зрительной строке, на которой они стоят.
 *
 * **Замечание заказчика по S7, 2026-09-09:** «если right block переносится на
 * другую строку, то выглядит некрасиво — на первой строке эта полоска идёт до
 * границы экрана вправо, а на следующей строке начинается от левой границы
 * экрана до конца элемента. Я хочу, чтобы… полоска на этой строке
 * заканчивалась на последнем элементе right panel на этой строке, а на
 * следующей строке начиналась от начала первого перенесённого элемента до
 * конца последнего».
 *
 * **Причина ровно та, что он описал, и она в коде платформы** (У-44).
 * `RectangleMarker.forRange` рисует **выделение**: у отрезка, начавшегося на
 * одной зрительной строке и кончившегося на другой, первый кусок идёт до
 * правого края содержимого (`toOpen` → `rightSide`), а последний начинается от
 * левого (`fromOpen` → `leftSide`). Для выделения это верно, для подложки —
 * нет: подложка обязана лежать на написанном.
 *
 * Поэтому отрезок отдаётся платформе **по куску на зрительную строку**, и
 * тогда каждый кусок целиком на одной строке — то есть открытых краёв у него
 * не бывает вовсе.
 *
 * Здесь **только группировка**, и она чистая: `tops[i]` — измеренная
 * платформой вертикаль начала `parts[i]`, и меряет её тот, кто умеет, — сам
 * CodeMirror. Часть, вертикаль которой измерить не удалось (`null`), встаёт
 * своей группой: догадка о том, где она, хуже лишнего прямоугольника.
 */
function blockFillGroupPartsByLine(parts, tops) {
  const list = Array.isArray(parts) ? parts : [];
  const at = Array.isArray(tops) ? tops : [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const part = list[i];
    if (!part || !(Number(part.to) > Number(part.from))) continue;
    /* Нуль — законная вертикаль (самый верх содержимого), а `Number(null)`
       равен нулю: неизмеренное надо отсечь **до** приведения к числу, иначе
       часть без измерения склеится с той, что и правда стоит наверху. */
    const raw = at[i];
    const top = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    const prev = out.length ? out[out.length - 1] : null;
    /* Полточки допуска: подстрочные и надстрочные знаки внутри одной строки
       дают вертикали, различающиеся на доли точки. */
    const sameLine = prev !== null && prev.top !== null && top !== null
      && Math.abs(top - prev.top) < 0.5;
    if (sameLine) {
      prev.to = Math.max(Number(prev.to), Number(part.to));
      continue;
    }
    out.push({ from: Number(part.from), to: Number(part.to), top });
  }
  return out;
}

/**
 * Отрезки строки, под которыми лежит подложка (З-7).
 *
 * Границы **не считаются заново**: их считает тот же разбор строки, что и
 * прозрачность блоков, — `scanLineVisualTokens` отдаёт каждому токену его
 * зону. Второй разбор того же разошёлся бы с первым молча (У-32).
 *
 * Подложка идёт от первого значения блока до последнего, а не до самого
 * разделителя: иначе она захватила бы пробел перед ним и кончалась бы в
 * пустоте. Значений в блоке нет — отрезка нет вовсе, и это условие заказчика:
 * «если values left\right block отсутствуют, то эта подложка не должна
 * появляться».
 */
function blockFillSpansInLine(text, sep1, sep2, elementMarkers) {
  const src = String(text || "");
  const tokens = scanLineVisualTokens(src, sep1, sep2, elementMarkers);
  const at = lineSeparatorBounds(src, sep1, sep2);
  const out = [];
  for (const zone of ["left", "right"]) {
    const parts = [];
    let start = -1;
    let end = -1;
    for (const hit of tokens) {
      if (hit.zone !== zone) continue;
      parts.push({ from: hit.index, to: hit.end });
      if (start < 0 || hit.index < start) start = hit.index;
      if (hit.end > end) end = hit.end;
    }
    if (start < 0 || end <= start) continue;
    /*
     * Промежуток до разделителя — та мера, которой измеряется `Band width`
     * (S7): сотня на ползунке значит «вплотную к разделителю». Слева он лежит
     * за блоком, справа — перед ним, и по обе стороны это одна и та же пара
     * «откуда — докуда», поэтому дальше её читают одним правилом.
     *
     * Зона существует только при своём разделителе (`resolveTagVisualZone`),
     * так что промежуток тут есть всегда; пустым он выходит, когда пробела
     * между блоком и разделителем нет вовсе, и это законно.
     */
    const gapFrom = zone === "left" ? end : at.lastEnd;
    const gapTo = zone === "left" ? at.first : start;
    out.push({
      zone,
      start,
      end,
      /* Части нужны переносу строки: подложка режется по зрительным строкам, а
         резать её можно только по границам того, что нарисовано. */
      parts,
      gapFrom: gapTo > gapFrom ? gapFrom : -1,
      gapTo: gapTo > gapFrom ? gapTo : -1,
    });
  }
  return out;
}

/**
 * Правила стилей подложки.
 *
 * Пусто, когда тумблер выключен: слоя тогда нет, и правил для него тоже быть
 * не должно.
 *
 * **Цвет и густота — на самом прямоугольнике**, а не на слое: слой один на
 * весь редактор, и прозрачность на нём погасила бы вместе с подложкой всё, что
 * в него попадёт позже.
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
    /* Своего цвета нет — берётся тема: тот же приём, что у каретки. */
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
  /*
   * Отрезку меняется только сторона измерения. Пустой отрезок `forRange`
   * читает тремя полями — `empty`, `head` и `assoc`, — и объявлять тут второй
   * курсор нечем и незачем: `EditorSelection` живёт в копии состояния,
   * отданной плагинам, а меряет по этим полям копия, на которой собран
   * редактор заметки. Остальные поля курсора выписаны, чтобы отрезок остался
   * отрезком для любого читателя.
   */
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
   * Полоса не занимает высоту строки целиком: у двух строк подряд полосы
   * стыкуются без зазора и читаются как одна — «не видно, к какой строке
   * относится какой bar» (замечание B22, 2026-09-02). Зазор сверху и снизу
   * делает границу видимой.
   *
   * Величина больше не литерал: её задаёт слайдер `Gap between Bars`, а у
   * строки внутри дерева зазор снимает тумблер `Join Bars in a tree`
   * (PRD 10.13.16). Число приходит переменной от адаптера, и та же
   * переменная читается предпросмотром полос — одно правило, одно место
   * (У-32). Запасное значение здесь равно умолчанию настройки.
   */
  "  top: var(--io-strip-line-gap, 2px);",
  "  bottom: var(--io-strip-line-gap, 2px);",
  "  width: var(--io-strip-thickness, 2px);",
  "  left: calc(-1 * var(--io-strip-x1, 20px));",
  "  background: var(--io-strip-c1, transparent);",
  "  box-shadow: var(--io-strip-shadow2, none), var(--io-strip-shadow3, none);",
  "  border-radius: 1px;",
  "}",
  /*
   * Правила для классов `io-strip-hidden-token` и `io-strip-hidden-space`
   * сняты 2026-09-03. Классы не ставил никто: тег Field слой полос прячет
   * заменой нулевой ширины, а не пометкой, — то есть правила обещали
   * поведение, которого нет. Записано это было в
   * `docs/AWAITING_OWNER_CHECK.md`, раздел 8, с оговоркой «снять при
   * следующей правке слоя полос».
   */
].join("\n");

/**
 * Метка панели TagWheel на строке.
 *
 * **Отрезок `==…==` сам по себе панелью не является.** `==` — разметка
 * выделения Obsidian, и её человек ставит себе сам. До 2026-09-04 слой брал
 * первый такой отрезок на любой строке, и заливка панели доставалась любому
 * выделенному тексту, а слой пузырей внутри него ничего не рисовал — то есть
 * `==#todo==` человека терял пузырь. Красили мы, выходит, чужую разметку.
 *
 * Своя метка у панели одна и та же с самого начала: активную ячейку движок
 * пишет как `**[текст]**` (`renderControlLine` в `tagwheel_core.js`), и другой
 * пометки активности на строке нет. Её и спрашиваем — **тем же** выражением,
 * которым ниже красится сама активная ячейка (У-32).
 *
 * Признак читается из текста строки, а не из состояния окна, и это выбор:
 * состояние может устареть — окно закрылось, заметка открыта во второй
 * панели, отрисовка случилась раньше, — а метка в строке либо есть, либо нет,
 * и в редакторе и в повторной отрисовке она одна и та же.
 *
 * Чего признак не покрывает: панель без активной ячейки. Такой не бывает —
 * `buildGroupDisplay` помечает активной ту группу, в которой стоит человек, —
 * но если она однажды появится, красить её слой не станет.
 */
const TAGWHEEL_ACTIVE_CELL_RE = /\*\*\[([\s\S]+?)\]\*\*/;

/**
 * Отрезок панели на строке: границы, внутренность и признак. Одно объявление
 * на оба слоя — пузырей и панели.
 */
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
 * Отрезок строки, который слой TagWheel **заменит своим виджетом**.
 *
 * `null` — не заменит: либо на строке нет обособления `==…==`, либо у TagWheel
 * не задана заливка и маркеры не спрятаны, и тогда слой ограничивается
 * покраской текста.
 *
 * Функция одна на два слоя, и это главное в ней. Правило «панель заменяется
 * целиком» раньше жило только внутри слоя TagWheel, а слой пузырей о нём не
 * знал: он к тому времени уже спрятал токены строки своими нулевой ширины, и
 * на один и тот же отрезок приходились две замены. На экране это выглядело
 * так, как заказчик и написал: «вся строка tagwheel пропадает, я вижу только
 * selector, но fields невидимы и не занимают места» (B2, 2026-09-02). Второе
 * объявление того же правила разошлось бы снова (У-32).
 */
function tagwheelPanelSpanInLine(text, colors) {
  const usePanelWidget = Boolean(colors && colors.fillColor) || (colors && colors.showPrefix === false);
  if (!usePanelWidget) return null;
  const seg = tagwheelPanelSegmentInLine(text);
  if (!seg) return null;
  return { start: seg.start, end: seg.end };
}

/**
 * Есть ли вообще что оформлять в панели. Одно объявление на два места: и на
 * расчёт отрезков, и на раннее «красить нечего» в сборке украшений (У-32).
 */
function tagwheelPanelPaints(colors) {
  if (!colors) return false;
  return Boolean(colors.fillColor) || Boolean(colors.defaultTextColor)
    || Boolean(colors.activeTextColor) || colors.showPrefix === false;
}

/**
 * Что оформляется в панели TagWheel на одной строке.
 *
 * Чистая функция: на входе текст строки, цвета и набор плейсхолдеров, на
 * выходе список отрезков с видом оформления. CodeMirror здесь не участвует —
 * и это главное в ней.
 *
 * Зачем так. Слой панели раньше заменял весь отрезок `==…==` **одним
 * виджетом**, и это был класс поломки, а не настройка: внутри отрезка живут
 * вещи, которые Obsidian оформляет сам — ссылка `[[…]]`, полужирный `**…**`,
 * тег, — и что получится, когда наши замены сложатся с его, из кода не видно.
 * Заказчик видел итог: «вся панель tagwheel невидима и безразмерна… только у
 * tagwheel left — у right всё нормально» (B2, 2026-09-02). Слева у него в
 * панели стоит ссылка, справа нет.
 *
 * Проверить это в живом редакторе нечем: DOM Obsidian из проверок
 * недостижим, библиотеки DOM в проекте нет. Поэтому утверждение выписано про
 * **механизм**: `kind: "replace"` появляется здесь ровно на одном случае —
 * когда решётки в панели просят спрятать, и тогда заменяется один токен.
 * Остальное — пометки, а пометка ничего не закрывает собой.
 *
 * Виды отрезков:
 *   `fill`    — фон панели;
 *   `text`    — цвет неактивных ячеек, на весь отрезок;
 *   `active`  — цвет и начертание активной ячейки;
 *   `replace` — один токен без приставки (только при спрятанных решётках).
 */
function tagwheelPanelSpans(text, colors, placeholders) {
  const out = [];
  /* Ни одного цвета и решётки на месте — оформлять нечего: полужирное
     начертание активной ячейки рисует сам Obsidian, по звёздочкам. */
  if (!tagwheelPanelPaints(colors)) return out;
  /* Панель узнаётся по своей метке, а не по разметке выделения Obsidian:
     правило объявлено один раз, в `tagwheelPanelSegmentInLine`. */
  const seg = tagwheelPanelSegmentInLine(text);
  if (!seg) return out;

  const innerAt = seg.innerAt;
  /* `seg.closeIdx` здесь не нужен: он был прочитан и не использован ни
     разу. Нашёл это линтер — в `main.js` он не смотрит вовсе, и до
     переезда об этой строке не знал никто (A3, кусок второй). */
  const segment = seg.segment;
  const known = placeholders instanceof Set ? placeholders : new Set();
  const fillColor = String(colors && colors.fillColor || "");
  const textColor = String(colors && colors.defaultTextColor || "");
  const activeColor = String(colors && colors.activeTextColor || "") || textColor;
  const showPrefix = !(colors && colors.showPrefix === false);

  /*
   * Пометка на всю строку панели — и цвет заливки, приезжающий на ней же
   * переменной `--io-twfill`.
   *
   * **Почему заливка не рисуется своим отрезком.** Рисовалась — и это был
   * дефект. Отрезок `mark` CodeMirror режет по своим же границам: тег
   * (`cm-hashtag`), плейсхолдер в обратных кавычках (`cm-inline-code`),
   * спрятанные `**` — каждый рвёт отрезок на куски. Куски получали фон
   * поштучно, пробелы между ячейками оставались незакрашенными, а поля тега
   * и кода делали соседние куски разной высоты. Заказчик 2026-09-05 по
   * скриншоту `12.png`: «по прежнему различается высота элементов, теперь
   * ещё пустоты стали белого цвета, а активный field вообще с непонятной
   * прыгающей рамкой».
   *
   * Сплошной слой на этом месте **уже есть** — подсветка `==…==` самой
   * Obsidian, и она ровно одна на весь отрезок вместе с метками. Спорить с
   * ней было нечем (её `--text-highlight-bg` полупрозрачен и ложился **на**
   * наш цвет), а вот заменить ей цвет — можно: правило в `styles.css` красит
   * `span.cm-highlight` и `span.cm-formatting-highlight` на помеченной строке
   * значением этой переменной. Чужой слой перестаёт быть чужим, и рвать
   * нечего (У-68).
   *
   * Той же пометкой гасятся фон и рамка тегов Obsidian и вставок кода внутри
   * панели: там они ничего не значат — пузыри Value слой внутрь панели не
   * рисует (`tagwheelPanelSpanInLine` отдаёт отрезок слою пузырей), — а вот
   * высоту строки рвут своими полями. Различать ячейки — работа
   * `Non-active Field text color` и `Active Field text color`.
   */
  out.push({
    kind: "line",
    start: seg.start,
    end: seg.end,
    style: fillColor ? "--io-twfill: " + fillColor + ";" : "",
  });
  /*
   * Цвет неактивных ячеек — на весь отрезок: ячейкой здесь может быть и
   * плейсхолдер в обратных кавычках, и готовое значение, и элемент из двух
   * слов. Резать отрезок на ячейки значило бы завести второй разбор панели
   * рядом с движком (У-4).
   */
  if (textColor) {
    out.push({ kind: "text", start: seg.start, end: seg.end, style: "color: " + textColor + ";" });
  }

  /*
   * Активная ячейка. Движок пишет её как `**[текст]**` (`renderControlLine` в
   * `tagwheel_core.js`) — это единственная пометка активности на строке.
   *
   * Цвет ставится **всегда**, а не только когда значение ещё не выбрано.
   * Прежнее условие требовало, чтобы текст ячейки был в наборе
   * плейсхолдеров, — то есть цвет пропадал, стоило выбрать значение:
   * «panel-active-color применяется только для исходного положения field, а
   * когда я начинаю прокручивать — подсветка слетает» (B2, 2026-09-02).
   * Отличать исходное состояние теперь начертание: плейсхолдер полужирный,
   * значение обычное — так и просил заказчик. `!important` нужен потому, что
   * полужирным ячейку делает и сам Obsidian, по звёздочкам вокруг неё.
   */
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
   * Спрятанные решётки (`Show tag markers` выключен). Здесь без подмены не
   * обойтись — меняется сам текст, — но подменяется **один токен**, а не
   * отрезок: внутри токена чужого оформления нет.
   */
  if (!showPrefix) {
    const tokenRe = /`([^`]+)`|(#\S+)/g;
    let m;
    while ((m = tokenRe.exec(segment)) !== null) {
      const raw = String(m[1] || m[2] || "");
      const shown = formatTagwheelDisplayToken(raw, false);
      if (!shown || shown === raw) continue;
      const start = innerAt + m.index + String(m[0] || "").indexOf(raw);
      const end = start + raw.length;
      if (end > start) out.push({ kind: "replace", start, end, text: shown });
    }
  }

  return out;
}

/** Порядок наложения: строка, общий цвет, активная ячейка, подмена токена. */
const TAGWHEEL_SPAN_RANK = { line: -1, text: 1, active: 2, replace: 3 };

/**
 * Переменные темы, которыми красится панель TagWheel, пока цвет не задан
 * (PRD 10.13.23 Ц2, замечание заказчика H4 от 2026-09-04).
 *
 * **То же объявление живёт в панели** — `src/ui/settings/custom/theme_colors.ts`,
 * где эти же переменные показываются в поле выбора цвета. Два объявления
 * одного правила разошлись бы молча, и первым это увидел бы человек: поле
 * показывало бы одно, строка — другое. Совпадение держит пин на литералы
 * (У-32), `tag_visual_render_tests.ts`.
 *
 * Пары взяты у самой Obsidian, а не собраны на глаз: `--text-highlight-bg` —
 * ровно то, чем она красит `==…==`, а панель обособлена именно им.
 */
const TAGWHEEL_THEME_COLOR_VARS = {
  defaultTextColor: "--text-muted",
  activeTextColor: "--text-accent",
  fillColor: "--text-highlight-bg",
}

/**
 * Цвета, которыми панель и правда красится: пустое значение заменяется
 * переменной темы (10.13.23 Ц2). Цвет, заданный человеком, сильнее темы
 * всегда (Ц6).
 *
 * Отдельная функция, а не правка `getTagwheelHeaderColorsFromConfig`: та
 * отвечает на вопрос «что сказано в конфиге», и её «пусто» означает «человек
 * не задал». Смешать эти два ответа значило бы потерять признак, по которому
 * панель показывает поле незаполненным.
 */
function resolveTagwheelPaintColors(colors) {
  const src = isObj(colors) ? colors : {};
  const themed = (value, variable) => {
    const own = String(value || "").trim();
    return own || ("var(" + variable + ")");
  };
  return {
    defaultTextColor: themed(src.defaultTextColor, TAGWHEEL_THEME_COLOR_VARS.defaultTextColor),
    activeTextColor: themed(src.activeTextColor, TAGWHEEL_THEME_COLOR_VARS.activeTextColor),
    fillColor: themed(src.fillColor, TAGWHEEL_THEME_COLOR_VARS.fillColor),
    showPrefix: src.showPrefix !== false,
  };
}

/**
 * Отметки на строке (10.13.12): подсветка обработанной и `Floating button`.
 *
 * Один проход и одно расширение на две функции: обе рисуются поверх строки,
 * обе включаются в Transform и обе живут только на экране. Второй проход по
 * тем же строкам ради второй из них был бы работой на ровном месте.
 */
function getSourceMarksFromConfig(cfg) {
  const i2n = isObj(readCfgPath(cfg, "transform.inline2note")) ? readCfgPath(cfg, "transform.inline2note") : {};
  const sp = isObj(i2n.sourceProcessing) ? i2n.sourceProcessing : {};
  const visual = isObj(sp.visual) ? sp.visual : {};
  const token = String(sp.token || "").trim();
  const moduleOn = readCfgPath(cfg, "features.transform.enabled") === true
    && readCfgPath(cfg, "transform.inline2note.enabled") === true;
  const pct = Number(visual.opacity);
  return {
    moduleOn,
    /* Метка — единственный признак обработанной строки (Н2). Нет метки —
       нечего искать, и подсветка не рисуется вовсе (Н3). */
    token,
    highlight: moduleOn && !!token && visual.enabled === true,
    color: normalizeHexColorInput(visual.color),
    /* Доля для CSS. В конфиге процент, как у остальной прозрачности (Н5). */
    opacity: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.trunc(pct))) / 100 : 0.65,
    button: moduleOn && i2n.floatingButton === true,
    /*
     * Отступ кнопки от текста (замечание заказчика 2026-09-04: «кнопка
     * находится слишком близко к тексту»). Клампит и досыпает умолчание
     * `transform_feature.js` — тот же код, что нормализует остальной
     * Transform, — поэтому здесь число уже законное, и второго объявления
     * границ не появляется (У-32).
     */
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
 * Все определения Fields подряд: сперва теги (`pkm.fields.tags`), затем ссылки
 * и элементы (`pkm.fields.links`).
 *
 * Имена веток названы по **типу** Field, а не по стороне панели (ответ В9):
 * ловушка `leftMode` / `rightMode` стоила проекту трёх правок подряд.
 */
function collectPkmFieldDefinitions(cfg) {
  const fields = isObj(readCfgPath(cfg, "pkm.fields")) ? readCfgPath(cfg, "pkm.fields") : {};
  return []
    .concat(Array.isArray(fields.tags && fields.tags.fields) ? fields.tags.fields : [])
    .concat(Array.isArray(fields.links && fields.links.fields) ? fields.links.fields : []);
}

module.exports = {
  normalizeHexColorInput,
  getTagwheelHeaderColorsFromConfig,
  buildTagwheelPlaceholderSetFromConfig,
  getTagVisualsFromConfig,
  TAG_EMPTY_BUBBLE_BASE_PX,
  computeTagVisualStyle,
  formatFieldTokenForVisual,
  buildFieldTagVisualMap,
  buildGlobalTagVisualMap,
  readTagVisualRowByTokenMaps,
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
  buildBlockStyleCss,
  formatTagwheelDisplayToken,
  TAGWHEEL_FILL_STYLE_CSS,
  BLOCK_FILL_LAYER_CLASS,
  BLOCK_FILL_MARKER_CLASS,
  BLOCK_FILL_DEFAULT_OPACITY_PCT,
  BLOCK_FILL_DEFAULT_HEIGHT_PX,
  BLOCK_FILL_DEFAULT_WIDTH_PCT,
  blockFillLookFromConfig,
  blockFillSpansInLine,
  blockFillPadXPx,
  blockFillGroupPartsByLine,
  buildBlockFillStyleCss,
  CARET_LAYER_CLASS,
  CARET_MARKER_CLASS,
  buildCaretStyleCss,
  caretBlinkMsFromSpeed,
  caretLookFromConfig,
  caretShapeActive,
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
