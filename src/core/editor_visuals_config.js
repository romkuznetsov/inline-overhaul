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
/* «Эта ссылка — значение поля или слово человека» и правила для движков: оба
   дома общие, своих копий здесь быть не должно (В-141, У-32). */
const __rulesShape = require("./pkm_rules_shape.js");
const __rulesHelpers = require("./pkm_rules_runtime_helpers.js");

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
    /* Цвет ячейки с уже выбранным значением: пусто — красится как
       остальные неактивные (его заказ 2026-09-17). */
    chosenValueColor: normalizeHexColorInput(wheel.chosenValueColor),
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
    /* Кегль у каждой стороны свой (его слово 2026-09-19, пункт 2). Одно имя
       на две величины не годится: их читают разные зоны строки. */
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
    /*
     * Повадки ссылки, показанной своим текстом (его слово 2026-09-20:
     * «добавь субхедер `Link view` с двумя контролами на предпросмотр и
     * перетаскивание… при off не работают, при on работают»). Значение
     * заменено нашим узлом, и платформа не знает, что под ним ссылка: обе
     * повадки возвращает плагин, и только когда человек попросил.
     */
    linkShownHover: readCfgPath(cfg, "visual.tags.linkShown.hoverPreview") === true,
    linkShownDrag: readCfgPath(cfg, "visual.tags.linkShown.draggable") === true,
    /*
     * Два цвета ссылки, показанной **как написано** (`З-37`, его ответ
     * `В-174`, вариант «а»). Предмет — значение поля-ссылки, которое стоит в
     * строке как `[[имя]]`; соседние два тумблера, наоборот, про случай, где
     * ссылка заменена своим текстом, и потому ветка здесь **своя**.
     *
     * Пусто значит «взять у темы»: смысл живёт на шве, а не в значении (У-60),
     * и `normalizeHexColorInput` отдаёт пустую строку на всём, что цветом не
     * является.
     */
    linkTargetColor: normalizeHexColorInput(readCfgPath(cfg, "visual.tags.linkAsWritten.targetColor")),
    linkBracketsColor: normalizeHexColorInput(readCfgPath(cfg, "visual.tags.linkAsWritten.bracketsColor")),
    separator1TextColor: normalizeHexColorInput(tags.separator1TextColor) || normalizeHexColorInput(ui.separator1TextColor),
    separator2TextColor: normalizeHexColorInput(tags.separator2TextColor) || normalizeHexColorInput(ui.separator2TextColor),
    stripActive: strip.active === true,
    strip,
  };
}

/*
 * Имена классов пузыря тега в заметке — **одно объявление на код и стили**.
 *
 * `io-bubble` тут занят: так называется пузырь Value в панели, и у него своя
 * геометрия. Класс — это тоже объявление правила, и одно имя на два дела уже
 * стоило шести неоткрывавшихся подсказок (У-103).
 *
 * Заведены переносом инлайновых объявлений оформления в классы (правило
 * каталога Р7, 2026-09-09). Правила лежат в `styles.css`, разделом «Оформление
 * заметки».
 */
const TAG_BUBBLE_CLASS = "io-tagbubble";
const TAG_BUBBLE_EMPTY_CLASS = "io-tagbubble--empty";
const TAG_BUBBLE_FILLED_CLASS = "io-tagbubble--filled";
/*
 * Пузырь тега, которому человек своего цвета не задавал: заливка — акцентный
 * цвет темы, текст — «текст на подложке», то есть ровно так же, как у тега со
 * своим цветом (его решение 2026-09-12, второй заход).
 *
 * **Первая версия брала `--tag-background`, и это оказалось неверно.** У темы
 * Minimal — той, что стоит у заказчика, — фон тега объявлен `transparent`, а
 * вид держится на рамке (`theme.css`, строка 1729). Пузырь честно взял «цвет
 * темы» и вышел невидимым: «визуально дефолтные теги отличаются от тегов, в
 * которых пользователь изменил text/fill — хочу, чтобы они были одинаковые».
 * Имя класса поэтому тоже сменилось: оно называет то, что делает (У-103).
 */
const TAG_BUBBLE_ACCENT_CLASS = "io-tagbubble--accent";
/* Пузырь, по которому можно щёлкнуть: это тег, и у него есть поиск. */
const TAG_BUBBLE_CLICKABLE_CLASS = "io-tagbubble--clickable";
/*
 * Значение поля-ссылки, показанное своим текстом (его заказ 2026-09-20,
 * пункт 14). Имя класса называет дело, а не вид: узел заменяет собой
 * `[[имя]]`, ведёт себя как ссылка и рисуется тем же, чем рисуется ссылка в
 * Block, — кегль и прозрачность приезжают к нему тем же правилом.
 */
const LINK_SHOWN_CLASS = "io-linkshown";

/**
 * Ширина пустого пузыря при 100 %.
 *
 * То же число стоит в панели: `.io-bubble--empty` в `styles.css` считает
 * `calc(30px * var(--io-empty-x))`. Два места, одно число — за их сходством
 * следит `tag_visual_render_tests.ts`, потому что разъехавшиеся формулы уже
 * стоили заказчику настройки, которая «ни на что не влияет» (И-2.3).
 */
const TAG_EMPTY_BUBBLE_BASE_PX = 30;

