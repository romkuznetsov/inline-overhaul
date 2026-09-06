"use strict";

/**
 * Копия настроек: заметка vault, а не служебный файл (PRD 10.13.2).
 *
 * Здесь только чтение и запись текста. Ни `obsidian`, ни DOM, ни файловых
 * операций: сама заметка приходит и уходит швом из `actions.ts`. Поэтому
 * весь разбор проверяется без Obsidian и на настоящих функциях.
 *
 * **Почему заметка, а не `.json`.** Obsidian не показывает посторонние типы
 * файлов в проводнике, а Obsidian Sync переносит их отдельным тумблером,
 * который может быть выключен. Заметка видна, ищется, синхронизируется по
 * умолчанию и пересылается как обычный файл (Б1).
 */

const MARKER = "inline-overhaul-backup";
const DEFAULT_FOLDER = "Inline Overhaul/Backups";

/**
 * Метка перед блоком настроек. Нужна затем, что сверху заметки теперь лежит
 * раздел человека, и он вправе написать там что угодно — включая свой блок
 * с забором и словом json. Метка говорит разбору, какой из заборов наш, и
 * снимает неоднозначность вместо надежды на порядок блоков (Б17).
 */
const SETTINGS_MARK = "<!-- " + MARKER + ": settings below, do not edit by hand -->";

/** Заголовок раздела человека и подсказка под ним. */
const NOTES_HEADING = "# Your notes";
const NOTES_HINT = "Write anything here";

/**
 * Метка блока хоткеев. Хоткеи живут **не** в настройках плагина: Obsidian
 * держит их в своём `hotkeys.json`, и в `data.json` их нет. Поэтому в заметке
 * они отдельным блоком, а не внутри настроек — иначе восстановление записало
 * бы их в конфиг плагина, где им не место.
 *
 * Блок стоит **после** блока настроек, и это важно: разбор настроек при
 * отсутствии метки берёт последний забор в заметке (см. `fencedJson`), а копии
 * прежних версий блока хоткеев не имеют вовсе.
 */
const HOTKEYS_MARK = "<!-- " + MARKER + ": hotkeys below, do not edit by hand -->";

/**
 * Ветки состояния устройства. В копию они не попадают, и при восстановлении
 * остаются свои (Б4): иначе перенос на второй компьютер тащил бы за собой
 * открытую вкладку первого, а показанное один раз уведомление возвращалось бы
 * вместе с настройками.
 */
const DEVICE_LOCAL = ["viewState", "backups", "meta", "_unmigrated"];

/* ---- видимые строки: английские, без точки в конце (Р9, Р10) ----------- */

const NO_SETTINGS = "That note does not hold plugin settings";
const BROKEN = "The settings in that note could not be read";

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

/** Путь папки копий из конфига: без ведущих и хвостовых косых (Б2). */
function backupFolder(cfg) {
  const advanced = isObj(cfg) && isObj(cfg.advanced) ? cfg.advanced : {};
  const backups = isObj(advanced.backups) ? advanced.backups : {};
  const raw = String(backups.folder === undefined ? "" : backups.folder).trim();
  const cleaned = raw.replace(/^[\\/]+/, "").replace(/[\\/]+$/, "").replace(/\\/g, "/");
  return cleaned || DEFAULT_FOLDER;
}

/**
 * Снимать ли копию перед восстановлением (Б12, замечание заказчика C56).
 *
 * До 2026-09-04 копия снималась всегда, и выбора не было. Умолчание осталось
 * прежним — восстановление затирает всё, и путь назад по умолчанию есть, — но
 * тумблер его снимает. Сброса (`Delete all my settings`) это **не** касается:
 * там копия и есть единственный путь назад, и она в тексте так и названа.
 */
function backupBeforeRestore(cfg) {
  const advanced = isObj(cfg) && isObj(cfg.advanced) ? cfg.advanced : {};
  const backups = isObj(advanced.backups) ? advanced.backups : {};
  return backups.beforeRestore === false ? false : true;
}

