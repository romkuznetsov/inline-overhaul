"use strict";

/**
 * Страница гейта: **настоящий редактор CodeMirror с настоящим слоем плагина**.
 *
 * **Почему это стало возможно** (У-98). В `harness.js` до 2026-09-09 стояло
 * «панель плагина в браузер не поднять — её рисует Obsidian, и платформы тут
 * нет». Про панель это верно и осталось верным. Но слой оформления **редактора**
 * — это чистый CodeMirror: `@codemirror/view` лежит в `node_modules`,
 * `decorations.js` подключает только его, `@codemirror/state` и свои модули, и
 * всё это собирается в страницу одной командой esbuild. То есть «как это
 * выглядит в самой заметке» перестало быть вопросом, на который отвечает
 * только глаз заказчика, — а этой строкой лист приёмки кончался дважды.
 *
 * **Что здесь настоящее и что подделано** (У-1):
 *
 *   * настоящие — `EditorView`, `RectangleMarker`, `layer`, разбор строки,
 *     виджеты пузырей, слой подложки и правила стилей: всё берётся из
 *     `src/**` и `@codemirror/view` без единой копии;
 *   * подделан — **Obsidian**. Ссылку `[[…]]`, чекбокс и знак списка в Live
 *     Preview рисует он, и его тут нет. На месте ссылки стоит пометка
 *     `io-probe-link`, и подделано в ней ровно одно свойство, обмеренное по
 *     скриншоту заказчика 18.png: её строчный ящик **выше** ящика соседнего
 *     текста. Это и есть предмет замечания «если в block встречается wikilink,
 *     то полоска становится выше».
 *
 * Числа наружу не выводятся: страница отдаёт измерения, а утверждения о них
 * живут в `check_editor.js`.
 */

const { EditorState } = require("@codemirror/state");
const { EditorView, Decoration, ViewPlugin } = require("@codemirror/view");
const decorations = require("../../src/ui/editor/decorations.js");
const visuals = require("../../src/core/editor_visuals_config.js");
const scroller = require("../../src/ui/tagwheel_scroller_overlay.js");

const SEP = "::";

/*
 * Конфиг заказчика в той части, которая решает вид блоков: его цвет подложки,
 * его густота, его размеры. Взят с его `data.json` — фикстура, придуманная
 * заново, проверяла бы другого человека (У-2).
 */
const CFG = {
  pkm: {
    lineFormat: { separator1: SEP, separator2: SEP },
    fields: {
      elements: { byField: { due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD hh:mm" } } },
    },
  },
  /*
   * Плавающая кнопка `→` включена нарочно: с 2026-09-09 подложка правого блока
   * прижимается к ней так же, как левая прижата к чекбоксу (решение заказчика
   * по вопросу о полосе за спиной кнопки). Без кнопки на странице этот прижим
   * проверялся бы отсутствием предмета (У-113).
   */
  features: { transform: { enabled: true } },
  transform: { inline2note: { enabled: true, floatingButton: true, floatingButtonGap: 12 } },
  visual: {
    tags: {
      textSizePct: 80,
      bubbleWidthPct: 80,
      bubbleHeightPct: 80,
      emptyBubblePct: 50,
      cornersPct: 0,
      opacityLeft: 100,
      opacityRight: 100,
      byTag: {
        type: { "#todo": { fillColor: "#0008f0", textColor: "#f0eaea", visibility: "default" } },
        Category: { "#work": { fillColor: "#1106b2", textColor: "", visibility: "default" } },
        Importance: { "#/1": { fillColor: "#ff0000", textColor: "#ffffff", visibility: "empty" } },
      },
      userTags: { "#processed": { fillColor: "#ff0000", textColor: "", visibility: "default" } },
      blockFill: { enabled: true, color: "#908e8e", opacity: 75, heightPct: 40, widthPct: 50 },
    },
  },
};

const plugin = { getConfig: () => CFG };

/*
 * Строки взяты из заметки заказчика (`test-vault/test1.md`) и покрывают ровно
 * те случаи, о которых он писал:
 *
 *   1. блок из одного пузыря;
 *   2. блок из двух пузырей — строка без ссылки, эталон высоты;
 *   3. блок с **ссылкой** на конце — та самая строка, где полоска уходила выше;
 *   4. блок из одного пустого пузыря — «полоска на empty bubble рисуется с
 *      разрывами и отличается по высоте»;
 *   5. длинная строка, у которой правый блок **переносится**.
 */
const LINES = [
  "- [ ] #todo " + SEP + " 1 " + SEP + " \u{1F4C5}2026-09-08 12:36",
  "- [ ] #todo #work " + SEP + " 4 " + SEP + " \u{1F4C5}2026-09-08 12:37",
  "- [ ] #todo #work [[test1]] " + SEP + " 12 " + SEP + " \u{1F4C5}2026-09-08 12:38",
  "- [ ] #/1 " + SEP + " 5 " + SEP + " #processed",
  "- [ ] #todo #work " + SEP + " a line long enough that its right block has to wrap onto"
    + " the next visual row of the very same document line " + SEP
    + " \u{1F4C5}2026-09-08 12:39 #processed",
];

/*
 * ПОДДЕЛКА OBSIDIAN, И ОНА НАЗВАНА (У-1). Ссылку `[[…]]` в Live Preview
 * рисует Obsidian, а его тут нет. Пометка ставится на тот же отрезок, что
 * заняла бы ссылка, и несёт класс, у которого в стилях страницы задан
 * **более высокий строчный ящик**, — единственное свойство ссылки, которое
 * обмерено по 18.png и которое решает вертикаль подложки.
 */
const linkStandIn = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildLinkMarks(view); }
  update(u) { this.decorations = buildLinkMarks(u.view); }
}, { decorations: (v) => v.decorations });

