let RULES_PATH = "Rules path";
let ACTION_TYPE = "Action type";
let CYCLE_END_BEHAVIOR = "Cycle end behavior";
let CURSOR_POLICY = "Cursor policy";
let ORDER_CONFIG = "Order config";
let DATE_RUNTIME_CONFIG = "Date runtime config";
let DEFAULT_RULES_PATH = "InlineOverhaul_Generated_RULES_TagWheel.md";
/*
 * Модули приезжают литеральным `require` — по одному на модуль (У-89).
 *
 * Было: шесть путей внутри vault и шесть асинхронных `ensure*Loaded` со
 * своими проверками годности; путь шёл через макро-рантайм в мост модулей,
 * а мост искал его в реестре забандленных. У реестра домена рядом лежала
 * запаска литеральным `require` — и в сборке работала именно она.
 *
 * Проверки годности сняты вместе с загрузкой: они отвечали на «приехал не
 * тот модуль», а из графа сборки приехать не тот не может.
 */
const __pkmDomainRegistry = require("../src/core/pkm_domain_registry.js");
const __lineFinalizeUnified = require("../src/core/pkm_line_finalize_unified.js");
const __statusLineRuntimeUnified = require("../src/core/status_line_runtime_unified.js");
const __dateRuntimeShared = require("../src/core/date_runtime_shared.js");
const __tokenGraphUnified = require("../src/core/token_graph_unified.js");
const __statusRuntimeCommonMod = require("../src/core/status_runtime_common.js");
const __pkmOptionKeys = require("../src/core/pkm_option_keys.js");
const __tagwheelCore = require("./TagWheel/tagwheel_core.js");
const __say = require("../src/core/say.js").say;
let __statusRuntimeCommonFns = null;

const DATE_ACTION_OPTIONS = [];

/*
 * Видимый текст сообщения по ключу каталога (PRD 10.13.50, ответ на В-74).
 * Английское стоит на месте вызова вторым аргументом: слой настроек может не
 * загрузиться, и тогда человек обязан увидеть сообщение, а не ключ.
 * Ключ собирает функция, а не литерал (У-82).
 */
function statusDateNoticeKey(name) {
  return 'notice.rules.' + name;
}

/*
 * Спрашивает общий код и своей копии не держит (В-100, 2026-09-10, тридцать
 * седьмое исключение к З3).
 *
 * **Что было.** Здесь лежала своя реализация того же правила: спросить шов,
 * при отказе остаться на английском, подставить `{0}`. Дом у правила есть —
 * `src/core/say.js`, — и объявлено оно было **четыре раза**: там и в трёх
 * движках. Расходятся такие копии молча, и из ровно такой копии выросло
 * «31 февраля читается как 3 марта» (первый кусок В-97).
 *
 * Отказ шва молчит в общем коде, и объяснение стоит там же.
 */
function sayStatusDate(key, english, ...args) {
  return __say(key, english, ...args);
}

/*
 * Показ сообщения человеку — одно место на файл (третий кусок В-97).
 *
 * **Что было.** Четыре копии `try { new Notice(…) } catch (_) {}` подряд, и в
 * каждой отказ показа проглатывался молча — то есть одно правило было
 * объявлено четыре раза (У-32), и все четыре раза неверно.
 *
 * **Почему молчать нельзя.** Два из четырёх сообщений — отчёты о сбое: файл
 * правил не прочитан и правила не сходятся после применения порядка. После
 * обоих работа прекращается, и если показать сообщение не удалось, человек
 * остаётся и без результата, и без причины. Это второй вид отказа, а не
 * третий: он уезжает в журнал разработчика — `console.error` с приставкой
 * плагина.
 *
 * `Notice` — глобальное имя платформы, поэтому импорта у движка нет: Obsidian
 * ставит его сам (`window.Notice = …` в `app.js` 1.13.7, спрошено у архива).
 */
function showStatusDateNotice(text) {
  const message = String(text == null ? '' : text);
  try {
    new Notice(message);
  } catch (e) {
    console.error('[inline-overhaul] сообщение не показано: ' + message, e);
  }
}

function applyPkmOptionKeys(mod) {
  const keys = mod && mod.KEYS && typeof mod.KEYS === "object" ? mod.KEYS : null;
  if (!keys) return;
  RULES_PATH = String(keys.RULES_PATH || RULES_PATH);
  ACTION_TYPE = String(keys.ACTION_TYPE || ACTION_TYPE);
  CYCLE_END_BEHAVIOR = String(keys.CYCLE_END_BEHAVIOR || CYCLE_END_BEHAVIOR);
  CURSOR_POLICY = String(keys.CURSOR_POLICY || CURSOR_POLICY);
  ORDER_CONFIG = String(keys.ORDER_CONFIG || ORDER_CONFIG);
  DATE_RUNTIME_CONFIG = String(keys.DATE_RUNTIME_CONFIG || DATE_RUNTIME_CONFIG);
  DEFAULT_RULES_PATH = String(mod.DEFAULT_RULES_PATH || DEFAULT_RULES_PATH);
}

function normalizeOrderKeyLocal(key) {
  return String(key || "").trim();
}

async function loadMacroRuntime(app_) {
  const globalGetter = globalThis.__inlineGetPkmMacroRuntime;
  if (typeof globalGetter === "function") {
    return globalGetter(app_, normalizeOrderKeyLocal);
  }
  const entry = globalThis.__inlinePkmMacroRuntimeEntryMod;
  if (entry && typeof entry.bootstrapMacroRuntime === "function") {
    return entry.bootstrapMacroRuntime(app_, normalizeOrderKeyLocal);
  }
  throw new Error("pkm_macro_runtime_entry unavailable: bootstrapMacroRuntime");
}

async function callRuntimeApi(app_, method, ...args) {
  const rt = await loadMacroRuntime(app_);
  const fn = rt && rt[method];
  if (typeof fn !== "function") {
    throw new Error(`pkm_macro_runtime_entry unavailable: ${method}`);
  }
  return fn.apply(rt, args);
}

applyPkmOptionKeys(__pkmOptionKeys);

function getDomainRegistry() {
  return __pkmDomainRegistry;
}

function resolveOrderKeyFromFieldId(fieldId) {
  const reg = getDomainRegistry();
  if (reg && typeof reg.resolveOrderKeyFromFieldId === "function") {
    return String(reg.resolveOrderKeyFromFieldId(fieldId) || "").trim();
  }
  return String(fieldId || "").trim();
}

function resolveDateFieldIdFromOrderKey(orderKey) {
  const reg = getDomainRegistry();
  if (reg && typeof reg.resolveRightFieldIdByOrderKey === "function") {
    return String(reg.resolveRightFieldIdByOrderKey(orderKey) || "").trim();
  }
  return String(orderKey || "").trim();
}

function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function getSharedUtils() {
  try {
    const su = globalThis && globalThis.__inlineOverhaulSharedUtils;
    return su && typeof su === "object" ? su : null;
  } catch (_) {
    return null;
  }
}

function ensureStatusRuntimeCommonLoaded() {
  if (__statusRuntimeCommonFns) return;
  __statusRuntimeCommonFns = __statusRuntimeCommonMod.createStatusRuntimeCommon({
    isObj,
    normalizeOrderKey: normalizeOrderKeyLocal,
    orderConfigKey: ORDER_CONFIG,
    dateRuntimeConfigKey: DATE_RUNTIME_CONFIG,
    defaultPanel: "right",
    loadOrderKeyNormalizer: async (ctxApp) => callRuntimeApi(ctxApp, "loadOrderKeyNormalizer"),
    loadRuntimePreloadFacade: async (ctxApp) => callRuntimeApi(ctxApp, "loadRuntimePreloadFacade"),
  });
}

function getStatusRuntimeCommon() {
  ensureStatusRuntimeCommonLoaded();
  return __statusRuntimeCommonFns;
}

function getStatusLineRuntimeUnified() {
  return __statusLineRuntimeUnified;
}

function getDateRuntimeShared() {
  return __dateRuntimeShared;
}

function buildTokenFactsFromLine(rawLine, rules) {
  return __tokenGraphUnified.buildTokenFactsFromLine(rawLine, rules);
}

/*
 * Поиск Field по идентификатору живёт в общем модуле, и здесь его зовут прямо.
 * Прежде рядом лежала копия, сравнивавшая `f.id === id` без приведения к
 * строке и без охраны пустого значения: на пустом `id` она отдавала Field, у
 * которого `id` не задан вовсе. Доставалась копия, только если общая
 * реализация бросила, — то есть отвечала иначе и молча (У-32).
 */
function getField(mode, id) {
  return getStatusRuntimeCommon().getFieldById(mode, id);
}

function remapCursorStable(oldLine, newLine, oldCh) {
  return getStatusRuntimeCommon().remapCursorStable(oldLine, newLine, oldCh);
}

function collectMissingEmojiFields(rules, dateRuntimeCfg) {
  const shared = getDateRuntimeShared();
  return shared.collectMissingEmojiFieldsFromRules(rules, dateRuntimeCfg, { resolveOrderKeyFromFieldId });
}

