/**
 * Порядок Prefix: три списка (PRD 10.7, фаза 3c).
 *
 *   * `cycle-order` — цикл, по которому `Move left` и `Move right` меняют
 *     Prefix строки. Путь `navigation.moveSelection.cycleOrder`, его читает
 *     `cycleLineTypeRaw` в `navigation_runtime.js`.
 *   * `field-order-list` — порядок Fields, когда приоритет решается ими.
 *     Путь `pkm.behavior.prefixRules.priorityTargets`, читает
 *     `pkm_line_finalize_unified.js`.
 *   * `prefix-order-list` — порядок самих Prefix. Путь
 *     `pkm.behavior.prefixRules.priorityCheckboxes`, читает он же.
 *
 * Все три пути настоящие и живые: это установлено в 8.3 и перепроверено здесь
 * перед написанием блока. Записи идут швом `platform.plugin.setConfigPatch` —
 * тем же, которым пишут редактор Fields и Smart Rules: ветка `prefixRules`
 * живёт в форме v1, и до фазы 2 её пути в схеме нет.
 *
 * Ц1: пустая строка в цикле — это «обычная строка без Prefix», и она подписана
 * словами, а не оставлена пустой. Ц2: из двух списков приоритета виден тот,
 * который выбран в `Decide by`, — второй скрыт предикатом `visible` схемы, а
 * не выключен. Ц3: оба переупорядочиваются перетаскиванием и стрелками.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, btn, textInput, type DragEv, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";

/* Помощники состояния — оттуда же, откуда их берут остальные блоки. */
import legacy from "./fields_editor_legacy.js";

interface LegacyModule {
  getOrderDeepEditorState: () => DeepState;
}

const helpers = legacy as unknown as LegacyModule;

/* ---- тексты: сняты с прототипа (Приложение B, 10.7) -------------------- */

/** Ц1: пустая строка в цикле — обычная строка, и это сказано словами. */
const NO_PREFIX = "no Prefix (plain text)";
const ADD_PREFIX = "Add Prefix";
const DRAG_NOTE = "Drag a row, or use the arrows, to change the order";
const FIELD_NOTE = "The Field nearest the top wins a conflict. Drag a row, or use the arrows";
const PREFIX_NOTE =
  "The Prefix nearest the top wins, whichever Field produced it. Drag a row, or use the arrows";
/** Списку нечего показать: приглашение, а не пустое место (ПЗ2). */
const EMPTY_FIELDS = "no Fields yet — set them up under Fields above";
const EMPTY_PREFIXES = "no Prefixes listed yet";

/* ---- общее: чтение и запись -------------------------------------------- */

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(x => String(x ?? "")) : [];
}

/** Ветка правил Prefix в конфиге версии 1. */
function prefixRules(cfg: unknown): Record<string, unknown> {
  const behavior = asObject(asObject(asObject(cfg)["pkm"])["behavior"]);
  return asObject(behavior["prefixRules"]);
}

/** Перестановка внутри списка: та же, что у остальных перетаскиваний. */
function moved(list: readonly string[], from: number, to: number): string[] {
  const out = list.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const taken = out.splice(from, 1)[0];
  if (taken === undefined) return list.slice();
  out.splice(to, 0, taken);
  return out;
}

interface ListOpts {
  /** Строки списка в порядке показа. */
  rows: readonly string[];
  /** Как назвать строку в подписи для программы чтения с экрана. */
  label: (value: string, index: number) => string;
  /** Что нарисовать в строке: подпись или поле ввода. */
  cell: (row: El, value: string, index: number) => void;
  enabled: boolean;
  /** Пусто — строку удалить нельзя (единственную не удаляем). */
  onRemove?: (index: number) => void;
  onMove: (from: number, to: number) => void;
  empty: string;
}

/**
 * Список с ручкой, номером, стрелками и (если дано) удалением. Один помощник
 * на три списка: они отличаются только тем, что стоит в строке.
 *
 * Стрелки не украшение: клавиатурой перетащить нельзя, а Ф17 требует, чтобы
 * порядок менялся и с клавиатуры. Место под них занято всегда.
 */
