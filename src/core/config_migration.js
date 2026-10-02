// @ts-check
"use strict";

/**
 * Форма ветвей Prefix и определений Fields на путях версии 2 (PRD 8.1а):
 * нормализует токены чекбоксов и заполняет `checkboxByValue`, если её нет.
 * Третья ступень `migrateConfig`.
 */
/**
 * @param {any} cfg дерево настроек человека: форма у него его, а не наша
 * @param {any} [deps] общие помощники; без них берутся местные запаски
 * @returns {any} то же дерево, приведённое к форме версии 2
 */
function normalizePkmBehaviorShape(cfg, deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : (/** @type {any} */ x) => !!x && typeof x === "object" && !Array.isArray(x);
  const cloneJson = deps && typeof deps.cloneJson === "function"
    ? deps.cloneJson
    : (/** @type {any} */ x) => JSON.parse(JSON.stringify(x));

  const out = isObj(cfg) ? cfg : {};
  if (!isObj(out.pkm)) out.pkm = {};
  if (!isObj(out.pkm.fields)) out.pkm.fields = {};
  if (!isObj(out.pkm.prefixRules)) out.pkm.prefixRules = {};

  const fields = out.pkm.fields;
  const prefixRules = out.pkm.prefixRules;
  /*
   * Знак чекбокса нормализует один модуль на весь плагин (У-32). Без запаски:
   * не приедет — упадём громко, а не разойдёмся молча.
   */
  const normalizeCheckbox = (/** @type {any} */ token) =>
    require("./pkm_line_finalize_unified.js").normalizeCheckboxToken(token);

  {
    const defaultBlock = String(fields.defaultBlock || "").trim().toLowerCase();
    fields.defaultBlock = defaultBlock === "left" || defaultBlock === "right" ? defaultBlock : "left";
  }

  if (Array.isArray(prefixRules.priorityCheckboxes)) {
    prefixRules.priorityCheckboxes = Array.from(new Set(prefixRules.priorityCheckboxes
      .map((/** @type {any} */ x) => normalizeCheckbox(x))
      .filter(Boolean)));
  }
  if (isObj(prefixRules.checkboxByFieldValue)) {
    const byField = prefixRules.checkboxByFieldValue;
    for (const fid of Object.keys(byField)) {
      if (!isObj(byField[fid])) continue;
      for (const tok of Object.keys(byField[fid])) {
        const norm = normalizeCheckbox(byField[fid][tok]);
        if (!norm) {
          delete byField[fid][tok];
          continue;
        }
        byField[fid][tok] = norm;
      }
    }
    /* `Prefix order` пополняется Prefix, стоящими у Values: движок решает только
       по списку (BUGHUNT 2026-09-30, A2). Дописанное — в конец, порядок человека не трогается. */
    const listed = Array.isArray(prefixRules.priorityCheckboxes) ? prefixRules.priorityCheckboxes : [];
    const used = Object.values(byField).flatMap((/** @type {any} */ row) => (isObj(row) ? Object.values(row) : []));
    prefixRules.priorityCheckboxes = Array.from(new Set(listed.concat(used)));
  }

  /*
   * Карта «Value → чекбокс» заполняется ПОСЛЕ нормализации токенов, иначе
   * уносит `[  ]` и негодные токены (2026-08-31).
   */
  if (!isObj(fields.checkboxByValue)
    && isObj(prefixRules.checkboxByFieldValue)
    && isObj(prefixRules.checkboxByFieldValue.type)) {
    fields.checkboxByValue = cloneJson(prefixRules.checkboxByFieldValue.type);
  }

  return out;
}

module.exports = {
  normalizePkmBehaviorShape,
};
