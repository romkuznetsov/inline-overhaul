/**
 * Ключи видимых текстов своих блоков (PRD 10.13.38, второй пласт первого
 * куска).
 *
 * У записи `kind: "custom"` нет ни `name`, ни `desc`: весь её текст живёт в
 * `schema/custom_texts.ts` — выгрузке из прототипа. Значит и ключи ему нужны
 * свои, и собираются они здесь, рядом с формой этих текстов, а не в общем
 * модуле каталога: тот про схему и про вкладки, и знать про коллауты и
 * предпросмотры ему нечего.
 *
 * Ключ строится по **пути внутри самой выгрузки**: `callout.general.head`,
 * `preview.line.cap`, `commands.0.list.3.does`. Так его можно прочесть, не
 * держа в голове второй словарь.
 *
 * **Место в файле — то же, что на экране** (10.13.46, замечание заказчика к
 * K1). Раньше все эти строки лежали одним разделом в конце: коллаут вкладки
 * `Visual` стоял через сотню строк от заголовков этой вкладки, и переводить
 * их приходилось врозь. Теперь каждый блок отдаёт свои тексты `catalogEntries`
 * там, где сам блок стоит в схеме.
 *
 * **Имена команд сюда не попадают** (Я2). Их показывает и палитра Obsidian,
 * а она берёт имя из реестра команд: переведи мы имя в справочнике, и два
 * списка одной и той же команды разошлись бы на экране.
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
} as const;

/**
 * Строки, у которых своего места в схеме нет.
 *
 * `calloutTipLabel` — подпись «?» у вводного коллаута: она читается вслух
 * экранным диктором и потому видима (`Show tip about this tab`).
 * `groupReset` — подпись кнопки сброса группы: кнопка одна на все группы.
 */
export const SHARED_TEXTS: Readonly<Record<string, string>> = {
  [SINGLE_KEYS.previewExample]: PREVIEW_EXAMPLE,
  [SINGLE_KEYS.previewLine]: PREVIEW_LINE_TEXT,
  [SINGLE_KEYS.previewEmptyRight]: PREVIEW_EMPTY_RIGHT,
  [SINGLE_KEYS.moduleOff]: MODULE_OFF_NOTE,
  [SINGLE_KEYS.calloutTipLabel]: "this tab",
  [SINGLE_KEYS.groupReset]: "Reset the group",
};

/**
 * Строки самой панели, у которых нет ни строки настройки, ни окна: сброс
 * группы, подсказка «?» у заголовка, пустые состояния предпросмотров
 * (10.13.46).
 *
 * Ключ строится `frameKey`, и оба конца зовут его (У-82). Живут они здесь, а
 * не в `texts_dialogs.ts`: то — окна, которые открывает кнопка, а это то, что
 * панель рисует всегда.
 */
export const FRAME_TEXTS = {
  /* Сброс группы (Н3, Н5). */
  RESET_TITLE: "Reset {0}",
  RESET_ONE: "One setting in this group goes back to its default",
  RESET_MANY: "{0} settings in this group go back to their defaults",
  RESET_MORE: "and {0} more",
  RESET_CONFIRM: "Reset the group",
  RESET_NOTE: "Your Fields, Values and rules are not touched",
  RESET_DONE: "{0} settings back to default. Use Undo settings change to revert",
  RESET_TIP_ONE: "Reset group: {0} setting differs from the default",
  RESET_TIP_MANY: "Reset group: {0} settings differ from the default",
  RESET_TIP_CLEAN: "Everything here is already at its default",
  /* «?» у заголовка группы и у строки настройки. */
  MORE_ABOUT: "More about {0}",
  /* Полоса вкладок: её читает вслух программа чтения с экрана. */
  TAB_STRIP: "Settings areas",
  /* Прежние имена настройки: человек ищет ими в глобальном поиске (С4). */
  PREVIOUSLY_CALLED: "Previously called {0}",
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
  BARS_NO_TAG_FIELD: "Bars are drawn from the colours of a tag Field, and there is no tag Field yet: add one under <code>Tags &amp; PKM</code>",
  BARS_FIELD_GONE: "The Field these Bars were drawn for is gone: pick another one above",
  PREVIEW_LEFT_BLOCK: "Left Block",
  PREVIEW_RIGHT_BLOCK: "Right Block",
  PREVIEW_SEPARATOR_1: "separator 1",
  PREVIEW_SEPARATOR_2: "separator 2",
  PREVIEW_EMPTY_VALUE: "empty",
  PREVIEW_BEFORE: "Before",
  PREVIEW_AFTER: "After",
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

/**
 * Тексты, которые рисует эта строка настройки.
 *
 * Вкладку коллаут берёт **у своей группы**, а не из своего id: у вкладки
 * `navigation` блок называется `nav-callout`, и вывод по имени разошёлся бы с
 * тем, что рисуется (У-82).
 */
export function blockEntries(tab: string, _group: SettingsGroup, it: SettingDef): readonly TextEntry[] {
  const out: TextEntry[] = [];
  const id = it.id;
  if (/-callout$/.test(id)) calloutEntries(out, tab);
  else if (PREVIEW_TEXTS[id]) previewEntries(out, id);
  else if (id === "command-list") commandEntries(out);
  /*
   * Своя вёрстка блока — свои тексты (10.13.47). Стоят они здесь же, а не
   * разделом в конце: человек читает их на этом месте панели.
   */
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
