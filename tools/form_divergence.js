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

/* Маска «где код, а где рассказ о коде» — общая с `tools/rule_copies.js`. */
const maskCode = require("./rule_copies.js").mask;

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

/* ------------------------------ «приставка поля + значение» (composeToken) */

/**
 * Правило «как приставка поля склеивается со значением» — то, что решает,
 * каким значение встанет в строку.
 *
 * **Объявлений было четыре, стало одно** (2026-09-15, его слово «убирать
 * лишнее в самом правиле»). До сведения: 73 расхождения из 136 пар, и три
 * тела из четырёх на паре «приставка `#` + значение `#todo`» давали
 * `##todo` — на 17 парах каждое. Прежние тела здесь **не хранятся**: копия
 * снятого тела — это ещё одно объявление правила, и стареет она молча.
 *
 * Что стережёт стенд теперь — две вещи, и они разные (У-194, У-195):
 *   - **ответ дома**: удвоенной приставки на выходе не бывает ни на одной
 *     паре, и её число печатается вслух. Это ловит поломку самого дома;
 *   - **форма**: сплошным обходом рантайма — что своего тела не завёл никто.
 *     Это ловит возврат копии, до которого ответом не дотянуться.
 *
 * Мера здесь своя: вход — **пара** «приставка и значение», а не один токен.
 */
function composeSites() {
  const shared = require(path.join(ROOT, "src", "core", "shared_utils.js"));
  return [
    {
      id: "shared_utils (дом)",
      file: "src/core/shared_utils.js",
      anchor: null,
      fn: (prefix, rawToken) => shared.composeToken(prefix, rawToken),
    },
  ];
}

/** Приставки берутся у него, а не пишутся здесь литералами (У-182). */
function prefixCorpus() {
  const out = [];
  const seen = new Set();
  const add = (v, from) => {
    const s = String(v == null ? "" : v);
    if (seen.has(s)) return;
    seen.add(s);
    out.push({ value: s, from });
  };
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  (function walk(o) {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      if (k === "prefix" && typeof o[k] === "string") add(o[k], "его конфиг");
      walk(o[k]);
    }
  })(raw);
  /*
   * Края. У заказчика приставка сегодня одна — решётка, — и на ней вопрос «а
   * что, если приставка не решётка» не задаётся вовсе. Он же и есть тот край,
   * на котором тела расходятся сильнее всего: одно из четырёх пропускает
   * **любой готовый тег** насквозь, то есть приставку не применяет.
   */
  add("", "край (синтетика)");
  add("#", "край (синтетика)");
  add("@", "край (синтетика)");
  add("📅", "край (синтетика)");
  return out;
}

/**
 * Полнота списка мест — сплошным обходом рантайма, а не рукой (У-111).
 * Делегат от объявления отличается **формой**: в теле стоит вызов
 * `.composeToken(` у кого-то другого.
 *
 * Контроль двусторонний: каждое найденное обязано быть в списке, и каждое
 * место списка обязано найтись обходом — иначе образец промахнулся (У-142).
 */
function composeSitesComplete(sites) {
  const listed = new Set(sites.map((s) => s.file));
  const found = new Set();
  const bad = [];
  const skipDir = new Set(["node_modules", "dist", ".git", "tests", "docs", "tools"]);
  const isDecl = (line) =>
    /function\s+composeToken\s*\(/.test(line) ||
    /composeToken\s*[:=]\s*(?:function\s*)?\(/.test(line) ||
    /composeToken\s*[:=]\s*(?:async\s*)?\([^)]*\)\s*=>/.test(line);
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      if (skipDir.has(name)) continue;
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.js$/.test(name)) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join("/");
      const lines = fs.readFileSync(full, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!isDecl(lines[i])) continue;
        /* Делегат: тело зовёт чужой `composeToken`. Десяти строк хватает —
           все тела здесь короче, и длиннее им быть незачем. */
        if (/\.composeToken\(/.test(lines.slice(i, i + 10).join("\n"))) continue;
        found.add(rel);
        if (!listed.has(rel)) {
          bad.push("объявление composeToken в " + rel + ":" + (i + 1) + " не значится в списке мест");
        }
      }
    }
  };
  walk(ROOT);
  for (const f of listed) {
    if (!found.has(f)) bad.push("обход не нашёл объявления в " + f + " — образец промахнулся, числам верить нельзя");
  }
  return bad;
}

