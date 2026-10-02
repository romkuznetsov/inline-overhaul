"use strict";

/*
 * Прослойка предзагрузки: литеральный `require` на модуль, без запасных путей —
 * не приехал, падаем громко (У-89, У-90).
 *
 * Ключи `globalThis` — шов, а не кеш: движки под З3 читают их сразу после
 * `load*`; снимать только вместе с этими чтениями. Асинхронность — ради их
 * `await`.
 */

const bootstrap = require("./pkm_runtime_bootstrap.js");
const linePipeline = require("./line_pipeline.js");
const macroShared = require("./pkm_macro_shared.js");
const rulesRuntimeHelpers = require("./pkm_rules_runtime_helpers.js");

async function loadRuntimeBootstrap() {
  return bootstrap;
}

async function loadLinePipeline() {
  globalThis.__inlineLinePipeline = linePipeline;
  return linePipeline;
}

async function loadMacroShared() {
  globalThis.__inlinePkmMacroShared = macroShared;
  return macroShared;
}

async function loadRulesRuntimeHelpers() {
  globalThis.__inlinePkmRulesHelpers = rulesRuntimeHelpers;
  return rulesRuntimeHelpers;
}

async function resolveOrderConfig(app_, settings, options) {
  const opts = options && typeof options === "object" ? options : {};
  return bootstrap.resolveOrderConfig(app_, settings, opts);
}

module.exports = {
  loadRuntimeBootstrap,
  loadLinePipeline,
  loadMacroShared,
  loadRulesRuntimeHelpers,
  resolveOrderConfig,
};
