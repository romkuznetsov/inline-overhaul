/**
 * Вкладка настроек на декларативном API Obsidian 1.13 (PRD 5.3).
 *
 * Платформа берёт рендеринг, привязки, условную видимость, валидацию и
 * индексацию в глобальном поиске. Нам остаются: схема как источник истины,
 * своё хранилище через шов getControlValue / setControlValue, свои блоки
 * через render и сборка описаний.
 */

import type { ExtraButtonComponent, SettingDefinitionItem } from "obsidian";

import type { ActionId, PlatformBits, SetOpts, SettingDef, SettingsCtx, SettingsGroup, SettingsStore, TabDef, TabId } from "./types.ts";
import { buildDefaultConfig, getIn, isBound } from "./types.ts";
import type { El } from "./custom/dom.ts";
import { toDefinitions, type Wiring } from "./to_definitions.ts";
import { fieldOptions } from "./custom/preview_data.ts";
import { themeColorFor, themeVarFor } from "./custom/theme_colors.ts";
import { paintSubheaders } from "./custom/subheader.ts";
import { templateOptions } from "./templates.ts";
/* Подсказчик папок и список папок vault — общий дом с блоком Smart Rules. */
import { attachFolderSuggest } from "./custom/smart_rules.ts";
import { dialogKey, fill } from "./texts_dialogs.ts";

/** Путь `Name brackets`: у него свой отказ на записи (C17, `В-264`). */
const NAME_BRACKETS_PATH = "transform.inline2note.noteName.delimiters";
import { FRAME_BY_NAME, SINGLE_KEYS, frameKey } from "./texts_custom.ts";
import { Describer, paintRich, type DocLike, type FragmentHost } from "./describe.ts";
import type { ConfirmRequest } from "./actions.ts";
import {
  BASE_LANG,
  PLAIN,
  languageOptions,
  localizeSchema,
  localizeTabs,
  makeResolve,
  type Catalogs,
  type Resolve,
} from "./texts.ts";

export interface TabDeps {
  schema: readonly SettingsGroup[];
  tabs: readonly TabDef[];
  /** Каталоги текстов из папки плагина (10.13.38); нет их — английский из схемы. */
  texts?: () => Catalogs;
  store: SettingsStore;
  /** Реестр действий (5.6). Кнопка без действия в схему не попадает (З8). */
  actions: Record<string, () => Promise<void> | void>;
  /** Откуда брать DocumentFragment. В Obsidian это createFragment(). */
  fragments: FragmentHost;
  /** Сообщить пользователю результат действия. */
  notify?: (message: string) => void;
  /** Подтверждение (Н3): без него сброс группы не идёт. Окно платформы — швом. */
  confirm?: (o: ConfirmRequest) => Promise<boolean>;
  /** Пересчитать предикаты: дешёвая операция. */
  refresh?: () => void;
  /**
   * Пересобрать определения и индекс поиска — дороже `refresh`; нужно, когда
   * меняется определение, а не значение.
   */
  rebuild?: () => void;
  /** Полоса вкладок рисуется слоем платформы; панель сообщает вкладку и получает выбор. */
  tabStrip?: (state: {
    tabs: readonly TabDef[];
    active: TabId;
    pick: (id: TabId) => void;
    /** Подпись полосы для программы чтения с экрана: слово из каталога. */
    label?: string;
  }) => unknown;
  /** Платформа для перенесённых блоков (3b): панель её только передаёт. */
  platform?: PlatformBits;
}

/**
 * Узел кнопки в заголовке группы для «?». Свой тип, не `HTMLElement`: панель
 * проверяется без браузера, в гейтах — заглушка; каждое поле проверяется.
 */
interface TipButtonEl {
  empty?: () => void;
  setText?: (text: string) => void;
  setAttribute?: (name: string, value: string) => void;
  closest?: (selector: string) => TipHostEl | null;
  classList?: ClassListLike;
  parentElement?: TipHostEl | null;
}

/** Строка заголовка и её место в группе; `classList` — у узла группы (пометка «свёрнута»). */
interface TipHostEl {
  parentElement?: TipHostEl | null;
  classList?: ClassListLike;
  createDiv?: (o?: { cls?: string }) => TipBodyEl;
  createEl?: (tag: string, o?: { text?: string; cls?: string }) => TipBodyEl;
  insertAdjacentElement?: (where: string, node: TipBodyEl) => unknown;
  /** Кнопка сворачивания — первым ребёнком строки заголовка, до названия. */
  insertBefore?: (node: TipBodyEl, before: TipBodyEl | null) => unknown;
  children?: ArrayLike<TipBodyEl>;
  /* Прежний коллаут и прежний знак снимаются перед тем, как поставить новые. */
  querySelectorAll?: (selector: string) => readonly TipBodyEl[];
}

interface TipBodyEl {
  remove?: () => void;
  createEl?: (tag: string, o?: { text?: string; cls?: string }) => TipBodyEl;
  createSpan?: (o?: { text?: string; cls?: string }) => TipBodyEl;
  createDiv?: (o?: { cls?: string }) => TipBodyEl;
  setAttribute?: (name: string, value: string) => void;
  addEventListener?: (type: string, fn: () => void) => void;
  classList?: ClassListLike;
  textContent?: string;
}

interface ClassListLike {
  add?: (...cls: string[]) => void;
  remove?: (...cls: string[]) => void;
  contains?: (cls: string) => boolean;
}

/** Поле ввода и коробка контрола для строки с крестиком; свои типы, как у «?» (без браузера). */
interface ClearableInput {
  value?: string;
  addClass?: (cls: string) => void;
  addEventListener?: (type: string, fn: () => void) => void;
}

interface ClearableText {
  inputEl: ClearableInput;
  setValue: (v: string) => ClearableText;
  onChange: (fn: (v: string) => void) => ClearableText;
  setPlaceholder?: (v: string) => ClearableText;
}

