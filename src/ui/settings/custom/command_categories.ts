/**
 * Таблица категорий и пресетов Command Field (постановка command-field.md, 4.1) —
 * одна на редактор Fields и окно `Add a Field` (его `💬` к тесту 1 цикла 125).
 * Вид — прототип, `commandCategoriesTable`.
 */

import type { El, DragEv, ElInput } from "./dom.ts";
import { el, btn, cssVar, textInput, tipBelow } from "./dom.ts";
import type { CommandCategory, CommandPreset, FieldRow } from "./fields_model.ts";
/* Реестр категорий Command Field — один дом с командами (4.3, У-32). */
import commandField from "../../../features/command_field.js";

type Say = (name: string, ...args: readonly (string | number)[]) => string;

/** Реестр так, как его читает панель: контролы пресета — по роду параметра (4.3). */
interface CfCategory {
  id: string;
  name: string;
  params: readonly string[];
  defaults: readonly CommandPreset[];
  defaultName: (p: CommandPreset, fieldName?: (key: string) => string) => string;
  signature: (p: CommandPreset) => string;
}
const CF = commandField as unknown as {
  CATEGORIES: readonly CfCategory[];
  CALLOUT_TYPES: readonly string[];
  blockMode: (p: CommandPreset) => string;
  blockLevel: (p: CommandPreset) => string;
};

/** Описание категории в строке таблицы — из каталога (10.13.47). */
const CAT_DESC: Record<string, string> = {
  callouts: "CAT_DESC_CALLOUTS",
  cleanup: "CAT_DESC_CLEANUP",
  block: "CAT_DESC_BLOCK",
  section: "CAT_DESC_SECTION",
};

/** Вариант выбора: значение в конфиге, подпись и подсказка при наведении — ключи каталога (его пункт «Новое» 2026-10-03). */
interface Choice { value: string; label: string; tip: string }

const LEVELS: readonly Choice[] = [{ value: "auto", label: "LEVEL_AUTO", tip: "LEVEL_AUTO_TIP" }]
  .concat([1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: "H" + n, tip: "LEVEL_FIXED_TIP" })));

/* Свёрнутость (6.1): `+` от пустого отличается только стрелкой в режиме чтения — два положения (его 💬 к тесту 1 цикла 125). */
const FOLDS: readonly Choice[] = [
  { value: "", label: "FOLD_OPEN", tip: "FOLD_OPEN_TIP" },
  { value: "-", label: "FOLD_CLOSED", tip: "FOLD_CLOSED_TIP" },
];

/* Обёртка вставки — одна из трёх (его 💬 к тесту 6 цикла 126). */
const MODES: readonly Choice[] = [
  { value: "plain", label: "MODE_PLAIN", tip: "MODE_PLAIN_TIP" },
  { value: "heading", label: "MODE_HEADING", tip: "MODE_HEADING_TIP" },
  { value: "callout", label: "MODE_CALLOUT", tip: "MODE_CALLOUT_TIP" },
];

/* Дерево ↔ раздел (6.4): поле пресета и варианты; первый — умолчание постановки. */
const SECTION_CHOICES: Record<string, { field: "level" | "place" | "code" | "tables"; aria: string; options: readonly Choice[] }> = {
  "heading-level": { field: "level", aria: "PRESET_LEVEL_ARIA", options: LEVELS },
  "section-place": { field: "place", aria: "PRESET_PLACE_ARIA", options: [
    { value: "after-list", label: "SECTION_PLACE_AFTER_LIST", tip: "SECTION_PLACE_AFTER_LIST_TIP" },
    { value: "in-place", label: "SECTION_PLACE_IN_PLACE", tip: "SECTION_PLACE_IN_PLACE_TIP" },
    { value: "section-end", label: "SECTION_PLACE_SECTION_END", tip: "SECTION_PLACE_SECTION_END_TIP" }] },
  "code-blocks": { field: "code", aria: "PRESET_CODE_ARIA", options: [
    { value: "nest", label: "SECTION_CODE_NEST", tip: "SECTION_CODE_NEST_TIP" },
    { value: "after", label: "SECTION_CODE_AFTER", tip: "SECTION_CODE_AFTER_TIP" }] },
  "tables": { field: "tables", aria: "PRESET_TABLES_ARIA", options: [
    { value: "after", label: "SECTION_TABLES_AFTER", tip: "SECTION_TABLES_AFTER_TIP" },
    { value: "keep", label: "SECTION_TABLES_KEEP", tip: "SECTION_TABLES_KEEP_TIP" }] },
};

