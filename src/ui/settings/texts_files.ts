/**
 * Каталоги текстов на диске (PRD 10.13.38).
 *
 * Файловые операции приходят швом, а не берутся у Obsidian напрямую: тогда
 * и запись, и чтение проверяются без него — на настоящих функциях, а не на
 * пересказе того, что они делают.
 *
 * **Адаптер, а не дерево заметок.** Vault не индексирует `.obsidian/**`, и
 * `getAbstractFileByPath` файл в папке плагина не найдёт **никогда** — тот же
 * урок, что стоил команд курсора внутри строки (10.13.26 Ф5). Поэтому шов
 * описан операциями адаптера.
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
 * Языки, которые плагин кладёт в папку сам: русский плейсхолдером (решение
 * заказчика — не тратить перевод, пока механизм не готов). Всё остальное —
 * файлы, которые человек принёс сам, и регистрировать их негде: список языков
 * собирается из папки.
 *
 * **Английского здесь нет и быть не должно** (10.13.46). Английский снимок,
 * положенный при установке и больше не переписываемый, замораживает каждую
 * позднейшую переформулировку: в подстановке он стоит раньше схемы. Его место
 * занял `default.js` — файл плагина, который переписывается при расхождении.
 */
export const SHIPPED_LANGS: readonly string[] = ["ru"];

/**
 * Файлы, которые плагин когда-либо клал сам и потому вправе держать в строю,
 * — но **только пока в них не тронуто ни строки**. `en.js` тут ради тех, у
 * кого он уже лежит от прошлых сборок: не трогать его значило бы оставить
 * английский замороженным, а переписать с правкой человека — унести его
 * работу. Правило одно: файл, слово в слово равный тому, что написал плагин,
 * — всё ещё его; расхождение в одной строке делает файл человеческим
 * навсегда.
 */
export const MANAGED_LANGS: readonly string[] = [BASE_LANG, "ru"];

/** Папка каталогов внутри папки плагина. */
export function textsDirOf(pluginFolder: string): string {
  return String(pluginFolder || "").replace(/\/+$/, "") + "/" + TEXTS_DIR;
}

/**
 * Английские строки, поверх которых легло то, что уже переведено.
 *
 * Имя языка идёт первой строкой файла: по нему список языков его и
 * подписывает, а человек, открывший файл, первым делом видит, чей он.
 */
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
 * Что плагин **написал бы** в файл языка: английский, поверх которого лёг
 * засев, плюс имя самого языка. Картой, а не строками файла: сравнивают
 * значения, и порядок ключей тут ни при чём.
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
 * Тронут ли файл человеком.
 *
 * Сравниваются **значения**, а не байты: перевод строки, отступ и порядок
 * ключей — форма, и менять её редактор человека вправе (У-77). Сломанный файл
 * считается тронутым: разобрать его нельзя, а переписать значило бы стереть
 * то, что человек не дописал.
 *
 * Сравнивать надо с тем, что плагин написал **в прошлый раз**, а не с тем,
 * что напишет сейчас: иначе всякая новая строка каталога делала бы нетронутый
 * файл «человеческим» и замораживала его навсегда. Прошлое написанное лежит в
 * `default.js`, который к этому моменту ещё не переписан.
 *
 * `partial` — единственный случай, когда прошлого нет: папка досталась от
 * сборки, которая `default.js` не писала. Тогда файлу верят по тому, что в
 * нём есть: каждый его ключ известен и равен нынешнему английскому. Правка
 * человека такую проверку не проходит, а отставание на новые ключи — проходит.
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
 * Привести папку каталогов в нынешнее состояние. Возвращает записанные пути —
 * по ним видно, что запуск и правда что-то сделал.
 *
 * Три разных случая, и путать их нельзя:
 *
 * 1. **`default.js` ведёт плагин** (10.13.46). Он переписывается всякий раз,
 *    когда разошёлся с каталогом: ради этого он и заведён — чтобы новая
 *    настройка, новое окно и переформулированная строка появлялись в папке
 *    сами, а не ждали, пока человек снесёт свой файл.
 * 2. **Файла языка, которого нет, кладётся снимок** — как и раньше.
 * 3. **Существующий файл языка не перезаписывается**, пока в нём есть хоть
 *    одна правка человека. Файл, слово в слово равный написанному плагином,
 *    правкой не является, и держать его отставшим незачем.
 *
 * Ключ, которого в файле человека нет, доедет английским из схемы (Я4), —
 * поэтому отставший файл ничего не ломает, он просто отстаёт на новые строки.
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
   * 1. Файл плагина. Читается **до** записи: в нём лежит английский прошлой
   *    сборки, и только по нему видно, тронул ли человек свой файл.
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
      /* Класть заново мы обещали не всякий язык, а только эти. */
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
  /** Имена файлов, которые не разобрались. Про них надо сказать, а не молчать. */
  broken: readonly string[];
}

/**
 * Что лежит в папке `texts`.
 *
 * Сломанный файл — не ошибка загрузки: панель обязана открыться и на нём
 * (Я1). Но и молчать о нём нельзя: человек правит этот файл руками, и
 * молчание в ответ на его правку — худшее, что можно сделать. Поэтому
 * сломанные названы отдельно, а решает, что с ними делать, тот, кто звал.
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
       * `default.js` — файл плагина, а не язык (10.13.46). Прочитать его
       * значило бы завести английскому второй дом: он и так лежит в схеме, и
       * два объявления одного текста расходятся молча (У-32).
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
