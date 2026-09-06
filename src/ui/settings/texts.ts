/**
 * Каталог видимых текстов и язык панели (PRD 10.13.38, заказ заказчика
 * 2026-09-06).
 *
 * Заказ был из двух половин: «изменять название опций, коллаутов и tips…
 * достаточно муторно — я должен обращаться к тебе» и «хочу добавить
 * возможность изменения языка». Обе решаются одним и тем же: каждый видимый
 * текст панели получает **ключ**, а тексты уезжают в файл рядом с плагином,
 * который человек правит сам.
 *
 * **Ключ — `<id группы>.<id строки>.<слот>`** (Я-ключ, 10.13.38). Оба
 * идентификатора уже существуют и уже показываются человеку в подсказке
 * (`Advanced → Setting ids`); придумывать вторую схему адресации незачем, а
 * изобретённая разошлась бы с той, что он видит на экране. Слот группы —
 * `<id группы>.<слот>`, слот вкладки — `tab.<id>.<слот>`.
 *
 * **Английский текст остаётся в схеме, а каталог его повторяет.** Второго
 * дома у текста при этом не заводится (У-32): английская ветка каталога
 * **выводится** из схемы этим же модулем — `catalogEntries` — и файл на диск
 * пишется ею же. Прототип не тронут, и Р8 не сужается: он по-прежнему
 * источник истины по всем видимым строкам, просто теперь из него растёт ещё
 * и каталог.
 *
 * **Незаполненное молча уступает английскому** (Я4). Ключ, которого в файле
 * нет, пустая строка, сломанный JSON, отсутствующий файл — всё это одно и то
 * же состояние: человек видит английский текст, а не ключ и не пустое место.
 * Показать ключ вместо текста значило бы завести дефект на экране вместо
 * строки в отчёте.
 *
 * **Имена команд не переключаются** (Я2). Их Obsidian берёт из реестра
 * команд и показывает в палитре; переведи мы их здесь — справочник команд
 * разошёлся бы с палитрой, а пин `docs_terms_tests.ts` потерял бы предмет.
 */

import type { SettingDef, SettingsGroup, TabDef } from "./types.ts";

/** Ключ, под которым в каталоге лежит имя самого языка: `English`, `Русский`. */
export const LANGUAGE_NAME_KEY = "$language";

/** Язык, на котором написана схема. Он же — последнее слово при подстановке. */
export const BASE_LANG = "en";

/**
 * Имя английского языка. Своего текста в схеме у него нет и быть не может —
 * это имя языка, а не строка панели, — а список языков подписывает каждый
 * файл тем, что в нём написано. Без этой строки английский показывался бы в
 * списке кодом `en`.
 */
export const BASE_LANG_SEED: Readonly<Record<string, string>> = { [LANGUAGE_NAME_KEY]: "English" };

/** Папка каталогов внутри папки плагина. */
export const TEXTS_DIR = "texts";

/**
 * Имя файла, который ведёт сам плагин (10.13.46, замечание заказчика к K1:
 * «убедись, что en.js — дефолтный и в нём будут автоматически выполняться
 * изменения, происходящие в ходе дальнейшей доработки плагина»).
 *
 * Своего файла у английского быть не должно, и вот почему. Файл человека
 * плагин не перезаписывает никогда — значит английский снимок, положенный
 * при установке, **замораживает** каждую позднейшую переформулировку: в
 * подстановке он стоит раньше схемы и выигрывает у неё молча. Поэтому
 * английский живёт в схеме, а рядом лежит `default.js` — тот же текст
 * файлом, который плагин переписывает при каждом расхождении. Его копируют,
 * чтобы завести язык; его же читают, чтобы увидеть все ключи разом.
 *
 * Языком он не считается: в списке языков его нет, и в подстановке он не
 * участвует — иначе один и тот же английский стоял бы в двух местах (У-32).
 */
export const DEFAULT_FILE = "default";

/**
 * Значение варианта выпадающего списка бывает пустым (`No Field chosen`), и
 * ключ `…option.` читался бы как оборванный. Пустое значение называется этим
 * знаком; проверка следит, чтобы такого значения не завелось по-настоящему.
 */
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
 * Тексты, которых в схеме нет, — и место, где они встают.
 *
 * `forItem` зовётся на каждой строке настройки и отдаёт то, что показывает
 * **она сама**: свой блок рисует вводный коллаут, живой предпросмотр или
 * справочник команд, а кнопка открывает окно со своими заголовками. Всё это
 * человек видит в одном месте панели, и в файле каталога оно обязано лежать
 * там же (замечание заказчика к K1: «callouts и tips элемента находятся рядом
 * с названием хедера или опции»). Отдельным разделом в конце такие строки уже
 * лежали, и найти среди них подсказку к нужному окну было нечем.
 *
 * `tail` — то, у чего места в схеме нет вовсе: `Cancel`, слова счёта, строки
 * про версию Obsidian. Их немного, и они идут последним разделом.
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
  /*
   * Старые имена настройки: человек ищет ими в глобальном поиске Obsidian
   * (С4). Переводить их незачем — но и оставить только английские нельзя:
   * ищет он на своём языке. Поэтому они тоже в каталоге, по порядковому
   * номеру: своего имени у такой строки нет.
   */
  const search = any.searchTerms as readonly unknown[] | undefined;
  if (Array.isArray(search)) {
    search.forEach((term, i) => pushText(out, itemKey(group, id, "search." + i), term));
  }
}

