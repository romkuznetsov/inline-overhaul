"use strict";

/**
 * Стенд воспроизведения: строка заказчика на его настоящих настройках.
 *
 * **Зачем отдельно от набора.** Замечание заказчика всегда звучит как «команда и
 * панель дают разное», и проверить это чтением нельзя: настройки едут к движкам
 * длинной дорогой, и половина расхождений живёт именно в ней. Стенд проезжает ту
 * же дорогу целиком — `migrateConfig` → `buildPkmCommandDefs` → `runCommand`, —
 * то есть зовёт **те же определения команд**, которыми плагин их регистрирует, и
 * досыпает те же ключи, что досыпает `runPkmRuntime`. Своих правил здесь нет ни
 * одного: всё, что стенд умеет, умеет плагин.
 *
 * **Почему он лежит в репозитории.** Его собирали заново дважды — 11 и 12
 * сентября, — и оба раза он находил причину за один заход (10.13.77, 10.13.78).
 * Третий раз собирать не надо.
 *
 * Запуск (из `repo/`):
 *   node tools/line_bench.js cmd date-due-next ""
 *   node tools/line_bench.js cmd date-due-previous "📅2026-09-12 17:05 || "
 *   node tools/line_bench.js panel left "" ArrowRight ArrowRight ArrowUp
 *   node tools/line_bench.js open right "-  :: 👤111"   — что панель узнала в строке
 *   node tools/line_bench.js list                      — какие команды есть
 *
 * Конфиг по умолчанию — `../test-vault/.obsidian/plugins/inline-overhaul/data.json`
 * (заказчик разрешил их брать 2026-09-11); другой задаётся `IO_DATA=<путь>`.
 * Значения настроек в вывод не идут — печатается только строка и курсор.
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

const runtime = require(path.join(ROOT, "pkm_runtime_v2.js"));
const normalize = require(path.join(ROOT, "src", "core", "config_normalize.js"));
const orderCfg = require(path.join(ROOT, "src", "core", "pkm_order_config.js"));
const registry = require(path.join(ROOT, "src", "features", "command_registry.js"));

const panelBench = require(path.join(ROOT, "tests", "harness", "panel_bench.js"));


function loadCfg() {
  return normalize.migrateConfig(JSON.parse(fs.readFileSync(DATA, "utf8")));
}

/* Ключи рантайма — общие у трёх стендов, и объявлены они один раз
   (`tests/harness/panel_bench.js`). Две копии здесь уже расходились (У-32).
   Путь к служебному файлу правил отсюда ушёл вместе с самим файлом
   (PRD 10.13.52, П-8, шаг четвёртый). */

function defsFor(cfg) {
  return registry.buildPkmCommandDefs(
    orderCfg.serializePkmOrderForMacro,
    orderCfg.serializeDateRuntimeConfigForMacro,
    orderCfg.normalizePkmOrder,
    cfg,
    ["navigation", "editor", "pkm", "visual", "transform", "advanced"]
  );
}

/**
 * Команда поля по его ключу в Order — **одно объявление на все стенды**.
 *
 * **Зачем это здесь, а не у каждого стенда.** Стенды гоняются на настоящем
 * `data.json` заказчика, и имена полей в нём принадлежат ему: 2026-09-13 он
 * переименовал `test3`, и `tools/undo_bench.js` умер целиком — в нём стоял
 * литеральный `test3-next`. Стенд, названный в промпте сессии как один из тех,
 * без которых будешь угадывать, молча перестал работать от **переименования
 * поля**. Своя копия этого правила в каждом стенде разошлась бы точно так же.
 *
 * Ключ переводится в идентификатор тем же порядком, каким его строит реестр
 * команд: строгое имя поля, kebab-case, направление.
 */
function fieldCommandId(cfg, key, direction) {
  const order = cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields.order : null;
  const strict = String((order && order.strictNames ? order.strictNames[key] : "") || key);
  const slug = strict.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug + "-" + String(direction || "next");
}

/**
 * Ключи полей его Order по стороне Block. Пусто — стенду нечего гонять, и он
 * обязан сказать это вслух, а не молча пройти нулём случаев.
 */
function fieldKeysBySide(cfg, side) {
  const order = cfg && cfg.pkm && cfg.pkm.fields ? cfg.pkm.fields.order : null;
  const list = order && Array.isArray(order[side]) ? order[side] : [];
  return list.slice();
}

function findDef(cfg, id) {
  const hit = defsFor(cfg).filter((d) => d.id === id);
  if (!hit.length) {
    throw new Error("нет команды " + JSON.stringify(id) + "; список — `node tools/line_bench.js list`");
  }
  return hit[0];
}

const paneSettings = panelBench.paneSettings;

