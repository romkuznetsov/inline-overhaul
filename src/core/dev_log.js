"use strict";

/**
 * Журнал разработчика: `Advanced → Developer mode`.
 *
 * **Что это.** Плагин пишет в vault две записи о своей работе — человеческую
 * (`.md`, читается глазами) и машинную (`.ndjson`, для разбора). Обе живут
 * ровно затем, чтобы можно было ответить на «а что плагин сделал со строкой»,
 * не пересобирая его с отладкой.
 *
 * **Почему модулем, а не методами класса** (кусок четвёртый разбора `main.js`,
 * 2026-09-07). Из семнадцати методов десять — чистая работа с текстом: разбор
 * пути, обрезка по времени и числу записей, склейка строки события. Ей не
 * нужен ни `Plugin` Obsidian, ни его загрузка; в классе она держала пятую
 * часть точки входа и не проверялась ничем, кроме пинов по тексту.
 *
 * **Состояние остаётся на плагине** — `_devLogSessionId`, `_devLogSeq`,
 * `_devLogWriteQueue`, `_devLogActivePathMd`, `_devLogActivePathAi`. Это выбор:
 * сессия журнала живёт столько же, сколько сам плагин, и второе место для неё
 * значило бы второе объявление её времени жизни (У-32). Поэтому функции,
 * которым состояние нужно, берут `plugin` первым аргументом — тем же приёмом,
 * каким переехали слой редактора и конфиг.
 *
 * **Границу с миром держит адаптер vault** (`read`, `write`, `list`, `mkdir`,
 * `remove`), и он приходит аргументом: без него всё, что здесь есть, —
 * функции над строками.
 */

const __sharedUtils = require("./shared_utils.js");
const __configNormalize = require("./config_normalize.js");

const DEFAULT_CONFIG = __configNormalize.DEFAULT_CONFIG;

function isObj(x) { return __sharedUtils.isObj(x); }
function readCfgPath(root, path) { return __sharedUtils.readCfgPath(root, path); }

function devModeConfig(plugin, cfg) {
  const snapshot = isObj(cfg) ? cfg : plugin.getConfig();
  const raw = isObj(readCfgPath(snapshot, "advanced.devMode")) ? readCfgPath(snapshot, "advanced.devMode") : {};
  const genAi = raw.aiLog === true;
  return {
    enabled: raw.enabled === true,
    logPath: String(raw.logPath || DEFAULT_CONFIG.devMode.logPath).trim() || DEFAULT_CONFIG.devMode.logPath,
    generateAiLog: genAi,
    humanRetentionMinutes: 20,
    humanMaxRecords: 300,
    aiRetentionMinutes: 45,
    aiMaxRecords: 1200,
  };
}

function shouldWrite(plugin, cfg) {
  const dm = devModeConfig(plugin, cfg);
  return dm.enabled === true;
}