/** Копия конфига без веток состояния устройства (Б3, Б4). */
function stripDeviceLocal(cfg) {
  const out = {};
  if (!isObj(cfg)) return out;
  for (const key of Object.keys(cfg)) {
    if (DEVICE_LOCAL.indexOf(key) >= 0) continue;
    out[key] = cloneJson(cfg[key]);
  }
  return out;
}

/**
 * Восстановленное поверх нынешнего: настройки берутся из копии целиком (Б10),
 * ветки состояния устройства остаются свои. Слияние настроек не делается
 * намеренно — оно дало бы состояние, которого не было ни в копии, ни на
 * экране.
 */
function keepDeviceLocal(current, restored) {
  const out = stripDeviceLocal(restored);
  if (!isObj(current)) return out;
  for (const key of DEVICE_LOCAL) {
    if (current[key] !== undefined) out[key] = cloneJson(current[key]);
  }
  return out;
}

/* ---- состав копии, коротко и для человека ------------------------------ */

function countValues(map) {
  if (!isObj(map)) return 0;
  let total = 0;
  for (const key of Object.keys(map)) {
    const values = map[key];
    if (Array.isArray(values)) total += values.length;
    else if (isObj(values)) total += Object.keys(values).length;
  }
  return total;
}

/**
 * Сколько в копии Fields, Values и строк Binder. Считается по тому, что в
 * файле лежит, а не по схеме: копию мог написать плагин другой версии.
 */
function summarize(cfg) {
  const pkm = isObj(cfg) && isObj(cfg.pkm) ? cfg.pkm : {};
  const fields = isObj(pkm.fields) ? pkm.fields : {};
  const order = isObj(fields.order) ? fields.order : {};
  const sides = [];
  for (const side of ["left", "right"]) {
    if (Array.isArray(order[side])) for (const id of order[side]) sides.push(String(id));
  }
  const own = sides.filter(id => id && !/_sub$/.test(id));
  const values = countValues(fields.tags) + countValues(fields.links) + countValues(fields.elements);
  const editor = isObj(cfg) && isObj(cfg.editor) ? cfg.editor : {};
  const binder = isObj(editor.binder) && Array.isArray(editor.binder.rows) ? editor.binder.rows.length : 0;
  return { fields: own.length, values: values, binderRows: binder };
}

function plural(n, one, many) {
  return String(n) + " " + (n === 1 ? one : many);
}

/** Строка состава для заметки и для окна выбора. */
function summaryLine(cfg) {
  const s = summarize(cfg);
  return plural(s.fields, "Field", "Fields")
    + ", " + plural(s.values, "Value", "Values")
    + " and " + plural(s.binderRows, "Binder row", "Binder rows");
}

/* ---- имя файла --------------------------------------------------------- */

function two(n) {
  return (n < 10 ? "0" : "") + String(n);
}

/**
 * Отметка времени в имени файла. Секунды здесь не педантизм: два сохранения в
 * одну минуту не должны затирать друг друга (Б5), а сохранение никогда не
 * переписывает существующую копию (Б6).
 */
function stamp(date) {
  const d = date instanceof Date ? date : new Date();
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate())
    + " " + two(d.getHours()) + "-" + two(d.getMinutes()) + "-" + two(d.getSeconds());
}

/**
 * Постфикс имени у копии, которую человек не заказывал.
 *
 * Замечание заказчика C56 от 2026-09-04: копии, снятые плагином сами перед
 * восстановлением и перед сбросом, в списке ничем не отличались от снятых
 * руками. Постфикс стоит в имени файла, потому что именно имя человек видит и
 * в списке `Restore a backup`, и в проводнике vault.
 */
const AUTO_SUFFIX = " Autogenerated";

function backupPath(folder, date, auto) {
  return String(folder || DEFAULT_FOLDER) + "/Settings " + stamp(date)
    + (auto === true ? AUTO_SUFFIX : "") + ".md";
}