function isEmptyLikeParsed(parsed) {
  if (!parsed || parsed.headingToken) return false;
  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  if (tags.length) return false;
  if (String(parsed.text || "").trim()) return false;
  if (String(parsed.dates || "").trim()) return false;
  return true;
}

function setCursorIfChanged(editor, lineNo, ch) {
  return getStatusRuntimeCommon().setCursorIfChanged(editor, lineNo, ch);
}

function escapeRx(s) {
  return getStatusRuntimeCommon().escapeRx(s);
}

function normalizeFormatMask(format) {
  const su = getSharedUtils();
  if (su && typeof su.normalizeFormatMask === "function") return su.normalizeFormatMask(format);
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

function addByUnitUtc(base, unit, delta) {
  return getStatusRuntimeCommon().addByUnitUtc(base, unit, delta);
}

function getReferenceDateForUnit(unit) {
  return getStatusRuntimeCommon().getReferenceDateForUnit(unit);
}

function getSearchLimitByUnit(unit) {
  return getStatusRuntimeCommon().getSearchLimitByUnit(unit, getSharedUtils());
}

/*
 * Разбор даты по маске живёт в общем модуле, и здесь его зовут прямо.
 * Копия рядом отличалась по существу: она **не сверяла результат обратно** и
 * потому принимала несуществующую дату — `2026-02-31` молча становилось третьим
 * марта, — а год по умолчанию брала нынешний вместо 1970.
 */
function parseDateByFormat(text, format) {
  return getStatusRuntimeCommon().parseDateByFormat(text, format, normalizeFormatMask, escapeRx);
}

/*
 * Сборка даты по маске живёт в общем модуле, и здесь её зовут прямо. Копия
 * рядом проверяла аргумент утиным способом (`dt.getTime`) и на объекте без
 * этого метода бросала, тогда как общая отдаёт пустую строку.
 */
function formatDateByFormat(dt, format) {
  return getStatusRuntimeCommon().formatDateByFormat(dt, format, normalizeFormatMask);
}

function buildFormatValueRegexSource(format) {
  const su = getSharedUtils();
  if (su && typeof su.buildFormatValueRegexSource === "function") return su.buildFormatValueRegexSource(format);
  const f = normalizeFormatMask(String(format ?? ""));
  if (!f) return "";
  const esc = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRe = /(YYYY|MM|DD|HH|mm|ss)/g;
  let src = "";
  let last = 0;
  let hit;
  let hasToken = false;
  while ((hit = tokenRe.exec(f)) !== null) {
    hasToken = true;
    src += esc(f.slice(last, hit.index));
    const tk = String(hit[1] || "");
    src += tk === "YYYY" ? "\\d{4}" : "\\d{2}";
    last = hit.index + tk.length;
  }
  src += esc(f.slice(last));
  return hasToken ? src : "";
}

function hasFormatTokens(format) {
  const su = getSharedUtils();
  if (su && typeof su.hasFormatTokens === "function") return su.hasFormatTokens(format);
  return /(YYYY|MM|DD|HH|mm|ss)/.test(normalizeFormatMask(String(format ?? "")));
}

function parseNumericLiteralSpec(format) {
  const su = getSharedUtils();
  if (su && typeof su.parseNumericLiteralSpec === "function") return su.parseNumericLiteralSpec(format);
  const f = String(format || "").trim();
  if (!/^\d+$/.test(f)) return null;
  const base = Number(f);
  if (!Number.isFinite(base)) return null;
  return { base, width: f.length };
}

function parseNumericPatternSpec(format) {
  const su = getSharedUtils();
  if (su && typeof su.parseNumericPatternSpec === "function") return su.parseNumericPatternSpec(format);
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

function renderNumericPatternValue(spec, progressRaw) {
  const su = getSharedUtils();
  if (su && typeof su.renderNumericPatternValue === "function") return su.renderNumericPatternValue(spec, progressRaw);
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

function buildTokenlessValueRegexSource(format) {
  const su = getSharedUtils();
  if (su && typeof su.buildTokenlessValueRegexSource === "function") return su.buildTokenlessValueRegexSource(format);
  throw new Error("shared_utils unavailable: buildTokenlessValueRegexSource");
}

function renderTokenlessValueByProgress(format, progressRaw) {
  const su = getSharedUtils();
  if (su && typeof su.renderTokenlessValueByProgress === "function") return su.renderTokenlessValueByProgress(format, progressRaw);
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

function parseTokenlessProgress(value, format) {
  const su = getSharedUtils();
  if (su && typeof su.parseTokenlessProgress === "function") return su.parseTokenlessProgress(value, format);
  throw new Error("shared_utils unavailable: parseTokenlessProgress");
}

function resolveDateOffsetByFormatValue(rawValue, format, maxDays) {
  const raw = String(rawValue || "").trim();
  const fmt = normalizeFormatMask(String(format ?? "YYYY-MM-DD"));
  if (!raw || !fmt || !hasFormatTokens(fmt)) return null;
  const unit = detectDateUnit(fmt);
  const ref = getReferenceDateForUnit(unit);
  const limit = Math.max(0, Math.trunc(Number(maxDays || getSearchLimitByUnit(unit))));
  for (let d = 0; d <= limit; d++) {
    const dt = addByUnitUtc(ref, unit, d);
    if (formatDateByFormat(dt, fmt) === raw) return d;
  }
  return null;
}

function getRuntimeFieldKeyCandidates(rtCfg, fieldKey, field) {
  const out = [];
  const push = (v) => {
    const k = String(v || "").trim();
    if (!k || out.includes(k)) return;
    out.push(k);
  };
  const srcField = isObj(field) ? field : {};
  const key = String(fieldKey || "").trim();
  const fieldId = String(srcField.id || "").trim();
  const orderKey = String(srcField.orderKey || "").trim();

  push(fieldId);
  push(orderKey);
  push(key);
  const canonical = isObj(rtCfg?.canonical) ? rtCfg.canonical : {};
  for (const k of Object.keys(canonical)) {
    const cv = String(canonical[k] || "").trim();
    if (!cv) continue;
    if (cv === fieldId || cv === orderKey || cv === key) {
      push(k);
      push(cv);
    }
  }

  return out;
}

function getRuntimeFieldConfigRow(rtCfg, fieldKey, field) {
  const map = isObj(rtCfg?.byField) ? rtCfg.byField : {};
  const keys = getRuntimeFieldKeyCandidates(rtCfg, fieldKey, field);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (isObj(map[k])) return map[k];
  }
  return {};
}

function parseIncrementCfg(src, defaultStep) {
  const inc = isObj(src?.increment) ? src.increment : {};
  const modeRaw = String(inc.mode || "standard").trim().toLowerCase();
  const mode = modeRaw === "custom" || modeRaw === "command" ? modeRaw : "standard";
  const incrementBy = Math.max(0, Math.trunc(Number(inc.incrementBy || 0)));
  const command = String(inc.command || "now").trim() || "now";
  const custom = Array.isArray(inc.custom)
    ? inc.custom.map((x) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x) => Number.isFinite(x))
    : [];
  const customRaw = Array.isArray(inc.customRaw)
    ? inc.customRaw.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  return {
    mode,
    incrementBy: incrementBy > 0 ? incrementBy : Math.max(1, Math.trunc(Number(defaultStep || 1)) || 1),
    command,
    custom: custom.length ? custom : [],
    customRaw,
  };
}

function stepByPress(incrementCfg, currentValue, inc) {
  const cfg = isObj(incrementCfg) ? incrementCfg : {};
  const modeRaw = String(cfg.mode || "standard").trim().toLowerCase();
  const mode = modeRaw === "custom" || modeRaw === "command" ? modeRaw : "standard";
  if (mode === "command") return 0;
  if (mode === "standard") {
    const base = Math.max(0, Math.trunc(Number(cfg.incrementBy || 0)));
    return base > 0 ? base : 1;
  }
  const plan = buildCustomPlan(cfg);
  const arr = plan.steps;
  if (!arr.length) return 1;
  if (plan.hasEnd && inc) {
    const curEnd = Number(currentValue);
    const total = arr.reduce((a, b) => a + b, 0);
    if (Number.isFinite(curEnd) && curEnd >= total) return -1;
  }
  if (plan.hasEnd && !inc) {
    const curEnd = Number(currentValue);
    if (Number.isFinite(curEnd) && curEnd >= arr.reduce((a, b) => a + b, 0)) return -1;
  }
  if (!inc) return backwardStepByCurrent(arr, currentValue);
  return forwardStepByCurrent(arr, currentValue);
}

function forwardStepByCurrent(customSteps, currentValue) {
  const su = getSharedUtils();
  if (su && typeof su.forwardStepByCurrent === "function") return su.forwardStepByCurrent(customSteps, currentValue);
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
    if (safeCur < frontiers[i]) {
      return Math.max(1, frontiers[i] - safeCur);
    }
  }
  const tail = Math.max(0, Math.trunc(Number(arr[arr.length - 1] || 0)));
  return Math.max(1, tail || 1);
}

function buildCustomPlan(incrementCfg) {
  const su = getSharedUtils();
  if (su && typeof su.buildCustomPlanFromIncrement === "function") return su.buildCustomPlanFromIncrement(incrementCfg);
  const cfg = isObj(incrementCfg) ? incrementCfg : {};
  const raw = Array.isArray(cfg.customRaw) ? cfg.customRaw.map((x) => String(x || "").trim()).filter(Boolean) : [];
  const fromRaw = [];
  let hasEnd = false;
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    if (/^END$/i.test(t)) { hasEnd = true; break; }
    const m = t.match(/^(-?\d+)(?:\s*\(\s*(\d+)\s*\))?$/);
    if (!m) continue;
    const step = Math.max(0, Math.trunc(Number(m[1] || 0)));
    const repeat = Math.max(1, Math.trunc(Number(m[2] || 1)));
    for (let r = 0; r < repeat; r++) fromRaw.push(step);
  }
  if (fromRaw.length) return { steps: fromRaw, hasEnd };
  const arr = Array.isArray(cfg.custom) ? cfg.custom.map((x) => Math.max(0, Math.trunc(Number(x || 0)))).filter((x) => Number.isFinite(x)) : [];
  return { steps: arr, hasEnd: false };
}

