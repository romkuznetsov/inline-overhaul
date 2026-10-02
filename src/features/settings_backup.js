"use strict";

const __sharedUtils = require("../core/shared_utils.js");
const __configNormalize = require("../core/config_normalize.js");

/**
 * Копия настроек — заметка vault, а не служебный файл (PRD 10.13.2). Только
 * текст: ни `obsidian`, ни DOM, файл — швом из `actions.ts`. Заметка, а не
 * `.json`: видна в проводнике и синхронизируется Sync по умолчанию (Б1).
 */

const MARKER = "inline-overhaul-backup";
const DEFAULT_FOLDER = "inlineOverhaul/Backups";

/**
 * Метка перед блоком настроек: в разделе человека может быть свой json-забор,
 * метка говорит разбору, какой наш (Б17).
 */
const SETTINGS_MARK = "<!-- " + MARKER + ": settings below, do not edit by hand -->";

/** Заголовок раздела человека и подсказка под ним. */
const NOTES_HEADING = "# Your notes";
/* Заголовок раздела «что изменилось» (З-11). Читает его человек, плагин — нет. */
const CHANGED_HEADING = "# What changed";

/**
 * Строка списка «что изменилось» со своим отступом (вложенные контролы — `S8`).
 * Знак списка — после отступа, иначе Obsidian не прочтёт вложенность.
 */
function changedLine(line) {
  const text = String(line == null ? "" : line);
  const indent = (/^\t*/.exec(text) || [""])[0];
  return indent + "- " + text.slice(indent.length);
}
const NOTES_HINT = "Write anything here";

/**
 * Метка блока хоткеев: они в `hotkeys.json` Obsidian, не в `data.json`, —
 * отдельным блоком, чтобы восстановление не писало их в конфиг. Стоит после
 * блока настроек: без метки разбор берёт последний забор (`fencedJson`).
 */
const HOTKEYS_MARK = "<!-- " + MARKER + ": hotkeys below, do not edit by hand -->";

/**
 * Ветки состояния устройства: в копию не попадают, при восстановлении остаются
 * свои (Б4) — иначе едут открытая вкладка и показанные уведомления.
 */
const DEVICE_LOCAL = ["viewState", "backups", "meta", "_unmigrated"];

/**
 * Листья, которые остаются своими, даже когда ветка едет целиком (10.13.44,
 * 2026-09-06). Путь папки копий — адрес в этом vault, не настройка; так же и
 * при сбросе, иначе теряется дорога к только что снятой копии.
 */
const DEVICE_LOCAL_LEAVES = ["advanced.backups.folder"];

/**
 * Части копии: вкладка панели → ветки конфига (10.13.41, 2026-09-06). Выведено
 * из схемы, расхождение держит пин (У-32). Ветки без вкладки (`schemaVersion`)
 * едут всегда.
 */
