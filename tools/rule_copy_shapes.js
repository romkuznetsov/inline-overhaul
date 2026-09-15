"use strict";
/*
 * **Разбор долга копий: что за род у каждого имени, объявленного дважды.**
 *
 * Число без списка — оценка, а не вывод (У-109). Этот обход печатает у
 * каждого имени **вердикт по форме** и первые значащие строки каждого тела, по
 * которым вердикт получен.
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
 * **Сам признак живёт не здесь, а в `tools/rule_copies.js`** — там же, где им
 * пользуется мера: два дома у одного правила разошлись бы молча (У-32).
 * Здесь — только показ: что за род и на каком теле это видно.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { declarations, shapeOf } = require("./rule_copies.js");

const ROOT = process.cwd();

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

/* Чем различаются тела группы: строки, которые есть не у всех. Нужен там, где
   вердикт опирается на «различаются только доводы» — без списка это была бы
   оценка, а не вывод (У-109). */
function bodyDiff(rows) {
  const setOf = (b) => String(b || "").split("\n").map((x) => x.trim()).filter(Boolean);
  const all = rows.map((r) => setOf(r.body));
  const common = all[0].filter((l) => all.every((ls) => ls.includes(l)));
  return rows.map((r, i) => ({ rel: r.rel, only: all[i].filter((l) => !common.includes(l)) }));
}

function main() {
  /*
   * Список берётся у меры с `--all`: имена, признанные «не правилами», из
   * короткого списка ушли, а показать их форму надо именно здесь — иначе
   * вердикт пришлось бы принимать на слово.
   */
  const out = execSync("node tools/rule_copies.js --all", { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 24 });
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
    const one = shapes[0] && shapes.every((sh) => sh && sh.id === shapes[0].id) ? shapes[0] : null;
    /* Имя, у которого настоящее тело одно, — честный делегат: показывать по
       нему нечего, и в сводку он идёт числом. */
    const realCount = Number(String(parts[2] || "").replace(/[^0-9]/g, "").slice(0, 1) || 0);
    const id = one ? one.id : (realCount > 1 ? "формой не решается" : "делегат к общему дому");
    byShape.set(id, (byShape.get(id) || 0) + 1);
    if (id === "делегат к общему дому") continue;

    console.log("\n" + name + "   [" + parts[2] + "]");
    console.log("   ВЕРДИКТ: " + (one
      ? "НЕ ПРАВИЛО — " + one.id + ": " + one.why + " (все " + bodies.length + ")"
      : "ФОРМОЙ НЕ РЕШАЕТСЯ — мерить расхождением: node tools/form_divergence.js"));
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

if (require.main === module) main();
