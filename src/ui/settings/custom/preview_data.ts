/**
 * Данные живых предпросмотров (PRD 10.3 П1): выдуманная строка, настоящие
 * настройки. Fields — из конфига моделью `fields_model.ts`, своего разбора нет
 * (П11, П9). Пример — только без платформы или без Fields, и панель это
 * говорит (ПЗ2).
 */

import type { SettingsCtx } from "../types.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";
import { frame } from "./previews.ts";

/* Общий с редактором Fields модуль; снятие шва — `fields_editor.ts`. */
import deepStateModule from "../../../core/order_deep_editor_state.js";

const deepState = deepStateModule as unknown as DeepState;

/** Как Value показывается на строке: значением, ничем или своим текстом. */
export type ValueShown = "value" | "empty" | "custom";

export interface PreviewValue {
  /** Без решётки: её добавляет отрисовка, если включены маркеры. */
  token: string;
  /** Цвет заливки. Только переменная темы или значение из конфига (З6). */
  fill: string;
  /** Цвет текста; пусто — берётся из темы. */
  text?: string;
  /** Цвет рамки (`Side`); пусто — рамка темы, `#ffffff` — без рамки. */
  side?: string;
  shown: ValueShown;
  /** Свой текст, когда `shown` равен `custom`. */
  custom?: string;
  /** 0 — Value, 1 — его подзначение. */
  depth: 0 | 1;
}

export interface PreviewField {
  id: string;
  name: string;
  /** Короткое имя для чипа: если его нет, показывается полное. */
  short?: string;
  kind: "tag" | "link" | "element";
  /** В каком Block стоит Field: до текста или после него. */
  side: "left" | "right";
  values: readonly PreviewValue[];
}

/**
 * Пример из стартового набора ПЗ1 плюс подзначение и Value с `empty` — без них
 * предпросмотрам нечего показать. Цвета — переменные темы (З6).
 */
export const EXAMPLE_FIELDS: readonly PreviewField[] = [
  {
    id: "status",
    /* Ключ каталога, подставляет `previewFields` (A46). */
    name: "EXAMPLE_STATUS",
    kind: "tag",
    side: "left",
    values: [
      { token: "todo", fill: "var(--color-blue)", shown: "value", depth: 0 },
      { token: "doing", fill: "var(--color-orange)", shown: "value", depth: 0 },
      { token: "review", fill: "var(--color-yellow)", shown: "value", depth: 1 },
      { token: "done", fill: "var(--color-green)", shown: "value", depth: 0 },
    ],
  },
  {
    id: "priority",
    name: "EXAMPLE_PRIORITY",
    kind: "tag",
    side: "left",
    values: [
      { token: "none", fill: "var(--color-base-50)", shown: "empty", depth: 0 },
      { token: "low", fill: "var(--color-base-60)", shown: "value", depth: 0 },
      { token: "med", fill: "var(--color-yellow)", shown: "value", depth: 0 },
      { token: "high", fill: "var(--color-red)", shown: "value", depth: 0 },
    ],
  },
];

export interface PreviewFields {
  fields: readonly PreviewField[];
  /** true — показан пример, и об этом надо сказать в интерфейсе (ПЗ2). */
  example: boolean;
}

/**
 * Настоящие Fields из конфига; пусто — нет платформы или Fields. Как в
 * редакторе: цвет дочернего значения — у РОДИТЕЛЬСКОГО Field
 * (`parentFieldId`), решётка токена снимается.
 */
