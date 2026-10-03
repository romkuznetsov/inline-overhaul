/**
 * Схема настроек (PRD 5.2) — источник истины, сгенерирована из прототипа и
 * несёт `tip`, `seeAlso`, `searchTerms`, которых нет у платформы. В форму
 * платформы её отображает `to_definitions.ts`.
 */

import type { El } from "./custom/dom.ts";

export type TabId =
  | "general" | "keyboard" | "navigation" | "pkm" | "visual" | "transform" | "advanced";

/** Действия конфиг-заметки сняты 2026-09-03 (PRD 10.12, В-28, В-29). */
export type ActionId =
  | "open-howto"
  | "open-changelog"
  | "open-hotkey"
  | "save-backup"
  | "restore-backup"
  | "reset-settings";

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
  /**
   * Подписка на изменение конфига — единственный способ узнать о записи не
   * через `setControlValue` (свои блоки пишут `plugin.setConfigPatch`;
   * 1.4.1.1.3). Слушателю приходят изменившиеся пути, а не причина записи.
   */
  subscribe(listener: (paths: readonly string[]) => void): () => void;
}

/** Контекст, который слой настроек передаёт предикатам и своим блокам. */
export interface SettingsCtx {
  get(path: string): unknown;
  set(path: string, value: unknown, opts?: SetOpts): Promise<void>;
  run(action: ActionId): Promise<void>;
  /**
   * Перерисовываться на изменение этих путей (П2). Возвращает отписку: её
   * обязана позвать очистка блока, иначе подписчик рисует в снятое поддерево.
   */
  watch(paths: readonly string[], redraw: () => void): () => void;
  /**
   * Видимый текст по ключу каталога (10.13.38) для своих блоков: у
   * `kind: "custom"` нет `name`/`desc`. Второй аргумент — текст прототипа и
   * ответ без перевода (Я4).
   */
  t?(key: string, fallback: string): string;
  /** Платформа для перенесённых блоков; у остальных её нет и быть не должно. */
  platform?: PlatformBits;
}

/**
 * Платформенные вещи для перенесённого кода (фаза 3b): компоненты Obsidian,
 * плагин, нормализация Order. Приходят швом, чтобы блок рисовала заглушка
 * гейта Г16; заполняет `obsidian_tab.ts`, в проверках — обвязка. Шов
 * временный — до переписки списка Fields по Ф17–Ф20.
 */
export interface PlatformBits {
  Setting: unknown;
  Notice: unknown;
  Modal: unknown;
  /**
   * Родная подсказка ввода Obsidian (`AbstractInputSuggest`, API с 1.4.10).
   * Нет — поле работает без подсказок.
   */
  AbstractInputSuggest?: unknown;
  /**
   * Область клавиш Obsidian (`Scope`, API с 0.13.9): пока выбиралка знака
   * раскрыта, `Escape` сворачивает её, а не окно (`В-196`).
   */
  Scope?: unknown;
  setIcon: (node: unknown, icon: string) => void;
  /**
   * Пути заметок vault, синхронно: Obsidian держит список в памяти, а
   * `getSettingDefinitions` ввода-вывода не терпит (П-11).
   */
  listNotes?: () => readonly string[];
  /** Объект плагина: перенесённый код зовёт его методы как есть. */
  plugin: unknown;
  /** Живой конфиг. Перенесённый код читает и пишет пути версии 1. */
  getConfig: () => unknown;
  normalizePkmOrder: (raw: unknown) => unknown;
  pkmOrderFields: readonly string[];
}

/**
 * Свой блок. Возвращает очистку: платформа зовёт её перед снятием строки (С5).
 * Блоку отдаётся строка целиком, вёрстка своя.
 */
export type CustomRender = (host: El, ctx: SettingsCtx) => () => void;

