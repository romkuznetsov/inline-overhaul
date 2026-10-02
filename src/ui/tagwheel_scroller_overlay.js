"use strict";

const __editorVisualsConfig = require("../core/editor_visuals_config.js");

/*
 * Имена классов коробки — одно объявление на код и стили (Р7); правила в
 * `styles.css`, раздел «Оверлей скроллера TagWheel». Показ — тоже класс (У-32).
 * Вычисленное (ширина, положение) — на отрисовке; цвета — переменными
 * `--io-twscroller-*` (У-68), умолчание «у темы» — в самом правиле.
 */
let SCROLLER_BOX_CLASS = "io-twscroller";
let SCROLLER_SHOWN_CLASS = "io-twscroller--shown";
let SCROLLER_LIST_CLASS = "io-twscroller__list";
let SCROLLER_ROW_CLASS = "io-twscroller__row";
let SCROLLER_PROBE_CLASS = "io-twscroller__probe";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeDirection(raw) {
  let d = String(raw || "").trim().toLowerCase();
  if (d === "up" || d === "down" || d === "full") return d;
  return "full";
}

function normalizeSize(raw) {
  let n = Math.trunc(Number(raw));
  if (!isFinite(n)) return 3;
  return clamp(n, 1, 20);
}

function findActiveTokenRange(controlLine) {
  let line = String(controlLine || "");
  let re = /\*\*\[[\s\S]*?\]\*\*/g;
  let m = re.exec(line);
  if (!m) return null;
  return {
    fromCh: Number(m.index || 0),
    toCh: Number((m.index || 0) + String(m[0] || "").length),
  };
}

function getAnchorRect(editor, lineNumber, controlLine) {
  try {
    if (!editor || typeof editor.posToOffset !== "function") return null;
    let cm = editor.cm;
    if (!cm || typeof cm.coordsAtPos !== "function") return null;
    /* Активная ячейка — из общего дома: свой образец обрывался на первой `]` (сторож чекбокса, 2026-10-01). */
    let activeTokenMatch = String(controlLine || "").match(__editorVisualsConfig.TAGWHEEL_ACTIVE_CELL_RE);
    let activeToken = activeTokenMatch ? String(activeTokenMatch[1] || "").trim() : "";
    let cmDom = cm && cm.dom ? cm.dom : null;
    if (cmDom && typeof cmDom.querySelectorAll === "function") {
      let nodes = cmDom.querySelectorAll(".inline-overhaul-tw-active-anchor");
      if (nodes && nodes.length) {
        let targetY = null;
        try {
          let lineFrom = editor.posToOffset({ line: lineNumber, ch: 0 });
          let lineCoords = cm.coordsAtPos(lineFrom);
          if (lineCoords && isFinite(lineCoords.top)) targetY = Number(lineCoords.top);
        } catch (_) {
          /*
           * Проба: строка бывает вне отрисованного, и координат редактор не знает —
           * `targetY` пуст, якорь выбирается по порядку.
           */
        }
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;
        let i;
        for (i = 0; i < nodes.length; i++) {
          let el = nodes[i];
          if (!el || typeof el.getBoundingClientRect !== "function") continue;
          if (activeToken && String(el.textContent || "").trim() !== activeToken) continue;
          let rect = el.getBoundingClientRect();
          if (!rect || !isFinite(rect.left) || !isFinite(rect.top)) continue;
          let cy = (Number(rect.top) + Number(rect.bottom || rect.top)) / 2;
          let score = targetY == null ? i : Math.abs(cy - targetY);
          if (score < bestScore) {
            best = rect;
            bestScore = score;
          }
        }
        if (best) {
          return {
            left: Number(best.left),
            right: Number(best.right || best.left),
            top: Number(best.top),
            bottom: Number(best.bottom || best.top),
            width: Math.max(8, Number(best.width || (best.right - best.left) || 8)),
          };
        }
      }
    }
    let range = findActiveTokenRange(controlLine);
    if (!range) return null;
    let from = editor.posToOffset({ line: lineNumber, ch: range.fromCh });
    let to = editor.posToOffset({ line: lineNumber, ch: Math.max(range.toCh, range.fromCh + 1) });
    let a = cm.coordsAtPos(from);
    let b = cm.coordsAtPos(to);
    if (!a || !b) return null;
    let left = Math.min(a.left, b.left);
    let right = Math.max(a.right || a.left, b.right || b.left);
    let top = Math.min(a.top, b.top);
    let bottom = Math.max(a.bottom || a.top, b.bottom || b.top);
    return {
      left: left,
      right: right,
      top: top,
      bottom: bottom,
      width: Math.max(8, right - left),
    };
  } catch (_) {
    return null;
  }
}

