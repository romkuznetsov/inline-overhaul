/**
 * Порядок Prefix: три списка (PRD 10.7, фаза 3c).
 *
 *   * `cycle-order` — цикл `Move left`/`Move right`; `navigation.moveSelection.cycleOrder`,
 *     читает `cycleLineTypeRaw` в `navigation_runtime.js`.
 *   * `field-order-list` — порядок Fields; `pkm.prefixRules.priorityTargets`,
 *     читает `pkm_line_finalize_unified.js` через `getPrefixRulesFromCfg`.
 *   * `prefix-order-list` — порядок Prefix; `pkm.prefixRules.priorityCheckboxes`, он же.
 *
 * Запись швом `platform.plugin.setConfigPatch`: у `prefixRules` контролов в
 * схеме нет — там данные правил. Ц1: пустая строка цикла подписана словами.
 * Ц2: второй список приоритета скрыт предикатом `visible`, а не выключен.
 * Ц3: перетаскивание и стрелки.
 */

import { asObject } from "../types.ts";
import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, btn, textInput, type El } from "./dom.ts";
import { attachRowDrag, type DragHold } from "./row_drag.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";

/* Помощники состояния — общий модуль; снятие шва разобрано в `fields_editor.ts`. */
import deepStateModule from "../../../core/order_deep_editor_state.js";
import { sayIn } from "../texts_blocks.ts";

const deepState = deepStateModule as unknown as DeepState;

/* ---- тексты ------------------------------------------------------------ */

/* Тексты живут в каталоге (10.13.47); пустой список объясняет себя (Ц1, ПЗ2). */
type Say = (name: string, ...args: readonly (string | number)[]) => string;

const words = (ctx: SettingsCtx): Say => sayIn("field-order-list", ctx);

/* ---- общее: чтение и запись -------------------------------------------- */


function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(x => String(x ?? "")) : [];
}

/** Ветка правил Prefix: `pkm.prefixRules` (PRD 8.1а). */
function prefixRules(cfg: unknown): Record<string, unknown> {
  return asObject(asObject(asObject(cfg)["pkm"])["prefixRules"]);
}

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
 * Список с ручкой, номером, стрелками и (если дано) удалением — один на три
 * списка. Стрелки — порядок с клавиатуры (Ф17); место под них занято всегда.
 */
function sortableList(host: El, o: ListOpts, say: Say): void {
  const box = el(host, "div", "io-sortable" + (o.enabled ? "" : " io-sortable--off"));
  if (!o.rows.length) {
    el(box, "div", "io-side__empty", o.empty);
    return;
  }
  const held: DragHold = { taken: null };

  o.rows.forEach((value, i) => {
    const row = el(box, "div", "io-sortrow");
    /* Перетаскивание — общий дом (`Р-11`). */
    attachRowDrag({
      row,
      index: i,
      label: say("ROW_DRAG", o.label(value, i)),
      enabled: o.enabled,
      held,
      onMove: o.onMove,
    });

    el(row, "span", "io-sortrow__n", String(i + 1));
    o.cell(row, value, i);

    const move = el(row, "div", "io-sortrow__move");
    const up = btn(move, "io-icon", { text: "▲", label: say("MOVE_UP", o.label(value, i)) });
    up.disabled = i === 0 || !o.enabled;
    up.addEventListener("click", (() => { if (o.enabled) o.onMove(i, i - 1); }) as never);
    const down = btn(move, "io-icon", { text: "▼", label: say("MOVE_DOWN", o.label(value, i)) });
    down.disabled = i === o.rows.length - 1 || !o.enabled;
    down.addEventListener("click", (() => { if (o.enabled) o.onMove(i, i + 1); }) as never);
    if (o.onRemove) {
      const drop = btn(move, "io-icon", { text: "✕", label: say("REMOVE", o.label(value, i)) });
      drop.disabled = o.rows.length < 2 || !o.enabled;
      drop.addEventListener("click", (() => {
        if (o.enabled && o.onRemove) o.onRemove(i);
      }) as never);
    }
  });
}

/**
 * Своё поддерево, перерисовка с возвратом скролла (A8). Запись — только через
 * `commit`, иначе следующая правка идёт по устаревшему списку (2026-08-29).
 * Перерисовка в `finally`: исключение из `setConfigPatch` не должно оставлять
 * экран прежним.
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
    /* Выключенный цикл не редактируется: этот список никто не читает. */
    const enabled = Boolean(ctx.get("navigation.moveSelection.prefixCyclerEnabled"));

    const save = (next: readonly string[], reason: string): void => {
      commit(() => {
        (p.plugin as { setConfigPatch: (patch: unknown, reason: string) => void }).setConfigPatch(
          { navigation: { moveSelection: { cycleOrder: next.slice() } } },
          reason,
        );
      });
    };

    const say = words(ctx);
    sortableList(mount, {
      rows,
      enabled,
      empty: say("PREFIX_EMPTY"),
      label: (value, i) => say("PREFIX_ROW", i + 1),
      cell: (row, value, i) => {
        const input = textInput(row, "io-text io-text--mono io-sortrow__text", {
          value,
          /* Ц1: пустая строка — обычная строка без Prefix. */
          placeholder: say("NO_PREFIX"),
          label: say("PREFIX_ROW", i + 1),
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
    }, say);

    const actions = el(mount, "div", "io-rowactions");
    const add = btn(actions, "io-btn io-btn--sm",
      { text: say("ADD_PREFIX"), label: say("ADD_PREFIX") });
    add.disabled = !enabled;
    add.addEventListener("click", (() => {
      if (!enabled) return;
      save(rows.concat(""), "navigation:cycleOrder:add");
    }) as never);
    el(actions, "span", "io-note", say("DRAG_HINT"));
  });
};