function buildLinkMarks(view) {
  const out = [];
  for (let n = 1; n <= view.state.doc.lines; n++) {
    const line = view.state.doc.line(n);
    const i = line.text.indexOf("[[");
    if (i < 0) continue;
    const j = line.text.indexOf("]]", i);
    if (j < 0) continue;
    out.push(Decoration.mark({ class: "io-probe-link" }).range(line.from + i, line.from + j + 2));
  }
  return Decoration.set(out, true);
}

const view = new EditorView({
  state: EditorState.create({
    doc: LINES.join("\n"),
    extensions: [
      EditorView.lineWrapping,
      decorations.createTagVisualDecorationExtension(plugin),
      linkStandIn,
      /* Кнопка `→` — наш же виджет, и здесь он настоящий. */
      decorations.createSourceMarkDecorationExtension(plugin),
      decorations.createBlockFillLayerExtension(plugin),
    ],
  }),
  parent: document.getElementById("host"),
});

/* Правила подложки ставит плагин; здесь их ставит то же место, что в нём. */
const bandStyle = document.createElement("style");
bandStyle.textContent = visuals.buildBlockFillStyleCss(visuals.blockFillLookFromConfig(CFG));
document.head.appendChild(bandStyle);

/**
 * Поставить настройки подложки и дать слою перерисоваться.
 *
 * Пустая правка выделения — тот же случай, что в заметке: пересборка настроек
 * присылает её же, и решает подпись слоя (`blockFillLayerNeedsRedraw`). То
 * есть проверка ходит тем самым путём, каким до слоя доезжает ползунок.
 */
/**
 * Слой перерисовывается **не сразу**, и это не мелочь.
 *
 * `layer` ставит свои прямоугольники в фазе измерения CodeMirror, а её
 * платформа откладывает до кадра отрисовки. Проба, снятая сразу за
 * `dispatch`, читает **прежнее** состояние слоя: 2026-09-09 из-за этого гейт
 * мерил вчерашнюю высоту подложки и был зелёный при шкале, которая ничего не
 * делала. Поэтому обе рисовалки возвращают обещание и ждут двух кадров: в
 * первом платформа мерит, во втором ставит.
 */
function settled() {
  return new Promise((done) => {
    requestAnimationFrame(() => requestAnimationFrame(() => done(true)));
  });
}

window.__ioSetBand = function (patch) {
  Object.assign(CFG.visual.tags.blockFill, patch || {});
  bandStyle.textContent = visuals.buildBlockFillStyleCss(visuals.blockFillLookFromConfig(CFG));
  view.dispatch({ selection: view.state.selection });
  return settled();
};

window.__ioSetTags = function (patch) {
  Object.assign(CFG.visual.tags, patch || {});
  view.dispatch({ selection: view.state.selection });
  return settled();
};

/** Каретка на строке: от неё зависит, где стоит кнопка `→`. */
window.__ioPutCaret = function (lineNumber) {
  const line = view.state.doc.line(Math.max(1, Math.min(view.state.doc.lines, Number(lineNumber) || 1)));
  view.dispatch({ selection: { anchor: line.to } });
  return settled();
};

function round(n) { return Math.round(Number(n) * 100) / 100; }