/**
 * Предикат объявляет свои пути: платформе `deps` не нужны, а своим блокам
 * нужны для перерисовки живого предпросмотра (С6).
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

/** Общее у любой записи схемы; своему блоку нужны только `id` и предикаты. */
interface Ident {
  /** Уникален глобально, kebab-case. */
  id: string;
  /** Старое имя настройки, чтобы её находил поиск (С4). */
  searchTerms?: readonly string[];
  /* Неприменимая строка прячется, а не гаснет: `disabled` снят (2026-09-29). Запрет держит `gates.js`. */
  visible?: Predicate;
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
  /**
   * Папка vault: контрол платформы с 1.13 — поле с подсказчиком папок и
   * свободным вводом (1.6.2.3).
   */
  | (Bound & { kind: "folder"; default: string; placeholder?: string; wide?: true; clearable?: true })
  | (Bound & {
    kind: "dropdown";
    options: ReadonlyArray<{ value: string; label: string }>;
    /**
     * Источник, из которого дописываются значения из данных человека;
     * строки `options` идут первыми.
     */
    optionsFrom?: string;
    default: string;
  })
  /**
   * Слайдер. `invert` — число, из которого вычитается записанное при показе:
   * `min`/`max` в показанных величинах, `default` — записанный (З1).
   * Переворот только на шве `getControlValue`/`setControlValue`.
   */
  | (Bound & { kind: "slider"; min: number; max: number; step: number; unit?: string; invert?: number; default: number })
  | (Bound & { kind: "number"; min?: number; max?: number; default: number })
  | (Bound & { kind: "text"; placeholder?: string; wide?: true; mono?: true; validate?: (v: string) => string | undefined; default: string; clearable?: true })
  | (Bound & { kind: "textarea"; placeholder?: string; rows?: number; default: string })
  | (Bound & { kind: "color"; allowReset?: true; default: string })
  /**
   * Строка-подпись без контрола (`SettingDefinitionEmpty`): называет
   * следующий блок, например `Fields to keep` (B13, B18).
   */
  | (Base & { kind: "note" })
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
   * Команды группы: имена под заголовком — чему назначается хоткей. Имена, а
   * не ID: ID в интерфейсе не показывается (7.2).
   */
  commands?: readonly string[];
  visible?: Predicate;
  /** Свёрнута при первом показе: группа, нужная редко (его пункт цикла 121). */
  folded?: true;
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
   * Группы вкладки показываются сразу, без строки перехода. Нужна ровно одна
   * такая вкладка, иначе первый экран — пустое оглавление.
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

/**
 * Приведение к объекту и к списку — одно объявление на слой настроек
 * (PRD 10.13.133). Пустое вместо отказа: конфиг бывает сломан.
 * `asArray` отдаёт копию — вызывающий правит её на месте.
 */
export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice() : [];
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

/** С1: умолчания строятся из схемы, а не пишутся руками. */
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
/**
 * Виден, пока истина хоть по одному пути: у строки два хозяина (`Del` и
 * `Backspace`), прячется, когда выключены оба (2026-09-29).
 */
export function either(a: string, b: string): Predicate {
  return { deps: [a, b], test: ctx => ctx.get(a) === true || ctx.get(b) === true };
}
/** Оба условия сразу: у строки уже было своё `visible`, и к нему добавился хозяин. */
export function both(p: Predicate, q: Predicate): Predicate {
  return { deps: [...p.deps, ...q.deps], test: ctx => p.test(ctx) && q.test(ctx) };
}

/* ---- конфиг редактора Fields (Ф16) ------------------------------------ */

/**
 * Пути, которые пишет редактор Fields (Ф16): карта записей —
 * `tests/fixtures/order_board_write_map.txt`. Свои теги пишутся в
 * `pkm.behavior.tagVisuals.userTags`, а таблица 8.1 ведёт ветку в
 * `visual.tags.userTags` — без миграции цвета потеряются; то же с `byTag`.
 */
export type FieldKind = "tag" | "wikilink" | "element" | "command";

/** Как Field встаёт в строку: строго, только вставка, свободно (З1: значения не меняются). */
export type FreeRoamMode = "off" | "minimal" | "full";

/** Работает ли Field сам, только по хоткею, или не работает. */
export type FieldActiveMode = "yes" | "no" | "hotkey_only";

/** Положение дочернего Field (2026-09-19): спрятан, после родителя, всегда, по `Alt`. */
export type SubMode = "hide" | "after-parent" | "always" | "alt";

/** Как Value показывается в строке: как есть, только цветом, своим текстом (Ф9). */
export type ValueVisibility = "default" | "empty" | "custom";

/**
 * `pkm.behavior.order` — карта Fields. Ключи всех карт — системные имена,
 * включая дочерние (`<key>_sub`).
 */
export interface OrderState {
  left: string[];
  right: string[];
  /** Field, который ведёт Block: его Prefix становится Prefix строки. */
  lead: Record<string, string>;
  /** Видимое имя Field. */
  labels: Record<string, string>;
  /** Системное имя: им Field назван в именах команд и в рантайме. */
  strictNames: Record<string, string>;
  types: Record<string, FieldKind>;
  active: Record<string, FieldActiveMode>;
  freeRoam: Record<string, FreeRoamMode>;
  enabled: Record<string, boolean>;
  /** Работает ли дочерний Field на строке, где у родителя значения нет. */
  subWithoutParent: Record<string, boolean>;
  /** Дописывать ли родителя, когда такой Field получил значение. */
  subAddsParent: Record<string, boolean>;
  /** Показывать ли дочерний Field в tagWheel только пока зажат `Alt` (`З-36`). */
  subOnAlt: Record<string, boolean>;
  /** Родительские Values — навигатор: сужают детей и не пишутся (PRD 10.13.269). */
  subNavigator: Record<string, boolean>;
  /** Навигатор ребёнка — в свойство родителя (PRD 10.13.272). */
  yamlNavigator: Record<string, boolean>;
  /** Link как MOC (тест 3 цикла 98): `false` — `Link the notes you mention` не пишет. Нет ключа — да. */
  useAsMoc?: Record<string, boolean>;
  /** Свойство заметки, в которое уходит значение Field. */
  propertiesByField: Record<string, string>;
  /** Custom block (PRD 10.13.260): свой Block у каретки, по разделу на блок. */
  custom: Array<{ id: string; name: string; keys: string[] }>;
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
