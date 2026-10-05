/**
 * Миграция конфига v1 → v2 (PRD 8.1, 8.1а, 8.2). Чистая `migrate(raw)` и две
 * границы: разовая копия (МГ4) и нечитаемый `data.json` (МГ6). Obsidian — только
 * швами `VaultFiles` и `notify`. Вторая ступень `migrateConfig`, прогоняется на
 * каждом патче.
 *
 * 1. `leftMode`/`rightMode` — не Left/Right Block, а списки Fields по типу:
 *    переезжают в `pkm.fields.tags` и `pkm.fields.links` (В9).
 * 2. Непрозрачные ветки (`order`, `byTag`, `taxonomy`, `binderRows`) — целиком
 *    (`whole`): внутри пользовательские ключи.
 * 3. Прозрачность: v1 — доля `0..1`, v2 — проценты `0..100`.
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
 * Служебный файл правил: плагин его не пишет (PRD 10.13.52, П-8); имена — чтобы
 * прибрать за прошлыми версиями.
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
 * Что делать с веткой v1: `to` — куда (у `keep` = исходный путь); `drop` —
 * удалить (8.1); `whole` — непрозрачная; `cast` — меняет единицы. Пути без
 * маршрута разбираются по ключам, лист — в `_unmigrated` (МГ3).
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
 * Карта маршрутов. Читают `tools/read_map_v1.js` и проверка МГ5; мост
 * `v1_bridge.ts` снят (М-5). Второй копии быть не должно.
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
  /* Цвет подсветки перенесённых строк (цикл 118): пары в v1 нет. */
  keepV2("navigation.moveLine.highlightColor"),
  /* 10.13.36: пары в v1 нет — `keepV2`, иначе `_unmigrated` (МГ3). */
  keepV2("navigation.moveLine.keepInView"),
  keepV2("navigation.moveLine.viewPosition"),
  /* 10.13.275, пары в v1 нет — `keepV2`. */
  keepV2("navigation.moveLine.jumpNeighborTrees"),
  keep("navigation.moveSelection.enabled"),
  keep("navigation.moveSelection.inlineEnabled"),
  keep("navigation.moveSelection.prefixCyclerEnabled"),
  keep("navigation.moveSelection.indentFallbackEnabled"),
  /* В-257, пары в версии 1 нет — `keepV2`. */
  keepV2("navigation.moveSelection.indentWithChildren"),
  keep("navigation.moveSelection.onCycleEnd"),
  keep("navigation.moveSelection.inlineMoveMode"),
  keep("navigation.moveSelection.cycleOrder", true),
  keepV2("navigation.moveSelection.rightCycles"),
  /* Пары в v1 нет — `keepV2` (МГ3). */
  keepV2("navigation.moveSelection.inlineBoundaryJump"),
  /* `Step out of the word` (2026-09-08): пары в v1 нет (МГ3). */
  keepV2("navigation.moveSelection.inlineWordEscape"),
  keep("navigation.jumpToHeader.enabled"),
  keep("navigation.jumpToHeader.centerCursor"),
  /* 10.13.37: пары в v1 нет (МГ3). */
  keepV2("navigation.jumpToHeader.viewPosition"),
  keep("navigation.jumpToHeader.centerDelayMs"),
  keep("navigation.jumpToHeader.centerThrottleMs"),
  keep("navigation.jumpToHeader.jumpMode"),
  keep("navigation.jumpToHeader.edgeMode"),
  keep("navigation.jumpToHeader.jumpCursorPosition"),
  /* Подсветка прыжка (Н5) живёт в `visual.jumpFlash.*` — маршруты рядом с вкладкой Visual. */
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
  /* Высота таблицы Fields (2026-09-12): в файлах v1 не встречалась — `keepV2`. */
  keepV2("ui.fieldsTableFixedHeight"),

  /* --- PKM: определения Fields (В9) ------------------------------------ */
  move("pkm.behavior.order", "pkm.fields.order", { whole: true }),
  move("pkm.behavior.leftMode", "pkm.fields.tags", { whole: true }),
  move("pkm.behavior.rightMode", "pkm.fields.links", { whole: true }),
  move("pkm.behavior.elements", "pkm.fields.elements", { whole: true }),
  /*
   * Легаси-ветка дат едет целиком, иначе лист за листом ушла бы в `_unmigrated`.
   * Третья ступень (`ensureBehaviorModesFromOrder`) сворачивает её в
   * `pkm.fields.elements`.
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
  /* Снят 2026-10-01 (цикл 114): `Insert only` всегда ставит разделители. */
  drop("pkm.behavior.freeRoam.minimalSeparator"),
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
  /* Путь файла правил снят вместе с файлом (PRD 10.13.52, П-8; З8). */
  drop("pkm.generatedRulesPath"),

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
  /* Цель переезда снята 2026-09-19 — ключ v1 удаляется. */
  drop("pkm.behavior.tagVisuals.showColorSettings"),

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
  /* Цвета гиперссылки (2026-09-22): пары в v1 нет (МГ3). */
  keepV2("visual.tags.hyperlink.targetColor"),
  keepV2("visual.tags.hyperlink.bracketsColor"),
  keepV2("visual.tags.hyperlink.addressColor"),
  keepV2("visual.tags.opacityLeft"),
  keepV2("visual.tags.opacityRight"),
  keepV2("visual.tags.textSizePct"),
  keepV2("visual.tags.textSizePctLeft"),
  keepV2("visual.tags.textSizePctRight"),
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
  /* Цвет ячейки выбранного значения (2026-09-17): пары в v1 нет (МГ3). */
  keepV2("visual.tagWheel.chosenValueColor"),
  /* Полужирные имена Field (2026-10-01): ветка новая. */
  keepV2("visual.tagWheel.boldFieldNames"),
  keepV2("visual.tagWheel.fillColor"),
  keepV2("visual.tagWheel.scroller.enabled"),
  keepV2("visual.tagWheel.scroller.direction"),
  keepV2("visual.tagWheel.scroller.labels"),
  keepV2("visual.tagWheel.scroller.size"),
  /* Подсветка прыжка: пары в v1 нет (МГ3); прежний адрес — в `MOVED_V2_KEYS`. */
  keepV2("visual.jumpFlash.enabled"),
  keepV2("visual.jumpFlash.color"),
  keepV2("visual.jumpFlash.radius"),
  keepV2("visual.jumpFlash.fadeMs"),
  keepV2("visual.jumpFlash.quietMs"),
  keepV2("visual.jumpFlash.inLine"),

  /* --- Transform -------------------------------------------------------- */
  drop("transform.inline2fleet"),
  keep("transform.inline2note.enabled"),
  keep("transform.inline2note.outputFolder"),
  keep("transform.inline2note.defaultTemplate"),
  keep("transform.inline2note.yamlNoteFormat"),
  keep("transform.inline2note.smartRules", true),
  keepV2("transform.inline2note.placement.headerLevel"),
  /* `At custom header` (З-4): пары в v1 нет (МГ3). */
  keepV2("transform.inline2note.placement.targetHeader"),
  keepV2("transform.inline2note.placement.fallback"),
  /* Ссылка на новую заметку (Н4): пары в v1 нет (МГ3). */
  keepV2("transform.inline2note.backlink.enabled"),
  /* `Link to Navigator` и `Keep sub-fields` (PRD 10.13.272): ключи новые. */
  keepV2("transform.inline2note.backlink.navigator"),
  /* `Add empty line before wikilink` (2026-09-28): ключ новый. */
  keepV2("transform.inline2note.backlink.emptyLine"),
  keepV2("transform.inline2note.sourceProcessing.keepSubFields"),
  keepV2("transform.inline2note.backlink.placement.position"),
  keepV2("transform.inline2note.backlink.placement.targetHeader"),
  keepV2("transform.inline2note.backlink.placement.fallback"),
  /* `Place in the list` и `Add after the link` (цикл 136): ключи новые. */
  keepV2("transform.inline2note.backlink.placement.order"),
  keepV2("transform.inline2note.backlink.suffix.mode"),
  keepV2("transform.inline2note.backlink.suffix.field"),
  keepV2("transform.inline2note.backlink.suffix.emoji"),
  keepV2("transform.inline2note.backlink.suffix.format"),
  keep("transform.inline2note.noteName.mode"),
  keep("transform.inline2note.noteName.preferHeaderTitle"),
  keep("transform.inline2note.nameCollision.mode"),
  keep("transform.inline2note.placement.position"),
  keep("transform.inline2note.placement.headerMode"),
  keep("transform.inline2note.preview.sampleLine"),
  keep("transform.inline2note.sourceProcessing.cleanupFieldIds", true),
  /*
   * Ветка целиком — и три листа отдельно: у каждого свой контрол (10.13.12), а
   * `settings_paths_v2_tests.ts` спрашивает маршрут у пути контрола.
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
  /* Ключа нет в старых файлах; умолчание выводит движок из `replaceWithLink`. */
  keepV2("transform.inline2note.sourceProcessing.text"),
  keepV2("transform.inline2note.sourceProcessing.keepWords"),
  keepV2("transform.inline2note.openTarget"),
  keepV2("transform.inline2note.sublines"),
  keepV2("transform.inline2note.floatingButton"),
  /* Ключа нет в старых файлах; умолчание — из схемы. */
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
  /* Галочки `Custom` (З-3): пары в v1 нет; форму ветки держит нормализация (МГ3). */
  keepV2("editor.selectAll.customSteps", true),
  /* Заливка Left и Right Block (З-7): пары в v1 нет. */
  keepV2("visual.tags.blockFill.enabled"),
  keepV2("visual.tags.blockFill.color"),
  keepV2("visual.tags.blockFill.opacity"),
  /* S7, 2026-09-09: высота стала `heightPct` (переводит третья ступень); маршрут
     прежнего имени — чтобы файл v1 не уехал в `_unmigrated`. */
  keepV2("visual.tags.blockFill.heightPx"),
  keepV2("visual.tags.blockFill.heightPct"),
  keepV2("visual.tags.blockFill.widthPct"),
  /* Сторона полосы (З-12): пары в v1 нет. */
  keepV2("visual.tags.blockFill.direction"),
  /* Автокопия (З-11): пары в v1 нет. */
  keepV2("advanced.backups.autosave"),
  /* Предел автокопий (10.13.304): пары в v1 нет. */
  keepV2("advanced.backups.autosaveKeep"),
  keepV2("editor.binder.rows", true),
  keepV2("general.help.showTips"),
  /* `Show callouts` (10.13.27): ключа нет в старых файлах, умолчание — схема. */
  keepV2("general.help.showCallouts"),
  /* Язык панели (10.13.38): пары в v1 нет, иначе `_unmigrated`. */
  keepV2("general.language"),
  keepV2("advanced.newSettingsPane"),
  /* Подпись id в подсказках (10.13.5): пары в v1 нет, маршрут — против `_unmigrated`. */
  keepV2("advanced.showSettingIds"),
  /* Папка копий (10.13.2, Б2): в v1 не было. */
  keepV2("advanced.backups.folder"),
  /* Копия перед восстановлением (C56): пары в v1 нет. */
  keepV2("advanced.backups.beforeRestore"),
  drop("advanced.generatedRulesPath"),
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
  keepV2("pkm.placement.fieldPrefixInsertOnly"),
  keepV2("pkm.placement.bulletInStrict"),
  keepV2("pkm.placement.typedTagsStayText"),
  keepV2("pkm.placement.freeInsertPosition"),
  keepV2("pkm.prefixPriority.decideBy"),
  keepV2("pkm.prefixPriority.fieldOrderSource"),
  keepV2("pkm.prefixPriority.parentOrChild"),
  keepV2("pkm.prefixRules.resolver"),
  keepV2("pkm.prefixRules.priorityTargets", true),
  keepV2("pkm.prefixRules.priorityCheckboxes", true),
  keepV2("pkm.prefixRules.checkboxByFieldValue", true),
  drop("pkm.configNote"),
  /* Флаг уведомления о смене ID команд (фаза 2, пункт 8): состояние, контрола нет. */
  keepV2("viewState.commandIdsNotice"),
  /*
   * `viewState.activeTab` и `viewState.fieldOrder.*` — вид старой панели,
   * снимаются списком снятых ключей (2026-09-19).
   */
  keepV2("_unmigrated", true),
]);

