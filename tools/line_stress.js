"use strict";

/**
 * Проба на прочность: строки, которых нет ни в одной фикстуре.
 *
 * **Зачем отдельно от обхода строки.** `tools/line_matrix.js` спрашивает, дают
 * ли панель и команда один и тот же ответ на **его** формах. Здесь вопрос
 * другой и к обеим дорогам сразу: что будет со строкой, которую человек
 * принёс из внешнего мира, — очень длинной, из одних разделителей, со
 * склейкой эмодзи, с письмом справа налево, со скобками внутри скобок. Такие
 * строки в корпус обхода не годятся: у них нет «правильного ответа», с
 * которым сверяться, — есть только «не упасть, не зависнуть и не раздуться».
 *
 * **Своего стенда здесь нет.** Дорога берётся у `tools/line_bench.js`: те же
 * определения команд, тот же конфиг заказчика, та же сессия панели. Собирать
 * её заново — значит завести второе объявление правила (У-197).
 *
 * **Гейтом это не является и чисел не стережёт** (У-145): величины времени
 * принадлежат машине, а порог на них был бы порогом на чужой. Это инструмент
 * ревизии; разбор 2026-09-18 — `docs/dev/AUDIT_2026-09-18.md`, раздел 4.11.
 *
 * Запуск (из `repo/`):
 *   node tools/line_stress.js              — команды и панель на трудных строках
 *   node tools/line_stress.js curve        — как растёт цена от длины строки
 *   node tools/line_stress.js where        — где именно теряется время (`Р-12`)
 *   IO_DATA=<путь> node tools/line_stress.js    — на другом `data.json`
 *
 * **Контролей три, и они печатаются первыми:**
 *   1. несуществующая команда обязана дать отказ — иначе «ни одного падения»
 *      получалось бы от того, что не исполнялось ничего (У-88);
 *   2. обычная его строка обязана пройти — падение на ней значит сломанный
 *      стенд, а не находку;
 *   3. у кривой: короткая строка обязана стоить заметно меньше длинной —
 *      ровная линия значила бы, что мерили не то.
 */

const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const bench = require(path.join(ROOT, "tools", "line_bench.js"));

const cfg = bench.loadCfg();

/**
 * Трудные строки. Первая — контрольная: обычная строка заказчика.
 *
 * Список дописывается вместе с находкой (У-185): принесли форму, на которой
 * что-то сломалось, — её место здесь, а не в памяти.
 */
const CASES = [
  ["контроль: обычная его строка", "- 📅2026-09-18 :: разобрать входящие :: #проект/дом"],
  ["пусто", ""],
  ["одни пробелы", "                    "],
  ["одни разделители", ":: :: :: :: :: :: :: :: ::"],
  ["двести разделителей", Array(200).join(":: ")],
  ["длинная строка 20 000 знаков", "- " + "слово ".repeat(3333) + ":: #проект/дом"],
  /* Форма дописана 2026-09-19 вместе с находкой `Ф-5` (У-185): на сорока
     тысячах знаков дорога падает `Invalid regular expression: too large` —
     где-то целая строка уходит в выражение как один токен. Падение старше
     правки `Р-12`: воспроизведено на рабочем дереве до неё. */
  ["длинная строка 40 000 знаков", "- " + "слово ".repeat(6666) + ":: #проект/дом"],
  ["пара суррогатов", "- \u{1D54F}\u{1D550}\u{1D551} :: текст :: #проект/дом"],
  ["склейка эмодзи", "- \u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466} :: семья :: #проект/дом"],
  ["флаг из двух знаков", "- \u{1F1F0}\u{1F1FF} :: страна :: #проект/дом"],
  ["комбинирующие знаки", "- ééé :: текст :: #проект/дом"],
  ["письмо справа налево", "- שלום עולם :: текст :: #проект/дом"],
  ["скобки в скобках", "- [[[[заметка]]]] :: текст :: #проект/дом"],
  ["незакрытая скобка", "- [[заметка :: текст :: #проект/дом"],
  ["управляющие знаки", "- [31m :: текст :: #проект/дом"],
  ["тысяча тегов", "- " + "#тег ".repeat(1000) + ":: текст"],
  ["только знак списка", "- "],
  ["знак заголовка и ничего", "###### "],
  ["чужая разметка вокруг", "> [!note] - **[[з]]** :: `текст` :: #проект/дом"],
];

