/**
 * Схема настроек (PRD 5.2).
 *
 * Схема — источник истины: она нормативна, сгенерирована из согласованного
 * прототипа и несёт то, чего в декларативном API Obsidian нет — `tip`,
 * `seeAlso`, `searchTerms`. В форму платформы её отображает чистая функция
 * `to_definitions.ts`.
 */

import type { El } from "./custom/dom.ts";

export type TabId =
  | "general" | "keyboard" | "navigation" | "pkm" | "visual" | "transform" | "advanced";

export type ActionId =
  | "generate-config-note"
  | "apply-config-note"
  | "open-config-template"
  | "regenerate-rules"
  | "open-howto"
  | "open-hotkey"
  | "restore-backup";

export interface SetOpts {
  /** Несколько записей с одним ключом внутри 400 мс склеиваются в одну запись undo. */
  coalesceKey?: string;
  /** false — не попадает в undo-стек. По умолчанию true. */
  undoable?: boolean;
}

/** Хранилище настроек. Остаётся нашим: платформа читает и пишет через него (П-1). */
export interface SettingsStore {
  get(path: string): unknown;
  set(path: string, value: unknown, opts?: SetOpts): Promise<void>;
}

/** Контекст, который слой настроек передаёт предикатам и своим блокам. */
export interface SettingsCtx {
  get(path: string): unknown;
  set(path: string, value: unknown, opts?: SetOpts): Promise<void>;
  run(action: ActionId): Promise<void>;
  /**
   * Перерисовываться на изменение этих путей и ничего больше (П2). Возвращает
   * отписку: её обязана позвать очистка блока, иначе после пересборки панели
   * останется подписчик, рисующий в снятое поддерево.
   */
  watch(paths: readonly string[], redraw: () => void): () => void;
  /** Платформа для перенесённых блоков; у остальных её нет и быть не должно. */
  platform?: PlatformBits;
}

/**
 * Платформенные вещи для перенесённого кода (фаза 3b). Редактор Fields
 * переехал в слой настроек без изменения логики, а логика эта ждёт контекст
 * старой панели: компоненты Obsidian, плагин, нормализацию Order. Отдавать их
 * блоку напрямую нельзя — тогда блок узнает про платформу и его не отрисует
 * заглушка в гейте Г16. Поэтому они приходят швом: заполняет его
 * `obsidian_tab.ts`, в проверках — обвязка.
 *
 * Шов временный: он исчезнет вместе с последним перенесённым блоком, когда
 * список Fields будет переписан по Ф17–Ф20.
 */
export interface PlatformBits {
  Setting: unknown;
  Notice: unknown;
  Modal: unknown;
  /**
   * Родная подсказка ввода Obsidian (`AbstractInputSuggest`, публичный API с
   * 1.4.10). Своего списка мы не рисуем: платформа даёт клавиатуру, попадание
   * в тему и правильное положение поповера. Может отсутствовать — тогда поле
   * работает как обычное поле ввода, без подсказок.
   */
  AbstractInputSuggest?: unknown;
  setIcon: (node: unknown, icon: string) => void;
  /** Объект плагина: перенесённый код зовёт его методы как есть. */
  plugin: unknown;
  /** Живой конфиг. Перенесённый код читает и пишет пути версии 1. */
  getConfig: () => unknown;
  normalizePkmOrder: (raw: unknown) => unknown;
  pkmOrderFields: readonly string[];
}

/**
 * Свой блок. Возвращает функцию очистки: платформа вызывает её перед тем,
 * как снять строку (С5). Блоку отдаётся строка настройки целиком — ни имени,
 * ни описания у него нет, вся вёрстка своя.
 */
export type CustomRender = (host: El, ctx: SettingsCtx) => () => void;

/**
 * Предикат объявляет пути, от которых зависит. Платформе `deps` не нужны —
 * она пересчитывает предикаты сама. Нам они нужны для своих блоков: живой
 * предпросмотр должен знать, на какие пути перерисовываться (С6).
 */
export interface Predicate {
  deps: readonly string[];
  test: (ctx: SettingsCtx) => boolean;
}

export interface SettingButton {
  label: string;
  action: ActionId;
  cta?: true;
  warning?: true;
}

