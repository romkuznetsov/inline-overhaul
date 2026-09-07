"use strict";

/**
 * Форма ветвей Prefix и определений Fields на путях версии 2.
 *
 * Раньше функция правила `pkm.behavior.*` и вызывалась из приёмника старой
 * формы. После пункта 4 фазы 2 она стоит в третьей ступени `migrateConfig` и
 * читает пути версии 2: `pkm.fields.*` и `pkm.prefixRules.*` (PRD 8.1а).
 * Работа осталась той же — нормализовать токены чекбоксов и заполнить карту
 * `checkboxByValue`, если её ещё нет.
 */
function normalizePkmBehaviorShape(cfg, deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const cloneJson = deps && typeof deps.cloneJson === "function"
    ? deps.cloneJson
    : (x) => JSON.parse(JSON.stringify(x));

  const out = isObj(cfg) ? cfg : {};
  if (!isObj(out.pkm)) out.pkm = {};
  if (!isObj(out.pkm.fields)) out.pkm.fields = {};
  if (!isObj(out.pkm.prefixRules)) out.pkm.prefixRules = {};

  const fields = out.pkm.fields;
  const prefixRules = out.pkm.prefixRules;
  /*
   * Знак чекбокса нормализует один модуль на весь плагин. Запаска здесь
   * была вторым объявлением того же правила (У-32) и в сборке была
   * недостижима: путь литеральный, модуль есть всегда. Не приедет —
   * упадём громко, а не разойдёмся молча.
   */
  const normalizeCheckbox = (token) =>
    require("./pkm_line_finalize_unified.js").normalizeCheckboxToken(token);

  {
    const defaultBlock = String(fields.defaultBlock || "").trim().toLowerCase();
    fields.defaultBlock = defaultBlock === "left" || defaultBlock === "right" ? defaultBlock : "left";
  }

  if (Array.isArray(prefixRules.priorityCheckboxes)) {
    prefixRules.priorityCheckboxes = Array.from(new Set(prefixRules.priorityCheckboxes
      .map((x) => normalizeCheckbox(x))
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
  }

  /*
   * Карта «Value → чекбокс» заполняется ПОСЛЕ нормализации токенов, а не до.
   * До 2026-08-31 копия снималась раньше и уносила с собой то, что нормализация
   * тут же выбрасывала: `[  ]` вместо `[ ]` и негодный токен целиком. Читала
   * эту карту конфиг-заметка, снятая 2026-09-03; порядок остаётся верным и
   * без неё — мусор в карте не нужен никому.
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
