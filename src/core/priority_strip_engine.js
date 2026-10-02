"use strict";

const __sharedUtils = require("./shared_utils.js");

function clampInt(value, fallback, min, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readListMeta(text) {
  const src = String(text || "");
  const m = src.match(/^(\s*)(?:[-*+]\s+|\d+\.\s+)(?:\[[^\]]\]\s+)?/);
  if (!m) return { isList: false, indent: 0 };
  return { isList: true, indent: String(m[1] || "").length };
}

function detectOwnMatch(text, tokenSet, readRowForToken) {
  const src = String(text || "");
  const rx = __sharedUtils.tagTokenScanner();
  let m;
  while ((m = rx.exec(src)) !== null) {
    const token = String(m[0] || "").trim();
    if (!token || !tokenSet.has(token)) continue;
    const row = typeof readRowForToken === "function" ? readRowForToken(token) : null;
    const fill = row && row.fillColor ? String(row.fillColor || "").trim() : "";
    return {
      token,
      color: fill || "var(--interactive-accent)",
      index: Number(m.index || 0),
    };
  }
  return null;
}

/**
 * Рельсы строки: по уровням цепочки, не больше `Number of Bars` (PRD 10.13.21 Б1).
 * Дорожка — уровень в дереве, а не номер полосы (H1, M1, B22): уровень без
 * значения дорожку занимает, но не красит, иначе полоса внучатой строки съедет
 * на дорожку дочерней. Хвостовые пустые дорожки не рисуются.
 */
function buildRailsDefault(chain, stripesToShow) {
  const levels = Array.isArray(chain) ? chain.slice(0) : [];
  if (!levels.length) return [];
  const maxN = Math.max(1, Math.min(3, Number(stripesToShow || 2)));
  const n = Math.min(maxN, levels.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const src = levels[i] || {};
    out.push({ role: "inherit", color: src.color || "" });
  }
  while (out.length && !String(out[out.length - 1].color || "").trim()) out.pop();
  return out;
}

/** То же правило про число рельсов, что в `buildRailsDefault` (Б1). */
function buildRailsCrossing(chain, stripesToShow) {
  const levels = Array.isArray(chain) ? chain.slice(0) : [];
  if (!levels.length) return [];
  const maxN = Math.max(1, Math.min(3, Number(stripesToShow || 2)));
  const n = Math.min(maxN, levels.length);
  const parent = levels[0];
  const deepest = levels[levels.length - 1];
  if (n === 1) return [{ role: "parent", color: parent && parent.color || "" }].filter((r) => r.color);
  if (n === 2) {
    return [
      { role: "parent", color: parent && parent.color || "" },
      { role: "child", color: deepest && deepest.color || "" },
    ].filter((r) => r.color);
  }
  const prev = levels[levels.length - 2] || deepest;
  return [
    { role: "parent", color: parent && parent.color || "" },
    { role: "child", color: prev && prev.color || "" },
    { role: "grandchild", color: deepest && deepest.color || "" },
  ].filter((r) => r.color);
}