export function realFields(ctx: SettingsCtx): readonly PreviewField[] {
  const p = ctx.platform;
  if (!p) return [];
  try {
    const model = createFieldsModel({
      plugin: p.plugin as never,
      normalizePkmOrder: p.normalizePkmOrder as never,
      pkmOrderFields: p.pkmOrderFields,
      cfg: p.getConfig() as never,
      deepState,
    });
    const out: PreviewField[] = [];
    for (const row of model.listLineFields()) {
      /* Дочерность — уровень значения в Values, не строка (В7). */
      if (row.parent) continue;
      const values: PreviewValue[] = [];
      if (row.kind !== "element") {
        const ve = model.valuesEditor(row.key);
        const fieldId = ve.parentFieldId || row.strictName;
        const push = (token: string, depth: 0 | 1): void => {
          const tok = String(token || "").trim();
          if (!tok) return;
          const visual = model.getValueVisual(fieldId, tok);
          values.push({
            token: bareToken(tok),
            fill: visual.fillColor,
            text: visual.textColor,
            shown: visual.visibility === "default" ? "value" : visual.visibility,
            custom: visual.customText,
            depth,
          });
        };
        for (const top of ve.tree) {
          push(top.token, 0);
          for (const child of top.children || []) push(child.token, 1);
        }
      }
      /* `name` — строгое (`Name`), `short` — `Name in TagWheel`; списки
         (`Field for the Bars`) читают строгое (2026-09-07, У-32). */
      /* Custom block пишется у каретки — в предпросмотр Left/Right не идёт (10.13.260). */
      if (row.side !== "left" && row.side !== "right") continue;
      out.push({
        id: row.key,
        name: row.strictName || row.key,
        short: row.label,
        /* Command Field сюда не доходит: `listLineFields`. */
        kind: row.kind === "wikilink" ? "link" : row.kind as "tag" | "element",
        side: row.side,
        values,
      });
    }
    return out;
  } catch (e) {
    /* Украшение: панель не роняет, покажет пример; сообщение разработчику (З8). */
    console.error("inline-overhaul: Fields для предпросмотра не прочитались", e);
    return [];
  }
}

/** Чип Field в custom block: имя и вид, Values не нужны. */
export interface PreviewChip {
  name: string;
  short?: string;
  kind: string;
}

/**
 * Custom block с их Fields, как в списке Fields — с Command Field: предпросмотр
 * строки рисует их под текстом (его пункт «Новое» 2026-10-04). Нет платформы — пусто.
 */
export function previewCustomBlocks(ctx: SettingsCtx): ReadonlyArray<{ name: string; fields: readonly PreviewChip[] }> {
  const p = ctx.platform;
  if (!p) return [];
  try {
    const model = createFieldsModel({
      plugin: p.plugin as never,
      normalizePkmOrder: p.normalizePkmOrder as never,
      pkmOrderFields: p.pkmOrderFields,
      cfg: p.getConfig() as never,
      deepState,
    });
    const rows = model.listFields().filter(r => !r.parent);
    return model.listBlocks().map(b => ({
      name: b.name,
      fields: rows.filter(r => r.side === `custom:${b.id}`)
        .map(r => ({ name: r.strictName || r.key, short: r.label, kind: r.kind })),
    }));
  } catch (e) {
    /* Украшение: предпросмотр рисуется без custom block; сообщение разработчику (З8). */
    console.error("inline-overhaul: custom block для предпросмотра не прочитались", e);
    return [];
  }
}

/** Fields для предпросмотра (П11): настоящие, иначе пример (ПЗ2). */
export function previewFields(ctx: SettingsCtx): PreviewFields {
  const real = realFields(ctx);
  if (real.length) return { fields: real, example: false };
  /* Имя примера — из каталога, на выходе (У-32). */
  const named = EXAMPLE_FIELDS.map(f => ({ ...f, name: frame(ctx, f.name) }));
  return { fields: named, example: true };
}

/**
 * Fields для выпадающего списка — только настоящие, без примера (Р8, дефект
 * 1.5.3.2). `kind` фильтрует вызывающий.
 */
export function fieldOptions(
  ctx: SettingsCtx,
  keep?: (f: PreviewField) => boolean,
): ReadonlyArray<{ value: string; label: string }> {
  return realFields(ctx)
    .filter(f => (keep ? keep(f) : true))
    .map(f => ({ value: f.id, label: f.name || f.id }));
}

