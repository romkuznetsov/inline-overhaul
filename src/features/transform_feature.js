"use strict";

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const DEFAULT_INLINE2NOTE = {
  enabled: false,
  templateFolder: "",
  outputFolder: "",
  defaultTemplate: "",
  smartRules: [],
  noteName: {
    mode: "auto",
    explicitNameDelimiters: "[]",
    autoWordsCount: 6,
    preferHeaderTitle: true,
  },
  nameCollision: {
    mode: "new_note",
  },
  placement: {
    position: "end",
    headerMode: "datetime",
    customHeaderText: "### Inline transformed",
    datetimeHeaderFormat: "YYYY-MM-DD HH:mm",
  },
  yamlNoteFormat: "raw",
  sourceProcessing: {
    cleanupFieldIds: [],
    processedToken: "#processed",
    processedTokenPanel: "right",
    replacePayloadWithLink: true,
    visual: {
      enabled: false,
      color: "",
      opacity: 0.65,
    },
  },
  openTransformedNote: false,
  sublinesBehavior: "stay",
  flyingButton: {
    enabled: false,
  },
  preview: {
    sampleLine: "- [ ] #/1 #todo #context",
  },
};

function normalizeMode(raw, allowed, dflt) {
  const s = String(raw || "").trim().toLowerCase();
  return allowed.includes(s) ? s : dflt;
}

function splitCsv(raw) {
  return String(raw || "")
    .split(",")
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function isInSpans(idx, spans) {
  const arr = Array.isArray(spans) ? spans : [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr[i];
    if (!s) continue;
    if (idx >= s.start && idx < s.end) return true;
  }
  return false;
}

function uniq(arr) {
  const src = Array.isArray(arr) ? arr : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < src.length; i++) {
    const s = String(src[i] || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function hasAnyCondition(rule) {
  const c = rule && rule.conditions ? rule.conditions : {};
  return !!((Array.isArray(c.tags) && c.tags.length) || (Array.isArray(c.emojiFields) && c.emojiFields.length) || (Array.isArray(c.wikilinks) && c.wikilinks.length));
}

function intersects(a, b) {
  const setB = new Set(Array.isArray(b) ? b : []);
  const srcA = Array.isArray(a) ? a : [];
  for (let i = 0; i < srcA.length; i++) {
    if (setB.has(srcA[i])) return true;
  }
  return false;
}

function rulesCanOverlap(a, b) {
  const ca = a && a.conditions ? a.conditions : {};
  const cb = b && b.conditions ? b.conditions : {};
  const dims = ["tags", "emojiFields", "wikilinks"];
  for (let i = 0; i < dims.length; i++) {
    const d = dims[i];
    const va = Array.isArray(ca[d]) ? ca[d] : [];
    const vb = Array.isArray(cb[d]) ? cb[d] : [];
    if (!va.length || !vb.length) continue;
    if (!intersects(va, vb)) return false;
  }
  return true;
}

function validateSmartRules(rules) {
  const src = Array.isArray(rules) ? rules : [];
  const out = src.map((r) => ({
    ...r,
    enabled: r && r.enabled !== false,
    validation: {
      isConflict: false,
      message: "",
      details: [],
    },
  }));

  for (let i = 0; i < out.length; i++) {
    if (!out[i].enabled) continue;
    if (!hasAnyCondition(out[i])) {
      out[i].enabled = false;
      out[i].validation = {
        isConflict: true,
        message: "Rule has no conditions. Add at least one tag/emoji/wikilink.",
        details: [],
      };
    }
  }

  const conflicts = out.map(() => []);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      if (!out[i].enabled || !out[j].enabled) continue;
      if (!rulesCanOverlap(out[i], out[j])) continue;
      const ri = String(out[i].id || `rule-${i + 1}`);
      const rj = String(out[j].id || `rule-${j + 1}`);
      const detailsI = [];
      const detailsJ = [];
      const dims = ["tags", "emojiFields", "wikilinks"];
      for (let di = 0; di < dims.length; di++) {
        const d = dims[di];
        const ai = Array.isArray(out[i].conditions && out[i].conditions[d]) ? out[i].conditions[d] : [];
        const aj = Array.isArray(out[j].conditions && out[j].conditions[d]) ? out[j].conditions[d] : [];
        const setJ = new Set(aj);
        for (let ti = 0; ti < ai.length; ti++) {
          const tok = String(ai[ti] || "").trim();
          if (!tok || !setJ.has(tok)) continue;
          detailsI.push({ dimension: d, token: tok, peerRuleId: rj });
          detailsJ.push({ dimension: d, token: tok, peerRuleId: ri });
        }
      }
      conflicts[i].push({ peerRuleId: rj, details: detailsI });
      conflicts[j].push({ peerRuleId: ri, details: detailsJ });
    }
  }
  for (let i = 0; i < out.length; i++) {
    if (!conflicts[i].length) continue;
    out[i].enabled = false;
    out[i].validation = {
      isConflict: true,
      message: `Conflicts with ${conflicts[i].map((entry) => entry.peerRuleId).join(", ")}. Overlapping conditions detected.`,
      details: conflicts[i].flatMap((entry) => entry.details),
    };
  }

  return out;
}

function normalizeSmartRules(rawRules) {
  const src = Array.isArray(rawRules) ? rawRules : [];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const r = isObj(src[i]) ? src[i] : {};
    const id = String(r.id || `rule-${i + 1}`).trim() || `rule-${i + 1}`;
    const targetTemplate = String(r.targetTemplate || "").trim();
    const conditions = isObj(r.conditions) ? r.conditions : {};
    const tags = Array.isArray(conditions.tags) ? conditions.tags.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const emojiFields = Array.isArray(conditions.emojiFields) ? conditions.emojiFields.map((x) => String(x || "").trim()).filter(Boolean) : [];
    const wikilinks = Array.isArray(conditions.wikilinks) ? conditions.wikilinks.map((x) => String(x || "").trim()).filter(Boolean) : [];
    out.push({
      id,
      enabled: r.enabled !== false,
      targetTemplate,
      conditions: { tags: uniq(tags), emojiFields: uniq(emojiFields), wikilinks: uniq(wikilinks) },
      validation: {
        isConflict: !!(r.validation && r.validation.isConflict),
        message: String(r.validation && r.validation.message ? r.validation.message : "").trim(),
        details: Array.isArray(r.validation && r.validation.details) ? r.validation.details.slice() : [],
      },
    });
  }
  return validateSmartRules(out);
}

function normalizeInline2Note(raw) {
  const src = isObj(raw) ? raw : {};
  const out = {
    enabled: src.enabled === true,
    templateFolder: String(src.templateFolder || "").trim(),
    outputFolder: String(src.outputFolder || "").trim(),
    defaultTemplate: String(src.defaultTemplate || "").trim(),
    smartRules: normalizeSmartRules(src.smartRules),
    noteName: {},
    nameCollision: {},
    placement: {},
    sourceProcessing: {},
    flyingButton: {},
    preview: {},
  };

  const noteName = isObj(src.noteName) ? src.noteName : {};
  out.noteName.mode = normalizeMode(noteName.mode, ["auto", "manual"], DEFAULT_INLINE2NOTE.noteName.mode);
  out.noteName.explicitNameDelimiters = String(noteName.explicitNameDelimiters || DEFAULT_INLINE2NOTE.noteName.explicitNameDelimiters).trim() || "[]";
  out.noteName.autoWordsCount = Math.max(1, Math.min(32, Math.trunc(Number(noteName.autoWordsCount) || DEFAULT_INLINE2NOTE.noteName.autoWordsCount)));
  out.noteName.preferHeaderTitle = noteName.preferHeaderTitle !== false;

  const nameCollision = isObj(src.nameCollision) ? src.nameCollision : {};
  out.nameCollision.mode = normalizeMode(nameCollision.mode, ["new_note", "add_to_note", "overwrite"], DEFAULT_INLINE2NOTE.nameCollision.mode);

  const placement = isObj(src.placement) ? src.placement : {};
  out.placement.position = normalizeMode(placement.position, ["beginning", "end"], DEFAULT_INLINE2NOTE.placement.position);
  out.placement.headerMode = normalizeMode(placement.headerMode, ["custom", "datetime", "none"], DEFAULT_INLINE2NOTE.placement.headerMode);
  out.placement.customHeaderText = String(placement.customHeaderText || DEFAULT_INLINE2NOTE.placement.customHeaderText).trim() || DEFAULT_INLINE2NOTE.placement.customHeaderText;
  out.placement.datetimeHeaderFormat = String(placement.datetimeHeaderFormat || DEFAULT_INLINE2NOTE.placement.datetimeHeaderFormat).trim() || DEFAULT_INLINE2NOTE.placement.datetimeHeaderFormat;
  out.yamlNoteFormat = normalizeMode(src.yamlNoteFormat, ["raw", "clean"], DEFAULT_INLINE2NOTE.yamlNoteFormat);

  const sp = isObj(src.sourceProcessing) ? src.sourceProcessing : {};
  out.sourceProcessing.cleanupFieldIds = Array.isArray(sp.cleanupFieldIds) ? sp.cleanupFieldIds.map((x) => String(x || "").trim()).filter(Boolean) : [];
  out.sourceProcessing.processedToken = Object.prototype.hasOwnProperty.call(sp, "processedToken")
    ? String(sp.processedToken || "").trim()
    : DEFAULT_INLINE2NOTE.sourceProcessing.processedToken;
  out.sourceProcessing.processedTokenPanel = normalizeMode(sp.processedTokenPanel, ["left", "right"], DEFAULT_INLINE2NOTE.sourceProcessing.processedTokenPanel);
  out.sourceProcessing.replacePayloadWithLink = sp.replacePayloadWithLink !== false;
  const visual = isObj(sp.visual) ? sp.visual : {};
  out.sourceProcessing.visual = {
    enabled: visual.enabled === true,
    color: String(visual.color || "").trim(),
    opacity: Number.isFinite(Number(visual.opacity)) ? Math.max(0, Math.min(1, Number(visual.opacity))) : DEFAULT_INLINE2NOTE.sourceProcessing.visual.opacity,
  };

  out.openTransformedNote = src.openTransformedNote === true;
  out.sublinesBehavior = normalizeMode(src.sublinesBehavior, ["stay", "remove"], DEFAULT_INLINE2NOTE.sublinesBehavior);

  const fb = isObj(src.flyingButton) ? src.flyingButton : {};
  out.flyingButton.enabled = fb.enabled === true;

  const preview = isObj(src.preview) ? src.preview : {};
  out.preview.sampleLine = String(preview.sampleLine || DEFAULT_INLINE2NOTE.preview.sampleLine);

  return out;
}

function normalizeTransformConfig(cfg) {
  const root = isObj(cfg) ? cfg : {};
  if (!isObj(root.transform)) root.transform = {};
  root.transform.inline2note = normalizeInline2Note(root.transform.inline2note);
  if (!isObj(root.transform.inline2fleet)) root.transform.inline2fleet = {};
  return root;
}

