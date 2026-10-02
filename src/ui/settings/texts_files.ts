/**
 * Каталоги текстов на диске (PRD 10.13.38). Файловые операции — швом, чтобы
 * проверяться без Obsidian. Шов — операции адаптера: vault не индексирует
 * `.obsidian/**`, `getAbstractFileByPath` файла плагина не найдёт (10.13.26 Ф5).
 */

import {
  BASE_LANG,
  DEFAULT_FILE,
  LANGUAGE_NAME_KEY,
  TEXTS_DIR,
  catalogFile,
  parseCatalog,
  type Catalogs,
  type TextEntry,
} from "./texts.ts";

/** То, что каталогам нужно от хранилища. */
export interface TextFiles {
  exists: (path: string) => Promise<boolean> | boolean;
  read: (path: string) => Promise<string> | string;
  write: (path: string, data: string) => Promise<void> | void;
  mkdir?: (path: string) => Promise<void> | void;
  /** Что лежит в папке. Нет — языки берутся только из тех файлов, что мы положили. */
  list?: (path: string) => Promise<{ files?: readonly string[] }> | { files?: readonly string[] };
}

/**
 * Языки, которые плагин кладёт сам. Пусто — решение заказчика (10.13.48):
 * в папке только `default.js`, остальное приносит человек. Английского здесь
 * нет (10.13.46): снимок заморозил бы позднейшие формулировки; его место —
 * `default.js`, который переписывается при расхождении.
 */
export const SHIPPED_LANGS: readonly string[] = [];

/**
 * Файлы, которые плагин клал раньше (`en.js`, `ru.js` до `0.1.0-beta.4`) и
 * вправе обновлять, пока они слово в слово равны написанному плагином.
 * Одна правка — и файл человеческий навсегда.
 */
export const MANAGED_LANGS: readonly string[] = [BASE_LANG, "ru"];

/** Папка каталогов внутри папки плагина. */
export function textsDirOf(pluginFolder: string): string {
  return String(pluginFolder || "").replace(/\/+$/, "") + "/" + TEXTS_DIR;
}

/** Английские строки поверх с переведённым; имя языка — первой строкой файла. */
export function seeded(
  entries: readonly TextEntry[],
  seed: Readonly<Record<string, string>>,
): readonly TextEntry[] {
  const name = seed[LANGUAGE_NAME_KEY];
  const head: TextEntry[] = name ? [{ key: LANGUAGE_NAME_KEY, text: String(name) }] : [];
  return head.concat(entries.map(e => (seed[e.key] ? { ...e, text: String(seed[e.key]) } : e)));
}

/** Содержимое файла для языка: засев поверх английского, если он есть. */
function fileFor(
  lang: string,
  entries: readonly TextEntry[],
  seeds: Readonly<Record<string, Readonly<Record<string, string>>>>,
): string {
  const seed = seeds ? seeds[lang] : undefined;
  return catalogFile(lang, seed ? seeded(entries, seed) : entries);
}

/**
 * Что плагин **написал бы** в файл языка (английский + засев + имя языка).
 * Картой: сравнивают значения, порядок ключей ни при чём.
 */
function shippedMap(
  english: Readonly<Record<string, string>>,
  seed: Readonly<Record<string, string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const name = seed ? seed[LANGUAGE_NAME_KEY] : "";
  if (name) out[LANGUAGE_NAME_KEY] = String(name);
  for (const [key, text] of Object.entries(english || {})) {
    if (key === LANGUAGE_NAME_KEY) continue;
    out[key] = seed && seed[key] ? String(seed[key]) : text;
  }
  return out;
}

/**
 * Тронут ли файл человеком. Сравниваются значения, а не байты (У-77);
 * сломанный файл — тронутый. Сравнение — с написанным **в прошлый раз**
 * (`default.js` ещё не переписан), иначе каждая новая строка каталога
 * замораживала бы файл. `partial` — прошлого нет (сборка без `default.js`):
 * каждый ключ файла известен и равен нынешнему английскому.
 */
export function untouched(
  onDisk: string,
  expected: Readonly<Record<string, string>>,
  partial?: boolean,
): boolean {
  const theirs = parseCatalog(onDisk);
  if (!theirs) return false;
  const keys = Object.keys(theirs);
  if (!partial && keys.length !== Object.keys(expected).length) return false;
  for (const key of keys) if (theirs[key] !== expected[key]) return false;
  return true;
}

