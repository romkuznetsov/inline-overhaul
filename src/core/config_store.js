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

  update(mutator, reason) {
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

    this.undoStack.push(before);
    if (this.undoStack.length > this.undoLimit) this.undoStack.shift();

    this.config = migratedNext;
    this.emit(reason || "update");
    this.scheduleSave();
    return true;
  }

  patch(patchObj, reason) {
    return this.update((prev) => this.deepMerge(prev, patchObj), reason || "patch");
  }

  undo(reason) {
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