interface ClearableSetting {
  addText: (fn: (text: ClearableText) => unknown) => unknown;
  controlEl?: {
    createEl?: (tag: string, o: { cls?: string; text?: string; attr?: Record<string, string> }) => El;
  };
}

/**
 * От каких путей конфига зависит каждый источник `optionsFrom` — одно место
 * (У-32, C44). Список значений платформа не подхватывает пересчётом предикатов:
 * его строит `getSettingDefinitions` и кеширует (П-11).
 */
const OPTION_SOURCE_DEPS: Record<string, readonly string[]> = {
  /* Языки — из файлов папки плагина при загрузке; пустая запись отличает «без
   * зависимостей» от «забыли объявить». */
  languages: [],
  /* Шаблоны берутся только из назначенной папки: сменилась папка — сменился список. */
  templates: ["transform.inline2note.templatesFolder"],
  /* Ветка целиком: у Field меняются имя, вид и сторона — по листьям однажды отстанем. */
  "tag-fields": ["pkm.fields"],
  /* Block меняется перетаскиванием внутри той же ветки — как у `tag-fields`. */
  "left-block-fields": ["pkm.fields"],
  "right-block-fields": ["pkm.fields"],
};

/** Путь выбранного языка — одно объявление (У-32). */
const LANGUAGE_PATH = "general.language";

/** Путь открытой вкладки (`Р-13`, В-143) — одно объявление на чтение и запись (У-32). */
const ACTIVE_TAB_PATH = "ui.activeSettingsTab";

/** Сколько строк списка показывать, прежде чем свернуть остаток (Н3). */
const RESET_ROWS = 10;

/**
 * Значение словами: в списке изменений его надо прочесть, а не разобрать.
 * Слова видимые, значит из каталога (10.13.46).
 */
function valueWords(value: unknown, say: (name: string) => string): string {
  if (value === true) return say("WORD_ON");
  if (value === false) return say("WORD_OFF");
  if (value === "" || value === null || value === undefined) return say("WORD_EMPTY");
  return String(value);
}

export class SettingsPane {
  private deps: TabDeps;
  private describer: Describer;
  private defaults: Record<string, unknown>;
  /**
   * Открытая вкладка, запоминается между запусками (В-143, `Р-13`). Пишется с
   * `undoable: false`: «отменить» отменяет правку, а не переход.
   */
  private active: TabId;
  /** Свои блоки, подписанные на пути (П2). */
  private watchers = new Set<{ paths: readonly string[]; redraw: () => void }>();
  /** Кнопки сброса по одной на группу: меняются на месте, без пересборки определений. */
  private resetButtons = new Map<string, ExtraButtonComponent>();
  /**
   * Свёрнутые группы (2026-09-04). В памяти панели, не в конфиге — состояние
   * взгляда (5.4); живёт до выгрузки плагина.
   */
  private folded = new Set<string>();

  /** Строки заголовков с вводной фразой: по ним `Show callouts` рисует коллауты сам
   * (см. `syncGroupCallouts`). */
  private calloutSlots = new Map<string, { heading: TipHostEl; host: TipHostEl; intro: string }>();

  /** Знаки «?» у заголовков групп — как коллауты (A30): id → показать/спрятать. */
  private tipSlots = new Map<string, (showTips: boolean, showIds: boolean) => void>();

  /** Отписка от хранилища: панель живёт до выгрузки плагина, но не дольше. */
  private stopWatchingStore: () => void;

  /**
   * Схема и вкладки на выбранном языке (10.13.38): копия на язык и набор каталогов,
   * т.к. платформа зовёт `getSettingDefinitions` часто (П-11). Копия, а не правка
   * схемы: иначе переключение языка необратимо.
   */
  private localized: { stamp: string; schema: readonly SettingsGroup[]; tabs: readonly TabDef[]; t: Resolve } | null = null;

  /**
   * С каким списком значений собраны определения, по источнику. Пересборка только
   * при другом списке: иначе каждая запись в `pkm.fields` пересоздавала редактор
   * Fields на той же вкладке и сбрасывала выбор (10.13.260, 2026-09-25).
   */
  private builtOptions = new Map<string, string>();

  constructor(deps: TabDeps) {
    this.deps = deps;
    this.describer = new Describer(deps.fragments);
    this.defaults = buildDefaultConfig(deps.schema);
    for (const g of deps.schema) if (g.folded) this.folded.add(g.id);
    const first = deps.tabs.find(t => deps.schema.some(g => g.tab === t.id));
    this.active = (first ? first.id : "general") as TabId;
    /* Запомненная вкладка (`Р-13`) — по схеме панели: список в нормализации старый
     * (`hotkeys` вместо `keyboard`). Вкладки без групп не рисуются. */
    const remembered = String(deps.store.get(ACTIVE_TAB_PATH) || "").trim();
    if (remembered && deps.tabs.some(t => t.id === remembered && deps.schema.some(g => g.tab === t.id))) {
      this.active = remembered as TabId;
    }
    /* Свои блоки будит только хранилище: иначе запись своего блока
     * (`plugin.setConfigPatch`) не будила никого (1.4.1.1.3). */
    this.stopWatchingStore = deps.store.subscribe(paths => { this.wakeFor(paths); });
  }

  /** Снять подписку на хранилище. Зовётся при выгрузке плагина. */
  dispose(): void {
    this.stopWatchingStore();
    this.stopWatchingStore = () => {};
  }

  /** Язык панели. Английский — «как в схеме»: `en.js` может не быть. */
  private language(): string {
    const raw = String(this.storedValue(LANGUAGE_PATH) || "").trim();
    return raw || BASE_LANG;
  }

  /** Выбранный язык для тех, кто рисует не в панели (10.13.51, У-32). */
  currentLanguage(): string {
    return this.language();
  }

