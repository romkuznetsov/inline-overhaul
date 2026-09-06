/**
 * Видимые тексты окон и сообщений слоя настроек (PRD 10.13.46, замечание
 * заказчика к K1: «проверь автоматически, что этот en.js содержит все
 * текстовые элементы, которые встречаются в настройках — в т.ч. текст
 * модальных окон»).
 *
 * Раньше они лежали константами в `actions.ts` и в каталог не попадали вовсе:
 * панель говорила выбранным языком, а окно `Save a backup` — по-английски. В
 * файле, который человек переводит, их не было ни одной строкой, и увидеть
 * это можно было только открыв окно.
 *
 * **Стоят они рядом со своей кнопкой.** Дом текста — не «раздел окон» в конце
 * файла, а то место, где человек это окно открывает: заголовки `Save a
 * backup` идут сразу за строкой `Settings backup` вкладки `Advanced`.
 * Раскладывает их `catalogEntries` по имени действия — тому же, что стоит у
 * кнопки в схеме.
 *
 * **Ключ строит одна функция** (У-82): `dialogKey`. Литерал на месте ключа
 * запрещён пином — разошлись бы такие молча, и заметно это было бы только
 * тем, что перевод не применился.
 */

/* ---- тексты: видимые строки английские, точек в конце нет (Р10) -------- */

/**
 * Тексты по владельцу. Владелец — это **кнопка**, которая открывает окно, и
 * называется он тем же именем действия, что стоит в схеме; `shared` — то, что
 * принадлежит не одной кнопке, а всей панели.
 *
 * Порядок внутри владельца — порядок чтения на экране: заголовок, подсказка к
 * нему, поля, кнопки, и уже потом строки, которые собираются по ходу.
 */