function collectTemplateOptions(app, folder) {
  if (!app || !app.vault || typeof app.vault.getMarkdownFiles !== "function") return [];
  const all = app.vault.getMarkdownFiles();
  const normalizedFolder = String(folder || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
  return all
    .filter((f) => {
      if (!normalizedFolder) return true;
      const path = String(f.path || "").replace(/\\/g, "/");
      return path === normalizedFolder || path.startsWith(normalizedFolder + "/");
    })
    .map((f) => String(f.path || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function resolveIoSeparators(cfg) {
  const io = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.io) ? cfg.pkm.behavior.io : null;
  const s1 = String(io && io.separator1 || "").trim();
  const s2 = String(io && io.separator2 || "").trim();
  if (!s1 || !s2) {
    throw new Error("InlineOverhaul: missing pkm.behavior.io separators (separator1/separator2)");
  }
  return { separator1: s1, separator2: s2 };
}

function extractPrimaryPayloadText(line, separators) {
  const src = String(line || "");
  const s1 = escapeRegexLiteral(separators && separators.separator1 || "");
  const s2 = escapeRegexLiteral(separators && separators.separator2 || "");
  if (!s1) return "";
  if (s2) {
    const re = new RegExp(`${s1}\\s*([\\s\\S]*?)\\s*${s2}`);
    const m = src.match(re);
    if (m && m[1]) return String(m[1] || "").trim();
  }
  const reSingle = new RegExp(`${s1}\\s*([^\\n]+)$`);
  const mSingle = src.match(reSingle);
  if (!mSingle || !mSingle[1]) return "";
  return String(mSingle[1] || "").trim();
}

function escapeRegexLiteral(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getElementMarkersFromConfig(cfg) {
  const out = [];
  const seen = new Set();
  const order = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.order) ? cfg.pkm.behavior.order : {};
  const orderTypes = isObj(order.types) ? order.types : {};
  const fields = getModeFields(cfg);
  for (let i = 0; i < fields.length; i++) {
    const f = isObj(fields[i]) ? fields[i] : {};
    const fid = String(f.id || "").trim();
    if (!fid) continue;
    const explicitType = String(f.type || "").trim().toLowerCase();
    const byOrderType = String(orderTypes[fid] || "").trim().toLowerCase();
    const marker = String(f.marker || "").trim();
    const isElement = explicitType === "element" || byOrderType === "element" || !!marker;
    if (!isElement) continue;
    const finalMarker = resolveFieldMarker(f);
    if (!finalMarker || seen.has(finalMarker)) continue;
    seen.add(finalMarker);
    out.push(finalMarker);
  }
  return out;
}

function resolveFieldMarker(field) {
  return String(field && (field.marker || field.prefix) || "").trim();
}

function formatDateTimeByPattern(date, pattern) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const values = {
    YYYY: String(d.getFullYear()),
    MM: String(d.getMonth() + 1).padStart(2, "0"),
    DD: String(d.getDate()).padStart(2, "0"),
    HH: String(d.getHours()).padStart(2, "0"),
    mm: String(d.getMinutes()).padStart(2, "0"),
    ss: String(d.getSeconds()).padStart(2, "0"),
  };
  return String(pattern || "YYYY-MM-DD HH:mm").replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => values[token]);
}

function formatHeaderByMode(i2n, now) {
  const placement = isObj(i2n && i2n.placement) ? i2n.placement : {};
  const mode = String(placement.headerMode || "").trim().toLowerCase();
  if (mode === "none") return "";
  if (mode === "custom") return String(placement.customHeaderText || "").trim();
  const fmt = String(placement.datetimeHeaderFormat || "YYYY-MM-DD HH:mm").trim();
  return `### ${formatDateTimeByPattern(now, fmt)}`;
}

function normalizeRuleWikilink(raw) {
  const src = String(raw || "").trim();
  const match = src.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  return match ? String(match[1] || "").trim() : src;
}

function selectSmartTemplate(parsed, smartRules, defaultTemplate) {
  const p = isObj(parsed) ? parsed : {};
  const tags = new Set(Array.isArray(p.tags) ? p.tags.map((x) => String(x || "").trim()).filter(Boolean) : []);
  const wikilinks = new Set(Array.isArray(p.wikilinks) ? p.wikilinks.map(normalizeRuleWikilink).filter(Boolean) : []);
  const emojiMarkers = new Set((Array.isArray(p.emojis) ? p.emojis : []).map((x) => String(x && x.marker || "").trim()).filter(Boolean));
  const rules = Array.isArray(smartRules) ? smartRules : [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule || rule.enabled === false || rule.validation && rule.validation.isConflict) continue;
    const conditions = isObj(rule.conditions) ? rule.conditions : {};
    const conditionGroups = [
      [Array.isArray(conditions.tags) ? conditions.tags : [], tags, (x) => String(x || "").trim()],
      [Array.isArray(conditions.emojiFields) ? conditions.emojiFields : [], emojiMarkers, (x) => String(x || "").trim()],
      [Array.isArray(conditions.wikilinks) ? conditions.wikilinks : [], wikilinks, normalizeRuleWikilink],
    ];
    if (!conditionGroups.some((group) => group[0].length)) continue;
    let matches = true;
    for (let gi = 0; gi < conditionGroups.length; gi++) {
      const [wanted, actual, normalize] = conditionGroups[gi];
      if (!wanted.length) continue;
      if (!wanted.some((value) => actual.has(normalize(value)))) {
        matches = false;
        break;
      }
    }
    const target = String(rule.targetTemplate || "").trim();
    if (matches && target) return target;
  }
  return String(defaultTemplate || "").trim();
}

function escapeRegExp(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseInlineLine(rawLine, cfg) {
  const line = String(rawLine || "");
  const separators = resolveIoSeparators(cfg);
  const tags = [];
  const wikilinks = [];
  const tagOccurrences = [];
  const wikilinkOccurrences = [];
  const emojiOccurrences = [];
  const wikilinkSpans = [];
  const tagSpans = [];
  const emojis = [];
  const markers = getElementMarkersFromConfig(cfg);
  const firstSeparator = line.indexOf(separators.separator1);
  const secondSeparator = firstSeparator >= 0
    ? line.indexOf(separators.separator2, firstSeparator + separators.separator1.length)
    : -1;
  const panelForSpan = (start) => {
    if (firstSeparator < 0) return "any";
    if (start < firstSeparator) return "left";
    if (secondSeparator >= 0 && start >= secondSeparator + separators.separator2.length) return "right";
    return "payload";
  };
  let m;
  const wlRe = /\[\[([^\]]+)\]\]/g;
  while ((m = wlRe.exec(line)) !== null) {
    const v = String(m[1] || "").trim();
    if (v) wikilinks.push(v);
    const span = { start: m.index, end: m.index + String(m[0] || "").length };
    wikilinkSpans.push(span);
    wikilinkOccurrences.push({ token: v, ...span, panel: panelForSpan(span.start) });
  }
  const tagRe = /(^|\s)(#[^\s#]+)/g;
  while ((m = tagRe.exec(line)) !== null) {
    tags.push(String(m[2] || "").trim());
    const full = String(m[0] || "");
    const token = String(m[2] || "");
    const idx = m.index + Math.max(0, full.lastIndexOf(token));
    const span = { start: idx, end: idx + token.length };
    tagSpans.push(span);
    tagOccurrences.push({ token: String(m[2] || "").trim(), ...span, panel: panelForSpan(span.start) });
  }
  for (let mi = 0; mi < markers.length; mi++) {
    const marker = String(markers[mi] || "").trim();
    if (!marker) continue;
    const emRe = new RegExp(`${escapeRegexLiteral(marker)}\\s*([^\\s]+)`, "g");
    while ((m = emRe.exec(line)) !== null) {
      if (isInSpans(m.index, wikilinkSpans) || isInSpans(m.index, tagSpans)) continue;
      const value = String(m[1] || "").trim();
      if (value) {
        const span = { start: m.index, end: m.index + String(m[0] || "").length };
        emojis.push({ marker, value });
        emojiOccurrences.push({ marker, value, ...span, panel: panelForSpan(span.start) });
      }
    }
  }

  const markerPattern = markers.length
    ? `(?:${markers.map((x) => escapeRegexLiteral(x)).join("|")})\\s*[^\\s]+`
    : null;
  const payloadTextRaw = extractPrimaryPayloadText(line, separators);
  let textCore = line
    .replace(/\[\[[^\]]+\]\]/g, " ")
    .replace(/(^|\s)(#[^\s#]+)/g, " ")
    .replace(markerPattern ? new RegExp(markerPattern, "g") : /$^/, " ")
    .replace(/\s+/g, " ")
    .trim();
  const payloadParts = textCore.split(String(separators.separator1 || "")).map((s) => String(s || "").trim()).filter(Boolean);
  const payloadText = String(payloadTextRaw || (payloadParts.length ? payloadParts[0] : textCore) || "")
    .replace(/^\s*(?:[-*+]\s+(?:\[[^\]]+\]\s+)?|#{1,6}\s+)/, "")
    .trim();
  return { line, tags: uniq(tags), wikilinks: uniq(wikilinks), emojis, payloadText, tagOccurrences, wikilinkOccurrences, emojiOccurrences };
}

function getModeFields(cfg) {
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const left = isObj(behavior.leftMode) && Array.isArray(behavior.leftMode.fields) ? behavior.leftMode.fields : [];
  const right = isObj(behavior.rightMode) && Array.isArray(behavior.rightMode.fields) ? behavior.rightMode.fields : [];
  return left.concat(right).filter((f) => isObj(f) && String(f.id || "").trim());
}

function fieldTokenCandidates(field) {
  const src = Array.isArray(field && field.values) ? field.values : [];
  const prefix = String(field && field.prefix || "#");
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const row = isObj(src[i]) ? src[i] : {};
    const tok = String(row.token || "").trim();
    if (!tok) continue;
    const full = tok.startsWith("#") ? tok : `${prefix}${tok}`;
    out.push({ fullToken: full, rawToken: tok, yamlProperty: String(row.yamlProperty || "").trim() });
  }
  return out;
}

function fieldWikilinkCandidates(field) {
  const src = Array.isArray(field && field.values) ? field.values : [];
  const out = [];
  for (let i = 0; i < src.length; i++) {
    const row = isObj(src[i]) ? src[i] : {};
    const tok = String(row.token || "").trim();
    if (!tok) continue;
    const bare = tok.startsWith("#") ? String(tok.slice(1)).trim() : tok;
    if (bare) out.push({ token: bare, yamlProperty: String(row.yamlProperty || "").trim() });
  }
  const dedup = [];
  const seen = new Set();
  for (let i = 0; i < out.length; i++) {
    const key = String(out[i] && out[i].token || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dedup.push(out[i]);
  }
  return dedup;
}

function inferFieldType(field) {
  const marker = String(field && field.marker || "").trim();
  const source = String(field && field.source || "").trim().toLowerCase();
  if (marker) return "element";
  if (source.startsWith("wikilinks:")) return "wikilink";
  return "tag";
}

function resolveEffectiveFieldType(field, orderTypes, fieldId) {
  const explicit = String(field && field.type || "").trim().toLowerCase();
  if (explicit) return explicit;
  const byOrder = String(orderTypes && orderTypes[fieldId] || "").trim().toLowerCase();
  if (byOrder) return byOrder;
  return inferFieldType(field);
}

function buildTransformContext(parsed, cfg) {
  const p = isObj(parsed) ? parsed : { line: "", tags: [], wikilinks: [], emojis: [], payloadText: "" };
  const order = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.order) ? cfg.pkm.behavior.order : {};
  const propertiesByField = isObj(order.propertiesByField) ? order.propertiesByField : {};
  const orderTypes = isObj(order.types) ? order.types : {};
  const fields = getModeFields(cfg);
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const leftFieldIds = new Set((isObj(behavior.leftMode) && Array.isArray(behavior.leftMode.fields) ? behavior.leftMode.fields : [])
    .map((field) => String(field && field.id || "").trim()));
  const rightFieldIds = new Set((isObj(behavior.rightMode) && Array.isArray(behavior.rightMode.fields) ? behavior.rightMode.fields : [])
    .map((field) => String(field && field.id || "").trim()));
  const fieldById = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    if (fid) fieldById[fid] = fields[i];
  }
  const wl = Array.isArray(p.wikilinks) ? p.wikilinks : [];
  const emojis = Array.isArray(p.emojis) ? p.emojis : [];

  const byFieldId = {};
  const matches = [];

  const pushMatch = (fid, fType, markerOrPrefix, yamlProperty, rawToken, occurrence) => {
    const yp = String(yamlProperty || "").trim();
    const rt = String(rawToken || "").trim();
    if (!rt) return;
    const span = occurrence && Number.isInteger(occurrence.start) && Number.isInteger(occurrence.end)
      ? { start: occurrence.start, end: occurrence.end, panel: occurrence.panel }
      : null;
    byFieldId[fid] = {
      fieldId: fid,
      fieldType: fType,
      fieldPrefix: String(markerOrPrefix || "").trim(),
      yamlProperty: yp,
      rawToken: rt,
      span,
    };
    matches.push({
      fieldId: fid,
      fieldType: fType,
      fieldPrefix: String(markerOrPrefix || "").trim(),
      yamlProperty: yp,
      rawToken: rt,
      span,
    });
  };

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const fid = String(f.id || "").trim();
    if (!fid) continue;
    const fType = resolveEffectiveFieldType(f, orderTypes, fid);
    const defaultYamlProperty = String(propertiesByField[fid] || "").trim();
    const parentFid = String(f.dependsOn || "").trim();
    const isSubField = !!parentFid;
    const parentYamlProperty = parentFid ? String(propertiesByField[parentFid] || "").trim() : "";
    const resolveYamlProperty = (candidateYamlProperty) => {
      const cand = String(candidateYamlProperty || "").trim();
      if (isSubField) return cand || defaultYamlProperty || parentYamlProperty;
      return cand || defaultYamlProperty;
    };
    const expectedPanel = leftFieldIds.has(fid) ? "left" : (rightFieldIds.has(fid) ? "right" : "any");
    const isPanelMatch = (occurrence) => occurrence && (occurrence.panel === expectedPanel || occurrence.panel === "any");

    if (fType === "element") {
      const marker = resolveFieldMarker(f);
      const occurrences = Array.isArray(p.emojiOccurrences) ? p.emojiOccurrences : [];
      for (let oi = 0; oi < occurrences.length; oi++) {
        const occurrence = occurrences[oi];
        if (marker && occurrence.marker === marker && isPanelMatch(occurrence)) {
          pushMatch(fid, fType, marker, resolveYamlProperty(""), `${marker}${occurrence.value}`, occurrence);
        }
      }
      continue;
    }

    if (fType === "wikilink") {
      const wlCandidates = fieldWikilinkCandidates(f);
      for (let wi = 0; wi < wlCandidates.length; wi++) {
        const name = String(wlCandidates[wi] && wlCandidates[wi].token || "").trim();
        if (!name) continue;
        const occurrences = Array.isArray(p.wikilinkOccurrences) ? p.wikilinkOccurrences : [];
        for (let oi = 0; oi < occurrences.length; oi++) {
          const occurrence = occurrences[oi];
          if (occurrence.token !== name || !isPanelMatch(occurrence)) continue;
          const yk = resolveYamlProperty(wlCandidates[wi] && wlCandidates[wi].yamlProperty);
          pushMatch(fid, fType, String(f.prefix || "").trim(), yk, `[[${name}]]`, occurrence);
        }
      }
      continue;
    }

    if (fType !== "tag") continue;

    {
      const candidates = fieldTokenCandidates(f);
      for (let ci = 0; ci < candidates.length; ci++) {
        const occurrences = Array.isArray(p.tagOccurrences) ? p.tagOccurrences : [];
        for (let oi = 0; oi < occurrences.length; oi++) {
          const occurrence = occurrences[oi];
          if (occurrence.token !== candidates[ci].fullToken || !isPanelMatch(occurrence)) continue;
          const yk = resolveYamlProperty(candidates[ci].yamlProperty);
          pushMatch(fid, fType, String(f.prefix || "").trim(), yk, candidates[ci].fullToken, occurrence);
        }
      }
    }
  }

  const dependencySafeMatches = matches.filter((row) => {
    const field = fieldById[String(row && row.fieldId || "").trim()];
    const parentId = String(field && field.dependsOn || "").trim();
    return !parentId || !!byFieldId[parentId];
  });
  const dependencySafeByFieldId = {};
  for (let i = 0; i < dependencySafeMatches.length; i++) {
    const row = dependencySafeMatches[i];
    dependencySafeByFieldId[row.fieldId] = row;
  }

  return {
    line: String(p.line || ""),
    payloadText: String(p.payloadText || ""),
    tags: Array.isArray(p.tags) ? p.tags.slice() : [],
    wikilinks: wl.slice(),
    emojis: emojis.slice(),
    byFieldId: dependencySafeByFieldId,
    matches: dependencySafeMatches,
  };
}