function reportCompose() {
  const sites = composeSites();
  const prefixes = prefixCorpus();
  const tokens = []
    .concat(corpusFromHisConfig().map((v) => ({ value: v, from: "его конфиг" })))
    .concat(SYNTHETIC_EDGES.map((v) => ({ value: v, from: "край (синтетика)" })));

  console.log("== вопрос «как приставка поля склеивается со значением»: " + sites.length + " объявлений");
  for (const s of sites) console.log("   - " + s.id + "  (" + s.file + ")");

  const problems = [];
  for (const s of sites) {
    if (!s.anchor) continue;
    const text = fs.readFileSync(path.join(ROOT, s.file), "utf8");
    if (text.indexOf(s.anchor) < 0) {
      problems.push(s.id + ": строки исходника, из которой тело переписано, в файле больше нет");
    }
  }
  for (const p of composeSitesComplete(sites)) problems.push(p);

  const answerOf = (s, pf, tk) => {
    try { return String(s.fn(pf, tk)); }
    catch (e) { return "БРОСИЛО: " + String(e && e.message); }
  };
  const ask = (s, pf, tk) => JSON.stringify(answerOf(s, pf, tk));

  let pairs = 0;
  const diverging = [];
  const doubled = new Map(sites.map((s) => [s.id, 0]));
  for (const pf of prefixes) {
    for (const tk of tokens) {
      pairs++;
      const answers = sites.map((s) => ask(s, pf.value, tk.value));
      if (new Set(answers).size > 1) diverging.push({ pf, tk, answers });
      /* Удвоенная приставка — тот самый `##todo`, ради которого всё это.
         Считается только **добавленная** приставка: значение, у которого
         приставка стояла дважды с самого начала, правило не удваивало. */
      if (pf.value && !String(tk.value).trim().startsWith(pf.value + pf.value)) {
        for (const s of sites) {
          const out = answerOf(s, pf.value, tk.value);
          if (out.startsWith(pf.value + pf.value)) doubled.set(s.id, doubled.get(s.id) + 1);
        }
      }
    }
  }

  console.log("   пар «приставка × значение»: " + pairs +
    " (приставок " + prefixes.length + ", значений " + tokens.length + "), расхождений: " + diverging.length);
  console.log("   удвоенная приставка на выходе (его решение 2026-09-15 — ни одной):");
  for (const s of sites) {
    const n = doubled.get(s.id);
    console.log("      " + s.id.padEnd(30) + " " + String(n).padStart(4) + " пар" + (n ? "   <= УДВАИВАЕТ" : ""));
    if (n) problems.push(s.id + ": приставка удваивается на " + n + " парах");
  }

  if (sites.length > 1) {
    console.log("   попарно (0 значит «на всех парах отвечают одинаково»):");
    for (let i = 0; i < sites.length; i++) {
      for (let j = i + 1; j < sites.length; j++) {
        let n = 0;
        for (const pf of prefixes) {
          for (const tk of tokens) {
            if (ask(sites[i], pf.value, tk.value) !== ask(sites[j], pf.value, tk.value)) n++;
          }
        }
        console.log("     " + sites[i].id.padEnd(30) + " x " + sites[j].id.padEnd(30) +
          " " + String(n).padStart(4) + (n === 0 ? "  <= сводимо" : ""));
      }
    }
  }

  if (SHOW_ALL) {
    for (const d of diverging) {
      console.log("     приставка " + JSON.stringify(d.pf.value) + " + значение " + JSON.stringify(d.tk.value));
      sites.forEach((s, i) => console.log("        " + s.id.padEnd(30) + " -> " + d.answers[i]));
    }
  }

  /* Контроль самой меры: нарочно разведённая сторона обязана попасть в счёт.
     Портится **копия** первого места, а не соседнее — иначе контроль отвечал
     бы на «расходятся ли эти двое», а не на «видит ли мера расхождение». */
  const spoiled = { id: "control", fn: (pf, tk) => answerOf(sites[0], pf, tk) + "x" };
  let seen = 0;
  for (const pf of prefixes) {
    for (const tk of tokens) {
      if (ask(sites[0], pf.value, tk.value) !== ask(spoiled, pf.value, tk.value)) seen++;
    }
  }
  console.log("   контроль чувствительности: нарочно испорченная сторона расходится на " +
    seen + " парах из " + pairs + (seen ? "" : "  <= МЕРА СЛЕПА"));
  if (!seen) problems.push("мера не увидела нарочно разведённой пары — она слепа");
  for (const p of problems) console.log("   ! " + p);
  console.log("");
  return diverging.length + problems.length;
}

/* ------------------------------------------ «найти ссылки в тексте строки» */

/**
 * Четвёртое место остатка: **обход ссылок в тексте**. Здесь у каждого читателя
 * свой образец, и вопрос у всех один — «где в этой строке ссылки».
 *
 * Дом рантайма держит форму ссылки как строку — `WIKILINK_TOKEN_SRC`, — и
 * образцы мест сверяются **с ней**, а не друг с другом: сравнивать двух
 * читателей между собой значит не увидеть расхождения обоих с тем, кто
 * предмет пишет (У-122).
 *
 * Вход — целая строка, а не токен, поэтому мера своя.
 */
function scanSites() {
  const shared = require(path.join(ROOT, "src", "core", "shared_utils.js"));
  const homeSrc = shared.WIKILINK_TOKEN_SRC;
  const all = (re, text) => {
    const out = [];
    const rx = new RegExp(re.source, re.flags.indexOf("g") >= 0 ? re.flags : re.flags + "g");
    let m;
    while ((m = rx.exec(String(text))) !== null) {
      out.push(m[0]);
      if (m.index === rx.lastIndex) rx.lastIndex++;
    }
    return JSON.stringify(out);
  };
  return [
    {
      id: "дом (WIKILINK_TOKEN_SRC)",
      file: "src/core/shared_utils.js",
      anchor: null,
      fn: (text) => all(new RegExp(homeSrc, "g"), text),
    },
    {
      id: "editor_visuals_config.pushAll",
      file: "src/core/editor_visuals_config.js",
      anchor: 'pushAll(/\\[\\[[^\\][\\n]+\\]\\]/g, "link");',
      fn: (text) => all(/\[\[[^\][\n]+\]\]/g, text),
    },
  ];
}

/** Строки берутся у него целиком: обход ищет в строке, а не в токене. */
function lineCorpus() {
  const out = [];
  const seen = new Set();
  for (const name of fs.readdirSync(VAULT).filter((n) => /\.md$/i.test(n))) {
    let text = "";
    try { text = fs.readFileSync(path.join(VAULT, name), "utf8"); } catch (_) { continue; }
    for (const line of String(text).split("\n")) {
      if (line.indexOf("[[") < 0) continue;
      if (seen.has(line)) continue;
      seen.add(line);
      out.push({ value: line, from: "его заметки" });
    }
  }
  const edges = [
    "[[a]]",
    "текст [[a]] и [[b]] хвост",
    "[[a[b]]",
    "[[a|подпись]] текст",
    "[[#heading]]",
    "[[a]] [[b]]",
    "[[",
    "]]",
    "[[]]",
    "- [ ] [[a]] :: [[b]]",
    "[[a\nb]]",
    "[[a]]]]",
    "[[кириллица с пробелом]]",
  ];
  for (const e of edges) out.push({ value: e, from: "край (синтетика)" });
  return out;
}

function reportScan() {
  const sites = scanSites();
  const lines = lineCorpus();
  console.log("== вопрос «где в этой строке ссылки»: " + sites.length + " образцов");
  for (const s of sites) console.log("   - " + s.id + "  (" + s.file + ")");

  for (const s of sites) {
    if (!s.anchor) continue;
    const text = fs.readFileSync(path.join(ROOT, s.file), "utf8");
    if (text.indexOf(s.anchor) < 0) {
      console.log("   ! " + s.id + ": строки исходника в файле больше нет — числам ниже верить нельзя");
    }
  }

  /* Сверяется каждый с домом, а не все со всеми (У-122). */
  const home = sites[0];
  let diverging = 0;
  for (const s of sites.slice(1)) {
    const bad = [];
    for (const l of lines) {
      if (s.fn(l.value) !== home.fn(l.value)) bad.push(l);
    }
    diverging += bad.length;
    console.log("   " + s.id.padEnd(34) + " против дома: расхождений " + bad.length + " из " + lines.length);
    for (const b of bad.slice(0, 4)) {
      console.log("      на " + JSON.stringify(b.value).slice(0, 70) + "  [" + b.from + "]");
      console.log("         дом  -> " + home.fn(b.value));
      console.log("         оно  -> " + s.fn(b.value));
    }
  }

  /* Контроль чувствительности: нарочно суженный образец обязан разойтись. */
  const narrow = (text) => JSON.stringify([]);
  let seen = 0;
  for (const l of lines) if (narrow(l.value) !== home.fn(l.value)) seen++;
  console.log("   контроль чувствительности: пустой образец расходится с домом на " +
    seen + " строках из " + lines.length + (seen ? "" : "  <= МЕРА СЛЕПА"));
  console.log("");
  return diverging;
}

