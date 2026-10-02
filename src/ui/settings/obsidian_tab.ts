/**
 * Вкладка настроек плагина (PRD 5.3). Единственный файл слоя, знающий модуль
 * `obsidian`: остальное проверяется гейтами на заглушке.
 */

import {
  AbstractInputSuggest,
  Modal,
  Notice,
  Platform,
  PluginSettingTab,
  Scope,
  Setting as SettingCtor,
  setIcon,
} from "obsidian";
import type { App, SettingDefinitionItem } from "obsidian";

import { SCHEMA, TABS } from "./schema/index.ts";
import { SettingsPane } from "./settings_tab.ts";
import { inSettingsWindow, rememberSettingsRoot } from "./settings_window.ts";
import { ConfigStoreAdapter, type ConfigStoreLike } from "./store.ts";
import {
  buildActions,
  type AnnounceRequest,
  type BackupOptions,
  type BackupOptionsRequest,
  type HotkeyConflict,
  type HotkeyWriteOptions,
  type BackupFile,
  type ConfigSeam,
  type ConfirmRequest,
  type HotkeySeam,
  type PickRequest,
  type VaultSeam,
} from "./actions.ts";
import { checkInput, el, selectInput, textInput, tipBelow, type El, type ElCheck } from "./custom/dom.ts";
import { bindingKey, hotkeyListWords } from "../../features/settings_backup.js";
import { tabStripRow } from "./custom/tab_strip.ts";
import { BASE_LANG_SEED, type Catalogs } from "./texts.ts";
import { ensureCatalogFiles, readCatalogs, type TextFiles } from "./texts_files.ts";
import { ensureGuideFiles, guideTextFor } from "./guide_files.ts";
import { howtoMarkdown } from "./howto.ts";
import { panelCatalog } from "./texts_panel.ts";
import { TEXT_BY_NAME, dialogKey, fill } from "./texts_dialogs.ts";
import { RU_SEED } from "./texts_seed_ru.ts";
import type { ActionId } from "./types.ts";

/** То, что слою настроек нужно от плагина. */
interface HostPlugin {
  store?: ConfigStoreLike & { config?: Record<string, unknown>; getSnapshot?: () => Record<string, unknown> };
  getConfig?: () => Record<string, unknown>;
  /* Пересобрать построенное из конфига (команды); без него — до перезапуска. */
  rebuildFromConfig?: () => Promise<void> | void;
  /* Пересобрать оформление открытых заметок; причины вида панели пропускает сам. */
  refreshEditorsFor?: (reason: string) => void;
}

/**
 * Третий аргумент для перенесённых блоков (3b): нормализация Order и ключи из
 * `main.js`. Без него редактор Fields не показывается.
 */
interface HostBridge {
  normalizePkmOrder?: (raw: unknown) => unknown;
  pkmOrderFields?: readonly string[];
}

/** Обёртка ConfigStore. Чтение по живому объекту: `getSettingDefinitions` частый (П-11), снимок клонирует. */
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
    subscribe(listener) {
      if (typeof store.subscribe !== "function") return () => {};
      return store.subscribe(listener);
    },
    update(mutator, reason, opts) {
      /* Контрол пишет сюда, мимо `setConfigPatch`, поэтому пересборку открытых
         заметок зовём здесь (`Ф-4`, H1.1). */
      const changed = store.update(
        (cfg: Record<string, unknown>) => {
          mutator(cfg);
          return cfg;
        },
        reason,
        opts,
      );
      /* `false` — менять было нечего. */
      if ((changed as unknown) !== false && typeof plugin.refreshEditorsFor === "function") plugin.refreshEditorsFor(String(reason || ""));
      return changed;
    },
  };
}

/** Текст окна по имени из `texts_dialogs.ts`, не ключом: ключ строит одна функция (У-82). */
type Say = (name: string) => string;

