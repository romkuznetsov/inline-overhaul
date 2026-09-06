/**
 * Данные для живых предпросмотров (PRD 10.3 П1).
 *
 * Предпросмотр показывает результат текущих настроек на **выдуманной строке**,
 * а не на заметке пользователя. Настройки в нём настоящие — они читаются из
 * конфига; Fields и Values пока примерные, и панель об этом говорит.
 *
 * Откуда берутся Fields (П11, закрыто 2026-08-28). Настоящие — из конфига,
 * тем же чтением, что у редактора Fields и у блока свойств заметки: модель
 * `fields_model.ts`. Второй разбор того же формата разошёлся бы с первым на
 * ближайшей правке, ровно как второй рендерер тегов разошёлся бы с виджетом
 * редактора (П9), — поэтому своего разбора здесь нет ни строки.
 *
 * Пример остаётся ровно на два случая: панель без платформы (её передаёт
 * плагин, а в проверках — обвязка) и vault, в котором Fields ещё не завели.
 * Тогда `example` равен true, и панель говорит об этом вслух (ПЗ2).
 */

import type { SettingsCtx } from "../types.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";

/*
 * Помощники состояния дерева значений — оттуда же, откуда их берут редактор
 * Fields и блок свойств заметки: у поиска есть откат на заглушку, и двух
 * таких откатов быть не должно.
 */
import legacy from "./fields_editor_legacy.js";

interface LegacyModule {
  getOrderDeepEditorState: () => DeepState;
}

const helpers = legacy as unknown as LegacyModule;

/** Как Value показывается на строке: значением, ничем или своим текстом. */
export type ValueShown = "value" | "empty" | "custom";

export interface PreviewValue {
  /** Без решётки: её добавляет отрисовка, если включены маркеры. */
  token: string;
  /** Цвет заливки. Только переменная темы или значение из конфига (З6). */
  fill: string;
  /** Цвет текста; пусто — берётся из темы. */
  text?: string;
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
 * Пример на время, пока Fields не читаются из конфига. Взят из стартового
 * набора ПЗ1 — `Status` и `Priority`, — и дополнен двумя значениями, без
 * которых группе нечего показывать: подзначением (иначе не видно разницы
 * между слитным и раздельным написанием) и значением с показом `empty`
 * (иначе не видно, как выглядит Value без текста).
 *
 * Цвета — переменные темы, не литералы (З6): пример обязан читаться и в
 * светлой теме, и в тёмной.
 */
export const EXAMPLE_FIELDS: readonly PreviewField[] = [
  {
    id: "status",
    name: "Status",
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
    name: "Priority",
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
 * Настоящие Fields из конфига. Пусто — читать было нечем: либо платформы нет,
 * либо Fields ещё не завели.
 *
 * Форма значения повторяет редактор поле в поле, включая две тонкости,
 * купленные его дефектами: цвет дочернего значения лежит у РОДИТЕЛЬСКОГО
 * Field (`parentFieldId`), а не у дочернего, и токен в конфиге хранится с
 * решёткой — её ставит отрисовка пузыря, поэтому здесь она снимается.
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
      deepState: helpers.getOrderDeepEditorState(),
    });
    const out: PreviewField[] = [];
    for (const row of model.listFields()) {
      /* Дочерний Field своей строки не имеет: дочерность — уровень значения
         в таблице Values (решение заказчика 2026-08-28, вопрос В7). */
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
            token: tok.replace(/^#/, "").replace(/^\[\[|\]\]$/g, ""),
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
      out.push({
        id: row.key,
        name: row.label,
        kind: row.kind === "wikilink" ? "link" : row.kind,
        side: row.side,
        values,
      });
    }
    return out;
  } catch (e) {
    /* Предпросмотр не имеет права уронить панель: он показывает пример и
       говорит, что это пример. Сообщение — разработчику, а не человеку (З8). */
    console.error("inline-overhaul: Fields для предпросмотра не прочитались", e);
    return [];
  }
}

/**
 * Fields для предпросмотра (П11). Настоящие — из конфига; пример — только
 * когда читать нечего, и тогда панель об этом говорит (ПЗ2).
 */