/* --------------------------------------- «что такое наша метка» (1и очереди) */

/**
 * Вопрос «какие метки элементов у нас бывают» объявлен в рантайме **пять**
 * раз, и очередь (`REMAINING_WORK.md`, раздел 1и) знала о двух.
 *
 * **Почему меру нельзя было снять обходом.** На его настройках все списки
 * совпадают до знака — у него одна метка на поле и записана она одним
 * способом, — и `node tools/line_matrix.js` показать расхождение не может в
 * принципе (У-147). Разводится это не глазами, а корпусом: его живые правила
 * плюс их же мутации, каждая из которых объявляет метку **ровно одним**
 * способом.
 *
 * **И первый вывод этой меры был неверен.** Она сказала «`dates.markers` не
 * пишет никто», потому что писателя искали образцом с отступом в начале
 * строки, а он записан инлайном — три вызова в `navigation_runtime.js`, и
 * это её шов, а не мёртвый ключ (У-119: контроль ставится до первого вывода).
 * Поэтому обход полноты ниже ищет и читателей, и писателей.
 *
 * **Правила берутся живыми, а не собранными здесь** (У-2, У-182). Форму,
 * которую видят движки, целиком не строит ни один модуль: `buildRulesForEngines`
 * даёт её без `behavior.dateRuntimeConfig`, а тот приезжает движку ключом
 * команды и приклеивается уже внутри. Поэтому корпус снимается **перехватом**
 * на настоящем прогоне через `tools/line_bench.js` — третьего стенда здесь не
 * заводится (У-197).
 */
/**
 * Метки-кандидаты, которыми спрашивают места-предикаты. Список **выводится**
 * из ответов остальных мест на том же корпусе, а не пишется здесь литералом
 * (У-182): метка принадлежит его настройкам, а не этому файлу.
 */
const MARKER_CANDIDATES = [];

/* Метка, которой нет ни в его настройках, ни где-либо ещё: по ней видно, кто
   узнал объявленное одним способом, а кто нет. */
const FRESH_MARKER = "\u{1F9ED}";

function markerSites() {
  const preload = require(path.join(ROOT, "src", "core", "pkm_runtime_preload_facade.js"));
  /* Шов ставится прослойкой плагина, а не присваиванием своей рукой (У-42). */
  preload.loadRulesRuntimeHelpers();
  const linePipeline = require(path.join(ROOT, "src", "core", "line_pipeline.js"));
  const finalize = require(path.join(ROOT, "src", "core", "pkm_line_finalize_unified.js"));
  const core = require(path.join(ROOT, "pkm_v2", "TagWheel", "tagwheel_core.js"));
  const uniqSorted = (list) => Array.from(new Set(
    (Array.isArray(list) ? list : []).map((x) => String(x == null ? "" : x).trim()).filter(Boolean)
  )).sort();
  return [
    {
      /* Дом: тот, у кого метку спрашивают движки перемещения. */
      id: "дом (getDateMarkersFromRules)",
      file: "src/core/pkm_rules_runtime_helpers.js",
      anchor: null,
      fn: (rules) => {
        const m = globalThis.__inlinePkmRulesHelpers.getDateMarkersFromRules(rules) || {};
        return uniqSorted([].concat(m.due || [], m.start || [], m.time || [], m.all || []));
      },
    },
    {
      id: "line_pipeline.fieldsShape",
      file: "src/core/line_pipeline.js",
      anchor: null,
      fn: (rules) => uniqSorted(linePipeline.fieldsShape(rules).markers),
    },
    {
      id: "finalize.getRightMarkersUnified",
      file: "src/core/pkm_line_finalize_unified.js",
      anchor: null,
      fn: (rules) => uniqSorted(finalize.getRightMarkersUnified(rules)),
    },
    {
      id: "tagwheel_core.getDateLikeMarkers",
      file: "pkm_v2/TagWheel/tagwheel_core.js",
      anchor: null,
      fn: (rules) => uniqSorted(core.getDateLikeMarkers(rules)),
    },
    {
      /*
       * **Действующий ответ этого места, а не первый его ход** (У-151).
       * `getDateLikeMarkers` бывает пустым, и тогда метку узнаёт запасной
       * список внутри `isDateLikeToken` — на его настройках именно так. Ответ
       * снимается **вопросом к самой функции**: у каждой метки-кандидата
       * спрашивается токен с ней, и в список идут те, о которых сказано «да».
       */
      id: "tagwheel_core.isDateLikeToken",
      file: "pkm_v2/TagWheel/tagwheel_core.js",
      anchor: null,
      fn: (rules) => uniqSorted(MARKER_CANDIDATES.filter(
        (mk) => core.isDateLikeToken(mk + "2026-09-15", rules)
      )),
    },
    {
      /*
       * **Шов навигации — отдельный вход того же вопроса.**
       *
       * `rules.dates.markers` пишут ровно три вызова, и все три в
       * `navigation_runtime.js`: у навигации свой формат строки, и метки она
       * подаёт общим помощникам этим ключом. Дорогам движков он не
       * принадлежит — там метка приезжает полем Order или строкой
       * `dateRuntimeConfig`. Место стоит здесь затем, чтобы видеть, кто этот
       * вход читает, а кто нет.
       */
      id: "шов навигации (dates.markers)",
      file: "navigation_runtime.js",
      anchor: "const rules = { io: { separator1: sep1, separator2: sep2 }, dates: { markers } };",
      fn: (rules) => uniqSorted(
        Array.isArray(rules && rules.dates && rules.dates.markers) ? rules.dates.markers : []
      ),
    },
  ];
}

