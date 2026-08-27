"use strict";

const fs = require("fs");
const path = require("path");

function assertTrue(v, name) {
  if (!v) throw new Error(name + ": expected truthy");
}

function assertFalse(v, name) {
  if (v) throw new Error(name + ": expected falsy");
}

function assertEq(actual, expected, name) {
  if (actual !== expected) {
    throw new Error(name + ": expected '" + expected + "' got '" + actual + "'");
  }
}

function assertAnyMatch(source, patterns, name) {
  const src = String(source || "");
  const list = Array.isArray(patterns) ? patterns : [];
  for (const p of list) {
    if (p && p.test(src)) return;
  }
  throw new Error(name + ": expected at least one pattern to match");
}

function collectDeclaredIdentifiers(source) {
  const src = String(source || "");
  const out = new Set();
  const RESERVED = new Set(["true", "false", "null", "undefined", "NaN", "Infinity", "return", "if", "else", "for", "while", "switch", "case", "default", "function", "const", "let", "var"]);
  const addName = (name) => {
    const n = String(name || "").trim();
    if (!n) return;
    if (!/^[A-Za-z_$][\w$]*$/.test(n)) return;
    if (RESERVED.has(n)) return;
    out.add(n);
  };
  const addParamNames = (rawParam) => {
    const p = String(rawParam || "").replace(/=.*$/, "").trim();
    if (!p) return;
    if (/^[A-Za-z_$][\w$]*$/.test(p)) {
      addName(p);
      return;
    }
    if (/^\{[\s\S]*\}$/.test(p)) {
      let mm;
      const aliasRe = /\b([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\b/g;
      while ((mm = aliasRe.exec(p))) addName(mm[2]);
      const keyRe = /\b([A-Za-z_$][\w$]*)\b/g;
      while ((mm = keyRe.exec(p))) addName(mm[1]);
    }
  };

  let m;
  const fnDeclRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fnDeclRe.exec(src))) addName(m[1]);

  const fnAnyRe = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
  while ((m = fnAnyRe.exec(src))) {
    const raw = String(m[1] || "");
    const parts = raw.split(",");
    for (let i = 0; i < parts.length; i++) {
      addParamNames(parts[i]);
    }
  }

  const varRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g;
  while ((m = varRe.exec(src))) addName(m[1]);

  const arrowOneRe = /\b([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = arrowOneRe.exec(src))) addName(m[1]);

  const arrowManyRe = /\(([^)]*)\)\s*=>/g;
  while ((m = arrowManyRe.exec(src))) {
    const raw = String(m[1] || "");
    const parts = raw.split(",");
    for (let i = 0; i < parts.length; i++) {
      addParamNames(parts[i]);
    }
  }

  return out;
}

function findSuspiciousObjectValueRefs(source) {
  const src = String(source || "");
  const declared = collectDeclaredIdentifiers(src);
  const suspicious = [];
  const ignore = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
  const pairRe = /\b([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g;
  let m;
  while ((m = pairRe.exec(src))) {
    const lhs = String(m[1] || "").trim();
    const rhs = String(m[2] || "").trim();
    if (!lhs || !rhs) continue;
    if (lhs !== rhs) continue;
    if (!rhs || ignore.has(rhs)) continue;
    if (declared.has(rhs)) continue;
    const upTo = src.slice(0, m.index);
    const lineNo = upTo.split(/\r?\n/).length;
    suspicious.push({ line: lineNo, expr: String(m[0] || "").trim() });
  }
  return suspicious;
}

function assertNoDanglingObjectValueRefs(source, name) {
  const bad = findSuspiciousObjectValueRefs(source);
  if (!bad.length) return;
  const top = bad.slice(0, 6).map((x) => `L${x.line}:${x.expr}`).join(", ");
  throw new Error(name + ": dangling object value refs detected: " + top);
}

function assertNoCanonicalOrderKeyLiteralsInRuntime(filePath, source) {
  const src = String(source || "");
  const banned = [
    /"importance"|'importance'/g,
    /"type"|'type'/g,
    /"category"|'category'/g,
    /"project"|'project'/g,
    /"date_due"|'date_due'/g,
    /"date_start"|'date_start'/g,
    /"type_sub"|'type_sub'/g,
    /"category_sub"|'category_sub'/g,
  ];
  const hits = [];
  for (const rx of banned) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(src)) !== null) {
      const idx = Number(m.index || 0);
      const line = src.slice(0, idx).split(/\r?\n/).length;
      hits.push(`L${line}:${String(m[0] || "")}`);
      if (hits.length >= 8) break;
    }
    if (hits.length >= 8) break;
  }
  if (hits.length) {
    throw new Error(`${filePath}: forbidden canonical key literals in runtime: ${hits.join(", ")}`);
  }
}

