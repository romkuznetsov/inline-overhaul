/**
 * Видимые тексты окон и сообщений слоя настроек (10.13.46, K1) — в каталоге,
 * чтобы окна говорили выбранным языком. Стоят рядом со своей кнопкой:
 * `catalogEntries` раскладывает их по имени действия из схемы. Ключ строит
 * одна функция, `dialogKey` (У-82); литерал ключа запрещён пином.
 */

/* ---- тексты: видимые строки английские, точек в конце нет (Р10) -------- */

/**
 * Тексты по владельцу — кнопке, открывающей окно (имя действия из схемы);
 * `shared` — всей панели. Порядок внутри — порядок чтения на экране.
 */
export const DIALOG_TEXTS = {
  "open-howto": {
    GUIDE_MADE: "Guide written and opened",
    GUIDE_OPENED: "Guide opened",
  },

  "save-backup": {
    SAVE_TITLE: "Save a backup",
    SAVE_TIP: "Everything is picked already, so pressing the button straight away saves the lot. Uncheck a tab and it stays out: restoring this backup will then leave that tab exactly as you have it",
    SAVE_COMMENT_LABEL: "What is this backup for",
    SAVE_COMMENT_HINT: "Optional. This line shows up in `Restore a backup`",
    SAVE_PARTS_LABEL: "Choose the tabs you want to back up",
    SAVE_PARTS_TIP: "One box per tab of this plugin. A tab you leave unchecked is not written into this backup at all, and restoring it later leaves that tab exactly as you have it then",
    SAVE_HOTKEYS_LABEL: "Hotkeys to keep",
    SAVE_HOTKEYS_TIP: "`Only this plugin’s commands` is the safe one: restoring can then never take a key away from another plugin. `Every hotkey in this vault` writes other plugins’ keys into the backup as well, and restoring puts them back",
    SAVE_HOTKEYS_OWN: "Only this plugin’s commands",
    SAVE_HOTKEYS_ALL: "Every hotkey in this vault",
    SAVE_HOTKEYS_NONE: "None",
    SAVE_CONFIRM: "Save",
    SAVE_NOTHING: "Nothing was picked, so there is nothing to save",
    BACKUP_SAVED: "Settings saved",
  },

  "restore-backup": {
    /* Окно выбора копии (Б9). */
    PICK_TITLE: "Restore a backup",
    PICK_BODY: "Newest first",
    BACKUP_NONE: "No backups found in",
    /* Окно подтверждения. */
    RESTORE_TITLE: "Restore these settings",
    RESTORE_BODY: "This replaces everything you have set up, on every tab. What you have now is saved as a backup first",
    /** Копия перед записью выключена (C56): не обещать копию, которой не будет. */
    RESTORE_BODY_NO_BACKUP: "This replaces everything you have set up, on every tab, and what you have now is not saved anywhere first",
    /* Выборочная копия (D10). */
    RESTORE_BODY_PARTS: "This replaces the tabs listed below and leaves the others as they are. What you have now is saved as a backup first",
    RESTORE_BODY_PARTS_NO_BACKUP: "This replaces the tabs listed below and leaves the others as they are, and what you have now is not saved anywhere first",
    RESTORE_CONFIRM: "Replace my settings",
    RESTORE_NOTE: "Your open tab and what you have expanded here stay as they are",
    RESTORE_NOTE_OTHERS: "Your open tab and what you have expanded here stay as they are, and so do hotkeys of every other plugin",
    /* Строки списка «что вернётся и что останется». */
    ROW_RESTORING: "Restoring {0}",
    ROW_PARTS_BACK: "Tabs coming back: {0}",
    ROW_PARTS_KEPT: "Staying as you have them now: {0}",
    ROW_HOTKEYS_OWN: "And {0} on the plugin commands",
    ROW_HOTKEYS_VAULT: "And {0} from this vault",
    /* Объём хоткеев в копии — сказать прямо. */
    HOTKEYS_ALL_WARNING: "This backup holds hotkeys of other commands too, Obsidian’s own among them, and restoring puts them back",
    /* Конфликты хоткеев (2026-09-06). */
    CONFLICT_LABEL: "Free up keys other commands are holding",
    CONFLICT_SUB: "Off by default: this is the one thing here that changes settings outside this plugin",
    CONFLICT_HELD: "Held by {0}: {1}",
    /** Конфликтов нет — сказать вслух: молчание неотличимо от «не посмотрел» (У-80). */
    CONFLICT_NONE: "No other command is holding those keys",
    /** Копия `all` сама перезапишет чужие хоткеи — галочки нет, это говорится. */
    CONFLICT_SCOPE_ALL: "This backup sets other commands’ keys itself, so there is nothing to free up separately",
    /** В копии хоткеев нет — тоже ответ. */
    HOTKEYS_NONE_HERE: "No hotkeys in this backup, so the ones you have now stay",
    /** Папка копий остаётся своей — иначе следующее нажатие ищет её не там. */
    FOLDER_KEPT: "Backups stay where they are now",
    /* Чем всё кончилось. */
    RESTORE_DONE: "Settings restored. Restart Obsidian so every part of the plugin picks them up",
    RESTORE_SAME: "That backup matches what you already have",
    /** Хоткеи — отдельно: их ищут не там, где настройки. */
    HOTKEYS_DONE: "back on the plugin commands",
    /** Копия `all` ставит клавиши и чужим командам (H3.4). */
    HOTKEYS_DONE_VAULT: "back in this vault",
    CONFLICT_CLEARED: "taken off other commands",
    /** В копии хоткеи есть, а вернуть их этой сборкой нечем. */
    HOTKEYS_NO_METHOD: "The hotkeys in that backup could not be put back",
    /* Окно после восстановления (2026-09-06). */
    RESTORED_TITLE: "Settings restored",
    RESTORED_BODY: "Everything from that backup is in place. A few parts of the plugin read your settings once, when Obsidian starts, so they still show what you had a minute ago",
    RESTORED_NOTE: "Restart Obsidian to be sure every part matches the backup",
    RESTORED_SAME_BODY: "That backup matches what you already have, so nothing changed",
    /** Настройки совпали, хоткеи — нет: «nothing changed» было бы неправдой (H3.3). */
    RESTORED_HOTKEYS_BODY: "Your settings already match that backup, so only its hotkeys changed",
    RESTORED_CLOSE: "Got it",
  },

  "reset-settings": {
    RESET_TITLE: "Delete all your settings",
    /* Сброс — умолчания без стартового набора Fields (`starter_config.ts`, BUGHUNT S21). */
    RESET_BODY: "Everything you have set up in this plugin goes, on every tab, and the plugin goes back to its own defaults, with no Fields at all. What you have now is saved as a backup first",
    RESET_CONFIRM: "Delete my settings",
    RESET_NOTE: "Your open tab and what you have expanded here stay as they are, and so do hotkeys of every other plugin and the folder your backups are kept in",
    ROW_DELETING: "Deleting {0}",
    ROW_DELETING_HOTKEYS: "And {0} you assigned to plugin commands",
    RESET_DONE: "Settings deleted and back to defaults. Restart Obsidian so every part of the plugin picks them up",
    RESET_NOTHING: "Your settings are already at their defaults",
    HOTKEYS_CLEARED: "cleared",
  },

  shared: {
    /** Метода нет — говорим, а не молчим. */
    NO_METHOD: "This build cannot do that yet",
    CANCEL: "Cancel",
    /** Пустой выбор в списке шаблонов; своё слово, не как у хоткеев. */
    WORD_NONE: "None",
    SAVED_AS: "Backup",
    /** Формы счёта лежат в каталоге, выбирает `plural`: из единственного множественное не собрать. */
    WORD_HOTKEY_ONE: "hotkey",
    WORD_HOTKEY_MANY: "hotkeys",
    WORD_KEY_ONE: "key",
    WORD_KEY_MANY: "keys",
    WORD_FIELD_ONE: "Field",
    WORD_FIELD_MANY: "Fields",
    WORD_VALUE_ONE: "Value",
    WORD_VALUE_MANY: "Values",
    WORD_BINDER_ROW_ONE: "Binder row",
    WORD_BINDER_ROW_MANY: "Binder rows",
    /** Состав копии одной строкой. */
    SUMMARY_LINE: "{0}, {1} and {2}",
    SUMMARY_TWO: "{0} and {1}",
    PLUGIN_VERSION: "plugin {0}",
    /* Каталог текстов сломан — сказать, а не промолчать (Я1). */
    TEXTS_BROKEN: "inlineOverhaul could not read {0}, so it is using English",
    /* Obsidian старше 1.13: честное объяснение вместо пустой панели. */
    NEEDS_UPDATE: "inlineOverhaul settings need Obsidian 1.13 or newer: the panel is built on the declarative settings API",
    NEEDS_UPDATE_HOW: "Update Obsidian, or install an earlier release of the plugin.",
    /* Список шаблонов Transform: пусто — тоже ответ. */
    NO_TEMPLATES: "No templates in",
    NO_TEMPLATE_FOLDER: "Set a Templates folder first",
  },
} as const;