  /** Схема и вкладки, тексты которых уже переведены. */
  private view(): { schema: readonly SettingsGroup[]; tabs: readonly TabDef[]; t: Resolve } {
    const catalogs: Catalogs = this.deps.texts ? (this.deps.texts() || {}) : {};
    const lang = this.language();
    const stamp = lang + "|" + Object.keys(catalogs).sort().join(",");
    if (this.localized && this.localized.stamp === stamp) return this.localized;
    const t = makeResolve(catalogs, lang);
    this.localized = {
      stamp,
      t,
      schema: t === PLAIN ? this.deps.schema : localizeSchema(this.deps.schema, t),
      tabs: t === PLAIN ? this.deps.tabs : localizeTabs(this.deps.tabs, t),
    };
    return this.localized;
  }

  /** Видимый текст по ключу каталога для окон платформы и реестра действий (10.13.46, У-32). */
  textFor(key: string, fallback: string): string {
    return this.view().t(key, fallback);
  }

  /** Строка панели из `FRAME_TEXTS`. Стрелка: передаётся значением, `this` свой. */
  private frame = (name: string): string =>
    this.textFor(frameKey(name), FRAME_BY_NAME[name] || "");

  /** Какая вкладка открыта. */
  activeTab(): TabId {
    return this.active;
  }

  /** Переключить вкладку, запомнить её и перерисовать содержимое. */
  setActiveTab(id: TabId): void {
    if (id === this.active) return;
    this.active = id;
    this.rememberActiveTab(id);
    if (this.deps.rebuild) this.deps.rebuild();
  }

  /**
   * Записать открытую вкладку (`Р-13`) тем же швом, что всё остальное (CS10, У-32).
   * `undoable: false`: `Ctrl+Z` не возвращает вкладку. Отказ — громко в журнал.
   */
  private rememberActiveTab(id: TabId): void {
    void Promise.resolve(this.deps.store.set(ACTIVE_TAB_PATH, String(id), { undoable: false }))
      .catch((e: unknown) => {
        console.error("inline-overhaul: открытая вкладка настроек не записалась", e);
      });
  }

  /* ---- шов с платформой (П-1) ---------------------------------------- */

  /** Значение как лежит в конфиге — для всей панели; платформе — `getControlValue`. */
  private storedValue(key: string): unknown {
    const v = this.deps.store.get(key);
    return v === undefined ? getIn(this.defaults, key) : v;
  }

  /**
   * Перевёрнутые слайдеры: путь → число, из которого вычитается записанное
   * (2026-09-02). В конфиге — доля оставшейся яркости (`getSourceMarksFromConfig`),
   * смысл записанного менять нельзя (З1), миграцией — тоже. Переворот только на
   * шве с платформой.
   */
  private inverted(): Map<string, number> {
    if (this.invertedCache) return this.invertedCache;
    const map = new Map<string, number>();
    for (const group of this.view().schema) {
      for (const it of group.items) {
        if (!isBound(it)) continue;
        const invert = Number((it as unknown as Record<string, unknown>)["invert"]);
        if (Number.isFinite(invert) && invert > 0) map.set(it.path, invert);
      }
    }
    this.invertedCache = map;
    return map;
  }

  private invertedCache: Map<string, number> | null = null;

  getControlValue(key: string): unknown {
    const stored = this.storedValue(key);
    /* Незаданный цвет — `undefined`: платформа берёт `defaultValue`, цвет темы
     * (10.13.23 Ц3); пустая строка показала бы чёрное. Цвет человека сильнее (Ц6). */
    if (this.themedColorPaths().has(key) && !String(stored == null ? "" : stored).trim()) {
      return undefined;
    }
    const invert = this.inverted().get(key);
    if (invert === undefined) return stored;
    const n = Number(stored);
    return Number.isFinite(n) ? invert - n : stored;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    /* `Name brackets` — два разных знака (`В-264`, BUGHUNT C17). Один знак — «ещё
     * печатает», молчим; неверная пара — сообщение. */
    if (key === NAME_BRACKETS_PATH) {
      const chars = Array.from(String(value == null ? "" : value).trim());
      const pair = chars.length === 2 && chars[0] !== chars[1];
      if (chars.length && !pair) {
        if (chars.length >= 2 && this.deps.notify) this.deps.notify(this.frame("NAME_BRACKETS_TWO"));
        return;
      }
    }
    /* Цвет, равный цвету темы, пишется пустым: сброс платформы ставит hex темы, и
     * у `--text-selection` выходила сплошная плашка (цикл 118). */
    if (this.themedColorPaths().has(key) && typeof value === "string"
      && value.trim().toLowerCase() === themeColorFor(key).toLowerCase()) {
      value = "";
    }
    const opts: SetOpts = { coalesceKey: this.coalesceKeyFor(key), undoable: true };
    const invert = this.inverted().get(key);
    const shown = Number(value);
    const write = invert !== undefined && Number.isFinite(shown) ? invert - shown : value;
    await this.deps.store.set(key, write, opts);

    /* Свои блоки здесь не будятся — их будит подписка на хранилище. */

    /* Кнопка сброса меняется на себе самой, без пересборки. */
    this.syncResetButtons(key);

    /* Пересборка — только если изменилось определение («?» у подсказок): пересборка
     * на шаге слайдера заменяет узел и обрывает перетаскивание. */
    if (this.definitionsChanged(key)) {
      if (this.deps.rebuild) this.deps.rebuild();
      else if (this.deps.refresh) this.deps.refresh();
    } else if (this.deps.refresh) {
      this.deps.refresh();
    }
  }

  /* ---- точечная перерисовка своих блоков (П2) ------------------------ */

  watch(paths: readonly string[], redraw: () => void): () => void {
    const w = { paths, redraw };
    this.watchers.add(w);
    return () => { this.watchers.delete(w); };
  }

  /** Сколько блоков сейчас слушают пути: подписки не должны накапливаться. */
  watcherCount(): number {
    return this.watchers.size;
  }

  /** Задевает ли изменившийся путь тот, на который подписан блок. */
  private static touches(watched: string, changed: string): boolean {
    return watched === changed
      || changed.startsWith(watched + ".")
      || watched.startsWith(changed + ".");
  }