/**
 * Живые правила заказчика — те самые, что видит движок на настоящем прогоне.
 *
 * Перехват стоит на `splitSegments`: её зовут обе дороги и зовут с правилами.
 * Контролей два — поймано хоть что-то, и поймано **его**: у его настроек в
 * `dateRuntimeConfig` лежит непустой `byField`.
 */
async function liveRulesOfHisConfig() {
  const bench = require(path.join(ROOT, "tools", "line_bench.js"));
  const linePipeline = require(path.join(ROOT, "src", "core", "line_pipeline.js"));
  const caught = [];
  const orig = linePipeline.splitSegments;
  linePipeline.splitSegments = function (line, rules) {
    caught.push(rules);
    return orig.apply(this, arguments);
  };
  const problems = [];
  try {
    const cfg = bench.loadCfg();
    const keys = bench.fieldKeysBySide(cfg, "right");
    if (!keys.length) problems.push("в его Order нет ни одного правого поля — корпус меток не на чем строить");
    for (const key of keys) {
      try {
        await bench.runCommandById(cfg, bench.fieldCommandId(cfg, key, "next"), "- [ ] #todo :: текст", 0);
      } catch (_) { /* команда этого поля могла не завестись — корпус соберут остальные */ }
    }
  } finally {
    linePipeline.splitSegments = orig;
  }
  if (!caught.length) problems.push("перехват правил не поймал ни одного вызова — корпус пуст, числам верить нельзя");
  const withCfg = caught.filter((r) => {
    const rt = r && r.behavior && r.behavior.dateRuntimeConfig;
    return rt && rt.byField && Object.keys(rt.byField).length > 0;
  });
  if (caught.length && !withCfg.length) {
    problems.push("пойманные правила без `dateRuntimeConfig` — это не его настройки, а огрызок");
  }
  return { rules: (withCfg[0] || caught[0] || null), problems };
}

/**
 * Корпус: его живые правила и их мутации, объявляющие метку **ровно одним**
 * способом. Каждая мутация названа и проверена на то, что она и правда
 * сделала то, что обещает именем (У-189): форма, которой не признаёт никто,
 * отвечала бы нулём расхождений от собственной негодности.
 */
function ruleCorpus(live) {
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const fieldsOf = (rules, side) => {
    const node = rules && rules[side];
    return node && Array.isArray(node.fields) ? node.fields : [];
  };
  const markedField = (rules) => {
    for (const side of ["rightMode", "leftMode"]) {
      for (const f of fieldsOf(rules, side)) {
        if (f && String(f.marker || "").trim()) return { side, id: String(f.id || "") };
      }
    }
    return null;
  };

  const out = [{ name: "его живые правила", rules: live, from: "его конфиг", check: null }];
  const home = markedField(live);
  if (!home) {
    return { corpus: out, problems: ["в его правилах нет ни одного поля с меткой — мутации строить не из чего"] };
  }
  const takeField = (rules, side, id) => fieldsOf(rules, side).filter((f) => String(f && f.id || "") === id)[0] || null;
  const problems = [];
  const add = (name, build, check) => {
    const r = clone(live);
    build(r);
    const bad = check(r);
    if (bad) problems.push("мутация «" + name + "»: " + bad);
    out.push({ name, rules: r, from: "мутация его правил", check: null });
  };

  const FRESH = FRESH_MARKER;

  add("метка только швом навигации (dates.markers)", (r) => {
    r.dates = { markers: [FRESH] };
  }, (r) => (Array.isArray(r.dates && r.dates.markers) && r.dates.markers[0] === FRESH
    ? "" : "ключ dates.markers не выставился"));

  add("поле с меткой уехало в левый Block", (r) => {
    const f = takeField(r, home.side, home.id);
    const other = home.side === "rightMode" ? "leftMode" : "rightMode";
    r[home.side].fields = fieldsOf(r, home.side).filter((x) => x !== f);
    if (!r[other] || !Array.isArray(r[other].fields)) r[other] = { fields: [] };
    r[other].fields.push(f);
  }, (r) => {
    const other = home.side === "rightMode" ? "leftMode" : "rightMode";
    return takeField(r, other, home.id) && !takeField(r, home.side, home.id)
      ? "" : "поле не переехало";
  });

  add("метка снята с поля и осталась только в dateRuntimeConfig", (r) => {
    const f = takeField(r, home.side, home.id);
    if (f) f.marker = "";
  }, (r) => {
    const f = takeField(r, home.side, home.id);
    const rt = r.behavior && r.behavior.dateRuntimeConfig;
    const byField = rt && rt.byField ? rt.byField : {};
    const row = byField[home.id] || null;
    if (f && String(f.marker || "").trim()) return "метка с поля не снялась";
    if (!row || !String((row.emoji || row.marker) || "").trim()) {
      return "в dateRuntimeConfig у этого поля метки нет — мутация объявляет метку ноль раз, а не один";
    }
    return "";
  });

  add("в dateRuntimeConfig метка записана ключом marker, а не emoji", (r) => {
    const f = takeField(r, home.side, home.id);
    if (f) f.marker = "";
    const rt = r.behavior && r.behavior.dateRuntimeConfig;
    const row = rt && rt.byField ? rt.byField[home.id] : null;
    if (row) {
      const mk = String(row.emoji || row.marker || "").trim();
      delete row.emoji;
      row.marker = mk;
    }
  }, (r) => {
    const rt = r.behavior && r.behavior.dateRuntimeConfig;
    const row = rt && rt.byField ? rt.byField[home.id] : null;
    if (!row) return "строки поля в dateRuntimeConfig нет";
    return !row.emoji && String(row.marker || "").trim() ? "" : "ключ emoji не сменился на marker";
  });

  add("у поля с меткой нет orderKey", (r) => {
    const f = takeField(r, home.side, home.id);
    if (f) f.orderKey = "";
  }, (r) => {
    const f = takeField(r, home.side, home.id);
    return f && !String(f.orderKey || "").trim() ? "" : "orderKey не снялся";
  });

  add("у поля с меткой пустой kind", (r) => {
    const f = takeField(r, home.side, home.id);
    if (f) f.kind = "";
  }, (r) => {
    const f = takeField(r, home.side, home.id);
    return f && !String(f.kind || "").trim() ? "" : "kind не снялся";
  });

  add("меток нет вовсе", (r) => {
    for (const side of ["rightMode", "leftMode"]) {
      for (const f of fieldsOf(r, side)) f.marker = "";
    }
    if (r.behavior) delete r.behavior.dateRuntimeConfig;
    delete r.dates;
  }, (r) => {
    const any = ["rightMode", "leftMode"].some((s) => fieldsOf(r, s).some((f) => String(f.marker || "").trim()));
    return !any && !(r.behavior && r.behavior.dateRuntimeConfig) ? "" : "метки остались";
  });

  return { corpus: out, problems };
}