const PARTS = [
  { id: "general", label: "General", branches: ["features", "general"] },
  { id: "keyboard", label: "Keyboard", branches: ["editor"] },
  { id: "navigation", label: "Navigation", branches: ["navigation"] },
  /*
   * Три строки `tagWheel behavior` стоят на `Tags & PKM`, а ключи в `visual`
   * (З1, PRD 10.13.260): едут с галочкой той вкладки, где видны (`В-210`).
   * Сверяет пин в `settings_backup_tests.ts`.
   */
  { id: "pkm", label: "Tags & PKM", branches: ["pkm"],
    leaves: ["visual.tagWheel.activeField", "visual.tagWheel.oppositeBlock",
      "visual.tagWheel.edgeMode", "visual.tagWheel.customTab"] },
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
 * Объём хоткеев в копии (2026-09-06):
 *
 *   - `own`  — только команды плагина; умолчание, чужой плагин не трогается;
 *   - `all`  — все хоткеи vault; окно восстановления обязано это сказать;
 *   - `none` — без хоткеев.
 */
const HOTKEY_SCOPES = ["own", "all", "none"];
const HOTKEY_SCOPE_DEFAULT = "own";

function normalizeHotkeyScope(value) {
  const raw = String(value === undefined || value === null ? "" : value).trim().toLowerCase();
  return HOTKEY_SCOPES.indexOf(raw) >= 0 ? raw : HOTKEY_SCOPE_DEFAULT;
}

/** Листья, которые едут не с веткой, а с галочкой своей вкладки. */
function borrowedLeaves() {
  const out = [];
  for (const part of PARTS) {
    for (const path of Array.isArray(part.leaves) ? part.leaves : []) out.push({ path, part: part.id });
  }
  return out;
}

/**
 * Листья чужой ветки по галочке их вкладки: отмеченная — из `onWanted`, нет —
 * из `onUnwanted`. Нет листа — нет и в результате.
 */
function placeBorrowed(out, partIds, onWanted, onUnwanted) {
  const ids = Array.isArray(partIds) ? partIds : allPartIds();
  for (const { path, part } of borrowedLeaves()) {
    const value = readLeaf(ids.indexOf(part) >= 0 ? onWanted : onUnwanted, path);
    if (value === undefined) deleteLeaf(out, path);
    else writeLeaf(out, path, cloneJson(value));
  }
  return out;
}

/** Все идентификаторы частей. Порядок тот же, что на полосе вкладок. */
function allPartIds() {
  return PARTS.map(function(part) { return part.id; });
}

/**
 * Список частей. `null` — «не сказано», не пустой список: копии до
 * 2026-09-06 частей не называют и восстанавливаются целиком (Б10).
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

/** Что ложится в копию при выбранных частях; все части = `stripDeviceLocal`. */
function selectParts(cfg, partIds) {
  const wanted = branchesOf(partIds);
  const out = {};
  if (!isObj(cfg)) return out;
  for (const key of Object.keys(cfg)) {
    if (DEVICE_LOCAL.indexOf(key) >= 0) continue;
    if (PART_BRANCHES[key] && !wanted[key]) continue;
    out[key] = cloneJson(cfg[key]);
  }
  return placeBorrowed(out, partIds, cfg, null);
}

/**
 * Нынешнее плюс принесённое копией (2026-09-06): неотмеченная вкладка остаётся
 * как сейчас, отмеченная заменяется целиком (даже если ветки в копии нет).
 * `partIds === null` — замена целиком (Б10).
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
  return keepLocalLeaves(current, placeBorrowed(out, partIds, restored, current));
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
  /* Дом — `isObj` в `shared_utils.js` (10.13.135). */
  return __sharedUtils.isObj(v);
}

