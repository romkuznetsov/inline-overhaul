/**
 * Видимые сообщения плагина в редакторе (PRD 10.13.50, В-74). Дома в панели у
 * них нет (`main.js`, `pkm_v2/**`, два из трёх под З3), поэтому шов один —
 * `globalThis.__inlineSay` (10.13.50 Ф-2).
 * Английский литерал остаётся на месте вызова вторым аргументом: панели может
 * не быть, и человек должен увидеть текст, а не ключ (контракт `PLAIN`).
 * В каталоге — разделом в конце (10.13.46 Р3). Не сюда: `console.*`, текст
 * `throw`, имена команд (Я2) и адреса `Settings -> inlineOverhaul -> …`.
 */

import type { TextEntry } from "./texts.ts";
import sayModule from "../../core/say.js";

/**
 * Ключ сообщения — одна функция на оба конца (У-82); литерал на месте ключа
 * запрещён пином: расхождение видно только по неприменённому переводу.
 */
export const noticeKey: (area: string, name: string) => string = sayModule.noticeKey;

/**
 * Сообщения по областям — по тому, что видит человек, не по файлу. Порядок:
 * модуль выключен → нечего делать → ошибки. Префикса `InlineOverhaul` нет:
 * источник уведомления Obsidian показывает сам (п. 5 фазы 4).
 */
export const RUNTIME_TEXTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  plugin: {
    "save-failed": "Could not save settings",
    "needs-obsidian": "inlineOverhaul settings need Obsidian 1.13 or newer",
    "nothing-to-undo": "Nothing to undo",
    undone: "Last settings change undone",
    /* `data.json` изменили снаружи и плагин перечитал файл (Р-2): сказать обязательно. */
    "external-reload": "Settings changed on disk, so inlineOverhaul reloaded them",
    /* Автокопия снята (З-11, 2026-09-19). `{0}` — путь заметки. */
    "autosave-saved": "Settings autosaved to {0}",
  },

  navigation: {
    "module-off": "Navigation is switched off: turn it on in General → Modules",
    "runtime-unavailable": "Navigation could not be loaded",
    "no-editor": "Open a note first",
    /* `{0}` — текст ошибки движка; склейка через `+` перевода не переживает. */
    error: "Navigation error: {0}",
  },

  pkm: {
    "module-off": "Tags & PKM is switched off: turn it on in General → Modules",
    "no-editor": "Open a note first",
    /* Пока сессия панели открыта, строкой распоряжается она (вид — в документе). */
    "tagwheel-open": "tagWheel is open on this line: finish it with Enter or close it with Escape first",
    /* Блок кода и таблица — не строка текста (BUGHUNT F8). */
    "code-line": "Tags & PKM does not work in a code block, a table, note properties or a divider line",
    /* `{0}` — строгое имя Field, как в палитре команд. Молча команда не отказывает (У-41). */
    "no-values": "{0} has no Values yet: add them in Tags & PKM → Fields",
    /* Command Field (4.4): `{0}` — `<Field> · <категория>`, как в палитре. */
    "no-presets": "{0} has no visible presets: add them in Tags & PKM → Fields",
    "nothing-to-do": "{0}: nothing to change on this line",
    error: "Tags & PKM error: {0}",
  },

  transform: {
    "module-off": "Transform is switched off: turn it on in General → Modules",
    "no-editor": "Open a note first",
    cancelled: "Transform cancelled",
    "code-line": "Transform does not work in a code block, a table, note properties or a divider line",
    "inline-off": "Inline to note is switched off: turn it on in the Transform tab of the settings",
    "already-note": "This line is already a note: its mark {0} says so",
    created: "Note created: {0}",
    error: "Transform error: {0}",
  },

  tagwheel: {
    "no-app": "tagWheel: no app context",
    /* Была русской строкой — дефект (Р9, 10.13.50 Ф-6). */
    "no-editor": "tagWheel: open a note first",
    /* Правила — из настроек, не из файла (PRD 10.13.52, П-8). Пустой ключ —
     * панель позвана не нашей командой. */
    "rules-missing": "tagWheel: no rules came with the command - open it from the command list or its hotkey",
    "emoji-required": "tagWheel: these Fields need an emoji: {0}. Set it in Settings → inlineOverhaul → Tags & PKM → Fields",
    /* Команда Field custom block пришла, а Field в блоке уже нет (PRD 10.13.260). */
    "custom-no-field": "tagWheel: this Field is not in a custom block any more",
    error: "tagWheel error: {0}",
  },

  rules: {
    /* Правила — из настроек, не из файла (PRD 10.13.52, П-8); `file-missing` и
     * `path-fallback` сняты (У-94). */
    "rules-missing": "No rules came with the command - run it from the command list or its hotkey",
    "config-error": "Rules are not valid after applying the order: {0}",
    "emoji-required": "These Fields need an emoji: {0}. Set it in Settings → inlineOverhaul → Tags & PKM → Fields",
    /* Предусловие Field (10.13.4, Н21). Отказ громкий: молчание читается как поломка. */
    "prerequisite-unmet": "{0} waits for {1}: set it on this line first",
    "navigator-only": "Nothing to step through: every Value of {0} is a navigator for its child Field",
    /* Действие, которого движок не разбирает (10.13.170): приезжает от чужого вызова. */
    "unsupported-action": "This command sent an action this engine no longer handles: {0}",
  },
};

/** Раздел каталога: все сообщения редактора, областями, с пустой строкой перед. */
export function runtimeEntries(): readonly TextEntry[] {
  const out: TextEntry[] = [];
  let first = true;
  for (const [area, messages] of Object.entries(RUNTIME_TEXTS)) {
    let head = true;
    for (const [name, text] of Object.entries(messages)) {
      const entry: TextEntry = { key: noticeKey(area, name), text };
      /* Пустая строка отделяет области и весь раздел от того, что выше. */
      if (first || head) out.push({ ...entry, gap: true });
      else out.push(entry);
      first = false;
      head = false;
    }
  }
  return out;
}