function normalizeYamlValueForFormat(rawToken, yamlFormat, row) {
  const mode = String(yamlFormat || "raw").trim().toLowerCase();
  const token = String(rawToken || "").trim();
  const fieldType = String(row && row.fieldType || "").trim().toLowerCase();
  const fieldPrefix = String(row && row.fieldPrefix || "").trim();
  if (!token) return "";
  if (fieldType === "element") {
    if (fieldPrefix && token.startsWith(fieldPrefix)) return String(token.slice(fieldPrefix.length)).trim();
    const mElement = token.match(/^[\u{1F300}-\u{1FAFF}]\s*(.*)$/u);
    return mElement ? String(mElement[1] || "").trim() : token;
  }
  if (mode === "raw") return token;
  if (/^#\/\d+$/.test(token)) return Number(String(token.replace(/^#\//, "")).trim());
  if (/^#[^\s#]+$/.test(token)) return String(token.slice(1)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d{2}:\d{2}$/u.test(token)) return String(token.slice(2)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d{4}-\d{2}-\d{2}$/u.test(token)) return String(token.slice(2)).trim();
  if (/^[\u{1F300}-\u{1FAFF}]\d+$/u.test(token)) return String(token.slice(2)).trim();
  const wl = token.match(/^\[\[([^\]]+)\]\]$/);
  if (wl) return String(wl[1] || "").trim();
  return token;
}

function buildYamlMapFromContext(transformContext, cfg) {
  const out = {};
  const byFieldId = isObj(transformContext && transformContext.byFieldId) ? transformContext.byFieldId : {};
  const rows = Array.isArray(transformContext && transformContext.matches)
    ? transformContext.matches
    : Object.keys(byFieldId).map((k) => byFieldId[k]);
  const yamlFormat = String(cfg && cfg.transform && cfg.transform.inline2note && cfg.transform.inline2note.yamlNoteFormat || "raw").trim().toLowerCase();
  const order = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.order) ? cfg.pkm.behavior.order : {};
  const propertiesByField = isObj(order.propertiesByField) ? order.propertiesByField : {};
  const cardinalityByField = isObj(order.yamlCardinalityByField) ? order.yamlCardinalityByField : {};
  const propertyFieldCounts = {};
  const listYamlKeys = new Set();
  const configuredFields = getModeFields(cfg);
  for (let i = 0; i < configuredFields.length; i++) {
    const field = configuredFields[i];
    const fid = String(field && field.id || "").trim();
    const keys = new Set();
    const defaultKey = String(propertiesByField[fid] || "").trim();
    if (defaultKey) keys.add(defaultKey);
    const values = Array.isArray(field && field.values) ? field.values : [];
    for (let vi = 0; vi < values.length; vi++) {
      const key = String(values[vi] && values[vi].yamlProperty || "").trim();
      if (key) keys.add(key);
    }
    for (const key of keys) propertyFieldCounts[key] = Number(propertyFieldCounts[key] || 0) + 1;
    const cardinality = String(field && field.yamlCardinality || cardinalityByField[fid] || "").trim().toLowerCase();
    if (cardinality === "list" || cardinality === "many" || cardinality === "array") {
      for (const key of keys) listYamlKeys.add(key);
    }
  }
  for (const key of Object.keys(propertyFieldCounts)) {
    if (propertyFieldCounts[key] > 1) listYamlKeys.add(key);
  }
  for (let i = 0; i < rows.length; i++) {
    const row = isObj(rows[i]) ? rows[i] : {};
    const yamlKey = String(row.yamlProperty || "").trim();
    const rawToken = String(row.rawToken || "").trim();
    if (!yamlKey || !rawToken) continue;
    const value = normalizeYamlValueForFormat(rawToken, yamlFormat, row);
    const isAlwaysListKey = listYamlKeys.has(yamlKey);
    if (!Object.prototype.hasOwnProperty.call(out, yamlKey)) out[yamlKey] = isAlwaysListKey ? [] : value;
    if (isAlwaysListKey) {
      const list = Array.isArray(out[yamlKey]) ? out[yamlKey] : [out[yamlKey]];
      if (!list.includes(value)) list.push(value);
      out[yamlKey] = list;
      continue;
    }
    if (!Array.isArray(out[yamlKey])) {
      if (out[yamlKey] === value) continue;
      out[yamlKey] = [out[yamlKey], value];
      continue;
    }
    if (!out[yamlKey].includes(value)) out[yamlKey].push(value);
  }
  return out;
}

function parseFrontmatter(md) {
  const text = String(md || "");
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  if (!m) return { yamlLines: [], body: text, newline };
  const rawYaml = String(m[1] || "");
  const body = String(text.slice(m[0].length) || "");
  const yamlLines = rawYaml.split(/\r?\n/);
  return { yamlLines, body, newline };
}

function renderYamlBlockWithOrder(existingYamlLines, yamlPatch, cfg) {
  const lines = Array.isArray(existingYamlLines) ? existingYamlLines.slice() : [];
  const patch = isObj(yamlPatch) ? yamlPatch : {};
  const keysExisting = [];
  const keyToLineIndex = {};
  const parseTopLevelKey = (line) => {
    const text = String(line || "");
    if (!text.trim() || /^\s/.test(text) || /^\s*#/.test(text)) return null;
    if (text[0] === '"' || text[0] === "'") {
      const quote = text[0];
      let end = -1;
      for (let i = 1; i < text.length; i++) {
        if (quote === '"' && text[i] === "\\") { i += 1; continue; }
        if (quote === "'" && text[i] === "'" && text[i + 1] === "'") { i += 1; continue; }
        if (text[i] === quote) { end = i; break; }
      }
      if (end < 0 || !/^\s*:/.test(text.slice(end + 1))) {
        throw new Error(`InlineOverhaul: invalid quoted YAML top-level key: ${text}`);
      }
      const lexeme = text.slice(0, end + 1);
      let key;
      try {
        key = quote === '"' ? JSON.parse(lexeme) : lexeme.slice(1, -1).replace(/''/g, "'");
      } catch (_) {
        throw new Error(`InlineOverhaul: invalid quoted YAML top-level key: ${text}`);
      }
      return { key: String(key), lexeme };
    }
    const colon = text.indexOf(":");
    if (colon < 1) return null;
    const lexeme = text.slice(0, colon).trim();
    if (!lexeme || /^[\-?:]/.test(lexeme)) throw new Error(`InlineOverhaul: invalid YAML top-level key: ${text}`);
    return { key: lexeme, lexeme };
  };
  const renderYamlKey = (key) => /^[\p{L}\p{N}_.-]+$/u.test(String(key || "")) ? String(key) : JSON.stringify(String(key));
  for (let i = 0; i < lines.length; i++) {
    const parsedKey = parseTopLevelKey(lines[i]);
    if (!parsedKey) continue;
    const k = parsedKey.key;
    if (!k) continue;
    if (Object.prototype.hasOwnProperty.call(keyToLineIndex, k)) throw new Error(`InlineOverhaul: duplicate YAML top-level key: ${k}`);
    keysExisting.push(k);
    keyToLineIndex[k] = i;
  }

  const renderYamlScalar = (value) => {
    if (Array.isArray(value)) return `[${value.map((x) => typeof x === "number" && Number.isFinite(x) ? String(x) : JSON.stringify(String(x ?? ""))).join(", ")}]`;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    return JSON.stringify(String(value ?? ""));
  };

  const mergedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const parsedKey = parseTopLevelKey(lines[i]);
    const key = parsedKey ? parsedKey.key : "";
    if (!key || !Object.prototype.hasOwnProperty.call(patch, key)) {
      mergedLines.push(lines[i]);
      continue;
    }
    mergedLines.push(`${parsedKey.lexeme}: ${renderYamlScalar(patch[key])}`);
    while (i + 1 < lines.length && !parseTopLevelKey(lines[i + 1])) i += 1;
  }
  lines.length = 0;
  lines.push(...mergedLines);
  for (const k of Object.keys(keyToLineIndex)) {
    if (!keysExisting.includes(k)) keysExisting.push(k);
  }

  const orderCfg = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.order) ? cfg.pkm.behavior.order : {};
  const pbf = isObj(orderCfg.propertiesByField) ? orderCfg.propertiesByField : {};
  const orderLeft = Array.isArray(orderCfg.left) ? orderCfg.left.slice() : [];
  const orderRight = Array.isArray(orderCfg.right) ? orderCfg.right.slice() : [];
  const orderFields = orderLeft.concat(orderRight).map((x) => String(x || "").trim()).filter(Boolean);

  const desiredOrderYamlKeys = [];
  for (let i = 0; i < orderFields.length; i++) {
    const fid = orderFields[i];
    const yk = String(pbf[fid] || "").trim();
    if (!yk) continue;
    if (!desiredOrderYamlKeys.includes(yk)) desiredOrderYamlKeys.push(yk);
  }

  const existingSet = new Set(keysExisting);
  for (let i = 0; i < desiredOrderYamlKeys.length; i++) {
    const k = desiredOrderYamlKeys[i];
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
    if (existingSet.has(k)) continue;
    lines.push(`${renderYamlKey(k)}: ${renderYamlScalar(patch[k])}`);
    existingSet.add(k);
  }

  for (const k of Object.keys(patch)) {
    if (existingSet.has(k)) continue;
    lines.push(`${renderYamlKey(k)}: ${renderYamlScalar(patch[k])}`);
    existingSet.add(k);
  }

  return lines;
}

function extractHeaderTitle(line) {
  const t = String(line || "").trim();
  const m = t.match(/^#{1,6}\s+(.+)$/);
  return m ? String(m[1] || "").trim() : "";
}

function resolveAutoTitle(parsed, i2n) {
  const line = String(parsed && parsed.line || "");
  const payload = String(parsed && parsed.payloadText || "").trim();
  const delim = String(i2n && i2n.noteName && i2n.noteName.explicitNameDelimiters || "[]").trim() || "[]";
  const open = delim.slice(0, Math.max(1, Math.floor(delim.length / 2))) || "[";
  const close = delim.slice(open.length) || "]";
  const re = new RegExp(escapeRegexLiteral(open) + "([\\s\\S]*?)" + escapeRegexLiteral(close), "g");
  const lineWithoutWikilinks = line
    .replace(/\[\[[^\]]+\]\]/g, " ")
    .replace(/^(\s*[-*+]\s+)\[[^\]]*\](\s*)/, "$1$2");
  let m;
  while ((m = re.exec(lineWithoutWikilinks)) !== null) {
    const explicit = String(m[1] || "").trim();
    if (explicit) return explicit;
  }
  if (i2n && i2n.noteName && i2n.noteName.preferHeaderTitle) {
    const hh = extractHeaderTitle(line);
    if (hh) return hh;
  }
  const base = payload && payload !== "-" ? payload : "";
  const wordsN = Math.max(1, Math.min(32, Math.trunc(Number(i2n && i2n.noteName && i2n.noteName.autoWordsCount) || 6)));
  const words = base.split(/\s+/).filter(Boolean).slice(0, wordsN);
  if (words.length) return words.join(" ");
  return "";
}

