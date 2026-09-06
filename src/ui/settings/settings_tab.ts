/**
 * Вкладка настроек на декларативном API Obsidian 1.13 (PRD 5.3).
 *
 * Платформа берёт рендеринг, привязки, условную видимость, валидацию и
 * индексацию в глобальном поиске. Нам остаются: схема как источник истины,
 * своё хранилище через шов getControlValue / setControlValue, свои блоки
 * через render и сборка описаний.
 */

import type { ExtraButtonComponent, Setting, SettingDefinitionItem } from "obsidian";

import type { ActionId, PlatformBits, SetOpts, SettingDef, SettingsCtx, SettingsGroup, SettingsStore, TabDef, TabId } from "./types.ts";
import { buildDefaultConfig, getIn, isBound } from "./types.ts";
import type { El } from "./custom/dom.ts";
import { toDefinitions, type Wiring } from "./to_definitions.ts";
import { fieldOptions } from "./custom/preview_data.ts";
import { themeVarFor } from "./custom/theme_colors.ts";
import { templateOptions } from "./templates.ts";
import { dialogKey, fill } from "./texts_dialogs.ts";
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
  /**
   * Каталоги видимых текстов, прочитанные из папки плагина (10.13.38).
   * Нет их — панель говорит по-английски тем текстом, что стоит в схеме, и
   * это ровно то, чем она была до 2026-09-06.
   */
  texts?: () => Catalogs;
  store: SettingsStore;
  /** Реестр действий (5.6). Кнопка без действия в схему не попадает (З8). */
  actions: Record<string, () => Promise<void> | void>;
  /** Откуда брать DocumentFragment. В Obsidian это createFragment(). */
  fragments: FragmentHost;
  /** Сообщить пользователю результат действия. */
  notify?: (message: string) => void;
  /**
   * Спросить подтверждение. Без него сброс группы не идёт: он меняет разом
   * всё, что человек в ней настроил (Н3). Окно живёт на платформе, поэтому
   * приходит швом — как и всё остальное платформенное.
   */
  confirm?: (o: ConfirmRequest) => Promise<boolean>;
  /** Пересчитать предикаты: дешёвая операция. */
  refresh?: () => void;
  /**
   * Пересобрать определения и индекс поиска. Дороже, чем refresh, и нужно
   * там, где изменилось само определение, а не значение: «?» у подсказок,
   * кнопка сброса в заголовке, состояние модуля в строке перехода.
   */
  rebuild?: () => void;
  /**
   * Полоса вкладок. Её рисует слой, знающий про платформу; панель только
   * сообщает, какая вкладка открыта, и получает обратный вызов на выбор.
   */
  tabStrip?: (state: {
    tabs: readonly TabDef[];
    active: TabId;
    pick: (id: TabId) => void;
  }) => unknown;
  /**
   * Платформа для перенесённых блоков (3b). Панель её не использует — только
   * передаёт блокам, которые без неё не работают.
   */
  platform?: PlatformBits;
}

/**
 * Узел кнопки в заголовке группы — ровно то, что от него нужно «?».
 *
 * Своего типа, а не `HTMLElement`: панель собирается и проверяется без
 * браузера, а в гейтах кнопка приходит заглушкой. Каждое поле необязательно
 * и перед вызовом проверяется.
 */
interface TipButtonEl {
  empty?: () => void;
  setText?: (text: string) => void;
  setAttribute?: (name: string, value: string) => void;
  closest?: (selector: string) => TipHostEl | null;
  classList?: ClassListLike;
  parentElement?: TipHostEl | null;
}

/**
 * Строка заголовка и её место в группе: сюда встаёт тело подсказки, коллаут
 * группы и кнопка сворачивания. `classList` — на узле группы: на нём живёт
 * пометка «свёрнута».
 */
