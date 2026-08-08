"use strict";

function createTagWheelConfigParser(opts) {
  const {
    isObj,
    collectTagSections,
    collectWikilinkFieldIds,
    parseCustomPrefixResolverBlock,
    isWikilinkToken,
    parseWikilinkLineStrict,
    extractFirstTagToken,
    parseCheckboxAndTag,
    denormTagToken,
    CFG_H1_SETTINGS,
    CFG_H2_DATES,
    CFG_H2_ELEMENTS,
    CFG_H2_ELEMENTS_COMBINED,
    TAGWHEEL_PREFIX_RESOLVER_SECTION,
    TAGWHEEL_WIKILINK_SECTION,
  } = opts || {};

  function collectMissingEmojiFields(parsed) {
    const out = [];
    const pushIfMissing = (fieldId, row) => {
      const fid = String(fieldId || "").trim();
      if (!fid) return;
      const src = isObj(row) ? row : {};
      const emoji = String(src.emoji == null ? "" : src.emoji).trim();
      if (!emoji && !out.includes(fid)) out.push(fid);
    };

    const elems = isObj(parsed && parsed.elementsConfig) ? parsed.elementsConfig : {};
    const elemsByField = isObj(elems.byField) ? elems.byField : {};
    const elemsFields = Array.isArray(elems.fields) ? elems.fields : [];

    const allElems = Array.from(new Set(elemsFields.concat(Object.keys(elemsByField || {}))));
    for (let i = 0; i < allElems.length; i++) pushIfMissing(allElems[i], elemsByField[allElems[i]]);
    return out;
  }

  return function parseTagWheelConfigMarkdown(md, cfg) {
    const lines = String(md || "").split(/\r?\n/);
    const USER_TAGS_SECTION = "User tags";
    const ORPHAN_WIKILINKS_SECTION = "Orphan wikilinks";
    const parseSectionHeader = (rawSection) => {
      const src = String(rawSection || "").trim();
      const m = src.match(/^(.*?)\s*-\s*(tag|link|wikilink)\s*$/i);
      if (!m) return { sectionId: src, kind: "" };
      const sectionId = String(m[1] || "").trim();
      const kindRaw = String(m[2] || "").trim().toLowerCase();
      return { sectionId, kind: kindRaw === "tag" ? "tag" : "link" };
    };
    const tagsHeaderRe = /^###\s+(?:`?#?TAGS\/#?SUBTAGS`?\s*\+\s*`?WIKILINKS`?|TAGS\/SUBTAGS\+WIKILINKS|#TAGS\/#SUBTAGS\s*\+\s*WIKILINKS|TagWheel)\s*$/mi;
    const prefixResolverHeaderRe = /^#{3,5}\s+`?(?:PREFIX\s+RESOLVER|Prefix\s+resolver)`?\s*$/mi;
    if (!/^##\s+Settings\s*$/m.test(String(md || ""))) throw new Error("Config format error: missing '## Settings'");
    if (!tagsHeaderRe.test(String(md || ""))) throw new Error("Config format error: missing tags section header");
    if (!prefixResolverHeaderRe.test(String(md || ""))) throw new Error("Config format error: missing '###/#### Prefix resolver'");
    const sectionDefs = collectTagSections(cfg);
    const allowedSections = sectionDefs.map((x) => x.sectionId);
    const sectionDefById = {};
    for (let i = 0; i < sectionDefs.length; i++) sectionDefById[sectionDefs[i].sectionId] = sectionDefs[i];
    const sectionMap = {};
    for (let i = 0; i < allowedSections.length; i++) sectionMap[allowedSections[i]] = true;
    const allowedWikilinkFields = collectWikilinkFieldIds(cfg);
    const leftFields = cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.leftMode && Array.isArray(cfg.pkm.behavior.leftMode.fields)
      ? cfg.pkm.behavior.leftMode.fields
      : [];
    const fieldById = {};
    for (let i = 0; i < leftFields.length; i++) {
      const f = leftFields[i];
      if (!f || !f.id) continue;
      fieldById[String(f.id)] = f;
    }
    const isWikilinkField = (fieldId) => {
      const fid = String(fieldId || "").trim();
      if (!fid) return false;
      if (allowedWikilinkFields.includes(fid)) return true;
      const f = fieldById[fid];
      if (!f) return false;
      const src = String(f.source || "").trim();
      return src === "projects" || src.startsWith("wikilinks:");
    };
    const allowedWikilinkFieldsDynamic = Array.isArray(allowedWikilinkFields) ? allowedWikilinkFields.slice() : [];
    const allowedWikilinkFieldsBySection = {};
    for (let i = 0; i < sectionDefs.length; i++) {
      const d = sectionDefs[i] || {};
      const sid = String(d.sectionId || "").trim();
      if (!sid) continue;
      const scoped = [];
      const pushScoped = (fid) => {
        const id = String(fid || "").trim();
        if (!id || scoped.includes(id)) return;
        if (!isWikilinkField(id)) return;
        scoped.push(id);
      };
      pushScoped(d.fieldId);
      pushScoped(d.subFieldId);
      allowedWikilinkFieldsBySection[sid] = scoped;
    }

    const sections = {};
    const sectionKinds = {};
    const sectionOrder = [];
    let current = "";
    let topH3 = "";
    let topH2 = "";
    for (let i = 0; i < lines.length; i++) {
      const lineNo = i + 1;
      const raw = lines[i];
      const h2 = String(raw || "").match(/^##\s+(.+)$/);
      if (h2) {
        topH2 = String(h2[1] || "").trim();
        topH3 = "";
        current = "";
        continue;
      }
      const h3 = String(raw || "").match(/^###\s+(.+)$/);
      if (h3) {
        topH3 = String(h3[1] || "").trim();
        current = "";
        continue;
      }
      const h = String(raw || "").match(/^#{4,5}\s+(.+)$/);
      if (h) {
        if (String(topH2 || "").toLowerCase() !== String(CFG_H1_SETTINGS || "Settings").toLowerCase()) {
          current = "";
          continue;
        }
        if (!/^(?:`?#?TAGS\/#?SUBTAGS`?\s*\+\s*`?WIKILINKS`?|TAGS\/SUBTAGS\+WIKILINKS|#TAGS\/#SUBTAGS\s*\+\s*WIKILINKS|TagWheel)$/i.test(String(topH3 || ""))) {
          current = "";
          continue;
        }
        const rawSection = String(h[1] || "").trim();
        if (/^(Prefix resolver|Settings|Order)$/i.test(rawSection)) {
          current = "";
          continue;
        }
        const parsedHeader = parseSectionHeader(rawSection);
        current = String(parsedHeader.sectionId || "").trim();
        const explicitKind = String(parsedHeader.kind || "").trim();
        if (!current) {
          current = "";
          continue;
        }
        if (!sectionMap[current] && current !== USER_TAGS_SECTION && current !== ORPHAN_WIKILINKS_SECTION && !explicitKind) {
          current = "";
          continue;
        }
        if (!sections[current]) sections[current] = { name: current, line: lineNo, items: [] };
        if (current !== USER_TAGS_SECTION && !sectionOrder.includes(current)) {
          sectionOrder.push(current);
        }
        if (current === ORPHAN_WIKILINKS_SECTION) {
          if (explicitKind) sectionKinds[current] = explicitKind;
        } else if (current !== USER_TAGS_SECTION) {
          if (explicitKind) sectionKinds[current] = explicitKind;
          else {
            const def = sectionDefById[current];
            const fid = String(def && def.fieldId ? def.fieldId : "").trim();
            sectionKinds[current] = isWikilinkField(fid) ? "link" : "tag";
          }
        }
        continue;
      }
      const m = String(raw || "").match(/^(\s*)-\s+(.+)$/);
      if (!m || !current) continue;
      sections[current].items.push({ indent: m[1].length, text: String(m[2] || "").trim(), line: lineNo });
    }

    for (const sectionId of Object.keys(sectionKinds)) {
      const sid = String(sectionId || "").trim();
      if (!sid) continue;
      const kind = String(sectionKinds[sid] || "").trim().toLowerCase();
      if (kind !== "link") continue;
      if (!allowedWikilinkFieldsDynamic.includes(sid)) allowedWikilinkFieldsDynamic.push(sid);
      if (!Array.isArray(allowedWikilinkFieldsBySection[sid]) || !allowedWikilinkFieldsBySection[sid].length) {
        allowedWikilinkFieldsBySection[sid] = [sid];
      }
    }

    const parsed = {
      sections: {},
      wikilinkFields: allowedWikilinkFieldsDynamic.slice(),
      checkboxByFieldValue: {},
      datesConfig: {
        behavior: {
          time_step_minutes: 5,
          time_rounding: "nearest",
          date_step_days: 1,
          date_format: "YYYY-MM-DD",
          time_format: "HH:mm",
        },
        fields: [],
        byField: {},
      },
      elementsConfig: {
        fields: [],
        byField: {},
      },
      tagVisuals: {
        byTag: {},
        userTags: {},
      },
      yamlByFieldValue: {},
      fieldYamlBySection: {},
      elementYamlByField: {},
      prefixResolver: {
        mode: "by-section",
        fieldsOrderMode: "manual",
        tagSubtagPriority: "subtag-over-tag",
        sectionOrder: allowedSections.slice(),
        sectionOrderRaw: allowedSections.slice(),
        checkboxOrder: [],
      },
      orphanWikilinks: {},
      sectionKinds,
      sectionOrder,
    };

    const parseH2ListAndKv = (h2Name) => {
      const all = String(md || "").split(/\r?\n/);
      const start = all.findIndex((ln) => new RegExp(`^##\\s+${h2Name}\\s*$`, "i").test(String(ln || "").trim()));
      if (start === -1) return { kv: {}, list: [] };
      let end = all.length;
      for (let i = start + 1; i < all.length; i++) {
        if (/^##\s+/.test(String(all[i] || "").trim())) { end = i; break; }
      }
      const block = all.slice(start + 1, end);
      const kv = {};
      const list = [];
      for (let i = 0; i < block.length; i++) {
        const m = String(block[i] || "").match(/^\s*-\s+(.+)$/);
        if (!m) continue;
        const text = String(m[1] || "").trim();
        const kvm = text.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.+)$/);
        if (kvm) kv[String(kvm[1]).trim()] = String(kvm[2]).trim();
        else list.push(text);
      }
      return { kv, list };
    };
    const parseCombinedDateElementsBlocks = () => {
      const all = String(md || "").split(/\r?\n/);
      const combinedHeaders = [
        String(CFG_H2_ELEMENTS_COMBINED || "").trim(),
        "DATE/TIME + ELEMENTS",
        "DATES + TIME + ELEMENTS",
        "DATES + EMOJI ELEMENTS",
      ].filter(Boolean);
      const normalizeHeader = (h) => String(h || "")
        .trim()
        .replace(/^`|`$/g, "")
        .toLowerCase();
      const normalizeHeaderLoose = (h) => normalizeHeader(h)
        .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/gu, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const expected = new Set(combinedHeaders.map((h) => normalizeHeader(h)));
      const expectedLoose = new Set(combinedHeaders.map((h) => normalizeHeaderLoose(h)).filter(Boolean));
      const start = all.findIndex((ln) => {
        const t = String(ln || "").trim();
        const m = t.match(/^###\s+(.+)$/);
        if (!m) return false;
        const strict = normalizeHeader(m[1]);
        if (expected.has(strict)) return true;
        const loose = normalizeHeaderLoose(m[1]);
        if (expectedLoose.has(loose)) return true;
        const parts = loose.split(" ").filter(Boolean);
        const hasDate = parts.includes("date") || parts.includes("dates");
        const hasTime = parts.some((p) => /^time$/i.test(String(p || "")));
        const hasElements = parts.includes("elements");
        return hasDate && hasTime && hasElements;
      });
      if (start === -1) return { body: null, hasCombined: false };
      let end = all.length;
      for (let i = start + 1; i < all.length; i++) {
        const t = String(all[i] || "").trim();
        if (/^##\s+/.test(t)) { end = i; break; }
      }
      const body = all.slice(start + 1, end);
      return { body, hasCombined: true };
    };
    const parseDateTimeFromBlock = (blockLines) => {
      const block = Array.isArray(blockLines) ? blockLines : [];
      const fields = [];
      const byField = {};
      const kv = {};
      let cur = "";
      let inIncrement = false;
      let inHotkey = false;
      for (let i = 0; i < block.length; i++) {
        const raw = String(block[i] || "");
        const t = raw.trim();
        const hh = t.match(/^#####\s+(.+)$/);
        if (hh) {
          cur = String(hh[1] || "").trim();
          inIncrement = false;
          inHotkey = false;
          if (cur && !fields.includes(cur)) fields.push(cur);
          if (!isObj(byField[cur])) byField[cur] = {};
          continue;
        }
        if (!cur) {
          const topKV = t.match(/^-\s+([A-Za-z0-9_\-]+)\s*:\s*(.+)$/);
          if (topKV) kv[String(topKV[1] || "").trim()] = String(topKV[2] || "").trim();
          continue;
        }
        const activeM = t.match(/^-\s*Active\s*:\s*(.+)$/i);
        if (activeM) { byField[cur].activeMode = String(activeM[1] || "").trim().toLowerCase(); inIncrement = false; inHotkey = false; continue; }
        const emojiM = t.match(/^-\s*Emoji\s*:\s*(.*)$/i);
        if (emojiM) { byField[cur].emoji = String(emojiM[1] || ""); continue; }
        const fmtM = t.match(/^-\s*Format\s*:\s*(.*)$/i);
        if (fmtM) { byField[cur].format = String(fmtM[1] || "").trim(); continue; }
        const yamlM = t.match(/^-\s*YAML\s*:\s*(.*)$/i);
        if (yamlM) { byField[cur].yamlProperty = String(yamlM[1] || "").trim(); continue; }
        if (/^-\s*Hotkey\s*:\s*$/i.test(t)) {
          inHotkey = true;
          inIncrement = false;
          if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
          continue;
        }
        if (inHotkey) {
          const incHot = t.match(/^[-*]\s*increase\s*:\s*(.*)$/i);
          if (incHot) {
            if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
            byField[cur].hotkey.increase = String(incHot[1] || "").trim();
            continue;
          }
          const decHot = t.match(/^[-*]\s*decrease\s*:\s*(.*)$/i);
          if (decHot) {
            if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
            byField[cur].hotkey.decrease = String(decHot[1] || "").trim();
            continue;
          }
        }
        if (/^-\s*(increment|behavior)\s*:\s*$/i.test(t)) {
          inIncrement = true;
          inHotkey = false;
          if (!isObj(byField[cur].increment)) byField[cur].increment = { mode: "standard", custom: [], customRaw: [], incrementBy: 0, command: "now" };
          continue;
        }
        if (inIncrement) {
          if (/^[-*]\s*\[x\]\s*standard/i.test(t)) byField[cur].increment.mode = "standard";
          const incM = t.match(/^[-*]\s*\[x\]\s*increment\s+by\s*\(\s*(-?\d+)\s*\)/i);
          if (incM) {
            byField[cur].increment.mode = "standard";
            byField[cur].increment.incrementBy = Math.max(0, Math.trunc(Number(incM[1] || 0)));
          }
          const cmdM = t.match(/^[-*]\s*\[x\]\s*command\s*\(\s*([^\)]+)\s*\)/i);
          if (cmdM) {
            byField[cur].increment.mode = "command";
            byField[cur].increment.command = String(cmdM[1] || "now").trim() || "now";
          }
          if (/^[-*]\s*\[x\]\s*custom/i.test(t)) byField[cur].increment.mode = "custom";
          const rawItemM = t.match(/^\d+[\).]\s*(.+?)\s*$/);
          if (rawItemM) {
            if (!Array.isArray(byField[cur].increment.customRaw)) byField[cur].increment.customRaw = [];
            byField[cur].increment.customRaw.push(String(rawItemM[1] || "").trim());
          }
          const stepM = t.match(/^\d+[\).]\s*(-?\d+)(?:\s*\(\s*(\d+)\s*\))?\s*$/);
          if (stepM) {
            if (!Array.isArray(byField[cur].increment.custom)) byField[cur].increment.custom = [];
            const stepVal = Math.max(0, Math.trunc(Number(stepM[1] || 0)));
            const repeat = Math.max(1, Math.trunc(Number(stepM[2] || 1)));
            for (let ri = 0; ri < repeat; ri++) byField[cur].increment.custom.push(stepVal);
          }
        }
      }
      return { fields, byField, kv };
    };
    const inferDateLikeFieldIdsFromConfig = (cfgInput) => {
      const out = new Set();
      const byField = cfgInput && cfgInput.pkm && cfgInput.pkm.behavior && cfgInput.pkm.behavior.elements
        && isObj(cfgInput.pkm.behavior.elements.byField)
        ? cfgInput.pkm.behavior.elements.byField
        : {};
      const maybeDateFormat = (fmt) => {
        const s = String(fmt || "").trim();
        if (!s) return false;
        const hasCalendar = /Y|M|D/.test(s);
        const hasClock = /H\s*:?\s*m|h\s*:?\s*m|:\s*m/.test(s);
        return hasCalendar || hasClock;
      };
      for (const fid of Object.keys(byField)) {
        const row = isObj(byField[fid]) ? byField[fid] : {};
        if (maybeDateFormat(row.format)) out.add(String(fid || "").trim());
      }
      return out;
    };
    const parseDateTimeByField = (h3Names) => {
      const names = Array.isArray(h3Names) ? h3Names : [h3Names];
      const all = String(md || "").split(/\r?\n/);
      let start = -1;
      for (let ni = 0; ni < names.length; ni++) {
        start = all.findIndex((ln) => new RegExp(`^###\\s+${String(names[ni] || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i").test(String(ln || "").trim()));
        if (start !== -1) break;
      }
      if (start === -1) return { fields: [], byField: {}, kv: {} };
      let end = all.length;
      for (let i = start + 1; i < all.length; i++) {
        const t = String(all[i] || "").trim();
        if (/^###\s+/.test(t) || /^##\s+/.test(t)) { end = i; break; }
      }
      const block = all.slice(start + 1, end);
      const fields = [];
      const byField = {};
      const kv = {};
      let cur = "";
      let inIncrement = false;
      let inHotkey = false;
      for (let i = 0; i < block.length; i++) {
        const raw = String(block[i] || "");
        const t = raw.trim();
        const hh = t.match(/^#####\s+(.+)$/);
        if (hh) {
          cur = String(hh[1] || "").trim();
          inIncrement = false;
          inHotkey = false;
          if (cur && !fields.includes(cur)) fields.push(cur);
          if (!isObj(byField[cur])) byField[cur] = {};
          continue;
        }
        if (!cur) {
          const topKV = t.match(/^-\s+([A-Za-z0-9_\-]+)\s*:\s*(.+)$/);
          if (topKV) kv[String(topKV[1] || "").trim()] = String(topKV[2] || "").trim();
          continue;
        }
        const activeM = t.match(/^-\s*Active\s*:\s*(.+)$/i);
        if (activeM) { byField[cur].activeMode = String(activeM[1] || "").trim().toLowerCase(); inIncrement = false; inHotkey = false; continue; }
        const emojiM = t.match(/^-\s*Emoji\s*:\s*(.*)$/i);
        if (emojiM) { byField[cur].emoji = String(emojiM[1] || ""); continue; }
        const fmtM = t.match(/^-\s*Format\s*:\s*(.*)$/i);
        if (fmtM) { byField[cur].format = String(fmtM[1] || "").trim(); continue; }
        const yamlM = t.match(/^-\s*YAML\s*:\s*(.*)$/i);
        if (yamlM) { byField[cur].yamlProperty = String(yamlM[1] || "").trim(); continue; }
        if (/^-\s*Hotkey\s*:\s*$/i.test(t)) {
          inHotkey = true;
          inIncrement = false;
          if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
          continue;
        }
        if (inHotkey) {
          const incHot = t.match(/^[-*]\s*increase\s*:\s*(.*)$/i);
          if (incHot) {
            if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
            byField[cur].hotkey.increase = String(incHot[1] || "").trim();
            continue;
          }
          const decHot = t.match(/^[-*]\s*decrease\s*:\s*(.*)$/i);
          if (decHot) {
            if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
            byField[cur].hotkey.decrease = String(decHot[1] || "").trim();
            continue;
          }
        }
        if (/^-\s*(increment|behavior)\s*:\s*$/i.test(t)) {
          inIncrement = true;
          inHotkey = false;
          if (!isObj(byField[cur].increment)) byField[cur].increment = { mode: "standard", custom: [], customRaw: [], incrementBy: 0, command: "now" };
          continue;
        }
        if (inIncrement) {
          if (/^[-*]\s*\[x\]\s*standard/i.test(t)) byField[cur].increment.mode = "standard";
          const incM = t.match(/^[-*]\s*\[x\]\s*increment\s+by\s*\(\s*(-?\d+)\s*\)/i);
          if (incM) {
            byField[cur].increment.mode = "standard";
            byField[cur].increment.incrementBy = Math.max(0, Math.trunc(Number(incM[1] || 0)));
          }
          const cmdM = t.match(/^[-*]\s*\[x\]\s*command\s*\(\s*([^\)]+)\s*\)/i);
          if (cmdM) {
            byField[cur].increment.mode = "command";
            byField[cur].increment.command = String(cmdM[1] || "now").trim() || "now";
          }
          if (/^[-*]\s*\[x\]\s*custom/i.test(t)) byField[cur].increment.mode = "custom";
          const rawItemM = t.match(/^\d+[\).]\s*(.+?)\s*$/);
          if (rawItemM) {
            if (!Array.isArray(byField[cur].increment.customRaw)) byField[cur].increment.customRaw = [];
            byField[cur].increment.customRaw.push(String(rawItemM[1] || "").trim());
          }
          const stepM = t.match(/^\d+[\).]\s*(-?\d+)(?:\s*\(\s*(\d+)\s*\))?\s*$/);
          if (stepM) {
            if (!Array.isArray(byField[cur].increment.custom)) byField[cur].increment.custom = [];
            const stepVal = Math.max(0, Math.trunc(Number(stepM[1] || 0)));
            const repeat = Math.max(1, Math.trunc(Number(stepM[2] || 1)));
            for (let ri = 0; ri < repeat; ri++) byField[cur].increment.custom.push(stepVal);
          }
        }
      }
      return { fields, byField, kv };
    };
    const parseElementsByField = (h3Names) => {
      const names = Array.isArray(h3Names) ? h3Names : [h3Names];
      const all = String(md || "").split(/\r?\n/);
      let start = -1;
      for (let ni = 0; ni < names.length; ni++) {
        start = all.findIndex((ln) => new RegExp(`^###\\s+${String(names[ni] || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i").test(String(ln || "").trim()));
        if (start !== -1) break;
      }
      if (start === -1) return { fields: [], byField: {} };
      let end = all.length;
      for (let i = start + 1; i < all.length; i++) {
        const t = String(all[i] || "").trim();
        if (/^###\s+/.test(t) || /^##\s+/.test(t)) { end = i; break; }
      }
      const block = all.slice(start + 1, end);
      const fields = [];
      const byField = {};
      let cur = "";
      let inIncrement = false;
      let inHotkey = false;
      for (let i = 0; i < block.length; i++) {
        const raw = String(block[i] || "");
        const t = raw.trim();
        const hh = t.match(/^#####\s+(.+)$/);
        if (hh) {
          cur = String(hh[1] || "").trim();
          inIncrement = false;
          inHotkey = false;
          if (cur && !fields.includes(cur)) fields.push(cur);
          if (!isObj(byField[cur])) byField[cur] = {};
          continue;
        }
        if (!cur) continue;
        const emojiM = t.match(/^-\s*Emoji\s*:\s*(.*)$/i);
        if (emojiM) { byField[cur].emoji = String(emojiM[1] || ""); inIncrement = false; inHotkey = false; continue; }
        const fmtM = t.match(/^-\s*Format\s*:\s*(.*)$/i);
        if (fmtM) { byField[cur].format = String(fmtM[1] || "").trim(); inIncrement = false; inHotkey = false; continue; }
        if (/^-\s*Hotkey\s*:\s*$/i.test(t)) {
          inHotkey = true;
          inIncrement = false;
          if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
          continue;
        }
        if (inHotkey) {
          const incHot = t.match(/^[-*]\s*increase\s*:\s*(.*)$/i);
          if (incHot) {
            if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
            byField[cur].hotkey.increase = String(incHot[1] || "").trim();
            continue;
          }
          const decHot = t.match(/^[-*]\s*decrease\s*:\s*(.*)$/i);
          if (decHot) {
            if (!isObj(byField[cur].hotkey)) byField[cur].hotkey = { increase: "", decrease: "" };
            byField[cur].hotkey.decrease = String(decHot[1] || "").trim();
            continue;
          }
        }
        if (/^-\s*(increment|behavior)\s*:\s*$/i.test(t)) {
          inIncrement = true;
          inHotkey = false;
          if (!isObj(byField[cur].increment)) byField[cur].increment = { mode: "standard", custom: [], customRaw: [], incrementBy: 0, command: "now" };
          continue;
        }
        if (inIncrement) {
          if (/^[-*]\s*\[x\]\s*standard/i.test(t)) byField[cur].increment.mode = "standard";
          const incM = t.match(/^[-*]\s*\[x\]\s*increment\s+by\s*\(\s*(-?\d+)\s*\)/i);
          if (incM) {
            byField[cur].increment.mode = "standard";
            byField[cur].increment.incrementBy = Math.max(0, Math.trunc(Number(incM[1] || 0)));
          }
          const cmdM = t.match(/^[-*]\s*\[x\]\s*command\s*\(\s*([^\)]+)\s*\)/i);
          if (cmdM) {
            byField[cur].increment.mode = "command";
            byField[cur].increment.command = String(cmdM[1] || "now").trim() || "now";
          }
          if (/^[-*]\s*\[x\]\s*custom/i.test(t)) byField[cur].increment.mode = "custom";
          const rawItemM = t.match(/^\d+[\).]\s*(.+?)\s*$/);
          if (rawItemM) {
            if (!Array.isArray(byField[cur].increment.customRaw)) byField[cur].increment.customRaw = [];
            byField[cur].increment.customRaw.push(String(rawItemM[1] || "").trim());
          }
          const stepM = t.match(/^\d+[\).]\s*(-?\d+)(?:\s*\(\s*(\d+)\s*\))?\s*$/);
          if (stepM) {
            if (!Array.isArray(byField[cur].increment.custom)) byField[cur].increment.custom = [];
            const stepVal = Math.max(0, Math.trunc(Number(stepM[1] || 0)));
            const repeat = Math.max(1, Math.trunc(Number(stepM[2] || 1)));
            for (let ri = 0; ri < repeat; ri++) byField[cur].increment.custom.push(stepVal);
          }
        }
        const em = t.match(/^-\s*enabled\s*:\s*(.+)$/i);
        if (em) {
          if (!isObj(byField[cur])) byField[cur] = {};
          byField[cur].enabled = /^true$/i.test(String(em[1] || "").trim());
        }
      }
      return { fields, byField };
    };

    const combinedBlocks = parseCombinedDateElementsBlocks();
    const allCombinedParsed = combinedBlocks.hasCombined ? parseDateTimeFromBlock(combinedBlocks.body) : null;
    const datesParsed = combinedBlocks.hasCombined
      ? { fields: [], byField: {}, kv: allCombinedParsed.kv || {} }
      : parseDateTimeByField([CFG_H2_DATES, "DATES"]);
    const elemsParsed = combinedBlocks.hasCombined
      ? { fields: [], byField: {} }
      : parseElementsByField([CFG_H2_ELEMENTS]);

    const datesFallback = parseH2ListAndKv("DATES");
    const elemsFallback = parseH2ListAndKv(CFG_H2_ELEMENTS);
    const dkv = Object.keys(datesParsed.kv || {}).length ? (datesParsed.kv || {}) : (datesFallback.kv || {});
    const toInt = (v, d) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : d;
    };
    parsed.datesConfig.behavior.time_step_minutes = toInt(dkv.time_step_minutes, 5);
    parsed.datesConfig.behavior.date_step_days = toInt(dkv.date_step_days, 1);
    parsed.datesConfig.behavior.time_rounding = String(dkv.time_rounding || "nearest").trim() || "nearest";
    parsed.datesConfig.behavior.date_format = String(dkv.date_format || "YYYY-MM-DD").trim() || "YYYY-MM-DD";
    parsed.datesConfig.behavior.time_format = String(dkv.time_format || "HH:mm").trim() || "HH:mm";
    parsed.datesConfig.fields = (Array.isArray(datesParsed.fields) && datesParsed.fields.length
      ? datesParsed.fields
      : (datesFallback.list || []).filter((x) => x && x !== "(none)"));
    parsed.datesConfig.byField = isObj(datesParsed.byField) ? datesParsed.byField : {};

    const combinedByField = combinedBlocks.hasCombined && isObj(allCombinedParsed && allCombinedParsed.byField)
      ? allCombinedParsed.byField
      : null;
    if (combinedByField) {
      parsed.datesConfig.byField = {};
      parsed.elementsConfig.byField = {};
      const forcedDateFields = inferDateLikeFieldIdsFromConfig(cfg);
      const maybeDateFormat = (fmt) => {
        const s = String(fmt || "").trim();
        if (!s) return false;
        const hasCalendar = /Y|M|D/.test(s);
        const hasClock = /H\s*:?\s*m|h\s*:?\s*m|:\s*m/.test(s);
        return hasCalendar || hasClock;
      };
      for (const fid of Object.keys(combinedByField)) {
        const fc = isObj(combinedByField[fid]) ? combinedByField[fid] : {};
        const fieldId = String(fid || "").trim();
        if (forcedDateFields.has(fieldId) || maybeDateFormat(fc.format)) parsed.datesConfig.byField[fid] = fc;
        else parsed.elementsConfig.byField[fid] = fc;
      }
      parsed.datesConfig.fields = Object.keys(parsed.datesConfig.byField);
      parsed.elementsConfig.fields = Object.keys(parsed.elementsConfig.byField);
    }

    const dateFieldsSet = new Set(parsed.datesConfig.fields || []);
    for (const fid of Object.keys(parsed.datesConfig.byField || {})) {
      if (!dateFieldsSet.has(fid)) dateFieldsSet.add(fid);
      const fc = isObj(parsed.datesConfig.byField[fid]) ? parsed.datesConfig.byField[fid] : {};
      const activeRaw = String(fc.activeMode || fc.active || "yes").trim().toLowerCase();
      const activeMode = activeRaw === "no" || activeRaw === "hotkey_only" ? activeRaw : "yes";
      const isTimeField = /^time/i.test(String(fid || ""));
      const format = Object.prototype.hasOwnProperty.call(fc, "format")
        ? String(fc.format ?? "").trim()
        : (isTimeField ? "HH:mm" : "YYYY-MM-DD");
      const incSrc = isObj(fc.increment) ? fc.increment : {};
      const modeRaw = String(incSrc.mode || "standard").trim().toLowerCase();
      const mode = modeRaw === "custom" || modeRaw === "command" ? modeRaw : "standard";
      const custom = Array.isArray(incSrc.custom)
        ? incSrc.custom.map((x) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x) => Number.isFinite(x))
        : [];
      const customRaw = Array.isArray(incSrc.customRaw)
        ? incSrc.customRaw.map((x) => String(x || "").trim()).filter((x) => x.length)
        : [];
      const incrementBy = Math.max(0, Math.trunc(Number(incSrc.incrementBy || 0)));
      const command = String(incSrc.command || "now").trim() || "now";
      const hk = isObj(fc.hotkey) ? fc.hotkey : {};
      parsed.datesConfig.byField[fid] = {
        activeMode,
        emoji: String(fc.emoji || ""),
        format,
        hotkey: {
          increase: String(hk.increase || "").trim(),
          decrease: String(hk.decrease || "").trim(),
        },
        increment: {
          mode,
          custom,
          customRaw,
          incrementBy,
          command,
        },
      };
    }
    parsed.datesConfig.fields = Array.from(dateFieldsSet);
    if (!combinedByField) {
      parsed.elementsConfig.fields = (Array.isArray(elemsParsed.fields) && elemsParsed.fields.length
        ? elemsParsed.fields
        : (elemsFallback.list || []).filter((x) => x && x !== "(none)"));
      parsed.elementsConfig.byField = isObj(elemsParsed.byField) ? elemsParsed.byField : {};
    }

    if (sections[TAGWHEEL_PREFIX_RESOLVER_SECTION]) {
      const resolverItems = sections[TAGWHEEL_PREFIX_RESOLVER_SECTION].items;
      let inCheckboxOrder = false;
      let checkboxBaseIndent = -1;
      for (let i = 0; i < resolverItems.length; i++) {
        const it = resolverItems[i];
        const text = String(it.text || "").trim();
        if (!text) continue;
        const modeM = text.match(/^mode\s*:\s*(.+)$/i);
        if (modeM) {
          const mode = String(modeM[1] || "").trim();
          if (mode !== "by-section" && mode !== "by-checkbox-list") {
            throw new Error(`Section #### ${TAGWHEEL_PREFIX_RESOLVER_SECTION}, line ${it.line}: mode must be by-section or by-checkbox-list`);
          }
          parsed.prefixResolver.mode = mode;
          inCheckboxOrder = false;
          continue;
        }
        const secM = text.match(/^section-order\s*:\s*(.*)$/i);
        if (secM) {
          const rawOrder = String(secM[1] || "").trim();
          const items = rawOrder ? rawOrder.split(",").map((x) => String(x || "").trim()).filter(Boolean) : [];
          const raw = items.length ? Array.from(new Set(items)) : allowedSections.slice();
          const resolved = raw.filter((x) => allowedSections.includes(x));
          parsed.prefixResolver.sectionOrderRaw = raw;
          parsed.prefixResolver.sectionOrder = resolved.length ? resolved : allowedSections.slice();
          inCheckboxOrder = false;
          continue;
        }
        const cbM = text.match(/^checkbox-order\s*:\s*(.*)$/i);
        if (cbM) {
          const rawCb = String(cbM[1] || "").trim();
          if (rawCb) {
            parsed.prefixResolver.checkboxOrder = Array.from(new Set(rawCb.split(",").map((x) => String(x || "").trim()).filter(Boolean)));
            inCheckboxOrder = false;
          } else {
            inCheckboxOrder = true;
            checkboxBaseIndent = it.indent;
          }
          continue;
        }
        if (inCheckboxOrder && it.indent > checkboxBaseIndent) {
          parsed.prefixResolver.checkboxOrder.push(text);
        }
      }
      parsed.prefixResolver.checkboxOrder = Array.from(new Set(parsed.prefixResolver.checkboxOrder.map((x) => String(x || "").trim()).filter(Boolean)));
    } else {
      const custom = parseCustomPrefixResolverBlock(md, allowedSections);
      if (custom) {
        parsed.prefixResolver.mode = custom.mode;
        parsed.prefixResolver.fieldsOrderMode = custom.fieldsOrderMode;
        parsed.prefixResolver.tagSubtagPriority = custom.tagSubtagPriority;
        parsed.prefixResolver.sectionOrder = custom.sectionOrder.length ? custom.sectionOrder : allowedSections.slice();
        parsed.prefixResolver.sectionOrderRaw = Array.isArray(custom.sectionOrderRaw) && custom.sectionOrderRaw.length
          ? custom.sectionOrderRaw.slice()
          : (custom.sectionOrder.length ? custom.sectionOrder.slice() : allowedSections.slice());
        parsed.prefixResolver.checkboxOrder = custom.checkboxOrder;
      }
    }

    const parseTagPipeSegments = (text) => {
      const src = String(text || "").trim();
      const out = {
        fillColor: "",
        textColor: "",
        customText: "",
        yamlProperty: "",
      };
      if (!src.includes("|")) return out;
      const parts = src.split("|").map((x) => String(x || "").trim()).filter(Boolean);
      if (parts.length <= 1) return out;
      for (let i = 1; i < parts.length; i++) {
        const seg = String(parts[i] || "").trim();
        if (!seg) continue;
        const mCustom = seg.match(/^custom\s+name\s*=\s*`([^`]*)`\s*$/i);
        if (mCustom) {
          out.customText = String(mCustom[1] || "").trim();
          continue;
        }
        const mHex = seg.match(/^hex\s*=\s*`?(#[0-9a-fA-F]{6})`?\s*\/\s*`?(#[0-9a-fA-F]{6})`?\s*$/i);
        if (mHex) {
          out.fillColor = String(mHex[1] || "").toLowerCase();
          out.textColor = String(mHex[2] || "").toLowerCase();
          continue;
        }
        const mHexInvalid = seg.match(/^hex\s*=/i);
        if (mHexInvalid) {
          throw new Error("Config format error: invalid hex segment, expected hex = `#rrggbb`/`#rrggbb`");
        }
        const mYaml = seg.match(/^yaml\s*=\s*`([^`]*)`\s*$/i);
        if (mYaml) {
          out.yamlProperty = String(mYaml[1] || "").trim();
          continue;
        }
      }
      return out;
    };
    const setByTagFirstWins = (fieldId, tagToken, visual) => {
      const fid = String(fieldId || "").trim();
      const tok = String(tagToken || "").trim();
      if (!fid || !/^#\S+/.test(tok) || !isObj(visual)) return;
      if (!isObj(parsed.tagVisuals.byTag[fid])) parsed.tagVisuals.byTag[fid] = {};
      if (Object.prototype.hasOwnProperty.call(parsed.tagVisuals.byTag[fid], tok)) return;
      parsed.tagVisuals.byTag[fid][tok] = visual;
    };
    const setUserTagFirstWins = (tagToken, visual) => {
      const tok = String(tagToken || "").trim();
      if (!/^#\S+/.test(tok) || !isObj(visual)) return;
      if (Object.prototype.hasOwnProperty.call(parsed.tagVisuals.userTags, tok)) return;
      parsed.tagVisuals.userTags[tok] = visual;
    };

    const names = Object.keys(sections).filter((x) => x !== TAGWHEEL_WIKILINK_SECTION && x !== TAGWHEEL_PREFIX_RESOLVER_SECTION);
    for (let ni = 0; ni < names.length; ni++) {
      const secName = names[ni];
      const sec = sections[secName];
      if (secName === USER_TAGS_SECTION) {
        for (let ii = 0; ii < sec.items.length; ii++) {
          const it = sec.items[ii];
          const tagTok = extractFirstTagToken(it.text);
          if (!tagTok) continue;
          const seg = parseTagPipeSegments(it.text);
          const visual = (seg.fillColor || seg.textColor || seg.customText)
            ? {
              fillColor: String(seg.fillColor || "").toLowerCase(),
              textColor: String(seg.textColor || "").toLowerCase(),
              visibility: "default",
              customText: String(seg.customText || "").trim(),
            }
            : null;
          if (!visual) continue;
          setUserTagFirstWins(tagTok, visual);
        }
        continue;
      }
      if (secName === ORPHAN_WIKILINKS_SECTION) {
        const orphanSectionKind = String(sectionKinds[secName] || "").trim().toLowerCase();
        const orphanScopedFields = Array.isArray(allowedWikilinkFieldsBySection[secName]) && allowedWikilinkFieldsBySection[secName].length
          ? allowedWikilinkFieldsBySection[secName]
          : (orphanSectionKind === "link" ? [secName] : []);
        const orphanAllowedExplicitFields = orphanScopedFields.concat(allowedWikilinkFieldsDynamic).filter((x, idx, arr) => {
          const id = String(x || "").trim();
          if (!id) return false;
          return arr.indexOf(id) === idx;
        });
        for (let ii = 0; ii < sec.items.length; ii++) {
          const it = sec.items[ii];
          const orphanRaw = String(it.text || "").trim();
          const orphanMatch = orphanRaw.match(/^(\[\[[^\]]+\]\])(?:\s*-\s*([A-Za-z0-9_-]+))?$/);
          if (!orphanMatch) {
            throw new Error(`Section #### ${secName}, line ${it.line}: expected wikilink '[[...]] - fieldId'`);
          }
          const orphanExplicitFieldId = String(orphanMatch[2] || "").trim();
          let parsedW = null;
          if (!orphanExplicitFieldId && orphanSectionKind === "link" && orphanScopedFields.length === 1) {
            parsedW = { token: String(orphanMatch[1] || "").trim(), fieldId: orphanScopedFields[0] };
          } else {
            const orphanRequireExplicitFieldId = orphanSectionKind !== "link" && orphanAllowedExplicitFields.length > 1;
            parsedW = parseWikilinkLineStrict(it.text, secName, it.line, orphanAllowedExplicitFields, {
              requireExplicitFieldId: orphanRequireExplicitFieldId,
            });
          }
          const fid = String(parsedW.fieldId || "").trim();
          const tok = String(parsedW.token || "").trim();
          if (!fid || !tok) continue;
          if (!Array.isArray(parsed.orphanWikilinks[fid])) parsed.orphanWikilinks[fid] = [];
          if (!parsed.orphanWikilinks[fid].includes(tok)) parsed.orphanWikilinks[fid].push(tok);
        }
        continue;
      }
      const out = { parents: [], wikilinks: {} };
      const sectionHasTagRows = Array.isArray(sec.items)
        ? sec.items.some((row) => {
          const rowText = row && row.text ? String(row.text) : "";
          if (!rowText) return false;
          if (isWikilinkToken(rowText) || /^\[\[[^\]]+\]\]\s*-/.test(rowText)) return false;
          return !!extractFirstTagToken(rowText);
        })
        : false;
      let curParent = "";
      let curSub = "";
      let subIndent = -1;

      const ensureParent = (pTok) => {
        const hit = out.parents.find((x) => x.token === pTok);
        if (hit) return hit;
        const created = { token: pTok, subtags: [] };
        out.parents.push(created);
        return created;
      };
      const ensureWikiNode = (fieldId, parentToken) => {
        if (!out.wikilinks[fieldId]) out.wikilinks[fieldId] = { defaults: [], byParent: {} };
        if (!parentToken) return out.wikilinks[fieldId];
        if (!out.wikilinks[fieldId].byParent[parentToken]) out.wikilinks[fieldId].byParent[parentToken] = { branch: [], leaf: {} };
        return out.wikilinks[fieldId].byParent[parentToken];
      };

      for (let ii = 0; ii < sec.items.length; ii++) {
        const it = sec.items[ii];
        if (!it.text) continue;
        if (/^yaml\s*:/i.test(String(it.text || "").trim())) continue;

        if (isWikilinkToken(it.text) || /^\[\[[^\]]+\]\]\s*-/.test(it.text)) {
          const sectionKind = String(sectionKinds[secName] || "").trim().toLowerCase();
          const scopedWikilinkFields = Array.isArray(allowedWikilinkFieldsBySection[secName])
            && allowedWikilinkFieldsBySection[secName].length
            ? allowedWikilinkFieldsBySection[secName]
            : (sectionKind === "link" ? [secName] : allowedWikilinkFieldsDynamic);
          const requireExplicitFieldId = sectionHasTagRows && scopedWikilinkFields.length > 1;
          const parsedW = parseWikilinkLineStrict(it.text, secName, it.line, scopedWikilinkFields, {
            requireExplicitFieldId,
          });
          if (!curParent || it.indent === 0) {
            const n = ensureWikiNode(parsedW.fieldId, "");
            if (!n.defaults.includes(parsedW.token)) n.defaults.push(parsedW.token);
            continue;
          }
          const pn = ensureWikiNode(parsedW.fieldId, curParent);
          if (curSub && it.indent > subIndent) {
            if (!pn.leaf[curSub]) pn.leaf[curSub] = [];
            if (!pn.leaf[curSub].includes(parsedW.token)) pn.leaf[curSub].push(parsedW.token);
          } else {
            if (!pn.branch.includes(parsedW.token)) pn.branch.push(parsedW.token);
          }
          continue;
        }

        const tagTok = extractFirstTagToken(it.text);
        if (!tagTok) {
          throw new Error(`Section #### ${secName}, line ${it.line}: expected tag '#...' or wikilink '[[...]] - fieldId'`);
        }
        const tagMeta = parseCheckboxAndTag(it.text);
        const seg = parseTagPipeSegments(it.text);
        const visual = (seg.fillColor || seg.textColor || seg.customText)
          ? {
            fillColor: String(seg.fillColor || "").toLowerCase(),
            textColor: String(seg.textColor || "").toLowerCase(),
            visibility: "default",
            customText: String(seg.customText || "").trim(),
          }
          : null;

        if (!curParent || it.indent === 0) {
          const p = ensureParent(tagTok);
          curParent = p.token;
          curSub = "";
          subIndent = -1;
          if (tagMeta.checkbox) {
            const def = sectionDefById[secName];
            const fieldId = def ? def.fieldId : "";
            const tokenKey = denormTagToken(tagTok);
            if (fieldId && tokenKey) {
              if (!isObj(parsed.checkboxByFieldValue[fieldId])) parsed.checkboxByFieldValue[fieldId] = {};
              parsed.checkboxByFieldValue[fieldId][tokenKey] = tagMeta.checkbox;
            }
          }
          {
            const def = sectionDefById[secName];
            const fieldId = def ? def.fieldId : "";
            if (visual && fieldId) setByTagFirstWins(fieldId, tagTok, visual);
            if (fieldId) {
              const yamlToken = String(seg.yamlProperty || "").trim();
              if (yamlToken) {
                if (!isObj(parsed.yamlByFieldValue[fieldId])) parsed.yamlByFieldValue[fieldId] = {};
                const tokenKey = denormTagToken(tagTok);
                if (tokenKey) parsed.yamlByFieldValue[fieldId][tokenKey] = yamlToken;
              }
            }
          }
        } else {
          const p = ensureParent(curParent);
          if (!p.subtags.includes(tagTok)) p.subtags.push(tagTok);
          curSub = tagTok;
          subIndent = it.indent;
          if (tagMeta.checkbox) {
            const def = sectionDefById[secName];
            const fieldId = def && def.subFieldId ? def.subFieldId : (def ? def.fieldId : "");
            const tokenKey = denormTagToken(tagTok);
            if (fieldId && tokenKey) {
              if (!isObj(parsed.checkboxByFieldValue[fieldId])) parsed.checkboxByFieldValue[fieldId] = {};
              parsed.checkboxByFieldValue[fieldId][tokenKey] = tagMeta.checkbox;
            }
          }
          {
            const def = sectionDefById[secName];
            const fieldId = def && def.subFieldId ? def.subFieldId : (def ? def.fieldId : "");
            if (visual && fieldId) setByTagFirstWins(fieldId, tagTok, visual);
            if (fieldId) {
              const yamlToken = String(seg.yamlProperty || "").trim();
              if (yamlToken) {
                if (!isObj(parsed.yamlByFieldValue[fieldId])) parsed.yamlByFieldValue[fieldId] = {};
                const tokenKey = denormTagToken(tagTok);
                if (tokenKey) parsed.yamlByFieldValue[fieldId][tokenKey] = yamlToken;
              }
            }
          }
        }
      }
      parsed.sections[secName] = out;
      {
        const fieldYaml = (() => {
          for (let ii = 0; ii < sec.items.length; ii++) {
            const text = String(sec.items[ii] && sec.items[ii].text || "").trim();
            const m = text.match(/^yaml\s*:\s*(.+)$/i);
            if (!m) continue;
            return String(m[1] || "").trim();
          }
          return "";
        })();
        if (fieldYaml) parsed.fieldYamlBySection[secName] = fieldYaml;
      }
    }
    const missingEmojiFields = collectMissingEmojiFields(parsed);
    if (missingEmojiFields.length) {
      throw new Error(
        `Config validation error: Emoji is required for fields: ${missingEmojiFields.join(", ")}. Fix: [[InlineOverhaul_Config]] (DATE/TIME + ELEMENTS section)`
      );
    }

    return parsed;
  };
}

module.exports = {
  createTagWheelConfigParser,
};
