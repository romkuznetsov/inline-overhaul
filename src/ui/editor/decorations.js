/**
 * Оформление редактора: то, что рисует CodeMirror.
 *
 * Виджеты декораций, сборка отрезков для тегов, полосы приоритета, панели
 * TagWheel и меток обработанной строки, слой каретки — и пять расширений
 * редактора, которые `main.js` регистрирует в `onload`.
 *
 * **Что решает конфиг, здесь не решается:** цвета, режимы и признаки читает
 * `src/core/editor_visuals_config.js`, и зовётся он отсюда. Обратной связи
 * нет — это проверено обходом ссылок при переезде.
 *
 * **Откуда взялось.** Вынесено из `main.js` 2026-09-07, кусок второй разбора
 * A3 (PRD, раздел 11). Тела функций при переезде не правились: каждое имя,
 * которое они зовут, объявлено здесь тем же именем.
 *
 * Вход один — `plugin`, и он приходит аргументом: своего состояния у слоя
 * оформления нет.
 *
 * Модули — литеральным `require`, по одному на модуль (У-89).
 */
const cmView = require("@codemirror/view");
const cmState = require("@codemirror/state");
const __sharedUtils = require("../../core/shared_utils.js");
const __priorityStripEngine = require("../../core/priority_strip_engine.js");
const __priorityStripCm6Adapter = require("../../core/priority_strip_cm6_adapter.js");
const __commandIds = require("../../features/command_ids.js");
const __editorVisualsConfig = require("../../core/editor_visuals_config.js");
const __devLog = require("../../core/dev_log.js");

function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/* Имена берутся из модуля конфига поштучно: тела ниже зовут их без префикса,
   и приписывать префикс значило бы править переехавший код (У-11). */
const {
  BLOCK_FILL_LAYER_CLASS,
  BLOCK_FILL_MARKER_CLASS,
  blockFillLookFromConfig,
  blockFillSpansInLine,
  blockFillPadXPx,
  blockFillBandHeightPx,
  blockFillRowCountTrusted,
  blockFillBubbleHeightPx,
  blockFillWrittenTextHeightPx,
  CARET_LAYER_CLASS,
  CARET_MARKER_CLASS,
  JUMP_FLASH_LAYER_CLASS,
  JUMP_FLASH_MARKER_CLASS,
  TAGWHEEL_SPAN_RANK,
  TAG_EMPTY_BUBBLE_BASE_PX,
  TAG_BUBBLE_CLASS,
  TAG_BUBBLE_EMPTY_CLASS,
  TAG_BUBBLE_FILLED_CLASS,
  TAG_BUBBLE_ACCENT_CLASS,
  TAG_BUBBLE_CLICKABLE_CLASS,
  buildBlockStyleCss,
  blockValueClassFor,
  buildElementMarkersFromConfig,
  buildFieldTagVisualMap,
  buildGlobalTagVisualMap,
  buildTagTokenSetForField,
  buildTagwheelPlaceholderSetFromConfig,
  caretLayerRangeFor,
  caretShapeActive,
  jumpFlashLookFromConfig,
  computeTagVisualStyle,
  getSourceMarksFromConfig,
  getTagVisualsFromConfig,
  getTagwheelHeaderColorsFromConfig,
  isHardLineBlockBoundary,
  isRenderableStripContext,
  lineHasProcessedToken,
  normalizeHexColorInput,
  normalizeVisualTokenKey,
  rangeIntersects,
  readTagVisualRowByTokenMaps,
  resolveEffectiveTagVisualMode,
  resolveTagwheelPaintColors,
  lineBelongsToPlugin,
  scanLineVisualTokens,
  buildBlockKindsFromConfig,
  tagVisualSizingForZone,
  tagwheelPanelSpanInLine,
  tagwheelPanelSegmentInLine,
  tagwheelPanelSpans,
} = __editorVisualsConfig;

/*
 * Запись следа в журнал разработчика живёт в модуле журнала —
 * `dev_log.traceQuietly`, и там же объяснено, почему она молчит о своём
 * собственном отказе. Здесь только короткое имя: тела ниже зовут его без
 * префикса, и приписывать префикс значило бы править переехавший код (У-11).
 *
 * Сюда её тянуло семь мест по всей программе, и каждое несло свой `try` с
 * пустым `catch` — то есть правило было объявлено семь раз (У-32, Д-4).
 */
const traceEvent = __devLog.traceQuietly;

/**
 * Отрезки оформления → набор платформы, **с отчётом об отказах** (Д-4).
 *
 * `RangeSetBuilder.add` бросает, когда отрезки приходят не по порядку или
 * пересекаются недопустимо. До 2026-09-09 отказ здесь глотался молча в
 * **четырёх** местах: декорация просто не рисовалась, и узнать об этом было
 * нельзя — ни человеку, ни мне. Тихий отказ неотличим от дефекта (У-41).
 *
 * Это второй вид отказа по правилу отказов — «сломалось невидимое»: человек
 * придёт со словами «перестало красить», и журнал разработчика единственное,
 * из чего можно будет узнать, почему. Ронять отрисовку по-прежнему нельзя:
 * заметка дороже картинки.
 *
 * **Отчёт один на проход, а не на отрезок.** Сбитый порядок роняет каждый
 * следующий `add`, и запись на каждый залила бы консоль целиком — то есть
 * спрятала бы ровно то, ради чего её читают.
 */
function buildDecorationSet(ranges, where) {
  const list = Array.isArray(ranges) ? ranges : [];
  const builder = new cmState.RangeSetBuilder();
  let refused = 0;
  let firstMessage = "";
  let firstRange = null;
  for (let i = 0; i < list.length; i++) {
    const r = list[i] || {};
    try {
      builder.add(r.from, r.to, r.deco);
    } catch (e) {
      refused += 1;
      if (!firstRange) {
        firstRange = { from: r.from, to: r.to };
        firstMessage = String((e && e.message) || e || "");
      }
    }
  }
  if (refused) {
    console.error("[inline-overhaul][" + String(where || "decorations") + "]"
      + " отрезков оформления отвергнуто " + refused + " из " + list.length
      + ", первый " + JSON.stringify(firstRange) + ": " + firstMessage);
  }
  return builder.finish();
}

/**
 * Номера строк документа, попавших в отрисованное окно, — **каждая по разу**.
 *
 * **Правило объявлено здесь один раз** (У-32, У-150), и зовут его все, кто
 * рисует по строкам: пузыри тегов, подложка Blocks, вид панели TagWheel и
 * отметки строки с плавающей кнопкой. До 2026-09-14 каждый из четырёх писал
 * этот обход сам, и все четыре писали его одинаково неверно.
 *
 * **Чем неверно.** Отрисованное окно — это не один отрезок. CodeMirror
 * считает его `RangeSet.spans` по декорациям **состояния** и разрывает на
 * куски там, где стоит замена длиной от двадцати знаков
 * (`computeVisibleRanges` в `@codemirror/view`, порог `minPointSize`). Такая
 * замена у нас одна — маска панели TagWheel, которая прячет значения,
 * закрытые полосой. То есть у строки, где в противоположном Block значений
 * набралось на два десятка знаков, отрезка становится два, оба кончаются и
 * начинаются **внутри одной строки**, и обход по отрезкам проходит эту строку
 * дважды.
 *
 * Заказчик увидел это так: «при наличии values в left block при открытии
 * tagwheel right я вижу две кнопки i2n-floating» (2026-09-13). Кнопка стоит
 * виджетом в конце строки, и второй проход ставит второй такой же виджет
 * рядом.
 *
 * **Отрезки платформа отдаёт по возрастанию**, поэтому «уже пройдено» — одно
 * число, а не множество.
 */
function visibleLineNumbers(view) {
  const doc = view.state.doc;
  const ranges = Array.isArray(view.visibleRanges) ? view.visibleRanges : [];
  const out = [];
  let done = 0;
  for (const vr of ranges) {
    const from = doc.lineAt(vr.from).number;
    const to = doc.lineAt(vr.to).number;
    for (let n = Math.max(from, done + 1); n <= to; n += 1) out.push(n);
    if (to > done) done = to;
  }
  return out;
}

/**
 * Открыть поиск по тегу — ровно тем же вызовом, каким это делает Obsidian.
 *
 * **Правило взято у платформы, а не придумано** (правило 10, У-44). По клику
 * Obsidian берёт токен из синтаксического дерева и для типа `tag` зовёт
 * `internalPlugins.getEnabledPluginById("global-search").openGlobalSearch("tag:" + текст)`
 * (`app.js` 1.13.7). Пузырь Value — наш узел, и клик по нему платформа
 * разбирать не обязана, поэтому тот же вызов делается здесь.
 *
 * Отказ молчит и это проба: поиск — встроенный плагин, человек вправе его
 * выключить, и «нет» тут ответ платформы, а не поломка.
 */
function openTagSearch(plugin, token) {
  const tag = String(token || "").trim();
  if (!tag || tag.charAt(0) !== "#") return false;
  const app = plugin && plugin.app ? plugin.app : null;
  const internal = app && app.internalPlugins ? app.internalPlugins : null;
  if (!internal || typeof internal.getEnabledPluginById !== "function") return false;
  let search = null;
  try {
    search = internal.getEnabledPluginById("global-search");
  } catch (_) {
    /* проба: у платформы этого реестра может не быть вовсе */
    search = null;
  }
  if (!search || typeof search.openGlobalSearch !== "function") return false;
  search.openGlobalSearch("tag:" + tag);
  return true;
}

