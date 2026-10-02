/**
 * Хоткей команды: показать и открыть настройки Obsidian на нём (К-2, PRD 10.5;
 * нужен Binder 10.4 и справочнику команд 10.5).
 *
 * `app.hotkeyManager` и `app.setting` — приватное API, их может не быть:
 * каждая функция проверяет наличие и ловит исключение, отказ — «нет» (К-2).
 * Идентификатор в менеджере — полный `<plugin>:<id>`, из `manifest.id` (Б-11).
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

/** Подпись «хоткея нет»; одна на два блока (10.13.47, У-32). */
export const HOTKEY_NONE = BLOCK_TEXTS["command-list"].HOTKEY_NOT_SET;

/** Подпись кнопки хоткея; одна на Binder (10.4) и справочник команд (10.5). */
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

/** `Mod` — `Cmd` на macOS, иначе `Ctrl`; клиента не видно (проверки) — `Ctrl`. */
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
 * Хоткей команды или "". `customKeys` перекрывает `getHotkeys`; пустой массив
 * в нём — «снят», а не «нет записи».
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
 * Отбор экрана `Hotkeys` (`app.js` 1.13.7, правило 101): запрос в нижнем
 * регистре делится по пробелам; команда остаётся, если каждая часть —
 * подстрока имени либо каждая — подстрока id. Ни «или», ни кавычек: фильтр
 * только сужает. Имя полное — Obsidian дописывает `manifest.name + ": "`.
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

/** Общее начало строк — то, чем заголовок отличается от своих соседей. */
function commonPrefixOf(names: readonly string[]): string {
  if (!names.length) return "";
  let head = String(names[0] || "");
  for (const name of names.slice(1)) {
    const other = String(name || "");
    let at = 0;
    while (at < head.length && at < other.length && head[at] === other[at]) at++;
    head = head.slice(0, at);
    if (!head) break;
  }
  return head;
}

/**
 * Запрос экрана `Hotkeys` для команд одного заголовка справочника (12.3,
 * 2026-09-20). Гарантирован охват, не точность: из годных — меньше чужих
 * команд, при равенстве длинный; нет общего слова — имя плагина. Считается
 * по настоящему списку команд.
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
  /*
   * Общее начало имён сильнее общего слова: `Navigation:` с двоеточием есть
   * только у своей области, а `navigation` — ещё и в `Toggle Navigation module`.
   */
  const prefix = commonPrefixOf(members.map(c => full(c))).trim();
  if (prefix) candidates.push(prefix);
  candidates.push(base);
  /*
   * Годные — под которые попадают все команды заголовка. Меньше чужих; при
   * равенстве — слово, подлиннее; общее начало имён — последним.
   */
  const own = new Set(members.map(c => c.id));
  const fit: Array<{ query: string; extra: number; byWord: boolean }> = [];
  for (const query of candidates) {
    if (!query) continue;
    if (!members.every(c => matchesHotkeyQuery(query, full(c), c.id))) continue;
    const extra = all.filter(c => !own.has(c.id) && matchesHotkeyQuery(query, full(c), c.id)).length;
    fit.push({ query, extra, byWord: query !== prefix });
  }
  if (!fit.length) return base;
  const least = Math.min(...fit.map(f => f.extra));
  const shortlist = fit.filter(f => f.extra === least);
  const byWord = shortlist.filter(f => f.byWord).sort((a, b) => b.query.length - a.query.length);
  const chosen = byWord.length ? byWord[0] : shortlist[0];
  return chosen ? chosen.query : base;
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

/** Открыть хоткеи Obsidian на команде; поиск по имени — его и показывает список. */
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
