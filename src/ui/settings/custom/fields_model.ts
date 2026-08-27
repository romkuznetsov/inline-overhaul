/**
 * Модель редактора Fields (PRD 10.2, фаза 3b пункт 4).
 *
 * Зачем она есть. Пункт 4 переписывает вёрстку редактора по Ф1–Ф20, а записи
 * в конфиг обязан сохранить один в один: их семнадцать путей (Ф16) и они
 * закреплены картой `tests/fixtures/order_board_write_map.txt`. Если новая
 * вёрстка соберёт патчи заново, карта станет проверять не то, что было, а то,
 * что получилось — то есть перестанет быть проверкой.
 *
 * Поэтому записи вынесены сюда из доски **дословно**, а доска зовёт их отсюда.
 * Карта снимается с доски и обязана остаться прежней посимвольно: это и есть
 * доказательство, что вынос ничего не сдвинул. Новая вёрстка потом берёт те же
 * функции — и пишет ровно то же, ничего не переписывая.
 *
 * Что здесь есть и чего нет. Здесь только чтение конфига и сборка патчей: ни
 * одного обращения к DOM, ни одного `Notice`. Проверки, которые доска
 * показывала уведомлением, возвращаются кодом ошибки — текст остаётся у того,
 * кто рисует. Так модель одинаково работает и в доске, и в новой панели, и в
 * проверках на заглушке.
 */

import type { OrderState, PkmFieldsConfig, FieldKind, ValueVisibility } from "../types.ts";

/*
 * Динамическая форма. Перенесённый код ходит по конфигу и по дереву значений
 * произвольными ключами, и типизировать это строго значило бы переписать его,
 * а не перенести (Ф12). Настоящая форма конфига описана в `types.ts` (Ф16);
 * здесь — те же данные в том виде, в каком их читает перенесённый код.
 */
type Loose = any;

/* ---- то, чего модель ждёт снаружи ------------------------------------- */

/**
 * Плагин в том виде, в каком его зовёт редактор. Это не весь плагин: модель
 * специально видит от него только запись патча, чтение конфига и два вызова
 * наружу, которые редактор делал и делает.
 */
export interface FieldsPlugin {
  getConfig: () => PkmFieldsConfig;
  setConfigPatch: (patch: unknown, reason: string) => void;
  renameStrictNameInConfigNote?: (from: string, to: string) => Promise<unknown>;
  registerPkmCommands?: () => void;
}

/**
 * Помощники состояния из `src/core/order_deep_editor_state.js`: дерево
 * значений, применение дерева к Fields, нормализация значений. Модель их не
 * ищет сама — их отдаёт тот, кто её создаёт, потому что искать их надо в
 * одном месте: доска умеет откатиться на заглушку, если модуля нет, и двух
 * таких поисков быть не должно.
 */
export interface DeepState {
  __unavailable?: boolean;
  normalizeToken?: (raw: unknown, kind?: string) => string;
  normalizeCheckboxToken?: (raw: unknown) => string;
  buildTagTree?: (parentField: Loose, subField: Loose, kind: string, options?: Loose) => Loose[];
  applyTagTreeToFields?: (tree: Loose[], parentField: Loose, subField: Loose, kind: string) => Loose;
  denormToken?: (raw: unknown) => string;
}

export interface FieldsModelDeps {
  plugin: FieldsPlugin;
  /** Помощники состояния; без них редактор значений не работает. */
  deepState?: DeepState;
  /** Нормализация Order живёт в `main.js` и приходит швом (фаза 3b пункт 2). */
  normalizePkmOrder: (raw: unknown) => OrderState;
  /** Ключи Order, известные плагину помимо конфига. */
  pkmOrderFields: readonly string[];
  /** Конфиг, с которым отрисовывались: тот же объект, что читает доска. */
  cfg: PkmFieldsConfig;
}

/** Ответ мутации: текст ошибки показывает тот, кто рисует, а не модель. */
export interface WriteResult {
  ok: boolean;
  error?: string;
  /**
   * `false` — записи не было, потому что менять нечего. Отличать это от
   * успеха приходится: перерисовка на пустом месте сбрасывает фокус в поле
   * ввода, и человек теряет каретку посреди набора.
   */
  changed?: boolean;
  /**
   * Ключ, под которым Field лёг в конфиг. Имя из окна нормализуется, и
   * вёрстке нужен именно итог: по нему она выбирает новый Field.
   */
  key?: string;
}

/** Строка списка Fields для вёрстки (Ф1, Ф3, Ф4, Ф6). */
export interface FieldRow {
  key: string;
  /** Сторона: в какой Block Field пишется (Ф1). */
  side: "left" | "right";
  kind: FieldKind;
  /** Видимое имя Field. */
  label: string;
  /** Системный ключ: им Field назван в конфиге и в заметке конфига. */
  strictName: string;
  /** Ключ родителя, если это дочерний Field (Ф3, Ф20). */
  parent: string;
  /** Ключ дочернего Field, если он у этого Field есть. */
  subKey: string;
  property: string;
  active: "yes" | "no" | "hotkey_only";
  freeRoam: "off" | "minimal" | "full";
  enabled: boolean;
  /** Этот Field ведёт свой Block. */
  lead: boolean;
}

/** Цвет и видимость одного Value так, как их читает вёрстка (Ф7, Ф9). */
export interface ValueVisual {
  /** Пусто — цвет не задан и берётся из темы. */
  fillColor: string;
  textColor: string;
  visibility: ValueVisibility;
  customText: string;
}

/** Строка таблицы Values: значение верхнего уровня со своими дочерними (Ф7, Ф8). */
export interface ValueTreeRow {
  token: string;
  prefix?: string;
  prefixMode?: string;
  checkboxToken?: string;
  yamlProperty?: string;
  children?: ValueTreeRow[];
  __ioParentBinding?: string;
  __ioParentFieldId?: string;
}

/**
 * Адрес строки в таблице Values. Значение опознаётся по себе и по родителю, а
 * не по номеру: между чтением и записью строка могла переехать, а токен —
 * это то, что человек видит и правит.
 */
export interface ValueAt {
  /** 0 — Value верхнего уровня, 1 — дочернее (Ф8). */
  level: 0 | 1;
  token: string;
  /** Значение родителя; у верхнего уровня пусто. */
  parentToken: string;
}

/**
 * Предусловие Field: Field, без которого он не показывается, и, если нужно,
 * конкретное значение того Field (10.13.4).
 *
 * В конфиг это ложится двумя ключами самого Field, и оба у рантайма давно
 * есть: `dependsOn` — Field, которого он ждёт (`isFieldEnabled` в
 * `tagwheel_core.js` выключает Field, пока у того значения нет), и
 * `enabledForParentValues` — список значений, при которых он включается. Мы
 * пишем в список ровно одно значение: человек выбирает одно.
 */
export interface PrerequisiteState {
  /** Пусто — предусловия нет. */
  fieldId: string;
  /** Пусто — годится любое значение того Field. */
  value: string;
  /** Кого можно выбрать: тот же пул Fields, без себя и без петель. */
  candidates: Array<{ key: string; label: string }>;
  /** Значения выбранного Field; у `element` их нет. */
  values: Array<{ value: string; label: string }>;
}

/** Что можно выбрать родителем значения-ссылки: Field и его значения. */
export interface LinkParentChoice {
  fieldId: string;
  strictName: string;
  tokens: Array<{ value: string; label: string }>;
}

/**
 * Редактор значений одного Field. Снимок: дерево и всё вокруг него читается
 * один раз, на отрисовке, — так это работало в доске, и от этого зависят
 * патчи, которые уходят в конфиг.
 */
export interface ValuesEditor {
  available: boolean;
  kind: FieldKind;
  parentFieldId: string;
  subFieldId: string;
  /** Field и его дочерний Field в том виде, в каком они лежат в конфиге. */
  parentField: Loose;
  subField: Loose;
  /** Нормализация значения-чекбокса: её же зовёт вёрстка строки значения. */
  normalizeCheckbox: (raw: unknown) => string;
  tree: ValueTreeRow[];
  linkParents: LinkParentChoice[];
  inferLinkBinding: (token: string) => string;
  cloneTree: () => ValueTreeRow[];
  reorder: (
    srcLevel: number, srcParentToken: string, srcToken: string,
    dstLevel: number, dstParentToken: string, dstToken: string,
  ) => ValueTreeRow[] | null;
  saveTree: (nextTree: ValueTreeRow[], reason: string) => WriteResult;
  addToken: (raw: string) => WriteResult;
  /** Строка дерева по адресу; `null`, если её там уже нет. */
  rowAt: (tree: ValueTreeRow[], at: ValueAt) => ValueTreeRow | null;
  /** Правки дерева. Чистые: дерево на входе не меняется, возвращается новое. */
  editRow: (tree: ValueTreeRow[], at: ValueAt, patch: Partial<ValueTreeRow>) => ValueTreeRow[];
  removeRow: (tree: ValueTreeRow[], at: ValueAt) => ValueTreeRow[];
  /** Ф8: сделать Value дочерним или вернуть на верхний уровень. */
  toggleLevel: (tree: ValueTreeRow[], at: ValueAt) => ValueTreeRow[];
}

/** Редактор Field типа `element`: маркер, формат и то, как он шагает. */
export interface ElementEditor {
  fieldId: string;
  emoji: string;
  format: string;
  mode: string;
  incrementBy: number;
  command: string;
  customRaw: string[];
  setEmoji: (v: string) => void;
  setFormat: (v: string) => void;
  setMode: (v: string) => void;
  setIncrementBy: (v: number) => void;
  setCommand: (v: string) => void;
  setCustomRaw: (text: string) => void;
}

export interface OrderSnapshot {
  order: OrderState;
  leftMode: unknown[];
  rightMode: unknown[];
  elements: Record<string, unknown>;
  dates: Record<string, unknown>;
}

/* ---- мелочи, общие для чтения и записи -------------------------------- */

const STRICT_NAME_RE = /^[a-z0-9_\- ]+$/i;
const SUB_SUFFIX_RE = /_sub$/;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice() : [];
}

function behaviorOf(cfg: unknown): Record<string, unknown> {
  const pkm = asObject(asObject(cfg)["pkm"]);
  return asObject(pkm["behavior"]);
}

function modeFields(behavior: Record<string, unknown>, side: "leftMode" | "rightMode"): unknown[] {
  return asArray(asObject(behavior[side])["fields"]);
}

