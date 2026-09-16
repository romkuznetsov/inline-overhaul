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

/*
 * Нормализатора ключа Order здесь больше нет — ни доводом, ни методом
 * рантайма (10.13.168). Довод ехал от движка через пять слоёв, и каждое
 * «иначе своё» на каждом слое было переходником к одному дому —
 * `normalizeOrderKey` в `shared_utils.js`. Потребители спрашивают дом сами.
 */
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