/**
 * Владелец окна: имя действия или `shared`. Из таблицы, а не из `ActionId`:
 * у `open-hotkey` окон нет.
 */
export type DialogOwner = keyof typeof DIALOG_TEXTS;

/**
 * Плоская карта «имя → текст»; её же берут пины. Тип из самих таблиц —
 * опечатка в `ACTION_TEXTS.X` краснеет, а не отдаёт `undefined`.
 */
type FlatTexts =
  & (typeof DIALOG_TEXTS)["open-howto"]
  & (typeof DIALOG_TEXTS)["save-backup"]
  & (typeof DIALOG_TEXTS)["restore-backup"]
  & (typeof DIALOG_TEXTS)["reset-settings"]
  & (typeof DIALOG_TEXTS)["shared"];

export const ACTION_TEXTS: FlatTexts = (() => {
  const out: Record<string, string> = {};
  for (const owner of Object.keys(DIALOG_TEXTS)) {
    const table = DIALOG_TEXTS[owner as DialogOwner] as Readonly<Record<string, string>>;
    for (const [name, text] of Object.entries(table)) out[name] = text;
  }
  return out as unknown as FlatTexts;
})();

/** То же, когда имя приходит строкой (для `say`). */
export const TEXT_BY_NAME: Readonly<Record<string, string>> =
  ACTION_TEXTS as unknown as Readonly<Record<string, string>>;

