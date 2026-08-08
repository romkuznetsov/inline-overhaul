"use strict";

function normalizeKey(v) {
  return String(v || "").trim();
}

function inferOrderFieldType(key) {
  const k = normalizeKey(key).toLowerCase();
  if (!k) return "tag";
  if (/wikilink|link/.test(k)) return "wikilink";
  return "tag";
}

function inferSubFieldKey(parentKey) {
  const p = normalizeKey(parentKey);
  return p ? `${p}_sub` : "";
}

function collapseSubOrderKey(key) {
  const k = normalizeKey(key);
  return /_sub$/.test(k) ? k.slice(0, -4) : k;
}

function resolveOrderKeyFromFieldId(fieldId) {
  return normalizeKey(fieldId);
}

function resolveLeftFieldIdByOrderKey(orderKey) {
  return normalizeKey(orderKey);
}

function resolveRightFieldIdByOrderKey(orderKey) {
  return normalizeKey(orderKey);
}

module.exports = {
  inferOrderFieldType,
  inferSubFieldKey,
  collapseSubOrderKey,
  resolveOrderKeyFromFieldId,
  resolveLeftFieldIdByOrderKey,
  resolveRightFieldIdByOrderKey,
};
