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
const DEFAULT_FOLDER = "inlineOverhaul/Backups";

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

/**
 * Листья, которые остаются своими, даже когда их ветка едет в копии целиком
 * (замечание заказчика 2026-09-06).
 *
 * Сегодня он один — путь папки копий. Это **адрес в этом vault**, а не
 * настройка: заметку, которую сейчас восстанавливают, только что прочли из
 * той папки, на которую плагин смотрит **сейчас**. Копия, снятая в другом
 * vault или до переименования плагина, приносила туда чужой путь — и
 * следующее нажатие `Restore a backup` говорило, что папки нет, стоя рядом с
 * собственными копиями человека.
 *
 * То же правило и для сброса: он пишет копию перед тем, как всё унести, и
 * потерять после этого дорогу к ней было бы худшим из состояний.
 */
const DEVICE_LOCAL_LEAVES = ["advanced.backups.folder"];

/**
 * Части копии: вкладка панели — ветка конфига (заказ заказчика 2026-09-06).
 *
 * Список назван тем, что человек видит на экране — вкладками, а не ветками
 * конфига: галочка «Navigation» понятна, галочка «editor» — нет. Соответствие
 * одно к одному и выведено из схемы, а не придумано; расхождение с ней держит
 * пин (У-32): завели настройку в новой ветке — покраснеет здесь.
 *
 * Ветки, которых нет ни у одной вкладки (например `schemaVersion`), ездят в
 * копии всегда: галочки для них нет, и показывать её было бы нечего.
 */
const PARTS = [
  { id: "general", label: "General", branches: ["features", "general"] },
  { id: "keyboard", label: "Keyboard", branches: ["editor"] },
  { id: "navigation", label: "Navigation", branches: ["navigation"] },
  { id: "pkm", label: "Tags & PKM", branches: ["pkm"] },
  { id: "visual", label: "Visual", branches: ["visual"] },
  { id: "transform", label: "Transform", branches: ["transform"] },
  { id: "advanced", label: "Advanced", branches: ["advanced"] },
];

/** Все ветки, у которых есть галочка. */
const PART_BRANCHES = PARTS.reduce(function(acc, part) {
  for (const branch of part.branches) acc[branch] = part.id;
  return acc;
}, {});

/**
 * Объём хоткеев в копии (заказ заказчика 2026-09-06).
 *
 *   - `own`  — только команды плагина. Умолчание и единственный безопасный:
 *     восстановление не имеет права тронуть чужой плагин;
 *   - `all`  — все хоткеи vault. Снимает ту самую защиту, и окно
 *     восстановления обязано сказать об этом прямо;
 *   - `none` — хоткеев в копии нет вовсе.
 */
const HOTKEY_SCOPES = ["own", "all", "none"];
const HOTKEY_SCOPE_DEFAULT = "own";

function normalizeHotkeyScope(value) {
  const raw = String(value === undefined || value === null ? "" : value).trim().toLowerCase();
  return HOTKEY_SCOPES.indexOf(raw) >= 0 ? raw : HOTKEY_SCOPE_DEFAULT;
}

/** Все идентификаторы частей. Порядок тот же, что на полосе вкладок. */
function allPartIds() {
  return PARTS.map(function(part) { return part.id; });
}

/**
 * Список частей из того, что пришло. `null` означает «не сказано», и это
 * не то же, что пустой список: копии до 2026-09-06 частей не называют вовсе, и
 * восстанавливаться они обязаны как раньше — заменой целиком (Б10).
 */
function normalizeParts(value) {
  if (value === undefined || value === null) return null;
  const list = Array.isArray(value)
    ? value
    : String(value).split(",");
  const known = allPartIds();
  const out = [];
  for (const raw of list) {
    const id = String(raw === undefined || raw === null ? "" : raw).trim();
    if (known.indexOf(id) >= 0 && out.indexOf(id) === -1) out.push(id);
  }
  return out;
}

/** Ветки, которые едут в копии при выбранных частях. */
function branchesOf(partIds) {
  const ids = Array.isArray(partIds) ? partIds : allPartIds();
  const out = {};
  for (const part of PARTS) {
    if (ids.indexOf(part.id) === -1) continue;
    for (const branch of part.branches) out[branch] = true;
  }
  return out;
}