async function run() {
  const mainPath = path.join(__dirname, "..", "..", "main.js");
  const codecPath = path.join(__dirname, "..", "..", "src", "features", "tagwheel_config_codec.js");
  const parserPath = path.join(__dirname, "..", "..", "src", "features", "tagwheel_config_parser.js");
  const codecFallbackPath = path.join(__dirname, "..", "..", "src", "features", "tagwheel_config_codec_fallback.js");
  const configMigrationPath = path.join(__dirname, "..", "..", "src", "core", "config_migration.js");
  const runtimeLiteralGuardPaths = [
    path.join(__dirname, "..", "..", "main.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "status_tags.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "status_date.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel_core.js"),
    path.join(__dirname, "..", "..", "src", "core", "pkm_rules_runtime_helpers.js"),
    path.join(__dirname, "..", "..", "src", "core", "date_runtime_shared.js"),
    path.join(__dirname, "..", "..", "src", "core", "tagwheel_rules_normalizer.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "field_model.js"),
  ];
  const linePipelinePath = path.join(__dirname, "..", "..", "src", "core", "line_pipeline.js");
  const pkmMacroSharedPath = path.join(__dirname, "..", "..", "src", "core", "pkm_macro_shared.js");
  const pkmRulesHelpersPath = path.join(__dirname, "..", "..", "src", "core", "pkm_rules_runtime_helpers.js");
  const pkmRuntimeBootstrapPath = path.join(__dirname, "..", "..", "src", "core", "pkm_runtime_bootstrap.js");
  const pkmRuntimePreloadFacadePath = path.join(__dirname, "..", "..", "src", "core", "pkm_runtime_preload_facade.js");
  const pkmMacroRuntimeEntryPath = path.join(__dirname, "..", "..", "src", "core", "pkm_macro_runtime_entry.js");
  const pkmMacroRuntimeSharedPath = path.join(__dirname, "..", "..", "src", "core", "pkm_macro_runtime_shared.js");
  const pkmLineFinalizeUnifiedPath = path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js");
  const pkmDomainRegistryPath = path.join(__dirname, "..", "..", "src", "core", "pkm_domain_registry.js");
  const fieldModelPath = path.join(__dirname, "..", "..", "pkm_v2", "field_model.js");
  const navigationRuntimePath = path.join(__dirname, "..", "..", "navigation_runtime.js");
  const statusRuntimeCommonPath = path.join(__dirname, "..", "..", "src", "core", "status_runtime_common.js");
  const statusLineRuntimeUnifiedPath = path.join(__dirname, "..", "..", "src", "core", "status_line_runtime_unified.js");
  const pkmRuntimeV2Path = path.join(__dirname, "..", "..", "pkm_runtime_v2.js");
  const vaultBridgePath = path.join(__dirname, "..", "..", "src", "core", "vault_module_bridge.js");
  const configNoteOrchestratorPath = path.join(__dirname, "..", "..", "src", "features", "config_note_orchestrator.js");
  const configNoteHelpersPath = path.join(__dirname, "..", "..", "src", "features", "config_note_helpers.js");
  const commandRegistryPath = path.join(__dirname, "..", "..", "src", "features", "command_registry.js");
  const settingsSectionsRendererPath = path.join(__dirname, "..", "..", "src", "ui", "settings_sections_renderer.js");
  const priorityStripEnginePath = path.join(__dirname, "..", "..", "src", "core", "priority_strip_engine.js");
  const priorityStripAdapterPath = path.join(__dirname, "..", "..", "src", "core", "priority_strip_cm6_adapter.js");
  const statusTagsPath = path.join(__dirname, "..", "..", "pkm_v2", "status_tags.js");
  const statusDatePath = path.join(__dirname, "..", "..", "pkm_v2", "status_date.js");
  const tagwheelPath = path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel.js");
  const tagwheelCorePath = path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel_core.js");
  const src = fs.readFileSync(mainPath, "utf8");
  const codecSrc = fs.readFileSync(codecPath, "utf8");
  const parserSrc = fs.readFileSync(parserPath, "utf8");
  const codecFallbackSrc = fs.readFileSync(codecFallbackPath, "utf8");
  const configMigrationSrc = fs.readFileSync(configMigrationPath, "utf8");
  const linePipelineSrc = fs.readFileSync(linePipelinePath, "utf8");
  const pkmMacroSharedSrc = fs.readFileSync(pkmMacroSharedPath, "utf8");
  const pkmRulesHelpersSrc = fs.readFileSync(pkmRulesHelpersPath, "utf8");
  const pkmRuntimeBootstrapSrc = fs.readFileSync(pkmRuntimeBootstrapPath, "utf8");
  const pkmRuntimePreloadFacadeSrc = fs.readFileSync(pkmRuntimePreloadFacadePath, "utf8");
  const pkmMacroRuntimeEntrySrc = fs.readFileSync(pkmMacroRuntimeEntryPath, "utf8");
  const pkmMacroRuntimeSharedSrc = fs.readFileSync(pkmMacroRuntimeSharedPath, "utf8");
  const pkmLineFinalizeUnifiedSrc = fs.readFileSync(pkmLineFinalizeUnifiedPath, "utf8");
  const pkmDomainRegistrySrc = fs.readFileSync(pkmDomainRegistryPath, "utf8");
  const fieldModelSrc = fs.readFileSync(fieldModelPath, "utf8");
  const navigationRuntimeSrc = fs.readFileSync(navigationRuntimePath, "utf8");
  const statusRuntimeCommonSrc = fs.readFileSync(statusRuntimeCommonPath, "utf8");
  const statusLineRuntimeUnifiedSrc = fs.readFileSync(statusLineRuntimeUnifiedPath, "utf8");
  const pkmRuntimeV2Src = fs.readFileSync(pkmRuntimeV2Path, "utf8");
  const vaultBridgeSrc = fs.readFileSync(vaultBridgePath, "utf8");
  const configNoteOrchestratorSrc = fs.readFileSync(configNoteOrchestratorPath, "utf8");
  const configNoteHelpersSrc = fs.readFileSync(configNoteHelpersPath, "utf8");
  const commandRegistrySrc = fs.readFileSync(commandRegistryPath, "utf8");
  const settingsSectionsRendererSrc = fs.readFileSync(settingsSectionsRendererPath, "utf8");
  /*
   * Редактор Fields и его помощники переехали в слой настроек (фаза 3b, пункт
   * 2), а записи в конфиг оттуда — в модель (пункт 4). Старая панель зовёт их
   * оттуда же, поэтому проверки по тексту читают три файла как один:
   * разделение файлов — не изменение поведения.
   */
  const fieldsEditorLegacySrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "ui", "settings", "custom", "fields_editor_legacy.js"), "utf8");
  const fieldsModelSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "ui", "settings", "custom", "fields_model.ts"), "utf8");
  const rendererPairSrc = settingsSectionsRendererSrc + "\n" + fieldsEditorLegacySrc + "\n" + fieldsModelSrc;
  const priorityStripEngineSrc = fs.readFileSync(priorityStripEnginePath, "utf8");
  const priorityStripAdapterSrc = fs.readFileSync(priorityStripAdapterPath, "utf8");
  for (const guardPath of runtimeLiteralGuardPaths) {
    const guardSrc = fs.readFileSync(guardPath, "utf8");
    assertNoCanonicalOrderKeyLiteralsInRuntime(path.relative(path.join(__dirname, "..", ".."), guardPath), guardSrc);
  }
  const statusTagsSrc = fs.readFileSync(statusTagsPath, "utf8");
  const statusDateSrc = fs.readFileSync(statusDatePath, "utf8");
  const tagwheelSrc = fs.readFileSync(tagwheelPath, "utf8");
  const tagwheelCoreSrc = fs.readFileSync(tagwheelCorePath, "utf8");

  assertTrue(/function\s+enforceOffModeFinalPrefix\(/.test(statusTagsSrc), "status_tags has off-mode final prefix guard");
  assertTrue(/lineFinalize\.enforceOffModeFinalPrefixUnified\(/.test(statusTagsSrc), "status_tags delegates off-mode final prefix behavior to shared core");
  assertTrue(/function\s+enforceOffModeFinalPrefixUnified\(/.test(pkmLineFinalizeUnifiedSrc), "shared finalize core owns off-mode final prefix behavior");
  assertTrue(/finalize\.enforceOffModeFinalPrefixUnified\(/.test(tagwheelSrc), "tagwheel delegates off-mode final prefix behavior to shared core");
  assertFalse(/function\s+enforceOffModeFinalPrefixTagWheel\(/.test(tagwheelSrc), "tagwheel does not duplicate off-mode final prefix behavior");

  assertNoDanglingObjectValueRefs(statusTagsSrc, "status_tags dangling-ref guard");
  assertNoDanglingObjectValueRefs(statusDateSrc, "status_date dangling-ref guard");
  assertNoDanglingObjectValueRefs(tagwheelSrc, "tagwheel dangling-ref guard");
  assertNoDanglingObjectValueRefs(tagwheelCoreSrc, "tagwheel_core dangling-ref guard");
  const linePipeline = require(linePipelinePath);
  const pkmMacroShared = require(pkmMacroSharedPath);
  const pkmMacroRuntimeShared = require(pkmMacroRuntimeSharedPath);
  const pkmMacroRuntimeEntry = require(pkmMacroRuntimeEntryPath);
  const pkmRulesHelpers = require(pkmRulesHelpersPath);
  const configMigration = require(configMigrationPath);
  const pkmRuntimeV2 = require(pkmRuntimeV2Path);
  const tagwheelCore = require(tagwheelCorePath);
  const lineFinalizerUnified = require(pkmLineFinalizeUnifiedPath);
  const tagwheelConfigParser = require(parserPath);
  const configNoteHelpers = require(configNoteHelpersPath);
  const priorityStripEngine = require(priorityStripEnginePath);
  const priorityStripAdapter = require(priorityStripAdapterPath);

  assertTrue(/buildStripSpecs\(/.test(priorityStripEngineSrc), "priority strip engine exports buildStripSpecs");
  assertTrue(/normalizeStripConfig\(/.test(priorityStripEngineSrc), "priority strip engine exports normalizeStripConfig");
  assertTrue(/buildStripDecorationRanges\(/.test(priorityStripAdapterSrc), "priority strip cm6 adapter exports buildStripDecorationRanges");
  assertTrue(typeof priorityStripEngine.buildStripSpecs === "function", "priority strip engine runtime export buildStripSpecs");
  assertTrue(typeof priorityStripEngine.normalizeStripConfig === "function", "priority strip engine runtime export normalizeStripConfig");
  assertTrue(typeof priorityStripAdapter.buildStripDecorationRanges === "function", "priority strip adapter runtime export buildStripDecorationRanges");

  assertEq(lineFinalizerUnified.normalizeCheckboxToken("[]"), "[ ]", "shared checkbox normalizer maps [] to [ ]");
  assertEq(lineFinalizerUnified.normalizeCheckboxToken("[   ]"), "[ ]", "shared checkbox normalizer trims blank checkbox token");
  assertEq(lineFinalizerUnified.normalizeCheckboxToken("[I]"), "[I]", "shared checkbox normalizer preserves non-empty token");

  const helpersFixture = configNoteHelpers.createConfigNoteHelpers({
    normalizePkmOrder: (x) => x || { left: [], right: [], enabled: {}, strictNames: {} },
    getOrderStrictName: (cfg, key) => {
      const strict = cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.order && cfg.pkm.behavior.order.strictNames
        ? cfg.pkm.behavior.order.strictNames
        : {};
      return strict[key] || key;
    },
  });
  const helperCfgFixture = {
    pkm: {
      behavior: {
        order: {
          left: ["type"],
          right: ["client1", "clients"],
          strictNames: { type: "type", client1: "client1", clients: "clients" },
        },
        leftMode: {
          fields: [
            { id: "type", prefix: "#", kind: "tag" },
          ],
        },
        rightMode: {
          fields: [
            { id: "client1", prefix: "#", kind: "tag" },
            { id: "clients", source: "wikilinks:clients", kind: "tag" },
          ],
        },
      },
    },
  };
  const helperSections = helpersFixture.collectTagSections(helperCfgFixture).map((x) => x.sectionId);
  assertEq(JSON.stringify(helperSections), JSON.stringify(["type", "client1", "clients"]), "config helpers collectTagSections includes ordered right-panel tag/wikilink sections");
  const helperWikilinks = helpersFixture.collectWikilinkFieldIds(helperCfgFixture);
  assertEq(JSON.stringify(helperWikilinks), JSON.stringify(["clients"]), "config helpers collectWikilinkFieldIds includes right-panel wikilink fields");

  const parserFixture = tagwheelConfigParser.createTagWheelConfigParser({
    isObj: (x) => x && typeof x === "object" && !Array.isArray(x),
    collectTagSections: () => ([
      { sectionId: "type", fieldId: "type", subFieldId: "type_sub" },
      { sectionId: "clients", fieldId: "clients", subFieldId: "" },
    ]),
    collectWikilinkFieldIds: (cfg) => {
      const out = [];
      const pushFieldId = (field) => {
        const f = field && typeof field === "object" ? field : {};
        const id = String(f.id || "").trim();
        if (!id || out.indexOf(id) !== -1) return;
        const source = String(f.source || "").trim();
        if (source === "projects" || source.indexOf("wikilinks:") === 0) out.push(id);
      };
      const left = cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.leftMode && Array.isArray(cfg.pkm.behavior.leftMode.fields)
        ? cfg.pkm.behavior.leftMode.fields
        : [];
      const right = cfg && cfg.pkm && cfg.pkm.behavior && cfg.pkm.behavior.rightMode && Array.isArray(cfg.pkm.behavior.rightMode.fields)
        ? cfg.pkm.behavior.rightMode.fields
        : [];
      for (let i = 0; i < left.length; i++) pushFieldId(left[i]);
      for (let i = 0; i < right.length; i++) pushFieldId(right[i]);
      return out;
    },
    parseCustomPrefixResolverBlock: () => null,
    isWikilinkToken: (text) => /^\[\[[^\]]+\]\](?:\s*-\s*[A-Za-z0-9_\-]+)?$/.test(String(text || "").trim()),
    parseWikilinkLineStrict: (text, secName, line, allowed, options) => {
      const m = String(text || "").trim().match(/^\[\[([^\]]+)\]\](?:\s*-\s*([A-Za-z0-9_\-]+))?$/);
      if (!m) throw new Error(`Section #### ${secName}, line ${line}: invalid wikilink line`);
      const allowedFields = Array.isArray(allowed) ? allowed.map((x) => String(x || "").trim()).filter(Boolean) : [];
      const explicit = String(m[2] || "").trim();
      const requireExplicit = !!(options && options.requireExplicitFieldId === true);
      if (requireExplicit && !explicit) {
        throw new Error(`Section #### ${secName}, line ${line}: field id is required for wikilink in mixed tag/wikilink section`);
      }
      if (!explicit && allowedFields.length > 1) {
        throw new Error(`Section #### ${secName}, line ${line}: field id is required for wikilink when multiple fields are available (${allowedFields.join(", ")})`);
      }
      const fieldId = explicit || String(allowedFields[0] || "").trim();
      if (!fieldId) throw new Error(`Section #### ${secName}, line ${line}: no wikilink fields are configured`);
      return { token: String(m[1] || "").trim(), fieldId };
    },
    extractFirstTagToken: (text) => {
      const m = String(text || "").match(/#\S+/);
      return m ? String(m[0]) : "";
    },
    parseCheckboxAndTag: () => ({ checkbox: "" }),
    denormTagToken: (token) => String(token || "").trim(),
    getOrderStrictName: (fieldId) => {
      const id = String(fieldId || "").trim();
      if (id === "date_due" || id === "due") return "date_due";
      if (id === "date_start" || id === "start") return "date_start";
      if (id === "time" || id === "timeNow" || id === "estimated") return "time";
      return id;
    },
    CFG_H1_SETTINGS: "Settings",
    CFG_H2_DATES: "DATES+TIME",
    CFG_H2_ELEMENTS: "ELEMENTS",
    CFG_H2_ELEMENTS_COMBINED: "DATE/TIME + ELEMENTS",
    TAGWHEEL_PREFIX_RESOLVER_SECTION: "PREFIX RESOLVER",
    TAGWHEEL_WIKILINK_SECTION: "WIKILINKS",
  });

  const mdFixture = [
    "## Settings",
    "- separator1: ||",
    "- separator2: ||",
    "### TAGS/SUBTAGS + WIKILINKS",
    "#### type",
    "- #todo",
    "#### clients",
    "- [[ClientA]]",
    "##### Orphan wikilinks - link",
    "- [[ClientOrphan]] - clients",
    "### PREFIX RESOLVER",
    "- mode: by-section",
    "- section-order: type, clients",
    "### `📅DATE/🕑TIME ➕ELEMENTS`",
    "##### date_due",
    "- Emoji: 📅",
    "##### date_start",
    "- Emoji: 🛫",
    "##### time",
    "- Emoji: 🕒",
    "",
  ].join("\n");
  const parsedFixture = parserFixture(mdFixture, {
    pkm: {
      behavior: {
        leftMode: {
          fields: [
            { id: "project", source: "projects" },
            { id: "clients", source: "wikilinks:clients" },
            { id: "type", source: "tags" },
          ],
        },
        rightMode: {
          fields: [
            { id: "due", kind: "dateOffset" },
            { id: "start", kind: "dateOffset" },
            { id: "timeNow", kind: "nowTime" },
          ],
        },
      },
    },
  });
  assertTrue(!!(parsedFixture.sections && parsedFixture.sections.clients), "config parser behavior: clients section parsed");
  assertTrue(!!(parsedFixture.sections && parsedFixture.sections.clients && parsedFixture.sections.clients.wikilinks && parsedFixture.sections.clients.wikilinks.clients), "config parser behavior: clients wikilink defaults are section-scoped");
  assertTrue(Array.isArray(parsedFixture.orphanWikilinks && parsedFixture.orphanWikilinks.clients) && parsedFixture.orphanWikilinks.clients.indexOf("ClientOrphan") !== -1, "config parser behavior: orphan wikilinks section is parsed and mapped by field id");
  const byFieldDateFixture = parsedFixture && parsedFixture.datesConfig && parsedFixture.datesConfig.byField && typeof parsedFixture.datesConfig.byField === "object"
    ? parsedFixture.datesConfig.byField
    : {};
  const byFieldElemFixture = parsedFixture && parsedFixture.elementsConfig && parsedFixture.elementsConfig.byField && typeof parsedFixture.elementsConfig.byField === "object"
    ? parsedFixture.elementsConfig.byField
    : {};
  assertTrue(Object.keys(byFieldDateFixture).length + Object.keys(byFieldElemFixture).length > 0, "config parser behavior: combined DATE/TIME + ELEMENTS block is parsed into field config maps");

  const mdMixedNoFieldSingle = [
    "## Settings",
    "- separator1: ||",
    "- separator2: ||",
    "### TAGS/SUBTAGS + WIKILINKS",
    "#### type",
    "- #team",
    "- [[ClientA]]",
    "### PREFIX RESOLVER",
    "- mode: by-section",
    "- section-order: type",
  ].join("\n");
  const parsedMixedSingle = parserFixture(mdMixedNoFieldSingle, {
    pkm: {
      behavior: {
        leftMode: { fields: [{ id: "clients", source: "wikilinks:clients" }] },
        rightMode: { fields: [] },
      },
    },
  });
  assertTrue(
    !!(parsedMixedSingle.sections && parsedMixedSingle.sections.type && parsedMixedSingle.sections.type.wikilinks && parsedMixedSingle.sections.type.wikilinks.clients),
    "config parser behavior: mixed tag+wikilink section allows wikilink without explicit field when link target is unambiguous"
  );

  const mdMixedNoFieldAmbiguous = [
    "## Settings",
    "- separator1: ||",
    "- separator2: ||",
    "### TAGS/SUBTAGS + WIKILINKS",
    "#### type",
    "- #team",
    "- [[ClientA]]",
    "### PREFIX RESOLVER",
    "- mode: by-section",
    "- section-order: type",
  ].join("\n");
  let mixedFailMsg = "";
  try {
    parserFixture(mdMixedNoFieldAmbiguous, {
      pkm: {
        behavior: {
          leftMode: {
            fields: [
              { id: "clients", source: "wikilinks:clients" },
              { id: "project", source: "projects" },
            ],
          },
          rightMode: { fields: [] },
        },
      },
    });
  } catch (e) {
    mixedFailMsg = String(e && e.message ? e.message : e || "");
  }
  assertTrue(/field id is required for wikilink/i.test(mixedFailMsg), "config parser behavior: mixed tag+wikilink section requires explicit field id only when link target is ambiguous");

  const mdOrphanNoFieldSingle = [
    "## Settings",
    "- separator1: ||",
    "- separator2: ||",
    "### TAGS/SUBTAGS + WIKILINKS",
    "#### clients",
    "- [[ClientA]]",
    "##### Orphan wikilinks",
    "- [[ClientOrphan]]",
    "### PREFIX RESOLVER",
    "- mode: by-section",
    "- section-order: clients",
  ].join("\n");
  const parsedOrphanSingle = parserFixture(mdOrphanNoFieldSingle, {
    pkm: {
      behavior: {
        leftMode: { fields: [{ id: "clients", source: "wikilinks:clients" }] },
        rightMode: { fields: [] },
      },
    },
  });
  const orphanSingleKeys = Object.keys(parsedOrphanSingle.orphanWikilinks || {});
  const orphanSingleHasValue = orphanSingleKeys.some((k) => {
    const arr = Array.isArray(parsedOrphanSingle.orphanWikilinks[k]) ? parsedOrphanSingle.orphanWikilinks[k] : [];
    return arr.indexOf("ClientOrphan") !== -1 || arr.indexOf("[[ClientOrphan]]") !== -1;
  });
  assertTrue(
    orphanSingleHasValue,
    "config parser behavior: orphan link section allows wikilink without explicit field id"
  );
  assertTrue(
    Array.isArray(parsedOrphanSingle.sectionOrder) && parsedOrphanSingle.sectionOrder.indexOf("Orphan wikilinks") !== -1,
    "config parser behavior: orphan link section participates in parsed section order"
  );

  const mdOrphanNoFieldMultiGlobal = [
    "## Settings",
    "- separator1: ||",
    "- separator2: ||",
    "### TAGS/SUBTAGS + WIKILINKS",
    "#### clients",
    "- [[ClientA]]",
    "##### Orphan wikilinks - link",
    "- [[ClientOrphan]]",
    "### PREFIX RESOLVER",
    "- mode: by-section",
    "- section-order: clients",
  ].join("\n");
  const parsedOrphanMultiGlobal = parserFixture(mdOrphanNoFieldMultiGlobal, {
    pkm: {
      behavior: {
        leftMode: {
          fields: [
            { id: "clients", source: "wikilinks:clients" },
            { id: "project", source: "projects" },
          ],
        },
        rightMode: { fields: [] },
      },
    },
  });
  const orphanMultiKeys = Object.keys(parsedOrphanMultiGlobal.orphanWikilinks || {});
  const orphanMultiHasValue = orphanMultiKeys.some((k) => {
    const arr = Array.isArray(parsedOrphanMultiGlobal.orphanWikilinks[k]) ? parsedOrphanMultiGlobal.orphanWikilinks[k] : [];
    return arr.indexOf("ClientOrphan") !== -1 || arr.indexOf("[[ClientOrphan]]") !== -1;
  });
  assertTrue(
    orphanMultiHasValue,
    "config parser behavior: orphan link section remains unambiguous by section context even with multiple global link fields"
  );

  assertTrue(/async function loadSharedUtilsSafe\(app\)/.test(src), "shared safe loader exists");
  assertTrue(/await loadSharedUtilsSafe\(this\.app\);/.test(src), "shared safe loader called in onload");
  assertTrue(/async function loadConfigStoreModuleSafe\(app\)/.test(src), "config store safe loader exists");
  assertTrue(/await loadConfigStoreModuleSafe\(this\.app\);/.test(src), "config store safe loader called in onload");
  assertTrue(/function getConfigStoreCtor\(\)/.test(src), "config store ctor getter exists");
  assertTrue(/class FallbackConfigStore/.test(src), "fallback config store class exists");
  assertTrue(/separator1:\s*"\|\|"/.test(src), "default config contains separator1");
  assertFalse(/`📅DATE\/🕑TIME ➕ELEMENTS`/.test(src), "main has no hardcoded emoji section title for date\/time elements");
  assertFalse(/isTimeLike \? "🕒" : \(isDateLike \? "📅" : ""\)/.test(src), "main infer-element defaults have no hardcoded emoji markers");
  assertTrue(/separator2:\s*"\|\|"/.test(src), "default config contains separator2");
  assertTrue(/replace\(/.test(src) && /\\s\+/.test(src), "order key normalizer collapses whitespace");
  assertTrue(/\^\[a-z0-9_\\- \]\+\$/.test(src), "order key validators allow space-containing field ids");
  assertTrue(/function makeDefaultPkmOrder\(\)/.test(src), "default order factory exists");
  assertTrue(/left:\s*\[\]/.test(src), "default order config starts empty left");
  assertTrue(/right:\s*\[\]/.test(src), "default order config starts empty right");
  assertTrue(/hotkey_only/.test(src), "order active mode supports hotkey_only");
  assertTrue(/async function loadRulesSyncOrchestratorSafe\(app\)/.test(src), "rules sync orchestrator safe loader exists");
  assertTrue(/await loadRulesSyncOrchestratorSafe\(this\.app\);/.test(src), "rules sync orchestrator safe loader called in onload");
  assertTrue(/function getRulesSyncOrchestrator\(\)/.test(src), "rules sync orchestrator getter exists");
  assertTrue(/async function loadStoreEventsOrchestratorSafe\(app\)/.test(src), "store events orchestrator safe loader exists");
  assertTrue(/await loadStoreEventsOrchestratorSafe\(this\.app\);/.test(src), "store events orchestrator safe loader called in onload");
  assertTrue(/function getStoreEventsOrchestrator\(\)/.test(src), "store events orchestrator getter exists");

  assertTrue(/async function loadModuleWithVaultFallback\(app, opts\)/.test(src), "shared vault fallback loader helper exists");
  assertTrue(/function reportLoaderFallback\(stage, err\)/.test(src), "main exposes debug-gated loader fallback reporter");
  assertTrue(/let __safeModuleCache = new Map\(\);/.test(src), "safe module cache exists");
  assertTrue(/const cacheKey = String\(options\.cacheKey \|\| ""\)\.trim\(\);/.test(src), "shared loader supports cache key");
  assertTrue(/__safeModuleCache\.set\(cacheKey, mod\)/.test(src), "shared loader caches validated modules");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/core\/shared_utils\.js"/.test(src), "shared utils uses shared vault fallback helper");
  assertTrue(/cacheKey: "core:shared-utils"/.test(src), "shared utils cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/core\/config_store\.js"/.test(src), "config store uses shared vault fallback helper");
  assertTrue(/cacheKey: "core:config-store"/.test(src), "config store cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/navigation_runtime\.js"/.test(src), "navigation runtime uses shared vault fallback helper");
  assertTrue(/cacheKey: "runtime:navigation"/.test(src), "navigation cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/pkm_runtime_v2\.js"/.test(src), "pkm runtime v2 uses shared vault fallback helper");
  assertTrue(/cacheKey: "runtime:pkm-v2"/.test(src), "pkm runtime cache key wired");
  assertTrue(/const sectionIsMixedWikilinks = sectionWikilinkFieldIds\.length > 1;/.test(codecSrc), "config codec generate uses mixed-context detection for wikilink field-id rendering");
  assertTrue(/if \(!sectionIsMixedWikilinks\) \{[\s\S]*?tagsBody\.push\(`\$\{indent\}- \$\{tokenOut\}`\);/.test(codecSrc), "config codec generate omits explicit field id in unambiguous section contexts");
  assertTrue(/if \(!hasOwnSourceNode && !parents\.length\) tagsBody\.push\("- "\);/.test(codecSrc), "config codec emits empty bullet placeholder for empty sections");
  assertFalse(/tagsBody\.push\("- #example"\);/.test(codecSrc), "config codec no longer emits #example placeholder for empty sections");
  assertTrue(/const orphanIsMixedWikilinks = orphanFieldIds\.length > 1;/.test(codecSrc), "config codec generate uses mixed-context detection for orphan wikilinks");
  assertTrue(/tagsBody\.push\("##### Orphan wikilinks - link"\);/.test(codecSrc), "config codec generate keeps orphan section kind as - link");
  assertTrue(/const activeWikilinkFieldSet = new Set\(/.test(codecSrc), "config codec filters orphan section by active wikilink fields");
  assertTrue(/const parsedWikilinkFieldIds = Array\.isArray\(parsed\.wikilinkFields\)/.test(configNoteOrchestratorSrc), "config apply materializes taxonomy wikilink fields into runtime fields/order");
  assertTrue(/behaviorCfg\.order\.right = dedupeOrder\(behaviorCfg\.order\.right\);/.test(configNoteOrchestratorSrc), "config apply deduplicates order.right after section materialization");
  assertTrue(/behaviorCfg\.order\.right = behaviorCfg\.order\.right\.filter\(\(id\) => !leftSet\.has\(String\(id \|\| ""\)\.trim\(\)\)\);/.test(configNoteOrchestratorSrc), "config apply preserves placement by removing left-duplicates from order.right");
  assertTrue(/for \(const fieldId of rightSet\.values\(\)\)/.test(configNoteOrchestratorSrc), "config apply reconciles wikilink field placement to match order.right");
  assertTrue(/if \(!mergeEntries\.length && !orphanList\.length\) return \[\];/.test(configNoteOrchestratorSrc), "config apply keeps orphan-only wikilink values when section-bound entries are absent");
  assertTrue(/const isPlaceholderOnly = rows\.length === 1 && String\(rows\[0\] \|\| ""\)\.trim\(\) === "";/.test(configNoteOrchestratorSrc), "config apply promotes orphan-only rows into deep-editor values when wikilink field is placeholder-only");
  assertTrue(/const activeWikilinkFieldIds = new Set\(\);/.test(configNoteOrchestratorSrc), "config apply builds active wikilink field set for orphan cleanup");
  assertTrue(/async function loadPriorityStripEngineSafe\(app\)/.test(src), "priority strip engine safe loader exists");
  assertTrue(/async function loadPriorityStripAdapterSafe\(app\)/.test(src), "priority strip adapter safe loader exists");
  assertTrue(/await loadPriorityStripEngineSafe\(this\.app\);/.test(src), "priority strip engine safe loader called in onload");
  assertTrue(/await loadPriorityStripAdapterSafe\(this\.app\);/.test(src), "priority strip adapter safe loader called in onload");
  assertTrue(/cacheKey: "core:priority-strip-engine"/.test(src), "priority strip engine cache key wired");
  assertTrue(/cacheKey: "core:priority-strip-adapter"/.test(src), "priority strip adapter cache key wired");
  assertTrue(/strip\.loader\.fail/.test(src), "strip loader fail telemetry exists");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/features\/command_registry\.js"/.test(src), "command registry uses shared vault fallback helper");
  assertTrue(/cacheKey: "feature:command-registry"/.test(src), "command registry cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/ui\/settings_tab_router\.js"/.test(src), "settings tab router uses shared vault fallback helper");
  assertTrue(/cacheKey: "ui:settings-tab-router"/.test(src), "settings tab router cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/ui\/settings_tab_router\.js"[\s\S]*?uiVaultEvalFallback: true/.test(src), "settings tab router enables bounded UI vault eval fallback");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/ui\/settings_sections_renderer\.js"/.test(src), "settings sections renderer uses shared vault fallback helper");
  assertTrue(/cacheKey: "ui:settings-sections-renderer"/.test(src), "settings sections renderer cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/ui\/settings_sections_renderer\.js"[\s\S]*?uiVaultEvalFallback: true/.test(src), "settings sections renderer enables bounded UI vault eval fallback");
  assertTrue(/function readTagVisualsConfig\(/.test(rendererPairSrc), "settings renderer exposes tagVisuals config reader");
  assertTrue(/require\("\.\/settings\/custom\/fields_editor_legacy\.js"\)/.test(settingsSectionsRendererSrc),
    "settings renderer pulls the moved Fields editor from the settings layer");
  assertTrue(/setName\("Show Color Settings"\)/.test(rendererPairSrc), "settings renderer includes Show Color Settings toggle");
  assertTrue(/setName\("Opacity Left"\)/.test(rendererPairSrc), "settings renderer includes Opacity Left control");
  assertTrue(/setName\("Tag text size"\)/.test(rendererPairSrc), "settings renderer includes Tag text size slider");
  assertTrue(/setName\("Tag bubble size - width"\)/.test(rendererPairSrc), "settings renderer includes Tag bubble width slider");
  assertTrue(/setName\("Tag bubble size - height"\)/.test(rendererPairSrc), "settings renderer includes Tag bubble height slider");
  assertTrue(/setName\("Empty bubble size"\)/.test(rendererPairSrc), "settings renderer includes Empty bubble size slider");
  assertTrue(/setName\("Tag shape"\)/.test(rendererPairSrc) && /Round <-> Square/.test(rendererPairSrc), "settings renderer includes round-to-square Tag shape slider");
  assertTrue(/setName\("Opacity Right"\)/.test(rendererPairSrc), "settings renderer includes Opacity Right control");
  assertTrue(/addType\.createEl\("option", \{ text: "link", value: "wikilink" \}\);/.test(rendererPairSrc), "settings renderer add-field type selector shows link label for wikilink kind");
  assertTrue(/\^\[a-z0-9_\\- \]\+\$/.test(rendererPairSrc), "settings renderer allows spaces in name_strict validation");
  assertTrue(/InlineOverhaul: cannot resolve target link field for Deep Editor add/.test(rendererPairSrc), "settings renderer fails fast when deep editor cannot resolve wikilink target field");
  assertFalse(/const allowed = Array\.isArray\(row\.allowedParentValues\) \? row\.allowedParentValues : \[\]/.test(rendererPairSrc), "wikilink binding inference does not restore parent from allowedParentValues fallback");
  assertTrue(/tokens\.push\(\{ value: `s:\$\{stok\}\|p:\$\{ptok\}\|f:\$\{fid\}`, label: `└ \$\{stok\} \(\$\{ptok\}\)` \}\);/.test(rendererPairSrc), "wikilink parent token selector disambiguates duplicate subtags by parent context");
  assertTrue(/collectTagOrderFieldOptions\(/.test(rendererPairSrc), "settings renderer resolves line field dropdown options from tag order fields");
  assertTrue(/const renderUserTagsEditor = \(\) => \{/.test(rendererPairSrc), "settings renderer includes user tags editor renderer");
  assertTrue(/text: "Color your Tags"/.test(rendererPairSrc), "settings renderer renders Color your Tags block header");
  assertTrue(/Soft warning: User tags count exceeded 300\./.test(rendererPairSrc), "settings renderer includes User tags soft warning copy");
  assertTrue(/Color settings are hidden\. Enable: Tag & PKM > Order > Show color settings\./.test(rendererPairSrc), "settings renderer shows explicit hint when tag color controls are hidden");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/features\/config_note_orchestrator\.js"/.test(src), "config note orchestrator uses shared vault fallback helper");
  assertTrue(/cacheKey: "feature:config-note-orchestrator"/.test(src), "config note orchestrator cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/features\/rules_sync_orchestrator\.js"/.test(src), "rules sync orchestrator uses shared vault fallback helper");
  assertTrue(/cacheKey: "feature:rules-sync-orchestrator"/.test(src), "rules sync orchestrator cache key wired");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/features\/store_events_orchestrator\.js"/.test(src), "store events orchestrator uses shared vault fallback helper");
  assertTrue(/cacheKey: "feature:store-events-orchestrator"/.test(src), "store events orchestrator cache key wired");
  assertTrue(/reportLoaderFallback\("main\.loadVaultBridgeSafe\.require", e\)/.test(src), "main bridge require fallback reports debug context");
  assertTrue(/reportLoaderFallback\("main\.loadVaultBridgeSafe\.vaultEval", p\)/.test(src), "main bridge vault-eval fallback reports debug context");
  assertTrue(/reportLoaderFallback\(`main\.tryLoadWithVaultBridge\.load:\$\{modulePath\}`, e\)/.test(src), "main bridge load fallback reports debug context");
  assertTrue(/bridge\.loadVaultModule\(app, vaultPath, forceReload, "__inlineOverhaulPkmV2ModuleCache"\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 uses canonical vault bridge loader before legacy fallback");

  assertTrue(/async function loadCommandRegistrySafe\(app\)/.test(src), "command registry safe loader exists");
  assertTrue(/await loadCommandRegistrySafe\(this\.app\);/.test(src), "command registry safe loader called in onload");

  assertTrue(/async function loadSettingsTabRouterSafe\(app\)/.test(src), "settings tab router safe loader exists");
  assertTrue(/await loadSettingsTabRouterSafe\(this\.app\);/.test(src), "settings tab router safe loader called in onload");
  assertTrue(/async function loadSettingsSectionsRendererSafe\(app\)/.test(src), "settings sections renderer safe loader exists");
  assertTrue(/await loadSettingsSectionsRendererSafe\(this\.app\);/.test(src), "settings sections renderer safe loader called in onload");
  assertTrue(/function getSettingsSectionsRenderer\(\)/.test(src), "settings sections renderer getter exists");
  assertTrue(/typeof mod\.renderSettingsDisplaySection === "function"/.test(src), "settings sections renderer display-shell contract required");
  assertTrue(/typeof mod\.renderTabBarSection === "function"/.test(src), "settings sections renderer tab-bar contract required");
  assertTrue(/typeof mod\.renderGeneralSection === "function"/.test(src), "settings sections renderer general contract required");
  assertTrue(/typeof mod\.renderModuleTabSection === "function"/.test(src), "settings sections renderer module-tab contract required");
  assertTrue(/typeof mod\.renderVisualTabSection === "function"/.test(src), "settings sections renderer visual-tab contract required");
  assertTrue(/typeof mod\.renderPkmOrderBoardSection === "function"/.test(src), "settings sections renderer pkm-order contract required");
  assertTrue(/typeof mod\.renderPkmConfigSections === "function"/.test(src), "settings sections renderer pkm-config contract required");
  assertTrue(/typeof mod\.renderNavigationSettings === "function"/.test(src), "settings sections renderer navigation contract required");

  assertTrue(/function getCommandRegistry\(\)/.test(src), "command registry getter exists");
  assertTrue(/buildCoreCommandDefs:\s*\(\)\s*=>\s*\[\]/.test(src), "command registry fallback returns empty core defs");
  assertTrue(/buildNavigationCommandDefs:\s*\(\)\s*=>\s*\[\]/.test(src), "command registry fallback returns empty nav defs");
  assertTrue(/buildPkmCommandDefs:\s*\(\)\s*=>\s*\[\]/.test(src), "command registry fallback returns empty pkm defs");
  assertTrue(/inlineOverhaul_Hotkey_\$\{strict\}_\$\{dir\}/.test(commandRegistrySrc), "command registry uses new hotkey command ID template");
  assertFalse(/inlineOverhaul_PKM_/.test(commandRegistrySrc), "command registry has no legacy PKM command IDs");
  assertTrue(/cycle_field:importance|cycle_field:\$\{key\}/.test(commandRegistrySrc), "importance hotkeys route through generic cycle_field action");
  assertFalse(/"statusImportance"/.test(commandRegistrySrc), "command registry no longer binds importance hotkeys to statusImportance runtime");
  assertFalse(/command === "statusImportance"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 has no statusImportance command route");
  assertFalse(/status_importance\.js/.test(pkmRuntimeV2Src), "pkm_runtime_v2 no longer loads status_importance module");
  assertTrue(/buildConfigCommandDefs:\s*\(\)\s*=>\s*\[\]/.test(src), "command registry fallback returns empty config defs");

  assertFalse(/const\s*\{[^\n]*buildNavigationCommandDefs[^\n]*\}\s*=\s*require\("\.\/src\/features\/command_registry\.js"\)/.test(src), "no top-level direct command registry import");

  assertTrue(/command registry unavailable: core commands skipped/.test(src), "core skip guard exists");
  assertTrue(/command registry unavailable: navigation commands skipped/.test(src), "navigation skip guard exists");
  assertTrue(/command registry unavailable: PKM commands skipped/.test(src), "pkm skip guard exists");
  assertTrue(/command registry unavailable: config commands skipped/.test(src), "config skip guard exists");
  assertTrue(/const moveKeys = \[key\];/.test(rendererPairSrc), "order board dnd initializes moved key bundle");
  assertTrue(/const subKey = getSubKeyForParent\(key\);/.test(rendererPairSrc), "order board dnd resolves sub key for parent");
  assertTrue(/target\.splice\(idx, 0, \.\.\.moveKeys\);/.test(rendererPairSrc), "order board dnd inserts parent and sub together");
  assertTrue(/const freeRoamSelect = item\.createEl\("select"\);[\s\S]*const activeSelect = item\.createEl\("select"\);/.test(rendererPairSrc), "order board renders Free roam select before Active select");
  assertTrue(/freeRoamSelect\.createEl\("option", \{ text: "off", value: "off" \}\);[\s\S]*freeRoamSelect\.createEl\("option", \{ text: "minimal", value: "minimal" \}\);[\s\S]*freeRoamSelect\.createEl\("option", \{ text: "full", value: "full" \}\);/.test(rendererPairSrc), "free roam select uses off\/minimal\/full options");
  assertTrue(/activeSelect\.createEl\("option", \{ text: "yes", value: "yes" \}\);[\s\S]*activeSelect\.createEl\("option", \{ text: "no", value: "no" \}\);[\s\S]*activeSelect\.createEl\("option", \{ text: "hotkey_only", value: "hotkey_only" \}\);/.test(rendererPairSrc), "active select uses yes\/no\/hotkey_only options");

  assertTrue(/function getConfigNoteOrchestrator\(\)/.test(src), "config note orchestrator getter exists");
  assertTrue(/async function loadConfigNoteOrchestratorSafe\(app\)/.test(src), "config note orchestrator safe loader exists");
  assertTrue(/await loadConfigNoteOrchestratorSafe\(this\.app\);/.test(src), "config note orchestrator safe loader called in onload");
  assertTrue(/typeof mod\.applyTagWheelConfigNote === "function"/.test(src), "config note orchestrator apply contract required");
  assertTrue(/async applyTagWheelConfigNote\(\) \{\s*throw new Error\("Config note orchestrator unavailable"\);\s*\}/.test(src), "config note orchestrator fallback apply exists");

  assertTrue(/async function loadTagWheelConfigCodecSafe\(app\)/.test(src), "tagwheel config codec safe loader exists");
  assertTrue(/require\("\.\/src\/features\/tagwheel_config_codec_fallback\.js"\)/.test(src), "main delegates heavy codec fallback to dedicated module");
  assertTrue(/async function loadTagWheelConfigParserSafe\(app\)/.test(src), "tagwheel config parser safe loader exists");
  assertFalse(/await loadTagWheelConfigParserSafe\(this\.app\);\s*await loadConfigNoteHelpersSafe\(this\.app\);/.test(src), "tagwheel config parser is not eagerly loaded in onload path");
  assertTrue(/async applyTagWheelConfigNote\(\) \{[\s\S]*?await loadTagWheelConfigParserSafe\(this\.app\);\s*await loadTagWheelConfigCodecSafe\(this\.app\);/.test(src), "tagwheel config parser is lazy-loaded on apply path");
  assertTrue(/cacheKey: "feature:tagwheel-config-parser"/.test(src), "tagwheel config parser cache key wired");
  assertTrue(/await loadTagWheelConfigCodecSafe\(this\.app\);/.test(src), "tagwheel config codec safe loader called in onload");
  assertTrue(/async function loadRulesMarkdownBuilderSafe\(app\)/.test(src), "rules markdown builder safe loader exists");
  assertTrue(/await loadRulesMarkdownBuilderSafe\(this\.app\);/.test(src), "rules markdown builder safe loader called in onload");
  assertTrue(/cacheKey: "feature:rules-markdown-builder"/.test(src), "rules markdown builder cache key wired");
  assertTrue(/buildRulesMarkdown: \(cfg\) => getRulesMarkdownBuilder\(\)\.buildTagWheelRulesMarkdownFromConfig\(cfg\)/.test(src), "rules sync uses extracted rules markdown builder");
  assertTrue(/async function loadConfigNoteHelpersSafe\(app\)/.test(src), "config note helpers safe loader exists");
  assertTrue(/await loadConfigNoteHelpersSafe\(this\.app\);/.test(src), "config note helpers safe loader called in onload");
  assertTrue(/cacheKey: "feature:config-note-helpers"/.test(src), "config note helpers cache key wired");
  assertTrue(/function denormTagToken\(token\)/.test(src), "main defines denormTagToken helper for config-note token normalization");
  assertFalse(/value\.charAt\(0\) === "\/"\) value = value\.slice\(1\)/.test(src), "denormTagToken preserves leading slash in #\/priority tokens");
  assertFalse(/allowed\.includes\("project"\)\) fieldId = "project"/.test(src), "wikilink parser has no semantic project fallback when field id is omitted");
  assertTrue(/async function readVaultText\(app, path\)/.test(src), "main defines readVaultText helper for config-note IO");
  assertTrue(/function extractFieldMetaMap\(field\)/.test(src), "main defines extractFieldMetaMap helper for config-note apply");
  assertTrue(/function rebuildTagValues\(parentTokens, metaByToken\)/.test(src), "main defines rebuildTagValues helper for config-note apply");
  assertTrue(/function rebuildSubtagValues\(parents, metaByToken\)/.test(src), "main defines rebuildSubtagValues helper for config-note apply");
  assertTrue(/const helpers = getConfigNoteHelpers\(\);/.test(src), "main obtains extracted config note helpers");
  assertTrue(/collectTagSections: helpers\.collectTagSections/.test(src), "apply config note uses extracted collectTagSections");
  assertTrue(/syncCustomPrefixResolverBlock: helpers\.syncCustomPrefixResolverBlock/.test(src), "apply config note uses extracted prefix sync helper");
  assertTrue(/function getTagWheelConfigCodec\(\)/.test(src), "tagwheel config codec getter exists");
  assertTrue(/loadModuleWithVaultFallback\(app, \{[\s\S]*?requirePath: "\.\/src\/features\/tagwheel_config_codec\.js"/.test(src), "tagwheel config codec uses shared vault fallback helper");
  assertTrue(/cacheKey: "feature:tagwheel-config-codec"/.test(src), "tagwheel config codec cache key wired");
  assertFalse(/function parseCheckboxAndTag\(text\) \{[\s\S]*?\(\[xX \]\)/.test(src), "parseCheckboxAndTag does not limit checkbox token parser to [ ] and [x] only");
  assertFalse(/datesLines\.push\(`- Active:/.test(codecSrc), "generated config codec does not emit Active line in date\/time blocks");
  assertFalse(/datesLines\.push\("- Hotkey:"\)/.test(codecSrc), "generated config codec does not emit Hotkey block in date\/time blocks");
  assertFalse(/elementsLines\.push\(`- enabled:/.test(codecSrc), "generated config codec does not emit enabled line in elements blocks");
  assertFalse(/elementsLines\.push\("- Hotkey:"\)/.test(codecSrc), "generated config codec does not emit Hotkey block in elements");
  assertTrue(/const fields = \[\]\.concat\(getLeftFields\(cfg\), getRightFields\(cfg\)\);/.test(codecSrc), "config codec resolves fields from both left and right panels");
  assertTrue(/const orderedKeys = \(Array\.isArray\(order\.left\) \? order\.left : \[\]\)\.concat\(Array\.isArray\(order\.right\) \? order\.right : \[\]\);/.test(configNoteHelpersSrc), "config helpers build tag sections from order.left + order.right");
  assertTrue(/const keys = \(Array\.isArray\(order\.left\) \? order\.left : \[\]\)\.concat\(Array\.isArray\(order\.right\) \? order\.right : \[\]\);/.test(configNoteHelpersSrc), "config helpers collect wikilink fields from order.left + order.right");

  assertTrue(/async function loadEnhancedSelectAllEngineSafe\(app\)/.test(src), "enhanced select-all engine safe loader exists");
  assertTrue(/await loadEnhancedSelectAllEngineSafe\(this\.app\);/.test(src), "enhanced select-all safe loader called in onload");
  assertTrue(/function getEnhancedSelectAllEngine\(\)/.test(src), "enhanced select-all getter exists");
  assertTrue(/cacheKey: "feature:enhanced-select-all-engine"/.test(src), "enhanced select-all cache key wired");

  assertTrue(/async function loadConfigMigrationModuleSafe\(app\)/.test(src), "config migration safe loader exists");
  assertTrue(/await loadConfigMigrationModuleSafe\(this\.app\);/.test(src), "config migration safe loader called in onload");
  assertTrue(/cacheKey: "core:config-migration"/.test(src), "config migration cache key wired");
  assertTrue(/function getConfigMigrationModule\(\)/.test(src), "config migration getter exists");
  assertTrue(/normalizePkmBehaviorShape\(cfg, \{ cloneJson, isObj \}\)/.test(src), "migrateConfig applies behavior shape normalization");
  assertTrue(/return "element"/.test(fieldModelSrc), "field model normalizes date-like order keys as element kind");
  assertFalse(/return "date"/.test(fieldModelSrc), "field model has no legacy date kind token");
  assertFalse(/createFieldModelFromOrder/.test(fieldModelSrc), "field model has no dead createFieldModelFromOrder export");
  assertTrue(/const deprecatedRules = Array\.isArray\(__compatProfile\.DEPRECATED_CONFIG_KEYS\?\.rules\)/.test(src), "migrateConfig resolves deprecated rules keys from shared compat profile module");
  assertTrue(/__compatProfile\.isCompatEnabled\("ENABLE_CONFIG_MIGRATION_SHIMS"\)/.test(src) && /cfg\.pkm\.generatedRulesPath = String\(cfg\.rules\.tagWheelPath\)\.trim\(\);/.test(src), "migrateConfig keeps migration-only shim for rules.tagWheelPath when compat flag enabled");
  assertFalse(/cfg\.pkm\.sourceOfTruth\s*=/.test(src), "migrateConfig no longer writes dead pkm.sourceOfTruth field");
  assertFalse(/cfg\.pkm\.autoGenerateRules\s*=/.test(src), "migrateConfig no longer writes dead pkm.autoGenerateRules field");
  assertFalse(/\.setName\("TagWheel rules path"\)/.test(rendererPairSrc), "settings no longer expose contradictory legacy TagWheel rules path field");
  assertTrue(/bridge\.loadVaultModule\(app, modulePath, false, "__inlineOverhaulMainModuleCache"\)/.test(src), "main shared loader uses canonical vault bridge path before adapter fallback");
  assertFalse(/console\.log\("\[inline-overhaul\] loaded"\)/.test(src), "main has no unconditional production console.log on plugin load");
  assertTrue(/cfg\.pkm\.behavior\.io\.separator1 = s1 \|\| DEFAULT_CONFIG\.pkm\.behavior\.io\.separator1;/.test(src), "migrateConfig normalizes separator1");
  assertTrue(/cfg\.pkm\.behavior\.io\.separator2 = s2 \|\| DEFAULT_CONFIG\.pkm\.behavior\.io\.separator2;/.test(src), "migrateConfig normalizes separator2");
  assertTrue(/const sep = typeof \(cfg && cfg\.separator1\) === "string" && cfg\.separator1 \? cfg\.separator1 : "\|\|";/.test(navigationRuntimeSrc), "navigation section-end cursor uses configurable separator1 fallback");
  assertTrue(/if \(!isObj\(cfg\.pkm\.behavior\.freeRoam\)\) cfg\.pkm\.behavior\.freeRoam = cloneJson\(DEFAULT_CONFIG\.pkm\.behavior\.freeRoam\);/.test(src), "migrateConfig initializes freeRoam behavior block");
  assertTrue(/if \(typeof fr\.minimalSeparator !== "boolean"\) fr\.minimalSeparator = DEFAULT_CONFIG\.pkm\.behavior\.freeRoam\.minimalSeparator;/.test(src), "migrateConfig normalizes minimalSeparator toggle");
  assertTrue(/if \(typeof fr\.minimalPrefix !== "boolean"\) fr\.minimalPrefix = DEFAULT_CONFIG\.pkm\.behavior\.freeRoam\.minimalPrefix;/.test(src), "migrateConfig normalizes minimalPrefix toggle");
  assertTrue(/fr\.fullPlacement = \["smart", "left", "right"\]\.includes\(place\)/.test(src), "migrateConfig normalizes fullPlacement");
  assertTrue(/devMode:\s*\{[\s\S]*generateAiLog:\s*true[\s\S]*logPath:\s*"InlineOverhaul_DevLog"/.test(src), "default config includes simplified devMode fields with AI log toggle");
  assertTrue(/if \(!isObj\(cfg\.devMode\)\) cfg\.devMode = cloneJson\(DEFAULT_CONFIG\.devMode\);/.test(src), "migrateConfig initializes devMode block");
  assertTrue(/if \(typeof cfg\.devMode\.generateAiLog !== "boolean"\) \{/.test(src), "migrateConfig normalizes generateAiLog toggle");
  assertTrue(/const deprecatedDevMode = Array\.isArray\(__compatProfile\.DEPRECATED_CONFIG_KEYS\?\.devMode\)/.test(src), "migrateConfig resolves deprecated devMode keys from shared compat profile module");
  assertTrue(/for \(const key of deprecatedDevMode\) delete cfg\.devMode\[key\];/.test(src), "migrateConfig drops deprecated devMode keys through centralized loop");
  assertTrue(/devLog: \(event, payload\) => this\.devLogEvent\(event, payload, "info", cfg\)/.test(src), "runPkmRuntimeV2 forwards devLog callback into runtime");
  assertTrue(/getLogPathParts\(dm\) \{/.test(src), "main exposes dev log path parts resolver");
  assertTrue(/buildLogFilePath\(parts, role, ts\) \{/.test(src), "main exposes timestamped dev log filename builder");
  assertTrue(/listMatchingLogFiles\(adapter, parts\) \{/.test(src), "main can enumerate existing timestamped dev logs");
  assertTrue(/trimAiLogContent\(content, dm\) \{/.test(src), "main trims AI logs by time window and record cap");
  assertTrue(/trimHumanLogContent\(content, dm\) \{/.test(src), "main trims Human logs by time window and record cap");
  assertTrue(src.includes("const maybeDir = /\\/$/.test(asForward);"), "main resolves directory-like log_path values");
  assertTrue(/async ensureDirectoryForFilePath\(adapter, filePath\)/.test(src), "main has helper to create parent directories for logs");
  assertTrue(/try \{\s*await this\.initializeDevLogSession\(this\.getConfig\(\)\);\s*\} catch \(e\)/.test(src), "onload guards dev-log session init with fail-open try/catch");
  assertTrue(/await this\.initializeDevLogSession\(this\.getConfig\(\)\);/.test(src), "onload initializes dev log session rotation");
  assertTrue(/session\.start/.test(src) && /session\.end/.test(src), "main writes session lifecycle events");
  assertTrue(/\.setName\("Enable Dev Mode"\)/.test(rendererPairSrc), "settings UI exposes dev mode toggle");
  assertTrue(/\.setName\("Generate log for AI\?"\)/.test(rendererPairSrc), "advanced settings exposes Generate log for AI toggle");
  assertTrue(/txt\.inputEl\.addEventListener\("blur", commitPath\);/.test(rendererPairSrc), "log_path commits on blur to avoid per-key rerender focus loss");
  assertTrue(/if \(!evt \|\| evt\.key !== "Enter"\) return;/.test(rendererPairSrc), "log_path commits on Enter key");
  assertTrue(/Yes: in addition to human `.md` log, generate detailed AI `.ndjson` log\./.test(rendererPairSrc), "advanced settings documents dual-log behavior");
  assertFalse(/Dev log max file size \(KB\)/.test(rendererPairSrc), "legacy dev max size control removed from settings");
  assertTrue(/if \(!wasEnabled && isEnabled\) \{[\s\S]*initializeDevLogSession\(after\)/.test(src), "setConfigPatch starts new dev log session on dev_mode ON transition");
  assertTrue(/if \(wasEnabled && !isEnabled\) \{[\s\S]*closeDevLogSession\(before, true\)/.test(src), "setConfigPatch closes dev log session on dev_mode OFF transition");
  assertTrue(/if \(wasEnabled && isEnabled && \(beforePath !== afterPath \|\| beforeAi !== afterAi\)\) \{[\s\S]*dev-mode-log:reinit/.test(src), "setConfigPatch reinitializes log session when path or AI toggle changes while enabled");
  assertTrue(/if \(mdLine\) await this\.writeDevLogLine\(dm, "md", mdLine\);/.test(src), "dev logger always writes human markdown log");
  assertTrue(/if \(aiLine\) await this\.writeDevLogLine\(dm, "ndjson", aiLine\);/.test(src), "dev logger writes AI ndjson log when enabled");
  assertTrue(/const marker = String\(elemCfg\.emoji \|\| inferElementDefaultsByKey\(key\)\.marker \|\| ""\)\.trim\(\);/.test(src), "ensureBehaviorModesFromOrder syncs custom element marker from behavior config");
  assertTrue(/behavior\.defaultMode = String\(behavior\.defaultMode \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "right" \? "right" : "left";/.test(src), "rules builder enforces behavior.defaultMode fallback");
  assertFalse(/for \(const k of orderFields\) \{[\s\S]*if \(!rightSet\.has\(k\)\) continue;[\s\S]*out\.right = out\.right\.filter\(\(x\) => x !== k\);[\s\S]*out\.left\.push\(k\);[\s\S]*\}/.test(src), "normalizePkmOrder does not force right fields back to left by sub presence");

  assertTrue(/handleEnhancedSelectAllKeymap\(\) \{\s*return getEnhancedSelectAllEngine\(\)\.handleEnhancedSelectAllKeymap\(this\);\s*\}/.test(src), "enhanced select-all delegated to extracted engine");
  assertFalse(/function normalizeTagWheelConfigPath\(/.test(src), "no legacy codec wrapper normalizeTagWheelConfigPath in main");
  assertFalse(/function normalizeTagWheelConfigTemplatePath\(/.test(src), "no legacy codec wrapper normalizeTagWheelConfigTemplatePath in main");
  assertFalse(/function buildDefaultTagWheelDetailedTemplateMarkdown\(/.test(src), "no legacy codec wrapper buildDefault template in main");
  assertFalse(/function renderTagWheelConfigFromTemplate\(/.test(src), "no legacy codec wrapper renderFromTemplate in main");
  assertFalse(/function buildMinimalFromRenderedTemplate\(/.test(src), "no legacy codec wrapper buildMinimal in main");
  assertFalse(/function buildTagWheelConfigParts\(/.test(src), "no legacy codec wrapper buildTagWheelConfigParts in main");
  assertFalse(/function buildTagWheelConfigMarkdown\(/.test(src), "no legacy codec wrapper buildTagWheelConfigMarkdown in main");
  assertFalse(/function parseTagWheelConfigMarkdown\(/.test(src), "no legacy codec wrapper parseTagWheelConfigMarkdown in main");
  assertTrue(/function createTagWheelConfigCodecFallback\(/.test(codecFallbackSrc), "dedicated codec fallback module exports factory");
  assertFalse(/cfg\.pkm\.legacy/.test(src), "no direct cfg.pkm.legacy reads in main");
  assertFalse(/require\("\.\/tagwheel_config_parser\.js"\)/.test(codecSrc), "codec has no direct parser require in sandbox path");
  assertFalse(/\|\|\s*s\s*===\s*"legacy"/.test(statusTagsSrc), "status_tags cursor policy has no legacy alias");
  assertFalse(/\|\|\s*s\s*===\s*"legacy"/.test(statusDateSrc), "status_date cursor policy has no legacy alias");
  assertFalse(/\|\|\s*s\s*===\s*'legacy'/.test(tagwheelSrc), "tagwheel cursor policy has no legacy alias");
  assertTrue(/collectMissingEmojiFieldsFromRules\(rules, dateRuntimeCfg\)/.test(tagwheelSrc), "tagwheel validates required Emoji before activation");
  assertTrue(/collectMissingEmojiFields\(rules, dateRuntimeCfg\)/.test(statusDateSrc), "status_date validates required Emoji before actions");
  assertFalse(/Object\.keys\(byField\)/.test(tagwheelSrc), "tagwheel emoji gate does not validate orphan byField keys outside active panel");
  assertFalse(/Object\.keys\(byField\)/.test(statusDateSrc), "status_date emoji gate does not validate orphan byField keys outside active panel");
  assertTrue(/Config validation error: Emoji is required for fields:/.test(parserSrc), "tagwheel config parser enforces required Emoji contract");
  assertTrue(/InlineOverhaul_Config\]\] \(DATE\/TIME \+ ELEMENTS section\)/.test(parserSrc), "tagwheel config parser error points to config note section hint");
  assertFalse(/wikilink entry is not allowed in this section/.test(parserSrc), "tagwheel config parser does not block wikilink entries by section");
  assertFalse(/wikilink field '\$\{parsedW\.fieldId\}' is not allowed here/.test(parserSrc), "tagwheel config parser has no section-scoped wikilink field restriction");
  assertTrue(/allowedWikilinkFieldsBySection/.test(parserSrc), "tagwheel config parser computes section-scoped wikilink field scope");
  assertTrue(/const scopedWikilinkFields = Array\.isArray\(allowedWikilinkFieldsBySection\[secName\]\)/.test(parserSrc), "tagwheel config parser applies section-scoped wikilink field defaults on parse");
  assertTrue(/parseSectionHeader/.test(parserSrc) && /sectionKinds/.test(parserSrc) && /sectionOrder/.test(parserSrc), "tagwheel config parser supports section header kind metadata for field creation");
  assertTrue(/normalizeHeaderLoose/.test(parserSrc) && /hasDate && hasTime && hasElements/.test(parserSrc), "tagwheel config parser supports emoji-decorated combined DATE\/TIME + ELEMENTS header variants");
  assertTrue(/unknown wikilink field '\$\{fieldId\}'/.test(src), "shared wikilink parser validates field id against allowed wikilink fields");
  assertTrue(/no wikilink fields are configured/.test(src), "shared wikilink parser rejects wikilinks when no wikilink fields are configured");
  assertTrue(/CFG_H2_ELEMENTS_COMBINED/.test(codecSrc), "tagwheel codec passes combined elements header constant into parser factory");
  assertFalse(/isDateLikeFormat\(fmt\)/.test(parserSrc), "combined parser does not auto-cast non-canonical fields to dates by format");
  assertFalse(/next\.pkm\.behavior\.dates\s*=/.test(configNoteOrchestratorSrc), "config apply does not write legacy dates block");
  assertTrue(/next\.pkm\.behavior\.elements = cloneJson\(cleanedElementsForPatch\);/.test(configNoteOrchestratorSrc), "config apply replaces elements block with order-scoped cleaned values");
  assertTrue(/parsedSectionOrder/.test(configNoteOrchestratorSrc) && /rightMode\.fields\.push\(fieldDef\)/.test(configNoteOrchestratorSrc), "config apply auto-creates missing fields from parsed section headers and appends to right panel");
  assertTrue(/isWikilinkSourceFieldSafe/.test(configNoteOrchestratorSrc), "config apply scans source-driven wikilink fields via shared helper predicate");
  assertTrue(/field\.values = buildWikilinkFieldValues\(field, sec, sourceFieldId\);|field\.values = buildWikilinkFieldValues\(field, sourceFieldId, parsed\.sections(?:, parsed\.orphanWikilinks)?\);/.test(configNoteOrchestratorSrc), "config apply rebuilds wikilink field values from config-note taxonomy");
  assertTrue(/for \(const sectionName of Object\.keys\(parsed\.sections \|\| \{\}\)\)/.test(configNoteOrchestratorSrc) && /sec\.wikilinks\[projectsFieldId\]/.test(configNoteOrchestratorSrc), "config apply aggregates projects taxonomy from all parsed sections");
  assertTrue(/if \(!isObj\(wikilinkTaxonomy\[fieldId\]\)\) wikilinkTaxonomy\[fieldId\] = \{ bySection: \{\} \};/.test(configNoteOrchestratorSrc), "config apply guards dynamic wikilink taxonomy keys before section assignment");
  assertFalse(/categorySectionId/.test(configNoteOrchestratorSrc), "config apply has no category-only projects extraction path");
  assertTrue(/resolveOrderFieldScopes\(tmpCfgForScope, normalizePkmOrder, isObj\)/.test(configNoteOrchestratorSrc), "config apply computes active order scope for stale cleanup");
  assertTrue(/filterBehaviorDateElementConfigs\(renderCfg, resolveOrderFieldScopes\(renderCfg, normalizePkmOrder, isObj\), isObj\);/.test(configNoteOrchestratorSrc), "open config note cleans stale deleted element tails before rendering");
  assertTrue(/const freshMd = mode === TAGWHEEL_CONFIG_MODE_MINIMAL[\s\S]*buildMinimalFromRenderedTemplate\(renderedMd\)[\s\S]*: renderedMd;/.test(configNoteOrchestratorSrc), "config note export keeps minimal and detailed modes distinct");
  assertTrue(/tagVisuals:\s*\{[\s\S]*byTag:[\s\S]*parsed\.tagVisuals/.test(configNoteOrchestratorSrc), "apply config note patches tagVisuals maps from parsed markdown");
  assertTrue(/next\.pkm\.behavior\.tagVisuals\.byTag = (?:cloneJson\(parsed\.tagVisuals|mergeByTagVisualsPreserveVisibility\()/.test(configNoteOrchestratorSrc), "apply config note updates byTag map from parsed markdown with delete-sync semantics");
  assertTrue(/next\.pkm\.behavior\.tagVisuals\.userTags = (?:cloneJson\(parsed\.tagVisuals|mergeUserTagVisualsPreserveVisibility\()/.test(configNoteOrchestratorSrc), "apply config note updates userTags map from parsed markdown with delete-sync semantics");
  assertTrue(/mergeByTagVisualsPreserveVisibility/.test(configNoteOrchestratorSrc) && /visibility:\s*existingRow\s*\?\s*normalizeVisibility\(existingRow\.visibility\)/.test(configNoteOrchestratorSrc), "apply config note preserves existing byTag visibility while updating parsed visual payload");
  assertTrue(/mergeUserTagVisualsPreserveVisibility/.test(configNoteOrchestratorSrc) && /next\.pkm\.behavior\.tagVisuals\.userTags = mergeUserTagVisualsPreserveVisibility/.test(configNoteOrchestratorSrc), "apply config note preserves existing userTags visibility while updating parsed visual payload");
  assertTrue(/const USER_TAGS_SECTION = "User tags";/.test(parserSrc), "config parser supports dedicated User tags section");
  assertTrue(/##### \$\{s\.sectionId\} - \$\{sectionKindByField\(field\)\}/.test(codecSrc), "config codec renders section headers in strictName-kind format");
  assertTrue(/setByTagFirstWins\(/.test(parserSrc) && /setUserTagFirstWins\(/.test(parserSrc), "config parser enforces first-wins policy for duplicate tag visual rows");
  assertTrue(/const parseTagPipeSegments = \(text\) => \{/.test(parserSrc), "config parser uses pipe segment parser for tag rows");
  assertTrue(parserSrc.includes("const mHex = seg.match(/^hex"), "config parser supports hex pipe segment with backticks");
  assertTrue(parserSrc.includes("const mCustom = seg.match(/^custom\\s+name") && parserSrc.includes("const mYaml = seg.match(/^yaml\\s*="), "config parser supports custom name and yaml pipe segments");
  assertTrue(/const buildPipeTail = \(payload\) => \{/.test(codecSrc), "config codec builds pipe tail segments for tag rows");
  assertTrue(codecSrc.includes("out.push(`custom name = \\`${customText}\\``)") && codecSrc.includes("out.push(`hex = \\`${fill}\\`/\\`${text}\\``)"), "config codec emits custom name and hex pipe segments");
  assertTrue(/fillColor:\s*parsedFill,/.test(configNoteOrchestratorSrc) && /textColor:\s*parsedText,/.test(configNoteOrchestratorSrc), "config apply resets colors to parsed/default instead of preserving stale colors");
  assertTrue(/if \(!nonEmpty\(src\.emoji\) && Object\.prototype\.hasOwnProperty\.call\(dst, "emoji"\)\) out\.emoji = String\(dst\.emoji \|\| ""\);/.test(src), "runtime date serializer does not overwrite non-empty emoji with empty element emoji");
  assertTrue(/const modeRaw = String\(incCur\.mode \|\| "standard"\)\.trim\(\)\.toLowerCase\(\);/.test(src), "behavior sync preserves configured increment mode for elements");
  assertTrue(/mode,\s*incrementBy,\s*command,\s*customRaw,\s*custom/.test(src), "behavior sync writes normalized increment fields without forcing standard mode");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(app_, "loadLinePipeline"\)/, /await loadLinePipeline\(app_\);/], "status_tags preloads shared line pipeline");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(app_, "loadLinePipeline"\)/, /await loadLinePipeline\(app_\);/], "status_date preloads shared line pipeline");
  assertTrue(/linePipeline\.splitSegments\(line, rules\)|linePipeline\.splitSegments\(lineInput, runtimeRules\)|linePipeline\.splitSegments\(segLine, rules\)/.test(tagwheelSrc), "tagwheel split delegates to shared line pipeline");
  assertTrue(/linePipeline\.buildFromSegments\(seg, rules\)|linePipeline\.buildFromSegments\(seg, runtimeRules\)/.test(tagwheelSrc), "tagwheel render delegates to shared line pipeline");
  assertTrue(/function getControlCursorCh\(state, controlLine\)/.test(tagwheelSrc), "tagwheel control cursor uses cursorPolicy-aware helper");
  assertTrue(/state\.editor\.setCursor\(\{ line: state\.lineNumber, ch: getControlCursorCh\(state, control\) \}\)/.test(tagwheelSrc), "tagwheel updates cursor using cursorPolicy in active control mode");
  assertTrue(/linePipeline\.splitSegments\(rawLine, rules\)|linePipeline\.splitSegments\(line, rules\)|linePipeline\.splitSegments\(out, rules\)/.test(statusTagsSrc), "status_tags split delegates to shared line pipeline");
  assertTrue(/linePipeline\.splitSegments\(rawLine, rules\)|linePipeline\.splitSegments\(line, rules\)/.test(statusDateSrc), "status_date split delegates to shared line pipeline");
  assertTrue(/throw new Error\("line_pipeline unavailable: splitSegments"\);/.test(statusTagsSrc), "status_tags split fallback removed in favor of shared line pipeline");
  assertFalse(/function stripPrefixKeepIndent\(/.test(statusTagsSrc), "status_tags has no local stripPrefixKeepIndent wrapper");
  assertTrue(/linePipeline\.stripPrefixKeepIndent\(line, removeCheckbox\)/.test(statusTagsSrc), "status_tags cycle-end strip-prefix callback delegates to shared line-pipeline helper");
  assertTrue(/function getFieldFreeRoamMode\(orderCfg, fieldKey\)|statusCommon\.getFieldFreeRoamMode\(orderCfg, actionFieldKey\)/.test(statusTagsSrc), "status_tags resolves free roam mode via shared runtime common");
  assertFalse(/actionFieldKey\s*===\s*"type"/.test(statusTagsSrc), "status_tags has no hardcoded actionFieldKey type branch");
  assertFalse(/actionFieldKey\s*===\s*"category"/.test(statusTagsSrc), "status_tags has no hardcoded actionFieldKey category branch");
  assertTrue(/function getFreeRoamBehavior\(orderCfg\)|statusCommon\.getFreeRoamBehavior\(orderCfg\)/.test(statusTagsSrc), "status_tags resolves free roam behavior via shared runtime common");
  assertTrue(/targetPanel === "left" && freeRoamMode === "off"/.test(statusTagsSrc), "status_tags applies left text enforcement only for freeRoam off");
  assertTrue(/const mixedMinimalSeparatorOff = isPriorityAction && mixedPolicy\.applyMinimalSeparatorCollapse;/.test(statusTagsSrc), "status_tags defines mixed minimal-separator-off guard from shared mixed policy");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusTagsSrc), "status_tags gates trailing separator via shared trailing-separator policy helper");
  assertTrue(/function getFieldFreeRoamMode\(orderCfg, fieldKey\)|statusCommon\.getFieldFreeRoamMode\(orderCfg, actionFieldKey\)/.test(statusDateSrc), "status_date resolves free roam mode via shared runtime common");
  assertTrue(/function getFreeRoamBehavior\(orderCfg\)|statusCommon\.getFreeRoamBehavior\(orderCfg\)/.test(statusDateSrc), "status_date resolves free roam behavior via shared runtime common");
  assertTrue(/targetPanel === "left" && freeRoamMode === "off"/.test(statusDateSrc), "status_date applies left text enforcement only for freeRoam off");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusDateSrc), "status_date gates trailing separator via shared trailing-separator policy helper");
  assertTrue(/function applyMinimalLeftTagNormalization\(finalLine, state, core, options\)/.test(tagwheelSrc), "tagwheel exposes minimal-left normalization helper");
  assertTrue(/finalLine = applyMinimalLeftTagNormalization\(finalLine, state, core, \{[\s\S]*preserveExistingTokens:\s*hasOffSelected[\s\S]*\}\)\s*;?/.test(tagwheelSrc), "tagwheel applies minimal-left normalization in applySelection pipeline");
  assertTrue(/var hasOffSelected = !!policy\.hasOffSelected/.test(tagwheelSrc), "tagwheel derives off-mode selection from shared mixed policy");
  assertTrue(/if \(hasMinimalSelected\)\s*\{\s*finalLine = applyMinimalLeftTagNormalization\(finalLine, state, core, \{[\s\S]*preserveExistingTokens:\s*hasOffSelected/.test(tagwheelSrc), "tagwheel applies minimal normalization for mixed off+minimal selections with token preservation");
  assertTrue(/throw new Error\("line_pipeline unavailable: splitSegments"\);/.test(statusDateSrc), "status_date split fallback removed in favor of shared line pipeline");
  assertTrue(/throw new Error\('line_pipeline unavailable: splitSegments'\)/.test(tagwheelSrc), "tagwheel split fallback removed in favor of shared line pipeline");
  assertTrue(/throw new Error\('line_pipeline unavailable: buildFromSegments'\)/.test(tagwheelSrc), "tagwheel render fallback removed in favor of shared line pipeline");
  assertFalse(/\^\[📅🛫🕒⌛\]\\S\+\$/.test(linePipelineSrc), "line pipeline has no hardcoded emoji marker regex");
  assertFalse(/\[📅🗓️🛫🕒⌛\]/.test(pkmLineFinalizeUnifiedSrc), "line finalizer has no hardcoded emoji marker regex fallback");
  assertFalse(/return indent \+ left \+ ' ' \+ sep1/.test(tagwheelSrc), "tagwheel has no manual line assembly leftovers");
  assertTrue(/function enforceTextSegmentForLeftTag\(/.test(linePipelineSrc), "line pipeline exports enforceTextSegment helper");
  assertTrue(/function extractOriginalTextFromRawLine\(/.test(linePipelineSrc), "line pipeline exports extractOriginalText helper");
  assertTrue(/function relocateMarkerSetByFieldOrder\(/.test(linePipelineSrc), "line pipeline exports marker-set relocation helper");
  assertTrue(/function removeCombinedByParentTokens\(/.test(linePipelineSrc), "line pipeline exports combined-subtag cleanup helper");
  assertTrue(/function removeExactTokens\(/.test(linePipelineSrc), "line pipeline exports exact-token stripping helper");
  assertTrue(/function detectMarkerPanel\(/.test(linePipelineSrc), "line pipeline exports marker-panel detection helper");
  assertTrue(/function resolvePanelByMarkerPresence\(/.test(linePipelineSrc), "line pipeline exports marker-panel resolve helper");
  assertTrue(/function getPanelSearchText\(/.test(linePipelineSrc), "line pipeline exports panel search-text helper");
  assertTrue(/function removeDateTimeMarkers\(/.test(linePipelineSrc), "line pipeline exports date-time marker cleanup helper");
  assertTrue(/function collectDateLikeMarkersFromRules\(/.test(linePipelineSrc), "line pipeline exports date-like marker collection helper");
  assertTrue(/function removeTokensAcrossSegments\(/.test(linePipelineSrc), "line pipeline exports segment-wide token stripping helper");
  assertTrue(/function cleanOriginalTextForLeftDate\(/.test(linePipelineSrc), "line pipeline exports left-date original-text cleaner helper");
  assertTrue(/\^\\d\+\\\.\(\?:\\s\|\$\)/.test(linePipelineSrc), "line pipeline treats numbered prefixes with optional trailing space");
  assertTrue(/linePipeline\.enforceTextSegmentForLeftTag\(finalLine, rules, originalText\)/.test(statusTagsSrc), "status_tags text enforcement delegates to shared line-pipeline helper");
  assertTrue(/function normalizeCycleEndBehavior\(/.test(pkmMacroSharedSrc), "pkm macro shared exports cycle behavior normalizer");
  assertTrue(/function escapeRegex\(/.test(pkmMacroSharedSrc), "pkm macro shared exports regex escaper");
  assertTrue(/function segmentHasToken\(/.test(pkmMacroSharedSrc), "pkm macro shared exports segment token matcher");
  assertTrue(/function removeTokensFromSegment\(/.test(pkmMacroSharedSrc), "pkm macro shared exports segment token remover");
  assertTrue(/function removePatternFromSegment\(/.test(pkmMacroSharedSrc), "pkm macro shared exports segment pattern remover");
  assertFalse(/\[📅🗓️🛫🕒⌛\]/.test(pkmMacroSharedSrc), "pkm macro shared has no hardcoded emoji marker regex fallback");
  assertFalse(/"📅"|"🗓️"|"🛫"|"🕒"|"⌛"/.test(pkmRulesHelpersSrc), "pkm rules helper has no hardcoded emoji marker defaults");
  assertTrue(/function firstTokenByPattern\(/.test(pkmMacroSharedSrc), "pkm macro shared exports pattern token finder");
  assertTrue(/function getCursorForPanel\(/.test(pkmMacroSharedSrc), "pkm macro shared exports panel cursor helper");
  assertTrue(/function applyKeepBullet\(/.test(pkmMacroSharedSrc), "pkm macro shared exports keep-bullet helper");
  assertTrue(/function isNoContentParsed\(/.test(pkmMacroSharedSrc), "pkm macro shared exports no-content parsed helper");
  assertTrue(/function parseOrderConfig\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export order parser");
  assertTrue(/lead:\s*\{\}/.test(pkmRulesHelpersSrc), "order parser initializes lead container");
  assertTrue(/if \(src\.lead && typeof src\.lead === "object" && !Array\.isArray\(src\.lead\)\)/.test(pkmRulesHelpersSrc), "order parser reads lead config block");
  assertTrue(/lead:\s*isObj\(orderCfg && orderCfg\.lead\) \? \{ \.\.\.orderCfg\.lead \} : \{\}/.test(pkmRulesHelpersSrc), "applyOrderToRules preserves lead config in behavior order");
  assertTrue(/function resolvePanelForField\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export panel resolver");
  assertTrue(/function buildPanelOrderKeys\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export panel order builder");
  assertTrue(/function buildDateMarkers\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-markers builder");
  assertTrue(/function getDateFieldsFromRules\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-fields resolver");
  assertTrue(/function getDateValuePatterns\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date value-patterns helper");
  assertTrue(/function getDefaultDateLikeMarkers\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-like markers helper");
  assertTrue(/function isDateLikeToken\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-like token classifier");
  assertTrue(/function hasDateLikeMarkerInText\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-like marker text classifier");
  assertTrue(/function removeMarkerTokensFromSegment\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export marker-token remover helper");
  assertTrue(/function getDateMarkersFromRules\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date marker resolver");
  assertTrue(/function reorderSegmentTokensByOrder\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export segment reorder helper");
  assertTrue(/function getDefaultTagTokenKeyMapOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export default token-key-map options helper");
  assertTrue(/function getStatusTagReorderOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export status-tag reorder options helper");
  assertTrue(/function getStatusMixedReorderOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export status-mixed reorder options helper");
  assertTrue(/function getTagWheelMixedReorderOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export tagwheel-mixed reorder options helper");
  assertTrue(/function buildTagTokenKeyMap\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export tag token-key map builder");
  assertTrue(/function readRulesMarkdownWithFallback\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export rules reader");
  assertTrue(/function loadSharedModule\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports shared module loader");
  assertTrue(/function reportLoaderFallback\(stage, err\)/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exposes debug-gated loader fallback reporter");
  assertTrue(/reportLoaderFallback\(`pkm_runtime_bootstrap\.loadSharedModule:\$\{modulePath\}`, e\)/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap reports shared-module loader fallback context");
  assertTrue(/reportLoaderFallback\("pkm_runtime_bootstrap\.loadVaultModuleBridgeShared", e\)/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap reports bridge loader fallback context");
  assertFalse(/function cycleStatusTags\(/.test(pkmRuntimeV2Src), "pkm_runtime_v2 no longer keeps legacy cycleStatusTags runtime path");
  assertFalse(/function cycleStatusDate\(/.test(pkmRuntimeV2Src), "pkm_runtime_v2 no longer keeps legacy cycleStatusDate runtime path");
  assertEq(typeof pkmRuntimeV2.runCommand, "function", "pkm_runtime_v2 exports runCommand entry");
  assertEq(typeof pkmRuntimeV2.loadPkmRules, "undefined", "pkm_runtime_v2 no longer exports legacy loadPkmRules helper");
  assertEq(typeof pkmRuntimeV2.cycleStatusTags, "undefined", "pkm_runtime_v2 no longer exports legacy cycleStatusTags helper");
  assertEq(typeof pkmRuntimeV2.cycleStatusDate, "undefined", "pkm_runtime_v2 no longer exports legacy cycleStatusDate helper");
  assertTrue(/function loadRuntimeBootstrap\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports bootstrap resolver");
  assertTrue(/function reportLoaderFallback\(stage, err\)/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exposes debug-gated loader fallback reporter");
  assertTrue(/reportLoaderFallback\("pkm_runtime_preload_facade\.loadRuntimeBootstrap", e\)/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade reports bootstrap loader fallback context");
  assertTrue(/function loadLinePipeline\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports line pipeline loader");
  assertTrue(/function loadMacroShared\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports macro loader");
  assertTrue(/function loadRulesRuntimeHelpers\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports rules helpers loader");
  assertTrue(/function resolveOrderConfig\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports order resolver");
  assertTrue(/function loadVaultModuleBridgeShared\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports vault bridge loader");
  assertTrue(/function normalizeOrderKeyFallback\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports order-key fallback normalizer");
  assertTrue(/function loadOrderKeyNormalizer\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports order-key normalizer loader");
  assertTrue(/function loadOrderConfigFromPluginData\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports plugin data order-config loader");
  assertTrue(/function resolveOrderConfig\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports order-config resolver");
  assertTrue(/const hasSettingsOrder = rawSettings !== undefined && rawSettings !== null/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap detects explicit settings order config");
  assertTrue(/if \(hasSettingsOrder\) \{\s*return parseOrderConfig\(rawSettings, normalizeKey\);\s*\}/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap prioritizes settings order config over plugin data fallback");
  assertTrue(/function loadVaultModule\(/.test(vaultBridgeSrc), "vault module bridge exports loader");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(ctxApp, "loadRuntimePreloadFacade"\)/, /loadRuntimePreloadFacade\(app_\)/], "status_tags uses runtime preload facade");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(ctxApp, "loadRuntimePreloadFacade"\)/, /loadRuntimePreloadFacade\(app_\)/], "status_date uses runtime preload facade");
  assertAnyMatch(tagwheelSrc, [/loadRuntimePreloadFacade\(\)/, /callRuntimeApi\(app_, 'loadRuntimePreloadFacade'\)/], "tagwheel uses runtime preload facade");
  assertTrue(/__inlineGetPkmMacroRuntime/.test(statusTagsSrc), "status_tags uses global reusable macro runtime getter");
  assertTrue(/__inlineGetPkmMacroRuntime/.test(statusDateSrc), "status_date uses global reusable macro runtime getter");
  assertTrue(/__inlineGetPkmMacroRuntime/.test(tagwheelSrc), "tagwheel uses global reusable macro runtime getter");
  assertTrue(/pkm_domain_registry\.js/.test(src), "main loads canonical pkm domain registry module");
  assertTrue(/pkm_domain_registry\.js/.test(pkmRulesHelpersSrc), "rules runtime helpers reference canonical pkm domain registry module");
  assertTrue(/pkm_domain_registry\.js/.test(statusDateSrc), "status_date references canonical pkm domain registry module");
  assertTrue(/pkm_domain_registry\.js/.test(tagwheelSrc), "tagwheel references canonical pkm domain registry module");
  assertTrue(/status_runtime_common\.js/.test(statusTagsSrc), "status_tags references shared status runtime common module");
  assertTrue(/status_runtime_common\.js/.test(statusDateSrc), "status_date references shared status runtime common module");
  assertTrue(/date_runtime_shared\.js/.test(statusDateSrc), "status_date references shared date runtime module");
  assertTrue(/date_runtime_shared\.js/.test(tagwheelSrc), "tagwheel references shared date runtime module");
  assertTrue(/tagwheel_rules_normalizer\.js/.test(tagwheelCoreSrc), "tagwheel_core references shared rules normalizer module");
  assertFalse(/isTimeLike \? "🕒" : \(isDateLike \? "📅" : ""\)/.test(rendererPairSrc), "settings renderer infer-element defaults have no hardcoded emoji markers");
  assertFalse(/"📅"|"🛫"|"🕒"|"⌛"|"⏳"|"➕"|"🔁"/.test(codecSrc), "tagwheel config codec has no hardcoded emoji defaults");
  assertTrue(/LINE_FINALIZE_UNIFIED_PATH/.test(statusDateSrc), "status_date references unified line finalizer module path");
  assertTrue(/function createStatusRuntimeCommon\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared status runtime factory");
  assertTrue(/function resolvePanelKeyForField\(/.test(tagwheelSrc), "tagwheel defines panel-key resolver for field placement");
  assertTrue(/field\.dependsOn/.test(tagwheelSrc), "tagwheel panel-key resolver handles dependsOn inheritance for child fields");
  assertTrue(/function enforceDependentAdjacencyBySelection\(/.test(tagwheelSrc), "tagwheel defines dependent adjacency post-order pass");
  assertTrue(/finalLine = enforceDependentAdjacencyBySelection\(finalLine, state, core\)/.test(tagwheelSrc), "tagwheel applies dependent adjacency pass after reorder");
  assertTrue(/status(?:LineRuntime|Rt)\.enforceDependentAdjacencyForStatusLine\(\{/.test(tagwheelSrc), "tagwheel dependent adjacency pass delegates to shared status-line runtime helper");
  assertFalse(/function findTokenInBuckets\(/.test(tagwheelSrc), "tagwheel has no local dependent-adjacency bucket matcher logic");
  assertTrue(/function resolveOrderKeyFromFieldId\(/.test(pkmDomainRegistrySrc), "domain registry exports field->order resolver");
  assertTrue(/function resolveRightFieldIdByOrderKey\(/.test(pkmDomainRegistrySrc), "domain registry exports order->right-field resolver");
  assertFalse(/DEFAULT_(?:LEFT|RIGHT)_ORDER|DEFAULT_ORDER_KEYS|DEFAULT_ACTIVE|DEFAULT_ENABLED/.test(pkmDomainRegistrySrc), "domain registry has no built-in default order dictionaries");
  assertFalse(/ORDER_KEY_TO_(?:LEFT|RIGHT)_FIELD_ID_DEFAULT|BUILT_IN_(?:LEFT|RIGHT)_IDS|BUILT_IN_ORDER_KEYS|\bORDER_KEYS\b/.test(pkmDomainRegistrySrc), "domain registry has no canonical order-key dictionary exports");
  assertFalse(/DEFAULT_(?:LEFT|RIGHT)_ORDER|ORDER_KEY_TO_(?:LEFT|RIGHT)_FIELD_ID_DEFAULT/.test(pkmRulesHelpersSrc), "rules helpers do not depend on registry default key maps");
  assertFalse(/BUILT_IN_(?:LEFT|RIGHT)_IDS|BUILT_IN_ORDER_KEYS/.test(src), "main does not depend on registry built-in key dictionaries");
  assertFalse(/function resolveLegacyTagActionToOrderKey\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy tag-action resolver");
  assertFalse(/function resolveLegacyDateActionToOrderKey\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy date-action resolver");
  assertFalse(/function resolveLegacyDateActionDirection\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy date-action direction resolver");
  assertFalse(/function resolveLegacyDateActionMeta\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy date-action meta resolver");
  assertTrue(/loadPkmMacroRuntimeEntrySafe\(this\.app\)/.test(src), "main preloads macro runtime entry bootstrap on startup");
  assertTrue(/bootstrapMacroRuntime\(app_, normalizeOrderKeyLocal\)/.test(statusTagsSrc), "status_tags uses reusable macro runtime bootstrap call");
  assertTrue(/bootstrapMacroRuntime\(app_, normalizeOrderKeyLocal\)/.test(statusDateSrc), "status_date uses reusable macro runtime bootstrap call");
  assertTrue(/bootstrapMacroRuntime\(app_, normalizeOrderKeyLocal\)/.test(tagwheelSrc), "tagwheel uses reusable macro runtime bootstrap call");
  assertFalse(/async function loadMacroRuntimeEntry\(/.test(statusTagsSrc), "status_tags no longer defines local loadMacroRuntimeEntry pair function");
  assertFalse(/async function loadMacroRuntimeEntry\(/.test(statusDateSrc), "status_date no longer defines local loadMacroRuntimeEntry pair function");
  assertFalse(/async function loadMacroRuntimeEntry\(/.test(tagwheelSrc), "tagwheel no longer defines local loadMacroRuntimeEntry pair function");
  assertFalse(/async function loadMacroRuntimeShared\(/.test(statusTagsSrc), "status_tags no longer defines local loadMacroRuntimeShared pair function");
  assertFalse(/async function loadMacroRuntimeShared\(/.test(statusDateSrc), "status_date no longer defines local loadMacroRuntimeShared pair function");
  assertFalse(/async function loadMacroRuntimeShared\(/.test(tagwheelSrc), "tagwheel no longer defines local loadMacroRuntimeShared pair function");
  assertTrue(/loadPkmOptionKeys\(\)|"loadPkmOptionKeys"/.test(statusTagsSrc), "status_tags loads centralized pkm option keys via shared runtime helper");
  assertTrue(/loadPkmOptionKeys\(\)|"loadPkmOptionKeys"/.test(statusDateSrc), "status_date loads centralized pkm option keys via shared runtime helper");
  assertAnyMatch(tagwheelSrc, [/loadPkmOptionKeys\(\)/, /callRuntimeApi\(app_, 'loadPkmOptionKeys'\)/], "tagwheel loads centralized pkm option keys via shared runtime helper");
  assertTrue(/pkm_macro_runtime_shared\.js/.test(pkmMacroRuntimeEntrySrc), "macro runtime entry resolves shared runtime module path");
  assertTrue(/async function bootstrapMacroRuntime\(/.test(pkmMacroRuntimeEntrySrc), "macro runtime entry exports reusable bootstrap function");
  assertTrue(/pkm_option_keys\.js/.test(pkmMacroRuntimeSharedSrc), "shared macro runtime references centralized pkm option keys module");
  assertTrue(/async function loadPkmOptionKeys\(/.test(pkmMacroRuntimeSharedSrc), "shared macro runtime exports pkm option keys loader");
  assertTrue(/loadVaultModule\(app_, PRELOAD_FACADE_PATH, false\)/.test(pkmMacroRuntimeSharedSrc), "shared macro runtime loader resolves preload facade cache-first");
  assertTrue(/loadVaultModule\(app_, modulePath, false\)/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap shared loader is cache-first");
  assertTrue(/loadVaultModule\(app_, \"\.obsidian\/plugins\/inline-overhaul\/src\/core\/vault_module_bridge\.js\", false\)/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap bridge loader is cache-first");
  assertTrue(/loadVaultModuleBridge\(app, macroPath, forceReload\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 macro loader supports force-reload flag");
  assertTrue(/async function ensureMacroRuntimeBootstrap\(app\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 preloads macro runtime bootstrap helper");
  assertFalse(/async function readVaultMtime\(pathKey\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 has no local mtime cache fallback loader");
  assertFalse(/new Function\("module", "exports", "app", "Notice"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 has no local dynamic module eval fallback");
  assertTrue(/emitDev\("pkm\.run\.start"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits dev start event");
  assertTrue(/emitDev\("pkm\.run\.result"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits dev result event");
  assertTrue(/emitDev\("pkm\.run\.error"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits dev error event");
  assertTrue(/orderConfigHash: hashShort\(String\(nz\(settings\["Order config"\], ""\)\)\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits order config hash in dev start event");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(app_, "loadRulesRuntimeHelpers"\)/, /await loadRulesRuntimeHelpers\(app_\);/], "status_tags preloads shared rules helpers");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(app_, "loadRulesRuntimeHelpers"\)/, /await loadRulesRuntimeHelpers\(app_\);/], "status_date preloads shared rules helpers");
  assertFalse(/function resolveLegacyTagActionOrderKey\(/.test(statusTagsSrc), "status_tags has no legacy tag-action resolver ingress");
  assertFalse(/const legacy = resolveLegacyTagActionOrderKey\(actionKey\);/.test(statusTagsSrc), "status_tags field action resolver has no legacy resolver helper path");
  assertFalse(/const legacy = resolveLegacyTagActionOrderKey\(v\);/.test(statusTagsSrc), "status_tags minimal-off action resolver has no legacy helper path");
  assertFalse(/resolveLegacyDateActionMeta|resolveLegacyDateActionToOrderKey/.test(statusDateSrc), "status_date has no legacy date-action parsing path");
  assertTrue(/getStatusRuntimeCommon\(\)\.resolveOrderConfig\(app_, settings\)|statusCommon\.resolveOrderConfig\(app_, settings\)/.test(statusTagsSrc), "status_tags order-config resolver is shared runtime-common backed");
  assertTrue(/getStatusRuntimeCommon\(\)\.resolveOrderConfig\(app_, settings\)|statusCommon\.resolveOrderConfig\(app_, settings\)/.test(statusDateSrc), "status_date order-config resolver is shared runtime-common backed");
  assertFalse(/stripPrefixWhenSourceHasNoPrefix:\s*true/.test(statusTagsSrc), "status_tags has no unconditional stripPrefixWhenSourceHasNoPrefix=true");
  assertTrue(/freeRoamMode\s*!==\s*"off"[\s\S]*removeSyntheticLeadingPrefix\(/.test(statusTagsSrc), "status_tags guards synthetic prefix removal for off mode");
  assertTrue(/enforceOffModeFinalPrefix\([\s\S]*freeRoamMode[\s\S]*lineFinalize[\s\S]*cycleEndBehavior/.test(statusTagsSrc), "status_tags enforces off-mode list prefix fallback when missing");
  assertTrue(statusTagsSrc.indexOf("statusCommon.applyOrderToRules(rules, orderCfg);") < statusTagsSrc.indexOf("core.validateRules(rules);"), "status_tags applies order before validateRules");
  assertTrue(statusDateSrc.indexOf("statusCommon.applyOrderToRules(rules, orderCfg);") < statusDateSrc.indexOf("core.validateRules(rules);"), "status_date applies order before validateRules");
  assertTrue(/getFieldById\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared field resolver");
  assertTrue(/getActiveValues\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared active-values resolver");
  assertTrue(/getFieldValueById\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared value-by-id resolver");
  assertTrue(/getFieldValueByToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared value-by-token resolver");
  assertTrue(/getValueId\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared value-id resolver");
  assertTrue(/resolveSubtagFormat\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared subtag-format resolver");
  assertTrue(/getAllowedSubValues\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared sub-value resolver");
  assertTrue(/setCursorIfChanged\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared cursor setter");
  assertTrue(/parseIsoDateSafe\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared ISO date parser");
  assertTrue(/getTodayIso\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared current-date formatter");
  assertTrue(/escapeRx\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared regex-escape helper");
  assertTrue(/getReferenceDateForUnit\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared reference-date resolver");
  assertTrue(/getSearchLimitByUnit\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared search-limit resolver");
  assertTrue(/addByUnitUtc\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared UTC date-step helper");
  assertTrue(/buildPriorityTokenMapFromLine\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority token-map builder");
  assertTrue(/buildPriorityCycleTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority cycle-token builder");
  assertTrue(/buildPriorityCycleTokensFromRules\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority cycle-from-rules builder");
  assertTrue(/resolvePriorityCycleTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority cycle resolver");
  assertTrue(/normalizePriorityToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority-token normalizer");
  assertTrue(/countPriorityTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority-token counter");
  assertTrue(/stripPriorityTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority-token stripper");
  assertTrue(/parseDateByFormat\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date parser by format");
  assertTrue(/formatDateByFormat\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date formatter by format");
  assertTrue(/replaceRange\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared replace-range helper");
  assertTrue(/cleanupSpacing\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared spacing cleanup helper");
  assertTrue(/fieldKeyByAction\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared field-key-by-action resolver");
  assertTrue(/isMinimalOffNoSeparatorAction\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared minimal-off action detector");
  assertTrue(/hasToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared segment-token detector");
  assertTrue(/composeToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared token composer");
  assertTrue(/normalizeImportanceTokenShape\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared importance-token normalizer");
  assertTrue(/detectDateUnit\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date-unit detector");
  assertTrue(/getDateProgressForStep\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date-progress resolver");
  assertTrue(/normalizeDirection\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared direction normalizer");
  assertTrue(/common\.getFieldById\(mode, id\)/.test(statusTagsSrc), "status_tags delegates field lookup to shared runtime common");
  assertTrue(/common\.getActiveValues\(field\)/.test(statusTagsSrc), "status_tags delegates active values lookup to shared runtime common");
  assertTrue(/common\.getFieldValueById\(field, valueId\)/.test(statusTagsSrc), "status_tags delegates value-by-id lookup to shared runtime common");
  assertTrue(/common\.getFieldValueByToken\(field, token\)/.test(statusTagsSrc), "status_tags delegates value-by-token lookup to shared runtime common");
  assertTrue(/common\.getValueId\(v\)/.test(statusTagsSrc), "status_tags delegates value-id lookup to shared runtime common");
  assertTrue(/common\.resolveSubtagFormat\(settings\?\.\[SUBTAG_FORMAT\], rules\)/.test(statusTagsSrc), "status_tags delegates subtag-format resolution to shared runtime common");
  assertTrue(/common\.getAllowedSubValues\(subField, parentToken\)/.test(statusTagsSrc), "status_tags delegates allowed-sub-values resolution to shared runtime common");
  assertTrue(/common\.escapeRx\(s\)/.test(statusTagsSrc), "status_tags delegates regex escaping to shared runtime common");
  assertTrue(/common\.buildPriorityTokenMapFromLine\(line\)/.test(statusTagsSrc), "status_tags delegates priority token-map build to shared runtime common");
  assertTrue(/common\.buildPriorityCycleTokens\(tokenMap, normalizePriorityToken\)/.test(statusTagsSrc), "status_tags delegates priority cycle-token build to shared runtime common");
  assertTrue(/common\.buildPriorityCycleTokensFromRules\(rules, normalizePriorityToken\)/.test(statusTagsSrc), "status_tags delegates priority cycle-from-rules build to shared runtime common");
  assertTrue(/common\.resolvePriorityCycleTokens\(tokenMap, rules, line, normalizePriorityToken\)/.test(statusTagsSrc), "status_tags delegates priority cycle resolver to shared runtime common");
  assertTrue(/common\.normalizePriorityToken\(raw\)/.test(statusTagsSrc), "status_tags delegates priority-token normalization to shared runtime common");
  assertTrue(/common\.countPriorityTokens\(line\)/.test(statusTagsSrc), "status_tags delegates priority-token counting to shared runtime common");
  assertTrue(/common\.stripPriorityTokens\(line\)/.test(statusTagsSrc), "status_tags delegates priority-token stripping to shared runtime common");
  assertTrue(/common\.replaceRange\(text, start, end, replacement\)/.test(statusTagsSrc), "status_tags delegates replace-range helper to shared runtime common");
  assertTrue(/common\.cleanupSpacing\(text\)/.test(statusTagsSrc), "status_tags delegates spacing cleanup helper to shared runtime common");
  assertTrue(/common\.fieldKeyByAction\(action, fallbackKey\)/.test(statusTagsSrc), "status_tags delegates field-key-by-action resolver to shared runtime common");
  assertTrue(/common\.isMinimalOffNoSeparatorAction\(action\)/.test(statusTagsSrc), "status_tags delegates minimal-off action detector to shared runtime common");
  assertTrue(/common\.hasToken\(segText, token\)/.test(statusTagsSrc), "status_tags delegates segment-token detector to shared runtime common");
  assertTrue(/common\.composeToken\(prefix, rawToken\)/.test(statusTagsSrc), "status_tags delegates token composer to shared runtime common");
  assertTrue(/common\.normalizeImportanceTokenShape\(tokenRaw\)/.test(statusTagsSrc), "status_tags delegates importance-token normalizer to shared runtime common");
  assertTrue(/common\.normalizeDirection\(raw\)/.test(statusTagsSrc), "status_tags delegates direction normalizer to shared runtime common");
  assertTrue(/common\.getFieldById\(mode, id\)/.test(statusDateSrc), "status_date delegates field lookup to shared runtime common");
  assertTrue(/common\.setCursorIfChanged\(editor, lineNo, ch\)/.test(statusDateSrc), "status_date delegates cursor setter to shared runtime common");
  assertTrue(/common\.parseIsoDateSafe\(s\)/.test(statusDateSrc), "status_date delegates ISO date parsing to shared runtime common");
  assertTrue(/common\.getTodayIso\(\)/.test(statusDateSrc), "status_date delegates today-date formatting to shared runtime common");
  assertTrue(/common\.escapeRx\(s\)/.test(statusDateSrc), "status_date delegates regex escaping to shared runtime common");
  assertTrue(/common\.getReferenceDateForUnit\(unit\)/.test(statusDateSrc), "status_date delegates reference-date resolution to shared runtime common");
  assertTrue(/common\.getSearchLimitByUnit\(unit, getSharedUtils\(\)\)/.test(statusDateSrc), "status_date delegates search-limit resolution to shared runtime common");
  assertTrue(/common\.addByUnitUtc\(base, unit, delta\)/.test(statusDateSrc), "status_date delegates UTC date-step helper to shared runtime common");
  assertTrue(/common\.parseDateByFormat\(text, format, normalizeFormatMask, escapeRx\)/.test(statusDateSrc), "status_date delegates date parsing-by-format to shared runtime common");
  assertTrue(/common\.formatDateByFormat\(dt, format, normalizeFormatMask\)/.test(statusDateSrc), "status_date delegates date formatting-by-format to shared runtime common");
  assertTrue(/common\.detectDateUnit\(format, normalizeFormatMask, hasFormatTokens, getSharedUtils\(\)\)/.test(statusDateSrc), "status_date delegates date-unit detection to shared runtime common");
  assertTrue(/common\.getDateProgressForStep\(state, fieldId, format\)/.test(statusDateSrc), "status_date delegates date-progress resolver to shared runtime common");
  assertTrue(/function ensureStatusRuntimeCommonFns\(/.test(tagwheelCoreSrc), "tagwheel_core bootstraps shared status runtime common helpers");
  assertTrue(/common\.resolveSubtagFormat\(null, rules\)/.test(tagwheelCoreSrc), "tagwheel_core delegates subtag-format resolution to shared runtime common");
  assertTrue(/common\.getSearchLimitByUnit\(unit, getSharedUtils\(\)\)/.test(tagwheelCoreSrc), "tagwheel_core delegates search-limit resolver to shared runtime common");
  assertTrue(/common\.detectDateUnit\(format, normalizeFormatMask, hasFormatTokens, getSharedUtils\(\)\)/.test(tagwheelCoreSrc), "tagwheel_core delegates date-unit detection to shared runtime common");
  assertTrue(/common\.getDateProgressForStep\(state, fieldId, format\)/.test(tagwheelCoreSrc), "tagwheel_core delegates date-progress resolver to shared runtime common");
  assertTrue(/facade\.resolveOrderConfig/.test(tagwheelSrc), "tagwheel order-config resolver is preload-facade backed");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(app_, "loadMacroShared"\)/, /await loadMacroShared\(app_\);/], "status_tags preloads shared macro helpers");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(app_, "loadMacroShared"\)/, /await loadMacroShared\(app_\);/], "status_date preloads shared macro helpers");
  assertTrue(/ensureLineFinalizeUnifiedLoaded\(app_\)/.test(statusDateSrc), "status_date loads unified line finalizer module");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusDateSrc) || /lineFinalize\.applyMixedPostPolicies\(rawLine, finalLine, rules, \{/.test(statusDateSrc), "status_date applies shared mixed post-policy through unified finalizer helper");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusDateSrc), "status_date applies shared trailing-separator policy helper");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusDateSrc) || /lineFinalize\.applyFinalLineInvariants\(\{/.test(statusDateSrc), "status_date applies shared final-line invariants through unified finalizer path");
  assertTrue(/lineFinalize\.applyCycleEndAndInvariants\(\{/.test(statusDateSrc) || /applyCycleEndPostProcessing\(\{/.test(statusDateSrc), "status_date delegates cycle-end post-processing through shared finalizer helper");
  assertTrue(/resolveCursorByPolicy\(\{/.test(statusDateSrc), "status_date delegates cursor policy resolution to shared finalizer");
  assertTrue(/macroShared\.getCursorAtTextEnd\(line, runtimeRules\)/.test(statusTagsSrc), "status_tags text-end cursor delegates to shared helper");
  assertTrue(/macroShared\.getCursorAtTextEnd\(line, runtimeRules\)/.test(statusDateSrc), "status_date text-end cursor delegates to shared helper");
  assertTrue(/getStatusRuntimeCommon\(\)\.applyOrderToRules\(rules, orderCfg\)|statusCommon\.applyOrderToRules\(rules, orderCfg\)/.test(statusTagsSrc), "status_tags order-apply helper is shared runtime-common backed");
  assertTrue(/getStatusRuntimeCommon\(\)\.getPanelForField\(orderCfg, fieldKey\)|statusCommon\.getPanelForField\(orderCfg, "type"\)|statusCommon\.getPanelForField\(orderCfg, k\.slice\(0, -4\)\)/.test(statusTagsSrc), "status_tags panel resolver is shared runtime-common backed");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder"\);/.test(statusTagsSrc), "status_tags segment reorder helper is shared-only");
  assertTrue(/rulesHelpers\.getStatusTagReorderOptions\(\)/.test(statusTagsSrc), "status_tags tag-only reorder options come from shared helper");
  assertTrue(/rulesHelpers\.getStatusMixedReorderOptions\(markers\)/.test(statusTagsSrc), "status_tags mixed reorder options come from shared helper");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules"\);/.test(statusTagsSrc), "status_tags date marker helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap"\);/.test(statusTagsSrc), "status_tags token-key map helper is shared-only");
  assertTrue(/rulesHelpers\.getDefaultTagTokenKeyMapOptions\(\)/.test(statusTagsSrc), "status_tags token-key map options come from shared helper");
  assertTrue(/function buildOutputTokenForField\(/.test(statusTagsSrc), "status_tags has unified output-token builder for tag\/link fields");
  assertTrue(/lineFinalize\.normalizeMinimalOffFinalLine\(rawLine, finalLine, rules, \{/.test(statusTagsSrc), "status_tags minimal-off normalization is delegated to unified line finalizer");
  assertFalse(/function reapplyOriginalPrefix\(rawLine, nextLine\)/.test(statusTagsSrc), "status_tags has no local prefix-reapply wrapper");
  assertTrue(/function reapplyOriginalPrefix\(rawLine, nextLine\)/.test(pkmMacroSharedSrc), "pkm_macro_shared exposes shared prefix reapply helper");
  assertTrue(/function preserveOriginalPrefixShape\(rawLine, nextLine\)/.test(pkmMacroSharedSrc), "pkm_macro_shared exposes shared prefix shape helper");
  assertTrue(/LINE_FINALIZE_UNIFIED_PATH/.test(statusTagsSrc), "status_tags defines unified line finalizer module path");
  assertTrue(/ensureLineFinalizeUnifiedLoaded\(app_\)/.test(statusTagsSrc), "status_tags loads unified line finalizer module");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusTagsSrc) || /lineFinalize\.applyMixedPostPolicies\(rawLine, finalLine, rules, \{/.test(statusTagsSrc), "status_tags applies shared mixed post-policy through unified finalizer path");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusTagsSrc), "status_tags applies shared trailing-separator policy helper from unified finalizer");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusTagsSrc) || /lineFinalize\.applyFinalLineInvariants\(\{/.test(statusTagsSrc), "status_tags applies shared final-line invariants through unified finalizer path");
  assertTrue(/lineFinalize\.applyCycleEndAndInvariants\(\{/.test(statusTagsSrc) || /lineFinalize\.applyCycleEndPostProcessing\(\{/.test(statusTagsSrc), "status_tags delegates cycle-end post-processing through shared finalizer helper");
  assertTrue(/lineFinalize\.isSimplePlainRaw\(rawLine, rules/.test(statusTagsSrc), "status_tags plain-raw minimal guard delegates to shared finalizer helper");
  assertTrue(/lineFinalize\.resolveCursorByPolicy\(\{/.test(statusTagsSrc), "status_tags delegates cursor policy resolution to shared finalizer");
  assertTrue(/LINE_FINALIZE_UNIFIED_PATH/.test(tagwheelSrc), "tagwheel defines unified line finalizer module path");
  assertTrue(/loadLineFinalizeUnified\(app_\)/.test(tagwheelSrc), "tagwheel loads unified line finalizer module");
  assertTrue(/finalize\.applyUnifiedPostFinalize\(\{/.test(tagwheelSrc) || /finalLine = finalize\.applyMixedPostPolicies\(state\.originalLine, finalLine, state\.rules, policy\)/.test(tagwheelSrc), "tagwheel applies shared mixed post policies through unified finalizer path");
  assertTrue(/finalize\.applyUnifiedPostFinalize\(\{/.test(tagwheelSrc) || /finalLine = finalize\.applyFinalLineInvariants\(\{/.test(tagwheelSrc), "tagwheel applies shared final-line invariants through unified finalizer path");
  assertTrue(/applyCycleEndAndInvariants\(/.test(tagwheelSrc) || /applyCycleEndPostProcessing\(/.test(tagwheelSrc), "tagwheel delegates cycle-end post-processing to shared finalizer");
  assertTrue(/resolveCursorByPolicy\(/.test(tagwheelSrc), "tagwheel delegates cursor policy resolution to shared finalizer");
  assertFalse(/function removeTokenWholeLine\(/.test(tagwheelSrc), "tagwheel no longer defines local removeTokenWholeLine helper");
  assertFalse(/function insertTokenAtIndex\(/.test(tagwheelSrc), "tagwheel no longer defines local insertTokenAtIndex helper");
  assertFalse(/function resolveInsertIndexByPlacement\(/.test(tagwheelSrc), "tagwheel no longer defines local resolveInsertIndexByPlacement helper");
  assertTrue(/function applyPrefixPolicy\(rawLine, builtLine, options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports applyPrefixPolicy helper");
  assertTrue(/function applyMixedPostPolicies\(rawLine, line, rules, policy\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports mixed post-policy helper");
  assertTrue(/function applyCycleEndPostProcessing\(options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports cycle-end post-processing helper");
  assertTrue(/function applyFinalLineInvariants\(options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports final-line invariant helper");
  assertTrue(/function removeTokenWholeLine\(line, token\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared removeTokenWholeLine primitive");
  assertTrue(/function insertTokenAtIndex\(src, token, idx\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared insertTokenAtIndex primitive");
  assertTrue(/function resolveInsertIndexByPlacement\(src, cursorAt, placement\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared resolveInsertIndexByPlacement primitive");
  assertTrue(/function isSimplePlainRaw\(rawLine, rules, options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared plain-raw guard helper");
  assertTrue(/function resolveCursorByPolicy\(options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports cursor policy resolver");
  assertTrue(/macroShared\.applyKeepBullet\(editor, lineNo, parsedWork, \{ keepParsedPrefix: true, keepCheckbox: false \}\)/.test(statusTagsSrc), "status_tags keep-bullet preserves parsed bullet prefix without stale checkbox");
  assertTrue(/linePipeline\.splitLeftPrefix\(seg\.left\)/.test(statusTagsSrc), "status_tags relocation uses shared left-prefix splitter");
  assertTrue(/linePipeline\.joinLeftPrefix\(leftParts\.prefix, orderedLeftBody\)/.test(statusTagsSrc), "status_tags relocation uses shared left-prefix joiner");
  assertTrue(/linePipeline\.buildFromSegments\(seg, rules\)/.test(statusTagsSrc), "status_tags render path uses shared buildFromSegments helper");
  assertTrue(/customRelocation = \{/.test(statusTagsSrc), "status_tags stores relocation plan for cycle_field custom fields");
  assertTrue(/selectedTokenFromState\(customRelocation\.field, state, rules\)/.test(statusTagsSrc), "status_tags applies relocated custom field token from state");
  assertTrue(/selectedTokenFromState\(customParentRelocation\.field, state, rules\)/.test(statusTagsSrc), "status_tags applies relocated custom parent token for sub-actions");
  assertTrue(/function enforceDependentAdjacencyForStatusLine\(/.test(statusTagsSrc), "status_tags has dedicated dependent-adjacency stabilization for cycle runtime");
  assertTrue(/STATUS_LINE_RUNTIME_UNIFIED_PATH/.test(statusTagsSrc), "status_tags defines shared status-line runtime module path");
  assertTrue(/ensureStatusLineRuntimeUnifiedLoaded\(app_\)/.test(statusTagsSrc), "status_tags preloads shared status-line runtime module");
  assertTrue(/runtime\.relocateCoreTagsByOrder\(\{/.test(statusTagsSrc), "status_tags core tag relocation delegates to shared status-line runtime module");
  assertTrue(/runtime\.enforceDependentAdjacencyForStatusLine\(\{/.test(statusTagsSrc), "status_tags dependent adjacency delegates to shared status-line runtime module");
  assertTrue(/typeof mod\.stripFieldTokenSetFromLine !== "function"/.test(statusTagsSrc), "status_tags shared status-line runtime loader requires field-token stripping helper");
  assertTrue(/typeof mod\.clearDependentSelections !== "function"/.test(statusTagsSrc), "status_tags shared status-line runtime loader requires dependent-selection clear helper");
  assertTrue(/runtime\.stripFieldTokenSetFromLine\(\{/.test(statusTagsSrc) || /getStatusLineRuntimeUnified\(\)\.stripFieldTokenSetFromLine\(\{/.test(statusTagsSrc), "status_tags field-token stripping delegates to shared status-line runtime module");
  assertTrue(/runtime\.clearDependentSelections\(\{ rules, state, parentFieldId \}\)/.test(statusTagsSrc) || /getStatusLineRuntimeUnified\(\)\.clearDependentSelections\(\{[\s\S]*rules,[\s\S]*state,[\s\S]*parentFieldId: targetField\.id/.test(statusTagsSrc), "status_tags dependent-selection clear delegates to shared status-line runtime module");
  assertTrue(/function relocateCoreTagsByOrder\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports relocation algorithm");
  assertTrue(/function normalizeFieldList\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime normalizes relocation fields generically");
  assertFalse(/activeKey === "type"|activeKey === "category"|activeKey === "type_sub"|activeKey === "category_sub"/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime has no canonical active-key hardcode branches");
  assertTrue(/function buildCombinedSelectionSet\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports generic combined-selection builder");
  assertTrue(/function applyCombinedToTokenList\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports generic combined token collapse helper");
  assertTrue(/function stripFieldTokenSetFromLine\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports field-token stripping helper");
  assertTrue(/function clearDependentSelections\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports dependent-selection clear helper");
  assertTrue(/runtime\.buildCombinedSelectionSet\(\{/.test(statusTagsSrc), "status_tags combined render delegates pair-build logic to shared status-line runtime");
  assertTrue(/STATUS_LINE_RUNTIME_UNIFIED_PATH/.test(tagwheelSrc) && /loadStatusLineRuntimeUnified\(app_\)/.test(tagwheelSrc), "tagwheel runtime preloads shared status-line runtime for universal combined behavior");
  assertTrue(/typeof mod\.enforceDependentAdjacencyForStatusLine !== 'function'/.test(tagwheelSrc), "tagwheel shared status-line runtime loader requires adjacency api");
  assertTrue(/function normalizeMinimalOffFinalLine\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes minimal-off normalizer");
  assertTrue(/function alignMinimalNoSeparatorPrefix\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes minimal no-separator prefix aligner");
  assertTrue(/function relocateOffEntriesToRightPanel\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes off-right relocation helper");
  assertTrue(/function applyFullNoSourceNormalization\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes full-no-source normalization helper");
  assertTrue(/function applyOffSelectionPostPolicies\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes off-selection post-policy helper");
  assertTrue(/function applyMinimalSelectionNormalization\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes minimal-selection normalization helper");
  assertTrue(/function resolveEffectiveSelectionPolicy\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes active-mode-aware mixed policy helper");
  assertTrue(/function hasAnySeparator\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes separator-presence helper");
  assertTrue(/hasCheckboxListPrefix,/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports checkbox-list prefix helper");
  assertTrue(/function applyResolvedPrefixToLine\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes resolved-prefix application helper");
  assertTrue(/function applyUnifiedPostFinalize\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes unified post-finalize pipeline helper");
  assertTrue(/function applyCycleEndAndInvariants\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes cycle-end plus invariants helper");
  assertTrue(/finalLine = lineFinalize\.normalizeMinimalOffFinalLine\(rawLine, finalLine, rules(?:, \{[\s\S]*?\})?\);/.test(statusTagsSrc), "status_tags minimal-off normalization uses unified finalizer pass");
  assertTrue(/lineFinalize\.alignMinimalNoSeparatorPrefix\(\{/.test(statusTagsSrc), "status_tags minimal no-separator prefix rewrite delegates to shared finalizer");
  assertFalse(/const desiredCheckbox\s*=/.test(statusTagsSrc), "status_tags has no local desiredCheckbox rewrite branch");
  assertTrue(/relocateOffEntriesToRightPanel\(\{/.test(pkmLineFinalizeUnifiedSrc), "off-right relocation is implemented in shared finalizer helper");
  assertFalse(/var offTokens = \[\]/.test(tagwheelSrc), "tagwheel has no local off-right token relocation accumulator");
  assertTrue(/finalLine = enforceDependentAdjacencyForStatusLine\(finalLine, rules, state, core\);/.test(statusTagsSrc), "status_tags applies dependent adjacency stabilization in final runtime path");
  assertFalse(/const fallback = direction === "decrease" \? cycle\[cycle\.length - 1\] : cycle\[0\];/.test(statusTagsSrc), "status_tags custom cycle has no edge fallback wrap");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: segmentHasToken"\);/.test(statusTagsSrc), "status_tags token matcher is shared-only");
  assertTrue(/throw new Error\("line_pipeline unavailable: removeExactTokens"\);/.test(statusTagsSrc), "status_tags token remover delegates to shared line-pipeline helper");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: getCursorAtTextEnd"\);/.test(statusTagsSrc), "status_tags text-end helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: applyKeepBullet"\);/.test(statusTagsSrc), "status_tags keep-bullet helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: isOrphanCheckboxBulletLine"\);/.test(statusDateSrc), "status_date orphan-checkbox helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: isNoContentParsed"\);/.test(statusTagsSrc), "status_tags no-content helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: isNoContentParsed"\);/.test(statusDateSrc), "status_date no-content helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: getCursorAtTextEnd"\);/.test(statusDateSrc), "status_date text-end helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: buildBulletOnlyLine"\);/.test(statusDateSrc), "status_date bullet-only helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: applyKeepBullet"\);/.test(statusDateSrc), "status_date keep-bullet helper is shared-only");
  assertFalse(/resolveLegacyDateActionMeta|resolveLegacyDateActionToOrderKey/.test(statusDateSrc), "status_date no longer parses legacy date-action aliases");
  assertTrue(/getStatusRuntimeCommon\(\)\.applyOrderToRules\(rules, orderCfg\)|statusCommon\.applyOrderToRules\(rules, orderCfg\)/.test(statusDateSrc), "status_date order-apply helper is shared runtime-common backed");
  assertTrue(/getStatusRuntimeCommon\(\)\.getPanelForField\(orderCfg, fieldKey\)|statusCommon\.getPanelForField\(orderCfg, actionFieldKey\)/.test(statusDateSrc), "status_date panel resolver is shared runtime-common backed");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildPanelOrderKeys"\);/.test(statusDateSrc), "status_date panel-order helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder"\);/.test(statusDateSrc), "status_date segment reorder helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: getStatusMixedReorderOptions"\);/.test(statusDateSrc), "status_date mixed reorder options helper is shared-only");
  assertTrue(/shared\.getStatusMixedReorderOptions\(markers\)/.test(statusDateSrc), "status_date mixed reorder options come from shared helper");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap"\);/.test(statusDateSrc), "status_date token-key map helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildDateMarkers"\);/.test(statusDateSrc) || /throw new Error\("pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules"\);/.test(statusDateSrc), "status_date date-markers helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: getDateValuePatterns"\);/.test(statusDateSrc), "status_date date value-patterns helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: isDateLikeToken"\);/.test(statusDateSrc), "status_date date-like token classifier is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: hasDateLikeMarkerInText"\);/.test(statusDateSrc), "status_date date-like marker text classifier is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: removeMarkerTokensFromSegment"\);/.test(statusDateSrc), "status_date marker-token remover helper is shared-only");
  assertTrue(/buildDateMarkers\(timeMarker, startMarker, dueMarker\)/.test(statusDateSrc) || /rulesHelpersForDates\.getDateMarkersFromRules\(rules\)/.test(statusDateSrc), "status_date runtime markers are resolved via shared helper");
  assertTrue(/\.\.\.dateMarkers,\s*generic:\s*actionMarker/.test(statusDateSrc), "status_date extends shared date-markers map with active generic marker for reorder");
  assertTrue(/rulesHelpersForDates\.getDateValuePatterns\(\)/.test(statusDateSrc), "status_date text cleanup uses shared date value-patterns helper");
  assertFalse(/\[📅🛫\]/.test(statusDateSrc), "status_date has no hardcoded date emoji regex class in marker cleanup");
  assertFalse(/\)🕒/.test(statusDateSrc), "status_date has no hardcoded time emoji token in marker cleanup");
  assertTrue(/offPrefix: false/.test(src), "main default config includes offPrefix toggle with OFF default");
  assertTrue(/tagwheelHeader:\s*\{[\s\S]*defaultTextColor:\s*""[\s\S]*fillColor:\s*""[\s\S]*showPrefix:\s*true/.test(src), "main default config includes tagwheel header visual colors and showPrefix toggle");
  assertTrue(/tagVisuals:\s*\{[\s\S]*showColorSettings:\s*false[\s\S]*tagTextSizePct:\s*100,[\s\S]*tagBubbleWidthPct:\s*100,[\s\S]*tagBubbleHeightPct:\s*100,[\s\S]*emptyBubbleSizePct:\s*100,[\s\S]*tagShapePct:\s*0,[\s\S]*opacity:\s*\{[\s\S]*left:\s*1,[\s\S]*right:\s*1[\s\S]*\}[\s\S]*strip:\s*\{[\s\S]*active:\s*false,[\s\S]*fieldId:\s*""[\s\S]*thickness:\s*2,[\s\S]*childOffset:\s*12/.test(src), "main default config includes strip-only tagVisuals defaults (text-size/bubble-width/bubble-height/empty-size/shape/opacity/strip)");
  assertTrue(/if \(!isObj\(cfg\.pkm\.behavior\.tagVisuals\)\) cfg\.pkm\.behavior\.tagVisuals = cloneJson\(DEFAULT_CONFIG\.pkm\.behavior\.tagVisuals\);/.test(src), "main migration initializes tagVisuals block when missing");
  assertTrue(/const normOpacity = \(value, fallback\) => \{[\s\S]*Math\.max\(0, Math\.min\(1, n\)\)/.test(src), "main migration clamps tagVisuals opacity to 0..1");
  assertTrue(/const normalizeTagToken = \(token\) => \{[\s\S]*return src\.charAt\(0\) === "#" \? src : "";/.test(src), "main migration keeps tagVisuals tokens strictly hash-prefixed");
  assertTrue(/visuals\.strip = strip;/.test(src), "main migration normalizes strip config through shared strip engine");
  assertTrue(/offPrefix: fr\.offPrefix === true/.test(src), "order serializer exports offPrefix behavior flag");
  assertTrue(/offPrefix/.test(pkmRulesHelpersSrc), "shared rules helper parses and resolves offPrefix behavior");
  assertTrue(/offPrefix: false/.test(statusRuntimeCommonSrc), "status runtime common fallback includes offPrefix default OFF");
  assertTrue(/function resolveOffPrefixFlagsUnified\(/.test(pkmLineFinalizeUnifiedSrc), "line finalizer exports unified off-prefix resolver");
  assertTrue(/lineFinalize\.resolveOffPrefixFlagsUnified\(\{/.test(statusTagsSrc), "status_tags delegates off-prefix resolution to shared line finalizer");
  assertTrue(/throw new Error\("line_pipeline unavailable: removeCombinedByParentTokens"\);/.test(statusTagsSrc), "status_tags combined-subtag cleanup requires shared line-pipeline helper");
  assertTrue(/shared\.removeCombinedByParentTokens\(\{/.test(statusTagsSrc), "status_tags combined-subtag cleanup delegates to shared line-pipeline helper");
  assertTrue(/throw new Error\("line_pipeline unavailable: removeTokensAcrossSegments"\);/.test(statusTagsSrc), "status_tags field-token stripping requires shared line-pipeline helper");
  assertTrue(/shared\.removeTokensAcrossSegments\(\{/.test(statusTagsSrc), "status_tags field-token stripping delegates to shared line-pipeline helper");
  assertTrue(/const hasAnySeparatorFn = lineFinalize\.hasAnySeparator;/.test(statusTagsSrc), "status_tags separator-presence checks strictly use shared finalizer helper");
  assertTrue(/typeof mod\.resolveEffectiveSelectionPolicy !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared effective-policy helper");
  assertTrue(/typeof mod\.hasAnySeparator !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared separator-presence helper");
  assertTrue(/typeof mod\.hasCheckboxListPrefix !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared checkbox-list prefix helper");
  assertTrue(/typeof mod\.hasListPrefix !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared list-prefix helper");
  assertTrue(/typeof mod\.hasStandaloneCheckboxPrefix !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared standalone-checkbox helper");
  assertTrue(/typeof mod\.applyResolvedPrefixToLine !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared resolved-prefix helper");
  assertTrue(/lineFinalize\.resolveEffectiveSelectionPolicy\(\{/.test(statusTagsSrc), "status_tags resolves mixed policy via shared finalizer effective-policy helper");
  assertTrue(/lineFinalize\.applyResolvedPrefixToLine\(\{/.test(statusTagsSrc), "status_tags prefix rewrite delegates to shared resolved-prefix helper");
  assertTrue(/typeof mod\.applyUnifiedPostFinalize !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared unified post-finalize helper");
  assertTrue(/typeof mod\.applyCycleEndAndInvariants !== "function"/.test(statusTagsSrc), "status_tags line-finalizer loader requires shared cycle-end/invariants helper");
  assertFalse(/function resolveOffPrefixFlags\(/.test(statusTagsSrc), "status_tags has no local off-prefix resolver implementation");
  assertTrue(/typeof mod\.relocateOffEntriesToRightPanel !== 'function'/.test(tagwheelSrc), "tagwheel line-finalizer loader requires shared off-right relocation helper");
  assertTrue(/typeof mod\.applyFullNoSourceNormalization !== 'function'/.test(tagwheelSrc), "tagwheel line-finalizer loader requires shared full-no-source normalization helper");
  assertTrue(/typeof mod\.applyOffSelectionPostPolicies !== 'function'/.test(tagwheelSrc), "tagwheel line-finalizer loader requires shared off-selection post-policy helper");
  assertTrue(/typeof mod\.applyMinimalSelectionNormalization !== 'function'/.test(tagwheelSrc), "tagwheel line-finalizer loader requires shared minimal-selection normalization helper");
  assertTrue(/typeof mod\.applyCycleEndAndInvariants !== 'function'/.test(tagwheelSrc), "tagwheel line-finalizer loader requires shared cycle-end/invariants helper");
  assertTrue(/typeof mod\.applyUnifiedPostFinalize !== 'function'/.test(tagwheelSrc), "tagwheel line-finalizer loader requires shared unified post-finalize helper");
  assertTrue(/finalize\.applyMinimalSelectionNormalization\(\{/.test(tagwheelSrc), "tagwheel minimal-left normalization delegates to shared finalizer helper");
  assertTrue(/finalize\.applyOffSelectionPostPolicies\(\{/.test(tagwheelSrc), "tagwheel off-selection post-policy delegates to shared finalizer helper");
  assertTrue(/finalize\.applyFullNoSourceNormalization\(\{/.test(tagwheelSrc), "tagwheel full-mode no-source normalization delegates to shared finalizer helper");
  assertTrue(/finalize\.applyCycleEndAndInvariants\(\{/.test(tagwheelSrc), "tagwheel cycle-end plus final-invariants flow delegates to shared finalizer helper");
  assertTrue(/typeof mod\.applyUnifiedPostFinalize !== "function"/.test(statusDateSrc), "status_date line-finalizer loader requires shared unified post-finalize helper");
  assertTrue(/typeof mod\.applyCycleEndAndInvariants !== "function"/.test(statusDateSrc), "status_date line-finalizer loader requires shared cycle-end/invariants helper");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusDateSrc), "status_date post-finalize chain delegates to shared unified helper");
  assertTrue(/typeof mod\.resolveEffectiveSelectionPolicy !== "function"/.test(statusDateSrc), "status_date line-finalizer loader requires shared effective-policy helper");
  assertTrue(/typeof mod\.hasAnySeparator !== "function"/.test(statusDateSrc), "status_date line-finalizer loader requires shared separator-presence helper");
  assertTrue(/lineFinalize\.resolveEffectiveSelectionPolicy\(\{/.test(statusDateSrc), "status_date mixed policy uses shared effective-policy helper");
  assertTrue(/throw new Error\("line_pipeline unavailable: resolvePanelByMarkerPresence"\);/.test(statusDateSrc), "status_date marker-panel resolve requires shared line-pipeline helper");
  assertTrue(/linePipeline\.resolvePanelByMarkerPresence\(\{[\s\S]*line: rawLine,[\s\S]*rules,[\s\S]*marker: actionMarker,[\s\S]*panelByOrder/.test(statusDateSrc), "status_date marker-panel resolve delegates to shared line-pipeline helper");
  assertTrue(/throw new Error\("status_line_runtime_unified unavailable: required deterministic selection api"\);/.test(statusDateSrc), "status_date date-offset hydration requires shared deterministic marker-selector helper");
  assertTrue(/runtime\.selectMarkerValueByPanelOrder\(\{[\s\S]*line: rawLine,[\s\S]*rules,[\s\S]*panel: targetPanel,[\s\S]*marker: markerSafe/.test(statusDateSrc), "status_date date-offset hydration delegates panel-aware marker selection to shared runtime helper");
  assertTrue(/throw new Error\("line_pipeline unavailable: cleanOriginalTextForLeftDate"\);/.test(statusDateSrc), "status_date left-date text cleanup requires shared line-pipeline cleaner helper");
  assertTrue(/linePipeline\.cleanOriginalTextForLeftDate\(\{/.test(statusDateSrc), "status_date left-date text cleanup delegates to shared line-pipeline cleaner helper");
  assertTrue(/lineFinalize\.applyCycleEndAndInvariants\(\{/.test(statusDateSrc), "status_date cycle-end plus final-invariants flow delegates to shared helper");
  assertTrue(/finalize\.resolveOffPrefixFlagsUnified\(\{/.test(tagwheelSrc), "tagwheel delegates off-prefix resolution to shared line finalizer");
  assertTrue(/hasDateLikeMarkerInText\(textOnly\)/.test(statusDateSrc), "status_date due-left guard uses shared marker text classifier");
  assertTrue(/removeMarkerTokensFromSegment\(src, marker, valueRxSrc \|\| ""\)/.test(statusDateSrc), "status_date date marker cleanup uses shared marker-token remover helper");
  assertTrue(/function resolveFieldIdByOrderKey\(/.test(statusDateSrc), "status_date resolves generic order-key fields");
  assertTrue(/function getRuntimeFieldConfigRow\(/.test(statusDateSrc) && /function getElementRuntimeCfg\(/.test(statusDateSrc), "status_date resolves element runtime config via generic runtime-field lookup");
  assertTrue(/function hydrateGenericElementFromRawLine\(/.test(statusDateSrc), "status_date hydrates generic element values from line");
  assertTrue(/function applyGenericElementIncrementByFormat\(/.test(statusDateSrc), "status_date mutates generic elements via increment behavior config");
  assertTrue(/function buildGenericElementTokenFromState\(/.test(statusDateSrc), "status_date builds generic element token from format state");
  assertTrue(/shared\.relocateMarkerTokenByPanel\(\{/.test(statusDateSrc), "status_date marker relocation delegates to shared line-pipeline helper");
  assertTrue(/shared\.clearMarkerFromLine\(\{/.test(statusDateSrc), "status_date marker clear delegates to shared line-pipeline helper");
  assertTrue(/shared\.clearMarkersFromLine\(\{/.test(statusDateSrc), "status_date marker-multi-clear delegates to shared line-pipeline helper");
  assertTrue(/if \(!inc && curNum <= 0\)/.test(statusDateSrc), "status_date date-offset decrement clears only from zero-progress state");
  assertTrue(/applyGenericElementIncrementByFormat\(state, actionField\.id, runtimeCfg\.increment, actionFormat, actionMeta\.increase, actionCycleValues\)/.test(statusDateSrc), "status_date applies generic element increment logic via unified action field executor");
  assertTrue(/if \(idx >= arr\.length - 1\) return "";/.test(statusDateSrc), "status_date generic increase exits cycle to null at upper bound");
  assertTrue(/if \(idx <= 0\) return "";/.test(statusDateSrc), "status_date generic decrease exits cycle to null at lower bound");
  assertTrue(/shared\.getDefaultTagTokenKeyMapOptions\(\)/.test(statusDateSrc), "status_date token-key map options come from shared helper");
  assertTrue(/throw new Error\("shared_utils unavailable: buildTokenlessValueRegexSource"\);/.test(statusDateSrc), "status_date tokenless regex builder is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: parseTokenlessProgress"\);/.test(statusDateSrc), "status_date tokenless parser is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: parseHhmm"\);/.test(statusDateSrc), "status_date HH:mm parser is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: addMinutesHhmm"\);/.test(statusDateSrc), "status_date HH:mm adder is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: formatNowByMask"\);/.test(statusDateSrc), "status_date now-mask formatter is shared-utils-only");
  assertTrue(/buildBulletOnlyLine\(parsed, \{ keepParsedPrefix: true, keepCheckbox: false \}\)/.test(tagwheelSrc), "tagwheel keep-bullet line preserves parsed bullet prefix without stale checkbox");
  assertTrue(/linePipeline\.splitLeftPrefix\(seg\.left\)/.test(tagwheelSrc), "tagwheel reorder\/relocate uses shared left-prefix splitter");
  assertTrue(/linePipeline\.joinLeftPrefix\(leftParts\.prefix, orderedLeft\)/.test(tagwheelSrc), "tagwheel reorder\/relocate uses shared left-prefix joiner");
  assertTrue(/state\.session\.activeField = state\.core\.resolveInitialActiveField\(state\.rules, state\.session, state\.session\.mode\)/.test(tagwheelSrc), "tagwheel reapplies lead/default field resolver on Tab mode switch");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: normalizeCycleEndBehavior'\)/.test(tagwheelSrc), "tagwheel cycle behavior helper is shared-only");
  assertTrue(/resolvePrefixBehaviorShared\(rules, state, deps\)/.test(tagwheelCoreSrc), "tagwheel_core resolves shared prefix behavior from injected deps/state");
  assertFalse(/loadCoreHelperFromGlobalOrRequire\('__inlinePkmLineFinalizeUnified'/.test(tagwheelCoreSrc), "tagwheel_core does not self-load shared prefix module");
  assertTrue(/shared\.buildPrefixUnified\(/.test(tagwheelCoreSrc), "tagwheel_core buildPrefix delegates to shared prefix behavior");
  assertFalse(/startsWith\('📅'\)|startsWith\('🗓️'\)|startsWith\('🛫'\)|startsWith\('🕒'\)|startsWith\('⌛'\)/.test(tagwheelCoreSrc), "tagwheel_core date-like token classifier has no hardcoded emoji prefixes");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder'\)/.test(tagwheelSrc), "tagwheel segment reorder helper is shared-only");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: resolvePanelForField'\)/.test(tagwheelSrc), "tagwheel panel resolver helper is shared-only");
  assertTrue(/rulesHelpers\.resolvePanelForField\(orderCfg, fieldKey, \{ defaultPanel: modeName \}\)|rulesHelpers\.resolvePanelForField\(runtimeOrderCfg, key, \{ defaultPanel: 'right' \}\)|rulesHelpers\.resolvePanelForField\(state\.orderCfg, panelKey, \{ defaultPanel: 'right' \}\)/.test(tagwheelSrc), "tagwheel panel resolver delegates to shared helper");
  assertTrue(/if \(hasMinimalSelected\) \{\s*finalLine = applyMinimalLeftTagNormalization\(finalLine, state, core, \{[\s\S]*preserveExistingTokens:\s*hasOffSelected/.test(tagwheelSrc), "tagwheel applies minimal normalization whenever minimal selection exists");
  assertTrue(/resolveEffectiveSelectionPolicy\(\{[\s\S]*selectedEntries:[\s\S]*freeRoamBehavior:[\s\S]*activeMode:/.test(tagwheelSrc) || /resolveMixedSelectionPolicy\(selectedEntries, freeRoamBehavior\)/.test(tagwheelSrc), "tagwheel resolves mixed selection policy via shared finalizer effective-policy helper");
  assertTrue(/applyUnifiedPostFinalize\(\{/.test(tagwheelSrc) || /applyMixedPostPolicies\(state\.originalLine, finalLine, state\.rules, policy\)/.test(tagwheelSrc), "tagwheel delegates minimal prefix\/separator post-processing through shared finalizer path");
  assertTrue(/__prefixIgnoreFieldIds/.test(tagwheelSrc), "tagwheel computes prefix-ignore map for minimal fields when minimalPrefix is off");
  assertTrue(/shared\.resolvePrefixCheckboxUnified\(/.test(tagwheelCoreSrc), "tagwheel_core resolvePrefixCheckbox delegates to shared prefix behavior");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules'\)/.test(tagwheelSrc), "tagwheel date-marker resolver is shared-only");
  assertTrue(/async function callRuntimeApi\(app_, method\)/.test(tagwheelSrc), "tagwheel defines runtime api dispatcher helper");
  assertTrue(/return callRuntimeApi\(app_, 'loadVaultModule', vaultPath, forceReload\)/.test(tagwheelSrc), "tagwheel vault module loading delegates via runtime api dispatcher");
  assertFalse(/runtimeApi\.load[A-Za-z]+\(/.test(tagwheelSrc), "tagwheel has no direct runtimeApi.load* calls in adapter flow");
  assertFalse(/<span style=\"color: /.test(tagwheelCoreSrc), "tagwheel_core does not inject inline HTML color wrappers");
  assertFalse(/<mark style=\"background-color: /.test(tagwheelCoreSrc), "tagwheel_core does not inject inline HTML fill wrappers");
  assertTrue(/createTagwheelHeaderDecorationExtension\(this\)/.test(src), "main registers live-preview tagwheel color decoration extension");
  assertTrue(/function getTagVisualsFromConfig\(/.test(src), "main exposes tagVisuals config reader for runtime painter");
  assertTrue(/function buildFieldTagVisualMap\(/.test(src), "main builds deterministic field-tag visual map");
  assertTrue(/function resolveEffectiveTagVisualMode\(/.test(src), "main defines effective tag visual mode resolver with custom fallback");
  assertTrue(/function normalizeRuntimeTagVisualRow\(/.test(src), "main defines shared runtime tag visual row normalizer");
  assertTrue(/function scoreTagVisualRow\(/.test(src), "main defines deterministic tag visual row scoring");
  assertTrue(/function pickStrongerTagVisualRow\(/.test(src), "main defines deterministic tag visual row merge chooser");
  assertFalse(/Object\.prototype\.hasOwnProperty\.call\(out, token\)\) continue;/.test(src), "main no longer uses first-win continue for token visual map merges");
  assertTrue(/mode === "custom" \? "empty"/.test(src) || /return String\(row && row\.customText \|\| ""\)\.trim\(\) \? "custom" : "empty"/.test(src), "main maps custom mode with empty text to empty behavior");
  assertTrue(/function resolveTagVisualZone\(/.test(src), "main defines zone resolver for left/right opacity");
  assertTrue(/class TagVisualTokenWidget extends cmView\.WidgetType/.test(src), "main defines unified tag visual widget for full and empty rendering");
  assertTrue(/this\.displayTextOverride = String\(displayTextOverride \|\| ""\)/.test(src), "tag visual widget supports custom display text override");
  assertTrue(/displayTextOverride \|\| this\.tokenText/.test(src), "tag visual widget renders custom text when provided");
  assertTrue(/visSel\.createEl\("option", \{ text: "custom", value: "custom" \}\)/.test(rendererPairSrc), "settings renderer exposes custom visibility option in deep color settings");
  assertTrue(/customInput\.placeholder = "print"/.test(rendererPairSrc), "settings renderer uses print placeholder for custom visibility text");
  assertTrue(/function createTagVisualDecorationExtension\(plugin\)/.test(src), "main defines tag visual CM6 extension");
  assertTrue(/createTagVisualDecorationExtension\(this\)/.test(src), "main registers tag visual CM6 extension");
  assertFalse(/rt\.loadPkmOptionKeys\(\)/.test(tagwheelSrc), "tagwheel option key preload avoids direct runtime object method calls");
  assertFalse(/getDateFieldsFromRules/.test(tagwheelSrc), "tagwheel has no local getDateFieldsFromRules wrapper");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: getDateValuePatterns'\)/.test(tagwheelSrc), "tagwheel date value-patterns helper is shared-only");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: removeMarkerTokensFromSegment'\)/.test(tagwheelSrc), "tagwheel marker-token remover helper is shared-only");
  assertTrue(/core\.getNavigableFieldSequence\(rules, session\)/.test(tagwheelSrc), "tagwheel virtual field navigation uses core navigable sequence");
  assertTrue(/function getNavigableFieldSequence\(/.test(tagwheelCoreSrc), "tagwheel_core exports navigable field sequence helper");
  assertTrue(/getRenderedGroupsForMode\(/.test(tagwheelCoreSrc), "tagwheel_core reuses rendered groups for navigation parity");
  assertTrue(/function buildPanelGroupsFromTechOrder\(/.test(tagwheelCoreSrc), "tagwheel_core uses unified panel-group builder for left/right");
  assertTrue(/state\.mode === 'left'\) return buildPanelGroupsFromTechOrder\(rules, mode, 'left'\)/.test(tagwheelCoreSrc), "tagwheel_core left panel render path uses unified panel-group builder");
  assertTrue(/buildPanelGroupsFromTechOrder\(rules, mode, 'right'\)/.test(tagwheelCoreSrc), "tagwheel_core builds right panel groups via unified panel-group builder");
  assertFalse(/orderMode === 'manual' && Array\.isArray\(rules\.ui\.leftGroups\)/.test(tagwheelCoreSrc), "tagwheel_core has no left-only manual branch in runtime group render path");
  assertFalse(/state\.mode === 'right' && Array\.isArray\(rules\.ui\.rightGroups\)/.test(tagwheelCoreSrc), "tagwheel_core does not use static rightGroups-only branch");
  assertFalse(/rules\.ui\.rightGroups\s*=/.test(pkmRulesHelpersSrc), "runtime rules helper does not emit legacy ui.rightGroups runtime source");
  assertFalse(/!isFieldEnabled\(fieldMode, state, field, rules\) && field\.dependsOn/.test(tagwheelCoreSrc), "tagwheel_core group rendering does not leak disabled fields into placeholders");
  assertTrue(/if \(!hasVisibleField\) \{\s*return \{ hidden: true, active: false, text: '' \}/.test(tagwheelCoreSrc), "tagwheel_core hides group when no visible fields remain");
  assertTrue(/getDateMarkersFromRules\(rules\)/.test(tagwheelSrc), "tagwheel order flow uses shared date-marker resolver");
  assertFalse(/getDateFieldsFromRules\(rules\)/.test(tagwheelSrc), "tagwheel relocate-date flow does not depend on date-fields helper wrapper");
  assertTrue(/getDateValuePatterns\(\)/.test(tagwheelSrc), "tagwheel relocate-date flow uses shared date value-patterns helper");
  assertTrue(/shared\.relocateMarkerSetByFieldOrder\(\{/.test(tagwheelSrc), "tagwheel relocate-date flow delegates marker-set relocation to shared line-pipeline helper");
  assertTrue(/throw new Error\('line_pipeline unavailable: relocateMarkerSetByFieldOrder'\)/.test(tagwheelSrc), "tagwheel relocate-date flow requires shared line-pipeline marker-set relocation helper");
  assertTrue(/shared\.relocateTokenSetByPanel\(\{/.test(tagwheelSrc), "tagwheel tag-field relocation delegates to shared line-pipeline helper");
  assertTrue(/throw new Error\('line_pipeline unavailable: relocateTokenSetByPanel'\)/.test(tagwheelSrc), "tagwheel tag-field relocation requires shared line-pipeline helper");
  assertTrue(/status(?:LineRuntime|Rt)\.relocateCoreTagsByOrder\(\{/.test(tagwheelSrc), "tagwheel tag relocation order pass delegates to shared status-line runtime helper");
  assertTrue(/var rightSourceEntries = rightEntries\.filter\(function \(e\)/.test(tagwheelSrc), "tagwheel collects right-panel source-driven entries for apply path");
  assertTrue(/finalLine = relocateTagFieldByPanel\(finalLine, state\.rules, rs\.tokens, rs\.token, 'right'/.test(tagwheelSrc), "tagwheel apply materializes selected right-panel source-driven tokens into right segment");
  assertTrue(/typeof mod\.relocateCoreTagsByOrder !== 'function'/.test(tagwheelSrc), "tagwheel status-line runtime loader requires shared relocation helper");
  assertTrue(/removeMarkerTokens:\s*function\(segLine, mk, valueRx\)\s*\{[\s\S]*removeMarkerTokensFromSegment\(segLine, mk, valueRx\)/.test(tagwheelSrc), "tagwheel relocate-date cleanup uses shared marker-token remover helper through adapter callback");
  assertTrue(/shared\.getTagWheelMixedReorderOptions\(markers\)/.test(tagwheelSrc), "tagwheel mixed reorder options come from shared helper");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap'\)/.test(tagwheelSrc), "tagwheel token-key map helper is shared-only");
  assertTrue(/shared\.getDefaultTagTokenKeyMapOptions\(\)/.test(tagwheelSrc), "tagwheel token-key map options come from shared helper");
  assertFalse(/function getCursorForPanel\(/.test(tagwheelSrc), "tagwheel no longer defines local panel-cursor wrapper");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: firstTokenByPattern'\)/.test(tagwheelSrc), "tagwheel first-token helper is shared-only");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: segmentHasToken'\)/.test(tagwheelSrc), "tagwheel token matcher is shared-only");
  assertFalse(/function removeByPattern\(/.test(tagwheelSrc), "tagwheel no longer defines local removeByPattern wrapper");
  assertTrue(/removeCombinedByParentToken:\s*function\(seg, parentToken\)/.test(tagwheelSrc) && /removeMarkerTokensFromSegment\(seg, parentToken, '.*\\S\+'\)/.test(tagwheelSrc), "tagwheel combined-subtag cleanup uses shared marker-token remover path");
  assertTrue(/statusLineRuntime\.buildCombinedSelectionSet\(\{/.test(tagwheelCoreSrc) && /statusLineRuntime\.applyCombinedToTokenList\(tags, combinedEntries\)/.test(tagwheelCoreSrc), "tagwheel_core combined render uses shared status-line runtime helpers");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: removeTokensFromSegment'\)/.test(tagwheelSrc), "tagwheel token remover is shared-only");
  assertFalse(/removeTokens:\s*removeTokens\b/.test(tagwheelSrc), "tagwheel has no dangling removeTokens reference in off-selection post policy path");
  assertTrue(/removeTokens:\s*function\(seg, tokenList\)\s*\{[\s\S]*macroShared\.removeTokensFromSegment\(seg, tokenList\)/.test(tagwheelSrc), "tagwheel off-selection post policy delegates removeTokens via shared macro helper");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: normalizeCursorPolicy'\)/.test(tagwheelSrc), "tagwheel cursor policy helper is shared-only");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: isNoContentParsed'\)/.test(tagwheelSrc), "tagwheel no-content helper is shared-only");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: parseOrderConfig'\)/.test(tagwheelSrc), "tagwheel order parser helper is shared-only");
  assertTrue(/throw new Error\('shared_utils unavailable: buildTokenlessValueRegexSource'\)/.test(tagwheelCoreSrc), "tagwheel_core tokenless regex builder is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: parseTokenlessProgress'\)/.test(tagwheelCoreSrc), "tagwheel_core tokenless parser is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: parseHhmm'\)/.test(tagwheelCoreSrc), "tagwheel_core HH:mm parser is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: addMinutesHhmm'\)/.test(tagwheelCoreSrc), "tagwheel_core HH:mm adder is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: formatNowByMask'\)/.test(tagwheelCoreSrc), "tagwheel_core now-mask formatter is shared-utils-only");
  assertTrue(/normalizer\.normalizeMode\(mode, modeName, \{ isObj: isObj, err: err \}\)/.test(tagwheelCoreSrc), "tagwheel_core normalizeMode delegates to shared rules normalizer when available");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: applyOrderToRules'\)/.test(tagwheelSrc), "tagwheel order apply helper is shared-only");
  assertTrue(/if \(\/_sub\$\/\.test\(raw\) && collapsed === raw\) return raw\.slice\(0, -4\);/.test(pkmRulesHelpersSrc), "rules helpers collapseSubOrderKey force-collapses _sub when registry fallback returns unchanged key");
  assertTrue(/const seen = visited instanceof Set \? visited : new Set\(\);/.test(pkmRulesHelpersSrc) && /if \(seen\.has\(k\)\) return "";/.test(pkmRulesHelpersSrc), "rules helpers resolveIdByOrderKey guards against recursive key resolution loops");
  assertTrue(/const runtimeExcludedIds = new Set\(\);/.test(pkmRulesHelpersSrc) && /const reconcileModeDependencies = \(mode, scopeFields\) => \{/.test(pkmRulesHelpersSrc), "rules helpers define mode dependency reconcile pass with runtime exclusion tracking");
  assertTrue(/if \(!parentExists \|\| !runtimeEligible\.has\(fid\)\) \{[\s\S]*?f\.enabled = false;[\s\S]*?runtimeExcludedIds\.add\(fid\);/.test(pkmRulesHelpersSrc), "rules helpers disable and runtime-exclude children with invalid dependency placement");
  assertTrue(/if \(!parentExists\) \{[\s\S]*?f\.dependsOn = "";/.test(pkmRulesHelpersSrc), "rules helpers preserve model safely by clearing broken dependsOn links");
  /*
   * Левый список ищет родителя только у себя, правый — в обоих: ссылка и
   * элемент могут ждать тег, тег ждёт только тега (PRD 10.13.4, Н24).
   */
  assertTrue(/reconcileModeDependencies\(rules\.leftMode, leftFields\);[\s\S]*?reconcileModeDependencies\(rules\.rightMode, leftFields\.concat\(rightFields\)\);/.test(pkmRulesHelpersSrc), "rules helpers reconcile dependencies for both panels, right one across both lists");
  /*
   * Второй проход, отвергавший ту же связь, — `validateMode` в
   * `tagwheel_core.js`: он не выключал Field, а бросал исключение, и TagWheel
   * не открывался вовсе (находка Н-1 из vault, 2026-08-28). Границу ему
   * открыли ровно ту же и в ту же сторону, что и первому: два прохода обязаны
   * сходиться, иначе один стирает связь, а второй на неё ругается.
   */
  assertTrue(/function validateMode\(mode, modeName, scopeFields\) \{/.test(tagwheelCoreSrc), "tagwheel_core validateMode takes an explicit dependency scope");
  assertTrue(/validateMode\(rules\.leftMode, 'leftMode', leftScope\)[\s\S]*?validateMode\(rules\.rightMode, 'rightMode', leftScope\.concat\(rightScope\)\)/.test(tagwheelCoreSrc), "tagwheel_core validates dependencies for both lists, right one across both");
  assertTrue(/if \(field\.dependsOn && !depIds\[field\.dependsOn\]\) \{/.test(tagwheelCoreSrc), "tagwheel_core still rejects a dependsOn that names no field at all");
  /*
   * Третий проход — `allowInPanel`: он брал Block родителя и молча прятал
   * Field с предусловием из обеих панелей. Признак, разводящий дочерний Field
   * и Field с предусловием, — свой ключ, лежащий в одном из Block.
   */
  assertTrue(/function ownOrderKeyPlaced\(field\) \{/.test(tagwheelCoreSrc), "tagwheel_core tells a child field from a field with a prerequisite by its own placed order key");
  assertTrue(/if \(field\.dependsOn && !ownOrderKeyPlaced\(field\)\) \{/.test(tagwheelCoreSrc), "tagwheel_core panel membership prefers the field's own Block over its parent's");
  assertTrue(/var depIsChild = !!dep\.dependsOn && !ownOrderKeyPlaced\(dep\)/.test(tagwheelCoreSrc), "tagwheel_core keeps the `sub` placeholder for child fields only");
  assertFalse(/category_sub|clients/.test(pkmRulesHelpersSrc.slice(pkmRulesHelpersSrc.indexOf("const runtimeExcludedIds = new Set();"), pkmRulesHelpersSrc.indexOf("for (const f of allFields)"))), "rules helpers dependency reconcile has no hardcoded domain field names");
  assertFalse(/isObj\s*:\s*isObj/.test(tagwheelSrc), "tagwheel does not reference removed isObj helper");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: readRulesMarkdownWithFallback'\)/.test(tagwheelSrc), "tagwheel rules reader helper is shared-only");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(app_, "loadVaultModuleBridgeShared"\)/, /await loadVaultModuleBridgeShared\(app_\);/], "status_tags preloads shared vault bridge");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(app_, "loadVaultModuleBridgeShared"\)/, /await loadVaultModuleBridgeShared\(app_\);/], "status_date preloads shared vault bridge");
  assertAnyMatch(tagwheelSrc, [/await callRuntimeApi\(app_, 'loadVaultModuleBridgeShared'\)/, /await runtimeApi\.loadVaultModuleBridgeShared\(\)/], "tagwheel preloads shared vault bridge");
  assertAnyMatch(tagwheelSrc, [/await callRuntimeApi\(app_, 'loadRulesRuntimeHelpers'\)/, /await runtimeApi\.loadRulesRuntimeHelpers\(\)/], "tagwheel preloads shared rules helpers");
  assertAnyMatch(tagwheelSrc, [/await callRuntimeApi\(app_, 'loadMacroShared'\)/, /await runtimeApi\.loadMacroShared\(\)/], "tagwheel preloads shared macro helpers");
  assertAnyMatch(tagwheelSrc, [/await callRuntimeApi\(app_, 'loadLinePipeline'\)/, /await runtimeApi\.loadLinePipeline\(\)/], "tagwheel preloads shared line pipeline");
  assertFalse(/typeCheckboxByValue/.test(src), "main has no typeCheckboxByValue fallback reads");
  assertFalse(/typeCheckboxByValue/.test(statusTagsSrc), "status_tags has no typeCheckboxByValue reads");
  assertFalse(/typeCheckboxByValue/.test(tagwheelSrc), "tagwheel runtime has no typeCheckboxByValue reads");
  assertFalse(/out\.pkm\.legacy\s*=/.test(configMigrationSrc), "config migration has no legacy mirror write");
  assertFalse(/pkm\s*:\s*\{[\s\S]*legacy\s*:\s*\{/.test(configNoteOrchestratorSrc), "config note orchestrator patch has no pkm.legacy write path");

  const testRules = { io: { separator1: "||", separator2: "||" } };
  const sampleSpaces = "    - [ ] #todo || 111";
  const segSpaces = linePipeline.splitSegments(sampleSpaces, testRules);
  assertEq(segSpaces.indent, "    ", "line pipeline preserves spaces indent");
  assertEq(linePipeline.buildFromSegments(segSpaces, testRules), sampleSpaces, "line pipeline roundtrip keeps spaces indent");

  const sampleTabs = "\t\t- [ ] #todo || 111";
  const segTabs = linePipeline.splitSegments(sampleTabs, testRules);
  assertEq(segTabs.indent, "\t\t", "line pipeline preserves tabs indent");
  assertEq(linePipeline.buildFromSegments(segTabs, testRules), sampleTabs, "line pipeline roundtrip keeps tabs indent");

  const sampleMixed = " \t  - [ ] #todo || 111";
  const stripped = linePipeline.stripPrefixKeepIndent(sampleMixed, true);
  assertTrue(/^ \t  /.test(stripped), "stripPrefixKeepIndent preserves mixed leading whitespace");

  const runtimeMarkerRules = {
    io: { separator1: "::", separator2: "::" },
    behavior: {
      dateRuntimeConfig: {
        byField: {
          date_due: { emoji: "📅" },
          time: { emoji: "🕒" },
        },
        canonical: {},
      },
    },
    rightMode: {
      fields: [
        { id: "date_due", orderKey: "date_due", kind: "genericElement", marker: "" },
        { id: "time", orderKey: "time", kind: "genericElement", marker: "" },
      ],
    },
  };
  const segRuntimeMarkers = linePipeline.splitSegments("111 :: 📅2026-04-27 🕒20:16", runtimeMarkerRules);
  assertEq(segRuntimeMarkers.text, "", "line pipeline treats runtime-config date markers as right payload text separator split");
  assertEq(segRuntimeMarkers.dates, "📅2026-04-27 🕒20:16", "line pipeline routes runtime-config marker tokens into right segment");
  const normalizedRightTail = linePipeline.normalizeRightPayloadTailToDates({
    line: "111 📅2026-04-27 🕒20:16 :: #account-alpha [[Entity-Alpha]]",
    rules: runtimeMarkerRules,
  });
  assertEq(
    normalizedRightTail,
    "111 :: 📅2026-04-27 🕒20:16 #account-alpha [[Entity-Alpha]]",
    "line pipeline moves right-like tail tokens from left body into right segment"
  );

  const cursorRules = { io: { separator1: "||", separator2: "||" }, dates: { markers: ["📅"] } };
  const cursorLine = "1111 || 📅2026-04-08";
  assertEq(pkmMacroShared.getCursorAtTextEnd(cursorLine, cursorRules), 4, "text_end cursor stays on text slot when tail is date payload");
  const cursorLineWithTextAndDate = "[ ] #todo || 1111 || 📅2026-04-08";
  assertEq(pkmMacroShared.getCursorAtTextEnd(cursorLineWithTextAndDate, cursorRules), 17, "text_end cursor stays at text segment end when second separator exists");
  assertEq(pkmMacroShared.getCursorForPanel(cursorLineWithTextAndDate, cursorRules, "right", { rightMode: "before_sep1" }), 9, "panel cursor before sep1 mode");
  assertEq(pkmMacroShared.getCursorForPanel(cursorLineWithTextAndDate, cursorRules, "right", { rightMode: "after_sep1" }), 13, "panel cursor after sep1 mode");
  assertEq(pkmMacroShared.getCursorForPanel(cursorLineWithTextAndDate, cursorRules, "right", { rightMode: "tag_slot" }), 17, "panel cursor tag slot mode");
  assertTrue(pkmMacroShared.segmentHasToken("#a #b", "#b"), "segment token matcher detects exact token");
  assertEq(pkmMacroShared.removeTokensFromSegment("#a #b #c", ["#b"]), "#a #c", "segment token remover keeps remaining tokens");
  assertEq(pkmMacroShared.firstTokenByPattern("📅2026-04-09 x", "📅", "\\d{4}-\\d{2}-\\d{2}"), "📅2026-04-09", "pattern token finder extracts first marker token");
  assertFalse(pkmMacroShared.isNoContentParsed({ tags: ["#todo"], text: "", dates: "", headingToken: "" }, { includeTags: true }), "no-content helper treats tags as content by default");
  assertTrue(pkmMacroShared.isNoContentParsed({ tags: [], text: "", dates: "", headingToken: "" }, { includeTags: true }), "no-content helper accepts truly empty payload");

  const markers = pkmRulesHelpers.getDateMarkersFromRules({
    behavior: {
      dateRuntimeConfig: {
        canonical: { due: "slotA", time: "slotClock" },
      },
    },
    rightMode: {
      fields: [
        { id: "slotA", orderKey: "slotA", kind: "dateOffset", marker: "📆" },
        { id: "slotClock", orderKey: "slotClock", kind: "nowTime", marker: "🕐" },
      ],
    },
  });
  assertTrue(Array.isArray(markers.due) && markers.due.indexOf("📆") !== -1, "date marker resolver picks due marker from canonical runtime mapping");
  const runtimeMarkers = pkmRulesHelpers.getDateMarkersFromRules({
    behavior: {
      dateRuntimeConfig: {
        byField: {
          date_due: { emoji: "📅" },
        },
        canonical: {},
      },
    },
    rightMode: {
      fields: [{ id: "date_due", orderKey: "date_due", kind: "genericElement", marker: "" }],
    },
  });
  assertEq(runtimeMarkers.orderKeysByMarker["📅"], "date_due", "date marker resolver uses runtime date config emoji when field marker is empty");
  const reorderedSeg = pkmRulesHelpers.reorderSegmentTokensByOrder(
    "- #/2 #todo [[proj]] 📅2026-04-09",
    { left: ["project", "importance"], right: ["date_due"], enabled: { project: true, importance: true, date_due: true } },
    "left",
    { "#/2": "importance", "[[proj]]": "project" },
    { includeKeys: ["project", "importance", "date_due"], projectFromWikilink: true, markers: markers }
  );
  assertEq(reorderedSeg, "- [[proj]] #/2 #todo 📅2026-04-09", "segment reorder helper keeps configured order and unknown tail");
  const tokenMap = pkmRulesHelpers.buildTagTokenKeyMap({
    leftMode: {
      fields: [
        { id: "priority", prefix: "#", values: [{ token: "/2", active: true }] },
        { id: "type", prefix: "#", values: [{ token: "todo", active: true }] },
        { id: "modal", prefix: "#", values: [{ token: "fast", active: true }] },
        { source: "projects", prefix: "#", values: [{ token: "ops", link: "Ops", active: true }] },
      ],
    },
    projects: { output: "wikilink" },
  }, { projectTagWhenWikilink: true, activeFlagKeys: ["active", "enabled"] });
  assertEq(tokenMap["#/2"], "priority", "token-key map resolves priority token by field id");
  assertTrue(tokenMap["#todo/fast"] === undefined || tokenMap["#todo/fast"] === "type" || tokenMap["#todo/fast"] === "modal", "token-key map combined token is optional without explicit relation metadata");
  assertEq(tokenMap["[[Ops]]"], "project", "token-key map resolves project wikilink token");

  const strictPanelRules = {
    io: { separator1: "||", separator2: "||" },
    behavior: {
      defaultMode: "left",
      order: {
        left: ["importance", "type", "category"],
        right: ["project"],
      },
    },
    inlineLayout: { techOrder: ["priority", "type", "context", "otherTags"] },
    ui: { leftPanelOrderMode: "fromTechOrder", leftGroups: [], rightGroups: [] },
    projects: { items: ["[[Ops]]"] },
    leftMode: {
      fields: [
        { id: "priority", placeholder: "важность", orderKey: "importance", values: [{ id: "", token: "" }, { id: "p2", token: "/2" }] },
        { id: "type", placeholder: "тип", orderKey: "type", values: [{ id: "", token: "" }, { id: "todo", token: "todo" }] },
        { id: "context", placeholder: "категория", orderKey: "category", values: [{ id: "", token: "" }, { id: "work", token: "work" }] },
        { id: "project", placeholder: "проект", source: "projects", orderKey: "project", values: [{ id: "", token: "" }] },
        { id: "stray", placeholder: "stray", values: [{ id: "", token: "" }, { id: "x", token: "x" }] },
      ],
    },
    rightMode: { fields: [] },
  };
  const strictState = tagwheelCore.makeInitialState(strictPanelRules, "left");
  strictState.mode = "left";
  strictState.activeFieldId = "priority";
  const strictSeq = tagwheelCore.getNavigableFieldSequence(strictPanelRules, strictState);
  assertTrue(strictSeq.indexOf("priority") !== -1, "strict order keeps left order field priority");
  assertTrue(strictSeq.indexOf("type") !== -1, "strict order keeps left order field type");
  assertTrue(strictSeq.indexOf("context") !== -1, "strict order keeps left order field category");
  assertFalse(strictSeq.indexOf("project") !== -1, "strict order hides right-only project from left panel");
  assertFalse(strictSeq.indexOf("stray") !== -1, "strict order hides unknown field outside order panels");

  const orderDrivenRules = {
    io: { separator1: "||", separator2: "||" },
    behavior: { defaultMode: "left" },
    inlineLayout: { techOrder: ["priority", "type", "context", "otherTags"] },
    ui: { leftPanelOrderMode: "fromTechOrder", leftGroups: [], rightGroups: [] },
    projects: { items: ["[[Ops]]"] },
    leftMode: {
      fields: [
        { id: "priority", prefix: "#", placeholder: "важность", values: [{ id: "", token: "" }, { id: "p2", token: "/2" }] },
        { id: "type", prefix: "#", placeholder: "тип", values: [{ id: "", token: "" }, { id: "todo", token: "todo" }] },
        { id: "context", prefix: "#", placeholder: "категория", values: [{ id: "", token: "" }, { id: "work", token: "work" }] },
        { id: "project", prefix: "#", placeholder: "проект", source: "projects", values: [{ id: "", token: "" }] },
        { id: "client", prefix: "#", placeholder: "client", values: [{ id: "", token: "" }, { id: "c1", token: "tenant-alpha" }] },
        { id: "client1", prefix: "#", placeholder: "client1", values: [{ id: "", token: "" }, { id: "c2", token: "account-alpha" }] },
      ],
    },
    rightMode: { fields: [] },
  };
  pkmRulesHelpers.applyOrderToRules(orderDrivenRules, {
    left: ["priority", "type", "context", "client", "client1", "project"],
    right: ["timeNow", "start", "due", "effort"],
    active: {
      priority: "yes",
      type: "yes",
      context: "yes",
      client: "yes",
      client1: "yes",
      project: "yes",
    },
    enabled: {
      priority: true,
      type: true,
      context: true,
      client: true,
      client1: true,
      project: true,
    },
    labels: {
      priority: "важность",
      type: "тип",
      context: "категория",
      client: "client",
      client1: "client1",
      project: "проект",
    },
    strictNames: {
      priority: "priority",
      type: "type",
      context: "context",
      client: "client",
      client1: "client1",
      project: "project",
    },
    types: {
      priority: "tag",
      type: "tag",
      context: "tag",
      client: "tag",
      client1: "tag",
      project: "wikilink",
    },
  });
  const orderDrivenState = tagwheelCore.makeInitialState(orderDrivenRules, "left");
  orderDrivenState.mode = "left";
  orderDrivenState.activeFieldId = "priority";
  const orderDrivenSeq = tagwheelCore.getNavigableFieldSequence(orderDrivenRules, orderDrivenState);
  assertEq(
    JSON.stringify(orderDrivenSeq),
    JSON.stringify(["priority", "type", "context", "client", "client1", "project"]),
    "left panel sequence follows Order.left exactly for custom + project placement"
  );

  const migratedDefaultMode = configMigration.normalizePkmBehaviorShape({ pkm: { behavior: { defaultMode: "RIGHT" } } });
  assertEq(migratedDefaultMode.pkm.behavior.defaultMode, "right", "config migration normalizes default mode casing");

  const migratedLegacyCheckbox = configMigration.normalizePkmBehaviorShape({
    pkm: {
      behavior: {
        prefixRules: {
          checkboxByFieldValue: {
            type: {
              todo: "[  ]",
              in_progress: "[I]",
              bad: "oops",
            },
          },
        },
      },
    },
  });
  assertEq(migratedLegacyCheckbox.pkm.behavior.prefixRules.checkboxByFieldValue.type.todo, "[ ]", "config migration normalizes empty checkbox token");
  assertEq(migratedLegacyCheckbox.pkm.behavior.prefixRules.checkboxByFieldValue.type.in_progress, "[I]", "config migration preserves explicit checkbox state");
  assertTrue(!Object.prototype.hasOwnProperty.call(migratedLegacyCheckbox.pkm.behavior.prefixRules.checkboxByFieldValue.type, "bad"), "config migration removes invalid checkbox tokens");

  const prevBridge = globalThis.__inlineVaultModuleBridge;
  const prevSharedRuntime = globalThis.__inlinePkmMacroRuntimeSharedMod;
  try {
    globalThis.__inlinePkmMacroRuntimeSharedMod = null;
    globalThis.__inlineVaultModuleBridge = { loadVaultModule: async () => ({}) };
    let invalidExportFailFast = false;
    try {
      await pkmMacroRuntimeEntry.loadMacroRuntimeShared({});
    } catch (e) {
      invalidExportFailFast = /vault_module_bridge unavailable/.test(String(e && e.message ? e.message : e || ""));
    }
    assertTrue(invalidExportFailFast, "macro runtime entry fails fast when bridge returns invalid shared export");

    globalThis.__inlineVaultModuleBridge = { loadVaultModule: async () => { throw new Error("bridge load failed"); } };
    let bridgeLoadFailFast = false;
    try {
      await pkmMacroRuntimeShared.loadVaultModule({}, ".obsidian/plugins/inline-overhaul/src/core/pkm_option_keys.js", false);
    } catch (e) {
      bridgeLoadFailFast = /bridge load failed/.test(String(e && e.message ? e.message : e || ""));
    }
    assertTrue(bridgeLoadFailFast, "macro runtime shared loader propagates bridge load failure without local eval fallback");
  } finally {
    globalThis.__inlineVaultModuleBridge = prevBridge;
    globalThis.__inlinePkmMacroRuntimeSharedMod = prevSharedRuntime;
  }

  console.log("Bootstrap loader regression tests: OK");
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
