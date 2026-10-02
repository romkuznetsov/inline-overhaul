/**
 * Хранилище настроек и шов с платформой (PRD 5.5 CS9, 5.3 П-1). Платформа
 * пишет через `getControlValue`/`setControlValue` вкладки сюда — только так
 * живут undo, склейка записей и оповещение движков.
 */

import type { SetOpts, SettingsStore } from "./types.ts";
import { getIn, setIn } from "./types.ts";

/**
 * Пути с разными значениями в обоих деревьях (появился/исчез — тоже изменение).
 * Сравнение снимков, а не причина записи: у патча блока причина не путь.
 */
export function changedPaths(
  before: unknown,
  after: unknown,
  prefix = "",
  out: string[] = [],
): string[] {
  const plain = (v: unknown): boolean =>
    Boolean(v) && typeof v === "object" && !Array.isArray(v);
  if (!plain(before) || !plain(after)) {
    /* Лист, массив или смена формы — целиком. */
    if (JSON.stringify(before) !== JSON.stringify(after) && prefix) out.push(prefix);
    return out;
  }
  const a = before as Record<string, unknown>;
  const b = after as Record<string, unknown>;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    changedPaths(a[key], b[key], prefix ? prefix + "." + key : key, out);
  }
  return out;
}

/** Минимум, который слой настроек ждёт от ConfigStore. */
export interface ConfigStoreLike {
  getConfig(): Record<string, unknown>;
  /**
   * Необязателен: без него панель не падает, а говорит в консоль (З8).
   */
  subscribe?(listener: (payload: unknown) => void): () => void;
  update(
    mutator: (cfg: Record<string, unknown>) => void,
    reason: string,
    opts?: { coalesceKey?: string; undoable?: boolean },
  ): Promise<void> | void;
}

/** Обёртка над `src/core/config_store.js`; зависит только от формы выше (5.5). */
export class ConfigStoreAdapter implements SettingsStore {
  private store: ConfigStoreLike;

  constructor(store: ConfigStoreLike) {
    this.store = store;
  }

  /*
   * Путь схемы = путь конфига (М-5). Причина записи — путь схемы: по ней
   * узнают контрол и сверяют карты записей (М-4).
   */
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

  /**
   * Кто изменился, а не почему. Снимок держится здесь: `ConfigStore` прошлого не помнит.
   */
  subscribe(listener: (paths: readonly string[]) => void): () => void {
    if (typeof this.store.subscribe !== "function") {
      console.error("inline-overhaul: у хранилища нет subscribe — "
        + "свои блоки не узнают о записи из другого блока");
      return () => {};
    }
    let prev = JSON.parse(JSON.stringify(this.store.getConfig())) as unknown;
    return this.store.subscribe(() => {
      const next = this.store.getConfig();
      const paths = changedPaths(prev, next);
      prev = JSON.parse(JSON.stringify(next)) as unknown;
      if (paths.length) listener(paths);
    });
  }
}

/** Хранилище в памяти: тесты и проверка отображения без Obsidian. */
export class MemoryStore implements SettingsStore {
  config: Record<string, unknown>;
  private listeners = new Set<(paths: readonly string[]) => void>();
  /** История записей: тест проверяет, что склейка получила нужный ключ. */
  writes: Array<{ path: string; value: unknown; opts?: SetOpts }> = [];

  constructor(initial: Record<string, unknown> = {}) {
    this.config = initial;
  }

  get(path: string): unknown {
    return getIn(this.config, path);
  }

  async set(path: string, value: unknown, opts?: SetOpts): Promise<void> {
    const before = JSON.parse(JSON.stringify(this.config)) as unknown;
    setIn(this.config, path, value);
    const entry: { path: string; value: unknown; opts?: SetOpts } = { path, value };
    if (opts !== undefined) entry.opts = opts;
    this.writes.push(entry);
    this.emit(before);
  }

  /**
   * Оповещение и в памяти: иначе проверки шли бы не тем путём (дефект 1.4.1.1.3).
   */
  subscribe(listener: (paths: readonly string[]) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Записать может не только `set`: конфиг проверки правят и напрямую. */
  emit(before: unknown): void {
    const paths = changedPaths(before, this.config);
    if (!paths.length) return;
    for (const l of Array.from(this.listeners)) l(paths);
  }
}