/**
 * Умолчания без контрола, а значит без схемы: пустые контейнеры (движок ждёт
 * объект) и три значения приоритета Prefix из `getPrefixRulesFromCfg` — не из
 * схемы, у неё другие умолчания (8.3), и вид строк бы переписался.
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
  /* Пустая ветка состояния: флаги «уже показывали». */
  "viewState": {},
};

/* ---- сама миграция ---------------------------------------------------- */

export interface MigrateReport {
  /** Ветки v1, для которых маршрута нет: сложены в `_unmigrated` (МГ3). */
  unknown: string[];
  /**
   * Пути, за которые спорили обе формы: победила v2, проигравшее v1 — в `_unmigrated` (МГ7).
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
 * Приземления — в плоскую карту `путь → значение`, потом в объект: спор за
 * путь решается правилом, а не порядком обхода. Побеждает форма v2 — её пишет
 * только контрол новой панели, а v1 в споре чаще нетронутое умолчание.
 * Проигравшее — в `_unmigrated` (МГ7).
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

  /* Ветка `rules` выбрасывается целиком; путь файла правил снят (PRD 10.13.52, П-8). */

  for (const key of Object.keys(raw)) {
    if (key === "schemaVersion") continue;
    collect(raw[key], key, walk);
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
  /* Скелет первым: приоритет Prefix — от движка, не из схемы (8.3). Оба прохода
     заполняют только отсутствующее, порядок и решает. */
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
}

/**
 * Ключи, снятые вместе с функцией, уходят из файла человека на каждом проходе:
 * маршруты читает только переезд с v1, файл v2 клонируется (З8, У-178). Только
 * для ключей со снятой функцией.
 */
const REMOVED_V2_KEYS: readonly string[] = [
  "advanced.generatedRulesPath",
  "pkm.generatedRulesPath",
  /*
   * Кеш конфиг-заметки TagWheel, снятой решением В-28 (PRD 10.12): ветку не
   * читает никто, а правка в ней путала (2026-09-19). Значения Field —
   * в `pkm.fields.links.fields[].values[]`.
   */
  "pkm.fields.taxonomy.tagWheelConfig",
  /*
   * Три листа приставок v1: их перекрывает `pkm.prefixPriority.*` в
   * `pkm_rules_shape` — не читает никто (`tools/dead_keys.js`, 2026-09-19).
   * Остальная `pkm.prefixRules` жива.
   */
  "pkm.prefixRules.priorityMode",
  "pkm.prefixRules.fieldsOrderMode",
  "pkm.prefixRules.tagSubtagPriority",
  /*
   * Без читателя, кроме нормализации (`tools/dead_keys.js`, 2026-09-19):
   *
   *   * `pkm.configNote.*` — конфиг-заметка (В-28);
   *   * `ui.visualSubTab`, `ui.hotkeysSubTab`, `ui.pkmSubTab` — подвкладки старой панели (10.13.197);
   *   * `ui.orderShow*`, `ui.orderActiveCommandsCollapsed` — сняты в Ф15;
   *   * `viewState.activeTab`, `viewState.fieldOrder.*` — вкладку помнит `ui.activeSettingsTab`;
   *   * `advanced.newSettingsPane` — панель одна.
   */
  "pkm.configNote",
  "ui.visualSubTab",
  "ui.hotkeysSubTab",
  "ui.pkmSubTab",
  "ui.orderShowInfoTips",
  "ui.orderShowDeepEditor",
  "ui.orderShowColorSettings",
  "ui.orderActiveCommandsCollapsed",
  "viewState.activeTab",
  "viewState.fieldOrder",
  "advanced.newSettingsPane",
  /*
   * `Insert only: keep Separators` снят 2026-10-01 (цикл 114, тест 6). Движок
   * читает «не `false` — да», без ключа — «да».
   */
  "pkm.placement.keepPrefixInsertOnly",
];

/**
 * Ключи, сменившие адрес внутри v2 (У-178): файл v2 маршрутов не проходит,
 * и значение осталось бы по старому адресу. Новый адрес сильнее старого.
 * Адресов бывает несколько — прежнее значение уступает всем (У-17), одним
 * списком (У-150). Сейчас: подсветка прыжка → Visual (2026-09-17, 10.13.41).
 */
const MOVED_V2_KEYS: ReadonlyArray<readonly [string, string | readonly string[]]> = [
  /* Кегль Block разведён на две стороны (2026-09-19, пункт 2). */
  ["visual.tags.textSizePct", ["visual.tags.textSizePctLeft", "visual.tags.textSizePctRight"]],
  ["navigation.jumpToHeader.flash.enabled", "visual.jumpFlash.enabled"],
  ["navigation.jumpToHeader.flash.color", "visual.jumpFlash.color"],
  ["navigation.jumpToHeader.flash.radius", "visual.jumpFlash.radius"],
  ["navigation.jumpToHeader.flash.fadeMs", "visual.jumpFlash.fadeMs"],
  ["navigation.jumpToHeader.flash.quietMs", "visual.jumpFlash.quietMs"],
  ["navigation.jumpToHeader.flash.inLine", "visual.jumpFlash.inLine"],
];

/**
 * Настройка, разделившаяся надвое: прежний адрес жив, новый заводится от него
 * (не `MOVED_V2_KEYS`, правило 117). Цвета ссылок: wikilink и гиперссылка
 * (2026-09-22, У-17). Заводится только отсутствующий ключ: пустая строка —
 * законное «взять у темы» (У-188).
 */
const SPLIT_V2_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["visual.tags.linkAsWritten.targetColor", "visual.tags.hyperlink.targetColor"],
  ["visual.tags.linkAsWritten.bracketsColor", "visual.tags.hyperlink.bracketsColor"],
  /* Адрес отделён от скобок 2026-09-22. */
  ["visual.tags.hyperlink.bracketsColor", "visual.tags.hyperlink.addressColor"],
];

