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

/** То, что слой настроек умеет делать помимо чтения и записи значений. */
export interface Wiring {
  ctx: SettingsCtx;
  run: (action: ActionId) => void;
  /** Действие сейчас выполняется: его кнопка гаснет до конца (5.6). */
  busy?: (action: ActionId) => boolean;
  /** Собирает описание: текст со ссылками плюс сворачиваемая подсказка. */
  describe: (it: NamedDef) => unknown;
  /**
   * Вводная фраза группы — коллаутом между заголовком и карточкой настроек.
   *
   * Отдаётся функцией в `extraButtons`, как «?» и сброс, и по той же причине:
   * это единственный слот, который платформа даёт строке заголовка, и
   * единственное место, откуда до неё вообще можно дотянуться. Сам узел
   * кнопки при этом скрыт — рисовать нечего, нужна только точка опоры (тот же
   * приём, что у припаркованной строки полосы вкладок).
   *
   * До 2026-09-04 фраза была первой строкой **внутри** карточки, и заказчик
   * написал: «это сделано не красиво, как plain text сверху над настройками…
   * коллауты должны размещаться под хедерами настроек и до самих настроек
   * (т.е. до серого поля)».
   *
   * Строкой она быть перестала, но урок остаётся: строку без `name`,
   * `render`, `control` и `action` платформа не рисует вовсе (`app.js`, `Z2`,
   * У-44) — на этом фразы не было в панели ни разу, а с нею не доезжало и
   * тело подсказки группы (B7, C18, C41, C42).
   */
  groupCallout?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /**
   * Кнопка сворачивания группы — в строке заголовка, **до названия**
   * (просьба заказчика 2026-09-04: «приходится много скролить… кнопка
   * сворачивания должна быть в строке хедера до названия»).
   *
   * Тем же слотом и по той же причине, что коллаут: колонка кнопок —
   * единственное, что платформа даёт строке заголовка. Своё место в строке
   * кнопка занимает вёрсткой (`order: -1`), а не переносом узла: перенос
   * узла между родителями платформа отменяет на следующей отрисовке (У-45).
   */
  groupFold?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /** Своя вёрстка для kind: 'custom'. */
  renderCustom?: (it: SettingDef) => SettingDefinition | null;
  /**
   * Кнопка сброса группы к значениям по умолчанию (10.13.1). Отдаётся сразу
   * функцией: платформа ждёт в `extraButtons` именно функции, а состояние
   * кнопки — неактивность и подсказку — панель меняет на самой кнопке, не
   * пересобирая определения.
   */
  resetGroup?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /**
   * «?» в заголовке группы (B7, C11, C18, C41, C42). Отдаётся так же
   * функцией: слот `extraButtons` платформа заполняет сама. Тело подсказки
   * кнопка **создаёт сама** при нажатии и ставит сразу за строкой заголовка —
   * так это делает прототип (`attachTip`), и так узел принадлежит нам.
   */
  groupTip?: (group: SettingsGroup) => ((btn: ExtraButtonComponent) => unknown) | null;
  /**
   * Значения выпадающего списка, которых в схеме нет: Fields человека,
   * папки vault, шаблоны. Отсутствует — список остаётся из одних постоянных
   * строк, и это честнее выдуманного набора.
   */
  optionsFrom?: (source: string) => ReadonlyArray<{ value: string; label: string }>;
  /** Открытая вкладка: показываются только её группы. */
  activeTab: TabId;
  /**
   * Тумблер `Show setting ids in tips` с вкладки Advanced (10.13.5): у группы
   * id дописывается к вводной строке.
   */
  showIds?: boolean;
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
   * Пустой цвет полю выбора цвета не цвет: оно принимает только `#rrggbb` и
   * пустую строку рисует **чёрным** (замечание H4, 10.13.23 Ц3). Запасным
   * значением ему отдаётся цвет темы, а само значение остаётся пустым —
   * «пусто» по-прежнему значит «взять у темы». Тему нечем прочесть (проверки,
   * окно ещё не открылось) — остаётся прежнее пустое значение, а не выдуманный
   * цвет.
   */
  if (it.kind === "color" && !String(raw["default"] || "")) {
    const themed = themeColorFor(it.path);
    if (themed) control["defaultValue"] = themed;
  }
  if (it.disabled) {
    const p = it.disabled;
    control["disabled"] = () => p.test(w.ctx);
  }