async function reportMarkers() {
  const sites = markerSites();
  const live = await liveRulesOfHisConfig();
  const problems = live.problems.slice();
  if (!live.rules) {
    console.log("== вопрос «что такое наша метка»: корпус не собран");
    for (const p of problems) console.log("   ! " + p);
    console.log("");
    return problems.length;
  }
  const built = ruleCorpus(live.rules);
  const corpus = built.corpus;
  for (const p of built.problems) problems.push(p);

  console.log("== вопрос «что такое наша метка»: " + sites.length + " объявлений");
  for (const s of sites) console.log("   - " + s.id + "  (" + s.file + ")");

  /* Контроль на переписывание — у того места, чьё тело переписано. */
  for (const s of sites) {
    if (!s.anchor) continue;
    const text = fs.readFileSync(path.join(ROOT, s.file), "utf8");
    if (text.indexOf(s.anchor) < 0) {
      problems.push(s.id + ": строки исходника, из которой тело переписано, в файле больше нет");
    }
  }
  for (const p of markerSitesComplete(sites)) problems.push(p);

  const ask = (s, rules) => {
    try { return JSON.stringify(s.fn(rules)); }
    catch (e) { return "БРОСИЛО: " + String(e && e.message); }
  };

  /*
   * Кандидаты для мест-предикатов: всё, что назвали меткой места-списки, плюс
   * свежая метка мутации. Контроль — в списке больше одной метки и свежая в
   * нём есть: без неё вопрос «узнаёт ли место объявленное одним способом» не
   * задаётся вовсе (У-113).
   */
  const listSites = sites.filter((s) => s.id.indexOf("isDateLikeToken") < 0);
  const union = new Set([FRESH_MARKER]);
  for (const c of corpus) {
    for (const s of listSites) {
      let list = [];
      try { list = s.fn(c.rules); } catch (_) { list = []; }
      for (const mk of list) union.add(mk);
    }
  }
  MARKER_CANDIDATES.length = 0;
  for (const mk of Array.from(union).sort()) MARKER_CANDIDATES.push(mk);
  if (MARKER_CANDIDATES.length < 2 || MARKER_CANDIDATES.indexOf(FRESH_MARKER) < 0) {
    problems.push("список меток-кандидатов негоден — местам-предикатам нечего предъявить");
  }
  console.log("   метки-кандидаты (выведены из ответов мест-списков): " + JSON.stringify(MARKER_CANDIDATES));

  let diverging = 0;
  for (const c of corpus) {
    const answers = sites.map((s) => ask(s, c.rules));
    const differ = new Set(answers).size > 1;
    if (differ) diverging++;
    console.log("   вход «" + c.name + "»  [" + c.from + "]" + (differ ? "   <= расходятся" : "   ответы совпадают"));
    sites.forEach((s, i) => console.log("      " + s.id.padEnd(36) + " -> " + answers[i]));
  }
  console.log("   входов: " + corpus.length + ", расхождений: " + diverging);

  console.log("   попарно (0 значит «на всех входах отвечают одинаково» — только такую пару можно сводить):");
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      let n = 0;
      for (const c of corpus) if (ask(sites[i], c.rules) !== ask(sites[j], c.rules)) n++;
      console.log("     " + sites[i].id.padEnd(36) + " x " + sites[j].id.padEnd(36) +
        " " + String(n).padStart(3) + (n === 0 ? "  <= сводимо" : ""));
    }
  }

  /* Контроль самой меры: нарочно разведённая сторона обязана попасть в счёт.
     Портится копия первого места, а не соседнее (У-92). */
  const spoiled = { id: "control", fn: (rules) => sites[0].fn(rules).concat("x") };
  let seen = 0;
  for (const c of corpus) if (ask(sites[0], c.rules) !== ask(spoiled, c.rules)) seen++;
  console.log("   контроль чувствительности: нарочно испорченная сторона расходится на " +
    seen + " входах из " + corpus.length + (seen ? "" : "  <= МЕРА СЛЕПА"));
  if (!seen) problems.push("мера меток не увидела нарочно разведённой стороны — она слепа");

  for (const p of problems) console.log("   ! " + p);
  console.log("");
  return diverging + problems.length;
}

/**
 * Полнота списка мест — сплошным обходом рантайма, а не рукой (У-111), и
 * **обеими сторонами**: кто ключ читает и кто его пишет.
 *
 * Вторая сторона куплена ошибкой этой же меры: писателя искали образцом
 * «`dates:` с начала строки», а он записан инлайном — и мера объявила ключ
 * мёртвым, каким он не был.
 */
function markerSitesComplete(sites) {
  const listed = new Set(sites.map((s) => s.file));
  const readers = new Set();
  const writers = new Set();
  const bad = [];
  const skipDir = new Set(["node_modules", "dist", ".git", "tests", "docs", "tools"]);
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      if (skipDir.has(name)) continue;
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.js$/.test(name)) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join("/");
      /* Читается **маска**, а не сырой текст: своё же объяснение иначе
         считается местом (У-138). Маска — общая, из `tools/rule_copies.js`. */
      const text = maskCode(fs.readFileSync(full, "utf8"));
      if (text.indexOf(".dates.markers") >= 0) readers.add(rel);
      if (/dates:\s*\{\s*markers/.test(text)) writers.add(rel);
    }
  };
  walk(ROOT);
  /* Положительный контроль обхода: обе стороны обязаны находить хоть что-то.
     Ноль означал бы промах образца, а не отсутствие мест (У-119, У-127). */
  if (!readers.size) return ["обход рантайма не нашёл ни одного чтения `dates.markers` — образец промахнулся"];
  if (!writers.size) return ["обход рантайма не нашёл ни одного писателя `dates.markers` — образец промахнулся"];
  for (const rel of readers) {
    if (!listed.has(rel)) bad.push("чтение `dates.markers` в " + rel + " не значится в списке мест меры");
  }
  for (const rel of writers) {
    if (!listed.has(rel)) bad.push("запись `dates.markers` в " + rel + " не значится в списке мест меры");
  }
  return bad;
}

