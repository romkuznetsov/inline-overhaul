/**
 * Модель Binder (PRD 10.4, фаза 3c).
 *
 * Только чтение конфига и сборка патчей — ни DOM, ни `Notice`: вёрстка обязана
 * рисоваться на заглушке (гейт Г16). Путь `editor.binder.rows` — версии 2
 * (PRD 8.1): его читает `buildBinderCommandDefs`
 * (`src/features/command_registry.js`) и нормализует `normalizeBinderRows`
 * внутри третьей ступени `migrateConfig` (`main.js`).
 *
 * **Идентификатор команды здесь не выдумывается.** `normalizeBinderRows`
 * умеет его выдать: пустой `commandId` она заменяет на
 * kebab-case из имени строки и разводит совпадения. Она идёт на каждом
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

/** Итог записи: отказ обязан сказать, почему (как у переименования Field). */
export interface BinderWriteResult {
  ok: boolean;
  error?: string;
}

/*
 * Тексты отказов. Видимые строки, поэтому без точки в конце (Р10) и поэтому
 * же живут в каталоге (10.13.47) — здесь только имя.
 */
import { BLOCK_TEXTS } from "../texts_blocks.ts";

export const DUPLICATE_INSERT = BLOCK_TEXTS["binder-table"].ERR_TEXT_TAKEN;
export const DUPLICATE_NAME = BLOCK_TEXTS["binder-table"].ERR_NAME_TAKEN;

/**
 * Совпадение с уже заведённой строкой: какое поле повторяется и что об этом
 * сказать. Поле нужно окну — сообщение встаёт под ним, а не над панелью.
 */
export interface BinderClash {
  field: "insertText" | "commandName";
  error: string;
}

export interface BinderModel {
  listRows(): BinderRow[];
  setDescription(rowId: string, text: string): void;
  remove(rowId: string): void;
  move(from: number, to: number): void;
  /**
   * Повторяет ли черновик уже заведённую строку. Спрашивает окно заведения,
   * пока человек печатает: до 2026-09-02 отказ приходил всплывающим
   * сообщением Obsidian **после** закрытия окна и перерисовки блока — «меня
   * выбрасывает во вкладку Keyboard» (C13).
   */
  duplicateOf(draft: BinderDraft): BinderClash | null;
  /**
   * Завести строку. Отказ приходит причиной, а не тишиной: до 2026-09-02
   * повтор заводился молча, а `normalizeBinderRows` разводила совпавшие
   * идентификаторы — и получались две команды с одной подписью (C13).
   */
  add(draft: BinderDraft): BinderWriteResult;
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

  /**
   * Запись. `registerCommands` пропускается там, где набор команд не менялся:
   * описание строки командой не является. Перерегистрация не обязана быть —
   * без неё новая команда появится после перезапуска, и это не повод падать.
   */
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
    /*
     * Повтор: одно объявление на обоих, кто про него спрашивает (У-32).
     *
     * Спрашивают двое: окно заведения — пока человек печатает, чтобы
     * сказать причину под тем полем, которое повторяется, и погасить `Add`;
     * и `add` — последней преградой, потому что записать строку можно и не
     * через окно.
     *
     * Заказчик завёл строку с теми же полями и получил две одинаковые
     * команды: сверки не было вовсе, а `normalizeBinderRows` развела
     * совпавшие идентификаторы — молча и на уровне ниже, где о человеке уже
     * не рассказать. Сверяются оба поля, которыми человек команду и узнаёт:
     * текст вставки и имя (C13, 2026-09-02).
     *
     * Сравнение по видимому значению: пробелы по краям и регистр человек
     * различать не обязан, а Obsidian ищет команду по подписи.
     */
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
      /* Строка без текста вставки не делает ничего: команда пуста (З8). */
      if (!insertText.trim()) return { ok: false };

      const clash = duplicateOf(draft);
      if (clash) return { ok: false, error: clash.error };

      const next = read().concat([{
        rowId: newRowId(),
        insertText,
        commandName: String(draft && draft.commandName || "").trim(),
        description: String(draft && draft.description || "").trim(),
        /* Пусто: идентификатор поставит `normalizeBinderRows` на этом же патче. */
        commandId: "",
      }]);
      save(next, "settings:binder:add", true);
      return { ok: true };
    },
  };
}