class TagVisualTokenWidget extends cmView.WidgetType {
  constructor(tokenText, fillColor, textColor, opacity, emptyMode, sizePct, bubbleWidthPct, bubbleHeightPct, emptyBubbleSizePct, shapePct, displayTextOverride, plugin) {
    super();
    this.plugin = plugin || null;
    this.tokenText = String(tokenText || "");
    this.fillColor = String(fillColor || "");
    this.textColor = String(textColor || "");
    this.opacity = Number(opacity);
    this.emptyMode = emptyMode === true;
    this.sizePct = Number(sizePct);
    this.bubbleWidthPct = Number(bubbleWidthPct);
    this.bubbleHeightPct = Number(bubbleHeightPct);
    this.emptyBubbleSizePct = Number(emptyBubbleSizePct);
    this.shapePct = Number(shapePct);
    this.displayTextOverride = String(displayTextOverride || "");
  }
  eq(other) {
    return !!other
      && other.tokenText === this.tokenText
      && other.fillColor === this.fillColor
      && other.textColor === this.textColor
      && other.opacity === this.opacity
      && other.emptyMode === this.emptyMode
      && other.sizePct === this.sizePct
      && other.bubbleWidthPct === this.bubbleWidthPct
      && other.bubbleHeightPct === this.bubbleHeightPct
      && other.emptyBubbleSizePct === this.emptyBubbleSizePct
      && other.shapePct === this.shapePct
      && other.displayTextOverride === this.displayTextOverride;
  }
  /**
   * **Вид — классами, величины — переменными** (правило каталога Р7).
   *
   * Разделение механическое и оно же было признаком разбора: то, что известно
   * заранее (`display`, снятые поля пустого пузыря, цвет текста на подложке),
   * уехало в `styles.css`; то, что считается на отрисовке (кегль, поля,
   * скругление, ширина пустого пузыря, цвета из настроек), приезжает
   * свойствами `--io-*`. Второе в класс не переносится вовсе: значение
   * известно только здесь.
   *
   * **Почему величины теперь тоже не свойствами узла.** Инлайновый стиль
   * сильнее любого класса, и `padding` шорткатом отменял бы снятые поля
   * пустого пузыря, объявленные классом. Переменная этого не делает: её
   * читает то самое правило, которое класс и задаёт (У-67 — объявить
   * свойство мало, надо посмотреть, кто выигрывает каскад).
   */
  toDOM() {
    const el = document.createElement("span");
    const st = computeTagVisualStyle(this.sizePct, this.bubbleWidthPct, this.bubbleHeightPct, this.shapePct);
    const emptyScale = Number.isFinite(this.emptyBubbleSizePct) ? Math.max(10, Math.min(180, Math.trunc(this.emptyBubbleSizePct))) / 100 : 1;
    const renderedText = this.emptyMode ? " " : (this.displayTextOverride || this.tokenText);
    el.textContent = renderedText;
    el.setAttribute("data-io-tag-token", this.tokenText);
    el.setAttribute("data-io-tag-render", renderedText);
    /*
     * Заливка — не только цвет, но и **условие**: цвет текста на подложке
     * подставляется ровно тогда, когда подложка есть. Условие выражено
     * классом, потому что в одном объявлении цвета его не выразить — а два
     * объявления одного правила расходятся молча (У-32).
     */
    /*
     * Тег без своей заливки берёт **акцентный цвет темы** — то есть выглядит
     * как тег, которому цвет задали. Первая версия брала `--tag-background`,
     * и в теме Minimal это `transparent`: пузырь вышел невидимым, и заказчик
     * ответил «хочу, чтобы они были одинаковые» (2026-09-12, второй заход).
     */
    const isTag = this.tokenText.charAt(0) === "#";
    const accent = isTag && !this.fillColor;
    el.className = [
      TAG_BUBBLE_CLASS,
      this.emptyMode ? TAG_BUBBLE_EMPTY_CLASS : "",
      this.fillColor ? TAG_BUBBLE_FILLED_CLASS : "",
      accent ? TAG_BUBBLE_ACCENT_CLASS : "",
      isTag ? TAG_BUBBLE_CLICKABLE_CLASS : "",
    ].filter(Boolean).join(" ");
    if (isTag) {
      /*
       * Клик по тегу открывает поиск — так ведёт себя тег в заметке, и наш
       * пузырь обязан вести себя так же: «по такому тегу нельзя кликнуть — это
       * недопустимо» (его слово 2026-09-12).
       *
       * Обработчик живёт на узле, который принадлежит нам (У-46), а не в
       * описании, которое платформа клонирует.
       */
      el.addEventListener("mousedown", (ev) => {
        if (ev && ev.button !== 0) return;
        if (!openTagSearch(this.plugin, this.tokenText)) return;
        ev.preventDefault();
        ev.stopPropagation();
      });
    }
    el.style.setProperty("--io-tagbubble-radius", `${st.borderRadiusPx}px`);
    el.style.setProperty("--io-tagbubble-pad-y", `${st.verticalPaddingPx}px`);
    el.style.setProperty("--io-tagbubble-pad-x", `${st.horizontalPaddingPx}px`);
    el.style.setProperty("--io-tagbubble-font", `${st.fontSizePx}px`);
    el.style.setProperty("--io-tagbubble-line", String(st.lineHeight));
    if (this.emptyMode) {
      /*
       * Ширина пустого пузыря считается так же, как в панели:
       * `.io-bubble--empty { width: calc(30px * var(--io-empty-x)) }`
       * (`styles.css`), горизонтальные поля при этом снимаются.
       *
       * Раньше здесь стояла своя формула — от горизонтального поля пузыря, —
       * и вся шкала настройки 50…180 % умещалась в заметке в 6…18 px, причём
       * нижняя треть упиралась в предел и не двигалась вовсе. Настройка
       * работала, но увидеть её было нельзя (замечание И-2.3). Панель по Р8
       * нормативна, поэтому равняется заметка.
       */
      el.style.setProperty("--io-tagbubble-width",
        `${Math.round(TAG_EMPTY_BUBBLE_BASE_PX * emptyScale)}px`);
    }
    if (this.fillColor) el.style.setProperty("--io-tagbubble-bg", this.fillColor);
    /*
     * Цвет текста не задан — берётся тот же, каким рисует пузырь Value в
     * панели: `--text-on-accent`, «текст на цветной подложке»
     * (`styles.css`, `.io-bubble`). Панель показывала его всегда, а заметка
     * брала цвет темы, и одно и то же значение выглядело в двух местах
     * по-разному (замечание заказчика 2026-08-28).
     *
     * Только при заданной заливке, и это не осторожность ради осторожности:
     * без подложки светлый текст лёг бы на светлый фон заметки и пропал.
     * Переменная темы, а не литерал: в тёмной теме белое пятно было бы не
     * лучше чёрного (З6). Умолчание переменной стоит в самом правиле, поэтому
     * второй ветки здесь больше нет.
     */
    if (this.textColor) el.style.setProperty("--io-tagbubble-fg", this.textColor);
    if (Number.isFinite(this.opacity)) el.style.setProperty("--io-tagbubble-opacity", String(this.opacity));
    return el;
  }
}

class ZeroWidthInlineWidget extends cmView.WidgetType {
  eq() { return true; }
  toDOM() {
    /* Весь вид — в классе (Р7): у этого узла нет ни одной вычисленной
       величины, и свойствам узла тут делать нечего. */
    const el = document.createElement("span");
    el.className = "io-zero-width-inline";
    return el;
  }
}

function buildBlockStyleDecoration(entry, visuals) {
  const style = buildBlockStyleCss(entry, visuals);
  /*
   * **Класс ставится и тогда, когда считать нечего** (его замечание `G4`).
   * Прежде пометка заводилась только ради вычисленных величин — прозрачности и
   * кегля, — и на умолчании её не было вовсе. Но выравнивание по середине
   * строки от величин не зависит: оно нужно ссылке и элементу в Block при
   * любом размере, иначе правило действует у того, кто двигал ползунки, и не
   * действует у всех остальных.
   */
  const cls = blockValueClassFor(entry, visuals);
  if (!style && !cls) return null;
  const spec = {};
  if (cls) spec.class = cls;
  if (style) spec.attributes = { style };
  return cmView.Decoration.mark(spec);
}

function buildTagVisualDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  const userTags = visuals.userTags;
  const fieldMap = buildFieldTagVisualMap(cfg);
  const globalMap = buildGlobalTagVisualMap(cfg);
  const io = isObj(readCfgPath(cfg, "pkm.lineFormat")) ? readCfgPath(cfg, "pkm.lineFormat") : {};
  const sep1 = String(io.separator1 || "").trim();
  const sep2 = String(io.separator2 || "").trim();
  const sep1Color = normalizeHexColorInput(visuals.separator1TextColor);
  const sep2Color = normalizeHexColorInput(visuals.separator2TextColor);
  const ranges = [];
  const stripCfg = visuals.strip || __priorityStripEngine.normalizeStripConfig({});
  const stripFieldId = String(stripCfg.fieldId || "").trim();
  const stripFieldTokenSet = visuals.stripActive ? buildTagTokenSetForField(cfg, stripFieldId) : new Set();
  const stripFieldTokenSetNorm = new Set(Array.from(stripFieldTokenSet).map((t) => normalizeVisualTokenKey(t)).filter(Boolean));
  const cfgStrip = isObj(readCfgPath(cfg, "visual.tagBars")) ? readCfgPath(cfg, "visual.tagBars") : {};
  const rawStripTagVisibility = cfgStrip.tagVisibility;
  const hideStripFieldTags = !!stripFieldId && (
    stripCfg.tagVisibility === false || rawStripTagVisibility === false
  );
  const suppressedRanges = [];
  const elementMarkers = buildElementMarkersFromConfig(cfg);
  /* Цвета TagWheel нужны здесь ровно затем, чтобы узнать его отрезок (B2). */
  const tagwheelColors = getTagwheelHeaderColorsFromConfig(cfg);

  const readRowForToken = (token) => readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap);
  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      const scannedTokens = [];
      const hiddenTokens = [];
      const tokenEntries = [];
      /*
       * Отрезок, который забирает себе слой TagWheel: там мы не рисуем ничего.
       *
       * Два слоя претендовали на одни и те же символы: этот прятал токены
       * своими заменами нулевой ширины, а слой TagWheel заменял весь отрезок
       * `==…==` одним виджетом. Токены оказывались спрятаны, а виджет их не
       * рисовал — «fields невидимы и не занимают места» (B2, 2026-09-02).
       * Правило про отрезок объявлено один раз, в `tagwheelPanelSpanInLine`.
       */
      const wheelSpan = tagwheelPanelSpanInLine(text, tagwheelColors);
      /* Наша ли это строка вообще: спрашивается один раз на строку. */
      const ourLine = lineBelongsToPlugin(text, sep1, sep2);
      for (const hit of scanLineVisualTokens(text, sep1, sep2, elementMarkers)) {
        const token = hit.token;
        if (wheelSpan && hit.index >= wheelSpan.start && hit.index < wheelSpan.end) continue;
        scannedTokens.push(token);
        const from = line.from + hit.index;
        const to = from + token.length;
        const tokenNorm = normalizeVisualTokenKey(token);
        const inStripField = stripFieldTokenSet.has(token) || (tokenNorm && stripFieldTokenSetNorm.has(tokenNorm));
        const row = readRowForToken(token);
        const zoneOpacity = hit.zone === "left" ? visuals.opacityLeft : (hit.zone === "right" ? visuals.opacityRight : 1);
        tokenEntries.push({ token, kind: hit.kind, from, to, zone: hit.zone, inStripField, row, zoneOpacity, index: hit.index });
      }

      if (sep1 && sep1Color) {
        const i1 = text.indexOf(sep1);
        if (i1 >= 0) {
          const from = line.from + i1;
          const to = from + sep1.length;
          if (to > from) {
            ranges.push({
              from,
              to,
              deco: cmView.Decoration.mark({ attributes: { style: `color: ${sep1Color};` } }),
            });
          }
        }
      }
      if (sep2 && sep2Color) {
        const i2 = text.lastIndexOf(sep2);
        if (i2 >= 0) {
          const from = line.from + i2;
          const to = from + sep2.length;
          if (to > from) {
            ranges.push({
              from,
              to,
              deco: cmView.Decoration.mark({ attributes: { style: `color: ${sep2Color};` } }),
            });
          }
        }
      }

      const zoneCounts = { left: 0, right: 0, middle: 0 };
      for (let ti = 0; ti < tokenEntries.length; ti++) {
        const z = tokenEntries[ti] && tokenEntries[ti].zone;
        if (z === "left" || z === "right" || z === "middle") zoneCounts[z] += 1;
      }

      for (let ti = 0; ti < tokenEntries.length; ti++) {
        const entry = tokenEntries[ti] || {};
        const token = String(entry.token || "").trim();
        const from = Number(entry.from || 0);
        const to = Number(entry.to || 0);
        if (!token || to <= from) continue;
        if (debugLine && token === "#/1") {
          traceEvent(plugin, cfg, "tagVisual.resolve.token", {
            traceTxId,
            lineNo,
            lineText: text,
            token,
            from,
            to,
            row: entry.row || null,
            zone: entry.zone,
            inStripField: !!entry.inStripField,
            zoneOpacity: entry.zoneOpacity,
          });
        }
        if (hideStripFieldTags && entry.inStripField) {
          hiddenTokens.push(token);
          let hideTo = to;
          if (text.charAt(Number(entry.index || 0) + token.length) === " ") hideTo += 1;
          if (hideTo > from) {
            suppressedRanges.push({ from, to: hideTo, token });
            ranges.push({
              from,
              to: hideTo,
              deco: cmView.Decoration.replace({
                widget: new ZeroWidthInlineWidget(),
                inclusive: false,
              }),
            });
          }
          const hideSep = hideStripFieldTags && stripCfg.hideSeparatorWhenOnlyStripToken === true;
          if (hideSep && (entry.zone === "left" || entry.zone === "right") && zoneCounts[entry.zone] === 1) {
            if (entry.zone === "left" && sep1) {
              const p = text.indexOf(sep1);
              if (p >= 0) {
                const sf = line.from + p;
                const st = sf + sep1.length;
                ranges.push({
                  from: sf,
                  to: st,
                  deco: cmView.Decoration.replace({ widget: new ZeroWidthInlineWidget(), inclusive: false }),
                });
              }
            } else if (entry.zone === "right" && sep2) {
              const p = text.lastIndexOf(sep2);
              if (p >= 0) {
                const sf = line.from + p;
                const st = sf + sep2.length;
                ranges.push({
                  from: sf,
                  to: st,
                  deco: cmView.Decoration.replace({ widget: new ZeroWidthInlineWidget(), inclusive: false }),
                });
              }
            }
          }
          continue;
        }
        const row = entry.row;
        let suppressed = false;
        for (let si = 0; si < suppressedRanges.length; si++) {
          const sr = suppressedRanges[si] || {};
          if (rangeIntersects(from, to, sr.from, sr.to)) {
            suppressed = true;
            break;
          }
        }
        if (suppressed) continue;
        const hasVisualOverride = !!row && (!!normalizeHexColorInput(row.fillColor)
          || !!normalizeHexColorInput(row.textColor)
          || resolveEffectiveTagVisualMode(row) !== "default");
        /*
         * **Кому рисуется пузырь.** Своему цвету — везде; тегу — в любой
         * строке, которой распоряжается плагин, то есть там, где стоит хотя бы
         * один его разделитель.
         *
         * Правило дважды уточнял заказчик. Сперва: «теги, у которых стоит
         * дефолтный fill и text, не подчиняются настройкам tag-appearance» —
         * пузырь такому тегу рисовала тема, и наши величины до него не
         * доезжали. Потом, увидев свой текст между разделителями: «все теги
         * такой строки рисует плагин», и там же граница — «обычные заметки без
         * разделителей плагин не трогает вовсе».
         *
         * **Ссылке и эмодзи-элементу пузырь по-прежнему не рисуется**:
         * заменить `[[Note]]` своим узлом значит забрать у ссылки клик,
         * наведение и перетаскивание — а вернуть их нечем, поиск тут не
         * замена (И-2.2). Им достаётся прозрачность и размер стилем.
         */
        const drawsOwnBubble = hasVisualOverride || (entry.kind === "tag" && ourLine);
        if (!drawsOwnBubble) {
          if (to <= from) continue;
          const styleDeco = buildBlockStyleDecoration(entry, visuals);
          if (styleDeco) ranges.push({ from, to, deco: styleDeco });
          continue;
        }
        if (to <= from) continue;
        /*
         * У тега без своего цвета строки правил нет вовсе, и читается она
         * тут как пустая: режим `default`, цвета пустые. Своей ветки для
         * этого не заводится — два объявления одного правила расходятся
         * молча (У-32).
         */
        const look = row || {};
        const effectiveMode = resolveEffectiveTagVisualMode(look);
        if (debugLine && token === "#/1") {
          traceEvent(plugin, cfg, "tagVisual.apply.token", {
            traceTxId,
            lineNo,
            lineText: text,
            token,
            from,
            to,
            effectiveMode,
            fillColor: String(look.fillColor || ""),
            textColor: String(look.textColor || ""),
            customText: String(look.customText || ""),
            displayTextOverride: effectiveMode === "custom" ? String(look.customText || "").trim() : "",
          });
        }
        /*
         * Размеры пузыря спрашиваются у того же объявления, что и размер
         * текста в блоке (`tagVisualSizingForZone`): в вашем тексте между
         * разделителями пузырь остаётся того размера, каким его пишет тема.
         * Цвет и форма приезжают к нему везде.
         */
        const sizing = tagVisualSizingForZone(entry.zone, visuals);
        ranges.push({
          from,
          to,
          deco: cmView.Decoration.replace({
            widget: new TagVisualTokenWidget(token, look.fillColor, look.textColor, entry.zoneOpacity, effectiveMode === "empty", sizing.textSizePct, sizing.bubbleWidthPct, sizing.bubbleHeightPct, sizing.emptyBubblePct, visuals.tagShapePct, effectiveMode === "custom" ? String(look.customText || "").trim() : "", plugin),
            inclusive: false,
          }),
        });
      }
      if (debugLine && hideStripFieldTags && hiddenTokens.length) {
        traceEvent(plugin, cfg, "strip.token.hide", {
          traceTxId,
          lineNo,
          stripFieldId,
          hiddenTokens,
          tokenSetSize: stripFieldTokenSet.size,
          tokenSetSample: Array.from(stripFieldTokenSet).slice(0, 10),
          tokenSetNormSample: Array.from(stripFieldTokenSetNorm).slice(0, 10),
          suppressedVisualDecorationsCount: suppressedRanges.length,
          tagVisibilityNormalized: stripCfg.tagVisibility,
          tagVisibilityRaw: rawStripTagVisibility,
        });
      }
    }
  }
  ranges.sort((a, b) => {
    const af = Number(a && a.from || 0);
    const bf = Number(b && b.from || 0);
    if (af !== bf) return af - bf;
    const at = Number(a && a.to || 0);
    const bt = Number(b && b.to || 0);
    return at - bt;
  });
  return buildDecorationSet(ranges, "tag-visual");
}

function buildStripDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  if (!visuals.stripActive) return cmView.Decoration.none;

  const io = isObj(readCfgPath(cfg, "pkm.lineFormat")) ? readCfgPath(cfg, "pkm.lineFormat") : {};
  const sep1 = String(io.separator1 || "").trim();
  const sep2 = String(io.separator2 || "").trim();
  const stripCfg = visuals.strip || __priorityStripEngine.normalizeStripConfig({});
  const stripFieldId = String(stripCfg.fieldId || "").trim();
  const fieldTokenSet = buildTagTokenSetForField(cfg, stripFieldId);
  const fieldMap = buildFieldTagVisualMap(cfg);
  const globalMap = buildGlobalTagVisualMap(cfg);
  const userTags = visuals.userTags;

  const readRowForToken = (token) => readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap);

  const stripInputRows = [];
  const docLines = Number(view && view.state && view.state.doc ? view.state.doc.lines : 0);
  const viewportBuffer = 60;
  let minVisible = 1;
  let maxVisible = docLines;
  if (Array.isArray(view.visibleRanges) && view.visibleRanges.length && docLines > 0) {
    minVisible = docLines;
    maxVisible = 1;
    for (let i = 0; i < view.visibleRanges.length; i++) {
      const vr = view.visibleRanges[i] || {};
      const fromNo = view.state.doc.lineAt(vr.from).number;
      const toNo = view.state.doc.lineAt(vr.to).number;
      if (fromNo < minVisible) minVisible = fromNo;
      if (toNo > maxVisible) maxVisible = toNo;
    }
  }
  const startNo = Math.max(1, minVisible - viewportBuffer);
  const endNo = Math.min(docLines, maxVisible + viewportBuffer);
  for (let lineNo = startNo; lineNo <= endNo; lineNo++) {
    const line = view.state.doc.line(lineNo);
    const text = String(line.text || "");
    if (isRenderableStripContext(text, sep1, sep2, fieldTokenSet)) {
      stripInputRows.push({ lineNo, text });
    }
  }


  const stripSpecs = __priorityStripEngine.buildStripSpecs(stripInputRows, {
    tokenSet: fieldTokenSet,
    readRowForToken,
    isHardBoundary: (text) => isHardLineBlockBoundary(text),
    mode: stripCfg.mode,
    stripesToShow: stripCfg.stripesToShow,
    drawWholeTree: stripCfg.drawWholeTree,
  });
  const stripRanges = __priorityStripCm6Adapter.buildStripDecorationRanges(stripSpecs, view, cmView, stripCfg);

  try {
    const rows = [];
    for (let i = 0; i < stripRanges.length; i++) {
      const rg = stripRanges[i] || {};
      const spec = stripSpecs[i] || {};
      const attrs = rg && rg.deco && rg.deco.spec && rg.deco.spec.attributes ? rg.deco.spec.attributes : {};
      const dbg = rg && rg.debug && typeof rg.debug === "object" ? rg.debug : {};
      rows.push({
        lineNo: Number(spec.lineNo || 0),
        mode: String(spec.mode || ""),
        ownToken: String(spec.ownToken || ""),
        ownColor: String(spec.ownColor || ""),
        inheritColor: String(spec.inheritColor || ""),
        classes: String(dbg.className || attrs.class || ""),
        style: String(dbg.style || attrs.style || ""),
        laneCount: Number(dbg.laneCount || 0),
        laneLefts: Array.isArray(dbg.laneLefts) ? dbg.laneLefts.slice(0, 4) : [],
        gutterInset: Number(dbg.gutterInset || 0),
      });
    }
    if (plugin) {
      plugin._lastStripDebugBatch = {
        ts: Date.now(),
        traceTxId,
        stripFieldId,
        sourceLineCount: stripInputRows.length,
        paintedLineCount: stripSpecs.length,
        decorationCount: stripRanges.length,
        rows,
      };
    }
  } catch (e) {
    /*
     * Снимок для окна отладки полос (`__ioStripDebug`) — второй вид отказа
     * по правилу: сломалось невидимое. Окно читает его по требованию и
     * без тумблера журнала, то есть пропажа снимка видна только тогда,
     * когда человек уже ищет причину другого дефекта. Отрисовку ронять
     * нельзя — заметка дороже отладочного снимка.
     */
    console.error("[inline-overhaul][strip-debug] снимок пакета полос не собрался: "
      + String((e && e.message) || e || ""));
  }

  if (debugLine) {
    traceEvent(plugin, cfg, "strip.apply.batch", {
      traceTxId,
      stripFieldId,
      tokenSetSize: fieldTokenSet.size,
      sourceLineCount: stripInputRows.length,
      paintedLineCount: stripSpecs.length,
      decorationCount: stripRanges.length,
      paintedLines: stripSpecs.map((s) => s.lineNo).slice(0, 100),
    });
    traceEvent(plugin, cfg, "strip.debug.snapshot", {
      traceTxId,
      stripFieldId,
      decorationCount: stripRanges.length,
      rows: (plugin && plugin._lastStripDebugBatch && Array.isArray(plugin._lastStripDebugBatch.rows))
        ? plugin._lastStripDebugBatch.rows.slice(0, 12)
        : [],
    });
  }

  return buildDecorationSet(stripRanges, "strip");
}

function createTagVisualDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildTagVisualDecorations(view, plugin);
    }
    update(update) {
      this.decorations = buildTagVisualDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

function createStripDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildStripDecorations(view, plugin);
    }
    update(update) {
      this.decorations = buildStripDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

/**
 * Своя каретка на строке без выделения (10.13.33 Ц9).
 *
 * **Зачем она вообще нужна** — разбор в комментарии к `buildCaretStyleCss`:
 * редактор заметки собран на копии `drawSelection`, которая главный **пустой**
 * отрезок не рисует, и курсор там родной браузерный. Толщину и мерцание у
 * такого не задать ничем, поэтому включённая форма рисует каретку сама.
 *
 * **Слой берётся у платформы, а не изобретается.** `layer` и
 * `RectangleMarker` есть в `@codemirror/view`, который Obsidian отдаёт
 * плагинам (проверено по карте экспортов `app.js` 1.13.7). Значит и позиция
 * каретки считается тем же кодом, что у самого CodeMirror, — со всеми его
 * поправками на масштаб, направление письма и прокрутку.
 *
 * **Рисуется ровно то, чего не рисует Obsidian:** главный отрезок и только
 * пустой. Непустой отрезок и вторые курсоры — по-прежнему его `.cm-cursor`,
 * иначе на строке стояло бы две каретки.
 *
 * Тумблер читается **на каждой отрисовке**, а не запоминается при загрузке:
 * иначе включение формы доезжало бы до заметки только после перезапуска.
 * `update` отвечает `true` в том числе на смену тумблера — без этого слой
 * не перерисуется, пока человек не тронет курсор.
 */
function createCaretLayerExtension(plugin) {
  if (typeof cmView.layer !== "function" || typeof cmView.RectangleMarker !== "function") {
    /* Громко: тихий отказ здесь неотличим от дефекта (У-41, У-73). */
    console.warn("[inline-overhaul][caret] @codemirror/view без layer/RectangleMarker: своя каретка не рисуется");
    return [];
  }
  return cmView.layer({
    above: true,
    class: CARET_LAYER_CLASS,
    markers(view) {
      try {
        const range = caretLayerRangeFor(plugin, view.state);
        if (!range) return [];
        return cmView.RectangleMarker.forRange(view, CARET_MARKER_CLASS, range);
      } catch (_) {
        return [];
      }
    },
    update(update, dom) {
      const now = caretShapeActive(plugin);
      const flipped = dom.__ioCaretActive !== now;
      dom.__ioCaretActive = now;
      return flipped || update.docChanged || update.selectionSet || update.viewportChanged;
    },
  });
}

/**
 * Подсветка места, куда прыгнул курсор (Н5, его заказ 2026-09-16).
 *
 * «При прыжке курсор создавал визуальный эффект, сразу привлекающий внимание,
 * чтобы не искать курсор глазами (например, цветной кружок, который
 * уменьшается)». Его ответы В-136: **только на прыжках**, два прыжка подряд —
 * **гасить прежний круг**, и задержка от 0 до 1 секунды, «если пользователь
 * прыгает сразу много, чтобы не возникало раздражение».
 *
 * **Сигнал приходит не из движка под З3, и это не обход запрета, а разбор.**
 * Разбор до кода говорил, что «курсор переехал прыжком» придётся объявлять в
 * `navigation_runtime.js`, то есть новым исключением. Это оказалось неверно
 * (правило «прошлый разбор — тоже гипотеза»): **все** команды навигации идут
 * через одну обёртку `runNavigationGuard` в `plugin_commands.js`, а какая из
 * них прыжок — знает тот же список, где объявлены их идентификаторы
 * (`command_registry.js`). Оба файла вне З3, и исключения не понадобилось.
 *
 * **Гасит круг анимация, а не таймер.** Таймер пришлось бы снимать при
 * выгрузке и при каждой перерисовке; анимация уезжает вместе с узлом. Таймер
 * здесь ровно один — задержка между прыжками, — и снимает его `destroy`.
 *
 * **Круг один на редактор.** Второй прыжок снимает узел первого: это и есть
 * «гасить прежний круг», и заодно ответ на вопрос, что делать с накоплением.
 */
function createJumpFlashExtension(plugin) {
  if (typeof cmView.ViewPlugin !== "function" && !(cmView.ViewPlugin && typeof cmView.ViewPlugin.fromClass === "function")) {
    /* Громко: тихий отказ здесь неотличим от дефекта (У-41). */
    console.warn("[inline-overhaul][jump] @codemirror/view без ViewPlugin: подсветка прыжка не рисуется");
    return [];
  }
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.node = null;
      this.timer = 0;
      const live = plugin.__ioJumpFlashViews || (plugin.__ioJumpFlashViews = []);
      live.push(this);
    }

    /** Снять круг и отложенный показ: и то и другое — уборка (правило отказов). */
    clear() {
      if (this.timer) { clearTimeout(this.timer); this.timer = 0; }
      if (this.node && this.node.parentNode) this.node.parentNode.removeChild(this.node);
      this.node = null;
    }

    destroy() {
      this.clear();
      const live = plugin.__ioJumpFlashViews;
      if (Array.isArray(live)) {
        const at = live.indexOf(this);
        if (at >= 0) live.splice(at, 1);
      }
    }

    /**
     * Показать круг там, где стоит каретка.
     *
     * Место спрашивается у платформы тем же вызовом, каким она рисует всё
     * остальное поверх текста (`coordsAtPos`), и переводится в координаты
     * слоя вычитанием его собственного прямоугольника: слой прокручивается
     * вместе с текстом, а `coordsAtPos` отвечает в координатах окна.
     */
    show(look) {
      this.clear();
      const view = this.view;
      const pos = view.state.selection.main.head;
      const at = view.coordsAtPos(pos);
      if (!at) return;
      const host = view.scrollDOM;
      if (!host) return;
      const layer = host.querySelector("." + JUMP_FLASH_LAYER_CLASS) || (() => {
        const made = host.ownerDocument.createElement("div");
        made.className = JUMP_FLASH_LAYER_CLASS;
        host.appendChild(made);
        return made;
      })();
      const box = layer.getBoundingClientRect();
      const node = host.ownerDocument.createElement("div");
      node.className = JUMP_FLASH_MARKER_CLASS;
      node.style.setProperty("--io-jump-x", (at.left - box.left) + "px");
      node.style.setProperty("--io-jump-y", ((at.top + at.bottom) / 2 - box.top) + "px");
      node.style.setProperty("--io-jump-radius", look.radius + "px");
      node.style.setProperty("--io-jump-fade", look.fadeMs + "ms");
      if (look.color) node.style.setProperty("--io-jump-color", look.color);
      /* Узел снимает сама анимация, дойдя до конца: держать его дольше значит
         оставить прозрачный кружок поверх текста навсегда. */
      node.addEventListener("animationend", () => {
        if (node.parentNode) node.parentNode.removeChild(node);
        if (this.node === node) this.node = null;
      });
      layer.appendChild(node);
      this.node = node;
    }

    /**
     * Прыжок случился.
     *
     * Задержка — **отложенный** показ, а не пропуск: человек, который жмёт
     * подряд, получает круг там, где остановился, а не там, где начал. Новый
     * прыжок отменяет отложенный показ прежнего — это и есть его «чтобы не
     * возникало раздражение».
     */
    fire(look) {
      this.clear();
      if (look.quietMs > 0) {
        this.timer = setTimeout(() => { this.timer = 0; this.show(look); }, look.quietMs);
        return;
      }
      this.show(look);
    }
  });
}

/**
 * Сказать слою, что курсор переехал прыжком (Н5).
 *
 * Зовётся из обёртки команд навигации — единственного места, через которое
 * проходят все они. `kind` говорит, какого рода был прыжок: по заголовкам или
 * внутри строки; второй рисуется только при своём тумблере.
 *
 * Круг рисуется в том редакторе, в котором человек работает: слоёв бывает
 * несколько, а прыжок один. Не нашлось ни одного с фокусом — рисовать негде,
 * и это ответ, а не отказ.
 */
function fireJumpFlash(plugin, kind) {
  const look = jumpFlashLookFromConfig(plugin.getConfig());
  if (!look.enabled) return false;
  if (String(kind || "") === "inline" && !look.inLine) return false;
  const live = Array.isArray(plugin.__ioJumpFlashViews) ? plugin.__ioJumpFlashViews : [];
  if (!live.length) return false;
  const target = live.find((v) => v.view && v.view.hasFocus) || live[live.length - 1];
  if (!target) return false;
  target.fire(look);
  return true;
}

/**
 * Заливка Left и Right Block: свой слой прямоугольников **за** текстом (З-7).
 *
 * Заказчик 2026-09-08: «хочу добавить опцию, чтобы left and right blocks можно
 * было добавить цветовую заливку… чтобы сразу в глаза бросались left\right
 * block». Способ он выбрал сам из трёх разобранных — этот.
 *
 * **Почему слой, а не фон отрезка.** Сплошной фон на часть строки платформа
 * режет по своим границам, и каждый наш токен внутри — тоже граница;
 * разваливаются скругление и вертикальные поля (У-68). Слой рисует
 * прямоугольник, и внутри него может быть что угодно.
 *
 * **Слой берётся у платформы**, тот же `layer` и `RectangleMarker`, что у
 * каретки: позиция считается кодом самого CodeMirror, со всеми поправками на
 * масштаб, перенос строки и прокрутку. И «подстроиться под tag-appearance»
 * подложке не надо — она ложится на те же символы, что и токены, а размер их
 * задаёт та же настройка.
 *
 * **`above: false`** — под текстом. Иначе она закрыла бы его собой.
 *
 * Тумблер спрашивается на каждой отрисовке, а не запоминается при загрузке:
 * иначе включение доезжало бы до заметки только после перезапуска (тот же
 * приём, что у каретки).
 */
function blockFillDocRanges(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  if (!cfg) return [];
  const look = blockFillLookFromConfig(cfg);
  if (!look.enabled) return [];
  const io = isObj(readCfgPath(cfg, "pkm.lineFormat")) ? readCfgPath(cfg, "pkm.lineFormat") : {};
  const sep1 = String(io.separator1 || "").trim();
  const sep2 = String(io.separator2 || "").trim();
  const elementMarkers = buildElementMarkersFromConfig(cfg);
  /* Род значений каждого Block — один раз на проход, а не на строку: он от
     строки не зависит, а обход полей стоит столько же. */
  const blockKinds = buildBlockKindsFromConfig(cfg);
  const out = [];
  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      for (const span of blockFillSpansInLine(text, sep1, sep2, elementMarkers, blockKinds)) {
        const from = line.from + span.start;
        const to = line.from + span.end;
        if (to <= from) continue;
        out.push({
          zone: span.zone,
          from,
          to,
          /* Промежуток до разделителя переводится в положения документа
             здесь же: дальше о строке никто не знает (S7). */
          gapFrom: span.gapFrom >= 0 ? line.from + span.gapFrom : -1,
          gapTo: span.gapTo >= 0 ? line.from + span.gapTo : -1,
          /* Дальняя граница разделителя и конец знака префикса — тем же
             переводом: обе меры нужны в точках, а мерит их слой. */
          sepFar: span.sepFar >= 0 ? line.from + span.sepFar : -1,
          prefixEnd: line.from + span.prefixEnd,
          lineFrom: line.from,
          /* Конец строки нужен обходу зрительных строк: число их у **строки**,
             а не у отрезка (см. `blockFillPiecesOf`). */
          lineTo: line.from + text.length,
        });
      }
    }
  }
  return out;
}

/**
 * Те же отрезки, но прямоугольниками платформы.
 *
 * Разделено надвое нарочно: **наша половина** — какие отрезки красить, и её
 * проверяет набор; **платформенная** — где эти отрезки на экране, и её
 * проверять нечем и незачем, это код самого CodeMirror.
 */
/**
 * Вертикаль положения — так, как её видит **отрисовка** прямоугольников.
 *
 * Сторона здесь не украшение: `rectanglesForRange` платформы спрашивает начало
 * отрезка с `coordsAtPos(pos, 2)`, а конец с `coordsAtPos(pos, -2)`, и эта
 * «двойка» у неё названа в комментарии затем, чтобы координата пришла с нужной
 * стороны виджета. Спрашивать иначе — значит спрашивать о другом.
 */
function blockFillRowTopAt(view, pos, side) {
  try {
    const c = view.coordsAtPos(pos, side);
    return c && Number.isFinite(Number(c.top)) ? Number(c.top) : null;
  } catch (_) {
    /* Проба: платформа может не знать положения, которого не отрисовала. */
    return null;
  }
}

/**
 * Конец зрительной строки, на которой стоит это положение.
 *
 * **Вопрос один, и он тот самый, который задаёт отрисовка** (10.13.116). Их
 * было два, и это и был дефект. `moveToLineBoundary` ищет границу под правым
 * краем редактора через `posAtCoords`; `rectanglesForRange` — тот, кто подложку
 * рисует, — спрашивает другое: на одном ли ряду стоят `coordsAtPos(начало, 2)`
 * и `coordsAtPos(конец, -2)`. Ответы расходятся на **один знак**, и этого
 * хватает: кусок, кончающийся знаком дальше начала ряда, платформа считает
 * пересекающим ряды и рисует **выделением** — первый прямоугольник до правого
 * края содержимого, последний от левого. Ровно это заказчик увидел 2026-09-14:
 * «иногда полоска по прежнему рисуется до границ экрана» и «на перенесённой
 * строке полоска не подкрашивает последнее value».
 *
 * Поэтому ответ платформы берётся **подсказкой**, а признаётся он по вопросу
 * отрисовки: на границе ряд обязан меняться — слева от неё тот же, справа
 * другой. Не сошлось — граница ищется двоичным делением по тому же признаку,
 * семь вопросов к координатам вместо сотни.
 *
 * Вертикали для этого годятся, а для **разбора блока на куски** не годились
 * (второй заход по S7): у пузыря тега своя высота, и `coordsAtPos` на пузыре и
 * на тексте одной строки отдаёт разный `top`. Разница эта — единицы точек, а
 * ряд отстоит на десятки, и мера здесь — половина высоты ряда, не равенство.
 */
function blockFillVisualLineEnd(view, pos) {
  if (typeof view.moveToLineBoundary !== "function") return null;
  let head = NaN;
  try {
    const at = view.moveToLineBoundary({ head: pos, assoc: 1 }, true, true);
    head = at ? Number(at.head) : NaN;
  } catch (_) {
    /* Проба: спросили платформу о положении, которого она может не знать
       (снятый узел, положение вне отрисованного). Ответ «нет» — это ответ. */
    head = NaN;
  }
  const lineH = Number(view.defaultLineHeight);
  let line = null;
  try {
    line = view.state.doc.lineAt(pos);
  } catch (_) {
    /* Проба: положение может быть вне документа. */
    line = null;
  }
  /*
   * Конец строки обязан быть числом: без него сверять нечего, и ответом
   * остаётся то, что сказала платформа. Молча уйти отсюда с `undefined`
   * нельзя — обход рядов прочитал бы это как «рядов нет» (У-172).
   */
  if (!line || !Number.isFinite(Number(line.to))
    || !Number.isFinite(lineH) || lineH <= 0) {
    return Number.isFinite(head) ? head : null;
  }
  const base = blockFillRowTopAt(view, pos, 2);
  if (base === null) return Number.isFinite(head) ? head : null;
  const sameRow = (t) => t !== null && Math.abs(t - base) <= lineH / 2;
  /*
   * Подсказка платформы принимается, только если она и есть граница: слева от
   * неё ряд прежний, справа — уже другой. Оба вопроса задаются теми же
   * сторонами, какими их задаёт отрисовка.
   */
  if (Number.isFinite(head) && head > pos && head <= line.to
    && sameRow(blockFillRowTopAt(view, head, -2))
    && !sameRow(blockFillRowTopAt(view, head, 2))) {
    return head;
  }
  /*
   * Не сошлось. Если до конца строки ряд не меняется — переноса на ней нет, и
   * концом ряда служит конец строки: это тот же ответ, что давала платформа.
   */
  if (sameRow(blockFillRowTopAt(view, line.to, 2))) return line.to;
  let lo = pos;
  let hi = line.to;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const t = blockFillRowTopAt(view, mid, 2);
    if (t === null) return Number.isFinite(head) ? head : null;
    if (sameRow(t)) lo = mid; else hi = mid;
  }
  return hi > pos ? hi : null;
}

