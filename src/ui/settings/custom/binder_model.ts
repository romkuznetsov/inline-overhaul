/**
 * Модель Binder (PRD 10.4, фаза 3c).
 *
 * Только чтение конфига и сборка патчей — ни DOM, ни `Notice`: вёрстка обязана
 * рисоваться на заглушке (гейт Г16). Путь `ui.binderRows` — версии 1, живой:
 * его читает `buildBinderCommandDefs` (`src/features/command_registry.js`) и
 * нормализует `normalizeBinderRows` внутри `migrateConfig` (`main.js`).
 *
 * **Идентификатор команды здесь не выдумывается.** `normalizeBinderRows`
 * умеет его выдать: пустой `commandId` она заменяет на
 * `inlineOverhaul_Binder_<имя>` и разводит совпадения. Она идёт на каждом
 * патче, поэтому новой строке достаточно родиться без идентификатора — его
 * поставит та функция, с которой начинается работа. Старая панель считала его
 * своей копией той же логики (`buildId`), и копия эта могла разойтись.
 *
 * **`rowId` остаётся на `Date.now()` и `Math.random()`** — так требует Б7, и
 * так же его делает `normalizeBinderRows`.
 */

/** Плагин в том виде, в каком его зовёт блок. */
export interface BinderPlugin {
  getConfig: () => unknown;
  setConfigPatch: (patch: unknown, reason: string) => void;
  /** Перерегистрация команд после правки списка; может отсутствовать. */
  registerBinderCommands?: () => void;
}

/**
 * Системная строка `Smart bracket`. `normalizeBinderRows` возвращает её на
 * место, если её нет, и переписывает её текст и описание своими: Б5, и
 * заодно причина, по которой её описание в панели не редактируется — правка
 * не пережила бы ближайший патч (З8).
 */
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

export interface BinderModel {
  listRows(): BinderRow[];
  setDescription(rowId: string, text: string): void;
  remove(rowId: string): void;
  move(from: number, to: number): void;
  add(draft: BinderDraft): void;
}

export interface BinderModelDeps {
  plugin: BinderPlugin;
  /**
   * Имена команд от реестра: `buildBinderCommandDefs` из
   * `command_registry.js` — та самая функция, по которой плагин их и
   * регистрирует. Своё построение имени разошлось бы с ней, а по имени
   * человек ищет команду в списке хоткеев.
   */
  commandDefs: (cfg: unknown) => ReadonlyArray<{ id: string; name: string }>;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

/** Строки в том виде, в каком они лежат в конфиге. */
function storedRows(cfg: unknown): Array<Record<string, unknown>> {
  const raw = asObject(asObject(cfg)["ui"])["binderRows"];
  return Array.isArray(raw) ? raw.map(asObject) : [];
}

/** Б7: тот же вид `rowId`, что и у `normalizeBinderRows`. */
function newRowId(): string {
  return "binder-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

export function createBinderModel(deps: BinderModelDeps): BinderModel {
  const { plugin } = deps;

  const read = (): Array<Record<string, unknown>> => storedRows(plugin.getConfig());

  /**
   * Запись. `registerCommands` пропускается там, где набор команд не менялся:
   * описание строки командой не является. Перерегистрация не обязана быть —
   * без неё новая команда появится после перезапуска, и это не повод падать.
   */
  const save = (rows: unknown[], reason: string, registerCommands: boolean): void => {
    plugin.setConfigPatch({ ui: { binderRows: rows } }, reason);
    if (!registerCommands || typeof plugin.registerBinderCommands !== "function") return;
    try {
      plugin.registerBinderCommands();
    } catch (e) {
      console.error("inline-overhaul: команды Binder не перерегистрировались", e);
    }
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

    add(draft) {
      const insertText = String(draft && draft.insertText || "");
      /* Строка без текста вставки не делает ничего: команда пуста (З8). */
      if (!insertText.trim()) return;
      const next = read().concat([{
        rowId: newRowId(),
        insertText,
        commandName: String(draft && draft.commandName || "").trim(),
        description: String(draft && draft.description || "").trim(),
        /* Пусто: идентификатор поставит `normalizeBinderRows` на этом же патче. */
        commandId: "",
      }]);
      save(next, "settings:binder:add", true);
    },
  };
}
