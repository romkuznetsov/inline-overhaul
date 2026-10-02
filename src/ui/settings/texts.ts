/**
 * Каталог видимых текстов и язык панели (PRD 10.13.38, 2026-09-06).
 *
 * Ключ — `<id группы>.<id строки>.<слот>` (те же id, что в `Advanced → Options
 * IDs`); группа — `<id группы>.<слот>`, вкладка — `tab.<id>.<слот>`.
 * Английская ветка выводится из схемы (`catalogEntries`), второго дома нет
 * (У-32, Р8). Незаполненное молча уступает английскому, ключ на экран не
 * выходит (Я4). Имена команд не переводятся — их берёт палитра (Я2).
 */

import type { SettingDef, SettingsGroup, TabDef } from "./types.ts";

/** Ключ, под которым в каталоге лежит имя самого языка: `English`, `Русский`. */
export const LANGUAGE_NAME_KEY = "$language";

/** Язык, на котором написана схема. Он же — последнее слово при подстановке. */
export const BASE_LANG = "en";

/** Имя английского языка: в схеме его нет, без него в списке стоял бы `en`. */
export const BASE_LANG_SEED: Readonly<Record<string, string>> = { [LANGUAGE_NAME_KEY]: "English" };

/** Папка каталогов внутри папки плагина. */
export const TEXTS_DIR = "texts";

/**
 * Файл, который ведёт плагин (10.13.46, K1): английский файлом человека
 * заморозил бы позднейшие формулировки, поэтому английский в схеме, а
 * `default.js` — его копия для перевода, переписываемая при расхождении.
 * Языком не считается и в подстановке не участвует (У-32).
 */
export const DEFAULT_FILE = "default";

/** Имя пустого значения варианта (`No Field chosen`) в ключе `…option.-`; проверка держит, что настоящего `-` нет. */
const EMPTY_VALUE = "-";

/** Пара «ключ — английский текст» в том порядке, в каком их видит человек. */
export interface TextEntry {
  key: string;
  text: string;
  /** Пустая строка перед записью: ею каталог делится на разделы. */
  gap?: true;
}

/* ---- ключи ------------------------------------------------------------- */

export function groupKey(group: string, slot: string): string {
  return group + "." + slot;
}

export function itemKey(group: string, item: string, slot: string): string {
  return group + "." + item + "." + slot;
}

export function tabKey(tab: string, slot: string): string {
  return "tab." + tab + "." + slot;
}

/** Ключ варианта списка. Пустое значение получает своё имя, а не пустое место. */
export function optionKey(group: string, item: string, value: string): string {
  return itemKey(group, item, "option." + (value === "" ? EMPTY_VALUE : value));
}

/* ---- английская ветка: выводится из схемы ------------------------------ */

function pushText(out: TextEntry[], key: string, text: unknown): void {
  if (typeof text !== "string" || text === "") return;
  out.push({ key, text });
}

/**
 * Тексты не из схемы и их место. `forItem` — то, что рисует или открывает
 * сама строка: в файле встаёт рядом с ней (K1). `tail` — без места в схеме
 * (`Cancel`, слова счёта), последним разделом.
 */
export interface CatalogExtras {
  forItem?: (tab: string, group: SettingsGroup, it: SettingDef) => readonly TextEntry[];
  tail?: readonly TextEntry[];
}

