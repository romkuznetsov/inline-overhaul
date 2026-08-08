"use strict";

function cleanJsonText(input) {
  return String(input || "")
    .replace(/\uFEFF/g, "")
    .replace(/^\s*>\s?/gm, "")
    .trim();
}

function parseJsonBlock(content, blockName, required, onError) {
  const src = String(content || "");
  const name = String(blockName || "").trim();
  const raise = typeof onError === "function"
    ? onError
    : (msg) => {
      throw new Error(String(msg || "parseJsonBlock error"));
    };
  const re = new RegExp("```" + name + "\\s*([\\s\\S]*?)```");
  const m = src.match(re);
  if (!m) {
    if (required) raise("Block `" + name + "` not found");
    return null;
  }
  try {
    return JSON.parse(cleanJsonText(m[1]));
  } catch (e) {
    const message = e && e.message ? String(e.message) : String(e || "Invalid JSON");
    raise("Invalid JSON in `" + name + "`: " + message);
  }
}

module.exports = {
  cleanJsonText,
  parseJsonBlock,
};