/* ---- заметка ----------------------------------------------------------- */

/**
 * Забор длиной по самой длинной цепочке обратных кавычек внутри плюс одна
 * (Б8). Текст строки Binder может содержать три обратные кавычки, и тогда
 * забор из трёх закрылся бы посреди настроек.
 */
function fenceFor(text) {
  let longest = 0;
  const runs = String(text).match(/`+/g);
  if (runs) for (const run of runs) if (run.length > longest) longest = run.length;
  const width = Math.max(3, longest + 1);
  return new Array(width + 1).join("`");
}

function readable(date) {
  const d = date instanceof Date ? date : new Date();
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate())
    + " " + two(d.getHours()) + ":" + two(d.getMinutes());
}

/**
 * Привязка словами: `Ctrl + Alt + 1`. Ровно для того, чтобы человек видел в
 * заметке, что там лежит, — плагин при восстановлении читает блок, а не этот
 * текст. Форма записи повторяет `hotkeys.json`: массив модификаторов и клавиша.
 */
function hotkeyWords(binding) {
  if (!isObj(binding)) return "";
  const mods = Array.isArray(binding.modifiers)
    ? binding.modifiers.map((m) => String(m || "").trim()).filter(Boolean)
    : [];
  const key = String(binding.key === undefined ? "" : binding.key).trim();
  const parts = mods.concat(key ? [key] : []);
  return parts.join(" + ");
}

/** Все привязки одной команды одной строкой: `Ctrl + 1, Ctrl + 2`. */
function hotkeyListWords(bindings) {
  if (!Array.isArray(bindings)) return "";
  return bindings.map(hotkeyWords).filter(Boolean).join(", ");
}

/**
 * Хоткеи в том виде, в каком они лежат в заметке: только команды плагина и
 * только непустые привязки. Ключи — идентификаторы команд Obsidian.
 */
function normalizeHotkeys(map) {
  const out = {};
  if (!isObj(map)) return out;
  for (const id of Object.keys(map)) {
    const key = String(id || "").trim();
    if (!key) continue;
    const bindings = Array.isArray(map[id]) ? map[id] : null;
    if (!bindings) continue;
    const kept = bindings.filter(isObj).map((b) => ({
      modifiers: Array.isArray(b.modifiers) ? b.modifiers.map((m) => String(m || "")) : [],
      key: String(b.key === undefined ? "" : b.key),
    })).filter((b) => b.key);
    /*
     * Пустой массив — это не «нет настройки», а «человек снял хоткей, который
     * плагин ставит по умолчанию». Такой ответ Obsidian тоже хранит, и терять
     * его нельзя: иначе восстановление вернуло бы умолчание.
     */
    out[key] = kept;
  }
  return out;
}

/**
 * Заметка целиком. Сверху то, что читается глазами, ниже — блок с настройками
 * (Б7). Свойство `inline-overhaul-backup` в шапке — признак своей заметки.
 */