  /**
   * Разбудить подписчиков изменившихся путей (и путей внутри). Подписчики
   * собираются в множество: одна запись задевает десятки путей, рисуем по разу.
   */
  private wakeFor(changed: readonly string[]): void {
    const hit = new Set<{ paths: readonly string[]; redraw: () => void }>();
    for (const w of Array.from(this.watchers)) {
      if (w.paths.some(p => changed.some(c => SettingsPane.touches(p, c)))) hit.add(w);
    }
    for (const w of hit) {
      /* Значение уже записано; падение предпросмотра его не отменяет, но сообщается. */
      try { w.redraw(); }
      catch (e) { console.error("inline-overhaul: свой блок упал при перерисовке", e); }
    }

    /* Запись своего блока минует шов панели, но может менять список значений —
     * пересобираем, если источник на открытой вкладке (`optionSourcesTouched`). */
    if (this.rebuildNeeded(changed)) {
      if (this.deps.rebuild) this.deps.rebuild();
      else if (this.deps.refresh) this.deps.refresh();
    } else if (this.deps.refresh && this.predicateDepsTouched(changed)) {
      /* Предикат `visible` спрашивает путь, который пишет свой блок (PRD 10.13.260):
       * платформа велит звать `refreshDomState` в таком случае. */
      this.deps.refresh();
    }

    /* Вводные фразы групп — своей отрисовкой, не пересборкой (`syncGroupCallouts`);
     * сюда доходят и шов панели, и патч своего блока. */
    if (changed.some(c => SettingsPane.touches("general.help.showCallouts", c))) {
      this.syncGroupCallouts();
    }
    /* Знаки «?» у заголовков — так же (A30); зависят от двух тумблеров. */
    if (changed.some(c => SettingsPane.touches("general.help.showTips", c)
      || SettingsPane.touches("advanced.showSettingIds", c))) {
      this.syncGroupTips();
    }
  }

  /**
   * Меняет ли запись определения: тумблер подсказок, подпись id (10.13.5),
   * `Show callouts` (коллауты групп едут из `extraButtons`, 2026-09-05) и язык.
   * Описания кешируются (П-11).
   */
  private definitionsChanged(key: string): boolean {
    return key === "general.help.showTips"
      || key === "general.help.showCallouts"
      || key === "advanced.showSettingIds"
      /* Язык меняет весь видимый текст (10.13.38). */
      || key === LANGUAGE_PATH;
  }

  /* Пути источников списка (C44) намеренно не здесь: пересборку просит `wakeFor`,
   * второе объявление расходилось бы (У-32). */

  /**
   * Источники значений, задетые путями, — только на открытой вкладке: записи в
   * Fields частые, и пересборка заменяла бы узлы под руками. Другая вкладка
   * соберётся при переходе.
   */
  /**
   * Нужна ли пересборка определений: путь источника списка (C44) или тумблер
   * модуля открытой вкладки — от него зависит калитка (C7). Одно место (У-32).
   */
  private rebuildNeeded(changed: readonly string[]): boolean {
    /* Язык — ровно лист: `touches` считает совпадением и предка, а хранилище
     * сообщает и ветку — иначе пересборка на любую запись в `general`. */
    if (changed.indexOf(LANGUAGE_PATH) >= 0) return true;
    if (this.optionSourcesTouched(changed).length) return true;
    const tab = this.view().tabs.find(t => t.id === this.active);
    const gate = String((tab && tab.module) || "").trim();
    if (!gate) return false;
    return changed.some(c => SettingsPane.touches(gate, c));
  }

  /** Задела ли запись путь, который спрашивает чей-то `visible`. */
  private predicateDepsTouched(changed: readonly string[]): boolean {
    for (const group of this.view().schema) {
      for (const it of group.items as ReadonlyArray<{ visible?: { deps: readonly string[] } }>) {
        for (const p of [it.visible]) {
          if (p && p.deps.some(d => changed.some(c => SettingsPane.touches(d, c)))) return true;
        }
      }
    }
    return false;
  }

  private optionSourcesTouched(changed: readonly string[]): string[] {
    const out: string[] = [];
    for (const group of this.view().schema) {
      if (group.tab !== this.active) continue;
      for (const it of group.items) {
        const source = (it as { optionsFrom?: unknown }).optionsFrom;
        if (typeof source !== "string" || !source) continue;
        if (out.includes(source)) continue;
        const deps = OPTION_SOURCE_DEPS[source] || [];
        const hit = deps.some(d => changed.some(c => SettingsPane.touches(d, c)));
        if (!hit) continue;
        const built = this.builtOptions.get(source);
        if (built !== undefined && built === JSON.stringify(this.optionsFor(source, this.ctx()))) continue;
        out.push(source);
      }
    }
    return out;
  }

  /** Обновить кнопку сброса той группы, чьё значение изменилось. */
  private syncResetButtons(key: string): void {
    for (const group of this.view().schema) {
      if (!group.items.some(it => isBound(it) && it.path === key)) continue;
      const btn = this.resetButtons.get(group.id);
      if (btn) this.paintResetButton(group, btn);
    }
  }

  /** Пути цветов, где пусто — «у темы» (10.13.23); схема не меняется, считается раз. */
  private themedColorPaths(): Set<string> {
    if (!this._themedColorPaths) {
      const out = new Set<string>();
      for (const group of this.view().schema) {
        for (const it of group.items) {
          if (isBound(it) && it.kind === "color" && themeVarFor(it.path)) out.add(it.path);
        }
      }
      this._themedColorPaths = out;
    }
    return this._themedColorPaths;
  }

  private _themedColorPaths: Set<string> | null = null;

  /** Склейка записей идёт по id настройки, а не по пути (CS3). */
  private coalesceKeyFor(path: string): string {
    for (const group of this.view().schema) {
      for (const it of group.items) {
        if (isBound(it) && it.path === path) return it.id;
      }
    }
    return path;
  }

  /* ---- определения для платформы ------------------------------------- */

