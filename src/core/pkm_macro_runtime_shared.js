"use strict";

/*
 * Общая часть макро-рантайма: один статический `require` на модуль (У-89).
 *
 * Загрузки модуля по пути внутри vault здесь больше нет вовсе. Мост её
 * делал через реестр забандленных путей; после снятия моста тут стояла
 * таблица «путь → литеральный `require`» — временная, на то время, пока
 * движки просили модуль по пути. Ни один больше не просит, и таблица
 * ушла вместе с ними: путей внутри vault в рантайме не осталось ни
 * одного, и это проверяется сплошным обходом в `release_bundle_tests.js`.
 *
 * Осталось то, что загрузкой не было: пять швов, которыми движки под З3
 * достают чужие модули по имени, и публикация в `globalThis` для тех,
 * кто читает их оттуда.
 */

const facade = require("./pkm_runtime_preload_facade.js");
const optionKeys = require("./pkm_option_keys.js");

async function loadRuntimePreloadFacade() {
  globalThis.__inlineRuntimePreloadFacade = facade;
  return facade;
}

function normalizeOrderKeyLocal(key) {
  return String(key || "").trim();
}

async function loadOrderKeyNormalizer(app_, fallbackNormalize) {
  const fallback = typeof fallbackNormalize === "function" ? fallbackNormalize : normalizeOrderKeyLocal;
  return facade.loadOrderKeyNormalizer(fallback);
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
  normalizeOrderKeyLocal,
  loadOrderKeyNormalizer,
  loadLinePipeline,
  loadMacroShared,
  loadRulesRuntimeHelpers,
  loadPkmOptionKeys,
};
