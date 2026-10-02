/**
 * Оформление редактора (CodeMirror): виджеты, отрезки тегов, полосы, панели
 * TagWheel, слой каретки и пять расширений для `main.js`. Решения конфига —
 * в `src/core/editor_visuals_config.js`, обратной связи нет. Вынесено из
 * `main.js` (A3, PRD раздел 11); вход — `plugin` аргументом. Модули —
 * литеральным `require` (У-89).
 */
const cmView = require("@codemirror/view");
const cmState = require("@codemirror/state");
const cmLanguage = require("@codemirror/language");
const __sharedUtils = require("../../core/shared_utils.js");
const __priorityStripEngine = require("../../core/priority_strip_engine.js");
const __priorityStripCm6Adapter = require("../../core/priority_strip_cm6_adapter.js");
const __commandIds = require("../../features/command_ids.js");
const __editorVisualsConfig = require("../../core/editor_visuals_config.js");
const __devLog = require("../../core/dev_log.js");

function isObj(x) { return __sharedUtils.isObj(x); }

/**
 * Где на строке тег видит Obsidian — начала узлов `hashtag-begin` (правило 24):
 * наш сканер не знает кода и обратных кавычек. Имя узла — токен HyperMD с `_`
 * вместо пробелов: `formatting_formatting-hashtag_hashtag-begin_hashtag_meta_tag-todo`
 * (`app.js` 1.13.7 `hmdHashtag`; `tokenID` в `@codemirror/language`).
 */
function obsidianTagStarts(state, from, to) {
  const out = new Set();
  try {
    cmLanguage.syntaxTree(state).iterate({
      from, to,
      enter: (node) => {
        if (String(node.name || "").split("_").indexOf("hashtag-begin") !== -1) out.add(node.from);
      },
    });
  } catch (e) { /* проба платформы: дерева нет — ответ «тегов Obsidian на строке нет» */ }
  return out;
}
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

/* Имена из модуля конфига поштучно: тела зовут их без префикса (У-11). */
const {
  BLOCK_FILL_LAYER_CLASS,
  BLOCK_FILL_MARKER_CLASS,
  TAG_TEXT_FALLBACK_PX,
  baseTextPx,
  blockFillLookFromConfig,
  blockFillZoneWanted,
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
  TAG_BUBBLE_THEME_CLASS,
  TAG_BUBBLE_SIDE_CLASS,
  isClearColor,
  TAG_BUBBLE_CLICKABLE_CLASS,
  LINK_SHOWN_CLASS,
  buildBlockStyleCss,
  blockValueStyleVars,
  blockValueClassFor,
  LINK_TARGET_CLASS,
  LINK_BRACKETS_CLASS,
  writtenLinkParts,
  buildElementMarkersFromConfig,
  buildFieldTagVisualMap,
  buildGlobalTagVisualMap,
  buildTagTokenSetForField,
  buildTagwheelPlaceholderSetFromConfig,
  caretLayerRangeFor,
  caretShapeActive,
  jumpFlashLookFromConfig,
  visualModuleOn,
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
  scanHyperlinksInLine,
  buildBlockKindsFromConfig,
  buildWikilinkValueTestFromConfig,
  buildLineSplitFromConfig,
  tagVisualSizingForZone,
  tagwheelPanelSpanInLine,
  tagwheelPanelSegmentInLine,
  tagwheelPanelSpans,
} = __editorVisualsConfig;

/* След в журнал — `dev_log.traceQuietly` (У-32, Д-4); короткое имя, чтобы не править переехавший код (У-11). */
const traceEvent = __devLog.traceQuietly;

/**
 * Отрезки → набор платформы с отчётом об отказах (Д-4, У-41): `RangeSetBuilder.add`
 * бросает на сбитом порядке. Отрисовку не роняем. Отчёт один на проход:
 * сбитый порядок роняет каждый следующий `add`.
 */
