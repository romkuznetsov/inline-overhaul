/**
 * Что в слое настроек видит человек — по исходнику (PRD 10.13.46).
 *
 * Заказ заказчика к K1: «проверь автоматически, что этот en.js содержит все
 * текстовые элементы, которые встречаются в настройках, в т.ч. текст модальных
 * окон». Глазами это не проверяется: строк семьсот с лишним, и появляются они
 * по одной вместе с каждой правкой.
 *
 * **Читается исходник, а не отрисованная панель.** Отрисовка показывает то,
 * что нарисовалось при этих настройках: у выключенного модуля половина строк
 * не рисуется вовсе, а окно `Restore a backup` не открыть без копии на диске.
 * Исходник показывает всё сразу — и, главное, показывает **новую** строку в
 * тот день, когда её написали.
 *
 * Разбор идёт скобка за скобкой, а не построчно: видимая строка почти всегда
 * склеена из нескольких — `"первая половина " + "вторая"`, — и построчный
 * поиск нашёл бы половинки, которых в каталоге нет и быть не должно.
 */

import fs from "node:fs";
import path from "node:path";

export interface FoundText {
  text: string;
  file: string;
  line: number;
}

/* ---- разбор исходника -------------------------------------------------- */

interface Literal {
  value: string;
  from: number;
  to: number;
  line: number;
}

/**
 * Все строковые литералы файла, кроме тех, что внутри комментариев.
 *
 * Проход посимвольный: `//` внутри строки — не комментарий, а кавычка внутри
 * комментария — не строка, и отличить одно от другого можно только идя по
 * файлу подряд.
 */
function literalsOf(src: string): Literal[] {
  const out: Literal[] = [];
  let line = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\n") { line++; continue; }
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      i--;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i++;
      continue;
    }
    /*
     * Литерал регулярного выражения. Внутри него кавычка — обычный символ, и
     * принять её за начало строки значит прочесть весь остаток файла как одну
     * строку: так `settings_backup.js` показывал тридцать «видимых строк»,
     * которых там нет. Отличить деление от регулярного выражения можно по
     * тому, что стоит слева: после значения идёт деление, после операции —
     * регулярное выражение.
     */
    if (c === "/") {
      let k = i - 1;
      while (k >= 0 && /\s/.test(String(src[k]))) k--;
      const prev = k >= 0 ? String(src[k]) : "(";
      if ("(,=:[!&|?{};+-*%<>~^".indexOf(prev) >= 0) {
        /* Пропускаем тело до незаэкранированной закрывающей косой черты. */
        let j = i + 1;
        let klass = false;
        for (; j < src.length; j++) {
          const ch = src[j];
          if (ch === "\\") { j++; continue; }
          if (ch === "\n") break;
          if (ch === "[") klass = true;
          else if (ch === "]") klass = false;
          else if (ch === "/" && !klass) break;
        }
        if (j < src.length && src[j] === "/") { i = j; continue; }
      }
      continue;
    }
    if (c !== '"' && c !== "'" && c !== "`") continue;
    const quote = c;
    const from = i;
    const startLine = line;
    let value = "";
    i++;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "\\") {
        const next = src[i + 1];
        if (next === "n") value += "\n";
        else if (next === "t") value += "\t";
        else if (next === "u" && src[i + 2] === "{") {
          const close = src.indexOf("}", i + 3);
          value += close > 0 ? String.fromCodePoint(parseInt(src.slice(i + 3, close), 16)) : "";
          i = close;
          continue;
        } else if (next === "u") {
          value += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
          i += 5;
          continue;
        } else value += next;
        i++;
        continue;
      }
      if (ch === "\n") { line++; value += "\n"; continue; }
      if (ch === quote) break;
      value += ch;
    }
    out.push({ value, from, to: i, line: startLine });
  }
  return out;
}

/** Склеить соседние литералы, между которыми только `+` и пробелы. */
function joinAdjacent(src: string, list: readonly Literal[]): Literal[] {
  const out: Literal[] = [];
  for (const lit of list) {
    const last = out[out.length - 1];
    if (last) {
      const between = src.slice(last.to + 1, lit.from);
      if (/^\s*\+\s*$/.test(between)) {
        out[out.length - 1] = { ...last, value: last.value + lit.value, to: lit.to };
        continue;
      }
    }
    out.push({ ...lit });
  }
  return out;
}