/** Команды полей его Order — обе стороны, обе кнопки, и дочерние тоже. */
function commandIds() {
  if (process.env.IO_IDS) return process.env.IO_IDS.split(",").map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const side of ["left", "right"]) {
    for (const key of bench.fieldKeysBySide(cfg, side)) {
      out.push(bench.fieldCommandId(cfg, key, "next"));
      out.push(bench.fieldCommandId(cfg, key, "previous"));
    }
  }
  return Array.from(new Set(out));
}

function lineOf(result) {
  if (!result) return "";
  return String(result.line === undefined ? (result.text || "") : result.line);
}

async function pressThrice(id, line) {
  const a = lineOf(await bench.runCommandById(cfg, id, line, String(line).length));
  const b = lineOf(await bench.runCommandById(cfg, id, a, a.length));
  const c = lineOf(await bench.runCommandById(cfg, id, b, b.length));
  return { a, b, c };
}

async function runCases() {
  /* Контроль 1: движок обязан отказать на том, чего нет. */
  let refused = false;
  try { await bench.runCommandById(cfg, "такой-команды-нет", "- проба", 7); } catch (_) { refused = true; }
  console.log("контроль: несуществующая команда " + (refused ? "даёт отказ" : "МОЛЧИТ — мерить нечем"));
  if (!refused) process.exitCode = 2;

  const ids = commandIds();
  let crashed = 0, slow = 0, grew = 0, done = 0, controlOk = true;
  const notes = [];

  for (const [name, line] of CASES) {
    for (const id of ids) {
      done++;
      const t0 = process.hrtime.bigint();
      let got;
      try {
        got = await pressThrice(id, line);
      } catch (e) {
        crashed++;
        if (/контроль/.test(name)) controlOk = false;
        notes.push("ПАДЕНИЕ  " + id + "  " + name + "  — " + String((e && e.message) || e).slice(0, 140));
        continue;
      }
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      if (ms > 250) { slow++; notes.push("ДОЛГО    " + ms.toFixed(0) + " мс  " + id + "  " + name); }
      /* Раздувание: третье нажатие длиннее первого больше чем вдвое (У-157). */
      if (got.c.length > Math.max(64, got.a.length * 2)) {
        grew++;
        notes.push("РАСТЁТ   " + id + "  " + name + "  "
          + line.length + " → " + got.a.length + " → " + got.b.length + " → " + got.c.length);
      }
    }
  }
  console.log("контроль: обычная строка " + (controlOk ? "прошла" : "УПАЛА — сломан стенд, а не продукт"));
  console.log("");
  console.log("команды: " + done + " случаев (" + CASES.length + " строк × " + ids.length + " команд)");
  console.log("  падений: " + crashed);
  console.log("  дольше 250 мс: " + slow);
  console.log("  строка растёт от повторов: " + grew);

  /* ---- та же проба на дороге панели ---------------------------------- */
  let pCrashed = 0, pSlow = 0, pDone = 0;
  const pNotes = [];
  for (const [name, line] of CASES) {
    for (const side of ["left", "right"]) {
      for (const keys of [[], ["ArrowRight"], ["ArrowRight", "ArrowDown", "Enter"]]) {
        pDone++;
        const t0 = process.hrtime.bigint();
        try {
          await bench.runTagWheel(cfg, side, line, String(line).length, keys);
        } catch (e) {
          pCrashed++;
          pNotes.push("ПАДЕНИЕ  " + side + " [" + keys.join(",") + "]  " + name
            + "  — " + String((e && e.message) || e).slice(0, 140));
          continue;
        }
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (ms > 400) pSlow++, pNotes.push("ДОЛГО    " + ms.toFixed(0) + " мс  " + side + "  " + name);
      }
    }
  }
  console.log("");
  console.log("панель: " + pDone + " сессий (" + CASES.length + " строк × 2 стороны × 3 набора клавиш)");
  console.log("  падений: " + pCrashed);
  console.log("  дольше 400 мс: " + pSlow);

  const all = notes.concat(pNotes);
  if (all.length) { console.log(""); all.slice(0, 40).forEach((n) => console.log("  " + n)); }
}

