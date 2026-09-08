/**
 * Миграция конфига v1 → v2 (PRD 8.1, 8.1а, 8.2).
 *
 * Что здесь есть и чего нет. Здесь — чистая функция `migrate(raw)` и две
 * границы с миром: разовая резервная копия (МГ4) и разбор нечитаемого
 * `data.json` (МГ6). Здесь нет ни одного обращения к Obsidian: файловые
 * операции приходят швом `VaultFiles`, уведомление — швом `notify`. Иначе
 * проверку пришлось бы гонять на подделке всего плагина.
 *
 * **Модуль подключён 2026-08-31**, второй ступенью `migrateConfig` в `main.js`,
 * тем же заходом, которым движки перешли на пути v2 (фаза 2, пункт 4).
 * Разделить это было нельзя: `migrateConfig` прогоняется на каждом патче, и
 * конфиг, переехавший наполовину, ломает и панель, и рантайм.
 *
 * Три вещи, о которые легко споткнуться при чтении карты маршрутов ниже.
 *
 * 1. **`leftMode` и `rightMode` — это не Left и Right Block.** Это списки
 *    определений Fields по типу: теги и ссылки. Поэтому по ответу В9 они
 *    переезжают в `pkm.fields.tags` и `pkm.fields.links` — имена названы по
 *    типу Field, чтобы ловушка не выстрелила в четвёртый раз.
 * 2. **Непрозрачные ветки переносятся целиком** (`whole`). Внутрь `order`,
 *    `byTag`, `taxonomy`, `binderRows` спускаться нельзя: там пользовательские
 *    ключи, и любой из них уехал бы в `_unmigrated`.
 * 3. **Прозрачность у значений тоже меняет единицы.** В v1 это доля `0..1`,
 *    в схеме v2 — проценты `0..100` (`settings_sections_renderer.js` делил на
 *    100 прямо в панели). Перенос без множителя дал бы полностью прозрачные
 *    теги.
 */

import { SCHEMA } from "../ui/settings/schema/index.ts";
import { buildDefaultConfig, getIn, setIn } from "../ui/settings/types.ts";
import { applyStarterSet } from "./starter_config.ts";

export const SCHEMA_VERSION_V2 = 2;

/** Имена файлов рядом с `data.json` в папке плагина (МГ4, МГ6). */
export const CONFIG_FILE = "data.json";
export const BACKUP_V1_FILE = "data.backup.v1.json";
export const BROKEN_FILE = "data.broken.json";
/**
 * Служебный файл правил — с 2026-09-04 он тоже живёт здесь, рядом с
 * `data.json` (решение заказчика В-39). Имя объявлено один раз: литерал
 * полного пути в `pkm_option_keys.DEFAULT_RULES_PATH` сверяется с ним пином.
 */
export const RULES_FILE = "generated_rules.md";
/** Прежнее место того же файла — корень vault. */
export const LEGACY_RULES_FILE = "InlineOverhaul_Generated_RULES_TagWheel.md";

type Dict = Record<string, unknown>;

/* ---- мелочи ----------------------------------------------------------- */

