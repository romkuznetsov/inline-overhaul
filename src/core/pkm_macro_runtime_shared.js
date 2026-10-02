"use strict";

/*
 * Общая часть макро-рантайма: один статический `require` на модуль (У-89).
 * Путей внутри vault в рантайме нет (сплошной обход — `release_bundle_tests.js`).
 * Здесь пять швов, которыми движки под З3 достают чужие модули по имени, и
 * публикация в `globalThis` для тех, кто читает их оттуда.
 */

const facade = require("./pkm_runtime_preload_facade.js");
const optionKeys = require("./pkm_option_keys.js");

async function loadRuntimePreloadFacade() {
  globalThis.__inlineRuntimePreloadFacade = facade;
  return facade;
}

async function loadLinePipeline() {
  return facade.loadLinePipeline();
}

async function loadMacroShared() {
  return facade.loadMacroShared();
}

async function loadRulesRuntimeHelpers() {
  return facade.loadRulesRuntimeHelpers();
}

async function loadPkmOptionKeys() {
  globalThis.__inlinePkmOptionKeysMod = optionKeys;
  return optionKeys;
}

module.exports = {
  loadRuntimePreloadFacade,
  loadLinePipeline,
  loadMacroShared,
  loadRulesRuntimeHelpers,
  loadPkmOptionKeys,
};
