/**
 * Хранилище настроек и шов с платформой (PRD 5.5 CS9, 5.3 П-1).
 *
 * Платформа читает и пишет значения через `getControlValue` и
 * `setControlValue` вкладки, а те идут сюда. Это единственный шов, который
 * позволяет сохранить undo, склейку записей и оповещение движков: если
 * отдать персистентность Obsidian, всё это придётся выбросить.
 */

import type { SetOpts, SettingsStore } from "./types.ts";
import { getIn, setIn } from "./types.ts";

/** Минимум, который слой настроек ждёт от ConfigStore. */
export interface ConfigStoreLike {
  getConfig(): Record<string, unknown>;
  update(
    mutator: (cfg: Record<string, unknown>) => void,
    reason: string,
    opts?: { coalesceKey?: string; undoable?: boolean },
  ): Promise<void> | void;
}

/**
 * Обёртка над настоящим ConfigStore. Пока он на JS и живёт в
 * `src/core/config_store.js`; когда переедет на TS (5.5), обёртка
 * останется той же — она зависит только от формы выше.
 */
export class ConfigStoreAdapter implements SettingsStore {
  private store: ConfigStoreLike;

  constructor(store: ConfigStoreLike) {
    this.store = store;
  }

  get(path: string): unknown {
    return getIn(this.store.getConfig(), path);
  }

  async set(path: string, value: unknown, opts?: SetOpts): Promise<void> {
    await this.store.update(
      cfg => setIn(cfg, path, value),
      "settings:" + path,
      opts as { coalesceKey?: string; undoable?: boolean } | undefined,
    );
  }
}

/** Хранилище в памяти: тесты и проверка отображения без Obsidian. */
export class MemoryStore implements SettingsStore {
  config: Record<string, unknown>;
  /** История записей: тест проверяет, что склейка получила нужный ключ. */
  writes: Array<{ path: string; value: unknown; opts?: SetOpts }> = [];

  constructor(initial: Record<string, unknown> = {}) {
    this.config = initial;
  }

  get(path: string): unknown {
    return getIn(this.config, path);
  }

  async set(path: string, value: unknown, opts?: SetOpts): Promise<void> {
    setIn(this.config, path, value);
    const entry: { path: string; value: unknown; opts?: SetOpts } = { path, value };
    if (opts !== undefined) entry.opts = opts;
    this.writes.push(entry);
  }
}
