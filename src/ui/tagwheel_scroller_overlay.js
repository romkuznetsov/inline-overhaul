"use strict";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeDirection(raw) {
  var d = String(raw || "").trim().toLowerCase();
  if (d === "up" || d === "down" || d === "full") return d;
  return "full";
}

function normalizeSize(raw) {
  var n = Math.trunc(Number(raw));
  if (!isFinite(n)) return 3;
  return clamp(n, 1, 20);
}

function findActiveTokenRange(controlLine) {
  var line = String(controlLine || "");
  var re = /\*\*\[[\s\S]*?\]\*\*/g;
  var m = re.exec(line);
  if (!m) return null;
  return {
    fromCh: Number(m.index || 0),
    toCh: Number((m.index || 0) + String(m[0] || "").length),
  };
}

function getAnchorRect(editor, lineNumber, controlLine) {
  try {
    if (!editor || typeof editor.posToOffset !== "function") return null;
    var cm = editor.cm;
    if (!cm || typeof cm.coordsAtPos !== "function") return null;
    var activeTokenMatch = String(controlLine || "").match(/\*\*\[([^\]]+)\]\*\*/);
    var activeToken = activeTokenMatch ? String(activeTokenMatch[1] || "").trim() : "";
    var cmDom = cm && cm.dom ? cm.dom : null;
    if (cmDom && typeof cmDom.querySelectorAll === "function") {
      var nodes = cmDom.querySelectorAll(".inline-overhaul-tw-active-anchor");
      if (nodes && nodes.length) {
        var targetY = null;
        try {
          var lineFrom = editor.posToOffset({ line: lineNumber, ch: 0 });
          var lineCoords = cm.coordsAtPos(lineFrom);
          if (lineCoords && isFinite(lineCoords.top)) targetY = Number(lineCoords.top);
        } catch (_) {}
        var best = null;
        var bestScore = Number.POSITIVE_INFINITY;
        var i;
        for (i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (!el || typeof el.getBoundingClientRect !== "function") continue;
          if (activeToken && String(el.textContent || "").trim() !== activeToken) continue;
          var rect = el.getBoundingClientRect();
          if (!rect || !isFinite(rect.left) || !isFinite(rect.top)) continue;
          var cy = (Number(rect.top) + Number(rect.bottom || rect.top)) / 2;
          var score = targetY == null ? i : Math.abs(cy - targetY);
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
    var range = findActiveTokenRange(controlLine);
    if (!range) return null;
    var from = editor.posToOffset({ line: lineNumber, ch: range.fromCh });
    var to = editor.posToOffset({ line: lineNumber, ch: Math.max(range.toCh, range.fromCh + 1) });
    var a = cm.coordsAtPos(from);
    var b = cm.coordsAtPos(to);
    if (!a || !b) return null;
    var left = Math.min(a.left, b.left);
    var right = Math.max(a.right || a.left, b.right || b.left);
    var top = Math.min(a.top, b.top);
    var bottom = Math.max(a.bottom || a.top, b.bottom || b.top);
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

/**
 * Цвет из настроек или пусто. Пустое значение означает «взять у темы», и
 * тогда стиль не задаётся вовсе: подставить сюда свой цвет значило бы решить
 * за тему (PRD 10.13.15 Н2, замечание заказчика D6 от 2026-09-02).
 */
function pickColor(value) {
  var s = String(value == null ? "" : value).trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(s) ? s : "";
}

function createRoot(colors) {
  var c = colors && typeof colors === "object" ? colors : {};
  var root = document.createElement("div");
  root.style.position = "fixed";
  root.style.zIndex = "60";
  root.style.pointerEvents = "none";
  root.style.display = "none";
  root.style.border = "1px solid var(--background-modifier-border)";
  root.style.borderRadius = "8px";
  /* Свой фон, если он задан; иначе — фон поповера темы, как было. */
  root.style.background = c.fill || "var(--background-primary)";
  root.style.boxShadow = "var(--shadow-s)";
  root.style.padding = "4px 0";
  root.style.fontSize = "12px";
  root.style.lineHeight = "1.3";
  root.style.whiteSpace = "nowrap";
  root.style.overflow = "hidden";
  root.style.fontFamily = "var(--font-text)";

  var list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "0";
  root.appendChild(list);
  document.body.appendChild(root);
  return { root: root, list: list, colors: { fill: c.fill || "", text: c.text || "" } };
}

function createTagWheelScrollerOverlay(options) {
  var cfg = options && typeof options === "object" ? options : {};
  var direction = normalizeDirection(cfg.direction);
  var size = normalizeSize(cfg.size);

  /* Цвета приходят настройками; пустые означают «как в теме» (10.13.15). */
  var colors = {
    fill: pickColor(cfg.fillColor),
    text: pickColor(cfg.textColor),
  };
  var boxPrimary = createRoot(colors);
  var boxSecondary = createRoot(colors);

  function hide() {
    boxPrimary.root.style.display = "none";
    boxSecondary.root.style.display = "none";
  }

  function measureLongest(rows) {
    var probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.left = "-99999px";
    probe.style.top = "0";
    probe.style.visibility = "hidden";
    probe.style.fontSize = boxPrimary.root.style.fontSize;
    probe.style.fontFamily = boxPrimary.root.style.fontFamily;
    probe.style.fontWeight = "500";
    document.body.appendChild(probe);
    var maxW = 0;
    var i;
    for (i = 0; i < rows.length; i++) {
      probe.textContent = String(rows[i] || "");
      maxW = Math.max(maxW, Math.ceil(probe.getBoundingClientRect().width));
    }
    document.body.removeChild(probe);
    return maxW;
  }

  /*
   * Строки коробки. Свой цвет текста, если он задан; иначе — цвет темы, как
   * было (10.13.15 Н1, Н2).
   *
   * Текущего значения в коробке нет: она показывает **соседние** значения, а
   * то, в котором человек стоит, нарисовано в самой строке. Поэтому третий
   * цвет, о котором просил заказчик, живёт не здесь, а у панели
   * (`visual.tagWheel.activeTextColor`).
   */
  function renderRows(target, rows) {
    /*
     * Чистка списка — **не через `innerHTML`** (правило каталога Obsidian, Р1
     * списка расхождений, 2026-09-08). Здесь строка и правда пустая, то есть
     * разметку никто не вставляет, — но правило каталога про само свойство, а
     * не про его значение: место, где однажды написали `innerHTML = ""`,
     * рано или поздно получает `innerHTML = что-то`.
     *
     * Правило называет `el.empty()` — помощник, которым Obsidian надстраивает
     * `HTMLElement`. Здесь снятие детей написано вручную, и это не упрямство:
     * коробка создаётся через `document.createElement`, а её проверка гоняется
     * на заглушке DOM, у которой надстройки платформы нет. Заглушка добрее
     * браузера не бывает — но и требовать от неё чужих методов незачем (У-45).
     */
    while (target.list.firstChild) target.list.removeChild(target.list.firstChild);
    var colors = target.colors || {};
    var i;
    for (i = 0; i < rows.length; i++) {
      var item = document.createElement("div");
      item.textContent = String(rows[i] || "-");
      item.style.padding = "2px 8px";
      item.style.overflow = "hidden";
      item.style.textOverflow = "ellipsis";
      item.style.opacity = "0.95";
      if (colors.text) item.style.color = colors.text;
      target.list.appendChild(item);
    }
  }

  function applyWidth(target, anchorWidth, rows) {
    var longestW = measureLongest(rows);
    var minW = Math.max(anchorWidth, longestW + 18);
    var vw = window.innerWidth || 1;
    var finalW = clamp(minW, 40, Math.max(40, vw - 8));
    target.root.style.minWidth = String(Math.round(finalW)) + "px";
    target.root.style.width = String(Math.round(finalW)) + "px";
  }

  function placeBox(target, anchor, mode) {
    var gap = 4;
    var vw = window.innerWidth || 1;
    var vh = window.innerHeight || 1;
    var rect = target.root.getBoundingClientRect();
    var w = Math.ceil(rect.width);
    var h = Math.ceil(rect.height);
    var left = clamp(anchor.left, 4, Math.max(4, vw - w - 4));
    var top = mode === "up"
      ? (anchor.top - h - gap)
      : (anchor.bottom + gap);
    top = clamp(top, 4, Math.max(4, vh - h - 4));
    target.root.style.left = String(Math.round(left)) + "px";
    target.root.style.top = String(Math.round(top)) + "px";
    target.root.style.display = "block";
  }

  function update(payload) {
    var p = payload && typeof payload === "object" ? payload : {};
    var editor = p.editor;
    var lineNumber = Number(p.lineNumber);
    var controlLine = String(p.controlLine || "");
    if (!editor || !isFinite(lineNumber)) {
      hide();
      return;
    }
    var anchor = getAnchorRect(editor, lineNumber, controlLine);
    if (!anchor) {
      hide();
      return;
    }

    var upRows = Array.isArray(p.upItems)
      ? p.upItems.slice(0, size).map(function(x) { return String(x && x.label || "-"); })
      : [];
    var downRows = Array.isArray(p.downItems)
      ? p.downItems.slice(0, size).map(function(x) { return String(x && x.label || "-"); })
      : [];

    hide();

    if (direction === "up") {
      if (!upRows.length) return;
      var upDisplayRows = upRows.slice().reverse();
      renderRows(boxPrimary, upDisplayRows);
      applyWidth(boxPrimary, anchor.width, upDisplayRows);
      boxPrimary.root.style.display = "block";
      placeBox(boxPrimary, anchor, "up");
      return;
    }

    if (direction === "down") {
      if (!downRows.length) return;
      renderRows(boxPrimary, downRows);
      applyWidth(boxPrimary, anchor.width, downRows);
      boxPrimary.root.style.display = "block";
      placeBox(boxPrimary, anchor, "down");
      return;
    }

    if (!upRows.length && !downRows.length) return;
    if (upRows.length) {
      var upDisplayRowsFull = upRows.slice().reverse();
      renderRows(boxPrimary, upDisplayRowsFull);
      applyWidth(boxPrimary, anchor.width, upDisplayRowsFull);
      boxPrimary.root.style.display = "block";
      placeBox(boxPrimary, anchor, "up");
    }
    if (downRows.length) {
      renderRows(boxSecondary, downRows);
      applyWidth(boxSecondary, anchor.width, downRows);
      boxSecondary.root.style.display = "block";
      placeBox(boxSecondary, anchor, "down");
    }
  }

  function destroy() {
    try {
      if (boxPrimary.root && boxPrimary.root.parentNode) boxPrimary.root.parentNode.removeChild(boxPrimary.root);
    } catch (_) {}
    try {
      if (boxSecondary.root && boxSecondary.root.parentNode) boxSecondary.root.parentNode.removeChild(boxSecondary.root);
    } catch (_) {}
  }

  return {
    update: update,
    hide: hide,
    destroy: destroy,
  };
}

module.exports = {
  createTagWheelScrollerOverlay: createTagWheelScrollerOverlay,
};