function formatTimestamp(d) {
  const dt = d instanceof Date ? d : new Date();
  const y = String(dt.getFullYear());
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}-${hh}${mm}${ss}`;
}

function logPathParts(dm) {
  const extHint = arguments.length > 1 ? arguments[1] : undefined;
  const raw = String(dm && dm.logPath ? dm.logPath : DEFAULT_CONFIG.devMode.logPath).trim() || DEFAULT_CONFIG.devMode.logPath;
  const ext = String(extHint || "md").trim().toLowerCase() === "ndjson" ? "ndjson" : "md";
  const asForward = raw.replace(/\\/g, "/");
  const maybeDir = /\/$/.test(asForward);
  const withDefault = maybeDir ? `${asForward}InlineOverhaul_DevLog` : asForward;
  const noExt = withDefault.replace(/\.(?:ndjson|md)$/i, "");
  const noRole = noExt.replace(/\.(?:new|old)(?:\.\d{8}-\d{6})?$/i, "");
  const i = noRole.lastIndexOf("/");
  const dir = i >= 0 ? noRole.slice(0, i) : "";
  const baseName = (i >= 0 ? noRole.slice(i + 1) : noRole) || "InlineOverhaul_DevLog";
  return { dir, baseName, ext };
}

function logFilePath(parts, role, ts) {
  const r = role === "old" ? "old" : "new";
  const safeTs = String(ts || formatTimestamp(new Date()));
  const file = `${parts.baseName}.${r}.${safeTs}.${parts.ext}`;
  return parts.dir ? `${parts.dir}/${file}` : file;
}

async function listLogFiles(adapter, parts) {
  const prefix = `${parts.baseName}.`;
  const suffix = `.${parts.ext}`;
  const out = [];
  const dir = parts.dir || "";
  try {
    let files = [];
    if (typeof adapter.list === "function") {
      const listed = await adapter.list(dir || "/");
      files = Array.isArray(listed && listed.files) ? listed.files : [];
    }
    for (const f of files) {
      const p = String(f || "").replace(/\\/g, "/");
      const fileName = p.split("/").pop() || "";
      if (!fileName.startsWith(prefix) || !fileName.endsWith(suffix)) continue;
      const m = fileName.match(/^(.+)\.(new|old)(?:\.(\d{8}-\d{6}))?\.(md|ndjson)$/i);
      if (!m) continue;
      out.push({ path: p, role: String(m[2] || "").toLowerCase(), ts: String(m[3] || "") });
    }
  } catch (_) {}
  out.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return out;
}

function sanitizeHumanPayload(eventName, payload) {
  const p = isObj(payload) ? payload : { value: payload };
  const out = {
    command: p.command || "",
    actionType: p.actionType || "",
    direction: p.direction || "",
    lineNo: Number.isFinite(Number(p.lineNo)) ? Number(p.lineNo) : -1,
    changed: p.changed === true,
    durationMs: Number.isFinite(Number(p.durationMs)) ? Number(p.durationMs) : 0,
    beforeLine: typeof p.beforeLine === "string" ? p.beforeLine : "",
    afterLine: typeof p.afterLine === "string" ? p.afterLine : "",
    message: typeof p.message === "string" ? p.message : "",
  };
  return out;
}

function parseIsoDateSafe(text) {
  const t = String(text || "").trim();
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

function trimAiLogContent(content, dm) {
  const src = String(content || "");
  const rows = src.split("\n").filter((x) => String(x || "").trim());
  const now = Date.now();
  const maxAgeMs = Math.max(1, Math.floor(Number(dm.retentionMinutes || 45))) * 60 * 1000;
  const kept = [];
  for (const row of rows) {
    try {
      const obj = JSON.parse(row);
      const dt = parseIsoDateSafe(obj && obj.ts ? obj.ts : "");
      if (dt && now - dt.getTime() > maxAgeMs) continue;
      kept.push(row);
    } catch (_) {
      kept.push(row);
    }
  }
  const limited = kept.slice(Math.max(0, kept.length - Math.max(1, Number(dm.maxRecords || 1200))));
  return limited.length ? (limited.join("\n") + "\n") : "";
}

function trimHumanLogContent(content, dm) {
  const src = String(content || "");
  const lines = src.split("\n");
  const header = lines.length && /^#\s+InlineOverhaul\s+Dev\s+Log/i.test(lines[0]) ? (lines[0] + "\n") : "";
  const body = header ? src.slice(header.length) : src;
  const chunks = body.split(/\n(?=###\s+\d{4}-\d{2}-\d{2}T)/g).filter((x) => String(x || "").trim());
  const now = Date.now();
  const maxAgeMs = Math.max(1, Math.floor(Number(dm.retentionMinutes || 20))) * 60 * 1000;
  const kept = [];
  for (const chunk of chunks) {
    const m = String(chunk || "").match(/^###\s+(\d{4}-\d{2}-\d{2}T[^\n\r]+)/);
    const dt = parseIsoDateSafe(m ? m[1] : "");
    if (dt && now - dt.getTime() > maxAgeMs) continue;
    kept.push(String(chunk || "").replace(/^\n+/, ""));
  }
  const limited = kept.slice(Math.max(0, kept.length - Math.max(1, Number(dm.maxRecords || 300))));
  const merged = limited.join("\n");
  if (!merged) return header || "";
  return (header ? header : "") + merged + (merged.endsWith("\n") ? "" : "\n");
}

function parentDirPath(filePath) {
  const p = String(filePath || "").replace(/\\/g, "/");
  const i = p.lastIndexOf("/");
  if (i <= 0) return "";
  return p.slice(0, i);
}

async function ensureDirectoryForFilePath(adapter, filePath) {
  const dir = parentDirPath(filePath);
  if (!dir) return;
  const parts = String(dir).split("/").filter(Boolean);
  if (!parts.length) return;
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    try {
      if (typeof adapter.exists === "function") {
        const ok = await adapter.exists(acc);
        if (!ok && typeof adapter.mkdir === "function") await adapter.mkdir(acc);
      } else if (typeof adapter.mkdir === "function") {
        await adapter.mkdir(acc);
      }
    } catch (_) {
      // best effort; continue trying nested segments
    }
  }
}

function buildLine(plugin, ext, eventName, payload) {
  const ts = new Date().toISOString();
  const event = String(eventName || "event");
  const p = isObj(payload) ? payload : { value: payload };
  if (String(ext || "md") === "md") {
    const hp = sanitizeHumanPayload(event, p);
    if (event === "pkm.run.start") {
      return `### ${ts}\n- event: ${event}\n- command: ${hp.command}\n- action: ${hp.actionType || "n/a"}\n- direction: ${hp.direction || "n/a"}\n- line: ${hp.lineNo}\n`;
    }
    if (event === "pkm.run.result") {
      return `### ${ts}\n- event: ${event}\n- command: ${hp.command || "n/a"}\n- changed: ${hp.changed ? "yes" : "no"}\n- durationMs: ${hp.durationMs}\n- before: ${hp.beforeLine}\n- after: ${hp.afterLine}\n`;
    }
    if (event === "pkm.run.error" || event === "pkm.guard.error") {
      return `### ${ts}\n- event: ${event}\n- command: ${hp.command || "n/a"}\n- error: ${hp.message || "unknown"}\n`;
    }
    if (event === "session.start" || event === "session.end") {
      return `### ${ts}\n- event: ${event}\n- session: ${plugin._devLogSessionId || ""}\n`;
    }
    return "";
  }
  const record = {
    ts,
    sessionId: plugin._devLogSessionId || "",
    seq: Number(plugin._devLogSeq || 0),
    event,
    payload: p,
  };
  return JSON.stringify(record) + "\n";
}