/* ------------------------- «во сколько смещения это значение» (1е очереди) */

/**
 * `resolveDateOffsetByFormatValue` объявлен дважды — у движка дат и у ядра
 * панели, — и очередь числила его кандидатом на сведение.
 *
 * **Алгоритм у обоих один:** перебрать смещения от опорной даты и найти то,
 * при котором значение, напечатанное по формату поля, совпадёт с тем, что
 * стоит в строке. Разошлись они **основанием времени**: движок дат считает и
 * печатает по Гринвичу (`addByUnitUtc`), ядро панели — по часам машины
 * (`addByUnit`). Пара «прибавить» и «напечатать» внутри каждой дороги
 * согласована сама с собой, поэтому расхождение гасится (У-196) — и увидеть
 * его можно только на входе, где основания расходятся: значение, записанное у
 * границы суток.
 *
 * Поэтому корпус здесь не из его конфига одного: к его форматам и его же
 * значениям из заметок добавлены **края суток** — значения, напечатанные по
 * его формату для моментов около полуночи по обоим основаниям.
 */
function dateOffsetSites() {
  const preload = require(path.join(ROOT, "src", "core", "pkm_runtime_preload_facade.js"));
  preload.loadRulesRuntimeHelpers();
  const statusDate = require(path.join(ROOT, "pkm_v2", "status_date.js"));
  const core = require(path.join(ROOT, "pkm_v2", "TagWheel", "tagwheel_core.js"));
  return [
    {
      id: "status_date (по Гринвичу)",
      file: "pkm_v2/status_date.js",
      fn: (raw, fmt, limit) => statusDate.resolveDateOffsetByFormatValue(raw, fmt, limit),
    },
    {
      id: "tagwheel_core (по часам машины)",
      file: "pkm_v2/TagWheel/tagwheel_core.js",
      /* Состояние сессии пустое: тогда опорная дата — «сегодня» по часам
         машины, то есть ровно то, с чем панель и работает у человека. */
      fn: (raw, fmt, limit) => core.resolveDateOffsetByFormatValue({}, raw, fmt, limit),
    },
  ];
}

/** Форматы — из его конфига, а не отсюда (У-182). */
function formatCorpus() {
  const out = [];
  const seen = new Set();
  const add = (v, from) => {
    const s = String(v == null ? "" : v).trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push({ value: s, from });
  };
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8"));
  (function walk(o) {
    if (!o) return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      if (k === "format" && typeof o[k] === "string") add(o[k], "его конфиг");
      walk(o[k]);
    }
  })(raw);
  add("YYYY-MM-DD", "край (синтетика)");
  add("YYYY-MM-DD hh:mm", "край (синтетика)");
  add("YYYY-MM", "край (синтетика)");
  add("YYYY", "край (синтетика)");
  return out;
}

/**
 * Значения: его собственные из заметок плюс напечатанные **общим** модулем для
 * моментов у границы суток. Печатает их тот, кто печатает у движка дат, — так
 * значение законно по построению (У-189), а вопрос задаётся тому, кто его
 * читает.
 */
function dateValueCorpus(formats) {
  const out = [];
  const seen = new Set();
  const add = (value, fmt, from) => {
    const key = fmt + " " + value;
    if (!value || seen.has(key)) return;
    seen.add(key);
    out.push({ value, fmt, from });
  };
  /*
   * Значения — его собственные, из его же заметок: то, что и правда стоит в
   * строке. Своего печатника здесь не заводится — это было бы ещё одно
   * объявление правила «как выглядит значение» (У-96).
   */
  const own = [];
  for (const name of fs.readdirSync(VAULT).filter((n) => /\.md$/i.test(n))) {
    let text = "";
    try { text = fs.readFileSync(path.join(VAULT, name), "utf8"); } catch (_) { continue; }
    for (const v of String(text).match(/\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?/g) || []) {
      if (own.indexOf(v) === -1) own.push(v);
    }
  }
  for (const v of own) for (const f of formats) add(v, f.value, "его заметки");
  /*
   * Края суток. Основания времени у двух объявлений разные — Гринвич и часы
   * машины, — и расходятся они ровно там, где местная дата и гринвичская не
   * совпадают. Такие значения получаются из **его же** заменой времени: это
   * по-прежнему его данные, а не выдуманная форма.
   */
  for (const v of own) {
    if (!/ \d{2}:\d{2}$/.test(v)) continue;
    for (const hhmm of ["00:10", "23:50", "02:30", "21:30"]) {
      for (const f of formats) add(v.replace(/ \d{2}:\d{2}$/, " " + hhmm), f.value, "край суток");
    }
  }
  return out;
}

/**
 * Значения, которые плагин пишет **сегодня**: команда поля-даты, нажатая
 * несколько раз подряд, даёт ряд смещений от «сейчас». Только на них вопрос
 * «во сколько единиц смещения это значение» и имеет непустой ответ: ряд идёт
 * вперёд, и всё, что записано в прошлом, оба объявления зовут `null`.
 */
async function writtenByPluginToday(formats) {
  const bench = require(path.join(ROOT, "tools", "line_bench.js"));
  const out = [];
  const seen = new Set();
  try {
    const cfg = bench.loadCfg();
    let line = "- [ ] ";
    for (const key of bench.fieldKeysBySide(cfg, "right")) {
      const id = bench.fieldCommandId(cfg, key, "next");
      for (let i = 0; i < 4; i++) {
        let res = null;
        try { res = await bench.runCommandById(cfg, id, line, 0); } catch (_) { break; }
        if (!res || !res.line) break;
        line = res.line;
        for (const v of String(res.line).match(/\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?/g) || []) {
          if (!seen.has(v)) { seen.add(v); out.push(v); }
        }
      }
      line = "- [ ] ";
    }
  } catch (_) { /* стенд не завёлся — корпус соберут остальные источники */ }
  /*
   * Ряд смещений идёт вперёд, поэтому к написанному сегодня добавляются
   * **завтра и послезавтра**: без них непустых ответов единицы, и ноль
   * расхождений держится на них одних (У-127). Сдвиг даты здесь — построение
   * входа, а не ответ на вопрос меры: правило «как выглядит значение» по-
   * прежнему объявляет только плагин, и день прибавляется к тому, что он
   * написал.
   */
  const shifted = [];
  for (const v of out) {
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
    if (!m) continue;
    for (const days of [1, 2]) {
      const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
      const iso = dt.toISOString().slice(0, 10);
      const next = iso + m[4];
      if (!seen.has(next)) { seen.add(next); shifted.push(next); }
    }
  }
  const rows = [];
  for (const v of out) for (const f of formats) rows.push({ value: v, fmt: f.value, from: "написано плагином сегодня" });
  for (const v of shifted) for (const f of formats) rows.push({ value: v, fmt: f.value, from: "написанное плагином, сдвинутое на день" });
  return rows;
}

