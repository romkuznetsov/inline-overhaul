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
  Platform,
  PluginSettingTab,
  Setting as SettingCtor,
  setIcon,
} from "obsidian";
import type { App, Setting, SettingDefinitionItem } from "obsidian";

import { SCHEMA, TABS } from "./schema/index.ts";
import type { TabDef, TabId } from "./types.ts";
import { SettingsPane } from "./settings_tab.ts";
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
import { panelCatalog } from "./texts_panel.ts";
import { TEXT_BY_NAME, dialogKey, fill } from "./texts_dialogs.ts";
import { RU_SEED } from "./texts_seed_ru.ts";
import type { ActionId } from "./types.ts";

/** То, что слою настроек нужно от плагина. */
interface HostPlugin {
  store?: ConfigStoreLike & { config?: Record<string, unknown>; getSnapshot?: () => Record<string, unknown> };
  getConfig?: () => Record<string, unknown>;
  /*
   * Заново собрать всё, что плагин строит из конфига: команды и место
   * служебного файла. Необязательный: без него восстановление работает
   * как работало, а последствия разбирает перезапуск.
   */
  rebuildFromConfig?: () => Promise<void> | void;
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
    subscribe(listener) {
      if (typeof store.subscribe !== "function") return () => {};
      return store.subscribe(listener);
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
 * Как окно спрашивает свой текст: именем из таблицы `texts_dialogs.ts`.
 *
 * Именем, а не готовой строкой: ключ каталога строит одна функция, и собрать
 * его на месте вызова значило бы объявить ключ второй раз (У-82).
 */
type Say = (name: string) => string;

/**
 * Заголовок внутри окна и подсказка к нему (замечание заказчика 2026-09-06:
 * «к каждому хедеру добавь tip, который должен также подчиняться show-tips»).
 *
 * Подсказка живёт тем же помощником, что и в панели, — `tipBelow`: значок «?»
 * встаёт в строку заголовка, а текст открывается **под** ней. Второго правила
 * про подсказки в продукте нет и быть не должно (У-32), поэтому и тумблер
 * `Show tips` тут не спрашивается заново: он приходит готовым ответом.
 *
 * Собственный `host` у каждого заголовка — чтобы открытая подсказка вставала
 * под своим заголовком, а не в конце всего, что под ним нарисовано.
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
  el(row, o.tag || "div", "io-dlg__head-name", o.text);
  tipBelow({
    head: row,
    host,
    text: o.tip || "",
    label: o.text,
    id: o.id,
    showTips: o.showTips === true,
  });
}

/**
 * Окно «точно?». Живёт здесь, а не в реестре действий: `Modal` — платформа, а
 * реестр обязан собираться и проверяться без неё. Закрытие мимо кнопок — это
 * отказ, а не согласие: так же устроены все окна панели.
 */
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
        el(box, "h4", undefined, o.title);
        el(box, "p", "io-dlg__body", o.body);
        if (o.rows && o.rows.length) {
          const list = el(box, "ul", "io-dlg__list");
          for (const row of o.rows) el(list, "li", undefined, row);
        }
        if (o.note) el(box, "p", "io-dlg__body io-dlg__note", o.note);
        /*
         * Галочка стоит между списком и кнопками: её читают после того, как
         * узнали, что именно произойдёт, и до того, как нажали.
         */
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

    new ConfirmModal(app).open();
  });
}

/**
 * Окно на одну кнопку (просьба заказчика 2026-09-06). Отдельное от окна
 * подтверждения: здесь ответа нет, есть только «прочитал». Закрытие мимо
 * кнопки — то же самое, поэтому обещание разрешается в обоих случаях и ровно
 * один раз.
 */
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
        el(box, "h4", undefined, o.title);
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

    new AnnounceModal(app).open();
  });
}

/**
 * Окно состава копии (заказ заказчика 2026-09-06).
 *
 * Всё в нём уже выбрано по-максимуму, и `Enter` сразу даёт то же, что давала
 * кнопка до окна. Закрытие мимо кнопки — отказ, как и во всех окнах панели.
 */
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
        /*
         * Три заголовка, и у каждого своя подсказка (замечание заказчика
         * 2026-09-06). Абзаца под заголовком окна больше нет: то, что стояло
         * там, ушло в подсказку первого из них.
         */
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

    new OptionsModal(app).open();
  });
}

/**
 * Окно выбора копии настроек (Б9). Отдельное от окна подтверждения: там ответ
 * «да или нет», здесь — «какая из». Закрытие мимо строк — отказ.
 */
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
        el(box, "h4", undefined, o.title);
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

    new PickModal(app).open();
  });
}

/**
 * Vault для руководства. Единственное место, где слой настроек пишет файл в
 * хранилище, и оно здесь по той же причине, что и окно подтверждения: это
 * платформа, а реестр действий обязан собираться без неё.
 */
