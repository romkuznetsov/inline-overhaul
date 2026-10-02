// @ts-check
"use strict";

/*
 * Текст сообщения по ключу каталога (PRD 10.13.50) — через общий помощник,
 * без своей копии правила (Б-11). Литеральный `require` без запасного пути (У-89, У-90, A33).
 */
const __sayModule = require("./say.js");
const __say = __sayModule.say;
/* Ключ сообщения строит общий модуль: своей копии здесь нет (У-82). */
const __noticeKey = __sayModule.noticeKey;

class ConfigStore {
  /**
   * @param {any} plugin точка входа: `loadData`/`saveData` — граница с диском
   * @param {any} options умолчания, помощники и `Notice` (форма — у загрузки)
   */
  constructor(plugin, options) {
    this.plugin = plugin;
    this.defaults = options.defaults;
    this.undoLimit = options.undoLimit || 20;
    this.saveDebounceMs = options.saveDebounceMs || 250;
    this.cloneJson = options.cloneJson;
    this.isObj = options.isObj;
    this.deepMerge = options.deepMerge;
    this.migrateConfig = options.migrateConfig;
    this.Notice = options.Notice;
    /**
     * Спросить перед записью; `false` — на диске чужое и оно принято. Без неё запись идёт как шла.
     * @type {null | (() => Promise<boolean>)}
     */
    this.beforeWrite = typeof options.beforeWrite === "function" ? options.beforeWrite : null;
    this.config = this.cloneJson(this.defaults);
    /**
     * Что мы сами в последний раз записали: признак «файл менял не только мы» —
     * по содержимому, не по времени (время переезжает с копией, У-220). `null` — не писали.
     * @type {any}
     */
    this.lastWritten = null;
    /**
     * Писали ли за эту загрузку. Отдельный признак: само значение бывает и `null`.
     * @type {boolean}
     */
    this.hasWritten = false;
    /** @type {any[]} снимки конфига до правки; форма — само дерево настроек */
    this.undoStack = [];
    this.listeners = new Set();
    this.saveTimer = null;
    this.coalesceWindowMs = options.coalesceWindowMs || 400;
    /** @type {string|null} */
    this.lastUndoKey = null;
    /** @type {number|null} */
    this.lastUndoAt = null;
  }

  async init() {
    const raw = await this.plugin.loadData();
    this.config = this.migrateConfig(raw);
    await this.writeSnapshot();
  }

  /** Запомнить, что теперь лежит в файле нашими руками. */
  rememberWritten() {
    this.lastWritten = this.getSnapshot();
    this.hasWritten = true;
  }

  /**
   * Записать снимок и запомнить именно его (Д-3): правка посреди `await saveData`
   * иначе объявлялась записанной и терялась при следующем взгляде на диск.
   */
  async writeSnapshot() {
    const snap = this.getSnapshot();
    await this.plugin.saveData(snap);
    this.lastWritten = snap;
    this.hasWritten = true;
  }

  getSnapshot() {
    return this.cloneJson(this.config);
  }

  /**
   * @param {(payload: any) => void} listener
   * @returns {() => void} отписка
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** @param {string} [reason] почему конфиг изменился */
  emit(reason) {
    const payload = { reason: reason || "update", snapshot: this.getSnapshot() };
    for (const l of this.listeners) {
      try {
        l(payload);
      } catch (e) {
        console.error("[inline-overhaul] Config listener failed", e);
      }
    }
  }

  /**
   * Тот же конфиг или другой — для `update` и `adoptExternal` (отрицательный
   * контроль Р-2: своя запись по содержимому не внешняя). Сравнение текстом —
   * порядок ключей в ручных ветках значим; цикл в `JSON.stringify` — ответ «другой».
   *
   * @param {any} candidate дерево настроек для сравнения
   * @returns {boolean}
   */
  sameAsCurrent(candidate) {
    try {
      return JSON.stringify(this.config) === JSON.stringify(candidate);
    } catch (_) {
      return false;
    }
  }

