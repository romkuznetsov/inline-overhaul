"use strict";

function clampInt(value, fallback, min, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function modeClass(mode) {
  const src = String(mode || "").trim();
  if (src === "standalone-own") return "io-strip-mode-standalone-own";
  if (src === "list-own") return "io-strip-mode-list-own";
  if (src === "list-inherit") return "io-strip-mode-list-inherit";
  if (src === "list-own+inherit") return "io-strip-mode-list-own-inherit";
  return "io-strip-mode-unknown";
}

function buildStripLineStyle(spec, stripCfg) {
  const s = stripCfg && typeof stripCfg === "object" ? stripCfg : {};
  const thickness = clampInt(s.thickness, 2, 1, 12);
  const spacing = clampInt(s.spacing, 20, 8, 48);
  const childOffset = clampInt(s.childOffset, 12, 2, 20);
  const rails = Array.isArray(spec && spec.rails) ? spec.rails : [];
  if (!rails.length) return "";
  const railBase = Math.max(2, thickness);
  const colors = [];
  for (let i = 0; i < Math.min(3, rails.length); i++) {
    const r = rails[i] || {};
    const color = String(r.color || "").trim();
    colors.push(color || "transparent");
  }
  while (colors.length < 3) colors.push("transparent");
  const x1 = spacing + railBase;
  const x2 = x1 + childOffset;
  const x3 = x2 + childOffset;
  const gutterInset = Math.max(16, x3 + thickness + 6);
  const shadow2 = `${childOffset}px 0 0 0 ${colors[1]}`;
  const shadow3 = `${childOffset * 2}px 0 0 0 ${colors[2]}`;
  /*
   * Зазор сверху и снизу полосы (PRD 10.13.16). Слитное дерево снимает его у
   * строки, чья полоса продолжается в соседнюю строку дерева: признак ставит
   * движок (`markTreeRuns`), вёрстка его только читает.
   *
   * Число уходит переменной, а не литералом в стилях: то же значение читает
   * предпросмотр полос, и два объявления одного правила разошлись бы (У-32).
   */
  const lineGap = clampInt(s.lineGap, 2, 0, 8);
  const joinTree = s.joinTree !== false;
  const gap = joinTree && spec && spec.inTree ? 0 : lineGap;
  return [
    `--io-strip-line-gap:${gap}px`,
    `--io-strip-thickness:${thickness}px`,
    `--io-strip-gap:${Math.max(2, childOffset)}px`,
    `--io-strip-spacing:${spacing}px`,
    `--io-strip-gutter-inset:${gutterInset}px`,
    `--io-strip-x1:${x1}px`,
    `--io-strip-x2:${x2}px`,
    `--io-strip-x3:${x3}px`,
    `--io-strip-c1:${colors[0]}`,
    `--io-strip-c2:${colors[1]}`,
    `--io-strip-c3:${colors[2]}`,
    `--io-strip-shadow2:${shadow2}`,
    `--io-strip-shadow3:${shadow3}`,
  ].join(";");
}

function buildStripDecorationRanges(specs, view, cmView, stripCfg) {
  const out = [];
  const src = Array.isArray(specs) ? specs : [];
  const lineCfg = stripCfg && typeof stripCfg === "object" ? stripCfg : {};
  for (let i = 0; i < src.length; i++) {
    const spec = src[i] || {};
    const ln = Number(spec.lineNo || 0);
    if (!ln) continue;
    let docLine;
    try {
      docLine = view.state.doc.line(ln);
    } catch (_) {
      continue;
    }
    if (!docLine) continue;
    const style = buildStripLineStyle(spec, lineCfg);
    if (!style) continue;
    const mode = String(spec && spec.mode || "").trim();
    const thickness = clampInt(lineCfg.thickness, 2, 1, 12);
    const spacing = clampInt(lineCfg.spacing, 20, 8, 48);
    const childOffset = clampInt(lineCfg.childOffset, 12, 2, 20);
    const railBase = Math.max(2, thickness);
    const rails = Array.isArray(spec && spec.rails) ? spec.rails : [];
    const x1 = spacing + railBase;
    const cls = ["io-strip-line", modeClass(mode)];
    if (rails.length >= 3) cls.push("io-strip-three-rails");
    else if (rails.length >= 2) cls.push("io-strip-two-rails");
    else cls.push("io-strip-one-rail");
    out.push({
      from: docLine.from,
      to: docLine.from,
      deco: cmView.Decoration.line({
        attributes: {
          class: cls.join(" "),
          style,
        },
      }),
      debug: {
        className: cls.join(" "),
        style,
        laneCount: rails.length,
        laneLefts: rails.map((_, idx) => x1 + (childOffset * idx)),
        gutterInset: Math.max(16, x1 + (childOffset * Math.max(0, rails.length - 1)) + thickness + 6),
      },
    });
  }
  return out;
}

module.exports = {
  buildStripLineStyle,
  buildStripDecorationRanges,
};