/** Видимые тексты одной строки настройки в том порядке, в каком они на экране. */
function itemEntries(out: TextEntry[], group: string, it: SettingDef): void {
  const id = it.id;
  const any = it as unknown as Record<string, unknown>;
  pushText(out, itemKey(group, id, "name"), any.name);
  pushText(out, itemKey(group, id, "desc"), any.desc);
  pushText(out, itemKey(group, id, "tip"), any.tip);
  pushText(out, itemKey(group, id, "placeholder"), any.placeholder);
  pushText(out, itemKey(group, id, "unit"), any.unit);
  const seeAlso = any.seeAlso as { label?: unknown } | undefined;
  if (seeAlso) pushText(out, itemKey(group, id, "seeAlso"), seeAlso.label);
  const buttons = any.buttons as ReadonlyArray<{ action?: unknown; label?: unknown }> | undefined;
  if (Array.isArray(buttons)) {
    for (const b of buttons) pushText(out, itemKey(group, id, "button." + String(b.action)), b.label);
  }
  const options = any.options as ReadonlyArray<{ value?: unknown; label?: unknown }> | undefined;
  if (Array.isArray(options)) {
    for (const o of options) pushText(out, optionKey(group, id, String(o.value)), o.label);
  }
  /* Старые имена для глобального поиска (С4) — ищут на своём языке; ключ по номеру. */
  const search = any.searchTerms as readonly unknown[] | undefined;
  if (Array.isArray(search)) {
    search.forEach((term, i) => pushText(out, itemKey(group, id, "search." + i), term));
  }
}

/** Всё, что панель показывает из схемы, в порядке показа — это порядок строк файла человека. */
export function catalogEntries(
  schema: readonly SettingsGroup[],
  tabs: readonly TabDef[],
  extras?: CatalogExtras,
): readonly TextEntry[] {
  const out: TextEntry[] = [];
  const forItem = extras && extras.forItem;
  for (const tab of tabs) {
    const groups = schema.filter(g => g.tab === tab.id).slice().sort((a, b) => a.order - b.order);
    if (!groups.length) continue;
    out.push({ key: tabKey(tab.id, "label"), text: tab.label, gap: true });
    pushText(out, tabKey(tab.id, "desc"), tab.desc);
    for (const g of groups) {
      const before = out.length;
      pushText(out, groupKey(g.id, "heading"), g.heading);
      pushText(out, groupKey(g.id, "intro"), g.intro);
      pushText(out, groupKey(g.id, "tip"), g.tip);
      for (const it of g.items) {
        itemEntries(out, g.id, it);
        /* То, что рисует и открывает сама строка, — сразу за её текстами. */
        if (forItem) for (const entry of forItem(tab.id, g, it)) out.push(entry);
      }
      const first = out[before];
      if (first) first.gap = true;
    }
  }
  for (const entry of (extras && extras.tail) || []) out.push(entry);
  return out;
}

/* ---- файл каталога ----------------------------------------------------- */

/**
 * Файл каталога: `.js` для `<script src>` без сборки, но читается плагином
 * как JSON — файл человека бывает сломан, выполнять нельзя (Я1). Отсюда: без
 * комментариев и висячей запятой в объекте.
 */
export function catalogFile(lang: string, entries: readonly TextEntry[]): string {
  const mine = lang === DEFAULT_FILE;
  const head = mine
    ? [
      "/*",
      " * inlineOverhaul: every visible text of the settings panel, in English.",
      " *",
      " * THE PLUGIN WRITES THIS FILE. Do not edit it - each update rewrites it,",
      " * so a new setting, a new window and a reworded line all show up here on",
      " * their own, and anything you typed here would be gone.",
      " *",
      " * To translate, copy this file next to it under its own name - ru.js,",
      " * de.js - and change " + LANGUAGE_NAME_KEY + " to the name of that language. That copy is",
      " * yours: the plugin never touches it. Name it en.js and you are rewording",
      " * the English instead of translating it.",
      " *",
      " * A line missing from your copy, and a line left empty, falls back to the",
      " * English written here.",
      " *",
      " * This file is read as JSON, so keep it plain: no comments inside the",
      " * braces below, and no comma after the last line. The plugin reads",
      " * everything between the line that is just { and the last line that is };",
      " */",
    ]
    : [
      "/*",
      " * inlineOverhaul: panel texts, " + lang + ".",
      " *",
      " * Edit the right-hand side of any line and reload the plugin to see it.",
      " * A line you delete, and a line you leave empty, falls back to English.",
      " *",
      " * This file is yours: the plugin stops touching it the moment you change",
      " * a line in it. The English it was copied from is kept current next door,",
      " * in default.js - copy that file again to pick up new lines.",
      " *",
      " * This file is read as JSON, so keep it plain: no comments inside the",
      " * braces below, and no comma after the last line. The plugin reads",
      " * everything between the line that is just { and the last line that is };",
      " */",
    ];
  head.push(
    "window.IO_TEXTS = window.IO_TEXTS || {};",
    "window.IO_TEXTS[" + JSON.stringify(lang) + "] =",
  );
  const body: string[] = ["{"];
  entries.forEach((entry, i) => {
    if (entry.gap && i > 0) body.push("");
    body.push("  " + JSON.stringify(entry.key) + ": " + JSON.stringify(entry.text)
      + (i === entries.length - 1 ? "" : ","));
  });
  body.push("};");
  return head.join("\n") + "\n" + body.join("\n") + "\n";
}