export function previewFields(ctx: SettingsCtx): PreviewFields {
  const real = realFields(ctx);
  if (real.length) return { fields: real, example: false };
  return { fields: EXAMPLE_FIELDS, example: true };
}

/**
 * Fields для выпадающего списка. Списку нужны только настоящие: примерный
 * набор — иллюстрация прототипа (Р8), и предложить выбрать Field, которого у
 * человека нет, значит вернуть дефект 1.5.3.2 — настройка встанет в значение,
 * которого движок не найдёт.
 *
 * `kind` фильтруется вызывающим: полосам нужен тег, потому что цвет полосы —
 * это цвет Value, а он есть только у тега.
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
 * Место в выдуманной строке (П13).
 *
 * Тексты предпросмотров называют Fields именами примерного набора — `status`,
 * `priority`, — а у человека Fields свои. Поэтому имя из текста читается не
 * как id, а как **место**: сначала ищется Field с таким id, потом берётся
 * следующий свободный. Так одно и то же дерево читается и против примерных
 * Fields, и против настоящих — этого и требует П13.
 *
 * Возвращается карта места на Field. Места, которым Field не хватило, в карту
 * не попадают: строка тогда несёт меньше чипов, а не пустое место.
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
  /* Сначала совпадения по имени: у кого Field и правда назван `status`,
     дерево обязано лечь на него, а не на первый по порядку. */
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
 * Цвет вида Field — одна карта на всю панель.
 *
 * Раньше вид красился в двух местах по-разному: левая колонка редактора Fields
 * брала эти переменные, а чип в предпросмотре — заливку **первого Value**
 * тега. Из-за этого один и тот же Field выглядел в таблице коричневым, а в
 * предпросмотре — цветом своего первого значения, и человек читал их как два
 * разных (замечание заказчика C20, 2026-09-02). Два объявления одного правила
 * расходятся молча (У-32), поэтому карта здесь одна и обе стороны берут её.
 *
 * Значения лежат в `styles.css` переменными: цвет вида намеренно не совпадает
 * с акцентом темы — акцент занят основными действиями (З6, литералов нет).
 *
 * Ключи покрывают оба написания: схема зовёт ссылку `wikilink`,
 * предпросмотр — `link`, и это шов, а не расхождение.
 */
export const TYPE_COLOR: Record<string, string> = {
  tag: "var(--io-type-tag)",
  wikilink: "var(--io-type-link)",
  link: "var(--io-type-link)",
  element: "var(--io-type-element)",
};

/** Цвет вида по его имени. Неизвестный вид красится как тег. */
export function typeColor(kind: string): string {
  return TYPE_COLOR[kind] ?? "var(--io-type-tag)";
}

/** Цвет чипа Field: цвет его вида, тот же, что в таблице Fields. */
export function fieldColor(f: PreviewField): string {
  return typeColor(f.kind);
}

/** Field по id: предпросмотрам нужны конкретные, а не первый попавшийся. */
export function fieldById(fields: readonly PreviewField[], id: string): PreviewField | null {
  return fields.find(f => f.id === id) || null;
}

/**
 * Value, которое строка показывает для этого Field: то, что стоит на её
 * глубине, считая только значения верхнего уровня. Правило намеренно не
 * привязано к токену: одно и то же дерево читается и против примерных Fields,
 * и против настоящих, а токен привязал бы его к одним из них.
 */
export function valueAtDepth(f: PreviewField | null, depth: number): PreviewValue | null {
  if (!f) return null;
  const tops = f.values.filter(v => v.depth === 0);
  if (!tops.length) return null;
  return tops[depth % tops.length] as PreviewValue;
}

/**
 * Пара «значение и подзначение» — то, что показывает Value с ребёнком. Если
 * подзначений нет, вернётся одно значение: это не пустое состояние, а Field
 * без вложенности.
 */
export function valuePair(f: PreviewField): { parent: PreviewValue | null; child: PreviewValue | null } {
  for (let i = 0; i < f.values.length; i++) {
    const here = f.values[i] as PreviewValue;
    const next = f.values[i + 1];
    if (here.depth === 0 && next && next.depth === 1) return { parent: here, child: next };
  }
  return { parent: f.values.find(v => v.depth === 0) || null, child: null };
}