  private ctx(): SettingsCtx {
    const ctx: SettingsCtx = {
      /* Внутри панели — записанное, а не показанное на слайдере. */
      get: (path: string) => this.storedValue(path),
      set: (path: string, value: unknown, opts?: SetOpts) => this.deps.store.set(path, value, opts),
      run: (action: ActionId) => this.run(action),
      watch: (paths: readonly string[], redraw: () => void) => this.watch(paths, redraw),
      /* Текст по ключу для своих блоков (10.13.38): у `custom` нет имени и описания;
       * второй аргумент — текст из `schema/custom_texts.ts`, он же ответ без перевода. */
      t: (key: string, fallback: string) => this.view().t(key, fallback),
    };
    if (this.deps.platform) ctx.platform = this.deps.platform;
    return ctx;
  }

  /* ---- свои блоки (раздел 10) ---------------------------------------- */

  /**
   * Строка со своей вёрсткой: блок очищает строку и рисует своё; возвращённая
   * функция снимает заведённое (С5). `searchable: false` — в поиск только
   * настройки. `data-io-item` нужен переходу по `id`.
   */
  private renderCustom(it: SettingDef): unknown {
    if (it.kind !== "custom") return null;
    const draw = it.render;
    const ctx = this.ctx();
    return {
      name: "",
      searchable: false,
      render: (setting: { settingEl: El }) => {
        const row = setting.settingEl;
        row.empty();
        row.addClass("io-block");
        row.setAttribute("data-io-item", it.id);
        return draw(row, ctx);
      },
    };
  }

  /**
   * Поле ввода с крестиком «стереть» (В-131). Строку рисуем сами: у
   * `SettingDefinitionControl` слота под кнопку нет, `extraButtons` только у группы
   * (`obsidian.d.ts` 1.13); `render` отдаёт `Setting` — поле её `addText`, кнопка в
   * нашем `controlEl` (У-161). Крестик — `.io-clear` (У-116), без значения
   * `hidden` (З8). Запись на `change` (Р-7).
   */
  private clearableControl(it: SettingDef): ((setting: unknown) => void) | null {
    if (!isBound(it)) return null;
    if (it.kind !== "text" && it.kind !== "folder") return null;
    const path = it.path;
    const placeholder = String((it as unknown as { placeholder?: string }).placeholder || "");
    const mono = (it as unknown as { mono?: boolean }).mono === true;
    const isFolder = it.kind === "folder";
    const label = it.name;
    return (settingRaw: unknown) => {
      const setting = settingRaw as ClearableSetting;
      let input: ClearableInput | null = null;
      let cross: El | null = null;
      const sync = (): void => {
        if (!cross) return;
        cross.hidden = !String((input && input.value) || "").trim();
      };
      setting.addText((text) => {
        input = text.inputEl;
        if (placeholder && typeof text.setPlaceholder === "function") text.setPlaceholder(placeholder);
        if (mono && text.inputEl && text.inputEl.addClass) text.inputEl.addClass("io-text--mono");
        text.setValue(String(this.storedValue(path) ?? ""));
        text.onChange((value: string) => {
          void this.setControlValue(path, value);
          sync();
        });
        /* Подсказчик папок — родной, как у Smart Rules; нет его — обычное поле. */
        if (isFolder) {
          /* Список папок и подсказчик — общий дом с Smart Rules (У-32). */
          const bits = this.deps.platform;
          const app = bits && (bits.plugin as { app?: unknown } | undefined)?.app;
          attachFolderSuggest(bits && bits.AbstractInputSuggest, app,
            text.inputEl as never, (value: string) => {
              if (text.inputEl) text.inputEl.value = value;
              void this.setControlValue(path, value);
              sync();
            });
        }
        if (text.inputEl && text.inputEl.addEventListener) {
          text.inputEl.addEventListener("input", sync);
        }
        return text;
      });
      const node = setting.controlEl;
      if (node && typeof node.createEl === "function") {
        cross = node.createEl("button", {
          cls: "io-clear",
          text: "✕",
          attr: {
            type: "button",
            "aria-label": this.textFor(SINGLE_KEYS.clearField, "Clear") + " " + label,
          },
        });
        if (cross && typeof cross.addEventListener === "function") {
          cross.addEventListener("click", () => {
            if (input) input.value = "";
            void this.setControlValue(path, "");
            sync();
          });
        }
      }
      sync();
    };
  }

  /** Выполняемые действия: пока идёт, кнопка неактивна (5.6). */
  private busy = new Set<string>();

  async run(action: ActionId): Promise<void> {
    const fn = this.deps.actions[action];
    if (!fn) {
      /* Кнопки без действия в схему не попадают: это ошибка сборки. */
      throw new Error("нет действия в реестре: " + action);
    }
    if (this.busy.has(action)) return;
    this.busy.add(action);
    if (this.deps.rebuild) this.deps.rebuild();
    try {
      await fn();
    } finally {
      this.busy.delete(action);
      if (this.deps.rebuild) this.deps.rebuild();
    }
  }

  private wiring(): Wiring {
    const ctx = this.ctx();
    const showTips = Boolean(this.storedValue("general.help.showTips"));
    const showIds = Boolean(this.storedValue("advanced.showSettingIds"));
    /* `Show callouts` (10.13.27): вкладочные коллауты закрывает предикат `visible`,
     * фразы групп — этот тумблер. */
    const showCallouts = Boolean(this.storedValue("general.help.showCallouts"));
    const wiring: Wiring = {
      ctx,
      run: (action: ActionId) => { void this.run(action); },
      busy: (action: ActionId) => this.busy.has(action),
      describe: it => this.describer.describe(it, { showTips, showIds }),
      groupFold: group => this.groupFoldButtonFor(group),
      groupCallout: group => this.groupCalloutButtonFor(group, showCallouts),
      showIds,
      renderCustom: it => this.renderCustom(it) as ReturnType<NonNullable<Wiring["renderCustom"]>>,
      clearableControl: it =>
        this.clearableControl(it) as ReturnType<NonNullable<Wiring["clearableControl"]>>,
      resetGroup: group => this.resetButtonFor(group),
      groupTip: group => this.groupTipButtonFor(group, showTips, showIds),
      /* Fields человека — тем же чтением, что у предпросмотров (П11). */
      optionsFrom: source => {
        const got = this.optionsFor(source, ctx);
        this.builtOptions.set(source, JSON.stringify(got));
        return got;
      },
      activeTab: this.active,
    };
    if (this.deps.tabStrip) {
      const draw = this.deps.tabStrip;
      wiring.tabStrip = () => (draw({
        tabs: this.tabsWithGroups(),
        active: this.active,
        pick: (id: TabId) => this.setActiveTab(id),
        /* Подпись полосы для диктора — из каталога (долг A46). */
        label: this.frame("TAB_STRIP"),
      }) as ReturnType<NonNullable<Wiring["tabStrip"]>>);
    }
    return wiring;
  }

