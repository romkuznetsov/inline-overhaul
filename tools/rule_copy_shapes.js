"use strict";
/*
 * **Разбор остатка долга копий: что за род у каждого имени.**
 *
 * Число без списка — оценка, а не вывод (У-109). Этот обход печатает у
 * каждого имени из списка `rule_copies` **вердикт по форме** и первые значащие
 * строки каждого тела, по которым вердикт получен.
 *
 * Запуск (из `repo/`): node tools/rule_copy_shapes.js
 *
 * **Почему вердикт печатает инструмент, а не глаз.** До 2026-09-16 этот обход
 * печатал только первые строки тел, а род имени называл человек — и
 * унаследованный от прежних сессий разбор оказался гипотезой: пятнадцать имён
 * числились разобранными со слов, а четыре из них были той самой «копией на
 * молчаливом запасном ходу», которую сессия 55 снимала трижды. Поэтому род,
 * который **выводится из формы**, называет прогон.
 *
 * **Родов, выводимых из формы, два, и оба узкие нарочно.** Всё, что не легло
 * в образец, объявляется «формой не решается» и уходит мерить расхождением
 * (`node tools/form_divergence.js`): промах в эту сторону стоит прогона, а
 * промах в обратную — неверного вердикта «не правило» (У-192, про направление
 * ошибки).
 *
 * 1. **Доставалка модуля** — тело возвращает модуль и ничего не решает:
 *    `return __mod;`, `return require("литерал");`, либо подготовка своим
 *    `ensure…()` и такой же возврат. Правила в таком теле нет, сводить нечего.
 * 2. **Ленивая сборка своего экземпляра** — тело один раз строит себе
 *    экземпляр общего дома фабрикой модуля (`__mod.createX({…})`) и отдаёт
 *    его. Правила в нём тоже нет: общее лежит в доме, а различаются **доводы**,
 *    и это данные. Расхождение доводов обход печатает сам — иначе вердикт
 *    «не правило» пришлось бы принимать на слово.
 *
 * Контроль стоит **до первого вывода** (У-119) и мутирует в обе стороны
 * (У-92): образец каждого рода обязан узнаться, а образец с правилом внутри —
 * не узнаться ни одним. Контроль живёт на строках-образцах здесь же, а не на
 * том, что нужная форма ещё есть в продукте (У-127).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { mask, declarations } = require("./rule_copies.js");

const ROOT = process.cwd();

/* Тело без подписи и внешних скобок, с маской вместо строк и комментариев,
   пробелы сведены к одному. На этом виде и стоят образцы родов. */