/** Владелец имени; имена в таблице не повторяются. */
const OWNER_OF: Readonly<Record<string, DialogOwner>> = (() => {
  const out: Record<string, DialogOwner> = {};
  for (const owner of Object.keys(DIALOG_TEXTS)) {
    const table = DIALOG_TEXTS[owner as DialogOwner] as Readonly<Record<string, string>>;
    for (const name of Object.keys(table)) out[name] = owner as DialogOwner;
  }
  return out;
})();

/** Ключ каталога для текста окна. Одна функция на оба конца (У-82). */
export function dialogKey(name: string): string {
  const owner = OWNER_OF[name] || "shared";
  return "dialog." + owner + "." + name.toLowerCase().replace(/_/g, "-");
}

/** Английская ветка каталога для окон одной кнопки — в порядке чтения. */
export function dialogEntries(owner: DialogOwner): ReadonlyArray<{ key: string; text: string }> {
  const table = DIALOG_TEXTS[owner] as Readonly<Record<string, string>> | undefined;
  if (!table) return [];
  return Object.entries(table).map(([name, text]) => ({ key: dialogKey(name), text }));
}

/** Подставить значения в `{0}`, `{1}`: порядок слов в переводе свой. */
export function fill(text: string, ...args: readonly (string | number)[]): string {
  return String(text).replace(/\{(\d+)\}/g, (whole, n) => {
    const value = args[Number(n)];
    return value === undefined ? whole : String(value);
  });
}