function vaultSeam(app: App): VaultSeam {
  return {
    /*
     * `exists` идёт через адаптер, а не через `getAbstractFileByPath`: копия
     * переезда лежит в папке плагина, а её файлы в дерево vault не попадают.
     */
    exists: async (path: string) => await app.vault.adapter.exists(path),
    create: async (path: string, text: string) => { await app.vault.create(path, text); },
    open: async (path: string) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file) throw new Error("Cannot open " + path);
      await app.workspace.getLeaf(true).openFile(file as never);
    },
    read: async (path: string) => await app.vault.adapter.read(path),
    /*
     * Папка под копии создаётся при первом сохранении, не раньше (Б2). Уже
     * существующая — не ошибка: адаптер об этом сообщает исключением, и оно
     * здесь гасится намеренно.
     */
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
        } catch (e) {
          mtime = 0;
        }
        out.push({ path: file, mtime });
      }
      return out;
    },
  };
}

/**
 * Хранилище для копий настроек. Чтение — снимок, запись — тот же `update`,
 * которым пишет вся панель: миграция, undo и сохранение достаются даром.
 */
function configSeam(plugin: HostPlugin): ConfigSeam {
  const store = storeFor(plugin);
  return {
    /* Снимок, а не живой объект: восстановление собирает следующий конфиг из
       нынешнего, и подмена под руками ему не нужна. */
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
 * Хоткеи команд плагина: прочитать и вернуть назад (Б18, вопрос В-32).
 *
 * **Служебное API Obsidian, и это второе исключение к 7.2.** Первое — колонка
 * `Hotkey` в справочнике команд (К-2), только чтение. Здесь появляется запись,
 * и разрешение на неё дано заказчиком 2026-09-04 после разбора.
 *
 * Что именно читалось в `app.js` Obsidian 1.13.7, чтобы это писать не наугад:
 *
 *   - `hotkeyManager.customKeys` — **геттер, отдающий копию**
 *     (`Object.assign({}, this[Symbol("customKeys")])`). Присвоить ему нельзя:
 *     настоящее хранилище лежит под символом. Отсюда `setHotkeys`, а не
 *     присваивание.
 *   - `setHotkeys(id, list)` кладёт список и сбрасывает `baked` — новая
 *     привязка начинает работать сразу, без перезапуска.
 *   - `removeHotkeys(id)` убирает запись целиком: команда возвращается к
 *     умолчанию плагина, если оно есть.
 *   - `save()` пишет `hotkeys.json` через `vault.writeConfigJson`. Без него
 *     назначение живёт до конца сеанса.
 *
 * **Трогаются только свои команды.** Идентификатор команды в Obsidian —
 * `<id плагина>:<id команды>`, и всё, что не начинается с нашего префикса,
 * пропускается в обе стороны. Восстановление копии не имеет права снять
 * хоткей другого плагина или самого Obsidian, и это единственное место, где
 * такое ограничение можно нарушить.
 */
interface HotkeyManagerApi {
  customKeys?: Record<string, unknown>;
  /** Хоткеи по умолчанию: команда держит клавишу и тогда, когда её не назначали руками. */
  defaultKeys?: Record<string, unknown>;
  setHotkeys?: (id: string, bindings: unknown[]) => void;
  removeHotkeys?: (id: string) => void;
  save?: () => Promise<void> | void;
}

/** Реестр команд Obsidian: нужно только имя, чтобы назвать чужую команду в окне. */
function commandNameOf(app: App, id: string): string {
  const holder = app as unknown as { commands?: { commands?: Record<string, { name?: unknown }> } };
  const found = holder && holder.commands && holder.commands.commands
    ? holder.commands.commands[id]
    : null;
  const name = found && found.name ? String(found.name) : "";
  return name || id;
}

/**
 * Привязка одной строкой для сравнения.
 *
 * Само правило живёт в `settings_backup.js` — там же, где разбор копии, и
 * там же, где его можно прогнать без Obsidian. Здесь остаётся одно: сказать
 * ему, на какой платформе он работает, потому что `Mod` — это Cmd на macOS и
 * Ctrl везде ещё, и без этого `Mod + Tab` и `Ctrl + Tab` считались разными
 * комбинациями (замечание заказчика 2026-09-06).
 */
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
    /**
     * Всё, что человек назначил руками — включая чужие команды. Умолчания
     * сюда не попадают намеренно: они приедут с самими плагинами, а в копии
     * означали бы «человек так решил» — чего он не решал.
     */
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

    /**
     * Чужие команды, держащие те же клавиши. Считается по **действующим**
     * привязкам, а не только по назначенным руками: команда со своим умолчанием
     * конфликтует точно так же, и именно о ней Obsidian ругается после перезапуска.
     */
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
          /* Клавиши называются так, как их пишет экран `Hotkeys`: там `Mod` не
             показывается никогда — стоит `Ctrl` или `Cmd`. */
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
      /*
       * Объём решает копия, а не этот код: чужие хоткеи пишутся только
       * тогда, когда человек сам выбрал `all` при сохранении и увидел это
       * в окне восстановления (заказ заказчика 2026-09-06). Умолчание прежнее.
       */
      const wide = opts && opts.scope === "all";
      const wanted = new Set<string>();
      let touched = 0;

      /*
       * Конфликты снимаются **до** того, как клавиша ляжет на нашу команду:
       * иначе после записи «чужой держатель» и наш новый были бы неразличимы.
       * Пустой список через `setHotkeys` — это и есть «человек снял клавишу»;
       * `removeHotkeys` вернул бы умолчание плагина и ничего не решил.
       */
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
          touched++;
        }
      }

      for (const id of Object.keys(map || {})) {
        if (!wide && !mine(id)) continue;
        const bindings = Array.isArray(map[id]) ? map[id] : [];
        wanted.add(id);
        hm.setHotkeys(id, bindings);
        touched++;
      }
      /*
       * Своё, чего в копии нет, снимается: копия описывает состояние целиком,
       * и оставленный хоткей был бы состоянием, которого в ней не было.
       *
       * **Снимается только своё, даже при `all`.** Для наших команд копия —
       * полный список, а для чужих она говорит только про то, что в ней есть:
       * чужой хоткей, заведённый после снятия копии, не должен исчезать оттого,
       * что копию сняли раньше (Б10 касается наших настроек, а не чужих).
       */
      const custom = hm.customKeys && typeof hm.customKeys === "object" ? hm.customKeys : {};
      for (const id of Object.keys(custom)) {
        if (!mine(id) || wanted.has(id)) continue;
        hm.removeHotkeys(id);
        touched++;
      }
      if (typeof hm.save === "function") await Promise.resolve(hm.save());
      return touched;
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