function buildStripSpecs(lines, options) {
  const src = Array.isArray(lines) ? lines : [];
  const tokenSet = options && options.tokenSet instanceof Set ? options.tokenSet : new Set();
  const readRowForToken = options && typeof options.readRowForToken === "function"
    ? options.readRowForToken
    : null;
  const isHardBoundary = options && typeof options.isHardBoundary === "function"
    ? options.isHardBoundary
    : (text) => !String(text || "").trim();
  const stripMode = options && String(options.mode || "default").trim().toLowerCase() === "crossing"
    ? "crossing"
    : "default";
  const stripesToShow = clampInt(options && options.stripesToShow, 2, 1, 3);
  /* `Draw bars for the whole tree` (PRD 10.13.21 Б5): вкл — полоса на всё поддерево,
   * выкл — только своя строка. Умолчание вкл (У-57). */
  const drawWholeTree = !(options && options.drawWholeTree === false);

  const stack = [];
  const out = [];

  for (let i = 0; i < src.length; i++) {
    const row = src[i] || {};
    const lineNo = Number(row.lineNo || 0);
    const text = String(row.text || "");
    if (!lineNo) continue;

    if (isHardBoundary(text)) {
      stack.length = 0;
      continue;
    }

    const listMeta = readListMeta(text);
    const own = detectOwnMatch(text, tokenSet, readRowForToken);
    if (!listMeta.isList) {
      stack.length = 0;
      if (!own) continue;
      const levelChain = [{ color: own.color, token: own.token }];
      const depthFromRoot = 0;
      const effectiveStripes = Math.max(1, Math.min(stripesToShow, depthFromRoot + 1));
      const rails = stripMode === "crossing"
        ? buildRailsCrossing(levelChain, effectiveStripes)
        : buildRailsDefault(levelChain, effectiveStripes);
      for (let r = 0; r < rails.length; r++) rails[r].role = "own";
      out.push({
        lineNo,
        indent: 0,
        depthFromRoot,
        effectiveStripes,
        mode: "standalone-own",
        ownToken: own.token,
        ownColor: own.color,
        inheritColor: "",
        rails,
      });
      continue;
    }

    while (stack.length && listMeta.indent <= stack[stack.length - 1].indent) stack.pop();

    /* Уровень занимает каждая строка списка, со значением или без (M1, B22, У-32). */
    const ancestors = stack.slice(0);
    const depthFromRoot = ancestors.length;
    stack.push({
      indent: listMeta.indent,
      color: own && own.color ? own.color : "",
      token: own ? own.token : "",
      depthFromRoot,
    });

    /* Наследуется цвет ближайшего сверху уровня, у которого он есть: уровень
       без значения дорожку занимает, но не красит. */
    let inherited = null;
    if (drawWholeTree) {
      for (let j = ancestors.length - 1; j >= 0; j--) {
        if (ancestors[j] && String(ancestors[j].color || "").trim()) {
          inherited = ancestors[j];
          break;
        }
      }
    }
    if (!own && !inherited) continue;
    const effectiveStripes = Math.max(1, Math.min(stripesToShow, depthFromRoot + 1));

    const spec = {
      lineNo,
      indent: listMeta.indent,
      depthFromRoot,
      effectiveStripes,
      mode: own
        ? (inherited ? "list-own+inherit" : "list-own")
        : "list-inherit",
      ownToken: own ? own.token : "",
      ownColor: own ? own.color : "",
      inheritColor: inherited ? inherited.color : "",
      rails: [],
    };

    /* Цепочка: по уровню на каждый уровень дерева, пустой цвет — пустой рельс.
     * `crossing` («Lanes rotate») собирает только окрашенные уровни, верхний снаружи. */
    const levelChain = [];
    if (drawWholeTree) {
      for (let j = 0; j < ancestors.length; j++) {
        const lv = ancestors[j] || {};
        if (stripMode === "crossing") {
          if (lv.color) levelChain.push({ color: lv.color, token: lv.token || "" });
        } else {
          levelChain.push({ color: lv.color || "", token: lv.token || "" });
        }
      }
    }
    if (stripMode === "crossing") {
      if (own && own.color) levelChain.push({ color: own.color, token: own.token || "" });
    } else {
      levelChain.push({ color: own && own.color ? own.color : "", token: own ? own.token : "" });
    }
    spec.rails = stripMode === "crossing"
      ? buildRailsCrossing(levelChain, effectiveStripes)
      : buildRailsDefault(levelChain, effectiveStripes);
    /* Роль рельса решается здесь одним местом (У-32): `default` — дорожка своего
     * уровня, `crossing` — самый глубокий рельс. */
    for (let r = 0; r < spec.rails.length; r++) spec.rails[r].role = "inherit";
    if (own && own.color && spec.rails.length) {
      const ownLane = stripMode === "crossing"
        ? spec.rails.length - 1
        : Math.min(depthFromRoot, spec.rails.length - 1);
      if (stripMode === "crossing" || depthFromRoot < spec.rails.length) {
        spec.rails[ownLane].role = "own";
      }
    }
    out.push(spec);
  }

  markTreeRuns(out);
  return out;
}

/**
 * Пометить строки, чья полоса продолжается в соседнюю строку дерева (PRD
 * 10.13.16 Н4): у дерева зазор не нужен. Помечается наследник и тот, у кого
 * наследуют; пометка одна на строку (Н5).
 */
function markTreeRuns(specs) {
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    if (!spec) continue;
    const inherits = spec.mode === "list-inherit" || spec.mode === "list-own+inherit";
    if (inherits) spec.joinsAbove = true;
    const next = specs[i + 1];
    const nextInherits = next
      && (next.mode === "list-inherit" || next.mode === "list-own+inherit")
      && Number(next.lineNo || 0) === Number(spec.lineNo || 0) + 1
      && Number(next.depthFromRoot || 0) > Number(spec.depthFromRoot || 0);
    if (nextInherits) {
      spec.joinsBelow = true;
      next.joinsAbove = true;
    }
    spec.inTree = Boolean(spec.joinsAbove || spec.joinsBelow);
  }
  return specs;
}

function normalizeStripConfig(strip) {
  const src = strip && typeof strip === "object" ? strip : {};
  const modeRaw = String(src.mode || "default").trim().toLowerCase();
  const mode = modeRaw === "crossing" ? "crossing" : "default";
  return {
    active: src.active === true,
    fieldId: String(src.fieldId || "").trim(),
    tagVisibility: src.tagVisibility !== false,
    hideSeparatorWhenOnlyStripToken: src.hideSeparatorWhenOnlyStripToken === true,
    mode,
    stripesToShow: clampInt(src.stripesToShow, 2, 1, 3),
    thickness: clampInt(src.thickness, 2, 1, 12),
    spacing: clampInt(src.spacing, 20, 8, 48),
    childOffset: clampInt(src.childOffset, 12, 2, 20),
    /* Зазор полосы и слитное дерево (PRD 10.13.16); 0 — полосы стыкуются. */
    lineGap: clampInt(src.lineGap, 2, 0, 8),
    joinTree: src.joinTree !== false,
    /* Полоса идёт по всему поддереву или только по своей строке (10.13.21). */
    drawWholeTree: src.drawWholeTree !== false,
  };
}

module.exports = {
  buildStripSpecs,
  normalizeStripConfig,
  /* Одно объявление на движок полос и адаптер CM6 (PRD 10.13.133). */
  clampInt,
};