/** Подписи выбранных частей — для окна и для текста заметки. */
function partLabels(partIds) {
  const ids = Array.isArray(partIds) ? partIds : allPartIds();
  return PARTS.filter(function(part) { return ids.indexOf(part.id) >= 0; })
    .map(function(part) { return part.label; });
}

/**
 * Что ложится в копию при выбранных частях. Все части — ровно
 * `stripDeviceLocal`, то есть то же, что было до галочек.
 */
function selectParts(cfg, partIds) {
  const wanted = branchesOf(partIds);
  const out = {};
  if (!isObj(cfg)) return out;
  for (const key of Object.keys(cfg)) {
    if (DEVICE_LOCAL.indexOf(key) >= 0) continue;
    if (PART_BRANCHES[key] && !wanted[key]) continue;
    out[key] = cloneJson(cfg[key]);
  }
  return out;
}

/**
 * Нынешнее плюс то, что копия принесла (решение заказчика 2026-09-06).
 *
 * Неотмеченная при сохранении вкладка **остаётся такой, какая сейчас**, а не
 * сбрасывается к заводскому: так одним нажатием не теряется работа, которой
 * в копии и не было. Отмеченная — заменяется целиком, включая случай «в копии
 * такой ветки нет»: копия описывает отмеченную часть целиком.
 *
 * `partIds` равный `null` — копия частей не называет, и восстановление идёт
 * заменой целиком, как шло до 2026-09-06 (Б10).
 */
function mergeParts(current, restored, partIds) {
  if (!Array.isArray(partIds)) return keepDeviceLocal(current, restored);
  const wanted = branchesOf(partIds);
  const out = {};
  if (isObj(current)) {
    for (const key of Object.keys(current)) out[key] = cloneJson(current[key]);
  }
  if (isObj(restored)) {
    for (const key of Object.keys(restored)) {
      if (DEVICE_LOCAL.indexOf(key) >= 0) continue;
      if (PART_BRANCHES[key] && !wanted[key]) continue;
      out[key] = cloneJson(restored[key]);
    }
  }
  for (const branch of Object.keys(wanted)) {
    if (!isObj(restored) || restored[branch] === undefined) delete out[branch];
  }
  return keepLocalLeaves(current, out);
}

/** Комментарий человека одной строкой: переводы строк в шапке недопустимы. */
function normalizeComment(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 300);
}

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
  return keepLocalLeaves(current, out);
}

/** Значение по пути `a.b.c`; `undefined`, если по дороге нет объекта. */
function readLeaf(obj, path) {
  let node = obj;
  for (const step of String(path).split(".")) {
    if (!isObj(node)) return undefined;
    node = node[step];
  }
  return node;
}

/** Записать значение по пути `a.b.c`, заводя объекты по дороге. */
function writeLeaf(obj, path, value) {
  if (!isObj(obj)) return;
  const steps = String(path).split(".");
  const last = steps.pop();
  let node = obj;
  for (const step of steps) {
    if (!isObj(node[step])) node[step] = {};
    node = node[step];
  }
  node[last] = value;
}

/** Убрать значение по пути `a.b.c`. Пустые объекты по дороге не трогаются. */
function deleteLeaf(obj, path) {
  const steps = String(path).split(".");
  const last = steps.pop();
  let node = obj;
  for (const step of steps) {
    if (!isObj(node)) return;
    node = node[step];
  }
  if (isObj(node)) delete node[last];
}

/**
 * Листья `DEVICE_LOCAL_LEAVES` берутся из нынешнего конфига, а не из копии.
 *
 * Пишется поверх уже собранного результата — одним местом на оба пути
 * восстановления (целиком и по галочкам) и на сброс, чтобы правило не
 * разошлось само с собой (У-32).
 */
