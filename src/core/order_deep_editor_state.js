"use strict";

const IO_TEMP_HISTORY_LIMIT = 100;

function isObj(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function cloneJson(x) {
  return JSON.parse(JSON.stringify(x));
}

function normalizeToken(raw, kind) {
  const src = String(raw || "").trim();
  if (!src) return "";
  if (kind === "wikilink") {
    if (/^\[\[[^\]]+\]\]$/.test(src)) return src;
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
function normalizeCheckboxToken(raw) {
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
  for (const row of subValues) {
    if (!isObj(row)) continue;
    const token = normalizeToken(row.token, kind);
    if (!token) continue;
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
    const checkboxToken = normalizeCheckboxToken(checkboxByToken[token]);
    out.push({
      token,
      prefix: String(parentField && parentField.prefix ? parentField.prefix : "#"),
      prefixMode: checkboxToken ? "checkbox" : "bullet",
      checkboxToken,
      children: (subByParent.get(token) || []).map((x) => ({ token: x })),
    });
  }
  for (let i = 0; i < out.length; i++) {
    const parent = out[i];
    const children = Array.isArray(parent.children) ? parent.children : [];
    for (let j = 0; j < children.length; j++) {
      const child = children[j];
      const childToken = normalizeToken(child && child.token, kind);
      const checkboxToken = normalizeCheckboxToken(checkboxByToken[childToken]);
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
  const checkboxByToken = {};
  for (const item of items) {
    const token = normalizeToken(item && item.token, kind);
    if (!token) continue;
    const mode = String(item && item.prefixMode || "").trim().toLowerCase();
    const parentCheckbox = mode === "checkbox" ? normalizeCheckboxToken(item && item.checkboxToken) : "";
    if (parentCheckbox) checkboxByToken[token] = parentCheckbox;
    const children = Array.isArray(item && item.children) ? item.children : [];
    const subTokens = [];
    for (const c of children) {
      const ct = normalizeToken(c && c.token, kind);
      if (!ct) continue;
      const childMode = String(c && c.prefixMode || "").trim().toLowerCase();
      const childCheckbox = childMode === "checkbox" ? normalizeCheckboxToken(c && c.checkboxToken) : "";
      if (childCheckbox) checkboxByToken[ct] = childCheckbox;
      subTokens.push(ct);
      if (!sMap.has(ct)) sMap.set(ct, new Set());
      sMap.get(ct).add(token);
    }
    pOut.push({ token, subtags: subTokens, active: true });
  }
  const sOut = [];
  for (const [token, parentSet] of sMap.entries()) {
    sOut.push({ token, allowedParentValues: Array.from(parentSet), active: true });
  }
  const nextParent = { ...(parentField || {}), values: pOut };
  const nextSub = subField ? { ...(subField || {}), values: sOut } : null;
  return { parentField: nextParent, subField: nextSub, checkboxByToken };
}

function validateDraft(draft) {
  const errors = [];
  const d = isObj(draft) ? draft : {};
  const rows = Array.isArray(d.rows) ? d.rows : [];
  const seen = new Set();
  for (let i = 0; i < rows.length; i++) {
    const row = isObj(rows[i]) ? rows[i] : {};
    const key = String(row.key || "").trim();
    if (!key) {
      errors.push(`row[${i}]: empty key`);
      continue;
    }
    if (seen.has(key)) errors.push(`row[${i}]: duplicate key '${key}'`);
    seen.add(key);
    const kind = String(row.kind || "").trim().toLowerCase();
    if (!["tag", "wikilink", "element"].includes(kind)) {
      errors.push(`row[${i}]: unsupported kind '${kind}'`);
      continue;
    }
    if (kind === "element") {
      const emoji = String(row.emoji || "").trim();
      const format = String(row.format || "").trim();
      const mode = String(row.behaviorMode || "").trim();
      if (!emoji) errors.push(`row[${i}]: emoji is required`);
      if (!format) errors.push(`row[${i}]: format is required`);
      if (!["increment", "command", "custom"].includes(mode)) {
        errors.push(`row[${i}]: behavior mode is required`);
      }
      if (mode === "command") {
        const cmd = String(row.command || "").trim();
        if (!["now", "randomN", "randomE"].includes(cmd)) {
          errors.push(`row[${i}]: command must be one of now|randomN|randomE`);
        }
      }
      if (mode === "increment") {
        const n = Number(row.incrementBy);
        if (!Number.isFinite(n)) errors.push(`row[${i}]: incrementBy must be numeric`);
      }
      if (mode === "custom") {
        const list = Array.isArray(row.customRaw) ? row.customRaw.map((x) => String(x || "").trim()).filter(Boolean) : [];
        if (!list.length) errors.push(`row[${i}]: custom increment list is empty`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function createHistory(limit) {
  const max = Number.isFinite(Number(limit)) ? Math.max(10, Math.trunc(Number(limit))) : IO_TEMP_HISTORY_LIMIT;
  return { max, past: [], future: [] };
}

function pushHistory(history, snapshot) {
  const h = isObj(history) ? history : createHistory();
  h.past.push(cloneJson(snapshot));
  while (h.past.length > h.max) h.past.shift();
  h.future = [];
  return h;
}

function undoHistory(history, currentSnapshot) {
  const h = isObj(history) ? history : createHistory();
  if (!h.past.length) return { changed: false, snapshot: currentSnapshot, history: h };
  const prev = h.past.pop();
  h.future.push(cloneJson(currentSnapshot));
  return { changed: true, snapshot: prev, history: h };
}

function redoHistory(history, currentSnapshot) {
  const h = isObj(history) ? history : createHistory();
  if (!h.future.length) return { changed: false, snapshot: currentSnapshot, history: h };
  const next = h.future.pop();
  h.past.push(cloneJson(currentSnapshot));
  return { changed: true, snapshot: next, history: h };
}

function resetHistory(history) {
  const h = isObj(history) ? history : createHistory();
  h.past = [];
  h.future = [];
  return h;
}

function partitionWikilinkRows(rows, validParentTokens, options) {
  const list = Array.isArray(rows) ? rows : [];
  const opts = isObj(options) ? options : {};
  const seen = new Set();
  const parents = Array.isArray(validParentTokens)
    ? validParentTokens.map((x) => normalizeToken(x, "tag")).filter(Boolean)
    : [];
  const validSet = new Set(parents);
  const linked = [];
  const orphans = [];
  for (let i = 0; i < list.length; i++) {
    const row = isObj(list[i]) ? list[i] : {};
    const token = normalizeToken(row.token, "wikilink");
    if (!token) continue;
    const dedupKey = opts.caseSensitiveIdentity === false ? token.toLowerCase() : token;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    const parentToken = normalizeToken(row.parentToken, "tag");
    const next = { ...row, token, parentToken };
    if (parentToken && validSet.has(parentToken)) linked.push(next);
    else orphans.push(next);
  }
  return { linked, orphans };
}

module.exports = {
  IO_TEMP_HISTORY_LIMIT,
  normalizeToken,
  normalizeCheckboxToken,
  buildTagTree,
  applyTagTreeToFields,
  validateDraft,
  createHistory,
  pushHistory,
  undoHistory,
  redoHistory,
  resetHistory,
  partitionWikilinkRows,
};
