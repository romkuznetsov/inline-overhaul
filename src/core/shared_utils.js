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
  /*
   * Двузначный год — свой токен, приводится после четырёхзначного (2026-09-20,
   * У-157, образец под З3): иначе `yy` писался буквами. `[Yy]{2}` — только без третьей `Y`
   * рядом, иначе `YYYY` разобрался бы на два двузначных года.
   */
  f = f.replace(/(?<![Yy])[Yy]{2}(?![Yy])/g, "YY");
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
  const tokenRe = /(YYYY|YY|MM|DD|HH|mm|ss)/g;
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
  return /(YYYY|YY|MM|DD|HH|mm|ss)/.test(normalizeFormatMask(String(format ?? "")));
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

/*
 * Формат из одних цифр — число: начало счёта и наименьшая ширина, а не маска
 * из стольких цифр (`В-268`, H2.1): `098` узнаёт `🔢7` и `🔢1000`. Прогресс
 * ниже начала — отрицательный.
 *
 * ponytail: признак «\d+» шире прежнего — у Element без знака он узнаёт любое
 * число строки; знак у Element заводит окно `Add a Field`, и без знака
 * счётчиков у него нет. Сузить, если такой появится.
 */
function isPlainNumberFormat(spec) {
  return !!spec && Array.isArray(spec.slots) && spec.slots.length > 0 && spec.slots.every(Boolean);
}

/**
 * Шаг счётчика, который стоит ниже начала своего формата-числа (`В-268`):
 * счёт идёт от числа на строке, а ниже нуля значение снимается. Ответ — новый
 * выбор (прогресс от начала) или пустая строка. Один дом на команду и панель.
 */
function stepBelowNumberStart(format, progress, up, step) {
  const spec = parseNumericPatternSpec(format);
  const base = spec ? spec.base : 0;
  const by = Math.max(1, Math.trunc(Number(step || 1)) || 1);
  const next = up ? progress + by : progress - by;
  return base + next < 0 ? "" : String(next);
}

function buildNumericPatternRegexSource(spec) {
  if (!spec || !Array.isArray(spec.slots)) return "";
  if (isPlainNumberFormat(spec)) return "\\d+";
  const chars = Array.from(String(spec.format || ""));
  let out = "";
  for (let i = 0; i < chars.length; i++) out += spec.slots[i] ? "\\d" : escapeRe(chars[i]);
  return out;
}

