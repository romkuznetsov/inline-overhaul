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
  blockFillBubbleHeightPx,
  CARET_LAYER_CLASS,
  CARET_MARKER_CLASS,
  TAGWHEEL_SPAN_RANK,
  TAG_EMPTY_BUBBLE_BASE_PX,
  TAG_BUBBLE_CLASS,
  TAG_BUBBLE_EMPTY_CLASS,
  TAG_BUBBLE_FILLED_CLASS,
  buildBlockStyleCss,
  buildElementMarkersFromConfig,
  buildFieldTagVisualMap,
  buildGlobalTagVisualMap,
  buildTagTokenSetForField,
  buildTagwheelPlaceholderSetFromConfig,
  caretLayerRangeFor,
  caretShapeActive,
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
  scanLineVisualTokens,
  tagwheelPanelSpanInLine,
  tagwheelPanelSpans,
} = __editorVisualsConfig;

class TagVisualTokenWidget extends cmView.WidgetType {
  constructor(tokenText, fillColor, textColor, opacity, emptyMode, sizePct, bubbleWidthPct, bubbleHeightPct, emptyBubbleSizePct, shapePct, displayTextOverride) {
    super();
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
    el.className = [
      TAG_BUBBLE_CLASS,
      this.emptyMode ? TAG_BUBBLE_EMPTY_CLASS : "",
      this.fillColor ? TAG_BUBBLE_FILLED_CLASS : "",
    ].filter(Boolean).join(" ");
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
  if (!style) return null;
  return cmView.Decoration.mark({ attributes: { style } });
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
  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
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
        if (debugLine && token === "#/1" && plugin && typeof plugin.devLogEvent === "function") {
          try {
            plugin.devLogEvent("tagVisual.resolve.token", {
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
            }, "trace", cfg);
          } catch (_) {}
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
         * Свой цвет — свой пузырь; всем остальным токенам блока достаётся
         * прозрачность и размер стилем, без подмены узла (И-2.2). Ссылка,
         * элемент и тег без цвета до этого не получали ничего.
         */
        if (!hasVisualOverride) {
          if (to <= from) continue;
          const styleDeco = buildBlockStyleDecoration(entry, visuals);
          if (styleDeco) ranges.push({ from, to, deco: styleDeco });
          continue;
        }
        if (to <= from) continue;
        const effectiveMode = resolveEffectiveTagVisualMode(row);
        if (debugLine && token === "#/1" && plugin && typeof plugin.devLogEvent === "function") {
          try {
            plugin.devLogEvent("tagVisual.apply.token", {
              traceTxId,
              lineNo,
              lineText: text,
              token,
              from,
              to,
              effectiveMode,
              fillColor: String(row.fillColor || ""),
              textColor: String(row.textColor || ""),
              customText: String(row.customText || ""),
              displayTextOverride: effectiveMode === "custom" ? String(row.customText || "").trim() : "",
            }, "trace", cfg);
          } catch (_) {}
        }
        ranges.push({
          from,
          to,
          deco: cmView.Decoration.replace({
            widget: new TagVisualTokenWidget(token, row.fillColor, row.textColor, entry.zoneOpacity, effectiveMode === "empty", visuals.tagTextSizePct, visuals.tagBubbleWidthPct, visuals.tagBubbleHeightPct, visuals.emptyBubbleSizePct, visuals.tagShapePct, effectiveMode === "custom" ? String(row.customText || "").trim() : ""),
            inclusive: false,
          }),
        });
      }
      if (debugLine && hideStripFieldTags && hiddenTokens.length && plugin && typeof plugin.devLogEvent === "function") {
        try {
          plugin.devLogEvent("strip.token.hide", {
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
          }, "trace", cfg);
        } catch (_) {}
      }
      lineNo += 1;
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
  const builder = new cmState.RangeSetBuilder();
  for (const r of ranges) {
    try { builder.add(r.from, r.to, r.deco); } catch (_) {}
  }
  return builder.finish();
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
  } catch (_) {}

  if (debugLine && plugin && typeof plugin.devLogEvent === "function") {
    try {
      plugin.devLogEvent("strip.apply.batch", {
        traceTxId,
        stripFieldId,
        tokenSetSize: fieldTokenSet.size,
        sourceLineCount: stripInputRows.length,
        paintedLineCount: stripSpecs.length,
        decorationCount: stripRanges.length,
        paintedLines: stripSpecs.map((s) => s.lineNo).slice(0, 100),
      }, "trace", cfg);
      plugin.devLogEvent("strip.debug.snapshot", {
        traceTxId,
        stripFieldId,
        decorationCount: stripRanges.length,
        rows: (plugin && plugin._lastStripDebugBatch && Array.isArray(plugin._lastStripDebugBatch.rows))
          ? plugin._lastStripDebugBatch.rows.slice(0, 12)
          : [],
      }, "trace", cfg);
    } catch (_) {}
  }