function cloneJson(v) {
  /* Дом — `cloneJson` в `shared_utils.js` (10.13.137). */
  return __sharedUtils.cloneJson(v);
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
 * Снимать ли копию перед восстановлением (Б12, C56); умолчание — да. Сброса
 * (`Delete all my settings`) не касается: там копия — единственный путь назад.
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
 * Восстановленное поверх нынешнего: настройки из копии целиком (Б10), ветки
 * устройства свои. Слияния нет — оно дало бы состояние, которого не было.
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
 * Листья `DEVICE_LOCAL_LEAVES` — из нынешнего конфига. Поверх собранного,
 * одним местом на оба пути восстановления и сброс (У-32).
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
 * Сколько в копии Fields, Values и строк Binder — по файлу, а не по схеме:
 * копию могла написать другая версия.
 */
function summarize(cfg) {
  /* Копия старой версии считается по результату переезда (BUGHUNT 2026-09-30, D2). */
  if (isObj(cfg) && !(Number(cfg.schemaVersion) >= 2)) cfg = __configNormalize.migrateConfig(JSON.parse(JSON.stringify(cfg)));
  const pkm =isObj(cfg) && isObj(cfg.pkm) ? cfg.pkm : {};
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

/**
 * Что говорить из состава: Fields/Values — на `Tags & PKM`, Binder — на
 * `Keyboard`; без этих вкладок «0 Fields» читалось как «сотрёт» (BUGHUNT
 * 2026-09-30, D11). `null` — копия несёт всё.
 */
function summaryPieces(cfg, partIds) {
  const s = summarize(cfg);
  const has = (id) => !Array.isArray(partIds) || partIds.indexOf(id) !== -1;
  const out = [];
  if (has("pkm")) out.push({ n: s.fields, kind: "field" }, { n: s.values, kind: "value" });
  if (has("keyboard")) out.push({ n: s.binderRows, kind: "binder" });
  return out;
}

/** Строка состава для заметки и для окна выбора; пусто — говорить нечего. */
function summaryLine(cfg, partIds) {
  const words = { field: ["Field", "Fields"], value: ["Value", "Values"], binder: ["Binder row", "Binder rows"] };
  const said = summaryPieces(cfg, partIds).map((p) => plural(p.n, words[p.kind][0], words[p.kind][1]));
  return said.length > 1 ? said.slice(0, -1).join(", ") + " and " + said[said.length - 1] : (said[0] || "");
}

/* ---- имя файла --------------------------------------------------------- */

function two(n) {
  return (n < 10 ? "0" : "") + String(n);
}

/**
 * Отметка времени в имени. Секунды — чтобы два сохранения в минуту не
 * затирали друг друга (Б5); существующая копия не переписывается (Б6).
 */
function stamp(date) {
  const d = date instanceof Date ? date : new Date();
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate())
    + " " + two(d.getHours()) + "-" + two(d.getMinutes()) + "-" + two(d.getSeconds());
}

/**
 * Постфикс копии, которую человек не заказывал (перед восстановлением и
 * сбросом, C56) — в имени, его видно в `Restore a backup` и в проводнике.
 */
const AUTO_SUFFIX = " Autogenerated";

function backupPath(folder, date, auto) {
  return String(folder || DEFAULT_FOLDER) + "/Settings " + stamp(date)
    + (auto === true ? AUTO_SUFFIX : "") + ".md";
}

/**
 * Приставка автокопии (З-11). Своя, не `AUTO_SUFFIX`: тот — путь назад от
 * действия человека, различать надо в имени.
 */
const AUTOSAVE_MARK = "_autosave";

/** Автокопии — подпапкой папки копий (10.13.304). */
const AUTOSAVE_FOLDER = "autosave";

function autosaveFolder(cfg) {
  return backupFolder(cfg) + "/" + AUTOSAVE_FOLDER;
}

function autosavePath(folder, date) {
  return String(folder || DEFAULT_FOLDER) + "/Settings " + stamp(date)
    + AUTOSAVE_MARK + ".md";
}

/** Это автокопия? Спрашивается у имени файла — им же она и помечена. */
function isAutosavePath(path) {
  const name = String(path || "").split("/").pop() || "";
  return name.indexOf(AUTOSAVE_MARK) !== -1 && /\.md$/.test(name);
}

/**
 * Какие автокопии снять, чтобы осталось `keep` новых. Порядок — по имени
 * (отметка времени от старшего к младшему), не по времени файла: копирование
 * vault переносит время источника (как У-226).
 */
function pickStaleAutosaves(paths, keep) {
  const limit = Math.max(1, Math.trunc(Number(keep) || 0));
  const mine = (Array.isArray(paths) ? paths : []).filter(isAutosavePath).slice().sort();
  if (mine.length <= limit) return [];
  return mine.slice(0, mine.length - limit);
}

/**
 * Забор длиной по самой длинной цепочке обратных кавычек внутри плюс одна
 * (Б8): в тексте Binder бывает три обратные кавычки.
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
 * Привязка словами (`Ctrl + Alt + 1`) — только для глаз, восстановление читает
 * блок. Форма `hotkeys.json`: массив модификаторов и клавиша.
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
 * Все привязки команды строкой (`Ctrl + 1, Ctrl + 2`). С `opts.mac` — как на
 * экране `Hotkeys` (`Ctrl`/`Cmd` вместо `Mod`); без — как в файле.
 */
function hotkeyListWords(bindings, opts) {
  if (!Array.isArray(bindings)) return "";
  return bindings.map((b) => hotkeyWords(b, opts)).filter(Boolean).join(", ");
}

/**
 * Клавиша привязки так, как её читает Obsidian. Форм две: `{ modifiers, key }`
 * (экран `Hotkeys`) и `{ modifiers, code }` (плагины, старые версии); `bake` в
 * `app.js` 1.13.7: `key: a.code ? Xw(a.code) : a.key`, `Xw` снимает `Key`
 * (`KeyF` = `F`).
 */
function bindingCode(binding) {
  if (!isObj(binding)) return "";
  const code = String(binding.code === undefined || binding.code === null ? "" : binding.code).trim();
  if (code) return code.length === 4 && code.indexOf("Key") === 0 ? code.charAt(3) : code;
  return String(binding.key === undefined || binding.key === null ? "" : binding.key).trim();
}

/**
 * `Mod` — имя платформенного: Cmd на macOS, Ctrl везде ещё (`compileModifiers`
 * в `app.js`). Умолчание ядра бывает словом `Ctrl` (`workspace:next-tab`), и
 * сравнение буквами пропустит конфликт.
 */
function physicalModifier(name, mac) {
  const raw = String(name || "").trim();
  if (raw === "Mod") return mac ? "Meta" : "Ctrl";
  return raw;
}

/**
 * Привязка строкой для сравнения: модификаторы платформенные и
 * отсортированные, клавиша обеими формами в нижнем регистре. Пустая клавиша —
 * пустая строка.
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

/** Хоткеи для заметки: только команды плагина и непустые привязки; ключи — id команд Obsidian. */
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
      /* `code` сохраняется как есть: у Obsidian он сильнее `key`. */
      const code = String(b.code === undefined || b.code === null ? "" : b.code).trim();
      if (code) row.code = code;
      return row;
    }).filter((b) => b.key || b.code);
    /*
     * Пустой массив — «человек снял хоткей по умолчанию»; потеряем — вернётся умолчание.
     */
    out[key] = kept;
  }
  return out;
}

