/**
 * Вкладка настроек, которую регистрирует плагин (PRD 5.3).
 *
 * Единственный файл слоя, который знает про модуль `obsidian`. Всё остальное
 * — схема, отображение, описания, хранилище — собирается и проверяется без
 * него, поэтому гейты работают на заглушке.
 */

import {
  AbstractInputSuggest,
  Modal,
  Notice,
  PluginSettingTab,
  Setting as SettingCtor,
  setIcon,
} from "obsidian";
import type { App, Setting, SettingDefinitionItem } from "obsidian";

import { SCHEMA, TABS } from "./schema/index.ts";
import type { TabDef, TabId } from "./types.ts";
import { SettingsPane } from "./settings_tab.ts";
import { ConfigStoreAdapter, type ConfigStoreLike } from "./store.ts";
import { buildActions, type ConfirmRequest, type VaultSeam } from "./actions.ts";
import { el } from "./custom/dom.ts";
import type { ActionId } from "./types.ts";

/** То, что слою настроек нужно от плагина. */
interface HostPlugin {
  store?: ConfigStoreLike & { config?: Record<string, unknown>; getSnapshot?: () => Record<string, unknown> };
  getConfig?: () => Record<string, unknown>;
}

/**
 * То, что плагин передаёт третьим аргументом для перенесённых блоков (3b):
 * нормализация Order и список заранее известных ключей живут в `main.js` и
 * из слоя настроек недостижимы. Аргумент необязательный: без него редактор
 * Fields просто не показывается, а остальная панель работает.
 */
interface HostBridge {
  normalizePkmOrder?: (raw: unknown) => unknown;
  pkmOrderFields?: readonly string[];
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

/**
 * Полоса вкладок (решение заказчика 2026-08-24). Декларативный API её не
 * умеет, поэтому она рисуется своей вёрсткой в строке `render`, а настройки
 * открытой вкладки по-прежнему рисует платформа.
 *
 * Полоса наша — значит и клавиатура наша (5.4): это `tablist`, между
 * вкладками ходят стрелками, в обход табуляции остаётся только активная.
 */
function tabStripRow(state: {
  tabs: readonly TabDef[];
  active: TabId;
  pick: (id: TabId) => void;
}): unknown {
  return {
    name: "",
    searchable: false,
    render: (setting: Setting) => {
      const row = setting.settingEl;
      row.empty();
      row.addClass("io-tabsrow");

      const strip = row.createDiv({ cls: "io-tabs" });
      strip.setAttribute("role", "tablist");
      strip.setAttribute("aria-label", "Settings areas");

      const buttons: HTMLElement[] = [];
      state.tabs.forEach(tab => {
        const isActive = tab.id === state.active;
        const btn = strip.createEl("button", {
          cls: "io-tab" + (isActive ? " io-tab--active" : ""),
          text: tab.label,
        });
        btn.setAttribute("role", "tab");
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
        btn.tabIndex = isActive ? 0 : -1;
        if (tab.desc) btn.setAttribute("aria-description", tab.desc);
        btn.addEventListener("click", () => state.pick(tab.id));
        buttons.push(btn);
      });

      /* Стрелки ходят по полосе, Home и End прыгают на края. */
      strip.addEventListener("keydown", (ev: KeyboardEvent) => {
        const at = state.tabs.findIndex(t => t.id === state.active);
        let next = -1;
        if (ev.key === "ArrowRight") next = (at + 1) % state.tabs.length;
        else if (ev.key === "ArrowLeft") next = (at - 1 + state.tabs.length) % state.tabs.length;
        else if (ev.key === "Home") next = 0;
        else if (ev.key === "End") next = state.tabs.length - 1;
        if (next < 0) return;
        ev.preventDefault();
        const tab = state.tabs[next];
        if (tab) state.pick(tab.id);
      });
    },
  };
}

/**
 * Окно «точно?». Живёт здесь, а не в реестре действий: `Modal` — платформа, а
 * реестр обязан собираться и проверяться без неё. Закрытие мимо кнопок — это
 * отказ, а не согласие: так же устроены все окна панели.
 */
function askConfirm(app: App, o: ConfirmRequest): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    let answered = false;
    const finish = (yes: boolean): void => {
      if (answered) return;
      answered = true;
      resolve(yes);
    };