/**
 * Две меры от края блока до разделителя, в точках, измеренные платформой:
 * до его ближней границы и до дальней.
 *
 * Они и есть шкала `Band width` (S7): половина шкалы тратится на промежуток,
 * вторая — на сам разделитель, и на сотне подложка его включает. Разница двух
 * измерений от начала прокрутки не зависит, поэтому приводить их к чему-либо
 * не нужно.
 *
 * Разделитель, уехавший на другую зрительную строку, шкалы не задаёт: разница
 * координат там бессмысленна и бывает отрицательной.
 */
function blockFillGapPx(view, span) {
  const none = { near: 0, far: 0 };
  if (!(span.gapTo > span.gapFrom) || span.gapFrom < 0) return none;
  /*
   * Разделитель, уехавший на другую зрительную строку, промежутка не задаёт:
   * разница координат там бессмысленна и бывает отрицательной. **Спрашивается
   * это у платформы**, а не сравнением вертикалей двух положений: у пузыря
   * тега своя высота, и вертикали двух положений ОДНОЙ строки различаются —
   * блок, кончающийся пузырём, терял из-за этого весь рост в сторону
   * разделителя молча (тот же разбор, что в `blockFillVisualLineEnd`).
   */
  const rowEnd = blockFillVisualLineEnd(view, span.gapFrom);
  if (rowEnd !== null && rowEnd <= span.gapTo) return none;
  let a = null;
  let b = null;
  let far = null;
  try {
    a = view.coordsAtPos(span.gapFrom, -1);
    b = view.coordsAtPos(span.gapTo, 1);
    /*
     * Сторона у дальней границы — та, с которой стоит **разделитель**: слева
     * `sepFar` это его конец, и мерить надо знак перед ним; справа это его
     * начало, и мерить надо знак на нём (У-76).
     */
    if (span.sepFar >= 0) {
      far = span.zone === "left"
        ? view.coordsAtPos(span.sepFar, -1)
        : view.coordsAtPos(span.sepFar, 1);
    }
  } catch (_) {
    /* Проба, как и в `blockFillVisualLineEnd`: положение может быть не отрисовано. */
    return none;
  }
  if (!a || !b) return none;
  const edge = span.zone === "left" ? Number(a.right) : Number(b.left);
  const nearRaw = span.zone === "left" ? Number(b.left) - edge : edge - Number(a.right);
  const near = Number.isFinite(nearRaw) && nearRaw > 0 ? nearRaw : 0;
  if (!far) return { near, far: near };
  const farRaw = span.zone === "left" ? Number(far.right) - edge : edge - Number(far.left);
  return { near, far: Number.isFinite(farRaw) && farRaw > near ? farRaw : near };
}

/**
 * Сколько точек есть у левого блока до знака начала строки.
 *
 * Его условие: «даже в максимальном положении ползунка полоска должна
 * начинаться после префикса не включая его». Мера — расстояние от первого
 * значения блока до правого края буллита или чекбокса; пробел между ними
 * префиксом не является, и расти в него подложке можно.
 *
 * Знака начала строки нет вовсе (строка начинается прямо со значения) — расти
 * наружу некуда: за первым значением там начало области текста.
 */
function blockFillRoomBeforePrefixPx(view, span) {
  if (!(span.prefixEnd > span.lineFrom) || span.prefixEnd > span.from) return 0;
  try {
    const glyph = view.coordsAtPos(span.prefixEnd, -1);
    const block = view.coordsAtPos(span.from, 1);
    if (!glyph || !block) return 0;
    const room = Number(block.left) - Number(glyph.right);
    return Number.isFinite(room) && room > 0 ? room : 0;
  } catch (_) {
    /* Проба: положение может быть не отрисовано. Ответ «нет» — это ответ, и
       подложка тогда просто не растёт наружу. */
    return 0;
  }
}

/**
 * Строка, на которой стоит плавающая кнопка `→`, или `-1`, если её нет вовсе.
 *
 * **Правило объявлено здесь один раз** (У-32) и зовётся дважды: отсюда кнопка
 * рисуется, и отсюда же подложка правого блока узнаёт, что впереди у неё
 * кнопка. Второе объявление разошлось бы с первым молча — и разошлось бы
 * ровно в ту сторону, в которую заказчику видно: подложка прижималась бы к
 * кнопке на строках, где кнопки нет.
 */
function floatingButtonLineNumber(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const marks = getSourceMarksFromConfig(cfg);
  if (!marks.button) return -1;
  const main = view.state.selection && view.state.selection.main ? view.state.selection.main : null;
  if (!main) return -1;
  const line = view.state.doc.lineAt(main.head);
  const text = String(line.text || "");
  if (!text.trim()) return -1;
  /*
   * **Пока на строке открыта панель TagWheel, кнопки на ней нет** (его слово
   * 2026-09-13: «вообще я думаю, что при открытии tagwheel кнопка i2n-floating
   * не должна отображаться»).
   *
   * Причина не только в виде. Кнопка зовёт `Inline to note` на **той строке,
   * где стоит курсор**, а во время сессии в строке лежит ещё и полоса панели —
   * то есть нажатие унесло бы в новую заметку её разметку вместе с текстом
   * человека. Отдельного вопроса «а что делать с полосой» у переноса нет и
   * заводить его не надо: у строки, которую человек сейчас правит панелью,
   * переносить нечего.
   *
   * Признак спрашивается у **того же объявления**, которым панель узнаёт себя
   * на строке (`tagwheelPanelSegmentInLine`), а не у состояния окна: своя
   * копия правила разошлась бы с ним молча (У-32), а состояние устаревает —
   * заметка бывает открыта во второй панели, отрисовка случается позже
   * закрытия сессии.
   */
  if (tagwheelPanelSegmentInLine(text)) return -1;
  return line.number;
}

/**
 * Сколько точек есть у правого блока до плавающей кнопки `→`.
 *
 * **Пара к прижиму левого блока** (решение заказчика 2026-09-09 по вопросу о
 * полосе и кнопке: «прижать к кнопке, как прижата к чекбоксу слева»). Наружу
 * правый блок растёт не дальше начала кнопки; на строках без кнопки
 * зеркальность остаётся полной, и мера тогда — бесконечность, а не ноль.
 *
 * **Кнопки на этой строке нет — мерить нечего**, и это не то же самое, что
 * «расстояние ноль»: у конца строки без виджета обе стороны измерения дают
 * одну и ту же точку (У-76), и «ноль» отменил бы весь наружный рост на каждой
 * строке. Поэтому сначала спрашивается, есть ли кнопка, и спрашивается это у
 * того же правила, которым она рисуется.
 */
function blockFillRoomBeforeFlyButtonPx(view, span, buttonLine) {
  if (!(buttonLine > 0)) return Infinity;
  /* Кнопка стоит за концом строки: блок, кончающийся раньше, её не касается. */
  if (span.to !== span.lineTo) return Infinity;
  let line = null;
  try {
    line = view.state.doc.lineAt(span.lineFrom);
  } catch (_) {
    /* Проба: положение может быть уже не в документе. */
    return Infinity;
  }
  if (!line || line.number !== buttonLine) return Infinity;
  try {
    const widget = view.coordsAtPos(span.lineTo, 1);
    const text = view.coordsAtPos(span.lineTo, -1);
    if (!widget || !text) return Infinity;
    const room = Number(widget.left) - Number(text.right);
    return Number.isFinite(room) && room > 0 ? room : 0;
  } catch (_) {
    /* Проба: положение может быть не отрисовано. Ответ «нет» — это ответ, и
       подложка тогда растёт наружу, как росла до этого решения. */
    return Infinity;
  }
}

/**
 * Отрезок, разрезанный по зрительным строкам (S7).
 *
 * Зачем резать: `forRange` на отрезке, начавшемся на одной зрительной строке и
 * кончившемся на другой, рисует **выделение** — первый кусок до правого края
 * содержимого, последний от левого. Для выделения это верно, для подложки нет.
 *
 * **Режется по границам, которые называет платформа, а не по нашим значениям**
 * (починка второго захода по S7). Прежде куски набирались из токенов блока, и
 * у этого две дыры, обе заказчик увидел: значение, которое переносится **само**
 * (`📅2026-09-09 11:14` разрывается по пробелу внутри себя), разрезать было
 * нечем — «по-прежнему при переносе полоска идёт до конца экрана первой строки
 * и начинается от левой границы второй»; а группировка кусков по измеренной
 * вертикали путала пузырь тега с переносом и рвала блок, лежащий на одной
 * строке.
 *
 * Обход идёт от начала отрезка к концу и на каждом шаге спрашивает, где
 * кончается зрительная строка. Не сдвинулись или измерить не удалось — остаток
 * уходит одним куском: это ровно прежнее поведение, то есть отказ здесь хуже
 * подложки, но не хуже её отсутствия.
 */
function blockFillLineRows(view, span) {
  /*
   * Обход идёт **от начала строки**, а не от начала отрезка, и это не лишняя
   * работа: номер зрительной строки нужен вертикали подложки, а взять его
   * можно только счётом границ от начала — у отрезка своего номера нет.
   * Границу каждого ряда называет `blockFillVisualLineEnd`, и называет её тем
   * вопросом, каким её задаёт отрисовка (10.13.116).
   */
  const rows = [];
  const at0 = Number.isFinite(Number(span.lineFrom)) ? Number(span.lineFrom) : span.from;
  let at = at0;
  /*
   * Обход идёт до конца **строки**, а не до конца отрезка, и это не лишняя
   * работа: `rows` — число зрительных строк строки, и делить на него высоту её
   * блока имеет смысл только так. Левый блок кончается на первой зрительной
   * строке, и обход, останавливавшийся на нём, объявлял перенесённую строку
   * однострочной: подложка левого блока и правого вставали на одной строке на
   * разную вертикаль. Найдено браузерным гейтом, а не глазами.
   */
  const stop = Math.max(Number(span.lineTo) || 0, span.to, at);
  for (let guard = 0; guard < 64; guard += 1) {
    const end = blockFillVisualLineEnd(view, at);
    if (end === null || !(end > at)) break;
    rows.push({ from: at, to: end });
    at = end;
    if (at >= stop) break;
  }
  if (!rows.length) return null;
  /*
   * **Насчитанному числу зрительных строк верят не на слово** — правило и его
   * цена живут в `blockFillRowCountTrusted`.
   *
   * **Второго способа посчитать ряды здесь больше нет** (10.13.116). Он стоял
   * запасным путём к `moveToLineBoundary` и мерил границу сам — то есть был
   * вторым объявлением того же правила (У-150). Теперь граница ряда объявлена
   * один раз, в `blockFillVisualLineEnd`, и объявлена тем вопросом, который
   * задаёт отрисовка; мерить её второй раз нечем и незачем. Счёт не годится —
   * кусок уходит целым, и это прежнее поведение: хуже подложки, но не хуже её
   * отсутствия.
   */
  const blockHeight = (() => {
    try {
      const block = view.lineBlockAt(span.lineFrom);
      return block ? Number(block.height) : NaN;
    } catch (_) {
      /* Проба: платформу спросили о строке, которой она может не знать. */
      return NaN;
    }
  })();
  if (!blockFillRowCountTrusted(rows.length, blockHeight, view.defaultLineHeight)) return null;
  /*
   * **Правила «остаток дописать последнему ряду» здесь больше нет, и его
   * предмет ушёл вместе с ним** (10.13.116, У-141).
   *
   * Оно стояло против выдумки: обход останавливался раньше конца строки, а
   * остаток объявлялся **ещё одним рядом**, и дальше это число делило высоту
   * строки (У-180). Останавливаться раньше конца обход больше не умеет:
   * границу ряда называет один вопрос, и на последнем ряду он отвечает концом
   * строки. А если координат не дали вовсе — ряды неполны, и их число тут же
   * бракует счёт выше, то есть кусок всё равно уходит целым. Место, где
   * дописывание что-то меняло, не осталось ни одного.
   */
  return rows;
}

