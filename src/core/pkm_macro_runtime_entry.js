"use strict";

/*
 * Точка входа макро-рантайма: объект, через который движки под З3 достают
 * чужие модули. Общая часть — литеральным `require`, моста модулей нет (У-89);
 * заглушек снятых методов быть не должно (У-90).
 */

const shared = require("./pkm_macro_runtime_shared.js");

/* Нормализатор ключа Order — `normalizeOrderKey` в `shared_utils.js`, потребители спрашивают его сами (10.13.168). */
async function loadMacroRuntimeShared() {
  globalThis.__inlinePkmMacroRuntimeSharedMod = shared;
  return shared;
}

async function bootstrapMacroRuntime(app_) {
  await loadMacroRuntimeShared();
  return {
    loadRuntimePreloadFacade: () => shared.loadRuntimePreloadFacade(app_),
    loadMacroShared: () => shared.loadMacroShared(app_),
    loadRulesRuntimeHelpers: () => shared.loadRulesRuntimeHelpers(app_),
    loadLinePipeline: () => shared.loadLinePipeline(app_),
    loadPkmOptionKeys: () => shared.loadPkmOptionKeys(app_),
  };
}

module.exports = {
  loadMacroRuntimeShared,
  bootstrapMacroRuntime,
};