    class ConfirmModal extends Modal {
      override onOpen(): void {
        const box = this.contentEl as unknown as import("./custom/dom.ts").El;
        box.empty();
        box.addClass("io-dlg");
        el(box, "h4", undefined, o.title);
        el(box, "p", "io-item__desc", o.body);
        if (o.rows && o.rows.length) {
          const list = el(box, "ul", "io-dlg__list");
          for (const row of o.rows) el(list, "li", undefined, row);
        }
        if (o.note) el(box, "p", "io-item__desc io-dlg__note", o.note);
        const foot = el(box, "div", "io-dlg__foot");
        const cancel = foot.createEl("button", { cls: "io-btn", text: "Cancel", attr: { type: "button" } });
        cancel.addEventListener("click", (() => { finish(false); this.close(); }) as never);
        const go = foot.createEl("button", {
          cls: o.danger ? "io-danger" : "io-btn io-btn--cta",
          text: o.confirmLabel,
          attr: { type: "button" },
        });
        go.addEventListener("click", (() => { finish(true); this.close(); }) as never);
      }

      override onClose(): void {
        finish(false);
        this.contentEl.empty();
      }
    }

    new ConfirmModal(app).open();
  });
}

/**
 * Vault для руководства. Единственное место, где слой настроек пишет файл в
 * хранилище, и оно здесь по той же причине, что и окно подтверждения: это
 * платформа, а реестр действий обязан собираться без неё.
 */
function vaultSeam(app: App): VaultSeam {
  return {
    exists: (path: string) => !!app.vault.getAbstractFileByPath(path),
    create: async (path: string, text: string) => { await app.vault.create(path, text); },
    open: async (path: string) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) throw new Error("Cannot open " + path);
      await app.workspace.getLeaf(true).openFile(file as never);
    },
  };
}

export class InlineOverhaulSettings extends PluginSettingTab {
  private pane: SettingsPane;

  constructor(app: App, plugin: HostPlugin, bridge?: HostBridge) {
    super(app, plugin as never);
    const normalizePkmOrder = bridge && typeof bridge.normalizePkmOrder === "function"
      ? bridge.normalizePkmOrder
      : null;
    this.pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store: new ConfigStoreAdapter(storeFor(plugin)),
      /*
       * Реестр действий (5.6). Кнопка, действия которой здесь нет, в схему
       * не попадает вовсе — этим занят `READY_ACTIONS` в `actions.ts`.
       */
      actions: buildActions({
        plugin: plugin as never,
        notify: (message: string) => { new Notice(message); },
        confirm: (o: ConfirmRequest) => askConfirm(app, o),
        vault: vaultSeam(app),
      }) as Record<string, () => Promise<void> | void>,
      /* То же окно и для сброса группы (Н3). */
      confirm: (o: ConfirmRequest) => askConfirm(app, o),
      fragments: {
        createFragment: () => document.createDocumentFragment() as never,
      },
      notify: (message: string) => { new Notice(message); },
      refresh: () => { this.refreshDomState(); },
      rebuild: () => { this.update(); },
      tabStrip: state => tabStripRow(state),
      /*
       * Шов для перенесённого редактора Fields. Без нормализации Order из
       * `main.js` его показывать нельзя: она нужна ему на каждом чтении, и
       * подделать её здесь значило бы завести вторую (З8, П9 по смыслу).
       */
      platform: normalizePkmOrder
        ? {
          Setting: SettingCtor,
          Notice,
          Modal,
          AbstractInputSuggest,
          setIcon: (node: unknown, icon: string) => { setIcon(node as HTMLElement, icon); },
          plugin,
          getConfig: () => (typeof plugin.getConfig === "function" ? plugin.getConfig() : {}),
          normalizePkmOrder,
          pkmOrderFields: (bridge && bridge.pkmOrderFields) || [],
        }
        : undefined,
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