function backwardStepByCurrent(customSteps, currentValue) {
  const su = getSharedUtils();
  if (su && typeof su.backwardStepByCurrent === "function") return su.backwardStepByCurrent(customSteps, currentValue);
  const arr = Array.isArray(customSteps) ? customSteps : [];
  if (!arr.length) return 1;
  const cur = Number(currentValue);
  if (!Number.isFinite(cur) || cur <= 0) return 1;
  const frontiers = [0];
  for (let i = 0; i < arr.length; i++) {
    const step = Math.max(0, Math.trunc(Number(arr[i] || 0)));
    frontiers.push(frontiers[frontiers.length - 1] + step);
  }
  let prev = 0;
  for (let i = 1; i < frontiers.length; i++) {
    const v = frontiers[i];
    if (cur === v) {
      prev = frontiers[i - 1];
      return Math.max(1, cur - prev);
    }
    if (cur < v) {
      prev = frontiers[i - 1];
      return Math.max(1, cur - prev);
    }
  }
  const tail = Math.max(0, Math.trunc(Number(arr[arr.length - 1] || 0)));
  return Math.max(1, tail || 1);
}

function parseHhmm(text) {
  const su = getSharedUtils();
  if (su && typeof su.parseHhmm === "function") return su.parseHhmm(text);
  throw new Error("shared_utils unavailable: parseHhmm");
}

function addMinutesToHhmm(text, delta) {
  const su = getSharedUtils();
  if (su && typeof su.addMinutesHhmm === "function") return su.addMinutesHhmm(text, delta);
  throw new Error("shared_utils unavailable: addMinutesHhmm");
}

function formatNowByMask(mask) {
  const su = getSharedUtils();
  if (su && typeof su.formatNowByMask === "function") return su.formatNowByMask(mask);
  throw new Error("shared_utils unavailable: formatNowByMask");
}

function renderCommandValueByFormat(format, commandRaw) {
  const su = getSharedUtils();
  if (su && typeof su.renderCommandValueByFormat === "function") {
    return su.renderCommandValueByFormat(format, commandRaw);
  }
  throw new Error("shared_utils unavailable: renderCommandValueByFormat");
}

function buildDateTokenFromState(field, state, marker, format) {
  if (!field || String(field.kind || "") !== "dateOffset") return "";
  const off = Number(state?.selected?.[field.id]);
  if (!Number.isFinite(off)) return "";
  const safeMarker = String(marker || "").trim();
  if (!safeMarker) return "";
  const fmt = normalizeFormatMask(String(format ?? "YYYY-MM-DD"));
  if (!hasFormatTokens(fmt)) {
    const val = fmt ? renderTokenlessValueByProgress(fmt, off) : safeMarker.repeat(Math.max(0, Math.trunc(off)));
    return safeMarker + val;
  }
  const unit = detectDateUnit(fmt);
  const base = getReferenceDateForUnit(unit);
  const dt = addByUnitUtc(base, unit, off);
  const out = formatDateByFormat(dt, fmt) || formatDateByFormat(dt, "YYYY-MM-DD");
  return safeMarker + out;
}

function firstDateByMarkerAndFormat(text, marker, format) {
  const src = String(text || "");
  const fmt = normalizeFormatMask(String(format ?? "YYYY-MM-DD"));
  if (!fmt) {
    const mk = String(marker || "");
    if (!mk) return "";
    const m0 = src.match(new RegExp(`${escapeRx(mk)}(${escapeRx(mk)}*)(?=\\s|$)`, "u"));
    return m0 ? String(m0[1] || "") : "";
  }
  const valueRxSrc = hasFormatTokens(fmt)
    ? buildFormatValueRegexSource(fmt)
    : buildTokenlessValueRegexSource(fmt);
  const rx = valueRxSrc
    ? new RegExp(`${escapeRx(marker)}(${valueRxSrc})(?=\\s|$)`, "u")
    : new RegExp(`${escapeRx(marker)}([^\\s]+)`, "u");
  const m = src.match(rx);
  if (!m) return "";
  const v = String(m[1] || "").trim();
  if (hasFormatTokens(fmt)) return parseDateByFormat(v, fmt) ? v : "";
  return parseTokenlessProgress(v, fmt) !== null ? v : "";
}

function hydrateDateOffsetFromRawLine(rawLine, rules, state, field, marker, targetPanel, format) {
  const markerSafe = String(marker || "").trim();
  if (!field || !field.id || !markerSafe) return;
  const fmt = String(format ?? "YYYY-MM-DD");
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const runtime = getStatusLineRuntimeUnified();
  if (!runtime || typeof runtime.selectMarkerValueByPanelOrder !== "function") {
    throw new Error("status_line_runtime_unified unavailable: selectMarkerValueByPanelOrder");
  }
  const tokenFacts = buildTokenFactsFromLine(rawLine, rules);
  const valueRxSrc = hasFormatTokens(fmt)
    ? buildFormatValueRegexSource(fmt)
    : buildTokenlessValueRegexSource(fmt);
  let iso = "";
  const hit = runtime.selectMarkerValueByPanelOrder({
    line: rawLine,
    rules,
    panel: targetPanel,
    marker: markerSafe,
    valueRxSource: valueRxSrc || "[^\\s]+",
    tokenFacts,
    validateValue: (value) => {
      if (hasFormatTokens(fmt)) return !!parseDateByFormat(value, fmt);
      const p = parseTokenlessProgress(value, fmt);
      return p !== null && Number.isFinite(p);
    },
    deps: {
      splitSegments: linePipeline.splitSegments,
    },
  });
  if (hit && hit.value) iso = String(hit.value || "");
  if (!iso) return;
  if (!hasFormatTokens(fmt)) {
    const p = parseTokenlessProgress(iso, fmt);
    if (p === null || !Number.isFinite(p)) return;
    state.selected[field.id] = String(Math.max(0, Math.trunc(p)));
    return;
  }
  const diff = resolveDateOffsetByFormatValue(iso, fmt, 3660);
  if (diff === null || !Number.isFinite(diff)) return;
  state.selected[field.id] = String(Math.max(0, Math.trunc(diff)));
}

function looksLikeConfiguredDatePayload(text, marker, format) {
  const t = String(text || "").trim();
  if (!t) return false;
  const mk = String(marker || "");
  const fmt = normalizeFormatMask(String(format ?? "YYYY-MM-DD"));
  if (mk && t.includes(mk)) {
    if (firstDateByMarkerAndFormat(t, mk, fmt)) return true;
  }
  if (!fmt) return parseTokenlessProgress(t, "") !== null;
  if (!hasFormatTokens(fmt)) return parseTokenlessProgress(t, fmt) !== null;
  return !!parseDateByFormat(t, fmt);
}

function removeDateMarkerTokens(text, marker, format) {
  const src = String(text || "");
  const fmt = normalizeFormatMask(String(format ?? ""));
  const shared = globalThis.__inlinePkmRulesHelpers;
  if (!shared || typeof shared.removeMarkerTokensFromSegment !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: removeMarkerTokensFromSegment");
  }
  if (!fmt) return shared.removeMarkerTokensFromSegment(src, marker, "");
  const valueRxSrc = hasFormatTokens(fmt)
    ? buildFormatValueRegexSource(fmt)
    : buildTokenlessValueRegexSource(fmt);
  return shared.removeMarkerTokensFromSegment(src, marker, valueRxSrc || "");
}

