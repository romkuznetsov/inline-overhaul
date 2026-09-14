"use strict";

/**
 * Сколько правил объявлено в рантайме больше одного раза — и сколько из этих
 * объявлений настоящие, а не делегаты к общему дому.
 *
 * **Зачем в репозитории.** Число копий стареет быстрее всего, что есть в
 * документах (У-145): ревизия 2026-09-14 насчитала «семь мест» там, где их
 * оказалось сорок, потому что мерила одним написанием. Поэтому число живёт в
 * прогоне, а в документе стоит команда.
 *
 * Запуск (из `repo/`):
 *   node tools/rule_copies.js          — только настоящие копии
 *   node tools/rule_copies.js --all    — и делегаты тоже
 *
 * **Что считается копией.** Имя, объявленное в двух файлах рантайма, у
 * которого хотя бы два тела — не делегаты. Делегат — тело из одного `return`
 * с вызовом к модулю (`__sharedUtils.…`): оно спрашивает у того, кто правило
 * держит, и объявлением правила не является. Первая версия этого признака
 * искала делегата по **своему** имени и объявила копиями пять честных
 * делегатов: переименованный делегат зовёт общий дом другим именем.
 */
const fs = require("fs");
const path = require("path");

const ROOT = require("path").resolve(__dirname, "..");
const RUNTIME = ["main.js", "navigation_runtime.js", "pkm_runtime_v2.js", "src", "pkm_v2"];

function files() {
  const out = [];
  const walk = (p) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) { for (const n of fs.readdirSync(p)) walk(path.join(p, n)); return; }
    if (/\.(ts|js)$/.test(p)) out.push(p);
  };
  for (const e of RUNTIME) walk(path.join(ROOT, e));
  return out;
}

function mask(body) {
  const out = body.split("");
  const blank = (a, b) => { for (let i = a; i < b && i < out.length; i++) if (out[i] !== "\n") out[i] = " "; };
  const lineEnd = (from) => { const nl = body.indexOf("\n", from); return nl < 0 ? body.length : nl; };
  let i = 0;
  while (i < body.length) {
    const two = body.slice(i, i + 2);
    if (two === "//") { const e = lineEnd(i); blank(i, e); i = e; continue; }
    if (two === "/*") { const e = body.indexOf("*/", i + 2); blank(i, e < 0 ? body.length : e + 2); i = e < 0 ? body.length : e + 2; continue; }
    const ch = body[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const stop = lineEnd(i);
      let j = i + 1;
      while (j < stop) { if (body[j] === "\\") { j += 2; continue; } if (body[j] === ch) break; j++; }
      if (j >= stop) { i += 1; continue; }
      blank(i, j + 1); i = j + 1; continue;
    }
    i++;
  }
  return out.join("");
}

/* Тело объявления: от его открывающей скобки до парной, считая по маске. */
function bodyOf(src, masked, at) {
  const open = masked.indexOf("{", at);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}") {
      depth--;
      if (!depth) return src.slice(at, i + 1);
    }
  }
  return null;
}

function declarations(src) {
  const masked = mask(src);
  const out = {};
  /*
   * **Видны только объявления верхнего уровня**, и это не оговорка, а граница
   * меры: образец требует `function имя(` от начала строки, без отступа.
   * Вложенная функция и стрелочное замыкание (`const имя = (…) => …`) в счёт
   * не попадают вовсе.
   *
   * **А самые крупные находки ночи на 2026-09-15 жили именно там:**
   * `resolveFieldOutputMode` третьим объявлением был замыканием внутри
   * `buildTagTokenKeyMap` (10.13.139), а у `composeToken` из четырёх тел мера
   * видела два — остальные два вложены (10.13.147).
   *
   * Поэтому число долга, которое печатает этот прогон, — **нижняя граница**, и
   * он обязан говорить это сам (У-192: у своей маски спрашивают, сколько она
   * съела). Сколько именно вне поля зрения, печатается строкой ниже.
   */
  const re = /(?:^|\n)function ([A-Za-z0-9_$]+)\s*\(/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const at = m.index + (m[0].startsWith("\n") ? 1 : 0);
    out[m[1]] = bodyOf(src, masked, at);
  }
  return out;
}