  /** Значения списка из данных человека; источник назван именем, как в прототипе. */
  private optionsFor(
    source: string,
    ctx: SettingsCtx,
  ): ReadonlyArray<{ value: string; label: string }> {
    /* Полосы красятся цветом Value, а он есть только у тега (З8). */
    if (source === "tag-fields") return fieldOptions(ctx, f => f.kind === "tag");
    /* Ведущее поле — только Fields этого Block; сторона — у самого Field (10.13.69, Т-1). */
    if (source === "left-block-fields") return fieldOptions(ctx, f => f.side === "left");
    if (source === "right-block-fields") return fieldOptions(ctx, f => f.side === "right");
    /* Языки: английский плюс файлы папки плагина; имя языка — из файла. */
    if (source === "languages") return languageOptions(this.deps.texts ? (this.deps.texts() || {}) : {});
    if (source === "templates") {
      /* Путь — из `OPTION_SOURCE_DEPS` (У-32). */
      const dep = OPTION_SOURCE_DEPS["templates"]?.[0] || "";
      const folder = String(this.storedValue(dep) || "").trim();
      const notes = ctx.platform && ctx.platform.listNotes ? ctx.platform.listNotes() : [];
      /* Строки «шаблонов нет» человек читает — значит, они из каталога. */
      return templateOptions(folder, notes,
        (name: string, english: string) => this.textFor(dialogKey(name), english));
    }
    return [];
  }

  /** Вкладки, у которых есть хотя бы одна группа: пустых не показываем. */
  tabsWithGroups(): readonly TabDef[] {
    const view = this.view();
    return view.tabs.filter(t => view.schema.some(g => g.tab === t.id));
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    /* Кнопки создаст платформа заново; прежние ссылки указывают на снятые узлы. */
    this.resetButtons.clear();
    const view = this.view();
    return toDefinitions(view.schema, view.tabs, this.wiring());
  }

  /* ---- сброс группы к значениям по умолчанию (10.13.1) --------------- */

/** Что в группе отличается от значения по умолчанию. */
  drift(group: SettingsGroup): Array<{ id: string; name: string; now: unknown; was: unknown }> {
    const out: Array<{ id: string; name: string; now: unknown; was: unknown }> = [];
    for (const it of group.items) {
      if (!isBound(it)) continue;
      const was = (it as unknown as { default: unknown })["default"];
      const now = this.storedValue(it.path);
      if (JSON.stringify(now) !== JSON.stringify(was)) {
        out.push({ id: it.id, name: it.name, now, was });
      }
    }
    return out;
  }

  /**
   * Сброс — одной записью undo (Н4); свои блоки не трогаются — это данные (Н5).
   * Без окна подтверждения сброса нет (Н3, как восстановление копии 5.6).
   */
  async resetGroup(group: SettingsGroup): Promise<number> {
    const drift = this.drift(group);
    if (!drift.length) return 0;

    const ask = this.deps.confirm;
    if (typeof ask !== "function") {
      console.error("inline-overhaul: сброс группы без окна подтверждения не идёт");
      return 0;
    }
    const say = this.frame;
    const shown = drift.slice(0, RESET_ROWS).map(d =>
      d.name + ": " + valueWords(d.now, say) + " \u2192 " + valueWords(d.was, say));
    const hidden = drift.length - shown.length;
    if (hidden > 0) shown.push(fill(say("RESET_MORE"), hidden));
    const yes = await ask({
      title: fill(say("RESET_TITLE"), group.heading),
      body: drift.length === 1
        ? say("RESET_ONE")
        : fill(say("RESET_MANY"), drift.length),
      confirmLabel: this.textFor(SINGLE_KEYS.groupReset, "Reset the group"),
      rows: shown,
      note: say("RESET_NOTE"),
    });
    if (!yes) return 0;
    let first = true;
    for (const d of drift) {
      const it = group.items.find(x => x.id === d.id);
      if (!it || !isBound(it)) continue;
      await this.deps.store.set(it.path, d.was, { coalesceKey: "reset:" + group.id, undoable: first });
      first = false;
    }
    if (drift.length && this.deps.notify) {
      this.deps.notify(fill(say("RESET_DONE"), drift.length));
    }
    if (drift.length) {
      if (this.deps.rebuild) this.deps.rebuild();
      else if (this.deps.refresh) this.deps.refresh();
    }
    return drift.length;
  }

  /**
   * Н1: место кнопки занято всегда, Н2 гасит её, когда сбрасывать нечего.
   * Показ/скрытие менял бы определение и обрывал перетаскивание слайдера.
   */
  private resetButtonFor(group: SettingsGroup): ((btn: ExtraButtonComponent) => unknown) | null {
    if (!group.items.some(it => isBound(it))) return null;
    return (btn: ExtraButtonComponent) => {
      this.resetButtons.set(group.id, btn);
      /* Своя пометка: по ней CSS уводит сброс вправо, а «?» остаётся у текста —
       * платформа кладёт оба в одну колонку (B7). */
      const node = (btn as unknown as { extraSettingsEl?: TipButtonEl }).extraSettingsEl;
      if (node && node.classList && typeof node.classList.add === "function") {
        node.classList.add("io-groupreset");
      }
      btn.setIcon("rotate-ccw").onClick(() => { void this.resetGroup(group); });
      return this.paintResetButton(group, btn);
    };
  }

