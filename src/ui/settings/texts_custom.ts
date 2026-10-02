/**
 * Ключи видимых текстов своих блоков (PRD 10.13.38). У `kind: "custom"` нет
 * `name`/`desc`: тексты — в `schema/custom_texts.ts`, ключ — путь внутри неё
 * (`callout.general.head`, `commands.0.list.3.does`).
 * Тексты встают в файл там же, где блок на экране (10.13.46, замечание к K1).
 * Имена команд не переводятся (Я2): палитра Obsidian берёт их из реестра команд.
 */

import {
  COMMAND_TEXTS,
  MODULE_OFF_NOTE,
  PREVIEW_EMPTY_RIGHT,
  PREVIEW_EXAMPLE,
  PREVIEW_LINE_TEXT,
  PREVIEW_TEXTS,
  TAB_CALLOUTS,
  type PreviewNode,
} from "./schema/custom_texts.ts";
import type { TextEntry } from "./texts.ts";
import type { SettingDef, SettingsGroup } from "./types.ts";
import { blockTextEntries } from "./texts_blocks.ts";

export function calloutKey(tab: string, slot: "head" | "tip" | "body"): string {
  return "callout." + tab + "." + slot;
}

export function previewKey(id: string, slot: string): string {
  return "preview." + id + "." + slot;
}

export function commandKey(area: number, slot: string): string {
  return "commands." + area + "." + slot;
}

/** Одиночные строки, у которых нет ни группы, ни блока. */
export const SINGLE_KEYS = {
  previewExample: "text.preview-example",
  previewLine: "text.preview-line",
  previewEmptyRight: "text.preview-empty-right",
  moduleOff: "text.module-off",
  calloutTipLabel: "text.callout-tip-label",
  groupReset: "text.group-reset",
  clearField: "text.clear-field",
  defaultOption: "text.default-option",
} as const;

/**
 * Строки без своего места в схеме, по одной на все блоки: `calloutTipLabel`
 * (читает диктор), `groupReset`, `clearField` (В-131), `defaultOption` —
 * приписка у умолчания в выпадающем списке (2026-09-20, п. 13).
 */
export const SHARED_TEXTS: Readonly<Record<string, string>> = {
  [SINGLE_KEYS.previewExample]: PREVIEW_EXAMPLE,
  [SINGLE_KEYS.previewLine]: PREVIEW_LINE_TEXT,
  [SINGLE_KEYS.previewEmptyRight]: PREVIEW_EMPTY_RIGHT,
  [SINGLE_KEYS.moduleOff]: MODULE_OFF_NOTE,
  [SINGLE_KEYS.calloutTipLabel]: "this tab",
  [SINGLE_KEYS.groupReset]: "Reset the group",
  [SINGLE_KEYS.clearField]: "Clear",
  [SINGLE_KEYS.defaultOption]: "(default)",
};

/**
 * Строки самой панели без строки настройки и окна (10.13.46). Ключ — `frameKey`
 * на обоих концах (У-82). Окна кнопок — в `texts_dialogs.ts`.
 */
export const FRAME_TEXTS = {
  /* Сброс группы (Н3, Н5). */
  RESET_TITLE: "Reset {0}",
  RESET_ONE: "One setting in this group goes back to its default",
  RESET_MANY: "{0} settings in this group go back to their defaults",
  RESET_MORE: "and {0} more",
  /* `Name brackets` пишется только двумя разными знаками (C17, `В-264`). */
  NAME_BRACKETS_TWO: "Name brackets takes two different characters, such as [] or (): the brackets stay as they were",
  RESET_CONFIRM: "Reset the group",
  RESET_NOTE: "Your Fields, Values and rules are not touched",
  RESET_DONE: "{0} settings back to default. Use <code>Undo last settings change</code> to revert",
  RESET_TIP_ONE: "Reset group: {0} setting differs from the default",
  RESET_TIP_MANY: "Reset group: {0} settings differ from the default",
  RESET_TIP_CLEAN: "Everything here is already at its default",
  /* «?» у заголовка группы и у строки настройки. */
  MORE_ABOUT: "More about {0}",
  /* Полоса вкладок: её читает вслух программа чтения с экрана. */
  TAB_STRIP: "Settings areas",
  /* `PREVIOUSLY_CALLED` снята 2026-09-08: не рисовалась; прежние имена идут в
   * `aliases` из `searchTerms` (С4, У-71). */
  /* Тихий значок контраста (Н16): число говорит, далеко ли до нормы. */
  CONTRAST_WARNING: "This Value may be hard to read: contrast {0}:1, aim for {1}:1",
  /* Примерные Fields предпросмотра, пока своих нет (ПЗ2). */
  EXAMPLE_STATUS: "Status",
  EXAMPLE_PRIORITY: "Priority",
  /* Значение словами в списке того, что сбрасывается. */
  WORD_ON: "on",
  WORD_OFF: "off",
  WORD_EMPTY: "empty",
  /* Пустые состояния живых предпросмотров. */
  BARS_NEED_FIELD: "Bars need a Field: pick one in <code>Which Field draws Bars</code> above",
  BARS_NO_TAG_FIELD: "Bars are drawn from the colors of a tag Field, and there is no tag Field yet: add one under <code>Tags &amp; PKM</code>",
  BARS_FIELD_GONE: "The Field these Bars were drawn for is gone: pick another one above",
  PREVIEW_LEFT_BLOCK: "Left Block",
  PREVIEW_RIGHT_BLOCK: "Right Block",
  PREVIEW_SEPARATOR_1: "Separator 1",
  PREVIEW_SEPARATOR_2: "Separator 2",
  PREVIEW_EMPTY_VALUE: "empty",
  PREVIEW_BEFORE: "Before",
  PREVIEW_AFTER: "After",
  /* Подсказки половин `Source line` (2026-09-08): «?» в самой подписи, тело под ней. */
  PREVIEW_BEFORE_TIP: "The line as you wrote it, with the Fields you have set up, and two lines indented under it. This half never changes with the settings: it is the starting point the half below is measured against",
  PREVIEW_AFTER_TIP: "The same line once <code>Inline to note</code> has run, with every choice in this block applied: what happens to your text, which Values stay behind, whether a link takes their place, and whether the indented lines travel with it",
  PREVIEW_NO_FIELDS: "no Fields yet — set one up under <code>Tags &amp; PKM</code> and the example fills in",
} as const;

