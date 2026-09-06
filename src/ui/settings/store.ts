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

/**
 * Пути, значения которых различаются. Обходятся оба дерева: путь, который
 * появился или исчез, — тоже изменение.
 *
 * Зачем это здесь, а не в причине записи: причину пишет тот, кто пишет, и у
 * патча своего блока она не путь (`pkm:behavior:order:deep:rename:status`).
 * Сравнение снимков даёт точные пути для **любой** записи, и подписчик
 * будится только тот, чьи пути и правда изменились.
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
    /* Лист, массив или смена формы: сравниваются целиком. */
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
   * Оповещение подписчиков. Есть и у `ConfigStore`, и у встроенной копии в
   * `main.js`, но объявлено необязательным: без него панель не падает, а
   * говорит об этом в консоль (З8) — иначе третий store однажды отнимет
   * живое обновление молча.
   */
  subscribe?(listener: (payload: unknown) => void): () => void;
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

  /*
   * Путь схемы и путь конфига — один и тот же. Так стало в фазе 2, пункт 4:
   * движки читают версию 2, миграция подключена, и мост `v1_bridge.ts`,
   * переводивший путь на чтении и на записи, снят целиком (М-5).
   *
   * Причина записи по-прежнему называется путём схемы: по ней узнают контрол,
   * а не ветку конфига, и по ней сверяются карты записей (М-4).
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
   * Кто изменился, а не почему. Снимок держится здесь: `ConfigStore` отдаёт
   * подписчику причину и новый конфиг, а прошлого не помнит никто.
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
   * Оповещение есть и у хранилища в памяти: иначе проверки гоняли бы не тот
   * путь, которым панель просыпается в Obsidian, и дефект 1.4.1.1.3 вернулся
   * бы незамеченным.
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
