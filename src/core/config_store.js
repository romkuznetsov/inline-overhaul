"use strict";

class ConfigStore {
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
    this.config = this.cloneJson(this.defaults);
    this.undoStack = [];
    this.listeners = new Set();
    this.saveTimer = null;
    this.lastSavedAt = null;
    this.coalesceWindowMs = options.coalesceWindowMs || 400;
    this.lastUndoKey = null;
    this.lastUndoAt = null;
  }

  async init() {
    const raw = await this.plugin.loadData();
    this.config = this.migrateConfig(raw);
    await this.plugin.saveData(this.config);
    this.lastSavedAt = Date.now();
  }

  getSnapshot() {
    return this.cloneJson(this.config);
  }

  getLastSavedAt() {
    return this.lastSavedAt;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

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
   * opts (PRD 5.5):
   *   undoable: false  - изменение не попадает в undo-стек (CS2);
   *   coalesceKey      - несколько записей с одним ключом внутри
   *                      coalesceWindowMs склеиваются в одну запись undo (CS3).
   *
   * Склейка нужна слайдерам: платформа зовёт запись на каждый шаг протяжки, и
   * без неё одна протяжка забивает весь стек, а «отменить» откатывает один
   * пиксель вместо жеста (дефект A6).
   */
  update(mutator, reason, opts) {
    const before = this.getSnapshot();
    const next = mutator(this.getSnapshot());
    if (!this.isObj(next)) return false;

    const migratedNext = this.migrateConfig(next);
    let isSame = false;
    try {
      isSame = JSON.stringify(this.config) === JSON.stringify(migratedNext);
    } catch (_) {
      isSame = false;
    }
    if (isSame) return false;

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

  patch(patchObj, reason) {
    return this.update((prev) => this.deepMerge(prev, patchObj), reason || "patch");
  }

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
        await this.plugin.saveData(this.config);
        this.lastSavedAt = Date.now();
      } catch (e) {
        console.error("[inline-overhaul] Save failed", e);
        new this.Notice("InlineOverhaul: failed to save settings");
      }
    }, this.saveDebounceMs);
  }

  async flushNow() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.plugin.saveData(this.config);
    this.lastSavedAt = Date.now();
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
