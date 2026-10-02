/**
 * Отображение нашей схемы в декларативные определения Obsidian (PRD 5.2, С11).
 * Чистая функция, проверяется без Obsidian. Типы — из пакета `obsidian`
 * (`import type`, стираются при сборке): `extraButtons` — массив функций, свои
 * догадки о формах этого не ловят. `getSettingDefinitions` зовётся часто —
 * без I/O и тяжёлых вычислений, с кешем (П-11).
 */

import type {
  ExtraButtonComponent,
  Setting,
  SettingControl,
  SettingDefinition,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingGroupItem,
} from "obsidian";

import type { ActionId, NamedDef, SettingDef, SettingsCtx, SettingsGroup, TabDef, TabId } from "./types.ts";
import { isBound } from "./types.ts";
/* Какой переменной темы красится цвет, пока он не задан (10.13.23). */
import { themeColorFor } from "./custom/theme_colors.ts";
/* Текст калитки модуля выведен из прототипа генератором, а не написан здесь. */
import { MODULE_OFF_NOTE } from "./schema/custom_texts.ts";
import { SHARED_TEXTS, SINGLE_KEYS } from "./texts_custom.ts";

/** То, что слой настроек умеет делать помимо чтения и записи значений. */
export interface Wiring {
  ctx: SettingsCtx;
  run: (action: ActionId) => void;
  /** Действие сейчас выполняется: его кнопка гаснет до конца (5.6). */
  busy?: (action: ActionId) => boolean;
  /** Собирает описание: текст со ссылками плюс сворачиваемая подсказка. */
  describe: (it: NamedDef) => unknown;
  /**
   * Вводная фраза группы — коллаутом между заголовком и карточкой. Отдаётся
   * функцией в `extraButtons`: единственный слот строки заголовка; узел кнопки
   * скрыт, нужна только точка опоры. Строку без `name`, `render`, `control` и
   * `action` платформа не рисует (`app.js`, `Z2`, У-44; B7, C18, C41, C42).
   */
  groupCallout?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /**
   * Кнопка сворачивания группы — в строке заголовка до названия (2026-09-04).
   * Тот же слот, что у коллаута; место — вёрсткой (`order: -1`), а не переносом
   * узла: перенос платформа отменяет на следующей отрисовке (У-45).
   */
  groupFold?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /** Своя вёрстка для kind: 'custom'. */
  renderCustom?: (it: SettingDef) => SettingDefinition | null;
  /**
   * Поле ввода с крестиком «стереть» (В-131). У `SettingDefinitionControl` нет
   * слота под кнопку, поэтому строка рисуется своим `render` (платформа отдаёт
   * `Setting`). Здесь только шов, рисование — в слое платформы.
   */
  clearableControl?: (it: SettingDef) => ((setting: Setting) => void) | null;
  /**
   * Кнопка сброса группы (10.13.1) — функцией, как ждёт `extraButtons`;
   * неактивность и подсказку панель меняет на самой кнопке, без пересборки.
   */
  resetGroup?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /**
   * «?» в заголовке группы (B7, C11, C18, C41, C42) — функцией; тело подсказки
   * кнопка создаёт сама за строкой заголовка (как `attachTip` прототипа).
   */
  groupTip?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /**
   * Значения списка не из схемы: Fields, папки vault, шаблоны. Нет — список из
   * одних постоянных строк.
   */
  optionsFrom?: (source: string) => ReadonlyArray<{ value: string; label: string }>;
  /** Открытая вкладка: показываются только её группы. */
  activeTab: TabId;
  /** Тумблер `Show option IDs in tips` (10.13.5): id дописывается к вводной строке группы. */
  showIds?: boolean;
  /**
   * Полоса вкладок первой строкой; рисует слой платформы, здесь только место.
   * Без неё (тесты) — группы активной вкладки.
   */
  tabStrip?: () => SettingDefinition | null;
}

/**
 * Называет ли подпись себя стандартной сама (`Default (default)`, 2026-10-01).
 * Слово приписки ищется среди слов подписи без скобок и регистра: приписка —
 * строка каталога, на другом языке иная.
 */
export function namesItselfDefault(label: string, mark: string): boolean {
  const word = String(mark).replace(/[^\p{L}]+/gu, "").toLowerCase();
  return !!word && String(label).toLowerCase().split(/[^\p{L}]+/u).includes(word);
}