function sortableList(host: El, o: ListOpts): void {
  const box = el(host, "div", "io-sortable" + (o.enabled ? "" : " io-sortable--off"));
  if (!o.rows.length) {
    el(box, "div", "io-side__empty", o.empty);
    return;
  }
  let taken: number | null = null;

  o.rows.forEach((value, i) => {
    const row = el(box, "div", "io-sortrow");
    const grip = el(row, "span", "io-grip", "⠿");
    grip.setAttribute("role", "button");
    grip.setAttribute("aria-label", "Drag " + o.label(value, i) + " to reorder it");
    grip.draggable = o.enabled;
    grip.addEventListener("dragstart", ((ev: DragEv) => {
      taken = i;
      row.classList.add("io-dragging");
      try { ev.dataTransfer?.setData("text/plain", String(i)); } catch { /* десктоп всегда даёт dataTransfer */ }
    }) as never);
    grip.addEventListener("dragend", (() => {
      taken = null;
      row.classList.remove("io-dragging");
    }) as never);
    row.addEventListener("dragover", ((ev: DragEv) => {
      if (taken === null) return;
      ev.preventDefault();
      row.classList.add("io-dragover");
    }) as never);
    row.addEventListener("dragleave", (() => { row.classList.remove("io-dragover"); }) as never);
    row.addEventListener("drop", ((ev: DragEv) => {
      ev.preventDefault();
      row.classList.remove("io-dragover");
      const from = taken;
      taken = null;
      if (from === null || from === i) return;
      o.onMove(from, i);
    }) as never);

    el(row, "span", "io-sortrow__n", String(i + 1));
    o.cell(row, value, i);

    const move = el(row, "div", "io-sortrow__move");
    const up = btn(move, "io-icon", { text: "▲", label: "Move " + o.label(value, i) + " up" });
    up.disabled = i === 0 || !o.enabled;
    up.addEventListener("click", (() => { if (o.enabled) o.onMove(i, i - 1); }) as never);
    const down = btn(move, "io-icon", { text: "▼", label: "Move " + o.label(value, i) + " down" });
    down.disabled = i === o.rows.length - 1 || !o.enabled;
    down.addEventListener("click", (() => { if (o.enabled) o.onMove(i, i + 1); }) as never);
    if (o.onRemove) {
      const drop = btn(move, "io-icon", { text: "✕", label: "Remove " + o.label(value, i) });
      drop.disabled = o.rows.length < 2 || !o.enabled;
      drop.addEventListener("click", (() => {
        if (o.enabled && o.onRemove) o.onRemove(i);
      }) as never);
    }
  });
}

/**
 * Общая обвязка: своё поддерево, перерисовка с возвратом скролла (A8).
 *
 * `fill` получает `commit` — им и делается запись. Иначе список после правки
 * остаётся прежним, и следующая правка идёт по устаревшему: добавленная строка
 * теряется. Дефект найден проверкой 2026-08-29.
 *
 * Перерисовка идёт в `finally`: `setConfigPatch` после самой записи делает
 * многое, и исключение оттуда не должно оставлять экран прежним — это уже
 * стоило одного замечания заказчика в разделе свойств заметки.
 */