export const DIALOG_TEXTS = {
  "open-howto": {
    GUIDE_MADE: "Guide written and opened",
    GUIDE_OPENED: "Guide opened",
  },

  "save-backup": {
    SAVE_TITLE: "Save a backup",
    /** Оно же стояло абзацем под заголовком до 2026-09-06 (замечание заказчика). */
    SAVE_TIP: "Everything is picked already, so pressing the button straight away saves the lot. Uncheck a tab and it stays out: restoring this backup will then leave that tab exactly as you have it",
    SAVE_COMMENT_LABEL: "What is this backup for",
    SAVE_COMMENT_HINT: "Optional. You will see this line in `Restore a backup`",
    SAVE_PARTS_LABEL: "Choose modules you want to backup",
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
    /**
     * Тот же вопрос, когда копия перед записью выключена (C56). Обещать копию,
     * которой не будет, нельзя: вопрос о разрушительном действии — единственное
     * место, где человек ещё может остановиться.
     */
    RESTORE_BODY_NO_BACKUP: "This replaces everything you have set up, on every tab, and what you have now is not saved anywhere first",
    RESTORE_CONFIRM: "Replace my settings",
    RESTORE_NOTE: "Your open tab and what you have expanded here stay as they are",
    RESTORE_NOTE_OTHERS: "Your open tab and what you have expanded here stay as they are, and so do hotkeys of every other plugin",
    /* Строки списка «что вернётся и что останется». */
    ROW_RESTORING: "Restoring {0}",
    ROW_PARTS_BACK: "Tabs coming back: {0}",
    ROW_PARTS_KEPT: "Staying as you have them now: {0}",
    ROW_HOTKEYS_OWN: "And {0} on the plugin commands",
    ROW_HOTKEYS_VAULT: "And {0} from this vault",
    /* Объём хоткеев в копии — сказать в окне восстановления прямо. */
    HOTKEYS_ALL_WARNING: "This backup holds hotkeys of other plugins too, and restoring puts them back",
    /* Конфликты хоткеев (ответ заказчика 2026-09-06). */
    CONFLICT_LABEL: "Free up keys other commands are holding",
    CONFLICT_SUB: "Off by default: this is the one thing here that changes settings outside this plugin",
    CONFLICT_HELD: "Held by {0}: {1}",
    /**
     * Конфликтов нет — сказать об этом вслух (замечание заказчика 2026-09-06:
     * «я не увидел этой опции при восстановлении… хотя там были конфликтующие
     * хоткеи»). Молчание неотличимо от «плагин не посмотрел», и разбирать потом
     * приходится по памяти человека, а не по тому, что было на экране (У-80).
     */
    CONFLICT_NONE: "No other command is holding those keys",
    /**
     * Копия объёма `all` несёт чужие хоткеи в себе и сама их и перезапишет —
     * галочки тут не бывает, и это надо сказать, а не оставить пустое место.
     */
    CONFLICT_SCOPE_ALL: "This backup sets other commands’ keys itself, so there is nothing to free up separately",
    /** В копии хоткеев нет вовсе — тоже ответ, и его тоже надо дать. */
    HOTKEYS_NONE_HERE: "No hotkeys in this backup, so the ones you have now stay",
    /** Папка копий остаётся своей — иначе следующее нажатие ищет её не там. */
    FOLDER_KEPT: "Backups stay where they are now",
    /* Чем всё кончилось. */
    RESTORE_DONE: "Settings restored. Restart Obsidian so every part of the plugin picks them up",
    RESTORE_SAME: "That backup matches what you already have",
    /** Хоткеи вернулись — сказать отдельно: их человек ищет не там, где настройки. */
    HOTKEYS_DONE: "hotkeys back on the plugin commands",
    CONFLICT_CLEARED: "keys taken off other commands",
    /** В копии хоткеи есть, а вернуть их этой сборкой нечем. */
    HOTKEYS_NO_METHOD: "The hotkeys in that backup could not be put back",
    /* Окно после восстановления (просьба заказчика 2026-09-06). */
    RESTORED_TITLE: "Settings restored",
    RESTORED_BODY: "Everything from that backup is in place. A few parts of the plugin read your settings once, when Obsidian starts, so they still show what you had a minute ago",
    RESTORED_NOTE: "Restart Obsidian to be sure every part matches the backup",
    RESTORED_CLOSE: "Got it",
  },

  "reset-settings": {
    RESET_TITLE: "Delete all your settings",
    RESET_BODY: "Everything you have set up in this plugin goes, on every tab, and the plugin starts as if it had just been installed. What you have now is saved as a backup first",
    RESET_CONFIRM: "Delete my settings",
    RESET_NOTE: "Your open tab and what you have expanded here stay as they are, and so do hotkeys of every other plugin and the folder your backups are kept in",
    ROW_DELETING: "Deleting {0}",
    ROW_DELETING_HOTKEYS: "And {0} you assigned to plugin commands",
    RESET_DONE: "Settings deleted and back to defaults. Restart Obsidian so every part of the plugin picks them up",
    RESET_NOTHING: "Your settings are already at their defaults",
    HOTKEYS_CLEARED: "cleared",
  },

  shared: {
    /** Метода нет — говорим об этом, а не молчим. */
    NO_METHOD: "This build cannot do that yet",
    CANCEL: "Cancel",
    /** Пустой выбор в списке шаблонов. Своё слово, а не то же, что у хоткеев. */
    WORD_NONE: "None",
    SAVED_AS: "Backup",
    /**
     * Счёт по-английски меняет слово, по-русски — три слова. Обе формы лежат
     * в каталоге, и выбирает между ними `plural`: собрать множественное из
     * единственного нельзя ни в одном языке, кроме английского.
     */
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
    /** Состав копии одной строкой: столько-то Fields, столько-то Values. */
    SUMMARY_LINE: "{0}, {1} and {2}",
    PLUGIN_VERSION: "plugin {0}",
    /* Каталог текстов сломан — сказать, а не промолчать (Я1). */
    TEXTS_BROKEN: "inlineOverhaul could not read {0}, so it is using English",
    /* Панель на Obsidian старше 1.13: пустая панель хуже честного объяснения. */
    NEEDS_UPDATE: "inlineOverhaul settings need Obsidian 1.13 or newer: the pane is built on the declarative settings API.",
    NEEDS_UPDATE_HOW: "Update Obsidian, or install an earlier release of the plugin.",
    /* Список шаблонов Transform: пусто — тоже ответ. */
    NO_TEMPLATES: "No templates in",
    NO_TEMPLATE_FOLDER: "Set a Templates folder first",
  },
} as const;

/**
 * Кому принадлежит окно: имя действия или `shared`.
 *
 * Выводится из самой таблицы, а не из `ActionId`: у `open-hotkey` окон нет
 * вовсе, и объявить владельцем то, чего в таблице не лежит, значило бы завести
 * ключ, который никто не спросит.
 */
export type DialogOwner = keyof typeof DIALOG_TEXTS;

/**
 * Плоская карта «имя → текст». Она же — то, что видят проверки: сверять
 * строку с самой собой бессмысленно, и пин берёт текст отсюда.
 *
 * Тип собран из самих таблиц, а не написан рядом: тогда `ACTION_TEXTS.X`
 * краснеет на опечатке в имени, а не молча отдаёт `undefined`.
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

/** То же самое, когда имя приходит строкой: у `say` его знать неоткуда. */
export const TEXT_BY_NAME: Readonly<Record<string, string>> =
  ACTION_TEXTS as unknown as Readonly<Record<string, string>>;

/** Кто владеет именем. Строится один раз: имена в таблице не повторяются. */
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

/**
 * Подставить значения в `{0}`, `{1}`. Порядок слов в переводе свой, и склейка
 * через `+` его не переживает: по-русски то, что по-английски стоит в конце,
 * встаёт в начало.
 */
export function fill(text: string, ...args: readonly (string | number)[]): string {
  return String(text).replace(/\{(\d+)\}/g, (whole, n) => {
    const value = args[Number(n)];
    return value === undefined ? whole : String(value);
  });
}
