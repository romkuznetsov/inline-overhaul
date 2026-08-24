/**
 * Вкладка настроек, которую регистрирует плагин (PRD 5.3).
 *
 * Единственный файл слоя, который знает про модуль `obsidian`. Всё остальное
 * — схема, отображение, описания, хранилище — собирается и проверяется без
 * него, поэтому гейты работают на заглушке.
 */

import { Notice, PluginSettingTab } from "obsidian";
import type { App, SettingDefinitionItem } from "obsidian";

import { SCHEMA, TABS } from "./schema/index.ts";
import { SettingsPane } from "./settings_tab.ts";
import { ConfigStoreAdapter, type ConfigStoreLike } from "./store.ts";
import type { ActionId } from "./types.ts";

/** То, что слою настроек нужно от плагина. */
interface HostPlugin {
  store?: ConfigStoreLike & { config?: Record<string, unknown>; getSnapshot?: () => Record<string, unknown> };
  getConfig?: () => Record<string, unknown>;
}

/**
 * Обёртка над ConfigStore плагина. Чтение идёт по живому объекту, а не по
 * снимку: `getSettingDefinitions` вызывается часто (П-11), а `getSnapshot`
 * каждый раз клонирует весь конфиг.
 */
function storeFor(plugin: HostPlugin): ConfigStoreLike {
  const store = plugin.store;
  if (!store) throw new Error("inline-overhaul: settings pane needs plugin.store");

  return {
    getConfig(): Record<string, unknown> {
      if (store.config) return store.config;
      if (typeof store.getSnapshot === "function") return store.getSnapshot();
      if (typeof plugin.getConfig === "function") return plugin.getConfig();
      return {};
    },
    update(mutator, reason, opts) {
      /* ConfigStore ждёт функцию, которая возвращает следующий конфиг. */
      return store.update(
        (cfg: Record<string, unknown>) => {
          mutator(cfg);
          return cfg;
        },
        reason,
        opts,
      );
    },
  };
}

export class InlineOverhaulSettings extends PluginSettingTab {
  private pane: SettingsPane;

  constructor(app: App, plugin: HostPlugin) {
    super(app, plugin as never);
    this.pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store: new ConfigStoreAdapter(storeFor(plugin)),
      actions: {},          // реестр наполняется в фазе 5; кнопок без действий в схеме нет
      fragments: {
        createFragment: () => document.createDocumentFragment() as never,
      },
      notify: (message: string) => { new Notice(message); },
      refresh: () => { this.refreshDomState(); },
      rebuild: () => { this.update(); },
    });
  }

  /* ---- декларативный путь Obsidian 1.13 ------------------------------- */

  /*
   * Приведение типа живёт здесь, и только здесь. Слой настроек описывает
   * определения своей структурой, чтобы собираться и проверяться без модуля
   * obsidian; этот файл — единственный, который знает про платформу, и
   * единственное место, где две формы встречаются.
   */
  override getSettingDefinitions(): SettingDefinitionItem[] {
    return this.pane.getSettingDefinitions();
  }

  override getControlValue(key: string): unknown {
    return this.pane.getControlValue(key);
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    await this.pane.setControlValue(key, value);
  }

  /**
   * При декларативном пути `display` не вызывается. Если Obsidian всё же его
   * позвал, значит версия старше 1.13 и определения игнорируются — тогда
   * пустая панель хуже честного объяснения.
   */
  override display(): void {
    const el = this.containerEl;
    el.empty();
    const box = el.createDiv({ cls: "io-needs-update" });
    box.createEl("p", {
      text: "Inline Overhaul settings need Obsidian 1.13 or newer: the pane is built on the declarative settings API.",
    });
    box.createEl("p", {
      text: "Update Obsidian, or install an earlier release of the plugin.",
    });
  }
}

/** Действия кнопок появятся в фазе 5; тип держим рядом, чтобы не разошёлся. */
export type { ActionId };
