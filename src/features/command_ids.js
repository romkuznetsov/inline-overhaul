"use strict";

/**
 * Идентификаторы и имена команд: одно место на плагин (PRD 7.2, T6, T7, Б-11).
 *
 * Р3: один разрыв совместимости — ID сменились вместе с конфигом v2; хоткеи
 * привязаны к ID, поэтому один раз уведомление с картой (пункт 8). ID, уже
 * отвечающий T7, не переименовывается. Имена — из `COMMANDS` прототипа (Р8):
 * правится прототип, не этот файл.
 */

/** kebab-case из подписи; не только латиница — имена Binder бывают на любом языке. */
function kebab(value) {
  const src = String(value == null ? "" : value).trim().toLowerCase();
  if (!src) return "";
  const cleaned = src
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned;
}

/**
 * Старый ID → новый, заморожена: печатается в `docs/COMMAND_IDS_V1_V2.md` и
 * уведомлении. Динамические — `pkmFieldCommandId`, `binderCommandId`.
 */
const RENAMED = new Map([
  ["inlineOverhaul_Navigation_MoveUp", "move-line-up"],
  ["inlineOverhaul_Navigation_MoveDown", "move-line-down"],
  ["inlineOverhaul_Navigation_MoveLeft", "move-left"],
  ["inlineOverhaul_Navigation_MoveRight", "move-right"],
  ["inlineOverhaul_Navigation_JumpHeaderUp", "jump-back"],
  ["inlineOverhaul_Navigation_JumpHeaderDown", "jump-next"],
  ["inlineOverhaul_Navigation_InlineLeft", "move-cursor-left-in-line"],
  ["inlineOverhaul_Navigation_InlineRight", "move-cursor-right-in-line"],
  ["inlineOverhaul_Hotkey_tagwheel_left", "open-tagwheel-left"],
  ["inlineOverhaul_Hotkey_tagwheel_right", "open-tagwheel-right"],
  ["inlineOverhaul_Transform_inline2note", "transform-inline-to-note"],
  ["inlineOverhaul_Binder_Smart_bracket", "smart-bracket"],
]);

/** Правила для динамических команд — здесь, чтобы карта была в одном месте. */
const RENAME_RULES = [
  ["inlineOverhaul_Hotkey_<field>_increase", "<field>-next"],
  ["inlineOverhaul_Hotkey_<field>_decrease", "<field>-previous"],
  ["inlineOverhaul_Binder_<name>", "<name>"],
];

/** Имена команд (с прототипа) — ровно то, что плагин регистрирует (T8, У-71). */
const NAMES = {
  "move-line-up": "Move up",
  "move-line-down": "Move down",
  "move-left": "Move left",
  "move-right": "Move right",
  "jump-back": "Jump up",
  "jump-next": "Jump down",
  "move-cursor-left-in-line": "Jump left",
  "move-cursor-right-in-line": "Jump right",
  "open-tagwheel-left": "tagWheel Left",
  "open-tagwheel-right": "tagWheel Right",
  "transform-inline-to-note": "Transform inline to note",
  "smart-bracket": "Smart bracket",
  "undo-last-settings-change": "Undo last settings change",
};

/** Идентификаторы, которые уже отвечают T7 и потому не переименовываются. */
const KEPT = new Set([
  "undo-last-settings-change",
]);

/** Шаблон идентификатора тумблера модуля: тоже уже kebab-case. */
function featureToggleCommandId(feature) {
  return "toggle-feature-" + kebab(feature);
}

const SMART_BRACKET_COMMAND_ID = "smart-bracket";

/** ID ядра: `binderCommandId` разводит против них, чтобы Binder не затенял ядро. */
function reservedCommandIds(featureOrder) {
  const out = new Set(RENAMED.values());
  for (const id of KEPT) out.add(id);
  for (const feature of Array.isArray(featureOrder) ? featureOrder : []) {
    out.add(featureToggleCommandId(feature));
  }
  return out;
}

/** Направление в имени команды поля: словами прототипа, а не движка. */
function directionLabel(direction) {
  return String(direction || "").trim() === "decrease" ? "previous" : "next";
}

/**
 * ID команды поля PKM — из строгого имени Field, не ключа Order. Совпадения
 * kebab (`date_due`/`date-due`) разводятся номером.
 */
function pkmFieldCommandId(strictName, direction, used) {
  const base = kebab(strictName) || "field";
  const suffix = directionLabel(direction);
  const usedSet = used instanceof Set ? used : new Set();
  let candidate = base + "-" + suffix;
  let i = 2;
  while (usedSet.has(candidate)) {
    candidate = base + "-" + i + "-" + suffix;
    i += 1;
  }
  usedSet.add(candidate);
  return candidate;
}


/** ID строки Binder: kebab, совпадения разводятся номером. */
function binderCommandId(seedText, used) {
  const base = kebab(seedText) || "insert";
  const usedSet = used instanceof Set ? used : new Set();
  let candidate = base;
  let i = 2;
  while (usedSet.has(candidate)) {
    candidate = base + "-" + i;
    i += 1;
  }
  usedSet.add(candidate);
  return candidate;
}

