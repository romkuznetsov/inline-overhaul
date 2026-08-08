"use strict";

function sanitizeDatesByFieldFromConfigNote(input, isObj) {
  const src = isObj(input) ? input : {};
  const out = {};
  for (const fid of Object.keys(src)) {
    const fc = isObj(src[fid]) ? src[fid] : {};
    const next = { ...fc };
    delete next.active;
    delete next.activeMode;
    out[fid] = next;
  }
  return out;
}

function sanitizeElementsByFieldFromConfigNote(input, isObj) {
  const src = isObj(input) ? input : {};
  const out = {};
  for (const fid of Object.keys(src)) {
    const fc = isObj(src[fid]) ? src[fid] : {};
    const next = { ...fc };
    delete next.enabled;
    delete next.active;
    delete next.activeMode;
    out[fid] = next;
  }
  return out;
}

function resolveOrderFieldScopes(cfg, normalizePkmOrder, isObj) {
  const rawOrder = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cfg.pkm.behavior.order : null;
  const order = typeof normalizePkmOrder === "function"
    ? normalizePkmOrder(rawOrder)
    : (isObj(rawOrder) ? rawOrder : {});
  const types = isObj(order.types) ? order.types : {};
  const activeElements = new Set();
  for (const key of Object.keys(types)) {
    const id = String(key || "").trim();
    if (!id) continue;
    if (String(types[key] || "").trim().toLowerCase() !== "element") continue;
    activeElements.add(id);
  }
  return { activeElements };
}

function filterBehaviorDateElementConfigs(cfgLike, scopes, isObj) {
  const cfg = isObj(cfgLike) ? cfgLike : {};
  const behavior = isObj(cfg.pkm) && isObj(cfg.pkm.behavior) ? cfg.pkm.behavior : null;
  if (!behavior) return cfg;

  const activeElements = scopes && scopes.activeElements instanceof Set ? scopes.activeElements : new Set();

  if (isObj(behavior.elements)) {
    const elements = behavior.elements;
    const fields = Array.isArray(elements.fields) ? elements.fields : [];
    elements.fields = fields.map((x) => String(x || "").trim()).filter((x) => x && activeElements.has(x));
    if (isObj(elements.byField)) {
      const next = {};
      for (const key of Object.keys(elements.byField)) {
        const id = String(key || "").trim();
        if (!id || !activeElements.has(id)) continue;
        next[id] = elements.byField[key];
      }
      elements.byField = next;
    }
  }

  if (isObj(behavior.dates)) delete behavior.dates;

  if (isObj(cfg.pkm.taxonomy) && isObj(cfg.pkm.taxonomy.tagWheelConfig)) {
    const tw = cfg.pkm.taxonomy.tagWheelConfig;
    if (isObj(tw.elements)) {
      const ef = Array.isArray(tw.elements.fields) ? tw.elements.fields : [];
      tw.elements.fields = ef.map((x) => String(x || "").trim()).filter((x) => x && activeElements.has(x));
      if (isObj(tw.elements.byField)) {
        const next = {};
        for (const key of Object.keys(tw.elements.byField)) {
          const id = String(key || "").trim();
          if (!id || !activeElements.has(id)) continue;
          next[id] = tw.elements.byField[key];
        }
        tw.elements.byField = next;
      }
    }
    if (isObj(tw.dates)) delete tw.dates;
  }
  return cfg;
}

async function openTagWheelConfigNote(ctx) {
  const {
    app,
    cfg,
    tagWheelConfigCodec,
    cloneJson,
    isObj,
    readVaultText,
    detectDateFieldHotkeys,
    normalizePkmOrder,
    TAGWHEEL_CONFIG_MODE_DETAILED,
    TAGWHEEL_CONFIG_MODE_MINIMAL,
  } = ctx;

  const codec = tagWheelConfigCodec || {};
  const parseTagWheelConfigMarkdown = typeof codec.parseTagWheelConfigMarkdown === "function"
    ? codec.parseTagWheelConfigMarkdown
    : ctx.parseTagWheelConfigMarkdown;
  const buildTagWheelConfigParts = typeof codec.buildTagWheelConfigParts === "function"
    ? codec.buildTagWheelConfigParts
    : ctx.buildTagWheelConfigParts;
  const buildDefaultTagWheelDetailedTemplateMarkdown = typeof codec.buildDefaultTagWheelDetailedTemplateMarkdown === "function"
    ? codec.buildDefaultTagWheelDetailedTemplateMarkdown
    : ctx.buildDefaultTagWheelDetailedTemplateMarkdown;
  const renderTagWheelConfigFromTemplate = typeof codec.renderTagWheelConfigFromTemplate === "function"
    ? codec.renderTagWheelConfigFromTemplate
    : ctx.renderTagWheelConfigFromTemplate;
  const buildMinimalFromRenderedTemplate = typeof codec.buildMinimalFromRenderedTemplate === "function"
    ? codec.buildMinimalFromRenderedTemplate
    : ctx.buildMinimalFromRenderedTemplate;
  const normalizeTagWheelConfigPath = typeof codec.normalizeTagWheelConfigPath === "function"
    ? codec.normalizeTagWheelConfigPath
    : ctx.normalizeTagWheelConfigPath;
  const normalizeTagWheelConfigTemplatePath = typeof codec.normalizeTagWheelConfigTemplatePath === "function"
    ? codec.normalizeTagWheelConfigTemplatePath
    : ctx.normalizeTagWheelConfigTemplatePath;

  const notePath = normalizeTagWheelConfigPath(cfg && cfg.pkm ? cfg.pkm.tagWheelConfigPath : "");
  const modeRaw = cfg && cfg.pkm ? cfg.pkm.configExportMode : TAGWHEEL_CONFIG_MODE_DETAILED;
  const mode = String(modeRaw || TAGWHEEL_CONFIG_MODE_DETAILED).trim() === TAGWHEEL_CONFIG_MODE_MINIMAL
    ? TAGWHEEL_CONFIG_MODE_MINIMAL
    : TAGWHEEL_CONFIG_MODE_DETAILED;
  const existing = app.vault.getAbstractFileByPath(notePath);
  let renderCfg = cfg;
  let currentMd = "";
  if (existing) {
    currentMd = await app.vault.read(existing);
    try {
      const parsedExisting = parseTagWheelConfigMarkdown(currentMd, cfg);
      if (parsedExisting && (parsedExisting.datesConfig || parsedExisting.elementsConfig)) {
        const clone = cloneJson(cfg) || cfg;
        if (!isObj(clone.pkm)) clone.pkm = {};
        if (!isObj(clone.pkm.behavior)) clone.pkm.behavior = {};
        if (!isObj(clone.pkm.behavior.elements)) clone.pkm.behavior.elements = {};
        const datesSrc = parsedExisting.datesConfig || {};
        const elemsSrc = parsedExisting.elementsConfig || {};
        const curElemFields = Array.isArray(clone.pkm.behavior.elements.fields) ? clone.pkm.behavior.elements.fields.slice() : [];
        const parsedElemFields = Array.isArray(elemsSrc.fields) ? elemsSrc.fields.slice() : [];
        const parsedDateFields = Array.isArray(datesSrc.fields) ? datesSrc.fields.slice() : [];
        clone.pkm.behavior.elements.fields = Array.from(new Set(curElemFields.concat(parsedElemFields).map((x) => String(x || "").trim()).filter(Boolean)));
        clone.pkm.behavior.elements.fields = Array.from(new Set(clone.pkm.behavior.elements.fields.concat(parsedDateFields).map((x) => String(x || "").trim()).filter(Boolean)));
        if (!isObj(clone.pkm.behavior.elements.byField)) clone.pkm.behavior.elements.byField = {};
        const parsedElemsByField = sanitizeElementsByFieldFromConfigNote(elemsSrc.byField, isObj);
        const parsedDatesByField = sanitizeDatesByFieldFromConfigNote(datesSrc.byField, isObj);
        for (const fid of Object.keys(parsedDatesByField)) {
          const src = isObj(parsedDatesByField[fid]) ? parsedDatesByField[fid] : {};
          const dst = isObj(clone.pkm.behavior.elements.byField[fid]) ? clone.pkm.behavior.elements.byField[fid] : {};
          const merged = {
            ...src,
            ...dst,
            increment: {
              ...(isObj(src.increment) ? src.increment : {}),
              ...(isObj(dst.increment) ? dst.increment : {}),
            },
          };
          if (!String(merged.emoji || "").trim() && String(src.emoji || "").trim()) merged.emoji = String(src.emoji || "").trim();
          if (!String(merged.format || "").trim() && String(src.format || "").trim()) merged.format = String(src.format || "").trim();
          clone.pkm.behavior.elements.byField[fid] = merged;
        }
        for (const fid of Object.keys(parsedElemsByField)) {
          const dst = isObj(clone.pkm.behavior.elements.byField[fid]) ? clone.pkm.behavior.elements.byField[fid] : {};
          clone.pkm.behavior.elements.byField[fid] = { ...dst, ...parsedElemsByField[fid] };
        }
        renderCfg = clone;
      }
    } catch (_) {}
  }
  filterBehaviorDateElementConfigs(renderCfg, resolveOrderFieldScopes(renderCfg, normalizePkmOrder, isObj), isObj);
  try {
    const dstCfg = cloneJson(renderCfg) || renderCfg;
    if (isObj(dstCfg) && isObj(dstCfg.pkm) && isObj(dstCfg.pkm.behavior) && isObj(dstCfg.pkm.behavior.elements)) {
      const byField = isObj(dstCfg.pkm.behavior.elements.byField) ? dstCfg.pkm.behavior.elements.byField : {};
      for (const fid of Object.keys(byField)) {
        const hk = detectDateFieldHotkeys(fid, dstCfg);
        const fc = isObj(byField[fid]) ? byField[fid] : {};
        byField[fid] = {
          ...fc,
          hotkey: {
            ...(isObj(fc.hotkey) ? fc.hotkey : {}),
            increase: hk.increase || String(fc?.hotkey?.increase || "").trim(),
            decrease: hk.decrease || String(fc?.hotkey?.decrease || "").trim(),
          },
        };
      }
      dstCfg.pkm.behavior.elements.byField = byField;
      renderCfg = dstCfg;
    }
  } catch (_) {}
  const parts = buildTagWheelConfigParts(renderCfg);
  const templatePath = normalizeTagWheelConfigTemplatePath(cfg && cfg.pkm ? cfg.pkm.tagWheelConfigTemplatePath : "");
  const templateFile = app.vault.getAbstractFileByPath(templatePath);
  if (!templateFile) {
    const seed = buildDefaultTagWheelDetailedTemplateMarkdown();
    await app.vault.create(templatePath, seed);
  }
  const templateMd = await readVaultText(app, templatePath);
  const renderedMd = renderTagWheelConfigFromTemplate(templateMd, parts);
  const freshMd = mode === TAGWHEEL_CONFIG_MODE_MINIMAL
    ? buildMinimalFromRenderedTemplate(renderedMd)
    : renderedMd;
  if (!existing) {
    await app.vault.create(notePath, freshMd);
  } else {
    if (currentMd !== freshMd) {
      await app.vault.modify(existing, freshMd);
    }
  }
  const file = app.vault.getAbstractFileByPath(notePath);
  if (!file) throw new Error("Failed to create/open config note: " + notePath);
  const leaf = app.workspace.getLeaf(true);
  await leaf.openFile(file);
  return notePath;
}

