/**
 * Механизм перевода заметки-руководства (PRD 10.13.51, ответ на В-73).
 *
 * Заказано **не «перевести», а «сделать так, чтобы перевести мог он»**: «был
 * основной default файл гайда (en), который я бы мог копировать, изменить
 * какое-то свойство и перевести». Поэтому здесь нет ни одной переведённой
 * строки — только уклад, по которому перевод появляется.
 *
 * **Уклад тот же, что у каталога панели** (10.13.46, 10.13.48), и общее в них
 * главное: у текста один дом, плагин держит нынешним свой файл и не трогает
 * копию человека (У-83). Разошлись формы, а не правило.
 *
 * | Что | Кто ведёт | Что делает плагин |
 * |---|---|---|
 * | `guide/default.md` | плагин | переписывает при расхождении с текстом в коде |
 * | `guide/<язык>.md` | человек | не трогает никогда |
 * | заметка в vault | человек | создаёт один раз, дальше только открывает (Р-1) |
 *
 * **Почему правило про перевод здесь строже, чем у каталога.** У каталога есть
 * «файл, слово в слово равный написанному плагином, — всё ещё его»: ключи
 * сравнимы, и отставший файл можно догнать без потерь. У прозы такого
 * сравнения нет — абзац переведён, и какой именно, машине не видно. Поэтому
 * проверки «тронут ли» тут нет вовсе: **любой файл перевода человеческий с
 * момента появления.**
 */

/** Папка руководств внутри папки плагина. Своя, а не `texts/`: разбор — Г-2. */
export const GUIDE_DIR = "guide";

/** Имя образца. То же слово, что у каталога: его копируют, чтобы завести язык. */
export const GUIDE_DEFAULT = "default";

/**
 * Свойство, которым человек подписывает свой перевод.
 *
 * Obsidian называет ключи frontmatter ровно тем словом, которым назвал их
 * заказчик, — свойство. У каталога ту же работу делает первая строка
 * `"$language"`; здесь она была бы чужеродной, а frontmatter в Markdown уже
 * есть и уже понятен.
 */
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

/**
 * Имя языка из свойства заметки.
 *
 * **Сломанный frontmatter не прячет перевод целиком** — он лишь оставляет его
 * без подписи. Человек правит эти файлы руками, и «я перевёл, а плагин делает
 * вид, что файла нет» — худший из возможных ответов на его работу (то же
 * правило, что у сломанного файла каталога, Я1).
 */
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

/**
 * Образец с шапкой: то, что человек копирует.
 *
 * Свойство стоит **в самом образце**, а не объясняется в комментарии рядом:
 * копируя файл, человек получает готовое место, которое надо поправить, и ему
 * не нужно знать, как это место называется по-нашему.
 */
export function guideFile(text: string): string {
  return [
    "---",
    GUIDE_LANG_PROP + ": English",
    "---",
    "",
    /* Комментарий Obsidian: два `%%` на своих строках, между ними что угодно.
       Так его и снимает `guideBody` — по строкам, а не по первой паре
       разделителей: внутри текста тоже бывает `%%`. */
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

/**
 * Тело руководства без служебной шапки — то, что уходит в заметку vault.
 *
 * Снимается **построчно**, а не первой парой разделителей: в тексте
 * руководства есть примеры разметки, и наткнуться там на `---` или `%%`
 * проще, чем кажется.
 */
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

  /* Наша подсказка про копирование. В заметке человека ей не место. */
  if (lines[at]?.trim() === "%%") {
    let end = -1;
    for (let i = at + 1; i < lines.length; i++) if (lines[i]?.trim() === "%%") { end = i; break; }
    if (end > at) at = end + 1;
  }
  while (at < lines.length && lines[at]?.trim() === "") at++;

  return lines.slice(at).join("\n").replace(/\n+$/, "") + "\n";
}

/**
 * Привести папку руководств в нынешнее состояние. Возвращает записанные пути.
 *
 * Пишет **один** файл и только его — образец, и только когда тот разошёлся с
 * текстом в коде. Переводы не читаются и не трогаются вовсе: читать их незачем
 * (сверять прозу не с чем), а трогать нельзя (Г-5).
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

/**
 * Текст руководства на выбранном языке.
 *
 * Перевода нет — берётся английский из кода. Это не отказ, а работа механизма:
 * язык интерфейса и язык руководства заводятся врозь, и человек, выбравший
 * язык панели, руководство мог ещё не переводить.
 */
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
 * Имя заметки в vault.
 *
 * **У каждого языка своя заметка**, и это единственная развилка постановки,
 * где выбор был неочевиден (Г-4). Заметка принадлежит человеку и не
 * перезаписывается (Р-1). При одном имени на все языки тот, у кого уже лежит
 * английская, после перевода нажал бы `Read` и получил ту же английскую —
 * молча; единственным выходом было бы снести заметку, то есть снести свои
 * пометки. Плагин, который просит об этом, свою же гарантию и обесценивает.
 *
 * Имя с языком в скобках снимает развилку целиком: **создать вторую заметку
 * не значит тронуть первую.**
 */
export function guideNotePath(basePath: string, lang: string, name: string): string {
  const path = String(basePath || "");
  if (!lang || lang === "en") return path;
  const dot = path.lastIndexOf(".");
  const stem = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : "";
  /* Имя языка человек читает, поэтому в скобках стоит оно, а не код. Символы,
     которых в имени файла быть не может, заменяются: имя приходит из файла,
     который правит человек, и `ru/RU` там вполне возможно. */
  const said = String(name || lang).replace(/[\\/:*?"<>|]/g, "-").trim() || lang;
  return stem + " (" + said + ")" + ext;
}
