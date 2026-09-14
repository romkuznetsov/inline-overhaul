"use strict";

/**
 * Мера расхождения между копиями одного правила — до того, как их сводить.
 *
 * **Зачем.** Заказчик 2026-09-15: «сначала хочу уборку кода, но не хочу риска
 * дефектов». Остаток форм ссылки и тега — не копии: у мест разные ответы на
 * краях, и сведение любого из них меняет поведение, о котором никто не просил.
 * Чтобы уборка была безрисковой, нужен не глаз, а число: **какие места дают
 * одинаковый ответ на всех входах, а какие расходятся и на чём**.
 *
 * Сводится только группа с нулём расхождений. Остальные не сводятся, а
 * называются числом — и решение по ним принимает заказчик.
 *
 * **Почему тела переписаны сюда, а не вызваны из модулей.** Все они —
 * локальные замыкания внутри функций слоя настроек, наружу не отданы ни одно.
 * Переписанное тело — это ещё одно объявление правила, и врёт оно молча
 * (У-96), поэтому у каждого места стоит **контроль на переписывание**: строка
 * исходника, из которой тело снято, ищется в самом файле. Уехала строка —
 * стенд краснеет и говорит, какое место он больше не описывает.
 *
 * Контролей три, и каждый на свой шаг обхода (У-142):
 *   1. переписывание   — тело и правда стоит в названном файле;
 *   2. корпус          — в нём есть каждая форма, ради которой он собран;
 *   3. сама мера       — нарочно разведённая пара обязана попасть в расхождения.
 *
 * Запуск (из `repo/`):
 *   node tools/form_divergence.js          — сводка по группам
 *   node tools/form_divergence.js --all    — плюс каждый вход и ответ каждого места
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VAULT = process.env.IO_VAULT
  ? path.resolve(process.env.IO_VAULT)
  : path.resolve(ROOT, "..", "test-vault");
const DATA = process.env.IO_DATA
  ? path.resolve(process.env.IO_DATA)
  : path.join(VAULT, ".obsidian", "plugins", "inline-overhaul", "data.json");

const SHOW_ALL = process.argv.includes("--all");

/* ------------------------------------------------------------------ корпус */

/**
 * Входы берутся у заказчика, а не пишутся здесь литералами (У-182): его
 * `data.json` даёт значения полей, его заметка — токены, которые и правда
 * стоят в строке. Синтетические края названы отдельным списком и помечены:
 * они отвечают на «а что на границе», и форму каждого признаёт предикат
 * общего дома (У-189).
 */
function corpusFromHisConfig() {
  const out = [];
  const seen = new Set();
  const add = (v) => {
    const s = String(v == null ? "" : v);
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  (function walk(o) {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      if (k === "token" && typeof o[k] === "string") add(o[k]);
      walk(o[k]);
    }
  })(raw);
  return out;
}

