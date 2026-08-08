"use strict";

function clampInt(value, fallback, min, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readListMeta(text) {
  const src = String(text || "");
  const m = src.match(/^(\s*)(?:[-*+]\s+|\d+\.\s+)(?:\[[^\]]+\]\s+)?/);
  if (!m) return { isList: false, indent: 0 };
  return { isList: true, indent: String(m[1] || "").length };
}

function detectOwnMatch(text, tokenSet, readRowForToken) {
  const src = String(text || "");
  const rx = /#\S+/g;
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

function buildRailsDefault(chain, stripesToShow) {
  const levels = Array.isArray(chain) ? chain.slice(0) : [];
  if (!levels.length) return [];
  const maxN = Math.max(1, Math.min(3, Number(stripesToShow || 2)));
  const out = [];
  for (let i = 0; i < maxN; i++) {
    const srcIdx = Math.min(i, Math.max(0, levels.length - 1));
    const src = levels[srcIdx] || {};
    out.push({ role: i === 0 ? "parent" : (i === 1 ? "child" : "grandchild"), color: src.color || "" });
  }
  return out.filter((r) => !!String(r.color || "").trim());
}

function buildRailsCrossing(chain, stripesToShow) {
  const levels = Array.isArray(chain) ? chain.slice(0) : [];
  if (!levels.length) return [];
  const maxN = Math.max(1, Math.min(3, Number(stripesToShow || 2)));
  if (maxN === 1) return [{ role: "parent", color: levels[0].color || "" }].filter((r) => r.color);
  if (maxN === 2) {
    const parent = levels[0];
    const deepest = levels[Math.max(0, levels.length - 1)];
    return [
      { role: "parent", color: parent && parent.color || "" },
      { role: "child", color: deepest && deepest.color || "" },
    ].filter((r) => r.color);
  }
  const parent = levels[0];
  const deepest = levels[Math.max(0, levels.length - 1)];
  const prev = levels[Math.max(1, levels.length - 2)] || deepest;
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

    const inherited = stack.length ? stack[stack.length - 1] : null;
    if (!own && !inherited) continue;
    const depthFromRoot = inherited ? (Number(inherited.depthFromRoot || 0) + 1) : 0;
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

    const levelChain = [];
    for (let j = 0; j < stack.length; j++) {
      const lv = stack[j] || {};
      if (lv.color) levelChain.push({ color: lv.color, token: lv.token || "" });
    }
    if (own && own.color) levelChain.push({ color: own.color, token: own.token || "" });
    spec.rails = stripMode === "crossing"
      ? buildRailsCrossing(levelChain, effectiveStripes)
      : buildRailsDefault(levelChain, effectiveStripes);
    if (spec.mode === "list-inherit" && spec.rails.length > 1) {
      spec.rails = [spec.rails[0]];
    }
    if (spec.mode === "list-inherit") {
      if (spec.rails[0]) spec.rails[0].role = "inherit";
    } else if (spec.mode === "list-own") {
      if (spec.rails[0]) spec.rails[0].role = "own";
    } else if (spec.mode === "list-own+inherit") {
      if (spec.rails[0]) spec.rails[0].role = "inherit";
      if (spec.rails[1]) spec.rails[1].role = "own";
      for (let r = 2; r < spec.rails.length; r++) spec.rails[r].role = "own";
    }
    out.push(spec);

    if (own && own.color) {
      stack.push({ indent: listMeta.indent, color: own.color, token: own.token, depthFromRoot });
    }
  }

  return out;
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
  };
}

module.exports = {
  buildStripSpecs,
  normalizeStripConfig,
};
