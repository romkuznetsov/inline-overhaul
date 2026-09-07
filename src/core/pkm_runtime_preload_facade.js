"use strict";

/*
 * Прослойка предзагрузки: один статический `require` на модуль.
 *
 * Было — шесть слоёв, чтобы найти модуль, который уже лежит в бандле: движок
 * звал макро-рантайм, тот прослойку, прослойка загрузчик, загрузчик мост, мост
 * искал путь в реестре забандленных модулей. Каждый слой ловил отказ, кешировал
 * результат в своём ключе `globalThis` и отдавал `null`, если не вышло, — то
 * есть «работаем наполовину и молчим» (У-90).
 *
 * Стало — литеральный `require`. Причина в У-89: путь в переменной esbuild не
 * разрешает, а литерал разрешает всегда, и промахнуться мимо литерала нельзя.
 * Поэтому запасных путей у загрузки здесь нет и заводить их не надо: модуль
 * лежит в бандле, не приехал — плагин обязан упасть громко.
 *
 * **Ключи `globalThis` остаются, и это шов, а не кеш.** Движки под З3 читают
 * `__inlinePkmRulesHelpers`, `__inlinePkmMacroShared` и `__inlineLinePipeline`
 * прямо из `globalThis` — сразу после того, как позвали соответствующий
 * `load*`. Пока эти чтения на месте, публикация обязана остаться: снимать её
 * надо вместе с ними, а не раньше.
 *
 * Формы вызова остались асинхронными: их зовут через `await` места в файлах
 * под З3. Аргументы «приложение» и «загрузчик модулей» ушли вместе с самой
 * загрузкой — передавать их было незачем, а оставлять значило бы держать в
 * подписи то, чего нет.
 */

const bootstrap = require("./pkm_runtime_bootstrap.js");
const linePipeline = require("./line_pipeline.js");
const macroShared = require("./pkm_macro_shared.js");
const rulesRuntimeHelpers = require("./pkm_rules_runtime_helpers.js");

async function loadRuntimeBootstrap() {
  return bootstrap;
}

async function loadOrderKeyNormalizer(fallbackNormalize) {
  return bootstrap.loadOrderKeyNormalizer(fallbackNormalize);
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
  loadOrderKeyNormalizer,
  loadLinePipeline,
  loadMacroShared,
  loadRulesRuntimeHelpers,
  resolveOrderConfig,
};
