"use strict";

/**
 * Что говорит конфиг о метке отмеченной строки (`done-marker`).
 *
 * Два читателя: запись метки (`checkbox_done_marker.js`) и оформление
 * (`editor_visuals_config.js` — затемнение и чей это токен в Block). Ответ
 * «Value ли метка какого-то Field» у них обязан быть одним (У-32), поэтому он
 * здесь, а не в каждом.
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

/**
 * Field, у которого маркер — одно из Values: тег (с решёткой и без — панель
 * хранит Value с решёткой, стартовый набор без, У-290) или ссылка.
 */
function fieldOfMarker(cfg, token) {
  const fields = isObj(cfg) && isObj(cfg.pkm) && isObj(cfg.pkm.fields) ? cfg.pkm.fields : {};
  const enabled = isObj(fields.order) && isObj(fields.order.enabled) ? fields.order.enabled : {};
  const tags = isObj(fields.tags) && Array.isArray(fields.tags.fields) ? fields.tags.fields : [];
  const links = isObj(fields.links) && Array.isArray(fields.links.fields) ? fields.links.fields : [];
  /* Field custom block пишет там, где каретка, а не в своём месте строки:
     «место этого Field» у него нет, и маркер идёт выбранным Block. */
  const custom = new Set((isObj(fields.order) && Array.isArray(fields.order.custom) ? fields.order.custom : [])
    .flatMap((b) => (isObj(b) && Array.isArray(b.keys) ? b.keys : [])));
  for (const f of tags.concat(links)) {
    if (!isObj(f) || enabled[f.id] === false || !Array.isArray(f.values) || custom.has(f.id)) continue;
    const isLink = links.indexOf(f) >= 0;
    /* Как Value стоит в строке: ссылка в скобках, тег с решёткой, а у поля
       без Prefix (знак custom block, `💡`) — как написано. */
    const spell = (t) => (isLink ? "[[" + t.replace(/^\[\[|\]\]$/g, "") + "]]"
      : (f.prefix === "#" || t.startsWith("#") ? "#" + t.replace(/^#/, "") : t));
    const tokens = f.values.map(valueToken).filter(Boolean).map(spell);
    if (tokens.indexOf(token) >= 0) return { id: String(f.id), tokens };
  }
  return null;
}

module.exports = { readDoneMarker, fieldOfMarker };