async function openTagWheelConfigTemplateNote(ctx) {
  const { app, cfg, tagWheelConfigCodec } = ctx;
  const codec = tagWheelConfigCodec || {};
  const normalizeTagWheelConfigTemplatePath = typeof codec.normalizeTagWheelConfigTemplatePath === "function"
    ? codec.normalizeTagWheelConfigTemplatePath
    : ctx.normalizeTagWheelConfigTemplatePath;
  const buildDefaultTagWheelDetailedTemplateMarkdown = typeof codec.buildDefaultTagWheelDetailedTemplateMarkdown === "function"
    ? codec.buildDefaultTagWheelDetailedTemplateMarkdown
    : ctx.buildDefaultTagWheelDetailedTemplateMarkdown;
  const templatePath = normalizeTagWheelConfigTemplatePath(cfg && cfg.pkm ? cfg.pkm.tagWheelConfigTemplatePath : "");
  let file = app.vault.getAbstractFileByPath(templatePath);
  if (!file) {
    await app.vault.create(templatePath, buildDefaultTagWheelDetailedTemplateMarkdown());
    file = app.vault.getAbstractFileByPath(templatePath);
  }
  if (!file) throw new Error("Failed to create/open detailed template note: " + templatePath);
  const leaf = app.workspace.getLeaf(true);
  await leaf.openFile(file);
  return templatePath;
}

