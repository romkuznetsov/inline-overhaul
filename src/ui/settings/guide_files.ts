/**
 * Механизм перевода заметки-руководства (PRD 10.13.51, В-73): переведённых строк
 * нет, только уклад. Как у каталога (10.13.46, 10.13.48, У-83):
 *
 * | Что | Кто ведёт | Что делает плагин |
 * |---|---|---|
 * | `guide/default.md` | плагин | переписывает при расхождении с текстом в коде |
 * | `guide/<язык>.md` | человек | не трогает никогда |
 * | заметка в vault | человек | создаёт один раз, дальше только открывает (Р-1) |
 *
 * Строже каталога: прозу не сравнить, поэтому любой файл перевода — человеческий с момента появления.
 */

/** Папка руководств внутри папки плагина. Своя, а не `texts/`: разбор — Г-2. */
export const GUIDE_DIR = "guide";

/** Имя образца. То же слово, что у каталога: его копируют, чтобы завести язык. */
export const GUIDE_DEFAULT = "default";

/** Свойство frontmatter, которым человек подписывает перевод (у каталога — строка `"$language"`). */
export const GUIDE_LANG_PROP = "language";

/** Что механизму нужно от хранилища. Та же форма, что у каталогов. */
export interface GuideFiles {
  exists: (path: string) => Promise<boolean> | boolean;
  read: (path: string) => Promise<string> | string;
  write: (path: string, data: string) => Promise<void> | void;
  mkdir?: (path: string) => Promise<void> | void;
  list?: (path: string) => Promise<{ files?: readonly string[] }> | { files?: readonly string[] };
}

export function guideDirOf(pluginFolder: string): string {
  return String(pluginFolder || "").replace(/\/+$/, "") + "/" + GUIDE_DIR;
}

export function guidePathOf(pluginFolder: string, lang: string): string {
  return guideDirOf(pluginFolder) + "/" + lang + ".md";
}

/** Имя языка из свойства. Сломанный frontmatter оставляет перевод без подписи, но не прячет (Я1). */
export function guideLanguageName(text: string, lang: string): string {
  const src = String(text || "").replace(/\r\n?/g, "\n");
  if (!src.startsWith("---\n")) return lang;
  const end = src.indexOf("\n---", 3);
  if (end < 0) return lang;
  const head = src.slice(4, end);
  for (const line of head.split("\n")) {
    const at = line.indexOf(":");
    if (at < 0) continue;
    if (line.slice(0, at).trim() !== GUIDE_LANG_PROP) continue;
    const said = line.slice(at + 1).trim().replace(/^["']|["']$/g, "");
    if (said) return said;
  }
  return lang;
}

/** Образец с шапкой для копирования: свойство стоит в самом образце, готовым местом для правки. */
export function guideFile(text: string): string {
  return [
    "---",
    GUIDE_LANG_PROP + ": English",
    "---",
    "",
    /* Комментарий Obsidian: `%%` на своих строках. `guideBody` снимает построчно — в тексте тоже бывает `%%`. */
    "%%",
    "Copy this file next to itself under a language name (ru.md, de.md), then",
    "change `" + GUIDE_LANG_PROP + "` above and translate the text below.",
    "",
    "Your copy is yours: the plugin never rewrites it and never reads it back.",
    "This file, " + GUIDE_DEFAULT + ".md, belongs to the plugin and stays current.",
    "%%",
    "",
    String(text || "").replace(/\r\n?/g, "\n").replace(/\n+$/, ""),
    "",
  ].join("\n");
}

/** Тело без служебной шапки — для заметки vault. Построчно: в примерах разметки бывают `---` и `%%`. */
export function guideBody(file: string): string {
  const lines = String(file || "").replace(/\r\n?/g, "\n").split("\n");
  let at = 0;

  /* Frontmatter: только если он с самой первой строки. */
  if (lines[0] === "---") {
    let end = -1;
    for (let i = 1; i < lines.length; i++) if (lines[i] === "---") { end = i; break; }
    if (end > 0) at = end + 1;
  }
  while (at < lines.length && lines[at]?.trim() === "") at++;

  /* Подсказка про копирование — не для заметки человека. */
  if (lines[at]?.trim() === "%%") {
    let end = -1;
    for (let i = at + 1; i < lines.length; i++) if (lines[i]?.trim() === "%%") { end = i; break; }
    if (end > at) at = end + 1;
  }
  while (at < lines.length && lines[at]?.trim() === "") at++;

  return lines.slice(at).join("\n").replace(/\n+$/, "") + "\n";
}

/**
 * Привести папку руководств в нынешнее состояние; возвращает записанные пути.
 * Пишет только образец при расхождении с кодом; переводы не читает и не трогает (Г-5).
 */
export async function ensureGuideFiles(
  files: GuideFiles,
  pluginFolder: string,
  english: string,
): Promise<readonly string[]> {
  const written: string[] = [];
  if (!files || typeof files.write !== "function") return written;

  const dir = guideDirOf(pluginFolder);
  if (!await Promise.resolve(files.exists(dir)) && typeof files.mkdir === "function") {
    await Promise.resolve(files.mkdir(dir));
  }

  const path = guidePathOf(pluginFolder, GUIDE_DEFAULT);
  const mine = guideFile(english);
  if (await Promise.resolve(files.exists(path))) {
    try {
      const onDisk = String(await Promise.resolve(files.read(path))).replace(/\r\n?/g, "\n");
      if (onDisk === mine) return written;
    } catch (e) {
      console.error("inline-overhaul: образец руководства не прочитался, пишем заново", e);
    }
  }
  await Promise.resolve(files.write(path, mine));
  written.push(path);
  return written;
}

/** Текст на выбранном языке; перевода нет — английский из кода (языки панели и руководства заводятся врозь). */
export async function guideTextFor(
  files: GuideFiles,
  pluginFolder: string,
  lang: string,
  english: string,
): Promise<{ text: string; lang: string; name: string }> {
  const base = { text: english, lang: "en", name: "English" };
  const wanted = String(lang || "").trim();
  if (!wanted || wanted === "en" || !files || typeof files.read !== "function") return base;

  const path = guidePathOf(pluginFolder, wanted);
  try {
    if (!await Promise.resolve(files.exists(path))) return base;
    const file = String(await Promise.resolve(files.read(path)));
    const body = guideBody(file);
    if (!body.trim()) return base;
    return { text: body, lang: wanted, name: guideLanguageName(file, wanted) };
  } catch (e) {
    console.error("inline-overhaul: руководство на языке " + wanted + " не прочиталось", e);
    return base;
  }
}

/**
 * Имя заметки в vault: у каждого языка своя (Г-4). Заметка не перезаписывается
 * (Р-1), и при общем имени перевод молча не появился бы.
 */
export function guideNotePath(basePath: string, lang: string, name: string): string {
  const path = String(basePath || "");
  if (!lang || lang === "en") return path;
  const dot = path.lastIndexOf(".");
  const stem = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : "";
  /* В скобках имя языка, не код; запрещённые в имени файла знаки заменяются (`ru/RU`). */
  const said = String(name || lang).replace(/[\\/:*?"<>|]/g, "-").trim() || lang;
  return stem + " (" + said + ")" + ext;
}
