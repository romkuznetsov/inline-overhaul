"use strict";

/**
 * Ключи прежних версий, которые уходят из конфига молча. Флаги совместимости
 * сняты (10.13.52, П-8, У-141).
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