function promptNoteTitleWithModal(plugin, ModalClass) {
  if (!plugin || !plugin.app || typeof ModalClass !== "function") {
    throw new Error("InlineOverhaul: Obsidian Modal unavailable for manual note naming");
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    class NoteTitleModal extends ModalClass {
      onOpen() {
        this.titleEl.setText("Inline2Note: note title");
        const input = this.contentEl.createEl("input", { type: "text" });
        input.style.width = "100%";
        input.setAttribute("aria-label", "Note title");
        const buttons = this.contentEl.createDiv();
        buttons.style.display = "flex";
        buttons.style.justifyContent = "flex-end";
        buttons.style.gap = "8px";
        const cancel = buttons.createEl("button", { text: "Cancel" });
        const submit = buttons.createEl("button", { text: "Create" });
        submit.classList.add("mod-cta");
        const submitValue = () => {
          const value = String(input.value || "").trim();
          if (!value) {
            input.focus();
            return;
          }
          finish(value);
          this.close();
        };
        cancel.addEventListener("click", () => this.close());
        submit.addEventListener("click", submitValue);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") submitValue();
          else if (event.key === "Escape") this.close();
        });
        setTimeout(() => input.focus(), 0);
      }
      onClose() {
        this.contentEl.empty();
        finish(null);
      }
    }
    new NoteTitleModal(plugin.app).open();
  });
}

async function resolveNoteTitle(plugin, parsed, i2n, runtimeOptions) {
  const mode = String(i2n && i2n.noteName && i2n.noteName.mode || "auto").trim().toLowerCase();
  if (mode !== "manual") return resolveAutoTitle(parsed, i2n);
  const ModalClass = runtimeOptions && runtimeOptions.Modal;
  return promptNoteTitleWithModal(plugin, ModalClass);
}

function sanitizeResolvedTitle(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "-") return "";
  return s;
}

function slugSafeTitle(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function pickTargetPath(plugin, title, i2n) {
  const app = plugin.app;
  let folder = String(i2n && i2n.outputFolder || "").trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");
  if (!folder) {
    try {
      const activeFile = app && app.workspace && typeof app.workspace.getActiveFile === "function" ? app.workspace.getActiveFile() : null;
      const parent = activeFile && activeFile.parent ? String(activeFile.parent.path || "").trim() : "";
      folder = parent;
    } catch (_) {}
  }
  const baseTitle = slugSafeTitle(title) || "inline2note";
  const mode = String(i2n && i2n.nameCollision && i2n.nameCollision.mode || "new_note").trim().toLowerCase();
  const basePath = folder ? `${folder}/${baseTitle}.md` : `${baseTitle}.md`;
  const exists = app.vault.getAbstractFileByPath(basePath);
  if (!exists) return { mode, path: basePath, basePath, exists: false };
  if (mode === "overwrite" || mode === "add_to_note") return { mode, path: basePath, basePath, exists: true };
  let idx = 1;
  while (idx < 1000) {
    const suffix = String(idx).padStart(2, "0");
    const p = folder ? `${folder}/${baseTitle}-${suffix}.md` : `${baseTitle}-${suffix}.md`;
    if (!app.vault.getAbstractFileByPath(p)) return { mode: "new_note", path: p, basePath, exists: false };
    idx += 1;
  }
  throw new Error(`InlineOverhaul: cannot allocate unique note path for ${basePath}`);
}

function deriveSourceWikilinkFromTargetPath(targetPath) {
  return String(targetPath || "").trim().replace(/\\/g, "/").replace(/\.md$/i, "");
}

function applySourcePayloadReplace(line, noteTitle, separators) {
  const src = String(line || "");
  const indent = String((src.match(/^[\t ]*/) || [""])[0] || "");
  const body = src.slice(indent.length);
  const title = String(noteTitle || "").trim();
  if (!title) return src;
  const replacement = `[[${title}]]`;
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (s1 && s2 && body.includes(s1) && body.includes(s2)) {
    const firstIdx = body.indexOf(s1);
    const secondIdx = body.indexOf(s2, firstIdx + s1.length);
    if (firstIdx >= 0 && secondIdx > firstIdx) {
      const left = String(body.slice(0, firstIdx) || "").trimEnd();
      const right = String(body.slice(secondIdx + s2.length) || "").trim();
      if (right) return `${indent}${left} ${s1} ${replacement} ${s2} ${right}`;
      return `${indent}${left} ${s1} ${replacement}`;
    }
  }
  if (s1 && body.includes(s1)) {
    const firstIdx = body.indexOf(s1);
    if (firstIdx >= 0) {
      const left = String(body.slice(0, firstIdx) || "").trimEnd();
      return `${indent}${left} ${s1} ${replacement}`;
    }
  }
  const bullet = src.match(/^([\s]*[-*]\s+)(.+)$/);
  if (bullet) return `${bullet[1]}${replacement}`;
  if (s1 && s2) return `${src} ${s1} ${replacement}`;
  return `${src} ${replacement}`;
}

function insertProcessedToken(line, token, panel, separators) {
  const src = String(line || "");
  const processed = String(token || "").trim();
  if (!processed) return src;
  const tokenRx = new RegExp(`(^|\\s)${escapeRegexLiteral(processed)}(?=\\s|$)`);
  if (tokenRx.test(src)) return src;
  const indent = String((src.match(/^[\t ]*/) || [""])[0] || "");
  const body = src.slice(indent.length);
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (!s1 || !s2) throw new Error("InlineOverhaul: source processing separators are required");
  const first = body.indexOf(s1);
  const second = first >= 0 ? body.indexOf(s2, first + s1.length) : -1;
  if (String(panel || "right").trim().toLowerCase() === "left") {
    if (first >= 0) return `${indent}${body.slice(0, first).trimEnd()} ${processed} ${body.slice(first).trimStart()}`;
    const prefix = body.match(/^([-*+]\s+(?:\[[^\]]+\]\s+)?)/);
    if (prefix) return `${indent}${prefix[1]}${processed} ${body.slice(prefix[1].length)}`.trimEnd();
    return `${indent}${processed}${body ? " " + body : ""}`;
  }
  if (second >= 0) {
    const right = body.slice(second + s2.length).trim();
    return `${indent}${body.slice(0, second + s2.length).trimEnd()}${right ? " " + right : ""} ${processed}`;
  }
  return `${indent}${body.trimEnd()} ${s2} ${processed}`;
}

function resolveSourceCleanupFieldIds(i2n, cfg) {
  const selected = Array.isArray(i2n && i2n.sourceProcessing && i2n.sourceProcessing.cleanupFieldIds)
    ? i2n.sourceProcessing.cleanupFieldIds.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const fields = getModeFields(cfg);
  const known = new Set(fields.map((f) => String(f && f.id || "").trim()).filter(Boolean));
  return selected.filter((id) => known.has(id));
}

function applySourceCleanupByFieldIds(line, transformContext, cleanupFieldIds, separators) {
  const src = String(line || "");
  const selected = new Set(Array.isArray(cleanupFieldIds) ? cleanupFieldIds : []);
  const rows = Array.isArray(transformContext && transformContext.matches) ? transformContext.matches : [];
  const spans = new Map();
  for (let i = 0; i < rows.length; i++) {
    const row = isObj(rows[i]) ? rows[i] : {};
    const fid = String(row.fieldId || "").trim();
    const span = isObj(row.span) ? row.span : null;
    if (!fid || !span || !Number.isInteger(span.start) || !Number.isInteger(span.end)) continue;
    const key = `${span.start}:${span.end}`;
    if (!spans.has(key)) spans.set(key, { start: span.start, end: span.end, owners: new Set() });
    spans.get(key).owners.add(fid);
  }
  const removable = Array.from(spans.values())
    .filter((span) => Array.from(span.owners).every((fid) => !selected.has(fid)))
    .sort((a, b) => b.start - a.start);
  let out = src;
  for (let i = 0; i < removable.length; i++) out = out.slice(0, removable[i].start) + out.slice(removable[i].end);
  const leadingIndent = String((out.match(/^\s*/) || [""])[0] || "");
  out = String(out.slice(leadingIndent.length) || "");
  const s1 = String(separators && separators.separator1 || "").trim();
  if (!s1) throw new Error("InlineOverhaul: separator1 is required for source cleanup");
  out = out
    .replace(new RegExp(`\\s+${escapeRegexLiteral(s1)}\\s+`, "g"), ` ${s1} `)
    .replace(/\s{2,}/g, " ")
    .replace(/\s+$/g, "");
  return `${leadingIndent}${normalizeSourceLineAfterCleanup(out, separators)}`;
}

function applySourcePrefixResolution(line, originalLine, transformContext, preservedFieldIds, cfg, lineFinalize) {
  const original = String(originalLine || "");
  const prefixMatch = original.match(/^([\t ]*)([-*+]\s+)(?:\[([^\]]*)\]\s+)?/);
  if (!prefixMatch) return String(line || "");
  if (!lineFinalize || typeof lineFinalize.buildPrefixUnified !== "function") {
    throw new Error("InlineOverhaul: shared prefix resolver unavailable");
  }
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  if (!isObj(behavior.prefixRules)) return String(line || "");
  const orderTypes = isObj(behavior.order && behavior.order.types) ? behavior.order.types : {};
  const fields = getModeFields(cfg);
  const fieldsById = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    if (fid) fieldsById[fid] = fields[i];
  }
  const preserved = new Set(Array.isArray(preservedFieldIds) ? preservedFieldIds : []);
  const selected = {};
  const matches = Array.isArray(transformContext && transformContext.matches) ? transformContext.matches : [];
  for (let i = 0; i < matches.length; i++) {
    const row = matches[i];
    const fid = String(row && row.fieldId || "").trim();
    if (!fid || !preserved.has(fid)) continue;
    const field = fieldsById[fid];
    const values = Array.isArray(field && field.values) ? field.values : [];
    const rawToken = String(row && row.rawToken || "").trim();
    for (let vi = 0; vi < values.length; vi++) {
      const value = values[vi];
      const valueToken = String(value && value.token || "").trim();
      if (!valueToken) continue;
      const fullToken = resolveEffectiveFieldType(field, orderTypes, fid) === "wikilink"
        ? `[[${valueToken.replace(/^#/, "")}]]`
        : composeFieldValueToken(field, valueToken);
      if (fullToken !== rawToken) continue;
      selected[fid] = String(value && value.id || valueToken);
      break;
    }
  }
  const rules = {
    leftMode: { fields },
    behavior: { prefixRules: isObj(behavior.prefixRules) ? behavior.prefixRules : {} },
  };
  const parsedLine = {
    bulletToken: String(prefixMatch[2] || "-").trim(),
    checkboxToken: prefixMatch[3] !== undefined ? `[${String(prefixMatch[3] || "")}]` : "",
    headingToken: "",
  };
  const resolved = String(lineFinalize.buildPrefixUnified(parsedLine, rules, { selected }, {
    isObj,
    getFieldById: (mode, fieldId) => {
      const sourceFields = Array.isArray(mode && mode.fields) ? mode.fields : [];
      return sourceFields.find((field) => String(field && field.id || "") === String(fieldId || "")) || null;
    },
  }) || "").trim();
  const indent = String((String(line || "").match(/^[\t ]*/) || [""])[0] || "");
  const body = String(line || "").slice(indent.length).replace(/^[-*+]\s+(?:\[[^\]]*\]\s+)?/, "").trimStart();
  return `${indent}${resolved}${body ? " " + body : ""}`.trimEnd();
}

function composeFieldValueToken(field, valueToken) {
  const prefix = String(field && field.prefix || "#");
  const token = String(valueToken || "").trim();
  if (!token) return "";
  if (token.startsWith("#") || token.startsWith("[[")) return token;
  return `${prefix}${token}`;
}

function normalizePreviewSeparators(line, separators) {
  const src = String(line || "").trim();
  if (!src) return src;
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (!s1 || !s2) return src;
  const parts = src.split(s1).map((x) => String(x || "").trim());
  if (parts.length < 3) return src.replace(/\s{2,}/g, " ").trim();
  const left = parts[0] || "";
  const payload = parts[1] || "";
  const right = parts.slice(2).join(` ${s2} `).trim();
  if (left && payload && right) return `${left} ${s1} ${payload} ${s2} ${right}`;
  if (left && payload) return `${left} ${s1} ${payload}`;
  if (payload && right) return `${payload} ${s2} ${right}`;
  if (left && right) return `${left} ${s2} ${right}`;
  return [left, payload, right].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
}

function normalizeSourceLineAfterCleanup(line, separators) {
  const src = String(line || "").trim();
  if (!src) return src;
  const s1 = String(separators && separators.separator1 || "").trim();
  const s2 = String(separators && separators.separator2 || "").trim();
  if (!s1 || !s2) return src;
  const parts = src.split(s1).map((x) => String(x || "").trim());
  if (parts.length < 3) return src.replace(/\s{2,}/g, " ").trim();
  const left = parts[0] || "";
  const payload = parts[1] || "";
  const right = parts.slice(2).join(` ${s2} `).trim();

  const dropPrefix = (s) => String(s || "").replace(/^[-*]\s*\[[^\]]+\]\s*/u, "").trim();
  const leftNoPrefix = dropPrefix(left);

  if (!leftNoPrefix && !right && payload) return `- ${payload}`.replace(/\s{2,}/g, " ").trim();
  if (leftNoPrefix && payload && right) return `${left} ${s1} ${payload} ${s2} ${right}`;
  if (leftNoPrefix && payload) return `${left} ${s1} ${payload}`;
  if (payload && right) return `${payload} ${s2} ${right}`;
  if (leftNoPrefix && right) return `${left} ${s2} ${right}`;
  if (payload) return `- ${payload}`;
  return [leftNoPrefix, right].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
}