/** Цвет из настроек или пусто — «взять у темы», стиль не задаётся (PRD 10.13.15 Н2, D6). */
function pickColor(value) {
  let s = String(value == null ? "" : value).trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}

function createRoot(colors) {
  let c = colors && typeof colors === "object" ? colors : {};
  let root = document.createElement("div");
  root.className = SCROLLER_BOX_CLASS;
  /* Свой фон, если задан; умолчание — в правиле, чтобы его перебивала тема. */
  if (c.fill) root.style.setProperty("--io-twscroller-fill", c.fill);

  let list = document.createElement("div");
  list.className = SCROLLER_LIST_CLASS;
  root.appendChild(list);
  document.body.appendChild(root);
  return { root: root, list: list, colors: { fill: c.fill || "", text: c.text || "" } };
}

/** Коробка видна или нет — одно место (У-32). */
function setBoxShown(target, shown) {
  if (!target || !target.root || !target.root.classList) return;
  if (shown) target.root.classList.add(SCROLLER_SHOWN_CLASS);
  else target.root.classList.remove(SCROLLER_SHOWN_CLASS);
}

function createTagWheelScrollerOverlay(options) {
  let cfg = options && typeof options === "object" ? options : {};
  let direction = normalizeDirection(cfg.direction);
  let size = normalizeSize(cfg.size);

  /* Цвета приходят настройками; пустые означают «как в теме» (10.13.15). */
  let colors = {
    fill: pickColor(cfg.fillColor),
    text: pickColor(cfg.textColor),
  };
  /* Своя заливка без своего цвета текста — читаемый текст, не цвет темы (в тёмной теме сливался). */
  if (colors.fill && !colors.text) colors.text = __editorVisualsConfig.readableTextOn(colors.fill);
  let boxPrimary = createRoot(colors);
  let boxSecondary = createRoot(colors);

  function hide() {
    setBoxShown(boxPrimary, false);
    setBoxShown(boxSecondary, false);
  }

  function measureLongest(rows) {
    /* Мерка длины строки того же начертания, что коробка: одно правило на два селектора (У-32). */
    let probe = document.createElement("span");
    probe.className = SCROLLER_PROBE_CLASS;
    document.body.appendChild(probe);
    let maxW = 0;
    let i;
    for (i = 0; i < rows.length; i++) {
      probe.textContent = String(rows[i] || "");
      maxW = Math.max(maxW, Math.ceil(probe.getBoundingClientRect().width));
    }
    document.body.removeChild(probe);
    return maxW;
  }

  /*
   * Строки коробки: свой цвет текста или цвет темы (10.13.15 Н1, Н2). Текущего
   * значения в коробке нет — его цвет у панели (`visual.tagWheel.activeTextColor`).
   */
  function renderRows(target, rows) {
    /*
     * Не `innerHTML` (Р1, 2026-09-08). Не `el.empty()`: коробка из
     * `document.createElement`, а заглушка DOM надстроек Obsidian не имеет (У-45).
     */
    while (target.list.firstChild) target.list.removeChild(target.list.firstChild);
    let colors = target.colors || {};
    let i;
    for (i = 0; i < rows.length; i++) {
      let item = document.createElement("div");
      item.className = SCROLLER_ROW_CLASS;
      item.textContent = String(rows[i] || "-");
      if (colors.text) item.style.setProperty("--io-twscroller-text", colors.text);
      target.list.appendChild(item);
    }
  }

  function applyWidth(target, anchorWidth, rows) {
    let longestW = measureLongest(rows);
    let minW = Math.max(anchorWidth, longestW + 18);
    let vw = window.innerWidth || 1;
    let finalW = clamp(minW, 40, Math.max(40, vw - 8));
    target.root.style.minWidth = String(Math.round(finalW)) + "px";
    target.root.style.width = String(Math.round(finalW)) + "px";
  }

  function placeBox(target, anchor, mode) {
    let gap = 4;
    let vw = window.innerWidth || 1;
    let vh = window.innerHeight || 1;
    let rect = target.root.getBoundingClientRect();
    let w = Math.ceil(rect.width);
    let h = Math.ceil(rect.height);
    let left = clamp(anchor.left, 4, Math.max(4, vw - w - 4));
    let top = mode === "up"
      ? (anchor.top - h - gap)
      : (anchor.bottom + gap);
    top = clamp(top, 4, Math.max(4, vh - h - 4));
    target.root.style.left = String(Math.round(left)) + "px";
    target.root.style.top = String(Math.round(top)) + "px";
    setBoxShown(target, true);
  }

  /*
   * Коробка приклеена к панели (2026-09-24): узел `position: fixed`, прокрутка
   * повторяет последний `update`. Слушатель на `cm.scrollDOM` (`.cm-scroller`):
   * `document` мимо `registerDomEvent` запрещён (`catalog_rules_tests.ts`).
   * Снимается при `destroy`.
   */
  let lastPayload = null;
  let framePending = false;
  let scrollHost = null;
  function onScroll() {
    if (!lastPayload || framePending) return;
    let raf = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : function(fn) { fn(); };
    framePending = true;
    raf(function() {
      framePending = false;
      if (lastPayload) update(lastPayload);
    });
  }
  function listenTo(editor) {
    let el = editor && editor.cm && editor.cm.scrollDOM;
    if (!el || typeof el.addEventListener !== "function") el = null;
    if (el === scrollHost) return;
    if (scrollHost) scrollHost.removeEventListener("scroll", onScroll);
    scrollHost = el;
    if (scrollHost) scrollHost.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Якорь за краем области заметки коробку не держит, иначе `placeBox` прижмёт её к краю окна. Край — у `scrollDOM`, иначе у окна. */
  function anchorOutOfView(editor, anchor) {
    let top = 0;
    let bottom = window.innerHeight || 1;
    let sd = editor && editor.cm && editor.cm.scrollDOM;
    if (sd && typeof sd.getBoundingClientRect === "function") {
      let r = sd.getBoundingClientRect();
      if (r && isFinite(r.top) && isFinite(r.bottom) && r.bottom > r.top) {
        top = r.top;
        bottom = r.bottom;
      }
    }
    return anchor.bottom < top || anchor.top > bottom;
  }

  function update(payload) {
    let p = payload && typeof payload === "object" ? payload : {};
    lastPayload = p;
    let editor = p.editor;
    listenTo(editor);
    let lineNumber = Number(p.lineNumber);
    let controlLine = String(p.controlLine || "");
    if (!editor || !isFinite(lineNumber)) {
      hide();
      return;
    }
    let anchor = getAnchorRect(editor, lineNumber, controlLine);
    if (!anchor || anchorOutOfView(editor, anchor)) {
      hide();
      return;
    }

    let upRows = Array.isArray(p.upItems)
      ? p.upItems.slice(0, size).map(function(x) { return String(x && x.label || "-"); })
      : [];
    let downRows = Array.isArray(p.downItems)
      ? p.downItems.slice(0, size).map(function(x) { return String(x && x.label || "-"); })
      : [];

    hide();

    if (direction === "up") {
      if (!upRows.length) return;
      let upDisplayRows = upRows.slice().reverse();
      renderRows(boxPrimary, upDisplayRows);
      applyWidth(boxPrimary, anchor.width, upDisplayRows);
      setBoxShown(boxPrimary, true);
      placeBox(boxPrimary, anchor, "up");
      return;
    }

    if (direction === "down") {
      if (!downRows.length) return;
      renderRows(boxPrimary, downRows);
      applyWidth(boxPrimary, anchor.width, downRows);
      setBoxShown(boxPrimary, true);
      placeBox(boxPrimary, anchor, "down");
      return;
    }

    if (!upRows.length && !downRows.length) return;
    if (upRows.length) {
      let upDisplayRowsFull = upRows.slice().reverse();
      renderRows(boxPrimary, upDisplayRowsFull);
      applyWidth(boxPrimary, anchor.width, upDisplayRowsFull);
      setBoxShown(boxPrimary, true);
      placeBox(boxPrimary, anchor, "up");
    }
    if (downRows.length) {
      renderRows(boxSecondary, downRows);
      applyWidth(boxSecondary, anchor.width, downRows);
      setBoxShown(boxSecondary, true);
      placeBox(boxSecondary, anchor, "down");
    }
  }

  /**
   * Снять коробку со страницы (Д-4, У-32). Уборка: узла может уже не быть —
   * коробки на экране нет в любом случае.
   */
  function dropBox(target) {
    try {
      if (target && target.root && target.root.parentNode) {
        target.root.parentNode.removeChild(target.root);
      }
    } catch (_) {
      /* Уборка: узла может уже не быть. */
    }
  }

  function destroy() {
    lastPayload = null;
    listenTo(null);
    dropBox(boxPrimary);
    dropBox(boxSecondary);
  }

  return {
    update: update,
    /* Спрятанное панелью прокрутка не возвращает: последний вызов забыт. */
    hide: function() { lastPayload = null; hide(); },
    destroy: destroy,
  };
}

module.exports = {
  createTagWheelScrollerOverlay: createTagWheelScrollerOverlay,
};