function blockFillPiecesOf(span, rows) {
  /*
   * **Запасной кусок называет себя неизмеренным, и это не мелочь.**
   *
   * Он говорил «зрительная строка одна» там, где обход не смог их сосчитать, —
   * а дальше это число делило высоту строки. На перенесённой строке высота
   * делилась на единицу, и подложка левого Block вставала по середине **всей
   * строки**, то есть уезжала вниз; а кусок, пересекающий зрительные строки,
   * платформа рисует выделением — первый прямоугольник до правого края, — и
   * все они получали одну вертикаль. Его слова 2026-09-13: «если строка
   * становится длинной, то полоска tags-block-fill начинает вести себя
   * неадекватно… полоска в left block съезжает вниз».
   */
  const whole = [{ from: span.from, to: span.to, row: 0, rows: 1, measured: false }];
  if (!rows || !rows.length) return whole;
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const from = Math.max(span.from, rows[i].from);
    const to = Math.min(span.to, rows[i].to);
    if (to > from) out.push({ from, to, row: i, rows: rows.length, measured: true });
  }
  return out.length ? out : whole;
}

/**
 * Ящик **написанного** на каждом ряду перенесённой строки.
 *
 * Зачем: высота ряда внутри строки бралась делением её блока на число рядов, и
 * это верно ровно пока ряды одной высоты. У заказчика ряды разной высоты —
 * ссылка `[[…]]` и высокий пузырь стоят на первом ряду, а на втором одно
 * короткое значение, — и деление даёт среднее: 74 точки на два ряда это 37 и
 * 37 при настоящих 42 и 32. Подложка обоих рядов уезжает вверх на половину
 * разницы (обмерено гейтом — 3.09 точки из 25), и это та же жалоба, что и на
 * строке-заголовке: «полоска смещена наверх».
 *
 * Мера — та же, что у заголовка (У-169): **написанное**, а не ящик строки.
 * Спрашивается оно отрезком документа по ряду: `domAtPos` даёт узлы, а
 * объединение строчных ящиков между ними отдаёт браузер. Своей формулы высоты
 * ряда тут нет, и появиться ей неоткуда.
 *
 * Меряется **только перенесённая** строка: у однорядной ряд один, и ящик
 * написанного у неё уже посчитан выше (ящик узла минус отступы). Это не
 * экономия, а граница правки: на строке-заголовке мера остаётся прежней, и
 * его условие по ней не трогается.
 *
 * Чего-то не отдали — `null`, и высота ряда остаётся делением. Это проба, и
 * ответ «нет» здесь ответ, а не отказ.
 */
function blockFillRowInkBoxes(view, rows, toLayer) {
  if (!rows || rows.length < 2 || typeof view.domAtPos !== "function") return null;
  const out = [];
  for (const row of rows) {
    let box = null;
    try {
      const a = view.domAtPos(row.from);
      const b = view.domAtPos(row.to);
      const doc = a && a.node ? a.node.ownerDocument : null;
      if (!a || !b || !a.node || !b.node || !doc || typeof doc.createRange !== "function") return null;
      const range = doc.createRange();
      range.setStart(a.node, a.offset);
      range.setEnd(b.node, b.offset);
      box = range.getBoundingClientRect();
    } catch (_) {
      /* Проба: узла может не быть — строка вне отрисованного окна. */
      return null;
    }
    if (!box || !(Number(box.height) > 0)) return null;
    out.push({ top: Number(box.top) + toLayer, height: Number(box.height) });
  }
  return out;
}

/**
 * Вертикаль зрительной строки и высота подложки на ней — **величины, не
 * зависящие от того, что в блоке лежит** (S7, замечание 2026-09-09 про
 * ссылку).
 *
 * Все три слагаемых спрошены у платформы:
 *
 *   * `view.lineBlockAt` — где строка стоит в документе и какой она высоты;
 *   * `view.defaultLineHeight` — высота одной зрительной строки;
 *   * `viewState.heightOracle.textHeight` — высота написанного. Ею же
 *     CodeMirror считает сам (`(defaultLineHeight - textHeight) / 2` стоит в
 *     его `posAtCoords`), и в сборке Obsidian 1.13.7 это поле есть — прочитано
 *     в её `app.js`, а не выведено из типов (У-44).
 *
 * **Смещение слоя спрашивается двумя измерениями одного положения**, а не
 * повторением платформенной формулы: `RectangleMarker` считает свои координаты
 * от начала прокручиваемого содержимого (`getBase`), а `coordsAtPos` — от
 * экрана. Пустой отрезок даёт и то и другое сразу, и разница между ними и есть
 * смещение. Своя копия `getBase` была бы вторым объявлением платформенного
 * правила (У-32) и разошлась бы с ним молча.
 *
 * Чего-то не отдали — возвращается `null`, и слой остаётся на прежней мере
 * (высота из самого прямоугольника). Это хуже, чем поправленная вертикаль, но
 * не хуже отсутствия подложки.
 */
function blockFillRowGeometry(view, span, rowList, bandHeightAsk, measured) {
  const rows = rowList && rowList.length ? rowList.length : 1;
  if (typeof view.lineBlockAt !== "function") return null;
  const lineH = Number(view.defaultLineHeight);
  if (!Number.isFinite(lineH) || lineH <= 0) return null;
  let block = null;
  let screen = null;
  let probe = null;
  try {
    block = view.lineBlockAt(span.lineFrom);
    screen = view.coordsAtPos(span.lineFrom, 1);
    probe = cmView.RectangleMarker.forRange(view, BLOCK_FILL_MARKER_CLASS, {
      empty: true, head: span.lineFrom, anchor: span.lineFrom,
      from: span.lineFrom, to: span.lineFrom, assoc: 1,
    });
  } catch (_) {
    /* Проба: платформу спросили о положении, которого она может не знать. */
    return null;
  }
  if (!block || !screen || !probe || !probe.length) return null;
  const docTop = Number(view.documentTop);
  const toLayer = Number(probe[0].top) - Number(screen.top);
  const blockTop = Number(block.top);
  const blockHeight = Number(block.height);
  if (!Number.isFinite(docTop) || !Number.isFinite(toLayer)
    || !Number.isFinite(blockTop) || !Number.isFinite(blockHeight)) return null;
  const oracle = view.viewState && view.viewState.heightOracle
    ? Number(view.viewState.heightOracle.textHeight) : NaN;
  const textH = Number.isFinite(oracle) && oracle > 0 && oracle <= lineH ? oracle : NaN;
  /*
   * **Два вопроса, и мера у них разная.**
   *
   *   * «Какой высоты подложка» — одна на все строки, и потому считается от
   *     умолчания редактора: «она должна быть одинаковая во всех строках» —
   *     его условие, и строка со ссылкой не имеет права делать полосу выше;
   *   * «где её середина» — у **этой** строки, потому что строка со ссылкой,
   *     эмодзи или высоким пузырём выше умолчания, и подложка, поставленная по
   *     середине умолчания, уезжает вверх на половину разницы. Ровно это и
   *     принёс заказчик третьим заходом.
   *
   * Смешать их было первой версией этой правки, и гейт покраснел сразу:
   * высоты разошлись на четыре точки между строкой со ссылкой и без неё.
   */
  /*
   * **Ящик строки бывает выше написанного, и лишнее лежит НАД буквами.**
   *
   * Замечание заказчика 2026-09-13: «в строке хедера полоска tags-block-fill
   * смещена наверх — выглядит отвратительно». Обмерено по его скриншоту картой
   * прямоугольников: подложка занимала `6…35`, буквы и пузыри — `20…43`, то
   * есть середины разошлись на десять точек из сорока.
   *
   * Причина — отступ строки. `lineBlockAt` отдаёт **блок** строки документа, а
   * у заголовка в него входит верхний отступ, который Obsidian ставит перед
   * ним. Середина блока при этом выше середины написанного ровно на половину
   * отступа, и подложка вставала по ней.
   *
   * **Отступ этот — `padding`, и он лежит ВНУТРИ ящика узла.** Правило
   * Obsidian: `.cm-s-obsidian .cm-line.HyperMD-header { padding-top:
   * var(--p-spacing) }` (`app.css` 1.13.7), а тема Minimal у заказчика
   * переписывает его на половину той же величины — 14 точек. То есть
   * «спросить ящик узла вместо блока» дефекта не лечит: `getBoundingClientRect`
   * отдаёт ящик **границы**, и у строки с `padding` он совпадает с блоком.
   * Первая версия этой правки так и сделала — и заказчик ответил «полоса по
   * прежнему выше». Спрашивать надо **содержимое** ящика: ящик границы минус
   * отступы.
   *
   * Проба координат (`coordsAtPos`) в эталон не годится: она отдаёт ящик
   * **каретки**, а между ним и верхом строки лежит ещё половина междустрочия —
   * на обычной строке она есть всегда.
   *
   * Узла может не быть — строка вне отрисованного окна: тогда остаётся прежняя
   * мера по блоку. Это проба, и ответ «нет» здесь ответ, а не отказ.
   */
  const rowCount = Math.max(1, Number(rows) || 1);
  const rowsMeasured = measured !== false;
  const blockTopLayer = docTop + blockTop + toLayer;
  let rowsTop = blockTopLayer;
  let rowsHeight = blockHeight;
  try {
    const at = view.domAtPos(span.lineFrom);
    const node = at && at.node
      ? (at.node.nodeType === 1 ? at.node : at.node.parentElement)
      : null;
    const lineEl = node && typeof node.closest === "function" ? node.closest(".cm-line") : null;
    const box = lineEl && typeof lineEl.getBoundingClientRect === "function"
      ? lineEl.getBoundingClientRect()
      : null;
    const win = lineEl && lineEl.ownerDocument ? lineEl.ownerDocument.defaultView : null;
    const style = win && typeof win.getComputedStyle === "function"
      ? win.getComputedStyle(lineEl)
      : null;
    const padTop = style ? Number.parseFloat(style.paddingTop) || 0 : 0;
    const padBottom = style ? Number.parseFloat(style.paddingBottom) || 0 : 0;
    const inner = box ? Number(box.height) - padTop - padBottom : NaN;
    if (box && Number.isFinite(inner) && inner > 0) {
      rowsTop = Number(box.top) + padTop + toLayer;
      rowsHeight = inner;
    }
  } catch (_) {
    /* Проба: узел строки может быть не отрисован — тогда мера остаётся по блоку. */
  }
  /*
   * Делить высоту строки на число зрительных строк можно только тогда, когда
   * это число **сосчитано**. Не сосчитано — берётся высота одной зрительной
   * строки по умолчанию: она может быть меньше настоящей, и подложка тогда
   * чуть ниже своего места, но она хотя бы на **своей** строке.
   */
  const rowH = !rowsMeasured
    ? Math.min(rowsHeight > 0 ? rowsHeight : lineH, lineH)
    : (rowsHeight > 0 ? rowsHeight / rowCount : lineH);
  const height = bandHeightAsk(lineH, textH);
  if (!Number.isFinite(height) || height <= 0) return null;
  /*
   * Ящики написанного по рядам — только у перенесённой строки и только когда
   * ряды сосчитаны: делить высоту на равные части там нельзя (ряды разной
   * высоты), а мерить нечего, если рядов нет.
   */
  const rowBoxes = rowsMeasured ? blockFillRowInkBoxes(view, rowList, toLayer) : null;
  return {
    docTop, toLayer, blockTop, blockHeight, rowsTop, rowsHeight, lineH, rowH, height, rowBoxes,
  };
}

/**
 * Ящик **написанного в самом куске** — то, что подложка накрывает.
 *
 * **Его замечание `G4`, второй заход, 2026-09-16:** «сверху и снизу от values в
 * технических блоках должно оставаться одинаковое расстояние до границ полоски
 * tags-block-fill». Полоса до этого вставала по середине **зрительной строки**,
 * а в строке, кроме значений Block, есть слово человека — и набрано оно
 * обычным кеглем, тогда как значения он уменьшил до 60 %. Мелкое стоит на той
 * же базовой линии, что и крупное, поэтому середина строки выше середины
 * значений: обмерено браузером на его настройках — 3,1 точки при полосе в
 * 21,6, и ровно столько же он намерил на своём скриншоте (3 из 27).
 *
 * Мера спрашивается у браузера тем же приёмом, каким меряются ряды
 * перенесённой строки, — `Range` по границам куска. Это проба: узла может не
 * быть (строка вне отрисованного окна), и тогда остаётся прежняя мера.
 */