function event(plugin, eventName, payload, level, cfg) {
  if (!shouldWrite(plugin, cfg)) return;
  const dm = devModeConfig(plugin, cfg);
  plugin._devLogSeq = Number(plugin._devLogSeq || 0) + 1;
  const mdLine = buildLine(plugin, "md", eventName, payload);
  const aiLine = dm.generateAiLog ? buildLine(plugin, "ndjson", eventName, payload) : "";
  if (!mdLine && !aiLine) return;
  plugin._devLogWriteQueue = plugin._devLogWriteQueue.then(async () => {
    if (mdLine) await writeLine(plugin, dm, "md", mdLine);
    if (aiLine) await writeLine(plugin, dm, "ndjson", aiLine);
  }).catch((e) => {
    console.error("[inline-overhaul][dev-mode-log]", e);
  });
}

async function startSession(plugin, cfg) {
  const dm = devModeConfig(plugin, cfg);
  if (!dm.enabled) return;
  const adapter = plugin.app && plugin.app.vault ? plugin.app.vault.adapter : null;
  if (!adapter || typeof adapter.read !== "function" || typeof adapter.write !== "function") return;
  const partsMd = logPathParts(dm, "md");
  const partsAi = logPathParts(dm, "ndjson");
  plugin._devLogSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  plugin._devLogSeq = 0;
  const rotateByParts = async (parts) => {
    const existing = await listLogFiles(adapter, parts);
    const prevNew = existing.find((x) => x.role === "new") || null;
    const allOld = existing.filter((x) => x.role === "old");
    for (const o of allOld) {
      try { if (typeof adapter.remove === "function") await adapter.remove(o.path); } catch (_) {}
    }
    if (prevNew) {
      let previous = "";
      try { previous = await adapter.read(prevNew.path); } catch (_) { previous = ""; }
      if (previous) {
        const oldPath = logFilePath(parts, "old", prevNew.ts || formatTimestamp(new Date()));
        try {
          await ensureDirectoryForFilePath(adapter, oldPath);
          await adapter.write(oldPath, previous);
        } catch (_) {}
      }
      try { if (typeof adapter.remove === "function") await adapter.remove(prevNew.path); } catch (_) {}
    }
  };
  await rotateByParts(partsMd);
  if (dm.generateAiLog) await rotateByParts(partsAi);
  const ts = formatTimestamp(new Date());
  const newPathMd = logFilePath(partsMd, "new", ts);
  await ensureDirectoryForFilePath(adapter, newPathMd);
  await adapter.write(newPathMd, "# InlineOverhaul Dev Log (Human)\n");
  plugin._devLogActivePathMd = newPathMd;
  if (dm.generateAiLog) {
    const newPathAi = logFilePath(partsAi, "new", ts);
    await ensureDirectoryForFilePath(adapter, newPathAi);
    await adapter.write(newPathAi, "");
    plugin._devLogActivePathAi = newPathAi;
  } else {
    plugin._devLogActivePathAi = "";
  }
  event(plugin, "session.start", {
    sessionId: plugin._devLogSessionId,
    logPathResolvedHuman: newPathMd,
    logPathResolvedAi: plugin._devLogActivePathAi,
    generateAiLog: dm.generateAiLog,
  }, "info", cfg);
}