function reorderRightDateTokensByOrder(line, rules, orderCfg, markers) {
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const seg = linePipeline.splitSegments(line, rules);
  const shared = globalThis.__inlinePkmRulesHelpers;
  if (!shared || typeof shared.buildPanelOrderKeys !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: buildPanelOrderKeys");
  }
  if (typeof shared.buildTagTokenKeyMap !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap");
  }
  if (typeof shared.getDefaultTagTokenKeyMapOptions !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: getDefaultTagTokenKeyMapOptions");
  }
  if (typeof shared.reorderSegmentTokensByOrder !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder");
  }
  if (typeof shared.getStatusMixedReorderOptions !== "function") {
    throw new Error("pkm_rules_runtime_helpers unavailable: getStatusMixedReorderOptions");
  }
  const tokenToKey = shared.buildTagTokenKeyMap(rules, shared.getDefaultTagTokenKeyMapOptions());
  const reorderOptions = shared.getStatusMixedReorderOptions(markers);
  seg.left = shared.reorderSegmentTokensByOrder(seg.left, orderCfg, "left", tokenToKey, reorderOptions);
  seg.dates = shared.reorderSegmentTokensByOrder(seg.dates, orderCfg, "right", tokenToKey, reorderOptions);
  if (!linePipeline || typeof linePipeline.buildFromSegments !== "function") {
    throw new Error("line_pipeline unavailable: buildFromSegments");
  }
  return linePipeline.buildFromSegments(seg, rules);
}

function takeFirstDateToken(text, marker, format) {
  const byFmt = firstDateByMarkerAndFormat(text, marker, format);
  if (byFmt) return String(marker || "") + byFmt;
  const rx = new RegExp(`${escapeRx(marker)}\\d{4}-\\d{2}-\\d{2}`);
  const m = String(text || "").match(rx);
  return m ? String(m[0]) : "";
}

function relocateDateTokenByPanel(finalLine, rules, marker, targetPanel, tokenOverride, useFallbackFromLine, format) {
  const shared = globalThis.__inlineLinePipeline;
  if (!shared || typeof shared.relocateMarkerTokenByPanel !== "function") {
    throw new Error("line_pipeline unavailable: relocateMarkerTokenByPanel");
  }
  return shared.relocateMarkerTokenByPanel({
    line: finalLine,
    rules,
    marker,
    targetPanel,
    tokenOverride,
    useFallbackFromLine,
    removeMarkerTokens: (segment, mk) => removeDateMarkerTokens(segment, mk, format),
    takeFirstToken: (segment, mk) => takeFirstDateToken(segment, mk, format),
  });
}

function clearDateMarkerFromLine(finalLine, rules, marker, format) {
  const shared = globalThis.__inlineLinePipeline;
  if (!shared || typeof shared.clearMarkerFromLine !== "function") {
    throw new Error("line_pipeline unavailable: clearMarkerFromLine");
  }
  return shared.clearMarkerFromLine({
    line: finalLine,
    rules,
    marker,
    removeMarkerTokens: (segment, mk) => removeDateMarkerTokens(segment, mk, format),
  });
}

function parseDateActionMeta(action) {
  const raw = String(action || "").trim();
  const m = raw.match(/^field_(inc|dec):(.+)$/);
  if (m) {
    return {
      kind: "generic",
      fieldKey: String(m[2] || "").trim(),
      increase: String(m[1] || "") === "inc",
    };
  }
  return {
    kind: "unknown",
    fieldKey: "",
    increase: true,
  };
}

function getFirstElementFieldKey(rules) {
  const right = Array.isArray(rules?.rightMode?.fields) ? rules.rightMode.fields : [];
  for (let i = 0; i < right.length; i++) {
    const field = right[i];
    if (!field || !field.id) continue;
    const kind = String(field.kind || "").trim();
    if (kind !== "dateOffset" && kind !== "nowTime" && kind !== "estimatedCycle" && kind !== "genericElement") continue;
    const orderKey = String(resolveOrderKeyFromFieldId(field.id) || field.orderKey || field.id || "").trim();
    if (orderKey) return orderKey;
  }
  return "";
}

function resolveFieldIdByOrderKey(rules, orderKey) {
  const key = String(orderKey || "").trim();
  if (!key) return "";
  const right = Array.isArray(rules?.rightMode?.fields) ? rules.rightMode.fields : [];
  const left = Array.isArray(rules?.leftMode?.fields) ? rules.leftMode.fields : [];
  const byId = right.concat(left).find((x) => x && String(x.id || "").trim() === key);
  if (byId && byId.id) return String(byId.id);
  const byOrderKey = right.concat(left).find((x) => x && String(x.orderKey || "").trim() === key);
  if (byOrderKey && byOrderKey.id) return String(byOrderKey.id);
  const mapped = String(resolveDateFieldIdFromOrderKey(key) || "").trim();
  if (mapped && mapped !== key) {
    const mappedById = right.concat(left).find((x) => x && String(x.id || "").trim() === mapped);
    if (mappedById && mappedById.id) return String(mappedById.id);
    const mappedByOrder = right.concat(left).find((x) => x && String(x.orderKey || "").trim() === mapped);
    if (mappedByOrder && mappedByOrder.id) return String(mappedByOrder.id);
  }
  return mapped || key;
}

function resolveActionFieldKey(rules, orderCfg, dateRuntimeCfg, actionFieldKey) {
  const statusCommon = getStatusRuntimeCommon();
  const rawKey = String(actionFieldKey || "").trim();
  if (!rawKey) return "";
  if (statusCommon.isFieldKeyEnabled(orderCfg, rawKey)) return rawKey;

  const canonical = isObj(dateRuntimeCfg?.canonical) ? dateRuntimeCfg.canonical : {};
  const mapped = String(canonical[rawKey] || "").trim();
  if (mapped && statusCommon.isFieldKeyEnabled(orderCfg, mapped)) return mapped;

  const right = Array.isArray(rules?.rightMode?.fields) ? rules.rightMode.fields : [];
  for (let i = 0; i < right.length; i++) {
    const f = right[i];
    if (!f || !f.id) continue;
    const orderKey = String(f.orderKey || resolveOrderKeyFromFieldId(f.id) || f.id || "").trim();
    if (!orderKey) continue;
    if (String(f.id || "").trim() === rawKey && statusCommon.isFieldKeyEnabled(orderCfg, orderKey)) return orderKey;
  }

  return rawKey;
}

function getElementCycleValues(field) {
  const vals = Array.isArray(field?.values) ? field.values : [];
  return vals
    .filter((v) => isObj(v) && typeof v.token === "string" && v.token && v.active !== false)
    .slice()
    .sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 999;
      const bo = typeof b.order === "number" ? b.order : 999;
      return ao - bo;
    });
}

function getElementRuntimeCfg(rtCfg, fieldKey, field) {
  const srcField = isObj(field) ? field : {};
  const src = getRuntimeFieldConfigRow(rtCfg, fieldKey, srcField);
  const kind = String(srcField.kind || "").trim();
  const isTime = kind === "nowTime" || kind === "estimatedCycle";
  const defaultFormat = kind === "genericElement"
    ? "1"
    : (isTime ? "HH:mm" : "YYYY-MM-DD");
  const hasOwnFormat = Object.prototype.hasOwnProperty.call(src, "format");
  const format = hasOwnFormat ? String(src.format ?? "").trim() : defaultFormat;
  const activeRaw = String(src.activeMode || src.active || "yes").trim().toLowerCase();
  const activeMode = activeRaw === "no" || activeRaw === "hotkey_only" ? activeRaw : "yes";
  const marker = String(src.emoji || srcField.marker || "").trim();
  const incrementDefault = isTime ? 5 : 1;
  return {
    fieldId: String(srcField.id || "").trim(),
    activeMode,
    emoji: marker,
    format: String(format || defaultFormat).trim() || defaultFormat,
    hotkey: {
      increase: String(src?.hotkey?.increase || "").trim(),
      decrease: String(src?.hotkey?.decrease || "").trim(),
    },
    increment: parseIncrementCfg(src, incrementDefault),
  };
}

function isTimeLikeField(field, runtimeCfg) {
  const kind = String(field?.kind || "").trim();
  if (kind === "nowTime" || kind === "estimatedCycle") return true;
  const fmt = String(runtimeCfg?.format || "").trim();
  if (!fmt) return false;
  if (fmt === "HH:mm") return true;
  if (!hasFormatTokens(fmt) && /^\d{2}:\d{2}$/.test(fmt)) return true;
  return false;
}

function hydrateTimeFieldFromRawLine(rawLine, rules, state, field, marker, targetPanel, format) {
  const markerSafe = String(marker || "").trim();
  if (!field || !field.id || !markerSafe) return;
  const fmt = String(format || "HH:mm").trim() || "HH:mm";
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const runtime = getStatusLineRuntimeUnified();
  if (!runtime || typeof runtime.selectMarkerValueByPanelOrder !== "function") {
    throw new Error("status_line_runtime_unified unavailable: selectMarkerValueByPanelOrder");
  }
  const tokenFacts = buildTokenFactsFromLine(rawLine, rules);
  const valueRxSrc = hasFormatTokens(fmt)
    ? buildFormatValueRegexSource(fmt)
    : buildTokenlessValueRegexSource(fmt);
  const hit = runtime.selectMarkerValueByPanelOrder({
    line: rawLine,
    rules,
    panel: targetPanel,
    marker: markerSafe,
    valueRxSource: valueRxSrc || "\\d{2}:\\d{2}",
    tokenFacts,
    validateValue: (value) => !!parseHhmm(value),
    deps: {
      splitSegments: linePipeline.splitSegments,
    },
  });
  if (hit && hit.value) {
    state.selected[field.id] = String(hit.value || "");
    return;
  }
}