/** Разобранный файл; `null` — не прочёлся. Не бросает: панель открывается и на сломанном (Я1). */
export function parseCatalog(text: string): Record<string, string> | null {
  /* Границы — строки `{` и `};`, а не скобки: в шапке есть `|| {}`. CRLF
     человека допустим (У-77). */
  const lines = String(text === undefined || text === null ? "" : text)
    .replace(/\r\n?/g, "\n").split("\n");
  let from = -1;
  let to = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i]).trim() === "{") { from = i; break; }
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^\}\s*;?$/.test(String(lines[i]).trim())) { to = i; break; }
  }
  if (from < 0 || to <= from) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(lines.slice(from, to + 1).join("\n").replace(/;\s*$/, ""));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    /* Не строка — как пропущенная. */
    if (typeof value !== "string" || value === "") continue;
    out[key] = value;
  }
  return out;
}

/* ---- подстановка ------------------------------------------------------- */

/** Каталоги, прочитанные с диска: язык → ключ → текст. */
export type Catalogs = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Как панель спрашивает текст: ключ и то, что стоит в схеме. */
export type Resolve = (key: string, fallback: string) => string;

/** Резолвер языка: свой язык → английский файл (его тоже правят) → схема. */
export function makeResolve(catalogs: Catalogs, lang: string): Resolve {
  const own = catalogs && catalogs[lang] ? catalogs[lang] : null;
  const base = catalogs && catalogs[BASE_LANG] ? catalogs[BASE_LANG] : null;
  if (!own && !base) return (_key: string, fallback: string) => fallback;
  return (key: string, fallback: string): string => {
    if (own) {
      const mine = own[key];
      if (typeof mine === "string" && mine !== "") return mine;
    }
    if (base && base !== own) {
      const english = base[key];
      if (typeof english === "string" && english !== "") return english;
    }
    return fallback;
  };
}

/** Ничего не переводит. Нужен там, где каталогов нет вовсе. */
export const PLAIN: Resolve = (_key: string, fallback: string) => fallback;

/** Языки: английский и всё из папки; имя языка — из самого файла. */
export function languageOptions(catalogs: Catalogs): ReadonlyArray<{ value: string; label: string }> {
  const seen = new Set<string>([BASE_LANG]);
  for (const lang of Object.keys(catalogs || {})) {
    /* `default.js` — файл плагина, а не язык (10.13.46). */
    if (lang === DEFAULT_FILE) continue;
    seen.add(lang);
  }
  return Array.from(seen).sort().map(lang => {
    const named = catalogs && catalogs[lang] ? catalogs[lang][LANGUAGE_NAME_KEY] : "";
    /* У английского файла нет (10.13.46), имя — из семени. */
    const fallback = lang === BASE_LANG ? BASE_LANG_SEED[LANGUAGE_NAME_KEY] : "";
    return { value: lang, label: named && String(named) || fallback || lang };
  });
}

/* ---- перевод схемы ----------------------------------------------------- */

function translateIfSet(t: Resolve, key: string, value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  return t(key, value);
}

