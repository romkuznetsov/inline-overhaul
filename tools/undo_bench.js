"use strict";

/**
 * Стенд отмены: `Ctrl+Z` на настоящей истории CodeMirror.
 *
 * **Зачем отдельно от `line_bench.js`.** Тот спрашивает, какую строку плагин
 * напишет. Здесь вопрос другой: что останется от **истории отмен** человека
 * после того, как плагин по этой строке поработал. Замечание заказчика
 * 2026-09-12: «в процессе тестирования нажимал ctrl+z — за несколько нажатий в
 * строке получил `1231 :: 👤111 🤣… || 1231 :: …`».
 *
 * Подделки здесь нет: история — `@codemirror/commands`, та же реализация, что
 * лежит в сборке Obsidian; команды и панель — настоящие, на настоящем
 * `data.json` заказчика. Редактор поверх документа CodeMirror даёт плагину тот
 * же набор вызовов, что даёт Obsidian: `getLine`, `setLine`, `replaceRange` и
 * `cm` для записи мимо истории.
 *
 * **Мера — не «строка выглядит целой», а равенство эталону.** Те же нажатия
 * человека без плагина дают ряд документов; после работы плагина ряд обязан
 * быть тем же. Иначе `Ctrl+Z` возвращает состояние, которого никогда не было, —
 * ровно то, что заказчик и прислал.
 *
 * Запуск (из `repo/`):
 *   node tools/undo_bench.js                       — набор по умолчанию
 *   node tools/undo_bench.js test3-next panel-left — свой порядок шагов
 *
 * Шаги: идентификатор команды (`node tools/line_bench.js list`) либо
 * `panel-left` / `panel-right` — открыть панель, крутнуть значение, применить.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const bench = require(path.join(ROOT, "tools", "line_bench.js"));
const runtime = require(path.join(ROOT, "pkm_runtime_v2.js"));
const shared = require(path.join(ROOT, "src", "core", "shared_utils.js"));
const panelBench = require(path.join(ROOT, "tests", "harness", "panel_bench.js"));


/*
 * Ключи рантайма и редактор поверх настоящего документа CodeMirror — общие
 * у трёх стендов, и объявлены они один раз (`tests/harness/panel_bench.js`).
 * Здесь стояли свои копии, и копия `paneSettings` уже разошлась с копией в
 * `line_bench.js` на строку (У-32).
 */
const paneSettings = panelBench.paneSettings;
const makeCmEditor = panelBench.makeCmEditor;

function makeWindowMock() {
  const listeners = {};
  return {
    __tagWheelState: { active: false },
    addEventListener(t, h) { (listeners[t] = listeners[t] || []).push(h); },
    removeEventListener(t, h) { listeners[t] = (listeners[t] || []).filter((x) => x !== h); },
    fire(t, e) { (listeners[t] || []).slice().forEach((h) => h(e)); },
  };
}

function makeApp(editor) {
  const toAbs = (p) => path.resolve(bench.VAULT, String(p || ""));
  return {
    workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } },
    vault: {
      getAbstractFileByPath(p) { return fs.existsSync(toAbs(p)) ? { path: p } : null; },
      async read(f) { return fs.promises.readFile(toAbs(f && f.path ? f.path : f), "utf8"); },
      adapter: { async read(p) { return fs.promises.readFile(toAbs(p), "utf8"); } },
    },
  };
}

