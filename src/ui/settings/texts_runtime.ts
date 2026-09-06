/**
 * Видимые сообщения плагина в редакторе (PRD 10.13.50, третий кусок каталога).
 *
 * Ответ заказчика на В-74: «если они относятся к настройкам плагина, то должны
 * быть в `default.js`». Это те всплывающие окна, которые человек видит **не в
 * настройках**: модуль выключен, нет активного редактора, не нашёлся файл
 * правил, у Field не задан эмодзи.
 *
 * **Чем этот кусок отличается от первых двух.** Те были переездом текста
 * внутри одного дома: панель и так спрашивала `ctx.t(...)`. Здесь дома нет
 * вовсе — `main.js` и файлы `pkm_v2/**` про панель не знают и знать не должны,
 * а два из трёх ещё и под З3. Поэтому кусок — это шов, и шов один:
 * `globalThis.__inlineSay`, который ставит слой настроек и который зовёт
 * помощник `say` на той стороне. Разбор — 10.13.50 Ф-2.
 *
 * **Английский литерал остаётся на месте вызова**, вторым аргументом. Это не
 * дублирование: панели может не быть вовсе (старый Obsidian, не загрузившийся
 * модуль), и тогда человек обязан увидеть сообщение, а не ключ. Тот же
 * контракт, что у `PLAIN`.
 *
 * **Место в файле каталога — раздел в конце.** Порядок файла — порядок чтения
 * панели (10.13.46 Р3), а этих строк на панели нет: их встречают в редакторе.
 * Разделом в конце лежит ровно то, у чего места в схеме нет.
 *
 * **Чего здесь нет и не будет:**
 *   * `console.log` и `console.error` — это следы для разработчика, а не речь;
 *   * текст `throw new Error(...)` — его человек не видит, он ловится и
 *     превращается в сообщение отсюда;
 *   * имена команд (Я2) и путь к настройкам внутри сообщения: `Settings ->
 *     inlineOverhaul -> …` — адрес, а не текст, и переведённый адрес никуда
 *     не приведёт.
 */

import type { TextEntry } from "./texts.ts";

/**
 * Ключ сообщения. **Строит его одна функция, и зовут её оба конца** (У-82):
 * и эта таблица, и место вызова в рантайме. Литерал на месте ключа запрещён
 * пином — расходятся такие молча, и заметно это только тем, что перевод не
 * применился.
 */
export function noticeKey(area: string, name: string): string {
  return "notice." + area + "." + name;
}

/**
 * Сообщения по областям. Область названа по тому, **что человек видит**, а не
 * по имени файла: `main.js` ему ни о чём не говорит, а `navigation` — говорит.
 *
 * Порядок внутри области — от общего к частному: сначала «модуль выключен»,
 * потом «нечего делать», потом ошибки.
 *
 * **Префикса `InlineOverhaul` здесь нет ни у одного.** Он стоял у двенадцати
 * сообщений и снят вместе с этим переездом: Obsidian показывает источник
 * уведомления сам, а префикс отнимал треть ширины окна у текста, ради
 * которого окно и показано. Тот же довод снял его у сообщений редактора Fields
 * в пункте 5 фазы 4 — он не перестаёт быть верным оттого, что сообщение
 * показано из другого файла.
 */
export const RUNTIME_TEXTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  plugin: {
    "save-failed": "Could not save settings",
    "needs-obsidian": "inlineOverhaul settings need Obsidian 1.13 or newer",
    "rules-updated": "Rules file updated",
    "transform-unavailable": "Transform module could not be loaded",
  },

  navigation: {
    "module-off": "Navigation is switched off",
    "runtime-unavailable": "Navigation could not be loaded",
    "no-editor": "Open a note first",
    /* `{0}` — текст ошибки от движка. Склейка через `+` перевода не переживает:
       по-русски то, что по-английски стоит в конце, встаёт в начало. */
    error: "Navigation error: {0}",
  },

  pkm: {
    "module-off": "Tags & PKM is switched off",
    "no-editor": "Open a note first",
    error: "Tags & PKM error: {0}",
  },

  transform: {
    "module-off": "Transform is switched off",
    error: "Transform error: {0}",
  },

  tagwheel: {
    "no-app": "TagWheel: no app context",
    /*
     * Была русской строкой — `TagWheel: нет активного редактора` — и это был
     * дефект, а не выбор (Р9, 10.13.50 Ф-6). Заметить его мог только тот, кто
     * читает по-русски: всем остальным он показывал бы чужой алфавит.
     */
    "no-editor": "TagWheel: open a note first",
    "rules-missing": "TagWheel: rules file not found: {0}",
    "rules-fallback": "TagWheel: using the rules file at {0}",
    "emoji-required": "TagWheel: these Fields need an emoji: {0}. Set it in Settings -> inlineOverhaul -> Tags & PKM -> Fields",
    error: "TagWheel error: {0}",
  },

  rules: {
    "file-missing": "Rules file not found: {0}",
    "path-fallback": "Using the rules file at {0}",
    "config-error": "Rules are not valid after applying the order: {0}",
    "emoji-required": "These Fields need an emoji: {0}. Set it in Settings -> inlineOverhaul -> Tags & PKM -> Fields",
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
      /* Пустая строка отделяет область от области — и весь раздел от того,
         что стоит выше: человек переводит его как один кусок. */
      if (first || head) out.push({ ...entry, gap: true });
      else out.push(entry);
      first = false;
      head = false;
    }
  }
  return out;
}

/**
 * Английский по ключу — для той стороны шва, где каталога нет.
 *
 * Нужен ровно одному месту: помощнику `say` в рантайме, когда слой настроек не
 * загрузился. Таблица одна, и второй копии английского не заводится (У-32).
 */
export function runtimeEnglish(key: string): string {
  for (const [area, messages] of Object.entries(RUNTIME_TEXTS)) {
    for (const [name, text] of Object.entries(messages)) {
      if (noticeKey(area, name) === key) return text;
    }
  }
  return "";
}