function buildDecorationSet(ranges, where) {
  /*
   * Порядок — начало, затем сторона (Д-7, Д-8), как требует `RangeSetBuilder`;
   * иначе замена на том же начале отвергается. Сортировка устойчива.
   */
  const side = (r) => Number(r && r.deco && r.deco.startSide) || 0;
  const list = (Array.isArray(ranges) ? ranges : []).slice()
    .sort((a, b) => (Number(a && a.from) - Number(b && b.from)) || (side(a) - side(b)));
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
 * Номера строк в отрисованном окне — каждая по разу (У-32, У-150). Окно — не
 * один отрезок: `computeVisibleRanges` рвёт его на замене от `minPointSize`
 * знаков (маска панели TagWheel), и строка проходится дважды — две
 * i2n-floating (2026-09-13). Отрезки идут по возрастанию: «пройдено» — одно число.
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
 * Поиск по тегу тем же вызовом, что Obsidian (правило 10, У-44):
 * `internalPlugins.getEnabledPluginById("global-search").openGlobalSearch("tag:" + текст)`
 * (`app.js` 1.13.7). Отказ — проба: поиск можно выключить.
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

/**
 * Открыть заметку ссылки: `workspace.openLinkText` (`obsidian.d.ts`, since 0.16.0);
 * `Ctrl`/`Cmd` или средняя кнопка — новая вкладка. Отказ — проба: листа может не быть.
 */
function openWikilinkTarget(plugin, token, ev) {
  const target = __sharedUtils.wikilinkTargetOf(token);
  if (!target) return false;
  const app = plugin && plugin.app ? plugin.app : null;
  const workspace = app && app.workspace ? app.workspace : null;
  if (!workspace || typeof workspace.openLinkText !== "function") return false;
  const active = typeof workspace.getActiveFile === "function" ? workspace.getActiveFile() : null;
  const sourcePath = active && typeof active.path === "string" ? active.path : "";
  const middle = !!ev && ev.button === 1;
  const mod = !!ev && (ev.ctrlKey || ev.metaKey);
  try {
    workspace.openLinkText(target, sourcePath, middle || mod ? "tab" : false);
  } catch (_) {
    /* проба: лист мог быть закрыт между нажатием и обработкой */
    return false;
  }
  return true;
}

/**
 * Предпросмотр по наведению событием редактора Obsidian (`app.js` 1.13.7:
 * `trigger("hover-link", { event, source: "editor", hoverParent: e.owner, targetEl, linktext, sourcePath })`).
 * `source: "editor"` — слушается настроек `Page preview`, включая `Ctrl`.
 * `hoverParent` — `workspace.activeEditor` (`MarkdownFileInfo extends HoverParent`); нет — проба.
 */
function askWikilinkHoverPreview(plugin, token, targetEl, ev) {
  const target = __sharedUtils.wikilinkTargetOf(token);
  if (!target) return false;
  const app = plugin && plugin.app ? plugin.app : null;
  const workspace = app && app.workspace ? app.workspace : null;
  if (!workspace || typeof workspace.trigger !== "function") return false;
  const owner = workspace.activeEditor;
  if (!owner) return false;
  const file = typeof workspace.getActiveFile === "function" ? workspace.getActiveFile() : null;
  try {
    workspace.trigger("hover-link", {
      event: ev,
      source: "editor",
      hoverParent: owner,
      targetEl,
      linktext: target,
      sourcePath: file && typeof file.path === "string" ? file.path : "",
    });
  } catch (e) {
    /* Украшение не имеет права уронить заметку, но и молчать тут нельзя. */
    console.error("[inline-overhaul] предпросмотр ссылки не открылся", e);
    return false;
  }
  return true;
}

/**
 * Перетаскивание как у ссылки Obsidian (`app.js` 1.13.7):
 * `dragManager.handleDrag(узел, e => dragManager.dragLink(e, цель, путь))`.
 * `dragManager` — приватное API: пробой, при отказе в `dataTransfer` кладётся `[[имя]]`.
 */
function makeWikilinkDraggable(plugin, el, token) {
  const target = __sharedUtils.wikilinkTargetOf(token);
  if (!target) return "none";
  const app = plugin && plugin.app ? plugin.app : null;
  const drag = app && app.dragManager ? app.dragManager : null;
  const file = app && app.workspace && typeof app.workspace.getActiveFile === "function"
    ? app.workspace.getActiveFile()
    : null;
  const sourcePath = file && typeof file.path === "string" ? file.path : "";
  if (drag && typeof drag.handleDrag === "function" && typeof drag.dragLink === "function") {
    try {
      drag.handleDrag(el, (ev) => drag.dragLink(ev, target, sourcePath));
      return "platform";
    } catch (e) {
      console.error("[inline-overhaul] перетаскивание ссылки не встало", e);
    }
  }
  el.draggable = true;
  el.addEventListener("dragstart", (ev) => {
    try {
      if (ev && ev.dataTransfer) ev.dataTransfer.setData("text/plain", token);
    } catch (_) {
      /* проба: на мобильном клиенте `dataTransfer` бывает пуст */
    }
  });
  return "text";
}

/**
 * Значение поля-ссылки своим текстом (2026-09-20 п.14). Отступление от И-2.2:
 * клик возвращён вызовом платформы, наведение и перетаскивание — контролы
 * `Link view`, выключены по умолчанию. Только при `custom` и непустом тексте.
 * Кегль, прозрачность, уровень — `buildBlockStyleCss` и `blockValueClassFor`.
 */
class LinkVisualTokenWidget extends cmView.WidgetType {
  constructor(tokenText, displayText, styleVars, blockClass, plugin, hoverPreview, draggable) {
    super();
    this.plugin = plugin || null;
    this.tokenText = String(tokenText || "");
    this.displayText = String(displayText || "");
    this.hoverPreview = hoverPreview === true;
    this.draggable = draggable === true;
    const vars = styleVars && typeof styleVars === "object" ? styleVars : {};
    this.opacity = vars.opacity === null || vars.opacity === undefined ? null : Number(vars.opacity);
    this.fontSizePx = vars.fontSizePx === null || vars.fontSizePx === undefined ? null : Number(vars.fontSizePx);
    this.risePx = vars.risePx === null || vars.risePx === undefined ? null : Number(vars.risePx);
    this.blockClass = String(blockClass || "");
  }
  eq(other) {
    return !!other
      && other.tokenText === this.tokenText
      && other.displayText === this.displayText
      && other.opacity === this.opacity
      && other.fontSizePx === this.fontSizePx
      && other.risePx === this.risePx
      && other.blockClass === this.blockClass
      && other.hoverPreview === this.hoverPreview
      && other.draggable === this.draggable;
  }
  toDOM() {
    const el = document.createElement("a");
    el.textContent = this.displayText;
    el.className = [LINK_SHOWN_CLASS, this.blockClass].filter(Boolean).join(" ");
    const target = __sharedUtils.wikilinkTargetOf(this.tokenText);
    el.setAttribute("data-io-link-token", this.tokenText);
    el.setAttribute("data-io-link-target", target);
    /* `href` — подпись для строки состояния, не путь; переход делает обработчик. `#` прыгнул бы в начало. */
    el.setAttribute("href", target);
    /* Величины — переменными (Р7), правило класса в `styles.css`. */
    if (this.opacity !== null) el.style.setProperty("--io-blockvalue-opacity", String(this.opacity));
    if (this.fontSizePx !== null) el.style.setProperty("--io-blockvalue-font", this.fontSizePx + "px");
    if (this.risePx !== null) el.style.setProperty("--io-blockvalue-rise", this.risePx + "px");
    /*
     * Открывает КЛИК, а не `mousedown` (2026-09-20): `preventDefault` на нажатии
     * отменяет и `dragstart`. Нажатие лишь не доходит до редактора.
     */
    el.addEventListener("mousedown", (ev) => { ev.stopPropagation(); });
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openWikilinkTarget(this.plugin, this.tokenText, ev);
    });
    /* Средняя кнопка клика не даёт — у неё своё событие. */
    el.addEventListener("auxclick", (ev) => {
      if (!ev || ev.button !== 1) return;
      ev.preventDefault();
      ev.stopPropagation();
      openWikilinkTarget(this.plugin, this.tokenText, ev);
    });
    /* Две повадки ссылки, которые человек просит отдельно (`Link view`). */
    if (this.hoverPreview) {
      el.addEventListener("mouseover", (ev) => {
        askWikilinkHoverPreview(this.plugin, this.tokenText, el, ev);
      });
    }
    if (this.draggable) makeWikilinkDraggable(this.plugin, el, this.tokenText);
    return el;
  }
}