/** Прогон: напечатать слово, выполнить шаги, нажать Ctrl+Z до упора. */
async function runSteps(cfg, steps, word, withPlugin) {
  const editor = makeCmEditor("");
  const pane = paneSettings(cfg);
  const defs = bench.defsFor(cfg);
  const defById = (id) => defs.filter((d) => d.id === id)[0];
  const seen = [];
  const note = () => seen.push(editor.doc());

  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = makeWindowMock();
  global.Notice = function Notice() {};
  const app = makeApp(editor);
  try {
    note();
    editor.type(word, 0);
    editor.setCursor({ line: 0, ch: word.length });
    note();
    if (withPlugin) {
      for (const step of steps) {
        if (step === "panel-left" || step === "panel-right") {
          const side = step === "panel-right" ? "right" : "left";
          const def = defById(side === "right" ? "open-tagwheel-right" : "open-tagwheel-left");
          const settings = Object.assign({}, pane, def.makeSettings(cfg));
          await runtime.runCommand({ app, command: "tagWheel", settings });
          global.window.fire("keydown", {
            key: "ArrowUp", code: "ArrowUp",
            preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
          });
          await runtime.runCommand({ app, command: "tagWheel", settings });
          note();
          continue;
        }
        const def = defById(step);
        if (!def) throw new Error("нет команды " + JSON.stringify(step));
        await runtime.runCommand({
          app, command: def.v2Command,
          settings: Object.assign({}, pane, def.makeSettings(cfg)),
        });
        note();
      }
    }
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }

  const undone = [];
  for (let i = 0; i < 8; i++) {
    const ok = editor.undo();
    undone.push(editor.doc());
    if (!ok) break;
  }
  return { seen, undone };
}

/**
 * Правила, которые прочтёт панель, с подменённым режимом противоположного
 * Block. Настоящий `generated_rules.md` при этом не трогается: сборка кладётся
 * во временный файл рядом с ним, и он же убирается за собой.
 *
 * Нужно это затем, что **режим решает, что панель удаляет из документа**, а
 * удаление и есть причина схлопывания чужих ступеней (У-160). Мерить формы
 * записи, не умея переключить режим, значит мерить одну из них.
 */
const PROBE_RULES_PATH = ".obsidian/plugins/inline-overhaul/_undo_bench_rules.md";

function withOppositeMode(cfg, mode) {
  const next = JSON.parse(JSON.stringify(cfg));
  shared.writeCfgPath(next, "visual.tagWheel.oppositeBlock", String(mode || "hide"));
  const builder = require(path.join(ROOT, "src", "features", "rules_markdown_builder.js"))
    .createRulesMarkdownBuilder({});
  const abs = path.join(bench.VAULT, PROBE_RULES_PATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, builder.buildTagWheelRulesMarkdownFromConfig(next), "utf8");
  shared.writeCfgPath(next, "advanced.generatedRulesPath", PROBE_RULES_PATH);
  return { cfg: next, cleanup() { try { fs.unlinkSync(abs); } catch (_) { /* файла может уже не быть */ } } };
}

/**
 * Два случая, и второй важнее первого.
 *
 * Первый — тот, что принёс заказчик: значения стоят **только** в
 * противоположном Block. Второй — те же шаги, но значение есть и в том Block,
 * на котором панель открывается.
 *
 * Разница между ними и есть мера годности формы записи: форма, которая
 * перестаёт удалять **чужой** Block, первый случай чинит, а второй нет — полосу
 * она по-прежнему ставит на место своих значений. Стенд, знавший один случай,
 * объявил бы такую форму починкой (У-137).
 */
const SCENARIOS = [
  { id: "right-only", about: "значения только в противоположном Block",
    steps: ["test3-next", "random-next", "panel-left"] },
  { id: "both-blocks", about: "значения есть и в том Block, где открылась панель",
    steps: ["category-next", "test3-next", "random-next", "panel-left"] },
];

const MODES = ["hide", "keep"];

async function measure(cfg, steps, word) {
  const r = await runSteps(cfg, steps, word, true);
  const past = new Set(r.seen);
  let bad = 0;
  const rows = r.undone.map((d, i) => {
    const known = past.has(d);
    if (!known) bad++;
    return "    " + (i + 1) + " " + (known ? "ok       " : "НЕ БЫЛО  ") + JSON.stringify(d);
  });
  return { bad, rows, seen: r.seen };
}