/*
 * Правка отрезком, а не строкой целиком.
 *
 * Вид панели пишется **различием** (исключение 30 к З3, У-97): `replaceRange`
 * получает только изменившийся кусок и его границы. Подделка, которая границы
 * игнорирует и кладёт кусок вместо всей строки, отвечает мусором — и мусор
 * читается как дефект продукта. Строка здесь одна, поэтому из `from`/`to` нужны
 * только столбцы; их отсутствие значит «вся строка», как у `setLine`.
 */
function makeEditor(line, ch) {
  let cur = { line: 0, ch: Number(ch || 0) };
  let text = String(line || "");
  const clamp = (n) => Math.max(0, Math.min(text.length, Math.trunc(Number(n))));
  return {
    getCursor() { return { line: cur.line, ch: cur.ch }; },
    getLine() { return text; },
    lastLine() { return 0; },
    setLine(_n, v) { text = String(v || ""); },
    replaceRange(v, from, to) {
      const value = String(v == null ? "" : v);
      if (!from || !Number.isFinite(Number(from.ch))) { text = value; return; }
      const a = clamp(from.ch);
      const b = to && Number.isFinite(Number(to.ch)) ? clamp(to.ch) : a;
      text = text.slice(0, a) + value + text.slice(Math.max(a, b));
    },
    setCursor(next) { cur = { line: Number(next.line || 0), ch: Number(next.ch || 0) }; },
    snapshot() { return { line: text, cursor: { line: cur.line, ch: cur.ch } }; },
  };
}

function makeWindowMock() {
  const listeners = {};
  return {
    __tagWheelState: { active: false },
    addEventListener(t, h) { (listeners[t] = listeners[t] || []).push(h); },
    removeEventListener(t, h) { listeners[t] = (listeners[t] || []).filter((x) => x !== h); },
    fire(t, e) { (listeners[t] || []).slice().forEach((h) => h(e)); },
  };
}

/**
 * `app` Obsidian: активный редактор и **ловушка вместо vault**.
 *
 * Здесь стояло чтение заметки правил из тестового vault. Правила приезжают к
 * движкам и к панели ключом `Rules data` (PRD 10.13.52, П-8, шаг третий), и
 * ловушка — единственное, чем «взял из настроек» отличается от «дочитал с
 * диска»: пока файл под стендом лежал, обе дороги выглядели одинаково (У-56).
 */
function makeApp(editor) {
  const trap = (p) => {
    throw new Error("стенд: обращение в vault за '" + String(p && p.path ? p.path : p) + "'");
  };
  return {
    workspace: { activeLeaf: { view: { editor } }, activeEditor: { editor } },
    vault: { getAbstractFileByPath: trap, read: trap, adapter: { read: trap } },
  };
}