class TagVisualTokenWidget extends cmView.WidgetType {
  constructor(tokenText, fillColor, textColor, opacity, emptyMode, sizePct, bubbleWidthPct, bubbleHeightPct, emptyBubbleSizePct, shapePct, displayTextOverride, plugin, basePx, tagBasePx, inBlock, borderColor) {
    super();
    this.plugin = plugin || null;
    this.tokenText = String(tokenText || "");
    this.fillColor = String(fillColor || "");
    this.textColor = String(textColor || "");
    this.borderColor = String(borderColor || "");
    this.opacity = Number(opacity);
    this.emptyMode = emptyMode === true;
    this.sizePct = Number(sizePct);
    this.bubbleWidthPct = Number(bubbleWidthPct);
    this.bubbleHeightPct = Number(bubbleHeightPct);
    this.emptyBubbleSizePct = Number(emptyBubbleSizePct);
    this.shapePct = Number(shapePct);
    this.displayTextOverride = String(displayTextOverride || "");
    /* Кегль редактора стоит и в `eq`: смена размера текста обязана перерисовать виджет. */
    this.basePx = Number(basePx);
    /*
     * Кегль тега темы (`--tag-size`, 2026-09-21) — сотня процентов у пузыря тега;
     * у не-тега — кегль строки (У-260).
     */
    this.tagBasePx = Number(tagBasePx);
    /*
     * В Block ли пузырь — от этого уровень: в Block по центру строки (`G4`),
     * вне Block базовой линией, как тег в просмотре (2026-09-21).
     */
    this.inBlock = inBlock === true;
  }
  eq(other) {
    return !!other
      && other.tokenText === this.tokenText
      && other.fillColor === this.fillColor
      && other.textColor === this.textColor
      && other.borderColor === this.borderColor
      && other.opacity === this.opacity
      && other.emptyMode === this.emptyMode
      && other.sizePct === this.sizePct
      && other.bubbleWidthPct === this.bubbleWidthPct
      && other.bubbleHeightPct === this.bubbleHeightPct
      && other.emptyBubbleSizePct === this.emptyBubbleSizePct
      && other.shapePct === this.shapePct
      && other.displayTextOverride === this.displayTextOverride
      && other.basePx === this.basePx
      && other.tagBasePx === this.tagBasePx
      && other.inBlock === this.inBlock;
  }
  /**
   * Вид — классами в `styles.css`, величины — переменными `--io-*` (Р7).
   * Инлайновый `padding` перебил бы класс пустого пузыря, переменная — нет (У-67).
   */
  toDOM() {
    const el = document.createElement("span");
    /* Сотня процентов: у тега — кегль тега Obsidian, у прочих — кегль строки. */
    const bubbleBasePx = this.tokenText.charAt(0) === "#" && Number.isFinite(this.tagBasePx) && this.tagBasePx > 0
      ? this.tagBasePx
      : this.basePx;
    const st = computeTagVisualStyle(this.sizePct, this.bubbleWidthPct, this.bubbleHeightPct, this.shapePct, bubbleBasePx);
    const emptyScale = Number.isFinite(this.emptyBubbleSizePct) ? Math.max(10, Math.min(180, Math.trunc(this.emptyBubbleSizePct))) / 100 : 1;
    const renderedText = this.emptyMode ? " " : (this.displayTextOverride || this.tokenText);
    el.textContent = renderedText;
    el.setAttribute("data-io-tag-token", this.tokenText);
    el.setAttribute("data-io-tag-render", renderedText);
    /* Цвет текста на подложке — классом, только когда подложка есть (У-32). */
    /*
     * Тег без своей заливки — `TAG_BUBBLE_THEME_CLASS`; `#FFFFFF` = «без заливки»
     * (`isClearColor`, цикл 89). Рамка `Side` — поверх обоих.
     */
    const isTag = this.tokenText.charAt(0) === "#";
    const filled = !!this.fillColor && !isClearColor(this.fillColor);
    el.className = [
      TAG_BUBBLE_CLASS,
      this.emptyMode ? TAG_BUBBLE_EMPTY_CLASS : "",
      filled ? TAG_BUBBLE_FILLED_CLASS : "",
      isTag && !filled ? TAG_BUBBLE_THEME_CLASS : "",
      isTag && this.borderColor ? TAG_BUBBLE_SIDE_CLASS : "",
      isTag ? TAG_BUBBLE_CLICKABLE_CLASS : "",
    ].filter(Boolean).join(" ");
    if (isTag) {
      /* Клик по тегу открывает поиск, как в заметке (2026-09-12). Обработчик на нашем узле (У-46), а не в клонируемом описании. */
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
    /* Подъём пузыря — половина разницы кеглей строки и пузыря; на сотне ноль, базовая линия (2026-09-19). */
    /*
     * Подъём от своей сотни, не от кегля строки: так стоит тег Obsidian
     * (`vertical-align: baseline` у `a.tag` и `.cm-hashtag`), иначе тег поехал бы
     * вверх на всех настройках (правило 87).
     */
    /* Опора подъёма: в Block — кегль строки (`G4`), вне Block — своя сотня, подъёма нет. */
    const riseFrom = this.inBlock ? baseTextPx(this.basePx) : baseTextPx(bubbleBasePx);
    el.style.setProperty("--io-tagbubble-rise",
      `${Math.round((riseFrom - st.fontSizePx) / 2 * 100) / 100}px`);
    el.style.setProperty("--io-tagbubble-line", String(st.lineHeight));
    if (this.emptyMode) {
      /*
       * Ширина пустого пузыря — как в панели (Р8):
       * `.io-bubble--empty { width: calc(30px * var(--io-empty-x)) }` (`styles.css`),
       * горизонтальные поля снимаются (И-2.3).
       */
      el.style.setProperty("--io-tagbubble-width",
        `${Math.round(TAG_EMPTY_BUBBLE_BASE_PX * emptyScale)}px`);
    }
    if (this.fillColor) el.style.setProperty("--io-tagbubble-bg", isClearColor(this.fillColor) ? "transparent" : this.fillColor);
    if (this.borderColor) el.style.setProperty("--io-tagbubble-side", isClearColor(this.borderColor) ? "transparent" : this.borderColor);
    /*
     * Цвет текста не задан — `--text-on-accent`, как `.io-bubble` в панели
     * (2026-08-28). Только при заданной заливке: без подложки светлый текст
     * пропал бы; переменная темы, не литерал (З6).
     */
    if (this.textColor) el.style.setProperty("--io-tagbubble-fg", this.textColor);
    if (Number.isFinite(this.opacity)) el.style.setProperty("--io-tagbubble-opacity", String(this.opacity));
    return el;
  }
}

class ZeroWidthInlineWidget extends cmView.WidgetType {
  eq() { return true; }
  toDOM() {
    /* Весь вид — в классе (Р7): вычисленных величин у узла нет. */
    const el = document.createElement("span");
    el.className = "io-zero-width-inline";
    return el;
  }
}

/**
 * Кегль текста редактора у `contentDOM` (тема задаёт его содержимому, не
 * рамке). Литерал делил бы людей надвое (`У-227`, правило 106). Нет ответа —
 * запасное число движка.
 */
function editorTextBasePx(view) {
  try {
    const node = view && view.contentDOM;
    if (!node || typeof getComputedStyle !== "function") return TAG_TEXT_FALLBACK_PX;
    const px = parseFloat(String(getComputedStyle(node).fontSize || ""));
    return Number.isFinite(px) && px > 0 ? px : TAG_TEXT_FALLBACK_PX;
  } catch (_) {
    /* Проба: страницы может не быть (прогон без браузера) — запасное число движка. */
    return TAG_TEXT_FALLBACK_PX;
  }
}

function buildBlockStyleDecoration(entry, visuals, basePx) {
  const style = buildBlockStyleCss(entry, visuals, basePx);
  /* Класс ставится и без вычисленных величин (`G4`): выравнивание по середине нужно ссылке и элементу в Block всегда. */
  const cls = blockValueClassFor(entry, visuals);
  if (!style && !cls) return null;
  const spec = {};
  if (cls) spec.class = cls;
  if (style) spec.attributes = { style };
  return cmView.Decoration.mark(spec);
}

/**
 * Кегль этой строки: у заголовка свой (`--h1-size`…`--h6-size`). Спрашивается
 * у нарисованного узла; нет на экране — кегль редактора.
 */
function lineTextBasePx(view, lineNo, fallbackPx) {
  try {
    if (!view || typeof view.domAtPos !== "function" || typeof getComputedStyle !== "function") {
      return fallbackPx;
    }
    const line = view.state.doc.line(lineNo);
    const at = view.domAtPos(line.from);
    const node = at && at.node ? at.node : null;
    const el = node && node.nodeType === 1 ? node : (node && node.parentElement) || null;
    const host = el && typeof el.closest === "function" ? (el.closest(".cm-line") || el) : el;
    if (!host) return fallbackPx;
    const px = parseFloat(String(getComputedStyle(host).fontSize || ""));
    return Number.isFinite(px) && px > 0 ? px : fallbackPx;
  } catch (_) {
    /* Проба: строки может не быть в дереве — кегль редактора. */
    return fallbackPx;
  }
}

/**
 * Кегль тега платформы — `var(--tag-size)` (`0.875em` умолчанием), им же
 * Obsidian рисует `.cm-hashtag` (2026-09-21, отменяет 2026-09-19; У-260).
 * Величину отвечает браузер: проба с кеглем строки наследует `--tag-size`.
 * Проба — в `view.dom`, не в `.cm-content`: чужой ребёнок там читается правкой
 * документа (У-45). Нет ответа — кегль строки.
 */
const TAG_BASE_CACHE = new Map();

function editorTagBasePx(view, basePx, rawTagSize) {
  const raw = String(rawTagSize || "").trim();
  if (!raw) return basePx;
  const key = basePx + "|" + raw;
  if (TAG_BASE_CACHE.has(key)) return TAG_BASE_CACHE.get(key);
  let px = basePx;
  try {
    const host = view && view.dom;
    if (host && typeof document !== "undefined" && typeof document.createElement === "function"
      && typeof getComputedStyle === "function") {
      const probe = document.createElement("span");
      probe.className = "io-tagsize-probe";
      /* Величина — переменной: стиль строкой атрибута запрещён (Р7). */
      probe.style.setProperty("--io-tagprobe-base", basePx + "px");
      const inner = document.createElement("span");
      inner.className = "io-tagsize-probe__inner";
      probe.appendChild(inner);
      host.appendChild(probe);
      const got = parseFloat(String(getComputedStyle(inner).fontSize || ""));
      probe.remove();
      if (Number.isFinite(got) && got > 0) px = got;
    }
  } catch (_) {
    /* Проба: страницы может не быть вовсе (прогон без браузера). Ответ «нет» —
       это ответ, и им остаётся кегль строки. */
  }
  /* Карта мала: ключей столько, сколько разных кеглей на экране; смена темы меняет `raw`. */
  if (TAG_BASE_CACHE.size > 32) TAG_BASE_CACHE.clear();
  TAG_BASE_CACHE.set(key, px);
  return px;
}

/** Что тема объявила тегу: спрашивается один раз на отрисовку. */
function themeTagSizeRaw(view) {
  try {
    const node = view && view.contentDOM;
    if (!node || typeof getComputedStyle !== "function") return "";
    return String(getComputedStyle(node).getPropertyValue("--tag-size") || "").trim();
  } catch (_) {
    /* Проба: переменной может не быть вовсе — это ответ. */
    return "";
  }
}

function buildTagVisualLayer(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  /* Выключенный модуль `Visual` — тегов не оформляем вовсе (`В-253`). */
  if (!visualModuleOn(cfg)) return { decorations: cmView.Decoration.none, atomic: cmView.Decoration.none };
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  /*
   * Кегль у строки, не у редактора: у заголовка свой (У-227). Кеш по номеру
   * строки — `getComputedStyle` в цикле по токенам дорог.
   */
  const viewBasePx = editorTextBasePx(view);
  const baseByLine = new Map();
  const lineBasePx = (lineNo) => {
    if (baseByLine.has(lineNo)) return baseByLine.get(lineNo);
    const px = lineTextBasePx(view, lineNo, viewBasePx);
    baseByLine.set(lineNo, px);
    return px;
  };
  /* Что тема объявила тегу — один вопрос на всю отрисовку (`--tag-size`). */
  const tagSizeRaw = themeTagSizeRaw(view);
  /* Кегль тега на этой строке: `em` темы считается от кегля самой строки. */
  const lineTagBasePx = (lineNo) => editorTagBasePx(view, lineBasePx(lineNo), tagSizeRaw);
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
  /* Род значений каждого Block — раз на проход; без него ваш текст, похожий на токен, получал бы кегль Block. */
  const blockKinds = buildBlockKindsFromConfig(cfg);
  /* То же для ссылки (В-141). */
  const isLinkValue = buildWikilinkValueTestFromConfig(cfg);
  const splitLine = buildLineSplitFromConfig(cfg);

  const readRowForToken = (token) => readTagVisualRowByTokenMaps(token, fieldMap, userTags, globalMap);
  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      const scannedTokens = [];
      const hiddenTokens = [];
      const tokenEntries = [];
      /*
       * Отрезок слоя TagWheel — здесь не рисуем: иначе токены прятались, а виджет
       * их не рисовал (B2, 2026-09-02). Правило — `tagwheelPanelSpanInLine`.
       */
      const wheelSpan = tagwheelPanelSpanInLine(text);
      /* Наша ли это строка вообще: спрашивается один раз на строку. */
      const ourLine = lineBelongsToPlugin(text, sep1, sep2);
      /* Только у чужой строки: у своей тег — по сканеру. */
      const platformTags = ourLine ? null : obsidianTagStarts(view.state, line.from, line.to);
      for (const hit of scanLineVisualTokens(text, sep1, sep2, elementMarkers, blockKinds, isLinkValue, splitLine)) {
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

      /*
       * Гиперссылки в любой заметке (`В-181`): свои цвета `Hyperlink target color`
       * и `Hyperlink brackets color`; у голого адреса разметки нет, он весь
       * подпись. Переменные и классы — как у wikilink (У-32). Ни один цвет не задан —
       * не рисуется ничего, тумблера нет (У-156). Ссылка под нашим токеном
       * пропускается целиком.
       */
      if (visuals.hyperlinkTargetColor || visuals.hyperlinkBracketsColor || visuals.hyperlinkAddressColor) {
        for (const link of scanHyperlinksInLine(text)) {
          if (wheelSpan && link.start >= wheelSpan.start && link.start < wheelSpan.end) continue;
          const from = line.from + link.start;
          const to = line.from + link.end;
          let taken = false;
          for (const entry of tokenEntries) {
            if (from < entry.to && to > entry.from) { taken = true; break; }
          }
          if (taken) continue;
          if (visuals.hyperlinkTargetColor && link.labelTo > link.labelFrom) {
            ranges.push({
              from: line.from + link.labelFrom,
              to: line.from + link.labelTo,
              deco: cmView.Decoration.mark({
                class: LINK_TARGET_CLASS,
                attributes: { style: "--io-link-target: " + visuals.hyperlinkTargetColor + ";" },
              }),
            });
          }
          if (visuals.hyperlinkBracketsColor) {
            for (const mark of link.marks) {
              if (mark.to <= mark.from) continue;
              ranges.push({
                from: line.from + mark.from,
                to: line.from + mark.to,
                deco: cmView.Decoration.mark({
                  class: LINK_BRACKETS_CLASS,
                  attributes: { style: "--io-link-brackets: " + visuals.hyperlinkBracketsColor + ";" },
                }),
              });
            }
          }
          /* Адрес в круглых скобках — свой цвет, класс и переменная как у скобок (У-32). У голого адреса `address` нет. */
          if (visuals.hyperlinkAddressColor && link.address && link.address.to > link.address.from) {
            ranges.push({
              from: line.from + link.address.from,
              to: line.from + link.address.to,
              deco: cmView.Decoration.mark({
                class: LINK_BRACKETS_CLASS,
                attributes: { style: "--io-link-brackets: " + visuals.hyperlinkAddressColor + ";" },
              }),
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
          || !!normalizeHexColorInput(row.borderColor)
          || resolveEffectiveTagVisualMode(row) !== "default");
        /*
         * Значение поля-ссылки своим текстом (2026-09-20 п.14) — только при `custom` с
         * непустым текстом; пустой при `custom` — как `empty`, но ссылку целиком не прячем.
         */
        if (entry.kind === "link") {
          const linkLook = row || {};
          const linkText = resolveEffectiveTagVisualMode(linkLook) === "custom"
            ? String(linkLook.customText || "").trim()
            : "";
          if (linkText && to > from) {
            ranges.push({
              from,
              to,
              /* На экране текст человека, в документе `[[имя]]` — отрезок ходит и выделяется целиком. */
              atomic: true,
              deco: cmView.Decoration.replace({
                widget: new LinkVisualTokenWidget(
                  token,
                  linkText,
                  blockValueStyleVars(entry, visuals, lineBasePx(lineNo)),
                  blockValueClassFor(entry, visuals),
                  plugin,
                  visuals.linkShownHover,
                  visuals.linkShownDrag,
                ),
                inclusive: false,
              }),
            });
            continue;
          }
          /*
           * Ссылка как написано — два цвета (`З-37`, `В-174` «а»): цель и скобки, поверх
           * пометки зоны. Цвет переменной, вид классом (Р7), чужое правило гасится
           * `color: inherit` (У-66). Скобки Obsidian прячет без выделения (`В-176`,
           * `app.js` 1.13.7, У-256) — цвет виден на строке с кареткой.
           */
          const parts = writtenLinkParts(token, from, to);
          if (parts) {
            if (visuals.linkTargetColor && parts.targetTo > parts.targetFrom) {
              ranges.push({
                from: parts.targetFrom,
                to: parts.targetTo,
                deco: cmView.Decoration.mark({
                  class: LINK_TARGET_CLASS,
                  attributes: { style: "--io-link-target: " + visuals.linkTargetColor + ";" },
                }),
              });
            }
            if (visuals.linkBracketsColor) {
              const brackets = cmView.Decoration.mark({
                class: LINK_BRACKETS_CLASS,
                attributes: { style: "--io-link-brackets: " + visuals.linkBracketsColor + ";" },
              });
              ranges.push({ from: parts.openFrom, to: parts.openTo, deco: brackets });
              ranges.push({ from: parts.closeFrom, to: parts.closeTo, deco: brackets });
            }
          }
        }
        /*
         * Кому пузырь: своему цвету — везде; тегу — везде, где тегом его считает
         * Obsidian (`obsidianTagStarts`, 2026-09-24), в режиме правки. Ссылке и
         * эмодзи-элементу — нет: забрать клик, наведение и перетаскивание (И-2.2);
         * им прозрачность и размер стилем.
         */
        const drawsOwnBubble = entry.kind !== "link"
          && (hasVisualOverride || (entry.kind === "tag" && (ourLine || platformTags.has(from))));
        if (!drawsOwnBubble) {
          if (to <= from) continue;
          const styleDeco = buildBlockStyleDecoration(entry, visuals, lineBasePx(lineNo));
          if (styleDeco) ranges.push({ from, to, deco: styleDeco });
          continue;
        }
        if (to <= from) continue;
        /* Тег без своего цвета читается пустой строкой правил (`default`) — без своей ветки (У-32). */
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
            borderColor: String(look.borderColor || ""),
            customText: String(look.customText || ""),
            displayTextOverride: effectiveMode === "custom" ? String(look.customText || "").trim() : "",
          });
        }
        /* Размеры пузыря — `tagVisualSizingForZone`, как у текста в блоке; цвет и форма — везде. */
        const sizing = tagVisualSizingForZone(entry.zone, visuals);
        ranges.push({
          from,
          to,
          /* `custom` у тега — другой текст, `empty` — ничего. Пузырь с самим тегом не атомарный: экран и документ совпадают. */
          atomic: effectiveMode === "custom" || effectiveMode === "empty",
          deco: cmView.Decoration.replace({
            widget: new TagVisualTokenWidget(token, look.fillColor, look.textColor, entry.zoneOpacity, effectiveMode === "empty", sizing.textSizePct, sizing.bubbleWidthPct, sizing.bubbleHeightPct, sizing.emptyBubblePct, visuals.tagShapePct, effectiveMode === "custom" ? String(look.customText || "").trim() : "", plugin, lineBasePx(lineNo), lineTagBasePx(lineNo), sizing.inBlock, look.borderColor),
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
  return {
    decorations: buildDecorationSet(ranges, "tag-visual"),
    /* Атомарные отрезки — где экран не равен документу (2026-09-20): `EditorView.atomicRanges` двигает курсор, выделение и удаление. */
    atomic: buildDecorationSet(ranges.filter((r) => r && r.atomic), "tag-visual-atomic"),
  };
}

function buildStripDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const debugLine = !!(readCfgPath(cfg, "advanced.devMode.enabled") === true && readCfgPath(cfg, "advanced.devMode.traceTagVisualLine") === true);
  const traceTxId = plugin && typeof plugin.getLineTraceTxId === "function"
    ? String(plugin.getLineTraceTxId() || "")
    : "";
  const visuals = getTagVisualsFromConfig(cfg);
  if (!visuals.stripActive || !visualModuleOn(cfg)) return cmView.Decoration.none;

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
    /* Снимок для `__ioStripDebug` — отказ невидимого: громко, но отрисовку не роняем. */
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

/**
 * «Надо ли перерисовать» — три ответа нарочно (`Р-8`, `docs/dev/AUDIT_2026-09-18.md` 4.7):
 *
 * | Что рисует | Ответ |
 * |---|---|
 * | теги (`createTagVisualDecorationExtension`) | перестраивает **всегда** |
 * | полосы (`createStripDecorationExtension`) | перестраивает **всегда** |
 * | метки строки, шапка TagWheel | `docChanged \|\| viewportChanged \|\| selectionSet` |
 * | подложка Block (`blockFillLayerNeedsRedraw`) | подпись настроек плюс три флага |
 *
 * «Всегда» — единственный путь настройки в декорации до заметки: запись
 * контрола даёт ноль `refreshOpenEditors` (2026-09-19). `selectionSet` —
 * «в транзакции была селекция» (`@codemirror/view`); транзакция из одних
 * эффектов (`reconfigure`) не будит ни один флаг. Цена — около 5 мс/с при
 * наборе. Шов записи — `docs/dev/REMAINING_WORK.md` (`Ф-4`).
 */
function createTagVisualDecorationExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      const built = buildTagVisualLayer(view, plugin);
      this.decorations = built.decorations;
      this.atomic = built.atomic;
    }
    update(update) {
      const built = buildTagVisualLayer(update.view, plugin);
      this.decorations = built.decorations;
      this.atomic = built.atomic;
    }
  }, {
    decorations: (v) => v.decorations,
    /* Курсор, выделение и удаление проходят подменённый отрезок целиком. */
    provide: (value) => cmView.EditorView.atomicRanges.of((view) => {
      const inst = view.plugin(value);
      return inst && inst.atomic ? inst.atomic : cmView.Decoration.none;
    }),
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
 * Своя каретка на строке без выделения (10.13.33 Ц9; см. `buildCaretStyleCss`):
 * копия `drawSelection` не рисует пустой главный отрезок. `layer` и
 * `RectangleMarker` — из `@codemirror/view` Obsidian (`app.js` 1.13.7).
 * Рисуется только пустой главный отрезок, остальное — `.cm-cursor`.
 * Тумблер — на каждой отрисовке, `update` отвечает `true` и на его смену.
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
 * Подсветка прыжка курсора (Н5, В-136): только на прыжках, второй гасит
 * прежний круг, задержка 0–1 с. Сигнал — из `runNavigationGuard`
 * (`plugin_commands.js`) и списка `command_registry.js`, вне З3. Гасит
 * анимация; единственный таймер — задержка, снимает `destroy`. Круг один на редактор.
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

    /** Показать круг у каретки: `coordsAtPos` (окно) минус прямоугольник слоя (прокручивается с текстом). */
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
      /* Узел снимает анимация в конце, иначе прозрачный кружок остался бы навсегда. */
      node.addEventListener("animationend", () => {
        if (node.parentNode) node.parentNode.removeChild(node);
        if (this.node === node) this.node = null;
      });
      layer.appendChild(node);
      this.node = node;
    }

    /** Прыжок: показ отложенный, новый прыжок отменяет прежний. */
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
 * Сказать слою о прыжке (Н5) из обёртки команд навигации. `kind` — по
 * заголовкам или внутри строки (свой тумблер). Рисуется в редакторе с
 * фокусом; нет такого — ответ, а не отказ.
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
 * Заливка Left и Right Block — свой слой за текстом (З-7, 2026-09-08). Не фон
 * отрезка: платформа режет его по границам токенов (У-68). `layer` и
 * `RectangleMarker` — как у каретки; `above: false` — под текстом. Тумблер —
 * на каждой отрисовке.
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
  /* Род значений каждого Block — раз на проход. */
  const blockKinds = buildBlockKindsFromConfig(cfg);
  const isLinkValue = buildWikilinkValueTestFromConfig(cfg);
  const splitLine = buildLineSplitFromConfig(cfg);
  const out = [];
  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      for (const span of blockFillSpansInLine(text, sep1, sep2, elementMarkers, blockKinds, isLinkValue, splitLine)) {
        /* Сторона (З-12, `Stripe direction`) — отбор здесь, до перевода в положения документа (У-217). */
        if (!blockFillZoneWanted(look.direction, span.zone)) continue;
        const from = line.from + span.start;
        const to = line.from + span.end;
        if (to <= from) continue;
        out.push({
          zone: span.zone,
          from,
          to,
          /* Промежуток до разделителя — в положения документа здесь: дальше о строке не знают (S7). */
          gapFrom: span.gapFrom >= 0 ? line.from + span.gapFrom : -1,
          gapTo: span.gapTo >= 0 ? line.from + span.gapTo : -1,
          /* Дальняя граница разделителя и конец префикса — тем же переводом, мерит слой. */
          sepFar: span.sepFar >= 0 ? line.from + span.sepFar : -1,
          prefixEnd: line.from + span.prefixEnd,
          lineFrom: line.from,
          /* Конец строки — для обхода зрительных строк (`blockFillPiecesOf`). */
          lineTo: line.from + text.length,
        });
      }
    }
  }
  return out;
}

/** Те же отрезки прямоугольниками платформы: наша половина — какие красить, платформенная — где. */
/** Вертикаль положения как у `rectanglesForRange`: начало `coordsAtPos(pos, 2)`, конец `coordsAtPos(pos, -2)`. */
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
 * Конец зрительной строки — тем вопросом, что задаёт отрисовка (10.13.116):
 * на одном ли ряду `coordsAtPos(начало, 2)` и `coordsAtPos(конец, -2)`.
 * `moveToLineBoundary` расходится на один знак, и кусок рисуется выделением
 * до края (2026-09-14). Ответ платформы — подсказка; не сошлось — двоичное
 * деление. Ряд — половина высоты ряда, не равенство `top`: пузырь выше текста.
 */
function blockFillVisualLineEnd(view, pos) {
  if (typeof view.moveToLineBoundary !== "function") return null;
  let head = NaN;
  try {
    const at = view.moveToLineBoundary({ head: pos, assoc: 1 }, true, true);
    head = at ? Number(at.head) : NaN;
  } catch (_) {
    /* Проба: положения может не знать платформа (снятый узел, вне отрисованного). */
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
  /* Конец строки обязан быть числом: `undefined` обход прочёл бы как «рядов нет» (У-172). */
  if (!line || !Number.isFinite(Number(line.to))
    || !Number.isFinite(lineH) || lineH <= 0) {
    return Number.isFinite(head) ? head : null;
  }
  const base = blockFillRowTopAt(view, pos, 2);
  if (base === null) return Number.isFinite(head) ? head : null;
  const sameRow = (t) => t !== null && Math.abs(t - base) <= lineH / 2;
  /* Подсказка принимается, только если слева ряд прежний, справа другой — сторонами отрисовки. */
  if (Number.isFinite(head) && head > pos && head <= line.to
    && sameRow(blockFillRowTopAt(view, head, -2))
    && !sameRow(blockFillRowTopAt(view, head, 2))) {
    return head;
  }
  /* Ряд не меняется до конца строки — переноса нет, конец ряда — конец строки. */
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
 * Две меры до разделителя в точках (ближняя и дальняя граница) — шкала
 * `Band width` (S7): половина на промежуток, половина на разделитель.
 * Разделитель на другой зрительной строке шкалы не задаёт.
 */
function blockFillGapPx(view, span) {
  const none = { near: 0, far: 0 };
  if (!(span.gapTo > span.gapFrom) || span.gapFrom < 0) return none;
  /* Разделитель на другой зрительной строке — промежутка нет; спрашивается у платформы, не вертикалями (`blockFillVisualLineEnd`). */
  const rowEnd = blockFillVisualLineEnd(view, span.gapFrom);
  if (rowEnd !== null && rowEnd <= span.gapTo) return none;
  let a = null;
  let b = null;
  let far = null;
  try {
    a = view.coordsAtPos(span.gapFrom, -1);
    b = view.coordsAtPos(span.gapTo, 1);
    /* Сторона дальней границы — со стороны разделителя: слева знак перед ним, справа на нём (У-76). */
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
 * Точки у левого блока до знака начала строки: полоска начинается после
 * префикса, пробел расти можно. Знака нет — расти некуда.
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
    /* Проба: положение не отрисовано — подложка не растёт наружу. */
    return 0;
  }
}

/** Строка с плавающей кнопкой `→` или `-1`. Одно правило для кнопки и подложки правого блока (У-32). */
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
   * При открытой панели TagWheel кнопки нет (2026-09-13): `Inline to note`
   * унесла бы разметку полосы. Признак — `tagwheelPanelSegmentInLine` (У-32),
   * не состояние окна — оно устаревает.
   */
  if (tagwheelPanelSegmentInLine(text)) return -1;
  /* Обработанной строке кнопка не нужна (2026-09-25); команда и хоткей остаются. */
  if (lineHasProcessedToken(text, marks.token)) return -1;
  /* Ограда кода, код и таблица — без кнопки (BUGHUNT T20; объявление общее с командой). */
  const doc = view.state.doc;
  if (__sharedUtils.isCodeOrTableLine((n) => doc.line(n + 1).text, line.number - 1)) return -1;
  return line.number;
}

/**
 * Точки у правого блока до кнопки `→` (2026-09-09, пара к прижиму слева).
 * Кнопки нет — бесконечность, не ноль: у конца строки без виджета обе
 * стороны дают одну точку (У-76).
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
    /* Проба: не отрисовано — подложка растёт наружу как без кнопки. */
    return Infinity;
  }
}

/**
 * Отрезок по зрительным строкам (S7): `forRange` на переносе рисует выделение.
 * Режется по границам платформы, не по значениям: значение переносится и
 * внутри себя. Не измерить — остаток одним куском.
 */
function blockFillLineRows(view, span) {
  /* Обход от начала строки: номер зрительной строки нужен вертикали; граница — `blockFillVisualLineEnd` (10.13.116). */
  const rows = [];
  const at0 = Number.isFinite(Number(span.lineFrom)) ? Number(span.lineFrom) : span.from;
  let at = at0;
  /* Обход до конца строки: `rows` — число рядов всей строки, иначе левый и правый блок встают на разную вертикаль (браузерный гейт). */
  const stop = Math.max(Number(span.lineTo) || 0, span.to, at);
  for (let guard = 0; guard < 64; guard += 1) {
    const end = blockFillVisualLineEnd(view, at);
    if (end === null || !(end > at)) break;
    rows.push({ from: at, to: end });
    at = end;
    if (at >= stop) break;
  }
  if (!rows.length) return null;
  /* Числу рядов не верят на слово — `blockFillRowCountTrusted`. Второго счёта рядов нет (10.13.116, У-150). */
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
  /* Правила «остаток — последнему ряду» нет (10.13.116, У-141, У-180): обход доходит до конца строки. */
  return rows;
}

function blockFillPiecesOf(span, rows) {
  /* Запасной кусок помечен неизмеренным: иначе «одна строка» делила высоту и подложка уезжала вниз (2026-09-13). */
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
 * Ящик написанного на каждом ряду перенесённой строки: ряды разной высоты,
 * деление даёт среднее (гейт — 3.09 точки из 25). Мера как у заголовка
 * (У-169) — `Range` по ряду через `domAtPos`. Только перенесённая строка.
 * Нет ответа — `null`, остаётся деление.
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
 * Вертикаль зрительной строки и высота подложки (S7) — от содержимого блока
 * не зависят. У платформы: `view.lineBlockAt`, `view.defaultLineHeight`,
 * `viewState.heightOracle.textHeight` (есть в `app.js` 1.13.7, У-44).
 * Смещение слоя — разница двух измерений одного положения (`getBase` против
 * `coordsAtPos`), без копии `getBase` (У-32). Нет ответа — `null`.
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
   * Высота подложки — от умолчания редактора, одна на все строки; середина — у
   * этой строки (ссылка, эмодзи, пузырь выше). Смешение давало 4 точки разницы.
   */
  /*
   * Ящик строки выше написанного: у заголовка `lineBlockAt` включает отступ
   * (2026-09-13). Отступ — `padding` внутри ящика:
   * `.cm-s-obsidian .cm-line.HyperMD-header { padding-top: var(--p-spacing) }`
   * (`app.css` 1.13.7), поэтому меряется содержимое — ящик границы минус
   * отступы. `coordsAtPos` не годится: ящик каретки. Нет узла — мера по блоку.
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
  /* Делить высоту на число рядов — только если оно сосчитано; иначе высота одного ряда. */
  const rowH = !rowsMeasured
    ? Math.min(rowsHeight > 0 ? rowsHeight : lineH, lineH)
    : (rowsHeight > 0 ? rowsHeight / rowCount : lineH);
  const height = bandHeightAsk(lineH, textH);
  if (!Number.isFinite(height) || height <= 0) return null;
  /* Ящики по рядам — только у перенесённой строки с сосчитанными рядами. */
  const rowBoxes = rowsMeasured ? blockFillRowInkBoxes(view, rowList, toLayer) : null;
  return {
    docTop, toLayer, blockTop, blockHeight, rowsTop, rowsHeight, lineH, rowH, height, rowBoxes,
  };
}

/**
 * Ящик написанного в самом куске (`G4`, 2026-09-16): равные поля сверху и
 * снизу значений, мельче слова человека (3,1 точки при полосе 21,6). `Range`
 * по границам куска; нет узла — прежняя мера.
 */
function blockFillPieceInkBox(view, piece, toLayer) {
  if (!view || typeof view.coordsAtPos !== "function") return null;
  /* Края куска, не весь `Range`: пробел обычным кеглем растягивает объединение на строку (У-173). */
  try {
    const head = view.coordsAtPos(piece.from, 1);
    const tail = view.coordsAtPos(piece.to, -1);
    if (!head || !tail) return null;
    /*
     * Меньший из ящиков краёв: у ссылки Obsidian ящик выше сверху, объединение
     * подняло бы подложку (2026-09-09); нижний край с высотой из настроек мимо на
     * дате (2,3). Худший промах 1,2 точки.
     */
    const boxes = [head, tail]
      .map((c) => ({ top: Number(c.top), height: Number(c.bottom) - Number(c.top) }))
      .filter((b) => Number.isFinite(b.top) && b.height > 0)
      .sort((a, b) => a.height - b.height);
    if (!boxes.length) return null;
    const box = boxes[0];
    return { top: box.top + toLayer, height: box.height };
  } catch (_) {
    /* Проба: позиции может не быть на экране. */
    return null;
  }
}

/**
 * Вертикаль подложки — середина зрительной строки, от высоты самой строки, а
 * не `defaultLineHeight` (`measureTextSize` меряет строку из букв; ссылка,
 * эмодзи, пузырь выше — S7, 2026-09-09). Внутри переноса — деление; прижим
 * не пускает подложку в соседнюю строку документа.
 */
function blockFillPieceBox(geom, piece) {
  const rows = Math.max(1, Number(piece.rows) || 1);
  const blockTop = geom.docTop + geom.blockTop + geom.toLayer;
  /* Зрительные строки — от верха содержимого узла: отступ (`margin` или `padding`) написанному не принадлежит. */
  const rowsTop = Number.isFinite(Number(geom.rowsTop)) ? Number(geom.rowsTop) : blockTop;
  /* У перенесённой строки ряд меряется, не делится (10.13.117): `blockFillRowInkBoxes`; не отдал — деление. */
  /* Середина — по написанному в куске, если измерено (`G4`); иначе ящик ряда, затем деление. */
  const pieceInk = piece && piece.ink && Number(piece.ink.height) > 0 ? piece.ink : null;
  const ink = pieceInk || (geom.rowBoxes ? geom.rowBoxes[Number(piece.row) || 0] : null);
  const rowH = ink ? ink.height : geom.rowH;
  const rowTop = ink ? ink.top : rowsTop + geom.rowH * (Number(piece.row) || 0);
  /* Прижим считает ряд строкой, не написанным в куске (У-131): иначе подложки соседей наезжают. */
  const clampRowH = geom.rowH;
  /* Прижим высоты — только в `blockFillBandHeightPx` (У-32, У-92); здесь — лишь граница блока строки. */
  const height = geom.height;
  const top = rowTop + (rowH - height) / 2;
  /*
   * Середина — по написанному (содержимое узла), прижим — по блоку строки
   * (У-131): отступ заголовка пуст, подложка в него заходит. Цена — до двух
   * точек из 24 при заголовке ниже обычной строки (Minimal).
   */
  const blockBottom = blockTop + (geom.blockHeight > 0 ? geom.blockHeight : clampRowH * rows);
  return { top: Math.max(blockTop, Math.min(top, blockBottom - height)), height };
}

/** Те же отрезки прямоугольниками платформы: наша половина — что красить и насколько больше написанного. */
function blockFillMarkersFor(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const look = blockFillLookFromConfig(cfg);
  /* Высота пузыря — от настроек, у каждой стороны своя (пункт 2). */
  /* Высота написанного — та, что в Block (`Tags text size`), не слово человека (`G4`). */
  const tagVisuals = getTagVisualsFromConfig(cfg);
  /* Кегль редактора — один ответ на всю отрисовку: он от строки не зависит. */
  const basePx = editorTextBasePx(view);
  /* Кегль тега — подложка не выше того, что в ней (`G4`). */
  const tagBasePx = editorTagBasePx(view, basePx, themeTagSizeRaw(view));
  const askHeight = (rowH, textH, zone) => blockFillBandHeightPx(
    look, rowH,
    blockFillWrittenTextHeightPx(tagVisuals, textH, zone),
    blockFillBubbleHeightPx(tagVisuals, zone, basePx, tagBasePx));
  /* Спрашивается один раз на отрисовку: правило одно на весь документ. */
  const flyLine = floatingButtonLineNumber(view, plugin);
  /* Ряды строки — один ответ на оба Block. */
  const rowsByLine = new Map();
  const out = [];
  for (const span of blockFillDocRanges(view, plugin)) {
    const reach = blockFillGapPx(view, span);
    const padX = blockFillPadXPx(look, reach.near, reach.far);
    /*
     * Наружу подложка растёт зеркально (S7, 2026-09-09). Исключения: слева — не
     * на префикс (буллит, чекбокс), справа — до кнопки `→`. Оба прижима мерены.
     */
    const room = span.zone === "left"
      ? blockFillRoomBeforePrefixPx(view, span)
      : blockFillRoomBeforeFlyButtonPx(view, span, flyLine);
    const outward = Math.min(padX, room);
    /* Ряды — раз на строку документа: платформу спрашивают по два-три раза на ряд. */
    const lineRows = rowsByLine.has(span.lineFrom)
      ? rowsByLine.get(span.lineFrom)
      : (() => { const r = blockFillLineRows(view, span); rowsByLine.set(span.lineFrom, r); return r; })();
    const pieces = blockFillPiecesOf(span, lineRows);
    /* Строк у строки, не у отрезка: у левого блока `pieces.length` единица при двух строках (У-129). */
    /* Зона привязывается здесь: высота подложки зависит от кегля стороны (пункт 2). */
    const askHeightHere = (rowH, textH) => askHeight(rowH, textH, span.zone);
    const geom = blockFillRowGeometry(view, span, lineRows, askHeightHere, pieces[0].measured);
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      /* Рост — к разделителю у касающегося куска, наружу — у внешнего; середина перенесённого не растёт. */
      const first = i === 0;
      const last = i === pieces.length - 1;
      const growLeft = span.zone === "right" ? (first ? padX : 0) : (first ? outward : 0);
      const growRight = span.zone === "left" ? (last ? padX : 0) : (last ? outward : 0);
      /* Отрезок для `forRange` — полями, которые читает платформа: `EditorSelection` из копии состояния плагинов не тот. */
      const range = {
        empty: false,
        from: piece.from,
        to: piece.to,
        anchor: piece.from,
        head: piece.to,
        assoc: 0,
      };
      /* Ящик написанного — мера середины (`G4`). */
      const pieceWithInk = geom
        ? Object.assign({}, piece, { ink: blockFillPieceInkBox(view, piece, geom.toLayer) })
        : piece;
      const box = geom ? blockFillPieceBox(geom, pieceWithInk) : null;
      const markers = cmView.RectangleMarker.forRange(view, BLOCK_FILL_MARKER_CLASS, range);
      /*
       * Кусок на несколько рядов (запасной путь) — по прямоугольникам платформы,
       * каждый на своей вертикали: правый Block законно пересекает ряды. Высота
       * подложки одна на все строки.
       */
      for (const marker of markers) {
        /* Не измерить и расти некуда — прямоугольник как есть: долю от неизмеренного не взять. */
        if (!box && !growLeft && !growRight) { out.push(marker); continue; }
        /* Прямоугольник пересоздаётся: его поля читают `eq` и отрисовка. `null` ширины — «не задавать». */
        const width = marker.width == null ? null : Number(marker.width) + growLeft + growRight;
        /*
         * Обход рядов не удался — номер выдуман; кусок у платформы один
         * прямоугольник: берём её вертикаль, высоту ставим по её середине.
         */
        const unmeasuredTop = box && piece.measured === false
          ? (() => {
            const mid = Number(marker.top) + (Number(marker.height) - box.height) / 2;
            /* Прижим как на измеренном пути: не за блок своей строки. */
            const blockTop = geom.docTop + geom.blockTop + geom.toLayer;
            const blockBottom = blockTop + (geom.blockHeight > 0 ? geom.blockHeight : box.height);
            return Math.max(blockTop, Math.min(mid, blockBottom - box.height));
          })()
          : null;
        out.push(new cmView.RectangleMarker(
          BLOCK_FILL_MARKER_CLASS,
          Number(marker.left) - growLeft,
          /* Вертикаль — от зрительной строки; не измерено — прежняя мера. */
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
 * Надо ли перерисовать слой подложки — решение отдельно: `layer(...)` прячет
 * config в фасете. Сравнивается подпись (S7): высота и ширина — геометрия;
 * пустая правка выделения из `refreshOpenEditors` не взводит `docChanged`,
 * `viewportChanged`, `geometryChanged` (У-56).
 */
function blockFillLayerNeedsRedraw(plugin, update, dom) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const look = blockFillLookFromConfig(cfg);
  /* В подписи и размер пузыря (`blockFillBubbleHeightPx`): `Text size`, `Tag bubble height` (У-56). */
  const v = getTagVisualsFromConfig(cfg);
  const sig = look.enabled
    /* Сторона (З-12, `Stripe direction`) в подписи (У-56); цвет и густота — переменными CSS. */
    ? [look.heightPct, look.widthPct, look.direction,
       v.tagTextSizeLeftPct, v.tagTextSizeRightPct, v.tagBubbleHeightPct].join(":")
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
        /* Украшение не роняет текст: рисование молчит, причина — в журнал (правило отказов, п. 3). */
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
 * Один токен панели без приставки — при выключенном `Show tag markers`.
 * Закрывает один токен, не весь `==…==` (B2, 2026-09-02).
 */
class TagwheelTokenWidget extends cmView.WidgetType {
  constructor(text, color) {
    super();
    this.text = String(text || "");
    /* Цвет своей ячейки: пометку над собой виджет не наследует (D6). */
    this.color = String(color || "");
  }

  eq(other) {
    return !!(other && other.text === this.text && other.color === this.color);
  }

  toDOM() {
    const node = document.createElement("span");
    node.className = "inline-overhaul-tw-token";
    node.textContent = this.text;
    if (this.color) node.style.setProperty("--io-tw-token-color", this.color);
    return node;
  }
}

function buildTagwheelHeaderDecorations(view, plugin) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  /* Незаданный цвет — у темы (10.13.23 Ц2): ранняя отбивка делала панель нечитаемой на чистом vault. */
  const colors = resolveTagwheelPaintColors(getTagwheelHeaderColorsFromConfig(cfg));

  const placeholders = buildTagwheelPlaceholderSetFromConfig(cfg);
  const ranges = [];

  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      for (const span of tagwheelPanelSpans(text, colors, placeholders)) {
        /*
         * Пометка строки: подсветка Obsidian цветом панели, фон тегов гаснет.
         * Цвет — `--io-twfill`, одним слоем на строку. Декорация строки — разбирается отдельно.
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
          ? cmView.Decoration.replace({ widget: new TagwheelTokenWidget(span.text, span.color), inclusive: false })
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
    /* Не `return true`: при смене отступа CodeMirror оставил бы прежний узел (У-24). */
    return !!other && other.gap === this.gap;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "io-flybtn";
    el.textContent = "\u2192";
    /* Стилем — только своя переменная; геометрия в `styles.css` (З6, Г1). */
    el.style.setProperty("--io-flybtn-gap", this.gap + "px");
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", __commandIds.commandName("transform-inline-to-note"));
    el.title = __commandIds.commandName("transform-inline-to-note");
    /* `mousedown`, не `click`: к `click` редактор уже переставил каретку (Н11). */
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
  if (!marks.highlight && !marks.button && !marks.doneHighlight && !marks.doneStrike) return cmView.Decoration.none;

  /* Строка кнопки — одно правило для кнопки и подложки правого блока (У-32). */
  const cursorLine = floatingButtonLineNumber(view, plugin);
  const style = [
    "opacity: " + marks.opacity + ";",
    marks.color ? "color: " + marks.color + ";" : "",
  ].filter(Boolean).join(" ");
  const lineDeco = cmView.Decoration.line({ attributes: { style, class: "io-done-line" } });
  /* Отмеченная строка (`done-dim`) — свой класс: `io-done-line` уже «ушла в заметку» (правило 31).
     `done-strike` — свой класс. Черта в `style`: у `[x]` её снимает
     `.HyperMD-task-line[data-task="x"]` (`app.css` 1.13.7) при пустом `--checklist-done-decoration` (Minimal). */
  const tickedDeco = cmView.Decoration.line({ attributes: {
    style: [
      marks.doneHighlight ? "opacity: " + marks.doneOpacity + ";" : "",
      marks.doneHighlight && marks.doneColor ? "color: " + marks.doneColor + ";" : "",
      marks.doneStrike ? "text-decoration-line: line-through;" : "",
    ].filter(Boolean).join(" "),
    class: [marks.doneHighlight ? "io-ticked-line" : "", marks.doneStrike ? "io-ticked-strike" : ""].filter(Boolean).join(" "),
  } });

  const ranges = [];
  for (const lineNo of visibleLineNumbers(view)) {
    {
      const line = view.state.doc.line(lineNo);
      const text = String(line.text || "");
      if (marks.highlight && lineHasProcessedToken(text, marks.token)) {
        ranges.push({ from: line.from, to: line.from, deco: lineDeco, side: -1 });
      } else if ((marks.doneHighlight || marks.doneStrike) && lineHasProcessedToken(text, marks.doneToken)) {
        ranges.push({ from: line.from, to: line.from, deco: tickedDeco, side: -1 });
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

/**
 * Строки, перенесённые `Move up/down` при `Highlight after moving` (`В-256`).
 * Метку ставит `markMovedLines` (`navigation_runtime.js`) до постановки
 * курсора; слой запоминает выделение первого обновления и красит, пока
 * документ и выделение те же (тест 3 цикла 111). Сам ничего не пишет.
 */
function movedLinesDecorations(view, plugin) {
  const mark = view.__ioMovedLines;
  if (!mark) return cmView.Decoration.none;
  const doc = view.state.doc;
  const sel = view.state.selection;
  if (!mark.sel) mark.sel = sel;
  if (mark.doc !== doc || !mark.sel.eq(sel) || mark.to >= doc.lines) {
    view.__ioMovedLines = null;
    return cmView.Decoration.none;
  }
  /* `Moved lines color` (цикл 118): переменной; пусто — цвет выделения темы. */
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : null;
  const color = normalizeHexColorInput(readCfgPath(cfg, "navigation.moveLine.highlightColor"));
  const spec = color
    ? { class: "io-moved-line", attributes: { style: "--io-moved-line-bg: " + color } }
    : { class: "io-moved-line" };
  const ranges = [];
  for (let n = mark.from + 1; n <= mark.to + 1; n++) {
    const at = doc.line(n).from;
    ranges.push({ from: at, to: at, deco: cmView.Decoration.line(spec) });
  }
  return buildDecorationSet(ranges, "moved-lines");
}

function createMovedLinesExtension(plugin) {
  return cmView.ViewPlugin.fromClass(class {
    constructor(view) {
      this.decorations = movedLinesDecorations(view, plugin);
    }
    update(update) {
      this.decorations = movedLinesDecorations(update.view, plugin);
    }
  }, {
    decorations: (v) => v.decorations,
  });
}

module.exports = {
  traceEvent,
  createMovedLinesExtension,
  buildDecorationSet,
  visibleLineNumbers,
  TagVisualTokenWidget,
  LinkVisualTokenWidget,
  openWikilinkTarget,
  ZeroWidthInlineWidget,
  buildBlockStyleDecoration,
  buildTagVisualLayer,
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