function keepLocalLeaves(current, next) {
  if (!isObj(next)) return next;
  for (const path of DEVICE_LOCAL_LEAVES) {
    const value = readLeaf(current, path);
    if (value === undefined) deleteLeaf(next, path);
    else writeLeaf(next, path, cloneJson(value));
  }
  return next;
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

/** Подписи частей, которых в копии нет. */
function missingLabels(partIds) {
  const ids = Array.isArray(partIds) ? partIds : allPartIds();
  return PARTS.filter(function(part) { return ids.indexOf(part.id) === -1; })
    .map(function(part) { return part.label; });
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
function hotkeyWords(binding, opts) {
  if (!isObj(binding)) return "";
  const mac = !!(isObj(opts) && opts.mac);
  const named = isObj(opts) && opts.mac !== undefined;
  const mods = Array.isArray(binding.modifiers)
    ? binding.modifiers
      .map((m) => (named ? physicalModifier(m, mac) : String(m || "").trim()))
      .filter(Boolean)
    : [];
  const key = bindingCode(binding);
  const parts = mods.concat(key ? [key] : []);
  return parts.join(" + ");
}

/**
 * Все привязки одной команды одной строкой: `Ctrl + 1, Ctrl + 2`.
 *
 * `opts.mac` задан — модификаторы называются так, как их пишет сам Obsidian
 * на экране `Hotkeys`: `Mod` там не показывается никогда, вместо него стоит
 * `Ctrl` или `Cmd`. Без `opts` строка повторяет то, что лежит в файле, и
 * такой она и уезжает в заметку копии.
 */
function hotkeyListWords(bindings, opts) {
  if (!Array.isArray(bindings)) return "";
  return bindings.map((b) => hotkeyWords(b, opts)).filter(Boolean).join(", ");
}

/**
 * Клавиша привязки так, как её читает сам Obsidian.
 *
 * Форм записи **две**, и вторая молча теряется, если о ней не знать:
 * `{ modifiers, key }` пишет экран `Hotkeys`, а `{ modifiers, code }` умеют
 * писать плагины и старые версии. `bake` в `app.js` 1.13.7 разбирает обе —
 * `key: a.code ? Xw(a.code) : a.key`, — и `Xw` снимает приставку `Key`:
 * `KeyF` это `F`. До 2026-09-06 копия такую привязку выбрасывала на входе
 * (`.filter(b => b.key)`), а сверка конфликтов её не видела.
 */
function bindingCode(binding) {
  if (!isObj(binding)) return "";
  const code = String(binding.code === undefined || binding.code === null ? "" : binding.code).trim();
  if (code) return code.length === 4 && code.indexOf("Key") === 0 ? code.charAt(3) : code;
  return String(binding.key === undefined || binding.key === null ? "" : binding.key).trim();
}

/**
 * `Mod` — это не модификатор, а имя платформенного: Cmd на macOS и Ctrl
 * везде ещё (`compileModifiers` в `app.js`). Экран `Hotkeys` пишет туда `Mod`
 * почти всегда, а умолчание команды ядра бывает записано и словом `Ctrl` —
 * `workspace:next-tab` держит `Ctrl + Tab` именно так. Сравнивать их
 * буквами значит не увидеть конфликта там, где он есть.
 */
function physicalModifier(name, mac) {
  const raw = String(name || "").trim();
  if (raw === "Mod") return mac ? "Meta" : "Ctrl";
  return raw;
}

/**
 * Привязка одной строкой — для сравнения, а не для человека.
 *
 * Модификаторы приводятся к платформенным и сортируются: `Mod+Shift` и
 * `Shift+Mod` — одна комбинация, и человек видит их одинаково. Клавиша
 * берётся обеими формами и в нижнем регистре. Пустая клавиша даёт пустую
 * строку: сравнивать в ней нечего.
 */
function bindingKey(binding, opts) {
  if (!isObj(binding)) return "";
  const mac = !!(isObj(opts) && opts.mac);
  const mods = Array.isArray(binding.modifiers)
    ? binding.modifiers.map((m) => physicalModifier(m, mac).toLowerCase()).filter(Boolean).sort()
    : [];
  const key = bindingCode(binding).toLowerCase();
  if (!key) return "";
  return mods.join("+") + "|" + key;
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
    const kept = bindings.filter(isObj).map((b) => {
      const row = {
        modifiers: Array.isArray(b.modifiers) ? b.modifiers.map((m) => String(m || "")) : [],
        key: String(b.key === undefined || b.key === null ? "" : b.key),
      };
      /* Вторая форма записи сохраняется как есть: `code` сильнее `key` и у
         самого Obsidian, и выбросить его значило бы вернуть не тот хоткей. */
      const code = String(b.code === undefined || b.code === null ? "" : b.code).trim();
      if (code) row.code = code;
      return row;
    }).filter((b) => b.key || b.code);
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
  /* Частей не назвали — значит все: так же, как было до галочек. */
  const parts = normalizeParts(opts.parts) || allPartIds();
  const scope = normalizeHotkeyScope(opts.hotkeyScope);
  const comment = normalizeComment(opts.comment);
  const config = selectParts(opts.config, parts);
  const version = String(opts.pluginVersion || "").trim();
  const when = opts.savedAt instanceof Date ? opts.savedAt : new Date();
  const json = JSON.stringify(config, null, 2);
  const fence = fenceFor(json);
  const hotkeys = scope === "none" ? {} : normalizeHotkeys(opts.hotkeys);
  const hotkeyIds = Object.keys(hotkeys).sort();
  const hotkeysJson = JSON.stringify(hotkeys, null, 2);
  const hotkeysFence = fenceFor(hotkeysJson);
  const lines = [
    "---",
    MARKER + ": 1",
    "saved: " + readable(when),
    "plugin: " + (version || "unknown"),
    /*
     * Состав копии читается **только отсюда** — по той же причине, по какой
     * шапка читается только из frontmatter (Б17): всё, что ниже, человек
     * вправе переписать. Комментарий одной строкой: перевод строки
     * внутри шапки завёл бы в ней чужое свойство.
     */
    "parts: " + parts.join(", "),
    "hotkeys: " + scope,
    ...(comment ? ["note: " + comment] : []),
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
    ...(comment ? [comment, ""] : []),
    "# inlineOverhaul settings backup",
    "",
    "Saved on " + readable(when) + (version ? " from plugin version " + version : "") + ".",
    "Holds " + summaryLine(config) + ".",
    "Tabs inside: " + partLabels(parts).join(", ") + ".",
    ...(missingLabels(parts).length
      ? ["Left out, so restoring keeps what you have there: " + missingLabels(parts).join(", ") + "."]
      : []),
    "",
    "To bring these settings back, open **Settings → inlineOverhaul → Advanced → Backup**",
    "and press `Restore a backup`. Restoring replaces the tabs listed above and leaves the rest alone;",
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
    /*
     * Вторая строка зависит от объёма, и до 2026-09-06 не зависела: копия
     * объёма `all` несёт чужие хоткеи — вот они, четыре команды Obsidian в
     * копии заказчика, — а заметка обещала, что не тронет ничего чужого.
     * Обещание было неверным ровно в том случае, ради которого объём и заведён.
     */
    lines.push(scope === "all"
      ? "This backup was taken with every hotkey in the vault, so restoring puts other commands' keys back too."
      : "Restoring this backup puts them back on the plugin commands and touches nothing else.");
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
  const partsLine = /^parts\s*:\s*(.*)$/m.exec(front);
  const scopeLine = /^hotkeys\s*:\s*(.+)$/m.exec(front);
  const commentLine = /^note\s*:\s*(.+)$/m.exec(front);
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
    /* `null` — копия частей не называет вовсе (снята до 2026-09-06). */
    parts: partsLine ? normalizeParts(partsLine[1]) : null,
    hotkeyScope: scopeLine ? normalizeHotkeyScope(scopeLine[1]) : HOTKEY_SCOPE_DEFAULT,
    comment: commentLine ? normalizeComment(commentLine[1]) : "",
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
  PARTS,
  PART_BRANCHES,
  HOTKEY_SCOPES,
  HOTKEY_SCOPE_DEFAULT,
  normalizeHotkeyScope,
  allPartIds,
  normalizeParts,
  branchesOf,
  partLabels,
  missingLabels,
  selectParts,
  mergeParts,
  normalizeComment,
  SETTINGS_MARK,
  HOTKEYS_MARK,
  NOTES_HEADING,
  NOTES_HINT,
  frontmatter,
  hotkeyWords,
  hotkeyListWords,
  bindingCode,
  bindingKey,
  physicalModifier,
  normalizeHotkeys,
  parseBackupHotkeys,
  DEFAULT_FOLDER,
  DEVICE_LOCAL,
  DEVICE_LOCAL_LEAVES,
  keepLocalLeaves,
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