/** Ключ строки панели. Одна функция на оба конца (У-82). */
export function frameKey(name: string): string {
  return "frame." + name.toLowerCase().replace(/_/g, "-");
}

/** То же самое, когда имя приходит строкой. */
export const FRAME_BY_NAME: Readonly<Record<string, string>> =
  FRAME_TEXTS as unknown as Readonly<Record<string, string>>;

function push(out: TextEntry[], key: string, text: unknown, gap?: true): void {
  if (typeof text !== "string" || text === "") return;
  out.push(gap ? { key, text, gap } : { key, text });
}

/** Строки выдуманного дерева предпросмотра: их человек тоже читает. */
function treeEntries(out: TextEntry[], id: string, path: string, nodes: readonly PreviewNode[]): void {
  nodes.forEach((node, i) => {
    const here = path + "." + i;
    push(out, previewKey(id, here + ".text"), node.text);
    if (node.children && node.children.length) treeEntries(out, id, here + ".children", node.children);
  });
}

/** Тексты вводного коллаута вкладки. */
function calloutEntries(out: TextEntry[], tab: string): void {
  const text = TAB_CALLOUTS[tab];
  if (!text) return;
  push(out, calloutKey(tab, "head"), text.head);
  push(out, calloutKey(tab, "tip"), text.tip);
  push(out, calloutKey(tab, "body"), text.body);
}

/** Тексты живого предпросмотра. */
function previewEntries(out: TextEntry[], id: string): void {
  const text = PREVIEW_TEXTS[id];
  if (!text) return;
  push(out, previewKey(id, "cap"), text.cap);
  push(out, previewKey(id, "tip"), text.tip);
  push(out, previewKey(id, "line"), text.line);
  push(out, previewKey(id, "element"), text.element);
  push(out, previewKey(id, "link"), text.link);
  push(out, previewKey(id, "note"), text.note);
  /* Три формы ссылки `Link view` — тоже через каталог (Г25). */
  push(out, previewKey(id, "wikilink"), text.wikilink);
  push(out, previewKey(id, "label"), text.label);
  push(out, previewKey(id, "address"), text.address);
  push(out, previewKey(id, "bare"), text.bare);
  if (text.tree) treeEntries(out, id, "tree", text.tree);
}

/** Справочник команд: области и объяснения. */
function commandEntries(out: TextEntry[]): void {
  COMMAND_TEXTS.forEach((area, i) => {
    push(out, commandKey(i, "area"), area.area);
    if (area.parts) {
      push(out, commandKey(i, "parts.standard"), area.parts.standard);
      push(out, commandKey(i, "parts.user"), area.parts.user);
    }
    /* Имя команды не переводится (Я2) — переводится только объяснение. */
    area.list.forEach((cmd, k) => push(out, commandKey(i, "list." + k + ".does"), cmd.does));
  });
}

/** Тексты строки настройки. Коллаут — по группе, не по id: у `navigation` блок `nav-callout` (У-82). */
export function blockEntries(tab: string, _group: SettingsGroup, it: SettingDef): readonly TextEntry[] {
  const out: TextEntry[] = [];
  const id = it.id;
  if (/-callout$/.test(id)) calloutEntries(out, tab);
  else if (PREVIEW_TEXTS[id]) previewEntries(out, id);
  else if (id === "command-list") commandEntries(out);
  /* Своя вёрстка блока — свои тексты, на месте блока (10.13.47). */
  const own = blockTextEntries(id);
  own.forEach((entry, i) => out.push(i === 0 ? { ...entry, gap: true } : { ...entry }));
  return out;
}

/** Строки, у которых места в схеме нет. Последним разделом. */
export function sharedEntries(): readonly TextEntry[] {
  const out: TextEntry[] = [];
  let first = true;
  for (const [key, text] of Object.entries(SHARED_TEXTS)) {
    push(out, key, text, first ? true : undefined);
    first = false;
  }
  first = true;
  for (const [name, text] of Object.entries(FRAME_BY_NAME)) {
    push(out, frameKey(name), text, first ? true : undefined);
    first = false;
  }
  return out;
}