/**
 * Заметка целиком: сверху читаемое глазами, ниже блок настроек (Б7). Свойство
 * `inline-overhaul-backup` в шапке — признак своей заметки.
 */
function buildBackupNote(o) {
  const opts = isObj(o) ? o : {};
  /* Частей не назвали — значит все. */
  const parts = normalizeParts(opts.parts) || allPartIds();
  const scope = normalizeHotkeyScope(opts.hotkeyScope);
  const comment = normalizeComment(opts.comment);
  /* Строки «что изменилось»: список, а не текст — каждая станет пунктом. */
  const details = Array.isArray(opts.details)
    ? opts.details.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
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
     * Состав копии читается только из шапки (Б17): ниже человек вправе
     * переписать. Комментарий одной строкой — перевод строки завёл бы чужое свойство.
     */
    "parts: " + parts.join(", "),
    "hotkeys: " + scope,
    ...(comment ? ["note: " + comment] : []),
    "---",
    "",
    /*
     * Раздел человека первым, для его пометок; плагин его не читает.
     */
    NOTES_HEADING,
    "",
    /*
     * Коллаутом (2026-09-19); разметка Obsidian пишется как есть.
     */
    "> [!note] " + NOTES_HINT,
    "> The plugin never reads this part, so nothing you write here changes what comes back",
    "",
    ...(comment ? [comment, ""] : []),
    /*
     * Раздел «что изменилось» (З-11) — под разделом человека, над блоком
     * настроек. Его отсутствие — «сравнивать не с чем», не «ничего не менялось».
     */
    ...(details.length
      ? [CHANGED_HEADING, "", ...details.map(changedLine), ""]
      : []),
    "# inlineOverhaul settings backup",
    "",
    "Saved on " + readable(when) + (version ? " from plugin version " + version : "") + ".",
    ...(summaryLine(config, parts) ? ["Holds " + summaryLine(config, parts) + "."] : []),
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
   * Раздел хоткеев — только когда они есть: пустой читался бы как «хоткеев не
   * было», а их просто не передали.
   */
  if (hotkeyIds.length) {
    lines.push("# Hotkeys");
    lines.push("");
    lines.push("Hotkeys live in Obsidian, not in the plugin settings, so they are kept here separately.");
    /*
     * Вторая строка зависит от объёма: копия `all` несёт чужие хоткеи, и
     * обещание «чужое не тронет» там неверно (2026-09-06).
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
 * Настройки из текста: заметка с блоком или голый `data.json` (копия переезда
 * `data.backup.v1.json`, Б9, Б13). Чужая заметка отвергается словами (Б16).
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
  /* Ни одной ветки настроек (хоткеи, чужой JSON) — отказ, а не пустое
     восстановление поверх вкладок (ревизия Д-2). */
  if (!Object.keys(parsed).some((k) => PART_BRANCHES[k] || k === "schemaVersion" || k === "configVersion")) throw new Error(NO_SETTINGS);
  return parsed;
}

/**
 * Содержимое блока настроек или `null`. Какой забор наш, если человек написал
 * свой в `Your notes` (Б17):
 *
 *   1. забор сразу за `SETTINGS_MARK`;
 *   2. иначе последний json-забор — плагин кладёт свой последним (так же
 *      читаются копии без метки);
 *   3. иначе блока нет — разбор голого `data.json` (Б13).
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
    /* Забор не закрыт — остаток заметки считается телом. */
    return body.join("\n");
  };

  const markAt = lines.findIndex((line) => String(line).trim() === SETTINGS_MARK);
  if (markAt >= 0) {
    for (let i = markAt + 1; i < lines.length; i++) {
      const body = bodyFrom(i);
      if (body !== null) return body;
    }
  }

  /*
   * Запасной ход ищет только выше раздела хоткеев (ревизия Д-2): метка —
   * HTML-комментарий и теряется при копии из режима чтения, а последним
   * оказывался блок хоткеев.
   */
  const hotkeysAt = lines.findIndex((line) => String(line).trim() === HOTKEYS_MARK || /^#\s+Hotkeys\s*$/.test(String(line)));
  const limit = hotkeysAt >= 0 ? hotkeysAt : lines.length;
  for (let i = limit - 1; i >= 0; i--) {
    const body = bodyFrom(i);
    if (body !== null) return body;
  }
  return null;
}