interface TipHostEl {
  parentElement?: TipHostEl | null;
  classList?: ClassListLike;
  createDiv?: (o?: { cls?: string }) => TipBodyEl;
  createEl?: (tag: string, o?: { text?: string; cls?: string }) => TipBodyEl;
  insertAdjacentElement?: (where: string, node: TipBodyEl) => unknown;
  /**
   * Кнопка сворачивания встаёт **первым** ребёнком строки заголовка: заказчик
   * просил знак до названия, а колонка контролов стоит после имени, и
   * порядком внутри неё туда не попасть.
   */
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

/**
 * От каких путей конфига зависит каждый источник значений `optionsFrom`.
 *
 * Одно правило — одно место (У-32). До 2026-09-02 зависимость жила только
 * внутри `optionsFor`, а список ключей, на которые панель пересобирает
 * определения, стоял отдельным литералом из двух строк. Из-за этого
 * `Default template` показывал «Set a Templates folder first» после того, как
 * папка уже была назначена: список собрался при открытии вкладки и больше не
 * пересобирался (замечание заказчика C44, 2026-09-02).
 *
 * Значения платформа подхватывает пересчётом предикатов; **список** значений
 * так не подхватывается — его строит `getSettingDefinitions`, и он кешируется
 * (П-11).
 */
const OPTION_SOURCE_DEPS: Record<string, readonly string[]> = {
  /*
   * Языки не зависят ни от одного пути конфига: список приходит из файлов
   * папки плагина, а они читаются при загрузке. Запись стоит здесь, чтобы
   * источник без зависимостей отличался от источника, который забыли
   * объявить.
   */
  languages: [],
  /* Шаблоны берутся только из назначенной папки: сменилась папка — сменился список. */
  templates: ["transform.inline2note.templatesFolder"],
  /*
   * Fields человека. Ветка целиком, а не отдельные листья: у Field меняется то
   * имя, то вид, то сторона, и перечислить это по листьям значит однажды
   * отстать — та же причина, по которой на `pkm.fields` подписаны
   * предпросмотры.
   */
  "tag-fields": ["pkm.fields"],
};

/**
 * Где лежит выбранный язык. Путь объявлен здесь один раз: его спрашивают и
 * подстановка текстов, и список значений, и пробуждение панели (У-32).
 */
const LANGUAGE_PATH = "general.language";

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
   * Открытая вкладка живёт в памяти панели, а не в конфиге: это состояние
   * взгляда, а не настройка. В undo не попадает и в data.json не пишется
   * (5.4).
   */
  private active: TabId;
  /** Свои блоки, подписанные на пути (П2). */
  private watchers = new Set<{ paths: readonly string[]; redraw: () => void }>();
  /**
   * Кнопки сброса, которые платформа уже создала: по одной на группу. Панель
   * держит их, чтобы менять неактивность и подсказку на месте, а не
   * пересобирать определения из-за одного изменённого значения.
   */
  private resetButtons = new Map<string, ExtraButtonComponent>();
  /**
   * Свёрнутые группы (просьба заказчика 2026-09-04: «сделай каждый хедер
   * сворачиваемым… хочу, чтобы запоминалось состояние хедеров»).
   *
   * Живёт в памяти панели, а не в конфиге: это состояние взгляда, как и
   * открытая вкладка, — в `data.json` оно не пишется и в undo не попадает
   * (5.4). Панель живёт до выгрузки плагина, поэтому свёрнутое остаётся
   * свёрнутым и после закрытия окна настроек — ровно то, о чём просил
   * заказчик («как минимум в рамках текущей сессии»).
   */
  private folded = new Set<string>();

  /**
   * Строки заголовков групп с вводной фразой: по ним `Show callouts` рисует
   * и снимает коллауты **сам**, не прося пересборку. Почему не пересборкой —
   * у `syncGroupCallouts`. Запись заводится при каждой отрисовке группы,
   * поэтому пересозданный платформой заголовок заменяет прежний.
   */
  private calloutSlots = new Map<string, { heading: TipHostEl; host: TipHostEl; intro: string }>();

  /**
   * Знаки «?» у заголовков групп: та же история, что у коллаутов (A30).
   * Ключ — id группы, значение — «показать или спрятать» с текущими
   * значениями обоих тумблеров.
   */
  private tipSlots = new Map<string, (showTips: boolean, showIds: boolean) => void>();

  /** Отписка от хранилища: панель живёт до выгрузки плагина, но не дольше. */
  private stopWatchingStore: () => void;

  /**
   * Схема и вкладки на выбранном языке (10.13.38).
   *
   * Считается один раз на язык и держится до его смены: подстановка идёт по
   * всем строкам каталога, а `getSettingDefinitions` платформа зовёт часто
   * (П-11). Пометка — язык плюс список прочитанных каталогов: сменилось то
   * или другое, и копия собирается заново.
   *
   * Копия, а не правка схемы на месте: схема — модуль, живущий всё время
   * работы плагина, и переписать её значило бы сделать переключение языка
   * необратимым.
   */
  private localized: { stamp: string; schema: readonly SettingsGroup[]; tabs: readonly TabDef[]; t: Resolve } | null = null;

  constructor(deps: TabDeps) {
    this.deps = deps;
    this.describer = new Describer(deps.fragments);
    this.defaults = buildDefaultConfig(deps.schema);
    const first = deps.tabs.find(t => deps.schema.some(g => g.tab === t.id));
    this.active = (first ? first.id : "general") as TabId;
    /*
     * Единственный вход в пробуждение своих блоков — хранилище.
     * Раньше их будил шов `setControlValue`, и о записи из своего блока
     * (редактор Fields пишет `plugin.setConfigPatch`) не узнавал никто:
     * предпросмотры оставались прежними до перехода по вкладкам, который
     * пересобирает содержимое целиком (замечание заказчика 1.4.1.1.3).
     */
    this.stopWatchingStore = deps.store.subscribe(paths => { this.wakeFor(paths); });
  }

