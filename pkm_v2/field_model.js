const domainRegistry = (() => {
  try {
    if (typeof require === "function") {
      const mod = require("../src/core/pkm_domain_registry.js")
      if (mod && typeof mod === "object") return mod
    }
  } catch (_) {}
  return null
})()

function keyKind(key) {
  if (domainRegistry && typeof domainRegistry.inferOrderFieldType === "function") {
    return String(domainRegistry.inferOrderFieldType(key) || "tag")
  }
  var k = String(key || "").trim().toLowerCase()
  if (k.indexOf("link") !== -1 || k.indexOf("wiki") !== -1) return "wikilink"
  if (k.indexOf("time") !== -1 || k.indexOf("date_") === 0) return "element"
  return "tag"
}

function normalizeOrderKey(key) {
  return String(key || "").trim()
}

module.exports = {
  keyKind: keyKind,
  normalizeOrderKey: normalizeOrderKey,
}