/**
 * Общее у любой записи схемы. Своему блоку из этого нужны только `id` и
 * предикаты: имени и описания у него нет — весь текст внутри блока.
 */
interface Ident {
  /** Уникален глобально, kebab-case. */
  id: string;
  /** Старое имя настройки, чтобы её находил поиск (С4). */
  searchTerms?: readonly string[];
  visible?: Predicate;
  disabled?: Predicate;
}

interface Base extends Ident {
  name: string;
  /** Одно предложение: что изменится для пользователя. Без точки в конце (Ст3). */
  desc?: string;
  /** Второй уровень объяснения. Раскрывается по «?». */
  tip?: string;
  /** Ссылка на связанную настройку. */
  seeAlso?: { id: string; label: string };
}

interface Bound extends Base {
  path: string;
}

export type SettingDef =
  | (Bound & { kind: "toggle"; default: boolean })
  | (Bound & { kind: "dropdown"; options: ReadonlyArray<{ value: string; label: string }>; default: string })
  | (Bound & { kind: "slider"; min: number; max: number; step: number; unit?: string; default: number })
  | (Bound & { kind: "number"; min?: number; max?: number; default: number })
  | (Bound & { kind: "text"; placeholder?: string; wide?: true; mono?: true; validate?: (v: string) => string | undefined; default: string })
  | (Bound & { kind: "textarea"; placeholder?: string; rows?: number; default: string })
  | (Bound & { kind: "color"; allowReset?: true; default: string })
  | (Base & { kind: "buttons"; buttons: readonly SettingButton[] })
  | (Ident & { kind: "custom"; render: CustomRender });

/** Запись схемы, у которой есть видимое имя: всё, кроме своего блока. */
export type NamedDef = Exclude<SettingDef, { kind: "custom" }>;

export interface SettingsGroup {
  id: string;
  tab: TabId;
  /** Шаг 100 (6.2). Группа с order меньше 100 — вводный коллаут вкладки. */
  order: number;
  heading: string;
  intro?: string;
  tip?: string;
  /**
   * Команды, которые эта группа настраивает: имена показываются под
   * заголовком, чтобы человек видел, чему он назначает хоткей. Имена, а не
   * ID: ID команды в интерфейсе не показывается никогда (7.2).
   */
  commands?: readonly string[];
  visible?: Predicate;
  items: readonly SettingDef[];
}

export interface TabDef {
  id: TabId;
  label: string;
  /** Путь тумблера модуля; у General, Keyboard и Advanced его нет. */
  module?: string;
  /** Одна фраза о том, что внутри: видна в строке перехода на эту область. */
  desc?: string;
  /**
   * Группы этой вкладки показываются сразу, а не за строкой перехода.
   * Нужна ровно одна такая вкладка: иначе первый экран панели — пустое
   * оглавление, что и случилось в первой сборке.
   */
  flat?: true;
}

/** Настройка, привязанная к пути конфига. */
export function isBound(
  it: SettingDef,
): it is Extract<SettingDef, { path: string }> {
  return typeof (it as { path?: unknown }).path === "string";
}

/* ---- работа с dot-path ------------------------------------------------ */

export function getIn(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function setIn(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i] as string;
    const next = cur[k];
    if (next === null || typeof next !== "object") cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1] as string] = value;
}

/**
 * С1: значения по умолчанию строятся из схемы, а не пишутся руками. Это
 * убирает класс ошибок «в UI одно значение по умолчанию, в конфиге другое».
 */
export function buildDefaultConfig(schema: readonly SettingsGroup[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const group of schema) {
    for (const it of group.items) {
      if (isBound(it)) setIn(out, it.path, (it as { default: unknown }).default);
    }
  }
  return out;
}

/* ---- короткие предикаты ---------------------------------------------- */

/** Виден или включён, когда по пути стоит истина. */
export function on(path: string): Predicate {
  return { deps: [path], test: ctx => Boolean(ctx.get(path)) };
}
/** Выключен, когда по пути стоит ложь. */
export function not(path: string): Predicate {
  return { deps: [path], test: ctx => !ctx.get(path) };
}
/** Виден, когда по пути стоит именно это значение. */
export function eq(path: string, value: unknown): Predicate {
  return { deps: [path], test: ctx => ctx.get(path) === value };
}