  /** Снять подписку на хранилище. Зовётся при выгрузке плагина. */
  dispose(): void {
    this.stopWatchingStore();
    this.stopWatchingStore = () => {};
  }

  /**
   * Каким языком говорит панель. Английский — это «как в схеме»: файла
   * `en.js` человек может и не заводить, и тогда подстановки нет вовсе.
   */
  private language(): string {
    const raw = String(this.storedValue(LANGUAGE_PATH) || "").trim();
    return raw || BASE_LANG;
  }

  /**
   * Какой язык выбран — для тех, кто рисует не в панели (10.13.51).
   *
   * Спрашивает руководство: перевод у него свой файл, а язык один на плагин, и
   * второе объявление разошлось бы с первым молча (У-32).
   */
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

  /**
   * Видимый текст по ключу каталога — для тех, кто рисует не в панели
   * (10.13.46): окна платформы и реестр действий. Своего резолвера они завести
   * не могут — язык живёт в конфиге, а конфиг у панели, — и второй завёлся бы
   * с другим порядком подстановки (У-32).
   */
  textFor(key: string, fallback: string): string {
    return this.view().t(key, fallback);
  }

  /**
   * Строка самой панели по имени из таблицы `FRAME_TEXTS`. Поле со стрелкой:
   * его передают дальше как значение, и `this` у него должен остаться свой.
   */
  private frame = (name: string): string =>
    this.textFor(frameKey(name), FRAME_BY_NAME[name] || "");

  /** Какая вкладка открыта. */
  activeTab(): TabId {
    return this.active;
  }

  /** Переключить вкладку и перерисовать содержимое. */
  setActiveTab(id: TabId): void {
    if (id === this.active) return;
    this.active = id;
    if (this.deps.rebuild) this.deps.rebuild();
  }

  /* ---- шов с платформой (П-1) ---------------------------------------- */

  /**
   * Значение так, как оно **лежит в конфиге**. Этим живёт вся панель:
   * предикаты видимости, предпросмотры, сброс группы. Платформе отдаётся
   * другое — см. `getControlValue`.
   */
  private storedValue(key: string): unknown {
    const v = this.deps.store.get(key);
    return v === undefined ? getIn(this.defaults, key) : v;
  }

  /**
   * Перевёрнутые слайдеры: путь → число, из которого вычитается записанное.
   *
   * Заказчик попросил, чтобы `Opacity of transformed line` росла вправо
   * (2026-09-02), а в конфиге по этому пути лежит **доля оставшейся
   * яркости** — так её читает движок (`getSourceMarksFromConfig`). Менять
   * смысл записанного нельзя: это З1, и починить это миграцией негде —
   * третья ступень идёт на каждом патче и «уже перевёрнуто» от «ещё нет» не
   * отличит.
   *
   * Поэтому переворот живёт **на шве с платформой** и только здесь: панель
   * внутри себя по-прежнему работает с записанным значением.
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
    /*
     * Незаданный цвет отдаётся платформе как `undefined`, и она берёт
     * `defaultValue` — цвет темы, посчитанный в `to_definitions`
     * (10.13.23 Ц3). Отдать пустую строку значило бы показать человеку
     * чёрное поле: цветом она полю не является. Заданный человеком цвет
     * уходит как есть и сильнее темы всегда (Ц6).
     */
    if (this.themedColorPaths().has(key) && !String(stored == null ? "" : stored).trim()) {
      return undefined;
    }
    const invert = this.inverted().get(key);
    if (invert === undefined) return stored;
    const n = Number(stored);
    return Number.isFinite(n) ? invert - n : stored;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const opts: SetOpts = { coalesceKey: this.coalesceKeyFor(key), undoable: true };
    const invert = this.inverted().get(key);
    const shown = Number(value);
    const write = invert !== undefined && Number.isFinite(shown) ? invert - shown : value;
    await this.deps.store.set(key, write, opts);

    /*
     * Свои блоки здесь не будятся: их будит подписка на хранилище, и
     * будит по-настоящему изменившимся путям. Второй вход сюда означал бы
     * двойную перерисовку на каждой записи из панели и — что хуже — два
     * способа проснуться, из которых один однажды отстанет от другого.
     */

    /* Кнопка сброса меняется на себе самой, без пересборки. */
    this.syncResetButtons(key);

