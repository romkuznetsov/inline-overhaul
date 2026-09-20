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
 * Голым его спрашивали в `main.js`, и менеджер не находил ничего никогда:
 * заметка конфигурации показывала хоткеи полей-дат пустыми (Б-11). Починено
 * дважды — 2026-08-29 полный идентификатор, 2026-08-31 сам идентификатор
 * спрашивается у реестра команд, а не собирается третьей копией схемы. Здесь
 * он собирается из `manifest.id`.
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

import { BLOCK_TEXTS } from "../texts_blocks.ts";

interface AppLike {
  hotkeyManager?: HotkeyManager;
  setting?: SettingApi;
}

/**
 * Подпись «хоткея нет». Снята с прототипа, английское живёт в каталоге
 * (10.13.47): её показывают два блока, и второе определение разошлось бы
 * с первым (У-32).
 */
export const HOTKEY_NONE = BLOCK_TEXTS["command-list"].HOTKEY_NOT_SET;

/**
 * Подпись кнопки хоткея. Снята с прототипа и живёт рядом с `HOTKEY_NONE`:
 * её показывают два блока — Binder (10.4) и справочник команд (10.5), — и
 * второе определение разошлось бы с первым.
 */
export const HOTKEY_TITLE = BLOCK_TEXTS["command-list"].HOTKEY_OPEN;

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

/**
 * Правило отбора экрана `Hotkeys` — прочитано в `app.js` 1.13.7, а не выведено
 * из вида поиска (правило 101).
 *
 * Строка запроса приводится к нижнему регистру и **делится по пробелам**;
 * команда остаётся, если **каждая** часть — подстрока её имени, либо каждая —
 * подстрока её идентификатора. Ни «или», ни кавычек, ни исключений в этом
 * языке нет, и поэтому произвольный набор команд запросом не выражается:
 * фильтр умеет только сузить список, а не перечислить.
 *
 * Имя, по которому идёт отбор, — **полное**: Obsidian дописывает к нему имя
 * плагина (`e.name = manifest.name + ": " + e.name` в `addCommand`), и это
 * даёт даровой охват «только команды этого плагина».
 */
export function matchesHotkeyQuery(query: string, name: string, id: string): boolean {
  const parts = String(query || "").toLowerCase().split(" ").filter(Boolean);
  if (!parts.length) return true;
  const hit = (text: string): boolean => {
    const low = String(text || "").toLowerCase();
    return parts.every(p => low.indexOf(p) !== -1);
  };
  return hit(name) || hit(id);
}

/** Слова имени: по ним строятся части запроса. */
function words(name: string): string[] {
  return String(name || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Запрос, которым экран `Hotkeys` показывает команды одного заголовка
 * справочника (его заказ 2026-09-20, пункт 12.3).
 *
 * **Что гарантируется и что нет.** Гарантируется охват: каждая команда
 * заголовка запросу отвечает. Точности язык отбора не даёт — набор команд
 * заголовка в нём не выражается, — поэтому из годных запросов берётся тот, под
 * который попадает меньше **чужих** команд плагина; при равенстве — длинный,
 * он понятнее в поле поиска. Не нашлось общего слова — остаётся имя плагина:
 * это всё ещё сужение (свои команды против всех в Obsidian) и всё ещё правда.
 *
 * Считается это на настоящем списке команд, а не на памяти: у человека свои
 * Fields, и общее слово у его заголовка своё.
 */
export function hotkeyQueryFor(
  scope: string,
  members: readonly { name: string; id: string }[],
  all: readonly { name: string; id: string }[],
): string {
  const base = String(scope || "").trim();
  if (!members.length) return base;
  const full = (c: { name: string }): string => (base ? base + ": " + c.name : c.name);
  const first = members[0];
  let common: string[] = first ? words(first.name) : [];
  for (const cmd of members.slice(1)) {
    const has = new Set(words(cmd.name));
    common = common.filter(w => has.has(w));
  }
  const candidates = common.map(w => (base ? base + " " + w : w));
  candidates.push(base);
  let best = base;
  let bestExtra = Infinity;
  for (const query of candidates) {
    if (!query) continue;
    const own = new Set(members.map(c => c.id));
    if (!members.every(c => matchesHotkeyQuery(query, full(c), c.id))) continue;
    const extra = all.filter(c => !own.has(c.id) && matchesHotkeyQuery(query, full(c), c.id)).length;
    const better = extra < bestExtra || (extra === bestExtra && query.length > best.length);
    if (better) { best = query; bestExtra = extra; }
  }
  return best;
}

/** Имя плагина — то самое, которое Obsidian дописывает к имени каждой команды. */
export function pluginScope(plugin: unknown): string {
  const manifest = (plugin as { manifest?: { name?: unknown } } | null)?.manifest;
  return String(manifest && manifest.name ? manifest.name : "").trim();
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
