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
  CARET_LAYER_CLASS,
  CARET_MARKER_CLASS,
  TAGWHEEL_SPAN_RANK,
  TAG_EMPTY_BUBBLE_BASE_PX,
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
  toDOM() {
    const el = document.createElement("span");
    const st = computeTagVisualStyle(this.sizePct, this.bubbleWidthPct, this.bubbleHeightPct, this.shapePct);
    const emptyScale = Number.isFinite(this.emptyBubbleSizePct) ? Math.max(50, Math.min(180, Math.trunc(this.emptyBubbleSizePct))) / 100 : 1;
    const renderedText = this.emptyMode ? " " : (this.displayTextOverride || this.tokenText);
    el.textContent = renderedText;
    el.setAttribute("data-io-tag-token", this.tokenText);
    el.setAttribute("data-io-tag-render", renderedText);
    el.style.display = "inline-block";
    el.style.borderRadius = `${st.borderRadiusPx}px`;
    el.style.padding = `${st.verticalPaddingPx}px ${st.horizontalPaddingPx}px`;
    el.style.fontSize = `${st.fontSizePx}px`;
    el.style.lineHeight = String(st.lineHeight);
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
      el.style.width = `${Math.round(TAG_EMPTY_BUBBLE_BASE_PX * emptyScale)}px`;
      el.style.minWidth = el.style.width;
      el.style.paddingLeft = "0px";
      el.style.paddingRight = "0px";
      el.style.lineHeight = "1";
    }
    if (this.fillColor) el.style.backgroundColor = this.fillColor;
    /*
     * Цвет текста не задан — берётся тот же, каким рисует пузырь Value в
     * панели: `--text-on-accent`, «текст на цветной подложке»
     * (`styles.css`, `.io-bubble`). Панель показывала его всегда, а заметка
     * брала цвет темы, и одно и то же значение выглядело в двух местах
     * по-разному (замечание заказчика 2026-08-28).
     *
     * Только при заданной заливке, и это не осторожность ради осторожности:
     * без подложки светлый текст лёг бы на светлый фон заметки и пропал.
     * Переменная, а не литерал: в тёмной теме белое пятно было бы не лучше
     * чёрного (З6).
     */
    if (this.textColor) el.style.color = this.textColor;
    else if (this.fillColor) el.style.color = "var(--text-on-accent)";
    if (Number.isFinite(this.opacity)) el.style.opacity = String(this.opacity);
    return el;
  }
}

class ZeroWidthInlineWidget extends cmView.WidgetType {
  eq() { return true; }
  toDOM() {
    const el = document.createElement("span");
    el.className = "io-zero-width-inline";
    el.style.display = "inline-block";
    el.style.width = "0";
    el.style.margin = "0";
    el.style.padding = "0";
    el.style.border = "0";
    el.style.overflow = "hidden";
    el.style.verticalAlign = "baseline";
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
  TagwheelTokenWidget,
  buildTagwheelHeaderDecorations,
  FloatingTransformButtonWidget,
  buildSourceMarkDecorations,
  createSourceMarkDecorationExtension,
  createTagwheelHeaderDecorationExtension,
};
