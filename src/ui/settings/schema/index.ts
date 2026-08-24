/**
 * Сборка схемы (PRD 5.1). Порядок вкладок — тот, что в 6.1; порядок групп
 * внутри вкладки задаёт поле `order`.
 *
 * Состояние: перенесены две группы из семи вкладок. Остальные переносятся
 * в фазе 1 по Приложению B; свои блоки — в фазе 3.
 */

import type { SettingsGroup, TabDef } from "../types.ts";
import { GENERAL_GROUPS } from "./general.ts";
import { KEYBOARD_GROUPS } from "./keyboard.ts";

export const TABS: readonly TabDef[] = [
  { id: "general", label: "General" },
  { id: "keyboard", label: "Keyboard" },
  { id: "navigation", label: "Navigation", module: "features.navigation.enabled" },
  { id: "pkm", label: "Tags & PKM", module: "features.pkm.enabled" },
  { id: "visual", label: "Visual", module: "features.visual.enabled" },
  { id: "transform", label: "Transform", module: "features.transform.enabled" },
  { id: "advanced", label: "Advanced" },
];

export const SCHEMA: readonly SettingsGroup[] = [
  ...GENERAL_GROUPS,
  ...KEYBOARD_GROUPS,
];

/** Группы одной вкладки в порядке показа. */
export function groupsFor(tab: string): readonly SettingsGroup[] {
  return SCHEMA.filter(g => g.tab === tab).slice().sort((a, b) => a.order - b.order);
}

/** Вкладки, у которых есть хотя бы одна группа. Пустых страниц не рисуем. */
export function activeTabs(): readonly TabDef[] {
  return TABS.filter(t => SCHEMA.some(g => g.tab === t.id));
}