/* ---- кривая: как цена растёт от длины строки ------------------------- */

async function runCurve() {
  const LENS = [200, 500, 1000, 2000, 5000, 10000, 20000, 40000];
  const make = (n) => "- " + "слово ".repeat(Math.max(1, Math.round((n - 20) / 6))) + ":: #проект/дом";
  const timeIt = async (fn, iters) => {
    await fn();
    const a = process.hrtime.bigint();
    for (let i = 0; i < iters; i++) await fn();
    return Number(process.hrtime.bigint() - a) / 1e6 / iters;
  };

  const id = commandIds()[0];
  console.log("длина строки   команда, мс   панель (открыть, шаг, применить), мс");
  const rows = [];
  for (const n of LENS) {
    const line = make(n);
    const cmd = await timeIt(() => bench.runCommandById(cfg, id, line, line.length), 3);
    const panel = await timeIt(
      () => bench.runTagWheel(cfg, "right", line, line.length, ["ArrowRight", "Enter"]), 3);
    rows.push({ len: line.length, cmd, panel });
    console.log(String(line.length).padStart(12) + "   " + cmd.toFixed(1).padStart(11)
      + "   " + panel.toFixed(1).padStart(12));
  }
  /* Контроль 3: короткая обязана стоить заметно меньше длинной. */
  const first = rows[0], last = rows[rows.length - 1];
  const grew = last.panel > first.panel * 3;
  console.log("");
  console.log("контроль: " + (grew
    ? "цена и правда растёт с длиной — мерили то"
    : "ЦЕНА НЕ РАСТЁТ — мерили не то"));
  if (!grew) process.exitCode = 2;
}


/* ---- где именно теряется время (`Р-12`) ------------------------------ */

/**
 * Не «сколько стоит», а **какое место растёт круче линейного**.
 *
 * Мера снимается профилировщиком V8 (`node:inspector`), а не своей обёрткой
 * вокруг экспортов: обёртка видит только те вызовы, что идут через объект
 * модуля, и своё же время приписывает предмету. V8 считает **собственное**
 * время каждой функции и не зависит от того, как её позвали.
 *
 * Сравниваются две длины — короткая и длинная, — и печатается отношение. Место
 * находит не самая дорогая строка, а самое **крутое** отношение: линейный рост
 * у длинной строки законен, круче линейного — нет.
 *
 * Контролей три, и каждый на свой шаг цепочки (правило 64): профиль вообще снят,
 * измеренное время сопоставимо с настоящим, и в списке есть хоть одно наше имя —
 * иначе меряли бы чужой рантайм.
 */
