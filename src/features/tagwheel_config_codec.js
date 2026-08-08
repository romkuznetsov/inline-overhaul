"use strict";

function createTagWheelConfigCodec(opts) {
  const {
    isObj,
    getOrderStrictName,
    getFieldById,
    getLeftFields,
    getRightFields,
    collectTagSections,
    collectWikilinkFieldIds,
    collectOrderedElementFields,
    getPrefixRulesFromCfg,
    denormTagToken,
    parseCustomPrefixResolverBlock,
    isWikilinkToken,
    parseWikilinkLineStrict,
    extractFirstTagToken,
    parseCheckboxAndTag,
    createTagWheelConfigParser,
    TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH,
    TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH,
    TAGWHEEL_TECHNICAL_BLOCK_MARKER,
    TAGWHEEL_TECH_MARKER_PREFIX,
    TAGWHEEL_IMPORTANT_LINE,
    CFG_H1_SETTINGS,
    CFG_H2_TAGS,
    CFG_H2_DATES,
    CFG_H2_ELEMENTS,
    CFG_H2_ELEMENTS_COMBINED,
    TAGWHEEL_PREFIX_RESOLVER_H3,
    TAGWHEEL_PREFIX_RESOLVER_SECTION,
    TAGWHEEL_WIKILINK_SECTION,
  } = opts || {};

  let __configParser = null;

  function normalizeTagWheelConfigPath() {
    return String(TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH || "InlineOverhaul_Config.md");
  }

  function normalizeTagWheelConfigTemplatePath() {
    return String(TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH || "InlineOverhaul_Config_template.md");
  }

  function buildDefaultTagWheelDetailedTemplateMarkdown() {
    const lines = [];
    lines.push(">This is the place where you can set up your PKM in user-friendly way.");
    lines.push(">Add or edit your comments here. Technical settings are inserted via markers.");
    lines.push("---");
    lines.push("## Instructions and Rules");
    lines.push("- Keep your custom comments and explanations in this template.");
    lines.push("- Do not remove technical markers.");
    lines.push("#### Wikilink fields (from plugin settings -> PKM -> Order)");
    lines.push("<!-- INLINE_OVERHAUL:TECH:WIKILINK_FIELDS -->");
    lines.push("");
    lines.push("## Settings");
    lines.push(`### ${String(CFG_H2_TAGS || "#TAGS/#SUBTAGS + WIKILINKS")}`);
    lines.push("<!-- INLINE_OVERHAUL:TECH:TAGS -->");
    lines.push("");
    lines.push(`### ${String(TAGWHEEL_PREFIX_RESOLVER_H3 || "PREFIX RESOLVER")}`);
    lines.push("#### Settings");
    lines.push("<!-- INLINE_OVERHAUL:TECH:PREFIX_SETTINGS -->");
    lines.push("#### Order");
    lines.push("1.  **Fields Order:**");
    lines.push("<!-- INLINE_OVERHAUL:TECH:FIELDS_ORDER_ITEMS -->");
    lines.push("");
    lines.push("2. **Checkbox Order:**");
    lines.push("<!-- INLINE_OVERHAUL:TECH:CHECKBOX_ORDER_ITEMS -->");
    lines.push("");
    lines.push(`### ${String(CFG_H2_ELEMENTS_COMBINED || "DATE/TIME + ELEMENTS")}`);
    lines.push("<!-- INLINE_OVERHAUL:TECH:ELEMENTS -->");
    lines.push("");
    return lines.join("\n");
  }

  function renderTagWheelConfigFromTemplate(templateMd, parts) {
    const src = String(templateMd || "");
    const byKey = isObj && isObj(parts) ? parts : {};
    const hasDatesMarker = /<!--\s*INLINE_OVERHAUL:TECH:DATES\s*-->/i.test(src);
    const markerRe = /<!--\s*INLINE_OVERHAUL:TECH:([A-Z_]+)\s*-->/g;
    let hasNamed = false;
    let out = src.replace(markerRe, (_, keyRaw) => {
      hasNamed = true;
      const key = String(keyRaw || "").trim();
      if (!Object.prototype.hasOwnProperty.call(byKey, key)) {
        throw new Error(`Detailed template error: unknown marker '${String(TAGWHEEL_TECH_MARKER_PREFIX || "INLINE_OVERHAUL:TECH:")}${key}'`);
      }
      if (key === "ELEMENTS" && hasDatesMarker && Object.prototype.hasOwnProperty.call(byKey, "ELEMENTS_ONLY")) {
        return String(byKey.ELEMENTS_ONLY || "");
      }
      return String(byKey[key] || "");
    });
    if (out.includes(String(TAGWHEEL_TECHNICAL_BLOCK_MARKER || "<!-- INLINE_OVERHAUL:TECHNICAL_BLOCK -->"))) {
      const fallback = String(byKey.MINIMAL_FULL || "").trim();
      if (!fallback) {
        throw new Error(`Detailed template error: missing marker '${String(TAGWHEEL_TECHNICAL_BLOCK_MARKER || "<!-- INLINE_OVERHAUL:TECHNICAL_BLOCK -->")}' payload`);
      }
      out = out.split(String(TAGWHEEL_TECHNICAL_BLOCK_MARKER || "<!-- INLINE_OVERHAUL:TECHNICAL_BLOCK -->")).join(fallback);
      hasNamed = true;
    }
    if (!hasNamed) {
      throw new Error("Detailed template error: no technical markers found");
    }
    return out;
  }

  function buildMinimalFromRenderedTemplate(renderedMd) {
    const src = String(renderedMd || "");
    const lines = src.split(/\r?\n/);
    const start = lines.findIndex((ln) => /^##\s+Settings\s*$/i.test(String(ln || "").trim()));
    const body = (start === -1 ? lines : lines.slice(start))
      .filter((ln) => !/^\s*>/.test(String(ln || "")));
    const out = [];
    out.push(String(TAGWHEEL_IMPORTANT_LINE || ""));
    out.push("---");
    out.push(...body);
    return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  function buildTagWheelConfigParts(cfg) {
    const sections = collectTagSections(cfg);
    const fields = [].concat(getLeftFields(cfg), getRightFields(cfg));
    const wikilinkFields = collectWikilinkFieldIds(cfg);
    const prefixRules = getPrefixRulesFromCfg(cfg);
    const projects = cfg && cfg.pkm && cfg.pkm.behavior && isObj(cfg.pkm.behavior.projects)
      ? cfg.pkm.behavior.projects
      : {};
    const taxonomyWikilinks = cfg && cfg.pkm && cfg.pkm.taxonomy && cfg.pkm.taxonomy.tagWheelConfig
      && isObj(cfg.pkm.taxonomy.tagWheelConfig.wikilinks)
      ? cfg.pkm.taxonomy.tagWheelConfig.wikilinks
      : {};
    const orphanWikilinks = cfg && cfg.pkm && cfg.pkm.taxonomy && cfg.pkm.taxonomy.tagWheelConfig
      && isObj(cfg.pkm.taxonomy.tagWheelConfig.orphanWikilinks)
      ? cfg.pkm.taxonomy.tagWheelConfig.orphanWikilinks
      : {};
    const tagVisuals = cfg && cfg.pkm && cfg.pkm.behavior && isObj(cfg.pkm.behavior.tagVisuals)
      ? cfg.pkm.behavior.tagVisuals
      : {};
    const byTagVisuals = isObj(tagVisuals.byTag) ? tagVisuals.byTag : {};
    const userTagVisuals = isObj(tagVisuals.userTags) ? tagVisuals.userTags : {};
    const orderCfg = cfg && cfg.pkm && cfg.pkm.behavior && isObj(cfg.pkm.behavior.order)
      ? cfg.pkm.behavior.order
      : {};
    const orderStrictNames = isObj(orderCfg.strictNames) ? orderCfg.strictNames : {};
    const propertiesByField = isObj(orderCfg.propertiesByField) ? orderCfg.propertiesByField : {};
    const strictToOrderKey = {};
    for (const orderKey of Object.keys(orderStrictNames)) {
      const strictName = String(orderStrictNames[orderKey] || "").trim();
      const ok = String(orderKey || "").trim();
      if (!strictName || !ok) continue;
      strictToOrderKey[strictName] = ok;
    }
    const resolveFieldYamlBySection = (sectionId) => {
      const sid = String(sectionId || "").trim();
      if (!sid) return "";
      const byStrict = String(propertiesByField[sid] || "").trim();
      if (byStrict) return byStrict;
      const orderKey = String(strictToOrderKey[sid] || "").trim();
      if (!orderKey) return "";
      return String(propertiesByField[orderKey] || "").trim();
    };
    const tagsBody = [];
    const tokenYamlForField = (fieldId, token) => {
      const fid = String(fieldId || "").trim();
      const tok = String(token || "").trim();
      if (!fid || !tok) return "";
      const field = getFieldById(fields, fid);
      const vals = field && Array.isArray(field.values) ? field.values : [];
      const wanted = denormTagToken(tok);
      if (!wanted) return "";
      for (let i = 0; i < vals.length; i++) {
        const row = vals[i] && typeof vals[i] === "object" ? vals[i] : null;
        if (!row) continue;
        const rTok = denormTagToken(row.token);
        if (!rTok || rTok !== wanted) continue;
        return String(row.yamlProperty || "").trim();
      }
      return "";
    };
    const buildPipeTail = (payload) => {
      const src = payload && typeof payload === "object" ? payload : {};
      const out = [];
      const customText = String(src.customText || "").trim();
      const fill = String(src.fillColor || "").trim().toLowerCase();
      const text = String(src.textColor || "").trim().toLowerCase();
      const yaml = String(src.yamlProperty || "").trim();
      if (customText) out.push(`custom name = \`${customText}\``);
      const hasColors = /^#[0-9a-f]{6}$/.test(fill) && /^#[0-9a-f]{6}$/.test(text);
      if (hasColors) out.push(`hex = \`${fill}\`/\`${text}\``);
      if (yaml) out.push(`yaml = \`${yaml}\``);
      return out.length ? ` | ${out.join(" | ")}` : "";
    };
    const visualTailForTag = (fieldId, token, sectionId) => {
      const fid = String(fieldId || "").trim();
      const tok = String(token || "").trim();
      if (!fid || !/^#\S+/.test(tok)) return "";
      const row = byTagVisuals[fid] && isObj(byTagVisuals[fid][tok]) ? byTagVisuals[fid][tok] : null;
      const fieldYaml = resolveFieldYamlBySection(sectionId);
      const tokenYaml = tokenYamlForField(fid, tok);
      const effectiveYaml = tokenYaml || fieldYaml;
      return buildPipeTail({
        customText: row ? String(row.customText || "").trim() : "",
        fillColor: row ? String(row.fillColor || "").trim() : "",
        textColor: row ? String(row.textColor || "").trim() : "",
        yamlProperty: effectiveYaml,
      });
    };
    const visualTailForUserTag = (token) => {
      const tok = String(token || "").trim();
      if (!/^#\S+/.test(tok)) return "";
      const row = isObj(userTagVisuals[tok]) ? userTagVisuals[tok] : null;
      const fill = row ? String(row.fillColor || "").trim() : "";
      const text = row ? String(row.textColor || "").trim() : "";
      const customText = row ? String(row.customText || "").trim() : "";
      const hasColors = /^#[0-9a-fA-F]{6}$/.test(fill) && /^#[0-9a-fA-F]{6}$/.test(text);
      if (customText && hasColors) return ` - \`${customText}\` - \`${fill.toLowerCase()}\`/\`${text.toLowerCase()}\``;
      if (customText) return ` - \`${customText}\``;
      if (!hasColors) return "";
      return ` - \`${fill.toLowerCase()}\`/\`${text.toLowerCase()}\``;
    };

    const parentTokens = (field) => {
      const vals = field && Array.isArray(field.values) ? field.values : [];
      const pref = field && typeof field.prefix === "string" ? field.prefix : "#";
      const source = String(field && field.source ? field.source : "").trim();
      const isWikilinkSource = source === "projects" || source.startsWith("wikilinks:");
      const out = [];
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (!v || typeof v !== "object" || Array.isArray(v)) continue;
        if (v.active === false) continue;
        const tok = String(v.token || "").trim();
        if (!tok) continue;
        if (/^\[\[[^\]]+\]\]$/.test(tok)) {
          out.push(tok);
          continue;
        }
        if (/^#\S+/.test(tok)) {
          out.push(tok);
          continue;
        }
        if (isWikilinkSource) {
          out.push(`[[${tok}]]`);
          continue;
        }
        if (!pref && /^\//.test(tok)) out.push(`#${tok}`);
        else out.push(`${pref}${tok}`);
      }
      return out;
    };
    const subByParent = (subField) => {
      const vals = subField && Array.isArray(subField.values) ? subField.values : [];
      const map = {};
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        if (!v || typeof v !== "object" || Array.isArray(v)) continue;
        if (v.active === false) continue;
        const tok = String(v.token || "").trim();
        if (!tok) continue;
        const parents = Array.isArray(v.allowedParentValues) ? v.allowedParentValues : [];
        for (let j = 0; j < parents.length; j++) {
          const p = `#${String(parents[j] || "").trim()}`;
          if (!map[p]) map[p] = [];
          if (!map[p].includes(`#${tok}`)) map[p].push(`#${tok}`);
        }
      }
      return map;
    };
    const sectionIdByFieldId = {};
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i] || {};
      const fid = String(s.fieldId || "").trim();
      const sfid = String(s.subFieldId || "").trim();
      if (fid && !sectionIdByFieldId[fid]) sectionIdByFieldId[fid] = s.sectionId;
      if (sfid && !sectionIdByFieldId[sfid]) sectionIdByFieldId[sfid] = s.sectionId;
    }
    const formatTokenForField = (field, rawToken) => {
      const tok = String(rawToken || "").trim();
      if (!tok) return "";
      if (/^\[\[[^\]]+\]\]$/.test(tok)) return tok;
      if (/^#\S+/.test(tok)) return tok;
      const source = String(field && field.source ? field.source : "").trim();
      if (source === "projects" || source.startsWith("wikilinks:")) return `[[${tok}]]`;
      const pref = field && typeof field.prefix === "string" ? field.prefix : "#";
      if (!pref && /^\//.test(tok)) return `#${tok}`;
      return `${pref}${tok}`;
    };
    const buildWikilinkNodeFromFieldValues = (field, options) => {
      const f = field && typeof field === "object" ? field : null;
      if (!f) return null;
      const opts = options && typeof options === "object" ? options : {};
      const src = String(f.source || "").trim();
      if (!(src === "projects" || src.indexOf("wikilinks:") === 0)) return null;
      const vals = Array.isArray(f.values) ? f.values : [];
      const node = { defaults: [], byParent: {} };
      const bySection = {};
      const boundTokenSet = new Set();
      const unboundOrdered = [];
      const canonicalWikilinkToken = (rawTok) => {
        const v = String(rawTok || "").trim();
        if (!v) return "";
        if (/^\[\[[^\]]+\]\]$/.test(v)) return v;
        if (/^#\S+/.test(v)) return v;
        return `[[${v.replace(/^\[\[/, "").replace(/\]\]$/, "")}]]`;
      };
      const defsSeen = new Set();
      const pushScoped = (sectionId, parentTok, subTok, tok) => {
        const sid = String(sectionId || "").trim();
        const v = String(tok || "").trim();
        if (!sid || !v) return;
        if (!bySection[sid]) bySection[sid] = { defaults: [], byParent: {} };
        const sec = bySection[sid];
        if (!parentTok) {
          if (!sec.defaults.includes(v)) sec.defaults.push(v);
          return;
        }
        const pTok = String(parentTok || "").trim();
        if (!pTok) return;
        if (!sec.byParent[pTok]) sec.byParent[pTok] = { branch: [], leaf: {} };
        if (subTok) {
          const sTok = String(subTok || "").trim();
          if (!sTok) return;
          if (!Array.isArray(sec.byParent[pTok].leaf[sTok])) sec.byParent[pTok].leaf[sTok] = [];
          if (!sec.byParent[pTok].leaf[sTok].includes(v)) sec.byParent[pTok].leaf[sTok].push(v);
          return;
        }
        if (!sec.byParent[pTok].branch.includes(v)) sec.byParent[pTok].branch.push(v);
      };
      const pushDefault = (tok) => {
        const v = String(tok || "").trim();
        if (!v || defsSeen.has(v)) return;
        defsSeen.add(v);
        node.defaults.push(v);
        if (!unboundOrdered.includes(v)) unboundOrdered.push(v);
      };
      for (let i = 0; i < vals.length; i++) {
        const row = vals[i] && typeof vals[i] === "object" ? vals[i] : null;
        if (!row || row.active === false) continue;
        const tok = canonicalWikilinkToken(row.token);
        if (!tok) continue;
        const binding = String(row.__ioParentBinding || "").trim();
        const mSub = binding.match(/^s:([^|]+)\|p:([^|]+)/);
        const mParent = binding.match(/^p:([^|]+)/);
        const mField = binding.match(/\|f:([^|]+)$/);
        const parentFieldId = mField ? String(mField[1] || "").trim() : "";
        const sectionFromBinding = parentFieldId && opts.sectionIdByFieldId ? String(opts.sectionIdByFieldId[parentFieldId] || "").trim() : "";
        if (mSub) {
          const subTok = String(mSub[1] || "").trim();
          const parentTok = String(mSub[2] || "").trim();
          if (subTok && parentTok) {
            if (!node.byParent[parentTok]) node.byParent[parentTok] = { branch: [], leaf: {} };
            const leaf = node.byParent[parentTok].leaf;
            if (!Array.isArray(leaf[subTok])) leaf[subTok] = [];
            if (!leaf[subTok].includes(tok)) leaf[subTok].push(tok);
            pushScoped(sectionFromBinding, parentTok, subTok, tok);
            boundTokenSet.add(tok);
            continue;
          }
        }
        if (mParent) {
          const parentTok = String(mParent[1] || "").trim();
          if (parentTok) {
            if (!node.byParent[parentTok]) node.byParent[parentTok] = { branch: [], leaf: {} };
            const branch = node.byParent[parentTok].branch;
            if (!branch.includes(tok)) branch.push(tok);
            pushScoped(sectionFromBinding, parentTok, "", tok);
            boundTokenSet.add(tok);
            continue;
          }
        }
        const allowed = Array.isArray(row.allowedParentValues)
          ? row.allowedParentValues.map((x) => String(x || "").trim()).filter(Boolean)
          : [];
        if (!allowed.length) {
          pushDefault(tok);
          pushScoped(String(opts.ownSectionId || "").trim(), "", "", tok);
          continue;
        }
        for (let ai = 0; ai < allowed.length; ai++) {
          const parentTok = `#${allowed[ai].replace(/^#/, "")}`;
          if (!node.byParent[parentTok]) node.byParent[parentTok] = { branch: [], leaf: {} };
          const branch = node.byParent[parentTok].branch;
          if (!branch.includes(tok)) branch.push(tok);
          pushScoped(sectionFromBinding || String(opts.ownSectionId || "").trim(), parentTok, "", tok);
        }
      }
      return { node, bySection, boundTokenSet, unboundOrdered };
    };
    const sectionKindByField = (field) => {
      const source = String(field && field.source ? field.source : "").trim();
      return source === "projects" || source.startsWith("wikilinks:") ? "link" : "tag";
    };
    const projectFieldId = (() => {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (!f || !f.id) continue;
        const src = String(f.source || "").trim();
        if (src !== "projects") continue;
        return String(f.id || "").trim();
      }
      return "";
    })();
    const projectTaxBySection = projectFieldId && isObj(taxonomyWikilinks[projectFieldId]) && isObj(taxonomyWikilinks[projectFieldId].bySection)
      ? taxonomyWikilinks[projectFieldId].bySection
      : {};
    const hasProjectTaxonomyBySection = Object.keys(projectTaxBySection).length > 0;
    const buildProjectCompatSectionNode = (sectionId) => {
      if (hasProjectTaxonomyBySection) return null;
      if (!projectFieldId || !isObj(projects) || !isObj(projects.byContext)) return null;
      const fk = Array.isArray(projects.filterKeys) ? projects.filterKeys.map((x) => String(x || "").trim()).filter(Boolean) : [];
      const parentFieldId = fk[0] || "";
      const parentSectionId = sectionIdByFieldId[parentFieldId] || "";
      if (!parentSectionId || String(parentSectionId) !== String(sectionId)) return null;
      const node = { defaults: [], byParent: {} };
      const defs = Array.isArray(projects.defaults) ? projects.defaults : [];
      for (let i = 0; i < defs.length; i++) {
        const tok = String(defs[i] || "").trim();
        if (!tok) continue;
        node.defaults.push(tok);
      }
      const byContext = isObj(projects.byContext) ? projects.byContext : {};
      for (const parentKey of Object.keys(byContext)) {
        const srcNode = isObj(byContext[parentKey]) ? byContext[parentKey] : {};
        const branch = Array.isArray(srcNode.branch) ? srcNode.branch : [];
        const leafSrc = isObj(srcNode.leaf) ? srcNode.leaf : {};
        const dstNode = { branch: [], leaf: {} };
        for (let i = 0; i < branch.length; i++) {
          const tok = String(branch[i] || "").trim();
          if (!tok) continue;
          dstNode.branch.push(tok);
        }
        for (const subKey of Object.keys(leafSrc)) {
          const arr = Array.isArray(leafSrc[subKey]) ? leafSrc[subKey] : [];
          const outArr = [];
          for (let i = 0; i < arr.length; i++) {
            const tok = String(arr[i] || "").trim();
            if (!tok) continue;
            outArr.push(tok);
          }
          dstNode.leaf[`#${String(subKey || "").trim()}`] = outArr;
        }
        node.byParent[`#${String(parentKey || "").trim()}`] = dstNode;
      }
      return node;
    };
    const pickByDenormToken = (obj, tokenLike) => {
      const map = isObj(obj) ? obj : {};
      const wanted = denormTagToken(tokenLike);
      for (const k of Object.keys(map)) {
        if (denormTagToken(k) === wanted) return map[k];
      }
      return null;
    };
    const mergeWikilinkNodes = (baseNode, extraNode) => {
      const out = {
        defaults: [],
        byParent: {},
      };
      const pushDefault = (tok) => {
        const v = String(tok || "").trim();
        if (!v) return;
        if (!out.defaults.includes(v)) out.defaults.push(v);
      };
      const mergeParent = (parentToken, srcNode) => {
        const pTok = String(parentToken || "").trim();
        if (!pTok || !isObj(srcNode)) return;
        if (!isObj(out.byParent[pTok])) out.byParent[pTok] = { branch: [], leaf: {} };
        const dst = out.byParent[pTok];
        const branch = Array.isArray(srcNode.branch) ? srcNode.branch : [];
        for (let i = 0; i < branch.length; i++) {
          const v = String(branch[i] || "").trim();
          if (!v) continue;
          if (!dst.branch.includes(v)) dst.branch.push(v);
        }
        const leaf = isObj(srcNode.leaf) ? srcNode.leaf : {};
        for (const subToken of Object.keys(leaf)) {
          const sTok = String(subToken || "").trim();
          if (!sTok) continue;
          if (!Array.isArray(dst.leaf[sTok])) dst.leaf[sTok] = [];
          const arr = Array.isArray(leaf[subToken]) ? leaf[subToken] : [];
          for (let i = 0; i < arr.length; i++) {
            const v = String(arr[i] || "").trim();
            if (!v) continue;
            if (!dst.leaf[sTok].includes(v)) dst.leaf[sTok].push(v);
          }
        }
      };
      const applyNode = (node) => {
        const src = isObj(node) ? node : {};
        const defs = Array.isArray(src.defaults) ? src.defaults : [];
        for (let i = 0; i < defs.length; i++) pushDefault(defs[i]);
        const byParent = isObj(src.byParent) ? src.byParent : {};
        for (const parentToken of Object.keys(byParent)) mergeParent(parentToken, byParent[parentToken]);
      };
      applyNode(baseNode);
      applyNode(extraNode);
      return out;
    };
    const filterNodeDefaults = (node, denySet) => {
      const src = isObj(node) ? node : { defaults: [], byParent: {} };
      const deny = denySet instanceof Set ? denySet : new Set();
      const out = {
        defaults: (Array.isArray(src.defaults) ? src.defaults : []).filter((tok) => {
          const v = String(tok || "").trim();
          if (!v) return false;
          return !deny.has(v);
        }),
        byParent: isObj(src.byParent) ? src.byParent : {},
      };
      return out;
    };
    const collectBoundFromNode = (node, outSet) => {
      const src = isObj(node) ? node : {};
      const byParent = isObj(src.byParent) ? src.byParent : {};
      for (const parentToken of Object.keys(byParent)) {
        const pNode = isObj(byParent[parentToken]) ? byParent[parentToken] : {};
        const branch = Array.isArray(pNode.branch) ? pNode.branch : [];
        for (let i = 0; i < branch.length; i++) {
          const tok = String(branch[i] || "").trim();
          if (tok) outSet.add(tok);
        }
        const leaf = isObj(pNode.leaf) ? pNode.leaf : {};
        for (const subToken of Object.keys(leaf)) {
          const arr = Array.isArray(leaf[subToken]) ? leaf[subToken] : [];
          for (let i = 0; i < arr.length; i++) {
            const tok = String(arr[i] || "").trim();
            if (tok) outSet.add(tok);
          }
        }
      }
    };
    const getWikilinkRowOrder = (field) => {
      const f = field && typeof field === "object" ? field : null;
      if (!f) return [];
      const src = String(f.source || "").trim();
      if (!(src === "projects" || src.indexOf("wikilinks:") === 0)) return [];
      const vals = Array.isArray(f.values) ? f.values : [];
      const out = [];
      for (let i = 0; i < vals.length; i++) {
        const row = vals[i] && typeof vals[i] === "object" ? vals[i] : null;
        if (!row || row.active === false) continue;
        const tok = String(row.token || "").trim();
        if (!tok) continue;
        const token = /^\[\[[^\]]+\]\]$/.test(tok) ? tok : `[[${tok.replace(/^\[\[/, "").replace(/\]\]$/, "") }]]`;
        const binding = String(row.__ioParentBinding || "").trim();
        out.push({ token, binding });
      }
      return out;
    };
    const orderedTokens = (candidateList, orderRows, predicate) => {
      const cset = new Set((Array.isArray(candidateList) ? candidateList : []).map((x) => String(x || "").trim()).filter(Boolean));
      const out = [];
      for (let i = 0; i < orderRows.length; i++) {
        const row = orderRows[i] || {};
        const tok = String(row.token || "").trim();
        if (!tok || !cset.has(tok)) continue;
        if (typeof predicate === "function" && !predicate(row)) continue;
        if (!out.includes(tok)) out.push(tok);
      }
      const base = Array.isArray(candidateList) ? candidateList : [];
      for (let i = 0; i < base.length; i++) {
        const tok = String(base[i] || "").trim();
        if (!tok) continue;
        if (out.includes(tok)) continue;
        out.push(tok);
      }
      return out;
    };
    const parseBindingPath = (binding) => {
      const src = String(binding || "").trim();
      if (!src) return null;
      const mLeaf = src.match(/^s:([^|]+)\|p:([^|]+)(?:\|f:([^|]+))?$/);
      if (mLeaf) {
        return {
          kind: "leaf",
          sub: String(mLeaf[1] || "").trim(),
          parent: String(mLeaf[2] || "").trim(),
          fieldId: String(mLeaf[3] || "").trim(),
        };
      }
      const mParent = src.match(/^p:([^|]+)(?:\|f:([^|]+))?$/);
      if (mParent) {
        return {
          kind: "branch",
          parent: String(mParent[1] || "").trim(),
          fieldId: String(mParent[2] || "").trim(),
        };
      }
      return null;
    };
    const getLiveWikilinkStateMap = (field) => {
      const map = {};
      const vals = field && Array.isArray(field.values) ? field.values : [];
      for (let i = 0; i < vals.length; i++) {
        const row = vals[i] && typeof vals[i] === "object" ? vals[i] : null;
        if (!row || row.active === false) continue;
        const tokRaw = String(row.token || "").trim();
        if (!tokRaw) continue;
        const tok = /^\[\[[^\]]+\]\]$/.test(tokRaw) ? tokRaw : `[[${tokRaw.replace(/^\[\[/, "").replace(/\]\]$/, "") }]]`;
        const parsed = parseBindingPath(row.__ioParentBinding);
        if (!parsed) {
          map[tok] = { state: "explicit_unbound" };
          continue;
        }
        if (parsed.kind === "leaf") {
          map[tok] = {
            state: "bound",
            kind: "leaf",
            parent: String(parsed.parent || "").trim(),
            sub: String(parsed.sub || "").trim(),
            fieldId: String(parsed.fieldId || "").trim(),
          };
          continue;
        }
        map[tok] = {
          state: "bound",
          kind: "branch",
          parent: String(parsed.parent || "").trim(),
          fieldId: String(parsed.fieldId || "").trim(),
        };
      }
      return map;
    };
    const reconcileNodeByLiveState = (node, liveStateMap) => {
      const src = isObj(node) ? node : { defaults: [], byParent: {} };
      const live = isObj(liveStateMap) ? liveStateMap : {};
      const out = { defaults: [], byParent: {} };
      const defs = Array.isArray(src.defaults) ? src.defaults : [];
      for (let i = 0; i < defs.length; i++) {
        const tok = String(defs[i] || "").trim();
        if (!tok) continue;
        const st = live[tok];
        if (st && st.state === "bound") continue;
        if (!out.defaults.includes(tok)) out.defaults.push(tok);
      }
      const byParent = isObj(src.byParent) ? src.byParent : {};
      for (const parentToken of Object.keys(byParent)) {
        const pNode = isObj(byParent[parentToken]) ? byParent[parentToken] : {};
        const dst = { branch: [], leaf: {} };
        const branch = Array.isArray(pNode.branch) ? pNode.branch : [];
        for (let i = 0; i < branch.length; i++) {
          const tok = String(branch[i] || "").trim();
          if (!tok) continue;
          const st = live[tok];
          if (!st) {
            if (!dst.branch.includes(tok)) dst.branch.push(tok);
            continue;
          }
          if (st.state === "explicit_unbound") continue;
          if (st.state !== "bound" || st.kind !== "branch") continue;
          if (st.parent !== String(parentToken || "").trim()) continue;
          if (!dst.branch.includes(tok)) dst.branch.push(tok);
        }
        const leaf = isObj(pNode.leaf) ? pNode.leaf : {};
        for (const subToken of Object.keys(leaf)) {
          const arr = Array.isArray(leaf[subToken]) ? leaf[subToken] : [];
          for (let i = 0; i < arr.length; i++) {
            const tok = String(arr[i] || "").trim();
            if (!tok) continue;
            const st = live[tok];
            if (!st) {
              if (!Array.isArray(dst.leaf[subToken])) dst.leaf[subToken] = [];
              if (!dst.leaf[subToken].includes(tok)) dst.leaf[subToken].push(tok);
              continue;
            }
            if (st.state === "explicit_unbound") continue;
            if (st.state !== "bound" || st.kind !== "leaf") continue;
            if (st.parent !== String(parentToken || "").trim()) continue;
            if (st.sub !== String(subToken || "").trim()) continue;
            if (!Array.isArray(dst.leaf[subToken])) dst.leaf[subToken] = [];
            if (!dst.leaf[subToken].includes(tok)) dst.leaf[subToken].push(tok);
          }
        }
        if (dst.branch.length || Object.keys(dst.leaf).length) out.byParent[parentToken] = dst;
      }
      return out;
    };

    const globalBoundByField = {};
    for (let wi = 0; wi < wikilinkFields.length; wi++) {
      const fid = String(wikilinkFields[wi] || "").trim();
      if (!fid) continue;
      const taxonomyBoundSet = new Set();
      const taxEntry = isObj(taxonomyWikilinks[fid]) ? taxonomyWikilinks[fid] : {};
      const bySec = isObj(taxEntry.bySection) ? taxEntry.bySection : {};
      for (const secName of Object.keys(bySec)) collectBoundFromNode(bySec[secName], taxonomyBoundSet);
      const ownField = getFieldById(fields, fid);
      const liveState = getLiveWikilinkStateMap(ownField);
      const ownSectionId = String(sectionIdByFieldId[fid] || "").trim();
      const ownFallbackPack = buildWikilinkNodeFromFieldValues(ownField, { ownSectionId, sectionIdByFieldId });
      const ownBound = ownFallbackPack && ownFallbackPack.boundTokenSet instanceof Set ? ownFallbackPack.boundTokenSet : null;
      const outSet = new Set();
      if (ownBound) {
        for (const tok of ownBound.values()) {
          const v = String(tok || "").trim();
          if (v) outSet.add(v);
        }
      }
      for (const tok of taxonomyBoundSet.values()) {
        const v = String(tok || "").trim();
        if (!v) continue;
        const st = liveState[v];
        if (st && st.state === "explicit_unbound") continue;
        outSet.add(v);
      }
      globalBoundByField[fid] = outSet;
    }

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const field = getFieldById(fields, s.fieldId);
      const subField = s.subFieldId ? getFieldById(fields, s.subFieldId) : null;
      const sectionWlByField = {};
      for (let wi = 0; wi < wikilinkFields.length; wi++) {
        const fid = String(wikilinkFields[wi] || "").trim();
        if (!fid) continue;
        const ownField = getFieldById(fields, fid);
        const liveStateMap = getLiveWikilinkStateMap(ownField);
        const ownSectionId = String(sectionIdByFieldId[fid] || s.sectionId || "").trim();
        const ownFallbackPack = buildWikilinkNodeFromFieldValues(ownField, { ownSectionId, sectionIdByFieldId });
        const ownFallback = ownFallbackPack && ownFallbackPack.node ? ownFallbackPack.node : null;
        const ownBySection = ownFallbackPack && ownFallbackPack.bySection ? ownFallbackPack.bySection : {};
        const boundSetLocal = ownFallbackPack && ownFallbackPack.boundTokenSet instanceof Set ? ownFallbackPack.boundTokenSet : new Set();
        const boundSet = globalBoundByField[fid] instanceof Set ? globalBoundByField[fid] : boundSetLocal;
        const unboundOrdered = ownFallbackPack && Array.isArray(ownFallbackPack.unboundOrdered) ? ownFallbackPack.unboundOrdered : [];
        const scopedNode = ownBySection[s.sectionId] && isObj(ownBySection[s.sectionId]) ? ownBySection[s.sectionId] : null;
        const taxEntry = isObj(taxonomyWikilinks[fid]) ? taxonomyWikilinks[fid] : {};
        const bySec = isObj(taxEntry.bySection) ? taxEntry.bySection : {};
        const secNode = isObj(bySec[s.sectionId]) ? bySec[s.sectionId] : null;
        if (secNode) {
          let merged = scopedNode ? mergeWikilinkNodes(secNode, scopedNode) : secNode;
          merged = reconcileNodeByLiveState(merged, liveStateMap);
          merged = filterNodeDefaults(merged, boundSet);
          if (fid === s.fieldId) {
            const d = Array.isArray(merged.defaults) ? merged.defaults.slice() : [];
            for (let ui = 0; ui < unboundOrdered.length; ui++) {
              const tok = String(unboundOrdered[ui] || "").trim();
              if (!tok || boundSet.has(tok)) continue;
              if (!d.includes(tok)) d.push(tok);
            }
            merged = { ...merged, defaults: d };
          }
          sectionWlByField[fid] = merged;
          continue;
        }
        {
          if (scopedNode && (scopedNode.defaults.length || Object.keys(scopedNode.byParent || {}).length)) {
            sectionWlByField[fid] = filterNodeDefaults(reconcileNodeByLiveState(scopedNode, liveStateMap), boundSet);
            continue;
          }
          if (fid === s.fieldId && ownFallback && (ownFallback.defaults.length || Object.keys(ownFallback.byParent).length)) {
            const mergedOwn = filterNodeDefaults(reconcileNodeByLiveState(ownFallback, liveStateMap), boundSet);
            const d = Array.isArray(mergedOwn.defaults) ? mergedOwn.defaults.slice() : [];
            for (let ui = 0; ui < unboundOrdered.length; ui++) {
              const tok = String(unboundOrdered[ui] || "").trim();
              if (!tok || boundSet.has(tok)) continue;
              if (!d.includes(tok)) d.push(tok);
            }
            sectionWlByField[fid] = { ...mergedOwn, defaults: d };
            continue;
          }
        }
        if (fid === projectFieldId) {
          const compat = buildProjectCompatSectionNode(s.sectionId);
          if (compat) sectionWlByField[fid] = compat;
        }
      }
      tagsBody.push(`##### ${s.sectionId} - ${sectionKindByField(field)}`);
      {
        const sectionYaml = resolveFieldYamlBySection(s.sectionId);
        if (sectionKindByField(field) === "link" && sectionYaml) tagsBody.push(`- YAML: ${sectionYaml}`);
      }
      const hasOwnSourceNode = Object.prototype.hasOwnProperty.call(sectionWlByField, String(s.fieldId || ""));
      const sectionWikilinkFieldIds = Object.keys(sectionWlByField).filter((x) => String(x || "").trim());
      const sectionIsMixedWikilinks = sectionWikilinkFieldIds.length > 1;
      const pushSourceLine = (indent, tokenOut, wlFieldId, ownSection) => {
        if (!tokenOut) return;
        if (!sectionIsMixedWikilinks) {
          tagsBody.push(`${indent}- ${tokenOut}`);
          return;
        }
        const fid = String(wlFieldId || "").trim();
        if (!fid) {
          if (ownSection) tagsBody.push(`${indent}- ${tokenOut}`);
          return;
        }
        tagsBody.push(`${indent}- ${tokenOut} - ${fid}`);
      };
      for (const wlFieldId of Object.keys(sectionWlByField)) {
        const ownSection = wlFieldId === s.fieldId;
        const wlField = getFieldById(fields, wlFieldId);
        const rowOrder = getWikilinkRowOrder(wlField);
        const wlNode = isObj(sectionWlByField[wlFieldId]) ? sectionWlByField[wlFieldId] : {};
        const defs = Array.isArray(wlNode.defaults) ? wlNode.defaults : [];
        const orderedDefs = orderedTokens(defs, rowOrder, (r) => !String(r.binding || "").trim());
        const defsSeen = new Set();
        const denyBound = globalBoundByField[wlFieldId] instanceof Set ? globalBoundByField[wlFieldId] : new Set();
        for (let di = 0; di < orderedDefs.length; di++) {
          const rawTok = String(orderedDefs[di] || "").trim();
          if (!rawTok) continue;
          if (denyBound.has(rawTok)) continue;
          if (defsSeen.has(rawTok)) continue;
          defsSeen.add(rawTok);
          const tokenOut = formatTokenForField(wlField, rawTok);
          pushSourceLine("", tokenOut, wlFieldId, ownSection);
        }
      }
      const parents = hasOwnSourceNode ? [] : parentTokens(field);
      const subMap = hasOwnSourceNode ? {} : subByParent(subField);
      if (!hasOwnSourceNode && !parents.length) tagsBody.push("- ");
      for (let pi = 0; pi < parents.length; pi++) {
        const pTok = parents[pi];
        const pKey = denormTagToken(pTok);
        const pCb = isObj(prefixRules.checkboxByFieldValue[s.fieldId]) ? String(prefixRules.checkboxByFieldValue[s.fieldId][pKey] || "").trim() : "";
        const pTail = visualTailForTag(s.fieldId, pTok, s.sectionId);
        tagsBody.push(pCb ? `- ${pCb} ${pTok}${pTail}` : `- ${pTok}${pTail}`);
        const subs = subMap[pTok] || [];
        const parentNodesByFieldId = {};
        for (const wlFieldId of Object.keys(sectionWlByField)) {
          const wlField = getFieldById(fields, wlFieldId);
          const rowOrder = getWikilinkRowOrder(wlField);
          const wlNode = isObj(sectionWlByField[wlFieldId]) ? sectionWlByField[wlFieldId] : {};
          const byParent = isObj(wlNode.byParent) ? wlNode.byParent : {};
          const parentNode = pickByDenormToken(byParent, pTok);
          if (!isObj(parentNode)) continue;
          parentNodesByFieldId[wlFieldId] = { field: wlField, node: parentNode, ownSection: wlFieldId === s.fieldId };
          const branch = Array.isArray(parentNode.branch) ? parentNode.branch : [];
          const orderedBranch = orderedTokens(branch, rowOrder, (r) => {
            const b = String(r.binding || "").trim();
            return b === `p:${pTok}` || b === `p:${pTok}|f:${String(wlField && wlField.id || "").trim()}`;
          });
          for (let bi = 0; bi < orderedBranch.length; bi++) {
            const tokenOut = formatTokenForField(wlField, orderedBranch[bi]);
            pushSourceLine("    ", tokenOut, wlFieldId, wlFieldId === s.fieldId);
          }
        }
        for (let si = 0; si < subs.length; si++) {
          const subTok = subs[si];
          const subKey = denormTagToken(subTok);
          const subFieldId = s.subFieldId || s.fieldId;
          const subCb = isObj(prefixRules.checkboxByFieldValue[subFieldId]) ? String(prefixRules.checkboxByFieldValue[subFieldId][subKey] || "").trim() : "";
          const subVisualFieldId = s.subFieldId || s.fieldId;
          const subTail = visualTailForTag(subVisualFieldId, subTok, s.sectionId);
          tagsBody.push(subCb ? `    - ${subCb} ${subTok}${subTail}` : `    - ${subTok}${subTail}`);
        for (const wlFieldId of Object.keys(parentNodesByFieldId)) {
          const entry = parentNodesByFieldId[wlFieldId] || {};
            const wlField = entry.field || getFieldById(fields, wlFieldId);
            const ownSection = entry.ownSection === true;
            const parentNode = isObj(entry.node) ? entry.node : {};
            const leaf = isObj(parentNode.leaf) ? parentNode.leaf : {};
            const leafArr = pickByDenormToken(leaf, subTok);
            const arr = Array.isArray(leafArr) ? leafArr : [];
            const rowOrder = getWikilinkRowOrder(wlField);
            const orderedLeaf = orderedTokens(arr, rowOrder, (r) => {
              const b = String(r.binding || "").trim();
              return b.indexOf(`s:${subTok}|p:${pTok}`) === 0;
            });
            for (let wi = 0; wi < orderedLeaf.length; wi++) {
              const tokenOut = formatTokenForField(wlField, orderedLeaf[wi]);
              pushSourceLine("        ", tokenOut, wlFieldId, ownSection);
            }
          }
        }
      }
      tagsBody.push("");
    }

    const userTags = Object.keys(userTagVisuals).filter((x) => /^#\S+/.test(String(x || "").trim()));
    if (userTags.length) {
      tagsBody.push("##### User tags");
      for (let i = 0; i < userTags.length; i++) {
        const tok = String(userTags[i] || "").trim();
        tagsBody.push(`- ${tok}${visualTailForUserTag(tok)}`);
      }
      tagsBody.push("");
    }

    const activeWikilinkFieldSet = new Set((Array.isArray(wikilinkFields) ? wikilinkFields : []).map((x) => String(x || "").trim()).filter(Boolean));
    const orphanFieldIds = Object.keys(orphanWikilinks)
      .map((x) => String(x || "").trim())
      .filter((x) => x && activeWikilinkFieldSet.has(x) && Array.isArray(orphanWikilinks[x]) && orphanWikilinks[x].length);
    if (orphanFieldIds.length) {
      tagsBody.push("##### Orphan wikilinks - link");
      const orphanIsMixedWikilinks = orphanFieldIds.length > 1;
      for (let i = 0; i < orphanFieldIds.length; i++) {
        const fieldId = String(orphanFieldIds[i] || "").trim();
        if (!fieldId) continue;
        const wlField = getFieldById(fields, fieldId);
        const vals = Array.isArray(orphanWikilinks[fieldId]) ? orphanWikilinks[fieldId] : [];
        for (let j = 0; j < vals.length; j++) {
          const tokenOut = formatTokenForField(wlField, vals[j]);
          if (!tokenOut) continue;
          if (orphanIsMixedWikilinks) tagsBody.push(`- ${tokenOut} - ${fieldId}`);
          else tagsBody.push(`- ${tokenOut}`);
        }
      }
      tagsBody.push("");
    }

    const sectionOrderDefault = sections.map((x) => x.sectionId);
    const fieldIdToSectionId = { ...sectionIdByFieldId };
    const sectionOrderFromRules = [];
    for (let i = 0; i < prefixRules.priorityTargets.length; i++) {
      const sid = fieldIdToSectionId[prefixRules.priorityTargets[i]];
      if (!sid) continue;
      if (!sectionOrderFromRules.includes(sid)) sectionOrderFromRules.push(sid);
    }
    const sectionOrder = sectionOrderFromRules.length ? sectionOrderFromRules : sectionOrderDefault;

    const prefixSettings = [];
    prefixSettings.push("1. **Main checkbox priority**");
    const modeName = String(prefixRules.priorityMode || "by-section").trim() === "by-checkbox-list" ? "by-checkbox-list" : "by-section";
    const fieldsModeName = String(prefixRules.fieldsOrderMode || "manual").trim() === "auto" ? "auto" : "manual";
    const tagModeName = String(prefixRules.tagSubtagPriority || "subtag-over-tag").trim() === "tag-over-subtag" ? "tag-over-subtag" : "subtag-over-tag";
    prefixSettings.push(`- [${modeName === "by-section" ? "x" : " "}] **by Fields Order** `);
    prefixSettings.push(`\t- [${modeName === "by-section" && fieldsModeName === "auto" ? "x" : " "}] **Automatically** - by plugin settings "Order" (PKM -> Order). Left panel tags > right panel tags, priority decreases from up to down`);
    prefixSettings.push(`\t- [${modeName === "by-section" && fieldsModeName === "manual" ? "x" : " "}] **Manually** - by your settings \`Fields order\` (go below to subheader \`Order\`)`);
    prefixSettings.push(`- [${modeName === "by-checkbox-list" ? "x" : " "}] **by Checkbox Order** - by your settings \`Checkbox order\` below`);
    prefixSettings.push("");
    prefixSettings.push("2. **Tag vs Subtag checkbox priority**");
    prefixSettings.push(`- [${tagModeName === "tag-over-subtag" ? "x" : " "}] **Tag > Subtag** `);
    prefixSettings.push(`- [${tagModeName === "subtag-over-tag" ? "x" : " "}] **Subtag > Tag** `);

    const fieldsOrderItems = [];
    const prefixMeta = cfg && cfg.pkm && cfg.pkm.taxonomy && cfg.pkm.taxonomy.tagWheelConfig
      && isObj(cfg.pkm.taxonomy.tagWheelConfig.prefixResolver)
      ? cfg.pkm.taxonomy.tagWheelConfig.prefixResolver
      : {};
    const rawFieldsOrder = Array.isArray(prefixMeta.fieldsOrderRaw)
      ? prefixMeta.fieldsOrderRaw.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const effectiveFieldsOrder = rawFieldsOrder.length ? rawFieldsOrder : sectionOrder;
    for (let i = 0; i < effectiveFieldsOrder.length; i++) fieldsOrderItems.push(`- ${effectiveFieldsOrder[i]}`);

    const checkboxOrderItems = [];
    const cbOrder = Array.isArray(prefixRules.priorityCheckboxes) ? prefixRules.priorityCheckboxes : [];
    for (let i = 0; i < cbOrder.length; i++) checkboxOrderItems.push(`- ${cbOrder[i]} - \`- ${cbOrder[i]}\``);

    const elementsCfgSource = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.elements)
      ? cfg.pkm.behavior.elements
      : {};
    const legacyDatesCfgSource = isObj(cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.dates)
      ? cfg.pkm.behavior.dates
      : {};
    const legacyDatesByField = isObj(legacyDatesCfgSource.byField) ? legacyDatesCfgSource.byField : {};
    const elementsByField = isObj(elementsCfgSource.byField)
      ? elementsCfgSource.byField
      : {};
    const orderedElementDefs = Array.isArray(collectOrderedElementFields(cfg))
      ? collectOrderedElementFields(cfg)
      : [];
    const dateFieldIds = [];
    const elementFieldIds = [];
    for (let i = 0; i < orderedElementDefs.length; i++) {
      const def = orderedElementDefs[i] || {};
      const key = String(def.orderKey || "").trim();
      if (!key) continue;
      const headingName = String(def.sectionId || key).trim().toLowerCase();
      const looksDateTime = /date|time|дата|время/.test(headingName);
      if (looksDateTime) dateFieldIds.push(key);
      else elementFieldIds.push(key);
    }
    const toIntPos = (v, d) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : d;
    };
    const normInc = (src, fallback) => {
      const inSrc = isObj(src) ? src : {};
      const modeRaw = String(inSrc.mode || "standard").trim().toLowerCase();
      const mode = modeRaw === "custom" || modeRaw === "command" ? modeRaw : "standard";
      let custom = Array.isArray(inSrc.custom)
        ? inSrc.custom.map((x) => toIntPos(x, 0)).filter((x) => Number.isFinite(x))
        : [];
      const customRaw = Array.isArray(inSrc.customRaw)
        ? inSrc.customRaw.map((x) => String(x || "").trim()).filter((x) => x.length)
        : [];
      const incrementBy = toIntPos(inSrc.incrementBy, 0);
      const command = String(inSrc.command || "now").trim() || "now";
      if (!custom.length && Array.isArray(fallback)) custom = fallback.map((x) => toIntPos(x, 0));
      return { mode, custom, customRaw, incrementBy, command };
    };
    const compressSteps = (arr) => {
      const src = Array.isArray(arr) ? arr.map((x) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x) => Number.isFinite(x)) : [];
      if (!src.length) return [];
      const out = [];
      let cur = src[0];
      let count = 1;
      for (let i = 1; i < src.length; i++) {
        if (src[i] === cur) {
          count += 1;
        } else {
          out.push(count > 1 ? `${cur} (${count})` : `${cur}`);
          cur = src[i];
          count = 1;
        }
      }
      out.push(count > 1 ? `${cur} (${count})` : `${cur}`);
      return out;
    };
    const datesLines = [];
    for (let i = 0; i < dateFieldIds.length; i++) {
      const fid = dateFieldIds[i];
      const dateDef = orderedElementDefs.find((x) => String(x && x.orderKey || "").trim() === fid) || {};
      const headingName = String(dateDef.sectionId || fid).trim() || fid;
      const isTimeField = /^time/i.test(fid);
      const fieldCfgBase = isObj(elementsByField[fid]) ? elementsByField[fid] : {};
      const fieldCfgLegacy = isObj(legacyDatesByField[fid]) ? legacyDatesByField[fid] : {};
      const fieldCfg = {
        ...fieldCfgLegacy,
        ...fieldCfgBase,
        increment: {
          ...(isObj(fieldCfgLegacy.increment) ? fieldCfgLegacy.increment : {}),
          ...(isObj(fieldCfgBase.increment) ? fieldCfgBase.increment : {}),
        },
      };
      if (!String(fieldCfg.emoji || "").trim() && String(fieldCfgLegacy.emoji || "").trim()) fieldCfg.emoji = String(fieldCfgLegacy.emoji || "").trim();
      if (!String(fieldCfg.format || "").trim() && String(fieldCfgLegacy.format || "").trim()) fieldCfg.format = String(fieldCfgLegacy.format || "").trim();
      const emoji = String(fieldCfg.emoji || "").trim();
      const formatDefault = isTimeField ? "HH:mm" : "YYYY-MM-DD";
      const format = String(fieldCfg.format || formatDefault).trim() || formatDefault;
      const increment = normInc(fieldCfg.increment, []);
      const customCompressed = compressSteps(increment.custom);
      datesLines.push(`##### ${headingName}`);
      datesLines.push(`- Emoji: ${emoji}`);
      datesLines.push(`- Format: ${format}`);
      const incBy = increment.incrementBy > 0 ? increment.incrementBy : (isTimeField ? 5 : 1);
      datesLines.push("- Behavior:");
      datesLines.push(`  - [${increment.mode === "standard" ? "x" : " "}] increment by (${incBy})`);
      datesLines.push(`  - [${increment.mode === "command" ? "x" : " "}] command (${increment.command || "now"})`);
      datesLines.push(`  - [${increment.mode === "custom" ? "x" : " "}] custom increment`);
      const customToRender = increment.customRaw.length ? increment.customRaw : customCompressed;
      if (customToRender.length) {
        for (let ci = 0; ci < customToRender.length; ci++) {
          datesLines.push(`    ${ci + 1}. ${customToRender[ci]}`);
        }
      } else {
        datesLines.push("    1. ");
      }
      if (i !== dateFieldIds.length - 1) datesLines.push("");
    }

    const elementsLines = [];
    for (let i = 0; i < elementFieldIds.length; i++) {
      const eid = elementFieldIds[i];
      const elementDef = orderedElementDefs.find((x) => String(x && x.orderKey || "").trim() === eid) || {};
      const headingName = String(elementDef.sectionId || eid).trim() || eid;
      const fieldCfgBase = isObj(elementsByField[eid]) ? elementsByField[eid] : {};
      const fieldCfgLegacy = isObj(legacyDatesByField[eid]) ? legacyDatesByField[eid] : {};
      const fieldCfg = {
        ...fieldCfgLegacy,
        ...fieldCfgBase,
        increment: {
          ...(isObj(fieldCfgLegacy.increment) ? fieldCfgLegacy.increment : {}),
          ...(isObj(fieldCfgBase.increment) ? fieldCfgBase.increment : {}),
        },
      };
      if (!String(fieldCfg.emoji || "").trim() && String(fieldCfgLegacy.emoji || "").trim()) fieldCfg.emoji = String(fieldCfgLegacy.emoji || "").trim();
      if (!String(fieldCfg.format || "").trim() && String(fieldCfgLegacy.format || "").trim()) fieldCfg.format = String(fieldCfgLegacy.format || "").trim();
      const increment = normInc(fieldCfg.increment, [1]);
      const emoji = String(fieldCfg.emoji || "").trim();
      const hasOwnFormat = Object.prototype.hasOwnProperty.call(fieldCfg, "format");
      const format = hasOwnFormat ? String(fieldCfg.format ?? "").trim() : "";
      const elementYaml = String((propertiesByField[eid] != null ? propertiesByField[eid] : "") || "").trim();
      elementsLines.push(`##### ${headingName}`);
      elementsLines.push(`- Emoji: ${emoji}`);
      elementsLines.push(`- Format: ${format}`);
      if (elementYaml) elementsLines.push(`- YAML: ${elementYaml}`);
      elementsLines.push("- Behavior:");
      elementsLines.push(`  - [${increment.mode === "standard" ? "x" : " "}] increment by (${Math.max(1, Math.trunc(Number(increment.incrementBy || 1)))})`);
      elementsLines.push(`  - [${increment.mode === "command" ? "x" : " "}] command (${increment.command || "now"})`);
      elementsLines.push(`  - [${increment.mode === "custom" ? "x" : " "}] custom increment`);
      if (Array.isArray(increment.customRaw) && increment.customRaw.length) {
        for (let ci = 0; ci < increment.customRaw.length; ci++) {
          elementsLines.push(`    ${ci + 1}. ${increment.customRaw[ci]}`);
        }
      } else if (Array.isArray(increment.custom) && increment.custom.length) {
        for (let ci = 0; ci < increment.custom.length; ci++) {
          elementsLines.push(`    ${ci + 1}. ${increment.custom[ci]}`);
        }
      } else {
        elementsLines.push("    1. ");
      }
      if (i !== elementFieldIds.length - 1) elementsLines.push("");
    }

    const parts = {
      IMPORTANT: TAGWHEEL_IMPORTANT_LINE,
      SETTINGS_HEADER: "## Settings",
      TAGS: tagsBody.join("\n").trim(),
      WIKILINK_FIELDS: wikilinkFields.map((x) => `- ${x}`).join("\n").trim(),
      PREFIX_SETTINGS: prefixSettings.join("\n").trim(),
      FIELDS_ORDER_ITEMS: fieldsOrderItems.join("\n").trim(),
      CHECKBOX_ORDER_ITEMS: checkboxOrderItems.join("\n").trim(),
      DATES: datesLines.join("\n").trim(),
      ELEMENTS: [datesLines.join("\n").trim(), elementsLines.join("\n").trim()].filter(Boolean).join("\n\n").trim(),
      ELEMENTS_ONLY: elementsLines.join("\n").trim(),
    };

    const minimalLines = [];
    minimalLines.push(TAGWHEEL_IMPORTANT_LINE);
    minimalLines.push("---");
    minimalLines.push("## Settings");
    minimalLines.push(`### ${CFG_H2_TAGS}`);
    minimalLines.push(parts.TAGS);
    minimalLines.push("");
    minimalLines.push(`### ${TAGWHEEL_PREFIX_RESOLVER_H3}`);
    minimalLines.push("#### Settings");
    minimalLines.push(parts.PREFIX_SETTINGS);
    minimalLines.push("#### Order");
    minimalLines.push("1.  **Fields Order:**");
    if (parts.FIELDS_ORDER_ITEMS) minimalLines.push(parts.FIELDS_ORDER_ITEMS);
    minimalLines.push("");
    minimalLines.push("2. **Checkbox Order:**");
    if (parts.CHECKBOX_ORDER_ITEMS) minimalLines.push(parts.CHECKBOX_ORDER_ITEMS);
    minimalLines.push("");
    minimalLines.push(`### ${CFG_H2_DATES}`);
    minimalLines.push(parts.DATES);
    minimalLines.push("");
    minimalLines.push(`### ${CFG_H2_ELEMENTS}`);
    minimalLines.push(parts.ELEMENTS);
    parts.MINIMAL_FULL = minimalLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    return parts;
  }

  function buildTagWheelConfigMarkdown(cfg, mode) {
    const parts = buildTagWheelConfigParts(cfg);
    const exportMode = String(mode || "detailed").trim() === "minimal"
      ? "minimal"
      : "detailed";
    if (exportMode === "minimal") {
      return String(parts.MINIMAL_FULL || "");
    }
    return String(parts.MINIMAL_FULL || "");
  }

  function parseTagWheelConfigMarkdown(md, cfg) {
    if (!__configParser) {
      const parserFactory = typeof createTagWheelConfigParser === "function"
        ? createTagWheelConfigParser
        : null;
      if (!parserFactory) throw new Error("TagWheel config parser module unavailable");
      __configParser = parserFactory({
        isObj,
        collectTagSections,
        collectWikilinkFieldIds,
        parseCustomPrefixResolverBlock,
        isWikilinkToken,
        parseWikilinkLineStrict,
        extractFirstTagToken,
        parseCheckboxAndTag,
        denormTagToken,
        getOrderStrictName,
        CFG_H1_SETTINGS,
        CFG_H2_DATES,
        CFG_H2_ELEMENTS,
        CFG_H2_ELEMENTS_COMBINED,
        TAGWHEEL_PREFIX_RESOLVER_SECTION,
        TAGWHEEL_WIKILINK_SECTION,
      });
    }
    return __configParser(md, cfg);
  }

  return {
    normalizeTagWheelConfigPath,
    normalizeTagWheelConfigTemplatePath,
    buildDefaultTagWheelDetailedTemplateMarkdown,
    renderTagWheelConfigFromTemplate,
    buildMinimalFromRenderedTemplate,
    buildTagWheelConfigParts,
    buildTagWheelConfigMarkdown,
    parseTagWheelConfigMarkdown,
  };
}

module.exports = {
  createTagWheelConfigCodec,
};