/**
 * Снять лист и опустевшего родителя. Не помощник из `settings_backup.js`: там
 * пустые объекты остаются (путь устройства), здесь адрес снят насовсем
 * (правило 117).
 */
function dropMovedLeaf(cfg: Dict, path: string): void {
  const parts = path.split(".").filter((p) => p.length > 0);
  if (!parts.length) return;
  const chain: Dict[] = [];
  let node: unknown = cfg;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isPlainObject(node)) return;
    chain.push(node as Dict);
    node = (node as Dict)[parts[i] as string];
  }
  if (!isPlainObject(node)) return;
  chain.push(node as Dict);
  delete (node as Dict)[parts[parts.length - 1] as string];
  /* Пустой объект на прежнем месте — тоже мёртвая настройка. */
  for (let i = chain.length - 1; i > 0; i--) {
    const own = chain[i] as Dict;
    if (Object.keys(own).length) break;
    delete (chain[i - 1] as Dict)[parts[i - 1] as string];
  }
}

function moveRenamedKeys(cfg: Dict): void {
  for (const pair of MOVED_V2_KEYS) {
    const from = pair[0];
    const targets = typeof pair[1] === "string" ? [pair[1]] : pair[1];
    const was = getIn(cfg, from);
    if (was === undefined) continue;
    for (const to of targets) {
      if (getIn(cfg, to) === undefined) setIn(cfg, to, cloneJson(was) as never);
    }
    dropMovedLeaf(cfg, from);
  }
}