/**
 * Привести папку каталогов в нынешнее состояние; возвращает записанные пути.
 *
 * 1. `default.js` ведёт плагин (10.13.46): переписывается при расхождении.
 * 2. Отсутствующему языку кладётся снимок.
 * 3. Существующий файл языка не перезаписывается, пока в нём есть правка человека.
 *
 * Недостающий ключ доедет английским из схемы (Я4).
 */
export async function ensureCatalogFiles(
  files: TextFiles,
  pluginFolder: string,
  entries: readonly TextEntry[],
  seeds: Readonly<Record<string, Readonly<Record<string, string>>>>,
): Promise<readonly string[]> {
  const dir = textsDirOf(pluginFolder);
  const written: string[] = [];
  if (typeof files.write !== "function") return written;
  if (!await Promise.resolve(files.exists(dir)) && typeof files.mkdir === "function") {
    await Promise.resolve(files.mkdir(dir));
  }

  const put = async (lang: string, text: string): Promise<void> => {
    const path = dir + "/" + lang + ".js";
    await Promise.resolve(files.write(path, text));
    written.push(path);
  };

  /*
   * 1. Файл плагина читается **до** записи: только по прошлой сборке видно,
   *    тронул ли человек свой файл.
   */
  const mine = catalogFile(DEFAULT_FILE, entries);
  const defaultPath = dir + "/" + DEFAULT_FILE + ".js";
  let before: Record<string, string> | null = null;
  if (await Promise.resolve(files.exists(defaultPath))) {
    try {
      before = parseCatalog(String(await Promise.resolve(files.read(defaultPath))));
    } catch (e) {
      console.error("inline-overhaul: " + DEFAULT_FILE + ".js не прочитался, пишем заново", e);
    }
  }
  const english: Record<string, string> = {};
  for (const entry of entries) english[entry.key] = entry.text;
  if (!before || JSON.stringify(before) !== JSON.stringify(english)) await put(DEFAULT_FILE, mine);

  /* 2 и 3. Файлы языков. */
  for (const lang of MANAGED_LANGS) {
    const path = dir + "/" + lang + ".js";
    const seed = (seeds && seeds[lang]) || {};
    const text = fileFor(lang, entries, seeds);
    if (!await Promise.resolve(files.exists(path))) {
      /* Класть заново — только эти языки. */
      if (SHIPPED_LANGS.indexOf(lang) >= 0) await put(lang, text);
      continue;
    }
    let onDisk = "";
    try {
      onDisk = String(await Promise.resolve(files.read(path)));
    } catch (e) {
      console.error("inline-overhaul: каталог " + lang + " не прочитался, оставляем как есть", e);
      continue;
    }
    if (onDisk.replace(/\r\n?/g, "\n") === text) continue;
    const was = shippedMap(before || english, seed);
    if (untouched(onDisk, was, !before)) await put(lang, text);
  }
  return written;
}

/** Что случилось при чтении: каталоги и файлы, которые прочесть не вышло. */
export interface CatalogsRead {
  catalogs: Catalogs;
  /** Неразобравшиеся файлы — про них надо сказать. */
  broken: readonly string[];
}

/**
 * Что лежит в папке `texts`. Сломанный файл не роняет панель (Я1), но
 * называется отдельно — решает зовущий.
 */
export async function readCatalogs(files: TextFiles, pluginFolder: string): Promise<CatalogsRead> {
  const catalogs: Record<string, Record<string, string>> = {};
  const broken: string[] = [];
  const dir = textsDirOf(pluginFolder);
  if (typeof files.list !== "function") return { catalogs, broken };
  try {
    if (!await Promise.resolve(files.exists(dir))) return { catalogs, broken };
    const listed = await Promise.resolve(files.list(dir));
    for (const path of (listed && listed.files) || []) {
      const name = String(path).split("/").pop() || "";
      if (!/\.js$/i.test(name)) continue;
      const lang = name.replace(/\.js$/i, "");
      if (!lang) continue;
      /*
       * `default.js` — файл плагина, а не язык (10.13.46): второй дом
       * английскому разошёлся бы со схемой молча (У-32).
       */
      if (lang === DEFAULT_FILE) continue;
      try {
        const parsed = parseCatalog(String(await Promise.resolve(files.read(String(path)))));
        if (parsed) catalogs[lang] = parsed;
        else broken.push(name);
      } catch (e) {
        broken.push(name);
        console.error("inline-overhaul: каталог текстов не открылся: " + path, e);
      }
    }
  } catch (e) {
    console.error("inline-overhaul: папка каталогов текстов не прочиталась", e);
  }
  return { catalogs, broken };
}
