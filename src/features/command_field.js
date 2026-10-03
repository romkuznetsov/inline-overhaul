"use strict";

/**
 * Command Field (постановка `test-vault/command-field.md`, разбор и ответы
 * В-272…В-283): реестр категорий и их действия над строками заметки — этап 1
 * Коллауты и Очистка, этап 2 Вставка блока и Дерево ↔ раздел.
 * Чистые функции: на входе строки документа и место каретки, на выходе одна
 * замена отрезка строк — одна транзакция, один шаг `Ctrl+Z` (R-1). `null` —
 * менять нечего, шага отмены нет.
 *
 * Замена: `{ from, to, lines, cursor: { line, ch } }` — строки `from..to`
 * включительно заменяются на `lines`.
 */

const __transform = require("./transform_feature.js");
const __lineFinalize = require("../core/pkm_line_finalize_unified.js");
const __sayModule = require("../core/say.js");
const __sharedUtils = require("../core/shared_utils.js");

/* ---- Коллауты (6.1) ------------------------------------------------------ */

const CALLOUT_HEAD_RE = /^((?:[\t ]*>[\t ]?)+)\[!([^\]\s]+)\]([+-]?)(?:[\t ]+(.*))?$/;
const QUOTE_RE = /^(?:[\t ]*>[\t ]?)+/;

/** Сколько уровней цитаты у строки. */
function quoteDepth(line) {
  const m = String(line || "").match(QUOTE_RE);
  return m ? (m[0].match(/>/g) || []).length : 0;
}

/** Снять один уровень цитаты — `depth`-й знак `>` с пробелом за ним. */
function stripQuoteLevel(line, depth) {
  const src = String(line || "");
  let seen = 0;
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== ">") {
      if (src[i] === " " || src[i] === "\t") continue;
      break;
    }
    seen += 1;
    if (seen === depth) {
      const end = src[i + 1] === " " ? i + 2 : i + 1;
      return src.slice(0, i) + src.slice(end);
    }
  }
  return src;
}

function indentWidth(line) {
  const m = String(line || "").match(/^[\t ]*/);
  let n = 0;
  for (const c of m ? m[0] : "") n += c === "\t" ? 4 : 1;
  return n;
}

/**
 * Самый внутренний коллаут, в котором стоит каретка (6.1, «вложенный»):
 * `{ head, end, depth, type, fold, title }` или `null`.
 */
function calloutAt(lines, at) {
  const depthHere = quoteDepth(lines[at]);
  if (!depthHere) return null;
  let floor = depthHere;
  for (let i = at; i >= 0; i--) {
    const d = quoteDepth(lines[i]);
    if (!d) return null;
    floor = Math.min(floor, d);
    const m = String(lines[i]).match(CALLOUT_HEAD_RE);
    if (m && d <= floor) {
      let end = i;
      while (end + 1 < lines.length && quoteDepth(lines[end + 1]) >= d) end += 1;
      return { head: i, end, depth: d, quote: m[1], type: m[2], fold: m[3] || "", title: m[4] || "" };
    }
  }
  return null;
}

/** Строка и её дерево: потомки — строки глубже по отступу; пустые — только внутри. */
function treeEnd(lines, at) {
  const base = indentWidth(lines[at]);
  let end = at;
  for (let i = at + 1; i < lines.length; i++) {
    const s = String(lines[i]);
    if (!s.trim()) continue;
    if (indentWidth(s) > base) { end = i; continue; }
    break;
  }
  return end;
}

function calloutHead(quote, preset, title) {
  const fold = preset.fold === "+" || preset.fold === "-" ? preset.fold : "";
  return `${quote}[!${preset.type}]${fold}${title ? " " + title : ""}`;
}

/** Какой пресет стоит: первый совпавший по типу и свёрнутости (В-281, клон — первый). */
function calloutPresetIndex(presets, box) {
  return presets.findIndex((p) => String(p.type).toLowerCase() === box.type.toLowerCase()
    && (p.fold || "") === box.fold);
}

function wrapCallout(lines, from, to, preset, cursor) {
  const body = [];
  for (let i = from; i <= to; i++) body.push(lines[i] === "" ? ">" : "> " + lines[i]);
  const out = [calloutHead("> ", preset, "")].concat(body);
  const line = cursor.line + 1;
  const ch = (lines[cursor.line] === "" ? 1 : cursor.ch + 2);
  return { from, to, lines: out, cursor: { line, ch } };
}

