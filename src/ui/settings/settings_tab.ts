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
import { Describer, type FragmentHost } from "./describe.ts";

export interface TabDeps {
  schema: readonly SettingsGroup[];
  tabs: readonly TabDef[];
  store: SettingsStore;
  /** Реестр действий (5.6). Кнопка без действия в схему не попадает (З8). */
  actions: Record<string, () => Promise<void> | void>;
  /** Откуда брать DocumentFragment. В Obsidian это createFragment(). */
  fragments: FragmentHost;
  /** Сообщить пользователю результат действия. */
  notify?: (message: string) => void;
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

  constructor(deps: TabDeps) {
    this.deps = deps;
    this.describer = new Describer(deps.fragments);
    this.defaults = buildDefaultConfig(deps.schema);
    const first = deps.tabs.find(t => deps.schema.some(g => g.tab === t.id));
    this.active = (first ? first.id : "general") as TabId;
  }

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

  getControlValue(key: string): unknown {
    const v = this.deps.store.get(key);
    return v === undefined ? getIn(this.defaults, key) : v;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const opts: SetOpts = { coalesceKey: this.coalesceKeyFor(key), undoable: true };
    await this.deps.store.set(key, value, opts);

    /* Свои блоки перерисовывают себя сами, по своим путям (П2). */
    this.wake(key);

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

  /**
   * Разбудить подписчиков изменённого пути. Совпадением считается и путь
   * внутри пути: у группы значений ветка меняется целиком.
   */
  private wake(changed: string): void {
    for (const w of Array.from(this.watchers)) {
      const hit = w.paths.some(p =>
        p === changed || changed.startsWith(p + ".") || p.startsWith(changed + "."));
      if (!hit) continue;
      /*
       * Значение уже записано, и падение предпросмотра не должно его
       * отменять. Молчать тоже нельзя: без сообщения такой сбой ищут глазами.
       */
      try { w.redraw(); }
      catch (e) { console.error("inline-overhaul: свой блок упал при перерисовке", e); }
    }
  }

  /**
   * Меняет ли эта запись сами определения, а не только значения.
   *
   * Таких случаев два, и оба про тексты: тумблер подсказок и подпись id в них
   * (10.13.5). Значения платформа подхватывает пересчётом предикатов, а
   * описания собираются один раз и кешируются (П-11) — их надо пересобрать.
   */
  private definitionsChanged(key: string): boolean {
    return key === "general.help.showTips" || key === "advanced.showSettingIds";
  }

  /** Обновить кнопку сброса той группы, чьё значение изменилось. */
  private syncResetButtons(key: string): void {
    for (const group of this.deps.schema) {
      if (!group.items.some(it => isBound(it) && it.path === key)) continue;
      const btn = this.resetButtons.get(group.id);
      if (btn) this.paintResetButton(group, btn);
    }
  }

  /** Склейка записей идёт по id настройки, а не по пути (CS3). */
  private coalesceKeyFor(path: string): string {
    for (const group of this.deps.schema) {
      for (const it of group.items) {
        if (isBound(it) && it.path === path) return it.id;
      }
    }
    return path;
  }

  /* ---- определения для платформы ------------------------------------- */

  private ctx(): SettingsCtx {
    const ctx: SettingsCtx = {
      get: (path: string) => this.getControlValue(path),
      set: (path: string, value: unknown, opts?: SetOpts) => this.deps.store.set(path, value, opts),
      run: (action: ActionId) => this.run(action),
      watch: (paths: readonly string[], redraw: () => void) => this.watch(paths, redraw),
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
    const showTips = Boolean(this.getControlValue("general.help.showTips"));
    const showIds = Boolean(this.getControlValue("advanced.showSettingIds"));
    const wiring: Wiring = {
      ctx,
      run: (action: ActionId) => { void this.run(action); },
      busy: (action: ActionId) => this.busy.has(action),
      describe: it => this.describer.describe(it, { showTips, showIds }),
      showIds,
      renderCustom: it => this.renderCustom(it) as ReturnType<NonNullable<Wiring["renderCustom"]>>,
      resetGroup: group => this.resetButtonFor(group),
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

  /** Вкладки, у которых есть хотя бы одна группа: пустых не показываем. */
  tabsWithGroups(): readonly TabDef[] {
    return this.deps.tabs.filter(t => this.deps.schema.some(g => g.tab === t.id));
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    /* Кнопки создаст платформа, когда вызовет функции из extraButtons: до тех
       пор прежние ссылки указывают на снятые узлы и держать их незачем. */
    this.resetButtons.clear();
    return toDefinitions(this.deps.schema, this.deps.tabs, this.wiring());
  }

  /* ---- сброс группы к значениям по умолчанию (10.13.1) --------------- */

  /** Что в группе отличается от значения по умолчанию. */
  drift(group: SettingsGroup): Array<{ id: string; name: string; now: unknown; was: unknown }> {
    const out: Array<{ id: string; name: string; now: unknown; was: unknown }> = [];
    for (const it of group.items) {
      if (!isBound(it)) continue;
      const was = (it as unknown as { default: unknown })["default"];
      const now = this.getControlValue(it.path);
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
   */
  async resetGroup(group: SettingsGroup): Promise<number> {
    const drift = this.drift(group);
    let first = true;
    for (const d of drift) {
      const it = group.items.find(x => x.id === d.id);
      if (!it || !isBound(it)) continue;
      await this.deps.store.set(it.path, d.was, { coalesceKey: "reset:" + group.id, undoable: first });
      first = false;
    }
    if (drift.length && this.deps.notify) {
      this.deps.notify(drift.length + " settings back to default. Use Undo settings change to revert");
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
      btn.setIcon("rotate-ccw").onClick(() => { void this.resetGroup(group); });
      return this.paintResetButton(group, btn);
    };
  }

  /** Состояние кнопки: сколько настроек группы отличается от умолчания. */
  private paintResetButton(group: SettingsGroup, btn: ExtraButtonComponent): unknown {
    const n = this.drift(group).length;
    const tooltip = n
      ? "Reset group: " + n + (n === 1 ? " setting differs" : " settings differ") + " from the default"
      : "Everything here is already at its default";
    return btn.setDisabled(n === 0).setTooltip(tooltip);
  }
}