/** Прямоугольники подложки, как их видит браузер. */
function bands() {
  return Array.from(document.querySelectorAll("." + visuals.BLOCK_FILL_MARKER_CLASS))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return { left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom), height: round(r.height) };
    })
    .sort((a, b) => (a.top - b.top) || (a.left - b.left));
}

/**
 * Измерения, о которых спрашивает проверка.
 *
 * Каждое — вопрос к браузеру, а не к нашему коду: положение прямоугольника,
 * положение первого написанного знака блока, правый край знака начала строки.
 */
window.__ioEditorProbe = function () {
  const doc = view.state.doc;
  const rows = [];
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    const spans = visuals.blockFillSpansInLine(
      line.text, SEP, SEP,
      visuals.buildElementMarkersFromConfig(CFG));
    const left = spans.find((s) => s.zone === "left") || null;
    const at = (pos, side) => {
      const c = view.coordsAtPos(pos, side);
      return c ? { left: round(c.left), right: round(c.right), top: round(c.top), bottom: round(c.bottom) } : null;
    };
    /*
     * Ящик зрительной строки — от него считается середина подложки, и он же
     * отличает строку со ссылкой от строки без неё: она **выше** умолчания
     * редактора. Берётся у платформы (`lineBlockAt`), а не у узла `.cm-line`:
     * подложка считается от той же меры.
     */
    const block = view.lineBlockAt(line.from);
    rows.push({
      line: n,
      hasLink: line.text.indexOf("[[") >= 0,
      rowTop: round(Number(view.documentTop) + Number(block.top)),
      rowHeight: round(Number(block.height)),
      /* Первое значение левого блока и правый край знака начала строки. */
      blockStart: left ? at(line.from + left.start, 1) : null,
      prefixGlyphEnd: left ? at(line.from + left.prefixEnd, -1) : null,
      sepStart: left && left.gapTo >= 0 ? at(line.from + left.gapTo, 1) : null,
      sepEnd: left && left.sepFar >= 0 ? at(line.from + left.sepFar, -1) : null,
    });
  }
  /*
   * Положительный контроль к подделке ссылки: её строчный ящик и правда выше
   * ящика соседнего текста. Без него «высоты подложек равны» выполнялось бы и
   * от подделки, которая ничего не подделала (У-110).
   */
  const linkEl = document.querySelector(".io-probe-link");
  const plainEl = document.querySelector(".cm-line");
  const linkBox = linkEl ? round(linkEl.getBoundingClientRect().height) : -1;
  const textBox = (() => {
    if (!plainEl) return -1;
    const range = document.createRange();
    const node = Array.from(plainEl.childNodes).find((n) => n.nodeType === 3);
    if (!node) return -1;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    return round(r.height);
  })();
  /* Пузырь тега: его высота — вторая половина замечания по V1, и мерит её
     браузер, а не наша формула. */
  const bubbleEl = document.querySelector("[data-io-tag-token]");
  const bubbleHeight = bubbleEl ? round(bubbleEl.getBoundingClientRect().height) : -1;
  /* Кнопка `→`: до неё прижимается подложка правого блока. */
  const flyEl = document.querySelector(".io-flybtn");
  const fly = flyEl ? (() => {
    const r = flyEl.getBoundingClientRect();
    return { left: round(r.left), right: round(r.right), top: round(r.top) };
  })() : null;
  return {
    bands: bands(),
    rows,
    linkBoxHeight: linkBox,
    textBoxHeight: textBox,
    bubbleHeight,
    fly,
    lineHeight: round(view.defaultLineHeight),
    markerClass: visuals.BLOCK_FILL_MARKER_CLASS,
  };
};

/**
 * Отпечаток отрисовки: вычисленный стиль каждого нарисованного плагином узла.
 *
 * Нужен не подложке, а **переносу инлайновых объявлений оформления в классы**
 * (Р7): перенос вида не меняет, если сделан верно, и проверить это было нечем,
 * кроме глаза заказчика. Здесь это проверяется числами: отпечаток до переноса
 * обязан совпасть с отпечатком после.
 */
const FINGERPRINT_PROPS = [
  "display", "font-size", "line-height", "padding-top", "padding-right",
  "padding-bottom", "padding-left", "border-radius", "background-color",
  "color", "opacity", "width", "min-width", "height", "margin-left",
  "margin-right", "vertical-align", "overflow", "border-top-width",
];