/** Снятие: строка `[!type]` уходит, у тела снимается один уровень `>` (6.1, ручной коллаут). */
function unwrapCallout(lines, box, cursor) {
  const out = [];
  for (let i = box.head + 1; i <= box.end; i++) out.push(stripQuoteLevel(lines[i], box.depth));
  /* Коллаут без тела снимается в пустую строку своего уровня. */
  if (!out.length) out.push(stripQuoteLevel(box.quote, box.depth).trimEnd());
  if (cursor.line <= box.head) return { from: box.head, to: box.end, lines: out, cursor: { line: box.head, ch: 0 } };
  const shift = String(lines[cursor.line]).length - out[cursor.line - box.head - 1].length;
  return { from: box.head, to: box.end, lines: out, cursor: { line: cursor.line - 1, ch: Math.max(0, cursor.ch - shift) } };
}

/** Смена пресета: только тип и свёрнутость, заголовок как есть (В-273). */
function recastCallout(lines, box, preset, cursor) {
  const head = calloutHead(box.quote, preset, box.title);
  const ch = cursor.line === box.head ? Math.min(cursor.ch, head.length) : cursor.ch;
  return { from: box.head, to: box.head, lines: [head], cursor: { line: cursor.line, ch } };
}

/* Типы коллаутов Obsidian — выбор пресета в панели (6.1). */
const CALLOUT_TYPES = ["note", "abstract", "info", "todo", "tip", "success", "question", "warning", "failure", "danger", "bug", "example", "quote"];

/** Вне коллаута: пустая строка — пустой коллаут, строка — с деревом, выделение — по строкам (6.1). */
function wrapWith(ctx, preset) {
  const { lines, cursor } = ctx;
  const sel = ctx.selection;
  if (sel && sel.from !== sel.to) return wrapCallout(lines, sel.from, sel.to, preset, cursor);
  if (lines[cursor.line].trim() === "") {
    return { from: cursor.line, to: cursor.line, lines: [calloutHead("> ", preset, ""), "> "], cursor: { line: cursor.line + 1, ch: 2 } };
  }
  return wrapCallout(lines, cursor.line, treeEnd(lines, cursor.line), preset, cursor);
}

const callouts = {
  id: "callouts",
  /* Его слово (пункт «Новое» 2026-10-03): `Callouts` → `Insert callout`; callout — слово Obsidian, со строчной (Р9). */
  name: "Insert callout",
  /* Контролы пресета в панели — по роду параметра, без правок UI (4.3). */
  params: ["callout-type", "fold"],
  /** Имя по умолчанию — из параметров (4.1): `Note · folded`. */
  defaultName(p) {
    const t = String(p.type || "note");
    return t.charAt(0).toUpperCase() + t.slice(1) + (p.fold === "-" ? " · closed" : "");
  },
  /** Что делает пресет неотличимым на тексте (В-281). */
  signature: (p) => String(p.type || "").toLowerCase() + "|" + (p.fold || ""),
  defaults: [
    { name: "Note", type: "note", fold: "" },
    { name: "Tip", type: "tip", fold: "" },
    { name: "Warning", type: "warning", fold: "" },
  ],
  hasRevert: true,
  /**
   * Каретка в коллауте — какой пресет стоит (его `💬` к тесту 1 цикла 125):
   * номер в `presets`, первый совпавший (В-281); `-1` — не в коллауте или тип чужой.
   */
  recognize(ctx, presets) {
    const box = calloutAt(ctx.lines, ctx.cursor.line);
    if (!box) return -1;
    return presets.findIndex((p) => p && !p.hidden && callouts.signature(p) === box.type.toLowerCase() + "|" + box.fold);
  },
  /** Пустое значение в tagWheel — коллаута нет: снять тот, в котором каретка; вне — менять нечего. */
  revert(ctx) {
    const box = calloutAt(ctx.lines, ctx.cursor.line);
    return box ? unwrapCallout(ctx.lines, box, ctx.cursor) : null;
  },
  /** Выбран в tagWheel (4.5): вне коллаута — обернуть, внутри — сменить тип; тот же — менять нечего. */
  apply(ctx, preset) {
    const box = calloutAt(ctx.lines, ctx.cursor.line);
    if (!box) return wrapWith(ctx, preset);
    if (callouts.signature(preset) === box.type.toLowerCase() + "|" + box.fold) return null;
    return recastCallout(ctx.lines, box, preset, ctx.cursor);
  },
  /**
   * `step`: +1 — `next`, −1 — `previous`. Вне коллаута `next` ставит первый
   * пресет, `previous` — последний; внутри — цикл 0 → 1 → … → n → 0 (4.4).
   */
  run(ctx, presets, step) {
    /* Совпавший клон в круге не участвует: на тексте он неотличим, шаг на него застрял бы (В-281). */
    const seen = new Set();
    const list = presets.filter((p) => {
      if (!p || p.hidden || seen.has(callouts.signature(p))) return false;
      seen.add(callouts.signature(p));
      return true;
    });
    if (!list.length) return null;
    const { lines, cursor } = ctx;
    const box = calloutAt(lines, cursor.line);
    if (!box) return wrapWith(ctx, step < 0 ? list[list.length - 1] : list[0]);
    const index = calloutPresetIndex(list, box);
    /* Тип не из пресетов — как вне цикла: `next` первый, `previous` последний. */
    const next = index < 0 ? (step < 0 ? list.length - 1 : 0) : index + step;
    if (next < 0 || next >= list.length) return unwrapCallout(lines, box, cursor);
    return recastCallout(lines, box, list[next], cursor);
  },
};