/**
 * Кегль текста редактора — запасной ответ, когда мерить нечем.
 *
 * Шестнадцать, а не четырнадцать: столько у Obsidian по умолчанию
 * (`--font-text-size` в `app.css` 1.13.7). Дом у числа один, и читает его
 * только `baseTextPx`.
 */
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
     * **Нижние границы опущены по его словам** (замечания 2026-09-09):
     * «tags-bubble-width при минимальном значении… я хочу, чтобы текст в
     * пузырьке начинался практически сразу после начала tag bubble», «то же
     * самое с tags-bubble-height», «tags-text-size — хочу, чтобы минимальное
     * значение могло быть меньше 80%».
     *
     * Прежние границы (`2`, `1`, `10`) съедали нижнюю часть каждой шкалы: на
     * восьмидесяти процентах поле было ещё 5 и 2 точки, а ниже шкала не шла
     * вовсе. Умолчания при этом не двинулись ни на точку — при сотне числа те
     * же, что были.
     */
    /*
     * **Поле считается дробным, а не целым числом точек** (замечание по V1,
     * 2026-09-09: «tags-bubble-height при значении ниже 40 % не меняется, при
     * 20 % высота такая же как при 40 %»). Округление до точки и было той
     * причиной: `round(3 * 0.2)` и `round(3 * 0.4)` — это одна и та же
     * единица, и нижняя треть шкалы стояла на месте. Ограничение платформы тут
     * ни при чём — обмерено браузером: 13.44 против 13.88 точки при
     * округлении, то есть шкала двигала вид на четыре сотых точки за десять
     * процентов. Умолчания не двинулись: при сотне это по-прежнему ровно 6 и 3.
     */
    horizontalPaddingPx: Math.max(0, Math.round(6 * bubbleScaleX * 100) / 100),
    verticalPaddingPx: Math.max(0, Math.round(3 * bubbleScaleY * 100) / 100),
    /*
     * **Кегль считается от кегля редактора, а не от четырнадцати точек**
     * (его замечание 2026-09-19: «при 100 текст в left/right block должен быть
     * таким же как в text block»). Четырнадцать стояли здесь литералом, а у
     * человека кегль текста задаёт тема и его собственная настройка размера —
     * у Obsidian по умолчанию шестнадцать. То есть на сотне процентов пузырь
     * рисовался **не** тем кеглем, которым написан текст рядом, и ни одна
     * проверка этого не видела: подделка страницы объявляла редактору те же
     * шестнадцать, а сравнения с ними не было (У-227 — вид, который мы не
     * объявили, объявляет тема).
     *
     * Мера приходит от того, кто рисует: слой спрашивает
     * `getComputedStyle(view.contentDOM).fontSize`. Четырнадцать остались
     * запасным ответом на случай, когда мерить нечем (проверка без страницы),
     * и названы одним домом — `TAG_TEXT_FALLBACK_PX`.
     */
    /* Дробно, а не целым числом точек: кегль строки бывает нецелым (у
       заголовка темы `16.8`), и округление до точки давало бы «17 против
       16.8» — то есть промах на его же требовании. Та же причина, по которой
       дробны поля пузыря. */
    fontSizePx: Math.max(6, Math.round(baseTextPx(basePx) * textScale * 100) / 100),
    /*
     * Междустрочие пузыря идёт за его высотой, и только вниз от сотни:
     * поджать поля до нуля мало — на низком пузыре остаётся собственное
     * междустрочие, и текст всё равно не упирается в границу. Выше сотни оно
     * прежнее: там он просил только более высокий пузырь, а не более
     * разреженный текст.
     */
    lineHeight: 1 + 0.2 * Math.min(1, bubbleScaleY),
  };
}

function formatFieldTokenForVisual(field, rawToken) {
  const tok = String(rawToken || "").trim();
  if (!tok) return "";
  /*
   * У поля-ссылки значение на строке стоит скобками, а в таблице Values лежит
   * голым именем — ключ вида собирается тем же помощником, которым его
   * собирает панель (его заказ 2026-09-20, пункт 14). Спрашивается **вывод
   * поля**, а не форма значения: «тег это или ссылка» объявлено один раз, в
   * помощниках правил, и второго ответа здесь не заводится.
   */
  if (__rulesHelpers.resolveFieldOutputMode(field, null) === "wikilink") {
    return __sharedUtils.wikilinkVisualToken(tok);
  }
  if (__sharedUtils.startsWithTagToken(tok)) return tok;
  const pref = typeof field?.prefix === "string" ? field.prefix : "#";
  if (!pref && /^\/\S+/.test(tok)) return `#${tok}`;
  return `${pref}${tok}`;
}

/**
 * Годится ли строка ключом вида: тег или ссылка.
 *
 * До 2026-09-20 ключом был только тег, и это было записано в двух обходах
 * сравнением с решёткой. Теперь вид бывает и у значения-ссылки, и вопрос
 * объявлен один раз.
 */
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

/**
 * Чем печатается каждый токен вместо себя — **один дом на всех, кто спрашивает**.
 *
 * Правило «у этого значения есть свой текст» уже объявлено:
 * `resolveEffectiveTagVisualMode` отвечает `custom` только тогда, когда текст
 * и правда задан. Пузырь в заметке спрашивает его на каждом токене строки;
 * коробке скроллера нужен тот же ответ, а строки у неё нет — она показывает
 * значения, которых в заметке ещё нет. Поэтому карта собирается заранее и
 * едет к движку рядом с остальными настройками скроллера.
 *
 * Второго правила здесь не заводится: и отбор строк, и сам текст берутся у тех
 * же помощников, что у отрисовки (У-32).
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
  /* Правило объявлено один раз — `escapeRe` в `shared_utils.js` (У-32).
     Своя копия стояла здесь и расходилась с ним на `0` и `false`:
     `String(s || "")` отдавала пустую строку, то есть пустую
     альтернативу регулярного выражения, а та совпадает со всем. */
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
 * Хвост токена эмодзи-элемента, выведенный из ФОРМАТА поля.
 *
 * Зачем не «всё до пробела». Сканер искал элемент именно так, и формат из
 * нескольких слов обрывался на первом же: у `📅YYYY-MM-DD hh:mm` оформлялась
 * только дата, а `hh:mm` оставалось без прозрачности блока и без размера
 * текста (замечание заказчика C35, 2026-09-02).
 *
 * **Разбор формата тут не свой, и это починка** (замечание по S7,
 * 2026-09-09). Здесь стоял второй разбор того же формата — «подряд идущие
 * буквы образца становятся столькими же цифрами», — и он разошёлся с тем, кто
 * значение **пишет**: у поля с командой `Random characters` формат `111111`,
 * букв в нём нет вовсе, и разбор давал литерал `111111`, а движок пишет туда
 * шесть случайных знаков. Токен вида «🤣XIInR_» сканер не находил, и элемент
 * оставался без прозрачности блока, без размера текста и без подложки. Теперь
 * образец спрашивается у `shared_utils`, там же, где живёт запись значения
 * (У-32).
 */