function getActiveOrderedFieldIds(cfg) {
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const order = isObj(behavior.order) ? behavior.order : {};
  const left = Array.isArray(order.left) ? order.left.slice() : [];
  const right = Array.isArray(order.right) ? order.right.slice() : [];
  const baseOrdered = left.concat(right).map((x) => String(x || "").trim()).filter(Boolean);
  const active = isObj(order.active) ? order.active : {};
  const enabled = isObj(order.enabled) ? order.enabled : {};
  const fields = getModeFields(cfg);
  const allIds = fields.map((f) => String(f && f.id || "").trim()).filter(Boolean);
  const childrenByParent = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    const parentId = String(fields[i] && fields[i].dependsOn || "").trim();
    if (!fid || !parentId) continue;
    if (!Array.isArray(childrenByParent[parentId])) childrenByParent[parentId] = [];
    childrenByParent[parentId].push(fid);
  }
  const out = [];
  const pushIfActive = (fid) => {
    if (!fid || out.includes(fid)) return;
    if (String(active[fid] || "").trim().toLowerCase() === "no") return;
    if (Object.prototype.hasOwnProperty.call(enabled, fid) && enabled[fid] === false) return;
    out.push(fid);
    const children = Array.isArray(childrenByParent[fid]) ? childrenByParent[fid] : [];
    for (let i = 0; i < children.length; i++) pushIfActive(children[i]);
  };
  for (let i = 0; i < baseOrdered.length; i++) {
    pushIfActive(baseOrdered[i]);
  }
  for (let i = 0; i < allIds.length; i++) pushIfActive(allIds[i]);
  return out;
}

function sampleValueForField(field, fType) {
  const values = Array.isArray(field && field.values) ? field.values : [];
  if (fType === "element") {
    const marker = resolveFieldMarker(field);
    if (!marker) return "";
    return `${marker}value`;
  }
  if (fType === "wikilink") {
    const wl = fieldWikilinkCandidates(field);
    if (wl.length) return `[[${wl[0].token}]]`;
    return "[[Link]]";
  }
  const tags = fieldTokenCandidates(field);
  if (tags.length) return tags[0].fullToken;
  return "";
}

function buildPreviewBaseLine(cfg) {
  const separators = resolveIoSeparators(cfg);
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const order = isObj(behavior.order) ? behavior.order : {};
  const labels = isObj(order.labels) ? order.labels : {};
  const orderTypes = isObj(order.types) ? order.types : {};
  const fields = getModeFields(cfg);
  const byId = {};
  for (let i = 0; i < fields.length; i++) {
    const fid = String(fields[i] && fields[i].id || "").trim();
    if (fid) byId[fid] = fields[i];
  }
  const orderedActive = getActiveOrderedFieldIds(cfg);
  const leftOrder = new Set((Array.isArray(order.left) ? order.left : []).map((x) => String(x || "").trim()));
  const rightOrder = new Set((Array.isArray(order.right) ? order.right : []).map((x) => String(x || "").trim()));
  const leftTokens = [];
  const rightTokens = [];
  for (let i = 0; i < orderedActive.length; i++) {
    const fid = orderedActive[i];
    const field = byId[fid];
    if (!field) continue;
    const type = resolveEffectiveFieldType(field, orderTypes, fid);
    const token = sampleValueForField(field, type);
    if (!token) continue;
    const label = String(labels[fid] || fid).trim();
    const composed = `${token}`;
    const parentId = String(field && field.dependsOn || "").trim();
    if (rightOrder.has(fid) || parentId && rightOrder.has(parentId)) rightTokens.push(composed);
    else if (leftOrder.has(fid) || parentId && leftOrder.has(parentId)) leftTokens.push(composed);
    else leftTokens.push(composed);
    void label;
  }
  const left = leftTokens.join(" ").trim();
  const right = rightTokens.join(" ").trim();
  if (left && right) return `${left} ${separators.separator1} Text ${separators.separator2} ${right}`;
  if (left) return `${left} ${separators.separator1} Text`;
  if (right) return `Text ${separators.separator2} ${right}`;
  return "Text";
}

function buildSourcePreviewLine(i2n, cfg) {
  const before = buildPreviewBaseLine(cfg);
  if (!before) return { before: "", after: "" };
  const separators = resolveIoSeparators(cfg);
  const parsed = parseInlineLine(before, cfg);
  const ctx = buildTransformContext(parsed, cfg);
  const ids = resolveSourceCleanupFieldIds(i2n, cfg);
  const cleaned = applySourceCleanupByFieldIds(before, ctx, ids, separators);
  const linked = i2n && i2n.sourceProcessing && i2n.sourceProcessing.replacePayloadWithLink
    ? applySourcePayloadReplace(cleaned, "Preview", separators)
    : cleaned;
  const processed = insertProcessedToken(
    linked,
    i2n && i2n.sourceProcessing && i2n.sourceProcessing.processedToken,
    i2n && i2n.sourceProcessing && i2n.sourceProcessing.processedTokenPanel,
    separators
  );
  const after = normalizePreviewSeparators(normalizeSourceLineAfterCleanup(processed, separators), separators);
  return { before, after };
}

function buildExamplePreviewLine(i2n, cfg) {
  const sample = String(i2n && i2n.preview && i2n.preview.sampleLine || DEFAULT_INLINE2NOTE.preview.sampleLine || "");
  if (!sample) return { before: "", after: "" };
  const separators = resolveIoSeparators(cfg);
  const parsed = parseInlineLine(sample, cfg);
  const ctx = buildTransformContext(parsed, cfg);
  const ids = resolveSourceCleanupFieldIds(i2n, cfg);
  const cleaned = applySourceCleanupByFieldIds(sample, ctx, ids, separators);
  const withLink = i2n && i2n.sourceProcessing && i2n.sourceProcessing.replacePayloadWithLink
    ? applySourcePayloadReplace(cleaned, "Example", separators)
    : cleaned;
  const replaced = insertProcessedToken(
    withLink,
    i2n && i2n.sourceProcessing && i2n.sourceProcessing.processedToken,
    i2n && i2n.sourceProcessing && i2n.sourceProcessing.processedTokenPanel,
    separators
  );
  return {
    before: sample,
    after: normalizePreviewSeparators(normalizeSourceLineAfterCleanup(replaced, separators), separators),
  };
}

function indentSize(line) {
  const s = String(line || "");
  const m = s.match(/^[\t ]*/);
  const raw = m ? String(m[0] || "") : "";
  let n = 0;
  for (let i = 0; i < raw.length; i++) n += raw[i] === "\t" ? 2 : 1;
  return n;
}

function deriveRootBlockFromEditor(ed, lineNo) {
  if (!ed || typeof ed.getLine !== "function") {
    return { rootIndex: 0, rootLine: "", blockStart: 0, blockEnd: 0, blockLines: [""], allLines: [""] };
  }
  const rootLine = String(ed.getLine(lineNo) || "");
  const baseIndent = indentSize(rootLine);
  const total = typeof ed.lineCount === "function" ? Number(ed.lineCount() || 0) : (lineNo + 1);
  let end = lineNo;
  for (let i = lineNo + 1; i < total; i++) {
    const cur = String(ed.getLine(i) || "");
    if (!cur.trim()) { end = i; continue; }
    const curIndent = indentSize(cur);
    if (curIndent > baseIndent) {
      end = i;
      continue;
    }
    break;
  }
  const lines = [];
  for (let i = lineNo; i <= end; i++) lines.push(String(ed.getLine(i) || ""));
  return {
    rootIndex: 0,
    rootLine,
    blockStart: lineNo,
    blockEnd: end,
    blockLines: lines,
    allLines: lines.slice(),
    absolute: true,
  };
}

function deriveSelectionRangeFromEditor(ed, from, to) {
  if (!ed || typeof ed.getLine !== "function") throw new Error("InlineOverhaul: editor line API unavailable");
  const total = typeof ed.lineCount === "function" ? Math.max(1, Number(ed.lineCount() || 1)) : Math.max(1, Number(to && to.line || 0) + 1);
  let start = Math.max(0, Math.min(total - 1, Number(from && from.line || 0)));
  let selectedEnd = Math.max(start, Math.min(total - 1, Number(to && to.line || start)));
  if (selectedEnd > start && Number(to && to.ch || 0) === 0) selectedEnd -= 1;
  while (start <= selectedEnd && !String(ed.getLine(start) || "").trim()) start += 1;
  if (start > selectedEnd) throw new Error("InlineOverhaul: selection contains no transformable line");
  const rootLine = String(ed.getLine(start) || "");
  const baseIndent = indentSize(rootLine);
  let end = selectedEnd;
  for (let i = selectedEnd + 1; i < total; i++) {
    const line = String(ed.getLine(i) || "");
    if (!line.trim()) {
      end = i;
      continue;
    }
    if (indentSize(line) <= baseIndent) break;
    end = i;
  }
  const blockLines = [];
  for (let i = start; i <= end; i++) blockLines.push(String(ed.getLine(i) || ""));
  return {
    rootIndex: 0,
    rootLine,
    blockStart: start,
    blockEnd: end,
    blockLines,
    blockText: blockLines.join("\n"),
    absolute: true,
    partialSelectionExpanded: Number(from && from.ch || 0) > 0 || Number(to && to.ch || 0) < String(ed.getLine(Number(to && to.line || 0)) || "").length,
  };
}

function readEditorBlock(ed, info) {
  const lines = [];
  for (let i = Number(info.blockStart || 0); i <= Number(info.blockEnd || 0); i++) lines.push(String(ed.getLine(i) || ""));
  return lines.join("\n");
}

function assertEditorSnapshot(plugin, ed, info, expectedBlock) {
  if (!ed || plugin && typeof plugin.getActiveEditor === "function" && plugin.getActiveEditor() !== ed) {
    throw new Error("InlineOverhaul: source editor changed before transform completed");
  }
  if (readEditorBlock(ed, info) !== String(expectedBlock || "")) {
    throw new Error("InlineOverhaul: source changed before transform completed");
  }
}

function replaceEditorSourceBlock(ed, info, nextRootLine, sublinesBehavior) {
  if (!ed || typeof ed.replaceRange !== "function") throw new Error("InlineOverhaul: editor replace API unavailable");
  const start = Number(info.blockStart || 0);
  const end = Number(info.blockEnd || start);
  if (String(sublinesBehavior || "stay").trim().toLowerCase() !== "remove") {
    const oldRoot = String(ed.getLine(start) || "");
    ed.replaceRange(String(nextRootLine || ""), { line: start, ch: 0 }, { line: start, ch: oldRoot.length });
    return;
  }
  const total = typeof ed.lineCount === "function" ? Number(ed.lineCount() || 0) : end + 1;
  if (end + 1 < total) {
    ed.replaceRange(`${String(nextRootLine || "")}\n`, { line: start, ch: 0 }, { line: end + 1, ch: 0 });
    return;
  }
  const endText = String(ed.getLine(end) || "");
  ed.replaceRange(String(nextRootLine || ""), { line: start, ch: 0 }, { line: end, ch: endText.length });
}

async function readTemplateContent(plugin, templatePath) {
  const path = String(templatePath || "").trim();
  if (!path) return "";
  if (!plugin || !plugin.app || !plugin.app.vault) throw new Error("InlineOverhaul: vault unavailable for template read");
  const af = plugin.app.vault.getAbstractFileByPath(path);
  if (!af) throw new Error(`InlineOverhaul: template not found: ${path}`);
  try {
    return await plugin.app.vault.read(af);
  } catch (error) {
    throw new Error(`InlineOverhaul: failed to read template ${path}: ${error && error.message ? error.message : error}`);
  }
}

function composeAppendBlock(inlineText, i2n) {
  const placement = isObj(i2n && i2n.placement) ? i2n.placement : {};
  const header = formatHeaderByMode({ placement: { ...placement, headerMode: "datetime" } });
  return [header, normalizeInlineBlockForBody(inlineText, "\n")].filter(Boolean).join("\n");
}

function normalizeInlineBlockForBody(inlineLine, newline) {
  const nl = newline === "\r\n" ? "\r\n" : "\n";
  const lines = String(inlineLine || "").split(/\r?\n/);
  while (lines.length && !String(lines[0] || "").trim()) lines.shift();
  while (lines.length && !String(lines[lines.length - 1] || "").trim()) lines.pop();
  if (!lines.length) return "";
  const rootIndent = String((String(lines[0] || "").match(/^[\t ]*/) || [""])[0] || "");
  if (rootIndent) {
    for (let i = 0; i < lines.length; i++) {
      if (String(lines[i] || "").startsWith(rootIndent)) lines[i] = String(lines[i]).slice(rootIndent.length);
    }
  }
  return lines.join(nl);
}

function composeBodyWithPlacement(templateBody, inlineLine, i2n, newline) {
  const base = String(templateBody || "");
  const nl = newline === "\r\n" ? "\r\n" : "\n";
  const source = normalizeInlineBlockForBody(inlineLine, nl);
  const header = formatHeaderByMode(i2n);
  const block = [header, source].filter(Boolean).join(nl);
  const pos = String(i2n && i2n.placement && i2n.placement.position || "end").trim().toLowerCase();
  if (!base.trim()) return block + nl;
  if (pos === "beginning") return `${block}${nl}${nl}${base}`;
  return `${base.replace(/\r?\n/g, nl)}${nl}${nl}${block}`;
}