async function reportDateOffset() {
  const sites = dateOffsetSites();
  const formats = formatCorpus();
  const values = dateValueCorpus(formats).concat(await writtenByPluginToday(formats));
  console.log("== вопрос «во сколько единиц смещения это значение»: " + sites.length + " объявлений");
  for (const s of sites) console.log("   - " + s.id + "  (" + s.file + ")");
  console.log("   форматов " + formats.length + " (его конфиг " +
    formats.filter((f) => f.from === "его конфиг").length + "), значений " + values.length +
    " (его заметки " + values.filter((v) => v.from === "его заметки").length +
    ", края суток " + values.filter((v) => v.from === "край суток").length +
    ", написано плагином сегодня " + values.filter((v) => v.from === "написано плагином сегодня").length +
    ", оно же со сдвигом на день " + values.filter((v) => v.from === "написанное плагином, сдвинутое на день").length + ")");
  console.log("   часовой пояс прогона: " + Intl.DateTimeFormat().resolvedOptions().timeZone +
    " (смещение " + (-new Date().getTimezoneOffset() / 60) + " ч); на машине по Гринвичу оба основания совпадают (У-155)");

  const problems = [];
  if (!values.length) problems.push("корпус значений пуст — мерить нечего");
  if (!values.some((v) => v.from === "край суток")) {
    problems.push("в корпусе нет значений у границы суток — именно там основания расходятся");
  }

  const ask = (s, v) => {
    try { return JSON.stringify(s.fn(v.value, v.fmt, 3660)); }
    catch (e) { return "БРОСИЛО: " + String(e && e.message); }
  };

  const diverging = [];
  for (const v of values) {
    const answers = sites.map((s) => ask(s, v));
    if (new Set(answers).size > 1) diverging.push({ v, answers });
  }
  /*
   * **Положительный контроль: сколько значений смещение вообще нашли.**
   * Ряд смещений идёт **вперёд** от «сегодня», и значение из прошлого в нём не
   * выражается никогда — оба объявления отвечают `null`, и «ноль расхождений»
   * получилось бы от пустоты (У-127, У-143).
   */
  const found = values.filter((v) => sites.some((s) => ask(s, v) !== "null")).length;
  console.log("   смещение найдено у " + found + " значений из " + values.length +
    (found ? "" : "   <= НОЛЬ РАСХОЖДЕНИЙ ОТ ПУСТОТЫ"));
  if (!found) problems.push("ни у одного значения смещение не найдено — сравнивать было нечего");
  console.log("   пар «значение × формат»: " + values.length + ", расхождений: " + diverging.length +
    (diverging.length ? "" : "   <= сводимо"));
  for (const d of diverging.slice(0, 10)) {
    console.log("     " + JSON.stringify(d.v.value) + " по формату " + JSON.stringify(d.v.fmt) +
      "  [" + d.v.from + "]");
    sites.forEach((s, i) => console.log("        " + s.id.padEnd(34) + " -> " + d.answers[i]));
  }

  /* Контроль самой меры: нарочно сдвинутая сторона обязана попасть в счёт. */
  const spoiled = { id: "control", fn: (raw, fmt, limit) => {
    const v = sites[0].fn(raw, fmt, limit);
    return v == null ? 1 : v + 1;
  } };
  let seen = 0;
  for (const v of values) if (ask(sites[0], v) !== ask(spoiled, v)) seen++;
  console.log("   контроль чувствительности: нарочно сдвинутая сторона расходится на " +
    seen + " значениях из " + values.length + (seen ? "" : "  <= МЕРА СЛЕПА"));
  if (!seen) problems.push("мера смещений не увидела сдвинутой стороны — она слепа");

  for (const p of problems) console.log("   ! " + p);
  console.log("");
  return diverging.length + problems.length;
}

/* ------------------- «какое поле отвечает этому ключу Order» (1е очереди) */

/**
 * `resolveFieldIdByOrderKey` объявлен дважды — у движка дат и у движка тегов,
 * — и очередь числила его кандидатом на сведение.
 *
 * Меряется он на **его** правилах и **его** ключах Order: ключи берутся из
 * списков сторон его конфига, к ним добавлены края — пустой, неизвестный и
 * имя поля вместо ключа.
 */
function fieldByKeySites() {
  const preload = require(path.join(ROOT, "src", "core", "pkm_runtime_preload_facade.js"));
  preload.loadRulesRuntimeHelpers();
  const statusDate = require(path.join(ROOT, "pkm_v2", "status_date.js"));
  const statusTags = require(path.join(ROOT, "pkm_v2", "status_tags.js"));
  return [
    {
      id: "status_date (поля-элементы)",
      file: "pkm_v2/status_date.js",
      fn: (rules, key) => statusDate.resolveFieldIdByOrderKey(rules, key),
    },
    {
      id: "status_tags (поля-теги)",
      file: "pkm_v2/status_tags.js",
      fn: (rules, key) => statusTags.resolveFieldIdByOrderKey(rules, key),
    },
  ];
}

function orderKeyCorpus(rules) {
  const out = [];
  const seen = new Set();
  const add = (v, from) => {
    const s = String(v == null ? "" : v);
    if (seen.has(s)) return;
    seen.add(s);
    out.push({ value: s, from });
  };
  const order = rules && rules.behavior && rules.behavior.order ? rules.behavior.order : {};
  for (const side of ["left", "right"]) {
    const list = Array.isArray(order[side]) ? order[side] : [];
    for (const k of list) add(k, "его Order");
  }
  for (const side of ["leftMode", "rightMode"]) {
    const node = rules && rules[side];
    const fields = node && Array.isArray(node.fields) ? node.fields : [];
    for (const f of fields) {
      add(f && f.id, "имя поля из его конфига");
      add(f && f.orderKey, "ключ поля из его конфига");
    }
  }
  add("", "край (синтетика)");
  add("   ", "край (синтетика)");
  add("такого ключа нет", "край (синтетика)");
  add("importance", "край (синтетика)");
  add("date_due", "край (синтетика)");
  return out;
}

