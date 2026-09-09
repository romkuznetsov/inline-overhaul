"use strict";

/*
 * Здесь стояла заглушка на месте `pkm_domain_registry.js`, и **её результат не
 * читало ни одно место файла** — мёртвое объявление с тихим отказом внутри
 * (Д-4, снято 2026-09-09).
 *
 * **Почему линтер не сказал.** `no-unused-vars` разрешает неиспользованными
 * имена, начинающиеся с подчёркивания, а модули в этом проекте как раз так и
 * называются — `__module`. То есть указатель на мёртвое, о котором говорит
 * `CLAUDE.md`, к модульным именам слеп по уговору самого проекта.
 */

function defaultIsObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function normalizeValue(v, options) {
  const opts = options && typeof options === "object" ? options : {};
  const err = typeof opts.err === "function" ? opts.err : (msg) => { throw new Error(String(msg || "normalizeValue error")); };
  const isObj = typeof opts.isObj === "function" ? opts.isObj : defaultIsObj;
  if (typeof v === "string") {
    return { id: v, token: v, allowedParentValues: null };
  }
  if (!isObj(v)) err("Field value must be string or object");
  const token = typeof v.token === "string" ? v.token : "";
  if (!token && token !== "") err("Value token must be string");
  const id = typeof v.id === "string" ? v.id : token;
  if (typeof id !== "string") err("Value id must be string");
  return {
    id,
    token,
    allowedParentValues: Array.isArray(v.allowedParentValues) ? v.allowedParentValues : null,
  };
}

function normalizeImportanceValueToken(raw) {
  const src = String(raw || "").trim();
  if (!src) return "";
  if (/^#\//.test(src)) return src;
  if (/^\//.test(src)) return "#" + src;
  if (src.charAt(0) === "#") return "#/" + src.slice(1);
  return "#/" + src;
}

function normalizeField(field, modeName, idx, options) {
  const opts = options && typeof options === "object" ? options : {};
  const err = typeof opts.err === "function" ? opts.err : (msg) => { throw new Error(String(msg || "normalizeField error")); };
  const isObj = typeof opts.isObj === "function" ? opts.isObj : defaultIsObj;

  if (!isObj(field)) err(modeName + ".fields[" + idx + "] must be object");
  if (typeof field.id !== "string" || !field.id) err(modeName + ".fields[" + idx + "].id must be non-empty string");

  const out = {
    id: field.id,
    orderKey: typeof field.orderKey === "string" ? field.orderKey : "",
    prefix: typeof field.prefix === "string" ? field.prefix : "#",
    dependsOn: typeof field.dependsOn === "string" ? field.dependsOn : "",
    source: typeof field.source === "string" ? field.source : "",
    enabled: field.enabled !== false,
    enabledForParentValues: Array.isArray(field.enabledForParentValues) ? field.enabledForParentValues.slice() : null,
    disabledForParentValues: Array.isArray(field.disabledForParentValues) ? field.disabledForParentValues.slice() : null,
    kind: typeof field.kind === "string" ? field.kind : "",
    marker: typeof field.marker === "string" ? field.marker : "",
    placeholder: typeof field.placeholder === "string" && field.placeholder ? field.placeholder : field.id,
    values: [],
  };

  const rawValues = Array.isArray(field.values)
    ? field.values
    : (out.source === "projects" ? [] : null);
  if (!rawValues) err(modeName + ".fields[" + field.id + "].values must be array");

  let hasEmpty = false;
  const importanceLike = rawValues.some((entry) => {
    const token = String(entry && entry.token || "").trim();
    return /^#\//.test(token) || /^\//.test(token);
  });
  for (let i = 0; i < rawValues.length; i++) {
    const nv = normalizeValue(rawValues[i], { err, isObj });
    if (importanceLike && nv.token) {
      const before = String(nv.token || "");
      nv.token = normalizeImportanceValueToken(before);
      if (String(nv.id || "") === before || String(nv.id || "") === before.replace(/^#/, "")) nv.id = nv.token;
    }
    if (nv.token === "") hasEmpty = true;
    out.values.push(nv);
  }
  if (!hasEmpty) out.values.unshift({ id: "", token: "", allowedParentValues: null });
  return out;
}

function normalizeMode(mode, modeName, options) {
  const opts = options && typeof options === "object" ? options : {};
  const err = typeof opts.err === "function" ? opts.err : (msg) => { throw new Error(String(msg || "normalizeMode error")); };
  const isObj = typeof opts.isObj === "function" ? opts.isObj : defaultIsObj;
  if (!isObj(mode)) err(modeName + " must be object");
  if (!Array.isArray(mode.fields)) err(modeName + ".fields must be array");
  const out = { fields: [] };
  for (let i = 0; i < mode.fields.length; i++) {
    out.fields.push(normalizeField(mode.fields[i], modeName, i, { err, isObj }));
  }
  return out;
}

module.exports = {
  normalizeValue,
  normalizeImportanceValueToken,
  normalizeField,
  normalizeMode,
};