/* ---- конфиг редактора Fields (Ф16) ------------------------------------ */

/**
 * Пути конфига, которые пишет редактор Fields. Ф16 требует описать их явным
 * типом, а не `Record<string, unknown>`: набор снят чтением кода доски и
 * закреплён картой записей `tests/fixtures/order_board_write_map.txt`.
 *
 * Что важно знать про эту форму до фазы 2. Свои теги редактор пишет в
 * `pkm.behavior.tagVisuals.userTags`, а таблица 8.1 ведёт эту ветку в
 * `visual.tags.userTags`. Путь надо провести миграцией, иначе цвета своих
 * тегов после перехода на схему v2 потеряются. То же и с `byTag`.
 */
export type FieldKind = "tag" | "wikilink" | "element";

/** Как Field встаёт в строку: строго, только вставка, свободно (З1: значения не меняются). */
export type FreeRoamMode = "off" | "minimal" | "full";

/** Работает ли Field сам, только по хоткею, или не работает. */
export type FieldActiveMode = "yes" | "no" | "hotkey_only";

/** Как Value показывается в строке: как есть, только цветом, своим текстом (Ф9). */
export type ValueVisibility = "default" | "empty" | "custom";

/**
 * `pkm.behavior.order` — карта Fields: кто в каком Block, как называется, чем
 * является. Ключи всех карт — системные имена Fields, включая дочерние
 * (`<key>_sub`).
 */
export interface OrderState {
  left: string[];
  right: string[];
  /** Field, который ведёт Block: его Prefix становится Prefix строки. */
  lead: Record<string, string>;
  /** Видимое имя Field. */
  labels: Record<string, string>;
  /** Системное имя: им Field назван в заметке конфига и в рантайме. */
  strictNames: Record<string, string>;
  types: Record<string, FieldKind>;
  active: Record<string, FieldActiveMode>;
  freeRoam: Record<string, FreeRoamMode>;
  enabled: Record<string, boolean>;
  /** Свойство заметки, в которое уходит значение Field. */
  propertiesByField: Record<string, string>;
}

/** Одно Value внутри Field: `pkm.behavior.leftMode.fields[].values[]`. */
export interface FieldValueRow {
  token: string;
  /** Значения родителя, при которых это Value разрешено: так задаётся уровень (Ф8). */
  allowedParentValues?: string[];
  active?: boolean;
  prefixMode?: "bullet" | "checkbox";
  checkboxToken?: string;
  yamlProperty?: string;
}

/** Field в списке Block: `pkm.behavior.leftMode.fields[]` и `rightMode.fields[]`. */
export interface ModeFieldRow {
  id: string;
  orderKey?: string;
  prefix?: string;
  enabled?: boolean;
  dependsOn?: string;
  disabledForParentValues?: string[];
  placeholder?: string;
  source?: string;
  kind?: string;
  marker?: string;
  values?: FieldValueRow[];
}

/** Field типа `element`: `pkm.behavior.elements.byField[key]`. */
export interface ElementFieldRow {
  emoji?: string;
  format?: string;
  hotkey?: { increase?: string; decrease?: string };
  increment?: {
    mode?: string;
    incrementBy?: number;
    command?: string;
    customRaw?: unknown[];
    custom?: unknown[];
  };
}

/** Цвет и видимость одного Value: `tagVisuals.byTag[field][token]`. */
export interface TagVisualRow {
  fillColor?: string;
  textColor?: string;
  visibility?: ValueVisibility;
  customText?: string;
}

/** Срез конфига, который редактор Fields читает и пишет. */
export interface PkmFieldsConfig {
  ui?: {
    pkmSubTab?: string;
    orderShowInfoTips?: boolean;
    orderShowDeepEditor?: boolean;
    orderShowColorSettings?: boolean;
  };
  pkm?: {
    behavior?: {
      order?: Partial<OrderState>;
      leftMode?: { fields?: ModeFieldRow[] };
      rightMode?: { fields?: ModeFieldRow[] };
      elements?: { fields?: string[]; byField?: Record<string, ElementFieldRow> };
      tagVisuals?: {
        byTag?: Record<string, Record<string, TagVisualRow>>;
        userTags?: Record<string, TagVisualRow | null>;
      };
    };
  };
}
