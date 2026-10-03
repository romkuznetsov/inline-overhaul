"use strict";

const __sharedUtils = require("./shared_utils.js");

function isObj(x) {
  /* Правило объявлено один раз — `isObj` в `shared_utils.js`. Копия здесь
     возвращала «да/нет» (10.13.135). */
  return __sharedUtils.isObj(x);
}

function normalizeToken(raw, kind) {
  const src = String(raw || "").trim();
  if (!src) return "";
  if (kind === "wikilink") {
    if (__sharedUtils.isWikilinkToken(src)) return src;
    return `[[${src.replace(/^\[\[/, "").replace(/\]\]$/, "")}]]`;
  }
  if (/^#/.test(src)) return src;
  return `#${src}`;
}

/*
 * Знак чекбокса — РОВНО ОДИН. Так его читает сам Obsidian:
 * `/^([>\s]*)(([*+-] |(\d+)([.)] ))(?:\[(.)\] )?)?/`
 * в `app.js` 1.13.7, и `data-task="(.)"` в разметке задачи. Знак длиннее
 * одного платформа задачей не считает — это обычный текст человека,
 * и `- [test-transform] text` терял этот текст, пока правило здесь
 * было шире платформенного (У-91).
 */
/*
 * **Нормализатор ввода человека**, и это не то же самое, что разбор готового
 * токена в `pkm_line_finalize_unified.js`. Сюда приезжает то, что напечатали
 * в колонке `Prefix` редактора Fields, поэтому знак списка снимается:
 * `- [x]` даёт `[x]`.
 *
 * **Имя у него своё с 2026-09-15**, и это исполнение ответа заказчика на
 * В-118: «пользователь может вводить как угодно (`- [x]` / `[x]`), а плагин
 * сам нормализует ввод» (правило 117, разбор 10.13.153). До того дня оба
 * вопроса носили одно имя `normalizeCheckboxToken` и расходились на восьми
 * входах из 31 — шесть из восьми были началами строк его собственных заметок.
 * Одно имя на два вопроса и есть та ошибка, из-за которой я счёл их копией.
 *
 * Оба ответа закреплены в `bootstrap_loader_tests.js`, и там же стоит запрет
 * на возврат прежнего имени сюда.
 */
function normalizeCheckboxInput(raw) {
  let src = String(raw || "").trim();
  src = src.replace(/^[-*+]\s+/, "").trim();
  if (!src) return "";
  const m = src.match(/^\[([\s\S]*)\]$/);
  if (!m) return "";
  const inner = String(m[1] || "").trim();
  if (inner.length > 1) return "";
  return inner ? `[${inner}]` : "[ ]";
}

function buildTagTree(parentField, subField, kind, options) {
  const opts = isObj(options) ? options : {};
  const checkboxByToken = isObj(opts.checkboxByToken) ? opts.checkboxByToken : {};
  const pValues = Array.isArray(parentField && parentField.values) ? parentField.values : [];
  const subValues = Array.isArray(subField && subField.values) ? subField.values : [];
  const subByParent = new Map();
  /* Глаз дочернего Value — у самого Value, под каким бы родителем оно ни стояло (В-278). */
  const subHidden = new Set();
  for (const row of subValues) {
    if (!isObj(row)) continue;
    const token = normalizeToken(row.token, kind);
    if (!token) continue;
    if (row.hidden === true) subHidden.add(token);
    const parents = Array.isArray(row.allowedParentValues) ? row.allowedParentValues : [];
    for (const p of parents) {
      const pt = normalizeToken(p, kind);
      if (!pt) continue;
      if (!subByParent.has(pt)) subByParent.set(pt, []);
      subByParent.get(pt).push(token);
    }
  }
  const out = [];
  for (const row of pValues) {
    const token = normalizeToken(isObj(row) ? row.token : row, kind);
    if (!token) continue;
    const checkboxToken = normalizeCheckboxInput(checkboxByToken[token]);
    out.push({
      token,
      prefix: String(parentField && parentField.prefix ? parentField.prefix : "#"),
      prefixMode: checkboxToken ? "checkbox" : "bullet",
      checkboxToken,
      ...(isObj(row) && row.hidden === true ? { hidden: true } : {}),
      children: (subByParent.get(token) || []).map((x) => (subHidden.has(x) ? { token: x, hidden: true } : { token: x })),
    });
  }
  for (let i = 0; i < out.length; i++) {
    const parent = out[i];
    const children = Array.isArray(parent.children) ? parent.children : [];
    for (let j = 0; j < children.length; j++) {
      const child = children[j];
      const childToken = normalizeToken(child && child.token, kind);
      const checkboxToken = normalizeCheckboxInput(checkboxByToken[childToken]);
      children[j] = {
        ...child,
        prefixMode: checkboxToken ? "checkbox" : "bullet",
        checkboxToken,
      };
    }
  }
  return out;
}

function applyTagTreeToFields(tree, parentField, subField, kind) {
  const items = Array.isArray(tree) ? tree : [];
  const pOut = [];
  const sMap = new Map();
  const subHidden = new Set();
  const checkboxByToken = {};
  for (const item of items) {
    const token = normalizeToken(item && item.token, kind);
    if (!token) continue;
    const mode = String(item && item.prefixMode || "").trim().toLowerCase();
    const parentCheckbox = mode === "checkbox" ? normalizeCheckboxInput(item && item.checkboxToken) : "";
    if (parentCheckbox) checkboxByToken[token] = parentCheckbox;
    const children = Array.isArray(item && item.children) ? item.children : [];
    const subTokens = [];
    for (const c of children) {
      const ct = normalizeToken(c && c.token, kind);
      if (!ct) continue;
      const childMode = String(c && c.prefixMode || "").trim().toLowerCase();
      const childCheckbox = childMode === "checkbox" ? normalizeCheckboxInput(c && c.checkboxToken) : "";
      if (childCheckbox) checkboxByToken[ct] = childCheckbox;
      subTokens.push(ct);
      if (c && c.hidden === true) subHidden.add(ct);
      if (!sMap.has(ct)) sMap.set(ct, new Set());
      sMap.get(ct).add(token);
    }
    pOut.push(item && item.hidden === true ? { token, subtags: subTokens, active: true, hidden: true } : { token, subtags: subTokens, active: true });
  }
  const sOut = [];
  for (const [token, parentSet] of sMap.entries()) {
    const sub = { token, allowedParentValues: Array.from(parentSet), active: true };
    if (subHidden.has(token)) sub.hidden = true;
    sOut.push(sub);
  }
  const nextParent = { ...(parentField || {}), values: pOut };
  const nextSub = subField ? { ...(subField || {}), values: sOut } : null;
  return { parentField: nextParent, subField: nextSub, checkboxByToken };
}

module.exports = {
  normalizeToken,
  normalizeCheckboxInput,
  buildTagTree,
  applyTagTreeToFields,
};
