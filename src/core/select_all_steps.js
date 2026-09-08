"use strict";

/*
 * Ступени расширенного `Ctrl+A`: какие бывают, в каком порядке идут и какие
 * из них берёт каждый режим.
 *
 * **Почему отдельный модуль.** Один и тот же список спрашивают трое: движок
 * (`src/features/enhanced_select_all_engine.js`) — что выделять; нормализация
 * конфига (`src/core/config_normalize.js`) — какие значения законны и что
 * стоит в галочках по умолчанию; панель
 * (`src/ui/settings/custom/select_all_custom.ts`) — какие строки нарисовать.
 * Три объявления одного правила расходятся молча (У-32), и в соседнем движке
 * это уже стоило трёх расхождений подряд.
 *
 * Порядок ступеней задаёт здесь и только здесь `SELECT_ALL_STEP_IDS`:
 * галочки режима `Custom` выбирают **ступени**, а не их порядок (решение
 * заказчика 2026-09-08, З-3). Его пример — `word`, `line`, `note` — идёт этим
 * же порядком.
 */

/** Ступени от самой узкой к самой широкой. Порядок цикла — этот. */
const SELECT_ALL_STEP_IDS = ["word", "line", "tree", "heading", "note"];

/** Режим `Custom`: ступени берутся не отсюда, а из галочек человека. */
const SELECT_ALL_CUSTOM_MODE = "custom";

/**
 * Готовые режимы. Значение ключа — список ступеней; `null` у `custom` значит
 * «спросить конфиг», и это не то же самое, что пустой список.
 */
const SELECT_ALL_MODE_STEPS = {
  "line-note": ["line", "note"],
  "line-tree-note": ["line", "tree", "note"],
  "line-tree-header-note": ["line", "tree", "heading", "note"],
  "word-line-tree-header-note": ["word", "line", "tree", "heading", "note"],
  [SELECT_ALL_CUSTOM_MODE]: null,
};

/** Законные значения `editor.selectAll.mode`. Их же перечисляет схема. */
const SELECT_ALL_MODE_IDS = Object.keys(SELECT_ALL_MODE_STEPS);

/** Режим, к которому сводится всё непонятное, — он же умолчание схемы. */
const SELECT_ALL_FALLBACK_MODE = "line-note";

/**
 * Что отмечено в `Custom` у того, кто его только что выбрал.
 *
 * Отмечены те же две ступени, что делает умолчание списка режимов: человек
 * переключился на `Custom`, чтобы что-то добавить, и до первой галочки
 * клавиша обязана вести себя так же, как вела.
 */
const SELECT_ALL_CUSTOM_DEFAULTS = {
  word: false,
  line: true,
  tree: false,
  heading: false,
  note: true,
};

function isPlainObject(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

/**
 * Привести галочки к пяти булевым: чего нет — умолчание, что не булево —
 * умолчание, лишние ключи не переживают.
 */
function normalizeCustomSteps(raw) {
  const src = isPlainObject(raw) ? raw : null;
  const out = {};
  for (const id of SELECT_ALL_STEP_IDS) {
    out[id] = src && typeof src[id] === "boolean" ? src[id] : SELECT_ALL_CUSTOM_DEFAULTS[id];
  }
  return out;
}

/**
 * Ступени этого режима по порядку.
 *
 * У `Custom` список бывает пустым — человек снял все галочки. Это законное
 * состояние: движок тогда не делает ничего, и `Ctrl+A` остаётся клавишей
 * Obsidian. Пустой список поэтому и возвращается пустым, а не подменяется
 * умолчанием.
 */
function stepsForMode(mode, customSteps) {
  const name = String(mode || "");
  if (name === SELECT_ALL_CUSTOM_MODE) {
    const picked = normalizeCustomSteps(customSteps);
    return SELECT_ALL_STEP_IDS.filter((id) => picked[id] === true);
  }
  const named = SELECT_ALL_MODE_STEPS[name];
  if (Array.isArray(named)) return named.slice();
  return SELECT_ALL_MODE_STEPS[SELECT_ALL_FALLBACK_MODE].slice();
}

module.exports = {
  SELECT_ALL_STEP_IDS,
  SELECT_ALL_MODE_IDS,
  SELECT_ALL_MODE_STEPS,
  SELECT_ALL_CUSTOM_MODE,
  SELECT_ALL_CUSTOM_DEFAULTS,
  SELECT_ALL_FALLBACK_MODE,
  normalizeCustomSteps,
  stepsForMode,
};
