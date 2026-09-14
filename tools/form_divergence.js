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
 * Контролей четыре, и каждый на свой шаг обхода (У-142):
 *   1. переписывание   — тело и правда стоит в названном файле;
 *   2. полнота списка  — сплошной обход слоя настроек, и каждое найденное
 *                        место обязано быть в списке ниже (У-111);
 *   3. корпус          — в нём есть каждая форма, ради которой он собран;
 *   4. сама мера       — нарочно разведённая пара обязана попасть в расхождения.
 *
 * Второй куплен мутацией: возврат снятой копии в другой файл прошёл мимо
 * стенда незамеченным, потому что список мест был написан рукой.
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
    /* Дом слоя настроек. До 2026-09-15 то же тело стояло здесь и в
       `fields_editor_view.ts`; сверены на всём корпусе, разошлись на нуле, и
       вторая копия снята (10.13.140). Переписывать больше нечего. */
    group: "bare-token",
    id: "preview_data.bareToken (дом)",
    file: "src/ui/settings/custom/preview_data.ts",
    anchor: "export function bareToken(token: string): string {",
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

/* ------------------------------------ «каким выводом печатается это поле» */

/**
 * Тот же вопрос объявлен в трёх местах, и два из них — настоящие функции
 * движков, третье — замыкание внутри функции помощников. Первые два зовутся
 * настоящими, третье переписано под контролем на переписывание.
 *
 * Мера здесь своя: вход — не строка, а пара «поле и правила», поэтому она
 * стоит отдельным прогоном, а не в общей сводке групп.
 */
function outputModeSites() {
  const preload = require(path.join(ROOT, "src", "core", "pkm_runtime_preload_facade.js"));
  /* Шов ставится прослойкой плагина, а не присваиванием своей рукой (У-42). */
  preload.loadRulesRuntimeHelpers();
  const panel = require(path.join(ROOT, "pkm_v2", "TagWheel", "tagwheel.js"));
  const core = require(path.join(ROOT, "pkm_v2", "TagWheel", "tagwheel_core.js"));
  return [
    {
      id: "tagwheel.resolveFieldOutputMode",
      file: "pkm_v2/TagWheel/tagwheel.js",
      anchor: null,
      fn: (field, rules) => panel.resolveFieldOutputMode(field, rules),
    },
    {
      id: "tagwheel_core.resolveFieldOutputMode",
      file: "pkm_v2/TagWheel/tagwheel_core.js",
      anchor: null,
      fn: (field, rules) => core.resolveFieldOutputMode(field, rules),
    },
    {
      /* Дом. До 2026-09-15 здесь стояло замыкание внутри `buildTagTokenKeyMap`,
         и его тело было переписано в стенд под контролем на переписывание.
         Теперь это настоящая экспортированная функция, и переписывать нечего. */
      id: "helpers.resolveFieldOutputMode (дом)",
      file: "src/core/pkm_rules_runtime_helpers.js",
      anchor: null,
      fn: (field, rules) => globalThis.__inlinePkmRulesHelpers.resolveFieldOutputMode(field, rules),
    },
  ];
}

/** Поля берутся у него; края названы отдельно и помечены. */
function fieldCorpus() {
  const out = [];
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  (function walk(o) {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o !== "object") return;
    if (typeof o.id === "string" && ("source" in o || "prefix" in o || "kind" in o)) {
      out.push({ field: o, from: "его конфиг" });
    }
    for (const k of Object.keys(o)) walk(o[k]);
  })(raw);
  const edges = [
    {}, { source: "projects" }, { source: "wikilinks:X" }, { source: "tagsrc" },
    { outputMode: "WIKILINK" }, { outputMode: "  tag  " }, { outputMode: "" },
    { source: "" }, { source: "wikilinks:" }, { source: "  projects  " },
  ];
  for (const e of edges) out.push({ field: Object.assign({ id: "край" }, e), from: "край (синтетика)" });
  return out;
}

const RULE_SETS = [
  {},
  { projects: { output: "wikilink" } },
  { projects: { output: "tag" } },
  { tagsrc: { output: "wikilink" } },
  { tagsrc: { output: "TAG" } },
  { tagsrc: { output: "" } },
];