function pathWithNumericSuffix(basePath, index) {
  const src = String(basePath || "");
  const suffix = String(index).padStart(2, "0");
  return src.replace(/\.md$/i, `-${suffix}.md`);
}

async function writeInline2Note(plugin, target, content, appendBlock) {
  const vault = plugin.app.vault;
  let af = vault.getAbstractFileByPath(target.path);
  if (target.mode === "new_note") {
    let candidate = String(target.path || "");
    const basePath = String(target.basePath || target.path || "");
    for (let index = 0; index < 1000; index++) {
      if (index > 0) candidate = pathWithNumericSuffix(basePath, index);
      if (vault.getAbstractFileByPath(candidate)) continue;
      const folderPath = candidate.replace(/\\/g, "/").replace(/\/[^/]*$/, "");
      if (folderPath && !vault.getAbstractFileByPath(folderPath)) await vault.createFolder(folderPath);
      try {
        await vault.create(candidate, content);
        const actualTarget = { ...target, path: candidate, exists: false };
        return {
          target: actualTarget,
          rollback: async () => {
            const created = vault.getAbstractFileByPath(candidate);
            if (created && typeof vault.delete === "function") await vault.delete(created);
            else if (created) throw new Error("vault.delete unavailable");
          },
        };
      } catch (error) {
        if (vault.getAbstractFileByPath(candidate)) continue;
        throw error;
      }
    }
    throw new Error(`InlineOverhaul: unique note allocation exhausted for ${basePath}`);
  }
  if (!af) {
    const folderPath = String(target.path || "").replace(/\\/g, "/").replace(/\/[^/]*$/, "");
    if (folderPath && !plugin.app.vault.getAbstractFileByPath(folderPath)) {
      await plugin.app.vault.createFolder(folderPath);
    }
    await vault.create(target.path, content);
    return {
      target: { ...target, exists: false },
      rollback: async () => {
        const created = vault.getAbstractFileByPath(target.path);
        if (created && typeof vault.delete === "function") await vault.delete(created);
        else if (created) throw new Error("vault.delete unavailable");
      },
    };
  }
  const previous = await vault.read(af);
  if (target.mode === "overwrite") {
    await vault.modify(af, content);
    return { target, rollback: async () => vault.modify(af, previous) };
  }
  if (target.mode === "add_to_note") {
    const nl = String(previous || "").includes("\r\n") ? "\r\n" : "\n";
    const block = String(appendBlock || "").trim().replace(/\r?\n/g, nl);
    const next = `${String(previous || "").trimEnd()}${nl}${nl}${block}${nl}`;
    await vault.modify(af, next);
    return { target, rollback: async () => vault.modify(af, previous) };
  }
  throw new Error(`InlineOverhaul: unsupported collision mode ${target.mode}`);
}

function patchInline2Note(plugin, nextI2n, reason) {
  const normalized = normalizeInline2Note(nextI2n);
  plugin.setConfigPatch({ transform: { inline2note: normalized } }, reason);
}

function wireTextCommitOnBlur(inputEl, getNextValue, commitFn) {
  if (!inputEl) return;
  const apply = () => {
    if (!inputEl.isConnected) return;
    const next = String(getNextValue() || "");
    setTimeout(() => {
      if (!inputEl.isConnected) return;
      commitFn(next);
    }, 0);
  };
  inputEl.addEventListener("blur", apply);
  inputEl.addEventListener("keydown", (ev) => {
    if (!ev || ev.key !== "Enter") return;
    apply();
  });
}

function wireTextCommitDebounced(inputEl, getNextValue, commitFn, debounceMs) {
  if (!inputEl) return;
  let t = null;
  const delay = Number.isFinite(Number(debounceMs)) ? Math.max(50, Math.trunc(Number(debounceMs))) : 220;
  const apply = () => {
    if (!inputEl.isConnected) return;
    if (t) {
      clearTimeout(t);
      t = null;
    }
    const next = String(getNextValue() || "");
    setTimeout(() => {
      if (!inputEl.isConnected) return;
      commitFn(next);
    }, 0);
  };
  inputEl.addEventListener("input", () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      const next = String(getNextValue() || "");
      setTimeout(() => {
        if (!inputEl.isConnected) return;
        commitFn(next);
      }, 0);
    }, delay);
  });
  inputEl.addEventListener("blur", apply);
  inputEl.addEventListener("keydown", (ev) => {
    if (!ev || ev.key !== "Enter") return;
    apply();
  });
}

function normalizeRuleDraft(rule, fallbackId) {
  const src = isObj(rule) ? rule : {};
  const conditions = isObj(src.conditions) ? src.conditions : {};
  return {
    id: String(src.id || fallbackId || "rule").trim() || String(fallbackId || "rule"),
    enabled: src.enabled !== false,
    targetTemplate: String(src.targetTemplate || "").trim(),
    conditions: {
      tags: uniq(Array.isArray(conditions.tags) ? conditions.tags : []),
      emojiFields: uniq(Array.isArray(conditions.emojiFields) ? conditions.emojiFields : []),
      wikilinks: uniq(Array.isArray(conditions.wikilinks) ? conditions.wikilinks : []),
    },
    validation: {
      isConflict: false,
      message: "",
    },
  };
}

function renderSmartRulesSection(ctx, i2n, templateOptions) {
  const { Setting, containerEl, plugin, enabled } = ctx;
  containerEl.createEl("h4", { text: "SmartTransform rules" });
  const hint = containerEl.createEl("small", { text: "Conflicting rules are auto-disabled. A rule must contain at least one condition." });
  hint.style.display = "block";
  hint.style.opacity = "0.8";
  hint.style.marginBottom = "8px";

  const rules = Array.isArray(i2n.smartRules) ? i2n.smartRules : [];
  for (let i = 0; i < rules.length; i++) {
    const rule = normalizeRuleDraft(rules[i], `rule-${i + 1}`);
    rule.validation = isObj(rules[i] && rules[i].validation) ? rules[i].validation : { isConflict: false, message: "" };
    const conflictDetails = Array.isArray(rule.validation && rule.validation.details) ? rule.validation.details : [];
    const hasConflictFor = (dimension) => conflictDetails.some((d) => String(d && d.dimension || "") === String(dimension || ""));

    const row = containerEl.createDiv();
    row.style.border = "1px solid var(--background-modifier-border)";
    row.style.borderRadius = "8px";
    row.style.padding = "8px";
    row.style.marginBottom = "8px";
    if (rule.validation && rule.validation.isConflict) {
      row.style.borderColor = "var(--color-red)";
      row.style.background = "color-mix(in srgb, var(--color-red) 8%, transparent)";
    }

    new Setting(row)
      .setName(`Rule ${i + 1}`)
      .setDesc(rule.validation && rule.validation.isConflict ? (rule.validation.message || "Conflict") : "Template routing rule")
      .addToggle((t) => {
        t.setValue(!!rule.enabled).onChange((v) => {
          const next = normalizeInline2Note(i2n);
          const nextRules = Array.isArray(next.smartRules) ? next.smartRules.slice() : [];
          nextRules[i] = normalizeRuleDraft(nextRules[i], `rule-${i + 1}`);
          nextRules[i].enabled = !!v;
          next.smartRules = validateSmartRules(nextRules);
          patchInline2Note(plugin, next, "transform:inline2note:smartRule:enabled");
        });
        if (!enabled || !i2n.enabled || (rule.validation && rule.validation.isConflict)) t.setDisabled(true);
      })
      .addButton((b) => {
        b.setButtonText("Remove").setWarning();
        b.onClick(() => {
          const next = normalizeInline2Note(i2n);
          const nextRules = Array.isArray(next.smartRules) ? next.smartRules.slice() : [];
          nextRules.splice(i, 1);
          next.smartRules = validateSmartRules(nextRules);
          patchInline2Note(plugin, next, "transform:inline2note:smartRule:remove");
        });
        if (!enabled || !i2n.enabled) b.setDisabled(true);
      });

    new Setting(row)
      .setName("Tags (csv)")
      .setDesc("Example: #todo,#project")
      .addText((txt) => {
        txt.setValue((rule.conditions.tags || []).join(", "));
        let draftValue = (rule.conditions.tags || []).join(", ");
        txt.onChange((v) => { draftValue = String(v || ""); });
        if (hasConflictFor("tags")) {
          txt.inputEl.style.borderColor = "var(--color-red)";
          txt.inputEl.style.boxShadow = "0 0 0 1px var(--color-red) inset";
        }
        wireTextCommitDebounced(txt.inputEl, () => draftValue, (v) => {
          const next = normalizeInline2Note(i2n);
          const nextRules = Array.isArray(next.smartRules) ? next.smartRules.slice() : [];
          nextRules[i] = normalizeRuleDraft(nextRules[i], `rule-${i + 1}`);
          nextRules[i].conditions.tags = uniq(splitCsv(v));
          next.smartRules = validateSmartRules(nextRules);
          patchInline2Note(plugin, next, "transform:inline2note:smartRule:tags");
        }, 220);
        if (!enabled || !i2n.enabled) txt.setDisabled(true);
      });

    new Setting(row)
      .setName("Emoji fields (csv)")
      .setDesc("Example: 📅,🛫")
      .addText((txt) => {
        txt.setValue((rule.conditions.emojiFields || []).join(", "));
        let draftValue = (rule.conditions.emojiFields || []).join(", ");
        txt.onChange((v) => { draftValue = String(v || ""); });
        if (hasConflictFor("emojiFields")) {
          txt.inputEl.style.borderColor = "var(--color-red)";
          txt.inputEl.style.boxShadow = "0 0 0 1px var(--color-red) inset";
        }
        wireTextCommitDebounced(txt.inputEl, () => draftValue, (v) => {
          const next = normalizeInline2Note(i2n);
          const nextRules = Array.isArray(next.smartRules) ? next.smartRules.slice() : [];
          nextRules[i] = normalizeRuleDraft(nextRules[i], `rule-${i + 1}`);
          nextRules[i].conditions.emojiFields = uniq(splitCsv(v));
          next.smartRules = validateSmartRules(nextRules);
          patchInline2Note(plugin, next, "transform:inline2note:smartRule:emoji");
        }, 220);
        if (!enabled || !i2n.enabled) txt.setDisabled(true);
      });

    new Setting(row)
      .setName("Wikilinks (csv)")
      .setDesc("Example: [[ClientA]],[[ProjectX]]")
      .addText((txt) => {
        txt.setValue((rule.conditions.wikilinks || []).join(", "));
        let draftValue = (rule.conditions.wikilinks || []).join(", ");
        txt.onChange((v) => { draftValue = String(v || ""); });
        if (hasConflictFor("wikilinks")) {
          txt.inputEl.style.borderColor = "var(--color-red)";
          txt.inputEl.style.boxShadow = "0 0 0 1px var(--color-red) inset";
        }
        wireTextCommitDebounced(txt.inputEl, () => draftValue, (v) => {
          const next = normalizeInline2Note(i2n);
          const nextRules = Array.isArray(next.smartRules) ? next.smartRules.slice() : [];
          nextRules[i] = normalizeRuleDraft(nextRules[i], `rule-${i + 1}`);
          nextRules[i].conditions.wikilinks = uniq(splitCsv(v));
          next.smartRules = validateSmartRules(nextRules);
          patchInline2Note(plugin, next, "transform:inline2note:smartRule:wikilinks");
        }, 220);
        if (!enabled || !i2n.enabled) txt.setDisabled(true);
      });

    if (conflictDetails.length) {
      const chips = row.createDiv();
      chips.style.display = "flex";
      chips.style.flexWrap = "wrap";
      chips.style.gap = "6px";
      chips.style.marginTop = "4px";
      for (let ci = 0; ci < conflictDetails.length; ci++) {
        const d = conflictDetails[ci] || {};
        const chip = chips.createEl("small", { text: `Conflict ${String(d.dimension || "field")}: ${String(d.token || "")}` });
        chip.style.color = "var(--color-red)";
        chip.style.border = "1px solid var(--color-red)";
        chip.style.padding = "1px 6px";
        chip.style.borderRadius = "999px";
      }
    }

    new Setting(row)
      .setName("Target template")
      .setDesc("Template used when this rule matches")
      .addDropdown((d) => {
        d.addOption("", "-- none --");
        for (let ti = 0; ti < templateOptions.length; ti++) d.addOption(templateOptions[ti], templateOptions[ti]);
        d.setValue(rule.targetTemplate || "");
        d.onChange((v) => {
          const next = normalizeInline2Note(i2n);
          const nextRules = Array.isArray(next.smartRules) ? next.smartRules.slice() : [];
          nextRules[i] = normalizeRuleDraft(nextRules[i], `rule-${i + 1}`);
          nextRules[i].targetTemplate = String(v || "").trim();
          next.smartRules = validateSmartRules(nextRules);
          patchInline2Note(plugin, next, "transform:inline2note:smartRule:targetTemplate");
        });
        if (!enabled || !i2n.enabled) d.setDisabled(true);
      });
  }

  new Setting(containerEl)
    .setName("Add smart rule")
    .setDesc("Create a new smart template rule")
    .addButton((b) => {
      b.setButtonText("Add rule").setCta();
      b.onClick(() => {
        const next = normalizeInline2Note(i2n);
        const nextRules = Array.isArray(next.smartRules) ? next.smartRules.slice() : [];
        const id = `rule-${nextRules.length + 1}`;
        nextRules.push(normalizeRuleDraft({ id, enabled: true, targetTemplate: "", conditions: { tags: [], emojiFields: [], wikilinks: [] } }, id));
        next.smartRules = validateSmartRules(nextRules);
        patchInline2Note(plugin, next, "transform:inline2note:smartRule:add");
      });
      if (!enabled || !i2n.enabled) b.setDisabled(true);
    });
}