/* ---- что из этого видно человеку --------------------------------------- */

/** Слоты, в которых строка встаёт на экран. */
const VISIBLE_SLOT = new RegExp(
  "(?:^|[^\\w$.])(?:name|desc|tip|label|text|title|body|note|sub|placeholder|head|cap"
  + "|intro|unit|does|area|standard|user|heading|hint|confirmLabel|closeLabel|commentLabel"
  + "|commentHint|partsLabel|partsTip|hotkeyLabel|hotkeyTip|empty|caption|buttonText)\\s*:\\s*$",
);

/** Вызовы, у которых первый аргумент — видимая строка. */
const VISIBLE_CALL =
  /(?:setText|setName|setDesc|setTooltip|setPlaceholder|setButtonText|setTitle|Notice)\s*\(\s*$/;

/** `const UPPER_NAME = "…"` и `UPPER_NAME: "…"` — так лежат тексты окон. */
const NAMED_TEXT = /(?:^|[^\w$])[A-Z][A-Z0-9_]{2,}\s*(?:=|:)\s*$/;

/** Технические строки, которые в слот попадают, а на экран — нет. */
function technical(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (!/[a-zA-Z]/.test(t)) return true;
  /*
   * Строка в консоль. Её человек не видит: она попадает в лог разработчика, и
   * узнаётся по имени плагина в начале.
   */
  if (/^inline-overhaul:/.test(t)) return true;
  /*
   * Кириллица — признак того, что строка не видимая: интерфейс английский
   * (Р9), а по-русски в этом коде пишут только комментарии и сообщения лога.
   */
  if (/[Ѐ-ӿ]/.test(t)) return true;
  /* Имена классов и селекторы. */
  if (/^[.#]?io-/.test(t)) return true;
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\s+[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(t) && /-/.test(t)) return true;
  /* Пути конфига и имена файлов. */
  if (/^[a-z][\w]*(?:\.[\w]+)+$/i.test(t)) return true;
  if (/\.(?:js|ts|md|json|css)$/i.test(t)) return true;
  /* Имена тегов, атрибутов и единиц. */
  if (/^(?:div|span|p|ul|ol|li|button|h[1-6]|input|select|option|label|a|table|tr|td|th|code|b|i|em|small|svg|fragment|br|hr|textarea)$/.test(t)) return true;
  if (/^(?:px|em|rem|%|ms|s|type|button|checkbox|text|number|range|color|hidden|true|false)$/.test(t)) return true;
  return false;
}

/** Похоже ли на фразу: два слова и больше, буквами. */
function phrase(text: string): boolean {
  const t = text.trim();
  if (t.length < 4) return false;
  const words = t.split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w));
  return words.length >= 2;
}

/**
 * Видимые строки одного файла.
 *
 * Строка считается видимой, если она либо стоит в видимом слоте, либо сама по
 * себе выглядит фразой. Первое ловит короткие подписи (`Cancel`, `None`),
 * второе — длинные объяснения, которые собирают из кусков не в слоте.
 */
export function visibleTextsIn(file: string, rel: string): FoundText[] {
  const src = fs.readFileSync(file, "utf8");
  const list = joinAdjacent(src, literalsOf(src));
  const out: FoundText[] = [];
  for (const lit of list) {
    if (technical(lit.value)) continue;
    const before = src.slice(Math.max(0, lit.from - 40), lit.from);
    const slotted = VISIBLE_SLOT.test(before) || VISIBLE_CALL.test(before) || NAMED_TEXT.test(before);
    if (!slotted && !phrase(lit.value)) continue;
    out.push({ text: lit.value, file: rel, line: lit.line });
  }
  return out;
}

/** Обойти папку и собрать видимые строки всех её файлов. */
export function visibleTextsUnder(
  root: string,
  dirs: readonly string[],
  skip: (rel: string) => boolean,
): FoundText[] {
  const out: FoundText[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full).replace(/\\/g, "/");
      if (fs.statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(?:ts|js)$/.test(name)) continue;
      if (skip(rel)) continue;
      out.push(...visibleTextsIn(full, rel));
    }
  };
  for (const dir of dirs) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    if (fs.statSync(full).isDirectory()) walk(full);
    else out.push(...visibleTextsIn(full, dir));
  }
  return out;
}