function reportOutputMode() {
  const sites = outputModeSites();
  const fields = fieldCorpus();
  console.log("== вопрос «каким выводом печатается это поле»: " + sites.length + " объявлений");
  for (const s of sites) console.log("   - " + s.id + "  (" + s.file + ")");

  /* Контроль на переписывание — у того места, чьё тело переписано. */
  for (const s of sites) {
    if (!s.anchor) continue;
    const text = fs.readFileSync(path.join(ROOT, s.file), "utf8");
    if (text.indexOf(s.anchor) < 0) {
      console.log("   ! " + s.id + ": строки исходника в файле больше нет — числам ниже верить нельзя");
    }
  }

  let pairs = 0;
  const diverging = [];
  for (const f of fields) {
    for (const r of RULE_SETS) {
      pairs++;
      const answers = sites.map((s) => {
        try { return String(s.fn(f.field, r)); } catch (e) { return "БРОСИЛО: " + String(e && e.message); }
      });
      if (new Set(answers).size > 1) diverging.push({ f, r, answers });
    }
  }
  console.log("   пар «поле × правила»: " + pairs + ", расхождений: " + diverging.length);
  for (const d of diverging.slice(0, 12)) {
    console.log("     " + JSON.stringify(d.f.field).slice(0, 64) + " + " + JSON.stringify(d.r));
    sites.forEach((s, i) => console.log("        " + s.id.padEnd(34) + " -> " + d.answers[i]));
  }

  /* Контроль самой меры: нарочно разведённая сторона обязана попасть в счёт. */
  let seen = 0;
  for (const f of fields) {
    for (const r of RULE_SETS) {
      if (String(sites[0].fn(f.field, r)) !== String(sites[1].fn(f.field, r)).toUpperCase()) seen++;
    }
  }
  console.log("   контроль чувствительности: нарочно испорченная сторона расходится на " +
    seen + " парах из " + pairs + (seen ? "" : "  <= МЕРА СЛЕПА"));
  console.log("");
  return diverging.length;
}

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

/**
 * **Контроль на полноту списка мест** (У-111). `SITES` — список, написанный
 * рукой, и он слеп к месту, которое заведут завтра: первая же мутация «вернуть
 * копию в другой файл» прошла мимо стенда незамеченной. Поэтому слой настроек
 * обходится сплошь, и каждое место, снимающее скобки ссылки, обязано быть либо
 * в списке, либо здесь названо.
 *
 * Образец узкий нарочно: снятие обёртки `[[…]]` у **целого** токена. Обход
 * ищет его в тексте как есть — маску комментариев тут заводить не за чем: то,
 * что мы ищем, в комментариях этого слоя не пишут, а ложная находка дешевле
 * пропущенной (направление ошибки выбрано, У-192).
 */
function controlSitesComplete() {
  const dir = path.join(ROOT, "src", "ui", "settings");
  const needle = "replace(/^\\[\\[|\\]\\]$/g";
  const known = new Set(SITES.map((s) => s.file));
  const found = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.(ts|js)$/.test(name)) continue;
      const text = fs.readFileSync(full, "utf8");
      let at = text.indexOf(needle);
      while (at >= 0) {
        found.push({ rel: path.relative(ROOT, full).split(path.sep).join("/"), at });
        at = text.indexOf(needle, at + 1);
      }
    }
  };
  walk(dir);

  /* Положительный контроль обхода: он обязан хоть что-то находить. Ноль
     означал бы, что образец промахнулся, а не что мест не осталось (У-119). */
  if (!found.length) return ["обход слоя настроек не нашёл ни одного места — образец промахнулся"];

  const bad = [];
  for (const hit of found) {
    if (!known.has(hit.rel)) {
      bad.push("место снятия скобок в " + hit.rel + " не значится в списке стенда — " +
        "либо впишите его, либо оно и есть возвращённая копия");
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
    .concat(controlSitesComplete())
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
    console.log("Контроли пройдены: переписывание, полнота списка мест, корпус, чувствительность меры");
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

  totalDiverging += reportOutputMode();

  console.log("Итого расхождений: " + totalDiverging);
  console.log("Сводить можно только группу с нулём — и только после мутации в обе стороны (У-92).");
  process.exitCode = problems.length ? 1 : 0;
}

main();