function renderTransformSettings(ctx) {
  const { Setting, containerEl, cfg, plugin, enabled } = ctx;
  const i2n = normalizeInline2Note(cfg && cfg.transform ? cfg.transform.inline2note : null);

  new Setting(containerEl)
    .setName("Inline2Note enabled")
    .setDesc("Enable inline-to-note transform runtime and settings.")
    .addToggle((t) => {
      t.setValue(i2n.enabled).onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { enabled: !!v } } }, "transform:inline2note:enabled");
      });
      if (!enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Templates folder")
    .setDesc("Vault folder used to resolve markdown templates.")
    .addText((txt) => {
      txt.setPlaceholder("Templates");
      txt.setValue(i2n.templateFolder || "");
      let draftValue = String(i2n.templateFolder || "");
      txt.onChange((v) => { draftValue = String(v || ""); });
      wireTextCommitOnBlur(txt.inputEl, () => draftValue, (nextValue) => {
        plugin.setConfigPatch({ transform: { inline2note: { templateFolder: nextValue } } }, "transform:inline2note:templateFolder");
      });
      if (!enabled || !i2n.enabled) txt.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Output folder for new notes")
    .setDesc("Folder where created/updated notes are stored. Empty means current note folder.")
    .addText((txt) => {
      txt.setPlaceholder("Notes/Fleet");
      txt.setValue(i2n.outputFolder || "");
      let draftValue = String(i2n.outputFolder || "");
      txt.onChange((v) => { draftValue = String(v || ""); });
      wireTextCommitOnBlur(txt.inputEl, () => draftValue, (nextValue) => {
        plugin.setConfigPatch({ transform: { inline2note: { outputFolder: nextValue } } }, "transform:inline2note:outputFolder");
      });
      if (!enabled || !i2n.enabled) txt.setDisabled(true);
    });

  const templateOptions = collectTemplateOptions(plugin.app, i2n.templateFolder);
  new Setting(containerEl)
    .setName("Default template")
    .setDesc("Used when no smart rule matches.")
    .addDropdown((d) => {
      d.addOption("", "-- none --");
      for (let i = 0; i < templateOptions.length; i++) d.addOption(templateOptions[i], templateOptions[i]);
      d.setValue(i2n.defaultTemplate || "");
      d.onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { defaultTemplate: String(v || "") } } }, "transform:inline2note:defaultTemplate");
      });
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  renderSmartRulesSection(ctx, i2n, templateOptions);

  new Setting(containerEl)
    .setName("Note name mode")
    .setDesc("Auto: derive title from inline; Manual: prompt user for title.")
    .addDropdown((d) => {
      d.addOption("auto", "Auto");
      d.addOption("manual", "Manual");
      d.setValue(i2n.noteName.mode);
      d.onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { noteName: { mode: String(v || "auto") } } } }, "transform:inline2note:noteName:mode");
      });
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Explicit name delimiters")
    .setDesc("Auto naming priority starts with text inside these opening/closing delimiters.")
    .addText((txt) => {
      txt.setValue(i2n.noteName.explicitNameDelimiters || "[]");
      let draftValue = String(i2n.noteName.explicitNameDelimiters || "[]");
      txt.onChange((v) => { draftValue = String(v || ""); });
      wireTextCommitOnBlur(txt.inputEl, () => draftValue, (value) => {
        plugin.setConfigPatch({ transform: { inline2note: { noteName: { explicitNameDelimiters: value } } } }, "transform:inline2note:noteName:delimiters");
      });
      if (!enabled || !i2n.enabled) txt.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Auto title word count")
    .setDesc("Fallback title length when delimiters and markdown header are absent.")
    .addText((txt) => {
      txt.inputEl.type = "number";
      txt.setValue(String(i2n.noteName.autoWordsCount || 6));
      let draftValue = String(i2n.noteName.autoWordsCount || 6);
      txt.onChange((v) => { draftValue = String(v || ""); });
      wireTextCommitOnBlur(txt.inputEl, () => draftValue, (value) => {
        plugin.setConfigPatch({ transform: { inline2note: { noteName: { autoWordsCount: Number(value) } } } }, "transform:inline2note:noteName:words");
      });
      if (!enabled || !i2n.enabled) txt.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Name collision mode")
    .setDesc("How to handle existing target note names.")
    .addDropdown((d) => {
      d.addOption("new_note", "New note (+suffix)");
      d.addOption("add_to_note", "Add to note");
      d.addOption("overwrite", "Overwrite");
      d.setValue(i2n.nameCollision.mode);
      d.onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { nameCollision: { mode: String(v || "new_note") } } } }, "transform:inline2note:nameCollision:mode");
      });
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Where to place inline text?")
    .setDesc("Placement in created note body.")
    .addDropdown((d) => {
      d.addOption("beginning", "At beginning");
      d.addOption("end", "At end");
      d.setValue(i2n.placement.position);
      d.onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { placement: { position: String(v || "end") } } } }, "transform:inline2note:placement:position");
      });
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Inserted block header")
    .setDesc("Custom header, formatted datetime header, or no header.")
    .addDropdown((d) => {
      d.addOption("custom", "Custom");
      d.addOption("datetime", "Datetime");
      d.addOption("none", "None");
      d.setValue(i2n.placement.headerMode);
      d.onChange((v) => plugin.setConfigPatch({ transform: { inline2note: { placement: { headerMode: String(v || "none") } } } }, "transform:inline2note:placement:headerMode"));
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  if (i2n.placement.headerMode === "custom") {
    new Setting(containerEl)
      .setName("Custom header text")
      .addText((txt) => {
        txt.setValue(i2n.placement.customHeaderText || "");
        let draftValue = String(i2n.placement.customHeaderText || "");
        txt.onChange((v) => { draftValue = String(v || ""); });
        wireTextCommitOnBlur(txt.inputEl, () => draftValue, (value) => plugin.setConfigPatch({ transform: { inline2note: { placement: { customHeaderText: value } } } }, "transform:inline2note:placement:customHeader"));
        if (!enabled || !i2n.enabled) txt.setDisabled(true);
      });
  }
  if (i2n.placement.headerMode === "datetime") {
    new Setting(containerEl)
      .setName("Datetime header format")
      .setDesc("Tokens: YYYY MM DD HH mm ss")
      .addText((txt) => {
        txt.setValue(i2n.placement.datetimeHeaderFormat || "YYYY-MM-DD HH:mm");
        let draftValue = String(i2n.placement.datetimeHeaderFormat || "YYYY-MM-DD HH:mm");
        txt.onChange((v) => { draftValue = String(v || ""); });
        wireTextCommitOnBlur(txt.inputEl, () => draftValue, (value) => plugin.setConfigPatch({ transform: { inline2note: { placement: { datetimeHeaderFormat: value } } } }, "transform:inline2note:placement:datetimeFormat"));
        if (!enabled || !i2n.enabled) txt.setDisabled(true);
      });
  }

  new Setting(containerEl)
    .setName("YAML note format")
    .setDesc("Raw keeps configured tokens; Clean stores normalized token values.")
    .addDropdown((d) => {
      d.addOption("raw", "Raw");
      d.addOption("clean", "Clean");
      d.setValue(i2n.yamlNoteFormat || "raw");
      d.onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { yamlNoteFormat: String(v || "raw") } } }, "transform:inline2note:yamlNoteFormat");
      });
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Open transformed note")
    .setDesc("When enabled, open created/updated note after transform.")
    .addToggle((t) => {
      t.setValue(!!i2n.openTransformedNote).onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { openTransformedNote: !!v } } }, "transform:inline2note:openTransformedNote");
      });
      if (!enabled || !i2n.enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Sublines behavior")
    .setDesc("For selection/root tree: Stay keeps sublines in source; Remove moves them into note and removes from source.")
    .addDropdown((d) => {
      d.addOption("stay", "Stay");
      d.addOption("remove", "Remove");
      d.setValue(String(i2n.sublinesBehavior || "stay"));
      d.onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { sublinesBehavior: String(v || "stay") } } }, "transform:inline2note:sublinesBehavior");
      });
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Flying button")
    .setDesc("Beta limitation: unavailable until editor-decoration lifecycle is stabilized. Use command palette/hotkey.")
    .addToggle((t) => {
      t.setValue(false);
      t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Replace payload with note link")
    .setDesc("After successful transform, replace first payload segment with [[noteTitle]] in source line.")
    .addToggle((t) => {
      t.setValue(!!(i2n.sourceProcessing && i2n.sourceProcessing.replacePayloadWithLink)).onChange((v) => {
        plugin.setConfigPatch({ transform: { inline2note: { sourceProcessing: { replacePayloadWithLink: !!v } } } }, "transform:inline2note:source:replacePayload");
      });
      if (!enabled || !i2n.enabled) t.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Processed token")
    .setDesc("Optional token inserted after successful transform. Empty disables insertion.")
    .addText((txt) => {
      txt.setValue(i2n.sourceProcessing.processedToken || "");
      let draftValue = String(i2n.sourceProcessing.processedToken || "");
      txt.onChange((v) => { draftValue = String(v || ""); });
      wireTextCommitOnBlur(txt.inputEl, () => draftValue, (value) => plugin.setConfigPatch({ transform: { inline2note: { sourceProcessing: { processedToken: value } } } }, "transform:inline2note:source:processedToken"));
      if (!enabled || !i2n.enabled) txt.setDisabled(true);
    });

  new Setting(containerEl)
    .setName("Processed token panel")
    .addDropdown((d) => {
      d.addOption("left", "Left");
      d.addOption("right", "Right");
      d.setValue(i2n.sourceProcessing.processedTokenPanel || "right");
      d.onChange((value) => plugin.setConfigPatch({ transform: { inline2note: { sourceProcessing: { processedTokenPanel: String(value || "right") } } } }, "transform:inline2note:source:processedPanel"));
      if (!enabled || !i2n.enabled) d.setDisabled(true);
    });

  const cleanupIds = resolveSourceCleanupFieldIds(i2n, cfg);
  const cleanupSet = new Set(cleanupIds);
  const modeFields = getModeFields(cfg);
  const behavior = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior : {};
  const order = isObj(behavior.order) ? behavior.order : {};
  const strictNames = isObj(order.strictNames) ? order.strictNames : {};
  const orderTypes = isObj(order.types) ? order.types : {};
  const byId = {};
  for (let i = 0; i < modeFields.length; i++) {
    const fid = String(modeFields[i] && modeFields[i].id || "").trim();
    if (fid) byId[fid] = modeFields[i];
  }
  const orderedActive = getActiveOrderedFieldIds(cfg);
  const subMap = {};
  for (let i = 0; i < orderedActive.length; i++) {
    const fid = orderedActive[i];
    const parent = String(byId[fid] && byId[fid].dependsOn || "").trim();
    if (!parent) continue;
    if (!Array.isArray(subMap[parent])) subMap[parent] = [];
    if (!subMap[parent].includes(fid)) subMap[parent].push(fid);
  }
  const cleanupBox = containerEl.createDiv();
  cleanupBox.style.border = "1px solid var(--background-modifier-border)";
  cleanupBox.style.borderRadius = "8px";
  cleanupBox.style.padding = "8px";
  cleanupBox.style.marginBottom = "10px";
  cleanupBox.style.background = "var(--background-secondary)";

  if (!plugin._transformUiState || typeof plugin._transformUiState !== "object") plugin._transformUiState = {};
  if (!plugin._transformUiState.inline2note || typeof plugin._transformUiState.inline2note !== "object") plugin._transformUiState.inline2note = {};
  const uiState = plugin._transformUiState.inline2note;
  if (typeof uiState.cleanupDetailsOpen !== "boolean") uiState.cleanupDetailsOpen = false;

  const details = cleanupBox.createEl("details");
  details.open = !!uiState.cleanupDetailsOpen;
  details.addEventListener("toggle", () => {
    uiState.cleanupDetailsOpen = !!details.open;
  });
  const summary = details.createEl("summary", { text: "Source cleanup fields" });
  summary.style.cursor = "pointer";
  summary.style.fontWeight = "600";
  summary.style.marginBottom = "6px";

  const controls = details.createDiv();
  controls.style.display = "flex";
  controls.style.alignItems = "center";
  controls.style.justifyContent = "space-between";
  controls.style.gap = "10px";
  controls.style.marginBottom = "6px";
  controls.createEl("small", { text: "Checked fields are kept in source line after transform; unchecked fields are removed." });
  const actions = controls.createDiv();
  actions.style.display = "flex";
  actions.style.gap = "6px";
  const mkActionBtn = (text, onClick) => {
    const b = actions.createEl("button", { text });
    b.style.padding = "2px 8px";
    b.style.fontSize = "12px";
    b.disabled = !enabled || !i2n.enabled;
    b.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!enabled || !i2n.enabled) return;
      onClick();
    });
    return b;
  };
  mkActionBtn("Select all", () => {
    uiState.cleanupDetailsOpen = true;
    const next = normalizeInline2Note(i2n);
    next.sourceProcessing.cleanupFieldIds = orderedActive.filter((fid) => !!byId[fid]);
    patchInline2Note(plugin, next, "transform:inline2note:source:cleanupFieldIds:all");
  });
  mkActionBtn("Clear all", () => {
    uiState.cleanupDetailsOpen = true;
    const next = normalizeInline2Note(i2n);
    next.sourceProcessing.cleanupFieldIds = [];
    patchInline2Note(plugin, next, "transform:inline2note:source:cleanupFieldIds:none");
  });

  const list = details.createDiv();
  list.style.display = "block";
  list.style.marginTop = "8px";
  list.style.borderTop = "1px solid var(--background-modifier-border)";
  list.style.paddingTop = "6px";
  const toUiType = (rawType) => {
    const t = String(rawType || "").trim().toLowerCase();
    if (t === "wikilink") return "link";
    if (t === "element") return "element";
    return "tag";
  };
  const renderRow = (fid, isSub) => {
    const field = byId[fid];
    if (!field) return;
    const rowType = toUiType(resolveEffectiveFieldType(field, orderTypes, fid));
    const strictName = String(strictNames[fid] || fid).trim() || fid;
    const row = list.createDiv();
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "flex-start";
    row.style.gap = "6px";
    row.style.margin = isSub ? "3px 0 3px 18px" : "4px 0";
    row.style.padding = isSub ? "3px 8px" : "5px 8px";
    row.style.borderRadius = "6px";
    row.style.border = "1px solid var(--background-modifier-border-hover)";
    row.style.background = "var(--background-secondary)";
    if (isSub) row.style.borderLeft = "2px solid var(--background-modifier-border-focus)";
    const left = row.createDiv();
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "6px";
    const cb = row.createEl("input", { type: "checkbox" });
    left.appendChild(cb);
    cb.checked = cleanupSet.has(fid);
    cb.disabled = !enabled || !i2n.enabled;
    const label = left.createEl("label", { text: strictName });
    label.style.opacity = "0.95";
    label.style.cursor = "pointer";
    const badge = left.createEl("span", { text: rowType });
    badge.style.fontSize = "11px";
    badge.style.fontWeight = "600";
    badge.style.padding = "1px 6px";
    badge.style.borderRadius = "999px";
    if (rowType === "tag") {
      badge.style.color = "var(--color-blue)";
      badge.style.border = "1px solid color-mix(in srgb, var(--color-blue) 45%, var(--background-modifier-border))";
      badge.style.background = "color-mix(in srgb, var(--color-blue) 14%, var(--background-primary))";
    } else if (rowType === "link") {
      badge.style.color = "var(--color-green)";
      badge.style.border = "1px solid color-mix(in srgb, var(--color-green) 45%, var(--background-modifier-border))";
      badge.style.background = "color-mix(in srgb, var(--color-green) 14%, var(--background-primary))";
    } else {
      badge.style.color = "var(--color-orange)";
      badge.style.border = "1px solid color-mix(in srgb, var(--color-orange) 45%, var(--background-modifier-border))";
      badge.style.background = "color-mix(in srgb, var(--color-orange) 14%, var(--background-primary))";
    }
    cb.id = `io-cleanup-${fid}`;
    label.setAttribute("for", cb.id);
    cb.addEventListener("change", () => {
      uiState.cleanupDetailsOpen = true;
      const next = normalizeInline2Note(i2n);
      const nextSet = new Set(resolveSourceCleanupFieldIds(next, cfg));
      if (cb.checked) nextSet.add(fid);
      else nextSet.delete(fid);
      next.sourceProcessing.cleanupFieldIds = Array.from(nextSet);
      patchInline2Note(plugin, next, "transform:inline2note:source:cleanupFieldIds");
    });
  };
  for (let i = 0; i < orderedActive.length; i++) {
    const fid = orderedActive[i];
    if (!byId[fid] || String(byId[fid].dependsOn || "").trim()) continue;
    renderRow(fid, false);
    const subs = Array.isArray(subMap[fid]) ? subMap[fid] : [];
    for (let si = 0; si < subs.length; si++) {
      if (!byId[subs[si]]) continue;
      renderRow(subs[si], true);
    }
  }

  const preview = buildSourcePreviewLine(i2n, cfg);
  const example = buildExamplePreviewLine(i2n, cfg);
  const pv = containerEl.createDiv();
  pv.style.border = "1px dashed var(--background-modifier-border)";
  pv.style.borderRadius = "8px";
  pv.style.padding = "8px";
  pv.style.marginBottom = "10px";
  pv.style.background = "var(--background-secondary)";
  pv.createEl("div", { text: "Preview", cls: "setting-item-name" });
  const beforeTitle = pv.createEl("div", { text: "Before" });
  beforeTitle.style.fontWeight = "600";
  beforeTitle.style.opacity = "0.9";
  beforeTitle.style.marginTop = "4px";
  const beforeEl = pv.createEl("pre", { text: preview.before });
  beforeEl.style.whiteSpace = "pre-wrap";
  beforeEl.style.margin = "4px 0 8px 0";
  beforeEl.style.padding = "6px 8px";
  beforeEl.style.borderRadius = "6px";
  beforeEl.style.background = "var(--background-primary)";
  beforeEl.style.border = "1px solid var(--background-modifier-border)";
  const afterTitle = pv.createEl("div", { text: "After" });
  afterTitle.style.fontWeight = "600";
  afterTitle.style.opacity = "0.9";
  const afterEl = pv.createEl("pre", { text: preview.after });
  afterEl.style.whiteSpace = "pre-wrap";
  afterEl.style.margin = "4px 0";
  afterEl.style.padding = "6px 8px";
  afterEl.style.borderRadius = "6px";
  afterEl.style.background = "var(--background-primary)";
  afterEl.style.border = "1px solid var(--background-modifier-border)";

  const exTitle = pv.createEl("div", { text: "Example preview" });
  exTitle.style.fontWeight = "600";
  exTitle.style.opacity = "0.9";
  exTitle.style.marginTop = "8px";
  const exBefore = pv.createEl("pre", { text: `Before: ${example.before}` });
  exBefore.style.whiteSpace = "pre-wrap";
  exBefore.style.margin = "4px 0";
  exBefore.style.padding = "6px 8px";
  exBefore.style.borderRadius = "6px";
  exBefore.style.background = "var(--background-primary)";
  exBefore.style.border = "1px solid var(--background-modifier-border)";
  const exAfter = pv.createEl("pre", { text: `After:  ${example.after}` });
  exAfter.style.whiteSpace = "pre-wrap";
  exAfter.style.margin = "4px 0";
  exAfter.style.padding = "6px 8px";
  exAfter.style.borderRadius = "6px";
  exAfter.style.background = "var(--background-primary)";
  exAfter.style.border = "1px solid var(--background-modifier-border)";

  const tips = containerEl.createEl("small", { text: "Transform settings are applied on blur/Enter for stable typing and live conflict updates." });
  tips.style.display = "block";
  tips.style.marginTop = "8px";
  tips.style.opacity = "0.8";
}