/**
 * Заголовок окна с подсказкой (2026-09-06) — тот же `tipBelow`, что в панели
 * (У-32); `Show tips` приходит готовым. Свой `host` — чтобы подсказка вставала
 * под своим заголовком.
 */
function dlgHead(box: El, o: {
  text: string;
  tip?: string;
  showTips?: boolean;
  id: string;
  /** `h4` у заголовка окна, `div` у заголовка раздела внутри него. */
  tag?: string;
}): void {
  const host = el(box, "div", "io-dlg__head");
  const row = el(host, "div", "io-dlg__head-row");
  /* Тег — признак заголовка окна: его размер объявляем мы, а не тема. */
  el(row, o.tag || "div", o.tag ? "io-dlg__head-name io-dlg__title" : "io-dlg__head-name", o.text);
  tipBelow({
    head: row,
    host,
    text: o.tip || "",
    label: o.text,
    id: o.id,
    showTips: o.showTips === true,
  });
}

/** Окно «точно?»; здесь, а не в реестре: `Modal` — платформа. Закрытие мимо кнопок — отказ. */
function askConfirm(app: App, o: ConfirmRequest, say: Say): Promise<boolean> {
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
        el(box, "h4", "io-dlg__title", o.title);
        el(box, "p", "io-dlg__body", o.body);
        if (o.rows && o.rows.length) {
          const list = el(box, "ul", "io-dlg__list");
          for (const row of o.rows) el(list, "li", undefined, row);
        }
        if (o.note) el(box, "p", "io-dlg__body io-dlg__note", o.note);
        /* Галочка — между списком и кнопками. */
        if (o.check) {
          const input = checkInput(box, "io-dlg__check", {
            label: o.check.label,
            labelCls: "io-dlg__check-label",
            checked: o.check.checked === true,
          });
          if (o.check.sub) el(box, "p", "io-dlg__body io-dlg__sub", o.check.sub);
          input.addEventListener("change", (() => {
            if (typeof o.onCheck === "function") o.onCheck(input.checked === true);
          }) as never);
          if (typeof o.onCheck === "function") o.onCheck(input.checked === true);
        }
        const foot = el(box, "div", "io-dlg__foot");
        const cancel = foot.createEl("button",
          { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
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

    inSettingsWindow(() => new ConfirmModal(app).open());
  });
}

/** Окно на одну кнопку (2026-09-06): закрытие мимо неё — то же «прочитал», обещание разрешается один раз. */
function announce(app: App, o: AnnounceRequest): Promise<void> {
  return new Promise<void>(resolve => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve();
    };

    class AnnounceModal extends Modal {
      override onOpen(): void {
        const box = this.contentEl as unknown as import("./custom/dom.ts").El;
        box.empty();
        box.addClass("io-dlg");
        el(box, "h4", "io-dlg__title", o.title);
        el(box, "p", "io-dlg__body", o.body);
        if (o.rows && o.rows.length) {
          const list = el(box, "ul", "io-dlg__list");
          for (const row of o.rows) el(list, "li", undefined, row);
        }
        if (o.note) el(box, "p", "io-dlg__body io-dlg__note", o.note);
        const foot = el(box, "div", "io-dlg__foot");
        const go = foot.createEl("button", {
          cls: "io-btn io-btn--cta",
          text: o.closeLabel,
          attr: { type: "button" },
        });
        go.addEventListener("click", (() => { finish(); this.close(); }) as never);
      }

      override onClose(): void {
        finish();
        this.contentEl.empty();
      }
    }

    inSettingsWindow(() => new AnnounceModal(app).open());
  });
}

