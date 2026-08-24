/**
 * Отображение нашей схемы в декларативные определения Obsidian (PRD 5.2, С11).
 *
 * Чистая функция: ни состояния, ни обращений к DOM за пределами сборки
 * DocumentFragment для описания. Это позволяет проверять отображение
 * тестом без Obsidian и без браузера.
 *
 * Важно (П-11): getSettingDefinitions вызывается часто, поэтому здесь не
 * должно быть ни чтения файлов, ни тяжёлых вычислений. Описания собираются
 * с кешем по id настройки.
 */

import type {
  ActionId, SettingDef, SettingsCtx, SettingsGroup, TabDef,
} from "./types.ts";
import { isBound } from "./types.ts";

/* Минимальные формы, которые ждёт платформа. Свой тип, а не импорт из
   obsidian: слой настроек должен собираться и проверяться без него. */

export interface ObsidianControl {
  type: "toggle" | "dropdown" | "slider" | "number" | "text" | "textarea" | "color";
  key: string;
  defaultValue?: unknown;
  options?: Record<string, string>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  rows?: number;
  validate?: (v: string) => string | undefined;
  disabled?: () => boolean;
}

export interface ObsidianDefinition {
  type?: "page" | "group";
  name?: string;
  heading?: string;
  desc?: unknown;
  cls?: string;
  searchable?: boolean;
  items?: ObsidianDefinition[];
  control?: ObsidianControl;
  action?: () => void;
  render?: (setting: unknown) => void;
  visible?: () => boolean;
  disabled?: () => boolean;
  extraButtons?: Array<{ icon?: string; tooltip: string; onClick: () => void }>;
}

/** То, что слой настроек умеет делать помимо чтения и записи значений. */
export interface Wiring {
  ctx: SettingsCtx;
  run: (action: ActionId) => void;
  /** Собирает описание: строка, «?» с подсказкой, старые имена. */
  describe: (it: SettingDef) => unknown;
  /** Своя вёрстка для kind: 'custom'. */
  renderCustom?: (it: SettingDef) => (setting: unknown) => void;
  /** Кнопка сброса группы к значениям по умолчанию (10.13.1). */
  resetGroup?: (group: SettingsGroup) => { tooltip: string; onClick: () => void } | null;
}

const CONTROL_TYPE: Record<string, ObsidianControl["type"]> = {
  toggle: "toggle",
  dropdown: "dropdown",
  slider: "slider",
  number: "number",
  text: "text",
  textarea: "textarea",
  color: "color",
};

function controlFor(it: SettingDef): ObsidianControl | undefined {
  if (!isBound(it)) return undefined;
  const type = CONTROL_TYPE[it.kind];
  if (!type) return undefined;

  const control: ObsidianControl = { type, key: it.path };
  const any = it as unknown as Record<string, unknown>;
  if ("default" in any) control.defaultValue = any["default"];

  if (it.kind === "dropdown") {
    const options: Record<string, string> = {};
    for (const o of it.options) options[o.value] = o.label;
    control.options = options;
  }
  if (it.kind === "slider") {
    control.min = it.min;
    control.max = it.max;
    control.step = it.step;
  }
  if (it.kind === "number") {
    if (it.min !== undefined) control.min = it.min;
    if (it.max !== undefined) control.max = it.max;
  }
  if (it.kind === "text") {
    if (it.placeholder !== undefined) control.placeholder = it.placeholder;
    if (it.validate) control.validate = it.validate;
  }
  if (it.kind === "textarea") {
    if (it.placeholder !== undefined) control.placeholder = it.placeholder;
    if (it.rows !== undefined) control.rows = it.rows;
  }
  return control;
}

function itemToDefinition(it: SettingDef, w: Wiring): ObsidianDefinition {
  const def: ObsidianDefinition = { name: it.name };
  const desc = w.describe(it);
  if (desc !== undefined && desc !== null) def.desc = desc;
  if (it.visible) {
    const p = it.visible;
    def.visible = () => p.test(w.ctx);
  }
  if (it.disabled) {
    const p = it.disabled;
    def.disabled = () => p.test(w.ctx);
  }

  /* control, render и action взаимоисключающи (П-12). */
  if (it.kind === "custom") {
    if (w.renderCustom) def.render = w.renderCustom(it);
    return def;
  }
  if (it.kind === "buttons") {
    const first = it.buttons[0];
    if (first) def.action = () => w.run(first.action);
    const rest = it.buttons.slice(1);
    if (rest.length) {
      def.extraButtons = rest.map(b => ({ tooltip: b.label, onClick: () => w.run(b.action) }));
    }
    return def;
  }

  const control = controlFor(it);
  if (control) def.control = control;
  return def;
}

function groupToDefinition(group: SettingsGroup, w: Wiring): ObsidianDefinition {
  const def: ObsidianDefinition = {
    type: "group",
    heading: group.heading,
    items: group.items.map(it => itemToDefinition(it, w)),
  };
  if (group.intro !== undefined) def.desc = group.intro;
  if (group.visible) {
    const p = group.visible;
    def.visible = () => p.test(w.ctx);
  }
  const reset = w.resetGroup ? w.resetGroup(group) : null;
  if (reset) def.extraButtons = [{ tooltip: reset.tooltip, onClick: reset.onClick }];
  return def;
}

/**
 * Схема плюс список вкладок на входе, массив определений на выходе.
 * Одна вкладка — одна страница; пустые страницы не создаются.
 */
export function toDefinitions(
  schema: readonly SettingsGroup[],
  tabs: readonly TabDef[],
  w: Wiring,
): ObsidianDefinition[] {
  const out: ObsidianDefinition[] = [];
  for (const tab of tabs) {
    const groups = schema
      .filter(g => g.tab === tab.id)
      .slice()
      .sort((a, b) => a.order - b.order);
    if (!groups.length) continue;
    out.push({
      type: "page",
      name: tab.label,
      items: groups.map(g => groupToDefinition(g, w)),
    });
  }
  return out;
}
