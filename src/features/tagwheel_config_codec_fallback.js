"use strict";

function createTagWheelConfigCodecFallback(deps) {
  const d = deps && typeof deps === "object" ? deps : {};
  const isObj = typeof d.isObj === "function"
    ? d.isObj
    : function(x) { return x && typeof x === "object" && !Array.isArray(x); };
  const TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH = String(d.TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH || "InlineOverhaul_Config.md");
  const TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH = String(d.TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH || "InlineOverhaul_Config_Template.md");
  const TAGWHEEL_TECHNICAL_BLOCK_MARKER = String(d.TAGWHEEL_TECHNICAL_BLOCK_MARKER || "<!-- INLINE_OVERHAUL:TECHNICAL_BLOCK -->");
  const TAGWHEEL_TECH_MARKER_PREFIX = String(d.TAGWHEEL_TECH_MARKER_PREFIX || "<!-- INLINE_OVERHAUL:TECH:");
  const TAGWHEEL_IMPORTANT_LINE = String(d.TAGWHEEL_IMPORTANT_LINE || "");
  const CFG_H2_TAGS = String(d.CFG_H2_TAGS || "Tags");
  const CFG_H2_ELEMENTS_COMBINED = String(d.CFG_H2_ELEMENTS_COMBINED || "Elements");
  const TAGWHEEL_PREFIX_RESOLVER_H3 = String(d.TAGWHEEL_PREFIX_RESOLVER_H3 || "Prefix Resolver");

  return {
    normalizeTagWheelConfigPath() {
      return TAGWHEEL_CONFIG_NOTE_DEFAULT_PATH;
    },
    normalizeTagWheelConfigTemplatePath() {
      return TAGWHEEL_CONFIG_TEMPLATE_DEFAULT_PATH;
    },
    buildDefaultTagWheelDetailedTemplateMarkdown() {
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
      lines.push(`### ${CFG_H2_TAGS}`);
      lines.push("<!-- INLINE_OVERHAUL:TECH:TAGS -->");
      lines.push("");
      lines.push(`### ${TAGWHEEL_PREFIX_RESOLVER_H3}`);
      lines.push("#### Settings");
      lines.push("<!-- INLINE_OVERHAUL:TECH:PREFIX_SETTINGS -->");
      lines.push("#### Order");
      lines.push("1.  **Fields Order:**");
      lines.push("<!-- INLINE_OVERHAUL:TECH:FIELDS_ORDER_ITEMS -->");
      lines.push("");
      lines.push("2. **Checkbox Order:**");
      lines.push("<!-- INLINE_OVERHAUL:TECH:CHECKBOX_ORDER_ITEMS -->");
      lines.push("");
      lines.push(`### ${CFG_H2_ELEMENTS_COMBINED}`);
      lines.push("<!-- INLINE_OVERHAUL:TECH:ELEMENTS -->");
      lines.push("");
      return lines.join("\n");
    },
    renderTagWheelConfigFromTemplate(templateMd, parts) {
      const src = String(templateMd || "");
      const byKey = isObj(parts) ? parts : {};
      const hasDatesMarker = /<!--\s*INLINE_OVERHAUL:TECH:DATES\s*-->/i.test(src);
      const markerRe = /<!--\s*INLINE_OVERHAUL:TECH:([A-Z_]+)\s*-->/g;
      let hasNamed = false;
      let out = src.replace(markerRe, (_, keyRaw) => {
        hasNamed = true;
        const key = String(keyRaw || "").trim();
        if (!Object.prototype.hasOwnProperty.call(byKey, key)) {
          throw new Error(`Detailed template error: unknown marker '${TAGWHEEL_TECH_MARKER_PREFIX}${key}'`);
        }
        if (key === "ELEMENTS" && hasDatesMarker && Object.prototype.hasOwnProperty.call(byKey, "ELEMENTS_ONLY")) {
          return String(byKey.ELEMENTS_ONLY || "");
        }
        return String(byKey[key] || "");
      });
      if (out.includes(TAGWHEEL_TECHNICAL_BLOCK_MARKER)) {
        const fallback = String(byKey.MINIMAL_FULL || "").trim();
        if (!fallback) throw new Error(`Detailed template error: missing marker '${TAGWHEEL_TECHNICAL_BLOCK_MARKER}' payload`);
        out = out.split(TAGWHEEL_TECHNICAL_BLOCK_MARKER).join(fallback);
        hasNamed = true;
      }
      if (!hasNamed) {
        throw new Error("Detailed template error: no technical markers found");
      }
      return out;
    },
    buildMinimalFromRenderedTemplate(renderedMd) {
      const src = String(renderedMd || "");
      const lines = src.split(/\r?\n/);
      const start = lines.findIndex((ln) => /^##\s+Settings\s*$/i.test(String(ln || "").trim()));
      const body = (start === -1 ? lines : lines.slice(start))
        .filter((ln) => !/^\s*>/.test(String(ln || "")));
      const out = [];
      out.push(TAGWHEEL_IMPORTANT_LINE);
      out.push("---");
      out.push(...body);
      return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    },
    buildTagWheelConfigParts() {
      throw new Error("TagWheel config codec unavailable: buildTagWheelConfigParts");
    },
    buildTagWheelConfigMarkdown() {
      throw new Error("TagWheel config codec unavailable: buildTagWheelConfigMarkdown");
    },
    parseTagWheelConfigMarkdown() {
      throw new Error("TagWheel config codec unavailable: parseTagWheelConfigMarkdown");
    },
  };
}

module.exports = {
  createTagWheelConfigCodecFallback,
};
