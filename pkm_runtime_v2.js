"use strict";

function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {}
}

function getSharedUtils() {
  try {
    const su = globalThis && globalThis.__inlineOverhaulSharedUtils;
    if (!su || typeof su !== "object") return null;
    if (typeof su.isObj !== "function") return null;
    if (typeof su.nz !== "function") return null;
    return su;
  } catch (_) {
    return null;
  }
}

function isObj(x) {
  const su = getSharedUtils();
  if (su) return su.isObj(x);
  return x && typeof x === "object" && !Array.isArray(x);
}

function nz(v, d) {
  const su = getSharedUtils();
  if (su) return su.nz(v, d);
  return v == null ? d : v;
}

function hashShort(text) {
  const s = String(nz(text, ""));
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h >>> 0).toString(16);
}

function getActiveEditor(app) {
  const ws = app && app.workspace ? app.workspace : null;
  const leaf = ws && ws.activeLeaf && ws.activeLeaf.view ? ws.activeLeaf.view : null;
  const fromLeaf = leaf && leaf.editor ? leaf.editor : null;
  if (fromLeaf) return fromLeaf;
  const active = ws && ws.activeEditor ? ws.activeEditor : null;
  return active && active.editor ? active.editor : null;
}

/*
 * Модули команд — литеральным `require` (У-89). Мост модулей снят: он искал
 * путь внутри vault в реестре забандленных модулей, а реестр существовал
 * ровно затем, чтобы мост его нашёл.
 *
 * `forceReload` тоже ушёл. В сборке он ничего не значил: реестр отдавал один
 * и тот же объект независимо от флага, — а вне Obsidian сбрасывал кеш
 * загрузчика, чего проверки не просили ни разу.
 */
const MACRO_MODULES = {
  statusTags: require("./pkm_v2/status_tags.js"),
  statusDate: require("./pkm_v2/status_date.js"),
  tagWheel: require("./pkm_v2/TagWheel/tagwheel.js"),
};

const macroRuntimeEntry = require("./src/core/pkm_macro_runtime_entry.js");

function macroModuleForCommand(command) {
  return Object.prototype.hasOwnProperty.call(MACRO_MODULES, command)
    ? MACRO_MODULES[command]
    : null;
}

async function ensureMacroRuntimeBootstrap() {
  if (typeof globalThis.__inlineGetPkmMacroRuntime === "function") return;
  globalThis.__inlinePkmMacroRuntimeEntryMod = macroRuntimeEntry;
  globalThis.__inlineGetPkmMacroRuntime = (app_, normalizeOrderKeyLocal) =>
    macroRuntimeEntry.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal);
}

function normalizeSettingsForCommand(command, settings) {
  return isObj(settings) ? settings : {};
}

async function runCommand(ctx) {
  const app = ctx && ctx.app ? ctx.app : null;
  if (!app) throw new Error("runCommand: app is required");
  const inputSettings = isObj(ctx && ctx.settings) ? ctx.settings : {};
  const command = String(nz(ctx && ctx.command, "")).trim();
  const settings = normalizeSettingsForCommand(command, inputSettings);
  const devLog = ctx && typeof ctx.devLog === "function" ? ctx.devLog : null;
  const emitDev = (event, payload) => {
    if (!devLog) return;
    try {
      return devLog(event, payload);
    } catch (_) {
      return null;
    }
  };

  const editor = getActiveEditor(app);
  if (!editor) throw new Error("runCommand: no active editor");
  var mod = macroModuleForCommand(command);
  if (!mod) throw new Error("runCommand: unknown command " + command);

  await ensureMacroRuntimeBootstrap();
  var entry = mod && typeof mod.entry === "function"
    ? mod.entry
    : (typeof mod === "function" ? mod : null);
  if (!entry) throw new Error("runCommand: module has no callable entry: " + macroPath);

  var quickAddCtx = { app: app };
  var cursor = editor.getCursor();
  var lineNo = cursor ? cursor.line : -1;
  var beforeLine = lineNo >= 0 ? String(nz(editor.getLine(lineNo), "")) : "";
  var t0 = Date.now();

  emitDev("pkm.run.start", {
    command: command,
    lineNo: lineNo,
    cursorCh: cursor ? cursor.ch : -1,
    beforeLine: beforeLine,
    actionType: String(nz(settings["Action type"], "")) || null,
    direction: String(nz(settings["Direction"], "")) || null,
    cycleEndBehavior: String(nz(settings["Cycle end behavior"], "")),
    subtagFormat: String(nz(settings["Subtag format"], "")),
    cursorPolicy: String(nz(settings["Cursor policy"], "")),
    orderConfigHash: hashShort(String(nz(settings["Order config"], ""))),
    dateRuntimeHash: hashShort(String(nz(settings["Date runtime config"], ""))),
    tagWheelScrollerEnabled: settings["TagWheel scroller enabled"] === true,
    tagWheelScrollerDirection: String(nz(settings["TagWheel scroller direction"], "")) || null,
    tagWheelScrollerSize: Number.isFinite(Number(settings["TagWheel scroller size"]))
      ? Number(settings["TagWheel scroller size"])
      : null,
  });

  try {
    var result = await Promise.resolve(entry(quickAddCtx, settings || {}));
    var afterLine = lineNo >= 0 ? String(nz(editor.getLine(lineNo), "")) : "";
    var cursorAfter = editor.getCursor();
    emitDev("pkm.run.result", {
      command: command,
      lineNo: lineNo,
      beforeLine: beforeLine,
      afterLine: afterLine,
      cursorAfterCh: cursorAfter ? cursorAfter.ch : -1,
      durationMs: Date.now() - t0,
      changed: beforeLine !== afterLine,
      invariantPrefixInPayload: !/(^|\s)\d+\.(?=\s|$)/.test(String(afterLine || "").replace(/^\s*(?:[-*+]|\d+\.)(?:\s+\[[^\]]\])?(?:\s+|$)/, "")),
    });
    return result;
  } catch (e) {
    emitDev("pkm.run.error", {
      command: command,
      lineNo: lineNo,
      beforeLine: beforeLine,
      durationMs: Date.now() - t0,
      message: String(e && e.message ? e.message : e || ""),
      stack: e && e.stack ? String(e.stack) : "",
    });
    throw e;
  }
}

module.exports = {
  runCommand,
};