  /**
   * Кнопка сворачивания группы. Узел платформа кладёт после имени и переписывает
   * детей строки на каждой отрисовке, поэтому до названия кнопку ставит вёрстка
   * (`order: -1`, строка — флекс). Прячутся карточка и коллаут; класс — на узле
   * группы: строки платформа пересобирает, группу — нет.
   */
  private groupFoldButtonFor(
    group: SettingsGroup,
  ): ((btn: ExtraButtonComponent) => unknown) | null {
    return (btn: ExtraButtonComponent) => {
      const node = (btn as unknown as { extraSettingsEl?: TipButtonEl }).extraSettingsEl;
      /* Кнопка платформы здесь только точка опоры: сам знак — свой узел. */
      if (node && node.classList && typeof node.classList.add === "function") {
        node.classList.add("io-calloutslot");
      }
      const heading = node && typeof node.closest === "function"
        ? node.closest(".setting-item")
        : (node ? node.parentElement || null : null);
      const box = heading && heading.parentElement ? heading.parentElement : null;
      if (!heading || typeof heading.createEl !== "function") return btn;

      /* Прежний знак снимается: строку заголовка платформа может переиспользовать. */
      const stale = typeof heading.querySelectorAll === "function"
        ? heading.querySelectorAll(".io-fold")
        : [];
      for (const old of stale) { if (typeof old.remove === "function") old.remove(); }

      const mark = heading.createEl("button", { cls: "io-fold" });
      /* Первым ребёнком: знак до названия. */
      const first = heading.children && heading.children[0];
      if (first && first !== mark && typeof heading.insertBefore === "function") {
        heading.insertBefore(mark, first);
      }

      const paint = (): void => {
        const shut = this.folded.has(group.id);
        mark.textContent = shut ? "\u25B8" : "\u25BE";
        const cls = mark.classList;
        if (cls && typeof cls.add === "function" && typeof cls.remove === "function") {
          if (shut) cls.add("io-fold--shut");
          else cls.remove("io-fold--shut");
        }
        if (typeof mark.setAttribute === "function") {
          mark.setAttribute("type", "button");
          mark.setAttribute("aria-expanded", shut ? "false" : "true");
          mark.setAttribute("aria-label",
            (shut ? "Expand " : "Collapse ") + group.heading);
        }
        if (box && box.classList) {
          if (shut) { if (typeof box.classList.add === "function") box.classList.add("io-group--shut"); }
          else if (typeof box.classList.remove === "function") box.classList.remove("io-group--shut");
        }
      };

      paint();
      if (typeof mark.addEventListener === "function") {
        mark.addEventListener("click", () => {
          if (this.folded.has(group.id)) this.folded.delete(group.id);
          else this.folded.add(group.id);
          paint();
        });
      }
      return btn;
    };
  }

  /** Свёрнута ли группа. Нужно проверке: своего состояния у неё нет. */
  isFolded(groupId: string): boolean {
    return this.folded.has(groupId);
  }

  /**
   * Докрасить субхедеры последнего захода (2026-09-22). В момент `render` соседей
   * ниже ещё нет, а шва «панель дорисована» у платформы нет: в живой панели —
   * микрозадачей, здесь — явный вход для проверки (У-212).
   */
  paintSubheaders(): void {
    paintSubheaders();
  }

  /** Вводная фраза группы: снять прежнюю и нарисовать. Одно объявление на сборку
   * и на `Show callouts` (У-32). */
  private static paintGroupCallout(
    heading: TipHostEl,
    host: TipHostEl,
    intro: string,
    show: boolean,
  ): void {
    /* Прежний коллаут снимается всегда, иначе накапливаются. */
    const stale = typeof host.querySelectorAll === "function"
      ? host.querySelectorAll(".io-callout--group")
      : [];
    for (const old of stale) { if (typeof old.remove === "function") old.remove(); }

    /* Пометка на группе: стили ужимают отступ заголовка, коллаут — посередине
     * между заголовком и карточкой (2026-09-05). */
    const cls = host.classList;
    if (cls) {
      if (show) { if (typeof cls.add === "function") cls.add("io-group--callout"); }
      else if (typeof cls.remove === "function") cls.remove("io-group--callout");
    }
    if (!show || typeof host.createDiv !== "function") return;

    const box = host.createDiv({ cls: "io-callout io-callout--group" });
    paintRich(box as unknown as DocLike, intro);
    if (typeof heading.insertAdjacentElement === "function") {
      heading.insertAdjacentElement("afterend", box);
    }
  }

  /**
   * Перерисовать вводные фразы групп без пересборки: группу платформа
   * переиспользует при совпадении типа и заголовка (`$2`, `t6` в `app.js`), а
   * `extraButtons` зовёт только у новой (2026-09-05; У-58, У-69). Поэтому строки
   * заголовков запоминаются и рисуются сами.
   */
  private syncGroupCallouts(): void {
    const show = Boolean(this.storedValue("general.help.showCallouts"));
    for (const slot of this.calloutSlots.values()) {
      SettingsPane.paintGroupCallout(slot.heading, slot.host, slot.intro, show);
    }
  }

  /** Показать или спрятать «?» у заголовков групп — как коллауты (A30). */
  private syncGroupTips(): void {
    const tips = Boolean(this.storedValue("general.help.showTips"));
    const ids = Boolean(this.storedValue("advanced.showSettingIds"));
    for (const paint of this.tipSlots.values()) paint(tips, ids);
  }