/**
 * Оверлей скроллера TagWheel — тот самый, про который в Р7 написано «проверить
 * это можно только глазами заказчика».
 *
 * Он поднимается здесь целиком и по-настоящему: модуль не знает ни об Obsidian,
 * ни о плагине, ему нужны `document`, `window` и редактор, у которого есть
 * `posToOffset` и `cm.coordsAtPos`. Второе — настоящий `EditorView` этой
 * страницы, то есть положение коробки считает настоящий CodeMirror.
 *
 * **Подделан ровно `Editor` Obsidian** (У-1): `posToOffset` — это его API, а не
 * CodeMirror'а, и здесь он переводит строку и столбец в смещение по настоящему
 * документу.
 */
let scrollerHandle = null;

window.__ioShowScroller = function (opts) {
  if (scrollerHandle) { scrollerHandle.destroy(); scrollerHandle = null; }
  const o = opts && typeof opts === "object" ? opts : {};
  scrollerHandle = scroller.createTagWheelScrollerOverlay({
    direction: o.direction || "full",
    size: o.size || 3,
    fillColor: o.fillColor || "",
    textColor: o.textColor || "",
  });
  const editorStandIn = {
    posToOffset: (at) => {
      const line = view.state.doc.line(Math.max(1, Number(at && at.line) + 1));
      return line.from + Math.max(0, Number(at && at.ch) || 0);
    },
    cm: view,
  };
  /*
   * Строка панели того же вида, что рисует TagWheel: активное значение в ней
   * обособлено `**[…]**`, и по нему оверлей находит, к чему прицепиться. Без
   * этой пометки он прячется, и снимок вышел бы из двух пустых коробок —
   * то есть проверял бы отсутствие предмета (У-113).
   */
  scrollerHandle.update({
    editor: editorStandIn,
    lineNumber: 1,
    controlLine: "==`#todo` **[work]**==",
    upItems: [{ label: "#todo" }, { label: "#doing" }],
    downItems: [{ label: "#work" }, { label: "#home" }, { label: "#health" }],
  });
  /* У-110: коробка обязана появиться, иначе снимок пуст и сверять нечего. */
  const rows = document.querySelectorAll("body > div:not(.markdown-source-view) > div > div");
  if (!rows.length) throw new Error("оверлей скроллера не нарисовал ни одной строки");
  return document.querySelectorAll("body > div:not(.markdown-source-view)").length;
};

window.__ioHideScroller = function () {
  if (scrollerHandle) { scrollerHandle.destroy(); scrollerHandle = null; }
};

/** Отпечаток коробок оверлея: сами коробки и всё, что в них. */
window.__ioFingerprintScroller = function () {
  const out = [];
  const roots = document.querySelectorAll("body > div:not(.markdown-source-view)");
  for (const root of roots) {
    const nodes = [root].concat(Array.from(root.querySelectorAll("*")));
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      const row = { tag: el.tagName.toLowerCase(), cls: el.className || "" };
      const text = el.textContent || "";
      row.text = text.length > 24 ? text.slice(0, 24) : text;
      for (const p of SCROLLER_PROPS) row[p] = cs.getPropertyValue(p);
      const r = el.getBoundingClientRect();
      row.box = round(r.width) + "x" + round(r.height)
        + "@" + round(r.left) + "," + round(r.top);
      out.push(row);
    }
  }
  return out;
};

const SCROLLER_PROPS = [
  "position", "z-index", "pointer-events", "display", "border-top-width",
  "border-top-style", "border-top-color", "border-radius", "background-color",
  "box-shadow", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "font-size", "line-height", "white-space", "overflow", "font-family",
  "flex-direction", "gap", "text-overflow", "opacity", "color", "font-weight",
  "visibility", "left", "top", "width", "min-width",
];

window.__ioFingerprint = function () {
  const out = [];
  const nodes = document.querySelectorAll(
    ".cm-content [data-io-tag-token], .cm-content .io-zero-width-inline,"
    + " .cm-content .inline-overhaul-tw-token, ." + visuals.BLOCK_FILL_MARKER_CLASS);
  for (const el of nodes) {
    const cs = getComputedStyle(el);
    const row = { tag: el.tagName.toLowerCase(), cls: el.className || "" };
    const token = el.getAttribute && el.getAttribute("data-io-tag-token");
    if (token) row.token = token;
    const text = el.textContent || "";
    row.text = text.length > 24 ? text.slice(0, 24) : text;
    for (const p of FINGERPRINT_PROPS) row[p] = cs.getPropertyValue(p);
    const r = el.getBoundingClientRect();
    row.box = round(r.width) + "x" + round(r.height);
    out.push(row);
  }
  return out;
};