/** Завести новую половину разделившейся настройки; идемпотентно — второй проход ключ не трогает. */
function seedSplitKeys(cfg: Dict): void {
  for (const pair of SPLIT_V2_KEYS) {
    const was = getIn(cfg, pair[0]);
    if (was === undefined) continue;
    if (getIn(cfg, pair[1]) !== undefined) continue;
    setIn(cfg, pair[1], cloneJson(was) as never);
  }
}

function dropRemovedKeys(cfg: Dict): void {
  for (const path of REMOVED_V2_KEYS) {
    const parts = path.split(".").filter((p) => p.length > 0);
    if (!parts.length) continue;
    const leaf = parts[parts.length - 1] as string;
    let node: unknown = cfg;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isPlainObject(node)) break;
      node = (node as Dict)[parts[i] as string];
    }
    if (isPlainObject(node)) delete (node as Dict)[leaf];
  }
}

/**
 * МГ1: `migrate(migrate(x))` = `migrate(x)` — держится версией: после первого
 * прохода ветка 1 → 2 не выполняется, досыпка умолчаний идемпотентна.
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

  moveRenamedKeys(out);
  seedSplitKeys(out);
  dropRemovedKeys(out);
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
 * Файловые операции в папке плагина: в Obsidian — `app.vault.adapter`, в
 * проверке — карта в памяти. Не `plugin.saveData`: МГ4 требует независимого
 * файла рядом.
 */
