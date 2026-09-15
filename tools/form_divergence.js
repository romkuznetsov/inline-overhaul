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

function main() {
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

  console.log("Итого расхождений: " + totalDiverging);
  console.log("Сводить можно только группу с нулём — и только после мутации в обе стороны (У-92).");
  process.exitCode = problems.length ? 1 : 0;
}

main();