/** Окно состава копии (2026-09-06): всё выбрано по максимуму, закрытие мимо кнопки — отказ. */
function askBackupOptions(app: App, o: BackupOptionsRequest, say: Say): Promise<BackupOptions | null> {
  return new Promise<BackupOptions | null>(resolve => {
    let answered = false;
    const finish = (value: BackupOptions | null): void => {
      if (answered) return;
      answered = true;
      resolve(value);
    };

    class OptionsModal extends Modal {
      override onOpen(): void {
        const box = this.contentEl as unknown as import("./custom/dom.ts").El;
        box.empty();
        box.addClass("io-dlg");
        /* Три заголовка, у каждого своя подсказка (2026-09-06). */
        dlgHead(box, { text: o.title, tip: o.tip, showTips: o.showTips, id: "backup-save-tip", tag: "h4" });

        el(box, "div", "io-dlg__field-label", o.commentLabel);
        const comment = textInput(box, "io-dlg__input", {
          value: "",
          label: o.commentLabel,
          placeholder: o.commentHint,
        });

        dlgHead(box, {
          text: o.partsLabel,
          tip: o.partsTip,
          showTips: o.showTips,
          id: "backup-parts-tip",
        });
        const boxes: { id: string; input: ElCheck }[] = [];
        const list = el(box, "div", "io-dlg__checks");
        for (const part of o.parts) {
          boxes.push({
            id: part.id,
            input: checkInput(list, "io-dlg__check", {
              label: part.label,
              labelCls: "io-dlg__check-label",
              checked: part.checked === true,
            }),
          });
        }

        dlgHead(box, {
          text: o.hotkeyLabel,
          tip: o.hotkeyTip,
          showTips: o.showTips,
          id: "backup-hotkeys-tip",
        });
        const scope = selectInput(box, "io-dlg__select", {
          options: o.hotkeyOptions,
          value: o.hotkeyDefault,
          label: o.hotkeyLabel,
        });

        const foot = el(box, "div", "io-dlg__foot");
        const cancel = foot.createEl("button",
          { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
        cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
        const go = foot.createEl("button", {
          cls: "io-btn io-btn--cta",
          text: o.confirmLabel,
          attr: { type: "button" },
        });
        go.addEventListener("click", (() => {
          finish({
            parts: boxes.filter(b => b.input.checked).map(b => b.id),
            comment: String(comment.value || ""),
            hotkeyScope: String(scope.value || o.hotkeyDefault),
          });
          this.close();
        }) as never);
      }

      override onClose(): void {
        finish(null);
        this.contentEl.empty();
      }
    }

    inSettingsWindow(() => new OptionsModal(app).open());
  });
}

/** Окно выбора копии настроек (Б9). Закрытие мимо строк — отказ. */
function askPick(app: App, o: PickRequest, say: Say): Promise<string | null> {
  return new Promise<string | null>(resolve => {
    let answered = false;
    const finish = (value: string | null): void => {
      if (answered) return;
      answered = true;
      resolve(value);
    };

    class PickModal extends Modal {
      override onOpen(): void {
        const box = this.contentEl as unknown as import("./custom/dom.ts").El;
        box.empty();
        box.addClass("io-dlg");
        el(box, "h4", "io-dlg__title", o.title);
        el(box, "p", "io-dlg__body", o.body);
        const list = el(box, "div", "io-dlg__picks");
        for (const option of o.options) {
          const row = list.createEl("button", { cls: "io-dlg__pick", attr: { type: "button" } });
          el(row as unknown as import("./custom/dom.ts").El, "div", "io-dlg__pick-name", option.label);
          if (option.sub) {
            el(row as unknown as import("./custom/dom.ts").El, "div", "io-dlg__pick-sub", option.sub);
          }
          if (option.note) {
            el(row as unknown as import("./custom/dom.ts").El, "div", "io-dlg__pick-note", option.note);
          }
          row.addEventListener("click", (() => { finish(option.value); this.close(); }) as never);
        }
        const foot = el(box, "div", "io-dlg__foot");
        const cancel = foot.createEl("button",
          { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
        cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      }

      override onClose(): void {
        finish(null);
        this.contentEl.empty();
      }
    }

    inSettingsWindow(() => new PickModal(app).open());
  });
}

/** Шов vault — единственная запись слоя настроек в хранилище; здесь, потому что это платформа. */
function vaultSeam(app: App): VaultSeam {
  return {
    /* Через адаптер: файлы папки плагина в дерево vault не попадают. */
    exists: async (path: string) => await app.vault.adapter.exists(path),
    create: async (path: string, text: string) => { await app.vault.create(path, text); },
    open: async (path: string) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) throw new Error("Cannot open " + path);
      const leaf = app.workspace.getLeaf(true);
      await leaf.openFile(file as never);
      /* Окно настроек поверх главного — поднять главное (BUGHUNT R2). */
      app.workspace.setActiveLeaf(leaf, { focus: true });
      const win = (leaf.view.containerEl as unknown as { ownerDocument?: Document }).ownerDocument?.defaultView;
      if (win && typeof win.focus === "function") win.focus();
    },
    read: async (path: string) => await app.vault.adapter.read(path),
    /* При первом сохранении (Б2); «уже есть» адаптер бросает исключением — гасим. */
    ensureFolder: async (path: string) => {
      const folder = String(path || "").replace(/\/+$/, "");
      if (!folder) return;
      if (await app.vault.adapter.exists(folder)) return;
      try {
        await app.vault.createFolder(folder);
      } catch (e) {
        if (!await app.vault.adapter.exists(folder)) throw e;
      }
    },
    list: async (folder: string): Promise<BackupFile[]> => {
      const path = String(folder || "").replace(/\/+$/, "");
      if (!path || !(await app.vault.adapter.exists(path))) return [];
      const found = await app.vault.adapter.list(path);
      const out: BackupFile[] = [];
      for (const file of found.files || []) {
        let mtime = 0;
        try {
          const stat = await app.vault.adapter.stat(file);
          mtime = stat && typeof stat.mtime === "number" ? stat.mtime : 0;
        } catch (_) {
          /* проба: `stat` может не быть — времени нет */
          mtime = 0;
        }
        out.push({ path: file, mtime });
      }
      return out;
    },
  };
}

/** Хранилище для копий: запись тем же `update`, что вся панель (миграция, undo). */
function configSeam(plugin: HostPlugin): ConfigSeam {
  const store = storeFor(plugin);
  return {
    /* Снимок: восстановление собирает следующий конфиг из нынешнего. */
    get: () => JSON.parse(JSON.stringify(store.getConfig())) as Record<string, unknown>,
    replace: async (next: Record<string, unknown>) => {
      const before = JSON.stringify(store.getConfig());
      await store.update(
        cfg => {
          for (const key of Object.keys(cfg)) delete cfg[key];
          Object.assign(cfg, next);
        },
        "settings:restore-backup",
      );
      return JSON.stringify(store.getConfig()) !== before;
    },
  };
}

function pluginVersionOf(plugin: HostPlugin): string {
  const manifest = (plugin as { manifest?: { version?: unknown } }).manifest;
  return manifest && manifest.version ? String(manifest.version) : "";
}

/**
 * Хоткеи команд плагина (Б18, В-32): служебное API Obsidian, второе
 * исключение к 7.2 (первое — К-2), запись разрешена 2026-09-04. По `app.js`
 * 1.13.7:
 *   - `customKeys` — геттер, отдающий копию (хранилище под символом): писать
 *     только `setHotkeys`;
 *   - `setHotkeys(id, list)` сбрасывает `baked` — работает без перезапуска;
 *   - `removeHotkeys(id)` возвращает умолчание плагина;
 *   - `save()` пишет `hotkeys.json`, без него — до конца сеанса.
 * Снимаются только свои команды (`<id плагина>:`): чужой хоткей восстановление
 * снять не вправе.
 */
interface HotkeyManagerApi {
  customKeys?: Record<string, unknown>;
  /** Хоткеи по умолчанию — держатся и без назначения руками. */
  defaultKeys?: Record<string, unknown>;
  setHotkeys?: (id: string, bindings: unknown[]) => void;
  removeHotkeys?: (id: string) => void;
  save?: () => Promise<void> | void;
}

/** Имя чужой команды для окна. */
function commandNameOf(app: App, id: string): string {
  const holder = app as unknown as { commands?: { commands?: Record<string, { name?: unknown }> } };
  const found = holder && holder.commands && holder.commands.commands
    ? holder.commands.commands[id]
    : null;
  const name = found && found.name ? String(found.name) : "";
  return name || id;
}

/** Привязка строкой для сравнения; правило в `settings_backup.js`, здесь только платформа: `Mod` — Cmd на macOS (2026-09-06). */
function keyOf(binding: unknown): string {
  return bindingKey(binding, { mac: Platform.isMacOS });
}

function hotkeyManagerOf(app: App): HotkeyManagerApi | null {
  const holder = app as unknown as { hotkeyManager?: unknown };
  const value = holder && typeof holder === "object" ? holder.hotkeyManager : null;
  return value && typeof value === "object" ? (value as HotkeyManagerApi) : null;
}

/** Префикс идентификаторов команд плагина: `<id плагина>:`. */
function commandPrefixOf(plugin: HostPlugin): string {
  const manifest = (plugin as { manifest?: { id?: unknown } }).manifest;
  const id = manifest && manifest.id ? String(manifest.id) : "inline-overhaul";
  return id + ":";
}

function hotkeySeam(app: App, plugin: HostPlugin): HotkeySeam {
  const prefix = commandPrefixOf(plugin);
  const mine = (id: string): boolean => String(id || "").startsWith(prefix);

  /** Что команда держит сейчас: назначенное руками сильнее умолчания. */
  const effective = (hm: HotkeyManagerApi, id: string): unknown[] => {
    const custom = hm.customKeys && typeof hm.customKeys === "object" ? hm.customKeys[id] : undefined;
    if (Array.isArray(custom)) return custom;
    const fallback = hm.defaultKeys && typeof hm.defaultKeys === "object" ? hm.defaultKeys[id] : undefined;
    return Array.isArray(fallback) ? fallback : [];
  };

  return {
    /** Назначенное руками, и чужое тоже; умолчаний нет — они приедут с плагинами. */
    readAll: () => {
      const out: Record<string, unknown[]> = {};
      const hm = hotkeyManagerOf(app);
      const custom = hm && hm.customKeys && typeof hm.customKeys === "object" ? hm.customKeys : null;
      if (!custom) return out;
      for (const id of Object.keys(custom)) {
        const value = custom[id];
        if (Array.isArray(value)) out[id] = value as unknown[];
      }
      return out;
    },

    /** Чужие команды на тех же клавишах — по действующим привязкам, с умолчаниями. */
    conflicts: (map: Record<string, unknown[]>) => {
      const hm = hotkeyManagerOf(app);
      if (!hm) return [];
      const wanted = new Map<string, true>();
      for (const id of Object.keys(map || {})) {
        const list = Array.isArray(map[id]) ? map[id] : [];
        for (const binding of list) {
          const key = keyOf(binding);
          if (key) wanted.set(key, true);
        }
      }
      if (!wanted.size) return [];
      const ids = new Set<string>();
      for (const source of [hm.customKeys, hm.defaultKeys]) {
        if (source && typeof source === "object") for (const id of Object.keys(source)) ids.add(id);
      }
      const out: HotkeyConflict[] = [];
      for (const id of ids) {
        if (mine(id) || map[id] !== undefined) continue;
        const clashing = effective(hm, id).filter(binding => wanted.has(keyOf(binding)));
        if (!clashing.length) continue;
        out.push({
          id,
          name: commandNameOf(app, id),
          /* Как на экране `Hotkeys`: `Ctrl`/`Cmd`, не `Mod`. */
          hotkey: hotkeyListWords(clashing, { mac: Platform.isMacOS }),
        });
      }
      return out;
    },

    read: () => {
      const out: Record<string, unknown[]> = {};
      const hm = hotkeyManagerOf(app);
      const custom = hm && hm.customKeys && typeof hm.customKeys === "object" ? hm.customKeys : null;
      if (!custom) return out;
      for (const id of Object.keys(custom)) {
        if (!mine(id)) continue;
        const value = custom[id];
        if (Array.isArray(value)) out[id] = value as unknown[];
      }
      return out;
    },

    write: async (map: Record<string, unknown[]>, opts?: HotkeyWriteOptions) => {
      const hm = hotkeyManagerOf(app);
      if (!hm || typeof hm.setHotkeys !== "function" || typeof hm.removeHotkeys !== "function") {
        throw new Error("This build of Obsidian does not let the plugin write hotkeys");
      }
      /* Чужие хоткеи — только если копия снята с `all` (2026-09-06). */
      const wide = opts && opts.scope === "all";
      const wanted = new Set<string>();
      /* Ответ — число клавиш на наших командах, не команд (D9). */
      let written = 0;

      /* Конфликты снимаются до записи, иначе чужой и наш неразличимы. Пустой
         список `setHotkeys` — «снял клавишу»; `removeHotkeys` вернул бы умолчание. */
      if (opts && opts.clearConflicts) {
        const wantedKeys = new Set<string>();
        for (const id of Object.keys(map || {})) {
          const list = Array.isArray(map[id]) ? map[id] : [];
          for (const binding of list) {
            const key = keyOf(binding);
            if (key) wantedKeys.add(key);
          }
        }
        const ids = new Set<string>();
        for (const source of [hm.customKeys, hm.defaultKeys]) {
          if (source && typeof source === "object") for (const id of Object.keys(source)) ids.add(id);
        }
        for (const id of ids) {
          if (mine(id) || map[id] !== undefined) continue;
          const now = effective(hm, id);
          const kept = now.filter(binding => !wantedKeys.has(keyOf(binding)));
          if (kept.length === now.length) continue;
          hm.setHotkeys(id, kept);
        }
      }

      for (const id of Object.keys(map || {})) {
        if (!wide && !mine(id)) continue;
        const bindings = Array.isArray(map[id]) ? map[id] : [];
        wanted.add(id);
        hm.setHotkeys(id, bindings);
        written += bindings.length;
      }
      /* Своё, чего в копии нет, снимается; чужое — никогда, даже при `all`:
         для чужих копия не полный список (Б10). */
      const custom = hm.customKeys && typeof hm.customKeys === "object" ? hm.customKeys : {};
      for (const id of Object.keys(custom)) {
        if (!mine(id) || wanted.has(id)) continue;
        hm.removeHotkeys(id);
      }
      if (typeof hm.save === "function") await Promise.resolve(hm.save());
      return written;
    },
  };
}


/* ---- каталоги видимых текстов (10.13.38) -------------------------------- */

/** Папка плагина в vault: `.obsidian/plugins/<id>`. */
function pluginFolderOf(app: App, plugin: HostPlugin): string {
  const configDir = String((app && app.vault && (app.vault as { configDir?: unknown }).configDir) || ".obsidian");
  const manifest = (plugin as { manifest?: { id?: unknown } }).manifest;
  const id = manifest && manifest.id ? String(manifest.id) : "inline-overhaul";
  return configDir + "/plugins/" + id;
}

/** Шов для каталогов — адаптер: `.obsidian/**` Obsidian не индексирует (10.13.26 Ф5). */
function textFilesOf(app: App): TextFiles | null {
  const holder = app && app.vault ? (app.vault as { adapter?: unknown }).adapter : null;
  if (!holder || typeof holder !== "object") return null;
  const adapter = holder as {
    exists: (p: string) => Promise<boolean>;
    read: (p: string) => Promise<string>;
    write: (p: string, data: string) => Promise<void>;
    mkdir?: (p: string) => Promise<void>;
    list?: (p: string) => Promise<{ files?: string[] }>;
  };
  return {
    exists: (p: string) => adapter.exists(p),
    read: (p: string) => adapter.read(p),
    write: (p: string, data: string) => adapter.write(p, data),
    ...(typeof adapter.mkdir === "function" ? { mkdir: (p: string) => adapter.mkdir!(p) } : {}),
    ...(typeof adapter.list === "function" ? { list: (p: string) => adapter.list!(p) } : {}),
  };
}

export class InlineOverhaulSettings extends PluginSettingTab {
  private pane: SettingsPane;

  /** Каталоги текстов с диска (10.13.38); до чтения пусто — английский из схемы. */
  private catalogs: Catalogs = {};

  /** Текст окна по имени. Стрелка, а не метод: передаётся значением, `this` свой. */
  private say: Say = (name: string): string =>
    this.textFor(dialogKey(name), TEXT_BY_NAME[name] || "");

  /** Видимый текст по ключу каталога. Спрашивается у панели — она одна. */
  private textFor(key: string, fallback: string): string {
    return this.pane ? this.pane.textFor(key, fallback) : fallback;
  }

  constructor(app: App, plugin: HostPlugin, bridge?: HostBridge) {
    super(app, plugin as never);
    /* Окно панели — туда встают её окна (BUGHUNT R2); узел один на жизнь вкладки. */
    rememberSettingsRoot(this.containerEl as never);
    const normalizePkmOrder = bridge && typeof bridge.normalizePkmOrder === "function"
      ? bridge.normalizePkmOrder
      : null;
    this.pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      /* Тексты по ключу (10.13.38): читаются асинхронно, панель перерисуется. */
      texts: () => this.catalogs,
      store: new ConfigStoreAdapter(storeFor(plugin)),
      /* Реестр действий (5.6); кнопка без действия в схему не попадает (`READY_ACTIONS`). */
      actions: buildActions({
        notify: (message: string) => { inSettingsWindow(() => new Notice(message)); },
        confirm: (o: ConfirmRequest) => askConfirm(app, o, this.say),
        pick: (o: PickRequest) => askPick(app, o, this.say),
        vault: vaultSeam(app),
        /* Кнопка `Changelog` (2026-09-19): `window.open` на десктопе отдаёт адрес системному браузеру. */
        openExternal: (url: string) => { window.open(url, "_blank"); },
        /* Руководство на выбранном языке (10.13.51, В-73) — адаптером (10.13.26 Ф5). */
        guide: async () => {
          const files = textFilesOf(app);
          if (!files) return { text: howtoMarkdown(), lang: "en", name: "English" };
          return guideTextFor(
            files, pluginFolderOf(app, plugin), this.pane.currentLanguage(), howtoMarkdown());
        },
        /* Копии — через то же хранилище, замена проходит миграцию (CS10). */
        config: configSeam(plugin),
        pluginVersion: pluginVersionOf(plugin),
        /* Второе исключение к 7.2 (2026-09-04). */
        hotkeys: hotkeySeam(app, plugin),
        /* `addCommand` кладёт по id — повтор не двоит; команды снятых Field живут до перезапуска. */
        rebuildFromConfig: typeof plugin.rebuildFromConfig === "function"
          ? () => plugin.rebuildFromConfig!()
          : undefined,
        /* Тексты окон (10.13.46); замыкание — язык меняется на лету. */
        t: (key: string, fallback: string) => this.textFor(key, fallback),
        announce: (o: AnnounceRequest) => announce(app, o),
        askBackupOptions: (o: BackupOptionsRequest) => askBackupOptions(app, o, this.say),
      }) as Record<string, () => Promise<void> | void>,
      /* То же окно и для сброса группы (Н3). */
      confirm: (o: ConfirmRequest) => askConfirm(app, o, this.say),
      fragments: {
        createFragment: () => document.createDocumentFragment() as never,
      },
      notify: (message: string) => { inSettingsWindow(() => new Notice(message)); },
      refresh: () => { this.refreshDomState(); },
      rebuild: () => { this.update(); },
      tabStrip: state => tabStripRow(state),
      /* Редактор Fields — только с нормализацией Order из `main.js` (З8, П9). */
      platform: normalizePkmOrder
        ? {
          Setting: SettingCtor,
          Notice,
          Modal,
          AbstractInputSuggest,
          Scope,
          setIcon: (node: unknown, icon: string) => { setIcon(node as HTMLElement, icon); },
          /* Для списка шаблонов (1.6.2.4); синхронно, в памяти — годится для П-11. */
          listNotes: () => app.vault.getMarkdownFiles().map(f => f.path),
          plugin,
          getConfig: () => (typeof plugin.getConfig === "function" ? plugin.getConfig() : {}),
          normalizePkmOrder,
          pkmOrderFields: (bridge && bridge.pkmOrderFields) || [],
        }
        : undefined,
    });

    /* Каталоги — после сборки панели, не задерживая загрузку; без них — английский. */
    void this.loadTexts(app, plugin);

    /*
     * Шов к сообщениям рантайма (10.13.50 Ф-2): глобалью, как остальные
     * (`__inlineLinePipeline`…), У-32. Резолвер тот же `pane.textFor` — язык
     * в одном месте. Нет вкладки — нет глобали, рантайм говорит своим
     * английским литералом (контракт `PLAIN`).
     */
    (globalThis as Record<string, unknown>)["__inlineSay"] =
      (key: string, fallback: string): string => {
        try { return this.textFor(String(key), String(fallback == null ? "" : fallback)); }
        catch { return String(fallback == null ? "" : fallback); }
      };
  }

  /** Положить недостающие каталоги и прочитать папку — именно в этом порядке, иначе первый запуск без языков. */
  private async loadTexts(app: App, plugin: HostPlugin): Promise<void> {
    const files = textFilesOf(app);
    if (!files) return;
    try {
      const folder = pluginFolderOf(app, plugin);
      await ensureCatalogFiles(files, folder, panelCatalog(SCHEMA, TABS),
        { en: BASE_LANG_SEED, ru: RU_SEED });
      /* Образец руководства (10.13.51); переводы не трогаются — они человека (Г-5). */
      await ensureGuideFiles(files, folder, howtoMarkdown());
      const read = await readCatalogs(files, folder);
      this.catalogs = read.catalogs;
      /* Сломанный файл правил человек — сказать ему. */
      for (const name of read.broken) {
        inSettingsWindow(() => new Notice(fill(this.say("TEXTS_BROKEN"), name)));
      }
      /* Панель уже могла собраться на пустом каталоге — пересобрать её. */
      this.update();
    } catch (e) {
      console.error("inline-overhaul: каталоги текстов не загрузились", e);
    }
  }

  /* ---- декларативный путь Obsidian 1.13 ------------------------------- */

  /* Единственное место, где своя форма определений встречает тип платформы. */
  override getSettingDefinitions(): SettingDefinitionItem[] {
    return this.pane.getSettingDefinitions();
  }

  override getControlValue(key: string): unknown {
    return this.pane.getControlValue(key);
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    await this.pane.setControlValue(key, value);
  }

  /** Отпустить подписку панели на хранилище при выгрузке (AUDIT_2026-09-18, 4.5). */
  disposePane(): void {
    this.pane.dispose();
  }

  /** Зовётся только Obsidian старше 1.13 (декларативный путь его не зовёт) — объяснить. */
  override display(): void {
    const el = this.containerEl;
    el.empty();
    const box = el.createDiv({ cls: "io-needs-update" });
    box.createEl("p", { text: this.say("NEEDS_UPDATE") });
    box.createEl("p", { text: this.say("NEEDS_UPDATE_HOW") });
  }
}

/** Действия кнопок появятся в фазе 5; тип держим рядом, чтобы не разошёлся. */
export type { ActionId };

/* Наружу ради проверки пересборки заметок (H1.1). */
export { storeFor };