async function reportFieldByKey() {
  const sites = fieldByKeySites();
  const live = await liveRulesOfHisConfig();
  const problems = live.problems.slice();
  console.log("== вопрос «какое поле отвечает этому ключу Order»: " + sites.length + " объявлений");
  for (const s of sites) console.log("   - " + s.id + "  (" + s.file + ")");
  if (!live.rules) {
    for (const p of problems) console.log("   ! " + p);
    console.log("");
    return problems.length;
  }
  const keys = orderKeyCorpus(live.rules);
  console.log("   ключей: " + keys.length + " (его Order " + keys.filter((k) => k.from === "его Order").length +
    ", из его конфига " + keys.filter((k) => k.from.indexOf("его конфиг") >= 0).length +
    ", края " + keys.filter((k) => k.from === "край (синтетика)").length + ")");

  const ask = (s, k) => {
    try { return JSON.stringify(s.fn(live.rules, k.value)); }
    catch (e) { return "БРОСИЛО: " + String(e && e.message); }
  };

  const diverging = [];
  for (const k of keys) {
    const answers = sites.map((s) => ask(s, k));
    if (new Set(answers).size > 1) diverging.push({ k, answers });
  }
  console.log("   расхождений: " + diverging.length + " из " + keys.length +
    (diverging.length ? "" : "   <= сводимо"));
  for (const d of diverging.slice(0, 12)) {
    console.log("     ключ " + JSON.stringify(d.k.value).padEnd(22) + " [" + d.k.from + "]");
    sites.forEach((s, i) => console.log("        " + s.id.padEnd(30) + " -> " + d.answers[i]));
  }

  /* Положительный контроль: непустых ответов больше нуля — иначе расхождений
     не было бы и у двух совсем разных правил (У-127). */
  const answered = keys.filter((k) => sites.some((s) => ask(s, k) !== '""')).length;
  console.log("   непустых ответов: " + answered + " из " + keys.length +
    (answered ? "" : "   <= СРАВНИВАТЬ БЫЛО НЕЧЕГО"));
  if (!answered) problems.push("оба объявления отвечают пустотой — сравнивать было нечего");

  /* Контроль самой меры: нарочно испорченная сторона обязана попасть в счёт. */
  const spoiled = { id: "control", fn: (rules, key) => String(sites[0].fn(rules, key) || "") + "x" };
  let seen = 0;
  for (const k of keys) if (ask(sites[0], k) !== ask(spoiled, k)) seen++;
  console.log("   контроль чувствительности: нарочно испорченная сторона расходится на " +
    seen + " ключах из " + keys.length + (seen ? "" : "  <= МЕРА СЛЕПА"));
  if (!seen) problems.push("мера не увидела нарочно испорченной стороны — она слепа");

  for (const p of problems) console.log("   ! " + p);
  console.log("");
  return diverging.length + problems.length;
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

/**
 * **Контроль на полноту: рукописный образец ссылки заводится тихо.**
 *
 * Сведя три места в `transform_feature.js`, я спросил не «нет ли ещё копии», а
 * что помешает завести её завтра (У-159). Ответ был «ничего» — поэтому здесь
 * сплошной обход рантайма по **форме** образца, а не по списку файлов (У-111,
 * У-126).
 *
 * Разрешены ровно два адреса: общий дом, где форма объявлена, и
 * `editor_visuals_config.js`, чей образец **у́же дома нарочно** — он не считает
 * ссылкой `[[a[b]]`. Расхождение измерено (2 строки из 77) и не сведено: что
 * об этом думает сам Obsidian, не спрошено, а гадать про чужую разметку здесь
 * запрещено (У-91).
 */
function controlNoHandwrittenLinkForm() {
  /* Форма записывается двумя способами, и искать надо обе: регулярным
     литералом и строкой с удвоенным слэшем, как в самом доме. Первая
     версия искала только первую — и положительный контроль ниже поймал
     это раньше, чем я успел прочесть «рукописных форм нет» (У-142). */
  const needles = ["\\[\\[[^", "\\\\[\\\\[[^"];
  const allowed = new Set([
    "src/core/shared_utils.js",
    "src/core/editor_visuals_config.js",
    "tools/form_divergence.js",
  ]);
  const found = [];
  const skipDir = new Set(["node_modules", "dist", ".git", "tests", "docs"]);
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      if (skipDir.has(name)) continue;
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!/\.(js|ts)$/.test(name)) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join("/");
      const text = fs.readFileSync(full, "utf8");
      if (needles.some((n) => text.indexOf(n) >= 0)) found.push(rel);
    }
  };
  walk(ROOT);

  /* Положительный контроль: обход обязан находить хотя бы дом. Ноль означал бы
     промах образца, а не отсутствие рукописных форм (У-119, У-127). */
  if (!found.includes("src/core/shared_utils.js")) {
    return ["обход не нашёл даже общий дом — образец промахнулся"];
  }
  return found
    .filter((rel) => !allowed.has(rel))
    .map((rel) => "рукописный образец ссылки в " + rel +
      ": форма ссылки объявляется в общем доме, а не по месту (У-91)");
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

async function main() {
  const corpus = []
    .concat(corpusFromHisConfig().map((v) => ({ value: v, from: "его конфиг" })))
    .concat(corpusFromHisNotes().map((v) => ({ value: v, from: "его заметки" })))
    .concat(SYNTHETIC_EDGES.map((v) => ({ value: v, from: "край (синтетика)" })));

  const problems = []
    .concat(controlTranscription())
    .concat(controlSitesComplete())
    .concat(controlNoHandwrittenLinkForm())
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
    console.log("Контроли пройдены: переписывание, полнота списка мест, отсутствие рукописных форм, корпус, чувствительность меры");
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
  totalDiverging += reportCompose();
  totalDiverging += reportScan();
  totalDiverging += await reportMarkers();
  totalDiverging += await reportDateOffset();
  totalDiverging += await reportFieldByKey();

  console.log("Итого расхождений: " + totalDiverging);
  console.log("Сводить можно только группу с нулём — и только после мутации в обе стороны (У-92).");
  process.exitCode = problems.length ? 1 : 0;
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