/**
 * Всё, что панель показывает из схемы, — списком в порядке показа.
 *
 * Порядок здесь не украшение: это порядок строк в файле, который человек
 * правит руками. Отсортированный по алфавиту каталог заставлял бы его
 * искать строку, вместо того чтобы читать сверху вниз ровно так же, как он
 * читает саму панель.
 */
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
 * Как выглядит файл, который человек правит.
 *
 * Это `.js`, а не `.json`, по одной причине: так его можно подключить
 * обычным `<script src>` там, где сборки нет, — и так же он читается
 * плагином. Разбирается он при этом **как JSON**: плагин берёт кусок от
 * первой открывающей до последней закрывающей фигурной скобки и отдаёт его
 * `JSON.parse`. Файл, который правит человек, бывает сломан, и выполнять его
 * как код нельзя (Я1).
 *
 * Отсюда правила, о которых говорит шапка самого файла: в объекте нет
 * комментариев и нет запятой после последней строки. Пустые строки между
 * разделами есть — их JSON пропускает наравне с пробелами.
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

/**
 * Что в файле написано. `null` — файл прочесть не удалось: сломанный JSON,
 * не тот верхний уровень, значения не строки. Ошибка не бросается: панель
 * обязана открыться и на сломанном файле (Я1).
 */
export function parseCatalog(text: string): Record<string, string> | null {
  /*
   * Границы объекта — строки, а не первая и последняя скобка в файле: в
   * шапке стоит `window.IO_TEXTS = window.IO_TEXTS || {}`, и поиск первой
   * скобки приводил ровно туда. Возврат каретки снимается заранее: файл
   * правит человек, и сохранить его формой Windows он вправе (У-77).
   */
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
    /* Не строка — не текст. Молчим о ней ровно так же, как о пропущенной. */
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

/**
 * Резолвер на один язык.
 *
 * Порядок один и тот же для всех: свой язык → английский файл → то, что
 * написано в схеме. Английский файл стоит между ними затем, что человек
 * правит и его — это и есть первая половина заказа.
 */
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

/**
 * Языки, из которых можно выбирать: английский плюс всё, что нашлось в
 * папке. Имя языка берётся из самого файла, а не из списка в коде: список в
 * коде пришлось бы править ради каждого нового файла, а тогда «добавление
 * новых языков» перестало бы быть простой задачей.
 */
export function languageOptions(catalogs: Catalogs): ReadonlyArray<{ value: string; label: string }> {
  const seen = new Set<string>([BASE_LANG]);
  for (const lang of Object.keys(catalogs || {})) {
    /* `default.js` — файл плагина, а не язык (10.13.46). */
    if (lang === DEFAULT_FILE) continue;
    seen.add(lang);
  }
  return Array.from(seen).sort().map(lang => {
    const named = catalogs && catalogs[lang] ? catalogs[lang][LANGUAGE_NAME_KEY] : "";
    /*
     * У английского своего файла нет и быть не должно (10.13.46), а имя ему
     * всё равно нужно: иначе в списке он стоял бы кодом `en`.
     */
    const fallback = lang === BASE_LANG ? BASE_LANG_SEED[LANGUAGE_NAME_KEY] : "";
    return { value: lang, label: named && String(named) || fallback || lang };
  });
}

/* ---- перевод схемы ----------------------------------------------------- */

function say(t: Resolve, key: string, value: unknown): string | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  return t(key, value);
}

/**
 * Копия строки настройки с переведёнными текстами.
 *
 * Копия, а не правка на месте: схема — модуль, живущий всё время работы
 * плагина, и переписать её значило бы сделать переключение языка
 * необратимым. Всё, что не текст, переносится как есть — предикаты и
 * рендереры своих блоков это функции, и клонировать их нельзя.
 */
function localizeItem(group: string, it: SettingDef, t: Resolve): SettingDef {
  const any = it as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...any };
  const id = it.id;
  const put = (slot: string, value: unknown): void => {
    const next = say(t, itemKey(group, id, slot), value);
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
    const intro = say(t, groupKey(g.id, "intro"), g.intro);
    if (intro !== undefined) out.intro = intro;
    const tip = say(t, groupKey(g.id, "tip"), g.tip);
    if (tip !== undefined) out.tip = tip;
    return out;
  });
}

/** Полоса вкладок и строки перехода на них. */
export function localizeTabs(tabs: readonly TabDef[], t: Resolve): readonly TabDef[] {
  return tabs.map(tab => {
    const out: TabDef = { ...tab, label: t(tabKey(tab.id, "label"), tab.label) };
    const desc = say(t, tabKey(tab.id, "desc"), tab.desc);
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

/**
 * Что в переводе не сделано (Я4). Отчёт нужен гейту, а не экрану: показывать
 * человеку ключ вместо текста — это дефект на экране вместо строки в отчёте.
 */
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