  /* У поля папки та же подсказка в пустом поле, что и у обычного текста. */
  if (it.kind === "folder" && it.placeholder) control["placeholder"] = it.placeholder;
  if (it.kind === "dropdown") {
    const options: Record<string, string> = {};
    for (const o of it.options) options[o.value] = o.label;
    /*
     * Значения из данных человека дописываются после постоянных: Fields,
     * папки и шаблоны в схеме не живут и жить не могут. Источник называется
     * именем, а не функцией, — иначе его нельзя было бы перенести из
     * прототипа генератором.
     */
    if (it.optionsFrom && w.optionsFrom) {
      for (const o of w.optionsFrom(it.optionsFrom)) options[o.value] = o.label;
    }
    control["options"] = options;
  }
  if (it.kind === "slider") {
    control["min"] = it.min;
    control["max"] = it.max;
    control["step"] = it.step;
    /*
     * У перевёрнутого слайдера `min` и `max` заданы в показанных величинах, а
     * `default` — в записанных: умолчание уходит в конфиг, а границы человек
     * видит. Значит и `defaultValue` платформе надо отдать перевёрнутым,
     * иначе её сброс поставил бы записанное число на показанную шкалу.
     */
    if (it.invert) control["defaultValue"] = it.invert - Number(it.default);
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
  /*
   * Свой блок идёт первым и в общую сборку не попадает: у него нет ни имени,
   * ни описания, ни контрола — только строка `render` (П-12). Из общего к
   * нему относится один предикат видимости.
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
     * Строка **с кнопками**, а не строка-кнопка (C9, заказчик просил трижды).
     *
     * До 2026-09-02 пункт схемы становился `SettingDefinitionAction`: у такой
     * строки платформа делает кликабельной всю строку, а подпись кнопки не
     * рисуется нигде. Второй и следующие кнопки уезжали в `extraButtons` —
     * платформенные кнопки без значка, у которых видна одна подсказка при
     * наведении. То есть `Apply` и `Restore a backup` были **безымянными**, и
     * найти их человек не мог.
     *
     * Прототип — источник истины (Р8) — рисует здесь настоящие кнопки:
     * `RENDER.buttons` заводит `button.io-btn` с подписью, `cta` и `warning`.
     * Панель с ним расходилась, а не выбирала.
     *
     * `render` для этого годится целиком: `SettingDefinitionRender`
     * наследует `name`, `desc`, `aliases` и `searchable`, поэтому тексты и
     * глобальный поиск остаются платформенными, а нашего кода — одни кнопки.
     */
    const off = it.disabled;
    const busy = w.busy;
    common["render"] = (setting: Setting) => {
      for (const b of buttons) {
        setting.addButton(btn => {
          btn.setButtonText(b.label).onClick(() => w.run(b.action));
          if (b.cta) btn.setCta();
          if (b.warning) btn.setWarning();
          /*
           * Кнопка гаснет на время работы (5.6): второе нажатие по `Apply`
           * запускало бы применение поверх незаконченного первого. Предикат
           * схемы при этом не теряется — оба условия складываются. Пересборку
           * на смену занятости просит `SettingsPane.run`, поэтому условие
           * считается здесь, при каждой отрисовке.
           */
          if ((off && off.test(w.ctx)) || (busy && busy(b.action))) btn.setDisabled(true);
          return btn;
        });
      }
    };
    return common as unknown as SettingDefinition;
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
   * У вводной группы заголовка нет: коллаут показывается сразу. Так же
   * устроен прототип — он пропускает заголовок у групп с id на `-intro`, —
   * и «Before you start» над коллаутом было расхождением с ним, а не
   * решением. `cls` даёт группе приметный класс: по нему переход находит
   * нужную группу, потому что строкам класса платформа не даёт (К3).
   */
  const introOnly = /-intro$/.test(group.id);
  const def: Record<string, unknown> = { type: "group", items, cls: "io-group-" + group.id };
  if (!introOnly) def["heading"] = group.heading;
  if (group.visible) {
    const p = group.visible;
    def["visible"] = () => p.test(w.ctx);
  }
  /*
   * Кнопки заголовка группы объявляются функциями, а не объектами: платформа
   * вызывает каждую с компонентом кнопки.
   *
   * Порядок тот же, что в прототипе: сначала «?», потом сброс. У группы без
   * заголовка кнопок нет вовсе — вешать их некуда.
   */
  const buttons: Array<(btn: ExtraButtonComponent) => unknown> = [];
  /*
   * Коллаут первым: он не кнопка, а точка опоры, и его узел скрыт. Порядок
   * видимых знаков от этого не меняется — «?», потом сброс, как в прототипе.
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
 * Вкладка выключенного модуля: одна группа вместо всех.
 *
 * `null` — модуля у вкладки нет или он включён, и вкладка рисуется как обычно.
 *
 * Тумблер берётся **тот самый**, что стоит в группе `Modules`: ищется по пути
 * из `TabDef.module`. Своей копии определения здесь не появляется — иначе
 * подпись, подсказка и предикаты разошлись бы с оригиналом на первой правке
 * (У-32). Меняется один `id`: платформа держит определения по id, и два
 * контрола с одним id на одной странице ей не годятся.
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
   * Тумблера в схеме нет — значит, выключить модуль было нечем, и калитка
   * заперла бы вкладку без выхода. Тогда лучше показать вкладку как есть:
   * контрол, который никуда не ведёт, хуже его отсутствия (З8).
   */
  if (!master) return null;

  const row = itemToDefinition(
    { ...(master as NamedDef), id: master.id + "-tab" } as SettingDef,
    w,
  );
  const items: SettingGroupItem[] = [];
  if (row) items.push(row as unknown as SettingGroupItem);
  items.push({ name: "", desc: MODULE_OFF_NOTE, searchable: false } as unknown as SettingGroupItem);

  return {
    type: "group",
    heading: active.label,
    cls: "io-group-module-off",
    items,
  } as unknown as SettingDefinitionGroup;
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

  /*
   * Калитка модуля: вкладка выключенного модуля показывает свой тумблер и
   * говорит, что остальное скрыто.
   *
   * Так устроен прототип с самого начала. В панели этого не было **ни одной
   * строкой**: поле `module` у вкладки не читалось нигде — сверено поиском по
   * всему `src/ui`. Заказчик написал: «при выключении модуля в General при
   * переключении на соответствующий модуль он выглядит только что» (C7,
   * 2026-09-02).
   *
   * Почему тумблер повторяется на вкладке, а не остаётся только в `Modules`:
   * человек попал сюда, чтобы что-то настроить, и ему нужен способ включить
   * модуль здесь же, а не искать, где его выключили. Прототип делает то же и
   * тем же контролом — второй копии правила не появляется.
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