async function runInline2Note(plugin, runtimeOptions) {
  const cfg = plugin && typeof plugin.getConfig === "function" ? plugin.getConfig() : {};
  const separators = resolveIoSeparators(cfg);
  const i2n = normalizeInline2Note(cfg && cfg.transform ? cfg.transform.inline2note : null);
  if (!i2n.enabled) {
    plugin.notice("InlineOverhaul: Transform inline2note disabled");
    return;
  }
  const ed = plugin.getActiveEditor();
  if (!ed) {
    plugin.notice("InlineOverhaul: no active editor");
    return;
  }
  const from = typeof ed.getCursor === "function" ? ed.getCursor("from") : null;
  const to = typeof ed.getCursor === "function" ? ed.getCursor("to") : null;
  const hasSelection = !!(ed && typeof ed.somethingSelected === "function" && ed.somethingSelected());
  if (!from || !to) throw new Error("InlineOverhaul: editor cursor unavailable");
  const selectionInfo = hasSelection
    ? deriveSelectionRangeFromEditor(ed, from, to)
    : deriveRootBlockFromEditor(ed, Number(from.line || 0));
  const sourceLine = String(selectionInfo.rootLine || "");
  const sourceBlockText = String(selectionInfo.blockText || (selectionInfo.blockLines || []).join("\n") || sourceLine);
  const sourceSnapshot = readEditorBlock(ed, selectionInfo);
  const parsed = parseInlineLine(sourceLine, cfg);
  if (!String(parsed.payloadText || "").trim()) throw new Error("InlineOverhaul: source payload is empty");
  const transformContext = buildTransformContext(parsed, cfg);
  const resolvedTitle = await resolveNoteTitle(plugin, parsed, i2n, runtimeOptions);
  if (resolvedTitle === null) {
    plugin.notice("InlineOverhaul: transform cancelled");
    return;
  }
  const title = sanitizeResolvedTitle(resolvedTitle);
  if (!title) throw new Error("InlineOverhaul: note title is empty");
  const target = await pickTargetPath(plugin, title, i2n);
  const yamlMap = buildYamlMapFromContext(transformContext, cfg);
  const templatePath = selectSmartTemplate(parsed, i2n.smartRules, i2n.defaultTemplate);
  const templateContent = target.mode === "add_to_note" && target.exists
    ? ""
    : await readTemplateContent(plugin, templatePath);
  const { yamlLines, body, newline } = parseFrontmatter(templateContent);
  const mergedYaml = renderYamlBlockWithOrder(yamlLines, yamlMap, cfg);
  const bodyOut = composeBodyWithPlacement(body, sourceBlockText || sourceLine, i2n, newline);
  const yamlBlock = mergedYaml.length ? `---${newline}${mergedYaml.join(newline)}${newline}---${newline}` : "";
  const noteContent = `${yamlBlock}${bodyOut}`;
  const appendBlock = composeAppendBlock(sourceBlockText || sourceLine, i2n);
  assertEditorSnapshot(plugin, ed, selectionInfo, sourceSnapshot);
  const mutation = await writeInline2Note(plugin, target, noteContent, appendBlock);
  const actualTarget = mutation.target;
  try {
    assertEditorSnapshot(plugin, ed, selectionInfo, sourceSnapshot);
    const cleanupFieldIds = resolveSourceCleanupFieldIds(i2n, cfg);
    let nextRoot = applySourceCleanupByFieldIds(sourceLine, transformContext, cleanupFieldIds, separators);
    nextRoot = applySourcePrefixResolution(nextRoot, sourceLine, transformContext, cleanupFieldIds, cfg, runtimeOptions && runtimeOptions.lineFinalize);
    if (i2n.sourceProcessing.replacePayloadWithLink) {
      nextRoot = applySourcePayloadReplace(nextRoot, deriveSourceWikilinkFromTargetPath(actualTarget.path), separators);
    }
    nextRoot = insertProcessedToken(nextRoot, i2n.sourceProcessing.processedToken, i2n.sourceProcessing.processedTokenPanel, separators);
    replaceEditorSourceBlock(ed, selectionInfo, nextRoot, i2n.sublinesBehavior);
  } catch (sourceError) {
    try {
      await mutation.rollback();
    } catch (rollbackError) {
      throw new Error(`InlineOverhaul: source edit failed and target rollback failed: ${sourceError.message}; rollback: ${rollbackError.message}`);
    }
    throw new Error(`InlineOverhaul: source edit failed; target mutation rolled back: ${sourceError && sourceError.message ? sourceError.message : sourceError}`);
  }
  if (i2n.openTransformedNote) {
    try {
      const opened = plugin.app.vault.getAbstractFileByPath(actualTarget.path);
      if (opened && plugin.app.workspace && typeof plugin.app.workspace.getLeaf === "function") {
        const leaf = plugin.app.workspace.getLeaf(true);
        if (leaf && typeof leaf.openFile === "function") await leaf.openFile(opened);
      }
    } catch (_) {}
  }
  plugin.notice(`InlineOverhaul: inline2note created ${actualTarget.path}`);
}

module.exports = {
  DEFAULT_INLINE2NOTE,
  normalizeInline2Note,
  normalizeTransformConfig,
  validateSmartRules,
  parseInlineLine,
  buildTransformContext,
  buildYamlMapFromContext,
  parseFrontmatter,
  renderYamlBlockWithOrder,
  resolveAutoTitle,
  formatHeaderByMode,
  selectSmartTemplate,
  applySourcePayloadReplace,
  applySourceCleanupByFieldIds,
  applySourcePrefixResolution,
  insertProcessedToken,
  buildPreviewBaseLine,
  deriveSelectionRangeFromEditor,
  normalizeInlineBlockForBody,
  deriveSourceWikilinkFromTargetPath,
  renderTransformSettings,
  runInline2Note,
};