function blockFillPieceInkBox(view, piece, toLayer) {
  if (!view || typeof view.coordsAtPos !== "function") return null;
  /*
   * **Спрашиваются края куска, а не весь его `Range`.**
   *
   * `Range` по куску даёт объединение всего, что в нём лежит, — вместе с
   * пробелами между значениями. А пробел набран **обычным** кеглем, и его
   * строчный ящик высотой во всю строку: объединение с ним всегда равно
   * строке, и мерить им середину значений всё равно что мерить её строкой
   * (У-173 — своя карта отвечает на свой вопрос). Края куска — это первое и
   * последнее значение Block, и у них ящик свой.
   */
  try {
    const head = view.coordsAtPos(piece.from, 1);
    const tail = view.coordsAtPos(piece.to, -1);
    if (!head || !tail) return null;
    /*
     * **Берётся тот край, у которого ящик меньше, и это выбор из трёх меренных.**
     *
     * Объединять ящики краёв нельзя: у ссылки, которую рисует Obsidian, ящик
     * выше соседнего при том же кегле — и **только сверху**. Подложка по
     * объединению на строке со ссылкой уезжала бы вверх, а это ровно его
     * замечание 2026-09-09 («над block эта полоска уходит сильно выше — так
     * быть не должно»); проверка, купленная тем замечанием, на объединении и
     * краснеет.
     *
     * Опора на нижний край с высотой из настроек тоже мерена: на пузырях
     * сходилось до 0,02, а на значении-дате мимо на 2,3 — её ящик выше, чем
     * выходит по кеглю.
     *
     * Меньший ящик — это то, что и правда написано: лишнее у ссылки висит
     * сверху. Его настройки: худший промах 1,2 точки против 3,1 до правки, и
     * ссылка подложку не поднимает.
     */
    const boxes = [head, tail]
      .map((c) => ({ top: Number(c.top), height: Number(c.bottom) - Number(c.top) }))
      .filter((b) => Number.isFinite(b.top) && b.height > 0)
      .sort((a, b) => a.height - b.height);
    if (!boxes.length) return null;
    const box = boxes[0];
    return { top: box.top + toLayer, height: box.height };
  } catch (_) {
    /* Проба: позиции может не быть на экране. Ответ «нет» здесь ответ, а не
       отказ. */
    return null;
  }
}

/**
 * Вертикаль подложки на куске: середина его зрительной строки.
 *
 * **Середина считается от высоты самой строки, а не от умолчания** (замечание
 * по S7, 2026-09-09: «полоска выглядит нецентрированной — она смещена выше,
 * сверху строки она выглядит больше, чем снизу»). Здесь стояло
 * `rows > 1 ? blockHeight / rows : lineH`, то есть у строки **без переноса**
 * серединой считалась середина `defaultLineHeight`. А `defaultLineHeight` —
 * это высота строки, измеренная платформой на пробной строке из одних букв
 * (`measureTextSize` в `@codemirror/view`); строка, в которой стоит ссылка,
 * эмодзи или высокий пузырь, **выше** этого умолчания. Подложка вставала по
 * середине верхней части такой строки и уезжала вверх ровно на половину
 * разницы: обмерено браузером — 5 точек из 42 на строке со ссылкой при
 * точной середине на трёх строках без неё.
 *
 * Высота зрительной строки внутри переноса берётся делением: платформа отдаёт
 * высоту строки целиком, а не по строкам. Пока зрительные строки одной высоты
 * — а так и есть, пока в них нет ничего выше написанного, — деление точно.
 * Когда одна из них выше, деление даёт среднее, и без прижима подложка могла
 * бы уехать в соседнюю строку документа. Прижим этого не даёт: «полоски на
 * разных строках наезжают друг на друга» — про **разные строки**.
 */
function blockFillPieceBox(geom, piece) {
  const rows = Math.max(1, Number(piece.rows) || 1);
  const blockTop = geom.docTop + geom.blockTop + geom.toLayer;
  /* Зрительные строки начинаются у верха **содержимого** узла строки, а не у
     верха её блока: отступ строки написанному не принадлежит, где бы он ни
     лежал — снаружи границы (`margin`) или внутри неё (`padding`). */
  const rowsTop = Number.isFinite(Number(geom.rowsTop)) ? Number(geom.rowsTop) : blockTop;
  /*
   * **У перенесённой строки ряд меряется, а не делится** (10.13.117). Деление
   * высоты строки на число рядов верно, пока ряды одной высоты; у заказчика
   * ссылка и высокий пузырь стоят на первом ряду, а на втором одно короткое
   * значение — 42 и 32 точки, а деление давало 37 и 37, и подложка обоих рядов
   * уезжала вверх на 3.09. Ящик написанного по рядам отдаёт браузер
   * (`blockFillRowInkBoxes`); не отдал — остаётся деление.
   */
  /*
   * **Середина считается по написанному в самом куске, если его удалось
   * измерить** (его `G4`, второй заход). Ряд строки на этот вопрос отвечает
   * приблизительно: в нём, кроме значений Block, стоит слово человека обычным
   * кеглем, и при уменьшенном `Tags text size` середина ряда выше середины
   * значений. Не измерили — остаётся прежний порядок: ящик ряда, а за ним
   * деление.
   */
  const pieceInk = piece && piece.ink && Number(piece.ink.height) > 0 ? piece.ink : null;
  const ink = pieceInk || (geom.rowBoxes ? geom.rowBoxes[Number(piece.row) || 0] : null);
  const rowH = ink ? ink.height : geom.rowH;
  const rowTop = ink ? ink.top : rowsTop + geom.rowH * (Number(piece.row) || 0);
  /*
   * **Прижим считает ряд строкой, а не написанным в куске.** Середина и прижим
   * отвечают на разные вопросы (У-131): середина — «где стоят значения»,
   * прижим — «не налезла ли подложка на соседнюю строку». Написанное в куске
   * бывает сильно ниже ряда, и подставить его сюда значило бы укоротить блок
   * строки — у крупного пузыря на верху шкалы подложки соседних строк на этом
   * и наехали друг на друга.
   */
  const clampRowH = geom.rowH;
  /*
   * **Прижим высоты объявлен один раз** — в самом правиле
   * (`blockFillBandHeightPx`), и здесь его копии быть не должно: второй прижим
   * делал первый недостижимым, и подмена, снимавшая правило, оставляла гейт
   * зелёным (У-32, и ровно тот признак, что назван в У-92). Здесь остаётся
   * только то, чего правило знать не может: подложка не выходит за блок своей
   * строки документа — этим кончается функция.
   */
  const height = geom.height;
  const top = rowTop + (rowH - height) / 2;
  /*
   * **У середины и у прижима меры разные, и это не описка** (У-131).
   *
   * Середину задаёт **написанное**: содержимое узла строки. Прижим — **блок**
   * строки документа, потому что отвечает он на другой вопрос: «полоски на
   * разных строках наезжают друг на друга» — это про соседей, а соседняя
   * строка начинается там, где кончается блок этой. Отступ заголовка блоку
   * принадлежит, и подложка имеет полное право в него заходить: он пуст.
   *
   * Разойтись они могут: у заказчика написанное в строке-заголовке **ниже**
   * обычной строки (20.16 против 24 при теме Minimal), а высота подложки одна
   * на все строки — его условие. Тогда подложка выше своей строки, целиком её
   * накрывает и прижимается к низу блока. Цена названа вслух: при такой строке
   * середина подложки стоит выше середины написанного на половину разницы —
   * две точки из двадцати четырёх вместо прежних семи.
   */
  const blockBottom = blockTop + (geom.blockHeight > 0 ? geom.blockHeight : clampRowH * rows);
  return { top: Math.max(blockTop, Math.min(top, blockBottom - height)), height };
}

/**
 * Те же отрезки, но прямоугольниками платформы.
 *
 * Разделено надвое нарочно: **наша половина** — какие отрезки красить и на
 * сколько подложка больше написанного, и её проверяет набор; **платформенная**
 * — где эти отрезки на экране, и её проверять нечем и незачем, это код самого
 * CodeMirror.
 */
function blockFillMarkersFor(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const look = blockFillLookFromConfig(cfg);
  /* Высота пузыря — от настроек, не от строки: одно слагаемое из трёх. */
  const bubbleH = blockFillBubbleHeightPx(getTagVisualsFromConfig(cfg));
  /*
   * Высота написанного берётся **та, что лежит в Block**, а не та, что в
   * строке: значения человек уменьшил ползунком `Tags text size`, и подложка,
   * посчитанная от слова человека, оказывалась выше всего, что в ней лежит
   * (его `G4`, второй заход).
   */
  const tagVisuals = getTagVisualsFromConfig(cfg);
  const askHeight = (rowH, textH) => blockFillBandHeightPx(
    look, rowH, blockFillWrittenTextHeightPx(tagVisuals, textH), bubbleH);
  /* Спрашивается один раз на отрисовку: правило одно на весь документ. */
  const flyLine = floatingButtonLineNumber(view, plugin);
  /* Ряды строки — один ответ на оба её Block (см. ниже). */
  const rowsByLine = new Map();
  const out = [];
  for (const span of blockFillDocRanges(view, plugin)) {
    const reach = blockFillGapPx(view, span);
    const padX = blockFillPadXPx(look, reach.near, reach.far);
    /*
     * **Наружу подложка растёт зеркально** (замечание по S7, 2026-09-09: «а
     * слева… должна отступать от первого элемента на такое же расстояние, как
     * у правой границы этого block»… «а должен быть такой же дополнительный
     * выход вправо, как от separator2 до первого элемента»). Прежде рост был
     * односторонним — только к разделителю, — и это его же прежнее слово,
     * которое он этим замечанием уточнил: зеркальность оказалась двумя краями
     * **одного** блока.
     *
     * Исключений два, и оба его. Слева: «полоска в left block не должна
     * наезжать на префикс (буллит, чекбокс)». Справа: «прижать к кнопке, как
     * прижата к чекбоксу слева» — решение 2026-09-09 по вопросу о полосе,
     * заходившей за спину плавающей кнопке `→`. Оба прижима — измеренное
     * расстояние, а не число.
     */
    const room = span.zone === "left"
      ? blockFillRoomBeforePrefixPx(view, span)
      : blockFillRoomBeforeFlyButtonPx(view, span, flyLine);
    const outward = Math.min(padX, room);
    /*
     * Ряды считаются **один раз на строку документа**, а не на каждый Block:
     * вопрос у них общий, а платформу он спрашивает по два-три раза на ряд.
     */
    const lineRows = rowsByLine.has(span.lineFrom)
      ? rowsByLine.get(span.lineFrom)
      : (() => { const r = blockFillLineRows(view, span); rowsByLine.set(span.lineFrom, r); return r; })();
    const pieces = blockFillPiecesOf(span, lineRows);
    /*
     * Строк у **строки**, а не у отрезка: левый блок кончается на первой
     * зрительной строке, и `pieces.length` у него единица при двух строках
     * (У-129). Число несёт сам кусок — его считает обход до конца строки.
     */
    const geom = blockFillRowGeometry(view, span, lineRows, askHeight, pieces[0].measured);
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      /*
       * Рост достаётся тому краю, который у него есть: к разделителю — куску,
       * который разделителя касается (справа первый, слева последний), наружу
       * — куску на внешнем конце блока. У перенесённого блока это разные
       * куски, и середина не растёт ни в одну сторону.
       */
      const first = i === 0;
      const last = i === pieces.length - 1;
      const growLeft = span.zone === "right" ? (first ? padX : 0) : (first ? outward : 0);
      const growRight = span.zone === "left" ? (last ? padX : 0) : (last ? outward : 0);
      /*
       * Отрезок отдаётся `forRange` теми же полями, какими его читает
       * платформа. Объявлять здесь `EditorSelection` нечем: он живёт в копии
       * состояния, отданной плагинам, а меряет копия, на которой собран
       * редактор заметки (тот же разбор, что у каретки).
       */
      const range = {
        empty: false,
        from: piece.from,
        to: piece.to,
        anchor: piece.from,
        head: piece.to,
        assoc: 0,
      };
      /* Ящик написанного в куске — мера его середины (`G4`, второй заход). */
      const pieceWithInk = geom
        ? Object.assign({}, piece, { ink: blockFillPieceInkBox(view, piece, geom.toLayer) })
        : piece;
      const box = geom ? blockFillPieceBox(geom, pieceWithInk) : null;
      const markers = cmView.RectangleMarker.forRange(view, BLOCK_FILL_MARKER_CLASS, range);
      /*
       * **Кусок, растянутый на несколько зрительных строк, рисуется по
       * прямоугольникам платформы — каждый на своей вертикали.**
       *
       * Сюда попадают только куски запасного пути: обход зрительных строк их
       * не разрезал. Первая версия этой правки их **не рисовала вовсе**, и это
       * была регрессия: у заказчика правый Block начинается в конце первой
       * зрительной строки и продолжается на второй, то есть кусок пересекает
       * ряды **законно**. Его слова в тот же вечер: «полоска стала пропадать из
       * right block, когда я ухожу из активной строки».
       *
       * Платформа на таком отрезке отдаёт по прямоугольнику на ряд, и каждый
       * знает свою вертикаль. Своя высота ставится по его середине — высота
       * подложки одна на все строки, его условие. Общей вертикали на все
       * прямоугольники больше нет: это она давала полосу во всю ширину.
       */
      for (const marker of markers) {
        /*
         * Мерить не удалось и расти некуда — прямоугольник платформы уходит
         * как есть. Вертикаль подложки теперь целиком от зрительной строки, и
         * своей прибавки в точках у неё больше нет: шкала высоты — доля
         * свободного места, а долю от неизмеренного не взять.
         */
        if (!box && !growLeft && !growRight) { out.push(marker); continue; }
        /*
         * Прямоугольник **пересоздаётся**, а не правится на месте: поля его
         * читает потом и `eq`, и отрисовка, и правка чужого объекта была бы
         * договором, которого платформа не давала. Ширины может не быть вовсе
         * (`null` значит «не задавать») — такому расти нечем.
         */
        const width = marker.width == null ? null : Number(marker.width) + growLeft + growRight;
        /*
         * **Где зрительная строка этого куска, когда мы её не считали.**
         *
         * Обход зрительных строк не удался — номер строки у куска выдуман, и
         * ставить подложку по нему значит рисовать её на чужой строке: правый
         * Block перенесённой строки уезжал на первую. Но кусок у платформы
         * **один прямоугольник**, то есть она сама знает, где он лежит. Тогда
         * берём её вертикаль, а свою высоту ставим по её середине: высота
         * подложки одна на все строки — его условие, и от запасного пути она
         * не меняется.
         */
        const unmeasuredTop = box && piece.measured === false
          ? (() => {
            const mid = Number(marker.top) + (Number(marker.height) - box.height) / 2;
            /* Прижим тот же, что и на измеренном пути: подложка не выходит за
               блок своей строки, иначе подложки соседей наезжают (его слово). */
            const blockTop = geom.docTop + geom.blockTop + geom.toLayer;
            const blockBottom = blockTop + (geom.blockHeight > 0 ? geom.blockHeight : box.height);
            return Math.max(blockTop, Math.min(mid, blockBottom - box.height));
          })()
          : null;
        out.push(new cmView.RectangleMarker(
          BLOCK_FILL_MARKER_CLASS,
          Number(marker.left) - growLeft,
          /* Вертикаль — от зрительной строки, а не от измеренного отрезка;
             измерение не удалось — остаётся прежняя мера. */
          unmeasuredTop !== null ? unmeasuredTop : (box ? box.top : Number(marker.top)),
          width,
          box ? box.height : Number(marker.height),
        ));
      }
    }
  }
  return out;
}