function innerCode(body) {
  const masked = mask(String(body || ""));
  return masked
    .replace(/^[^{]*\{/, "")
    .replace(/\}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* Первые две значащие строки тела — то, чем вердикт показывается человеку. */
function firstLines(body) {
  const lines = String(body || "").split("\n").slice(1);
  const sig = [];
  for (const l of lines) {
    const t = l.trim();
    if (!t || t === "}" || t.startsWith("*") || t.startsWith("//") || t.startsWith("/*")) continue;
    sig.push(t);
    if (sig.length >= 2) break;
  }
  return sig.join(" ⏎ ").slice(0, 118);
}

/* Возвращается имя модуля: голое имя или литеральный `require`. Поле объекта
   (`return __mod.x;`) и вызов (`return __mod.f();`) сюда не попадают — первое
   читает значение, второе делегирует, и оба решаются не формой. */
const RETURNS_MODULE = /return (?:[A-Za-z0-9_$]+|require\( *\)) ?;?/.source;
/* Подготовка: свой вызов без доводов, `ensureX();`. */
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
      /* Охрана возвратом, затем сборка: `if (__f) return; __f = __mod.createX({…});` */
      /^if \([^()]*\) return ?; ?[A-Za-z0-9_$]+ = __[A-Za-z0-9_$]*\.[A-Za-z0-9_$]+\(\{.*\}\) ?;?$/.test(inner)
      /* Охрана блоком, затем возврат: `if (!__f) { __f = __mod.createX({…}); } return __f;` */
      || /^if \([^()]*\) \{ ?[A-Za-z0-9_$]+ = __[A-Za-z0-9_$]*\.[A-Za-z0-9_$]+\(\{.*\}\) ?;? ?\} return [A-Za-z0-9_$]+ ?;?$/.test(inner),
  },
];

function shapeOf(body) {
  const inner = innerCode(body);
  for (const s of SHAPES) if (s.test(inner)) return s;
  return null;
}

/*
 * Контроль до первого вывода, мутацией в обе стороны (У-92, У-119).
 * Каждый образец назван вместе с ответом, которого от обхода ждут.
 */
function selfCheck() {
  const cases = [
    ["function g() {\n  return __mod;\n}", "доставалка модуля"],
    ["function g() {\n  return require(\"../features/x.js\");\n}", "доставалка модуля"],
    ["function g() {\n  ensureLoaded();\n  return __fns;\n}", "доставалка модуля"],
    ["function g() {\n  if (__f) return;\n  __f = __mod.createX({ a: 1, b: \"left\" });\n}", "ленивая сборка своего экземпляра"],
    ["function g() {\n  if (!__f) {\n    __f = __mod.createX({ a: 1 });\n  }\n  return __f;\n}", "ленивая сборка своего экземпляра"],
    /* Обратная сторона: тело с правилом внутри не смеет узнаться ни одним родом. */
    ["function g(k) {\n  const s = String(k || \"\").trim();\n  return s ? s.toLowerCase() : \"tag\";\n}", null],
    /* И близкие формы, которые родом не являются: чтение поля и вызов модуля. */
    ["function g() {\n  return __mod.value;\n}", null],
    ["function g() {\n  return __mod.createX({ a: 1 });\n}", null],
    /* Фигурная скобка внутри строки не смеет обрезать тело (та же проверка,
       что у разборщика в `rule_copies`, но на этом виде тела). */
    ["function g() {\n  const s = \"}\";\n  return s;\n}", null],
  ];
  for (const [src, want] of cases) {
    const got = shapeOf(src);
    const gotId = got ? got.id : null;
    if (gotId !== want) {
      throw new Error("контроль рода: на образце ждали " + (want || "ничего")
        + ", обход сказал " + (gotId || "ничего") + "\n" + src);
    }
  }
}

/* Чем различаются тела группы: строки, которые есть не у всех. Нужен там, где
   вердикт «не правило» опирается на «различаются только доводы» — без списка
   это была бы оценка, а не вывод (У-109). */
function bodyDiff(rows) {
  const setOf = (b) => String(b || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const all = rows.map((r) => setOf(r.body));
  const common = all[0].filter((l) => all.every((ls) => ls.includes(l)));
  return rows.map((r, i) => ({ rel: r.rel, only: all[i].filter((l) => !common.includes(l)) }));
}

function main() {
  selfCheck();

  const out = execSync("node tools/rule_copies.js", { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 24 });
  const rows = out.split("\n").filter((l) => /^(расходятся|совпадают|ТОЧНАЯ)/.test(l));

  const cache = new Map();
  const declsOf = (rel) => {
    if (!cache.has(rel)) cache.set(rel, declarations(fs.readFileSync(path.join(ROOT, rel), "utf8")));
    return cache.get(rel);
  };

  const byShape = new Map();
  for (const row of rows) {
    const parts = row.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
    const name = parts[1];
    const files = parts.slice(3).join(" ").split("|").map((x) => x.trim()).filter(Boolean);
    const bodies = files.map((rel) => ({ rel, body: declsOf(rel)[name] }));

    const shapes = bodies.map((b) => shapeOf(b.body));
    const one = shapes[0] && shapes.every((s) => s && s.id === shapes[0].id) ? shapes[0] : null;
    const verdict = one
      ? "НЕ ПРАВИЛО — " + one.id + ": " + one.why + " (все " + bodies.length + ")"
      : "ФОРМОЙ НЕ РЕШАЕТСЯ — мерить расхождением: node tools/form_divergence.js";
    byShape.set(one ? one.id : "формой не решается", (byShape.get(one ? one.id : "формой не решается") || 0) + 1);

    console.log("\n" + name + "   [" + parts[2] + "]");
    console.log("   ВЕРДИКТ: " + verdict);
    for (const b of bodies) console.log("   " + b.rel.padEnd(44) + " " + firstLines(b.body));
    if (one && one.id === "ленивая сборка своего экземпляра") {
      for (const d of bodyDiff(bodies)) {
        console.log("   различие " + d.rel.padEnd(36) + " " + (d.only.length ? d.only.join(" ⏎ ") : "(нет)"));
      }
    }
  }

  console.log("\nИтог по родам:");
  for (const [id, n] of [...byShape.entries()].sort((a, b) => b[1] - a[1])) {
    console.log("  " + String(n).padStart(3) + "  " + id);
  }
}

module.exports = { shapeOf, innerCode };

if (require.main === module) main();