    /*
     * Пересборка — только когда изменилось само определение, а не значение.
     * Остался один такой случай: «?» у подсказок. Всё остальное платформа
     * подхватывает пересчётом предикатов, и это важно — пересборка на каждом
     * шаге слайдера заменяет его новым узлом, и перетаскивание обрывается.
     */
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
   * Разбудить подписчиков изменившихся путей. Совпадением считается и путь
   * внутри пути: у группы значений ветка меняется целиком.
   *
   * Одна запись меняет много путей сразу — переименование Field задевает
   * почти три десятка, — поэтому подписчики сначала собираются в множество,
   * а рисуются по одному разу. Иначе предпросмотр перерисовался бы столько
   * раз, сколько путей задел патч.
   */
  private wakeFor(changed: readonly string[]): void {
    const hit = new Set<{ paths: readonly string[]; redraw: () => void }>();
    for (const w of Array.from(this.watchers)) {
      if (w.paths.some(p => changed.some(c => SettingsPane.touches(p, c)))) hit.add(w);
    }
    for (const w of hit) {
      /*
       * Значение уже записано, и падение предпросмотра не должно его
       * отменять. Молчать тоже нельзя: без сообщения такой сбой ищут глазами.
       */
      try { w.redraw(); }
      catch (e) { console.error("inline-overhaul: свой блок упал при перерисовке", e); }
    }

    /*
     * Запись из своего блока тоже может менять **список** значений выпадающего
     * списка, а не только значения: свои блоки пишут `plugin.setConfigPatch`,
     * минуя шов панели, и до `definitionsChanged` такая запись не доходит.
     * Пересобираем только если задетый источник и правда стоит на открытой
     * вкладке — оговорка объяснена у `optionSourcesTouched`.
     */
    if (this.rebuildNeeded(changed)) {
      if (this.deps.rebuild) this.deps.rebuild();
      else if (this.deps.refresh) this.deps.refresh();
    }

    /*
     * Вводные фразы групп — не пересборкой, а своей отрисовкой: пересборка
     * их не трогает вовсе, потому что группу платформа переиспользует, а
     * `extraButtons` зовёт только у созданной заново. Разбор — у
     * `syncGroupCallouts`.
     *
     * Место одно, и это то же место, где просыпаются свои блоки: сюда
     * доходит и запись через шов панели, и патч своего блока.
     */
    if (changed.some(c => SettingsPane.touches("general.help.showCallouts", c))) {
      this.syncGroupCallouts();
    }
    /* И знаки «?» у заголовков групп — по той же причине (A30). Их
       положение зависит от двух тумблеров сразу. */
    if (changed.some(c => SettingsPane.touches("general.help.showTips", c)
      || SettingsPane.touches("advanced.showSettingIds", c))) {
      this.syncGroupTips();
    }
  }

  /**
   * Меняет ли эта запись сами определения, а не только значения.
   *
   * Таких случаев три, и все про тексты: тумблер подсказок, подпись id в них
   * (10.13.5) и тумблер коллаутов. Значения платформа подхватывает пересчётом
   * предикатов, а описания собираются один раз и кешируются (П-11) — их надо
   * пересобрать.
   *
   * `Show callouts` попал сюда доделкой: вводные коллауты вкладок он убирал
   * сразу (у их групп предикат `visible`, а его платформа пересчитывает
   * сама), а коллауты групп — только после перехода по вкладкам. Они приезжают
   * из `extraButtons`, то есть из **определений**, а те пересобираются лишь по
   * этому списку. Заказчик: «обновление экрана происходит только при
   * перещелкивании вкладок… должно быть онлайн» (2026-09-05).
   */
  private definitionsChanged(key: string): boolean {
    return key === "general.help.showTips"
      || key === "general.help.showCallouts"
      || key === "advanced.showSettingIds"
      /* Язык меняет не значение, а весь видимый текст (10.13.38): без
         пересборки панель осталась бы прежней до перехода по вкладкам. */
      || key === LANGUAGE_PATH;
  }

  /*
   * Третий случай — путь, от которого зависит **список** значений выпадающего
   * списка (C44), — сюда намеренно не добавлен, и это выяснила мутация.
   *
   * Первая версия правки считала источники и здесь, и в `wakeFor`. Снятие
   * ветки отсюда проверку не покрасило: запись через шов панели всё равно
   * идёт в хранилище, хранилище отдаёт изменившиеся пути, и пересборку просит
   * `wakeFor`. То есть ветка была вторым объявлением одного правила, а два
   * объявления расходятся молча (У-32). Осталось одно место, и оно ловит и
   * записи из панели, и патчи своих блоков.
   */