async function applyTagWheelConfigNote(ctx) {
  const {
    app,
    cfg,
    tagWheelConfigCodec,
    store,
    readVaultText,
    getOrderStrictName,
    isObj,
    cloneJson,
    collectTagSections,
    getFieldById,
    extractFieldMetaMap,
    rebuildTagValues,
    rebuildSubtagValues,
    denormTagToken,
    getPrefixRulesFromCfg,
    collectCheckboxTokensFromMap,
    deepMerge,
    syncCustomPrefixResolverBlock,
    normalizePkmOrder,
    CFG_H2_DATES,
  } = ctx;

  const codec = tagWheelConfigCodec || {};
  const normalizeTagWheelConfigPath = typeof codec.normalizeTagWheelConfigPath === "function"
    ? codec.normalizeTagWheelConfigPath
    : ctx.normalizeTagWheelConfigPath;
  const parseTagWheelConfigMarkdown = typeof codec.parseTagWheelConfigMarkdown === "function"
    ? codec.parseTagWheelConfigMarkdown
    : ctx.parseTagWheelConfigMarkdown;

  const notePath = normalizeTagWheelConfigPath(cfg && cfg.pkm ? cfg.pkm.tagWheelConfigPath : "");
  const md = await readVaultText(app, notePath);
  const parsed = parseTagWheelConfigMarkdown(md, cfg);
  void getOrderStrictName;
  void CFG_H2_DATES;
  let isWikilinkSourceFieldSafe = (fieldLike) => {
    const source = String(fieldLike && fieldLike.source || "").trim();
    return source === "projects" || source.indexOf("wikilinks:") === 0;
  };
  try {
    const runtimeHelpers = require("../core/pkm_rules_runtime_helpers.js");
    if (runtimeHelpers && typeof runtimeHelpers.isWikilinkSourceField === "function") {
      isWikilinkSourceFieldSafe = runtimeHelpers.isWikilinkSourceField;
    }
  } catch (_) {}

  const behaviorCfg = isObj(cfg && cfg.pkm && cfg.pkm.behavior) ? cloneJson(cfg.pkm.behavior) : {};
  const leftMode = isObj(behaviorCfg.leftMode)
    ? behaviorCfg.leftMode
    : { fields: [] };
  if (!Array.isArray(leftMode.fields)) leftMode.fields = [];
  const rightMode = isObj(behaviorCfg.rightMode)
    ? behaviorCfg.rightMode
    : { fields: [] };
  if (!Array.isArray(rightMode.fields)) rightMode.fields = [];
  let allModeFields = leftMode.fields.concat(rightMode.fields);
  const refreshAllModeFields = () => {
    allModeFields = leftMode.fields.concat(rightMode.fields);
  };
  const getFieldAcrossModes = (fieldId) => {
    const id = String(fieldId || "").trim();
    if (!id) return null;
    return getFieldById(allModeFields, id);
  };

  const orderCfg = normalizePkmOrder(behaviorCfg.order || null);
  behaviorCfg.order = cloneJson(orderCfg);
  if (!isObj(behaviorCfg.order.propertiesByField)) behaviorCfg.order.propertiesByField = {};
  const strictToOrderKey = {};
  const registerStrict = (orderKey) => {
    const key = String(orderKey || "").trim();
    if (!key) return;
    const strict = String((behaviorCfg.order && behaviorCfg.order.strictNames && behaviorCfg.order.strictNames[key]) || key).trim();
    if (!strict) return;
    strictToOrderKey[strict] = key;
  };
  const leftKeys = Array.isArray(behaviorCfg.order && behaviorCfg.order.left) ? behaviorCfg.order.left : [];
  const rightKeys = Array.isArray(behaviorCfg.order && behaviorCfg.order.right) ? behaviorCfg.order.right : [];
  for (let i = 0; i < leftKeys.length; i++) registerStrict(leftKeys[i]);
  for (let i = 0; i < rightKeys.length; i++) registerStrict(rightKeys[i]);

  const parsedSectionOrder = Array.isArray(parsed.sectionOrder) ? parsed.sectionOrder : [];
  const parsedSectionKinds = isObj(parsed.sectionKinds) ? parsed.sectionKinds : {};
  for (let i = 0; i < parsedSectionOrder.length; i++) {
    const strictName = String(parsedSectionOrder[i] || "").trim();
    if (!strictName) continue;
    if (!/[\S]/.test(strictName)) continue;
    const kind = String(parsedSectionKinds[strictName] || "tag").trim().toLowerCase() === "link" ? "link" : "tag";
    if (strictToOrderKey[strictName]) {
      const existingField = getFieldAcrossModes(strictName);
      if (existingField && kind === "link") {
        existingField.source = String(existingField.source || "").trim() === "projects"
          ? "projects"
          : `wikilinks:${strictName}`;
        if (Object.prototype.hasOwnProperty.call(existingField, "dependsOn")) delete existingField.dependsOn;
        const legacySubId = `${strictName}_sub`;
        leftMode.fields = leftMode.fields.filter((f) => String(f && f.id || "").trim() !== legacySubId);
        rightMode.fields = rightMode.fields.filter((f) => String(f && f.id || "").trim() !== legacySubId);
        if (Array.isArray(behaviorCfg.order.left)) behaviorCfg.order.left = behaviorCfg.order.left.filter((k) => String(k || "").trim() !== legacySubId);
        if (Array.isArray(behaviorCfg.order.right)) behaviorCfg.order.right = behaviorCfg.order.right.filter((k) => String(k || "").trim() !== legacySubId);
      }
      if (!isObj(behaviorCfg.order.types)) behaviorCfg.order.types = {};
      behaviorCfg.order.types[strictName] = kind === "link" ? "wikilink" : "tag";
      continue;
    }
    const fieldDef = kind === "link"
      ? { id: strictName, prefix: "#", source: `wikilinks:${strictName}`, placeholder: strictName, values: [""] }
      : { id: strictName, prefix: "#", placeholder: strictName, values: [""] };
    rightMode.fields.push(fieldDef);
    allModeFields.push(fieldDef);
    if (!Array.isArray(behaviorCfg.order.right)) behaviorCfg.order.right = [];
    behaviorCfg.order.right.push(strictName);
    if (!isObj(behaviorCfg.order.strictNames)) behaviorCfg.order.strictNames = {};
    behaviorCfg.order.strictNames[strictName] = strictName;
    if (!isObj(behaviorCfg.order.types)) behaviorCfg.order.types = {};
    behaviorCfg.order.types[strictName] = kind === "link" ? "wikilink" : "tag";
    strictToOrderKey[strictName] = strictName;
  }
  const parsedWikilinkFieldIds = Array.isArray(parsed.wikilinkFields)
    ? parsed.wikilinkFields.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  for (let i = 0; i < parsedWikilinkFieldIds.length; i++) {
    const fieldId = parsedWikilinkFieldIds[i];
    if (!fieldId) continue;
    const existingField = getFieldAcrossModes(fieldId);
    if (existingField) {
      if (!isWikilinkSourceFieldSafe(existingField)) continue;
      existingField.source = `wikilinks:${fieldId}`;
      if (Object.prototype.hasOwnProperty.call(existingField, "dependsOn")) delete existingField.dependsOn;
      if (!isObj(behaviorCfg.order.types)) behaviorCfg.order.types = {};
      behaviorCfg.order.types[fieldId] = "wikilink";
      continue;
    }
    const fieldDef = { id: fieldId, prefix: "#", source: `wikilinks:${fieldId}`, placeholder: fieldId, values: [""] };
    rightMode.fields.push(fieldDef);
    allModeFields.push(fieldDef);
    if (!Array.isArray(behaviorCfg.order.right)) behaviorCfg.order.right = [];
    const leftHas = Array.isArray(behaviorCfg.order.left) && behaviorCfg.order.left.includes(fieldId);
    if (!leftHas && !behaviorCfg.order.right.includes(fieldId)) behaviorCfg.order.right.push(fieldId);
    if (!isObj(behaviorCfg.order.strictNames)) behaviorCfg.order.strictNames = {};
    behaviorCfg.order.strictNames[fieldId] = fieldId;
    if (!isObj(behaviorCfg.order.types)) behaviorCfg.order.types = {};
    behaviorCfg.order.types[fieldId] = "wikilink";
    if (!isObj(behaviorCfg.order.active)) behaviorCfg.order.active = {};
    if (!String(behaviorCfg.order.active[fieldId] || "").trim()) behaviorCfg.order.active[fieldId] = "yes";
    if (!isObj(behaviorCfg.order.enabled)) behaviorCfg.order.enabled = {};
    if (typeof behaviorCfg.order.enabled[fieldId] !== "boolean") behaviorCfg.order.enabled[fieldId] = true;
    strictToOrderKey[fieldId] = fieldId;
  }
  const dedupeOrder = (arr) => {
    const src = Array.isArray(arr) ? arr : [];
    const out = [];
    const seen = new Set();
    for (let i = 0; i < src.length; i++) {
      const id = String(src[i] || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  };
  behaviorCfg.order.left = dedupeOrder(behaviorCfg.order.left);
  behaviorCfg.order.right = dedupeOrder(behaviorCfg.order.right);
  {
    const leftSet = new Set(Array.isArray(behaviorCfg.order.left) ? behaviorCfg.order.left : []);
    if (Array.isArray(behaviorCfg.order.right)) {
      behaviorCfg.order.right = behaviorCfg.order.right.filter((id) => !leftSet.has(String(id || "").trim()));
    }
  }
  {
    const rightSet = new Set(Array.isArray(behaviorCfg.order.right) ? behaviorCfg.order.right : []);
    const findInMode = (arr, fieldId) => {
      const list = Array.isArray(arr) ? arr : [];
      const target = String(fieldId || "").trim();
      if (!target) return -1;
      for (let i = 0; i < list.length; i++) {
        if (String(list[i] && list[i].id || "").trim() === target) return i;
      }
      return -1;
    };
    for (const fieldId of rightSet.values()) {
      const id = String(fieldId || "").trim();
      if (!id) continue;
      const leftIdx = findInMode(leftMode.fields, id);
      if (leftIdx === -1) continue;
      const leftField = leftMode.fields[leftIdx];
      if (!isWikilinkSourceFieldSafe(leftField)) continue;
      const rightIdx = findInMode(rightMode.fields, id);
      if (rightIdx === -1) {
        rightMode.fields.push(leftField);
      }
      leftMode.fields.splice(leftIdx, 1);
    }
  }
  refreshAllModeFields();

  const cfgForSections = cloneJson(cfg || {});
  if (!isObj(cfgForSections.pkm)) cfgForSections.pkm = {};
  cfgForSections.pkm.behavior = cloneJson(behaviorCfg);
  const sectionDefs = collectTagSections(cfgForSections);
  const parsedSectionSet = new Set(
    Object.keys(isObj(parsed.sections) ? parsed.sections : {})
      .concat(Array.isArray(parsed.sectionOrder) ? parsed.sectionOrder.map((x) => String(x || "").trim()).filter(Boolean) : [])
  );
  const removedFieldIds = new Set();
  for (let i = 0; i < sectionDefs.length; i++) {
    const d = sectionDefs[i];
    const sid = String(d && d.sectionId || "").trim();
    if (!sid || parsedSectionSet.has(sid)) continue;
    const fid = String(d && d.fieldId || "").trim();
    const sfid = String(d && d.subFieldId || "").trim();
    if (fid) removedFieldIds.add(fid);
    if (sfid) removedFieldIds.add(sfid);
  }
  if (removedFieldIds.size) {
    const shouldKeepField = (f) => {
      const id = String(f && f.id || "").trim();
      if (!id) return true;
      return !removedFieldIds.has(id);
    };
    leftMode.fields = leftMode.fields.filter(shouldKeepField);
    rightMode.fields = rightMode.fields.filter(shouldKeepField);
    const cleanOrderArray = (arr) => (Array.isArray(arr) ? arr.filter((k) => !removedFieldIds.has(String(k || "").trim())) : []);
    behaviorCfg.order.left = cleanOrderArray(behaviorCfg.order.left);
    behaviorCfg.order.right = cleanOrderArray(behaviorCfg.order.right);
    const cleanObjMap = (obj) => {
      const src = isObj(obj) ? obj : {};
      const out = {};
      for (const k of Object.keys(src)) {
        if (removedFieldIds.has(String(k || "").trim())) continue;
        out[k] = src[k];
      }
      return out;
    };
    behaviorCfg.order.strictNames = cleanObjMap(behaviorCfg.order.strictNames);
    behaviorCfg.order.labels = cleanObjMap(behaviorCfg.order.labels);
    behaviorCfg.order.types = cleanObjMap(behaviorCfg.order.types);
    behaviorCfg.order.active = cleanObjMap(behaviorCfg.order.active);
    behaviorCfg.order.enabled = cleanObjMap(behaviorCfg.order.enabled);
    behaviorCfg.order.freeRoam = cleanObjMap(behaviorCfg.order.freeRoam);
    behaviorCfg.order.propertiesByField = cleanObjMap(behaviorCfg.order.propertiesByField);
    if (isObj(parsed.checkboxByFieldValue)) {
      for (const rid of removedFieldIds.values()) delete parsed.checkboxByFieldValue[rid];
    }
    if (isObj(parsed.orphanWikilinks)) {
      for (const rid of removedFieldIds.values()) delete parsed.orphanWikilinks[rid];
    }
    refreshAllModeFields();
  }
  const sectionIdByFieldId = {};
  const sectionDefById = {};
  for (let i = 0; i < sectionDefs.length; i++) {
    const d = sectionDefs[i];
    sectionDefById[d.sectionId] = d;
    sectionIdByFieldId[d.fieldId] = d.sectionId;
    if (d.subFieldId) sectionIdByFieldId[d.subFieldId] = d.sectionId;
  }
  const appliedSectionIds = new Set();
  for (let i = 0; i < sectionDefs.length; i++) {
    const d = sectionDefs[i];
    const sec = parsed.sections[d.sectionId];
    if (!sec) continue;
    appliedSectionIds.add(String(d.sectionId || "").trim());
    const sectionId = String(d.sectionId || "").trim();
    const sectionOrderKey = String(strictToOrderKey[sectionId] || sectionId).trim();
    const sectionFieldYaml = String(parsed.fieldYamlBySection && parsed.fieldYamlBySection[sectionId] || "").trim();
    if (sectionOrderKey) {
      if (sectionFieldYaml) behaviorCfg.order.propertiesByField[sectionOrderKey] = sectionFieldYaml;
    }
    const parentField = getFieldAcrossModes(d.fieldId);
    if (parentField) {
      const parentMeta = extractFieldMetaMap(parentField);
      const parentYamlByToken = isObj(parsed.yamlByFieldValue && parsed.yamlByFieldValue[d.fieldId])
        ? parsed.yamlByFieldValue[d.fieldId]
        : {};
      const parentList = Array.isArray(sec.parents) ? sec.parents : [];
      for (let pi = 0; pi < parentList.length; pi++) {
        const tok = denormTagToken(parentList[pi] && parentList[pi].token || "");
        if (!tok) continue;
        const candidate = String(parentYamlByToken[tok] || "").trim();
        if (candidate && candidate !== sectionFieldYaml) {
          if (!isObj(parentMeta[tok])) parentMeta[tok] = {};
          parentMeta[tok].yamlProperty = candidate;
        } else if (isObj(parentMeta[tok]) && Object.prototype.hasOwnProperty.call(parentMeta[tok], "yamlProperty")) {
          delete parentMeta[tok].yamlProperty;
        }
      }
      parentField.values = rebuildTagValues(sec.parents.map((x) => x.token), parentMeta);
    }
    if (d.subFieldId) {
      const subField = getFieldAcrossModes(d.subFieldId);
      if (subField) {
        const subMeta = extractFieldMetaMap(subField);
        const subYamlByToken = isObj(parsed.yamlByFieldValue && parsed.yamlByFieldValue[d.subFieldId])
          ? parsed.yamlByFieldValue[d.subFieldId]
          : {};
        const parents = Array.isArray(sec.parents) ? sec.parents : [];
        for (let pi = 0; pi < parents.length; pi++) {
          const subs = Array.isArray(parents[pi] && parents[pi].subtags) ? parents[pi].subtags : [];
          for (let si = 0; si < subs.length; si++) {
            const tok = denormTagToken(subs[si]);
            if (!tok) continue;
            const candidate = String(subYamlByToken[tok] || "").trim();
            if (candidate && candidate !== sectionFieldYaml) {
              if (!isObj(subMeta[tok])) subMeta[tok] = {};
              subMeta[tok].yamlProperty = candidate;
            } else if (isObj(subMeta[tok]) && Object.prototype.hasOwnProperty.call(subMeta[tok], "yamlProperty")) {
              delete subMeta[tok].yamlProperty;
            }
          }
        }
        subField.values = rebuildSubtagValues(sec.parents, subMeta);
      }
    }
  }

  const parsedSectionsObj = isObj(parsed.sections) ? parsed.sections : {};
  for (const sectionIdRaw of Object.keys(parsedSectionsObj)) {
    const sectionId = String(sectionIdRaw || "").trim();
    if (!sectionId || appliedSectionIds.has(sectionId)) continue;
    const sec = parsedSectionsObj[sectionId];
    if (!isObj(sec)) continue;
    const parentTokens = Array.isArray(sec.parents)
      ? sec.parents.map((x) => (isObj(x) ? x.token : "")).filter((x) => String(x || "").trim())
      : [];
    const parentField = getFieldAcrossModes(sectionId);
    const sectionOrderKey = String(strictToOrderKey[sectionId] || sectionId).trim();
    const sectionFieldYaml = String(parsed.fieldYamlBySection && parsed.fieldYamlBySection[sectionId] || "").trim();
    if (sectionOrderKey) {
      if (sectionFieldYaml) behaviorCfg.order.propertiesByField[sectionOrderKey] = sectionFieldYaml;
    }
    if (parentField) {
      const parentMeta = extractFieldMetaMap(parentField);
      const parentYamlByToken = isObj(parsed.yamlByFieldValue && parsed.yamlByFieldValue[String(parentField.id || "").trim()])
        ? parsed.yamlByFieldValue[String(parentField.id || "").trim()]
        : {};
      for (let pi = 0; pi < parentTokens.length; pi++) {
        const tok = denormTagToken(parentTokens[pi]);
        if (!tok) continue;
        const candidate = String(parentYamlByToken[tok] || "").trim();
        if (candidate && candidate !== sectionFieldYaml) {
          if (!isObj(parentMeta[tok])) parentMeta[tok] = {};
          parentMeta[tok].yamlProperty = candidate;
        } else if (isObj(parentMeta[tok]) && Object.prototype.hasOwnProperty.call(parentMeta[tok], "yamlProperty")) {
          delete parentMeta[tok].yamlProperty;
        }
      }
      parentField.values = rebuildTagValues(parentTokens, parentMeta);
    }
    const subField = getFieldAcrossModes(`${sectionId}_sub`);
    if (subField) {
      const subMeta = extractFieldMetaMap(subField);
      const subYamlByToken = isObj(parsed.yamlByFieldValue && parsed.yamlByFieldValue[String(subField.id || "").trim()])
        ? parsed.yamlByFieldValue[String(subField.id || "").trim()]
        : {};
      const parents = Array.isArray(sec.parents) ? sec.parents : [];
      for (let pi = 0; pi < parents.length; pi++) {
        const subs = Array.isArray(parents[pi] && parents[pi].subtags) ? parents[pi].subtags : [];
        for (let si = 0; si < subs.length; si++) {
          const tok = denormTagToken(subs[si]);
          if (!tok) continue;
          const candidate = String(subYamlByToken[tok] || "").trim();
          if (candidate && candidate !== sectionFieldYaml) {
            if (!isObj(subMeta[tok])) subMeta[tok] = {};
            subMeta[tok].yamlProperty = candidate;
          } else if (isObj(subMeta[tok]) && Object.prototype.hasOwnProperty.call(subMeta[tok], "yamlProperty")) {
            delete subMeta[tok].yamlProperty;
          }
        }
      }
      subField.values = rebuildSubtagValues(Array.isArray(sec.parents) ? sec.parents : [], subMeta);
    }
  }

  const normalizeWikilinkTokenRaw = (token) => {
    const src = String(token || "").trim();
    if (!src) return "";
    const m = src.match(/^\[\[([^\]]+)\]\]$/);
    return m ? String(m[1] || "").trim() : src;
  };

  const buildWikilinkFieldValues = (field, sourceFieldId, parsedSections, orphanWikilinks) => {
    const sourceId = String(sourceFieldId || "").trim();
    const sectionsSrc = isObj(parsedSections) ? parsedSections : {};
    if (!sourceId) return [];
    const mergeEntries = [];
    for (const sectionName of Object.keys(sectionsSrc)) {
      const sec = sectionsSrc[sectionName];
      if (!isObj(sec)) continue;
      const wlRoot = isObj(sec.wikilinks) ? sec.wikilinks : {};
      const wl = isObj(wlRoot[sourceId]) ? wlRoot[sourceId] : null;
      if (!wl) continue;
      mergeEntries.push({ sectionName, wl });
    }
    const orphanByField = isObj(orphanWikilinks) ? orphanWikilinks : {};
    const orphanList = Array.isArray(orphanByField[sourceId]) ? orphanByField[sourceId] : [];
    if (!mergeEntries.length && !orphanList.length) return [];
    const existingMeta = extractFieldMetaMap(field);
    const withDepends = typeof field?.dependsOn === "string" && String(field.dependsOn || "").trim().length > 0;
    const dependsOnFieldId = String(field && field.dependsOn || "").trim();
    const sectionForDepends = String(sectionIdByFieldId[dependsOnFieldId] || "").trim();
    const parentDefForDepends = sectionForDepends && isObj(sectionDefById[sectionForDepends]) ? sectionDefById[sectionForDepends] : null;
    const defaultParentFieldId = parentDefForDepends && parentDefForDepends.fieldId
      ? String(parentDefForDepends.fieldId || "").trim()
      : "";

    if (!withDepends) {
      const out = [];
      const seen = new Set();
      const pushToken = (rawTok) => {
        const token = normalizeWikilinkTokenRaw(rawTok);
        if (!token || seen.has(token)) return;
        seen.add(token);
        const meta = isObj(existingMeta[token]) ? cloneJson(existingMeta[token]) : {};
        delete meta.allowedParentValues;
        out.push({
          ...meta,
          token,
          __ioParentBinding: "",
          __ioParentFieldId: "",
          active: typeof meta.active === "boolean" ? meta.active : true,
        });
      };
      for (let ni = 0; ni < mergeEntries.length; ni++) {
        const wl = mergeEntries[ni] && isObj(mergeEntries[ni].wl) ? mergeEntries[ni].wl : {};
        const defs = Array.isArray(wl.defaults) ? wl.defaults : [];
        for (let i = 0; i < defs.length; i++) pushToken(defs[i]);
        const parentMap = isObj(wl.byParent) ? wl.byParent : {};
        for (const parentToken of Object.keys(parentMap)) {
          const node = isObj(parentMap[parentToken]) ? parentMap[parentToken] : {};
          const branch = Array.isArray(node.branch) ? node.branch : [];
          for (let i = 0; i < branch.length; i++) pushToken(branch[i]);
          const leaf = isObj(node.leaf) ? node.leaf : {};
          for (const subToken of Object.keys(leaf)) {
            const arr = Array.isArray(leaf[subToken]) ? leaf[subToken] : [];
            for (let i = 0; i < arr.length; i++) pushToken(arr[i]);
          }
        }
      }
      for (let oi = 0; oi < orphanList.length; oi++) pushToken(orphanList[oi]);
      return out;
    }

    const allowedByToken = {};
    const tokenOrder = [];
    const bindingByToken = {};
    const assertCanonicalBinding = (binding, token, reason) => {
      const src = String(binding || "").trim();
      const mLeaf = src.match(/^s:#[^|]+\|p:#[^|]+\|f:[^|]+$/);
      const mBranch = src.match(/^p:#[^|]+\|f:[^|]+$/);
      if (!mLeaf && !mBranch) {
        throw new Error(`Config apply failed: non-canonical binding for wikilink token=[[${token}]], field=${sourceId}, reason=${reason}, binding=${src || "<empty>"}`);
      }
    };
    const pushDefault = (rawTok) => {
      const token = normalizeWikilinkTokenRaw(rawTok);
      if (!token) return;
      if (!allowedByToken[token]) tokenOrder.push(token);
      if (!allowedByToken[token]) allowedByToken[token] = new Set();
    };
    const pushAllowed = (rawTok, rawParent, sourceParentFieldId, sourceSectionName) => {
      const token = normalizeWikilinkTokenRaw(rawTok);
      const parent = denormTagToken(rawParent);
      if (!token || !parent) return;
      const parentFieldId = String(sourceParentFieldId || defaultParentFieldId || "").trim();
      if (!parentFieldId) {
        throw new Error(`Config apply failed: unresolved parent field id for wikilink token=[[${token}]], section=${sourceSectionName || "<unknown>"}, field=${sourceId}`);
      }
      const binding = `p:#${parent}|f:${parentFieldId}`;
      assertCanonicalBinding(binding, token, "branch");
      if (!allowedByToken[token]) tokenOrder.push(token);
      if (!allowedByToken[token]) allowedByToken[token] = new Set();
      allowedByToken[token].add(parent);
      if (bindingByToken[token] && bindingByToken[token] !== binding) {
        throw new Error(`Config apply failed: conflicting parent binding for wikilink token=[[${token}]], field=${sourceId}, bindings=${bindingByToken[token]} vs ${binding}`);
      }
      if (!bindingByToken[token]) bindingByToken[token] = binding;
    };
    const pushLeaf = (rawTok, rawParent, rawSub, sourceParentFieldId, sourceSectionName) => {
      const token = normalizeWikilinkTokenRaw(rawTok);
      const parent = denormTagToken(rawParent);
      const sub = denormTagToken(rawSub);
      if (!token || !parent || !sub) return;
      const parentFieldId = String(sourceParentFieldId || defaultParentFieldId || "").trim();
      if (!parentFieldId) {
        throw new Error(`Config apply failed: unresolved parent field id for wikilink token=[[${token}]], section=${sourceSectionName || "<unknown>"}, field=${sourceId}`);
      }
      const binding = `s:#${sub}|p:#${parent}|f:${parentFieldId}`;
      assertCanonicalBinding(binding, token, "leaf");
      if (!allowedByToken[token]) tokenOrder.push(token);
      if (!allowedByToken[token]) allowedByToken[token] = new Set();
      allowedByToken[token].add(parent);
      allowedByToken[token].add(sub);
      if (bindingByToken[token] && bindingByToken[token] !== binding) {
        throw new Error(`Config apply failed: conflicting parent binding for wikilink token=[[${token}]], field=${sourceId}, bindings=${bindingByToken[token]} vs ${binding}`);
      }
      bindingByToken[token] = binding;
    };
    for (let ni = 0; ni < mergeEntries.length; ni++) {
      const entry = mergeEntries[ni] && isObj(mergeEntries[ni]) ? mergeEntries[ni] : {};
      const wl = isObj(entry.wl) ? entry.wl : {};
      const sourceSectionName = String(entry.sectionName || "").trim();
      const defs = Array.isArray(wl.defaults) ? wl.defaults : [];
      for (let di = 0; di < defs.length; di++) pushDefault(defs[di]);
      const sourceSectionDef = sourceSectionName && isObj(sectionDefById[sourceSectionName]) ? sectionDefById[sourceSectionName] : null;
      const sourceParentFieldId = sourceSectionDef && sourceSectionDef.fieldId ? String(sourceSectionDef.fieldId || "").trim() : defaultParentFieldId;
      const sourceSectionParents = sourceSectionName && sectionsSrc[sourceSectionName] && Array.isArray(sectionsSrc[sourceSectionName].parents)
        ? sectionsSrc[sourceSectionName].parents
        : [];
      const validParentTokens = new Set(sourceSectionParents.map((x) => denormTagToken(x && x.token || "")).filter(Boolean));
      const validSubTokensByParent = {};
      for (let pi = 0; pi < sourceSectionParents.length; pi++) {
        const pRow = sourceSectionParents[pi] && typeof sourceSectionParents[pi] === "object" ? sourceSectionParents[pi] : null;
        const pTok = denormTagToken(pRow && pRow.token || "");
        if (!pTok) continue;
        const subtags = Array.isArray(pRow.subtags) ? pRow.subtags : [];
        validSubTokensByParent[pTok] = new Set(subtags.map((x) => denormTagToken(x)).filter(Boolean));
      }
      const parentMap = isObj(wl.byParent) ? wl.byParent : {};
      for (const parentToken of Object.keys(parentMap)) {
        const normalizedParent = denormTagToken(parentToken);
        if (!normalizedParent || !validParentTokens.has(normalizedParent)) {
          throw new Error(`Config apply failed: unknown parent token for wikilink field=${sourceId}, parent=${String(parentToken || "").trim()}, section=${sourceSectionName || "<unknown>"}`);
        }
        const node = isObj(parentMap[parentToken]) ? parentMap[parentToken] : {};
        const branch = Array.isArray(node.branch) ? node.branch : [];
        for (let i = 0; i < branch.length; i++) pushAllowed(branch[i], parentToken, sourceParentFieldId, sourceSectionName);
        const leaf = isObj(node.leaf) ? node.leaf : {};
        for (const subToken of Object.keys(leaf)) {
          const normalizedSub = denormTagToken(subToken);
          const validSubs = validSubTokensByParent[normalizedParent] instanceof Set ? validSubTokensByParent[normalizedParent] : new Set();
          if (!normalizedSub || !validSubs.has(normalizedSub)) {
            throw new Error(`Config apply failed: unknown sub token for wikilink field=${sourceId}, parent=${String(parentToken || "").trim()}, sub=${String(subToken || "").trim()}, section=${sourceSectionName || "<unknown>"}`);
          }
          const arr = Array.isArray(leaf[subToken]) ? leaf[subToken] : [];
          for (let i = 0; i < arr.length; i++) {
            pushLeaf(arr[i], parentToken, subToken, sourceParentFieldId, sourceSectionName);
          }
        }
      }
    }
    for (let oi = 0; oi < orphanList.length; oi++) {
      const tok = normalizeWikilinkTokenRaw(orphanList[oi]);
      if (!tok || allowedByToken[tok]) continue;
      tokenOrder.push(tok);
      allowedByToken[tok] = new Set();
    }
    const out = [];
    for (const token of tokenOrder) {
      const meta = isObj(existingMeta[token]) ? cloneJson(existingMeta[token]) : {};
      const allowedParentValues = Array.from(allowedByToken[token]);
      const binding = String(bindingByToken[token] || "").trim();
      if (allowedParentValues.length && !binding) {
        throw new Error(`Config apply failed: missing binding for linked wikilink token=[[${token}]], field=${sourceId}`);
      }
      if (binding) assertCanonicalBinding(binding, token, "finalize");
      const bindingFieldMatch = binding.match(/\|f:([^|]+)$/);
      const parentFieldId = String(bindingFieldMatch ? bindingFieldMatch[1] : "").trim();
      if (allowedParentValues.length && !parentFieldId) {
        throw new Error(`Config apply failed: missing binding field id for wikilink token=[[${token}]], field=${sourceId}, binding=${binding || "<empty>"}`);
      }
      out.push({
        ...meta,
        token,
        allowedParentValues,
        __ioParentBinding: binding,
        __ioParentFieldId: parentFieldId,
        active: typeof meta.active === "boolean" ? meta.active : true,
      });
    }
    return out;
  };

  const resolveDependsOnForWikilinkField = (sourceFieldId, parsedSections) => {
    const sourceId = String(sourceFieldId || "").trim();
    const sectionsSrc = isObj(parsedSections) ? parsedSections : {};
    if (!sourceId) return { hasBindings: false, dependsOn: "" };
    const leafCandidates = new Set();
    const branchCandidates = new Set();
    for (const sectionName of Object.keys(sectionsSrc)) {
      const sec = isObj(sectionsSrc[sectionName]) ? sectionsSrc[sectionName] : null;
      if (!sec) continue;
      const wlRoot = isObj(sec.wikilinks) ? sec.wikilinks : {};
      const wl = isObj(wlRoot[sourceId]) ? wlRoot[sourceId] : null;
      if (!wl) continue;
      const def = isObj(sectionDefById[sectionName]) ? sectionDefById[sectionName] : null;
      if (!def) {
        throw new Error(`Config apply failed: cannot resolve section definition for wikilink field=${sourceId}, section=${sectionName}`);
      }
      const parentMap = isObj(wl.byParent) ? wl.byParent : {};
      for (const parentToken of Object.keys(parentMap)) {
        const node = isObj(parentMap[parentToken]) ? parentMap[parentToken] : {};
        const branch = Array.isArray(node.branch) ? node.branch : [];
        if (branch.some((x) => String(x || "").trim())) {
          const parentFieldId = String(def.fieldId || "").trim();
          if (!parentFieldId) {
            throw new Error(`Config apply failed: cannot resolve parent field for wikilink field=${sourceId}, section=${sectionName}`);
          }
          branchCandidates.add(parentFieldId);
        }
        const leaf = isObj(node.leaf) ? node.leaf : {};
        for (const subToken of Object.keys(leaf)) {
          const arr = Array.isArray(leaf[subToken]) ? leaf[subToken] : [];
          if (!arr.some((x) => String(x || "").trim())) continue;
          const subFieldId = String(def.subFieldId || "").trim();
          if (!subFieldId) {
            throw new Error(`Config apply failed: cannot resolve sub field for wikilink field=${sourceId}, section=${sectionName}`);
          }
          leafCandidates.add(subFieldId);
        }
      }
    }
    if (!leafCandidates.size && !branchCandidates.size) return { hasBindings: false, dependsOn: "" };
    if (leafCandidates.size > 1) {
      throw new Error(`Config apply failed: ambiguous sub-field dependsOn for wikilink field=${sourceId}, candidates=${Array.from(leafCandidates).join(",")}`);
    }
    if (branchCandidates.size > 1) {
      throw new Error(`Config apply failed: ambiguous parent-field dependsOn for wikilink field=${sourceId}, candidates=${Array.from(branchCandidates).join(",")}`);
    }
    if (leafCandidates.size === 1) return { hasBindings: true, dependsOn: Array.from(leafCandidates)[0] };
    return { hasBindings: true, dependsOn: Array.from(branchCandidates)[0] };
  };

  for (let i = 0; i < allModeFields.length; i++) {
    const field = allModeFields[i];
    if (!isObj(field) || !field.id) continue;
    const source = String(field.source || "").trim();
    if (!isWikilinkSourceFieldSafe(field)) continue;
    const sourceFieldId = source.indexOf("wikilinks:") !== 0
      ? String(field.id || "").trim()
      : String(source.slice("wikilinks:".length) || "").trim();
    if (!sourceFieldId) continue;
    const depRes = resolveDependsOnForWikilinkField(sourceFieldId, parsed.sections);
    if (depRes && depRes.hasBindings) {
      field.dependsOn = String(depRes.dependsOn || "").trim();
    }
    field.values = buildWikilinkFieldValues(field, sourceFieldId, parsed.sections, parsed.orphanWikilinks);
    {
      const rows = Array.isArray(field.values) ? field.values : [];
      const isPlaceholderOnly = rows.length === 1 && String(rows[0] || "").trim() === "";
      const isEmpty = rows.length === 0 || isPlaceholderOnly;
      const orphanList = isObj(parsed.orphanWikilinks) && Array.isArray(parsed.orphanWikilinks[sourceFieldId])
        ? parsed.orphanWikilinks[sourceFieldId]
        : [];
      if (isEmpty && orphanList.length) {
        const seen = new Set();
        const out = [];
        for (let oi = 0; oi < orphanList.length; oi++) {
          const rawTok = String(orphanList[oi] || "").trim();
          if (!rawTok) continue;
          const m = rawTok.match(/^\[\[([^\]]+)\]\]$/);
          const token = String(m ? m[1] : rawTok).trim();
          if (!token || seen.has(token)) continue;
          seen.add(token);
          out.push({
            token,
            __ioParentBinding: "",
            __ioParentFieldId: "",
            active: true,
          });
        }
        if (out.length) field.values = out;
      }
    }
  }

  const wikilinkTaxonomy = {};
  const fields = parsed.wikilinkFields;
  for (let i = 0; i < fields.length; i++) {
    wikilinkTaxonomy[fields[i]] = { bySection: {} };
  }
  for (const sectionName of Object.keys(parsed.sections)) {
    const sec = parsed.sections[sectionName];
    const wl = isObj(sec.wikilinks) ? sec.wikilinks : {};
    for (const fieldId of Object.keys(wl)) {
      if (!isObj(wikilinkTaxonomy[fieldId])) wikilinkTaxonomy[fieldId] = { bySection: {} };
      wikilinkTaxonomy[fieldId].bySection[sectionName] = wl[fieldId];
    }
  }
  const activeWikilinkFieldIds = new Set();
  for (let i = 0; i < allModeFields.length; i++) {
    const f = allModeFields[i];
    if (!isObj(f) || !f.id) continue;
    const source = String(f.source || "").trim();
    if (!isWikilinkSourceFieldSafe(f)) continue;
    const sourceFieldId = source.indexOf("wikilinks:") !== 0
      ? String(f.id || "").trim()
      : String(source.slice("wikilinks:".length) || "").trim();
    if (!sourceFieldId) continue;
    activeWikilinkFieldIds.add(sourceFieldId);
  }

  const orphanWikilinks = {};
  if (isObj(parsed.orphanWikilinks)) {
    for (const fieldId of Object.keys(parsed.orphanWikilinks)) {
      const fid = String(fieldId || "").trim();
      if (!fid || !activeWikilinkFieldIds.has(fid)) continue;
      const list = Array.isArray(parsed.orphanWikilinks[fieldId])
        ? parsed.orphanWikilinks[fieldId].map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      if (!list.length) continue;
      orphanWikilinks[fid] = list;
    }
  }

  const prevProjectsCfg = isObj(behaviorCfg.projects)
    ? behaviorCfg.projects
    : {};
  const projectsCfg = {
    output: String(prevProjectsCfg.output || "wikilink").trim() || "wikilink",
    filterKeys: [],
    includeDefaultsWhenFiltered: prevProjectsCfg.includeDefaultsWhenFiltered === true,
    defaults: [],
    byContext: {},
    items: [],
    rules: [],
    catalog: [],
  };
  let projectsFieldId = "";
  for (let i = 0; i < allModeFields.length; i++) {
    const f = allModeFields[i];
    if (!f || !f.id) continue;
    if (String(f.source || "").trim() !== "projects") continue;
    projectsFieldId = String(f.id || "").trim();
    if (projectsFieldId) break;
  }
  if (projectsFieldId) {
    const defaultsOut = [];
    const defaultsSeen = new Set();
    const projectFilterKeys = [];
    const parsedScopeKeys = [];
    const byFieldId = {};
    for (let i = 0; i < allModeFields.length; i++) {
      const f = allModeFields[i];
      const fid = String(f && f.id || "").trim();
      if (!fid) continue;
      byFieldId[fid] = f;
    }
    const pushFilterKey = (key) => {
      const k = String(key || "").trim();
      if (!k) return;
      if (projectFilterKeys.includes(k)) return;
      projectFilterKeys.push(k);
    };
    const projectField = byFieldId[projectsFieldId] || null;
    let depCursor = String(projectField && projectField.dependsOn || "").trim();
    const depSeen = new Set();
    const depChain = [];
    while (depCursor && !depSeen.has(depCursor)) {
      depSeen.add(depCursor);
      depChain.unshift(depCursor);
      const depField = byFieldId[depCursor] || null;
      depCursor = String(depField && depField.dependsOn || "").trim();
    }
    for (let i = 0; i < depChain.length; i++) pushFilterKey(depChain[i]);
    const nextByContext = {};
    const pushUnique = (arr, value) => {
      const v = String(value || "").trim();
      if (!v) return;
      if (arr.includes(v)) return;
      arr.push(v);
    };
    const mergeProjectCfg = (projectCfg) => {
      const defs = Array.isArray(projectCfg && projectCfg.defaults) ? projectCfg.defaults : [];
      for (let i = 0; i < defs.length; i++) {
        const v = String(defs[i] || "").trim();
        if (!v || defaultsSeen.has(v)) continue;
        defaultsSeen.add(v);
        defaultsOut.push(v);
      }
      const byParent = isObj(projectCfg && projectCfg.byParent) ? projectCfg.byParent : {};
      for (const parentToken of Object.keys(byParent)) {
        const parentKey = denormTagToken(parentToken);
        if (!parentKey) continue;
        const src = byParent[parentToken];
        if (!isObj(nextByContext[parentKey])) nextByContext[parentKey] = { branch: [], leaf: {} };
        const dst = nextByContext[parentKey];
        const branch = Array.isArray(src && src.branch) ? src.branch : [];
        for (let i = 0; i < branch.length; i++) pushUnique(dst.branch, branch[i]);
        const leaf = isObj(src && src.leaf) ? src.leaf : {};
        for (const subToken of Object.keys(leaf)) {
          const subKey = denormTagToken(subToken);
          if (!subKey) continue;
          if (!Array.isArray(dst.leaf[subKey])) dst.leaf[subKey] = [];
          const vals = Array.isArray(leaf[subToken]) ? leaf[subToken] : [];
          for (let i = 0; i < vals.length; i++) pushUnique(dst.leaf[subKey], vals[i]);
        }
      }
    };
    for (const sectionName of Object.keys(parsed.sections || {})) {
      const sec = parsed.sections[sectionName];
      if (!isObj(sec) || !isObj(sec.wikilinks) || !isObj(sec.wikilinks[projectsFieldId])) continue;
      const secDef = sectionDefById[sectionName];
      const secWl = sec.wikilinks[projectsFieldId];
      const byParent = isObj(secWl && secWl.byParent) ? secWl.byParent : {};
      let hasLeafRows = false;
      for (const parentToken of Object.keys(byParent)) {
        const node = isObj(byParent[parentToken]) ? byParent[parentToken] : {};
        const leaf = isObj(node.leaf) ? node.leaf : {};
        if (Object.keys(leaf).length) {
          hasLeafRows = true;
          break;
        }
      }
      if (isObj(secDef)) {
        const parentKey = String(secDef.fieldId || "").trim();
        if (parentKey && !parsedScopeKeys.includes(parentKey)) parsedScopeKeys.push(parentKey);
        if (hasLeafRows) {
          const childKey = String(secDef.subFieldId || "").trim();
          if (childKey && !parsedScopeKeys.includes(childKey)) parsedScopeKeys.push(childKey);
        }
      }
      mergeProjectCfg(sec.wikilinks[projectsFieldId]);
    }
    if (parsedScopeKeys.length) projectsCfg.filterKeys = parsedScopeKeys.slice();
    else if (projectFilterKeys.length) projectsCfg.filterKeys = projectFilterKeys.slice();
    else projectsCfg.filterKeys = [];
    projectsCfg.defaults = defaultsOut;
    projectsCfg.byContext = nextByContext;
  }
  behaviorCfg.projects = projectsCfg;

  const existingPrefixRules = getPrefixRulesFromCfg(cfg);
  const sectionById = {};
  for (let i = 0; i < sectionDefs.length; i++) sectionById[sectionDefs[i].sectionId] = sectionDefs[i];
  const resolvedFieldsOrderMode = parsed.prefixResolver && parsed.prefixResolver.fieldsOrderMode
    ? parsed.prefixResolver.fieldsOrderMode
    : (existingPrefixRules.fieldsOrderMode || "manual");
  const secOrder = resolvedFieldsOrderMode === "auto"
    ? sectionDefs.map((x) => x.sectionId)
    : (parsed.prefixResolver && Array.isArray(parsed.prefixResolver.sectionOrder)
        ? parsed.prefixResolver.sectionOrder
        : sectionDefs.map((x) => x.sectionId));
  const secOrderRaw = parsed.prefixResolver && Array.isArray(parsed.prefixResolver.sectionOrderRaw)
    ? parsed.prefixResolver.sectionOrderRaw.map((x) => String(x || "").trim()).filter(Boolean)
    : secOrder.slice();
  const prefixPriorityTargets = [];
  const pushTarget = (fid) => {
    const v = String(fid || "").trim();
    if (!v) return;
    if (!prefixPriorityTargets.includes(v)) prefixPriorityTargets.push(v);
  };
  for (let i = 0; i < secOrder.length; i++) {
    const def = sectionById[secOrder[i]];
    if (!def) continue;
    pushTarget(def.fieldId);
    if (def.subFieldId) pushTarget(def.subFieldId);
  }
  for (let i = 0; i < sectionDefs.length; i++) {
    pushTarget(sectionDefs[i].fieldId);
    if (sectionDefs[i].subFieldId) pushTarget(sectionDefs[i].subFieldId);
  }
  const fieldToSection = {};
  for (let i = 0; i < sectionDefs.length; i++) {
    fieldToSection[sectionDefs[i].fieldId] = sectionDefs[i].sectionId;
    if (sectionDefs[i].subFieldId) fieldToSection[sectionDefs[i].subFieldId] = sectionDefs[i].sectionId;
  }
  const effectiveSectionOrder = [];
  for (let i = 0; i < prefixPriorityTargets.length; i++) {
    const sid = fieldToSection[prefixPriorityTargets[i]];
    if (!sid) continue;
    if (!effectiveSectionOrder.includes(sid)) effectiveSectionOrder.push(sid);
  }
  const nextBehavior = {};
  const rawCheckboxByFieldValue = isObj(parsed.checkboxByFieldValue) ? parsed.checkboxByFieldValue : {};
  const normalizeCheckbox = (token) => {
    try {
      const lf = require("../core/pkm_line_finalize_unified.js");
      if (lf && typeof lf.normalizeCheckboxToken === "function") return lf.normalizeCheckboxToken(token);
    } catch (_) {}
    return String(token || "").trim();
  };
  const checkboxByFieldValue = {};
  for (const fid of Object.keys(rawCheckboxByFieldValue)) {
    if (!isObj(rawCheckboxByFieldValue[fid])) continue;
    checkboxByFieldValue[fid] = {};
    for (const tok of Object.keys(rawCheckboxByFieldValue[fid])) {
      const cbNorm = normalizeCheckbox(rawCheckboxByFieldValue[fid][tok]);
      if (!cbNorm) continue;
      checkboxByFieldValue[fid][tok] = cbNorm;
    }
  }
  const discoveredCheckboxes = collectCheckboxTokensFromMap(checkboxByFieldValue);
  const baseCheckboxOrder = parsed.prefixResolver && Array.isArray(parsed.prefixResolver.checkboxOrder)
    ? parsed.prefixResolver.checkboxOrder.slice()
    : (Array.isArray(existingPrefixRules.priorityCheckboxes) ? existingPrefixRules.priorityCheckboxes.slice() : []);
  const mergedCheckboxOrder = Array.from(new Set(baseCheckboxOrder.concat(discoveredCheckboxes).map((x) => normalizeCheckbox(x)).filter(Boolean)));
  nextBehavior.prefixRules = {
    resolver: String(existingPrefixRules.resolver || "priority-first"),
    priorityMode: String(parsed.prefixResolver && parsed.prefixResolver.mode ? parsed.prefixResolver.mode : (existingPrefixRules.priorityMode || "by-section")),
    fieldsOrderMode: String(parsed.prefixResolver && parsed.prefixResolver.fieldsOrderMode ? parsed.prefixResolver.fieldsOrderMode : (existingPrefixRules.fieldsOrderMode || "manual")),
    tagSubtagPriority: String(parsed.prefixResolver && parsed.prefixResolver.tagSubtagPriority ? parsed.prefixResolver.tagSubtagPriority : (existingPrefixRules.tagSubtagPriority || "subtag-over-tag")),
    priorityTargets: prefixPriorityTargets,
    priorityCheckboxes: mergedCheckboxOrder,
    checkboxByFieldValue,
  };
  const pickTypeFieldId = () => {
    const existingTypeMap = isObj(behaviorCfg.typeCheckboxByValue) ? behaviorCfg.typeCheckboxByValue : {};
    const existingTokens = Object.keys(existingTypeMap).map((x) => String(x || "").trim()).filter(Boolean);
    let bestFieldId = "";
    let bestScore = -1;
    const candidateIds = [];
    for (let i = 0; i < sectionDefs.length; i++) {
      const fid = String(sectionDefs[i] && sectionDefs[i].fieldId || "").trim();
      if (!fid) continue;
      candidateIds.push(fid);
    }
    const ids = candidateIds.length ? candidateIds : Object.keys(checkboxByFieldValue || {});
    for (let i = 0; i < ids.length; i++) {
      const fid = String(ids[i] || "").trim();
      if (!fid) continue;
      const cmap = isObj(checkboxByFieldValue[fid]) ? checkboxByFieldValue[fid] : {};
      const tokens = Object.keys(cmap).map((x) => String(x || "").trim()).filter(Boolean);
      if (!tokens.length) continue;
      let score = tokens.length;
      if (existingTokens.length) {
        score = 0;
        for (let ti = 0; ti < tokens.length; ti++) {
          if (existingTokens.includes(tokens[ti])) score += 10;
          else score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestFieldId = fid;
      }
    }
    return bestFieldId;
  };
  const typeFieldId = pickTypeFieldId();
  const typeMap = isObj(checkboxByFieldValue[typeFieldId]) ? checkboxByFieldValue[typeFieldId] : {};
  nextBehavior.typeCheckboxByValue = cloneJson(typeMap);

  const parsedElementsForPatch = cloneJson(parsed.elementsConfig || {});
  if (!isObj(parsedElementsForPatch.byField)) parsedElementsForPatch.byField = {};
  parsedElementsForPatch.byField = sanitizeElementsByFieldFromConfigNote(parsedElementsForPatch.byField, isObj);
  const parsedDatesForPatch = cloneJson(parsed.datesConfig || {});
  if (!isObj(parsedDatesForPatch.byField)) parsedDatesForPatch.byField = {};
  parsedDatesForPatch.byField = sanitizeDatesByFieldFromConfigNote(parsedDatesForPatch.byField, isObj);
  for (const fid of Object.keys(parsedDatesForPatch.byField)) {
    const id = String(fid || "").trim();
    if (!id) continue;
    const src = isObj(parsedDatesForPatch.byField[id]) ? parsedDatesForPatch.byField[id] : {};
    const dst = isObj(parsedElementsForPatch.byField[id]) ? parsedElementsForPatch.byField[id] : {};
    const merged = {
      ...src,
      ...dst,
      increment: {
        ...(isObj(src.increment) ? src.increment : {}),
        ...(isObj(dst.increment) ? dst.increment : {}),
      },
    };
    if (!String(merged.emoji || "").trim() && String(src.emoji || "").trim()) merged.emoji = String(src.emoji || "").trim();
    if (!String(merged.format || "").trim() && String(src.format || "").trim()) merged.format = String(src.format || "").trim();
    parsedElementsForPatch.byField[id] = merged;
  }
  const dateFields = Array.isArray(parsedDatesForPatch.fields) ? parsedDatesForPatch.fields.map((x) => String(x || "").trim()).filter(Boolean) : [];
  parsedElementsForPatch.fields = Array.from(new Set((Array.isArray(parsedElementsForPatch.fields) ? parsedElementsForPatch.fields : []).concat(dateFields).map((x) => String(x || "").trim()).filter(Boolean)));

  const ensureElementOrderField = (fieldId) => {
    const fid = String(fieldId || "").trim();
    if (!fid) return;
    const existing = getFieldAcrossModes(fid);
    const elemMeta = isObj(parsedElementsForPatch.byField[fid]) ? parsedElementsForPatch.byField[fid] : {};
    const marker = String(elemMeta.emoji || "").trim();
    if (existing) {
      existing.kind = "genericElement";
      if (!String(existing.marker || "").trim() && marker) existing.marker = marker;
      if (!String(existing.placeholder || "").trim()) existing.placeholder = fid;
      if (!Array.isArray(existing.values)) existing.values = [""];
    } else {
      rightMode.fields.push({
        id: fid,
        kind: "genericElement",
        marker,
        placeholder: fid,
        values: [""],
      });
      refreshAllModeFields();
    }
    if (!Array.isArray(behaviorCfg.order.right)) behaviorCfg.order.right = [];
    if (!behaviorCfg.order.right.includes(fid)) behaviorCfg.order.right.push(fid);
    if (!isObj(behaviorCfg.order.strictNames)) behaviorCfg.order.strictNames = {};
    if (!String(behaviorCfg.order.strictNames[fid] || "").trim()) behaviorCfg.order.strictNames[fid] = fid;
    if (!isObj(behaviorCfg.order.types)) behaviorCfg.order.types = {};
    behaviorCfg.order.types[fid] = "element";
    if (!isObj(behaviorCfg.order.active)) behaviorCfg.order.active = {};
    if (!String(behaviorCfg.order.active[fid] || "").trim()) behaviorCfg.order.active[fid] = "yes";
    if (!isObj(behaviorCfg.order.enabled)) behaviorCfg.order.enabled = {};
    if (typeof behaviorCfg.order.enabled[fid] !== "boolean") behaviorCfg.order.enabled[fid] = true;
  };
  const elementIdsFromConfig = Array.from(new Set(
    (Array.isArray(parsedElementsForPatch.fields) ? parsedElementsForPatch.fields : [])
      .concat(Object.keys(parsedElementsForPatch.byField || {}))
      .map((x) => String(x || "").trim())
      .filter(Boolean)
  ));

  const currentElementIds = Array.from(new Set(
    Object.keys(isObj(behaviorCfg.order && behaviorCfg.order.types) ? behaviorCfg.order.types : {})
      .map((x) => String(x || "").trim())
      .filter((id) => id && String(behaviorCfg.order.types[id] || "").trim().toLowerCase() === "element")
  ));
  const elementIdsSet = new Set(elementIdsFromConfig);
  const removedElementIds = currentElementIds.filter((id) => !elementIdsSet.has(id));
  if (removedElementIds.length) {
    const removedSet = new Set(removedElementIds);
    rightMode.fields = (Array.isArray(rightMode.fields) ? rightMode.fields : []).filter((f) => {
      const fid = String(f && f.id || "").trim();
      return !removedSet.has(fid);
    });
    if (Array.isArray(behaviorCfg.order.right)) {
      behaviorCfg.order.right = behaviorCfg.order.right.filter((k) => !removedSet.has(String(k || "").trim()));
    }
    const cleanOrderMap = (obj) => {
      const src = isObj(obj) ? obj : {};
      const out = {};
      for (const key of Object.keys(src)) {
        const id = String(key || "").trim();
        if (removedSet.has(id)) continue;
        out[id] = src[key];
      }
      return out;
    };
    behaviorCfg.order.types = cleanOrderMap(behaviorCfg.order.types);
    behaviorCfg.order.strictNames = cleanOrderMap(behaviorCfg.order.strictNames);
    behaviorCfg.order.labels = cleanOrderMap(behaviorCfg.order.labels);
    behaviorCfg.order.active = cleanOrderMap(behaviorCfg.order.active);
    behaviorCfg.order.enabled = cleanOrderMap(behaviorCfg.order.enabled);
    behaviorCfg.order.freeRoam = cleanOrderMap(behaviorCfg.order.freeRoam);
    behaviorCfg.order.propertiesByField = cleanOrderMap(behaviorCfg.order.propertiesByField);
    parsedElementsForPatch.fields = (Array.isArray(parsedElementsForPatch.fields) ? parsedElementsForPatch.fields : [])
      .map((x) => String(x || "").trim())
      .filter((id) => id && !removedSet.has(id));
    const nextElementsByField = {};
    for (const key of Object.keys(isObj(parsedElementsForPatch.byField) ? parsedElementsForPatch.byField : {})) {
      const id = String(key || "").trim();
      if (!id || removedSet.has(id)) continue;
      nextElementsByField[id] = parsedElementsForPatch.byField[key];
    }
    parsedElementsForPatch.byField = nextElementsByField;
    parsedDatesForPatch.fields = (Array.isArray(parsedDatesForPatch.fields) ? parsedDatesForPatch.fields : [])
      .map((x) => String(x || "").trim())
      .filter((id) => id && !removedSet.has(id));
    if (isObj(parsedDatesForPatch.byField)) {
      for (const rid of removedSet.values()) delete parsedDatesForPatch.byField[rid];
    }
    refreshAllModeFields();
  }
  for (let i = 0; i < elementIdsFromConfig.length; i++) ensureElementOrderField(elementIdsFromConfig[i]);
  for (let i = 0; i < elementIdsFromConfig.length; i++) {
    const eid = String(elementIdsFromConfig[i] || "").trim();
    if (!eid) continue;
    const row = isObj(parsedElementsForPatch.byField && parsedElementsForPatch.byField[eid])
      ? parsedElementsForPatch.byField[eid]
      : {};
    const yaml = String(row.yamlProperty || "").trim();
    if (yaml) behaviorCfg.order.propertiesByField[eid] = yaml;
    else delete behaviorCfg.order.propertiesByField[eid];
  }

  const tmpCfgForScope = cloneJson(cfg) || cfg;
  if (!isObj(tmpCfgForScope.pkm)) tmpCfgForScope.pkm = {};
  if (!isObj(tmpCfgForScope.pkm.behavior)) tmpCfgForScope.pkm.behavior = {};
  tmpCfgForScope.pkm.behavior.elements = cloneJson(parsedElementsForPatch);
  filterBehaviorDateElementConfigs(tmpCfgForScope, resolveOrderFieldScopes(tmpCfgForScope, normalizePkmOrder, isObj), isObj);
  const cleanedElementsForPatch = cloneJson(tmpCfgForScope.pkm.behavior.elements || parsedElementsForPatch);

  const patch = {
    pkm: {
      tagWheelConfigPath: notePath,
      behavior: {
        order: cloneJson(behaviorCfg.order || {}),
        prefixRules: cloneJson(nextBehavior.prefixRules),
        typeCheckboxByValue: cloneJson(nextBehavior.typeCheckboxByValue),
        elements: cloneJson(cleanedElementsForPatch),
        leftMode: cloneJson(leftMode),
        rightMode: cloneJson(rightMode),
        projects: cloneJson(projectsCfg),
        tagVisuals: {
          byTag: cloneJson(parsed.tagVisuals && parsed.tagVisuals.byTag ? parsed.tagVisuals.byTag : {}),
          userTags: cloneJson(parsed.tagVisuals && parsed.tagVisuals.userTags ? parsed.tagVisuals.userTags : {}),
        },
      },
      taxonomy: {
        tagWheelConfig: {
          sourcePath: notePath,
          updatedAt: new Date().toISOString(),
          wikilinkFields: parsed.wikilinkFields.slice(),
          wikilinks: wikilinkTaxonomy,
          orphanWikilinks,
          prefixResolver: {
            fieldsOrderRaw: secOrderRaw,
          },
          elements: cloneJson(cleanedElementsForPatch),
        },
      },
    },
  };

  store.update((prev) => {
    const normalizeHexColor = (value) => {
      const src = String(value || "").trim().toLowerCase();
      return /^#[0-9a-f]{6}$/.test(src) ? src : "";
    };
    const normalizeVisibility = (value) => {
      const src = String(value || "").trim().toLowerCase();
      return src === "empty" || src === "custom" || src === "default" ? src : "default";
    };
    const mergeByTagVisualsPreserveVisibility = (existingByTag, parsedByTag) => {
      const out = {};
      const existing = isObj(existingByTag) ? existingByTag : {};
      const parsedMap = isObj(parsedByTag) ? parsedByTag : {};
      for (const fid of Object.keys(parsedMap)) {
        const fieldId = String(fid || "").trim();
        if (!fieldId) continue;
        const parsedField = isObj(parsedMap[fid]) ? parsedMap[fid] : {};
        const existingField = isObj(existing[fieldId]) ? existing[fieldId] : {};
        const fieldOut = {};
        for (const tok of Object.keys(parsedField)) {
          const token = String(tok || "").trim();
          if (!token) continue;
          const parsedRow = isObj(parsedField[tok]) ? parsedField[tok] : {};
          const existingRow = isObj(existingField[token]) ? existingField[token] : null;
          const parsedFill = normalizeHexColor(parsedRow.fillColor);
          const parsedText = normalizeHexColor(parsedRow.textColor);
          const rowOut = {
            fillColor: parsedFill,
            textColor: parsedText,
            customText: String(parsedRow.customText || "").trim(),
            visibility: existingRow
              ? normalizeVisibility(existingRow.visibility)
              : normalizeVisibility(parsedRow.visibility),
          };
          fieldOut[token] = rowOut;
        }
        out[fieldId] = fieldOut;
      }
      return out;
    };
    const mergeUserTagVisualsPreserveVisibility = (existingUserTags, parsedUserTags) => {
      const out = {};
      const existing = isObj(existingUserTags) ? existingUserTags : {};
      const parsedMap = isObj(parsedUserTags) ? parsedUserTags : {};
      for (const tok of Object.keys(parsedMap)) {
        const token = String(tok || "").trim();
        if (!token) continue;
        const parsedRow = isObj(parsedMap[tok]) ? parsedMap[tok] : {};
        const existingRow = isObj(existing[token]) ? existing[token] : null;
        const parsedFill = normalizeHexColor(parsedRow.fillColor);
        const parsedText = normalizeHexColor(parsedRow.textColor);
        out[token] = {
          fillColor: parsedFill,
          textColor: parsedText,
          customText: String(parsedRow.customText || "").trim(),
          visibility: existingRow
            ? normalizeVisibility(existingRow.visibility)
            : normalizeVisibility(parsedRow.visibility),
        };
      }
      return out;
    };
    const next = deepMerge(prev, patch);
    if (!isObj(next.pkm)) next.pkm = {};
    if (!isObj(next.pkm.behavior)) next.pkm.behavior = {};
    next.pkm.behavior.order = cloneJson(behaviorCfg.order || {});
    next.pkm.behavior.leftMode = cloneJson(leftMode);
    next.pkm.behavior.rightMode = cloneJson(rightMode);
    next.pkm.behavior.projects = cloneJson(projectsCfg);
    next.pkm.behavior.elements = cloneJson(cleanedElementsForPatch);
    if (!isObj(next.pkm.behavior.tagVisuals)) next.pkm.behavior.tagVisuals = {};
    next.pkm.behavior.tagVisuals.byTag = mergeByTagVisualsPreserveVisibility(
      prev && prev.pkm && prev.pkm.behavior && prev.pkm.behavior.tagVisuals ? prev.pkm.behavior.tagVisuals.byTag : {},
      parsed.tagVisuals && parsed.tagVisuals.byTag ? parsed.tagVisuals.byTag : {}
    );
    next.pkm.behavior.tagVisuals.userTags = mergeUserTagVisualsPreserveVisibility(
      prev && prev.pkm && prev.pkm.behavior && prev.pkm.behavior.tagVisuals ? prev.pkm.behavior.tagVisuals.userTags : {},
      parsed.tagVisuals && parsed.tagVisuals.userTags ? parsed.tagVisuals.userTags : {}
    );
    if (!isObj(next.pkm.taxonomy)) next.pkm.taxonomy = {};
    if (!isObj(next.pkm.taxonomy.tagWheelConfig)) next.pkm.taxonomy.tagWheelConfig = {};
    next.pkm.taxonomy.tagWheelConfig.wikilinkFields = parsed.wikilinkFields.slice();
    next.pkm.taxonomy.tagWheelConfig.wikilinks = cloneJson(wikilinkTaxonomy);
    next.pkm.taxonomy.tagWheelConfig.orphanWikilinks = cloneJson(orphanWikilinks);
    next.pkm.taxonomy.tagWheelConfig.prefixResolver = { fieldsOrderRaw: secOrderRaw.slice() };
    next.pkm.taxonomy.tagWheelConfig.elements = cloneJson(cleanedElementsForPatch);
    {
      const behavior = isObj(next.pkm.behavior) ? next.pkm.behavior : {};
      if (!isObj(behavior.leftMode)) behavior.leftMode = { fields: [] };
      if (!Array.isArray(behavior.leftMode.fields)) behavior.leftMode.fields = [];
      if (!isObj(behavior.rightMode)) behavior.rightMode = { fields: [] };
      if (!Array.isArray(behavior.rightMode.fields)) behavior.rightMode.fields = [];
      const order = isObj(behavior.order) ? behavior.order : {};
      const rightSet = new Set((Array.isArray(order.right) ? order.right : []).map((x) => String(x || "").trim()).filter(Boolean));
      const findIdx = (arr, fieldId) => {
        const id = String(fieldId || "").trim();
        const list = Array.isArray(arr) ? arr : [];
        for (let i = 0; i < list.length; i++) {
          if (String(list[i] && list[i].id || "").trim() === id) return i;
        }
        return -1;
      };
      for (const fieldId of rightSet.values()) {
        const id = String(fieldId || "").trim();
        if (!id) continue;
        const li = findIdx(behavior.leftMode.fields, id);
        if (li !== -1) {
          const lf = behavior.leftMode.fields[li];
          if (isWikilinkSourceFieldSafe(lf)) {
            if (findIdx(behavior.rightMode.fields, id) === -1) behavior.rightMode.fields.push(lf);
            behavior.leftMode.fields.splice(li, 1);
          }
        }
        const ri = findIdx(behavior.rightMode.fields, id);
        if (ri === -1) continue;
        const rf = behavior.rightMode.fields[ri];
        if (!isWikilinkSourceFieldSafe(rf)) continue;
        const rows = Array.isArray(rf.values) ? rf.values : [];
        const isPlaceholderOnly = rows.length === 1 && String(rows[0] || "").trim() === "";
        const isEmpty = rows.length === 0 || isPlaceholderOnly;
        const orphanList = isObj(next.pkm.taxonomy && next.pkm.taxonomy.tagWheelConfig && next.pkm.taxonomy.tagWheelConfig.orphanWikilinks)
          && Array.isArray(next.pkm.taxonomy.tagWheelConfig.orphanWikilinks[id])
          ? next.pkm.taxonomy.tagWheelConfig.orphanWikilinks[id]
          : [];
        if (!isEmpty || !orphanList.length) continue;
        const seen = new Set();
        const out = [];
        for (let oi = 0; oi < orphanList.length; oi++) {
          const rawTok = String(orphanList[oi] || "").trim();
          if (!rawTok) continue;
          const m = rawTok.match(/^\[\[([^\]]+)\]\]$/);
          const token = String(m ? m[1] : rawTok).trim();
          if (!token || seen.has(token)) continue;
          seen.add(token);
          out.push({ token, __ioParentBinding: "", __ioParentFieldId: "", active: true });
        }
        if (out.length) rf.values = out;
      }
      next.pkm.behavior = behavior;
    }
    if (!isObj(next.backups)) next.backups = {};
    if (!Array.isArray(next.backups.tagWheelConfigApplies)) next.backups.tagWheelConfigApplies = [];
    next.backups.tagWheelConfigApplies.push({
      at: new Date().toISOString(),
      sourcePath: notePath,
    });
    if (next.backups.tagWheelConfigApplies.length > 10) next.backups.tagWheelConfigApplies.shift();
    return next;
  }, "pkm:tagwheel-config:apply");

  try {
    const syncedMd = syncCustomPrefixResolverBlock(
      md,
      effectiveSectionOrder.length ? effectiveSectionOrder : sectionDefs.map((x) => x.sectionId),
      mergedCheckboxOrder,
      parsed.prefixResolver && parsed.prefixResolver.mode ? parsed.prefixResolver.mode : "by-section",
      parsed.prefixResolver && parsed.prefixResolver.fieldsOrderMode ? parsed.prefixResolver.fieldsOrderMode : "manual",
      parsed.prefixResolver && parsed.prefixResolver.tagSubtagPriority ? parsed.prefixResolver.tagSubtagPriority : "subtag-over-tag"
    );
    if (syncedMd !== md) {
      const af = app.vault.getAbstractFileByPath(notePath);
      if (af) await app.vault.modify(af, syncedMd);
    }
  } catch (e) {
    console.warn("[inline-overhaul][tagwheel-prefix-sync]", e);
  }
}

async function renameStrictNameInConfigNote(ctx, oldName, newName) {
  const { app, cfg, tagWheelConfigCodec } = ctx;
  const codec = tagWheelConfigCodec || {};
  const normalizeTagWheelConfigPath = typeof codec.normalizeTagWheelConfigPath === "function"
    ? codec.normalizeTagWheelConfigPath
    : ctx.normalizeTagWheelConfigPath;
  const from = String(oldName || "").trim();
  const to = String(newName || "").trim();
  if (!from || !to || from === to) return;
  const notePath = normalizeTagWheelConfigPath(cfg && cfg.pkm ? cfg.pkm.tagWheelConfigPath : "");
  const file = app.vault.getAbstractFileByPath(notePath);
  if (!file) return;
  const src = await app.vault.read(file);
  let out = String(src || "");
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fromEsc = esc(from);
  out = out.replace(new RegExp(`(^|\\n)(\\s*#{4,5}\\s+)${fromEsc}(\\s*(?:\\n|$))`, "g"), `$1$2${to}$3`);
  out = out.replace(new RegExp(`(^|\\n)(\\s*[-*]\\s+)${fromEsc}(\\s*(?:\\n|$))`, "g"), `$1$2${to}$3`);
  if (out !== src) await app.vault.modify(file, out);
}

module.exports = {
  openTagWheelConfigNote,
  openTagWheelConfigTemplateNote,
  applyTagWheelConfigNote,
  renameStrictNameInConfigNote,
};
