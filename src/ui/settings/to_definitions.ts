/**
 * Отображение нашей схемы в декларативные определения Obsidian (PRD 5.2, С11).
 *
 * Чистая функция: ни состояния, ни обращений к DOM за пределами сборки
 * описания. Это позволяет проверять отображение тестом без Obsidian.
 *
 * Типы берутся из пакета `obsidian`, но **только типы**: `import type`
 * стирается при сборке, поэтому модуль по-прежнему собирается и проверяется
 * без платформы. Первая версия описывала формы своим интерфейсом — и это
 * пропустило настоящую ошибку: `extraButtons` это массив **функций**, а не
 * объектов, и на нём падала отрисовка страницы. Типы платформы такое ловят,
 * свои догадки — нет.
 *
 * Важно (П-11): getSettingDefinitions вызывается часто, поэтому здесь нет ни
 * чтения файлов, ни тяжёлых вычислений; описания собираются с кешем.
 */

import type {
  ExtraButtonComponent,
  SettingControl,
  SettingDefinition,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingGroupItem,
} from "obsidian";

import type { ActionId, SettingDef, SettingsCtx, SettingsGroup, TabDef, TabId } from "./types.ts";
import { isBound } from "./types.ts";

/** То, что слой настроек умеет делать помимо чтения и записи значений. */
export interface Wiring {
  ctx: SettingsCtx;
  run: (action: ActionId) => void;
  /** Собирает описание: текст со ссылками плюс сворачиваемая подсказка. */
  describe: (it: SettingDef) => unknown;
  /** Своя вёрстка для kind: 'custom'. */
  renderCustom?: (it: SettingDef) => SettingDefinition | null;
  /** Кнопка сброса группы к значениям по умолчанию (10.13.1). */
  resetGroup?: (group: SettingsGroup) => { tooltip: string; onClick: () => void } | null;
  /** Открытая вкладка: показываются только её группы. */
  activeTab: TabId;
  /**
   * Полоса вкладок первой строкой. Её рисует тот слой, который знает про
   * платформу, — здесь только место под неё, чтобы отображение осталось
   * свободным от DOM. Без полосы (в тестах) показываются группы активной
   * вкладки, и этого достаточно, чтобы проверять содержимое.
   */
  tabStrip?: () => SettingDefinition | null;
}

const CONTROL_TYPE: Record<string, string> = {
  toggle: "toggle",
  dropdown: "dropdown",
  slider: "slider",
  number: "number",
  text: "text",
  textarea: "textarea",
  color: "color",
};

function controlFor(it: SettingDef, w: Wiring): SettingControl | undefined {
  if (!isBound(it)) return undefined;
  const type = CONTROL_TYPE[it.kind];
  if (!type) return undefined;

  /* Общая часть: ключ, значение по умолчанию и неактивность живут в контроле. */
  const control: Record<string, unknown> = { type, key: it.path };
  const raw = it as unknown as Record<string, unknown>;
  if ("default" in raw) control["defaultValue"] = raw["default"];
  if (it.disabled) {
    const p = it.disabled;
    control["disabled"] = () => p.test(w.ctx);
  }

  if (it.kind === "dropdown") {
    const options: Record<string, string> = {};
    for (const o of it.options) options[o.value] = o.label;
    control["options"] = options;
  }
  if (it.kind === "slider") {
    control["min"] = it.min;
    control["max"] = it.max;
    control["step"] = it.step;
    /* Единица измерения — это displayFormat, чем и выполняется Ст5. */
    if (it.unit) {
      const unit = it.unit;
      control["displayFormat"] = (v: number) => v + " " + unit;
    }
  }
  if (it.kind === "number") {
    if (it.min !== undefined) control["min"] = it.min;
    if (it.max !== undefined) control["max"] = it.max;
  }
  if (it.kind === "text" || it.kind === "textarea") {
    if (it.placeholder !== undefined) control["placeholder"] = it.placeholder;
    if (it.kind === "text" && it.validate) control["validate"] = it.validate;
  }
  return control as unknown as SettingControl;
}