/** Токены из его же заметки: там ссылка стоит в скобках, а в конфиге — без. */
function corpusFromHisNotes() {
  const out = [];
  const seen = new Set();
  const files = fs.readdirSync(VAULT).filter((n) => /\.md$/i.test(n));
  for (const name of files) {
    let text = "";
    try { text = fs.readFileSync(path.join(VAULT, name), "utf8"); } catch (_) { continue; }
    for (const tok of String(text).split(/\s+/)) {
      if (!tok) continue;
      if (!/^\[\[|^#|\]\]$/.test(tok)) continue;
      if (seen.has(tok)) continue;
      seen.add(tok);
      out.push(tok);
    }
  }
  return out;
}

/**
 * Края. Это единственные входы, которых у заказчика нет, и они здесь нарочно:
 * вопрос «расходятся ли места» решается именно на них.
 */
const SYNTHETIC_EDGES = [
  "",
  "   ",
  "#",
  "[[]]",
  "[[a|b]]",
  "[[Имя заметки|подпись]]",
  "#[[a]]",
  "[[#heading]]",
  "[[a]]tail",
  "head[[a]]",
  "[[a",
  "a]]",
  "[[a]]]]",
  "  [[a]]  ",
  "  #tag  ",
  "##tag",
  "#tag#tag",
  "[[a]] [[b]]",
];

/* ------------------------------------------------------------------- места */

/**
 * Каждое место: где стоит, что делает и строка исходника, по которой тело
 * переписано. Строка — контроль: она обязана и правда найтись в файле.
 */
const SITES = [
  {
    group: "bare-token",
    id: "fields_editor_view.plain",
    file: "src/ui/settings/custom/fields_editor_view.ts",
    anchor: 'return String(token || "").trim().replace(/^#/, "").replace(/^\\[\\[|\\]\\]$/g, "");',
    fn: (token) => String(token || "").trim().replace(/^#/, "").replace(/^\[\[|\]\]$/g, ""),
  },
  {
    group: "bare-token",
    id: "preview_data.push",
    file: "src/ui/settings/custom/preview_data.ts",
    anchor: 'token: tok.replace(/^#/, "").replace(/^\\[\\[|\\]\\]$/g, ""),',
    /* `tok` на месте вызова уже обрезан: `String(token || "").trim()` строкой выше. */
    fn: (token) => String(token || "").trim().replace(/^#/, "").replace(/^\[\[|\]\]$/g, ""),
  },
  {
    group: "bare-token",
    id: "fields_model.shown",
    file: "src/ui/settings/custom/fields_model.ts",
    anchor: '? token.replace(/^\\[\\[|\\]\\]$/g, "").replace(/^#/, "").trim()',
    fn: (token) => String(token).replace(/^\[\[|\]\]$/g, "").replace(/^#/, "").trim(),
  },
  {
    group: "bare-token",
    id: "fields_model.bare",
    file: "src/ui/settings/custom/fields_model.ts",
    anchor: 'const bare = (tok: string): string => tok.replace(/^\\[\\[|\\]\\]$/g, "");',
    fn: (token) => String(token).replace(/^\[\[|\]\]$/g, ""),
  },
  {
    group: "bare-token",
    id: "fields_model.tokenPlain",
    file: "src/ui/settings/custom/fields_model.ts",
    anchor: 'const tokenPlain = String(token).replace(/^\\[\\[|\\]\\]$/g, "").trim();',
    fn: (token) => String(token).replace(/^\[\[|\]\]$/g, "").trim(),
  },
];

/* --------------------------------------------------------------- контроли */

function controlTranscription() {
  const bad = [];
  for (const site of SITES) {
    const full = path.join(ROOT, site.file);
    let text = "";
    try { text = fs.readFileSync(full, "utf8"); } catch (_) {
      bad.push(site.id + ": файла нет — " + site.file);
      continue;
    }
    if (text.indexOf(site.anchor) < 0) {
      bad.push(site.id + ": строки исходника в файле больше нет — тело переписано с того, чего там не стоит");
    }
  }
  return bad;
}

function controlCorpus(corpus) {
  const need = [
    ["ссылка в скобках", (s) => /^\[\[[^\]]+\]\]$/.test(s)],
    ["ссылка с подписью", (s) => /^\[\[[^\]|]+\|[^\]]+\]\]$/.test(s)],
    ["тег", (s) => /^#\S+$/.test(s)],
    ["имя без скобок", (s) => /^[A-Za-z0-9]+$/.test(s)],
    ["решётка перед скобками", (s) => /^#\[\[/.test(s)],
    ["пусто", (s) => s.trim() === ""],
  ];
  const bad = [];
  for (const [name, test] of need) {
    if (!corpus.some((c) => test(c.value))) bad.push("в корпусе нет формы «" + name + "»");
  }
  return bad;
}

/**
 * Контроль самой меры: пара, разведённая нарочно, обязана попасть в
 * расхождения. Без него «ноль расхождений» бывает нулём от слепоты (У-142).
 */
function controlMeasureSeesDivergence(corpus) {
  const probes = [
    { id: "control.a", fn: (t) => String(t).replace(/^\[\[|\]\]$/g, "") },
    { id: "control.b", fn: (t) => String(t).toUpperCase() },
  ];
  const diff = compare(probes, corpus);
  return diff.length ? [] : ["мера не увидела нарочно разведённой пары — она слепа"];
}

/* ----------------------------------------------------------------- сверка */

function compare(sites, corpus) {
  const rows = [];
  for (const c of corpus) {
    const answers = sites.map((s) => {
      try { return { id: s.id, out: JSON.stringify(s.fn(c.value)) }; }
      catch (e) { return { id: s.id, out: "БРОСИЛО: " + String(e && e.message) }; }
    });
    const distinct = new Set(answers.map((a) => a.out));
    if (distinct.size > 1) rows.push({ input: c, answers });
  }
  return rows;
}

function groupsOf(sites) {
  const map = new Map();
  for (const s of sites) {
    if (!map.has(s.group)) map.set(s.group, []);
    map.get(s.group).push(s);
  }
  return map;
}

/* ------------------------------------------------------------------ прогон */

function main() {
  const corpus = []
    .concat(corpusFromHisConfig().map((v) => ({ value: v, from: "его конфиг" })))
    .concat(corpusFromHisNotes().map((v) => ({ value: v, from: "его заметки" })))
    .concat(SYNTHETIC_EDGES.map((v) => ({ value: v, from: "край (синтетика)" })));

  const problems = []
    .concat(controlTranscription())
    .concat(controlCorpus(corpus))
    .concat(controlMeasureSeesDivergence(corpus));

  console.log("Корпус: " + corpus.length + " входов" +
    " (его конфиг " + corpus.filter((c) => c.from === "его конфиг").length +
    ", его заметки " + corpus.filter((c) => c.from === "его заметки").length +
    ", края " + corpus.filter((c) => c.from === "край (синтетика)").length + ")");
  console.log("");

  if (problems.length) {
    console.log("КОНТРОЛЬ НЕ ПРОЙДЕН — числам ниже верить нельзя:");
    for (const p of problems) console.log("  ! " + p);
    console.log("");
  } else {
    console.log("Контроли пройдены: переписывание, корпус, чувствительность меры");
    console.log("");
  }

  let totalDiverging = 0;
  for (const [group, sites] of groupsOf(SITES)) {
    const rows = compare(sites, corpus);
    totalDiverging += rows.length;
    console.log("== группа «" + group + "»: " + sites.length + " мест, расхождений " +
      rows.length + " из " + corpus.length + " входов");
    for (const s of sites) console.log("   - " + s.id + "  (" + s.file + ")");
    if (rows.length) {
      console.log("   расходятся на:");
      for (const r of rows) {
        console.log("     вход " + JSON.stringify(r.input.value) + "  [" + r.input.from + "]");
        for (const a of r.answers) console.log("        " + a.id.padEnd(30) + " -> " + a.out);
      }
    }
    if (sites.length > 1) {
      console.log("   попарно (0 значит «на всех входах отвечают одинаково» — только такую пару можно сводить):");
      for (let i = 0; i < sites.length; i++) {
        for (let j = i + 1; j < sites.length; j++) {
          const rows = compare([sites[i], sites[j]], corpus);
          const n = rows.length;
          const mark = n === 0 ? "  <= сводимо" : "";
          console.log("     " + sites[i].id.padEnd(30) + " x " + sites[j].id.padEnd(30) + " " + String(n).padStart(3) + mark);
          /* У узкой пары расхождения печатаются целиком: именно они и решают,
             можно ли её свести, — а их мало и они читаются глазами. */
          if (n > 0 && n <= 6) {
            for (const r of rows) {
              console.log("         на " + JSON.stringify(r.input.value).padEnd(24) + " [" + r.input.from + "]  " +
                r.answers.map((a) => a.out).join("  vs  "));
            }
          }
        }
      }
      console.log("");
    }
    if (SHOW_ALL) {
      console.log("   все входы:");
      for (const c of corpus) {
        const outs = sites.map((s) => s.id + "=" + JSON.stringify(s.fn(c.value))).join("  ");
        console.log("     " + JSON.stringify(c.value).padEnd(28) + " " + outs);
      }
    }
    console.log("");
  }

  console.log("Итого расхождений: " + totalDiverging);
  console.log("Сводить можно только группу с нулём — и только после мутации в обе стороны (У-92).");
  process.exitCode = problems.length ? 1 : 0;
}

main();
