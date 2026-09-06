"use strict";

/**
 * Идентификаторы и имена команд: одно место на весь плагин (PRD 7.2, T6, T7).
 *
 * **Почему модуль, а не пара функций по месту.** Схему идентификатора собирали
 * трижды: реестр команд, генератор строк Binder и поиск хоткея поля-даты. Из
 * этой тройки уже вырос дефект Б-11 — заметка конфигурации показывала хоткеи
 * полей-дат пустыми, потому что третье место собирало идентификатор иначе, чем
 * первое. Здесь схема одна, и разойтись ей не с чем.
 *
 * **Что меняется в фазе 2 и почему именно в ней.** Р3: ломать совместимость
 * можно, но один раз. Конфиг переезжает на версию 2 и ID команд — в том же
 * релизе, а не в фазе 6. Хоткеи в Obsidian привязаны к ID команды и после
 * переименования перестают работать; миграция конфига этого не покрывает,
 * поэтому плагин один раз показывает уведомление и печатает карту (пункт 8).
 *
 * **Что НЕ переименовывается.** Идентификатор, уже отвечающий T7 —
 * kebab-case без префикса плагина, — остаётся как есть: `toggle-feature-*`,
 * `undo-last-settings-change`, `open-inline-overhaul-settings`. Ломать
 * работающий хоткей ради красоты — это второй разрыв, которого Р3 не даёт.
 * У них меняются только **имена** (T6), а имя к хоткею не привязано.
 *
 * **Имена команд взяты из прототипа** (`docs/prototype/settings_prototype.html`,
 * список `COMMANDS`), потому что прототип нормативен (Р8), а справочник команд
 * 10.5 показывает ровно эти строки. Руками их здесь не придумывают: если имя
 * должно измениться, правится прототип.
 */

/**
 * kebab-case из произвольной подписи.
 *
 * Не латиницей ограничивается намеренно: имя строки Binder человек пишет на
 * своём языке, и выбрасывать его целиком значило бы дать всем таким строкам
 * один и тот же идентификатор `command`.
 */
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
 * Карта переименования: старый идентификатор → новый. Замороженная — она же
 * печатается в `docs/command_ids_v1_v2.md` и попадает в уведомление.
 *
 * Динамических команд здесь нет: их идентификаторы собираются из имён Fields и
 * строк Binder, и правило для них — ниже, в `pkmFieldCommandId` и
 * `binderCommandId`.
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

/**
 * Правила для команд, которых в таблице нет: их идентификатор собирается из
 * имён Fields и строк Binder, а не переводится по карте.
 *
 * Строки живут здесь, а не в уведомлении: карта должна быть в одном месте
 * целиком, иначе печать и документ разойдутся.
 */
const RENAME_RULES = [
  ["inlineOverhaul_Hotkey_<field>_increase", "<field>-next"],
  ["inlineOverhaul_Hotkey_<field>_decrease", "<field>-previous"],
  ["inlineOverhaul_Binder_<name>", "<name>"],
];

/**
 * Имена команд с новыми идентификаторами. Сняты с прототипа.
 *
 * `Open settings` в прототипе нет: команда удаляется в фазе 6 вместе с вызовом
 * `app.setting.open()` (T8, пункт 5 фазы 6). До тех пор она живёт, и имя ей
 * тоже приведено к T6 — иначе в списке команд Obsidian осталась бы одна строка
 * со старым префиксом.
 */
const NAMES = {
  "move-line-up": "Move line up",
  "move-line-down": "Move line down",
  "move-left": "Move left",
  "move-right": "Move right",
  "jump-back": "Jump back",
  "jump-next": "Jump next",
  "move-cursor-left-in-line": "Move cursor left in line",
  "move-cursor-right-in-line": "Move cursor right in line",
  "open-tagwheel-left": "Open TagWheel on the left",
  "open-tagwheel-right": "Open TagWheel on the right",
  "transform-inline-to-note": "Transform inline to note",
  "smart-bracket": "Smart bracket",
  "undo-last-settings-change": "Undo last settings change",
  "open-inline-overhaul-settings": "Open settings",
};

/** Идентификаторы, которые уже отвечают T7 и потому не переименовываются. */
const KEPT = new Set([
  "undo-last-settings-change",
  "open-inline-overhaul-settings",
]);

/** Шаблон идентификатора тумблера модуля: тоже уже kebab-case. */
function featureToggleCommandId(feature) {
  return "toggle-feature-" + kebab(feature);
}

const SMART_BRACKET_COMMAND_ID = "smart-bracket";

/**
 * Идентификаторы, занятые ядром. Строка Binder, названная `Move left`, не
 * должна затенять команду навигации: `binderCommandId` разводит совпадения
 * против этого набора.
 */
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
 * Идентификатор команды поля PKM.
 *
 * Строится из **строгого имени** Field, а не из его ключа Order: строгое имя —
 * то, что человек видит и правит, и именно оно стоит в старом идентификаторе.
 * Совпадения разводятся: `date_due` и `date-due` дают один kebab, и без
 * разводки вторая команда затёрла бы первую.
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

/** Старый идентификатор команды поля PKM: нужен карте переименования. */
function legacyPkmFieldCommandId(strictName, direction) {
  const dir = String(direction || "").trim() === "decrease" ? "decrease" : "increase";
  return "inlineOverhaul_Hotkey_" + String(strictName || "").trim() + "_" + dir;
}

/**
 * Идентификатор строки Binder.
 *
 * Правило то же, что было, только форма другая: kebab вместо
 * `inlineOverhaul_Binder_<Suffix>`. Разводка совпадений осталась —
 * две строки с одним именем не должны делить команду.
 */
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

/**
 * Перевод старого идентификатора в новый. Отдаёт пустую строку для того, чего
 * в карте нет: у динамических команд идентификатор пересобирается из данных, а
 * не переводится по таблице.
 */
function renameCommandId(oldId) {
  const id = String(oldId == null ? "" : oldId).trim();
  if (!id) return "";
  if (RENAMED.has(id)) return RENAMED.get(id);
  if (KEPT.has(id) || /^toggle-feature-/.test(id)) return id;
  return "";
}

/** Имя команды по новому идентификатору. Пусто — значит имя строится из данных. */
function commandName(id) {
  const key = String(id == null ? "" : id).trim();
  return Object.prototype.hasOwnProperty.call(NAMES, key) ? NAMES[key] : "";
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
  legacyPkmFieldCommandId,
  binderCommandId,
  isLegacyCommandId,
  renameCommandId,
  commandName,
  isCompliantCommandId,
};