async function closeSession(plugin, cfg, forceWrite) {
  if (!forceWrite && !shouldWrite(plugin, cfg)) return;
  event(plugin, "session.end", { sessionId: plugin._devLogSessionId }, "info", cfg);
  try {
    await (plugin._devLogWriteQueue || Promise.resolve());
  } catch (_) {}
  plugin._devLogActivePathMd = "";
  plugin._devLogActivePathAi = "";
}

async function writeLine(plugin, dm, ext, line) {
  const adapter = plugin.app && plugin.app.vault ? plugin.app.vault.adapter : null;
  if (!adapter || typeof adapter.read !== "function" || typeof adapter.write !== "function") return;
  const logPath = String(ext === "ndjson" ? (plugin._devLogActivePathAi || "") : (plugin._devLogActivePathMd || "")).trim();
  if (!logPath) return;
  let prev = "";
  try {
    prev = await adapter.read(logPath);
  } catch (_) {
    prev = "";
  }
  const rawOut = String(prev || "") + String(line || "");
  const out = ext === "ndjson"
    ? trimAiLogContent(rawOut, { retentionMinutes: dm.aiRetentionMinutes, maxRecords: dm.aiMaxRecords })
    : trimHumanLogContent(rawOut, { retentionMinutes: dm.humanRetentionMinutes, maxRecords: dm.humanMaxRecords });
  await ensureDirectoryForFilePath(adapter, logPath);
  await adapter.write(logPath, out);
}

module.exports = {
  devModeConfig,
  shouldWrite,
  formatTimestamp,
  logPathParts,
  logFilePath,
  listLogFiles,
  sanitizeHumanPayload,
  parseIsoDateSafe,
  trimAiLogContent,
  trimHumanLogContent,
  parentDirPath,
  ensureDirectoryForFilePath,
  buildLine,
  event,
  startSession,
  closeSession,
  writeLine,
};
