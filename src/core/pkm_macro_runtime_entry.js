"use strict";

/*
 * Точка входа макро-рантайма: собирает объект, через который движки под З3
 * достают чужие модули.
 *
 * Мост модулей отсюда ушёл (У-89): общая часть приезжает литеральным `require`,
 * а не поиском по пути внутри vault. Вместе с ним ушли `ensureVaultBridge`,
 * свой ключ кеша и ветка «моста нет — бросаем исключение с его именем».
 *
 * Методы `loadVaultModuleBridgeShared` и `loadVaultModule` сняты: первый
 * прогревал мост, второй искал модуль по пути внутри vault. Обоих предметов
 * больше нет, а функция, которая делает вид, что грузит снятую вещь, — это
 * заглушка, и заглушек здесь быть не должно (У-90).
 */

const shared = require("./pkm_macro_runtime_shared.js");

function normalizeOrderKeyDefault(key) {
  return String(key || "").trim();
}

async function loadMacroRuntimeShared() {
  globalThis.__inlinePkmMacroRuntimeSharedMod = shared;
  return shared;
}

async function bootstrapMacroRuntime(app_, normalizeOrderKeyLocal) {
  await loadMacroRuntimeShared();
  const normalizeKey = typeof normalizeOrderKeyLocal === "function"
    ? normalizeOrderKeyLocal
    : normalizeOrderKeyDefault;
  return {
    loadRuntimePreloadFacade: () => shared.loadRuntimePreloadFacade(app_),
    loadMacroShared: () => shared.loadMacroShared(app_),
    loadRulesRuntimeHelpers: () => shared.loadRulesRuntimeHelpers(app_),
    loadLinePipeline: () => shared.loadLinePipeline(app_),
    loadOrderKeyNormalizer: () => shared.loadOrderKeyNormalizer(app_, normalizeKey),
    loadPkmOptionKeys: () => shared.loadPkmOptionKeys(app_),
  };
}

module.exports = {
  loadMacroRuntimeShared,
  bootstrapMacroRuntime,
};