function block(
  host: El,
  ctx: SettingsCtx,
  cls: string,
  paths: readonly string[],
  fill: (mount: El, commit: (write: () => void) => void) => void,
): () => void {
  const box = el(host, "div", cls);
  let mounted: El | null = null;
  const commit = (write: () => void): void => {
    try {
      write();
    } catch (e) {
      console.error("inline-overhaul: запись порядка не удалась", e);
    } finally {
      draw();
    }
  };
  const draw = (): void => {
    const keep = keepView(box);
    const next = el(box, "div", cls + "__mount");
    try {
      fill(next, commit);
    } catch (e) {
      next.remove();
      console.error("inline-overhaul: список порядка не отрисовался", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };
  draw();
  const unwatch = ctx.watch(paths, draw);
  return () => {
    unwatch();
    mounted = null;
    box.empty();
  };
}

/* ---- цикл Prefix (Ц1) --------------------------------------------------- */

/** Пути, от которых зависит цикл Prefix. */
const CYCLE_PATHS = ["navigation.moveSelection.prefixCyclerEnabled"] as const;

export const cycleOrder: CustomRender = (host: El, ctx: SettingsCtx) => {
  const p = ctx.platform;
  if (!p) {
    const empty = el(host, "div", "io-cycleorder");
    return () => { empty.empty(); };
  }

  return block(host, ctx, "io-cycleorder", CYCLE_PATHS, (mount, commit) => {
    const cfg = p.getConfig();
    const move = asObject(asObject(asObject(cfg)["navigation"])["moveSelection"]);
    const rows = strings(move["cycleOrder"]);
    /*
     * Цикл включается своим тумблером, и выключенный он не редактируется:
     * иначе человек правит список, который никто не читает.
     */
    const enabled = Boolean(ctx.get("navigation.moveSelection.prefixCyclerEnabled"));

    const save = (next: readonly string[], reason: string): void => {
      commit(() => {
        (p.plugin as { setConfigPatch: (patch: unknown, reason: string) => void }).setConfigPatch(
          { navigation: { moveSelection: { cycleOrder: next.slice() } } },
          reason,
        );
      });
    };

    sortableList(mount, {
      rows,
      enabled,
      empty: EMPTY_PREFIXES,
      label: (value, i) => "Prefix " + (i + 1),
      cell: (row, value, i) => {
        const input = textInput(row, "io-text io-text--mono io-sortrow__text", {
          value,
          /* Ц1: пустая строка — это обычная строка, и подпись это говорит. */
          placeholder: NO_PREFIX,
          label: "Prefix " + (i + 1),
        });
        input.disabled = !enabled;
        input.addEventListener("change", (() => {
          if (!enabled) return;
          const next = rows.slice();
          next[i] = input.value;
          save(next, "navigation:cycleOrder:edit");
        }) as never);
      },
      onMove: (from, to) => save(moved(rows, from, to), "navigation:cycleOrder:move"),
      onRemove: i => save(rows.filter((_, k) => k !== i), "navigation:cycleOrder:remove"),
    });

    const actions = el(mount, "div", "io-rowactions");
    const add = btn(actions, "io-btn io-btn--sm", { text: ADD_PREFIX, label: ADD_PREFIX });
    add.disabled = !enabled;
    add.addEventListener("click", (() => {
      if (!enabled) return;
      save(rows.concat(""), "navigation:cycleOrder:add");
    }) as never);
    el(actions, "span", "io-note", DRAG_NOTE);
  });
};

/* ---- приоритет: два списка (Ц2, Ц3) ------------------------------------ */

/** Общая часть обоих списков приоритета: чтение ветки и запись в неё. */
function priorityBlock(host: El, ctx: SettingsCtx, o: {
  cls: string;
  key: "priorityTargets" | "priorityCheckboxes";
  note: string;
  empty: string;
  /** Строки списка и как их подписать; Fields читаются моделью редактора. */
  rowsOf: (cfg: unknown) => Array<{ value: string; label: string }>;
  cell: (row: El, item: { value: string; label: string }) => void;
}): () => void {
  const p = ctx.platform;
  if (!p) {
    const empty = el(host, "div", o.cls);
    return () => { empty.empty(); };
  }

  return block(host, ctx, o.cls, ["features.pkm.enabled"], (mount, commit) => {
    const cfg = p.getConfig();
    const items = o.rowsOf(cfg);
    const enabled = Boolean(ctx.get("features.pkm.enabled"));

    const save = (next: readonly string[], reason: string): void => {
      commit(() => {
        (p.plugin as { setConfigPatch: (patch: unknown, reason: string) => void }).setConfigPatch(
          { pkm: { behavior: { prefixRules: { [o.key]: next.slice() } } } },
          reason,
        );
      });
    };

    el(mount, "p", "io-note io-note--lead", o.note);
    sortableList(mount, {
      rows: items.map(x => x.value),
      enabled,
      empty: o.empty,
      label: (_value, i) => (items[i]?.label || "row " + (i + 1)),
      cell: (row, _value, i) => {
        const item = items[i];
        if (item) o.cell(row, item);
      },
      onMove: (from, to) => save(moved(items.map(x => x.value), from, to),
        "pkm:prefixRules:" + o.key + ":move"),
    });
  });
}

/**
 * Порядок Fields (Ц2). Список ведёт `prefixRules.priorityTargets`; Fields,
 * которых там ещё нет, дописываются в конец — так их видит и рантайм
 * (`pkm_line_finalize_unified.js` заполняет пустой список левым Block).
 */
export const fieldOrderList: CustomRender = (host: El, ctx: SettingsCtx) =>
  priorityBlock(host, ctx, {
    cls: "io-fieldorder",
    key: "priorityTargets",
    note: FIELD_NOTE,
    empty: EMPTY_FIELDS,
    rowsOf: cfg => {
      const p = ctx.platform;
      if (!p) return [];
      const model = createFieldsModel({
        plugin: p.plugin as never,
        normalizePkmOrder: p.normalizePkmOrder as never,
        pkmOrderFields: p.pkmOrderFields,
        cfg: cfg as never,
        deepState: helpers.getOrderDeepEditorState(),
      });
      const fields = model.listFields().filter(row => !row.parent);
      const byKey = new Map(fields.map(row => [row.key, row.label]));
      const stored = strings(prefixRules(cfg)["priorityTargets"]).filter(id => byKey.has(id));
      const rest = fields.map(row => row.key).filter(id => !stored.includes(id));
      return stored.concat(rest).map(id => ({ value: id, label: byKey.get(id) || id }));
    },
    cell: (row, item) => { el(row, "span", "io-sortrow__label", item.label); },
  });

/**
 * Порядок Prefix (Ц2). Значения — токены чекбоксов в том виде, в каком их
 * хранит конфиг (`[ ]`, `[x]`): `normalizePkmBehaviorShape` нормализует их
 * именно так, и показывать другое значило бы показывать не то, что записано.
 */
export const prefixOrderList: CustomRender = (host: El, ctx: SettingsCtx) =>
  priorityBlock(host, ctx, {
    cls: "io-prefixorder",
    key: "priorityCheckboxes",
    note: PREFIX_NOTE,
    empty: EMPTY_PREFIXES,
    rowsOf: cfg => strings(prefixRules(cfg)["priorityCheckboxes"])
      .map(value => ({ value, label: value })),
    cell: (row, item) => { el(row, "code", "io-mono", item.value); },
  });
