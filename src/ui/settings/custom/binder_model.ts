/**
 * Модель Binder (PRD 10.4, фаза 3c): конфиг и патчи, без DOM (Г16). Путь
 * `editor.binder.rows` (PRD 8.1) читает `buildBinderCommandDefs`
 * (`command_registry.js`), нормализует `normalizeBinderRows` в третьей ступени
 * `migrateConfig`. `commandId` здесь не выдумывается: пустой ставит
 * `normalizeBinderRows` на каждом патче. `rowId` — `Date.now()` и
 * `Math.random()` (Б7).
 */

/** Плагин в том виде, в каком его зовёт блок. */
export interface BinderPlugin {
  getConfig: () => unknown;
  setConfigPatch: (patch: unknown, reason: string) => void;
  /** Перерегистрация команд после правки списка; может отсутствовать. */
  registerBinderCommands?: () => void;
}

/** Системная `Smart bracket`: `normalizeBinderRows` возвращает её и переписывает текст (Б5), поэтому не редактируется (З8). */
export const SYSTEM_ROW_ID = "binder-system-smart-bracket";

/** Одна строка таблицы так, как её читает вёрстка. */
export interface BinderRow {
  rowId: string;
  insertText: string;
  commandName: string;
  description: string;
  /** Внутренний идентификатор: в UI не показывается (Б2). */
  commandId: string;
  /** Имя команды в списке хоткеев Obsidian: его даёт реестр команд. */
  commandLabel: string;
  system: boolean;
}

/** Что нужно, чтобы завести строку. Текст вставки обязателен, остальное нет. */
export interface BinderDraft {
  insertText: string;
  commandName: string;
  description: string;
}

/** Итог записи: отказ обязан сказать, почему (как у переименования Field). */
export interface BinderWriteResult {
  ok: boolean;
  error?: string;
}

/* Тексты отказов — в каталоге (10.13.47), без точки (Р10). */
import { asObject } from "../types.ts";
import { BLOCK_TEXTS } from "../texts_blocks.ts";

export const DUPLICATE_INSERT = BLOCK_TEXTS["binder-table"].ERR_TEXT_TAKEN;
export const DUPLICATE_NAME = BLOCK_TEXTS["binder-table"].ERR_NAME_TAKEN;

/** Совпадение с заведённой строкой: поле — чтобы окно сказало под ним. */
export interface BinderClash {
  field: "insertText" | "commandName";
  error: string;
}

export interface BinderModel {
  listRows(): BinderRow[];
  setDescription(rowId: string, text: string): void;
  remove(rowId: string): void;
  move(from: number, to: number): void;
  /** Повторяет ли черновик строку; окно спрашивает, пока человек печатает (C13). */
  duplicateOf(draft: BinderDraft): BinderClash | null;
  /** Завести строку; отказ — с причиной (C13). */
  add(draft: BinderDraft): BinderWriteResult;
}

export interface BinderModelDeps {
  plugin: BinderPlugin;
  /** Имена команд — `buildBinderCommandDefs`, по которой плагин их регистрирует. */
  commandDefs: (cfg: unknown) => ReadonlyArray<{ id: string; name: string }>;
}


function str(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

/** Строки в том виде, в каком они лежат в конфиге. */
function storedRows(cfg: unknown): Array<Record<string, unknown>> {
  const raw = asObject(asObject(asObject(cfg)["editor"])["binder"])["rows"];
  return Array.isArray(raw) ? raw.map(asObject) : [];
}

/** Б7: тот же вид `rowId`, что и у `normalizeBinderRows`. */
function newRowId(): string {
  return "binder-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

export function createBinderModel(deps: BinderModelDeps): BinderModel {
  const { plugin } = deps;

  const read = (): Array<Record<string, unknown>> => storedRows(plugin.getConfig());

  /** Запись; `registerCommands` — если менялся набор команд. Без перерегистрации — после перезапуска. */
  const save = (rows: unknown[], reason: string, registerCommands: boolean): void => {
    plugin.setConfigPatch({ editor: { binder: { rows } } }, reason);
    if (!registerCommands || typeof plugin.registerBinderCommands !== "function") return;
    try {
      plugin.registerBinderCommands();
    } catch (e) {
      console.error("inline-overhaul: команды Binder не перерегистрировались", e);
    }
  };

  const duplicateOf = (draft: BinderDraft): BinderClash | null => {
    /* Одно объявление для окна и `add` (У-32). Сверяются текст вставки и имя
       (C13) по видимому: без краевых пробелов и регистра. */
    const same = (a: string, b: string): boolean =>
      a.trim().toLowerCase() === b.trim().toLowerCase() && a.trim() !== "";
    const insertText = String(draft && draft.insertText || "");
    const commandName = String(draft && draft.commandName || "");
    for (const row of read()) {
      if (same(str(row["insertText"]), insertText)) {
        return { field: "insertText", error: DUPLICATE_INSERT };
      }
      if (same(str(row["commandName"]), commandName)) {
        return { field: "commandName", error: DUPLICATE_NAME };
      }
    }
    return null;
  };

  return {
    listRows() {
      const cfg = plugin.getConfig();
      const names = new Map<string, string>();
      try {
        for (const def of deps.commandDefs(cfg)) names.set(str(def && def.id), str(def && def.name));
      } catch (e) {
        console.error("inline-overhaul: имена команд Binder не прочитались", e);
      }
      return storedRows(cfg).map(row => {
        const commandId = str(row["commandId"]).trim();
        return {
          rowId: str(row["rowId"]).trim(),
          insertText: str(row["insertText"]),
          commandName: str(row["commandName"]),
          description: str(row["description"]),
          commandId,
          commandLabel: names.get(commandId) || "",
          system: str(row["rowId"]).trim() === SYSTEM_ROW_ID,
        };
      });
    },

    setDescription(rowId, text) {
      const id = String(rowId || "").trim();
      if (!id || id === SYSTEM_ROW_ID) return;
      const rows = read();
      if (!rows.some(row => str(row["rowId"]).trim() === id)) return;
      const next = rows.map(row => (
        str(row["rowId"]).trim() === id ? { ...row, description: String(text ?? "") } : row
      ));
      save(next, "settings:binder:description", false);
    },

    remove(rowId) {
      const id = String(rowId || "").trim();
      /* Б5: системная строка не удаляется — и кнопкой, и здесь. */
      if (!id || id === SYSTEM_ROW_ID) return;
      const rows = read();
      const next = rows.filter(row => str(row["rowId"]).trim() !== id);
      if (next.length === rows.length) return;
      save(next, "settings:binder:delete", true);
    },

    move(from, to) {
      const rows = read();
      if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
      const next = rows.slice();
      const taken = next.splice(from, 1)[0];
      if (!taken) return;
      next.splice(to, 0, taken);
      save(next, "settings:binder:reorder", true);
    },

    duplicateOf,

    add(draft) {
      const insertText = String(draft && draft.insertText || "");
      /* Без текста вставки команда пуста (З8). */
      if (!insertText.trim()) return { ok: false };

      const clash = duplicateOf(draft);
      if (clash) return { ok: false, error: clash.error };

      const next = read().concat([{
        rowId: newRowId(),
        insertText,
        commandName: String(draft && draft.commandName || "").trim(),
        description: String(draft && draft.description || "").trim(),
        /* Поставит `normalizeBinderRows` на этом патче. */
        commandId: "",
      }]);
      save(next, "settings:binder:add", true);
      return { ok: true };
    },
  };
}
