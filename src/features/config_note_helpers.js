"use strict";

function createConfigNoteHelpers(deps) {
  const isObj = deps && typeof deps.isObj === "function"
    ? deps.isObj
    : function(x) { return x && typeof x === "object" && !Array.isArray(x); };
  const normalizePkmOrder = deps && typeof deps.normalizePkmOrder === "function"
    ? deps.normalizePkmOrder
    : function(x) { return isObj(x) ? x : { left: [], right: [], enabled: {} }; };
  const getOrderStrictName = deps && typeof deps.getOrderStrictName === "function"
    ? deps.getOrderStrictName
    : function(_, k) { return String(k || ""); };
  const TAGWHEEL_PREFIX_RESOLVER_H3 = String(deps && deps.TAGWHEEL_PREFIX_RESOLVER_H3 ? deps.TAGWHEEL_PREFIX_RESOLVER_H3 : "PREFIX RESOLVER");

  function getLeftFields(cfg) {
    const fields = cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.leftMode && Array.isArray(cfg.pkm.behavior.leftMode.fields)
      ? cfg.pkm.behavior.leftMode.fields
      : [];
    return fields;
  }

  function getFieldById(fields, fieldId) {
    for (let i = 0; i < fields.length; i++) {
      if (fields[i] && fields[i].id === fieldId) return fields[i];
    }
    return null;
  }

  function getRightFields(cfg) {
    const fields = cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.rightMode && Array.isArray(cfg.pkm.behavior.rightMode.fields)
      ? cfg.pkm.behavior.rightMode.fields
      : [];
    return fields;
  }

  function getAllFields(cfg) {
    const left = getLeftFields(cfg);
    const right = getRightFields(cfg);
    return left.concat(right);
  }

  function findFieldByOrderKey(fields, orderKey) {
    const key = String(orderKey || "").trim();
    if (!key) return null;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f || !f.id) continue;
      if (String(f.orderKey || "").trim() === key) return f;
    }
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f || !f.id) continue;
      if (String(f.id || "").trim() === key) return f;
    }
    return null;
  }

  function resolveOrderField(cfg, orderKey) {
    const key = String(orderKey || "").trim();
    if (!key) return null;
    const fields = getAllFields(cfg);
    let field = findFieldByOrderKey(fields, key);
    if (field) return field;
    if (/_sub$/.test(key)) {
      const parentKey = key.slice(0, -4);
      const parent = findFieldByOrderKey(fields, parentKey);
      if (!parent || !parent.id) return null;
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (!f || !f.id) continue;
        if (String(f.dependsOn || "").trim() !== String(parent.id || "").trim()) continue;
        const fk = String(f.orderKey || "").trim();
        if (fk === key) return f;
      }
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (!f || !f.id) continue;
        if (String(f.dependsOn || "").trim() !== String(parent.id || "").trim()) continue;
        const fid = String(f.id || "").trim();
        if (fid === key) return f;
      }
    }
    return null;
  }

  function isWikilinkField(field) {
    const source = String(field && field.source ? field.source : "").trim();
    return source === "projects" || source.startsWith("wikilinks:");
  }

  function isTagLikeField(field) {
    const prefix = typeof (field && field.prefix) === "string" ? field.prefix : "#";
    return prefix === "#";
  }

  function isElementLikeField(field, orderKey, orderCfg) {
    const f = field && typeof field === "object" ? field : null;
    if (!f || !f.id) return false;
    const kind = String(f.kind || "").trim();
    if (kind === "dateOffset" || kind === "nowTime" || kind === "estimatedCycle" || kind === "genericElement") return true;
    const key = String(orderKey || "").trim();
    const types = isObj(orderCfg && orderCfg.types) ? orderCfg.types : {};
    const typeByKey = String(types[key] || "").trim().toLowerCase();
    return typeByKey === "element";
  }

  function collectWikilinkFieldIds(cfg) {
    const out = [];
    const seen = new Set();
    const order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null);
    const keys = (Array.isArray(order.left) ? order.left : []).concat(Array.isArray(order.right) ? order.right : []);
    for (let i = 0; i < keys.length; i++) {
      const key = String(keys[i] || "").trim();
      if (!key) continue;
      const field = resolveOrderField(cfg, key);
      if (!field || !field.id) continue;
      if (!isWikilinkField(field)) continue;
      const fid = String(field.id || "").trim();
      if (!fid || seen.has(fid)) continue;
      seen.add(fid);
      out.push(fid);
    }
    return out;
  }

  function collectTagSections(cfg) {
    const out = [];
    const seen = new Set();
    const order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null);
    const allFields = getAllFields(cfg);
    const push = (sectionId, fieldId, subFieldId) => {
      const sid = String(sectionId || "").trim();
      if (!sid || seen.has(sid)) return;
      if (!getFieldById(allFields, fieldId)) return;
      seen.add(sid);
      out.push({ sectionId: sid, fieldId: fieldId, subFieldId: subFieldId || "" });
    };
    const orderedKeys = (Array.isArray(order.left) ? order.left : []).concat(Array.isArray(order.right) ? order.right : []);
    for (let i = 0; i < orderedKeys.length; i++) {
      const key = String(orderedKeys[i] || "").trim();
      if (!key || /_sub$/.test(key)) continue;
      const field = resolveOrderField(cfg, key);
      if (!field || !field.id) continue;
      if (isElementLikeField(field, key, order)) continue;
      if (!isTagLikeField(field) && !isWikilinkField(field)) continue;
      let subFieldId = "";
      const subByOrder = resolveOrderField(cfg, `${key}_sub`);
      if (subByOrder && subByOrder.id && String(subByOrder.dependsOn || "").trim() === String(field.id || "").trim()) {
        subFieldId = String(subByOrder.id || "").trim();
      } else {
        for (let j = 0; j < allFields.length; j++) {
          const sf = allFields[j];
          if (!sf || !sf.id) continue;
          if (String(sf.dependsOn || "").trim() !== String(field.id || "").trim()) continue;
          if (!isTagLikeField(sf)) continue;
          subFieldId = String(sf.id || "").trim();
          break;
        }
      }
      const strictSection = String(getOrderStrictName(cfg, key) || key).trim();
      push(strictSection, String(field.id || "").trim(), subFieldId);
    }
    return out;
  }

  function collectOrderedElementFields(cfg) {
    const out = [];
    const seen = new Set();
    const order = normalizePkmOrder(cfg && cfg.pkm && cfg.pkm.behavior ? cfg.pkm.behavior.order : null);
    const keys = (Array.isArray(order.left) ? order.left : []).concat(Array.isArray(order.right) ? order.right : []);
    for (let i = 0; i < keys.length; i++) {
      const key = String(keys[i] || "").trim();
      if (!key || seen.has(key)) continue;
      const field = resolveOrderField(cfg, key);
      if (!field || !field.id) continue;
      if (!isElementLikeField(field, key, order)) continue;
      out.push({
        orderKey: key,
        sectionId: String(getOrderStrictName(cfg, key) || key).trim() || key,
        fieldId: String(field.id || "").trim(),
        kind: String(field.kind || "").trim(),
      });
      seen.add(key);
    }
    return out;
  }

  function getPrefixRulesFromCfg(cfg) {
    const out = {
      resolver: "priority-first",
      priorityMode: "by-section",
      fieldsOrderMode: "manual",
      tagSubtagPriority: "subtag-over-tag",
      priorityTargets: [],
      priorityCheckboxes: [],
      checkboxByFieldValue: {},
    };
    const pkmBehavior = cfg && cfg.pkm && isObj(cfg.pkm.behavior) ? cfg.pkm.behavior : {};
    const src = isObj(pkmBehavior.prefixRules) ? pkmBehavior.prefixRules : {};

    const resolver = String(src.resolver || "").trim();
    if (resolver) out.resolver = resolver;
    const priorityMode = String(src.priorityMode || "").trim();
    if (priorityMode) out.priorityMode = priorityMode;
    const fieldsOrderMode = String(src.fieldsOrderMode || "").trim();
    if (fieldsOrderMode) out.fieldsOrderMode = fieldsOrderMode;
    const tagSubtagPriority = String(src.tagSubtagPriority || "").trim();
    if (tagSubtagPriority) out.tagSubtagPriority = tagSubtagPriority;
    const pr = Array.isArray(src.priorityTargets) ? src.priorityTargets : [];
    out.priorityTargets = pr.map((x) => String(x || "").trim()).filter(Boolean);
    const pc = Array.isArray(src.priorityCheckboxes) ? src.priorityCheckboxes : [];
    out.priorityCheckboxes = Array.from(new Set(pc.map((x) => String(x || "").trim()).filter(Boolean)));
    const cb = isObj(src.checkboxByFieldValue) ? src.checkboxByFieldValue : {};
    for (const fid of Object.keys(cb)) {
      if (!isObj(cb[fid])) continue;
      out.checkboxByFieldValue[fid] = {};
      for (const tok of Object.keys(cb[fid])) {
        const v = String(cb[fid][tok] || "").trim();
        if (!v) continue;
        out.checkboxByFieldValue[fid][tok] = v;
      }
    }
    return out;
  }

  function collectCheckboxTokensFromMap(checkboxByFieldValue) {
    const out = [];
    const map = isObj(checkboxByFieldValue) ? checkboxByFieldValue : {};
    for (const fid of Object.keys(map)) {
      if (!isObj(map[fid])) continue;
      for (const token of Object.keys(map[fid])) {
        const cb = String(map[fid][token] || "").trim();
        if (!cb) continue;
        if (!out.includes(cb)) out.push(cb);
      }
    }
    return out;
  }

  function parseCustomPrefixResolverBlock(md, allowedSections) {
    const lines = String(md || "").split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^#{3,5}\s+`?(?:PREFIX\s+RESOLVER|Prefix\s+resolver)`?\s*$/i.test(String(lines[i] || "").trim())) {
        start = i;
        break;
      }
    }
    if (start === -1) return null;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^###\s+/.test(String(lines[i] || "").trim())) {
        end = i;
        break;
      }
    }
    const block = lines.slice(start, end);
    const pickChecked = (re) => {
      const out = [];
      for (let i = 0; i < block.length; i++) {
        const t = String(block[i] || "");
        if (!/^\s*-\s*\[x\]\s+/i.test(t)) continue;
        if (re.test(t)) out.push({ idx: i, lineNo: start + i + 1, text: t.trim() });
      }
      return out;
    };

    const checkedMainFields = pickChecked(/\*\*by\s+Fields\s+Order\*\*/i);
    const checkedMainCheckbox = pickChecked(/\*\*by\s+Checkbox\s+Order\*\*/i);
    const totalMainChecked = checkedMainFields.length + checkedMainCheckbox.length;
    if (totalMainChecked > 1) throw new Error("Prefix resolver: choose only one main priority option (by Fields Order OR by Checkbox Order).");
    if (totalMainChecked === 0) throw new Error("Prefix resolver: choose one main priority option.");
    const mode = checkedMainCheckbox.length ? "by-checkbox-list" : "by-section";

    const checkedAuto = pickChecked(/\*\*Automatically\*\*/i);
    const checkedManual = pickChecked(/\*\*Manually\*\*/i);
    let fieldsOrderMode = "manual";
    if (mode === "by-section") {
      const total = checkedAuto.length + checkedManual.length;
      if (total > 1) throw new Error("Prefix resolver: choose only one fields-order mode (Automatically OR Manually).");
      if (total === 0) throw new Error("Prefix resolver: choose one fields-order mode for by Fields Order.");
      fieldsOrderMode = checkedAuto.length ? "auto" : "manual";
    }

    const checkedTagOverSubtag = pickChecked(/\*\*Tag\s*>\s*Subtag\*\*/i);
    const checkedSubtagOverTag = pickChecked(/\*\*Subtag\s*>\s*Tag\*\*/i);
    const totalTagMode = checkedTagOverSubtag.length + checkedSubtagOverTag.length;
    if (totalTagMode > 1) throw new Error("Prefix resolver: choose only one Tag/Subtag priority option.");
    if (totalTagMode === 0) throw new Error("Prefix resolver: choose one Tag/Subtag priority option.");
    const tagSubtagPriority = checkedSubtagOverTag.length ? "subtag-over-tag" : "tag-over-subtag";

    const sectionOrder = [];
    const sectionOrderRaw = [];
    const checkboxOrder = [];
    let inFields = false;
    let inCheckbox = false;
    for (let i = 0; i < block.length; i++) {
      const raw = String(block[i] || "");
      const t = raw.trim();
      if (/^1[\).]\s*\*\*Fields\s+Order:\*\*/i.test(t)) { inFields = true; inCheckbox = false; continue; }
      if (/^2[\).]\s*\*\*Checkbox\s+Order:\*\*/i.test(t)) { inFields = false; inCheckbox = true; continue; }
      if (inFields) {
        const m = t.match(/^[-*]\s+([A-Za-z0-9_-]+)$/);
        if (m) {
          const sid = String(m[1] || "").trim();
          if (sid && !sectionOrderRaw.includes(sid)) sectionOrderRaw.push(sid);
          if (allowedSections.includes(sid) && !sectionOrder.includes(sid)) sectionOrder.push(sid);
        }
        continue;
      }
      if (inCheckbox) {
        const m = t.match(/^[-*]\s+(\[[^\]]+\])/);
        if (m) {
          const cb = String(m[1] || "").trim();
          if (cb && !checkboxOrder.includes(cb)) checkboxOrder.push(cb);
        }
      }
    }
    return { mode, fieldsOrderMode, tagSubtagPriority, sectionOrder, sectionOrderRaw, checkboxOrder, range: { start: start, end: end } };
  }

  function syncCustomPrefixResolverBlock(md, sectionOrder, checkboxOrder, mode, fieldsOrderMode, tagSubtagPriority) {
    const lines = String(md || "").split(/\r?\n/);
    const parsed = parseCustomPrefixResolverBlock(md, sectionOrder);
    const modeName = String(mode || "by-section").trim() === "by-checkbox-list" ? "by-checkbox-list" : "by-section";
    const fieldsModeName = String(fieldsOrderMode || "manual").trim() === "auto" ? "auto" : "manual";
    const tagModeName = String(tagSubtagPriority || "subtag-over-tag").trim() === "tag-over-subtag" ? "tag-over-subtag" : "subtag-over-tag";

    const buildBlock = (oldLines) => {
      const src = Array.isArray(oldLines) ? oldLines.slice() : [];
      if (!src.length) {
        return [
          "### " + TAGWHEEL_PREFIX_RESOLVER_H3,
          "> if you have tags with checkboxes in different fields (i.e. 'type' and 'category') - it can lead to conflicts (like, which tag's checkbox should be visible if you use both tags in the same time)",
          "#### Settings",
          "1. **Main checkbox priority** (Choose only one option by clicking on it):",
          "> If you have tags with checkboxes in different fields (i.e. 'type' (#todo) and 'category' (#home)) - it can lead to conflicts (which tag's checkbox should be active if you use both tags at the same time?). So you need to decide how you want to resolve this conflict",
          "> Choose only one parent option by clicking on it (and un-click the second).",
          "- [" + (modeName === "by-section" ? "x" : " ") + "] **by Fields Order** (choose only one option below)",
          "\t- [" + (modeName === "by-section" && fieldsModeName === "auto" ? "x" : " ") + "] **Automatically** - by plugin settings \"Order\" (PKM -> Order). Left panel tags > right panel tags, priority decreases from up to down",
          "\t- [" + (modeName === "by-section" && fieldsModeName === "manual" ? "x" : " ") + "] **Manually** - by your settings `Fields order` (go below to subheader `Order`)",
          "- [" + (modeName === "by-checkbox-list" ? "x" : " ") + "] **by Checkbox Order** - by your settings `Checkbox order` (go to subheader `Order`)",
          "",
          "2. **Tag vs Subtag checkbox priority** (Choose only one option by clicking on it)",
          "> If both your tag (#home) and its subtag (#budget) have their own checkbox, which one's checkbox should appear?",
          "> Choose only one option by clicking on it (and un-click the second)",
          "- [" + (tagModeName === "tag-over-subtag" ? "x" : " ") + "] **Tag > Subtag** - (the checkbox will be from `#home`)",
          "- [" + (tagModeName === "subtag-over-tag" ? "x" : " ") + "] **Subtag > Tag** - (the checkbox will be from `#budget`)",
          "",
          "#### Order",
          ">You can manually setup the order below (just reorder them from up to down)",
          ">The higher element is -> the more powerful the checkbox would be.",
          ">After making changes -> Apply them so it works ()",
          "",
          "**Settings**",
          "1) **Fields Order:**",
          ...sectionOrder.map((x) => "\t- " + x),
          "",
          "2) **Checkbox Order:**",
          ...checkboxOrder.map((x) => "\t- " + x + " - `- " + x + "`"),
        ];
      }
      const out = src.slice();
      for (let i = 0; i < out.length; i++) {
        if (/^\s*-\s*\[[x ]\]\s*\*\*by\s+Fields\s+Order\*\*/i.test(out[i])) {
          out[i] = modeName === "by-section" ? out[i].replace(/^\s*-\s*\[[x ]\]/, "- [x]") : out[i].replace(/^\s*-\s*\[[x ]\]/, "- [ ]");
        }
        if (/^\s*[-*]\s*\[[x ]\]\s*\*\*Automatically\*\*/i.test(out[i])) {
          out[i] = "\t- [" + (modeName === "by-section" && fieldsModeName === "auto" ? "x" : " ") + "] **Automatically** - by plugin settings \"Order\" (PKM -> Order). Left panel tags > right panel tags, priority decreases from up to down";
        }
        if (/^\s*[-*]\s*\[[x ]\]\s*\*\*Manually\*\*/i.test(out[i])) {
          out[i] = "\t- [" + (modeName === "by-section" && fieldsModeName === "manual" ? "x" : " ") + "] **Manually** - by your settings `Fields order` (go below to subheader `Order`)";
        }
        if (/^\s*-\s*\[[x ]\]\s*\*\*by\s+Checkbox\s+Order\*\*/i.test(out[i])) {
          out[i] = modeName === "by-checkbox-list" ? out[i].replace(/^\s*-\s*\[[x ]\]/, "- [x]") : out[i].replace(/^\s*-\s*\[[x ]\]/, "- [ ]");
        }
        if (/^\s*[-*]\s*\[[x ]\]\s*\*\*Tag\s*>\s*Subtag\*\*/i.test(out[i])) {
          out[i] = tagModeName === "tag-over-subtag" ? out[i].replace(/^\s*[-*]\s*\[[x ]\]/, "- [x]") : out[i].replace(/^\s*[-*]\s*\[[x ]\]/, "- [ ]");
        }
        if (/^\s*[-*]\s*\[[x ]\]\s*\*\*Subtag\s*>\s*Tag\*\*/i.test(out[i])) {
          out[i] = tagModeName === "subtag-over-tag" ? out[i].replace(/^\s*[-*]\s*\[[x ]\]/, "- [x]") : out[i].replace(/^\s*[-*]\s*\[[x ]\]/, "- [ ]");
        }
      }
      const fieldsHdr = out.findIndex((l) => /^\s*1[\).]\s*\*\*Fields\s+Order:\*\*/i.test(String(l || "")));
      const checksHdr = out.findIndex((l) => /^\s*2[\).]\s*\*\*Checkbox\s+Order:\*\*/i.test(String(l || "")));
      if (fieldsHdr !== -1 && checksHdr !== -1 && checksHdr > fieldsHdr) {
        const keepHead = out.slice(0, fieldsHdr + 1);
        const between = sectionOrder.map((x) => "\t- " + x);
        const tail = out.slice(checksHdr + 1);
        const newTail = checkboxOrder.map((x) => "\t- " + x + " - `- " + x + "`");
        return keepHead.concat(between, [""], [out[checksHdr]], newTail, [""], tail.filter((l) => !/^\s*[-*]\s+\[[^\]]+\]\s*-\s*`-\s*\[[^\]]+\]`\s*$/i.test(String(l || ""))));
      }
      return out;
    };

    if (!parsed) {
      const block = buildBlock([]);
      return lines.concat(["", ...block]).join("\n");
    }
    const before = lines.slice(0, parsed.range.start);
    const oldBlock = lines.slice(parsed.range.start, parsed.range.end);
    const after = lines.slice(parsed.range.end);
    const synced = buildBlock(oldBlock);
    return before.concat(synced, after).join("\n");
  }

  return {
    getLeftFields,
    getRightFields,
    resolveOrderField,
    getFieldById,
    collectWikilinkFieldIds,
    collectTagSections,
    collectOrderedElementFields,
    getPrefixRulesFromCfg,
    collectCheckboxTokensFromMap,
    parseCustomPrefixResolverBlock,
    syncCustomPrefixResolverBlock,
  };
}

module.exports = {
  createConfigNoteHelpers,
};