/**
 * Место в выдуманной строке (П13): имя из текста — сперва id, иначе следующий
 * свободный Field. Местам без Field записи нет — меньше чипов, не пустота.
 */
export function resolveSlots(
  fields: readonly PreviewField[],
  slots: readonly string[],
): Map<string, PreviewField> {
  const out = new Map<string, PreviewField>();
  const taken = new Set<string>();
  const want: string[] = [];
  for (const slot of slots) {
    const name = String(slot || "").trim();
    if (name && !want.includes(name)) want.push(name);
  }
  /* Сначала совпадения по id. */
  for (const slot of want) {
    const hit = fields.find(f => f.id === slot);
    if (!hit) continue;
    out.set(slot, hit);
    taken.add(hit.id);
  }
  /* Остальным местам — Fields по порядку строки: левый Block, потом правый. */
  const rest = fields.filter(f => !taken.has(f.id));
  let at = 0;
  for (const slot of want) {
    if (out.has(slot)) continue;
    const next = rest[at];
    if (!next) break;
    at++;
    out.set(slot, next);
  }
  return out;
}

/** Fields одной стороны строки, в порядке записи. */
export function fieldsOn(fields: readonly PreviewField[], side: "left" | "right"): readonly PreviewField[] {
  return fields.filter(f => f.side === side);
}

/**
 * Значение для показа: без решётки и скобок ссылки. Не `wikilinkTargetOf` и не
 * `unwrapWikilinkToken` (`shared_utils.js`) — вопрос зрительный (У-103).
 * Решётка снимается ДО скобок: `#[[a]]` → `a` (`tools/form_divergence.js`).
 */
export function bareToken(token: string): string {
  return String(token || "").trim().replace(/^#/, "").replace(/^\[\[|\]\]$/g, "");
}

/**
 * Цвет вида Field — одна карта на панель: таблица Fields и чип предпросмотра
 * (C20, У-32). Переменные `styles.css`, не акцент темы (З6). `wikilink` у
 * схемы и `link` у предпросмотра — шов.
 */
export const TYPE_COLOR: Record<string, string> = {
  tag: "var(--io-type-tag)",
  wikilink: "var(--io-type-link)",
  link: "var(--io-type-link)",
  element: "var(--io-type-element)",
  command: "var(--io-type-command)",
};

/** Цвет вида по его имени. Неизвестный вид красится как тег. */
export function typeColor(kind: string): string {
  return TYPE_COLOR[kind] ?? "var(--io-type-tag)";
}

/** Текст поверх цвета вида: на янтаре тега — тёмный бренда (`В-198`), иначе белый темы. */
export function typeInk(kind: string): string {
  return typeColor(kind) === "var(--io-type-tag)" ? "var(--io-type-tag-ink)" : "var(--text-on-accent)";
}

/** Field по id: предпросмотрам нужны конкретные, а не первый попавшийся. */
export function fieldById(fields: readonly PreviewField[], id: string): PreviewField | null {
  return fields.find(f => f.id === id) || null;
}

/** Value на глубине `depth` среди верхних — не по токену: дерево общее для примера и настоящих. */
export function valueAtDepth(f: PreviewField | null, depth: number): PreviewValue | null {
  if (!f) return null;
  const tops = f.values.filter(v => v.depth === 0);
  if (!tops.length) return null;
  return tops[depth % tops.length] as PreviewValue;
}

/** Первая пара «значение и подзначение»; без подзначений — `child: null`. */
export function valuePair(f: PreviewField): { parent: PreviewValue | null; child: PreviewValue | null } {
  for (let i = 0; i < f.values.length; i++) {
    const here = f.values[i] as PreviewValue;
    const next = f.values[i + 1];
    if (here.depth === 0 && next && next.depth === 1) return { parent: here, child: next };
  }
  return { parent: f.values.find(v => v.depth === 0) || null, child: null };
}