/**
 * Колонки пресета — по роду параметра (его 💬 к тесту 2 цикла 126): подпись
 * стоит над контролом первого пресета категории и переносится вместе с ним в
 * узком окне; `weight` — доля ширины, `wide` — во всю ширину.
 */
const COLUMNS: Record<string, { cap: string; tip: string; weight?: number; wide?: boolean }> = {
  "callout-type": { cap: "CAP_TYPE", tip: "CAP_TYPE_TIP" },
  "fold": { cap: "CAP_FOLD", tip: "CAP_FOLD_TIP" },
  "fields": { cap: "CAP_KEEP", tip: "CAP_KEEP_TIP" },
  "heading-level": { cap: "CAP_LEVEL", tip: "CAP_LEVEL_TIP" },
  "section-place": { cap: "CAP_PLACE", tip: "CAP_PLACE_TIP" },
  "code-blocks": { cap: "CAP_CODE", tip: "CAP_CODE_TIP" },
  "tables": { cap: "CAP_TABLES", tip: "CAP_TABLES_TIP" },
  "block-mode": { cap: "CAP_WRAP", tip: "CAP_WRAP_TIP" },
  "block-wrap": { cap: "CAP_WRAP_SETTINGS", tip: "CAP_WRAP_SETTINGS_TIP", weight: 3 },
  "block-content": { cap: "CAP_TEXT", tip: "CAP_TEXT_TIP", wide: true },
};


/** Вид коллаута у темы: значок и цвет из `.callout[data-callout]` (переменные Obsidian). */
interface CalloutLook { icon: string; color: string }
const looks = new Map<string, CalloutLook>();
function calloutLook(type: string): CalloutLook | null {
  const cached = looks.get(type);
  if (cached) return cached;
  const g = globalThis as unknown as { document?: { body?: El }; getComputedStyle?: (n: unknown) => { getPropertyValue(k: string): string } };
  const body = g.document && g.document.body;
  if (!body || typeof g.getComputedStyle !== "function") return null;
  /* Проба: узел коллаута платформы, вне экрана; без тела документа — без вида. */
  const probe = body.createDiv();
  probe.addClass("callout", "io-cats__probe");
  probe.setAttribute("data-callout", type);
  const style = g.getComputedStyle(probe);
  const look = {
    icon: String(style.getPropertyValue("--callout-icon") || "").trim(),
    color: rgbTriple(String(style.getPropertyValue("--callout-color") || "")),
  };
  probe.remove();
  looks.set(type, look);
  return look;
}

/**
 * Цвет коллаута тройкой «r, g, b». Тема по умолчанию так его и пишет, а Minimal
 * — hex-цветом (`#6c99bb`, стенд на его теме): `rgb(var(...))` от hex недействителен.
 */
function rgbTriple(raw: string): string {
  const v = String(raw || "").trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = (hex[1] as string).length === 3 ? (hex[1] as string).split("").map(c => c + c).join("") : hex[1] as string;
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(", ");
  }
  const fn = /^rgba?\(([^)]*)\)$/i.exec(v);
  if (fn) return (fn[1] as string).split(/[\s,/]+/).filter(Boolean).slice(0, 3).join(", ");
  return /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(v) ? v : "";
}

/** Значок и цвет типа в узле; без платформы — только имя. */
function paintType(host: El, type: string, setIcon?: (node: unknown, icon: string) => void): void {
  const look = calloutLook(type);
  const icon = el(host, "span", "io-cats__ticon");
  host.classList.add("io-cats__typed");
  if (look && look.color) cssVar(host, "--io-callout-rgb", look.color);
  if (look && look.icon && setIcon) setIcon(icon, look.icon);
  el(host, "span", "io-cats__tname", type);
}

/** Вариант списка: подпись, подсказка при наведении и свой вид (значок типа коллаута). */
interface PickItem { value: string; label: string; tip?: string; paint?: (host: El) => void }