/**
 * Шов к хранилищу для каталогов. Адаптер, а не дерево заметок: `.obsidian/**`
 * Obsidian не индексирует, и файл в папке плагина `getAbstractFileByPath` не
 * найдёт **никогда** (10.13.26 Ф5).
 */
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

  /**
   * Каталоги текстов, прочитанные с диска (10.13.38). Пусто до того, как
   * чтение закончится, и это не проблема: пустой каталог — это английский из
   * схемы, то есть ровно то, чем панель была до 2026-09-06.
   */
  private catalogs: Catalogs = {};

  /**
   * Текст окна по имени из таблицы. Поле со стрелкой, а не метод: его
   * передают дальше как значение, и `this` у него должен остаться свой.
   */
  private say: Say = (name: string): string =>
    this.textFor(dialogKey(name), TEXT_BY_NAME[name] || "");

  /** Видимый текст по ключу каталога. Спрашивается у панели — она одна. */
  private textFor(key: string, fallback: string): string {
    return this.pane ? this.pane.textFor(key, fallback) : fallback;
  }

  constructor(app: App, plugin: HostPlugin, bridge?: HostBridge) {
    super(app, plugin as never);
    const normalizePkmOrder = bridge && typeof bridge.normalizePkmOrder === "function"
      ? bridge.normalizePkmOrder
      : null;
    this.pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      /*
       * Видимые тексты по ключу (10.13.38). Чтение идёт с диска и потому
       * асинхронно, а панель строится сразу: до конца чтения она говорит
       * английским из схемы, а закончив, перерисовывается сама.
       */
      texts: () => this.catalogs,
      store: new ConfigStoreAdapter(storeFor(plugin)),
      /*
       * Реестр действий (5.6). Кнопка, действия которой здесь нет, в схему
       * не попадает вовсе — этим занят `READY_ACTIONS` в `actions.ts`.
       */
      actions: buildActions({
        notify: (message: string) => { new Notice(message); },
        confirm: (o: ConfirmRequest) => askConfirm(app, o, this.say),
        pick: (o: PickRequest) => askPick(app, o, this.say),
        vault: vaultSeam(app),
        /*
         * Копии настроек пишутся и читаются через то же хранилище, что и всё
         * остальное: замена идёт `update`-мутатором и потому проходит миграцию
         * (CS10). Второй точки записи в конфиг нет.
         */
        config: configSeam(plugin),
        pluginVersion: pluginVersionOf(plugin),
        /* Хоткеи: второе исключение к 7.2, разрешение заказчика 2026-09-04. */
        hotkeys: hotkeySeam(app, plugin),
        /*
         * После восстановления. `addCommand` у Obsidian кладёт команду
         * в словарь по её id, поэтому повторный заход обновляет старые и
         * добавляет новые, а не двоит. Команды снятых Field остаются до
         * перезапуска — про него и говорит окно.
         */
        rebuildFromConfig: typeof plugin.rebuildFromConfig === "function"
          ? () => plugin.rebuildFromConfig!()
          : undefined,
        /*
         * Тексты окон — из каталога (10.13.46). Замыкание, а не значение:
         * панель в этот момент ещё собирается, а язык человек меняет на
         * лету.
         */
        t: (key: string, fallback: string) => this.textFor(key, fallback),
        announce: (o: AnnounceRequest) => announce(app, o),
        askBackupOptions: (o: BackupOptionsRequest) => askBackupOptions(app, o, this.say),
      }) as Record<string, () => Promise<void> | void>,
      /* То же окно и для сброса группы (Н3). */
      confirm: (o: ConfirmRequest) => askConfirm(app, o, this.say),
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
          /*
           * Пути заметок vault: из них собирается список шаблонов (1.6.2.4).
           * Список файлов Obsidian держит в памяти, поэтому чтение синхронное
           * и годится для `getSettingDefinitions` (П-11).
           */
          listNotes: () => app.vault.getMarkdownFiles().map(f => f.path),
          plugin,
          getConfig: () => (typeof plugin.getConfig === "function" ? plugin.getConfig() : {}),
          normalizePkmOrder,
          pkmOrderFields: (bridge && bridge.pkmOrderFields) || [],
        }
        : undefined,
    });

    /*
     * Каталоги — после того, как панель собрана: она обязана существовать
     * даже если файлов нет вовсе, а чтение с диска не должно задерживать
     * загрузку плагина. Неудача не роняет ничего: без каталогов панель
     * говорит английским.
     */
    void this.loadTexts(app, plugin);

    /*
     * **Шов к сообщениям плагина в редакторе** (10.13.50 Ф-2).
     *
     * `main.js` и файлы `pkm_v2/**` про панель не знают и знать не должны: у
     * них нет ни `ctx`, ни импорта слоя настроек, а два из трёх ещё и под З3.
     * Так они получают всё остальное — `__inlinePkmMacroShared`,
     * `__inlineLinePipeline`, сам `Notice`, — и заводить для одной строки
     * второй способ доставки значило бы объявить одно правило дважды (У-32).
     *
     * **Резолвер здесь не свой, а тот же самый.** Зовётся `pane.textFor` — та
     * функция, которой отвечает панель. Отсюда даром берётся то, что своим
     * резолвером пришлось бы поддерживать руками: человек меняет язык в
     * `General → Language`, и сообщения в редакторе меняются вместе с
     * панелью, потому что язык живёт в одном месте.
     *
     * Если этой вкладки нет вовсе (старый Obsidian, не загрузившийся модуль —
     * `createSettingTab()` отдаёт `null`), глобали нет, и каждое место в
     * рантайме отдаёт свой английский литерал. Это не поломка, а тот же
     * контракт, что у `PLAIN`.
     */
    (globalThis as Record<string, unknown>)["__inlineSay"] =
      (key: string, fallback: string): string => {
        try { return this.textFor(String(key), String(fallback == null ? "" : fallback)); }
        catch { return String(fallback == null ? "" : fallback); }
      };
  }

  /**
   * Положить недостающие каталоги и прочитать то, что в папке лежит.
   *
   * Порядок обязателен: сначала запись, потом чтение — иначе первый запуск
   * не увидел бы собственных файлов и список языков был бы пуст до
   * перезапуска.
   */
  private async loadTexts(app: App, plugin: HostPlugin): Promise<void> {
    const files = textFilesOf(app);
    if (!files) return;
    try {
      const folder = pluginFolderOf(app, plugin);
      await ensureCatalogFiles(files, folder, panelCatalog(SCHEMA, TABS),
        { en: BASE_LANG_SEED, ru: RU_SEED });
      const read = await readCatalogs(files, folder);
      this.catalogs = read.catalogs;
      /*
       * Сломанный файл не роняет ничего, но и промолчать о нём нельзя: его
       * правит человек руками, и молчание в ответ на его правку — худшее,
       * что можно сделать.
       */
      for (const name of read.broken) {
        new Notice(fill(this.say("TEXTS_BROKEN"), name));
      }
      /* Панель уже могла собраться на пустом каталоге — пересобрать её. */
      this.update();
    } catch (e) {
      console.error("inline-overhaul: каталоги текстов не загрузились", e);
    }
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
    box.createEl("p", { text: this.say("NEEDS_UPDATE") });
    box.createEl("p", { text: this.say("NEEDS_UPDATE_HOW") });
  }
}

/** Действия кнопок появятся в фазе 5; тип держим рядом, чтобы не разошёлся. */
export type { ActionId };