function hydrateGenericElementFromRawLine(rawLine, rules, state, field, marker, targetPanel, format, cycleVals) {
  const markerSafe = String(marker || "").trim();
  if (!field || !field.id || !markerSafe) return;
  const fmt = String(format || "").trim() || "1";
  const linePipeline = globalThis.__inlineLinePipeline;
  if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
    throw new Error("line_pipeline unavailable: splitSegments");
  }
  const runtime = getStatusLineRuntimeUnified();
  if (!runtime || typeof runtime.selectMarkerValueByPanelOrder !== "function") {
    throw new Error("status_line_runtime_unified unavailable: selectMarkerValueByPanelOrder");
  }
  if (typeof runtime.selectTokenByPanelOrder !== "function") {
    throw new Error("status_line_runtime_unified unavailable: selectTokenByPanelOrder");
  }
  const tokenFacts = buildTokenFactsFromLine(rawLine, rules);
  const valueRxSrc = hasFormatTokens(fmt)
    ? buildFormatValueRegexSource(fmt)
    : buildTokenlessValueRegexSource(fmt);
  const hit = runtime.selectMarkerValueByPanelOrder({
    line: rawLine,
    rules,
    panel: targetPanel,
    marker: markerSafe,
    valueRxSource: valueRxSrc || "[^\\s]+",
    tokenFacts,
    validateValue: (raw) => {
      if (hasFormatTokens(fmt)) {
        const progress = resolveDateOffsetByFormatValue(raw, fmt, 3660);
        return progress !== null && Number.isFinite(progress);
      }
      const progress = parseTokenlessProgress(raw, fmt);
      return progress !== null && Number.isFinite(progress);
    },
    deps: {
      splitSegments: linePipeline.splitSegments,
    },
  });
  if (hit && hit.value) {
    let progress = null;
    if (hasFormatTokens(fmt)) progress = resolveDateOffsetByFormatValue(hit.value, fmt, 3660);
    else progress = parseTokenlessProgress(hit.value, fmt);
    if (progress !== null && Number.isFinite(progress)) {
      state.selected[field.id] = String(Math.max(0, Math.trunc(progress)));
      return;
    }
  }
  const map = Array.isArray(cycleVals) ? cycleVals : [];
  if (!map.length) return;
  const tokenMap = [];
  for (const v of map) {
    const tok = String(v?.token || "").trim();
    if (!tok) continue;
    tokenMap.push({ id: tok, token: `${markerSafe}${tok}` });
  }
  const hitToken = runtime.selectTokenByPanelOrder({
    line: rawLine,
    rules,
    panel: targetPanel,
    tokenMap,
    tokenFacts,
    deps: {
      splitSegments: linePipeline.splitSegments,
    },
  });
  if (hitToken && hitToken.id) {
    state.selected[field.id] = String(hitToken.id || "");
    return;
  }
}

function nextCycleTokenByDirection(cycleVals, currentToken, increase) {
  const arr = Array.isArray(cycleVals) ? cycleVals : [];
  if (!arr.length) return "";
  const cur = String(currentToken || "").trim();
  const idx = arr.findIndex((v) => String(v?.token || "") === cur);
  if (idx === -1) return String(increase ? arr[0]?.token || "" : arr[arr.length - 1]?.token || "");
  if (increase) {
    if (idx >= arr.length - 1) return "";
    return String(arr[idx + 1]?.token || "");
  }
  if (idx <= 0) return "";
  return String(arr[idx - 1]?.token || "");
}

function applyGenericElementIncrementByFormat(state, fieldId, incrementCfg, format, increase, cycleVals) {
  const id = String(fieldId || "").trim();
  if (!id) return;
  const fmt = String(format || "").trim() || "1";
  const cur = String(state?.selected?.[id] || "").trim();
  const curProgress = cur === "" ? "" : String(Math.max(0, Math.trunc(Number(cur || 0))));
  const cfg = isObj(incrementCfg) ? incrementCfg : { mode: "standard", incrementBy: 1, command: "now", customRaw: [], custom: [] };
  if (cfg.mode === "command") {
    if (!increase) {
      state.selected[id] = "";
      return;
    }
    const cmdValue = String(renderCommandValueByFormat(fmt, String(cfg.command || "now")) || "").trim();
    if (!cmdValue) {
      state.selected[id] = "";
      return;
    }
    const progress = hasFormatTokens(fmt)
      ? resolveDateOffsetByFormatValue(cmdValue, fmt, 3660)
      : parseTokenlessProgress(cmdValue, fmt);
    if (progress !== null && Number.isFinite(progress)) state.selected[id] = String(Math.max(0, Math.trunc(progress)));
    else if (String(cfg.command || "").trim().toLowerCase() === "randome") state.selected[id] = cmdValue;
    else state.selected[id] = "";
    return;
  }
  const step = stepByPress(cfg, curProgress, increase);
  if (step < 0) {
    state.selected[id] = "";
    return;
  }
  mutateDateOffsetByFormat(state, id, fmt, increase, step);
  if (String(state?.selected?.[id] || "").trim()) return;
  const cycle = Array.isArray(cycleVals) ? cycleVals : [];
  if (!cycle.length) return;
  const fallback = nextCycleTokenByDirection(cycle, "", increase);
  if (!fallback) return;
  const parsed = parseTokenlessProgress(fallback, fmt);
  if (parsed === null || !Number.isFinite(parsed)) return;
  state.selected[id] = String(Math.max(0, Math.trunc(parsed)));
}

function buildGenericElementTokenFromState(field, state, marker, format, cycleVals) {
  const f = field && field.id ? field : null;
  if (!f || !marker) return "";
  const raw = String(state?.selected?.[f.id] || "").trim();
  if (!raw) return "";
  const cycle = Array.isArray(cycleVals) ? cycleVals : [];
  for (let i = 0; i < cycle.length; i++) {
    const tok = String(cycle[i]?.token || "").trim();
    if (tok && tok === raw) return `${marker}${tok}`;
  }
  const fmt = String(format || "").trim() || "1";
  const asNum = Number(raw);
  const progress = Number.isFinite(asNum) ? Math.max(0, Math.trunc(asNum)) : null;
  if (hasFormatTokens(fmt)) {
    if (progress === null) return `${marker}${raw}`;
    const unit = detectDateUnit(fmt);
    const base = getReferenceDateForUnit(unit);
    const dt = addByUnitUtc(base, unit, progress);
    const value = formatDateByFormat(dt, fmt) || "";
    return value ? `${marker}${value}` : `${marker}${raw}`;
  }
  if (progress === null) return `${marker}${raw}`;
  const token = renderTokenlessValueByProgress(fmt, progress);
  return token ? `${marker}${token}` : `${marker}${raw}`;
}

function detectDateUnit(format) {
  return getStatusRuntimeCommon().detectDateUnit(format, normalizeFormatMask, hasFormatTokens, getSharedUtils());
}

function getDateProgressForStep(state, fieldId, format) {
  return getStatusRuntimeCommon().getDateProgressForStep(state, fieldId, format);
}

function mutateDateOffsetByFormat(state, fieldId, format, inc, stepRaw) {
  const step = Math.max(0, Math.trunc(Number(stepRaw || 1))) || 1;
  const cur = String(state.selected[fieldId] || "");
  const val = cur === "" ? null : Number(cur);
  if (inc) {
    if (val === null || isNaN(val)) {
      state.selected[fieldId] = "0";
      return;
    }
  } else if (val === null || isNaN(val)) {
    state.selected[fieldId] = "";
    return;
  }
  const curNum = Math.max(0, Math.trunc(Number(val || 0)));
  if (!inc && curNum <= 0) {
    state.selected[fieldId] = "";
    return;
  }
  const next = inc
    ? (curNum + step)
    : Math.max(0, curNum - step);
  state.selected[fieldId] = String(Math.max(0, next));
}