/**
 * Выбор списком: кнопка и под ней варианты, у каждого подсказка при наведении —
 * её показывает Obsidian по `aria-label` (его пункт «Новое» 2026-10-03: «чтобы
 * при наведении на вариант контрола возникала подсказка»). Обычный `select` не
 * рисует ни подсказок вариантов, ни значков (его `💬` к тесту 1 цикла 125).
 * Без значения — `placeholder` серым.
 */
function picker(host: El, o: { items: readonly PickItem[]; value: string; aria: string; enabled: boolean;
  placeholder?: string; pick: (value: string) => void }): void {
  const wrap = el(host, "div", "io-cats__type");
  const now = o.items.find(i => i.value === o.value);
  const face = (node: El, item: PickItem): void => {
    if (item.paint) item.paint(node);
    else el(node, "span", "io-cats__tname", item.label);
  };
  const button = btn(wrap, "io-cats__tbtn" + (now ? "" : " io-cats__tbtn--unset"),
    { label: o.aria, title: now ? now.label + (now.tip ? " — " + now.tip : "") : "" });
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.disabled = !o.enabled;
  if (now) face(button, now);
  else el(button, "span", "io-cats__tname", o.placeholder || "");
  let list: El | null = null;
  const close = (): void => {
    if (list) list.remove();
    list = null;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", (() => {
    if (list) { close(); return; }
    list = el(wrap, "div", "io-cats__tlist");
    list.setAttribute("role", "listbox");
    button.setAttribute("aria-expanded", "true");
    for (const it of o.items) {
      const on = it.value === o.value;
      const item = btn(list, "io-cats__titem" + (on ? " io-cats__titem--on" : ""), { label: it.label, title: it.tip || "" });
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", on ? "true" : "false");
      face(item, it);
      /* Фокус остаётся на кнопке: иначе `focusout` снимает список до `click` (окно `Add a Field`, стенд `command-field`). */
      item.addEventListener("mousedown", ((ev: { preventDefault?: () => void }) => { if (ev && ev.preventDefault) ev.preventDefault(); }) as never);
      item.addEventListener("click", (() => { close(); if (!on) o.pick(it.value); }) as never);
    }
  }) as never);
  wrap.addEventListener("focusout", ((ev: { relatedTarget?: unknown }) => {
    const next = ev && ev.relatedTarget as { closest?: (s: string) => unknown } | undefined;
    if (!next || typeof next.closest !== "function" || next.closest(".io-cats__type") !== wrap) close();
  }) as never);
}

/** Имя категории: своё, иначе реестра (4.1). */
export function categoryName(c: CommandCategory): string {
  return String(c.name || "").trim() || (CF.CATEGORIES.find(r => r.id === c.id)?.name ?? c.id);
}

/** Что таблице категорий нужно от хозяина: тексты, Fields строки и куда писать. */
export interface CategoriesTableOpts {
  say: Say;
  enabled: boolean;
  showTips: boolean;
  showIds?: boolean;
  /** Fields строки — для пресетов Очистки (`fields`) и имён по умолчанию. */
  lineFields: readonly FieldRow[];
  fieldName: string;
  /** Список `cats` уже изменён на месте: хозяин пишет его и перерисовывает. */
  save: () => void;
  /** Значок платформы (`setIcon`): нет платформы — выбор типа без значков. */
  setIcon?: (node: unknown, icon: string) => void;
}

/**
 * Таблица категорий и пресетов на списке `cats` — одна на редактор Fields и
 * окно `Add a Field` (его `💬` к тесту 1 цикла 125: настраивать сразу при создании).
 */