/** Идентификатор старой формы: с ним нельзя работать, его надо перевести. */
function isLegacyCommandId(id) {
  return /^inlineOverhaul_/.test(String(id == null ? "" : id));
}

/** Старый ID → новый; пусто — динамическая команда, ID пересобирается из данных. */
function renameCommandId(oldId) {
  const id = String(oldId == null ? "" : oldId).trim();
  if (!id) return "";
  if (RENAMED.has(id)) return RENAMED.get(id);
  if (KEPT.has(id) || /^toggle-feature-/.test(id)) return id;
  return "";
}

/** Команда custom block (10.13.260): по неизменному `id` — хоткей переживает переименование. */
const CUSTOM_BLOCK_COMMAND_PREFIX = "open-tagwheel-custom-";
function customBlockCommandId(blockId) {
  return CUSTOM_BLOCK_COMMAND_PREFIX + kebab(blockId);
}

/**
 * Из каких Field и с каким строгим именем растут команды PKM — одно объявление
 * для реестра и разводки Binder (У-32). Порядок: Left, Right, остальные, дочерние
 * из `active` (имя родителя + `-sub`, У-7); `buildPkmCommandDefs` раздаёт ID в
 * этом же порядке.
 */
function pkmCommandSeeds(order) {
  const o = order && typeof order === "object" ? order : {};
  const keys = [];
  const push = (k) => {
    const key = String(k || "").trim();
    if (key && !keys.includes(key)) keys.push(key);
  };
  for (const k of o.left || []) push(k);
  for (const k of o.right || []) push(k);
  for (const k of Object.keys(o.strictNames || {})) push(k);
  for (const k of Object.keys(o.active || {})) if (/_sub$/.test(String(k || "").trim())) push(k);
  const strictOf = (key) => String(o.strictNames && o.strictNames[key] || "").trim() || key;
  return keys.map((key) => ({
    key,
    strict: /_sub$/.test(key) ? strictOf(key.slice(0, -4)) + "-sub" : strictOf(key),
  }));
}

/**
 * Все ID команд, кроме Binder: ядро, пары Field, custom block — против них
 * разводится Binder (BUGHUNT K1).
 */
function pkmCommandIdSet(order, featureOrder) {
  const used = reservedCommandIds(featureOrder);
  for (const s of pkmCommandSeeds(order)) {
    pkmFieldCommandId(s.strict, "increase", used);
    pkmFieldCommandId(s.strict, "decrease", used);
  }
  for (const b of (order && Array.isArray(order.custom) ? order.custom : [])) {
    if (b && b.id) used.add(customBlockCommandId(b.id));
  }
  return used;
}

/** Имя команды по новому идентификатору. Пусто — значит имя строится из данных. */
function commandName(id) {
  const key = String(id == null ? "" : id).trim();
  return Object.prototype.hasOwnProperty.call(NAMES, key) ? NAMES[key] : "";
}

/**
 * Видимое имя: `Navigation: Move line up` (отмена T6, 2026-09-20). Экран
 * `Hotkeys` отбирает только по словам имени/ID (`app.js` 1.13.7), и область —
 * общее слово для отбора. Одно объявление на регистрацию и справочник (У-240).
 */
function commandDisplayName(area, name) {
  const head = String(area == null ? "" : area).trim();
  const tail = String(name == null ? "" : name).trim();
  if (!tail) return "";
  if (!head) return tail;
  /* Имя Binder приходит уже с областью. */
  return tail.startsWith(head + ": ") ? tail : head + ": " + tail;
}

/**
 * Имя без области — для колонки под заголовком области (2026-09-22). Настоящее
 * имя остаётся полным (У-240). Обратна `commandDisplayName` (У-157).
 */
function commandShortName(area, name) {
  const head = String(area == null ? "" : area).trim();
  const tail = String(name == null ? "" : name).trim();
  if (!head || !tail) return tail;
  return tail.startsWith(head + ": ") ? tail.slice(head.length + 2) : tail;
}

/** Признак T7: kebab-case, без префикса плагина, без двоеточия. */
function isCompliantCommandId(id) {
  return /^[\p{Ll}\p{N}]+(-[\p{Ll}\p{N}]+)*$/u.test(String(id == null ? "" : id));
}

module.exports = {
  kebab,
  RENAMED,
  RENAME_RULES,
  NAMES,
  KEPT,
  SMART_BRACKET_COMMAND_ID,
  featureToggleCommandId,
  reservedCommandIds,
  directionLabel,
  pkmFieldCommandId,
  CUSTOM_BLOCK_COMMAND_PREFIX,
  customBlockCommandId,
  pkmCommandSeeds,
  pkmCommandIdSet,
  binderCommandId,
  isLegacyCommandId,
  renameCommandId,
  commandName,
  commandDisplayName,
  commandShortName,
  isCompliantCommandId,
};
