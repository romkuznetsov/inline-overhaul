"use strict";

/**
 * Ключи прежних версий, которые уходят из конфига молча.
 *
 * **Флага совместимости здесь больше нет.** `COMPAT_FLAGS` и `isCompatEnabled`
 * держали одно место — переходник `rules.tagWheelPath` → путь служебного файла
 * правил, — и ушли вместе с ним (PRD 10.13.52, П-8, шаг четвёртый). Флаг,
 * который никто не спрашивает, обещает выбор, которого нет (У-141).
 */
const DEPRECATED_CONFIG_KEYS = {
  rules: ["tagWheelPath"],
  pkm: ["sourceOfTruth", "autoGenerateRules"],
  devMode: ["logLevel", "maxFileSizeKb", "maxRecords", "logSize"],
  navigation: ["topRevealOffsetLines"],
};

module.exports = {
  DEPRECATED_CONFIG_KEYS,
};