async function runWhere() {
  const inspector = require("inspector");
  const SHORT = 2000;
  const LONG = 20000;
  const ITERS = 3;
  const make = (n) => "- " + "слово ".repeat(Math.max(1, Math.round((n - 20) / 6))) + ":: #проект/дом";

  const profile = async (line) => {
    const session = new inspector.Session();
    session.connect();
    const post = (method, params) => new Promise((res, rej) => {
      session.post(method, params || {}, (err, r) => (err ? rej(err) : res(r)));
    });
    await post("Profiler.enable");
    await post("Profiler.setSamplingInterval", { interval: 100 });
    await post("Profiler.start");
    const wall0 = process.hrtime.bigint();
    for (let i = 0; i < ITERS; i++) {
      await bench.runTagWheel(cfg, "right", line, line.length, ["ArrowRight", "Enter"]);
    }
    const wallMs = Number(process.hrtime.bigint() - wall0) / 1e6;
    const { profile: p } = await post("Profiler.stop");
    session.disconnect();

    /* Собственное время узла: сколько раз он оказался на вершине стека. */
    const byNode = new Map();
    for (const id of p.samples || []) byNode.set(id, (byNode.get(id) || 0) + 1);
    const total = (p.samples || []).length;
    const spanMs = (p.endTime - p.startTime) / 1000;
    const self = new Map();
    for (const node of p.nodes || []) {
      const hits = byNode.get(node.id) || 0;
      if (!hits) continue;
      const f = node.callFrame || {};
      const url = String(f.url || "");
      const name = String(f.functionName || "(анонимная)");
      const key = name + "  " + url.replace(/^file:\/\/\//, "").split("/").slice(-2).join("/");
      self.set(key, (self.get(key) || 0) + hits);
    }
    return { self, total, spanMs, wallMs, ours: [...self.keys()].filter(isOurs) };
  };

  const isOurs = (key) => /pkm_v2\/|src\/|line_pipeline|token_graph|navigation_runtime/.test(key);

  console.log("снимаю профиль на строке " + SHORT + " знаков…");
  const a = await profile(make(SHORT));
  console.log("снимаю профиль на строке " + LONG + " знаков…");
  const b = await profile(make(LONG));

  console.log("");
  console.log("КОНТРОЛЬ:");
  const c1 = a.total > 50 && b.total > 50;
  const c2 = b.spanMs > 0 && Math.abs(b.spanMs - b.wallMs) / b.wallMs < 0.5;
  const c3 = b.ours.length > 0;
  console.log("  " + (c1 ? "ok  " : "FAIL") + " профиль снят: проб " + a.total + " и " + b.total);
  console.log("  " + (c2 ? "ok  " : "FAIL") + " измеренное время сопоставимо с настоящим: "
    + b.spanMs.toFixed(0) + " против " + b.wallMs.toFixed(0) + " мс");
  console.log("  " + (c3 ? "ok  " : "FAIL") + " в списке есть наши имена: " + b.ours.length);
  if (!(c1 && c2 && c3)) { console.log("\nконтроль не прошёл — выводам верить нельзя"); process.exitCode = 2; }

  const msOf = (r, key) => (r.self.get(key) || 0) * (r.spanMs / Math.max(1, r.total));
  const rows = [];
  for (const key of new Set([...a.self.keys(), ...b.self.keys()])) {
    const ms0 = msOf(a, key);
    const ms1 = msOf(b, key);
    if (ms1 < 5) continue;
    rows.push({ key, ms0, ms1, ratio: ms1 / Math.max(ms0, 0.3) });
  }
  const grow = LONG / SHORT;
  console.log("");
  console.log("длина выросла в " + grow + " раз. Рост круче этого — находка.");
  console.log("");
  console.log("  " + "мс@2000".padStart(8) + "  " + "мс@20000".padStart(9) + "  рост   место");
  for (const r of rows.sort((x, y) => y.ms1 - x.ms1).slice(0, 18)) {
    const mark = r.ratio > grow * 1.5 ? "  <-- круче линейного" : "";
    console.log("  " + r.ms0.toFixed(0).padStart(8) + "  " + r.ms1.toFixed(0).padStart(9)
      + "  " + ("x" + r.ratio.toFixed(1)).padStart(6) + "   " + r.key + mark);
  }
}

const mode = String(process.argv[2] || "").trim();
(mode === "curve" ? runCurve() : mode === "where" ? runWhere() : runCases()).catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});