async function main() {
  const cfg = bench.loadCfg();
  const word = "1231";
  const custom = process.argv.slice(2);

  if (custom.length) {
    const r = await measure(cfg, custom, word);
    console.log("шаги: " + custom.join(" → "));
    console.log("что было на строке:");
    r.seen.forEach((d, i) => console.log("  " + i + " " + JSON.stringify(d)));
    console.log("Ctrl+Z:");
    r.rows.forEach((l) => console.log(l.slice(2)));
    console.log("");
    console.log("состояний, которых на строке никогда не было: " + r.bad);
    if (r.bad) process.exitCode = 1;
    return;
  }

  /*
   * Мера: каждое состояние после Ctrl+Z обязано быть тем, которое на строке
   * когда-то стояло. Состояние, которого не было, и есть дефект — «плагин
   * вернул то, чего человек не набирал».
   */
  const table = [];
  for (const s of SCENARIOS) {
    console.log("");
    console.log(s.id + " — " + s.about);
    console.log("  шаги: " + s.steps.join(" → "));
    for (const mode of MODES) {
      const probe = withOppositeMode(cfg, mode);
      try {
        const r = await measure(probe.cfg, s.steps, word);
        table.push({ scenario: s.id, mode, bad: r.bad });
        console.log("  режим `" + mode + "`: состояний, которых не было — " + r.bad);
        console.log("    строка перед панелью: " + JSON.stringify(r.seen[r.seen.length - 2]));
        r.rows.forEach((l) => console.log(l));
      } finally {
        probe.cleanup();
      }
    }
  }

  console.log("");
  console.log("итог:");
  for (const row of table) {
    console.log("  " + (row.scenario + "/" + row.mode + "        ").slice(0, 20)
      + " " + row.bad);
  }

  /*
   * **Положительный контроль: прежняя форма записи обязана быть красной.**
   *
   * Ноль у всех случаев читается двояко: «форма чинит» и «шаги перестали
   * воспроизводить замечание». Разводит их прогон на прежней форме — той, где
   * полоса вставала **на место** значений. Форма эта из продукта не ушла: она
   * и есть запасной путь, на который панель сходит, когда план записи не
   * сложился. Подмена возвращает `null` из планировщика — то есть гоняет
   * настоящий запасной путь продукта, а не выдуманное состояние (У-146).
   *
   * Контроль обязателен: без него зелёный стенд ничего не стоит (У-88).
   */
  const planner = require(path.join(ROOT, "src", "core", "panel_line_write.js"));
  const realPlan = planner.planPanelLineWrite;
  planner.planPanelLineWrite = () => null;
  const oldTable = [];
  try {
    for (const s of SCENARIOS) {
      for (const mode of MODES) {
        const probe = withOppositeMode(cfg, mode);
        try {
          const r = await measure(probe.cfg, s.steps, word);
          oldTable.push({ scenario: s.id, mode, bad: r.bad });
        } finally {
          probe.cleanup();
        }
      }
    }
  } finally {
    planner.planPanelLineWrite = realPlan;
  }
  console.log("");
  console.log("контроль — прежняя форма записи (полоса на месте значений):");
  for (const row of oldTable) {
    console.log("  " + (row.scenario + "/" + row.mode + "        ").slice(0, 20)
      + " " + row.bad);
  }
  const oldClean = oldTable.filter((r) => r.bad === 0).length;
  if (oldClean > 1) {
    console.log("");
    console.log("ВНИМАНИЕ: прежняя форма дала чистую историю в " + oldClean
      + " случаях из " + oldTable.length + " — шаги перестали воспроизводить замечание");
    process.exitCode = 2;
    return;
  }

  const worst = table.reduce((a, r) => Math.max(a, r.bad), 0);
  if (worst) process.exitCode = 1;
}

module.exports = { makeCmEditor, runSteps, paneSettings, withOppositeMode, SCENARIOS };

if (require.main === module) {
  main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