/**
 * Хоткеи из заметки или `{}`. Только блок за меткой: по порядку заборов не угадать.
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
    /* Подпорченный блок хоткеев не рушит восстановление настроек. */
    return {};
  }
}

/**
 * Что показать про копию в окне выбора (Б9). Никогда не бросает: копию могла
 * написать другая версия или испортить рука.
 */
function describeBackup(text) {
  const raw = String(text === undefined || text === null ? "" : text);
  /*
   * Шапка — только из frontmatter: `plugin: …` в пометках человека подменил бы
   * версию в окне выбора (Б17).
   */
  const front = frontmatter(raw);
  const saved = /^saved\s*:\s*(.+)$/m.exec(front);
  const version = /^plugin\s*:\s*(.+)$/m.exec(front);
  const partsLine = /^parts\s*:\s*(.*)$/m.exec(front);
  const scopeLine = /^hotkeys\s*:\s*(.+)$/m.exec(front);
  const commentLine = /^note\s*:\s*(.+)$/m.exec(front);
  let summary = "";
  try {
    summary = summaryLine(parseBackupNote(raw), partsLine ? normalizeParts(partsLine[1]) : null);
  } catch {
    summary = "";
  }
  return {
    savedAt: saved ? String(saved[1]).trim() : "",
    pluginVersion: version ? String(version[1]).trim() : "",
    summary: summary,
    hotkeys: Object.keys(parseBackupHotkeys(raw)).length,
    /* `null` — копия частей не называет (до 2026-09-06). */
    parts: partsLine ? normalizeParts(partsLine[1]) : null,
    hotkeyScope: scopeLine ? normalizeHotkeyScope(scopeLine[1]) : HOTKEY_SCOPE_DEFAULT,
    comment: commentLine ? normalizeComment(commentLine[1]) : "",
  };
}

/**
 * Текст frontmatter без ограждающих строк или "". Признак копии и шапка —
 * только здесь, ниже человек вправе писать что угодно (Б17).
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
  /* Не закрыт — frontmatter не сложился, шапки нет. */
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
  AUTOSAVE_MARK,
  CHANGED_HEADING,
  changedLine,
  autosavePath,
  autosaveFolder,
  AUTOSAVE_FOLDER,
  isAutosavePath,
  pickStaleAutosaves,
  stripDeviceLocal,
  keepDeviceLocal,
  summarize,
  summaryLine,
  summaryPieces,
  plural,
  stamp,
  backupPath,
  fenceFor,
  buildBackupNote,
  parseBackupNote,
  describeBackup,
  looksLikeBackup,
};