/* ---- приоритет: два списка (Ц2, Ц3) ------------------------------------ */

/** Общая часть обоих списков приоритета: чтение ветки и запись в неё. */
function priorityBlock(host: El, ctx: SettingsCtx, o: {
  cls: string;
  key: "priorityTargets" | "priorityCheckboxes";
  /** Имена строк каталога, а не слова: у видимого текста один дом (10.13.47). */
  note: string;
  empty: string;
  /** Строки списка и подписи; Fields читаются моделью редактора. */
  rowsOf: (cfg: unknown) => Array<{ value: string; label: string }>;
  cell: (row: El, item: { value: string; label: string }) => void;
  /** Что ещё перерисовывает список, кроме выключателя модуля. */
  deps?: readonly string[];
}): () => void {
  const p = ctx.platform;
  if (!p) {
    const empty = el(host, "div", o.cls);
    return () => { empty.empty(); };
  }

  return block(host, ctx, o.cls, ["features.pkm.enabled", ...(o.deps || [])], (mount, commit) => {
    const cfg = p.getConfig();
    const items = o.rowsOf(cfg);
    const enabled = Boolean(ctx.get("features.pkm.enabled"));

    const save = (next: readonly string[], reason: string): void => {
      commit(() => {
        (p.plugin as { setConfigPatch: (patch: unknown, reason: string) => void }).setConfigPatch(
          { pkm: { prefixRules: { [o.key]: next.slice() } } },
          reason,
        );
      });
    };

    const say = words(ctx);
    el(mount, "p", "io-note io-note--lead", say(o.note));
    sortableList(mount, {
      rows: items.map(x => x.value),
      enabled,
      empty: say(o.empty),
      label: (_value, i) => (items[i]?.label || say("PREFIX_ROW", i + 1)),
      cell: (row, _value, i) => {
        const item = items[i];
        if (item) o.cell(row, item);
      },
      onMove: (from, to) => save(moved(items.map(x => x.value), from, to),
        "pkm:prefixRules:" + o.key + ":move"),
    }, say);
  });
}

/**
 * Порядок Fields (Ц2), `prefixRules.priorityTargets`; Fields, которых там нет,
 * дописываются в конец — так их видит и рантайм.
 */
export const fieldOrderList: CustomRender = (host: El, ctx: SettingsCtx) =>
  priorityBlock(host, ctx, {
    cls: "io-fieldorder",
    key: "priorityTargets",
    /* Fields правят на той же вкладке — без этого виден удалённый Field (BUGHUNT A15). */
    deps: ["pkm.fields.order"],
    note: "FIELDS_TIP",
    empty: "FIELDS_EMPTY",
    rowsOf: cfg => {
      const p = ctx.platform;
      if (!p) return [];
      const model = createFieldsModel({
        plugin: p.plugin as never,
        normalizePkmOrder: p.normalizePkmOrder as never,
        pkmOrderFields: p.pkmOrderFields,
        cfg: cfg as never,
        deepState,
      });
      const fields = model.listLineFields().filter(row => !row.parent);
      const byKey = new Map(fields.map(row => [row.key, row.label]));
      const stored = strings(prefixRules(cfg)["priorityTargets"]).filter(id => byKey.has(id));
      const rest = fields.map(row => row.key).filter(id => !stored.includes(id));
      return stored.concat(rest).map(id => ({ value: id, label: byKey.get(id) || id }));
    },
    cell: (row, item) => { el(row, "span", "io-sortrow__label", item.label); },
  });

/**
 * Порядок Prefix (Ц2). Токены в виде конфига (`[ ]`, `[x]`) — так их
 * нормализует `normalizePkmBehaviorShape`.
 */
export const prefixOrderList: CustomRender = (host: El, ctx: SettingsCtx) =>
  priorityBlock(host, ctx, {
    cls: "io-prefixorder",
    key: "priorityCheckboxes",
    note: "PREFIX_TIP",
    empty: "PREFIX_EMPTY",
    rowsOf: cfg => strings(prefixRules(cfg)["priorityCheckboxes"])
      .map(value => ({ value, label: value })),
    cell: (row, item) => { el(row, "code", "io-mono", item.value); },
  });
