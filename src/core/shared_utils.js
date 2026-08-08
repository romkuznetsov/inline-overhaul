"use strict";

function cloneJson(x) {
  return JSON.parse(JSON.stringify(x));
}

function nz(v, dflt) {
  return v === undefined || v === null ? dflt : v;
}

function escapeRe(s) {
  return String(nz(s, "")).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFormatMask(format) {
  let f = String(format ?? "").trim();
  if (!f) return "";
  f = f.replace(/yyyy/gi, "YYYY");
  f = f.replace(/dd/gi, "DD");
  f = f.replace(/hh/gi, "HH");
  f = f.replace(/ss/gi, "ss");
  f = f.replace(/mm/gi, "MM");
  f = f.replace(/HHMMSS/g, "HHmmss");
  f = f.replace(/HHMM/g, "HHmm");
  f = f.replace(/HH([^A-Za-z0-9]?)(MM)/g, "HH$1mm");
  return f;
}

function buildFormatValueRegexSource(format) {
  const f = normalizeFormatMask(String(format ?? ""));
  if (!f) return "";
  const tokenRe = /(YYYY|MM|DD|HH|mm|ss)/g;
  let src = "";
  let last = 0;
  let hit;
  let hasToken = false;
  while ((hit = tokenRe.exec(f)) !== null) {
    hasToken = true;
    src += escapeRe(f.slice(last, hit.index));
    const tk = String(hit[1] || "");
    src += tk === "YYYY" ? "\\d{4}" : "\\d{2}";
    last = hit.index + tk.length;
  }
  src += escapeRe(f.slice(last));
  return hasToken ? src : "";
}

function hasFormatTokens(format) {
  return /(YYYY|MM|DD|HH|mm|ss)/.test(normalizeFormatMask(String(format ?? "")));
}

function parseNumericLiteralSpec(format) {
  const f = String(format || "").trim();
  if (!/^\d+$/.test(f)) return null;
  const base = Number(f);
  if (!Number.isFinite(base)) return null;
  return { base, width: f.length };
}

function parseNumericPatternSpec(format) {
  const f = String(format || "").trim();
  if (!f) return null;
  if (/[A-Za-z]/.test(f)) return null;
  const chars = Array.from(f);
  const slots = chars.map((ch) => /\d/.test(ch));
  if (!slots.some(Boolean)) return null;
  const baseDigits = chars.filter((ch) => /\d/.test(ch)).join("");
  if (!/^\d+$/.test(baseDigits)) return null;
  const base = Number(baseDigits);
  if (!Number.isFinite(base)) return null;
  return { format: f, slots, width: baseDigits.length, base };
}

function buildNumericPatternRegexSource(spec) {
  if (!spec || !Array.isArray(spec.slots)) return "";
  const chars = Array.from(String(spec.format || ""));
  let out = "";
  for (let i = 0; i < chars.length; i++) out += spec.slots[i] ? "\\d" : escapeRe(chars[i]);
  return out;
}

function renderNumericPatternValue(spec, progressRaw) {
  if (!spec) return "";
  const p = Math.max(0, Math.trunc(Number(progressRaw || 0)));
  const value = spec.base + p;
  let digits = String(value);
  if (digits.length < spec.width) digits = digits.padStart(spec.width, "0");
  if (digits.length > spec.width) digits = digits.slice(-spec.width);
  const chars = Array.from(String(spec.format || ""));
  let di = 0;
  let out = "";
  for (let i = 0; i < chars.length; i++) {
    if (spec.slots[i]) out += digits.charAt(di++) || "0";
    else out += chars[i];
  }
  return out;
}

function parseNumericPatternProgress(value, spec) {
  if (!spec) return null;
  const raw = String(value || "").trim();
  const rxSrc = buildNumericPatternRegexSource(spec);
  if (!rxSrc) return null;
  const re = new RegExp(`^${rxSrc}$`, "u");
  if (!re.test(raw)) return null;
  const digits = Array.from(raw).filter((ch) => /\d/.test(ch)).join("");
  if (!/^\d+$/.test(digits)) return null;
  const got = Number(digits);
  if (!Number.isFinite(got) || got < spec.base) return null;
  return Math.max(0, Math.trunc(got - spec.base));
}

function renderTokenlessValueByProgress(format, progressRaw) {
  const f = String(format || "").trim();
  if (!f) return "";
  const numPattern = parseNumericPatternSpec(f);
  if (numPattern) return renderNumericPatternValue(numPattern, progressRaw);
  const num = parseNumericLiteralSpec(f);
  if (num) {
    const p = Math.max(0, Math.trunc(Number(progressRaw || 0)));
    const v = num.base + p;
    const s = String(v);
    return s.length >= num.width ? s : s.padStart(num.width, "0");
  }
  const chars = Array.from(f);
  const last = chars[chars.length - 1] || "";
  const extra = Math.max(0, Math.trunc(Number(progressRaw || 0)));
  return f + (last ? last.repeat(extra) : "");
}

function buildTokenlessValueRegexSource(format) {
  const f = String(format || "").trim();
  if (!f) return "";
  const numPattern = parseNumericPatternSpec(f);
  if (numPattern) return buildNumericPatternRegexSource(numPattern);
  const num = parseNumericLiteralSpec(f);
  if (num) return "\\d+";
  const chars = Array.from(f);
  const last = chars[chars.length - 1];
  if (!last) return escapeRe(f);
  if (chars.length === 1) return `${escapeRe(last)}+`;
  const prefix = chars.slice(0, chars.length - 1).join("");
  return `${escapeRe(prefix)}${escapeRe(last)}+`;
}

function parseTokenlessProgress(value, format) {
  const raw = String(value || "").trim();
  const fmt = String(format || "").trim();
  const numPattern = parseNumericPatternSpec(fmt);
  if (numPattern) return parseNumericPatternProgress(raw, numPattern);
  const num = parseNumericLiteralSpec(fmt);
  if (num) {
    if (!/^\d+$/.test(raw)) return null;
    const got = Number(raw);
    if (!Number.isFinite(got) || got < num.base) return null;
    return Math.max(0, Math.trunc(got - num.base));
  }
  const vChars = Array.from(raw);
  const fChars = Array.from(fmt);
  if (!fChars.length) return vChars.length;
  if (!vChars.length) return null;
  if (fChars.length === 1) {
    for (const ch of vChars) if (ch !== fChars[0]) return null;
    return Math.max(0, vChars.length - 1);
  }
  if (vChars.length < fChars.length) return null;
  const last = fChars[fChars.length - 1];
  for (let i = 0; i < fChars.length - 1; i++) {
    if (vChars[i] !== fChars[i]) return null;
  }
  for (let i = fChars.length - 1; i < vChars.length; i++) {
    if (vChars[i] !== last) return null;
  }
  return Math.max(0, vChars.length - fChars.length);
}

function parseHhmm(text) {
  const m = String(text || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function addMinutesHhmm(text, delta) {
  const p = parseHhmm(text);
  if (!p) return "";
  const total = p.hh * 60 + p.mm + Number(delta || 0);
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatNowByMask(mask) {
  const d = new Date();
  const YYYY = String(d.getFullYear());
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const m = normalizeFormatMask(String(mask ?? "YYYY-MM-DD")) || "YYYY-MM-DD";
  return m
    .replace(/YYYY/g, YYYY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss);
}

function randomInt(maxExclusive) {
  const n = Math.max(1, Math.trunc(Number(maxExclusive || 1)));
  return Math.floor(Math.random() * n);
}

function pickRandom(chars) {
  const pool = Array.isArray(chars) ? chars : [];
  if (!pool.length) return "";
  return pool[randomInt(pool.length)] || "";
}

function buildNowDigitsByLength(len, nowDate) {
  const n = Math.max(1, Math.trunc(Number(len || 1)));
  const d = nowDate instanceof Date ? nowDate : new Date();
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const seed = `${HH}${mm}${ss}`;
  if (n <= seed.length) return seed.slice(seed.length - n);
  let out = "";
  while (out.length < n) out += seed;
  return out.slice(out.length - n);
}

function buildNowNumberInRange(minValue, width, nowDate) {
  const min = Math.max(0, Math.trunc(Number(minValue || 0)));
  const w = Math.max(1, Math.trunc(Number(width || 1)));
  const max = Math.pow(10, w) - 1;
  const span = Math.max(1, Math.trunc(max - min + 1));
  const seed = Number(buildNowDigitsByLength(Math.max(w, 6), nowDate)) || 0;
  return min + (seed % span);
}

function renderCommandValueByFormat(format, commandRaw, nowDate) {
  const fmt = String(format || "").trim() || "1";
  const cmd = String(commandRaw || "now").trim();
  const cmdLower = cmd.toLowerCase();
  const isRandomN = cmdLower === "randomn";
  const isRandomE = cmdLower === "randome";
  const isNow = cmdLower === "now";
  if (!isRandomN && !isRandomE && !isNow) return "";

  const digitsPool = "0123456789".split("");
  const elementPool = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#><-_".split("");
  const pool = isRandomN ? digitsPool : elementPool;

  if (hasFormatTokens(fmt)) {
    if (isNow) return formatNowByMask(fmt);
    return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (tk) => {
      const size = tk === "YYYY" ? 4 : 2;
      let out = "";
      for (let i = 0; i < size; i++) out += pickRandom(pool);
      return out;
    });
  }

  const numPattern = parseNumericPatternSpec(fmt);
  if (numPattern) {
    const chars = Array.from(String(numPattern.format || ""));
    let out = "";
    if (isNow) {
      const nowNum = buildNowNumberInRange(numPattern.base, numPattern.width, nowDate);
      const nowDigits = String(nowNum).padStart(numPattern.width, "0").slice(-numPattern.width);
      let di = 0;
      for (let i = 0; i < chars.length; i++) {
        out += numPattern.slots[i] ? (nowDigits.charAt(di++) || "0") : chars[i];
      }
      return out;
    }
    if (isRandomN) {
      const maxValue = Math.pow(10, Math.max(1, Math.trunc(Number(numPattern.width || 1)))) - 1;
      const span = Math.max(1, Math.trunc(maxValue - Number(numPattern.base || 0) + 1));
      return renderNumericPatternValue(numPattern, randomInt(span));
    }
    for (let i = 0; i < chars.length; i++) out += numPattern.slots[i] ? pickRandom(pool) : chars[i];
    return out;
  }

  const numLiteral = parseNumericLiteralSpec(fmt);
  if (numLiteral) {
    if (isNow) {
      const nowNum = buildNowNumberInRange(numLiteral.base, numLiteral.width, nowDate);
      return String(nowNum).padStart(numLiteral.width, "0").slice(-numLiteral.width);
    }
    if (isRandomN) {
      const maxValue = Math.pow(10, Math.max(1, Math.trunc(Number(numLiteral.width || 1)))) - 1;
      const span = Math.max(1, Math.trunc(maxValue - Number(numLiteral.base || 0) + 1));
      const next = Number(numLiteral.base || 0) + randomInt(span);
      return String(next).padStart(numLiteral.width, "0");
    }
    let out = "";
    for (let i = 0; i < numLiteral.width; i++) out += pickRandom(pool);
    return out;
  }

  const genericLen = Math.max(1, Array.from(fmt).length);
  if (isNow) return buildNowDigitsByLength(genericLen, nowDate);
  let out = "";
  for (let i = 0; i < genericLen; i++) out += pickRandom(pool);
  return out;
}

function shouldHydrateGenericElementRaw(format, commandRaw, rawValue) {
  const fmt = String(format || "").trim() || "1";
  const cmd = String(commandRaw || "").trim().toLowerCase();
  const raw = String(rawValue || "").trim();
  if (!raw) return false;
  if (cmd !== "randome") return false;
  if (hasFormatTokens(fmt)) return false;
  const parsed = parseTokenlessProgress(raw, fmt);
  return parsed === null;
}

function buildCustomPlanFromIncrement(incrementCfg) {
  const cfg = isObj(incrementCfg) ? incrementCfg : {};
  const raw = Array.isArray(cfg.customRaw)
    ? cfg.customRaw.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const fromRaw = [];
  let hasEnd = false;
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (/^END$/i.test(t)) {
      hasEnd = true;
      break;
    }
    const m = t.match(/^(-?\d+)(?:\s*\(\s*(\d+)\s*\))?$/);
    if (!m) continue;
    const step = Math.max(0, Math.trunc(Number(m[1] || 0)));
    const repeat = Math.max(1, Math.trunc(Number(m[2] || 1)));
    for (let r = 0; r < repeat; r++) fromRaw.push(step);
  }
  if (fromRaw.length) return { steps: fromRaw, hasEnd };
  const arr = Array.isArray(cfg.custom)
    ? cfg.custom
      .map((x) => Math.max(0, Math.trunc(Number(x || 0))))
      .filter((x) => Number.isFinite(x))
    : [];
  return { steps: arr, hasEnd: false };
}

function forwardStepByCurrent(customSteps, currentValue) {
  const arr = Array.isArray(customSteps) ? customSteps : [];
  if (!arr.length) return 1;
  const cur = Number(currentValue);
  const safeCur = Number.isFinite(cur) ? Math.max(0, Math.trunc(cur)) : 0;
  const frontiers = [];
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    const step = Math.max(0, Math.trunc(Number(arr[i] || 0)));
    acc += step;
    frontiers.push(acc);
  }
  for (let i = 0; i < frontiers.length; i++) {
    if (safeCur < frontiers[i]) return Math.max(1, frontiers[i] - safeCur);
  }
  const tail = Math.max(0, Math.trunc(Number(arr[arr.length - 1] || 0)));
  return Math.max(1, tail || 1);
}

function backwardStepByCurrent(customSteps, currentValue) {
  const arr = Array.isArray(customSteps) ? customSteps : [];
  if (!arr.length) return 1;
  const cur = Number(currentValue);
  if (!Number.isFinite(cur) || cur <= 0) return 1;
  const frontiers = [0];
  for (let i = 0; i < arr.length; i++) {
    const step = Math.max(0, Math.trunc(Number(arr[i] || 0)));
    frontiers.push(frontiers[frontiers.length - 1] + step);
  }
  for (let i = 1; i < frontiers.length; i++) {
    const v = frontiers[i];
    if (cur <= v) return Math.max(1, cur - frontiers[i - 1]);
  }
  const tail = Math.max(0, Math.trunc(Number(arr[arr.length - 1] || 0)));
  return Math.max(1, tail || 1);
}

function getSearchLimitByUnit(unit) {
  if (unit === "second") return 172800;
  if (unit === "minute") return 10080;
  if (unit === "hour") return 720;
  return 3660;
}

function detectDateUnit(format) {
  const f = normalizeFormatMask(String(format ?? ""));
  if (!hasFormatTokens(f)) return "tokenless";
  if (/ss/.test(f)) return "second";
  if (/mm/.test(f)) return "minute";
  if (/HH/.test(f)) return "hour";
  if (/YYYY/.test(f) && !/(MM|DD)/.test(f)) return "year";
  if (/MM/.test(f) && !/DD/.test(f)) return "month";
  return "day";
}

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function deepMerge(base, patch) {
  if (!isObj(base)) return cloneJson(patch);
  const out = cloneJson(base);
  if (!isObj(patch)) return out;
  for (const k of Object.keys(patch)) {
    const bv = out[k];
    const pv = patch[k];
    if (isObj(bv) && isObj(pv)) out[k] = deepMerge(bv, pv);
    else out[k] = cloneJson(pv);
  }
  return out;
}

function parseJsonFence(md, fenceName, required) {
  const src = String(md || "");
  const re = new RegExp("```" + fenceName + "\\s*([\\s\\S]*?)```");
  const m = src.match(re);
  if (!m) {
    if (required) throw new Error("Fence not found: " + fenceName);
    return null;
  }
  try {
    return JSON.parse(String(m[1] || "").trim());
  } catch (e) {
    throw new Error("Invalid JSON in fence `" + fenceName + "`: " + e.message);
  }
}

function toPrettyJson(x) {
  return JSON.stringify(x, null, 2);
}

module.exports = {
  cloneJson,
  nz,
  escapeRe,
  normalizeFormatMask,
  buildFormatValueRegexSource,
  hasFormatTokens,
  parseNumericLiteralSpec,
  parseNumericPatternSpec,
  buildNumericPatternRegexSource,
  renderNumericPatternValue,
  parseNumericPatternProgress,
  renderTokenlessValueByProgress,
  buildTokenlessValueRegexSource,
  parseTokenlessProgress,
  parseHhmm,
  addMinutesHhmm,
  formatNowByMask,
  renderCommandValueByFormat,
  shouldHydrateGenericElementRaw,
  buildCustomPlanFromIncrement,
  forwardStepByCurrent,
  backwardStepByCurrent,
  getSearchLimitByUnit,
  detectDateUnit,
  isObj,
  deepMerge,
  parseJsonFence,
  toPrettyJson,
};
