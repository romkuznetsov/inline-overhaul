/**
 * Вкладка настроек на декларативном API Obsidian 1.13 (PRD 5.3).
 *
 * Платформа берёт рендеринг, привязки, условную видимость, валидацию и
 * индексацию в глобальном поиске. Нам остаются: схема как источник истины,
 * своё хранилище через шов getControlValue / setControlValue, свои блоки
 * через render и сборка описаний.
 */

import type { SettingDefinitionItem } from "obsidian";

import type { ActionId, SetOpts, SettingsCtx, SettingsGroup, SettingsStore, TabDef, TabId } from "./types.ts";
import { buildDefaultConfig, getIn, isBound } from "./types.ts";
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
    /*
     * Платформа сама пересчитывает предикаты, но не пересобирает определения.
     * А от значений зависят и сами определения: «?» появляется по Show tips,
     * кнопка сброса — по отличию от умолчания, состояние модуля — по тумблеру.
     * Без этого выключенный Show tips оставлял «?» на месте.
     */
    if (this.deps.rebuild) this.deps.rebuild();
    else if (this.deps.refresh) this.deps.refresh();
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
    return {
      get: (path: string) => this.getControlValue(path),
      set: (path: string, value: unknown, opts?: SetOpts) => this.deps.store.set(path, value, opts),
      run: (action: ActionId) => this.run(action),
    };
  }

  async run(action: ActionId): Promise<void> {
    const fn = this.deps.actions[action];
    if (!fn) {
      /* Кнопки без действия в схему не попадают, так что это ошибка сборки,
         а не пользовательская ситуация. */
      throw new Error("нет действия в реестре: " + action);
    }
    await fn();
  }

  private wiring(): Wiring {
    const ctx = this.ctx();
    const showTips = Boolean(this.getControlValue("general.help.showTips"));
    const wiring: Wiring = {
      ctx,
      run: (action: ActionId) => { void this.run(action); },
      describe: it => this.describer.describe(it, { showTips }),
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

  private resetButtonFor(group: SettingsGroup): { tooltip: string; onClick: () => void } | null {
    if (!group.items.some(it => isBound(it))) return null;
    const n = this.drift(group).length;
    if (!n) return null;
    return {
      tooltip: "Reset group: " + n + (n === 1 ? " setting differs" : " settings differ") + " from the default",
      onClick: () => { void this.resetGroup(group); },
    };
  }
}
