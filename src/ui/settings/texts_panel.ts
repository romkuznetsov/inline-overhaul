/**
 * Каталог панели целиком — одной функцией (PRD 10.13.46): его собирают панель,
 * запись файлов, гейт и проверка, и забытое слагаемое молча ломает перевод (У-32).
 * Тексты своих блоков и окон кнопок встают на место своей строки, а не разделом
 * в конце (замечание к K1).
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
    /* В конце — то, у чего места в схеме нет, в т.ч. сообщения в редакторе (10.13.50). */
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