  /**
   * opts (PRD 5.5):
   *   undoable: false  - изменение не попадает в undo-стек (CS2);
   *   coalesceKey      - записи с одним ключом в coalesceWindowMs склеиваются (CS3):
   *                      слайдер пишет на каждый шаг протяжки (A6).
   *
   * @param {(cfg: any) => any} mutator получает снимок, возвращает новый конфиг
   * @param {string} [reason] причина записи: по ней узнают контрол
   * @param {{undoable?: boolean, coalesceKey?: string}} [opts]
   * @returns {boolean} изменилось ли что-нибудь
   */
  update(mutator, reason, opts) {
    const before = this.getSnapshot();
    const next = mutator(this.getSnapshot());
    if (!this.isObj(next)) return false;

    const migratedNext = this.migrateConfig(next);
    if (this.sameAsCurrent(migratedNext)) return false;

    const undoable = !opts || opts.undoable !== false;
    const key = opts && opts.coalesceKey ? String(opts.coalesceKey) : null;
    const now = Date.now();

    if (undoable) {
      const window = this.coalesceWindowMs || 400;
      const sameKeyRecently = key
        && this.lastUndoKey === key
        && this.lastUndoAt !== null
        && now - this.lastUndoAt < window
        && this.undoStack.length > 0;

      if (!sameKeyRecently) {
        this.undoStack.push(before);
        if (this.undoStack.length > this.undoLimit) this.undoStack.shift();
      }
      this.lastUndoKey = key;
      this.lastUndoAt = now;
    }

    this.config = migratedNext;
    this.emit(reason || "update");
    this.scheduleSave();
    return true;
  }

  /**
   * @param {any} patchObj кусок дерева настроек, который надо влить
   * @param {string} [reason]
   * @param {{undoable?: boolean, coalesceKey?: string}} [opts] как у `update`: без них
   *   служебная запись попадала в стек отмены (BUGHUNT 2026-09-30, D8)
   * @returns {boolean}
   */
  patch(patchObj, reason, opts) {
    return this.update((/** @type {any} */ prev) => this.deepMerge(prev, patchObj), reason || "patch", opts);
  }

  /**
   * Принять настройки, изменённые снаружи (Р-2): диск сильнее памяти (В-142).
   *
   *   1. Отложенная запись снимается — она несёт прежний конфиг (разбор 4.2).
   *   2. Стек отмены очищается — `Ctrl+Z` записал бы старое поверх принесённого.
   *   3. Своей записи нет — иначе синхронизация проснётся по кругу.
   *
   * Нечитаемый файл (`isObj` — нет) не принимается: `migrateConfig` из `null`
   * стёр бы всё дерево умолчаниями.
   *
   * @param {any} raw то, что лежит в `data.json` прямо сейчас
   * @returns {boolean} изменилось ли что-нибудь
   */
  adoptExternal(raw) {
    if (!this.isObj(raw)) return false;
    const next = this.migrateConfig(raw);
    if (this.sameAsCurrent(next)) return false;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.undoStack.length = 0;
    this.lastUndoKey = null;
    this.lastUndoAt = null;

    this.config = next;
    /* Наша следующая запись не должна принять этот файл за чужой. */
    this.rememberWritten();
    this.emit("external");
    return true;
  }

  /**
   * Лежит ли в файле не то, что мы положили. По содержимому, не по времени:
   * копия переносит время источника (2026-09-18). Не писали — «нет».
   *
   * @param {any} raw то, что лежит в `data.json` прямо сейчас
   * @returns {boolean}
   */
  diskChangedUnderUs(raw) {
    if (!this.isObj(raw)) return false;
    if (!this.hasWritten) return false;
    try {
      return JSON.stringify(this.migrateConfig(raw)) !== JSON.stringify(this.lastWritten);
    } catch (_) {
      /* Цикл не сериализуется: «нет» безопаснее, чем принять непрочитанное за чужое. */
      return false;
    }
  }

  /**
   * @param {string} [reason]
   * @returns {boolean} было ли что отменять
   */
  undo(reason) {
    this.lastUndoKey = null;
    this.lastUndoAt = null;
    if (!this.undoStack.length) return false;
    this.config = this.migrateConfig(this.undoStack.pop());
    this.emit(reason || "undo");
    this.scheduleSave();
    return true;
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      this.saveTimer = null;
      try {
        /* Диск сильнее — спрашивается перед записью: сигнала платформы может не быть (копия со старым временем). */
        if (this.beforeWrite && (await this.beforeWrite()) === false) return;
        await this.writeSnapshot();
      } catch (e) {
        console.error("[inline-overhaul] Save failed", e);
        new this.Notice(__say(__noticeKey("plugin", "save-failed"), "Could not save settings"));
      }
    }, this.saveDebounceMs);
  }

  /**
   * Дописать отложенную запись сейчас (CS7) — зовётся выгрузкой: `unload()` снимает
   * таймер `scheduleSave`, и последняя правка пропадала (`docs/dev/AUDIT_2026-09-18.md`, 4.1).
   * Нечего дописывать — не пишем, отвечаем `false`. Взгляда на диск нет нарочно (`Р-1`).
   */
  async flushNow() {
    if (!this.saveTimer) return false;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    await this.writeSnapshot();
    return true;
  }

  unload() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}

module.exports = {
  ConfigStore,
};
