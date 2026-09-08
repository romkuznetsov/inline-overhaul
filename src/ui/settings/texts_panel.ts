/**
 * Каталог панели целиком — одной функцией (PRD 10.13.46).
 *
 * Собирать его каждый раз заново нельзя: собирают его четыре места — панель,
 * запись файлов, гейт и проверка, — и стоит одному из них забыть слагаемое,
 * как файл на диске разойдётся с тем, что панель спрашивает. Заметно это
 * будет только тем, что перевод не применился (У-32).
 *
 * Слагаемых три:
 *   * схема и вкладки — английский из прототипа;
 *   * тексты своих блоков — коллауты, предпросмотры, справочник команд;
 *   * тексты окон, которые открывают кнопки этих строк.
 *
 * Последние два встают **на место своей строки**, а не разделом в конце: в
 * файле, который человек переводит, подсказка к окну `Save a backup` обязана
 * лежать рядом со строкой `Backup`, а не через семьсот строк от неё
 * (замечание заказчика к K1).
 */

import { catalogEntries, type CatalogExtras, type TextEntry } from "./texts.ts";
import { blockEntries, sharedEntries } from "./texts_custom.ts";
import { dialogEntries, type DialogOwner } from "./texts_dialogs.ts";
import { runtimeEntries } from "./texts_runtime.ts";
import type { SettingDef, SettingsGroup, TabDef } from "./types.ts";

/** У каких кнопок этой строки есть свои окна. */
function dialogsOf(it: SettingDef): readonly TextEntry[] {
  const buttons = (it as unknown as { buttons?: ReadonlyArray<{ action?: unknown }> }).buttons;
  if (!Array.isArray(buttons)) return [];
  const out: TextEntry[] = [];
  for (const b of buttons) {
    const said = dialogEntries(String(b.action) as DialogOwner);
    said.forEach((entry, i) => out.push(i === 0 ? { ...entry, gap: true } : { ...entry }));
  }
  return out;
}

/** Что показывает и открывает одна строка настройки, помимо себя самой. */
export function panelExtras(): CatalogExtras {
  return {
    forItem: (tab: string, group: SettingsGroup, it: SettingDef) => {
      const blocks = blockEntries(tab, group, it);
      const dialogs = dialogsOf(it);
      return blocks.length ? blocks.concat(dialogs) : dialogs;
    },
    /*
     * Разделом в конце — то, у чего места в схеме нет. Сообщения плагина в
     * редакторе (10.13.50) стоят здесь по той же причине, что и общие строки:
     * человек встречает их не в настройках, а пока печатает, и класть их
     * между строками вкладки значило бы соврать о порядке чтения.
     */
    tail: sharedEntries()
      .concat(dialogEntries("shared").map(e => ({ ...e })))
      .concat(runtimeEntries().map(e => ({ ...e }))),
  };
}

/** Английская ветка каталога целиком, в порядке чтения панели. */
export function panelCatalog(
  schema: readonly SettingsGroup[],
  tabs: readonly TabDef[],
): readonly TextEntry[] {
  return catalogEntries(schema, tabs, panelExtras());
}
