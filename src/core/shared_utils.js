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
  const elementPool = ELEMENT_VALUE_CHARS.split("");
  const pool = isRandomN ? digitsPool : elementPool;

  if (hasFormatTokens(fmt)) {
    if (isNow) return formatNowByMask(fmt);
    /*
     * Образец приводится к одному написанию — тем же `normalizeFormatMask`,
     * которым его приводит `formatNowByMask`. Прежде здесь стоял **сырой**
     * формат, а решение «есть ли в нём токены» принималось по приведённому: у
     * `YYYY-MM-DD hh:mm` строчное `hh` токеном не считалось и оставалось в
     * значении буквами — `3859-84-26 hh:77`. Найдено сверкой записи с
     * образцом, которым это значение потом ищут на строке (S7, 2026-09-09).
     */
    const mask = normalizeFormatMask(fmt) || fmt;
    return mask.replace(/YYYY|MM|DD|HH|mm|ss/g, (tk) => {
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

/**
 * Знаки, из которых команда `Random characters` набирает значение элемента.
 *
 * Объявлено здесь, а не литералом внутри записи: тот же набор нужен образцу,
 * которым это значение потом ищут на строке, и две копии набора разошлись бы
 * молча (У-32).
 */
const ELEMENT_VALUE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#><-_";

/** Тот же набор классом знаков регулярного выражения. */
function elementValueCharClass() {
  return "[" + ELEMENT_VALUE_CHARS.replace(/[\\^\]-]/g, "\\$&") + "]";
}

/**
 * Как выглядит на строке значение эмодзи-элемента этого формата — образцом.
 *
 * **Зачем это здесь, рядом с записью значения.** Значение элемента пишет
 * `renderCommandValueByFormat`, а ищет его на строке сканер оформления
 * (`scanLineVisualTokens`): ему надо знать, где токен кончается. Это один
 * вопрос, заданный с двух сторон, и разбор формата у него обязан быть один
 * (У-32).
 *
 * **Что было.** У сканера был свой разбор — «подряд идущие буквы образца
 * становятся столькими же цифрами», — и он разошёлся с записью на первом же
 * формате без букв: у поля с командой `Random characters` формат `111111`,
 * разбор сканера давал литерал `111111`, а движок пишет туда шесть случайных
 * знаков. Токен вида «🤣XIInR_» сканер не находил вовсе — и элемент не
 * получал ни прозрачности блока, ни размера текста, ни подложки (замечание
 * заказчика по S7, 2026-09-09: «в right block с только одним value из
 * field=emoji Random полоска вообще не нарисовалась»).
 *
 * **Ветки и их порядок — те же, что у записи**, и это не совпадение: разойдись
 * порядок, и образец описывал бы не то значение, которое пишется. Токены
 * формата, потом формат с буквами без токенов, потом числовой образец,
 * числовой литерал и длина формата в знаках.
 *
 * **Чем заполнен слот, решает команда** — тем же выбором, каким его заполняет
 * запись: цифрой у `now` и `Random numbers`, знаком из набора у `Random
 * characters`. Команды нет — цифра: так стоит у поля-даты, и так это правило
 * читалось раньше.
 *
 * Формата нет — образца нет, и это ответ, а не пустота: правило «до пробела»
 * остаётся у того, кто спрашивает.
 *
 * **Где он расходится с третьим объявлением того же правила** (`pkm_rules_
 * runtime_helpers.js`, оно под З3 и его читают движки): на форматах, где буквы
 * стоят и в токене, и рядом с ним (`abcYYYY`). Там третье объявление считает
 * цифрами весь пробег букв, а запись оставляет `abc` собой — то есть право
 * здесь это, выведенное из записи. Разойтись им на форматах, которые человек
 * пишет, не на чем: пин `Т-14` сверяет обе функции на семи формах, и все семь
 * совпадают побайтово. Тронуть тот файл ради `abcYYYY` дороже, чем оставить
 * его: движки режут блок по пробелам, а значение без пробела им и так достаётся
 * целиком.
 */
function buildElementTailRegexSource(format, commandRaw) {
  const fmt = String(format || "").trim();
  if (!fmt) return "";
  const cmd = String(commandRaw || "now").trim().toLowerCase();
  const slot = cmd === "randome" ? elementValueCharClass() : "\\d";
  const times = (n) => slot + "{" + n + "}";

  if (hasFormatTokens(fmt)) {
    const mask = normalizeFormatMask(fmt);
    const tokenRe = /(YYYY|MM|DD|HH|mm|ss)/g;
    /* Пробел записывается классом из одного знака — так же, как в третьем
       объявлении: пин сверяет строки, а не поведение выражений. */
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

  /* Буквы без токенов: запись идёт общей ветвью и пишет столько знаков, сколько
     их в формате. */
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
 * Общий вид значения даты со временем — на случай, когда нынешний формат
 * поля значение не узнал.
 *
 * **Зачем он нужен.** Значение ищут на строке, чтобы убрать старое и
 * поставить новое. Образец для поиска выводится из формата поля
 * (`buildElementTailRegexSource`), и пока формат не менялся, этого хватает.
 * Но человек формат меняет, а строки остаются написанными прежним: при
 * формате `YYYY-MM-DD` строка держит `📅2026-09-11 21:32`, образец узнаёт
 * только первое слово, и хвост `21:32` остаётся в строке навсегда
 * (PRD 10.13.71, Ч-5).
 *
 * **Чем он НЕ является.** Это не второе объявление формата: формат
 * спрашивается первым и всегда. Это запасной вопрос «а не выглядит ли
 * оставшееся датой» — и задаётся он только там, где мы и так убираем токен
 * своей метки.
 *
 * **Его слабость названа здесь же:** он знает даты в форме ISO и время
 * `чч:мм`. Значение прежнего формата вида `31.12.2026 21:32` он не узнает, и
 * хвост от него останется. Шире делать нечего: «что угодно до конца блока»
 * съело бы текст человека.
 */
const DATE_LIKE_VALUE_SRC =
  "\\d{4}-\\d{2}(?:-\\d{2})?(?:[ T]\\d{2}:\\d{2}(?::\\d{2})?)?"
  + "|\\d{2}:\\d{2}(?::\\d{2})?";

/**
 * Сколько знаков занимает значение, стоящее в тексте с позиции `index`.
 *
 * Берётся **самое длинное** из того, что узнают поданные образцы, а не
 * первое совпавшее. Это не придирка: у одного значения образцов несколько —
 * формат поля, общий вид даты, «слово до пробела», — и первый по списку
 * бывает короче правильного. `📅2026-09-11 21:32` при формате `YYYY-MM-DD`
 * образцом формата покрывается наполовину, и ровно эта половина оставляла
 * хвост в строке заказчика.
 *
 * Значение обязано кончаться границей токена — пробелом или концом текста.
 * Ноль — законный ответ: метка без значения (`📅` на строке) это тоже наш
 * токен. Если не подошёл ни один образец, ответ `null`, и это значит «это не
 * наш токен, не трогайте его».
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
 * Образцы, которыми на строке узнаётся значение этой метки.
 *
 * Список, а не один образец, и спрашиваются они разом — выигрывает тот, кто
 * узнал больше (`longestValueLengthAt`). Порядок здесь ничего не решает.
 *
 * - образец формата поля — главный и точный;
 * - общий вид даты со временем — для значений прежнего формата;
 * - подряд идущие метки — метка без значения тоже наш токен;
 * - слово до пробела — последний ответ, им жили все прежние объявления.
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
 * Снять из текста все токены этой метки вместе с их значениями.
 *
 * **Это единственное объявление правила** «где кончается значение элемента».
 * Прежде их было несколько: уборка блока в правилах рантайма резала по
 * первому пробелу, уборка меток в тексте — по рукописному образцу даты, у
 * TagWheel стояла своя догадка. Значение формата `YYYY-MM-DD hh:mm` занимает
 * два слова и ни в одно из них не помещалось (PRD 10.13.71).
 *
 * Метка, стоящая не с начала токена (`abc📅2026-09-11`), не наша и не
 * трогается.
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
 * Первый на строке токен этой метки — вместе со значением целиком.
 *
 * Тот же вопрос, что у уборки, и потому тот же ответ: где кончается
 * значение, решает `longestValueLengthAt`. Прежде эти два вопроса задавались
 * порознь — уборка резала по образцу формата, а взятие токена собирало своё
 * выражение из метки и образца, — и на пустом образце оно возвращало **одну
 * метку**: элемент переезжал без значения.
 *
 * Метка без значения токеном не считается: брать нечего.
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

/**
 * Прочитать значение по точечному пути.
 *
 * Отдаёт `undefined`, как только по дороге встретился не-объект: на этом стоит
 * различение «настройки нет» и «настройка пуста», и менять его нельзя.
 *
 * Жило в `main.js`; переехало сюда 2026-09-07, когда слой оформления редактора
 * стал отдельным модулем и звать этот путь понадобилось с двух сторон (У-32).
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
 *
 * **Правило одно и живёт здесь.** До 2026-09-08 те же формы были объявлены
 * дважды — в `smart_delete_engine.js` и в `enhanced_select_all_engine.js`, — и
 * два объявления одного правила успели разойтись трижды (У-32):
 *   1. знак чекбокса был сужен до `[ ]`, `[x]`, `[X]`, а Obsidian считает
 *      задачей **любой один знак** (У-91, дефект A34) — из-за этого `Del` на
 *      строке `- [I] текст` оставлял `[I]` в тексте человека;
 *   2. у номера списка чекбокса не было вовсе: `1. [ ] текст` тоже оставлял
 *      `[ ]`;
 *   3. номер списка со скобкой (`1) текст`) один движок считал списком, а
 *      другой нет.
 *
 * Сторож A34 этого не поймал и был прав по-своему: он запрещает написание
 * **шире** одного знака, а здесь оно было уже (У-88 — у запрета не было
 * положительного контроля на этот случай).
 */
const CHECKBOX_ONE_CHAR_SRC = "\\[[^\\]]\\]";

/**
 * Знак заголовка — разметка Obsidian, и правило спрошено у него, а не выдумано
 * (У-91). В `app.js` 1.13.7 заголовок это `/^(#+)(?: |$)/`, а режется он
 * `/^#{1,6} (.*)/m`: решёток не больше шести, и за ними обязан стоять пробел
 * или конец строки. Отсюда и главное следствие — **тег с решёток начаться не
 * может**, потому что за ними стоит пробел.
 *
 * Объявлено здесь, потому что спрашивают его двое и по разным поводам: разбор
 * строки (`line_pipeline.splitLeftPrefix`) и слой оформления заметки
 * (`editor_visuals_config.scanLineVisualTokens`). Пока правило знал только
 * разбор, `##` получал на экране пузырь тега — заказчик прислал это скриншотом
 * 2026-09-13, тем же днём, что и починку разбора.
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
 * Знак списка — разметка Obsidian, и форма у него одна на весь плагин.
 *
 * Правило спрошено у платформы (У-91): в `app.js` 1.13.7 начало строки списка
 * это `([*+-] |(\d+)([.)] ))` — дефис, звёздочка, плюс или число с точкой либо
 * скобкой. Объявлено здесь, потому что спрашивает его `lineStartOf` ниже — а
 * через него и все остальные: разбор строки, доводка, макро-прослойка,
 * перестановка значений по Order и слой оформления.
 *
 * **Копия у перестановки знала один дефис**, и знак человека уезжал в зону
 * значений: `* текст` после шага по элементу давала `- 📅… * || текст`
 * (10.13.106). Копия у разбора знала точку и не знала скобки.
 */
const LIST_PREFIX_SRC = "(?:[-*+]|\\d+[.)])";

/**
 * **Начало строки — одно объявление на весь плагин.**
 *
 * Вопрос его, и задан он трижды за две недели: что на строке принадлежит
 * платформе, а что человеку. Ответов на него было пять — здесь, в разборе
 * строки, в доводке, в макро-прослойке и в слое оформления, — и расходились
 * они молча (У-150). Теперь ответ один, а остальные его читают.
 *
 * **Правила спрошены у Obsidian, а не выдуманы** (У-91). В `app.js` 1.13.7:
 *
 *   * знак списка — `([*+-] |(\d+)([.)] ))`;
 *   * задача — скобки **ровно с одним знаком** и **за знаком списка**. Скобки
 *     без знака списка задачей не являются: `[ ] текст` Obsidian рисует как
 *     обычный текст, и это ответ заказчика на В-114 — «как в Obsidian: это ваш
 *     текст»;
 *   * заголовок — `#{1,6}` до пробела или конца строки;
 *   * цитата — `>` в начале, столько раз, сколько её поставили;
 *   * каллаут — `/^\[!([^\]]+)\]([+\-]?)(?:\s|$)/`, и только внутри цитаты
 *     (в `app.js` образец спрашивается под условием `o.quote > h`). Он часть
 *     начала строки: наше значение, вставленное между `>` и `[!note]`, каллаут
 *     разваливает — а заказчик просил, чтобы каллаут действие пережил (В-115).
 *
 * Порядок частей задан платформой: отступ, цитата (сколько угодно раз),
 * каллаут, затем **либо** заголовок, **либо** знак списка с задачей за ним.
 *
 * **Пробел за знаком берётся ровно один**, и это тоже правило платформы: в её
 * образцах он один. Второй пробел принадлежит уже написанному — пустой слот
 * под текст у нас и есть два пробела, и жадный захват его съедал.
 *
 * Возвращается разбор, а не длина: длина нужна одним читателям, куски —
 * другим, и второе объявление ради кусков было бы тем же грехом.
 */
const LINE_CALLOUT_RE = /^\[![^\]]+\][+-]?(?:[ \t]+|$)/;
const LINE_ORDERED_ONLY_RE = /^\d+[.)]/;
const LINE_MARK_RE = new RegExp("^" + LIST_PREFIX_SRC + "(?:[ \\t]|$)");
const LINE_CHECKBOX_RE = new RegExp("^" + CHECKBOX_ONE_CHAR_SRC + "(?:[ \\t]|$)");
const LINE_HEADING_MARK_RE = new RegExp("^" + HEADING_PREFIX_SRC + "(?:[ \\t]|$)");

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
  /* Заголовок и знак списка на одной строке не сходятся: `## - текст` для
     Obsidian заголовок с текстом `- текст`. */
  const marker = heading ? "" : take(LINE_MARK_RE, at);
  at += marker.length;
  /* Задача — только за знаком списка. Это и есть ответ на В-114. */
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
 * просили, Prefix. Возвращается смещение, а не остаток строки: вызывающему
 * нужен диапазон для замены, а не копия текста.
 *
 * Цитата снимается столько раз, сколько её поставили (`> > текст`), маркер
 * списка и чекбокс — как одно целое, номер и решётки заголовка по одному разу:
 * `1. 2.` в начале строки бывает текстом, а не двумя номерами.
 */
function linePrefixLength(text, dropPrefix) {
  const src = String(nz(text, ""));
  let at = dropPrefix ? lineStartOf(src).at : lineIndentLength(src);
  /* Что бы ни сняли, пробелы за снятым тоже оформление. */
  at += lineIndentLength(src.slice(at));
  return at;
}

/*
 * Где кончается слово.
 *
 * **Правило одно и живёт здесь.** Объявлено оно было в
 * `navigation_runtime.js` — перенос выделенного текста спрашивает у него, куда
 * можно шагнуть, — а 2026-09-08 то же самое понадобилось ступени `word`
 * расширенного `Ctrl+A` (З-3). Второе объявление разошлось бы с первым молча
 * (У-32): у соседнего правила, форм начала строки, две копии успели разойтись
 * трижды. Поэтому движок навигации читает его отсюда, а движок `Ctrl+A` —
 * тоже отсюда, и обоим оно одно.
 *
 * Буквы латиницы и кириллицы, цифры и подчёркивание. Знак препинания, дефис и
 * пробел словом не считаются, поэтому `foo-bar` — два слова, а `foo_bar` одно.
 */
const SLASH_CHAR = String.fromCharCode(47);
const TAG_PREFIX_CHAR = String.fromCharCode(35);

function isWordChar(ch) {
  return /[0-9A-Za-zА-Яа-яЁё_]/.test(ch || "");
}

/**
 * Родительско-дочерний токен: `#parent/child`.
 *
 * **Правило одно и живёт здесь.** Объявлено оно было трижды — разбором панели
 * (`tagwheel_core`), гидратацией строки (`status_line_runtime_unified`) и
 * переносом значения по Block (`line_pipeline`), — и третье объявление было
 * наивнее двух первых: родительско-дочерним оно считало **любой** токен, в
 * котором есть косая черта (У-150).
 *
 * Чем это стоило заказчику: значения его Field важности записаны `#/1`,
 * `#/2` — решётка, а сразу за ней косая черта. Родителем получалась одна
 * решётка, и уборка «снять из строки всё, что начинается с родителя»
 * выносила **каждый** тег: применение панели стирало соседние значения
 * (замечание `S12` 2026-09-12).
 *
 * Поэтому родитель обязан быть токеном, а не одним знаком приставки: косая
 * черта сразу за приставкой означает, что это **значение**, а не пара
 * «родитель и ребёнок».
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
 * Начало строки в том виде, в каком его повторяют на новой строке.
 *
 * **Своего правила здесь нет ни одного** — всё берётся у `lineStartOf` (У-32):
 * одному читателю нужна длина, другому куски, чтобы повторить знак на новой
 * строке (`Smart Enter`, 10.13.88). Что оба сходятся, спрашивает проверка в
 * `smart_enter_tests.js`.
 *
 * Каллаут приписан к цитате, а задача к знаку списка: на новой строке цитата
 * повторяется, а имя каллаута нет — второй `[!note]` подряд Obsidian каллаутом
 * уже не считает. Заголовок знаком списка не считается: `##` на новую строку не
 * переносится ни в Obsidian, ни здесь.
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
 * **Ссылка и тег: чем они написаны — объявлено здесь, и только здесь.**
 *
 * До 2026-09-14 общего дома не было ни у того, ни у другого: форма ссылки
 * стояла рукописной в девятнадцати местах восьми файлов, форма тега — в
 * восьми местах пяти (Д3 ревизии). Расхождений между ними не нашлось ни
 * одного, и это не оправдание, а отсрочка: у знака списка копии тоже сперва
 * совпадали, а потом разошлись трижды и стоили заказчику текста (У-150).
 *
 * Вопросов здесь три, и они разные: «весь ли токен — ссылка», «чем он
 * начинается» и «что внутри скобок». Смешивать их нельзя — на этом уже
 * обожглись: `^#\S+` без якоря конца отвечает «да» и на `#work=text`.
 */
const WIKILINK_TOKEN_SRC = "\\[\\[[^\\]]+\\]\\]";
const TAG_TOKEN_SRC = TAG_PREFIX_CHAR + "\\S+";
const WIKILINK_TOKEN_RE = new RegExp("^" + WIKILINK_TOKEN_SRC + "$");
const WIKILINK_TARGET_RE = /^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/;
const TAG_TOKEN_RE = new RegExp("^" + TAG_TOKEN_SRC + "$");
const TAG_TOKEN_LEAD_RE = new RegExp("^" + TAG_TOKEN_SRC);

/** Весь токен целиком — ссылка вида `[[имя]]`. */
function isWikilinkToken(text) {
  return WIKILINK_TOKEN_RE.test(String(nz(text, "")).trim());
}

/** Весь токен целиком — тег вида `#имя`. */
function isTagToken(text) {
  return TAG_TOKEN_RE.test(String(nz(text, "")).trim());
}

/** Токен начинается с тега — но чем он кончается, вопрос другой. */
function startsWithTagToken(text) {
  return TAG_TOKEN_LEAD_RE.test(String(nz(text, "")).trim());
}

/**
 * Цель ссылки: `[[имя|подпись]]` → `имя`. Не ссылка — пустая строка.
 *
 * Подпись после вертикальной черты в цель не входит: её человек пишет для
 * глаз, а адресом заметки она не является.
 */
function wikilinkTargetOf(text) {
  const m = String(nz(text, "")).trim().match(WIKILINK_TARGET_RE);
  return m ? String(m[1] || "").trim() : "";
}

/**
 * След о том, что загрузка пошла запасным ходом. Пишется **только** при
 * включённом `__inlineDebugLoaders`, и молчит, если сам сломался.
 *
 * **Почему молчание здесь обязательно.** Это сам отчётчик об отказе, и отчёт о
 * его собственном отказе девать некуда, кроме него же. Уронить загрузку из-за
 * неудавшегося следа значило бы получить два отказа вместо одного.
 *
 * Объявлений было два — в `pkm_runtime_bootstrap.js` и `plugin_commands.js`, —
 * и комментарий в первом из них это признавал словами «сводить их — отдельная
 * правка, не эта» (третий кусок В-97, 2026-09-10). Это она и есть: тела были
 * побайтно равны (10.13.150).
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
 * Как нормализуется ключ Order. **Одно объявление на весь плагин.**
 *
 * До 2026-09-15 то же тело стояло **шесть раз под тремя именами**:
 * `normalizeOrderKey` (`pkm_v2/field_model.js`), `normalizeOrderKeyDefault`
 * (`pkm_macro_runtime_entry.js`) и `normalizeOrderKeyLocal` в четырёх местах —
 * прослойке макро-рантайма и трёх движках. Тела сверены **текстом**,
 * приведённым к общему виду, и совпали все шесть; у меры был контроль —
 * соседнее правило `normalizeOrderFieldKey` она называет другим.
 *
 * **Сведение здесь снимает не только копии.** Нормализатор передаётся через
 * пять слоёв, и на каждом стоит «дали — бери данное, иначе моё»; в
 * `pkm_runtime_bootstrap.js` он вдобавок кладётся на шов `globalThis`, то есть
 * побеждает тот, кто загрузился первым. Пока тела совпадают, выбор ни на что
 * не влияет; разойдись одно — и поведение начало бы зависеть от порядка
 * загрузки, а это худший род расхождения: он не воспроизводится (10.13.146).
 */
function normalizeOrderKey(key) {
  return String(key || "").trim();
}

/**
 * Снять скобки с того, что целиком ссылка; всё остальное отдать как есть.
 *
 * **Это не `wikilinkTargetOf`, и путать их нельзя** — вопросы разные, и на
 * одном входе ответы расходятся:
 *
 *   вход            `wikilinkTargetOf`   `unwrapWikilinkToken`
 *   `[[a]]`         `a`                  `a`
 *   `[[a|подпись]]` `a`                  `a|подпись`
 *   `имя`           `` (пусто)           `имя`
 *
 * Первая спрашивает «какая заметка адресована» — подпись человек пишет для
 * глаз, и адресом она не является. Вторая спрашивает «как это выглядит без
 * обёртки» и ничего не выбрасывает: её ответ идут заворачивать обратно, и
 * потерянная подпись стала бы потерей текста человека.
 *
 * Заведена 2026-09-15: правило стояло двумя объявлениями — в панели
 * (`normalizeWikilinkTarget`) и **никак** в ядре, где цель бралась как есть.
 * На `link` со скобками ядро собирало `[[[[X]]]]`, а панель `[[X]]` (У-150).
 */
function unwrapWikilinkToken(raw) {
  /* `|| ""`, а не `nz`: тело взято у панели побайтно, и разница между ними
     настоящая — `nz` бережёт ноль, `||` обращает его в пустую строку. Сверка
     на 17 193 входах дала ровно одно расхождение, и оно было именно здесь.
     Выбирать семантику молча нельзя: это была бы правка поведения панели. */
  const src = String(raw || "").trim();
  if (!src) return "";
  const m = src.match(/^\[\[([^\]]+)\]\]$/);
  return m ? String(m[1] || "").trim() : src;
}

/**
 * Обход тегов в тексте: свой образец был у каждого читателя.
 *
 * Отдаётся новое выражение на каждый вызов, а не одно на всех: у глобального
 * `lastIndex` живёт между вызовами, и общий экземпляр пропускал бы каждое
 * второе совпадение.
 */
function tagTokenScanner() {
  return new RegExp(TAG_TOKEN_SRC, "g");
}

/**
 * **Разделители зон строки: откуда они берутся и что значит их отсутствие.**
 *
 * Объявление было четвёртым по счёту одинаковым: разбор строки, доводка,
 * макро-прослойка и граф токенов писали одни и те же шесть строк, отличаясь
 * только именем в тексте исключения и именами полей на выходе (Д2 ревизии,
 * 2026-09-14). Имя звавшего приезжает теперь аргументом: человеку в журнале
 * нужен тот, кто спрашивал, а правило одно на всех.
 *
 * Отсутствие разделителя — не «возьмём умолчание», а отказ вслух: без них
 * строка не разбирается вовсе, и тихий ответ был бы неотличим от дефекта.
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
 * **Умолчание разделителей — один дом на весь рантайм.**
 *
 * До 2026-09-15 запасное `"||"` стояло рядом с каждым чтением: шесть раз в
 * навигации, десять в предпросмотрах. Копия умолчания у места вызова — не
 * запас, а второе объявление правила: она молча расходится с настоящим
 * умолчанием и врёт человеку, у которого разделитель свой (У-186, У-32).
 *
 * Домов у этого умолчания ровно два, и второй — схема панели
 * (`separator-1`, `separator-2` в `schema/pkm.ts`), которая выводится из
 * прототипа и правится только им (Р8). Развести их нельзя: расхождения
 * умолчаний схемы и движка — продуктовый вопрос заказчика (В-7), а не
 * ошибка кода.
 */
const DEFAULT_SEPARATORS = { separator1: "||", separator2: "||" };

/**
 * **«Любой из двух разделителей» — образцом, а не литералом.**
 *
 * Правил вида «дальше стоят только разделители» в рантайме несколько, и все
 * они были написаны с `||` внутри регулярного выражения: у человека с другим
 * разделителем такое правило не срабатывает **ни разу** (У-186, его слово
 * 2026-09-14). Источник у образца один — настройки; экранирование берётся у
 * `escapeRe`, потому что разделителем человек вправе выбрать `|`, `.` или `*`.
 *
 * Одинаковые разделители не удваиваются: альтернатива из двух равных ветвей
 * работает так же, но читается как ошибка.
 */
function separatorAltSrc(rules, who) {
  const sep = resolveSeparatorsOrThrow(rules, who);
  const parts = sep.sep1 === sep.sep2 ? [sep.sep1] : [sep.sep1, sep.sep2];
  return "(?:" + parts.map(escapeRe).join("|") + ")";
}

/**
 * Первый разделитель в строке — любой из двух, тот, что стоит левее.
 *
 * `indexOf` одного разделителя отвечает на этот вопрос верно только у того, у
 * кого оба одинаковы (У-147).
 */
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

/**
 * **Пара суррогатов UTF-16.** Символ внеосновной плоскости записан двумя кодовыми
 * единицами, и шаг курсора по кодовым единицам рвал бы его пополам. Правило
 * было объявлено дважды — в навигации и в панели, — и тела совпадали.
 */
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
 * **Пара скобок в начале строки — это не задача, но это начало, которое
 * написал человек.**
 *
 * Задачей Obsidian считает скобки только за знаком списка (В-114), и
 * `lineStartOf` так и отвечает. Но у доводки строки есть свой вопрос: чем
 * строка **была** начата, чтобы вернуть это после перестановки. Скобки без
 * знака списка — текст человека, и сохранять его надо тем более.
 *
 * Имя здесь говорит о форме, а не о смысле: прежнее звалось
 * `hasStandaloneCheckboxPrefix` и обещало задачу там, где её нет (У-103).
 */
function startsWithBracketPair(text) {
  const src = String(nz(text, ""));
  const body = src.slice(lineIndentLength(src));
  return new RegExp("^" + CHECKBOX_ONE_CHAR_SRC + "(?:[ \\t]|$)").test(body);
}

/**
 * Чем строка начата — куском, который можно приписать обратно.
 *
 * **Объявление одно на обе дороги** (Д2 ревизии, 2026-09-14). Копий было две,
 * знак в знак: в доводке строки и в макро-прослойке, — и обе писали своё
 * правило о знаке списка руками. Расходились они с общим объявлением уже
 * сейчас: своё видело `\s` там, где платформа видит пробел и табуляцию, и не
 * знало про цитату вовсе — на строке `> - текст` одна и та же пара функций
 * отвечала «знак списка есть» и «начала нет».
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
 * Форма начала исходной строки переживает действие.
 *
 * Было начало — возвращается оно; не было — у новой строки снимается то, что
 * приписал плагин, и остаётся отступ человека.
 */
function preserveLineStartShape(rawLine, nextLine) {
  const raw = String(nz(rawLine, ""));
  if (isListItemLine(raw) || startsWithBracketPair(raw)) return reapplyLineStart(raw, nextLine);
  const rawIndent = String(raw.match(LINE_INDENT_RE)[0] || "");
  return rawIndent + stripLineStart(nextLine).trimStart();
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
  isTagToken,
  startsWithTagToken,
  wikilinkTargetOf,
  unwrapWikilinkToken,
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
  renderTokenlessValueByProgress,
  buildTokenlessValueRegexSource,
  parseTokenlessProgress,
  parseHhmm,
  addMinutesHhmm,
  formatNowByMask,
  renderCommandValueByFormat,
  buildElementTailRegexSource,
  DATE_LIKE_VALUE_SRC,
  longestValueLengthAt,
  elementValueSources,
  removeMarkerValueTokens,
  firstMarkerValueToken,
  ELEMENT_VALUE_CHARS,
  shouldHydrateGenericElementRaw,
  buildCustomPlanFromIncrement,
  forwardStepByCurrent,
  backwardStepByCurrent,
  getSearchLimitByUnit,
  detectDateUnit,
  isObj,
  deepMerge,
};
