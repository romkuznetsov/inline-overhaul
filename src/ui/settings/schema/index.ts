/**
 * ВНИМАНИЕ: файл сгенерирован из docs/prototype/settings_prototype.html.
 * Руками не правится. Правится прототип, затем `npm run gen:schema`.
 */

import type { SettingsGroup, TabDef } from "../types.ts";
import { GENERAL_GROUPS } from "./general.ts";
import { KEYBOARD_GROUPS } from "./keyboard.ts";
import { NAVIGATION_GROUPS } from "./navigation.ts";
import { PKM_GROUPS } from "./pkm.ts";
import { VISUAL_GROUPS } from "./visual.ts";
import { TRANSFORM_GROUPS } from "./transform.ts";
import { ADVANCED_GROUPS } from "./advanced.ts";

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
  ...NAVIGATION_GROUPS,
  ...PKM_GROUPS,
  ...VISUAL_GROUPS,
  ...TRANSFORM_GROUPS,
  ...ADVANCED_GROUPS,
];

/** Группы одной вкладки в порядке показа. */
export function groupsFor(tab: string): readonly SettingsGroup[] {
  return SCHEMA.filter(g => g.tab === tab).slice().sort((a, b) => a.order - b.order);
}

/** Вкладки, у которых есть хотя бы одна группа. Пустых страниц не рисуем. */
export function activeTabs(): readonly TabDef[] {
  return TABS.filter(t => SCHEMA.some(g => g.tab === t.id));
}