  const builder = new cmState.RangeSetBuilder();
  for (let i = 0; i < stripRanges.length; i++) {
    const r = stripRanges[i] || {};
    try { builder.add(r.from, r.to, r.deco); } catch (_) {}
  }
  return builder.finish();
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
  const out = [];
  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      for (const span of blockFillSpansInLine(text, sep1, sep2, elementMarkers)) {
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
      lineNo += 1;
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
 * Конец зрительной строки, на которой стоит это положение, — измерением
 * платформы.
 *
 * **Спрошено у того, кто это знает** (У-44). Вертикали положений для того же
 * вопроса не годятся, и это стоило второго захода по S7: у пузыря тега своя
 * высота, и `coordsAtPos` на пузыре и на обычном тексте **одной и той же**
 * зрительной строки отдаёт разный `top`. Сравнение вертикалей читало это как
 * перенос, отрезок распадался на кусок под каждым значением, и заказчик
 * увидел ровно это: «полоска идёт с разрывами… для values=tags и
 * values=wikilink она рисуется на разной высоте».
 *
 * `moveToLineBoundary` отвечает на нужный вопрос прямо, и отвечает тем же
 * приёмом, каким сам CodeMirror ищет границы зрительной строки при отрисовке
 * выделения: положение под правым краем содержимого на высоте этой строки.
 * Сторона нужна и здесь — `assoc: 1` значит «строка, которая после этого
 * положения начинается», иначе в точке переноса мы получили бы конец
 * предыдущей.
 */
function blockFillVisualLineEnd(view, pos) {
  if (typeof view.moveToLineBoundary !== "function") return null;
  try {
    const at = view.moveToLineBoundary({ head: pos, assoc: 1 }, true, true);
    const head = at ? Number(at.head) : NaN;
    return Number.isFinite(head) ? head : null;
  } catch (_) {
    /* Проба: спросили платформу о положении, которого она может не знать
       (снятый узел, положение вне отрисованного). Ответ «нет» — это ответ. */
    return null;
  }
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
function blockFillPiecesOf(view, span) {
  const whole = [{ from: span.from, to: span.to, row: 0, rows: 1 }];
  /*
   * Обход идёт **от начала строки**, а не от начала отрезка, и это не
   * лишняя работа: номер зрительной строки нужен вертикали подложки, а
   * получить его из координат нельзя — ровно они и врут (S7, второе
   * замечание). Здесь он получается счётом границ, без единого измерения.
   */
  const rows = [];
  let at = Number.isFinite(Number(span.lineFrom)) ? Number(span.lineFrom) : span.from;
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
  if (!rows.length) return whole;
  /* Обход кончился раньше отрезка — остаток строки считается последней
     зрительной строкой, а не теряется. */
  if (at < span.to) rows.push({ from: at, to: span.to });
  const out = [];
  for (let i = 0; i < rows.length; i += 1) {
    const from = Math.max(span.from, rows[i].from);
    const to = Math.min(span.to, rows[i].to);
    if (to > from) out.push({ from, to, row: i, rows: rows.length });
  }
  return out.length ? out : whole;
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
function blockFillRowGeometry(view, span, bandHeightAsk) {
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
  const height = bandHeightAsk(lineH, textH);
  if (!Number.isFinite(height) || height <= 0) return null;
  return { docTop, toLayer, blockTop, blockHeight, lineH, height };
}

/**
 * Вертикаль подложки на куске: середина его зрительной строки.
 *
 * **И она не выходит за блок своей строки документа.** Высота зрительной
 * строки внутри переноса берётся делением: платформа отдаёт высоту строки
 * целиком, а не по строкам. Пока зрительные строки одной высоты — а так и есть,
 * пока в них нет ничего выше написанного, — деление точно. Когда одна из них
 * выше (крупный пузырь, ссылка), деление даёт среднее, и без прижима подложка
 * могла бы уехать в соседнюю строку документа. Прижим этого не даёт: «полоски
 * на разных строках наезжают друг на друга» — про **разные строки**.
 */
function blockFillPieceBox(geom, piece) {
  const rows = Math.max(1, Number(piece.rows) || 1);
  const rowH = rows > 1 && geom.blockHeight > 0 ? geom.blockHeight / rows : geom.lineH;
  const blockTop = geom.docTop + geom.blockTop + geom.toLayer;
  const rowTop = blockTop + rowH * (Number(piece.row) || 0);
  const height = Math.min(geom.height, geom.blockHeight > 0 ? geom.blockHeight : geom.height);
  const top = rowTop + (rowH - height) / 2;
  const blockBottom = blockTop + (geom.blockHeight > 0 ? geom.blockHeight : rowH * rows);
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
  const padY = Math.max(0, Number(look.heightPx) || 0);
  /* Высота пузыря — от настроек, не от строки: одно слагаемое из трёх. */
  const bubbleH = blockFillBubbleHeightPx(getTagVisualsFromConfig(cfg));
  const askHeight = (lineH, textH) => blockFillBandHeightPx(look, lineH, textH, bubbleH);
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
     * Единственное исключение — знак начала строки: «полоска в left block не
     * должна наезжать на префикс (буллит, чекбокс)». Поэтому наружный рост
     * левого блока прижимается к измеренному расстоянию до него.
     */
    const room = span.zone === "left" ? blockFillRoomBeforePrefixPx(view, span) : Infinity;
    const outward = Math.min(padX, room);
    const pieces = blockFillPiecesOf(view, span);
    const geom = blockFillRowGeometry(view, span, askHeight);
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
      const box = geom ? blockFillPieceBox(geom, piece) : null;
      for (const marker of cmView.RectangleMarker.forRange(view, BLOCK_FILL_MARKER_CLASS, range)) {
        if (!box && !growLeft && !growRight && !padY) { out.push(marker); continue; }
        /*
         * Прямоугольник **пересоздаётся**, а не правится на месте: поля его
         * читает потом и `eq`, и отрисовка, и правка чужого объекта была бы
         * договором, которого платформа не давала. Ширины может не быть вовсе
         * (`null` значит «не задавать») — такому расти нечем.
         */
        const width = marker.width == null ? null : Number(marker.width) + growLeft + growRight;
        out.push(new cmView.RectangleMarker(
          BLOCK_FILL_MARKER_CLASS,
          Number(marker.left) - growLeft,
          /* Вертикаль — от зрительной строки, а не от измеренного отрезка;
             измерение не удалось — остаётся прежняя мера. */
          box ? box.top : Number(marker.top) - padY,
          width,
          box ? box.height : Number(marker.height) + padY * 2,
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
    ? [look.heightPx, look.widthPct, v.tagTextSizePct, v.tagBubbleHeightPct].join(":")
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

  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
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
      lineNo += 1;
    }
  }

  ranges.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    if (a.to !== b.to) return a.to - b.to;
    return a.rank - b.rank;
  });

  const builder = new cmState.RangeSetBuilder();
  for (const r of ranges) {
    try {
      builder.add(r.from, r.to, r.deco);
    } catch (_) {}
  }
  return builder.finish();
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

  const cursorLine = marks.button && view.state.selection && view.state.selection.main
    ? view.state.doc.lineAt(view.state.selection.main.head).number
    : -1;
  const style = [
    "opacity: " + marks.opacity + ";",
    marks.color ? "color: " + marks.color + ";" : "",
  ].filter(Boolean).join(" ");
  const lineDeco = cmView.Decoration.line({ attributes: { style, class: "io-done-line" } });

  const ranges = [];
  for (const vr of view.visibleRanges) {
    let lineNo = view.state.doc.lineAt(vr.from).number;
    const endLineNo = view.state.doc.lineAt(vr.to).number;
    while (lineNo <= endLineNo) {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      if (marks.highlight && lineHasProcessedToken(text, marks.token)) {
        ranges.push({ from: line.from, to: line.from, deco: lineDeco, side: -1 });
      }
      if (lineNo === cursorLine && text.trim()) {
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
      lineNo += 1;
    }
  }

  ranges.sort((a, b) => (a.from !== b.from ? a.from - b.from : a.side - b.side));
  const builder = new cmState.RangeSetBuilder();
  for (const r of ranges) {
    try { builder.add(r.from, r.to, r.deco); } catch (_) {}
  }
  return builder.finish();
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
  TagVisualTokenWidget,
  ZeroWidthInlineWidget,
  buildBlockStyleDecoration,
  buildTagVisualDecorations,
  buildStripDecorations,
  createTagVisualDecorationExtension,
  createStripDecorationExtension,
  createCaretLayerExtension,
  blockFillDocRanges,
  blockFillMarkersFor,
  blockFillLayerNeedsRedraw,
  createBlockFillLayerExtension,
  TagwheelTokenWidget,
  buildTagwheelHeaderDecorations,
  FloatingTransformButtonWidget,
  buildSourceMarkDecorations,
  createSourceMarkDecorationExtension,
  createTagwheelHeaderDecorationExtension,
};
