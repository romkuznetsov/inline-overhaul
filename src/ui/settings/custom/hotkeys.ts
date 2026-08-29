/**
 * Хоткей команды: показать назначенный и открыть настройки Obsidian на нём.
 *
 * Это К-2 из PRD 10.5, вынесенное отдельно, потому что колонка `Hotkey` нужна
 * двум блокам: Binder (10.4) уже сейчас, справочник команд (10.5) — когда у
 * него появятся имена команд из фазы 2.
 *
 * **Всё здесь — приватное API Obsidian.** `app.hotkeyManager` и `app.setting`
 * не объявлены в `obsidian.d.ts`, и их может не быть: другая версия, мобильный
 * клиент, заглушка в проверках. Поэтому каждая функция проверяет наличие и
 * ловит исключение, а при отказе отвечает «нет» — кнопка становится
 * неактивной, панель не падает (К-2).
 *
 * Идентификатор команды в менеджере хоткеев — **полный**: `<plugin>:<id>`.
 * `getBoundHotkeyForCommand` в `main.js` спрашивает голым
 * (`inlineOverhaul_Hotkey_…`) и поэтому не находит ничего никогда — из-за
 * этого заметка конфигурации показывает хоткеи полей-дат пустыми. Дефект
 * записан в PRD 10.4 и живёт вне слоя настроек; здесь идентификатор
 * собирается из `manifest.id`.
 */

/** Хоткей в том виде, в каком его хранит Obsidian. */
interface Binding {
  modifiers?: unknown;
  key?: unknown;
}

interface HotkeyManager {
  customKeys?: Record<string, unknown>;
  getHotkeys?: (id: string) => unknown;
  getDefaultHotkeys?: (id: string) => unknown;
}

interface SettingApi {
  open?: () => void;
  openTabById?: (id: string) => unknown;
}

interface AppLike {
  hotkeyManager?: HotkeyManager;
  setting?: SettingApi;
}

/** Подпись «хоткея нет». Снята с прототипа. */
export const HOTKEY_NONE = "not set";

function app(plugin: unknown): AppLike | null {
  const holder = plugin as { app?: unknown } | null;
  const value = holder && typeof holder === "object" ? holder.app : null;
  return value && typeof value === "object" ? (value as AppLike) : null;
}

/** Полный идентификатор команды: `<id плагина>:<id команды>`. */
export function fullCommandId(plugin: unknown, commandId: string): string {
  const id = String(commandId || "").trim();
  if (!id) return "";
  const manifest = (plugin as { manifest?: { id?: unknown } } | null)?.manifest;
  const owner = String(manifest && manifest.id ? manifest.id : "").trim();
  return owner ? owner + ":" + id : id;
}

/**
 * `Mod` — это `Ctrl` везде, кроме macOS, где это `Cmd`. Obsidian решает это
 * сам; здесь то же решение принимается по клиенту, а если клиента не видно
 * (проверки), берётся `Ctrl`.
 */
function modLabel(): string {
  try {
    const nav = (globalThis as { navigator?: { platform?: unknown } }).navigator;
    const platform = String(nav && nav.platform ? nav.platform : "");
    return /Mac|iPhone|iPad/.test(platform) ? "Cmd" : "Ctrl";
  } catch {
    return "Ctrl";
  }
}

/** Одна привязка словами: `Ctrl + Shift + K`. */
function binding(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const b = value as Binding;
  const key = String(b.key || "").trim();
  if (!key) return "";
  const mods = Array.isArray(b.modifiers)
    ? b.modifiers.map(x => String(x || "").trim()).filter(Boolean).map(m => (m === "Mod" ? modLabel() : m))
    : [];
  return mods.length ? mods.join(" + ") + " + " + key : key;
}

function firstBinding(value: unknown): string {
  if (!Array.isArray(value) || !value.length) return "";
  return binding(value[0]);
}

/**
 * Хоткей команды или пустая строка. Свой хоткей человека важнее заводского:
 * `customKeys` перекрывает `getHotkeys`, и пустой массив в нём означает
 * «снят», а не «нет записи».
 */
export function hotkeyOf(plugin: unknown, commandId: string): string {
  const a = app(plugin);
  const hm = a && a.hotkeyManager;
  const id = fullCommandId(plugin, commandId);
  if (!hm || !id) return "";
  try {
    const custom = hm.customKeys;
    if (custom && typeof custom === "object" && Object.prototype.hasOwnProperty.call(custom, id)) {
      return firstBinding(custom[id]);
    }
    if (typeof hm.getHotkeys === "function") return firstBinding(hm.getHotkeys(id));
  } catch (e) {
    console.error("inline-overhaul: хоткей команды не прочитался", e);
  }
  return "";
}

/** Есть ли куда вести человека: без `app.setting` кнопка неактивна (К-2). */
export function canOpenHotkeys(plugin: unknown): boolean {
  const a = app(plugin);
  const s = a && a.setting;
  return !!(s && typeof s.open === "function" && typeof s.openTabById === "function");
}

/**
 * Открыть список хоткеев Obsidian на этой команде. Поиск идёт по **имени**
 * команды: именно его показывает список, и именно его человек увидит, когда
 * окно откроется.
 */
export function openHotkeys(plugin: unknown, commandName: string): boolean {
  const a = app(plugin);
  const s = a && a.setting;
  if (!s || typeof s.open !== "function" || typeof s.openTabById !== "function") return false;
  try {
    s.open();
    const tab = s.openTabById("hotkeys") as { setQuery?: (q: string) => void } | null;
    const query = String(commandName || "").trim();
    if (tab && typeof tab.setQuery === "function" && query) tab.setQuery(query);
    return true;
  } catch (e) {
    console.error("inline-overhaul: настройки хоткеев не открылись", e);
    return false;
  }
}
