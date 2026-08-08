"use strict";

const COMPAT_FLAGS = {
  ENABLE_CONFIG_MIGRATION_SHIMS: true,
};

const DEPRECATED_CONFIG_KEYS = {
  rules: ["tagWheelPath"],
  pkm: ["sourceOfTruth", "autoGenerateRules"],
  devMode: ["logLevel", "maxFileSizeKb", "maxRecords", "logSize"],
  navigation: ["topRevealOffsetLines"],
};

function isCompatEnabled(flag) {
  const key = String(flag || "").trim();
  if (!key) return false;
  return COMPAT_FLAGS[key] === true;
}

module.exports = {
  COMPAT_FLAGS,
  DEPRECATED_CONFIG_KEYS,
  isCompatEnabled,
};