function buildBackupNote(o) {
  const opts = isObj(o) ? o : {};
  const config = stripDeviceLocal(opts.config);
  const version = String(opts.pluginVersion || "").trim();
  const when = opts.savedAt instanceof Date ? opts.savedAt : new Date();
  const json = JSON.stringify(config, null, 2);
  const fence = fenceFor(json);
  const hotkeys = normalizeHotkeys(opts.hotkeys);
  const hotkeyIds = Object.keys(hotkeys).sort();
  const hotkeysJson = JSON.stringify(hotkeys, null, 2);
  const hotkeysFence = fenceFor(hotkeysJson);
  const lines = [
    "---",
    MARKER + ": 1",
    "saved: " + readable(when),
    "plugin: " + (version || "unknown"),
    "---",
    "",
    /*
     * Раздел человека идёт первым: он для его пометок — зачем снята эта копия,
     * что в ней особенного, к чему возвращаться. Плагин его не читает и при
     * восстановлении не смотрит вовсе.
     */
    NOTES_HEADING,
    "",
    NOTES_HINT + ". The plugin never reads this part, so nothing you write here changes what comes back",
    "",
    "# Inline Overhaul settings backup",
    "",
    "Saved on " + readable(when) + (version ? " from plugin version " + version : "") + ".",
    "Holds " + summaryLine(config) + ".",
    "",
    "To bring these settings back, open **Settings → Inline Overhaul → Advanced → Settings backup**",
    "and press `Restore a backup`. Restoring replaces everything you have set up now;",
    "whether the plugin saves what you have at that moment before it writes is a toggle there.",
    "",
    "You can move this note to another vault, or send it to yourself on another device.",
    "",
    SETTINGS_MARK,
    "",
    fence + "json",
    json,
    fence,
    "",
  ];

  /*
   * Раздел хоткеев дописывается только когда они есть. Пустого раздела в
   * заметке не бывает: он читался бы как «хоткеев не было», а это неправда —
   * их просто не передали.
   */
  if (hotkeyIds.length) {
    lines.push("# Hotkeys");
    lines.push("");
    lines.push("Hotkeys live in Obsidian, not in the plugin settings, so they are kept here separately.");
    lines.push("Restoring this backup puts them back on the plugin commands and touches nothing else.");
    lines.push("");
    for (const id of hotkeyIds) {
      const words = hotkeyListWords(hotkeys[id]);
      lines.push("- `" + id + "` — " + (words || "no hotkey"));
    }
    lines.push("");
    lines.push(HOTKEYS_MARK);
    lines.push("");
    lines.push(hotkeysFence + "json");
    lines.push(hotkeysJson);
    lines.push(hotkeysFence);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * Настройки из текста. Понимает и заметку с блоком, и голый `data.json` —
 * благодаря этому копия переезда `data.backup.v1.json` читается тем же кодом
 * (Б9, Б13). Чужая заметка отвергается словами, а не исключением без текста
 * (Б16).
 */
function parseBackupNote(text) {
  const raw = String(text === undefined || text === null ? "" : text);
  const inner = fencedJson(raw);
  const source = inner === null ? raw.trim() : inner;
  if (!source) throw new Error(NO_SETTINGS);
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(inner === null ? NO_SETTINGS : BROKEN);
  }
  if (!isObj(parsed)) throw new Error(NO_SETTINGS);
  return parsed;
}

/**
 * Содержимое блока настроек, или `null`, если блока нет.
 *
 * Порядок поиска отвечает на один вопрос: **какой** из заборов наш, если
 * человек написал свой в разделе `Your notes` (Б17).
 *
 *   1. Забор сразу за меткой `SETTINGS_MARK` — так пишет нынешняя версия.
 *   2. Иначе **последний** блок с забором и словом json: плагин всегда кладёт
 *      свой последним, а раздел человека лежит выше. Этим же читается копия,
 *      снятая прежними версиями, где метки ещё не было.
 *   3. Иначе блока нет, и разбор пойдёт по голому `data.json` (Б13).
 */
function fencedJson(text) {
  const lines = String(text).split(/\r?\n/);

  const bodyFrom = (i) => {
    const open = /^(`{3,}|~{3,})\s*json\s*$/.exec(lines[i]);
    if (!open) return null;
    const fence = open[1];
    const closer = new RegExp("^" + fence[0] + "{" + fence.length + ",}" + "\\s*$");
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (closer.test(lines[j])) return body.join("\n");
      body.push(lines[j]);
    }
    /* Забор открыт и не закрыт: считаем остаток заметки телом блока. */
    return body.join("\n");
  };

  const markAt = lines.findIndex((line) => String(line).trim() === SETTINGS_MARK);
  if (markAt >= 0) {
    for (let i = markAt + 1; i < lines.length; i++) {
      const body = bodyFrom(i);
      if (body !== null) return body;
    }
  }

  for (let i = lines.length - 1; i >= 0; i--) {
    const body = bodyFrom(i);
    if (body !== null) return body;
  }
  return null;
}

/**
 * Хоткеи из заметки, или пустой объект, если их там нет.
 *
 * Ищется **только** блок за меткой: угадывать блок хоткеев по порядку заборов
 * нельзя — в заметке их теперь два, и второй принадлежит настройкам.
 */
function parseBackupHotkeys(text) {
  const raw = String(text === undefined || text === null ? "" : text);
  const lines = raw.split(/\r?\n/);
  const markAt = lines.findIndex((line) => String(line).trim() === HOTKEYS_MARK);
  if (markAt < 0) return {};
  const tail = lines.slice(markAt + 1).join("\n");
  const inner = fencedJson(tail);
  if (inner === null) return {};
  try {
    return normalizeHotkeys(JSON.parse(inner));
  } catch {
    /* Подпорченный блок хоткеев не должен рушить восстановление настроек. */
    return {};
  }
}

/**
 * Что показать про копию в окне выбора: когда снята, чем снята, что внутри
 * (Б9). Никогда не бросает: копия могла быть написана другой версией плагина
 * или подпорчена руками, и это не повод не показать строку.
 */
function describeBackup(text) {
  const raw = String(text === undefined || text === null ? "" : text);
  /*
   * Шапка читается **только** из frontmatter. Раньше `saved:` и `plugin:`
   * искались по всей заметке, а теперь сверху лежит раздел человека: строка
   * `plugin: тот, что глючит` в его пометках подменила бы версию в окне
   * выбора (Б17).
   */
  const front = frontmatter(raw);
  const saved = /^saved\s*:\s*(.+)$/m.exec(front);
  const version = /^plugin\s*:\s*(.+)$/m.exec(front);
  let summary = "";
  try {
    summary = summaryLine(parseBackupNote(raw));
  } catch {
    summary = "";
  }
  return {
    savedAt: saved ? String(saved[1]).trim() : "",
    pluginVersion: version ? String(version[1]).trim() : "",
    summary: summary,
    hotkeys: Object.keys(parseBackupHotkeys(raw)).length,
  };
}

/**
 * Текст frontmatter, без ограждающих строк. Пустая строка, если его нет.
 *
 * Признак копии и её шапка живут только здесь: всё, что ниже, человек вправе
 * переписать своими словами, и подделать этим шапку он не должен (Б17).
 */
function frontmatter(text) {
  const raw = String(text === undefined || text === null ? "" : text);
  const lines = raw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && String(lines[i]).trim() === "") i++;
  if (String(lines[i] || "").trim() !== "---") return "";
  const body = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (String(lines[j]).trim() === "---") return body.join("\n");
    body.push(lines[j]);
  }
  /* Открыт и не закрыт — значит frontmatter не сложился, шапки нет. */
  return "";
}

/** Похожа ли заметка на нашу копию — по признаку в её frontmatter. */
function looksLikeBackup(text) {
  return new RegExp("^" + MARKER + "\\" + "s*:", "m").test(frontmatter(text));
}

module.exports = {
  MARKER,
  SETTINGS_MARK,
  HOTKEYS_MARK,
  NOTES_HEADING,
  NOTES_HINT,
  frontmatter,
  hotkeyWords,
  hotkeyListWords,
  normalizeHotkeys,
  parseBackupHotkeys,
  DEFAULT_FOLDER,
  DEVICE_LOCAL,
  NO_SETTINGS,
  BROKEN,
  backupFolder,
  backupBeforeRestore,
  AUTO_SUFFIX,
  stripDeviceLocal,
  keepDeviceLocal,
  summarize,
  summaryLine,
  plural,
  stamp,
  backupPath,
  fenceFor,
  buildBackupNote,
  parseBackupNote,
  describeBackup,
  looksLikeBackup,
};