function idOf(row: unknown): string {
  return String(asObject(row)["id"] || "").trim();
}

/* ---- модель ------------------------------------------------------------ */

export function createFieldsModel(deps: FieldsModelDeps) {
  const { plugin, normalizePkmOrder, pkmOrderFields, cfg } = deps;

  const order = normalizePkmOrder(behaviorOf(cfg)["order"] ?? null);
  /**
   * Состояние Order, с которым работает вёрстка. Объект живой: доска меняет
   * его на месте и перерисовывается из него, поэтому модель отдаёт тот же
   * объект, а не копию. Копия развела бы два источника истины.
   */
  const orderState: OrderState = normalizePkmOrder(order);

  const inferSubKey = (parentKey: string): string => {
    const p = String(parentKey || "").trim();
    if (!p) return "";
    return `${p}_sub`;
  };

  const getOrderKeys = (): string[] => {
    const out: string[] = [];
    const push = (k: unknown): void => {
      const key = String(k || "").trim();
      if (!key || SUB_SUFFIX_RE.test(key)) return;
      if (!out.includes(key)) out.push(key);
    };
    for (const k of pkmOrderFields) push(k);
    for (const k of (orderState.left || [])) push(k);
    for (const k of (orderState.right || [])) push(k);
    for (const k of Object.keys(orderState.labels || {})) push(k);
    for (const k of Object.keys(orderState.strictNames || {})) push(k);
    for (const k of Object.keys(orderState.active || {})) push(k);
    for (const k of Object.keys(orderState.freeRoam || {})) push(k);
    for (const k of Object.keys(orderState.types || {})) push(k);
    return out;
  };

  const getFieldKind = (k: string): FieldKind => {
    const raw = String(orderState.types && orderState.types[k] ? orderState.types[k] : "")
      .trim().toLowerCase();
    if (raw === "tag" || raw === "wikilink" || raw === "element") return raw;
    return "tag";
  };

  /**
   * Ключ дочернего Field. Есть у Field типа `tag` и `wikilink`; у `element`
   * значений нет вовсе, и дочернего быть не может.
   *
   * История этой строки стоит того, чтобы её не переписывали заново. Ссылку
   * сюда добавляли 2026-08-27, в тот же день убирали — стрелка уровня уносила
   * значение, потому что ветка `wikilink` в `saveTree` писала только верхний
   * уровень дерева, — и в тот же день вернули, когда стало ясно, что рантайм
   * дочерние значения ссылки понимает: `getAllowedValues` берёт каталог из
   * `field.values` для всего, кроме `projects`, и фильтрует значения дочернего
   * Field по `allowedParentValues` одинаково для любого типа. Починена была не
   * стрелка, а запись.
   */
  const getSubKeyForParent = (k: string): string => {
    const kind = getFieldKind(k);
    if (kind !== "tag" && kind !== "wikilink") return "";
    return inferSubKey(k);
  };

  /**
   * Включён ли дочерний Field. Читается там, где состояние и лежит — в картах
   * `active` и `enabled`, — а не из списка Fields.
   *
   * Причина важная и куплена дефектом: настоящий `normalizePkmOrder` из
   * `main.js` **выбрасывает ключи `_sub` из `left` и `right`** (там
   * `normalizeList` пропускает всё, чего нет в наборе не-дочерних ключей).
   * Поэтому `listFields()` в живой панели строки дочернего Field не отдаёт, и
   * вёрстка, читавшая состояние оттуда, всегда видела «нет данных» и
   * показывала `yes`, что бы человек ни выбрал.
   *
   * Значение по умолчанию — то же, что было у кнопки старой доски: нет записи
   * в `active` — смотрим `enabled`, нет и его — считаем включённым.
   */
  const getSubActive = (subKey: string): "yes" | "no" => {
    const key = String(subKey || "").trim();
    if (!key) return "yes";
    const raw = String(
      (orderState.active && orderState.active[key])
      || (orderState.enabled && orderState.enabled[key] !== false ? "yes" : "no"),
    ).trim().toLowerCase();
    return raw === "no" ? "no" : "yes";
  };

  /** Ключи, которых нет ни в одном Block, дописываются в правый (как было). */
  const ensureAllKeys = (): void => {
    for (const k of getOrderKeys()) {
      if (orderState.left.includes(k) || orderState.right.includes(k)) continue;
      orderState.right.push(k);
    }
  };

  /**
   * Запись Order. Перенесена дословно, вместе с надгробиями: ключ, исчезнувший
   * из карты, обязан уйти в конфиг как `null`, иначе слияние патчей его
   * воскресит. Ради этого `replace` и существует.
   */
  const setOrderPatch = (
    patchObj: Partial<OrderState> | OrderState,
    reason: string,
    opts?: { replace?: boolean },
  ): void => {
    const live = plugin.getConfig();
    const current = normalizePkmOrder(behaviorOf(live)["order"] ?? null);
    const replace = !!(opts && opts.replace === true);
    const p = patchObj as Partial<OrderState>;
    const next = replace
      ? normalizePkmOrder(patchObj)
      : normalizePkmOrder({
        ...current,
        ...patchObj,
        lead: { ...current.lead, ...(p && p.lead ? p.lead : {}) },
        active: { ...current.active, ...(p && p.active ? p.active : {}) },
        freeRoam: { ...current.freeRoam, ...(p && p.freeRoam ? p.freeRoam : {}) },
        enabled: { ...current.enabled, ...(p && p.enabled ? p.enabled : {}) },
        types: { ...current.types, ...(p && p.types ? p.types : {}) },
        labels: { ...current.labels, ...(p && p.labels ? p.labels : {}) },
        strictNames: { ...current.strictNames, ...(p && p.strictNames ? p.strictNames : {}) },
      });
    const withTombstones = <T>(
      nextMap: Record<string, T> | undefined,
      curMap: Record<string, T> | undefined,
    ): Record<string, T | null> => {
      const out: Record<string, T | null> = { ...(nextMap || {}) };
      const cur = curMap || {};
      for (const k of Object.keys(cur)) {
        if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = null;
      }
      return out;
    };
    if (!replace) {
      const orderPatch = {
        ...next,
        lead: withTombstones(next.lead, current.lead),
      };
      plugin.setConfigPatch({ pkm: { behavior: { order: orderPatch } } }, reason);
      return;
    }
    const orderPatch = {
      ...next,
      lead: withTombstones(next.lead, current.lead),
      labels: withTombstones(next.labels, current.labels),
      strictNames: withTombstones(next.strictNames, current.strictNames),
      types: withTombstones(next.types, current.types),
      active: withTombstones(next.active, current.active),
      freeRoam: withTombstones(next.freeRoam, current.freeRoam),
      enabled: withTombstones(next.enabled, current.enabled),
    };
    plugin.setConfigPatch({ pkm: { behavior: { order: orderPatch } } }, reason);
  };

  const captureSnapshot = (): OrderSnapshot => {
    const behavior = behaviorOf(plugin.getConfig());
    return {
      order: normalizePkmOrder(behavior["order"] ?? null),
      leftMode: modeFields(behavior, "leftMode"),
      rightMode: modeFields(behavior, "rightMode"),
      elements: asObject(behavior["elements"]),
      dates: {},
    };
  };

  const applySnapshot = (snap: OrderSnapshot | null, reason?: string): void => {
    const s = snap && typeof snap === "object" ? snap : captureSnapshot();
    plugin.setConfigPatch({
      pkm: {
        behavior: {
          order: s.order,
          leftMode: { fields: Array.isArray(s.leftMode) ? s.leftMode : [] },
          rightMode: { fields: Array.isArray(s.rightMode) ? s.rightMode : [] },
          elements: s.elements || {},
        },
      },
    }, reason || "pkm:behavior:order:deep-draft-apply");
  };

  /* ---- перенос Field между Block и внутри Block (Ф1–Ф3) ---------------- */

  /**
   * Дочерний Field ходит за родителем и на другую сторону сам не попадает
   * (Ф3, Ф20): в `moveKeys` он приписан к родителю, а не двигается отдельно.
   */
  const moveKey = (toPanel: "left" | "right", key: string, beforeKey?: string): void => {
    if (!key) return;
    const moveKeys = [key];
    const subKey = getSubKeyForParent(key);
    if (subKey && (orderState.left.includes(subKey) || orderState.right.includes(subKey))) {
      moveKeys.push(subKey);
    }
    orderState.left = orderState.left.filter(x => !moveKeys.includes(x));
    orderState.right = orderState.right.filter(x => !moveKeys.includes(x));
    const target = toPanel === "right" ? orderState.right : orderState.left;
    let idx = target.length;
    if (beforeKey) {
      const bi = target.indexOf(beforeKey);
      if (bi !== -1) idx = bi;
    }
    target.splice(idx, 0, ...moveKeys);
    setOrderPatch(orderState, "pkm:behavior:order:dnd");
  };

  /* ---- добавление Field (Ф5) ------------------------------------------- */

  const buildLeftFieldDefinition = (key: string, kind: FieldKind): Record<string, unknown> => {
    if (kind === "wikilink") {
      return { id: key, prefix: "#", source: `wikilinks:${key}`, placeholder: key, values: [""] };
    }
    return { id: key, prefix: "#", placeholder: key, values: [""] };
  };

  const buildRightElementFieldDefinition = (key: string): Record<string, unknown> => ({
    id: key,
    kind: "genericElement",
    marker: "",
    placeholder: key,
    values: [""],
  });

  const addField = (rawKey: string, rawKind: string): WriteResult => {
    const key = String(rawKey || "").replace(/\s+/g, " ").trim();
    if (!STRICT_NAME_RE.test(key)) {
      return { ok: false, error: "InlineOverhaul: name_strict must match [a-z0-9_- ]+" };
    }
    const all = getOrderKeys();
    if (SUB_SUFFIX_RE.test(key)) {
      return { ok: false, error: "InlineOverhaul: name_strict ending with _sub is reserved for generated child keys" };
    }
    if (all.includes(key)) {
      return { ok: false, error: "InlineOverhaul: field already exists" };
    }
    const strictValues = new Set(
      all.map(kk => String((orderState.strictNames && orderState.strictNames[kk]) || kk).trim())
        .filter(Boolean),
    );
    if (strictValues.has(key)) {
      return { ok: false, error: "InlineOverhaul: name_strict already exists" };
    }
    const kindRaw = String(rawKind || "tag").trim().toLowerCase();
    const kind: FieldKind = kindRaw === "wikilink" || kindRaw === "element" ? kindRaw : "tag";
    const subKey = kind === "tag" ? inferSubKey(key) : "";
    const subStrict = kind === "tag" ? `${key}_sub` : "";
    if (subStrict && strictValues.has(subStrict)) {
      return { ok: false, error: "InlineOverhaul: auto sub name_strict already exists" };
    }

    orderState.right = (orderState.right || []).concat([key]);
    orderState.labels = { ...(orderState.labels || {}), [key]: key };
    orderState.strictNames = { ...(orderState.strictNames || {}), [key]: key };
    orderState.types = { ...(orderState.types || {}), [key]: kind };
    orderState.active = { ...(orderState.active || {}), [key]: "yes" };
    orderState.freeRoam = { ...(orderState.freeRoam || {}), [key]: "off" };
    orderState.enabled = { ...(orderState.enabled || {}), [key]: true };
    if (subKey) {
      orderState.active[subKey] = "no";
      orderState.freeRoam[subKey] = "off";
      orderState.enabled[subKey] = false;
      orderState.types[subKey] = "tag";
      orderState.labels[subKey] = `${key} sub`;
      orderState.strictNames[subKey] = subStrict;
    }
    setOrderPatch({
      right: orderState.right.slice(),
      labels: { [key]: key },
      strictNames: { [key]: key },
      types: { [key]: kind },
      active: { [key]: "yes" },
      freeRoam: { [key]: "off" },
      enabled: { [key]: true },
      ...(subKey ? {
        labels: { [key]: key, [subKey]: `${key} sub` },
        strictNames: { [key]: key, [subKey]: subStrict },
        types: { [key]: kind, [subKey]: "tag" as FieldKind },
        active: { [key]: "yes", [subKey]: "no" },
        freeRoam: { [key]: "off", [subKey]: "off" },
        enabled: { [key]: true, [subKey]: false },
      } : {}),
    } as Partial<OrderState>, "pkm:behavior:order:add-field:" + key);

    const behavior = behaviorOf(plugin.getConfig());
    const leftMode = modeFields(behavior, "leftMode");
    const rightMode = modeFields(behavior, "rightMode");
    if (kind === "element") {
      if (!rightMode.find(f => idOf(f) === key)) {
        rightMode.push(buildRightElementFieldDefinition(key));
      }
    } else {
      if (!leftMode.find(f => idOf(f) === key)) {
        leftMode.push(buildLeftFieldDefinition(key, kind));
      }
      if (kind === "tag") {
        if (!leftMode.find(f => idOf(f) === subKey)) {
          leftMode.push({
            id: subKey,
            prefix: "#",
            enabled: false,
            dependsOn: key,
            disabledForParentValues: [],
            placeholder: "sub",
            values: [""],
          });
        }
      }
    }
    plugin.setConfigPatch(
      { pkm: { behavior: { leftMode: { fields: leftMode }, rightMode: { fields: rightMode } } } },
      "pkm:behavior:modes:add-field:" + key,
    );

    try {
      if (typeof plugin.registerPkmCommands === "function") plugin.registerPkmCommands();
    } catch { /* реестр команд не обязан быть готов: запись уже прошла */ }

    if (kind === "element") {
      const behaviorAfterMode = behaviorOf(plugin.getConfig());
      const elementsCfg = asObject(behaviorAfterMode["elements"]);
      const fields = asArray(elementsCfg["fields"]) as string[];
      if (!fields.includes(key)) fields.push(key);
      const byField = { ...asObject(elementsCfg["byField"]) };
      const cur = asObject(byField[key]);
      const curHotkey = asObject(cur["hotkey"]);
      const curIncrement = asObject(cur["increment"]);
      byField[key] = {
        ...cur,
        emoji: Object.prototype.hasOwnProperty.call(cur, "emoji") ? String(cur["emoji"] || "").trim() : "",
        format: Object.prototype.hasOwnProperty.call(cur, "format") ? String(cur["format"] ?? "") : "",
        hotkey: {
          increase: String(curHotkey["increase"] || "").trim(),
          decrease: String(curHotkey["decrease"] || "").trim(),
        },
        increment: {
          mode: "standard",
          incrementBy: 1,
          command: "now",
          customRaw: Array.isArray(curIncrement["customRaw"]) ? curIncrement["customRaw"] : [],
          custom: Array.isArray(curIncrement["custom"]) ? curIncrement["custom"] : [1],
        },
      };
      plugin.setConfigPatch(
        { pkm: { behavior: { elements: { fields, byField } } } },
        "pkm:behavior:elements:add-field:" + key,
      );
    }
    return { ok: true, key };
  };

  /* ---- удаление Field (Ф6) --------------------------------------------- */

  /**
   * Удаление уже подтверждено: спрашивает тот, кто рисует. Модель только
   * выносит Field из Order, из обоих Block и из элементов — тремя записями,
   * как и раньше, потому что порядок записей виден в undo.
   */
  const deleteField = (k: string): void => {
    const sub = getSubKeyForParent(k);
    const targets = [k].concat(sub ? [sub] : []);
    const liveOrder = normalizePkmOrder(behaviorOf(plugin.getConfig())["order"] ?? null);
    const nextOrder: OrderState = {
      ...liveOrder,
      left: (liveOrder.left || []).filter(x => !targets.includes(String(x || "").trim())),
      right: (liveOrder.right || []).filter(x => !targets.includes(String(x || "").trim())),
      lead: { ...(liveOrder.lead || {}) },
      labels: { ...(liveOrder.labels || {}) },
      strictNames: { ...(liveOrder.strictNames || {}) },
      types: { ...(liveOrder.types || {}) },
      active: { ...(liveOrder.active || {}) },
      freeRoam: { ...(liveOrder.freeRoam || {}) },
      enabled: { ...(liveOrder.enabled || {}) },
    };
    for (const t of targets) {
      delete nextOrder.labels[t];
      delete nextOrder.strictNames[t];
      delete nextOrder.types[t];
      delete nextOrder.active[t];
      delete nextOrder.freeRoam[t];
      delete nextOrder.enabled[t];
    }
    const leftLead = String(nextOrder.lead && nextOrder.lead.left ? nextOrder.lead.left : "").trim();
    const rightLead = String(nextOrder.lead && nextOrder.lead.right ? nextOrder.lead.right : "").trim();
    if (targets.includes(leftLead)) nextOrder.lead.left = "";
    if (targets.includes(rightLead)) nextOrder.lead.right = "";
    orderState.left = nextOrder.left.slice();
    orderState.right = nextOrder.right.slice();
    orderState.lead = { ...(nextOrder.lead || {}) };
    orderState.labels = { ...nextOrder.labels };
    orderState.strictNames = { ...nextOrder.strictNames };
    orderState.types = { ...nextOrder.types };
    orderState.active = { ...nextOrder.active };
    orderState.freeRoam = { ...nextOrder.freeRoam };
    orderState.enabled = { ...nextOrder.enabled };
    setOrderPatch(nextOrder, "pkm:behavior:order:delete:" + k, { replace: true });

    const behavior = behaviorOf(plugin.getConfig());
    /*
     * Предусловие, показывавшее на удалённый Field, снимается здесь же.
     * Оставить его нельзя: `reconcileModeDependencies` в
     * `pkm_rules_runtime_helpers.js`, не найдя `dependsOn` в своём списке,
     * выключает Field целиком — человек удалил один Field, а замолчал другой,
     * и в панели он при этом показан включённым.
     */
    const dropDangling = (row: unknown): unknown => {
      const obj = asObject(row);
      const dep = String(obj["dependsOn"] || "").trim();
      if (!dep || !targets.includes(dep)) return row;
      const next = { ...obj };
      delete next["dependsOn"];
      delete next["enabledForParentValues"];
      return next;
    };
    /* Дочерний Field уходит вместе с родителем с обеих сторон: у ссылки он
       лежит в `rightMode`, и без этого остался бы сиротой. */
    const leftFields = modeFields(behavior, "leftMode")
      .filter(f => {
        const id = idOf(f);
        return id !== k && (!sub || id !== sub);
      })
      .map(dropDangling);
    const rightFields = modeFields(behavior, "rightMode")
      .filter(f => {
        const id = idOf(f);
        return id !== k && (!sub || id !== sub);
      })
      .map(dropDangling);
    const elementsCfg = asObject(behavior["elements"]);
    const elementsFields = asArray(elementsCfg["fields"]).filter(x => String(x || "").trim() !== k);
    const elementsByField = { ...asObject(elementsCfg["byField"]) };
    delete elementsByField[k];
    plugin.setConfigPatch({
      pkm: {
        behavior: {
          leftMode: { fields: leftFields },
          rightMode: { fields: rightFields },
          elements: { ...elementsCfg, fields: elementsFields, byField: elementsByField },
        },
      },
    }, "pkm:behavior:delete-field:" + k);
  };

  /* ---- поля строки Field ------------------------------------------------ */

  /**
   * Системное имя. Оно же имя Field в заметке конфига, поэтому после записи
   * идёт переименование в заметке — и идёт именно после, как было: сначала
   * конфиг, потом заметка, иначе при отказе заметки конфиг остаётся старым.
   */
  const setStrictName = async (k: string, rawNext: string): Promise<WriteResult> => {
    const oldName = String((orderState.strictNames && orderState.strictNames[k]) || k);
    const next = String(rawNext || "").replace(/\s+/g, " ").trim();
    if (next === oldName) return { ok: true, changed: false };
    if (!STRICT_NAME_RE.test(next)) {
      return { ok: false, error: "InlineOverhaul: name_strict must match [a-z0-9_- ]+" };
    }
    const taken = new Set<string>();
    for (const kk of getOrderKeys()) {
      const vv = String((orderState.strictNames && orderState.strictNames[kk]) || kk).trim();
      if (kk === k) continue;
      if (vv) taken.add(vv);
    }
    if (taken.has(next)) {
      return { ok: false, error: "InlineOverhaul: name_strict already exists" };
    }
    orderState.strictNames = { ...(orderState.strictNames || {}), [k]: next };
    setOrderPatch({ strictNames: { [k]: next } }, "pkm:behavior:order:strict:" + k);
    try {
      if (typeof plugin.renameStrictNameInConfigNote === "function") {
        await plugin.renameStrictNameInConfigNote(oldName, next);
      }
    } catch (e) {
      console.error("[inline-overhaul][strict-rename:config-note]", e);
    }
    return { ok: true };
  };

  const setLabel = (k: string, rawValue: string): WriteResult => {
    const v = String(rawValue || "").trim();
    if (!v) return { ok: false };
    orderState.labels = { ...(orderState.labels || {}), [k]: v };
    setOrderPatch(orderState, "pkm:behavior:order:label:" + k);
    return { ok: true };
  };

  /**
   * Свойство заметки у Field. Второй записью значение расходится по Values,
   * которые его унаследовали: у кого стояло старое значение поля или ничего,
   * тому проставляется новое. Тот, кто выставил своё, не трогается.
   */
  const setProperty = (k: string, rawNext: string): WriteResult => {
    const prev = String((orderState.propertiesByField && orderState.propertiesByField[k]) || "").trim();
    const next = String(rawNext || "").trim();
    orderState.propertiesByField = { ...(orderState.propertiesByField || {}) };
    if (next) orderState.propertiesByField[k] = next;
    else delete orderState.propertiesByField[k];
    setOrderPatch({ propertiesByField: { [k]: next || null } } as Partial<OrderState>,
      "pkm:behavior:order:yaml:" + k);

    const behaviorNow = behaviorOf(plugin.getConfig());
    const leftFieldsNow = modeFields(behaviorNow, "leftMode");
    const rightFieldsNow = modeFields(behaviorNow, "rightMode");
    const strictNameNow = String((orderState.strictNames && orderState.strictNames[k]) || k).trim() || k;
    const subKeyNow = getSubKeyForParent(k) || "";
    const findByOrderKey = (arr: unknown[], key: string): Record<string, unknown> | null => {
      const kk = String(key || "").trim();
      if (!kk || !Array.isArray(arr)) return null;
      const strict = String((orderState.strictNames && orderState.strictNames[kk]) || kk).trim() || kk;
      for (let i = 0; i < arr.length; i++) {
        const row = arr[i] && typeof arr[i] === "object" ? asObject(arr[i]) : null;
        if (!row) continue;
        const id = String(row["id"] || "").trim();
        const ok = String(row["orderKey"] || "").trim();
        if (ok === kk || ok === strict || id === kk || id === strict) return row;
      }
      return null;
    };
    const parentFieldNow = findByOrderKey(leftFieldsNow, k) || findByOrderKey(rightFieldsNow, k);
    const subFieldNow = subKeyNow
      ? (findByOrderKey(leftFieldsNow, subKeyNow) || findByOrderKey(rightFieldsNow, subKeyNow))
      : null;
    const patchFieldValues = (field: Record<string, unknown> | null): Record<string, unknown> | null => {
      if (!field || !Array.isArray(field["values"])) return field;
      const values = (field["values"] as unknown[]).map(v => {
        const row = v && typeof v === "object" ? { ...asObject(v) } : v;
        if (!row || typeof row !== "object") return row;
        const cur = String((row as Record<string, unknown>)["yamlProperty"] || "").trim();
        const inheritedBefore = !cur || cur === prev;
        if (!inheritedBefore) return row;
        if (next) (row as Record<string, unknown>)["yamlProperty"] = next;
        else delete (row as Record<string, unknown>)["yamlProperty"];
        return row;
      });
      return { ...field, values };
    };
    const parentPatched = patchFieldValues(parentFieldNow);
    const subPatched = patchFieldValues(subFieldNow);
    const upsertById = (arr: unknown[], field: Record<string, unknown> | null): unknown[] => {
      if (!field || !field["id"] || !Array.isArray(arr)) return arr;
      const id = String(field["id"] || "").trim();
      const out = arr.slice();
      const idx = out.findIndex(x => idOf(x) === id);
      if (idx === -1) out.push(field);
      else out[idx] = field;
      return out;
    };
    const nextLeft = upsertById(upsertById(leftFieldsNow, parentPatched), subPatched);
    const nextRight = upsertById(upsertById(rightFieldsNow, parentPatched), subPatched);
    plugin.setConfigPatch(
      { pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } },
      "pkm:behavior:order:yaml-propagate:" + strictNameNow,
    );
    return { ok: true };
  };

  /**
   * Дочерний Field включается и выключается одной кнопкой. Записей две, и
   * порядок важен: сначала список Block, потом Order — так это работало.
   */
  const toggleSub = (subKey: string): WriteResult => {
    const cur = String((orderState.active && orderState.active[subKey]) || "yes").trim().toLowerCase();
    const next = cur === "no" ? "yes" : "no";
    orderState.active = { ...(orderState.active || {}), [subKey]: next };
    orderState.enabled = { ...(orderState.enabled || {}), [subKey]: next !== "no" };
    const leftMode = modeFields(behaviorOf(plugin.getConfig()), "leftMode");
    const idx = leftMode.findIndex(f => idOf(f) === subKey);
    if (idx !== -1) leftMode[idx] = { ...asObject(leftMode[idx]), enabled: next !== "no" };
    plugin.setConfigPatch(
      { pkm: { behavior: { leftMode: { fields: leftMode } } } },
      "pkm:behavior:leftmode:subtoggle:" + subKey,
    );
    setOrderPatch({ active: { [subKey]: next }, enabled: { [subKey]: next !== "no" } },
      "pkm:behavior:order:sub:" + subKey);
    return { ok: true };
  };

  const setFreeRoam = (k: string, rawMode: string): WriteResult => {
    const nextMode = String(rawMode || "off").trim().toLowerCase();
    const normalizedMode = nextMode === "minimal" || nextMode === "full" ? nextMode : "off";
    orderState.freeRoam = { ...(orderState.freeRoam || {}), [k]: normalizedMode };
    setOrderPatch({ freeRoam: { [k]: normalizedMode } }, "pkm:behavior:order:freeroam:" + k);
    return { ok: true };
  };

  const setActive = (k: string, rawActive: string): WriteResult => {
    const nextActive = String(rawActive || "yes").trim().toLowerCase();
    const normalized = nextActive === "no" || nextActive === "hotkey_only" ? nextActive : "yes";
    orderState.active = { ...(orderState.active || {}), [k]: normalized };
    orderState.enabled = { ...(orderState.enabled || {}), [k]: normalized !== "no" };
    setOrderPatch({ active: { [k]: normalized }, enabled: { [k]: normalized !== "no" } },
      "pkm:behavior:order:active:" + k);
    return { ok: true };
  };

  const setLead = (panelKey: "left" | "right", rawKey: string): WriteResult => {
    const next = String(rawKey || "").trim();
    const patchLead = { [panelKey]: next || "" };
    orderState.lead = { ...(orderState.lead || {}), [panelKey]: next || "" };
    setOrderPatch({ lead: patchLead }, `pkm:behavior:order:lead:${panelKey}`);
    return { ok: true };
  };

  const getPanelLeadCandidates = (panelKey: "left" | "right"): Array<{ key: string; label: string }> => {
    const arr = panelKey === "right" ? orderState.right : orderState.left;
    const seen = new Set<string>();
    const out: Array<{ key: string; label: string }> = [];
    for (const k of arr) {
      const key = String(k || "").trim();
      if (!key || SUB_SUFFIX_RE.test(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: String((orderState.labels && orderState.labels[key]) || key) });
    }
    return out;
  };

  /* ---- чтение для вёрстки ----------------------------------------------- */

  /**
   * Список Fields обеими сторонами, дочерний сразу за родителем. Это ровно
   * то, что рисует левая колонка: сторона строки и есть Block, в который
   * Field пишется (Ф1), а дочерний идёт за родителем и своей стороны не
   * имеет (Ф3).
   */
  const listFields = (): FieldRow[] => {
    const out: FieldRow[] = [];
    const rowFor = (key: string, side: "left" | "right", parent: string): FieldRow => {
      const activeRaw = String(
        (orderState.active && orderState.active[key])
        || (orderState.enabled && orderState.enabled[key] !== false ? "yes" : "no"),
      ).trim().toLowerCase();
      const freeRaw = String((orderState.freeRoam && orderState.freeRoam[key]) || "off").trim().toLowerCase();
      const leadKey = String((orderState.lead && orderState.lead[side]) || "").trim();
      return {
        key,
        side,
        kind: parent ? "tag" : getFieldKind(key),
        label: String((orderState.labels && orderState.labels[key]) || key),
        strictName: String((orderState.strictNames && orderState.strictNames[key]) || key),
        parent,
        subKey: parent ? "" : getSubKeyForParent(key),
        property: String((orderState.propertiesByField && orderState.propertiesByField[key]) || "").trim(),
        active: activeRaw === "no" || activeRaw === "hotkey_only" ? activeRaw : "yes",
        freeRoam: freeRaw === "minimal" || freeRaw === "full" ? freeRaw : "off",
        enabled: !(orderState.enabled && orderState.enabled[key] === false),
        lead: !parent && leadKey === key,
      };
    };
    for (const side of ["left", "right"] as const) {
      for (const raw of (side === "left" ? orderState.left : orderState.right)) {
        const key = String(raw || "").trim();
        if (!key || SUB_SUFFIX_RE.test(key)) continue;
        out.push(rowFor(key, side, ""));
        const sub = getSubKeyForParent(key);
        if (sub && (orderState.left.includes(sub) || orderState.right.includes(sub))) {
          out.push(rowFor(sub, side, key));
        }
      }
    }
    return out;
  };

  /* ---- предусловие Field (10.13.4) ----------------------------------- */

  /**
   * В каком списке лежит определение Field. Это не сторона строки: `leftMode`
   * держит определения тегов, `rightMode` — ссылок и элементов, независимо от
   * того, в каком Block Field пишется (`ensureBehaviorModesFromOrder` в
   * `main.js` раскладывает их именно так).
   *
   * Для предусловия это главное ограничение: `reconcileModeDependencies` в
   * `pkm_rules_runtime_helpers.js` ищет `dependsOn` **внутри своего списка** и,
   * не найдя, выключает Field целиком. Значит предложить в предусловие можно
   * только соседа по списку.
   */
  const poolOf = (fieldId: string): "leftMode" | "rightMode" | "" => {
    const behavior = behaviorOf(plugin.getConfig());
    const fid = String(fieldId || "").trim();
    if (!fid) return "";
    if (modeFields(behavior, "leftMode").some(f => idOf(f) === fid)) return "leftMode";
    if (modeFields(behavior, "rightMode").some(f => idOf(f) === fid)) return "rightMode";
    return "";
  };

  const fieldObject = (fieldId: string): Record<string, unknown> => {
    const behavior = behaviorOf(plugin.getConfig());
    const fid = String(fieldId || "").trim();
    for (const side of ["leftMode", "rightMode"] as const) {
      const found = modeFields(behavior, side).find(f => idOf(f) === fid);
      if (found) return asObject(found);
    }
    return {};
  };

  /**
   * Ведёт ли цепочка `dependsOn` от `from` обратно к `to`. Петля здесь не
   * косметика: `clearDependentSelections` в `status_line_runtime_unified.js`
   * обходит детей рекурсивно и без списка пройденных, поэтому кольцо из двух
   * Fields повесило бы Obsidian. Замкнуть его не даёт эта проверка.
   */
  const dependsChainReaches = (from: string, to: string): boolean => {
    let at = String(from || "").trim();
    const seen = new Set<string>();
    let guard = 0;
    while (at && guard++ < 64) {
      if (at === to) return true;
      if (seen.has(at)) return false;
      seen.add(at);
      at = String(fieldObject(at)["dependsOn"] || "").trim();
    }
    return false;
  };

  /** Значения Field так, как их видит рантайм: `id`, а при его отсутствии — токен. */
  const valueIdsOf = (fieldId: string): Array<{ value: string; label: string }> => {
    const out: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    for (const raw of asArray(fieldObject(fieldId)["values"])) {
      const row = asObject(raw);
      const token = String(row["token"] || "").trim();
      const id = String(row["id"] || token).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({ value: id, label: token || id });
    }
    return out;
  };

  const getPrerequisite = (k: string): PrerequisiteState => {
    const key = String(k || "").trim();
    const self = fieldObject(key);
    const fieldId = String(self["dependsOn"] || "").trim();
    const allowed = asArray(self["enabledForParentValues"])
      .map(x => String(x || "").trim())
      .filter(Boolean);
    const pool = poolOf(key);
    const candidates: Array<{ key: string; label: string }> = [];
    for (const row of listFields()) {
      /*
       * Дочерний Field в предусловие не годится: его `dependsOn` уже занят
       * родителем, и он сам показывается только под ним.
       */
      if (row.parent || row.key === key) continue;
      if (pool && poolOf(row.key) !== pool) continue;
      if (dependsChainReaches(row.key, key)) continue;
      candidates.push({ key: row.key, label: row.strictName || row.key });
    }
    return {
      fieldId,
      value: fieldId ? String(allowed[0] || "") : "",
      candidates,
      values: fieldId ? valueIdsOf(fieldId) : [],
    };
  };

  /**
   * Записать предусловие. Пустой `rawFieldId` снимает его целиком: остаться
   * `enabledForParentValues` без `dependsOn` не может — рантайм читает его
   * только вместе с ним, и повисший список однажды стал бы сюрпризом.
   */
  const setPrerequisite = (k: string, rawFieldId: string, rawValue: string): WriteResult => {
    const key = String(k || "").trim();
    const side = poolOf(key);
    if (!side) return { ok: false, error: "InlineOverhaul: field is not in the config yet" };
    const fieldId = String(rawFieldId || "").trim();
    const value = String(rawValue || "").trim();
    if (fieldId && (fieldId === key || dependsChainReaches(fieldId, key))) {
      return { ok: false, error: "InlineOverhaul: a Field cannot wait for itself" };
    }
    const list = modeFields(behaviorOf(plugin.getConfig()), side);
    const idx = list.findIndex(f => idOf(f) === key);
    if (idx === -1) return { ok: false, error: "InlineOverhaul: field is not in the config yet" };
    const next = { ...asObject(list[idx]) };
    if (fieldId) {
      next["dependsOn"] = fieldId;
      if (value) next["enabledForParentValues"] = [value];
      else delete next["enabledForParentValues"];
    } else {
      delete next["dependsOn"];
      delete next["enabledForParentValues"];
    }
    list[idx] = next;
    plugin.setConfigPatch(
      { pkm: { behavior: { [side]: { fields: list } } } },
      "pkm:behavior:order:prerequisite:" + key,
    );
    return { ok: true };
  };

  /* ---- цвет и видимость Value (Ф9) ------------------------------------- */

  /** Только `#rrggbb`; всё остальное — «цвета нет», и его даст тема (З6). */
  const normalizeHex = (value: unknown): string => {
    const s = String(value || "").trim().toLowerCase();
    if (!s) return "";
    return /^#[0-9a-f]{6}$/.test(s) ? s : "";
  };

  const normalizeVisibility = (value: unknown): ValueVisibility => {
    const s = String(value || "default").trim().toLowerCase();
    return s === "empty" || s === "custom" ? s : "default";
  };

  const getValueVisual = (fieldId: string, token: string): ValueVisual => {
    const fid = String(fieldId || "").trim();
    const tok = String(token || "").trim();
    const visuals = asObject(behaviorOf(plugin.getConfig())["tagVisuals"]);
    const byTag = asObject(visuals["byTag"]);
    const fm = fid ? asObject(byTag[fid]) : {};
    const row = tok ? asObject(fm[tok]) : {};
    return {
      fillColor: normalizeHex(row["fillColor"]),
      textColor: normalizeHex(row["textColor"]),
      visibility: normalizeVisibility(row["visibility"]),
      customText: String(row["customText"] || "").trim(),
    };
  };

  /**
   * Запись цвета и видимости Value. Строка пишется целиком, а не по одному
   * полю: недостающие берутся из текущей — так это работало, и от этого
   * зависит, что уходит в конфиг.
   *
   * Цвета живут в `pkm.behavior.tagVisuals.byTag`, а таблица 8.1 ведёт эту
   * ветку в `visual.tags.byTag`: путь надо провести миграцией фазы 2, иначе
   * цвета Values потеряются (Ф16).
   */
  const setValueVisual = (
    fieldId: string,
    token: string,
    patch: Partial<ValueVisual>,
    reason?: string,
  ): void => {
    const fid = String(fieldId || "").trim();
    const tok = String(token || "").trim();
    if (!fid || !tok || tok.charAt(0) !== "#") return;
    const visuals = asObject(behaviorOf(plugin.getConfig())["tagVisuals"]);
    const byTag = asObject(visuals["byTag"]);
    const current = asObject(asObject(byTag[fid])[tok]);
    const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(patch, key);
    const next = {
      fillColor: has("fillColor") ? normalizeHex(patch.fillColor) : normalizeHex(current["fillColor"]),
      textColor: has("textColor") ? normalizeHex(patch.textColor) : normalizeHex(current["textColor"]),
      visibility: has("visibility") ? normalizeVisibility(patch.visibility) : normalizeVisibility(current["visibility"]),
      customText: has("customText") ? String(patch.customText || "").trim() : String(current["customText"] || "").trim(),
    };
    plugin.setConfigPatch(
      { pkm: { behavior: { tagVisuals: { byTag: { [fid]: { [tok]: next } } } } } },
      reason || "pkm:visuals:tag",
    );
  };

  /* ---- значения Field и element --------------------------------------- */

  const deep: DeepState = deps.deepState || {};
  const normToken = (raw: unknown, kind: string): string =>
    (typeof deep.normalizeToken === "function"
      ? deep.normalizeToken(raw, kind)
      : String(raw || "").trim());
  const normCheckbox = (raw: unknown): string =>
    (typeof deep.normalizeCheckboxToken === "function"
      ? deep.normalizeCheckboxToken(raw)
      : String(raw || "").trim());
  const denorm = (raw: unknown): string =>
    (typeof deep.denormToken === "function"
      ? deep.denormToken(raw)
      : String(raw || "").trim().replace(/^#/, ""));

  /**
   * Найти Field по ключу Order. Ищет и по системному имени: в конфиге Field
   * может быть назван либо ключом, либо системным именем, и обе связи живые.
   */
  const findFieldByOrderKey = (arr: Loose[], orderKey: string): Loose => {
    const key = String(orderKey || "").trim();
    if (!key) return null;
    const strict = String((orderState.strictNames && orderState.strictNames[key]) || key).trim() || key;
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const rid = String(row.id || "").trim();
      const rkey = String(row.orderKey || "").trim();
      if (rkey && (rkey === key || rkey === strict)) return row;
      if (rid && (rid === key || rid === strict)) return row;
    }
    return null;
  };

  const upsertField = (arr: Loose[], id: string, valueObj: Loose): Loose[] => {
    const listNext = Array.isArray(arr) ? arr.slice() : [];
    const idx = listNext.findIndex(x => x && String(x.id || "").trim() === String(id || "").trim());
    if (idx === -1) listNext.push(valueObj);
    else listNext[idx] = valueObj;
    return listNext;
  };

  const hasFieldById = (arr: Loose[], fieldId: string): boolean => {
    const fid = String(fieldId || "").trim();
    if (!fid || !Array.isArray(arr)) return false;
    for (let i = 0; i < arr.length; i++) {
      const row = arr[i];
      if (!row || typeof row !== "object") continue;
      if (String(row.id || "").trim() === fid) return true;
    }
    return false;
  };

  /** Строки собственного списка шагов: пустые выкидываются, остальное как есть. */
  const normalizeCustomRaw = (text: string): string[] =>
    String(text || "").split(/\r?\n/).map(x => String(x || "").trim()).filter(Boolean);

  /**
   * Список шагов в том виде, в каком его читает рантайм: `2 (3)` значит шаг
   * на два, три нажатия подряд. Если разобрать нечего, остаётся прежний.
   */
  const toNormalizedCustomIncrement = (rawList: Loose, fallbackList: Loose): number[] => {
    const src2 = Array.isArray(rawList) ? rawList : [];
    const out: number[] = [];
    for (let i = 0; i < src2.length; i++) {
      const row = String(src2[i] || "").trim();
      if (!row || /^END$/i.test(row)) continue;
      const m = row.match(/^(-?\d+)(?:\s*\(\s*(\d+)\s*\))?$/);
      if (!m) continue;
      const step = Math.max(0, Math.trunc(Number(m[1] || 0)));
      const repeat = Math.max(1, Math.trunc(Number(m[2] || 1)));
      for (let r = 0; r < repeat; r++) out.push(step);
    }
    if (out.length) return out;
    const fb = Array.isArray(fallbackList) ? fallbackList : [];
    return fb.map((x: Loose) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x: number) => Number.isFinite(x));
  };

  /**
   * Редактор Field типа `element`. Снимок конфига берётся один раз: так вела
   * себя доска, и от этого зависит, что уходит в патче — каждая запись несёт
   * строку целиком, а не одно поле.
   */
  const elementEditor = (k: string): ElementEditor => {
    const behavior = behaviorOf(plugin.getConfig());
    const rightMode = modeFields(behavior, "rightMode");
    const strictName = String((orderState.strictNames && orderState.strictNames[k]) || k).trim() || k;
    const elem = asObject(behavior["elements"]);
    const byField = asObject(elem["byField"]);
    const elementField = findFieldByOrderKey(rightMode, k) || findFieldByOrderKey(rightMode, strictName);
    const elementFieldId = String(elementField && elementField.id || "").trim() || String(k || "").trim();
    const curElem: Loose = byField[elementFieldId] || byField[k] || byField[strictName] || {};
    const cur: Loose = {
      ...curElem,
      increment: { ...(curElem && curElem.increment && typeof curElem.increment === "object" ? curElem.increment : {}) },
    };
    const inc: Loose = cur.increment;
    const write = (nextRow: Loose, reason: string): void => {
      plugin.setConfigPatch(
        { pkm: { behavior: { elements: { byField: { [elementFieldId]: nextRow } } } } },
        reason,
      );
    };
    const modeRaw = String(inc.mode || "increment").trim().toLowerCase();
    return {
      fieldId: elementFieldId,
      emoji: String(cur.emoji || ""),
      format: String(cur.format || ""),
      mode: ["increment", "command", "custom"].includes(modeRaw) ? modeRaw : "increment",
      incrementBy: Number.isFinite(Number(inc.incrementBy)) ? Number(inc.incrementBy) : 1,
      command: ["now", "randomN", "randomE"].includes(String(inc.command || "")) ? String(inc.command) : "now",
      customRaw: Array.isArray(inc.customRaw) ? inc.customRaw.map((x: Loose) => String(x || "")) : [],
      setEmoji: v => write({ ...cur, emoji: v }, "pkm:behavior:order:deep:emoji:" + k),
      setFormat: v => write({ ...cur, format: v }, "pkm:behavior:order:deep:format:" + k),
      setMode: v => write(
        { ...cur, increment: { ...inc, mode: String(v || "increment").trim().toLowerCase() } },
        "pkm:behavior:order:deep:mode:" + k,
      ),
      setIncrementBy: v => write(
        { ...cur, increment: { ...inc, mode: "increment", incrementBy: Number(v || 1) } },
        "pkm:behavior:order:deep:inc:" + k,
      ),
      setCommand: v => write(
        { ...cur, increment: { ...inc, mode: "command", command: String(v || "now") } },
        "pkm:behavior:order:deep:command:" + k,
      ),
      setCustomRaw: text => {
        const raw = normalizeCustomRaw(text);
        write(
          { ...cur, increment: { ...inc, mode: "custom", customRaw: raw, custom: toNormalizedCustomIncrement(raw, inc.custom) } },
          "pkm:behavior:order:deep:custom:" + k,
        );
      },
    };
  };

  /**
   * Редактор значений Field. Тоже снимок: дерево, поля Block и карта
   * чекбоксов читаются один раз. Все записи собраны здесь, потому что
   * значения — самая тонкая часть конфига: одно значение живёт сразу в
   * четырёх местах (список Block, дочерний список, свойство заметки,
   * префикс-чекбокс), и собирать это дважды нельзя.
   */
  const valuesEditor = (k: string): ValuesEditor => {
    const behavior = behaviorOf(plugin.getConfig());
    const leftMode = modeFields(behavior, "leftMode");
    const rightMode = modeFields(behavior, "rightMode");
    const strictName = String((orderState.strictNames && orderState.strictNames[k]) || k).trim() || k;
    const kind = getFieldKind(k);
    const parentField = findFieldByOrderKey(leftMode, k) || findFieldByOrderKey(rightMode, k);
    const subKey = `${k}_sub`;
    const subField = findFieldByOrderKey(leftMode, subKey) || findFieldByOrderKey(rightMode, subKey);
    const parentFieldId = String(parentField && parentField.id || "").trim();
    const subFieldId = String(subField && subField.id || "").trim();
    const parentInRight = hasFieldById(rightMode, parentFieldId);
    const subInRight = hasFieldById(rightMode, subFieldId);

    const prefixRules = asObject(behavior["prefixRules"]);
    const checkboxByFieldValue = asObject(prefixRules["checkboxByFieldValue"]);
    const parentCheckboxRaw = parentFieldId ? asObject(checkboxByFieldValue[parentFieldId]) : {};
    const subCheckboxRaw = subFieldId ? asObject(checkboxByFieldValue[subFieldId]) : {};
    const fieldCheckboxByToken: Record<string, string> = {};
    for (const rawToken of Object.keys(parentCheckboxRaw)) {
      const t = normToken(rawToken, kind);
      const cb = normCheckbox(parentCheckboxRaw[rawToken]);
      if (t && cb) fieldCheckboxByToken[t] = cb;
    }
    for (const rawToken of Object.keys(subCheckboxRaw)) {
      const t = normToken(rawToken, kind);
      const cb = normCheckbox(subCheckboxRaw[rawToken]);
      if (t && cb) fieldCheckboxByToken[t] = cb;
    }

    const tree: Loose[] = typeof deep.buildTagTree === "function"
      ? deep.buildTagTree(parentField, subField, kind, { checkboxByToken: fieldCheckboxByToken })
      : [];
    if (kind === "wikilink") {
      const vals: Loose[] = parentField && Array.isArray(parentField.values) ? parentField.values : [];
      const byTok: Loose = {};
      for (let vi = 0; vi < vals.length; vi++) {
        const row = vals[vi] && typeof vals[vi] === "object" ? vals[vi] : {};
        const tok = normToken(row.token, "wikilink");
        if (!tok) continue;
        byTok[tok] = row;
      }
      for (let ti = 0; ti < tree.length; ti++) {
        const trow = tree[ti] || {};
        const tok = normToken(trow.token, "wikilink");
        const meta = byTok[tok] && typeof byTok[tok] === "object" ? byTok[tok] : {};
        tree[ti] = {
          ...trow,
          __ioParentBinding: String(meta.__ioParentBinding || "").trim(),
          __ioParentFieldId: String(meta.__ioParentFieldId || "").trim(),
          prefixMode: String(meta.prefixMode || "bullet").trim().toLowerCase() === "checkbox" ? "checkbox" : "bullet",
          checkboxToken: String(meta.checkboxToken || "").trim(),
        };
      }
    }

    const buildLinkParents = (): LinkParentChoice[] => {
      const choices: LinkParentChoice[] = [];
      const seenField = new Set<string>();
      const orderKeys = getOrderKeys().filter(kk => !SUB_SUFFIX_RE.test(kk));
      const anyByOrderKey = (orderKey: string): Loose =>
        findFieldByOrderKey(leftMode, orderKey) || findFieldByOrderKey(rightMode, orderKey);
      for (let oi = 0; oi < orderKeys.length; oi++) {
        const kk = String(orderKeys[oi] || "").trim();
        if (!kk || kk === k) continue;
        const fk = anyByOrderKey(kk);
        if (!fk || !fk.id) continue;
        const source = String(fk.source || "").trim();
        if (source === "projects" || /^wikilinks:/.test(source)) continue;
        const fid = String(fk.id || "").trim();
        if (!fid || seenField.has(fid)) continue;
        seenField.add(fid);
        const strict = String(orderState.strictNames && orderState.strictNames[kk] ? orderState.strictNames[kk] : kk).trim() || kk;
        const vals: Loose[] = Array.isArray(fk.values) ? fk.values : [];
        const tokens: Array<{ value: string; label: string }> = [];
        const subByOrder = anyByOrderKey(`${kk}_sub`);
        const subFieldLocal = subByOrder && String(subByOrder.dependsOn || "").trim() === fid ? subByOrder : null;
        const subVals: Loose[] = subFieldLocal && Array.isArray(subFieldLocal.values) ? subFieldLocal.values : [];
        for (let vi = 0; vi < vals.length; vi++) {
          const row = vals[vi] && typeof vals[vi] === "object" ? vals[vi] : {};
          const ptok = normToken(row.token, "tag");
          if (!ptok) continue;
          tokens.push({ value: `p:${ptok}|f:${fid}`, label: ptok });
          for (let si = 0; si < subVals.length; si++) {
            const srow = subVals[si] && typeof subVals[si] === "object" ? subVals[si] : {};
            const allowed: Loose[] = Array.isArray(srow.allowedParentValues) ? srow.allowedParentValues : [];
            const hasParent = allowed.some((av: Loose) => normToken(av, "tag") === ptok);
            if (!hasParent) continue;
            const stok = normToken(srow.token, "tag");
            if (!stok) continue;
            tokens.push({ value: `s:${stok}|p:${ptok}|f:${fid}`, label: `└ ${stok} (${ptok})` });
          }
        }
        if (!tokens.length) continue;
        choices.push({ fieldId: fid, strictName: strict, tokens });
      }
      return choices;
    };

    const inferLinkBinding = (token: string): string => {
      const vals: Loose[] = parentField && Array.isArray(parentField.values) ? parentField.values : [];
      const normTarget = normToken(token, "wikilink");
      for (let i = 0; i < vals.length; i++) {
        const row = vals[i] && typeof vals[i] === "object" ? vals[i] : {};
        const rt = normToken(row.token, "wikilink");
        if (!rt || rt !== normTarget) continue;
        return String(row.__ioParentBinding || "").trim();
      }
      return "";
    };

    /**
     * Патч префиксов-чекбоксов. Значение, у которого чекбокс сняли, уходит в
     * конфиг как `null`: без надгробия слияние патчей вернуло бы прежний.
     */
    const buildCheckboxPatch = (nextTree: Loose[], merged: Loose): Loose => {
      const mergedMap = merged && merged.checkboxByToken && typeof merged.checkboxByToken === "object"
        ? merged.checkboxByToken
        : {};
      const parentOut: Loose = {};
      const subOut: Loose = {};
      const list = Array.isArray(nextTree) ? nextTree : [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i] || {};
        const pTok = normToken(p.token, kind);
        const pCb = normCheckbox(mergedMap[pTok]);
        if (pTok && pCb) parentOut[pTok] = pCb;
        const children = Array.isArray(p.children) ? p.children : [];
        for (let j = 0; j < children.length; j++) {
          const c = children[j] || {};
          const cTok = normToken(c.token, kind);
          const cCb = normCheckbox(mergedMap[cTok]);
          if (cTok && cCb) subOut[cTok] = cCb;
        }
      }
      const patch: Loose = { pkm: { behavior: { prefixRules: { checkboxByFieldValue: {} } } } };
      const map = patch.pkm.behavior.prefixRules.checkboxByFieldValue;
      if (parentFieldId) map[parentFieldId] = parentOut;
      if (subFieldId) map[subFieldId] = subOut;
      if (parentFieldId) {
        for (const prevTok of Object.keys(parentCheckboxRaw)) {
          const t = normToken(prevTok, kind);
          if (t && !Object.prototype.hasOwnProperty.call(parentOut, t)) map[parentFieldId][t] = null;
        }
      }
      if (subFieldId) {
        for (const prevTok of Object.keys(subCheckboxRaw)) {
          const t = normToken(prevTok, kind);
          if (t && !Object.prototype.hasOwnProperty.call(subOut, t)) map[subFieldId][t] = null;
        }
      }
      return patch;
    };

    const cloneTree = (): Loose[] =>
      tree.map((p: Loose) => ({ ...p, children: (p.children || []).map((c: Loose) => ({ ...c })) }));

    const reorder = (
      srcLevel: number, srcParentToken: string, srcToken: string,
      dstLevel: number, dstParentToken: string, dstToken: string,
    ): Loose[] | null => {
      const nextTree = cloneTree();
      if (srcLevel === 0 && dstLevel === 0) {
        const fromIdx = nextTree.findIndex((x: Loose) => x.token === srcToken);
        const toIdx = nextTree.findIndex((x: Loose) => x.token === dstToken);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;
        const picked = nextTree.splice(fromIdx, 1)[0];
        const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
        nextTree.splice(insertIdx, 0, picked);
        return nextTree;
      }
      if (srcLevel === 1 && dstLevel === 1 && srcParentToken && srcParentToken === dstParentToken) {
        const parent = nextTree.find((x: Loose) => x.token === srcParentToken);
        if (!parent) return null;
        const arr = Array.isArray(parent.children) ? parent.children : [];
        const fromIdx = arr.findIndex((x: Loose) => x.token === srcToken);
        const toIdx = arr.findIndex((x: Loose) => x.token === dstToken);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;
        const picked = arr.splice(fromIdx, 1)[0];
        const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
        arr.splice(insertIdx, 0, picked);
        parent.children = arr;
        return nextTree;
      }
      return null;
    };

    /*
     * Правки дерева вынесены сюда из вёрстки: обе вёрстки обязаны править
     * дерево одинаково, иначе одно и то же нажатие даст разный конфиг, а
     * карта записей этого не увидит — она снята с одной из них.
     */
    const copyTree = (t: Loose[]): Loose[] =>
      (Array.isArray(t) ? t : []).map((p: Loose) => ({ ...p, children: (p.children || []).map((c: Loose) => ({ ...c })) }));

    const rowAt = (t: Loose[], at: Loose): Loose => {
      const list = Array.isArray(t) ? t : [];
      if (at.level === 0) return list.find((x: Loose) => x.token === at.token) || null;
      const prow = list.find((x: Loose) => x.token === at.parentToken);
      if (!prow) return null;
      return (prow.children || []).find((x: Loose) => x.token === at.token) || null;
    };

    const editRow = (t: Loose[], at: Loose, patch: Loose): Loose[] => {
      const nextTree = copyTree(t);
      if (at.level === 0) {
        const row = nextTree.find((x: Loose) => x.token === at.token);
        if (row) Object.assign(row, patch);
        return nextTree;
      }
      const prow = nextTree.find((x: Loose) => x.token === at.parentToken);
      if (prow) {
        const crow = (prow.children || []).find((x: Loose) => x.token === at.token);
        if (crow) Object.assign(crow, patch);
      }
      return nextTree;
    };

    const removeRow = (t: Loose[], at: Loose): Loose[] => {
      const nextTree = copyTree(t);
      if (at.level === 0) {
        const idx = nextTree.findIndex((x: Loose) => x.token === at.token);
        if (idx !== -1) nextTree.splice(idx, 1);
        return nextTree;
      }
      const prow = nextTree.find((x: Loose) => x.token === at.parentToken);
      if (prow) prow.children = (prow.children || []).filter((x: Loose) => x.token !== at.token);
      return nextTree;
    };

    /**
     * Уровень Value. Вниз — значение уходит дочерним к тому, что стоит над
     * ним; вверх — встаёт сразу за своим родителем. Первое значение списка
     * дочерним стать не может: над ним никого нет.
     */
    const toggleLevel = (t: Loose[], at: Loose): Loose[] => {
      const nextTree = copyTree(t);
      if (at.level === 0) {
        const idx = nextTree.findIndex((x: Loose) => x.token === at.token);
        if (idx > 0) {
          const picked = nextTree.splice(idx, 1)[0];
          nextTree[idx - 1].children = (nextTree[idx - 1].children || []).concat([{ token: picked.token }]);
        }
        return nextTree;
      }
      const prow = nextTree.find((x: Loose) => x.token === at.parentToken);
      if (prow) {
        const childIdx = (prow.children || []).findIndex((x: Loose) => x.token === at.token);
        if (childIdx !== -1) {
          prow.children.splice(childIdx, 1);
          const pIdx = nextTree.findIndex((x: Loose) => x.token === at.parentToken);
          nextTree.splice(pIdx + 1, 0, { token: at.token, prefix: prow.prefix || "#", children: [] });
        }
      }
      return nextTree;
    };

    const saveTree = (nextTree: Loose[], reason: string): WriteResult => {
      if (typeof deep.applyTagTreeToFields !== "function") return { ok: false, changed: false };
      if (kind === "wikilink") {
        /*
         * Сохранение дерева значений ссылки.
         *
         * Дочерние значения тут такие же, как у тега, и рантайм их понимает:
         * `getAllowedValues` в `tagwheel_core.js` берёт каталог значений из
         * `field.values` для всего, что не `projects` (строка `base = ...`), а
         * дальше фильтрует значения дочернего Field по `allowedParentValues`
         * против выбранного значения родителя — и делает это одинаково для
         * любого типа Field. Сам дочерний Field показывается, когда у родителя
         * выбрано значение (`isFieldEnabled`, тоже без разбора типа).
         *
         * До 2026-08-27 эта ветка проходила **только верхний уровень** дерева,
         * поэтому вложенная строка в запись не попадала и стрелка уровня
         * выглядела как удаление значения (замечание заказчика).
         *
         * Ветка своя, а не общий `applyTagTreeToFields`, по одной причине: у
         * значения ссылки есть метаданные, которых общий писатель не знает и
         * которые он бы стёр — `prefixMode`, `checkboxToken` и старая привязка.
         */
        const prevVals: Loose[] = parentField && Array.isArray(parentField.values) ? parentField.values : [];
        const prevSubVals: Loose[] = subField && Array.isArray(subField.values) ? subField.values : [];
        const metaByToken: Loose = {};
        for (const list of [prevVals, prevSubVals]) {
          for (let i = 0; i < list.length; i++) {
            const row = list[i] && typeof list[i] === "object" ? list[i] : {};
            const tok = normToken(row.token, "wikilink");
            if (!tok) continue;
            if (!metaByToken[tok]) metaByToken[tok] = row;
          }
        }
        const bare = (tok: string): string => tok.replace(/^\[\[|\]\]$/g, "");
        /** Значение ссылки: токен, метаданные строки и то, что дал вызов. */
        const valueOf = (row: Loose, tok: string, extra: Loose): Loose => {
          const prev = metaByToken[tok] && typeof metaByToken[tok] === "object" ? metaByToken[tok] : {};
          const out: Loose = {
            ...prev,
            token: bare(tok),
            prefixMode: String(row.prefixMode || prev.prefixMode || "bullet").trim().toLowerCase() === "checkbox"
              ? "checkbox"
              : "bullet",
            checkboxToken: String(row.checkboxToken || prev.checkboxToken || "").trim(),
            active: typeof prev.active === "boolean" ? prev.active : true,
            ...extra,
          };
          return out;
        };

        const nextValues: Loose[] = [];
        /** Дочернее значение может стоять под несколькими родителями. */
        const subParents = new Map<string, Set<string>>();
        const subRows = new Map<string, Loose>();
        for (let i = 0; i < nextTree.length; i++) {
          const row = nextTree[i] || {};
          const tok = normToken(row.token, "wikilink");
          if (!tok) continue;
          const children: Loose[] = Array.isArray(row.children) ? row.children : [];
          const subtags: string[] = [];
          for (let ci = 0; ci < children.length; ci++) {
            const crow = children[ci] || {};
            const ctok = normToken(crow.token, "wikilink");
            if (!ctok) continue;
            subtags.push(bare(ctok));
            if (!subParents.has(ctok)) subParents.set(ctok, new Set<string>());
            (subParents.get(ctok) as Set<string>).add(bare(tok));
            subRows.set(ctok, crow);
          }
          /*
           * У значения верхнего уровня `allowedParentValues` быть не может: этот
           * список принадлежит дочерним значениям и говорит, под какими
           * родителями их показывать. Общий путь тега делает то же самое
           * (`rebuildTagValues` в `main.js` его удаляет).
           */
          const value = valueOf(row, tok, { subtags });
          delete value["allowedParentValues"];
          nextValues.push(value);
        }

        const nextSubValues: Loose[] = [];
        for (const [ctok, parents] of subParents.entries()) {
          nextSubValues.push(valueOf(subRows.get(ctok) || {}, ctok, {
            allowedParentValues: Array.from(parents),
            subtags: [],
          }));
        }

        const fidParent = parentFieldId || String(strictName || k || "").trim();
        let nextLeft = leftMode.slice();
        let nextRight = rightMode.slice();
        if (!fidParent) {
          return { ok: false, error: "InlineOverhaul: cannot resolve target link field for Deep Editor save" };
        }
        const sourceId = String((parentField && parentField.source) || `wikilinks:${fidParent}`).trim();
        const nextParent = {
          ...(parentField || {}),
          id: fidParent,
          prefix: String(parentField && parentField.prefix || "#").trim() || "#",
          source: sourceId,
          placeholder: String(parentField && parentField.placeholder || fidParent).trim() || fidParent,
          values: nextValues,
        };
        const inRight = parentInRight || hasFieldById(rightMode, fidParent);
        if (inRight) nextRight = upsertField(nextRight, fidParent, nextParent);
        else nextLeft = upsertField(nextLeft, fidParent, nextParent);

        /*
         * Дочерний Field ссылки. Форма — та же, что заводит `addField` тегу, с
         * поправкой на тип: у ссылки есть `source`, иначе рантайм напишет её
         * значение как тег. `enabled` не ставится вовсе: включённость дочернего
         * Field живёт в картах `active` и `enabled` Order, и отсутствие ключа
         * там значит «включён» — так же читает и панель (`getSubActive`).
         */
        const subId = String(subFieldId || `${fidParent}_sub`).trim();
        if (nextSubValues.length || subField) {
          const nextSub = {
            ...(subField || {
              id: subId,
              prefix: "#",
              dependsOn: fidParent,
              disabledForParentValues: [],
              placeholder: "sub",
              source: `wikilinks:${subId}`,
            }),
            id: subId,
            dependsOn: fidParent,
            values: nextSubValues,
          };
          /* Дочерний Field лежит там же, где родитель: `dependsOn` обязан
             ссылаться на Field того же Block, иначе рантайм ругается. */
          if (subInRight || inRight) nextRight = upsertField(nextRight, subId, nextSub);
          else nextLeft = upsertField(nextLeft, subId, nextSub);
        }

        plugin.setConfigPatch(
          { pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } },
          reason,
        );
        return { ok: true };
      }

      const merged: Loose = deep.applyTagTreeToFields(
        nextTree,
        parentField || { id: k, prefix: "#", values: [] },
        subField || { id: subKey, values: [] },
        kind,
      );
      if (kind === "tag") {
        const fieldYaml = String((orderState.propertiesByField && orderState.propertiesByField[k]) || "").trim();
        const parentYamlByToken: Loose = {};
        const subYamlByToken: Loose = {};
        for (let i = 0; i < nextTree.length; i++) {
          const row = nextTree[i] || {};
          const pTok = denorm(row.token);
          if (!pTok) continue;
          const py = String(row.yamlProperty || "").trim();
          if (py && py !== fieldYaml) parentYamlByToken[pTok] = py;
          const ch = Array.isArray(row.children) ? row.children : [];
          for (let j = 0; j < ch.length; j++) {
            const crow = ch[j] || {};
            const sTok = denorm(crow.token);
            if (!sTok) continue;
            const sy = String(crow.yamlProperty || "").trim();
            if (sy && sy !== fieldYaml) subYamlByToken[sTok] = sy;
          }
        }
        const applyYamlMeta = (fieldObj: Loose, map: Loose): Loose => {
          if (!fieldObj || !Array.isArray(fieldObj.values)) return fieldObj;
          const vals = fieldObj.values.map((v: Loose) => {
            const row = v && typeof v === "object" ? { ...v } : v;
            if (!row || typeof row !== "object") return row;
            const tok = denorm(row.token);
            if (!tok) {
              delete row.yamlProperty;
              return row;
            }
            const yy = String(map[tok] || "").trim();
            if (yy) row.yamlProperty = yy;
            else delete row.yamlProperty;
            return row;
          });
          return { ...fieldObj, values: vals };
        };
        merged.parentField = applyYamlMeta(merged.parentField, parentYamlByToken);
        if (merged.subField) merged.subField = applyYamlMeta(merged.subField, subYamlByToken);
      }
      let nextLeft = leftMode.slice();
      let nextRight = rightMode.slice();
      if (merged.parentField) {
        if (parentFieldId) {
          if (parentInRight) nextRight = upsertField(nextRight, parentFieldId, merged.parentField);
          else nextLeft = upsertField(nextLeft, parentFieldId, merged.parentField);
        } else {
          nextRight = upsertField(nextRight, merged.parentField.id, merged.parentField);
        }
      }
      if (merged.subField) {
        if (subFieldId) {
          if (subInRight) nextRight = upsertField(nextRight, subFieldId, merged.subField);
          else nextLeft = upsertField(nextLeft, subFieldId, merged.subField);
        } else {
          const dependsOnParentId = String(merged.subField.dependsOn || "").trim();
          if (dependsOnParentId && hasFieldById(nextRight, dependsOnParentId)) nextRight = upsertField(nextRight, merged.subField.id, merged.subField);
          else nextLeft = upsertField(nextLeft, merged.subField.id, merged.subField);
        }
      }
      plugin.setConfigPatch(
        { pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } },
        reason,
      );
      plugin.setConfigPatch(buildCheckboxPatch(nextTree, merged), reason + ":prefix");
      return { ok: true };
    };

    /**
     * Добавить значение. У ссылки свой путь: значение уходит прямо в список
     * Block, минуя дерево, потому что у ссылки нет дочерних значений.
     */
    const addToken = (raw: string): WriteResult => {
      const token = normToken(raw, kind);
      if (!token) return { ok: false, changed: false };
      if (kind === "wikilink") {
        const behaviorNow = behaviorOf(plugin.getConfig());
        const leftNow = modeFields(behaviorNow, "leftMode");
        const rightNow = modeFields(behaviorNow, "rightMode");
        const keyNorm = String(k || "").trim();
        const strictNorm = String(strictName || keyNorm).trim();
        const findWikilinkField = (arr: Loose[]): Loose => {
          if (!Array.isArray(arr)) return null;
          for (let i = 0; i < arr.length; i++) {
            const f = arr[i] && typeof arr[i] === "object" ? arr[i] : null;
            if (!f) continue;
            const fid = String(f.id || "").trim();
            const fkey = String(f.orderKey || "").trim();
            const src2 = String(f.source || "").trim();
            if (!fid && !fkey && !src2) continue;
            if (fid === keyNorm || fid === strictNorm || fkey === keyNorm || fkey === strictNorm
              || src2 === `wikilinks:${keyNorm}` || src2 === `wikilinks:${strictNorm}`) return f;
          }
          return null;
        };
        const rightField = findWikilinkField(rightNow);
        const leftField = findWikilinkField(leftNow);
        const target = rightField || leftField;
        if (!target) return { ok: false, error: "InlineOverhaul: cannot resolve target link field for Deep Editor add" };
        const targetId = String(target.id || strictNorm || keyNorm).trim();
        if (!targetId) return { ok: false, error: "InlineOverhaul: target link field id is empty" };
        const valuesNow: Loose[] = Array.isArray(target.values) ? target.values.slice() : [];
        const tokenPlain = String(token).replace(/^\[\[|\]\]$/g, "").trim();
        if (!tokenPlain) return { ok: false, error: "InlineOverhaul: empty link token" };
        const exists = valuesNow.some((row: Loose) => {
          const tok = String(row && typeof row === "object" ? row.token : row || "").trim();
          return tok === tokenPlain;
        });
        if (!exists) valuesNow.push({ token: tokenPlain, active: true, allowedParentValues: [], prefixMode: "bullet", checkboxToken: "" });
        const nextTarget = {
          ...target,
          id: targetId,
          source: String(target.source || `wikilinks:${targetId}`).trim(),
          prefix: String(target.prefix || "#").trim() || "#",
          placeholder: String(target.placeholder || targetId).trim() || targetId,
          values: valuesNow,
        };
        const toRight = !!rightField || String(nextTarget.source || "").indexOf("wikilinks:") === 0;
        const nextLeft = toRight ? leftNow : upsertField(leftNow, targetId, nextTarget);
        const nextRight = toRight ? upsertField(rightNow, targetId, nextTarget) : rightNow;
        plugin.setConfigPatch(
          { pkm: { behavior: { leftMode: { fields: nextLeft }, rightMode: { fields: nextRight } } } },
          "pkm:behavior:order:deep:add-token:" + k,
        );
        return { ok: true };
      }

      const nextTree = cloneTree();
      nextTree.push({ token, prefix: "#", children: [] });
      if (typeof deep.applyTagTreeToFields !== "function") return { ok: false, changed: false };
      const merged: Loose = deep.applyTagTreeToFields(
        nextTree,
        parentField || { id: strictName, orderKey: k, prefix: "#", values: [] },
        subField || { id: `${strictName}_sub`, orderKey: `${k}_sub`, values: [] },
        kind,
      );
      let nextLeft = leftMode.map((f: Loose) => {
        const id = String(f && f.id || "").trim();
        if (parentFieldId && id === parentFieldId) return merged.parentField;
        if (subFieldId && id === subFieldId && merged.subField) return merged.subField;
        return f;
      });
      if (!parentField && merged.parentField) nextLeft = upsertField(nextLeft, merged.parentField.id, merged.parentField);
      if (!subField && merged.subField) nextLeft = upsertField(nextLeft, merged.subField.id, merged.subField);
      plugin.setConfigPatch(
        { pkm: { behavior: { leftMode: { fields: nextLeft } } } },
        "pkm:behavior:order:deep:add-token:" + k,
      );
      plugin.setConfigPatch(buildCheckboxPatch(nextTree, merged), "pkm:behavior:order:deep:add-token:" + k + ":prefix");
      return { ok: true };
    };

    return {
      available: deep.__unavailable !== true && typeof deep.applyTagTreeToFields === "function",
      kind,
      parentFieldId,
      subFieldId,
      parentField,
      subField,
      normalizeCheckbox: normCheckbox,
      tree: tree as ValueTreeRow[],
      linkParents: kind === "wikilink" ? buildLinkParents() : [],
      inferLinkBinding,
      cloneTree: cloneTree as () => ValueTreeRow[],
      reorder: reorder as ValuesEditor["reorder"],
      saveTree: saveTree as ValuesEditor["saveTree"],
      addToken,
      rowAt: rowAt as ValuesEditor["rowAt"],
      editRow: editRow as ValuesEditor["editRow"],
      removeRow: removeRow as ValuesEditor["removeRow"],
      toggleLevel: toggleLevel as ValuesEditor["toggleLevel"],
    };
  };

  ensureAllKeys();

  return {
    orderState,
    /* чтение */
    getOrderKeys,
    getFieldKind,
    getSubKeyForParent,
    getSubActive,
    inferSubKey,
    ensureAllKeys,
    getPanelLeadCandidates,
    listFields,
    /* снимки для черновиков и истории (Ф12, Ф13) */
    captureSnapshot,
    applySnapshot,
    /* запись */
    setOrderPatch,
    moveKey,
    addField,
    deleteField,
    setStrictName,
    setLabel,
    setProperty,
    getPrerequisite,
    setPrerequisite,
    toggleSub,
    setFreeRoam,
    setActive,
    setLead,
    valuesEditor,
    elementEditor,
    getValueVisual,
    setValueVisual,
    /* Пригодится вёрстке значений: разбор списка шагов у Field типа element. */
    normalizeCustomRaw,
  };
}

export type FieldsModel = ReturnType<typeof createFieldsModel>;