/**
 * Надо ли перерисовать слой подложки.
 *
 * Вынесено из тела слоя нарочно: это **решение**, и его можно спросить без
 * окна, а `layer(...)` прячет свой config в фасете платформы.
 *
 * Сравнивается **подпись**, а не один тумблер (S7). Цвет и густота живут в
 * стилях, и слою до них дела нет; а высота и ширина подложки — геометрия
 * прямоугольников, и пересчитать её может только перерисовка. Правка настройки
 * сама по себе состояния редактора не меняет: пересборка присылает пустую
 * правку выделения (`refreshOpenEditors`), и ни `docChanged`, ни
 * `viewportChanged`, ни `geometryChanged` на ней не взводятся — то есть без
 * подписи новые ползунки доезжали бы до заметки только после первой её правки
 * (тот же класс, что У-56).
 */
function blockFillLayerNeedsRedraw(plugin, update, dom) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const look = blockFillLookFromConfig(cfg);
  /*
   * В подписи стоит и размер пузыря: высота подложки берёт его слагаемым
   * (`blockFillBubbleHeightPx`), и без этого сдвиг `Text size` или
   * `Tag bubble height` доезжал бы до подложки только после первой правки
   * заметки — тот же класс, что У-56.
   */
  const v = getTagVisualsFromConfig(cfg);
  const sig = look.enabled
    ? [look.heightPct, look.widthPct, v.tagTextSizePct, v.tagBubbleHeightPct].join(":")
    : "off";
  const flipped = dom.__ioBlockFillSig !== sig;
  dom.__ioBlockFillSig = sig;
  return !!(flipped || update.docChanged || update.viewportChanged || update.geometryChanged);
}

function createBlockFillLayerExtension(plugin) {
  if (typeof cmView.layer !== "function" || typeof cmView.RectangleMarker !== "function") {
    /* Громко: тихий отказ здесь неотличим от дефекта (У-41, У-73). */
    console.warn("[inline-overhaul][block-fill] @codemirror/view без layer/RectangleMarker: заливка блоков не рисуется");
    return [];
  }
  return cmView.layer({
    above: false,
    class: BLOCK_FILL_LAYER_CLASS,
    markers(view) {
      try {
        return blockFillMarkersFor(view, plugin);
      } catch (e) {
        /* Украшение не имеет права уронить текст человека: рисование молчит,
           а причина уходит в журнал разработчика (правило отказов, п. 3). */
        console.error("[inline-overhaul][block-fill]", e);
        return [];
      }
    },
    update(update, dom) {
      return blockFillLayerNeedsRedraw(plugin, update, dom);
    },
  });
}

/**
 * Один токен панели без своей приставки.
 *
 * Нужен ровно там, где `Show tag markers` выключен: текст токена меняется, и
 * пометкой этого не сделать. Виджет закрывает **один токен** — в отличие от
 * прежнего `TagwheelFillWidget`, который закрывал весь отрезок `==…==` вместе
 * со всем, что Obsidian оформляет сам (B2, 2026-09-02).
 */
class TagwheelTokenWidget extends cmView.WidgetType {
  constructor(text) {
    super();
    this.text = String(text || "");
  }

  eq(other) {
    return !!(other && other.text === this.text);
  }

  toDOM() {
    const node = document.createElement("span");
    node.className = "inline-overhaul-tw-token";
    node.textContent = this.text;
    return node;
  }
}

function buildTagwheelHeaderDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  /*
   * Красить всегда есть чем: незаданный цвет берётся у темы (10.13.23 Ц2).
   * Прежняя ранняя отбивка «ни одного цвета — не рисуем» снята вместе с
   * причиной: панель на чистом vault была нечитаемой ровно из-за неё.
   */
  const colors = resolveTagwheelPaintColors(getTagwheelHeaderColorsFromConfig(cfg));

  const placeholders = buildTagwheelPlaceholderSetFromConfig(cfg);
  const ranges = [];

  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      for (const span of tagwheelPanelSpans(text, colors, placeholders)) {
        /*
         * Пометка на всю строку: по ней стили красят подсветку Obsidian
         * цветом панели и гасят фон её тегов внутри неё. Цвет приезжает сюда
         * же переменной `--io-twfill` — заливка живёт **одним** слоем на всю
         * строку, а не отрезком, который платформа порежет на куски.
         * Декорация строки, поэтому `start`/`end` отрезка ей не нужны и она
         * разбирается отдельно.
         */
        if (span.kind === "line") {
          const spec = { class: "io-twline" };
          if (span.style) spec.attributes = { style: span.style };
          ranges.push({
            from: line.from,
            to: line.from,
            rank: TAGWHEEL_SPAN_RANK.line,
            deco: cmView.Decoration.line(spec),
          });
          continue;
        }
        const from = line.from + span.start;
        const to = line.from + span.end;
        if (to <= from) continue;
        const deco = span.kind === "replace"
          ? cmView.Decoration.replace({ widget: new TagwheelTokenWidget(span.text), inclusive: false })
          : cmView.Decoration.mark({ attributes: { style: span.style } });
        ranges.push({ from, to, rank: TAGWHEEL_SPAN_RANK[span.kind] || 0, deco });
      }
    }
  }

  ranges.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (a.to !== b.to) return a.to - b.to;
    return a.rank - b.rank;
  });

  return buildDecorationSet(ranges, "tagwheel-header");
}

/** Кнопка `Inline to note` в конце строки. Только на экране (Н8). */
class FloatingTransformButtonWidget extends cmView.WidgetType {
  constructor(plugin, gap) {
    super();
    this.plugin = plugin;
    /* Отступ от текста: слайдер `Distance from the text`. */
    this.gap = Number.isFinite(Number(gap)) ? Number(gap) : 12;
  }
  eq(other) {
    /*
     * Кнопка одна и та же на любой строке — но не при разном отступе.
     * Здесь стояло `return true`, и это было бы ровно тем дефектом, о
     * котором предупреждает У-24: CodeMirror оставляет прежний узел, человек
     * двигает слайдер и не видит ничего.
     */
    return !!other && other.gap === this.gap;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "io-flybtn";
    el.textContent = "\u2192";
    /* Единственное, что виджет задаёт стилем, — своя переменная: саму
       геометрию держит `styles.css` (правило З6 и Г1 по духу). */
    el.style.setProperty("--io-flybtn-gap", this.gap + "px");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", __commandIds.commandName("transform-inline-to-note"));
    el.title = __commandIds.commandName("transform-inline-to-note");
    /*
     * `mousedown`, а не `click`: до `click` редактор успевает поставить
     * каретку по месту нажатия, и перенесена была бы не та строка (Н11).
     */
    el.addEventListener("mousedown", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      Promise.resolve(this.plugin.runInlineToNote()).catch((e) => {
        console.error("[inline-overhaul][floating-button]", e);
      });
    });
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

function buildSourceMarkDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const marks = getSourceMarksFromConfig(cfg);
  if (!marks.highlight && !marks.button) return cmView.Decoration.none;

  /* На какой строке стоит кнопка — одно правило на два места (У-32): её же
     спрашивает подложка правого блока, чтобы не заехать кнопке за спину. */
  const cursorLine = floatingButtonLineNumber(view, plugin);
  const style = [
    "opacity: " + marks.opacity + ";",
    marks.color ? "color: " + marks.color + ";" : "",
  ].filter(Boolean).join(" ");
  const lineDeco = cmView.Decoration.line({ attributes: { style, class: "io-done-line" } });

  const ranges = [];
  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      if (marks.highlight && lineHasProcessedToken(text, marks.token)) {
        ranges.push({ from: line.from, to: line.from, deco: lineDeco, side: -1 });
      }
      /* Пустую строку и выключенный тумблер отсеяло само правило выше. */
      if (lineNo === cursorLine) {
        ranges.push({
          from: line.to,
          to: line.to,
          side: 1,
          deco: cmView.Decoration.widget({
            widget: new FloatingTransformButtonWidget(plugin, marks.buttonGap),
            side: 1,
          }),
        });
      }
    }
  }

  ranges.sort((a, b) => (a.from !== b.from ? a.from - b.from : a.side - b.side));
  return buildDecorationSet(ranges, "source-marks");
}

function createSourceMarkDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildSourceMarkDecorations(view, plugin);
    }
    update(update) {
      if (!update.docChanged && !update.viewportChanged && !update.selectionSet) return;
      this.decorations = buildSourceMarkDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

function createTagwheelHeaderDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = buildTagwheelHeaderDecorations(view, plugin);
    }
    update(update) {
      if (!update.docChanged && !update.viewportChanged && !update.selectionSet) return;
      this.decorations = buildTagwheelHeaderDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

module.exports = {
  traceEvent,
  buildDecorationSet,
  visibleLineNumbers,
  TagVisualTokenWidget,
  ZeroWidthInlineWidget,
  buildBlockStyleDecoration,
  buildTagVisualDecorations,
  buildStripDecorations,
  createTagVisualDecorationExtension,
  createStripDecorationExtension,
  createCaretLayerExtension,
  createJumpFlashExtension,
  fireJumpFlash,
  blockFillDocRanges,
  blockFillMarkersFor,
  floatingButtonLineNumber,
  blockFillLayerNeedsRedraw,
  createBlockFillLayerExtension,
  TagwheelTokenWidget,
  buildTagwheelHeaderDecorations,
  FloatingTransformButtonWidget,
  buildSourceMarkDecorations,
  createSourceMarkDecorationExtension,
  createTagwheelHeaderDecorationExtension,
};