  /**
   * Вводная фраза группы — коллаутом между заголовком и карточкой.
   * Строку только с `desc` платформа не рисует (`app.js` `Z2`: нужно `name`,
   * `render`, `control` или `action`) — отсюда B7, C18, C41, C42. Точка опоры —
   * узел кнопки из `extraButtons`, коллаут встаёт `insertAdjacentElement`
   * ("afterend"): детей группы помимо списка строк (`i6`) платформа не трогает.
   * Узел кнопки скрыт классом (как `io-tabsrow--parked`). Не на сером фоне карточки
   * (2026-09-04). Прежний коллаут снимается: строку платформа переиспользует.
   */
  private groupCalloutButtonFor(
    group: SettingsGroup,
    showCallouts: boolean,
  ): ((btn: ExtraButtonComponent) => unknown) | null {
    const intro = String(group.intro || "").trim();
    if (!intro) return null;

    /* Слот заводится и при выключенном тумблере: по нему запоминается строка заголовка. */
    return (btn: ExtraButtonComponent) => {
      const node = (btn as unknown as { extraSettingsEl?: TipButtonEl }).extraSettingsEl;
      if (node && node.classList && typeof node.classList.add === "function") {
        node.classList.add("io-calloutslot");
      }
      const heading = node && typeof node.closest === "function"
        ? node.closest(".setting-item")
        : (node ? node.parentElement || null : null);
      const host = heading && heading.parentElement ? heading.parentElement : null;
      if (!heading || !host) return btn;

      this.calloutSlots.set(group.id, { heading, host, intro });
      SettingsPane.paintGroupCallout(heading, host, intro, showCallouts);
      return btn;
    };
  }

  /**
   * «?» в строке заголовка группы (B7, C11, C18, C41, C42). Тело не ищется, а
   * создаётся нажатием сразу за строкой заголовка, как `attachTip` прототипа, и
   * живёт в замыкании кнопки. Из DOM — только отданное платформой; всё под
   * проверками на наличие (в гейтах — заглушка).
   */
  private groupTipButtonFor(
    group: SettingsGroup,
    showTips: boolean,
    showIds: boolean,
  ): ((btn: ExtraButtonComponent) => unknown) | null {
    const hint = String(group.tip || "").trim();
    /* Подпись id — последней строкой; ради неё знак есть и у группы без подсказки (A3, C52). */
    if (!hint && !group.id) return null;
    /* Слот заводится при любых тумблерах (A30, У-69): `extraButtons` зовутся только у
     * новой группы. Показ решает `paint` в момент отрисовки. */
    const label = fill(this.frame("MORE_ABOUT"), group.heading);
    return (btn: ExtraButtonComponent) => {
      const node = (btn as unknown as { extraSettingsEl?: TipButtonEl }).extraSettingsEl;
      /* Тело живёт в замыкании кнопки: она его и создала, она и снимает. */
      let body: TipBodyEl | null = null;

      /**
       * Показать или спрятать знак — одно объявление на сборку и `Show tips` (У-32).
       * Знак — «?», как в прототипе, а не иконка темы.
       */
      const paint = (tips: boolean, ids: boolean): void => {
        const show = tips && Boolean(hint || (ids && group.id));
        if (node) {
          if (typeof node.empty === "function") node.empty();
          if (show && typeof node.setText === "function") node.setText("?");
          const cls = node.classList;
          if (cls && typeof cls.add === "function" && typeof cls.remove === "function") {
            if (show) { cls.add("io-help", "io-help--group"); cls.remove("io-tipslot"); }
            /* Спрятанный знак прячется тем же приёмом, что слот коллаута:
               узел платформы остаётся на месте, видимым он не становится. */
            else { cls.remove("io-help", "io-help--group"); cls.add("io-tipslot"); }
          }
        }
        /* Открытое тело закрывается вместе со знаком. */
        if (!show && body) {
          if (typeof body.remove === "function") body.remove();
          body = null;
          if (node && typeof node.setAttribute === "function") {
            node.setAttribute("aria-expanded", "false");
          }
        }
      };
      this.tipSlots.set(group.id, paint);
      paint(showTips, showIds);

      return btn.setTooltip(label).onClick(() => {
        if (body) {
          if (typeof body.remove === "function") body.remove();
          body = null;
          if (node && typeof node.setAttribute === "function") {
            node.setAttribute("aria-expanded", "false");
          }
          return;
        }
        const heading = node && typeof node.closest === "function"
          ? node.closest(".setting-item")
          : (node ? node.parentElement || null : null);
        /* Тело — сразу за строкой заголовка внутри группы: список строк (`i6`)
         * платформа переписывает, детей группы — нет. */
        const host = heading && heading.parentElement ? heading.parentElement : heading;
        if (!host || typeof host.createDiv !== "function") return;
        const made = host.createDiv({ cls: "io-tip io-grouptip" });
        if (heading && typeof heading.insertAdjacentElement === "function") {
          heading.insertAdjacentElement("afterend", made);
        }
        if (hint && typeof made.createDiv === "function") {
          paintRich(made.createDiv({ cls: "io-tip__body" }) as unknown as DocLike, hint);
        }
        /* Подпись id — в момент открытия: `extraButtons` второй раз не вызываются (У-69). */
        const wantId = Boolean(this.storedValue("advanced.showSettingIds")) && Boolean(group.id);
        if (wantId && typeof made.createDiv === "function" && typeof made.createEl === "function") {
          made.createEl("div", { text: group.id, cls: "io-tip__id" });
        }
        body = made;
        if (node && typeof node.setAttribute === "function") {
          node.setAttribute("aria-expanded", "true");
        }
      });
    };
  }

  /** Состояние кнопки: сколько настроек группы отличается от умолчания. */
  private paintResetButton(group: SettingsGroup, btn: ExtraButtonComponent): unknown {
    const n = this.drift(group).length;
    const tooltip = n
      ? fill(this.frame(n === 1 ? "RESET_TIP_ONE" : "RESET_TIP_MANY"), n)
      : this.frame("RESET_TIP_CLEAN");
    return btn.setDisabled(n === 0).setTooltip(tooltip);
  }
}