/** Копия строки с переводом: схему не переписываем (язык обратим); функции переносятся как есть. */
function localizeItem(group: string, it: SettingDef, t: Resolve): SettingDef {
  const any = it as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...any };
  const id = it.id;
  const put = (slot: string, value: unknown): void => {
    const next = translateIfSet(t, itemKey(group, id, slot), value);
    if (next !== undefined) out[slot] = next;
  };
  put("name", any.name);
  put("desc", any.desc);
  put("tip", any.tip);
  put("placeholder", any.placeholder);
  put("unit", any.unit);
  const seeAlso = any.seeAlso as { id: string; label: string } | undefined;
  if (seeAlso && typeof seeAlso.label === "string") {
    out.seeAlso = { ...seeAlso, label: t(itemKey(group, id, "seeAlso"), seeAlso.label) };
  }
  const buttons = any.buttons as ReadonlyArray<{ action: string; label: string }> | undefined;
  if (Array.isArray(buttons)) {
    out.buttons = buttons.map(b => ({
      ...b,
      label: t(itemKey(group, id, "button." + String(b.action)), String(b.label)),
    }));
  }
  const options = any.options as ReadonlyArray<{ value: string; label: string }> | undefined;
  if (Array.isArray(options)) {
    out.options = options.map(o => ({
      ...o,
      label: t(optionKey(group, id, String(o.value)), String(o.label)),
    }));
  }
  const search = any.searchTerms as readonly string[] | undefined;
  if (Array.isArray(search)) {
    out.searchTerms = search.map((term, i) => t(itemKey(group, id, "search." + i), String(term)));
  }
  return out as unknown as SettingDef;
}

/** Схема на выбранном языке. */
export function localizeSchema(
  schema: readonly SettingsGroup[],
  t: Resolve,
): readonly SettingsGroup[] {
  return schema.map(g => {
    const out: SettingsGroup = {
      ...g,
      heading: t(groupKey(g.id, "heading"), g.heading),
      items: g.items.map(it => localizeItem(g.id, it, t)),
    };
    const intro = translateIfSet(t, groupKey(g.id, "intro"), g.intro);
    if (intro !== undefined) out.intro = intro;
    const tip = translateIfSet(t, groupKey(g.id, "tip"), g.tip);
    if (tip !== undefined) out.tip = tip;
    return out;
  });
}

/** Полоса вкладок и строки перехода на них. */
export function localizeTabs(tabs: readonly TabDef[], t: Resolve): readonly TabDef[] {
  return tabs.map(tab => {
    const out: TabDef = { ...tab, label: t(tabKey(tab.id, "label"), tab.label) };
    const desc = translateIfSet(t, tabKey(tab.id, "desc"), tab.desc);
    if (desc !== undefined) out.desc = desc;
    return out;
  });
}

/* ---- отчёт о недостающем ----------------------------------------------- */

export interface CatalogReport {
  lang: string;
  /** Ключей всего в английской ветке. */
  total: number;
  /** Ключей, которых в файле нет вовсе или которые пусты. */
  missing: readonly string[];
  /** Ключей, которых в файле нет в английской ветке: опечатка или старьё. */
  unknown: readonly string[];
  /** Ключей, чей текст дословно совпал с английским: перевод не начат. */
  untranslated: readonly string[];
}

/** Что в переводе не сделано (Я4) — для гейта, не для экрана. */
export function reportCatalog(
  lang: string,
  catalog: Readonly<Record<string, string>>,
  entries: readonly TextEntry[],
): CatalogReport {
  const english = new Map<string, string>();
  for (const entry of entries) english.set(entry.key, entry.text);
  const missing: string[] = [];
  const untranslated: string[] = [];
  for (const [key, text] of english) {
    const mine = catalog ? catalog[key] : undefined;
    if (typeof mine !== "string" || mine === "") { missing.push(key); continue; }
    if (mine === text) untranslated.push(key);
  }
  const unknown = Object.keys(catalog || {})
    .filter(key => key !== LANGUAGE_NAME_KEY && !english.has(key))
    .sort();
  return { lang, total: english.size, missing, unknown, untranslated };
}