export interface VaultFiles {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  /** Нужно одному месту — сироте в корне vault (В-39). */
  remove?(path: string): Promise<void>;
}

function join(dir: string, name: string): string {
  const base = String(dir || "").replace(/[/\\]+$/, "");
  return base ? base + "/" + name : name;
}

/**
 * МГ4: разовая копия исходного `data.json`. Существующая не перезаписывается —
 * это единственный снимок до переезда.
 */
export async function backupV1Once(files: VaultFiles, dir: string, originalText: string): Promise<"created" | "kept"> {
  const target = join(dir, BACKUP_V1_FILE);
  if (await files.exists(target)) return "kept";
  await files.write(target, originalText);
  return "created";
}

/**
 * Прибрать служебный файл правил (PRD 10.13.52, П-8): его положил плагин.
 * Адреса считаются: папка — от `vault.configDir`, свой путь — из конфига,
 * прочитанного до миграции (маршрута у ключа нет). Чужого не трогаем:
 * удаляется только с блоком сборщика (` ```tagwheel- `).
 */
export async function removeGeneratedRulesFile(
  files: VaultFiles,
  dir: string,
  rawCfg: unknown,
): Promise<string[]> {
  if (typeof files.remove !== "function") return [];
  const raw = isPlainObject(rawCfg) ? (rawCfg as Dict) : {};
  const candidates: string[] = [join(dir, RULES_FILE), LEGACY_RULES_FILE];
  for (const path of ["advanced.generatedRulesPath", "pkm.generatedRulesPath", "rules.tagWheelPath"]) {
    const value = getIn(raw, path);
    const text = typeof value === "string" ? value.trim() : "";
    if (text && candidates.indexOf(text) === -1) candidates.push(text);
  }
  const removed: string[] = [];
  for (const path of candidates) {
    try {
      if (!(await files.exists(path))) continue;
      const body = await files.read(path);
      if (String(body || "").indexOf("```tagwheel-") === -1) continue;
      await files.remove(path);
      removed.push(path);
    } catch (_err) {
      /* Уборка: файла может уже не быть, или его держит синхронизация. Цель —
         чтобы его не осталось; не вышло сейчас — выйдет следующим запуском, и
         ронять из-за этого загрузку плагина нельзя. */
    }
  }
  return removed;
}

