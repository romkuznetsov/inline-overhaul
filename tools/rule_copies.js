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

/*
 * Тело объявления: от его открывающей скобки до парной, считая по маске.
 *
 * **У объявления на TypeScript открывающих скобок бывает две**, и первая —
 * не тело: `function themePair(node: El): { fill: string; text: string } {`.
 * Первая версия брала объектный тип за тело, и `themePair` числился
 * расходящейся копией при тождественных телах — свой разборщик врёт молча
 * (У-96), и ловится это проверкой **на симптом**, а не чтением.
 *
 * Симптом узкий нарочно: за телом функции никогда не стоит ещё одна
 * открывающая скобка на той же строке, а за возвращаемым типом стоит всегда.
 * Промах в эту сторону стоит лишнего круга поиска, промах в обратную —
 * молчаливо обрезанного тела (У-192, про направление ошибки).
 */
const TYPE_THEN_BODY = /^[ \t]*[>|&\]\)]*[ \t]*\{/;

function bodyOf(src, masked, at) {
  let from = at;
  for (;;) {
    const open = masked.indexOf("{", from);
    if (open === -1) return null;
    let depth = 0;
    let close = -1;
    for (let i = open; i < masked.length; i++) {
      if (masked[i] === "{") depth++;
      else if (masked[i] === "}") {
        depth--;
        if (!depth) { close = i; break; }
      }
    }
    if (close === -1) return null;
    if (TYPE_THEN_BODY.test(masked.slice(close + 1))) { from = close + 1; continue; }
    return src.slice(at, close + 1);
  }
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

/*
 * **Не всякое второе тело — второе объявление правила.**
 *
 * Два рода тел правила не объявляют вовсе, и род выводится **из формы**:
 *
 * 1. **доставалка модуля** — тело возвращает модуль и ничего не решает:
 *    `return __mod;`, `return require("литерал");`, либо подготовка своим
 *    `ensure…()` и такой же возврат. У каждого файла свой `require`, и свести
 *    их не во что: доставалка есть адрес, а не правило;
 * 2. **ленивая сборка своего экземпляра** — тело один раз строит себе
 *    экземпляр общего дома фабрикой модуля (`__mod.createX({…})`). Общее лежит
 *    в доме, а различаются **доводы**, и это данные, а не правило.
 *
 * Оба образца узкие нарочно: всё, что в них не легло, остаётся копией и идёт
 * мерить расхождением. Промах в эту сторону стоит прогона, промах в
 * обратную — неверного вердикта «не правило» (У-192, про направление ошибки).
 *
 * Дом у признака один — здесь; `tools/rule_copy_shapes.js` спрашивает его же и
 * печатает форму каждого тела, чтобы вердикт можно было прочесть, а не принять
 * на слово (У-32).
 */
function innerCode(body) {
  return mask(String(body || ""))
    .replace(/^[^{]*\{/, "")
    .replace(/\}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const RETURNS_MODULE = /return (?:[A-Za-z0-9_$]+|require\( *\)) ?;?/.source;
const PREPARE = /(?:[A-Za-z0-9_$]+\( *\) ?;? ?)*/.source;

const SHAPES = [
  {
    id: "доставалка модуля",
    why: "тело возвращает модуль и ничего не решает",
    test: (inner) => new RegExp("^" + PREPARE + RETURNS_MODULE + "$").test(inner),
  },
  {
    id: "ленивая сборка своего экземпляра",
    why: "тело один раз строит себе экземпляр общего дома фабрикой модуля",
    test: (inner) =>
      /^if \([^()]*\) return ?; ?[A-Za-z0-9_$]+ = __[A-Za-z0-9_$]*\.[A-Za-z0-9_$]+\(\{.*\}\) ?;?$/.test(inner)
      || /^if \([^()]*\) \{ ?[A-Za-z0-9_$]+ = __[A-Za-z0-9_$]*\.[A-Za-z0-9_$]+\(\{.*\}\) ?;? ?\} return [A-Za-z0-9_$]+ ?;?$/.test(inner),
  },
];

function shapeOf(body) {
  const inner = innerCode(body);
  for (const sh of SHAPES) if (sh.test(inner)) return sh;
  return null;
}

/* Контроль признака — на строках-образцах и в обе стороны (У-92, У-119). */
function checkShapes() {
  const cases = [
    ["function g() {\n  return __mod;\n}", "доставалка модуля"],
    ["function g() {\n  return require(\"../features/x.js\");\n}", "доставалка модуля"],
    ["function g() {\n  ensureLoaded();\n  return __fns;\n}", "доставалка модуля"],
    ["function g() {\n  if (__f) return;\n  __f = __mod.createX({ a: 1, b: \"left\" });\n}", "ленивая сборка своего экземпляра"],
    ["function g() {\n  if (!__f) {\n    __f = __mod.createX({ a: 1 });\n  }\n  return __f;\n}", "ленивая сборка своего экземпляра"],
    ["function g(k) {\n  const s = String(k || \"\").trim();\n  return s ? s : \"tag\";\n}", null],
    ["function g() {\n  return __mod.value;\n}", null],
    ["function g() {\n  return __mod.createX({ a: 1 });\n}", null],
    ["function g() {\n  const s = \"}\";\n  return s;\n}", null],
  ];
  for (const [src, want] of cases) {
    const got = shapeOf(declarations(src).g);
    const id = got ? got.id : null;
    if (id !== want) {
      throw new Error("контроль рода: на образце ждали " + (want || "ничего")
        + ", обход сказал " + (id || "ничего") + "\n" + src);
    }
  }
}

function norm(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function measure() {
  /* Контроль до первого вывода (У-119): на известном куске разборщик обязан
     отдать тело целиком, а не до первой скобки внутри строки. */
  const probe = "function f(a) {\n  const s = \"}\";\n  return s;\n}\n";

  /* И вторая сторона того же контроля: объектный тип перед телом не смеет
     стать телом, а тело без типа не смеет уехать дальше (У-92, в обе
     стороны). */
  const typed = "function g(n) : { fill: string; text: string } {\n  return n;\n}\n";
  const gotTyped = declarations(typed).g;
  if (!gotTyped || gotTyped.indexOf("return n;") === -1) {
    throw new Error("контроль: возвращаемый тип принят за тело");
  }
  const plain = "function h() {\n  return 1;\n}\n\nfunction i() {\n  return 2;\n}\n";
  if (declarations(plain).h.indexOf("return 2;") !== -1) {
    throw new Error("контроль: тело уехало за пределы своего объявления");
  }
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
  /*
   * Возврат кончается на вызове дома, а не начинается с него: скобка вызова
   * обязана закрыться в самом конце предложения. Всё, что дописано за ней —
   * `|| "tag"`, `.trim()`, тернарник, — это своя работа, и тело настоящее.
   */
  const endsOnHomeCall = (stmt) => {
    const body = stmt.replace(/\s*;?\s*$/, "");
    /* Чтение поля дома правила не объявляет: `return __mod.value;`. */
    if (/^return\s+__[A-Za-z0-9_$]*\s*\.\s*[A-Za-z0-9_$]+$/.test(body)) return true;
    /* Иначе предложение обязано **кончаться** закрывающей скобкой вызова, и
       снаружи скобок не должно остаться ни одного действия: `|| "tag"`,
       `.trim()`, тернарник — это своя работа, и тело с ней настоящее. */
    if (!/\)$/.test(body)) return false;
    let depth = 0;
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i];
      if (c === "(" || c === "[" || c === "{") depth += 1;
      else if (c === ")" || c === "]" || c === "}") depth -= 1;
      else if (!depth && (c === "|" || c === "&" || c === "?" || c === "+")) return false;
    }
    return true;
  };

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

    /*
     * **Шестая форма: охрана отказом прямо у модуля, затем возврат его
     * вызова.**
     *
     *   if (!__pkmDomainRegistry || typeof __pkmDomainRegistry.inferSubFieldKey !== "function") {
     *     throw new Error("pkm_domain_registry unavailable: inferSubFieldKey");
     *   }
     *   return __pkmDomainRegistry.inferSubFieldKey(parentKey);
     *
     * От четвёртой формы отличается одним: дом не связан локальным именем, а
     * назван прямо. Смысл тот же — спросить дом и громко отказать, если его
     * нет, — а признак этого не видел, и три честных делегата числились бы
     * настоящими телами (У-191, У-193: признак чинится по одной найденной
     * форме и работу этим не кончает).
     *
     * Условие узкое нарочно: охрана обязана называть **ту самую** функцию,
     * которую тело возвращает. Своя работа между охраной и возвратом делает
     * тело настоящим, и оно им и останется.
     */
    const guardThrowThenCall = inner.match(new RegExp(
      "^\\s*if\\s*\\(([^)]*)\\)\\s*\\{[^{}]*throw[^{}]*\\}" +
      "\\s*return\\s+(__[A-Za-z0-9_$]*|(?:get|ensure)[A-Za-z0-9_$]*\\(\\))" +
      "\\s*\\.\\s*([A-Za-z0-9_$]+)\\s*\\([^;]*\\)\\s*;?\\s*$"
    ));
    if (guardThrowThenCall && guardThrowThenCall[1].indexOf(guardThrowThenCall[3]) >= 0) return true;

    /*
     * **Седьмая форма, и она не образец, а свойство: из тела нет выхода,
     * кроме ответа дома и громкого отказа.**
     *
     *   function registerStoreEvents(plugin) {
     *     return __storeEventsOrchestrator.registerStoreEvents({ … })
     *   }
     *
     *   function enforceDependentAdjacencyForStatusLine(line, rules, state, core) {
     *     const runtime = getStatusLineRuntimeUnified()
     *     const linePipeline = globalThis.__inlineLinePipeline
     *     if (!linePipeline || typeof linePipeline.splitLeftPrefix !== "function") {
     *       throw new Error("line_pipeline unavailable: splitLeftPrefix")
     *     }
     *     …ещё две такие охраны…
     *     return runtime.enforceDependentAdjacencyForStatusLine({ … })
     *   }
     *
     * Прежние шесть форм — образцы, и каждая ловила ровно ту запись, на
     * которой её писали (У-193, трижды подряд). Эта спрашивает **свойство**:
     * возврат в теле ровно один, на верхнем уровне, и это вызов дома; всё, что
     * стоит до него, — связывание дома и охрана, которая **бросает**. Своя
     * работа до возврата — хоть `String(x).trim()` — делает тело настоящим, и
     * это нарочно: приведение входа перед вопросом есть объявление правила.
     *
     * Возврат считается на верхнем уровне тела: `return []` внутри замыкания,
     * переданного доводом, телу не принадлежит и в счёт не идёт.
     */
    const topLevelReturns = (text) => {
      let depth = 0;
      const at = [];
      for (let i = 0; i < text.length; i += 1) {
        const c = text[i];
        if (c === "{" || c === "(" || c === "[") depth += 1;
        else if (c === "}" || c === ")" || c === "]") depth -= 1;
        else if (depth === 0 && text.startsWith("return", i)
          && !/[A-Za-z0-9_$]/.test(text[i - 1] || " ")
          && !/[A-Za-z0-9_$]/.test(text[i + 6] || " ")) at.push(i);
      }
      return at;
    };
    {
      const flat = inner.replace(/\s+/g, " ");
      const rets = topLevelReturns(flat);
      if (rets.length === 1) {
        const ret = flat.slice(rets[0]).trim();
        const call = ret.match(/^return ([A-Za-z0-9_$]+)\.[A-Za-z0-9_$]+\(/);
        /*
         * **И возврат обязан на этом вызове кончаться.** Первая версия
         * сверяла только начало, и `return __mod.f(x) || "tag"` — вызов дома
         * со своим умолчанием рядом — числился делегатом. Поймал это контроль
         * на строке-образце, а не чтение (У-142: контроль на каждый шаг).
         */
        if (call && endsOnHomeCall(ret)) {
          const home = call[1];
          const head = flat.slice(0, rets[0]);
          /* Связывания до возврата — только дом: имя с двух подчёркиваний,
             геттер или шов `globalThis.__…`. */
          const bindings = head.match(/(?:var|const|let) [A-Za-z0-9_$]+ =[^;]*/g) || [];
          const onlyHomeBindings = bindings.every((b) =>
            /=[^;]*(?:__[A-Za-z0-9_$]*|(?:get|ensure)[A-Z][A-Za-z0-9_$]*\(\))/.test(b));
          /* Охраны до возврата — только бросающие. */
          const ifs = (head.match(/\bif \(/g) || []).length;
          const throws = (head.match(/\bthrow \b/g) || []).length;
          const homeBound = /^__/.test(home) || new RegExp("(?:var|const|let) " + home + " =").test(head);
          const rest = head
            .replace(/(?:var|const|let) [A-Za-z0-9_$]+ =[^;]*;?/g, " ")
            .replace(/if \([^)]*\)\s*\{[^{}]*\}/g, " ")
            .replace(/if \([^)]*\)\s*throw [^;]*;?/g, " ")
            .trim();
          if (onlyHomeBindings && homeBound && throws >= ifs && ifs > -1 && !rest) return true;
        }
      }
    }

    const stmts = inner.split(";").map((x) => x.trim()).filter(Boolean);
    if (stmts.length !== 1) return false;
    /* И вызов должен быть **к другому модулю**: `return String(s).replace(...)`
       это своя работа, а не делегирование.
       Форм у обращения к дому две, и вторую признак не видел (У-137): модуль
       приезжает либо именем с двух подчёркиваний (`__sharedUtils.…`), либо
       **геттером** (`getStatusRuntimeCommon().…`) — так устроены оба статусных
       движка, и три честных делегата числились копиями. */
    if (!/^return\s/.test(stmts[0])) return false;
    /*
     * **И здесь возврат обязан кончаться на вызове дома.** Признак сверял
     * только начало, и `return __mod.f(x) || "tag"` — вопрос дому со своим
     * умолчанием рядом — числился делегатом с первого дня. Своё умолчание есть
     * объявление правила, и тело с ним настоящее (У-186: настройка человека в
     * коде не пишется). Дыра нашлась контролем на строке-образце, а не
     * чтением.
     */
    if (!endsOnHomeCall(stmts[0])) return false;
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

  /*
   * **Контроль признака делегата — на строках-образцах и в обе стороны**
   * (У-92, У-119, У-127). Он стоит здесь, а не на том, что нужная форма ещё
   * есть в продукте: такой контроль умер бы вместе с долгом.
   *
   * Седьмая форма опасна ровно тем, чем сильна: она спрашивает свойство, а не
   * образец, и потому может признать делегатом тело, которое **приводит вход**
   * перед вопросом. Приведение входа — объявление правила, и последний образец
   * ниже требует, чтобы оно телом и осталось.
   */
  const control = [
    ["делегат одной строкой",
     "function f(x) {\n  return __mod.f(x);\n}", true],
    ["делегат со связыванием и охраной",
     "function f(x) {\n  const home = getHome();\n  if (!home || typeof home.f !== \"function\") {\n    throw new Error(\"home unavailable: f\");\n  }\n  return home.f(x);\n}", true],
    ["возврат внутри довода телу не принадлежит",
     "function f(x) {\n  return __mod.f({ pick: (v) => { if (!v) return []; return v; } });\n}", true],
    ["приведение входа перед вопросом делает тело настоящим",
     "function f(x) {\n  const k = String(x || \"\").trim().toLowerCase();\n  return __mod.f(k);\n}", false],
    ["свой ответ рядом с вопросом — настоящее тело",
     "function f(x) {\n  if (!__mod) return \"tag\";\n  return __mod.f(x);\n}", false],
    ["чтение поля дома правила не объявляет",
     "function f() {\n  return __mod.value;\n}", true],
    ["своё умолчание рядом с вызовом дома — настоящее тело",
     "function f(x) {\n  return __mod.f(x) || \"tag\";\n}", false],
  ];
  for (const [why, src, want] of control) {
    const body = declarations(src).f;
    if (!body) throw new Error("контроль признака: образец не разобрался — " + why);
    if (isDelegate("f", body) !== want) {
      throw new Error("контроль признака делегата: «" + why + "» — ждали "
        + (want ? "делегат" : "настоящее тело") + ", вышло иначе");
    }
  }

  checkShapes();

  const broken = [];
  const twins = [];
  for (const name of Object.keys(byName)) {
    const rows = byName[name];
    for (const r of rows) if (r.body === null) broken.push(name + " в " + r.rel);
    if (rows.length < 2) continue;
    const real = rows.filter((r) => !isDelegate(name, r.body));
    const same = rows.every((r) => norm(r.body) === norm(rows[0].body));
    /* Имя, у которого **все** тела правила не объявляют, — не долг: сводить в
       нём нечего. Оно печатается отдельным списком, а не прячется. */
    const shapes = rows.map((r) => shapeOf(r.body));
    const notARule = shapes[0] && shapes.every((sh) => sh && sh.id === shapes[0].id) ? shapes[0].id : null;
    twins.push({ name, rows, same, real: real.length, delegates: rows.length - real.length, notARule });
  }

  const notRules = twins.filter((t) => t.notARule && t.real > 1);
  const real = twins.filter((t) => t.real > 1 && !t.notARule);
  return { twins, real, notRules, broken, seen, unseen };
}

/*
 * Измерение отдаётся наружу: его спрашивает сторож
 * `tests/regression/rule_copies_debt_tests.js`. Разбирать текст вывода он бы
 * не смог — свой разборщик чужого вывода есть то же второе объявление правила
 * (У-96).
 */
function main() {
  const { twins, real, notRules, broken, seen, unseen } = measure();
  if (broken.length) {
    console.log("!!! скобки не сошлись, эти места решает человек: " + broken.join(", "));
  }
  const SHOW_ALL = process.argv.includes("--all");
  const copies = SHOW_ALL ? twins : real;
  /* Число настоящих копий считается по предмету, а не по тому, что сейчас
     печатается: под `--all` в списке лежат и делегаты, и шапка называла
     долгом все 81 имя (У-145 — число живёт в прогоне, и врать оно тоже умеет
     в прогоне). */
  console.log("имён, объявленных больше одного раза: " + twins.length
    + "; из них с двумя и более настоящими объявлениями: " + real.length
    + " (остальные — делегаты к общему дому)");
  console.log("Правила не объявляют вовсе (вердикт по форме, см. node tools/rule_copy_shapes.js): "
    + notRules.length + " — " + (notRules.map((t) => t.name).join(", ") || "нет"));
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

/* Маска «где код, а где рассказ о коде» отдаётся наружу: её спрашивает
   `tools/form_divergence.js`, и второй копии заводить не надо (У-138, У-32). */
module.exports = { mask, declarations, shapeOf, innerCode, measure };

if (require.main === module) main();