/* ---- Очистка (6.2) ------------------------------------------------------- */

/** Очистка одной строки дорогой Transform (В-274): уборка Values, затем приставка. */
function cleanLine(line, cfg, keep) {
  /* В коллауте разбор не видит приставку за `> ` — чистится строка без цитаты (его пункт «Новое» 2026-10-03). */
  const quote = (String(line).match(QUOTE_RE) || [""])[0];
  if (quote) return quote + cleanLine(String(line).slice(quote.length), cfg, keep);
  const parsed = __transform.parseInlineLine(line, cfg);
  const tctx = __transform.buildTransformContext(parsed, cfg);
  if (!tctx || !Array.isArray(tctx.matches) || !tctx.matches.length) return line;
  const separators = __transform.resolveIoSeparators(cfg);
  const plan = __transform.planSourceCleanup(line, tctx, keep, separators);
  return __transform.applySourcePrefixResolution(plan.line, line, tctx, keep, cfg, __lineFinalize);
}

const cleanup = {
  id: "cleanup",
  name: "Cleanup",
  params: ["fields"],
  /* `fieldName` — видимое имя Field по ключу, его знает панель. */
  defaultName(p, fieldName) {
    const kept = (Array.isArray(p.keep) ? p.keep : []).map((k) => (fieldName ? fieldName(k) : k));
    return kept.length ? "Keep " + kept.join(", ") : "Clear all";
  },
  signature: (p) => (Array.isArray(p.keep) ? p.keep : []).slice().sort().join(","),
  defaults: [{ name: "", keep: [] }],
  hasRevert: false,
  apply(ctx, preset) { return cleanup.run(ctx, [{ ...preset, hidden: false }], 1); },
  /** Обратного нет: `next` ставит первый видимый пресет, `previous` — последний (В-276). */
  run(ctx, presets, step) {
    const list = presets.filter((p) => p && !p.hidden);
    if (!list.length) return null;
    const preset = step < 0 ? list[list.length - 1] : list[0];
    const keep = Array.isArray(preset.keep) ? preset.keep : [];
    const { lines, cursor } = ctx;
    const sel = ctx.selection;
    const from = sel ? sel.from : cursor.line;
    const to = sel ? sel.to : cursor.line;
    const out = [];
    let changed = false;
    for (let i = from; i <= to; i++) {
      const next = cleanLine(lines[i], ctx.cfg, keep);
      if (next !== lines[i]) changed = true;
      out.push(next);
    }
    /* Строка без Values не меняется и шага отмены не заводит (6.2). */
    if (!changed) return null;
    const ch = Math.min(cursor.ch, out[cursor.line - from].length);
    return { from, to, lines: out, cursor: { line: cursor.line, ch } };
  },
};

/* ---- Вставка блока (6.3) ------------------------------------------------- */