async function runCommandById(cfg, id, line, ch) {
  const def = findDef(cfg, id);
  const editor = makeEditor(line, ch);
  const said = [];
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  if (!global.window) global.window = makeWindowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  try {
    await runtime.runCommand({
      app: makeApp(editor),
      command: def.v2Command,
      settings: Object.assign(paneSettings(cfg), def.makeSettings(cfg)),
    });
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return Object.assign(editor.snapshot(), { said });
}

/*
 * Панель: открыть, нажать клавиши, применить. Контроль «панель открылась» стоит
 * здесь же и печатается всегда: пока она не открылась, движок возвращает строку
 * нетронутой, и вывод стенда читался бы как «ничего не сломано» (У-152).
 */
/**
 * Какие поля панель показывает в этом Block и в каком порядке она по ним ходит.
 *
 * Нужна тому, кто обходит все Fields разом: **порядок панели — это не порядок
 * Order**, и «дойти до нужного поля N нажатиями вправо» есть догадка. Здесь
 * спрашивается сама сессия: после каждого нажатия читается `activeFieldId`.
 */
async function fieldWalk(cfg, side, line, ch, steps) {
  const def = findDef(cfg, side === "right" ? "open-tagwheel-right" : "open-tagwheel-left");
  const editor = makeEditor(line, ch);
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = makeWindowMock();
  global.Notice = function Notice() {};
  const settings = Object.assign(paneSettings(cfg), def.makeSettings(cfg));
  const seen = [];
  try {
    await runtime.runCommand({ app: makeApp(editor), command: "tagWheel", settings });
    const st = global.window.__tagWheelState;
    if (!st || st.active !== true || !st.session) return [];
    const idNow = () => String(st.session.activeFieldId || st.session.activeField || "");
    seen.push(idNow());
    for (let i = 0; i < Math.max(0, Number(steps || 0)); i++) {
      global.window.fire("keydown", {
        key: "ArrowRight", code: "ArrowRight",
        preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
      });
      seen.push(idNow());
    }
    if (typeof st.cancel === "function") st.cancel();
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return seen;
}

/**
 * Открыть панель на готовой строке и спросить, **что она в ней узнала**.
 *
 * Отдельно от `runTagWheel`, потому что вопрос другой. `runTagWheel` спрашивает
 * «что панель напишет»; замечание заказчика 2026-09-12 («в right block были
 * выбраны элементы, но при активации TagWheel right они не распознались как
 * выбранные values, а отображались как текст») — про то, что панель **читает**.
 * Строку она при этом не портит: `Esc` возвращает исходную, и обход,
 * смотрящий только на строку, такого дефекта не видит вовсе.
 *
 * Отдаётся разбор строки, состав выбранного и вид панели — до `Esc`.
 */
async function openSession(cfg, side, line, ch) {
  const def = findDef(cfg, side === "right" ? "open-tagwheel-right" : "open-tagwheel-left");
  const editor = makeEditor(line, ch);
  const said = [];
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = makeWindowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  const settings = Object.assign(paneSettings(cfg), def.makeSettings(cfg));
  let out = { opened: false, parsed: null, selected: {}, control: "", said };
  try {
    await runtime.runCommand({ app: makeApp(editor), command: "tagWheel", settings });
    const st = global.window.__tagWheelState;
    out.opened = !!(st && st.active === true);
    out.control = editor.getLine();
    out.parsed = st && st.parsedLine ? st.parsedLine : null;
    out.selected = st && st.session && st.session.selected ? st.session.selected : {};
    if (st && typeof st.cancel === "function") st.cancel();
    out.afterCancel = editor.getLine();
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return out;
}

async function runTagWheel(cfg, side, line, ch, keys) {
  const def = findDef(cfg, side === "right" ? "open-tagwheel-right" : "open-tagwheel-left");
  const editor = makeEditor(line, ch);
  const said = [];
  const prevWindow = global.window;
  const prevNotice = global.Notice;
  global.window = makeWindowMock();
  global.Notice = function Notice(m) { said.push(String(m)); };
  const settings = Object.assign(paneSettings(cfg), def.makeSettings(cfg));
  const app = makeApp(editor);
  let opened = false;
  try {
    await runtime.runCommand({ app, command: "tagWheel", settings });
    opened = global.window.__tagWheelState && global.window.__tagWheelState.active === true;
    for (const key of (keys || [])) {
      global.window.fire("keydown", {
        key, code: key,
        preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
      });
    }
    await runtime.runCommand({ app, command: "tagWheel", settings });
  } finally {
    global.window = prevWindow;
    global.Notice = prevNotice;
  }
  return Object.assign(editor.snapshot(), { said, opened: !!opened });
}

function report(title, out) {
  console.log(title);
  console.log("  строка : " + JSON.stringify(out.line));
  console.log("  курсор : " + out.cursor.ch);
  if (out.opened !== undefined) console.log("  панель открылась: " + out.opened);
  if (out.said && out.said.length) console.log("  сказал : " + JSON.stringify(out.said));
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const cfg = loadCfg();

  if (!mode || mode === "list") {
    console.log("конфиг: " + DATA);
    console.log("команды: " + defsFor(cfg).map((d) => d.id).join(", "));
    return;
  }
  if (mode === "cmd") {
    const [id, line, ch] = rest;
    report("команда " + id, await runCommandById(cfg, id, line || "", ch || 0));
    return;
  }
  if (mode === "walk") {
    const [side, line, steps] = rest;
    console.log("порядок панели (" + (side || "left") + "): "
      + JSON.stringify(await fieldWalk(cfg, side, line || "", 0, steps || 8)));
    return;
  }
  if (mode === "open") {
    const [side, line] = rest;
    const out = await openSession(cfg, side, line || "", String(line || "").length);
    console.log("открытие панели " + (side || "left") + " на " + JSON.stringify(line || ""));
    console.log("  открылась : " + out.opened);
    console.log("  вид       : " + JSON.stringify(out.control));
    console.log("  после Esc : " + JSON.stringify(out.afterCancel));
    if (out.parsed) {
      console.log("  разбор    : tags=" + JSON.stringify(out.parsed.tags)
        + " text=" + JSON.stringify(out.parsed.text)
        + " dates=" + JSON.stringify(out.parsed.dates));
    }
    console.log("  узнано    : " + JSON.stringify(Object.keys(out.selected)
      .filter((k) => out.selected[k]).map((k) => k + "=" + out.selected[k])));
    if (out.said.length) console.log("  сказал    : " + JSON.stringify(out.said));
    return;
  }
  if (mode === "panel") {
    const [side, line, ...keys] = rest;
    report("панель " + (side || "left") + ", клавиши " + JSON.stringify(keys),
      await runTagWheel(cfg, side, line || "", 0, keys));
    return;
  }
  throw new Error("режимы: list | cmd <id> <строка> [курсор] | panel <left|right> <строка> [клавиши…]");
}

/* Стенд — и команда, и модуль: обход всех Fields разом собирается поверх него
   (`tools/line_matrix.js`), и своей копии дороги настроек у обхода нет. */
module.exports = { loadCfg, defsFor, findDef, fieldCommandId, fieldKeysBySide, runCommandById, runTagWheel, openSession, fieldWalk, makeEditor, DATA, VAULT };

if (require.main === module) {
  main().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  });
}