function itemToDefinition(it: SettingDef, w: Wiring): SettingDefinition | null {
  const common: Record<string, unknown> = { name: it.name };
  const desc = w.describe(it);
  if (desc !== undefined) common["desc"] = desc;
  /* Старые имена — в aliases: поиск их учитывает, видимый текст чист (П-4). */
  if (it.searchTerms && it.searchTerms.length) common["aliases"] = it.searchTerms.slice();
  if (it.visible) {
    const p = it.visible;
    common["visible"] = () => p.test(w.ctx);
  }

  /* control, render и action взаимоисключающи (П-12). */
  if (it.kind === "custom") {
    return w.renderCustom ? w.renderCustom(it) : null;
  }
  if (it.kind === "buttons") {
    const first = it.buttons[0];
    if (!first) return null;
    if (it.disabled) {
      const p = it.disabled;
      common["disabled"] = () => p.test(w.ctx);
    }
    common["action"] = () => w.run(first.action);
    const rest = it.buttons.slice(1);
    if (rest.length) {
      common["extraButtons"] = rest.map(b => (btn: ExtraButtonComponent) =>
        btn.setTooltip(b.label).onClick(() => w.run(b.action)));
    }
    return common as unknown as SettingDefinition;
  }

  const control = controlFor(it, w);
  if (control) common["control"] = control;
  return common as unknown as SettingDefinition;
}

/**
 * Вводная фраза группы. У группы нет поля `desc` — только `heading`, — поэтому
 * фраза становится первой строкой без контрола. Строка исключается из поиска:
 * искать нужно настройки, а не вводные тексты.
 */
function introRow(text: string): SettingGroupItem {
  return { name: "", desc: text, searchable: false } as unknown as SettingGroupItem;
}

function groupToDefinition(group: SettingsGroup, w: Wiring): SettingDefinitionGroup {
  const items: SettingGroupItem[] = [];
  if (group.intro) items.push(introRow(group.intro));
  for (const it of group.items) {
    const def = itemToDefinition(it, w);
    if (def) items.push(def as unknown as SettingGroupItem);
  }

  const def: Record<string, unknown> = { type: "group", heading: group.heading, items };
  if (group.visible) {
    const p = group.visible;
    def["visible"] = () => p.test(w.ctx);
  }
  /* Кнопка сброса живёт в заголовке группы и объявляется функцией, а не
     объектом: платформа вызывает её с компонентом кнопки. */
  const reset = w.resetGroup ? w.resetGroup(group) : null;
  if (reset) {
    def["extraButtons"] = [(btn: ExtraButtonComponent) =>
      btn.setIcon("rotate-ccw").setTooltip(reset.tooltip).onClick(reset.onClick)];
  }
  return def as unknown as SettingDefinitionGroup;
}

/**
 * Схема плюс список вкладок на входе, определения на выходе.
 *
 * Полосы вкладок в декларативном API нет (П-16), поэтому она рисуется своей
 * вёрсткой первой строкой, а настройки открытой вкладки отдаются платформе —
 * решение заказчика от 2026-08-24. Цена решения: глобальный поиск Obsidian
 * видит только открытую вкладку; это записано в П-21.
 */
export function toDefinitions(
  schema: readonly SettingsGroup[],
  tabs: readonly TabDef[],
  w: Wiring,
): SettingDefinitionItem[] {
  const out: SettingDefinitionItem[] = [];

  const strip = w.tabStrip ? w.tabStrip() : null;
  if (strip) out.push(strip as SettingDefinitionItem);

  const active = tabs.find(t => t.id === w.activeTab) || tabs[0];
  if (!active) return out;

  const groups = schema
    .filter(g => g.tab === active.id)
    .slice()
    .sort((a, b) => a.order - b.order);

  for (const g of groups) out.push(groupToDefinition(g, w) as SettingDefinitionItem);
  return out;
}
