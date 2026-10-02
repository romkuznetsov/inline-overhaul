"use strict";

/**
 * Метка отмеченной строки (`done-marker`) в конфиге. Два читателя —
 * `checkbox_done_marker.js` и `editor_visuals_config.js`; ответ у них один (У-32).
 */

const __sharedUtils = require("./shared_utils.js");

function isObj(x) { return __sharedUtils.isObj(x); }

function readDoneMarker(cfg) {
  const dm = isObj(cfg) && isObj(cfg.pkm) && isObj(cfg.pkm.behavior) && isObj(cfg.pkm.behavior.doneMarker)
    ? cfg.pkm.behavior.doneMarker : {};
  return {
    token: String(dm.token || "").trim(),
    panel: String(dm.panel || "").trim().toLowerCase() === "left" ? "left" : "right",
  };
}

function valueToken(v) { return String((isObj(v) ? v.token : v) || "").trim(); }

/** Field, у которого маркер — одно из Values: тег (с решёткой и без, У-290) или ссылка. */
function fieldOfMarker(cfg, token) {
  const fields = isObj(cfg) && isObj(cfg.pkm) && isObj(cfg.pkm.fields) ? cfg.pkm.fields : {};
  const enabled = isObj(fields.order) && isObj(fields.order.enabled) ? fields.order.enabled : {};
  const tags = isObj(fields.tags) && Array.isArray(fields.tags.fields) ? fields.tags.fields : [];
  const links = isObj(fields.links) && Array.isArray(fields.links.fields) ? fields.links.fields : [];
  /* Field custom block пишет у каретки, своего места нет — маркер идёт выбранным Block. */
  const custom = new Set((isObj(fields.order) && Array.isArray(fields.order.custom) ? fields.order.custom : [])
    .flatMap((b) => (isObj(b) && Array.isArray(b.keys) ? b.keys : [])));
  for (const f of tags.concat(links)) {
    if (!isObj(f) || enabled[f.id] === false || !Array.isArray(f.values) || custom.has(f.id)) continue;
    const isLink = links.indexOf(f) >= 0;
    /* Ссылка в скобках, тег с решёткой, без Prefix (`💡`) — как написано. */
    const spell = (t) => (isLink ? "[[" + t.replace(/^\[\[|\]\]$/g, "") + "]]"
      : (f.prefix === "#" || t.startsWith("#") ? "#" + t.replace(/^#/, "") : t));
    const tokens = f.values.map(valueToken).filter(Boolean).map(spell);
    if (tokens.indexOf(token) >= 0) return { id: String(f.id), tokens };
  }
  return null;
}

module.exports = { readDoneMarker, fieldOfMarker };