  /**
   * Источники значений, задетые этими путями, — но только те, что и правда
   * стоят на открытой вкладке.
   *
   * Оговорка про вкладку не про экономию. Записи в Fields идут не через шов
   * панели, а патчами из своего блока, и их много: перетаскивание, каждая
   * буква короткого имени. Пересобирать панель на каждой такой записи значит
   * заменять узлы под руками человека — тем самым, из-за чего пересборка на
   * шаге слайдера однажды отобрала у слайдера перетаскивание. А список
   * `Which Field draws Bars` живёт на другой вкладке, и к моменту, когда
   * человек до неё дойдёт, определения соберутся заново сами: переход по
   * вкладкам — законная пересборка.
   */
  /**
   * Нужна ли пересборка определений из-за этих путей.
   *
   * Два случая, и оба про **структуру**, а не про значение:
   *
   *   1. путь, от которого зависит список значений выпадающего списка (C44);
   *   2. тумблер модуля открытой вкладки — от него зависит, показывает вкладка
   *      свои группы или калитку (C7). Без этого включить модуль на его же
   *      вкладке было бы нельзя: калитка осталась бы стоять до перехода по
   *      вкладкам.
   *
   * Оба спрашиваются в одном месте: второе объявление того же правила
   * расходится молча (У-32), и по C44 это уже подтвердилось мутацией.
   */
  private rebuildNeeded(changed: readonly string[]): boolean {
    /*
     * Ровно этот путь, а не «задевает» его: `touches` считает совпадением и
     * предка, а хранилище сообщает вместе с листом и его ветку — тогда
     * пересборкой отвечала бы любая запись внутри `general`. Язык — лист,
     * и сравнивать его надо с листом.
     */
    if (changed.indexOf(LANGUAGE_PATH) >= 0) return true;
    if (this.optionSourcesTouched(changed).length) return true;
    const tab = this.view().tabs.find(t => t.id === this.active);
    const gate = String((tab && tab.module) || "").trim();
    if (!gate) return false;
    return changed.some(c => SettingsPane.touches(gate, c));
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
        if (hit) out.push(source);
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

  /**
   * Пути цветов, у которых пустое значение означает «взять у темы»
   * (10.13.23). Считается один раз: схема за время жизни панели не меняется.
   */
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
      /* Внутри панели читается записанное: предикаты и предпросмотры знают
         конфиг, а не то, что показано на слайдере. */
      get: (path: string) => this.storedValue(path),
      set: (path: string, value: unknown, opts?: SetOpts) => this.deps.store.set(path, value, opts),
      run: (action: ActionId) => this.run(action),
      watch: (paths: readonly string[], redraw: () => void) => this.watch(paths, redraw),
      /*
       * Текст по ключу — для своих блоков (10.13.38). У записи `custom` нет
       * ни имени, ни описания, и подстановка по схеме до её текстов не
       * достаёт: коллаут вкладки, предпросмотры и справочник команд берут
       * свои строки из `schema/custom_texts.ts` сами. Второй аргумент — то,
       * что там написано: он же и ответ, когда перевода нет.
       */
      t: (key: string, fallback: string) => this.view().t(key, fallback),
    };
    if (this.deps.platform) ctx.platform = this.deps.platform;
    return ctx;
  }

  /* ---- свои блоки (раздел 10) ---------------------------------------- */

  /**
   * Строка со своей вёрсткой. Платформа отдаёт блоку строку целиком, блок
   * её очищает и рисует своё; возвращённая функция снимает то, что блок
   * завёл сам (С5).
   *
   * `searchable: false` — в поиск попадают настройки, а не предпросмотры и
   * не вводные тексты. `data-io-item` нужен переходу по `id`: у строки,
   * которую рисует платформа, других приметных признаков нет.
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
   * Действия, которые сейчас выполняются. Пока действие идёт, его кнопка
   * неактивна (5.6): второе нажатие по «Применить» запускало бы применение
   * заметки поверх незаконченного первого.
   */
  private busy = new Set<string>();

  async run(action: ActionId): Promise<void> {
    const fn = this.deps.actions[action];
    if (!fn) {
      /* Кнопки без действия в схему не попадают, так что это ошибка сборки,
         а не пользовательская ситуация. */
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
    /* `Show callouts` (10.13.27): выключенный убирает и вводные коллауты
       вкладок, и вводные фразы групп. Вкладочные закрывает предикат `visible`
       у вводных групп, эти — тумблер здесь. */
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
      resetGroup: group => this.resetButtonFor(group),
      groupTip: group => this.groupTipButtonFor(group, showTips, showIds),
      /*
       * Значения, которых в схеме нет: Fields человека. Читаются тем же
       * чтением, которым их берут предпросмотры, — второй разбор того же
       * формата разошёлся бы с первым (П11).
       */
      optionsFrom: source => this.optionsFor(source, ctx),
      activeTab: this.active,
    };
    if (this.deps.tabStrip) {
      const draw = this.deps.tabStrip;
      wiring.tabStrip = () => (draw({
        tabs: this.tabsWithGroups(),
        active: this.active,
        pick: (id: TabId) => this.setActiveTab(id),
      }) as ReturnType<NonNullable<Wiring["tabStrip"]>>);
    }
    return wiring;
  }

  /**
   * Значения списка, которых в схеме нет и быть не может: они приходят из
   * данных человека. Источник называется именем, чтобы прототип мог назвать
   * его так же и генератор перенёс это как обычную строку.
   */
  private optionsFor(
    source: string,
    ctx: SettingsCtx,
  ): ReadonlyArray<{ value: string; label: string }> {
    /* Полосы красятся цветом Value, а он есть только у тега (З8). */
    if (source === "tag-fields") return fieldOptions(ctx, f => f.kind === "tag");
    /*
     * Языки: английский плюс всё, что нашлось в папке плагина. Имя языка
     * берётся из самого файла — список в коде пришлось бы править ради
     * каждого нового языка, и «добавить язык» перестало бы быть простым.
     */
    if (source === "languages") return languageOptions(this.deps.texts ? (this.deps.texts() || {}) : {});
    if (source === "templates") {
      /* Путь тот же, что объявлен в `OPTION_SOURCE_DEPS`: одно правило — одно
         место, иначе список и его зависимость разойдутся молча (У-32). */
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
    /* Кнопки создаст платформа, когда вызовет функции из extraButtons: до тех
       пор прежние ссылки указывают на снятые узлы и держать их незачем. */
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
   * Сброс идёт одной записью undo: одно нажатие — один шаг назад (Н4).
   * Свои блоки не трогаются: Fields, Values и правила — данные, а не
   * настройки (Н5).
   *
   * И спрашивает перед тем, как что-то менять (Н3). Окна нет — сброса нет:
   * молчаливое согласие в действии, которое меняет разом всю группу, хуже
   * неработающей кнопки. Так же устроено восстановление копии настроек (5.6).
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
   * Н1: место кнопки в заголовке занято всегда, а Н2 гасит её, когда сбрасывать
   * нечего. Первая версия кнопку показывала и убирала — и этим меняла само
   * определение группы на первом же шаге слайдера: платформа пересобирала
   * страницу, заменяла узел слайдера, и перетаскивание обрывалось.
   */
  private resetButtonFor(group: SettingsGroup): ((btn: ExtraButtonComponent) => unknown) | null {
    if (!group.items.some(it => isBound(it))) return null;
    return (btn: ExtraButtonComponent) => {
      this.resetButtons.set(group.id, btn);
      /*
       * Своя пометка на узле кнопки: по ней CSS отправляет сброс к правому
       * краю строки заголовка, оставляя «?» у текста. Оба знака платформа
       * кладёт в одну колонку контролов, и без пометки правило двигало их
       * вместе — заказчик это и написал: «сдвинь reset group обратно вправо»
       * (B7, 2026-09-02).
       */
      const node = (btn as unknown as { extraSettingsEl?: TipButtonEl }).extraSettingsEl;
      if (node && node.classList && typeof node.classList.add === "function") {
        node.classList.add("io-groupreset");
      }
      btn.setIcon("rotate-ccw").onClick(() => { void this.resetGroup(group); });
      return this.paintResetButton(group, btn);
    };
  }

  /**
   * Вводная фраза группы — своей строкой под заголовком.
   *
   * Рисуется, а не описывается: строку, у которой есть только `desc`,
   * платформа **не рисует вовсе** (`app.js`, `Z2`: нужно `name`, `render`,
   * `control` или `action`). Из-за этого вводных фраз в панели не было
   * никогда, а вместе с ними до окна не доезжало тело подсказки группы,
   * которое ехало той же строкой, — отсюда четыре захода «при нажатии на "?"
   * ничего не происходит» (B7, C18, C41, C42).
   */
  /**
   * Вводная фраза группы — коллаутом между заголовком и карточкой настроек.
   *
   * **Почему через `extraButtons`.** Строка заголовка принадлежит платформе, и
   * единственное, что она у неё просит, — функции для колонки кнопок. Узел
   * кнопки и есть та точка опоры, с которой видно и саму строку заголовка, и
   * её место в группе; дальше коллаут встаёт `insertAdjacentElement`
   * («afterend»), то есть между заголовком и карточкой. Ровно так уже стоит
   * тело подсказки группы, и это единственное место, где узел переживает
   * отрисовку: список строк платформа переписывает целиком (`i6`), а детей
   * группы помимо списка не трогает.
   *
   * Сам узел кнопки скрыт классом: кнопки здесь нет и быть не должно —
   * коллаут не нажимается. Тот же приём, что у припаркованной строки полосы
   * вкладок (`io-tabsrow--parked`).
   *
   * **Почему не строкой внутри карточки, как было до 2026-09-04.** Заказчик:
   * «это сделано не красиво, как plain text сверху над настройками… коллауты
   * должны размещаться под хедерами настроек и до самих настроек (т.е. до
   * серого поля). Коллауты не должны находится на сером фоне».
   *
   * Повторную отрисовку коллаут переживает **снятием прежнего**: платформа
   * зовёт эти функции на каждой сборке определений, а строку заголовка может
   * и переиспользовать — без снятия коллаутов накапливалось бы по одному на
   * отрисовку.
   */
  /**
   * Кнопка сворачивания группы.
   *
   * Место: строка заголовка, до названия. Узел кнопки платформа кладёт в
   * колонку контролов — то есть **после** имени, — и вернуть его на место
   * переносом нельзя: список детей строки платформа переписывает на каждой
   * отрисовке. Поэтому кнопка остаётся там, куда её положили, а до названия
   * встаёт вёрсткой: `order: -1` внутри строки заголовка, ставшей флексом.
   *
   * Что прячется: карточка настроек и коллаут группы. Заголовок остаётся —
   * иначе разворачивать было бы нечем.
   *
   * Класс ставится на узел группы, а не на каждую строку: строки платформа
   * пересобирает, узел группы — нет.
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

      /* Прежний знак снимается: платформа зовёт эти функции на каждой сборке
         определений, а строку заголовка может и переиспользовать. */
      const stale = typeof heading.querySelectorAll === "function"
        ? heading.querySelectorAll(".io-fold")
        : [];
      for (const old of stale) { if (typeof old.remove === "function") old.remove(); }

      const mark = heading.createEl("button", { cls: "io-fold" });
      /* Первым ребёнком строки: знак стоит **до названия** (просьба заказчика). */
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
   * Вводная фраза группы: снять прежнюю и, если тумблер включён, нарисовать
   * новую. **Одно объявление на два входа** — на сборку определений и на
   * щелчок по `Show callouts` (У-32): разойдясь, они дали бы группу, у
   * которой коллаут есть, а пометки выравнивания нет.
   */
  private static paintGroupCallout(
    heading: TipHostEl,
    host: TipHostEl,
    intro: string,
    show: boolean,
  ): void {
    /* Прежний коллаут этой группы снимается всегда: иначе на каждой
       отрисовке добавлялся бы ещё один, а при выключении оставался бы
       прежний. */
    const stale = typeof host.querySelectorAll === "function"
      ? host.querySelectorAll(".io-callout--group")
      : [];
    for (const old of stale) { if (typeof old.remove === "function") old.remove(); }

    /*
     * Пометка на узле группы: по ней стили ужимают отступ заголовка снизу,
     * и коллаут встаёт **посередине** между заголовком и карточкой
     * настроек. Без неё сверху оставался отступ платформы, снизу наш, и
     * коллаут прижимался к настройкам — заказчик 2026-09-05: «под хедером
     * много пустого места, затем коллаут, сразу после которого идут
     * настройки; я хочу, чтобы коллауты были отцентрированы».
     */
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
   * Перерисовать вводные фразы групп, ничего не пересобирая.
   *
   * **Почему не пересборкой определений.** Она этого не делает и не может:
   * группу платформа **переиспользует**, если совпали её тип и заголовок
   * (`$2` и `t6` в `app.js`), а `extraButtons` вызываются только у группы,
   * созданной заново. Коллаут приезжает как раз оттуда — и поэтому тумблер
   * действовал лишь после перехода по вкладкам, который создаёт группы с
   * нуля: «нет, по прежнему требуется перещелкивать вкладки» (2026-09-05,
   * второе замечание к `Show callouts`). Ни одна проверка этого не видела:
   * пин спрашивал, попросила ли панель пересборку, а не что от неё вышло
   * (У-58, У-69).
   *
   * Поэтому строки заголовков панель запоминает, когда платформа их отдаёт,
   * и рисует по ним сама.
   */
  private syncGroupCallouts(): void {
    const show = Boolean(this.storedValue("general.help.showCallouts"));
    for (const slot of this.calloutSlots.values()) {
      SettingsPane.paintGroupCallout(slot.heading, slot.host, slot.intro, show);
    }
  }

  /**
   * Показать или спрятать знаки «?» у заголовков групп. Причина та же, что у
   * коллаутов: пересборка определений до `extraButtons` не доходит (A30).
   */
  private syncGroupTips(): void {
    const tips = Boolean(this.storedValue("general.help.showTips"));
    const ids = Boolean(this.storedValue("advanced.showSettingIds"));
    for (const paint of this.tipSlots.values()) paint(tips, ids);
  }

  private groupCalloutButtonFor(
    group: SettingsGroup,
    showCallouts: boolean,
  ): ((btn: ExtraButtonComponent) => unknown) | null {
    const intro = String(group.intro || "").trim();
    if (!intro) return null;

    /*
     * Слот объявляется **и при выключенном тумблере**: он же точка опоры, по
     * которой строка заголовка запоминается. Без него включить коллауты на
     * лету было бы нельзя — рисовать оказалось бы некуда.
     */
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
   * «?» в строке заголовка группы (B7, C11, C18, C41, C42).
   *
   * Заказчик написал об этом знаке пять заходов подряд, и последние четыре —
   * «нажимаю, ничего не происходит». Причина всё это время была не в поиске
   * тела подсказки, а в том, что **тела в окне не было**: оно ехало вводной
   * строкой группы, а строку без `name`, `render`, `control` и `action`
   * платформа отбрасывает до отрисовки (`app.js`, `Z2`). Ни одна проверка
   * этого не видела: правило живёт в поведении платформы, а в типах пакета
   * его нет.
   *
   * Поэтому тело здесь больше не ищется. Оно **создаётся нажатием** и встаёт
   * сразу за строкой заголовка — ровно так это делает прототип (`attachTip`:
   * `tipEl = rich(el("div","io-tip"), text)` и
   * `anchor.insertAdjacentElement("afterend", tipEl)`). Узел принадлежит
   * кнопке, живёт в её замыкании, и вопросов «доехало ли», «где предок» и
   * «не клонировала ли его платформа» больше не существует.
   *
   * Из DOM берётся только то, что платформа сама и отдала: узел кнопки, его
   * строка заголовка и её место в группе. Всё под проверками на наличие: в
   * гейтах кнопка приходит заглушкой, и падать она не должна.
   */
  private groupTipButtonFor(
    group: SettingsGroup,
    showTips: boolean,
    showIds: boolean,
  ): ((btn: ExtraButtonComponent) => unknown) | null {
    const hint = String(group.tip || "").trim();
    /*
     * Подпись id — последней строкой подсказки, и у группы без своей
     * подсказки знак появляется ради неё одной: иначе id группы негде
     * увидеть (замечания A3 и C52).
     */
    if (!hint && !group.id) return null;
    /*
     * Слот заводится **при любом положении обоих тумблеров** — по той же
     * причине, что у коллаута (A30, У-69): платформа зовёт `extraButtons`
     * только у группы, созданной заново, и вернуть здесь `null` значило бы
     * лишить панель узла, на котором знак потом понадобится показать.
     * Показан он или спрятан, решает `paint`, и решает по значениям, взятым
     * в момент отрисовки.
     */
    const label = fill(this.frame("MORE_ABOUT"), group.heading);
    return (btn: ExtraButtonComponent) => {
      const node = (btn as unknown as { extraSettingsEl?: TipButtonEl }).extraSettingsEl;
      /* Тело живёт в замыкании кнопки: она его и создала, она и снимает. */
      let body: TipBodyEl | null = null;

      /**
       * Показать или спрятать знак. **Одно объявление на два входа** — на
       * сборку определений и на щелчок по `Show tips` (У-32).
       *
       * Знак платформы заменяется вопросительным: в прототипе это «?», и
       * человек ищет глазами именно его. Иконку не берём — её имя пришлось
       * бы угадывать в библиотеке темы.
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
        /* Открытое тело закрывается вместе со знаком: иначе подсказка
           осталась бы на экране без того, чем её закрыть. */
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
        /*
         * Место тела: сразу за строкой заголовка, внутри группы. Строка
         * заголовка платформе принадлежит, а вот узел рядом с ней — нет:
         * её список строк платформа переписывает на каждой отрисовке
         * (`i6`), а вот детей группы помимо списка — не трогает.
         */
        const host = heading && heading.parentElement ? heading.parentElement : heading;
        if (!host || typeof host.createDiv !== "function") return;
        const made = host.createDiv({ cls: "io-tip io-grouptip" });
        if (heading && typeof heading.insertAdjacentElement === "function") {
          heading.insertAdjacentElement("afterend", made);
        }
        if (hint && typeof made.createDiv === "function") {
          paintRich(made.createDiv({ cls: "io-tip__body" }) as unknown as DocLike, hint);
        }
        /*
         * Подпись id спрашивается **в момент открытия**, а не при сборке
         * определений: тумблер `Show setting ids` человек может щёлкнуть при
         * открытом окне, а `extraButtons` к тому времени давно отработали и
         * второй раз вызваны не будут (У-69).
         */
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