module.exports = {
  settings: {
    name: "Status: date & time field logic",
    author: "you",
    options: {
      [RULES_PATH]: {
        type: "text",
        defaultValue: "InlineOverhaul_Generated_RULES_TagWheel.md",
        description: "Path from vault root to rules markdown",
      },
      [ACTION_TYPE]: {
        type: "dropdown",
        defaultValue: DATE_ACTION_OPTIONS[0] || "",
        options: DATE_ACTION_OPTIONS,
        description: "Action type: generic element increment/decrement by order key",
      },
      [CYCLE_END_BEHAVIOR]: {
        type: "dropdown",
        defaultValue: "keep-bullet",
        options: ["keep-bullet", "clear-prefix"],
        description: "On cycle end for empty-like lines: keep bullet (- ) or clear line",
      },
      [CURSOR_POLICY]: {
        type: "dropdown",
        defaultValue: "text_end",
        options: ["text_end", "current_position", "line_end"],
        description: "Cursor behavior after action",
      },
      [ORDER_CONFIG]: {
        type: "text",
        defaultValue: "",
        description: "Optional JSON order config from plugin",
      },
      [DATE_RUNTIME_CONFIG]: {
        type: "text",
        defaultValue: "",
        description: "Optional JSON dates runtime config from plugin",
      },
    },
  },

  entry: async (QuickAdd, settings) => {
    const app_ = QuickAdd?.app ?? app;
    const editor = app_?.workspace?.activeLeaf?.view?.editor ?? app_?.workspace?.activeEditor?.editor;
    if (!editor) return;

    await callRuntimeApi(app_, "loadRulesRuntimeHelpers");
    /*
     * Свои модули уже приехали `require` при загрузке файла. Остаются
     * только те, что публикуют себя в `globalThis`: оттуда их читают
     * `status_runtime_common` и TagWheel.
     */
    await callRuntimeApi(app_, "loadMacroShared");
    await callRuntimeApi(app_, "loadLinePipeline");
    const lineFinalize = (__lineFinalizeUnified && typeof __lineFinalizeUnified === "object")
      ? __lineFinalizeUnified
      : null;
    if (!lineFinalize) throw new Error("pkm_line_finalize_unified unavailable: not initialized");
    const macroShared = globalThis.__inlinePkmMacroShared;
    if (!macroShared || typeof macroShared.isNoContentParsed !== "function") {
      throw new Error("pkm_macro_shared unavailable: isNoContentParsed");
    }
    if (typeof macroShared.isOrphanCheckboxBulletLine !== "function") {
      throw new Error("pkm_macro_shared unavailable: isOrphanCheckboxBulletLine");
    }
    if (typeof macroShared.buildBulletOnlyLine !== "function") {
      throw new Error("pkm_macro_shared unavailable: buildBulletOnlyLine");
    }
    if (typeof macroShared.applyKeepBullet !== "function") {
      throw new Error("pkm_macro_shared unavailable: applyKeepBullet");
    }
    if (typeof macroShared.ensureTrailingSeparatorSpace !== "function") {
      throw new Error("pkm_macro_shared unavailable: ensureTrailingSeparatorSpace");
    }
    if (typeof macroShared.getCursorAtTextEnd !== "function") {
      throw new Error("pkm_macro_shared unavailable: getCursorAtTextEnd");
    }
    if (typeof macroShared.getTextSlotBounds !== "function") {
      throw new Error("pkm_macro_shared unavailable: getTextSlotBounds");
    }
    if (typeof macroShared.isBulletLikeEmptyResult !== "function") {
      throw new Error("pkm_macro_shared unavailable: isBulletLikeEmptyResult");
    }

    const core = __tagwheelCore;

    const rulesPathInput = String(settings?.[RULES_PATH] ?? "").trim();
    const rulesHelpers = globalThis.__inlinePkmRulesHelpers;
    if (!rulesHelpers || typeof rulesHelpers.normalizeRulesPath !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: normalizeRulesPath");
    }
    if (typeof rulesHelpers.readRulesMarkdownWithFallback !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: readRulesMarkdownWithFallback");
    }
    const normalizeRulesPath = (raw) => rulesHelpers.normalizeRulesPath(raw, DEFAULT_RULES_PATH);
    let rulesMd = "";
    let usedRulesPath = "";
    try {
      const loaded = await rulesHelpers.readRulesMarkdownWithFallback(app_, rulesPathInput, DEFAULT_RULES_PATH);
      rulesMd = loaded.markdown;
      usedRulesPath = loaded.path;
    } catch (e) {
      showStatusDateNotice((e && e.message)
        ? e.message
        : sayStatusDate(statusDateNoticeKey('file-missing'),
          'Rules file not found: {0}', normalizeRulesPath(rulesPathInput)));
      return;
    }
    if (usedRulesPath && usedRulesPath !== normalizeRulesPath(rulesPathInput)) {
      showStatusDateNotice(sayStatusDate(statusDateNoticeKey('path-fallback'),
        'Using the rules file at {0}', usedRulesPath));
    }
    const rules = core.parseRulesFromMarkdown(rulesMd);
    const statusCommon = getStatusRuntimeCommon();
    const dateRuntimeCfg = await statusCommon.resolveAndApplyDateRuntimeConfig(app_, settings, rules);
    const orderCfg = await statusCommon.resolveOrderConfig(app_, settings);
    statusCommon.applyOrderToRules(rules, orderCfg);
    try {
      core.validateRules(rules);
    } catch (e) {
      showStatusDateNotice(sayStatusDate(statusDateNoticeKey('config-error'),
        'Rules are not valid after applying the order: {0}',
        String(e && e.message ? e.message : e || "validateRules failed")));
      return;
    }
    const missingEmojiFields = collectMissingEmojiFields(rules, dateRuntimeCfg);
    if (missingEmojiFields.length) {
      showStatusDateNotice(sayStatusDate(statusDateNoticeKey('emoji-required'),
        'These Fields need an emoji: {0}. Set it in Settings -> inlineOverhaul -> Tags & PKM -> Fields',
        missingEmojiFields.join(", ")));
    }

    const actionDefaultField = String(getFirstElementFieldKey(rules) || "").trim();
    const actionSetting = settings?.[ACTION_TYPE] ?? settings?.["Action type"];
    const action = String(actionSetting ?? (actionDefaultField ? `field_inc:${actionDefaultField}` : "")).trim();
    const actionMeta = parseDateActionMeta(action);
    const requestedFieldKey = String(actionMeta.fieldKey || getFirstElementFieldKey(rules) || "").trim();
    if (!requestedFieldKey) return;
    const actionFieldKey = resolveActionFieldKey(rules, orderCfg, dateRuntimeCfg, requestedFieldKey);
    const actionFieldId = resolveFieldIdByOrderKey(rules, actionFieldKey);
    const rightFieldsAll = Array.isArray(rules?.rightMode?.fields) ? rules.rightMode.fields : [];
    const leftFieldsAll = Array.isArray(rules?.leftMode?.fields) ? rules.leftMode.fields : [];
    const resolveFieldOrderKeyLocal = (field) => String(field?.orderKey || resolveOrderKeyFromFieldId(field?.id) || field?.id || "").trim();
    const findFieldByKey = (key) => {
      const k = String(key || "").trim();
      if (!k) return null;
      const all = rightFieldsAll.concat(leftFieldsAll);
      for (let i = 0; i < all.length; i++) {
        const f = all[i];
        if (!f || !f.id) continue;
        if (String(f.id || "").trim() === k) return f;
        if (String(f.orderKey || "").trim() === k) return f;
        if (resolveFieldOrderKeyLocal(f) === k) return f;
      }
      return null;
    };

    let actionField = findFieldByKey(actionFieldKey) || findFieldByKey(actionFieldId);
    if (!actionField || !actionField.id) {
      const canonical = isObj(dateRuntimeCfg?.canonical) ? dateRuntimeCfg.canonical : {};
      for (const alias of Object.keys(canonical)) {
        const mappedKey = String(canonical[alias] || "").trim();
        if (!mappedKey) continue;
        if (mappedKey !== actionFieldKey && mappedKey !== actionFieldId) continue;
        const byAlias = getField(rules.rightMode, alias) || getField(rules.leftMode, alias);
        if (byAlias && byAlias.id) {
          actionField = byAlias;
          break;
        }
      }
    }
    if (!actionField || !actionField.id) {
      const rightFields = rightFieldsAll;
      const curFallback = editor.getCursor();
      const rawLineForFallback = String(editor.getLine(curFallback.line) ?? "").replace(/\n$/, "");
      for (let i = 0; i < rightFields.length; i++) {
        const cand = rightFields[i];
        if (!cand || !cand.id) continue;
        const candRuntime = getElementRuntimeCfg(dateRuntimeCfg, String(cand.orderKey || cand.id || "").trim(), cand);
        const candMarker = String(candRuntime.emoji || cand.marker || "").trim();
        if (!candMarker) continue;
        if (rawLineForFallback.indexOf(candMarker) === -1) continue;
        actionField = cand;
        break;
      }
    }
    if (!actionField || !actionField.id) return;
    const actionFieldRuntimeKey = resolveFieldOrderKeyLocal(actionField);
    if (!statusCommon.isFieldKeyEnabled(orderCfg, actionFieldRuntimeKey || actionFieldKey)) return;
    const panelByOrder = statusCommon.getPanelForField(orderCfg, actionFieldKey);
    let freeRoamMode = statusCommon.getFieldFreeRoamMode(orderCfg, actionFieldKey);
    const freeRoamBehavior = statusCommon.getFreeRoamBehavior(orderCfg);
    const cur = editor.getCursor();
    const lineNo = cur.line;
    const rawLine = String(editor.getLine(lineNo) ?? "").replace(/\n$/, "");
    const tokenFactsRaw = buildTokenFactsFromLine(rawLine, rules);
    const parsed = core.parseLine(rawLine, rules);
    const noContentStart = macroShared.isNoContentParsed(parsed, { includeTags: true });
    const cycleEndBehavior = statusCommon.normalizeCycleEndBehavior(settings?.[CYCLE_END_BEHAVIOR]);
    const cursorPolicy = statusCommon.normalizeCursorPolicy(settings?.[CURSOR_POLICY]);
    const parsedWork = noContentStart ? { ...parsed, checkboxToken: "" } : parsed;

    const state = core.makeInitialState(rules, "left");
    core.hydrateStateFromParsedLine(rules, state, parsedWork);
    core.sanitizeState(rules, state);

    const runtimeCfg = getElementRuntimeCfg(dateRuntimeCfg, actionFieldKey, actionField);
    const actionFormat = String(runtimeCfg.format || "1").trim() || "1";
    let actionMarker = String(runtimeCfg.emoji || actionField.marker || "").trim();
    if (!actionMarker) {
      const rulesHelpersForMarker = globalThis.__inlinePkmRulesHelpers;
      if (!rulesHelpersForMarker || typeof rulesHelpersForMarker.getDateMarkersFromRules !== "function") {
        throw new Error("pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules");
      }
      const fallbackMarkers = rulesHelpersForMarker.getDateMarkersFromRules(rules);
      const markerPool = Array.from(new Set([
        ...(Array.isArray(fallbackMarkers.time) ? fallbackMarkers.time : []),
        ...(Array.isArray(fallbackMarkers.start) ? fallbackMarkers.start : []),
        ...(Array.isArray(fallbackMarkers.due) ? fallbackMarkers.due : []),
        ...(Array.isArray(fallbackMarkers.all) ? fallbackMarkers.all : []),
      ].map((x) => String(x || "").trim()).filter(Boolean)));
      for (let i = 0; i < markerPool.length; i++) {
        const mk = markerPool[i];
        if (mk && rawLine.indexOf(mk) !== -1) {
          actionMarker = mk;
          break;
        }
      }
    }
    if (!actionMarker) {
      const fallbackHit = String(rawLine || "").match(/([^\s\w\d])\d{4}-\d{2}-\d{2}/u);
      if (fallbackHit && fallbackHit[1]) actionMarker = String(fallbackHit[1]);
    }
    if (!actionMarker) return;
    const actionKind = String(actionField.kind || "").trim();
    const isTimeLike = isTimeLikeField(actionField, runtimeCfg);
    const isDateOffset = actionKind === "dateOffset";
    const actionCycleValues = getElementCycleValues(actionField);

    let targetPanel = panelByOrder;
    if (!actionMeta.increase) {
      const linePipeline = globalThis.__inlineLinePipeline;
      if (!linePipeline || typeof linePipeline.resolvePanelByMarkerPresence !== "function") {
        throw new Error("line_pipeline unavailable: resolvePanelByMarkerPresence");
      }
      linePipeline.resolvePanelByMarkerPresence({
        line: rawLine,
        rules,
        marker: actionMarker,
        panelByOrder,
      });
    }
    if (targetPanel === "right") {
      freeRoamMode = "off";
    }

    if (isTimeLike) {
      hydrateTimeFieldFromRawLine(rawLine, rules, state, actionField, actionMarker, targetPanel, actionFormat);
    } else if (isDateOffset) {
      hydrateDateOffsetFromRawLine(rawLine, rules, state, actionField, actionMarker, targetPanel, actionFormat);
    } else {
      hydrateGenericElementFromRawLine(rawLine, rules, state, actionField, actionMarker, targetPanel, actionFormat, actionCycleValues);
    }

    const rulesHelpersForDates = globalThis.__inlinePkmRulesHelpers;
    if (!rulesHelpersForDates || typeof rulesHelpersForDates.getDateMarkersFromRules !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules");
    }
    if (typeof rulesHelpersForDates.getDateValuePatterns !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: getDateValuePatterns");
    }
    if (typeof rulesHelpersForDates.isDateLikeToken !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: isDateLikeToken");
    }
    if (typeof rulesHelpersForDates.hasDateLikeMarkerInText !== "function") {
      throw new Error("pkm_rules_runtime_helpers unavailable: hasDateLikeMarkerInText");
    }
    const dateMarkers = rulesHelpersForDates.getDateMarkersFromRules(rules);
    let forceClear = false;
    let useNowToken = false;
    let didDateOffsetDecrease = false;
    let directDateTokenOverride = "";
    const fieldDisabled = statusCommon.getFieldActiveMode(orderCfg, actionFieldKey) === "no";
    if (fieldDisabled) return;

    if (isTimeLike) {
      if (runtimeCfg.increment.mode === "command") {
        if (actionMeta.increase && String(runtimeCfg.increment.command || "").toLowerCase() === "now") {
          state.selected[actionField.id] = formatNowByMask(actionFormat || "HH:mm");
        } else {
          state.selected[actionField.id] = "";
          forceClear = true;
        }
      } else {
        const curVal = String(state?.selected?.[actionField.id] || "").trim();
        const step = stepByPress(runtimeCfg.increment, curVal ? String(parseHhmm(curVal) ? 1 : 0) : "", actionMeta.increase);
        if (actionMeta.increase) {
          if (!curVal) {
            const now = new Date();
            const base = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
            const next = addMinutesToHhmm(base, 0);
            state.selected[actionField.id] = next;
          } else {
            state.selected[actionField.id] = addMinutesToHhmm(curVal, step) || curVal;
          }
        } else {
          if (!curVal) {
            state.selected[actionField.id] = "";
            forceClear = true;
          } else {
            state.selected[actionField.id] = addMinutesToHhmm(curVal, -step) || "";
            if (!String(state.selected[actionField.id] || "")) forceClear = true;
          }
        }
      }
    } else if (isDateOffset) {
      if (runtimeCfg.increment.mode === "command") {
        if (actionMeta.increase && String(runtimeCfg.increment.command || "").toLowerCase() === "now") {
          useNowToken = true;
          state.selected[actionField.id] = "";
        } else {
          state.selected[actionField.id] = "";
          forceClear = true;
        }
      } else if (!actionMeta.increase) {
        didDateOffsetDecrease = true;
        const runtime = getStatusLineRuntimeUnified();
        const linePipeline = globalThis.__inlineLinePipeline;
        const valueRxSource = hasFormatTokens(actionFormat)
          ? buildFormatValueRegexSource(actionFormat)
          : buildTokenlessValueRegexSource(actionFormat);
        const hit = runtime.selectMarkerValueByPanelOrder({
          line: rawLine,
          rules,
          panel: targetPanel,
          marker: actionMarker,
          valueRxSource: valueRxSource || "[^\\s]+",
          tokenFacts: tokenFactsRaw,
          deps: { splitSegments: linePipeline.splitSegments },
        });
        const selectedValue = String(hit && hit.value || "").trim();
        if (selectedValue) {
          let off = null;
          if (hasFormatTokens(actionFormat)) {
            off = resolveDateOffsetByFormatValue(selectedValue, actionFormat, 3660);
          } else {
            const p = parseTokenlessProgress(selectedValue, actionFormat);
            off = (p !== null && Number.isFinite(p)) ? Math.max(0, Math.trunc(p)) : null;
          }
          if (off !== null && Number.isFinite(off)) {
            state.selected[actionField.id] = String(Math.max(0, off));
          }
        }
        const progress = getDateProgressForStep(state, actionField.id, actionFormat);
        const step = stepByPress(runtimeCfg.increment, progress, false);
        if (step < 0) {
          state.selected[actionField.id] = "";
          forceClear = true;
        } else {
          mutateDateOffsetByFormat(state, actionField.id, actionFormat, false, step);
          if (!String(state.selected[actionField.id] || "")) forceClear = true;
        }
      } else {
        const progress = getDateProgressForStep(state, actionField.id, actionFormat);
        let step = stepByPress(runtimeCfg.increment, progress, true);
        if (!progress) {
          const runtime = getStatusLineRuntimeUnified();
          const linePipeline = globalThis.__inlineLinePipeline;
          if (!runtime || typeof runtime.selectMarkerValueByPanelOrder !== "function") {
            throw new Error("status_line_runtime_unified unavailable: selectMarkerValueByPanelOrder");
          }
          if (!linePipeline || typeof linePipeline.splitSegments !== "function") {
            throw new Error("line_pipeline unavailable: splitSegments");
          }
          const valueRxSource = hasFormatTokens(actionFormat)
            ? buildFormatValueRegexSource(actionFormat)
            : buildTokenlessValueRegexSource(actionFormat);
          const hit = runtime.selectMarkerValueByPanelOrder({
            line: rawLine,
            rules,
            panel: targetPanel,
            marker: actionMarker,
            valueRxSource: valueRxSource || "[^\\s]+",
            tokenFacts: tokenFactsRaw,
            deps: { splitSegments: linePipeline.splitSegments },
          });
          const hitValue = String(hit && hit.value || "").trim();
          if (hitValue && hasFormatTokens(actionFormat)) {
            const parsedDate = parseDateByFormat(hitValue, actionFormat);
            if (parsedDate) {
              const unit = detectDateUnit(actionFormat);
              const safeStep = Math.max(1, Math.trunc(Number(step || 1)));
              const nextDate = addByUnitUtc(parsedDate, unit, safeStep);
              const nextRaw = formatDateByFormat(nextDate, actionFormat);
              if (nextRaw) directDateTokenOverride = `${actionMarker}${nextRaw}`;
            }
          }
        }
        if (step < 0) {
          state.selected[actionField.id] = "";
          forceClear = true;
        } else {
          mutateDateOffsetByFormat(state, actionField.id, actionFormat, true, step);
        }
      }
    } else {
      applyGenericElementIncrementByFormat(state, actionField.id, runtimeCfg.increment, actionFormat, actionMeta.increase, actionCycleValues);
      if (!String(state?.selected?.[actionField.id] || "").trim()) forceClear = true;
    }

    let finalLine = rawLine;
    const finalParsed0 = core.parseLine(finalLine, rules);
    finalLine = lineFinalize.applyTrailingSeparatorPolicy({
      line: finalLine,
      rules,
      parsedFinal: finalParsed0,
      freeRoamMode,
      mixedMinimalSeparatorOff: freeRoamMode === "minimal" && freeRoamBehavior.minimalSeparator === false,
      ensureTrailingSeparatorSpace: (line, runtimeRules, parsedFinal) => macroShared.ensureTrailingSeparatorSpace(line, runtimeRules, parsedFinal),
    });
    let finalParsed = core.parseLine(finalLine, rules);
    if (isEmptyLikeParsed(parsed)) {
      const reflown = lineFinalize.reflowNoContentPanelLine({
        parsedFinal: finalParsed,
        parsedBase: parsedWork,
        rules,
        panelName: targetPanel,
      });
      if (typeof reflown === "string") {
        finalLine = reflown;
        finalParsed = core.parseLine(finalLine, rules);
      }
    }
    let nextToken = "";
    if (isTimeLike) {
      if (runtimeCfg.increment.mode === "command" && actionMeta.increase && String(runtimeCfg.increment.command || "").toLowerCase() === "now") {
        nextToken = `${actionMarker}${formatNowByMask(actionFormat || "HH:mm")}`;
      } else {
        const v = String(state?.selected?.[actionField.id] || "").trim();
        nextToken = v ? `${actionMarker}${v}` : "";
      }
    } else if (isDateOffset) {
      nextToken = directDateTokenOverride || (useNowToken
        ? `${actionMarker}${formatNowByMask(actionFormat || "YYYY-MM-DD")}`
        : buildDateTokenFromState(actionField, state, actionMarker, actionFormat));
    } else {
      nextToken = buildGenericElementTokenFromState(actionField, state, actionMarker, actionFormat, actionCycleValues);
    }

    if (forceClear || !String(nextToken || "")) {
      finalLine = clearDateMarkerFromLine(finalLine, rules, actionMarker, actionFormat);
    } else {
      finalLine = relocateDateTokenByPanel(finalLine, rules, actionMarker, targetPanel, nextToken, false, actionFormat);
    }
    finalLine = reorderRightDateTokensByOrder(finalLine, rules, orderCfg, {
      ...dateMarkers,
      generic: actionMarker,
    });
    finalParsed = core.parseLine(finalLine, rules);
    if (targetPanel === "left" && freeRoamMode === "off") {
      const linePipeline = globalThis.__inlineLinePipeline;
      if (!linePipeline || typeof linePipeline.cleanOriginalTextForLeftDate !== "function") {
        throw new Error("line_pipeline unavailable: cleanOriginalTextForLeftDate");
      }
      if (typeof linePipeline.enforceTextSegmentForLeftTag !== "function") {
        throw new Error("line_pipeline unavailable: enforceTextSegmentForLeftTag");
      }
      const dateValuePatterns = rulesHelpersForDates.getDateValuePatterns();
      const originalTextClean = linePipeline.cleanOriginalTextForLeftDate({
        rawLine,
        parsedText: parsed.text,
        rules,
        isDateLikeToken: (token) => rulesHelpersForDates.isDateLikeToken(token),
        dateIso: String(dateValuePatterns && dateValuePatterns.dateIso ? dateValuePatterns.dateIso : "\\d{4}-\\d{2}-\\d{2}"),
        timeHm: String(dateValuePatterns && dateValuePatterns.timeHm ? dateValuePatterns.timeHm : "\\d{2}:\\d{2}"),
        kinds: ["dateOffset", "nowTime", "estimatedCycle", "genericElement"],
      });
      finalLine = linePipeline.enforceTextSegmentForLeftTag(finalLine, rules, originalTextClean);
      finalParsed = core.parseLine(finalLine, rules);
    }
    const effectivePolicy = lineFinalize.resolveEffectiveSelectionPolicy({
      selectedEntries: [],
      freeRoamBehavior,
      activeMode: freeRoamMode,
    });
    const mixedPolicy = {
      ...effectivePolicy,
      applyMinimalSeparatorCollapse: freeRoamMode === "minimal"
        && freeRoamBehavior.minimalSeparator === false
        && !lineFinalize.hasAnySeparator(rawLine, rules),
    };
    finalLine = lineFinalize.applyUnifiedPostFinalize({
      rawLine,
      line: finalLine,
      rules,
      mode: freeRoamMode,
      mixedPolicy,
      preserveOff: freeRoamMode === "off",
      preserveMinimalHeading: freeRoamMode === "minimal",
    });
    finalParsed = core.parseLine(finalLine, rules);
    finalLine = lineFinalize.normalizeSingleSeparatorLayout(finalLine, rules);
    finalParsed = core.parseLine(finalLine, rules);
    if (didDateOffsetDecrease) {
      const textOnly = String((finalParsed || {}).text || "").trim();
      const textHasDateMarkers = rulesHelpersForDates.hasDateLikeMarkerInText(textOnly);
      const textLooksLikeDate = looksLikeConfiguredDatePayload(textOnly, actionMarker, actionFormat);
      finalLine = lineFinalize.collapseEmptyLeftSeparatorToText({
        line: finalLine,
        parsedFinal: finalParsed,
        rules,
        shouldCollapse: () => !textHasDateMarkers && !textLooksLikeDate,
      });
      finalParsed = core.parseLine(finalLine, rules);
    }
    const cyclePost = lineFinalize.applyCycleEndAndInvariants({
      rawLine,
      finalLine,
      rules,
      mode: freeRoamMode,
      cycleEndBehavior,
      parsedLine: parsedWork,
      parseLine: core.parseLine,
      isBulletLikeEmptyResult: (line, parsedLine) => macroShared.isBulletLikeEmptyResult(line, parsedLine),
      isOrphanCheckboxBulletLine: (line) => macroShared.isOrphanCheckboxBulletLine(line),
      buildBulletOnlyLine: (p) => macroShared.buildBulletOnlyLine(p, { keepParsedPrefix: true, keepCheckbox: false }),
      shouldKeepBulletLine: (line) => /^\s*(?:[-*+]|\d+\.)\s*$/.test(String(line || "")),
    });
    finalLine = String(cyclePost?.finalLine ?? finalLine);
    finalParsed = core.parseLine(finalLine, rules);
    if (targetPanel === "right") {
      const linePipeline = globalThis.__inlineLinePipeline;
      if (!linePipeline || typeof linePipeline.normalizeRightPayloadTailToDates !== "function") {
        throw new Error("line_pipeline unavailable: normalizeRightPayloadTailToDates");
      }
      finalLine = linePipeline.normalizeRightPayloadTailToDates({ line: finalLine, rules });
      finalParsed = core.parseLine(finalLine, rules);
    }
    if (finalLine !== rawLine) {
      editor.replaceRange(finalLine, { line: lineNo, ch: 0 }, { line: lineNo, ch: rawLine.length });
    }
    if (cyclePost?.applyKeepBullet) {
      macroShared.applyKeepBullet(editor, lineNo, parsedWork, { keepParsedPrefix: true, keepCheckbox: false });
      return;
    }
    const nextCh = lineFinalize.resolveCursorByPolicy({
      finalLine,
      rules,
      cursorPolicy,
      originalLine: rawLine,
      originalCursorCh: cur.ch,
      bootstrapToTextEndWhenSourceEmpty: true,
      getCursorAtTextEnd: (line, runtimeRules) => macroShared.getCursorAtTextEnd(line, runtimeRules),
      remapCursorByLineDiff: (fromLine, toLine, ch) => {
        const oldBounds = macroShared.getTextSlotBounds(fromLine, rules);
        const newBounds = macroShared.getTextSlotBounds(toLine, rules);
        if (oldBounds && newBounds && ch >= oldBounds.start && ch <= oldBounds.end) {
          const rel = ch - oldBounds.start;
          const candidate = newBounds.start + rel;
          return Math.max(newBounds.start, Math.min(candidate, newBounds.end));
        }
        return remapCursorStable(fromLine, toLine, ch);
      },
    });
    setCursorIfChanged(editor, lineNo, nextCh);
  },
};
