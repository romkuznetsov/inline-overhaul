/**
 * Таблица категорий и пресетов Command Field (постановка command-field.md, 4.1) —
 * одна на редактор Fields и окно `Add a Field` (его `💬` к тесту 1 цикла 125).
 * Вид — прототип, `commandCategoriesTable`.
 */

import type { El, DragEv } from "./dom.ts";
import { el, btn, selectInput, textInput, tipBelow } from "./dom.ts";
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
const CF = commandField as unknown as { CATEGORIES: readonly CfCategory[]; CALLOUT_TYPES: readonly string[] };

/** Описание категории в строке таблицы — из каталога (10.13.47). */
const CAT_DESC: Record<string, string> = {
  callouts: "CAT_DESC_CALLOUTS",
  cleanup: "CAT_DESC_CLEANUP",
};

/** Свёрнутость коллаута (6.1): значения — разметки Obsidian, подписи — каталога. */
const FOLD_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "FOLD_OPEN" },
  { value: "-", label: "FOLD_FOLDED" },
  { value: "+", label: "FOLD_UNFOLDED" },
];

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
}

/**
 * Таблица категорий и пресетов на списке `cats` — одна на редактор Fields и
 * окно `Add a Field` (его `💬` к тесту 1 цикла 125: настраивать сразу при создании).
 */
export function drawCategoriesTable(sec: El, cats: CommandCategory[], t: CategoriesTableOpts): () => void {
  const say = t.say;
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
      for (const kind of reg ? reg.params : []) {
        if (kind === "callout-type") {
          const ty = selectInput(set, "io-select", {
            options: CF.CALLOUT_TYPES.map(v => ({ value: v, label: v })), value: p.type || "note", label: say("PRESET_TYPE_ARIA", pn),
          });
          ty.disabled = !t.enabled;
          ty.addEventListener("change", (() => { p.type = String(ty.value); save(); }) as never);
        } else if (kind === "fold") {
          const f = selectInput(set, "io-select", {
            options: FOLD_OPTIONS.map(x => ({ value: x.value, label: say(x.label) })), value: p.fold || "", label: say("PRESET_FOLD_ARIA", pn),
          });
          f.disabled = !t.enabled;
          f.addEventListener("change", (() => { p.fold = String(f.value); save(); }) as never);
        } else if (kind === "fields") {
          const keep = p.keep || (p.keep = []);
          for (const lf of t.lineFields) {
            if (lf.parent) continue;
            const on = keep.includes(lf.key);
            const chip = btn(set, "io-cats__keep" + (on ? " io-cats__keep--on" : ""), { text: lf.strictName, label: say("PRESET_KEEP_ARIA", lf.strictName) });
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
      if (!p.hidden && seen.has(sig)) el(set, "span", "io-cats__same", say("PRESET_SAME", seen.get(sig) as string));
      else if (!p.hidden) seen.set(sig, pn);
      const ptools = el(pline, "div", "io-valtools");
      tool(ptools, "⧉", say("PRESET_CLONE", pn), () => {
        c.presets.splice(pi + 1, 0, { ...(JSON.parse(JSON.stringify(p)) as CommandPreset), name: say("COPY_OF", pn) });
      });
      tool(ptools, "✕", say("PRESET_REMOVE", pn), () => { c.presets.splice(pi, 1); }, true);
    });
  });

  const foot = el(box, "div", "io-vals__foot");
  const pick = selectInput(foot, "io-select", {
    options: CF.CATEGORIES.map(c => ({ value: c.id, label: c.name })), value: CF.CATEGORIES[0]?.id ?? "",
    label: say("CATS_PICK_ARIA", t.fieldName),
  });
  pick.disabled = !t.enabled;
  const add = btn(foot, "io-btn io-btn--sm io-btn--cta", { text: say("CATS_ADD") });
  add.disabled = !t.enabled;
  add.addEventListener("click", (() => {
    const reg = regOf(String(pick.value));
    if (!reg) return;
    let key = reg.id;
    for (let n = 2; cats.some(x => (x.key || x.id) === key); n++) key = reg.id + "-" + n;
    cats.push({ id: reg.id, key, name: "", hidden: false, presets: reg.defaults.map(p => ({ ...JSON.parse(JSON.stringify(p)), hidden: false })) });
    save();
  }) as never);

  return () => { closers.forEach(fn => fn()); };
}
