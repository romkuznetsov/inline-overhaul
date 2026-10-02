"use strict";

const __sharedUtils = require("./shared_utils.js");

/*
 * Ступени расширенного `Ctrl+A`: какие, в каком порядке, какие берёт режим.
 * Один список для движка (`src/features/enhanced_select_all_engine.js`),
 * нормализации (`src/core/config_normalize.js`) и панели
 * (`src/ui/settings/custom/select_all_custom.ts`) (У-32). Порядок — только
 * `SELECT_ALL_STEP_IDS`; галочки `Custom` выбирают ступени (З-3).
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

/** Отмеченное в `Custom` при выборе: те же ступени, что у умолчания, — клавиша ведёт себя как вела. */
const SELECT_ALL_CUSTOM_DEFAULTS = {
  word: false,
  line: true,
  tree: false,
  heading: false,
  note: true,
};

function isPlainObject(x) {
  /* Это тот же вопрос, что `isObj`, и дом у него один (10.13.137). */
  return !!__sharedUtils.isObj(x);
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

/** Ступени режима по порядку. У `Custom` пустой список законен: `Ctrl+A` остаётся клавишей Obsidian, умолчанием не подменяется. */
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