function renderNumericPatternValue(spec, progressRaw) {
  if (!spec) return "";
  /* Число пишется целиком и не уже формата: `🔢7` → `🔢007`, `🔢1000` остаётся
     четырьмя цифрами, а не `000` (`В-268`). */
  if (isPlainNumberFormat(spec)) {
    const v = Math.max(0, spec.base + (Math.trunc(Number(progressRaw || 0)) || 0));
    return String(v).padStart(spec.width, "0");
  }
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
  if (isPlainNumberFormat(spec)) return /^\d+$/.test(raw) ? Math.trunc(Number(raw)) - spec.base : null;
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

/**
 * Подстановка величин в уже приведённую маску. Маска, а не формат, нарочно:
 * у двух звавших разные ответы на пустой формат.
 */
function applyMaskToDate(mask, d) {
  const YYYY = String(d.getFullYear());
  /* Двузначный год — последние две цифры четырёхзначного: у 2100 — `00`, а не `21`. */
  const YY = YYYY.slice(-2);
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const DD = String(d.getDate()).padStart(2, "0");
  const HH = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return String(mask)
    .replace(/YYYY/g, YYYY)
    .replace(/YY/g, YY)
    .replace(/MM/g, MM)
    .replace(/DD/g, DD)
    .replace(/HH/g, HH)
    .replace(/mm/g, mm)
    .replace(/ss/g, ss);
}

/**
 * Дом правила «дата по формату поля» для произвольной даты (исключение № 136:
 * третьим объявлением был `fmtDateByFormat` в `tagwheel_core.js`). Пустой
 * формат здесь не подменяется умолчанием: у панели это «значения нет»;
 * умолчание — у `formatNowByMask`.
 */
function formatDateByMask(d, format) {
  return applyMaskToDate(
    normalizeFormatMask(String(format == null ? "YYYY-MM-DD" : format)), d);
}

function formatNowByMask(mask) {
  const m = normalizeFormatMask(String(mask ?? "YYYY-MM-DD")) || "YYYY-MM-DD";
  return applyMaskToDate(m, new Date());
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
  const elementPool = ELEMENT_VALUE_CHARS.split("");
  const pool = isRandomN ? digitsPool : elementPool;

  if (hasFormatTokens(fmt)) {
    if (isNow) return formatNowByMask(fmt);
    /* Образец приводится тем же `normalizeFormatMask`, что у `formatNowByMask`:
       иначе `hh` оставалось буквами (S7, 2026-09-09). */
    const mask = normalizeFormatMask(fmt) || fmt;
    return mask.replace(/YYYY|YY|MM|DD|HH|mm|ss/g, (tk) => {
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

/** Знаки значения команды `Random characters`; тот же набор нужен образцу поиска на строке (У-32). */
const ELEMENT_VALUE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#><-_";

/** Тот же набор классом знаков регулярного выражения. */
function elementValueCharClass() {
  return "[" + ELEMENT_VALUE_CHARS.replace(/[\\^\]-]/g, "\\$&") + "]";
}

/**
 * Образец значения эмодзи-элемента этого формата на строке. Пишет значение
 * `renderCommandValueByFormat`, ищет сканер `scanLineVisualTokens` — разбор
 * формата один (У-32, S7 2026-09-09: формат `111111` у `Random characters`).
 *
 * Ветки и их порядок — те же, что у записи: токены формата, буквы без
 * токенов, числовой образец, числовой литерал, длина формата. Чем заполнен
 * слот, решает команда, как у записи: цифра у `now`/`Random numbers`, знак
 * набора у `Random characters`; команды нет — цифра. Формата нет — образца
 * нет, «до пробела» решает спрашивающий.
 *
 * Расходится с третьим объявлением (`pkm_rules_runtime_helpers.js`, под З3)
 * только на `abcYYYY`-формах: там весь пробег букв — цифры. Пин `Т-14`
 * сверяет обе на семи формах, побайтово.
 */
function buildElementTailRegexSource(format, commandRaw) {
  const fmt = String(format || "").trim();
  if (!fmt) return "";
  const cmd = String(commandRaw || "now").trim().toLowerCase();
  const slot = cmd === "randome" ? elementValueCharClass() : "\\d";
  const times = (n) => slot + "{" + n + "}";

  if (hasFormatTokens(fmt)) {
    const mask = normalizeFormatMask(fmt);
    const tokenRe = /(YYYY|YY|MM|DD|HH|mm|ss)/g;
    /* Пробел — классом из одного знака, как в третьем объявлении: пин сверяет строки. */
    const between = (text) => String(text || "").split(" ").map(escapeRe).join("[ ]");
    let out = "";
    let last = 0;
    let hit;
    while ((hit = tokenRe.exec(mask)) !== null) {
      out += between(mask.slice(last, hit.index));
      out += times(hit[1] === "YYYY" ? 4 : 2);
      last = hit.index + hit[1].length;
    }
    out += between(mask.slice(last));
    return out;
  }

  /* Буквы без токенов: запись пишет столько знаков, сколько их в формате. */
  if (/[A-Za-z]/.test(fmt)) return times(Array.from(fmt).length);

  const pattern = parseNumericPatternSpec(fmt);
  if (pattern) {
    const chars = Array.from(String(pattern.format || ""));
    let out = "";
    for (let i = 0; i < chars.length; i++) out += pattern.slots[i] ? slot : escapeRe(chars[i]);
    return out;
  }

  const literal = parseNumericLiteralSpec(fmt);
  if (literal) return times(literal.width);

  return times(Math.max(1, Array.from(fmt).length));
}
/**
 * Общий вид даты со временем — запасной вопрос, когда формат поля значение не
 * узнал: формат сменили, строки остались прежними (10.13.71, Ч-5). Формат
 * спрашивается первым всегда. Знает ISO и `чч:мм`; `31.12.2026 21:32` не
 * узнает — шире нельзя, съел бы текст человека.
 */
const DATE_LIKE_VALUE_SRC =
  "\\d{4}-\\d{2}(?:-\\d{2})?(?:[ T]\\d{2}:\\d{2}(?::\\d{2})?)?"
  + "|\\d{2}:\\d{2}(?::\\d{2})?";

/**
 * Сколько знаков занимает значение с позиции `index`. Берётся самое длинное из
 * узнанного образцами, а не первое: первый бывает короче правильного.
 * Значение кончается пробелом или концом текста. Ноль — метка без значения
 * (наш токен); `null` — не наш токен, не трогать.
 */
function longestValueLengthAt(text, index, sources) {
  const src = String(text == null ? "" : text);
  const from = Number(index || 0);
  const list = Array.isArray(sources) ? sources : [];
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const one = String(list[i] == null ? "" : list[i]).trim();
    if (!one) continue;
    const rx = new RegExp("(?:" + one + ")(?=\\s|$)", "yu");
    rx.lastIndex = from;
    const hit = rx.exec(src);
    if (!hit) continue;
    const len = String(hit[0] || "").length;
    if (best === null || len > best) best = len;
  }
  return best;
}

/**
 * Образцы, которыми узнаётся значение метки; спрашиваются разом, выигрывает
 * самое длинное (`longestValueLengthAt`), порядок не решает.
 *
 * - образец формата поля — главный и точный;
 * - общий вид даты со временем — для значений прежнего формата;
 * - подряд идущие метки — метка без значения тоже наш токен;
 * - слово до пробела — последний ответ.
 */
function elementValueSources(ownValueRx, marker) {
  const own = String(ownValueRx == null ? "" : ownValueRx).trim();
  const mk = String(marker == null ? "" : marker);
  const out = [];
  if (own) out.push(own);
  out.push(DATE_LIKE_VALUE_SRC);
  if (mk) out.push("(?:" + escapeRe(mk) + ")*");
  out.push("[^\\s]+");
  return out;
}

/**
 * Снять из текста все токены метки с их значениями. Единственное объявление
 * «где кончается значение элемента» (10.13.71). Метка не с начала токена
 * (`abc📅2026-09-11`) не наша.
 */
function removeMarkerValueTokens(text, marker, sources) {
  const src = String(text == null ? "" : text);
  const mk = String(marker == null ? "" : marker);
  if (!mk) return src;
  let out = "";
  let i = 0;
  while (i < src.length) {
    const atTokenStart = i === 0 || /\s/.test(src[i - 1]);
    if (atTokenStart && src.startsWith(mk, i)) {
      const len = longestValueLengthAt(src, i + mk.length, sources);
      if (len !== null) {
        i += mk.length + len;
        continue;
      }
    }
    out += src[i];
    i += 1;
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Первый токен метки со значением целиком; конец значения — `longestValueLengthAt`,
 * как у уборки. Метка без значения токеном не считается.
 */
function firstMarkerValueToken(text, marker, sources) {
  const src = String(text == null ? "" : text);
  const mk = String(marker == null ? "" : marker);
  if (!mk) return "";
  for (let i = 0; i < src.length; i++) {
    if (!src.startsWith(mk, i)) continue;
    if (i !== 0 && !/\s/.test(src[i - 1])) continue;
    const valueLen = longestValueLengthAt(src, i + mk.length, sources);
    if (valueLen === null || valueLen === 0) continue;
    return src.slice(i, i + mk.length + valueLen);
  }
  return "";
}

/**
 * Знак и значение через пробел — то же значение (`В-243`, F9): узнавать обе
 * формы, писать слитно. Ответ — отрезки пробела между знаком Element и
 * значением, справа налево. Значение узнаётся строго — образцом формата и
 * общим видом даты, без «слова до пробела»: `📅 встреча` — текст. Знак не с
 * начала токена не наш.
 *
 * `marks` — `[{ marker, format }]` Fields типа `element`.
 */
function spacedMarkerValueGaps(text, marks) {
  const src = String(text == null ? "" : text);
  const out = [];
  for (const m of Array.isArray(marks) ? marks : []) {
    const mk = String(m && m.marker || "");
    if (!mk) continue;
    const fmt = String(m && m.format || "").trim() || "1";
    const own = hasFormatTokens(fmt) ? buildFormatValueRegexSource(fmt) : buildTokenlessValueRegexSource(fmt);
    const sources = [own, DATE_LIKE_VALUE_SRC].filter(Boolean);
    for (let at = src.indexOf(mk); at !== -1; at = src.indexOf(mk, at + mk.length)) {
      if (at !== 0 && !/\s/.test(src[at - 1])) continue;
      const gap = /^[ \t]+/.exec(src.slice(at + mk.length));
      if (!gap) continue;
      const from = at + mk.length;
      const len = longestValueLengthAt(src, from + gap[0].length, sources);
      if (!len) continue;
      if (!out.some((g) => g.from === from)) out.push({ from, to: from + gap[0].length });
    }
  }
  return out.sort((a, b) => b.from - a.from);
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

/**
 * Во сколько единиц смещения от опорной даты выражается значение. Одно
 * объявление на весь плагин (10.13.159). Календарное основание — доводом:
 * движок дат считает по Гринвичу, панель по часам машины; ответы совпадают,
 * сводить основание — смена поведения (У-196).
 *
 * `calendar` — три функции дороги: `reference(unit)`, `add(date, unit, delta)`
 * и `format(date, mask)`.
 */
function resolveOffsetByFormatValue(rawValue, format, maxDays, calendar) {
  const cal = calendar && typeof calendar === "object" ? calendar : {};
  if (typeof cal.reference !== "function" || typeof cal.add !== "function" || typeof cal.format !== "function") {
    throw new Error("shared_utils: resolveOffsetByFormatValue needs calendar {reference, add, format}");
  }
  const raw = String(rawValue || "").trim();
  const fmt = normalizeFormatMask(String(format == null ? "YYYY-MM-DD" : format));
  if (!raw || !fmt || !hasFormatTokens(fmt)) return null;
  const unit = detectDateUnit(fmt);
  const ref = cal.reference(unit);
  /* Негодная опора — ответ «не выражается», а не бросок (10.13.159). */
  if (!ref || typeof ref.getTime !== "function" || isNaN(ref.getTime())) return null;
  const limit = Math.max(0, Math.trunc(Number(maxDays || getSearchLimitByUnit(unit))));
  for (let d = 0; d <= limit; d++) {
    if (cal.format(cal.add(ref, unit, d), fmt) === raw) return d;
  }
  return null;
}

function detectDateUnit(format) {
  const f = normalizeFormatMask(String(format ?? ""));
  if (!hasFormatTokens(f)) return "tokenless";
  if (/ss/.test(f)) return "second";
  if (/mm/.test(f)) return "minute";
  if (/HH/.test(f)) return "hour";
  if (/(YYYY|YY)/.test(f) && !/(MM|DD)/.test(f)) return "year";
  if (/MM/.test(f) && !/DD/.test(f)) return "month";
  return "day";
}

/** Шаг даты на `delta` единиц формата; один дом движка и предпросмотра (Н-3 ревизии 2026-10-03). */
function addByUnit(base, unit, delta) {
  const dt = new Date(base.getTime());
  const d = Math.trunc(Number(delta || 0));
  if (unit === "second") dt.setSeconds(dt.getSeconds() + d);
  else if (unit === "minute") dt.setMinutes(dt.getMinutes() + d);
  else if (unit === "hour") dt.setHours(dt.getHours() + d);
  else if (unit === "month") dt.setMonth(dt.getMonth() + d);
  else if (unit === "year") dt.setFullYear(dt.getFullYear() + d);
  else dt.setDate(dt.getDate() + d);
  return dt;
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

/**
 * Значение по точечному пути. `undefined`, как только встретился не-объект:
 * на этом стоит различение «настройки нет» и «настройка пуста» (У-32).
 */
function readCfgPath(root, path) {
  let node = root;
  for (const key of String(path || "").split(".")) {
    if (!isObj(node)) return undefined;
    node = node[key];
  }
  return node;
}

/** Записать значение по точечному пути, создавая объекты по дороге. */
function writeCfgPath(root, path, value) {
  const parts = String(path || "").split(".");
  let node = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!isObj(node[parts[i]])) node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
  return root;
}

/*
 * Начало строки списка: отступ, цитата, маркер, номер, решётки заголовка.
 * Правило одно (У-32): знак чекбокса — любой один знак, как у Obsidian
 * (У-91, A34, У-88); чекбокс бывает и за номером; `1)` — тоже список.
 */
const CHECKBOX_ONE_CHAR_SRC = "\\[[^\\]]\\]";

/**
 * Знак заголовка — по Obsidian (У-91, `app.js` 1.13.7: `/^#{1,6} (.*)/m`): до
 * шести решёток, за ними пробел или конец строки; поэтому тег с решёток не
 * начинается. Спрашивают разбор строки (`line_pipeline.splitLeftPrefix`) и
 * слой оформления (`editor_visuals_config.scanLineVisualTokens`).
 */
const HEADING_PREFIX_SRC = "#{1,6}(?=[ \\t]|$)";
const HEADING_PREFIX_RE = new RegExp("^[ \\t]*" + HEADING_PREFIX_SRC);

/** Сколько знаков в начале строки занимает знак заголовка; ноль — его нет. */
function headingPrefixLength(text) {
  const m = String(nz(text, "")).match(HEADING_PREFIX_RE);
  return m ? m[0].length : 0;
}

const LINE_INDENT_RE = /^[ \t]*/;
const LINE_QUOTE_RE = /^>[ \t]?/;
/**
 * Знак списка — по Obsidian (У-91, `app.js` 1.13.7: `([*+-] |(\d+)([.)] ))`).
 * Читают через `lineStartOf` все: разбор, доводка, макро-прослойка,
 * перестановка по Order, слой оформления (10.13.106).
 */
const LIST_PREFIX_SRC = "(?:[-*+]|\\d+[.)])";

/**
 * Начало строки — одно объявление на весь плагин (У-150): что на строке
 * принадлежит платформе, а что человеку.
 *
 * Правила спрошены у Obsidian (У-91, `app.js` 1.13.7):
 *
 *   * знак списка — `([*+-] |(\d+)([.)] ))`;
 *   * задача — скобки ровно с одним знаком и только за знаком списка; `[ ] текст`
 *     без знака — текст (В-114);
 *   * заголовок — `#{1,6}` до пробела или конца строки;
 *   * цитата — `>` в начале, сколько угодно раз;
 *   * каллаут — `/^\[!([^\]]+)\]([+\-]?)(?:\s|$)/`, только внутри цитаты
 *     (`o.quote > h` в `app.js`); часть начала строки, действие его не разваливает (В-115).
 *
 * Порядок: отступ, цитата (сколько угодно), каллаут, затем либо заголовок,
 * либо знак списка с задачей. Пробел за знаком — ровно один: второй — уже
 * написанное (пустой слот у нас — два пробела). Возвращается разбор, а не длина.
 */
const LINE_CALLOUT_RE = /^\[![^\]]+\][+-]?(?:[ \t]+|$)/;
const LINE_ORDERED_ONLY_RE = /^\d+[.)]/;
const LINE_MARK_RE = new RegExp("^" + LIST_PREFIX_SRC + "(?:[ \\t]|$)");
const LINE_CHECKBOX_RE = new RegExp("^" + CHECKBOX_ONE_CHAR_SRC + "(?:[ \\t]|$)");
const LINE_HEADING_MARK_RE = new RegExp("^" + HEADING_PREFIX_SRC + "(?:[ \\t]|$)");

/* «Есть ли знак списка» — вопрос с одним домом, а не `!!lineStartOf(line).marker` у каждого. */
function hasListPrefix(text) {
  return !!lineStartOf(text).marker;
}

function lineStartOf(text) {
  const src = String(nz(text, ""));
  const take = (re, at) => {
    const m = src.slice(at).match(re);
    return m ? m[0] : "";
  };
  let at = 0;
  const indent = take(LINE_INDENT_RE, at);
  at += indent.length;
  let quote = "";
  for (;;) {
    const q = take(LINE_QUOTE_RE, at);
    if (!q) break;
    quote += q;
    at += q.length;
    const pad = take(LINE_INDENT_RE, at);
    quote += pad;
    at += pad.length;
  }
  const callout = quote ? take(LINE_CALLOUT_RE, at) : "";
  at += callout.length;
  const heading = take(LINE_HEADING_MARK_RE, at);
  at += heading.length;
  /* Заголовок и знак списка не сходятся: `## - текст` — заголовок с текстом `- текст`. */
  const marker = heading ? "" : take(LINE_MARK_RE, at);
  at += marker.length;
  /* Задача — только за знаком списка (В-114). */
  const checkbox = marker ? take(LINE_CHECKBOX_RE, at) : "";
  at += checkbox.length;
  return {
    indent,
    quote,
    callout,
    heading,
    marker,
    checkbox,
    prefix: src.slice(0, at),
    at,
    body: src.slice(at),
    /* Номерованный список нужен `Smart Enter`: он считает следующий номер. */
    ordered: !!marker && LINE_ORDERED_ONLY_RE.test(marker),
  };
}

/** Длина отступа: ведущие пробелы и табуляции. */
function lineIndentLength(text) {
  return String(nz(text, "")).match(LINE_INDENT_RE)[0].length;
}

/**
 * Сколько символов в начале строки занимает оформление: отступ и, если
 * просили, Prefix. Смещение, а не остаток: вызывающему нужен диапазон замены.
 * Цитата снимается сколько раз поставлена, маркер с чекбоксом — целым, номер
 * и решётки — по разу: `1. 2.` бывает текстом.
 */
function linePrefixLength(text, dropPrefix) {
  const src = String(nz(text, ""));
  let at = dropPrefix ? lineStartOf(src).at : lineIndentLength(src);
  /* Что бы ни сняли, пробелы за снятым тоже оформление. */
  at += lineIndentLength(src.slice(at));
  return at;
}

/*
 * Где кончается слово. Правило одно (У-32): читают навигация
 * (`navigation_runtime.js`) и ступень `word` у `Ctrl+A` (З-3). Слово —
 * латиница, кириллица, цифры, `_`; `foo-bar` — два слова, `foo_bar` одно.
 */
const SLASH_CHAR = String.fromCharCode(47);
const TAG_PREFIX_CHAR = String.fromCharCode(35);

function isWordChar(ch) {
  return /[0-9A-Za-zА-Яа-яЁё_]/.test(ch || "");
}

/**
 * Родительско-дочерний токен `#parent/child`; правило одно (У-150). Родитель
 * обязан быть токеном: косая черта сразу за приставкой (`#/1`) — значение, а
 * не пара (S12, иначе уборка выносила каждый тег).
 *
 * Отвечает `null`, если токен парой не является.
 */
function splitCombinedTagToken(tag) {
  const t = String(nz(tag, "")).trim();
  const i = t.indexOf(SLASH_CHAR);
  /* `i <= 1` — косая черта в начале токена или сразу за приставкой. */
  if (i <= 1) return null;
  const parent = t.slice(0, i);
  const child = t.slice(i + 1);
  if (!parent || !child) return null;
  if (parent.charAt(0) !== TAG_PREFIX_CHAR) return null;
  return { parent, child: child.charAt(0) === TAG_PREFIX_CHAR ? child : TAG_PREFIX_CHAR + child };
}

/**
 * Начало строки в том виде, в каком его повторяют на новой (`Smart Enter`,
 * 10.13.88); всё — у `lineStartOf` (У-32), сверка в `smart_enter_tests.js`.
 * Каллаут приписан к цитате, задача — к знаку списка: на новой строке цитата
 * повторяется, имя каллаута нет (второй `[!note]` подряд — не каллаут).
 * Заголовок не переносится.
 */
function lineMarkerOf(text) {
  const start = lineStartOf(text);
  return {
    indent: start.indent,
    quote: start.quote + start.callout,
    marker: start.marker + start.checkbox,
    ordered: start.ordered,
    at: start.indent.length + start.quote.length + start.callout.length
      + start.marker.length + start.checkbox.length,
  };
}

/*
 * Ссылка и тег: чем написаны — объявлено только здесь (Д3, У-150). Три разных
 * вопроса: «весь ли токен», «чем начинается», «что внутри скобок» — не
 * смешивать: `^#\S+` без якоря конца отвечает «да» и на `#work=text`.
 */
const WIKILINK_TOKEN_SRC = "\\[\\[[^\\]]+\\]\\]";
const TAG_TOKEN_SRC = TAG_PREFIX_CHAR + "\\S+";
const WIKILINK_TOKEN_RE = new RegExp("^" + WIKILINK_TOKEN_SRC + "$");
const WIKILINK_TARGET_RE = /^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/;
const TAG_TOKEN_RE = new RegExp("^" + TAG_TOKEN_SRC + "$");
const TAG_TOKEN_LEAD_RE = new RegExp("^" + TAG_TOKEN_SRC);

/**
 * Слова строки: пробел делит слова, кроме пробела внутри `[[…]]` (BUGHUNT R1):
 * значение ссылки бывает с пробелом (`Project A`). Незакрытая `[[` — не ссылка.
 */
const WORD_WITH_LINKS_RE = /(?:\[\[[^\]\n]*\]\]|\S)+/g;
function lineWords(text) {
  return String(nz(text, "")).match(WORD_WITH_LINKS_RE) || [];
}

/** Те же слова вместе с пробелами перед каждым: склейка даёт строку знак в знак. */
const WORD_WITH_SPACE_RE = new RegExp("\\s*" + WORD_WITH_LINKS_RE.source + "|\\s+", "g");
function lineWordsWithSpace(text) {
  return String(nz(text, "")).match(WORD_WITH_SPACE_RE) || [];
}

/**
 * Код и таблица — одно объявление (BUGHUNT R4). Ограда — три и больше `\``
 * или `~` в начале строки (отступ допускается), как у Obsidian; внутри блока —
 * нечётное число оград выше. Строка таблицы — начинается с `|`.
 */
const FENCE_LINE_RE = /^[ \t]*(?:`{3,}|~{3,})/;
function isFenceLine(text) {
  return FENCE_LINE_RE.test(String(nz(text, "")));
}
/** Строка `lineNo` лежит внутри блока кода (сама ограда — нет). */
/* ponytail: обход всех строк выше на каждый вопрос; дерево разбора Obsidian (`syntaxTree`), если заметка в десятки тысяч строк станет медленной. */
function isInsideFence(getLine, lineNo) {
  let depth = 0;
  for (let l = 0; l < lineNo; l++) if (isFenceLine(getLine(l))) depth++;
  return depth % 2 === 1;
}
/* `Editor.getLine` за концом отвечает `undefined`, `doc.line` CodeMirror бросает — оба «строки нет». */
function lineOrNull(getLine, n) {
  if (n < 0) return null;
  try { const t = getLine(n); return t === undefined || t === null ? null : String(t); } catch (_) { return null; /* проба: строки нет */ }
}
/** Горизонтальная линия: три и больше `-`, `*` или `_`, пробелы между ними допускаются. */
const RULE_LINE_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
/** Строка `lineNo` — frontmatter (свойства заметки) вместе с обеими чертами. */
/* ponytail: обход до закрывающей черты на каждый вопрос, как у `isInsideFence`. */
function isFrontmatterLine(getLine, lineNo) {
  if (!/^---[ \t]*$/.test(lineOrNull(getLine, 0) || "")) return false;
  for (let l = 1; ; l++) {
    const t = lineOrNull(getLine, l);
    if (t === null) return false;
    if (/^(---|\.\.\.)[ \t]*$/.test(t)) return lineNo <= l;
  }
}
/**
 * Строка таблицы: начинается с `|`, и второй ряд сплошного куска — разделитель
 * `|---|---|`: без него Obsidian таблицы не рисует, а `|| …` плагин пишет сам (BUGHUNT A3).
 */
const TABLE_ROW_RE = /^[ \t]*\|/;
const TABLE_DELIM_RE = /^[ \t]*\|?(?:[ \t]*:?-+:?[ \t]*\|)+(?:[ \t]*:?-+:?[ \t]*)?$/;
function isTableLine(getLine, lineNo) {
  if (!TABLE_ROW_RE.test(lineOrNull(getLine, lineNo) || "")) return false;
  let top = lineNo;
  while (TABLE_ROW_RE.test(lineOrNull(getLine, top - 1) || "")) top--;
  return TABLE_DELIM_RE.test(lineOrNull(getLine, top + 1) || "");
}
/**
 * Строку нельзя трогать как строку текста: ограда, код, таблица, frontmatter
 * или горизонтальная линия (BUGHUNT 2026-09-30, корень Q1).
 */
function isCodeOrTableLine(getLine, lineNo) {
  const text = String(nz(getLine(lineNo), ""));
  if (isFenceLine(text) || RULE_LINE_RE.test(text)) return true;
  if (isTableLine(getLine, lineNo) || isFrontmatterLine(getLine, lineNo)) return true;
  return isInsideFence(getLine, lineNo);
}

/* Ссылка Markdown `[текст](адрес)`: первая группа — текст (BUGHUNT T8). */
const MARKDOWN_LINK_SRC = "\\[([^\\]\\n]*)\\]\\(([^)\\n]*)\\)";

/** Весь токен целиком — ссылка вида `[[имя]]`. */
function isWikilinkToken(text) {
  return WIKILINK_TOKEN_RE.test(String(nz(text, "")).trim());
}

/**
 * Набранный в тексте тег — слово человека или Value, уезжающее в свой Block
 * (`В-235`, `В-249`); тумблер `Keep typed tags in text`
 * (`pkm.placement.typedTagsStayText`, у движков — `behavior.freeRoam`).
 */
function typedTagsStayText(rules) {
  const fr = rules && rules.behavior && rules.behavior.freeRoam;
  return !(fr && fr.typedTagsStayText === false);
}

/** Весь токен целиком — тег вида `#имя`. */
function isTagToken(text) {
  return TAG_TOKEN_RE.test(String(nz(text, "")).trim());
}

/** Токен начинается с тега — но чем он кончается, вопрос другой. */
function startsWithTagToken(text) {
  return TAG_TOKEN_LEAD_RE.test(String(nz(text, "")).trim());
}

/** Цель ссылки: `[[имя|подпись]]` → `имя`; подпись — не адрес. Не ссылка — пустая строка. */
function wikilinkTargetOf(text) {
  const m = String(nz(text, "")).trim().match(WIKILINK_TARGET_RE);
  return m ? String(m[1] || "").trim() : "";
}

/** Элемент нумерованного списка: отступ, номер, знак после него и пробел. */
const ORDERED_ITEM_RE = /^([ \t]*)(\d+)([.)])([ \t]+)/;

/**
 * Уровень вложенности строки списка — как у Obsidian (`oj` в `app.js` 1.13.7):
 * табуляция и каждые четыре пробела — ступень. Иначе её фильтр нумерации
 * разойдётся с нами.
 */
function listIndentLevel(indent) {
  let rest = String(nz(indent, ""));
  let level = 0;
  while (rest.startsWith("\t") || rest.startsWith("    ")) {
    rest = rest.startsWith("\t") ? rest.slice(1) : rest.slice(4);
    level += 1;
  }
  return level;
}

/**
 * Номера нумерованного списка в переписываемом окне строк. Фильтр Obsidian
 * считает номер первого элемента подсписка по старому документу (2026-09-20,
 * тест 4); верные номера он не трогает — подаём готовое. Номер — номер
 * ближайшего старшего соседа того же уровня плюс один, нет соседа — единица.
 * Граница: список, начатый не с единицы, при переносе первой строки начнётся с
 * единицы. Строки вне окна досчитает фильтр платформы.
 *
 * Возвращает новый массив строк; исходный не меняется.
 */
function renumberOrderedWindow(lines, from, to) {
  const src = Array.isArray(lines) ? lines.slice() : [];
  const first = Math.max(0, Number(from) || 0);
  const last = Math.min(src.length - 1, Number(to));
  for (let i = first; i <= last; i++) {
    const item = ORDERED_ITEM_RE.exec(String(nz(src[i], "")));
    if (!item) continue;
    const level = listIndentLevel(item[1]);
    let number = 1;
    for (let j = i - 1; j >= 0; j--) {
      const text = String(nz(src[j], ""));
      /* Пустая строка и заголовок кончают список: ниже начинается новый (цикл 121). */
      if (!text.trim() || /^#{1,6}\s/.test(text)) break;
      const prev = ORDERED_ITEM_RE.exec(text);
      const prevLevel = listIndentLevel(/^[ \t]*/.exec(text)[0]);
      if (prev && prevLevel === level) { number = Number(prev[2]) + 1; break; }
      /* Строка мельче уровнем — родитель: подсписок начинается за ним. */
      if (prevLevel < level) break;
      /* Глубже уровнем — чужие дети, они соседству не мешают. */
    }
    if (String(number) === item[2]) continue;
    src[i] = item[1] + number + item[3] + item[4] + String(src[i]).slice(item[0].length);
  }
  return src;
}

/**
 * Значение поля-ссылки в строке: `[[имя]]`. Одно объявление на панель и слой
 * оформления (2026-09-20, п. 14). В Values хранится голым именем; решётку
 * старой формы снимаем — приставка `#` у поля-ссылки не значение.
 */
function wikilinkVisualToken(value) {
  const bare = String(nz(value, "")).trim()
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/^#/, "")
    .trim();
  return wikilinkLineToken(bare);
}

/**
 * Ссылка на заметку, как её пишет плагин. Одно объявление на все сборщики
 * строки (2026-09-26): Value с папкой — `[[111/test-project|test-project]]`,
 * без папки — `[[test-project]]`. Подпись человека в Value не трогается.
 */
function wikilinkLineToken(target) {
  const t = String(nz(target, "")).trim();
  if (!t) return "";
  if (t.includes("|") || !t.includes("/")) return `[[${t}]]`;
  const name = t.replace(/^.*\//, "").trim();
  return name ? `[[${t}|${name}]]` : `[[${t}]]`;
}

/**
 * Что Obsidian покажет у ссылки: подпись после `|`, у Value с папкой — имя без
 * неё (`wikilinkLineToken`), иначе цель; не ссылка — пусто. Спрашивают скроллер
 * tagWheel и предпросмотр `Add a Field`.
 */
function wikilinkShownOf(text) {
  const t = String(nz(text, "")).trim();
  if (!wikilinkTargetOf(t)) return "";
  const written = wikilinkLineToken(t.slice(2, -2));
  const bar = written.indexOf("|");
  return written.slice(bar >= 0 ? bar + 1 : 2, -2).trim();
}

/** Формы Value-ссылки в строке: та, что пишет плагин, и голая `[[папка/имя]]`. Узнаются обе, пишется первая. */
function wikilinkLineForms(token) {
  const first = String(nz(token, "")).trim();
  const target = wikilinkTargetOf(first);
  const bare = target ? `[[${target}]]` : "";
  return bare && bare !== first ? [first, bare] : (first ? [first] : []);
}

/**
 * Склейка приставки поля со значением. Одно объявление на весь плагин
 * (10.13.147, `node tools/form_divergence.js`):
 *
 * - пусто на входе — пусто на выходе, приставка сама значением не становится;
 * - готовая ссылка `[[имя]]` проходит насквозь: приставка — марка тега;
 * - приставка уже стоит в начале значения — не удваивать (`##todo`);
 * - приставки нет, значение начинается с `/` — ставится решётка (`/1`).
 *
 * Нарочно нет пропуска любого готового тега: при приставке `@` значение
 * `#todo` получает приставку.
 */
function composeToken(prefix, rawToken) {
  const p = typeof prefix === "string" ? prefix : TAG_PREFIX_CHAR;
  const t = String(nz(rawToken, "")).trim();
  if (!t) return "";
  if (isWikilinkToken(t)) return t;
  if (p && t.startsWith(p)) return t;
  if (!p && /^\/\S+/.test(t)) return `${TAG_PREFIX_CHAR}${t}`;
  return `${p}${t}`;
}

/**
 * След о запасном ходе загрузки — только при `__inlineDebugLoaders`. Сам молчит
 * при сбое: отчёт об отказе отчётчика девать некуда, а ронять загрузку из-за
 * следа нельзя (В-97, 10.13.150).
 */
function reportLoaderFallback(stage, err) {
  try {
    if (globalThis.__inlineDebugLoaders !== true) return;
    const msg = err && err.message ? String(err.message) : String(err || "");
    console.warn(`[inline-overhaul][loader] ${stage}: ${msg}`);
  } catch (_) {
    /* Молчание — предмет объяснения выше, а не недосмотр. */
  }
}

/**
 * Нормализация ключа Order. Одно объявление на весь плагин (10.13.146):
 * нормализатор передаётся через пять слоёв и кладётся на шов `globalThis` в
 * `pkm_runtime_bootstrap.js` — с копиями поведение зависело бы от порядка загрузки.
 */
function normalizeOrderKey(key) {
  return String(key || "").trim();
}

/**
 * Снять скобки с того, что целиком ссылка; остальное отдать как есть.
 * Не путать с `wikilinkTargetOf`:
 *
 *   вход            `wikilinkTargetOf`   `unwrapWikilinkToken`
 *   `[[a]]`         `a`                  `a`
 *   `[[a|подпись]]` `a`                  `a|подпись`
 *   `имя`           `` (пусто)           `имя`
 *
 * Ответ заворачивают обратно — подпись терять нельзя (У-150).
 */
function unwrapWikilinkToken(raw) {
  /* `|| ""`, а не `nz`, нарочно: тело панели побайтно; `nz` бережёт ноль, `||` — нет. */
  const src = String(raw || "").trim();
  if (!src) return "";
  const m = src.match(/^\[\[([^\]]+)\]\]$/);
  return m ? String(m[1] || "").trim() : src;
}

/** Обход тегов в тексте. Новое выражение на вызов: `lastIndex` глобального живёт между вызовами. */
function tagTokenScanner() {
  return new RegExp(TAG_TOKEN_SRC, "g");
}

/**
 * Разделители зон строки (Д2). Имя звавшего — аргументом, для журнала. Нет
 * разделителя — отказ вслух, а не умолчание: строка без них не разбирается.
 */
function resolveSeparatorsOrThrow(rules, who) {
  const io = rules && typeof rules.io === "object" && !Array.isArray(rules.io) ? rules.io : null;
  const sep1 = io && io.separator1 != null ? String(io.separator1).trim() : "";
  const sep2 = io && io.separator2 != null ? String(io.separator2).trim() : "";
  if (!sep1 || !sep2) {
    throw new Error(String(nz(who, "rules")) + ": rules.io.separator1 and rules.io.separator2 are required");
  }
  return { sep1, sep2 };
}

/**
 * Умолчание разделителей — один дом на рантайм (У-186, У-32); `"||"` у места
 * вызова — второе объявление. Второй дом — схема панели (`separator-1`,
 * `separator-2` в `schema/pkm.ts`, из прототипа, Р8); расхождение умолчаний
 * схемы и движка — вопрос заказчика (В-7).
 */
const DEFAULT_SEPARATORS = { separator1: "||", separator2: "||" };

/**
 * «Любой из двух разделителей» — образцом из настроек, не литералом `||`
 * (У-186). Экранирование — `escapeRe`: разделитель бывает `|`, `.` или `*`.
 * Одинаковые не удваиваются.
 */
function separatorAltSrc(rules, who) {
  const sep = resolveSeparatorsOrThrow(rules, who);
  const parts = sep.sep1 === sep.sep2 ? [sep.sep1] : [sep.sep1, sep.sep2];
  return "(?:" + parts.map(escapeRe).join("|") + ")";
}

/** Первый (левее) из двух разделителей; `indexOf` одного верен, только если они равны (У-147). */
function firstSeparatorIndex(text, rules, who) {
  const s = String(text || "");
  const sep = resolveSeparatorsOrThrow(rules, who);
  const list = sep.sep1 === sep.sep2 ? [sep.sep1] : [sep.sep1, sep.sep2];
  let best = -1;
  for (const one of list) {
    const at = s.indexOf(one);
    if (at !== -1 && (best === -1 || at < best)) best = at;
  }
  return best;
}

/** Пара суррогатов UTF-16: шаг по кодовым единицам рвал бы символ пополам. */
function isHighSurrogate(code) {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code) {
  return code >= 0xdc00 && code <= 0xdfff;
}

/** Строка списка: маркер или номер. Заголовок и цитата списком не считаются. */
function isListItemLine(text) {
  return !!lineStartOf(text).marker;
}

/**
 * Пара скобок в начале строки — не задача (В-114), но начало, написанное
 * человеком: доводка возвращает его после перестановки. Имя — о форме, не о
 * смысле (У-103).
 */
function startsWithBracketPair(text) {
  const src = String(nz(text, ""));
  const body = src.slice(lineIndentLength(src));
  return new RegExp("^" + CHECKBOX_ONE_CHAR_SRC + "(?:[ \\t]|$)").test(body);
}

/**
 * Чем строка начата — куском, который можно приписать обратно. Одно
 * объявление на обе дороги (Д2): доводку и макро-прослойку.
 */
function lineStartPrefixOf(text) {
  const src = String(nz(text, ""));
  const start = lineStartOf(src);
  if (start.marker) return src.slice(0, start.at).replace(/[ \t]+$/, "");
  const head = start.indent + start.quote + start.callout;
  const rest = src.slice(head.length);
  const m = rest.match(new RegExp("^" + CHECKBOX_ONE_CHAR_SRC + "(?:[ \\t]+|$)"));
  if (m) return (head + m[0]).replace(/[ \t]+$/, "");
  return "";
}

/** Та же строка без своего начала: отступа, цитаты, знака списка и задачи. */
function stripLineStart(text) {
  const src = String(nz(text, ""));
  const start = lineStartOf(src);
  const head = start.indent + start.quote + start.callout;
  const rest = src.slice(head.length);
  if (start.marker) return rest.slice(start.marker.length + start.checkbox.length);
  const m = rest.match(new RegExp("^" + CHECKBOX_ONE_CHAR_SRC + "(?:[ \\t]+|$)"));
  return m ? rest.slice(m[0].length) : rest;
}

/** Начало исходной строки, приписанное к телу новой. */
function reapplyLineStart(rawLine, nextLine) {
  const prefix = lineStartPrefixOf(rawLine);
  if (!prefix) return String(nz(nextLine, ""));
  const body = stripLineStart(nextLine).trim();
  return body ? prefix + " " + body : prefix;
}

/**
 * Форма начала исходной строки переживает действие: было начало — оно
 * возвращается; не было — снимается приписанное плагином, а отступ, цитата и
 * каллаут человека остаются (У-184, BUGHUNT E1).
 */
function preserveLineStartShape(rawLine, nextLine) {
  const raw = String(nz(rawLine, ""));
  if (isListItemLine(raw) || startsWithBracketPair(raw)) return reapplyLineStart(raw, nextLine);
  const start = lineStartOf(raw);
  return start.indent + start.quote + start.callout + stripLineStart(nextLine).trimStart();
}

module.exports = {
  cloneJson,
  readCfgPath,
  writeCfgPath,
  nz,
  escapeRe,
  CHECKBOX_ONE_CHAR_SRC,
  LIST_PREFIX_SRC,
  HEADING_PREFIX_SRC,
  headingPrefixLength,
  lineStartOf,
  hasListPrefix,
  lineIndentLength,
  linePrefixLength,
  lineMarkerOf,
  isHighSurrogate,
  isLowSurrogate,
  isListItemLine,
  resolveSeparatorsOrThrow,
  DEFAULT_SEPARATORS,
  separatorAltSrc,
  firstSeparatorIndex,
  WIKILINK_TOKEN_SRC,
  TAG_TOKEN_SRC,
  isWikilinkToken,
  typedTagsStayText,
  isTagToken,
  startsWithTagToken,
  wikilinkTargetOf,
  wikilinkVisualToken,
  wikilinkLineToken,
  wikilinkShownOf,
  wikilinkLineForms,
  lineWords,
  MARKDOWN_LINK_SRC,
  isFenceLine,
  isInsideFence,
  isCodeOrTableLine,
  isTableLine,
  lineWordsWithSpace,
  listIndentLevel,
  renumberOrderedWindow,
  unwrapWikilinkToken,
  composeToken,
  normalizeOrderKey,
  reportLoaderFallback,
  tagTokenScanner,
  startsWithBracketPair,
  lineStartPrefixOf,
  stripLineStart,
  reapplyLineStart,
  preserveLineStartShape,
  isWordChar,
  splitCombinedTagToken,
  normalizeFormatMask,
  buildFormatValueRegexSource,
  hasFormatTokens,
  parseNumericLiteralSpec,
  parseNumericPatternSpec,
  buildNumericPatternRegexSource,
  renderNumericPatternValue,
  parseNumericPatternProgress,
  stepBelowNumberStart,
  renderTokenlessValueByProgress,
  buildTokenlessValueRegexSource,
  parseTokenlessProgress,
  parseHhmm,
  addMinutesHhmm,
  formatNowByMask,
  formatDateByMask,
  renderCommandValueByFormat,
  buildElementTailRegexSource,
  DATE_LIKE_VALUE_SRC,
  longestValueLengthAt,
  elementValueSources,
  removeMarkerValueTokens,
  firstMarkerValueToken,
  spacedMarkerValueGaps,
  ELEMENT_VALUE_CHARS,
  shouldHydrateGenericElementRaw,
  buildCustomPlanFromIncrement,
  forwardStepByCurrent,
  backwardStepByCurrent,
  getSearchLimitByUnit,
  detectDateUnit,
  addByUnit,
  resolveOffsetByFormatValue,
  isObj,
  deepMerge,
};