const CONTROL_TYPE: Record<string, string> = {
  toggle: "toggle",
  dropdown: "dropdown",
  slider: "slider",
  number: "number",
  text: "text",
  textarea: "textarea",
  folder: "folder",
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
  /*
   * Поле цвета принимает только `#rrggbb` и пустое рисует чёрным (H4, 10.13.23
   * Ц3): запасным отдаётся цвет темы, значение остаётся пустым («взять у темы»).
   * Тему нечем прочесть — остаётся пустое.
   */
  if (it.kind === "color" && !String(raw["default"] || "")) {
    const themed = themeColorFor(it.path);
    if (themed) control["defaultValue"] = themed;
  }

  /* У поля папки та же подсказка в пустом поле, что и у обычного текста. */
  if (it.kind === "folder" && it.placeholder) control["placeholder"] = it.placeholder;
  if (it.kind === "dropdown") {
    const options: Record<string, string> = {};
    /*
     * Приписка у умолчания (2026-09-20, пункт 13) — после подстановки языка,
     * сама строка каталога. Значения не трогаются, только подписи (З1).
     */
    for (const o of it.options) options[o.value] = o.label;
    /*
     * Значения из данных человека — после постоянных. Источник — именем, а не
     * функцией: иначе генератор не перенесёт его из прототипа.
     */
    if (it.optionsFrom && w.optionsFrom) {
      for (const o of w.optionsFrom(it.optionsFrom)) options[o.value] = o.label;
    }
    /*
     * Приписка у умолчания (2026-09-20, пункт 13) — после обоих источников
     * (умолчание бывает и у списка из данных человека) и после подстановки
     * языка. Значения не трогаются (З1). Список из одной строки не помечается:
     * там бывает сообщение о пустоте (`Set a Templates folder first`).
     */
    const fallback = SHARED_TEXTS[SINGLE_KEYS.defaultOption] || "";
    const mark = w.ctx.t ? w.ctx.t(SINGLE_KEYS.defaultOption, fallback) : fallback;
    const standard = "default" in raw ? String(raw["default"]) : null;
    const single = Object.keys(options).length < 2;
    if (mark && !single && standard !== null && Object.prototype.hasOwnProperty.call(options, standard)
      && !namesItselfDefault(String(options[standard]), mark)) {
      options[standard] = String(options[standard]) + " " + mark;
    }
    control["options"] = options;
  }
  if (it.kind === "slider") {
    control["min"] = it.min;
    control["max"] = it.max;
    control["step"] = it.step;
    /*
     * У перевёрнутого слайдера `min`/`max` — в показанных величинах, `default` —
     * в записанных: `defaultValue` платформе отдаётся перевёрнутым, иначе сброс
     * поставит записанное число на показанную шкалу.
     */
    if (it.invert) control["defaultValue"] = it.invert - Number(it.default);
    /*
     * Единица — `displayFormat` (Ст5). Пробел неразрывный: иначе `%` уезжал под
     * трёхзначное число (2026-09-07); ширину ячейки решает платформа, правило
     * стилей пришлось бы держать по чужому классу (У-32).
     */
    if (it.unit) {
      const unit = it.unit;
      control["displayFormat"] = (v: number) => v + "\u00a0" + unit;
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
  /*
   * Свой блок — первым и мимо общей сборки: только `render` (П-12); из общего —
   * предикат видимости.
   */
  if (it.kind === "custom") {
    const def = w.renderCustom ? w.renderCustom(it) : null;
    if (!def) return null;
    if (it.visible) {
      const p = it.visible;
      (def as unknown as Record<string, unknown>)["visible"] = () => p.test(w.ctx);
    }
    return def;
  }

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
  if (it.kind === "buttons") {
    const buttons = it.buttons.slice();
    if (!buttons.length) return null;
    /*
     * Строка с кнопками, а не строка-кнопка (C9): у `SettingDefinitionAction`
     * кликабельна вся строка, подпись кнопки не рисуется, остальные уезжали в
     * безымянные `extraButtons`. Прототип (Р8) рисует `button.io-btn` с
     * подписью. `SettingDefinitionRender` наследует `name`, `desc`, `aliases`,
     * `searchable` — тексты и поиск остаются платформенными.
     */
    const busy = w.busy;
    common["render"] = (setting: Setting) => {
      for (const b of buttons) {
        setting.addButton(btn => {
          btn.setButtonText(b.label).onClick(() => w.run(b.action));
          if (b.cta) btn.setCta();
          if (b.warning) btn.setWarning();
          /*
           * Кнопка гаснет на время работы (5.6), иначе второй `Apply` поверх
           * первого. Пересборку просит `SettingsPane.run` — условие считается
           * при каждой отрисовке.
           */
          if (busy && busy(b.action)) btn.setDisabled(true);
          return btn;
        });
      }
    };
    return common as unknown as SettingDefinition;
  }

  /*
   * Поле, у которого пусто — законное значение, — своим `render`, иначе
   * крестик некуда (В-131). Имя, описание, aliases и видимость собраны выше и
   * наследуются.
   */
  if (isBound(it) && (it as unknown as { clearable?: boolean }).clearable === true) {
    const draw = w.clearableControl ? w.clearableControl(it) : null;
    if (draw) {
      common["render"] = draw;
      return common as unknown as SettingDefinition;
    }
  }

  const control = controlFor(it, w);
  if (control) common["control"] = control;
  return common as unknown as SettingDefinition;
}

function groupToDefinition(group: SettingsGroup, w: Wiring): SettingDefinitionGroup {
  const items: SettingGroupItem[] = [];
  for (const it of group.items) {
    const def = itemToDefinition(it, w);
    if (def) items.push(def as unknown as SettingGroupItem);
  }

  /*
   * У вводной группы (`-intro`) заголовка нет, как в прототипе. `cls` — по
   * нему переход находит группу: строкам класса платформа не даёт (К3).
   */
  const introOnly = /-intro$/.test(group.id);
  const def: Record<string, unknown> = { type: "group", items, cls: "io-group-" + group.id };
  if (!introOnly) def["heading"] = group.heading;
  if (group.visible) {
    const p = group.visible;
    def["visible"] = () => p.test(w.ctx);
  }
  /*
   * Кнопки заголовка — функциями: платформа зовёт каждую с компонентом.
   * Порядок прототипа: «?», потом сброс; без заголовка кнопок нет.
   */
  const buttons: Array<(btn: ExtraButtonComponent) => unknown> = [];
  /*
   * Коллаут первым: узел скрыт, видимый порядок — «?», потом сброс.
   */
  const fold = !introOnly && w.groupFold ? w.groupFold(group) : null;
  if (fold) buttons.push(fold);
  const callout = !introOnly && w.groupCallout ? w.groupCallout(group) : null;
  if (callout) buttons.push(callout);
  const tip = !introOnly && w.groupTip ? w.groupTip(group) : null;
  if (tip) buttons.push(tip);
  const reset = w.resetGroup ? w.resetGroup(group) : null;
  if (reset) buttons.push(reset);
  if (buttons.length) def["extraButtons"] = buttons;
  return def as unknown as SettingDefinitionGroup;
}

/**
 * Вкладка выключенного модуля: одна группа вместо всех. `null` — модуля нет
 * или он включён. Тумблер — тот же, что в `Modules` (по пути из
 * `TabDef.module`, У-32); меняется только `id`: два контрола с одним id на
 * странице платформе не годятся.
 */
function moduleGate(
  schema: readonly SettingsGroup[],
  active: TabDef,
  w: Wiring,
): SettingDefinitionGroup | null {
  const path = String(active.module || "").trim();
  if (!path) return null;
  if (w.ctx.get(path) !== false) return null;

  let master: SettingDef | null = null;
  for (const group of schema) {
    for (const it of group.items) {
      if (isBound(it) && it.path === path) { master = it; break; }
    }
    if (master) break;
  }
  /*
   * Тумблера в схеме нет — калитка заперла бы вкладку без выхода; показываем
   * как есть (З8).
   */
  if (!master) return null;

  const row = itemToDefinition(
    { ...(master as NamedDef), id: master.id + "-tab" } as SettingDef,
    w,
  );
  const items: SettingGroupItem[] = [];
  if (row) items.push(row as unknown as SettingGroupItem);
  /* Текст калитки переводится (10.13.38). */
  const moduleOff = w.ctx.t ? w.ctx.t(SINGLE_KEYS.moduleOff, MODULE_OFF_NOTE) : MODULE_OFF_NOTE;
  items.push({ name: "", desc: moduleOff, searchable: false } as unknown as SettingGroupItem);

  return {
    type: "group",
    heading: active.label,
    cls: "io-group-module-off",
    items,
  } as unknown as SettingDefinitionGroup;
}

/**
 * Схема и вкладки → определения. Полосы вкладок в декларативном API нет
 * (П-16): своя вёрстка первой строкой, платформе — только открытая вкладка
 * (решение 2026-08-24). Цена — глобальный поиск видит одну вкладку (П-21).
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

  /*
   * Калитка модуля (C7, 2026-09-02): вкладка выключенного модуля показывает
   * свой тумблер — включить можно здесь же, как в прототипе, тем же контролом.
   */
  const gate = moduleGate(schema, active, w);
  if (gate) {
    out.push(gate as SettingDefinitionItem);
    return out;
  }

  const groups = schema
    .filter(g => g.tab === active.id)
    .slice()
    .sort((a, b) => a.order - b.order);

  for (const g of groups) out.push(groupToDefinition(g, w) as SettingDefinitionItem);
  return out;
}