function norm(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function main() {
  /* Контроль до первого вывода (У-119): на известном куске разборщик обязан
     отдать тело целиком, а не до первой скобки внутри строки. */
  const probe = "function f(a) {\n  const s = \"}\";\n  return s;\n}\n";
  const got = declarations(probe).f;
  if (!got || got.indexOf("return s;") === -1) throw new Error("контроль: разборщик обрезал тело");

  const byName = {};
  for (const f of files()) {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    const decls = declarations(fs.readFileSync(f, "utf8"));
    for (const name of Object.keys(decls)) {
      (byName[name] = byName[name] || []).push({ rel, body: decls[name] });
    }
  }

  /*
   * Сколько объявлений мера не видит. Считается по тому же тексту с той же
   * маской, но образцами вложенных форм; вычитается то, что уже сосчитано.
   * Контроль у этого счёта свой: он обязан быть больше нуля — вложенные
   * функции в проекте есть наверняка, и круглый ноль означал бы промах
   * образца, а не их отсутствие (У-119).
   */
  let unseen = 0;
  let seen = 0;
  for (const f of files()) {
    const masked = mask(fs.readFileSync(f, "utf8"));
    const nested = masked.match(/\n[ \t]+function [A-Za-z0-9_$]+\s*\(/g);
    const arrows = masked.match(/(?:^|\n)[ \t]*(?:const|let|var) [A-Za-z0-9_$]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g);
    unseen += (nested ? nested.length : 0) + (arrows ? arrows.length : 0);
    const top = masked.match(/(?:^|\n)function [A-Za-z0-9_$]+\s*\(/g);
    seen += top ? top.length : 0;
  }

  /*
   * **Делегат — не копия.** Тело вида `return X.name(...)` объявлением правила
   * не является: оно спрашивает у того, кто правило держит. Без этого шага
   * обход объявляет расхождением каждую тонкую обёртку — а их здесь
   * большинство (У-142: контроль на каждый шаг обхода, а не на его вывод).
   */
  const isDelegate = (name, body) => {
    /*
     * Контроль на этот шаг был неверен и соврал первым же прогоном: делегат
     * искался по **своему** имени (`.name(`), а переименованный делегат зовёт
     * общий дом другим именем — и пять честных делегатов объявились копиями.
     * Признак делегата не имя, а форма: тело из одного `return` с вызовом.
     */
    const code = mask(String(body || ""));
    const inner = code.replace(/^[^{]*\{/, "").replace(/\}\s*$/, "");

    /*
     * **Третья форма обращения к дому: охрана и возврат** (У-191, второй раз).
     * Движки под З3 берут помощников не `require`-ом, а швом `globalThis`, и
     * пустого модуля там быть не должно — поэтому у такого делегата не один
     * оператор, а три: связывание, охрана с громким отказом и возврат. Признак
     * «тело из одного `return`» такую форму не видел, и после сведения
     * `resolveFieldOutputMode` два честных делегата продолжали числиться
     * настоящими телами.
     *
     * Образец нарочно узкий: связать имя, бросить на отсутствии, вернуть вызов
     * **того же** имени. Своя работа между этими тремя шагами делает тело
     * настоящим, и оно им и останется.
     *
     * Точка с запятой не требуется: движки под З3 написаны без них, и первая
     * версия образца поэтому не нашла ни одного делегата — контроль «что ушло
     * из списка» показал пустоту там, где обязаны были уйти два имени.
     */
    const guardedDelegate = new RegExp(
      "^\\s*(?:var|const|let)\\s+([A-Za-z0-9_$]+)\\s*=\\s*[^;\\n]+[;\\n]" +
      "\\s*if\\s*\\([^)]*\\)\\s*\\{[^{}]*throw[^{}]*\\}" +
      "\\s*return\\s+\\1\\s*\\.\\s*[A-Za-z0-9_$]+\\s*\\([^;]*\\)\\s*;?\\s*$"
    );
    if (guardedDelegate.test(inner)) return true;

    /*
     * **Пятая форма: охрана возвращает делегата, отказ стоит после неё.**
     *
     *   const su = getSharedUtils();
     *   if (su && typeof su.parseHhmm === "function") return su.parseHhmm(text);
     *   throw new Error("shared_utils unavailable: parseHhmm");
     *
     * Так устроена вся семья разбора форматов даты и числа — исключение к З3
     * № 39 свело её в общий дом ещё 2026-09-11, — и мера всё это время считала
     * пятнадцать честных делегатов настоящими телами.
     *
     * Это У-193 в лоб, и на себе: признак чинился накануне по **одной**
     * найденной форме, и работа на этом не кончилась. Известный ответ, на
     * котором мера проверяется, лежал в самом отчёте о сведении.
     */
    const guardReturnDelegate = new RegExp(
      "^\\s*(?:var|const|let)\\s+([A-Za-z0-9_$]+)\\s*=\\s*[^;\\n]+[;\\n]" +
      /* Возврат делегата разрешено обернуть в фигурные скобки: это форма
         записи, а не смысл. Обёртка вроде `!!` — уже своя работа, и
         делегатом такое тело не считается. */
      "\\s*if\\s*\\([^)]*\\)\\s*\\{?\\s*return\\s+\\1\\s*\\.\\s*[A-Za-z0-9_$]+\\s*\\([^;\\n]*\\)\\s*;?\\s*\\}?" +
      "\\s*throw\\s[^;]*;?\\s*$"
    );
    if (guardReturnDelegate.test(inner)) return true;

    const stmts = inner.split(";").map((x) => x.trim()).filter(Boolean);
    if (stmts.length !== 1) return false;
    /* И вызов должен быть **к другому модулю**: `return String(s).replace(...)`
       это своя работа, а не делегирование.
       Форм у обращения к дому две, и вторую признак не видел (У-137): модуль
       приезжает либо именем с двух подчёркиваний (`__sharedUtils.…`), либо
       **геттером** (`getStatusRuntimeCommon().…`) — так устроены оба статусных
       движка, и три честных делегата числились копиями. */
    if (!/^return\s/.test(stmts[0])) return false;
    /* Модуль приезжает и **через вызов**: `__relocation().имя(...)` — так
       статусные движки берут общий дом перестановки. Признак требовал точку
       сразу за именем и эту форму не видел (третий такой случай за ночь,
       У-193). */
    const byModuleName = /(^|[^A-Za-z0-9_$])__[A-Za-z0-9_$]*(\(\))?\s*\./.test(stmts[0]);
    /* И после геттера обязан стоять **вызов**, а не чтение поля:
       `return getCfg().left;` — это своя работа, а не обращение к дому. */
    const byGetter = /(^|[^A-Za-z0-9_$])(get|ensure)[A-Z][A-Za-z0-9_$]*\(\)\s*\.[A-Za-z0-9_$]+\s*\(/.test(stmts[0]);
    return byModuleName || byGetter;
  };

  const broken = [];
  const twins = [];
  for (const name of Object.keys(byName)) {
    const rows = byName[name];
    for (const r of rows) if (r.body === null) broken.push(name + " в " + r.rel);
    if (rows.length < 2) continue;
    const real = rows.filter((r) => !isDelegate(name, r.body));
    const same = rows.every((r) => norm(r.body) === norm(rows[0].body));
    twins.push({ name, rows, same, real: real.length, delegates: rows.length - real.length });
  }

  if (broken.length) {
    console.log("!!! скобки не сошлись, эти места решает человек: " + broken.join(", "));
  }
  const SHOW_ALL = process.argv.includes("--all");
  const copies = twins.filter((t) => SHOW_ALL || t.real > 1);
  console.log("имён, объявленных больше одного раза: " + twins.length
    + "; из них с двумя и более настоящими объявлениями: " + copies.length
    + " (остальные — делегаты к общему дому)");
  console.log("Видны только объявления верхнего уровня: " + seen + " из " + (seen + unseen) +
    ". Вне поля зрения меры: " + unseen +
    " вложенных и стрелочных" + (unseen ? "" : "  <= НОЛЬ: образец промахнулся, вложенные функции в проекте есть") +
    ". Число выше — нижняя граница долга (10.13.147).");
  console.log("");
  copies.sort((a, b) => (a.same === b.same ? 0 : a.same ? -1 : 1));
  for (const t of copies) {
    console.log((t.same ? "ТОЧНАЯ КОПИЯ  " : "расходятся    ") + t.name
      + "   настоящих " + t.real + ", делегатов " + t.delegates
      + "   " + t.rows.map((r) => r.rel).join("  |  "));
  }
}

main();
