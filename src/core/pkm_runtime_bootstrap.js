"use strict";

/*
 * Разрешение конфига порядка Field; модули — литеральным `require` (У-89,
 * У-90), запасного нормализатора ключа нет (У-32).
 */

const __sharedUtils = require("./shared_utils.js");

/*
 * Нормализатор ключа Order — дом `normalizeOrderKey` в `shared_utils.js`
 * (10.13.168). Запасного чтения порядка из `data.json` нет (AUDIT_2026-09-18
 * 4.4, Р-5): оно было недостижимо (`.obsidian/**` vault не видит). Довод
 * `app_` остался ради подписей пяти звавших.
 */
async function resolveOrderConfig(app_, settings, options) {
  const opts = options && typeof options === "object" ? options : {};
  const key = String(opts.orderConfigKey || "").trim();
  if (!key) throw new Error("pkm_runtime_bootstrap: orderConfigKey is required");
  const parseOrderConfig = typeof opts.parseOrderConfig === "function" ? opts.parseOrderConfig : null;
  /* Дом — `normalizeOrderKey` (10.13.168). */
  const normalizeKey = typeof opts.normalizeKey === "function" ? opts.normalizeKey : __sharedUtils.normalizeOrderKey;
  if (!parseOrderConfig) throw new Error("pkm_runtime_bootstrap: parseOrderConfig is required");
  const rawSettings = settings && Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : undefined;
  return parseOrderConfig(rawSettings, normalizeKey);
}

module.exports = {
  resolveOrderConfig,
};