const HEADING_RE = /^(#{1,6})[\t ]+(.*?)[\t ]*#*[\t ]*$/;

/**
 * Обёртка пресета — одна из трёх (его `💬` к тесту 6 цикла 126): `plain`,
 * `heading`, `callout`. Пресет прежней формы — по флагам, коллаут старше.
 */
function blockMode(p) {
  if (p.mode === "plain" || p.mode === "heading" || p.mode === "callout") return p.mode;
  return p.callout ? "callout" : p.heading ? "heading" : "plain";
}

/** Уровень заголовка: `"1"`…`"6"` или `auto` — на один глубже заголовка выше, как у раздела (6.4). */
function blockLevel(p) {
  const n = Math.trunc(Number(p.level != null ? p.level : p.headingLevel));
  return n >= 1 && n <= 6 ? String(n) : "auto";
}

/** Уровень заголовка пресета на строке `at`. */
function levelAt(lines, at, p) {
  return sectionLevel(lines, fenceMask(lines), at, { level: blockLevel(p) });
}

function blockBody(p) {
  return String(p.content || "").replace(/\r/g, "").split("\n");
}

/** Строка обёртки: заголовок уровня `level` или `[!type]`; у `plain` — никакой. */
function blockWrap(p, level) {
  const mode = blockMode(p);
  const heading = String(p.headingText || "").trim();
  if (mode === "heading" && heading) return ["#".repeat(level) + " " + heading];
  if (mode === "callout") return [calloutHead("> ", { type: p.type || "note", fold: p.fold }, String(p.title || "").trim())];
  return [];
}

/** Строки, которые вставляет пресет: обёртка и содержимое (6.3). */
function blockLines(p, level) {
  const body = blockBody(p);
  return blockWrap(p, level).concat(blockMode(p) === "callout" ? body.map((l) => (l ? "> " + l : ">")) : body);
}

/**
 * Вставленный блок пресета, в котором стоит каретка: узнаётся обёрткой и первой
 * строкой содержимого, правки внутри не мешают (6.3). `{ from, to, extras }`,
 * `extras` — дописанные строки (в порядке, без `> `) или `null`. Заголовок `auto`
 * узнаётся на любом уровне.
 */
function blockAt(lines, at, p) {
  const body = blockBody(p);
  const callout = blockMode(p) === "callout";
  for (let s = at; s >= 0; s--) {
    const own = String(lines[s]).match(/^(#{1,6})[\t ]/);
    const level = blockLevel(p) === "auto" && own ? own[1].length : Number(blockLevel(p)) || 1;
    const built = blockLines(p, level);
    const wrapN = blockWrap(p, level).length;
    if (built.slice(0, wrapN + 1).some((l, i) => lines[s + i] !== l)) continue;
    let end = s + wrapN;
    if (callout) {
      while (end + 1 < lines.length && quoteDepth(lines[end + 1]) >= 1) end += 1;
    } else if (body.length > 1) {
      const last = body[body.length - 1];
      let k = s + wrapN + 1;
      while (k < lines.length && lines[k] !== last) k += 1;
      end = k < lines.length ? k : Math.min(lines.length - 1, s + built.length - 1);
    }
    if (at > end) continue;
    /* Дописанное — то, что не легло на содержимое пресета по порядку. */
    const extras = [];
    let j = 0;
    for (let i = s + wrapN; i <= end; i++) {
      const l = callout ? stripQuoteLevel(lines[i], 1) : String(lines[i]);
      if (j < body.length && l === body[j]) j += 1;
      else extras.push(l);
    }
    return { from: s, to: end, extras };
  }
  return null;
}

/**
 * Блок какого из пресетов под кареткой: `{ index, box }` или `null`. Пресет без
 * обёртки узнаётся и внутри пресета с ней — берётся охватывающий.
 */
function blockOf(lines, at, presets) {
  let best = null;
  presets.forEach((p, index) => {
    if (!p || p.hidden) return;
    const box = blockAt(lines, at, p);
    if (box && (!best || box.from < best.box.from)) best = { index, box };
  });
  return best;
}

/** Снятие (его ответ 10): обёртка и строки пресета уходят, дописанное остаётся текстом. */
function unwrapBlock(box) {
  const out = box.extras.length ? box.extras : [""];
  return { from: box.from, to: box.to, lines: out, cursor: { line: box.from, ch: 0 } };
}

/** Смена пресета: блок другого пресета на том же месте, дописанное — следом. */
function recastBlock(lines, box, preset) {
  const out = blockLines(preset, levelAt(lines, box.from, preset)).concat(box.extras);
  return { from: box.from, to: box.to, lines: out, cursor: { line: box.from, ch: 0 } };
}

/** Новый блок — только на пустой строке и без такого же заголовка в заметке (6.3, предусловия). */
function insertBlock(ctx, preset) {
  const { lines, cursor } = ctx;
  if (String(lines[cursor.line]).trim() !== "") return { refuse: "block-not-empty" };
  const heading = String(preset.headingText || "").trim();
  if (blockMode(preset) === "heading" && heading && lines.some((l) => {
    const m = String(l).match(HEADING_RE);
    return m && m[2].trim() === heading;
  })) return { refuse: "block-heading-exists", args: [heading] };
  const out = blockLines(preset, levelAt(lines, cursor.line, preset));
  return { from: cursor.line, to: cursor.line, lines: out, cursor: { line: cursor.line + out.length - 1, ch: out[out.length - 1].length } };
}

/** Что делает пресет неотличимым на тексте (В-281): режим, содержимое и настройки своей обёртки. */
function blockSignature(p) {
  const mode = blockMode(p);
  const wrap = mode === "heading" ? [String(p.headingText || "").trim(), blockLevel(p)]
    : mode === "callout" ? [String(p.type || "note").toLowerCase(), p.fold || "", String(p.title || "").trim()] : [];
  return JSON.stringify([mode, String(p.content || "")].concat(wrap));
}

const insertBlockCategory = {
  id: "block",
  /* Имя — его слово (пункт «Новое» 2026-10-03): `Insert block` → `Insert codeblock`. */
  name: "Insert codeblock",
  params: ["block-content", "block-mode", "block-wrap"],
  defaultName(p) {
    const mode = blockMode(p);
    const first = blockBody(p).find((l) => l.trim()) || "";
    return String(mode === "heading" && p.headingText || "").trim() || String(mode === "callout" && p.title || "").trim()
      || first.trim().slice(0, 24) || "Block";
  },
  signature: blockSignature,
  /* Пример постановки 6.3 — оглавление стороннего плагина; обёртка одна, заголовок на уровень ниже заголовка выше. */
  defaults: [{ name: "Contents", content: "```table-of-contents\n```", mode: "heading", headingText: "Contents", level: "auto",
    type: "note", fold: "-", title: "Contents" }],
  hasRevert: true,
  recognize(ctx, presets) {
    const hit = blockOf(ctx.lines, ctx.cursor.line, presets);
    return hit ? hit.index : -1;
  },
  revert(ctx) {
    /* Чей блок — неизвестно: снимается по любому пресету категории, их отдаёт `ctx.presets`. */
    const hit = blockOf(ctx.lines, ctx.cursor.line, ctx.presets || []);
    return hit ? unwrapBlock(hit.box) : null;
  },
  apply(ctx, preset) {
    const hit = blockOf(ctx.lines, ctx.cursor.line, ctx.presets || [preset]);
    if (!hit) return insertBlock(ctx, preset);
    if (blockSignature(ctx.presets[hit.index]) === blockSignature(preset)) return null;
    return recastBlock(ctx.lines, hit.box, preset);
  },
  /** Как у коллаутов (6.3, «перебор»): вне блока `next` — первый, `previous` — последний; внутри — цикл с 0. */
  run(ctx, presets, step) {
    const seen = new Set();
    const list = presets.filter((p) => {
      if (!p || p.hidden || seen.has(insertBlockCategory.signature(p))) return false;
      seen.add(insertBlockCategory.signature(p));
      return true;
    });
    if (!list.length) return null;
    const hit = blockOf(ctx.lines, ctx.cursor.line, list);
    if (!hit) return insertBlock(ctx, step < 0 ? list[list.length - 1] : list[0]);
    const next = hit.index + step;
    if (next < 0 || next >= list.length) return unwrapBlock(hit.box);
    return recastBlock(ctx.lines, hit.box, list[next]);
  },
};

/* ---- Дерево ↔ раздел (6.4) ----------------------------------------------- */

const FENCE_RE = /^[\t ]*(```|~~~)/;
const LIST_RE = /^([\t ]*)(?:[-*+]|\d+[.)])[\t ]+(?:\[.\][\t ]+)?/;

/** Какие строки лежат в блоке кода: заголовок там — текст, а не раздел. */
function fenceMask(lines) {
  const mask = [];
  let open = "";
  for (const l of lines) {
    const m = String(l).match(FENCE_RE);
    if (open) { mask.push(true); if (m && m[1] === open) open = ""; continue; }
    if (m) { open = m[1]; mask.push(true); continue; }
    mask.push(false);
  }
  return mask;
}

function headingAt(lines, mask, i) {
  if (mask[i]) return null;
  const m = String(lines[i]).match(HEADING_RE);
  return m ? { level: m[1].length, text: m[2] } : null;
}

/** Уровень нового раздела (6.4): на один глубже ближайшего заголовка выше, H1 без них, не глубже H6 (его ответ 8). */
function sectionLevel(lines, mask, at, preset) {
  const fixed = Math.trunc(Number(preset.level));
  if (fixed >= 1 && fixed <= 6) return fixed;
  for (let i = at - 1; i >= 0; i--) {
    const h = headingAt(lines, mask, i);
    if (h) return Math.min(6, h.level + 1);
  }
  return 1;
}

/** Строки потомков без одного уровня отступа: тот, что стоит у первого потомка. */
function dedentChildren(lines, from, to, rootIndent) {
  const first = lines.slice(from, to + 1).find((l) => String(l).trim());
  const unit = first ? String(first).match(/^[\t ]*/)[0].slice(rootIndent.length) : "";
  const cut = rootIndent + unit;
  return lines.slice(from, to + 1).map((l) => {
    const s = String(l);
    if (!s.trim()) return "";
    if (s.startsWith(cut)) return s.slice(cut.length);
    return s.replace(/^[\t ]*/, (ws) => ws.slice(Math.min(ws.length, cut.length)));
  });
}

/** Куда встаёт раздел: индекс строки, перед которой он вставляется. */
function sectionTarget(lines, mask, at, end, place) {
  if (place === "in-place") return at;
  if (place === "section-end") {
    let level = 0;
    for (let i = at - 1; i >= 0 && !level; i--) { const h = headingAt(lines, mask, i); if (h) level = h.level; }
    for (let i = end + 1; i < lines.length; i++) {
      const h = headingAt(lines, mask, i);
      if (h && (!level || h.level <= level)) return i;
    }
    return lines.length;
  }
  /* После конца списка: подряд идущие пункты и строки с отступом. */
  let k = end + 1;
  while (k < lines.length && String(lines[k]).trim() && (LIST_RE.test(lines[k]) || /^[\t ]/.test(lines[k]))) k += 1;
  return k;
}

function treeToSection(ctx, preset) {
  const { lines } = ctx;
  const at = ctx.cursor.line;
  const line = String(lines[at]);
  if (!line.trim() || quoteDepth(line)) return null;
  const mask = fenceMask(lines);
  if (mask[at]) return null;
  const end = treeEnd(lines, at);
  const rootIndent = line.match(/^[\t ]*/)[0];
  const text = line.slice(rootIndent.length).replace(LIST_RE, "").trim() || line.trim();
  const level = sectionLevel(lines, mask, at, preset);
  const section = ["#".repeat(level) + " " + text].concat(dedentChildren(lines, at + 1, end, rootIndent).filter((l, i, all) => l || i < all.length - 1));
  const place = String(preset.place || "after-list");
  if (place === "in-place") {
    return { from: at, to: end, lines: section, cursor: { line: at, ch: section[0].length } };
  }
  const target = sectionTarget(lines, mask, at, end, place);
  /* Одна пустая строка до заголовка и после тела раздела (6.4, пустые строки). */
  const middle = lines.slice(end + 1, target);
  while (middle.length && !String(middle[middle.length - 1]).trim()) middle.pop();
  /*
   * Раздел на месте пункта — без пустой строки сверху: над строкой ничего не
   * появляется (его `💬` к тесту 5 цикла 126, «логично и удобно»). Уехал ниже
   * других строк — отделён от них одной пустой.
   */
  const before = middle.length ? [""] : [];
  const after = target < lines.length && String(lines[target]).trim() ? [""] : [];
  const out = middle.concat(before, section, after);
  const to = target - 1 >= at ? target - 1 : at;
  return { from: at, to, lines: out, cursor: { line: at + middle.length + before.length, ch: section[0].length } };
}

/** Приставка пункта из раздела (6.4): маркер выполненной — `- [x]` (его ответ 11), иначе по Prefix Values, иначе `- `. */
function itemPrefix(text, cfg) {
  const marker = String(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.doneMarker && cfg.pkm.behavior.doneMarker.token || "").trim();
  if (marker && new RegExp("(^|\\s)" + __sharedUtils.escapeRe(marker) + "(?=\\s|$)").test(text)) return "- [x] " + text;
  const plain = "- " + text;
  if (!cfg) return plain;
  try {
    const parsed = __transform.parseInlineLine(plain, cfg);
    const tctx = __transform.buildTransformContext(parsed, cfg);
    const ids = (tctx && Array.isArray(tctx.matches) ? tctx.matches : []).map((m) => m.fieldId);
    return __transform.applySourcePrefixResolution(plain, plain, tctx, ids, cfg, __lineFinalize) || plain;
  } catch (_) {
    /* Приставка — украшение: не разобралась строка — обычный пункт, текст человека цел. */
    return plain;
  }
}

/** Раздел под заголовком `h` — пункт списка с деревом; вынесенное копится в `moved`. */
function sectionItems(lines, mask, h, stop, depth, unit, preset, cfg, moved) {
  const head = headingAt(lines, mask, h);
  const out = [unit.repeat(depth) + itemPrefix(head.text, cfg)];
  const child = unit.repeat(depth + 1);
  let i = h + 1;
  while (i < stop) {
    const s = String(lines[i]);
    const sub = headingAt(lines, mask, i);
    if (sub) {
      let next = i + 1;
      while (next < stop && !(headingAt(lines, mask, next) && headingAt(lines, mask, next).level <= sub.level)) next += 1;
      out.push(...sectionItems(lines, mask, i, next, depth + 1, unit, preset, cfg, moved));
      i = next;
      continue;
    }
    if (FENCE_RE.test(s)) {
      /* Блок кода — до закрывающей той же разметкой; текст внутри не меняется (6.4). */
      const open = s.match(FENCE_RE)[1];
      let close = i + 1;
      while (close < stop - 1 && !String(lines[close]).trim().startsWith(open)) close += 1;
      const block = lines.slice(i, close + 1).map(String);
      if (preset.code === "after") moved.push(block);
      else out.push(...block.map((l) => child + l));
      i = close + 1;
      continue;
    }
    if (/^[\t ]*\|/.test(s)) {
      let k = i;
      while (k < stop && /^[\t ]*\|/.test(lines[k])) k += 1;
      const table = lines.slice(i, k).map(String);
      if (preset.tables === "keep") out.push(...table);
      else moved.push(table);
      i = k;
      continue;
    }
    /* Пустые строки внутри дерева уходят — иначе список «разреженный» (6.4). */
    if (s.trim()) out.push(child + s);
    i += 1;
  }
  return out;
}

function sectionToTree(ctx, preset) {
  const { lines } = ctx;
  const at = ctx.cursor.line;
  const mask = fenceMask(lines);
  const head = headingAt(lines, mask, at);
  if (!head) return null;
  let stop = at + 1;
  while (stop < lines.length && !(headingAt(lines, mask, stop) && headingAt(lines, mask, stop).level <= head.level)) stop += 1;
  let last = stop - 1;
  while (last > at && !String(lines[last]).trim()) last -= 1;
  /* Единица отступа — та, что уже стоит у пунктов раздела; нет их — табуляция, как у Obsidian. */
  let unit = "\t";
  for (let i = at + 1; i <= last; i++) {
    if (!mask[i] && LIST_RE.test(lines[i]) && /^[\t ]/.test(lines[i])) { unit = String(lines[i]).match(/^[\t ]*/)[0]; break; }
  }
  const moved = [];
  const tree = sectionItems(lines, mask, at, last + 1, 0, unit, preset, ctx.cfg, moved);
  const out = moved.reduce((acc, block) => acc.concat([""], block), tree);
  return { from: at, to: last, lines: out, cursor: { line: at, ch: out[0].length } };
}

const PLACE_NAMES = { "in-place": "in place", "after-list": "after the list", "section-end": "at the section end" };

const sectionCategory = {
  id: "section",
  name: "Tree ↔ section",
  params: ["heading-level", "section-place", "code-blocks", "tables"],
  defaultName(p) {
    const fixed = Math.trunc(Number(p.level));
    return (fixed >= 1 && fixed <= 6 ? "H" + fixed : "Section") + " · " + (PLACE_NAMES[p.place] || PLACE_NAMES["after-list"]);
  },
  signature: (p) => [p.level || "auto", p.place || "after-list", p.code || "nest", p.tables || "after"].join("|"),
  defaults: [{ name: "", level: "auto", place: "after-list", code: "nest", tables: "after" }],
  /* Переключатель (его ответ 7): результата, в котором «стоят», нет — пресет задаёт параметры. */
  hasRevert: false,
  apply(ctx, preset) {
    return headingAt(ctx.lines, fenceMask(ctx.lines), ctx.cursor.line) ? sectionToTree(ctx, preset) : treeToSection(ctx, preset);
  },
  /** `next` и `previous` одинаково переключают первым видимым пресетом. */
  run(ctx, presets) {
    const preset = presets.find((p) => p && !p.hidden);
    return preset ? sectionCategory.apply(ctx, preset) : null;
  },
};

/** Реестр: picker, перебор и команды строятся по нему (4.3). */
const CATEGORIES = [callouts, cleanup, insertBlockCategory, sectionCategory];

function categoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || null;
}

/**
 * Категории Command Field из конфига: `pkm.fields.commands.byField[key]`.
 * Незнакомая реестру категория отбрасывается — её нечем исполнить.
 */
function fieldCategories(cfg, key) {
  const byField = cfg && cfg.pkm && cfg.pkm.fields && cfg.pkm.fields.commands
    ? cfg.pkm.fields.commands.byField : null;
  const entry = byField && typeof byField === "object" ? byField[key] : null;
  const list = entry && Array.isArray(entry.categories) ? entry.categories : [];
  return list.filter((c) => c && categoryById(c.id)).map((c) => ({
    id: String(c.id),
    /* Клон категории — свой адрес команд (4.1): `callouts-2`. */
    key: String(c.key || c.id),
    /* Стёртое до пустого имя — имя реестра (4.1). */
    name: String(c.name || "").trim() || categoryById(c.id).name,
    hidden: c.hidden === true,
    presets: Array.isArray(c.presets) ? c.presets.filter((p) => p && typeof p === "object") : [],
  }));
}

/** Строки, затронутые выделением: частичное выделение расширяется до строк (6.1). */
function selectedLines(ed) {
  if (typeof ed.somethingSelected !== "function" || !ed.somethingSelected()) return null;
  const a = ed.getCursor("from");
  const b = ed.getCursor("to");
  /* Выделение, кончающееся в начале строки, эту строку не захватывает. */
  const to = b.line > a.line && b.ch === 0 ? b.line - 1 : b.line;
  return { from: a.line, to };
}

/** Одна замена в редакторе — одна транзакция, один шаг `Ctrl+Z` (R-1). */
function commit(ed, lines, r) {
  ed.transaction({
    changes: [{ from: { line: r.from, ch: 0 }, to: { line: r.to, ch: lines[r.to].length }, text: r.lines.join("\n") }],
    selection: { from: r.cursor },
  });
}

/* Отказы с причиной (R-4): английское на случай без каталога; `{0}` — `<Field> · <категория>`. */
/* Ключ — литералом на месте вызова: его ищет сторож каталога (`runtime_notices_tests.js`). */
const { say: __say, noticeKey: __noticeKey } = __sayModule;
const REFUSALS = {
  "block-not-empty": (name) => __say(__noticeKey("pkm", "block-not-empty"), "{0}: put the cursor on an empty line to insert the block", name),
  "block-heading-exists": (name, heading) => __say(__noticeKey("pkm", "block-heading-exists"), "{0}: the note already has the heading {1}", name, heading),
};

/** Текст отказа для уведомления: `name` — как в палитре, без `next`/`previous`. */
function refusalText(got, name) {
  const say = REFUSALS[String(got && got.refuse || "")];
  const args = Array.isArray(got && got.args) ? got.args : [];
  return say ? say(name, ...args) : __say(__noticeKey("pkm", "nothing-to-do"), "{0}: nothing to change on this line", name);
}

/**
 * Ответ категории в редакторе: `"done"`, `"nothing"` или отказ с причиной
 * `{ refuse, args }` — его говорят вслух вызывающие (R-4).
 */
function finish(ed, lines, r) {
  if (!r) return "nothing";
  if (r.refuse) return r;
  commit(ed, lines, r);
  return "done";
}

/**
 * Пресет, выбранный в tagWheel (4.5): применить его, а не шагать по кругу.
 * Ответ — как у `runInEditor`.
 */
function applyPresetInEditor(ed, cfg, fieldKey, categoryKey, presetIndex) {
  const entry = fieldCategories(cfg, fieldKey).find((c) => c.key === categoryKey);
  const category = entry ? categoryById(entry.id) : null;
  const preset = entry ? entry.presets[presetIndex] : null;
  if (!category || !preset) return "unknown";
  const lines = String(ed.getValue()).split("\n");
  const r = category.apply({ lines, cursor: ed.getCursor(), selection: selectedLines(ed), cfg, presets: entry.presets }, preset);
  return finish(ed, lines, r);
}

/** Снять результат категории (пустое значение в tagWheel); у категории без обратного — менять нечего. */
function revertInEditor(ed, cfg, fieldKey, categoryKey) {
  const entry = fieldCategories(cfg, fieldKey).find((c) => c.key === categoryKey);
  const category = entry ? categoryById(entry.id) : null;
  if (!category || typeof category.revert !== "function") return "nothing";
  const lines = String(ed.getValue()).split("\n");
  const r = category.revert({ lines, cursor: ed.getCursor(), selection: null, cfg, presets: entry.presets });
  return finish(ed, lines, r);
}

/**
 * Исполнить категорию в редакторе: одна транзакция — один шаг `Ctrl+Z` (R-1).
 * Ответ: `"done"`, `"nothing"` (менять нечего), `"no-presets"`, `"unknown"` или отказ `{ refuse, args }`.
 */
function runInEditor(ed, cfg, fieldKey, categoryId, step) {
  const entry = fieldCategories(cfg, fieldKey).find((c) => c.key === categoryId);
  if (!entry) return "unknown";
  return runPresetsInEditor(ed, cfg, entry.id, entry.presets, step);
}

/**
 * Категория по реестру с переданными пресетами: Command Field и строка Binder
 * типа `Command` (4.6) — у той один пресет, и шаг вперёд с него снимает результат
 * («вкл/выкл»). Ответ — как у `runInEditor`.
 */
function runPresetsInEditor(ed, cfg, categoryId, presets, step) {
  const category = categoryById(categoryId);
  if (!category) return "unknown";
  const list = (Array.isArray(presets) ? presets : []).filter((p) => p && typeof p === "object");
  if (!list.some((p) => !p.hidden)) return "no-presets";
  const lines = String(ed.getValue()).split("\n");
  const r = category.run({ lines, cursor: ed.getCursor(), selection: selectedLines(ed), cfg, presets: list }, list, step);
  return finish(ed, lines, r);
}

module.exports = {
  refusalText,
  blockMode,
  blockLevel,
  CALLOUT_TYPES,
  CATEGORIES,
  categoryById,
  fieldCategories,
  runInEditor,
  runPresetsInEditor,
  applyPresetInEditor,
  revertInEditor,
  calloutAt,
  stripQuoteLevel,
};