export interface LoadResult {
  config: Dict;
  /** Что случилось с файлом: прочитан, отсутствовал, не разобрался. */
  state: "read" | "absent" | "broken";
  /** Куда положена копия нечитаемого файла (МГ6). */
  brokenSavedAs?: string;
  /** Куда положена копия v1 до переезда (МГ4). */
  backupSavedAs?: string;
  /** Что убрано от снятого служебного файла правил (10.13.52). */
  generatedRulesRemoved?: string[];
  /** Положен ли стартовый набор Fields первой установке (ПЗ1). */
  starterSet?: boolean;
  report: MigrateReport;
}

/**
 * МГ6: нечитаемый `data.json` сохраняется как `data.broken.json`, старт на
 * умолчаниях, одно уведомление с адресом копии. Существующая копия не
 * перезаписывается (как МГ4).
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

  /*
   * Уборка файла правил — на каждом из трёх выходов: конфига нет, не
   * разобрался, а файл лежит.
   */
  let rawForCleanup: unknown = null;
  const withRulesPath = async (result: LoadResult): Promise<LoadResult> => {
    const removed = await removeGeneratedRulesFile(files, dir, rawForCleanup);
    if (removed.length) result.generatedRulesRemoved = removed;
    return result;
  };

  if (!(await files.exists(configPath))) {
    /*
     * ПЗ1: файла не было — первая установка, стартовый набор Fields. Не для
     * `broken`: настройки у человека были.
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
    /* Адрес — из прочитанного конфига: после миграции ключа нет. */
    rawForCleanup = raw;
  } catch (_err) {
    /*
     * Вторая поломка кладётся рядом с именем со временем (ревизия Д-9), а не
     * теряется.
     */
    let target = join(dir, BROKEN_FILE);
    if (await files.exists(target)) {
      const d = new Date();
      const two = (n: number): string => String(n).padStart(2, "0");
      const stamp = `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}`;
      target = join(dir, BROKEN_FILE.replace(/\.json$/, "." + stamp + ".json"));
    }
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
