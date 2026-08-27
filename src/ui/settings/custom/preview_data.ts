/**
 * Данные для живых предпросмотров (PRD 10.3 П1).
 *
 * Предпросмотр показывает результат текущих настроек на **выдуманной строке**,
 * а не на заметке пользователя. Настройки в нём настоящие — они читаются из
 * конфига; Fields и Values пока примерные, и панель об этом говорит.
 *
 * Почему не читаем Fields из конфига уже сейчас. Настоящие Fields лежат в
 * `pkm.behavior.leftMode.fields` вместе с деревом значений, подзначениями и
 * тремя картами цветов, и разбирает их редактор Fields — те самые 3400 строк,
 * которые переезжают в фазе 3b. Второй разбор того же формата разойдётся с
 * первым на ближайшей правке, ровно как второй рендерер тегов разойдётся с
 * виджетом редактора (П9). Поэтому здесь оставлен шов `previewFields`: в 3b
 * он начнёт отдавать настоящие Fields из того же чтения, что и редактор, а до
 * тех пор отдаёт пример и честно помечает его.
 */

import type { SettingsCtx } from "../types.ts";

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
 * Fields для предпросмотра. Шов: в фазе 3b здесь появится чтение конфига
 * рядом с редактором Fields, и `example` станет false у того, кто свои Fields
 * настроил.
 */
export function previewFields(_ctx: SettingsCtx): PreviewFields {
  return { fields: EXAMPLE_FIELDS, example: true };
}

/** Fields одной стороны строки, в порядке записи. */
export function fieldsOn(fields: readonly PreviewField[], side: "left" | "right"): readonly PreviewField[] {
  return fields.filter(f => f.side === side);
}

/**
 * Цвет чипа Field. У Field своего цвета нет: tag берёт заливку первого своего
 * Value, остальные — цвет своего вида. Литералов нет, только переменные темы
 * или то, что лежит в конфиге (З6).
 */
export function fieldColor(f: PreviewField): string {
  if (f.kind === "tag") {
    const first = f.values.find(v => v.depth === 0);
    if (first) return first.fill;
    return "var(--color-orange)";
  }
  return f.kind === "link" ? "var(--color-blue)" : "var(--color-green)";
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