function isPlainObject(x: unknown): x is Dict {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function cloneJson<T>(x: T): T {
  return x === undefined ? x : (JSON.parse(JSON.stringify(x)) as T);
}

/** Число в проценты из доли `0..1`, с отсечкой по краям. */
function shareToPercent(v: unknown): unknown {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  const pct = Math.round(n * 100);
  return pct < 0 ? 0 : pct > 100 ? 100 : pct;
}

/* ---- карта маршрутов -------------------------------------------------- */

/**
 * Что делать с веткой v1.
 *
 * `to` — куда переносится (у `keep` совпадает с исходным путём);
 * `drop` — ветка удаляется (8.1, «Удаляются»);
 * `whole` — ветка непрозрачная, внутрь не спускаемся;
 * `cast` — значение по дороге меняет единицы измерения.
 *
 * Путь без маршрута — не ошибка, а развилка: объект разбирается дальше по
 * ключам, лист уезжает в `_unmigrated` (МГ3).
 */
export interface Route {
  to?: string;
  drop?: true;
  whole?: true;
  cast?: (v: unknown) => unknown;
  /** Ветка уже написана в форме v2: при споре с веткой v1 проигрывает. */
  alreadyV2?: true;
}

function keep(path: string, whole?: true): [string, Route] {
  return whole ? [path, { to: path, whole }] : [path, { to: path }];
}

function keepV2(path: string, whole?: true): [string, Route] {
  return whole
    ? [path, { to: path, whole, alreadyV2: true }]
    : [path, { to: path, alreadyV2: true }];
}

function move(from: string, to: string, opts?: { whole?: true; cast?: (v: unknown) => unknown }): [string, Route] {
  const route: Route = { to };
  if (opts && opts.whole) route.whole = opts.whole;
  if (opts && opts.cast) route.cast = opts.cast;
  return [from, route];
}

function drop(path: string): [string, Route] {
  return [path, { drop: true, whole: true }];
}

/**
 * Карта маршрутов наружу. Её читают две вещи, и обе — не панель: сборщик карты
 * чтений `tools/read_map_v1.js` и проверка МГ5. Мост `ui/settings/v1_bridge.ts`
 * снят в фазе 2 вместе с пунктом 4 (М-5): движки читают версию 2, схема тоже,
 * и переводить стало нечего. Второй копии этой карты в проекте быть не должно —
 * разойдутся.
 */
export const ROUTES: ReadonlyMap<string, Route> = new Map<string, Route>([
  /* --- модули: без изменений ------------------------------------------- */
  keep("features.navigation.enabled"),
  keep("features.pkm.enabled"),
  keep("features.visual.enabled"),
  keep("features.transform.enabled"),

  /* --- навигация: без изменений (8.1) ---------------------------------- */
  keep("navigation.moveLine.enabled"),
  keep("navigation.moveLine.noSelectionMode"),
  keep("navigation.moveLine.headerMode"),
  keep("navigation.moveLine.crossSectionAllowed"),
  keep("navigation.moveLine.highlightMovedLines"),
  /* Прокрутка при перемещении строки заведена 2026-09-05 вместе с 10.13.36:
     пары в версии 1 нет, поэтому `keepV2`, иначе ключ уезжает в
     `_unmigrated` (МГ3). */
  keepV2("navigation.moveLine.keepInView"),
  keepV2("navigation.moveLine.viewPosition"),
  keep("navigation.moveSelection.enabled"),
  keep("navigation.moveSelection.inlineEnabled"),
  keep("navigation.moveSelection.prefixCyclerEnabled"),
  keep("navigation.moveSelection.indentFallbackEnabled"),
  keep("navigation.moveSelection.onCycleEnd"),
  keep("navigation.moveSelection.inlineMoveMode"),
  keep("navigation.moveSelection.cycleOrder", true),
  keepV2("navigation.moveSelection.rightCycles"),
  /* Заведена вместе с новой панелью 2026-09-04: пары в версии 1 нет, поэтому
     `keepV2`, иначе ключ уезжает в `_unmigrated` (МГ3). */
  keepV2("navigation.moveSelection.inlineBoundaryJump"),
  /* `Step out of the word` заведена 2026-09-08 по замечанию заказчика: пары в
     версии 1 нет, поэтому `keepV2` (МГ3). */
  keepV2("navigation.moveSelection.inlineWordEscape"),
  keep("navigation.jumpToHeader.enabled"),
  keep("navigation.jumpToHeader.centerCursor"),
  /* Место на экране после перехода заведено 2026-09-06 вместе с 10.13.37:
     пары в версии 1 нет, поэтому `keepV2` (МГ3). */
  keepV2("navigation.jumpToHeader.viewPosition"),
  keep("navigation.jumpToHeader.centerDelayMs"),
  keep("navigation.jumpToHeader.centerThrottleMs"),
  keep("navigation.jumpToHeader.jumpMode"),
  keep("navigation.jumpToHeader.edgeMode"),
  keep("navigation.jumpToHeader.jumpCursorPosition"),
  keep("navigation.navigateInline.enabled"),
  keep("navigation.navigateInline.stepMode"),
  keep("navigation.navigateInline.boundaryJump"),
  keep("navigation.navigateInline.onBoundary"),

  /* --- расширенное «выделить всё» → вкладка Keyboard -------------------- */
  move("globalFunctions.enhancedSelectAll.enabled", "editor.selectAll.enabled"),
  move("globalFunctions.enhancedSelectAll.mode", "editor.selectAll.mode"),
  move("globalFunctions.enhancedSelectAll.useMultiPressDelay", "editor.selectAll.useDelay"),
  move("globalFunctions.enhancedSelectAll.delayMs", "editor.selectAll.delayMs"),
  move("globalFunctions.enhancedSelectAll.clearSelectionOnLastPress", "editor.selectAll.clearOnLast"),

  /* --- Binder ---------------------------------------------------------- */
  move("ui.binderRows", "editor.binder.rows", { whole: true }),

  /* --- состояние старой панели: живёт до фазы 3c (8.1) ------------------ */
  keep("ui.activeSettingsTab"),
  keep("ui.visualSubTab"),
  keep("ui.hotkeysSubTab"),
  keep("ui.pkmSubTab"),
  keep("ui.orderShowInfoTips"),
  keep("ui.orderShowDeepEditor"),
  keep("ui.orderShowColorSettings"),
  keep("ui.orderActiveCommandsCollapsed"),

  /* --- PKM: определения Fields (В9) ------------------------------------ */
  move("pkm.behavior.order", "pkm.fields.order", { whole: true }),
  move("pkm.behavior.leftMode", "pkm.fields.tags", { whole: true }),
  move("pkm.behavior.rightMode", "pkm.fields.links", { whole: true }),
  move("pkm.behavior.elements", "pkm.fields.elements", { whole: true }),
  /*
   * Легаси-ветка дат. Маршрута у неё не было, и лист за листом она уехала бы в
   * `_unmigrated` — то есть настройки полей-дат, заведённых до перехода на
   * элементы, пропали бы из панели молча. Разбирает её третья ступень
   * `migrateConfig` (`ensureBehaviorModesFromOrder`): она сворачивает
   * `pkm.fields.dates` в `pkm.fields.elements` и удаляет ветку. Маршрут нужен
   * ровно затем, чтобы ветка до неё доехала целиком.
   */
  move("pkm.behavior.dates", "pkm.fields.dates", { whole: true }),
  move("pkm.taxonomy", "pkm.fields.taxonomy", { whole: true }),
  move("pkm.behavior.projects", "pkm.fields.projects", { whole: true }),
  move("pkm.behavior.typeCheckboxByValue", "pkm.fields.checkboxByValue", { whole: true }),
  move("pkm.behavior.defaultMode", "pkm.fields.defaultBlock"),

  /* --- PKM: разделители и правила письма -------------------------------- */
  move("pkm.behavior.io.separator1", "pkm.lineFormat.separator1"),
  move("pkm.behavior.io.separator2", "pkm.lineFormat.separator2"),
  move("pkm.behavior.subtagFormat", "pkm.behavior.childTagFormat"),
  keepV2("pkm.behavior.childTagFormat"),
  keep("pkm.behavior.cycleEndBehavior"),
  keep("pkm.behavior.cursorPolicy"),

  /* --- PKM: как Field встаёт в строку ----------------------------------- */
  move("pkm.behavior.freeRoam.minimalSeparator", "pkm.placement.keepPrefixInsertOnly"),
  move("pkm.behavior.freeRoam.minimalPrefix", "pkm.placement.fieldPrefixInsertOnly"),
  move("pkm.behavior.freeRoam.offPrefix", "pkm.placement.bulletInStrict"),
  move("pkm.behavior.freeRoam.fullPlacement", "pkm.placement.freeInsertPosition"),

  /* --- PKM: приоритет Prefix (8.3) -------------------------------------- */
  move("pkm.behavior.prefixRules.priorityMode", "pkm.prefixPriority.decideBy"),
  move("pkm.behavior.prefixRules.fieldsOrderMode", "pkm.prefixPriority.fieldOrderSource"),
  move("pkm.behavior.prefixRules.tagSubtagPriority", "pkm.prefixPriority.parentOrChild"),
  move("pkm.behavior.prefixRules.resolver", "pkm.prefixRules.resolver"),
  move("pkm.behavior.prefixRules.priorityTargets", "pkm.prefixRules.priorityTargets", { whole: true }),
  move("pkm.behavior.prefixRules.priorityCheckboxes", "pkm.prefixRules.priorityCheckboxes", { whole: true }),
  move("pkm.behavior.prefixRules.checkboxByFieldValue", "pkm.prefixRules.checkboxByFieldValue", { whole: true }),

  /* --- PKM: заметка конфига снята 2026-09-03 (PRD 10.12) ---------------- */
  drop("pkm.tagWheelConfigPath"),
  drop("pkm.tagWheelConfigTemplatePath"),
  drop("pkm.configExportMode"),
  move("pkm.generatedRulesPath", "advanced.generatedRulesPath"),

  /* --- PKM: удаляемое ---------------------------------------------------- */
  drop("pkm.executionBackend"),

  /* --- вид тегов -------------------------------------------------------- */
  move("pkm.behavior.tagVisuals.opacity.left", "visual.tags.opacityLeft", { cast: shareToPercent }),
  move("pkm.behavior.tagVisuals.opacity.right", "visual.tags.opacityRight", { cast: shareToPercent }),
  move("pkm.behavior.tagVisuals.tagTextSizePct", "visual.tags.textSizePct"),
  move("pkm.behavior.tagVisuals.tagBubbleWidthPct", "visual.tags.bubbleWidthPct"),
  move("pkm.behavior.tagVisuals.tagBubbleHeightPct", "visual.tags.bubbleHeightPct"),
  move("pkm.behavior.tagVisuals.emptyBubbleSizePct", "visual.tags.emptyBubblePct"),
  move("pkm.behavior.tagVisuals.tagShapePct", "visual.tags.cornersPct"),
  move("pkm.behavior.tagVisuals.byField", "visual.tags.byField", { whole: true }),
  move("pkm.behavior.tagVisuals.byTag", "visual.tags.byTag", { whole: true }),
  move("pkm.behavior.tagVisuals.userTags", "visual.tags.userTags", { whole: true }),
  move("pkm.behavior.tagVisuals.showColorSettings", "viewState.fieldOrder.showColors"),

  /* --- Tag Bars --------------------------------------------------------- */
  move("pkm.behavior.tagVisuals.strip.active", "visual.tagBars.active"),
  move("pkm.behavior.tagVisuals.strip.fieldId", "visual.tagBars.fieldId"),
  move("pkm.behavior.tagVisuals.strip.tagVisibility", "visual.tagBars.tagVisibility"),
  move("pkm.behavior.tagVisuals.strip.hideSeparatorWhenOnlyStripToken", "visual.tagBars.hideSeparatorWhenOnlyStripToken"),
  move("pkm.behavior.tagVisuals.strip.mode", "visual.tagBars.mode"),
  move("pkm.behavior.tagVisuals.strip.stripesToShow", "visual.tagBars.stripesToShow"),
  move("pkm.behavior.tagVisuals.strip.spacing", "visual.tagBars.spacing"),
  move("pkm.behavior.tagVisuals.strip.thickness", "visual.tagBars.thickness"),
  move("pkm.behavior.tagVisuals.strip.childOffset", "visual.tagBars.childOffset"),

  /* --- TagWheel --------------------------------------------------------- */
  move("pkm.behavior.colors.tagwheelHeader.showPrefix", "visual.tagWheel.showMarkers"),
  move("pkm.behavior.colors.tagwheelHeader.defaultTextColor", "visual.tagWheel.textColor"),
  move("pkm.behavior.colors.tagwheelHeader.fillColor", "visual.tagWheel.fillColor"),
  move("pkm.behavior.tagWheelScroller.enabled", "visual.tagWheel.scroller.enabled"),
  move("pkm.behavior.tagWheelScroller.direction", "visual.tagWheel.scroller.direction"),
  move("pkm.behavior.tagWheelScroller.size", "visual.tagWheel.scroller.size"),

  /* --- вид: удаляемое ---------------------------------------------------- */
  drop("visual.displayModes"),
  drop("visual.colors"),

  /* --- вид: уже написанное новой панелью в форме v2 ---------------------- */
  keepV2("visual.tags.opacityLeft"),
  keepV2("visual.tags.opacityRight"),
  keepV2("visual.tags.textSizePct"),
  keepV2("visual.tags.bubbleWidthPct"),
  keepV2("visual.tags.bubbleHeightPct"),
  keepV2("visual.tags.emptyBubblePct"),
  keepV2("visual.tags.cornersPct"),
  keepV2("visual.tags.byField", true),
  keepV2("visual.tags.byTag", true),
  keepV2("visual.tags.userTags", true),
  keepV2("visual.tagBars.active"),
  keepV2("visual.tagBars.fieldId"),
  keepV2("visual.tagBars.tagVisibility"),
  keepV2("visual.tagBars.hideSeparatorWhenOnlyStripToken"),
  keepV2("visual.tagBars.mode"),
  keepV2("visual.tagBars.stripesToShow"),
  keepV2("visual.tagBars.spacing"),
  keepV2("visual.tagBars.thickness"),
  keepV2("visual.tagBars.childOffset"),
  keepV2("visual.tagWheel.showMarkers"),
  keepV2("visual.tagWheel.highlightLine"),
  keepV2("visual.tagWheel.textColor"),
  keepV2("visual.tagWheel.fillColor"),
  keepV2("visual.tagWheel.scroller.enabled"),
  keepV2("visual.tagWheel.scroller.direction"),
  keepV2("visual.tagWheel.scroller.size"),

  /* --- Transform -------------------------------------------------------- */
  drop("transform.inline2fleet"),
  keep("transform.inline2note.enabled"),
  keep("transform.inline2note.outputFolder"),
  keep("transform.inline2note.defaultTemplate"),
  keep("transform.inline2note.yamlNoteFormat"),
  keep("transform.inline2note.smartRules", true),
  keepV2("transform.inline2note.placement.headerLevel"),
  keep("transform.inline2note.noteName.mode"),
  keep("transform.inline2note.noteName.preferHeaderTitle"),
  keep("transform.inline2note.nameCollision.mode"),
  keep("transform.inline2note.placement.position"),
  keep("transform.inline2note.placement.headerMode"),
  keep("transform.inline2note.preview.sampleLine"),
  keep("transform.inline2note.sourceProcessing.cleanupFieldIds", true),
  /*
   * Ветка целиком — и три её листа отдельно: у каждого с 2026-09-01 есть свой
   * контрол (10.13.12), а проверка `settings_paths_v2_tests.ts` спрашивает
   * маршрут именно у пути контрола, не у ветки над ним.
   */
  keep("transform.inline2note.sourceProcessing.visual", true),
  keep("transform.inline2note.sourceProcessing.visual.enabled"),
  keep("transform.inline2note.sourceProcessing.visual.color"),
  keep("transform.inline2note.sourceProcessing.visual.opacity"),
  move("transform.inline2note.templateFolder", "transform.inline2note.templatesFolder"),
  move("transform.inline2note.noteName.explicitNameDelimiters", "transform.inline2note.noteName.delimiters"),
  move("transform.inline2note.noteName.autoWordsCount", "transform.inline2note.noteName.wordCount"),
  move("transform.inline2note.placement.customHeaderText", "transform.inline2note.placement.customHeader"),
  move("transform.inline2note.placement.datetimeHeaderFormat", "transform.inline2note.placement.datetimeFormat"),
  move("transform.inline2note.sourceProcessing.processedToken", "transform.inline2note.sourceProcessing.token"),
  move("transform.inline2note.sourceProcessing.processedTokenPanel", "transform.inline2note.sourceProcessing.panel"),
  move("transform.inline2note.sourceProcessing.replacePayloadWithLink", "transform.inline2note.sourceProcessing.replaceWithLink"),
  move("transform.inline2note.openTransformedNote", "transform.inline2note.openTarget"),
  move("transform.inline2note.sublinesBehavior", "transform.inline2note.sublines"),
  move("transform.inline2note.flyingButton.enabled", "transform.inline2note.floatingButton"),
  keepV2("transform.inline2note.templatesFolder"),
  keepV2("transform.inline2note.noteName.delimiters"),
  keepV2("transform.inline2note.noteName.wordCount"),
  keepV2("transform.inline2note.placement.customHeader"),
  keepV2("transform.inline2note.placement.datetimeFormat"),
  keepV2("transform.inline2note.sourceProcessing.token"),
  keepV2("transform.inline2note.sourceProcessing.panel"),
  keepV2("transform.inline2note.sourceProcessing.replaceWithLink"),
  /* Судьба текста исходной строки: своя настройка с 2026-09-01. Ключа нет в
     старых файлах, и умолчание там выводит движок из `replaceWithLink`. */
  keepV2("transform.inline2note.sourceProcessing.text"),
  keepV2("transform.inline2note.sourceProcessing.keepWords"),
  keepV2("transform.inline2note.openTarget"),
  keepV2("transform.inline2note.sublines"),
  keepV2("transform.inline2note.floatingButton"),
  /* Отступ кнопки от текста: ключа нет в старых файлах, умолчание досыпает
     схема (замечание заказчика 2026-09-04). */
  keepV2("transform.inline2note.floatingButtonGap"),

  /* --- журнал применений заметки: снят вместе с ней (PRD 10.12) --------- */
  drop("backups.tagWheelConfigApplies"),

  /* --- режим разработчика → Advanced ------------------------------------ */
  move("devMode.enabled", "advanced.devMode.enabled"),
  move("devMode.generateAiLog", "advanced.devMode.aiLog"),
  move("devMode.logPath", "advanced.devMode.logPath"),
  move("devMode.traceTagVisualLine", "advanced.devMode.traceTagVisualLine"),

  /* --- мёртвые ветки ----------------------------------------------------- */
  drop("meta"),
  drop("rules"),

  /* --- уже написанное новой панелью ------------------------------------- */
  keepV2("editor.selectAll.enabled"),
  keepV2("editor.selectAll.mode"),
  keepV2("editor.selectAll.useDelay"),
  keepV2("editor.selectAll.delayMs"),
  keepV2("editor.selectAll.clearOnLast"),
  keepV2("editor.binder.rows", true),
  keepV2("general.help.showTips"),
  /* `Show callouts` (10.13.27): ключа нет в старых файлах, умолчание
     досыпает схема (замечание заказчика 2026-09-04). */
  keepV2("general.help.showCallouts"),
  /* Язык панели (10.13.38): путь версии 2, пары в версии 1 нет. Без маршрута
     форма v2 в конфиге считалась бы неизвестным ключом и уезжала в
     `_unmigrated`. */
  keepV2("general.language"),
  keepV2("advanced.newSettingsPane"),
  /* Тумблер подписи id в подсказках (10.13.5): настройка новая, ветки v1 у неё
     нет, и мигрировать нечего — но маршрут нужен, чтобы форма v2 в конфиге
     заказчика не считалась неизвестным ключом и не уезжала в `_unmigrated`. */
  keepV2("advanced.showSettingIds"),
  /* Папка копий настроек (10.13.2, Б2): путь версии 2, в версии 1 его не было. */
  keepV2("advanced.backups.folder"),
  /* Копия перед восстановлением — тумблер с 2026-09-04 (замечание C56).
     Тоже путь версии 2, пары в версии 1 нет. */
  keepV2("advanced.backups.beforeRestore"),
  keepV2("advanced.generatedRulesPath"),
  keepV2("advanced.devMode.enabled"),
  keepV2("advanced.devMode.aiLog"),
  keepV2("advanced.devMode.logPath"),
  keepV2("advanced.devMode.traceTagVisualLine"),
  keepV2("pkm.fields.order", true),
  keepV2("pkm.fields.tags", true),
  keepV2("pkm.fields.links", true),
  keepV2("pkm.fields.elements", true),
  keepV2("pkm.fields.taxonomy", true),
  keepV2("pkm.fields.projects", true),
  keepV2("pkm.fields.checkboxByValue", true),
  keepV2("pkm.fields.defaultBlock"),
  keepV2("pkm.lineFormat.separator1"),
  keepV2("pkm.lineFormat.separator2"),
  keepV2("pkm.placement.keepPrefixInsertOnly"),
  keepV2("pkm.placement.fieldPrefixInsertOnly"),
  keepV2("pkm.placement.bulletInStrict"),
  keepV2("pkm.placement.freeInsertPosition"),
  keepV2("pkm.prefixPriority.decideBy"),
  keepV2("pkm.prefixPriority.fieldOrderSource"),
  keepV2("pkm.prefixPriority.parentOrChild"),
  keepV2("pkm.prefixRules.resolver"),
  keepV2("pkm.prefixRules.priorityTargets", true),
  keepV2("pkm.prefixRules.priorityCheckboxes", true),
  keepV2("pkm.prefixRules.checkboxByFieldValue", true),
  drop("pkm.configNote"),
  keepV2("viewState.activeTab"),
  /* Флаг одноразового уведомления о смене ID команд (фаза 2, пункт 8). Это
     состояние, а не настройка: контрола у него нет и быть не должно. */
  keepV2("viewState.commandIdsNotice"),
  keepV2("viewState.fieldOrder.expanded", true),
  keepV2("viewState.fieldOrder.showColors"),
  keepV2("_unmigrated", true),
]);

/**
 * Умолчания, которых нет в схеме, потому что контрола у них нет.
 *
 * Два источника, и оба обязательны. Пустые контейнеры — чтобы движок нашёл
 * объект, а не `undefined`, там где v1 всегда клал объект. Три значения
 * приоритета Prefix — из `getPrefixRulesFromCfg`, а **не** из схемы: 8.3
 * прямо требует этого, потому что у схемы там другие умолчания
 * (`auto` и `tag-over-subtag`), и обновление переписало бы вид уже
 * написанных строк тем, кто эти настройки не трогал.
 */
const V2_SKELETON: Dict = {
  "pkm.fields.order": {},
  "pkm.fields.tags": {},
  "pkm.fields.links": {},
  "pkm.fields.elements": {},
  "pkm.fields.taxonomy": {},
  "pkm.fields.checkboxByValue": {},
  "pkm.fields.defaultBlock": "left",
  "pkm.prefixRules.resolver": "priority-first",
  "pkm.prefixRules.priorityTargets": [],
  "pkm.prefixRules.priorityCheckboxes": [],
  "pkm.prefixRules.checkboxByFieldValue": {},
  "pkm.prefixPriority.decideBy": "by-section",
  "pkm.prefixPriority.fieldOrderSource": "manual",
  "pkm.prefixPriority.parentOrChild": "subtag-over-tag",
  "visual.tags.byField": {},
  "visual.tags.byTag": {},
  "visual.tags.userTags": {},
  "editor.binder.rows": [],
  "advanced.generatedRulesPath": ".obsidian/plugins/inline-overhaul/generated_rules.md",
  "viewState.activeTab": "general",
  "viewState.fieldOrder.expanded": {},
  "viewState.fieldOrder.showColors": true,
};

/* ---- сама миграция ---------------------------------------------------- */

export interface MigrateReport {
  /** Ветки v1, для которых маршрута нет: сложены в `_unmigrated` (МГ3). */
  unknown: string[];
  /**
   * Пути, за которые спорили обе формы. Победила форма v2, проигравшее
   * значение v1 лежит в `_unmigrated` (МГ7).
   */
  contested: string[];
  /** Была ли выполнена ветка 1 → 2 или конфиг уже был версии 2. */
  migrated: boolean;
}

interface Landing {
  value: unknown;
  /** Значение пришло с ветки v1, а не с ветки в форме v2. В споре слабее. */
  fromV1: boolean;
  /** Путь-источник: по нему проигравший спор попадает в `_unmigrated`. */
  source: string;
  /** Значение до пересчёта единиц: в `_unmigrated` кладётся именно оно. */
  raw: unknown;
}

interface Walk {
  landings: Map<string, Landing>;
  /** Проигравшие спор за путь: сохраняются, а не выбрасываются. */
  losers: Array<{ path: string; value: unknown }>;
  /** Ветки без маршрута (МГ3). */
  unknown: string[];
}

/**
 * Приземления собираются в плоскую карту `путь → значение` и только потом
 * раскладываются в объект. Так спор двух источников за один путь виден и
 * решается правилом, а не порядком обхода.
 *
 * Правило: **побеждает форма v2**. До фазы 2 настройка с `path:` до движка не
 * доезжала, поэтому обе формы лежат в конфиге сразу; но значение в форме v2
 * попало туда только одним способом — человек нажал контрол в новой панели.
 * Значение v1 в таком споре чаще всего не выбор, а нетронутое умолчание.
 * Проигравшее не выбрасывается: оно ложится в `_unmigrated` (МГ7).
 */
function collect(node: unknown, path: string, walk: Walk): void {
  const route = ROUTES.get(path);

  if (route) {
    if (route.drop) return;
    if (route.whole || !isPlainObject(node)) {
      const target = route.to;
      if (!target) return;
      const fromV1 = !route.alreadyV2;
      const value = route.cast ? route.cast(node) : cloneJson(node);
      const prev = walk.landings.get(target);
      const raw = cloneJson(node);
      if (!prev) {
        walk.landings.set(target, { value, raw, fromV1, source: path });
        return;
      }
      if (!fromV1 && prev.fromV1) {
        walk.losers.push({ path: prev.source, value: prev.raw });
        walk.landings.set(target, { value, raw, fromV1, source: path });
        return;
      }
      walk.losers.push({ path, value: raw });
      return;
    }
  }

  if (isPlainObject(node)) {
    for (const key of Object.keys(node)) {
      collect(node[key], path ? path + "." + key : key, walk);
    }
    return;
  }

  walk.unknown.push(path);
}

function migrateV1(raw: Dict, report: MigrateReport): Dict {
  const walk: Walk = { landings: new Map<string, Landing>(), losers: [], unknown: [] };

  /* Переходник со старых версий: `rules.tagWheelPath` → путь сгенерированных
     правил. Ветка `rules` удаляется, переходник остаётся (8.1) — иначе
     обновление со старой версии потеряет путь. Считается до обхода, потому
     что обход ветку `rules` выбрасывает целиком. */
  const rulesBranch = isPlainObject(raw.rules) ? raw.rules : {};
  const legacyRulesPath = typeof rulesBranch.tagWheelPath === "string" ? rulesBranch.tagWheelPath.trim() : "";
  const ownRulesPath = typeof getIn(raw, "pkm.generatedRulesPath") === "string"
    ? String(getIn(raw, "pkm.generatedRulesPath")).trim()
    : "";

  for (const key of Object.keys(raw)) {
    if (key === "schemaVersion") continue;
    collect(raw[key], key, walk);
  }

  /* Обход уже приземлил `pkm.generatedRulesPath` своим маршрутом. Переходник
     вступает только там, где своего пути нет: пустая строка или её отсутствие. */
  const prevRulesPath = walk.landings.get("advanced.generatedRulesPath");
  if (!ownRulesPath && legacyRulesPath && (!prevRulesPath || prevRulesPath.fromV1)) {
    if (prevRulesPath) walk.losers.push({ path: prevRulesPath.source, value: prevRulesPath.raw });
    walk.landings.set("advanced.generatedRulesPath", {
      value: legacyRulesPath,
      raw: legacyRulesPath,
      fromV1: true,
      source: "rules.tagWheelPath",
    });
  }

  const out: Dict = {};
  for (const [target, landing] of walk.landings) setIn(out, target, landing.value);

  const rejected: Dict = {};
  for (const path of walk.unknown) rejected[path] = cloneJson(getIn(raw, path));
  for (const loser of walk.losers) {
    rejected[loser.path] = loser.value;
    report.contested.push(loser.path);
  }
  report.unknown = walk.unknown.slice();

  if (Object.keys(rejected).length) {
    const prev = isPlainObject(out._unmigrated) ? out._unmigrated : {};
    out._unmigrated = { ...prev, ...rejected };
  }
  return out;
}

/** Заполнить то, чего нет: сперва схемой (МГ2), затем скелетом веток без контрола. */
function fillDefaults(cfg: Dict): Dict {
  const fromSchema = buildDefaultConfig(SCHEMA);
  const fill = (defaults: Dict, prefix: string): void => {
    for (const key of Object.keys(defaults)) {
      const path = prefix ? prefix + "." + key : key;
      const value = defaults[key];
      if (isPlainObject(value)) {
        fill(value, path);
        continue;
      }
      if (getIn(cfg, path) === undefined) setIn(cfg, path, cloneJson(value));
    }
  };
  /* Скелет идёт ПЕРВЫМ, и это не косметика. Три значения приоритета Prefix
     обязаны прийти от движка, а не из схемы: у схемы там другие умолчания, и
     заполнение схемой вперёд скелета переписало бы вид уже написанных строк
     (8.3). Оба прохода заполняют только отсутствующее, поэтому порядок и
     решает спор. */
  for (const path of Object.keys(V2_SKELETON)) {
    if (getIn(cfg, path) === undefined) setIn(cfg, path, cloneJson(V2_SKELETON[path]));
  }
  fill(fromSchema, "");
  return cfg;
}

export interface MigrateOptions {
  /** Куда сообщить про `_unmigrated`. По умолчанию — один `console.warn`. */
  log?: (message: string) => void;
  /** Отчёт заполняется на месте: тесту нужны имена, а не только конфиг. */
  report?: MigrateReport;
  /**
   * Литеральные умолчания пути служебного файла правил — признак «человек
   * путь не менял» при переезде в папку плагина (В-39). Приходит швом, а не
   * читается из `pkm_option_keys`: у модуля миграции обращений к движку нет.
   */
  legacyRulesDefaults?: readonly string[];
}

/**
 * МГ1: `migrate(migrate(x))` даёт то же, что `migrate(x)`.
 *
 * Идемпотентность держится не сравнением, а версией: после первого прохода
 * `schemaVersion` равен 2, и ветка 1 → 2 больше не выполняется — остаётся
 * только досыпка умолчаний, которая сама по себе идемпотентна.
 */
export function migrate(raw: unknown, opts?: MigrateOptions): Dict {
  const report: MigrateReport = opts && opts.report
    ? opts.report
    : { unknown: [], contested: [], migrated: false };
  report.unknown = [];
  report.contested = [];
  report.migrated = false;

  const source: Dict = isPlainObject(raw) ? raw : {};
  const version = Number(source.schemaVersion) || 0;

  let out: Dict;
  if (version >= SCHEMA_VERSION_V2) {
    out = cloneJson(source);
  } else {
    out = migrateV1(source, report);
    report.migrated = true;
  }

  fillDefaults(out);
  out.schemaVersion = SCHEMA_VERSION_V2;

  if (report.migrated && (report.unknown.length || report.contested.length)) {
    const log = (opts && opts.log) || ((m: string) => console.warn(m));
    const parts: string[] = [];
    if (report.unknown.length) {
      parts.push("незнакомые ветки сохранены в _unmigrated: " + report.unknown.join(", "));
    }
    if (report.contested.length) {
      parts.push("старые значения уступили тому, что записано в новой панели, и сохранены в _unmigrated: "
        + report.contested.join(", "));
    }
    log("inlineOverhaul, миграция конфига 1 → 2. " + parts.join("; "));
  }

  return out;
}

/* ---- границы с миром: МГ4 и МГ6 --------------------------------------- */

/**
 * Файловые операции в папке плагина. Шов существует ровно затем, чтобы
 * проверка не подделывала весь плагин ради чтения одного файла: в Obsidian
 * сюда приходит `app.vault.adapter`, в проверке — карта в памяти.
 *
 * Почему не `plugin.saveData` — МГ4 требует именно независимого пути: копия
 * должна лечь рядом файлом, которого сам плагин потом не трогает.
 */
export interface VaultFiles {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  /** Удаление файла. Нужно одному месту — сироте в корне vault (В-39). */
  remove?(path: string): Promise<void>;
}

function join(dir: string, name: string): string {
  const base = String(dir || "").replace(/[/\\]+$/, "");
  return base ? base + "/" + name : name;
}

/**
 * МГ4. Разовая копия исходного `data.json` рядом с ним. Если копия уже есть —
 * не перезаписывается: вторая миграция затёрла бы единственный снимок до
 * переезда.
 */
export async function backupV1Once(files: VaultFiles, dir: string, originalText: string): Promise<"created" | "kept"> {
  const target = join(dir, BACKUP_V1_FILE);
  if (await files.exists(target)) return "kept";
  await files.write(target, originalText);
  return "created";
}

/**
 * Переезд служебного файла правил из корня vault в папку плагина
 * (решение заказчика В-39 от 2026-09-04).
 *
 * **Путь считается, а не берётся литералом:** папка плагина зависит от
 * `vault.configDir`, и у того, кто держит настройки Obsidian не в `.obsidian`,
 * литерал был бы неверен. Литерал в `pkm_option_keys.DEFAULT_RULES_PATH`
 * остаётся только на случай, когда конфига нет вовсе.
 *
 * Свой путь человека не трогается. «Свой» — это любой, кроме прежнего места и
 * литеральных умолчаний: только по ним видно, что человек путь не менял.
 *
 * Файл в корне удаляется, а не остаётся сиротой: он читается как «правила»
 * последним запасным кандидатом, и заметка, которую никто не пишет, но все
 * читают, — худшее из двух состояний.
 */
export async function moveGeneratedRulesIntoPluginFolder(
  files: VaultFiles,
  dir: string,
  cfg: Dict,
  legacyDefaults: readonly string[],
): Promise<{ path: string; moved: boolean; orphanRemoved: boolean }> {
  const target = join(dir, RULES_FILE);
  const current = String(getIn(cfg, "advanced.generatedRulesPath") || "").trim();
  const untouched = !current || current === LEGACY_RULES_FILE
    || legacyDefaults.indexOf(current) !== -1 || current === target;
  if (!untouched) return { path: current, moved: false, orphanRemoved: false };
  setIn(cfg, "advanced.generatedRulesPath", target);
  let orphanRemoved = false;
  if (typeof files.remove === "function") {
    try {
      if (await files.exists(LEGACY_RULES_FILE)) {
        await files.remove(LEGACY_RULES_FILE);
        orphanRemoved = true;
      }
    } catch (_err) { /* сирота не удалилась — это не повод не стартовать */ }
  }
  return { path: target, moved: current !== target, orphanRemoved };
}

export interface LoadResult {
  config: Dict;
  /** Что случилось с файлом: прочитан, отсутствовал, не разобрался. */
  state: "read" | "absent" | "broken";
  /** Куда положена копия нечитаемого файла (МГ6). */
  brokenSavedAs?: string;
  /** Куда положена копия v1 до переезда (МГ4). */
  backupSavedAs?: string;
  /** Куда уехал служебный файл правил, если путь был прежним (В-39). */
  rulesPathMovedTo?: string;
  /** Сирота в корне vault, если она была и удалилась (В-39). */
  legacyRulesRemoved?: string;
  /** Положен ли стартовый набор Fields первой установке (ПЗ1). */
  starterSet?: boolean;
  report: MigrateReport;
}

/**
 * МГ6. Нечитаемый `data.json` не перезаписывается молча: файл сохраняется
 * рядом как `data.broken.json`, плагин стартует на значениях по умолчанию и
 * один раз сообщает об этом.
 *
 * Существующая копия не перезаписывается по той же причине, что и в МГ4:
 * первая копия ближе всего к настоящим настройкам пользователя. Куда легла
 * копия — сказано в уведомлении, а не только в консоли.
 */
export async function loadConfig(
  files: VaultFiles,
  dir: string,
  notify?: (message: string) => void,
  opts?: MigrateOptions,
): Promise<LoadResult> {
  const report: MigrateReport = { unknown: [], contested: [], migrated: false };
  const merged: MigrateOptions = { ...(opts || {}), report };
  const configPath = join(dir, CONFIG_FILE);
  const legacyDefaults = (opts && opts.legacyRulesDefaults) || [];

  /*
   * Переезд служебного файла правил делается **на каждом из трёх выходов**, а
   * не на одном: конфига может не быть вовсе, он может не разобраться, и в
   * обоих случаях путь всё равно приходит из умолчаний — то есть прежний.
   */
  const withRulesPath = async (result: LoadResult): Promise<LoadResult> => {
    const move = await moveGeneratedRulesIntoPluginFolder(
      files, dir, result.config, legacyDefaults);
    if (move.moved) result.rulesPathMovedTo = move.path;
    if (move.orphanRemoved) result.legacyRulesRemoved = LEGACY_RULES_FILE;
    return result;
  };

  if (!(await files.exists(configPath))) {
    /*
     * ПЗ1: файла не было вовсе — значит, это первая установка, и человек
     * получает стартовый набор Fields. Только здесь: у нечитаемого файла
     * (`broken` ниже) настройки у человека были, и класть ему поверх аварии
     * чужие Fields нельзя.
     */
    const fresh = migrate(null, merged) as Dict;
    const seeded = applyStarterSet(fresh);
    return withRulesPath({
      config: fresh, state: "absent", report, ...(seeded ? { starterSet: true } : {}),
    });
  }

  const text = await files.read(configPath);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (_err) {
    const target = join(dir, BROKEN_FILE);
    if (!(await files.exists(target))) await files.write(target, text);
    if (notify) {
      notify("inlineOverhaul could not read its settings file. A copy is kept at "
        + target + " and the plugin started with default settings");
    }
    return withRulesPath({
      config: migrate(null, merged), state: "broken", brokenSavedAs: target, report,
    });
  }

  const version = isPlainObject(raw) ? Number(raw.schemaVersion) || 0 : 0;
  const result: LoadResult = { config: {}, state: "read", report };
  if (version < SCHEMA_VERSION_V2) {
    const backup = await backupV1Once(files, dir, text);
    if (backup === "created") result.backupSavedAs = join(dir, BACKUP_V1_FILE);
  }
  result.config = migrate(raw, merged);
  return withRulesPath(result);
}