function elementTailPatternFromFormat(format, commandRaw) {
  return __sharedUtils.buildElementTailRegexSource(format, commandRaw);
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
    /* Команда поля решает, чем заполнены слоты образца: цифрой или знаком из
       набора. Без неё значение `Random characters` образцом не описывается. */
    const inc = isObj(row.increment) ? row.increment : {};
    out.push({ marker, tail: elementTailPatternFromFormat(row.format, inc.command) });
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
function scanLineVisualTokens(text, sep1, sep2, elementMarkers, blockKinds, isLinkValue) {
  const src = String(text || "");
  const found = [];
  /*
   * **Знак заголовка тегом не становится** (замечание заказчика 2026-09-13,
   * `Скриншоты`: «`##` (уровень хедера) стал пузырьком — этого не должно
   * быть»). Наше правило «что такое тег» — решётка плюс непробел, и `##` под
   * него подходит целиком. В разборе строки это чинилось тем же днём; сюда
   * правило не доходило, потому что было объявлено в разборе, а не в общем
   * доме. Теперь дом один — `shared_utils`, и длина знака берётся оттуда.
   */
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
    /*
     * Хвост берётся из формата поля, а не «всё до пробела»: формат из
     * нескольких слов иначе обрывается на первом (C35). Формата нет —
     * остаётся прежнее правило: гадать о длине честнее, чем выдумать её.
     */
    pushAll(new RegExp(escapeRegExp(marker) + (tail || "\\S+"), "g"), "element");
  }
  pushAll(__sharedUtils.tagTokenScanner(), "tag");

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
      zone: blockValueZone(
        resolveTagVisualZone(src, entry.index, sep1, sep2),
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
 * Размеры `Inline appearance` — про Left и Right Block, а не про ваш текст.
 *
 * **Одно объявление на обе отрисовки, и это починка** (У-159, правило 80,
 * замечание заказчика 2026-09-12). Правило про зону знала одна половина:
 * `buildBlockStyleCss` спрашивала её и для середины строки не давала ничего, а
 * пузырю (`TagVisualTokenWidget`) размеры передавались **безусловно**. Поэтому
 * тег со своим цветом, стоящий в тексте человека между разделителями, рос от
 * `Text size` наравне с блоками: «внутри сепараторов изменяться от этой опции
 * не должно». Теперь обе отрисовки спрашивают здесь.
 *
 * **Форма сюда не входит.** Скругление (`Tags bubble corners`) — это вид, а не
 * размер: пузырь, оставшийся круглым посреди квадратных, читался бы как
 * дефект. Оно приезжает к пузырю где угодно, как и цвет.
 */
function tagVisualSizingForZone(zone, visuals) {
  const inBlock = zone === "left" || zone === "right";
  const num = (value, fallback) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
  };
  /* Своя величина у каждой стороны, и спрашивается она здесь один раз: это
     единственное место, где известно, какая зона рисуется. */
  const sidePct = zone === "left"
    ? num(visuals && visuals.tagTextSizeLeftPct, 100)
    : zone === "right"
      ? num(visuals && visuals.tagTextSizeRightPct, 100)
      : 100;
  return {
    inBlock,
    /*
     * **Кегль — единственное, что кончается на границе Block**, и границу эту
     * провёл заказчик дважды. Сначала: «то, что внутри сепараторов, изменяться
     * от этой опции не должно» — про `Text size`. Потом, когда разнобой в его
     * тексте стал виден: «да, должны. Не должен действовать только
     * tags-text-size» — про остальные ползунки.
     */
    textSizePct: inBlock ? sidePct : 100,
    bubbleWidthPct: num(visuals && visuals.tagBubbleWidthPct, 100),
    bubbleHeightPct: num(visuals && visuals.tagBubbleHeightPct, 100),
    emptyBubblePct: num(visuals && visuals.emptyBubbleSizePct, 100),
  };
}

/**
 * Строка, которой плагин распоряжается: в ней есть хотя бы один его
 * разделитель.
 *
 * **Одно объявление, и появилось оно по его слову** (2026-09-12): «все теги
 * такой строки рисует плагин… обычные заметки без разделителей плагин не
 * трогает вовсе». Без этой границы правило «тегу — наш пузырь» перекрасило бы
 * теги во всём хранилище, включая заметки, к плагину отношения не имеющие.
 */
function lineBelongsToPlugin(lineText, sep1, sep2) {
  const at = lineSeparatorBounds(lineText, sep1, sep2);
  return at.first >= 0 || at.last >= 0;
}

/**
 * **Написанное в Block стоит серединой строки, а не её низом.**
 *
 * Его замечание `G4`, 2026-09-16: «я говорил не про текст тега, а про всё, что
 * находится в технических блоках left/right (tags, wikilinks,
 * emoji-elements) — хочу, чтобы при уменьшении текста все values в технических
 * блоках были выровнены по центру строки, а не по нижней границе».
 *
 * Пузырь тега эту строку уже получил (`io-tagbubble`, 2026-09-16), и потому
 * прошлая правка починила **треть** предмета: ссылка и элемент — не наши узлы,
 * им достаётся не пузырь, а пометка стилем, и у неё выравнивания не было.
 * Обмерено браузером до правки, на полосе `tags-block-fill`: при 50 % ссылка
 * и элемент стоят на 5 точек ниже середины полосы (сверху 13, снизу 3), при
 * 100 % — в пределах точки.
 *
 * Класс, а не свойство узла: вид объявляется классами (Р7), и инлайновый
 * стиль сильнее любого правила темы, которое человек мог бы поправить (У-125).
 * Величины по-прежнему едут стилем — они считаются на отрисовке.
 */
const BLOCK_VALUE_CLASS = "io-blockvalue";

/*
 * Имена кусков ссылки, показанной как написано (`З-37`) — **одно объявление
 * на код и стили** (У-103). `io-link__target` и `io-link__mark` тут заняты:
 * так зовутся куски ссылки в предпросмотре панели, и её правила — со своим
 * кеглем — накрыли бы отрезок в заметке.
 */
const LINK_TARGET_CLASS = "io-linkwritten__target";

const LINK_BRACKETS_CLASS = "io-linkwritten__mark";

/**
 * Три куска ссылки, показанной как написано: скобка, цель, скобка.
 *
 * Образец спрашивает ровно то, что видно, и **своего разбора ссылки здесь
 * нет**: цель и подпись после черты — вопрос другой, на него отвечает
 * `wikilinkTargetOf` в общем доме. Токен, не похожий на `[[…]]`, кусков не
 * даёт вовсе — пустой ответ и есть ответ (У-209).
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
 * Гиперссылки в любой заметке — его заказ `В-181`, 2026-09-22.
 *
 * Его слова: «должны краситься гиперссылки в любой заметке (по аналогии как
 * сейчас реализовано с wikilink)… пусть гиперссылки будут не только формата
 * `[hyper](link)`, но и просто ссылки (кроме wikilink). Если я просто вставлю
 * в строку `www.example.com`, то цвет ссылки будет как у контрола на цвет
 * текста ссылки».
 *
 * **Этот разбор ничего не решает о Block.** Он живёт рядом со
 * `scanLineVisualTokens`, но в него не входит: там решается, что считается
 * значением Block — кегль, прозрачность, полоса, — и вписать туда ссылку
 * значило бы поменять ответ на вопрос, которого он не задавал. Здесь только
 * два цвета и ни одного следствия.
 *
 * **Что считается ссылкой.** Разметка `[подпись](адрес)` и голый адрес: схема
 * с двумя косыми (`https://…`), `mailto:` и начало с `www.`. Wikilink сюда не
 * входит нарочно — его красит прежняя дорога, по значению Field.
 */
/*
 * **Длина схемы ограничена нарочно, и цена этого измерена.** Открытый
 * `[A-Za-z0-9+.-]*` перед `://` заставляет разбор на каждой букве длинного
 * слова проходить его до конца в поисках двоеточия: на строке в 22 тысячи
 * знаков это 251 мс **на каждую перерисовку**, и строку такой длины человек
 * получает одной вставкой. С пределом в пятнадцать знаков — 1,4 мс, и ни одна
 * настоящая схема в него не упирается (`https`, `obsidian`, `ftp`, `mailto`).
 */
const BARE_LINK_RE = /(?:[A-Za-z][A-Za-z0-9+.-]{0,14}:\/\/|mailto:|www\.)[^\s<>"'`]+/g;
const MD_LINK_RE = /(!?)\[([^\][\n]*)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g;
/*
 * Знаки, которые в конце голого адреса принадлежат предложению, а не ссылке.
 * Список закрытый: `/`, `#` и `=` в конце адреса законны и остаются.
 */
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
 * Ссылки строки: у каждой — отрезок подписи (его красит цвет текста ссылки) и
 * отрезки самой разметки (их красит цвет скобок).
 *
 * Голый адрес подписью считается целиком: читаемого и служебного в нём не
 * разделить, и человек видит его именно так.
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
    out.push({
      kind: "md",
      start,
      end,
      labelFrom,
      labelTo,
      marks: [
        { from: start, to: labelFrom },
        { from: labelTo, to: end },
      ],
    });
    claimed.push({ start, end });
  }

  BARE_LINK_RE.lastIndex = 0;
  while ((m = BARE_LINK_RE.exec(src)) !== null) {
    let end = m.index + m[0].length;
    while (end > m.index && LINK_TAIL_MARKS.indexOf(src[end - 1]) >= 0) end--;
    if (end <= m.index) continue;
    if (!free(m.index, end)) continue;
    out.push({
      kind: "bare",
      start: m.index,
      end,
      labelFrom: m.index,
      labelTo: end,
      marks: [],
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
 * Прозрачность блока и размер текста для токена, у которого нет своего цвета.
 *
 * Токен со своим цветом получает и то и другое через пузырь
 * (`TagVisualTokenWidget`); всем остальным нужна декорация **стилем**, а не
 * подменой: заменить `[[Note]]` своим узлом значит забрать у ссылки клик.
 *
 * Текст между разделителями не трогается — это ваш текст, а не запись
 * плагина (решение заказчика 2026-09-01).
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
  /* Размер берётся той же функцией, что и у пузыря: иначе текст в блоке
     разъедется с текстом в пузыре при одной и той же настройке. */
  const st = computeTagVisualStyle(sizePct, 100, 100, 0, basePx);
  /*
   * **И подъём — тот же, что у пузыря** (его слово 2026-09-19: «при 100
   * текст в left/right block должен быть таким же как в text block»).
   * Ссылку и эмодзи-элемент рисуем не мы, но кегль им задаём мы — значит и
   * уровень наш: на сотне подъёма нет и они стоят базовой линией, как
   * обычный текст, мельче — поднимаются на половину разницы кеглей.
   * Правило одно на оба рода значений, потому что вопрос у них один (У-206).
   */
  const rise = Math.round((baseTextPx(basePx) - st.fontSizePx) / 2 * 100) / 100;
  return { inBlock: true, opacity, fontSizePx: st.fontSizePx, risePx: rise || null };
}

/**
 * То же самое строкой стиля — для отрезка, который рисует платформа.
 *
 * Величины считает `blockValueStyleVars`, и второй раз они здесь не
 * выводятся: у заменённого значения-ссылки те же числа приезжают переменными
 * `--io-*` (Р7 каталога запрещает вид строкой атрибута), и расхождение между
 * заменённым и незаменённым значением было бы видно глазом.
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
  /* Цель ссылки называет общий дом: свой образец стоял здесь одним из
     четырёх, и подпись после черты все четверо отбрасывали по-своему. */
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

/*
 * Имена подсветки прыжка (Н5). Имя класса — такое же объявление правила, как
 * имя функции, и одно имя на два дела уже стоило шести неоткрывавшихся
 * подсказок (У-103). Поэтому у слоя над заметкой имена **свои**: `io-jumpline`
 * и `io-jumpflash` заняты предпросмотром в панели, и его правила — со своим
 * положением и своим шрифтом — накрыли бы круг над заметкой.
 */
const JUMP_FLASH_LAYER_CLASS = "io-editor-jumplayer";

const JUMP_FLASH_MARKER_CLASS = "io-editor-jumpflash";

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

/**
 * Подсветка места, куда прыгнул курсор, — что о ней говорит конфиг (Н5).
 *
 * Отдаётся разбор, а не куски: слой спрашивает его один раз и дальше едет с
 * ответом. Своего правила здесь нет ни одного — границы те же, какие ставит
 * нормализация конфига, а цвет проходит тем же приведением, что и все
 * остальные цвета панели.
 *
 * Пустой цвет — это ответ, а не пропуск: «взять у темы». Смысл живёт на шве,
 * потому что в значение контрола он не влезает (У-60).
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
    enabled: flash.enabled === true,
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
const BLOCK_FILL_DEFAULT_HEIGHT_PCT = 60;
/**
 * Умолчание ширины — **середина шкалы**, и это её же ориентир.
 *
 * Заказчик назвал три положения ползунка (замечание по S7, 2026-09-09):
 * начало шкалы — подложка от первого значения до последнего, середина — до
 * разделителя, верх — включая разделитель. Умолчанием стоит середина: это
 * единственное положение, у которого есть имя.
 */
const BLOCK_FILL_DEFAULT_WIDTH_PCT = 50;

/**
 * Шкала высоты — **доля свободного места до краёв строки**, а не точки.
 *
 * Точками она была до 2026-09-09, и верхняя её половина у заказчика была
 * мёртвой: «tags-block-fill-height изменяются только при значениях ползунка от
 * 0 до 2 px, а при значениях от 3 до 5 высота как при 2px». Причина не в шкале
 * и не в дефекте счёта — подложка **упирается в высоту строки**, иначе полосы
 * соседних строк наедут друг на друга, а этого он просил не допускать. Сколько
 * места остаётся между написанным и краем строки, решает начертание темы: у
 * него между ними две с половиной точки, и три верхних деления шкалы в точках
 * назвать было нечем.
 *
 * Поэтому у шкалы теперь два ориентира, и оба выполняются на любой теме:
 * **ноль** — подложка ровно по написанному, **сотня** — подложка заполняет
 * зрительную строку целиком. Между ними — доля этого расстояния, и каждое
 * деление двигает вид, потому что делится измеренное, а не выдуманное.
 */
const BLOCK_FILL_MAX_HEIGHT_PCT = 100;

/**
 * Доля, которую занимает написанное в зрительной строке, — на случай, когда
 * платформа своей меры не отдала.
 *
 * Своя мера у неё есть (`heightOracle.textHeight`, ею же считает и сам
 * CodeMirror), и берётся она первой. Это — только запас, и он назван: без
 * него подложка при отказе измерения стала бы толщиной в строку целиком.
 */
const BLOCK_FILL_TEXT_HEIGHT_SHARE = 0.7;

/**
 * Какой Block получает полосу — его слово 2026-09-19 (З-12): «при left —
 * полоска возникает только в left block, при right — только в right block»,
 * умолчание `both`.
 *
 * Значения совпадают с именами зон разбора строки, и это не совпадение:
 * вопрос задаётся о зоне, а другого способа назвать сторону у нас нет.
 *
 * **Второй дом умолчания — схема панели**, выводимая из прототипа (правило 106):
 * здесь стоит ответ движка для файла, в котором ключа ещё нет, там — для
 * контрола. Так же устроены остальные величины полосы.
 */
const BLOCK_FILL_DIRECTIONS = ["left", "right", "both"];
const BLOCK_FILL_DEFAULT_DIRECTION = "both";

/**
 * Получает ли эта сторона полосу.
 *
 * Правило объявлено **один раз на обе отрисовки** (У-217): его спрашивают и
 * слой заметки, и предпросмотр панели. Незнакомое значение читается как
 * `both` — полоса это украшение, и пропадать ей от испорченного ключа не за
 * что (правило отказов, семья «украшение»).
 */
function blockFillZoneWanted(direction, zone) {
  const dir = String(direction || "").trim();
  const known = BLOCK_FILL_DIRECTIONS.indexOf(dir) !== -1 ? dir : BLOCK_FILL_DEFAULT_DIRECTION;
  if (known === "both") return true;
  return known === String(zone || "").trim();
}

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
    /* Высота — в долях свободного места между написанным и краями зрительной
       строки. Ноль: ровно по написанному. Сотня: строка заполнена целиком. */
    heightPct: blockFillIntOr(src.heightPct, 0, BLOCK_FILL_MAX_HEIGHT_PCT, BLOCK_FILL_DEFAULT_HEIGHT_PCT),
    /* Ширина — в долях расстояния до разделителя: границу назвал заказчик, и
       она зависит от строки, а не от шкалы. */
    widthPct: blockFillIntOr(src.widthPct, 0, 100, BLOCK_FILL_DEFAULT_WIDTH_PCT),
    /* Сторона (З-12). Здесь только нормализованное значение; решает по нему
       `blockFillZoneWanted` — он один на слой заметки и на предпросмотр. */
    direction: BLOCK_FILL_DIRECTIONS.indexOf(String(src.direction || "").trim()) !== -1
      ? String(src.direction).trim()
      : BLOCK_FILL_DEFAULT_DIRECTION,
  };
}

/**
 * На сколько подложка выходит за написанное по горизонтали, в точках.
 *
 * **Шкалу заказчик откалибровал сам** (замечание по S7, 2026-09-09): «при
 * минимальном значении полоска в block начиналась от начала первого элемента
 * до конца последнего, при среднем положении — была до сепаратора (и
 * зеркально с другой стороны), а при максимальном — включала separator».
 *
 * Отсюда две меры вместо одной и **перелом на середине**:
 *
 *   * `nearPx` — от края блока до ближней границы разделителя (пробел между
 *     ними). Половина шкалы тратится на него, и на пятидесяти подложка стоит
 *     ровно у разделителя;
 *   * `farPx` — до дальней его границы. Вторая половина шкалы тратится на сам
 *     разделитель, и на сотне подложка его включает.
 *
 * Обе — доли измеренного, а не точки: расстояние до разделителя зависит от
 * начертания, и шкала в точках была бы почти вся мёртвой.
 *
 * Мера не измерена или отрицательна — своей части шкалы нет: подложка
 * кончается там, где кончилась предыдущая часть. Придумать расстояние вместо
 * измеренного значило бы заехать за разделитель.
 */
function blockFillPadXPx(look, nearPx, farPx) {
  const pct = Math.min(100, Math.max(0, Number(look && look.widthPct)));
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  const near = Number(nearPx);
  const nearOk = Number.isFinite(near) && near > 0 ? near : 0;
  if (pct <= 50) return (nearOk * pct) / 50;
  const far = Number(farPx);
  /* Разделитель шире промежутка всегда; обратное значит, что измерить его не
     удалось, и второй половины шкалы тогда нет. */
  const sep = Number.isFinite(far) && far > nearOk ? far - nearOk : 0;
  return nearOk + (sep * (pct - 50)) / 50;
}

/**
 * Высота того, что подложка накрывает, — **одно объявление на два вопроса**.
 *
 * Спрашивают её двое: высота самой подложки (сколько свободного места отдать)
 * и её вертикаль (где середина накрытого). Второй вопрос появился с его
 * замечанием `G4`; до него мера жила внутри правила высоты, и вынесена она
 * сюда затем, чтобы вертикаль не считала её второй раз по-своему (У-32).
 */
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
 * Высота подложки в точках — **одна на все строки** (замечание по S7,
 * 2026-09-09: «если в block встречается wikilink, то полоска становится выше,
 * чем в строке, в которой нет wikilink… она должна быть одинаковая во всех
 * строках»).
 *
 * **Почему это считается, а не мерится.** `RectangleMarker.forRange` берёт
 * вертикаль как объединение строчных ящиков **краёв** отрезка
 * (`rectanglesForRange` в `@codemirror/view`), а у ссылки, которую рисует
 * Obsidian, ящик выше ящика соседнего текста: по скриншоту заказчика подложка
 * такой строки на пять точек выше, и выше **только сверху**. То есть высота
 * подложки зависела от того, что в блоке лежит, — а этого он и не хочет.
 *
 * Слагаемых поэтому три, и ни одно не зависит от содержимого строки:
 *
 *   1. `textHeightPx` — высота написанного, мера самой платформы;
 *   2. `bubbleHeightPx` — высота пузыря тега по нынешним настройкам. Пузырь
 *      бывает выше написанного (крупный кегль, высокий пузырь), и подложка
 *      ниже него значила бы цветные края, торчащие наружу;
 *   3. `heightPct` — какую долю оставшегося до краёв строки места человек
 *      попросил отдать подложке, поровну вверх и вниз.
 *
 * И прижим к высоте зрительной строки: подложки соседних строк не
 * пересекаются никогда, чем бы ни был выставлен ползунок.
 *
 * **Высота строки приходит своя у каждой строки, а не умолчанием редактора**
 * (замечание по S7, 2026-09-09, третий заход). Строка со ссылкой, эмодзи или
 * высоким пузырём выше `defaultLineHeight`, и прижим по умолчанию отнимал у
 * такой строки то место, которое на ней есть.
 */
function blockFillBandHeightPx(look, rowHeightPx, textHeightPx, bubbleHeightPx) {
  const lineH = Number(rowHeightPx);
  if (!Number.isFinite(lineH) || lineH <= 0) return 0;
  /* `written` — высота того, что подложка накрывает: значения Block, а не
     слово человека. Кегль значений приводит звавший
     (`blockFillWrittenTextHeightPx`); правило «какую долю свободного места
     отдать» остаётся здесь. */
  const written = blockFillWrittenHeightPx(lineH, textHeightPx, bubbleHeightPx);
  /*
   * Свободное место — то, что осталось от строки за написанным, и оно же вся
   * шкала. Ноль процентов: подложка ровно по написанному. Сто: заполняет
   * строку. Прижим остаётся последней строкой, а не единственной: он ловит и
   * случай, когда написанное само выше строки (крупный пузырь).
   */
  const pct = Math.max(0, Math.min(BLOCK_FILL_MAX_HEIGHT_PCT, Number(look && look.heightPct) || 0));
  const room = Math.max(0, lineH - written);
  return Math.max(1, Math.min(lineH, written + (room * pct) / 100));
}

/**
 * Высота пузыря тега по нынешним настройкам, в точках.
 *
 * Считается **той же функцией**, что задаёт пузырю стиль: второе объявление
 * его размера разошлось бы с первым молча (У-32), а разошедшись — оставило бы
 * подложку ниже пузыря ровно на разницу.
 */
/**
 * Можно ли верить насчитанному числу зрительных строк.
 *
 * **У счёта есть вторая мера, и она обязательна.** Число зрительных строк
 * считается обходом по ответам платформы, а тем числом потом **делится высота
 * строки**. Обход может насчитать меньше, чем их на самом деле, и тихо это не
 * проходит: однострочный ответ на двухрядной строке опускает подложку ровно на
 * половину лишней высоты.
 *
 * Обмерено по разметке и картинке заказчика 2026-09-13: пузыри строки стоят на
 * `77…100`, подложка — на `88…117`, то есть ниже на четырнадцать точек при
 * высоте ряда `31.5` и высоте подложки `30`. Это в точности
 * `(высота строки − высота подложки) / 2` для строки, посчитанной однорядной.
 *
 * Вторая мера — высота: сколько рядов умещается в строке по умолчанию
 * редактора. Насчитали **меньше** — счёту верить нельзя. Насчитали столько же
 * или больше — можно: ряд бывает выше умолчания (У-133), и тогда верен счёт, а
 * не деление.
 *
 * **Рядов считается по нижней границе, а не по округлению.** Ряд бывает выше
 * умолчания в полтора раза и больше: на верху шкал пузыря строка из двух рядов
 * выходит в 2.56 умолчания, и округление объявляло её трёхрядной — то есть
 * верный счёт признавался негодным. Нижняя граница отвечает «сколько рядов там
 * точно есть», а это и спрашивается.
 *
 * Мер нет (платформа промолчала) — верим счёту: прежнее поведение.
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
 * Высота **написанного в Block** — того, что подложка и накрывает.
 *
 * **Его замечание `G4`, второй заход, 2026-09-16:** «сверху и снизу от values в
 * технических блоках должно оставаться одинаковое расстояние до границ полоски
 * tags-block-fill». Высота подложки считалась от высоты написанного в **строке**
 * — то есть от слова человека, набранного обычным кеглем. У него `Tags text
 * size` = 60 %, и значения ровно настолько мельче: подложка выходила выше всего,
 * что в ней лежит, упиралась в края зрительной строки и прижималась к ним, а
 * значения оставались внизу. Обмерено на его настройках: полоса 21,6 при
 * значениях 12,5…16 — свободного места ноль, и середина подложки не могла
 * совпасть с серединой значений ни при каком ползунке.
 *
 * Считается **от настроек, а не от содержимого строки**: это его прежнее
 * условие («полоска должна быть одинаковая во всех строках», 2026-09-09), и
 * оно остаётся в силе — обе величины здесь приходят из панели, а не из того,
 * что человек написал.
 */
function blockFillWrittenTextHeightPx(visuals, textHeightPx, zone) {
  const v = isObj(visuals) ? visuals : {};
  const textH = Number(textHeightPx);
  if (!Number.isFinite(textH) || textH <= 0) return textH;
  const share = tagVisualSizingForZone(String(zone || ""), v).textSizePct;
  return textH * share / 100;
}

/**
 * Высота пузыря, посчитанная от настроек.
 *
 * **Кегль здесь — кегль тега**, а не строки: пузыри в Block рисует тег, и с
 * 2026-09-21 сотня процентов у него значит «как рисует тег сама Obsidian»
 * (`var(--tag-size)`, У-260). Считай эту высоту от кегля строки — и подложка
 * снова стала бы выше того, что в ней лежит, то есть вернулся бы его же
 * пункт `G4`, второй заход (правило 87: у лекарства есть цена, и мерить её
 * надо тем же прогоном).
 *
 * Кегля тега нет (прогон без страницы) — отвечает кегль строки, прежнее
 * поведение.
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
 * Где кончается **знак** начала строки: отступ, цитата, маркер списка,
 * чекбокс, решётки заголовка — и ни один пробел за ними.
 *
 * `linePrefixLength` досыпает к оформлению и пробелы, которые за ним стоят, —
 * это верно для тех, кто ищет начало текста, и неверно здесь: подложке в этот
 * пробел расти можно, а на чекбокс нельзя. Поэтому пробел снимается обратно, а
 * само правило по-прежнему одно и лежит в `shared_utils`.
 */
function blockFillPrefixGlyphEnd(text) {
  const src = String(text || "");
  const at = __sharedUtils.linePrefixLength(src, true);
  let end = Math.max(0, Math.min(src.length, at));
  while (end > 0 && (src[end - 1] === " " || src[end - 1] === "\t")) end -= 1;
  return end;
}

/**
 * Какого рода значения бывают в каждом Block — по порядку Fields.
 *
 * **Замечание заказчика 2026-09-17:** после `Inline to note` исходная строка
 * выглядит как `- [[333/имя]] :: #processed`, и «текст воспринимается как
 * values left block и рисуется полоска». Ссылку туда поставил сам Transform —
 * она стоит **вместо его текста**, — а подложка читала её как значение левого
 * Block. Обмер картинки: полоса цвета его подложки идёт от ссылки до конца
 * строки, то есть она и правда нарисована, а не показалась.
 *
 * Правило простое и своё у подложки: **полоса принадлежит Block**, и Block, в
 * котором значений такого рода не бывает вовсе, красить нечем. У него в обоих
 * vault левый Block пуст — там нет ни одного Field, — и левой полосы поэтому
 * быть не может ни на какой строке.
 *
 * Спрашивается **Order, а не то, что панель показывает сейчас**: поле с
 * невыполненным предусловием своих значений не теряет (правило 107, его ответ
 * В-137). Дочерние поля берут род у родителя — `types` их не называет.
 *
 * Род значения у порядка и у разбора строки назван разными словами:
 * `wikilink` против `link`. Перевод один и здесь, второго быть не должно.
 *
 * **И один токен принадлежит Block не по роду, а по имени** — метка
 * `Inline to note` (его замечание 2026-09-18: «теперь left block без полоски
 * `tags-block-fill` и не учитывающий размер текста `tags-text-size`»). Ставит
 * её туда сам плагин по настройке `Source marker position`, и значением поля
 * она не является ни у кого: у него в левом Block полей нет вовсе, и без этого
 * ответа единственное, что там стоит, оформления Block не получало. По имени, а
 * не по роду — иначе оформление досталось бы и чужому тегу, случайно стоящему
 * слева.
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
  /*
   * Метка обработанной строки и её сторона — у того же объявления, которое
   * читает её слой отметок (`getSourceMarksFromConfig`): второй разбор той же
   * настройки разошёлся бы с ним молча (У-32).
   */
  const marks = getSourceMarksFromConfig(cfg);
  const own = { left: new Set(), right: new Set() };
  const markToken = String(marks && marks.token || "").trim();
  if (marks && marks.moduleOn && markToken) {
    const side = String(readCfgPath(cfg, "transform.inline2note.sourceProcessing.panel") || "right")
      .trim().toLowerCase() === "left" ? "left" : "right";
    own[side].add(markToken);
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
 * Бывают ли в этом Block значения такого рода.
 *
 * Ответа «не спрашивали» здесь нет нарочно: молчаливое «да» вернуло бы ровно
 * тот дефект, ради которого правило заведено, и вернуло бы молча (У-56).
 * Кто зовёт подложку, тот и обязан сказать, что в Block бывает.
 */
function blockHoldsKind(blockKinds, zone, kind) {
  const side = isObj(blockKinds) ? blockKinds[zone] : null;
  if (side instanceof Set) return side.has(kind);
  return Array.isArray(side) ? side.indexOf(kind) >= 0 : false;
}

/**
 * Зона токена: та, в которой он стоит, — но только если в этом Block значения
 * такого рода вообще бывают. Иначе это текст человека, то есть середина.
 *
 * **Его замечание 2026-09-17:** «в исходной строке wikilink на трансформированную
 * заметку размера как в `tags-text-size` — так быть не должно, `tags-text-size`
 * должен применяться только к values left и right block, а wikilink
 * трансформированной заметки — часть текста».
 *
 * Правило то же самое, каким чинилась полоса Block днём раньше (У-213,
 * правило 135), и потому оно здесь **одно на всех**: место токена решает не
 * только положение между разделителями, но и то, чьё это оформление. Пока
 * правило знала одна подложка, тот же токен полосы не получал, а кегль и
 * прозрачность Block получал — две половины одного вопроса отвечали по-разному.
 *
 * **Цена та же и называется вслух:** у кого левый Block пуст, написанное слева
 * от первого разделителя — текст, и настройки Block его не трогают вовсе.
 *
 * «Не спросили» здесь значит «значений такого рода в Block не бывает»: молчаливое
 * «да» вернуло бы ровно тот дефект, ради которого правило заведено (У-56).
 */
function blockValueZone(zone, kind, blockKinds, token, isLinkValue) {
  const side = String(zone || "");
  if (side !== "left" && side !== "right") return side;
  /* Свой токен принадлежит Block по имени: полей такого рода в нём может не
     быть вовсе, а поставил его туда сам плагин (его замечание про метку
     `Inline to note` в пустом левом Block). */
  if (blockOwnsToken(blockKinds, side, token)) return side;
  if (!blockHoldsKind(blockKinds, side, kind)) return "middle";
  /*
   * **Род значения мало, когда род — ссылка** (его уточнение 2026-09-18: «не
   * только слева, но и справа от разделителя, если есть значения в left
   * block»). У строки с непустым левым Block слот текста стоит **за** первым
   * разделителем, и по положению он неотличим от правого Block: ссылка
   * `Inline to note`, стоящая в слоте, получала оформление Block там, где
   * ссылки в Block бывают. Спрашивается то же, что и у движков: названа ли
   * эта ссылка значением какого-нибудь поля (В-141). Тег остаётся значением по
   * роду — его слово по `#processed`: «справа, у `#processed`, подложка
   * должна» быть.
   */
  if (kind === "link" && typeof isLinkValue === "function" && !isLinkValue(token)) return "middle";
  return side;
}

/**
 * Признак «эта ссылка — значение поля» для слоя оформления.
 *
 * Дом признака один и живёт у движков; здесь только сборка правил из конфига —
 * та же, какой их собирает рантайм. Строится **один раз на проход** отрисовки:
 * 0,2 мс на его конфиге, и от строки он не зависит.
 */
let wikilinkTestFailureReported = false;

function buildWikilinkValueTestFromConfig(cfg) {
  try {
    return __rulesHelpers.makeWikilinkValueTest(__rulesShape.buildRulesForEngines(cfg));
  } catch (e) {
    /*
     * **Оформление не имеет права уронить заметку** (раздел «Отказы», семья
     * «украшение»), но и молчать тут нельзя: без признака ссылка снова
     * становится значением Block по роду. Поэтому отказ уходит в журнал
     * разработчика — один раз за сеанс, иначе он писался бы на каждый кадр, —
     * а слой возвращается к прежнему ответу.
     *
     * Дойти сюда можно только с конфигом, не прошедшим `migrateConfig`: у
     * прошедшего корзины полей есть всегда, пусть и пустые.
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
function blockFillSpansInLine(text, sep1, sep2, elementMarkers, blockKinds, isLinkValue) {
  const src = String(text || "");
  /* Значение считается значением **этого** Block, только если такие в нём
     бывают. Вопрос задаётся один раз — при разборе строки (`blockValueZone`):
     пока его знала одна подложка, кегль и прозрачность Block доставались тому
     же токену, которому полосы уже не давали. Разбор строки у движков решает
     иначе, и это отдельный вопрос — у него свой ответ и своя цена (10.13.187). */
  const tokens = scanLineVisualTokens(src, sep1, sep2, elementMarkers, blockKinds, isLinkValue);
  const at = lineSeparatorBounds(src, sep1, sep2);
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
    /*
     * Дальняя граница разделителя — вторая половина шкалы `Band width`: на
     * сотне подложка разделитель включает. Слева это конец первого
     * разделителя, справа — начало последнего; ближняя граница у обоих та, что
     * уже названа в `gapFrom`/`gapTo`.
     */
    const sepFar = zone === "left" ? at.firstEnd : at.last;
    out.push({
      zone,
      start,
      end,
      gapFrom: gapTo > gapFrom ? gapFrom : -1,
      gapTo: gapTo > gapFrom ? gapTo : -1,
      sepFar: gapTo > gapFrom && sepFar >= 0 ? sepFar : -1,
      /*
       * Где кончается оформление начала строки. Его условие: «даже в
       * максимальном положении ползунка полоска должна начинаться после
       * префикса не включая его». Берётся **знак** префикса, без пробелов за
       * ним: пробел между чекбоксом и первым значением — не префикс, и
       * подложке в него расти можно.
       *
       * Правило одно и живёт в `shared_utils`: второе объявление форм начала
       * строки здесь разошлось бы с движками молча (У-32).
       */
      prefixEnd: blockFillPrefixGlyphEnd(src),
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
   * `docs/dev/AWAITING_OWNER_CHECK.md`, раздел 8, с оговоркой «снять при
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
 * Отрезок строки, который принадлежит панели TagWheel: **слой пузырей внутри
 * него не рисует ничего**.
 *
 * `null` — на строке панели нет.
 *
 * Функция одна на два слоя, и это главное в ней. Правило «панель заменяется
 * целиком» раньше жило только внутри слоя TagWheel, а слой пузырей о нём не
 * знал: он к тому времени уже спрятал токены строки своими нулевой ширины, и
 * на один и тот же отрезок приходились две замены. На экране это выглядело
 * так, как заказчик и написал: «вся строка tagwheel пропадает, я вижу только
 * selector, но fields невидимы и не занимают места» (B2, 2026-09-02). Второе
 * объявление того же правила разошлось бы снова (У-32).
 *
 * **Цвета здесь больше не спрашиваются, и это чинка его замечания 2026-09-20**
 * («я удалил все настройки и начал заново — получил такое»). Условие стояло
 * от прежнего устройства, где панель и правда заменялась виджетом, — и
 * разошлось со вторым читателем тех же цветов (У-216): слой оформления
 * спрашивает их через `resolveTagwheelPaintColors`, где пустое заменяется цветом
 * темы, а слой пузырей спрашивал ответ конфига напрямую. У человека, который
 * цвета панели не трогал вовсе — то есть у каждого, кто только что поставил
 * плагин, — отрезок не забирался, и пузырь вставал поверх разметки самой
 * панели: на его строке слой находил токен `#low]**` и рисовал его пузырём.
 * Пузырь внутри панели неверен при любых цветах: то, что там написано, плагин
 * нарисовал сам, и токенов человека там нет.
 */
function tagwheelPanelSpanInLine(text) {
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
    || Boolean(colors.activeTextColor) || Boolean(colors.chosenValueColor)
    || colors.showPrefix === false;
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
  const chosenColor = String(colors && colors.chosenValueColor || "");
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
  /*
   * **Ячейка, в которой значение уже выбрано** — его заказ 2026-09-17: «сейчас
   * в tagwheel дефолтное значение field (само название field) визуально не
   * различается от измененного значения field… при `Type` цвет field должен
   * определяться panel-text-color, а при `#todo` в зависимости от этого
   * контрола».
   *
   * **Ячейки здесь не режутся, и это нарочно** — резать их значило бы завести
   * второй разбор панели рядом с движком (У-4). Красится **дополнение**: из
   * отрезка панели вычитается всё, что рисует не выбранное значение, — имя
   * поля и активная ячейка, — а остальное и есть выбранные значения. Пробелы
   * между ячейками попадают в дополнение и знаков не несут, так что цвет на
   * них не виден.
   *
   * **Имя поля узнаётся по обратным кавычкам, и только по ним.** Так его
   * печатает сам движок (`buildGroupDisplay`), и это единственная пометка,
   * которую он на имя ставит. Второй способ — искать имена поля из конфига в
   * тексте панели — здесь стоял и был снят: он признак **по образцу** (У-201)
   * и красит не тем цветом любое значение, внутри которого случилось имя поля
   * (`Type` внутри `#Typed`). Имя группы, склеенной из двух полей, он не
   * находит вовсе — а кавычки находят.
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
const TAGWHEEL_SPAN_RANK = { line: -1, text: 1, chosen: 2, active: 3, replace: 4 };

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
 *
 * **Этот шов молча терял цвет, и это его замечание 2026-09-17** («не работает —
 * я установил `panel-chosen-color`, ждал, что поменяется цвет выбранных
 * значений»): `Chosen Value text color` доезжал до предпросмотра в панели и не
 * доезжал до заметки, потому что здесь его не было в списке. Весь набор был
 * зелёным: проверки зовут `tagwheelPanelSpans` с ответом конфига напрямую, минуя
 * этот шов. Поэтому ключи теперь не перечисляются заново, а **переносятся**:
 * новый цвет доедет сам, а сторож на форму стоит в `tag_visual_render_tests.ts`.
 */
function resolveTagwheelPaintColors(colors) {
  const src = isObj(colors) ? colors : {};
  const themed = (value, variable) => {
    const own = String(value || "").trim();
    return own || ("var(" + variable + ")");
  };
  /*
   * Пустое значение заменяется переменной темы только там, где тема названа:
   * у `Chosen Value text color` её нет нарочно — «пусто» у него значит «как
   * остальные неактивные», а не «возьми у темы», и подстановка перекрасила бы
   * ячейку у всех, кто контрол не трогал.
   */
  const out = { showPrefix: src.showPrefix !== false };
  /* Цвет с названной темой есть всегда — даже когда о нём не спросили: пустая
     панель обязана остаться читаемой (10.13.23 Ц2). */
  for (const key of Object.keys(TAGWHEEL_THEME_COLOR_VARS)) {
    out[key] = themed(src[key], TAGWHEEL_THEME_COLOR_VARS[key]);
  }
  for (const key of Object.keys(src)) {
    if (key === "showPrefix" || Object.prototype.hasOwnProperty.call(out, key)) continue;
    out[key] = String(src[key] || "").trim();
  }
  return out;
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
  TAG_TEXT_FALLBACK_PX,
  baseTextPx,
  TAG_BUBBLE_CLASS,
  TAG_BUBBLE_EMPTY_CLASS,
  TAG_BUBBLE_FILLED_CLASS,
  TAG_BUBBLE_ACCENT_CLASS,
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