export function drawCategoriesTable(sec: El, cats: CommandCategory[], t: CategoriesTableOpts): () => void {
  const say = t.say;
  /* «H1»…«H6» — не ключи каталога, а сами подписи. */
  const word = (k: string): string => (/^H\d$/.test(k) ? k : say(k));
  const closers: Array<() => void> = [];
  const save = t.save;
  const regOf = (id: string): CfCategory | undefined => CF.CATEGORIES.find(c => c.id === id);
  const lineName = (key: string): string => {
    const f = t.lineFields.find(r => r.key === key);
    return f ? f.strictName : key;
  };
  const catName = (c: CommandCategory): string => String(c.name || "").trim() || (regOf(c.id)?.name ?? c.id);
  const presetName = (c: CommandCategory, p: CommandPreset): string =>
    String(p.name || "").trim() || (regOf(c.id)?.defaultName(p, lineName) ?? "");

  const box = el(sec, "div", "io-vals io-cats");
  const scroll = el(box, "div", "io-scroll");
  const inner = el(scroll, "div", "io-vals__inner io-cats__inner");
  const headRow = el(inner, "div", "io-vals__head io-cats__row");
  const colTips = el(inner, "div", "io-vals__tipslot");
  for (const [title, tip] of [["", ""], ["", ""], [say("CATS_COL_NAME"), "CATS_COL_NAME_TIP"], [say("CATS_COL_SETTINGS"), "CATS_COL_SETTINGS_TIP"], ["", ""]] as const) {
    const cell = el(headRow, "div", "io-vals__col");
    el(cell, "span", "io-vals__coltext", title);
    if (!tip) continue;
    closers.push(tipBelow({
      head: cell, host: colTips, text: say(tip), label: title, id: "io-categories-col-" + tip.toLowerCase().replace(/_/g, "-"),
      showTips: t.showTips, showIds: t.showIds,
    }));
  }
  if (!cats.length) el(inner, "div", "io-side__empty io-cats__empty", say("CATS_EMPTY"));

  /* Что тянут: адрес переживает перерисовку, узел — нет. Перенос — только в своём списке. */
  let dragged: { scope: string; index: number } | null = null;
  const grip = (line: El, scope: string, index: number, list: unknown[], what: string): void => {
    const g = el(line, "div", "io-grip", "⠿");
    g.setAttribute("role", "button");
    g.setAttribute("aria-label", say("CAT_DRAG", what));
    g.draggable = t.enabled;
    g.addEventListener("dragstart", ((ev: DragEv) => {
      dragged = { scope, index };
      line.classList.add("io-dragging");
      try { ev.dataTransfer?.setData("text/plain", what); } catch { /* проба: десктоп всегда даёт dataTransfer */ }
    }) as never);
    g.addEventListener("dragend", (() => { line.classList.remove("io-dragging"); dragged = null; }) as never);
    line.addEventListener("dragover", ((ev: DragEv) => {
      if (!dragged || dragged.scope !== scope) return;
      ev.preventDefault();
      line.classList.add("io-dragover");
    }) as never);
    line.addEventListener("dragleave", (() => line.classList.remove("io-dragover")) as never);
    line.addEventListener("drop", ((ev: DragEv) => {
      line.classList.remove("io-dragover");
      if (!dragged || dragged.scope !== scope || !t.enabled) return;
      ev.preventDefault();
      const [moved] = list.splice(dragged.index, 1);
      list.splice(index, 0, moved);
      dragged = null;
      save();
    }) as never);
  };
  const eye = (line: El, item: { hidden?: boolean }, what: string): void => {
    const b = btn(line, "io-icon io-cats__eye" + (item.hidden ? " io-cats__eye--off" : ""), {
      text: item.hidden ? "◌" : "👁", label: say(item.hidden ? "CAT_SHOW" : "CAT_HIDE", what),
    });
    b.setAttribute("aria-pressed", item.hidden ? "false" : "true");
    b.disabled = !t.enabled;
    b.addEventListener("click", (() => { item.hidden = !item.hidden; save(); }) as never);
  };
  const nameInput = (line: El, value: string, placeholder: string, label: string, write: (v: string) => void): void => {
    const input = textInput(line, "io-text", { value, placeholder, label });
    input.disabled = !t.enabled;
    input.addEventListener("change", (() => { write(String(input.value || "").trim()); save(); }) as never);
  };
  const tool = (host2: El, glyph: string, label: string, act: () => void, danger?: boolean): void => {
    const b = btn(host2, "io-icon" + (danger ? " io-icon--danger" : ""), { text: glyph, label });
    b.disabled = !t.enabled;
    b.addEventListener("click", (() => { act(); save(); }) as never);
  };

  cats.forEach((c, ci) => {
    const reg = regOf(c.id);
    const cn = catName(c);
    const line = el(inner, "div", "io-vals__row io-cats__row io-cats__cat" + (c.hidden ? " io-cats__row--hidden" : ""));
    grip(line, "cat", ci, cats, cn);
    eye(line, c, cn);
    nameInput(line, c.name || "", reg ? reg.name : c.id, say("CAT_NAME_ARIA", cn), v => { c.name = v; });
    el(line, "div", "io-cats__desc", CAT_DESC[c.id] ? say(CAT_DESC[c.id] as string) : "");
    const tools = el(line, "div", "io-valtools");
    tool(tools, "⧉", say("CAT_CLONE", cn), () => {
      let n = 2;
      while (cats.some(x => (x.key || x.id) === c.id + "-" + n)) n++;
      const copy = JSON.parse(JSON.stringify(c)) as CommandCategory;
      cats.splice(ci + 1, 0, { ...copy, key: c.id + "-" + n, name: say("COPY_OF", cn) });
    });
    tool(tools, "✕", say("CAT_REMOVE", cn), () => { cats.splice(ci, 1); }, true);

    const seen = new Map<string, string>();
    c.presets.forEach((p, pi) => {
      const pn = presetName(c, p);
      const pline = el(inner, "div", "io-vals__row io-vals__row--child io-cats__row" + (p.hidden ? " io-cats__row--hidden" : ""));
      grip(pline, "presets:" + ci, pi, c.presets, pn);
      eye(pline, p, pn);
      nameInput(pline, p.name || "", presetName(c, { ...p, name: "" }), say("PRESET_NAME_ARIA", pn), v => { p.name = v; });
      const set = el(pline, "div", "io-cats__set");
      /* Ячейка колонки; у первого пресета — подпись колонки над контролом, подсказка — при наведении. */
      const cell = (kind: string): El => {
        const col = COLUMNS[kind];
        const node = el(set, "div", "io-cats__cell" + (col && col.wide ? " io-cats__cell--wide" : ""));
        if (col && col.weight) cssVar(node, "--io-cats-grow", String(col.weight));
        if (col && pi === 0) el(node, "span", "io-cats__cap", say(col.cap)).setAttribute("aria-label", say(col.tip));
        return node;
      };
      const choose = (host2: El, options: readonly Choice[], value: string, aria: string, write: (v: string) => void): void => picker(host2, {
        items: options.map(o => ({ value: o.value, label: word(o.label), tip: say(o.tip) })),
        value: options.some(o => o.value === value) ? value : (options[0] as Choice).value,
        aria, enabled: t.enabled, pick: v => { write(v); save(); },
      });
      const types = (host2: El): void => picker(host2, {
        items: CF.CALLOUT_TYPES.map(type => ({ value: type, label: type, paint: (n: El) => paintType(n, type, t.setIcon) })),
        value: p.type || "note", aria: say("PRESET_TYPE_ARIA", pn), enabled: t.enabled, pick: v => { p.type = v; save(); },
      });
      const folds = (host2: El): void => choose(host2, FOLDS, p.fold === "-" ? "-" : "", say("PRESET_FOLD_ARIA", pn), v => { p.fold = v; });
      const prop = (host2: El, value: string, placeholder: string, label: string, write: (v: string) => void): void => {
        const input = textInput(host2, "io-text io-cats__prop", { value, placeholder, label });
        input.disabled = !t.enabled;
        input.addEventListener("change", (() => { write(String(input.value || "").trim()); save(); }) as never);
      };
      for (const kind of reg ? reg.params : []) {
        const box2 = cell(kind);
        if (kind === "callout-type") {
          types(box2);
        } else if (kind === "fold") {
          folds(box2);
        } else if (kind === "block-mode") {
          choose(box2, MODES, CF.blockMode(p), say("PRESET_MODE_ARIA", pn), v => { p.mode = v; });
        } else if (kind === "block-wrap") {
          /* Настройки только своей обёртки (его 💬 к тесту 6 цикла 126: «у каждого свой набор опций»). */
          const mode = CF.blockMode(p);
          if (mode === "heading") {
            prop(box2, p.headingText || "", say("PRESET_HEADING"), say("PRESET_HEADING_TEXT_ARIA", pn), v => { p.headingText = v; });
            choose(box2, LEVELS, CF.blockLevel(p), say("PRESET_LEVEL_ARIA", pn), v => { p.level = v; });
          } else if (mode === "callout") {
            types(box2);
            folds(box2);
            prop(box2, p.title || "", say("PRESET_TITLE_PLACEHOLDER"), say("PRESET_TITLE_ARIA", pn), v => { p.title = v; });
          }
        } else if (kind === "block-content") {
          const area = el(box2, "textarea", "io-text io-cats__content") as unknown as ElInput;
          area.value = String(p.content || "");
          area.setAttribute("aria-label", say("PRESET_CONTENT_ARIA", pn));
          area.setAttribute("placeholder", say("PRESET_CONTENT_PLACEHOLDER"));
          area.setAttribute("rows", "2");
          area.disabled = !t.enabled;
          area.addEventListener("change", (() => { p.content = String(area.value || ""); save(); }) as never);
        } else if (SECTION_CHOICES[kind]) {
          const c = SECTION_CHOICES[kind] as (typeof SECTION_CHOICES)[string];
          choose(box2, c.options, String(p[c.field] || ""), say(c.aria, pn), v => { p[c.field] = v; });
        } else if (kind === "fields") {
          const keep = p.keep || (p.keep = []);
          for (const lf of t.lineFields) {
            if (lf.parent) continue;
            const on = keep.includes(lf.key);
            const chip = btn(box2, "io-cats__keep" + (on ? " io-cats__keep--on" : ""), { text: lf.strictName, label: say("PRESET_KEEP_ARIA", lf.strictName) });
            chip.setAttribute("aria-pressed", on ? "true" : "false");
            chip.disabled = !t.enabled;
            chip.addEventListener("click", (() => {
              if (on) keep.splice(keep.indexOf(lf.key), 1); else keep.push(lf.key);
              save();
            }) as never);
          }
        }
      }
      const sig = reg ? reg.signature(p) : "";
      if (!p.hidden && seen.has(sig)) el(set, "span", "io-cats__same io-cats__cell--wide", say("PRESET_SAME", seen.get(sig) as string));
      else if (!p.hidden) seen.set(sig, pn);
      const ptools = el(pline, "div", "io-valtools");
      tool(ptools, "⧉", say("PRESET_CLONE", pn), () => {
        c.presets.splice(pi + 1, 0, { ...(JSON.parse(JSON.stringify(p)) as CommandPreset), name: say("COPY_OF", pn) });
      });
      tool(ptools, "✕", say("PRESET_REMOVE", pn), () => { c.presets.splice(pi, 1); }, true);
    });
  });

  const foot = el(box, "div", "io-vals__foot");
  /*
   * Ничего не выбрано заранее — серый прочерк (его пункт «Новое» 2026-10-03:
   * «select here выглядит глупо»); у каждой категории подсказка — её описание.
   */
  let chosen = "";
  const pickHost = el(foot, "div", "io-cats__pick");
  const add = btn(foot, "io-btn io-btn--sm io-btn--cta", { text: say("CATS_ADD") });
  add.disabled = true;
  const drawPick = (): void => {
    pickHost.empty();
    picker(pickHost, {
      items: CF.CATEGORIES.map(c => ({ value: c.id, label: c.name, tip: CAT_DESC[c.id] ? say(CAT_DESC[c.id] as string) : "" })),
      value: chosen, aria: say("CATS_PICK_ARIA", t.fieldName), enabled: t.enabled, placeholder: say("CATS_PICK_PLACEHOLDER"),
      pick: v => { chosen = v; add.disabled = !t.enabled || !regOf(v); drawPick(); },
    });
  };
  drawPick();
  add.addEventListener("click", (() => {
    const reg = regOf(chosen);
    if (!reg) return;
    let key = reg.id;
    for (let n = 2; cats.some(x => (x.key || x.id) === key); n++) key = reg.id + "-" + n;
    cats.push({ id: reg.id, key, name: "", hidden: false, presets: reg.defaults.map(p => ({ ...JSON.parse(JSON.stringify(p)), hidden: false })) });
    save();
  }) as never);

  return () => { closers.forEach(fn => fn()); };
}
