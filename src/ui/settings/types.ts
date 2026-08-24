/**
 * Схема настроек (PRD 5.2).
 *
 * Схема — источник истины: она нормативна, сгенерирована из согласованного
 * прототипа и несёт то, чего в декларативном API Obsidian нет — `tip`,
 * `seeAlso`, `searchTerms`. В форму платформы её отображает чистая функция
 * `to_definitions.ts`.
 */

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
}

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

interface Base {
  /** Уникален глобально, kebab-case. */
  id: string;
  name: string;
  /** Одно предложение: что изменится для пользователя. Без точки в конце (Ст3). */
  desc?: string;
  /** Второй уровень объяснения. Раскрывается по «?». */
  tip?: string;
  /** Старое имя настройки, чтобы её находил поиск (С4). */
  searchTerms?: readonly string[];
  /** Ссылка на связанную настройку. */
  seeAlso?: { id: string; label: string };
  visible?: Predicate;
  disabled?: Predicate;
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
  | (Base & { kind: "custom"; render: (el: unknown, ctx: SettingsCtx) => (() => void) });

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
