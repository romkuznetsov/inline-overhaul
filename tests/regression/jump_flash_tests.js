"use strict";
/**
 * Подсветка места, куда прыгнул курсор (Н5, его заказ 2026-09-16).
 *
 * Его ответы В-136: **только на прыжках**, два прыжка подряд — **гасить
 * прежний круг**, и задержка от 0 до 1 секунды, «если пользователь прыгает
 * сразу много, чтобы не возникало раздражение».
 *
 * **Что здесь настоящее.** Обёртка команд навигации
 * (`runNavigationGuard` в `plugin_commands.js`), список команд с пометкой
 * прыжка (`command_registry.js`), чтение настроек
 * (`jumpFlashLookFromConfig`) и сам слой (`createJumpFlashExtension`).
 * Подделан редактор и то, что у CodeMirror есть только в браузере —
 * координаты и узлы: другого способа позвать слой вне Obsidian нет (У-1).
 *
 * **Чего здесь нет и почему.** Того, что видно только глазом: круг, который
 * и правда уменьшается. Это решает браузерный шаг (`check_editor.js`), и
 * туда же уходит вопрос «гаснет ли он сам».
 */

const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..", "..");
const registry = require(path.join(ROOT, "src", "features", "command_registry.js"));
/*
 * Обёртка команд берётся загрузчиком внутренностей, а не прямым `require`:
 * её модуль требует `obsidian`, которого в Node нет вовсе (У-1).
 */
const { loadPluginInternals } = require(path.join(ROOT, "tests", "harness", "plugin_internals.ts"));
const internals = loadPluginInternals();
const decorations = require(path.join(ROOT, "src", "ui", "editor", "decorations.js"));
const visuals = require(path.join(ROOT, "src", "core", "editor_visuals_config.js"));
const normalize = require(path.join(ROOT, "src", "core", "config_normalize.js"));

let passed = 0;
function ok(what) { passed += 1; console.log("  ok " + what); }

function configWith(flash) {
  return normalize.migrateConfig({
    schemaVersion: 2,
    features: { navigation: { enabled: true } },
    navigation: { jumpToHeader: { enabled: true, flash: flash || {} } },
  });
}

/* ---- 1. Что о подсветке говорит конфиг --------------------------------- */
{
  const off = visuals.jumpFlashLookFromConfig(configWith({}));
  assert.equal(off.enabled, false, "умолчание — выключено: рисовать поверх заметки человек просит сам");

  const on = visuals.jumpFlashLookFromConfig(configWith({
    enabled: true, color: "#ff0000", radius: 24, fadeMs: 700, quietMs: 300, inLine: true,
  }));
  assert.deepEqual(
    { enabled: on.enabled, color: on.color, radius: on.radius, fadeMs: on.fadeMs, quietMs: on.quietMs, inLine: on.inLine },
    { enabled: true, color: "#ff0000", radius: 24, fadeMs: 700, quietMs: 300, inLine: true },
    "все шесть контролов доезжают до слоя");

  /* Границы ставит нормализация, а слой обязан получать уже прижатое: панель
     таких значений не выдаёт, а рукописный `data.json` выдаёт. */
  const wide = visuals.jumpFlashLookFromConfig(configWith({
    enabled: true, radius: 9000, fadeMs: 9000, quietMs: 9000,
  }));
  assert.deepEqual([wide.radius, wide.fadeMs, wide.quietMs], [40, 1500, 1000],
    "значения за шкалой прижимаются к её краям");

  /* Пусто — это ответ «взять у темы», а не пропуск (У-60). */
  assert.equal(visuals.jumpFlashLookFromConfig(configWith({ enabled: true })).color, "",
    "пустой цвет остаётся пустым и решается на шве");
  ok("Н5: настройки подсветки доезжают до слоя и прижимаются к шкале");
}

/* ---- 2. Команды помечены прыжком там, где курсор и правда переезжает ---- */
{
  const plugin = { app: {}, manifest: { id: "inline-overhaul" }, notice: () => {}, getConfig: () => ({}) };
  const defs = registry.buildNavigationCommandDefs(plugin);
  const kindOf = (id) => String((defs.find((d) => d && d.id === id) || {}).jump || "");

  assert.equal(kindOf("jump-back"), "jump", "переход по заголовкам назад — прыжок");
  assert.equal(kindOf("jump-next"), "jump", "переход по заголовкам вперёд — прыжок");
  assert.equal(kindOf("move-cursor-left-in-line"), "inline", "шаг внутри строки — прыжок своего рода");
  assert.equal(kindOf("move-cursor-right-in-line"), "inline", "и второй такой же");

  /*
   * Отрицательный контроль, и он важнее: перемещение строки курсор двигает
   * вместе с ней, но прыжком не является — круг там был бы вспышкой на
   * каждое нажатие.
   */
  assert.equal(kindOf("move-line-up"), "", "перемещение строки прыжком не считается");
  assert.equal(kindOf("move-line-down"), "", "и вниз тоже");
  assert.equal(kindOf("move-left"), "", "перенос выделенного текста — не прыжок");
  assert.equal(kindOf("move-right"), "", "и в другую сторону");
  ok("Н5: прыжком помечены четыре команды, и список объявлен там же, где сами команды");
}

/* ---- 3. Сигнал доходит до слоя ровно тогда, когда курсор переехал ------- */
/* Обёртка команд асинхронная, и её надо дождаться: утверждение, снятое сразу
   за вызовом, читает состояние до работы команды (тот же класс, что У-130). */
async function seamSuite() {
  /**
   * Подделка слоя: считает, сколько раз ей сказали «прыжок случился».
   *
   * Настоящий слой рисует узел, и вне браузера у него нет ни координат, ни
   * родителя; предмет этой проверки — **шов**, а не картинка (У-1).
   */
  function makeSeam(cfg) {
    const fired = [];
    const plugin = {
      app: {},
      manifest: { id: "inline-overhaul" },
      notice: () => {},
      getConfig: () => cfg,
      __ioJumpFlashViews: [{ view: { hasFocus: true }, fire: (look) => fired.push(look) }],
    };
    return { plugin, fired };
  }

  /* Редактор-подделка: держит курсор и умеет его двигать. Решений он не
     принимает — двигает ровно то, что попросили. */
  function makeEditor(line, ch) {
    let cur = { line: line, ch: ch };
    return {
      getCursor: () => ({ line: cur.line, ch: cur.ch }),
      moveTo: (l, c) => { cur = { line: l, ch: c }; },
    };
  }

  const cfg = configWith({ enabled: true, radius: 20, fadeMs: 300, quietMs: 0 });

  /* Курсор переехал — круг просят нарисовать. */
  {
    const seam = makeSeam(cfg);
    const ed = makeEditor(0, 0);
    seam.plugin.getActiveEditor = () => ed;
    seam.plugin.navRuntime = {};
    await internals.runNavigationGuard(seam.plugin, "navigation",
      (editor) => { editor.moveTo(5, 2); }, "jump");
    assert.equal(seam.fired.length, 1, "прыжок, сдвинувший курсор, просит круг");
  }

  /*
   * А не переехал — не просят. Это отрицательный контроль, и без него зелёное
   * значило бы «круг на каждое нажатие»: команда, упёршаяся в край заметки,
   * рисовала бы вспышку там, где ничего не случилось.
   */
  {
    const seam = makeSeam(cfg);
    const ed = makeEditor(3, 7);
    seam.plugin.getActiveEditor = () => ed;
    seam.plugin.navRuntime = {};
    await internals.runNavigationGuard(seam.plugin, "navigation", () => {}, "jump");
    assert.equal(seam.fired.length, 0, "прыжок, не сдвинувший курсор, круга не просит");
  }

  /* Команда, прыжком не помеченная, не просит круга, даже двигая курсор. */
  {
    const seam = makeSeam(cfg);
    const ed = makeEditor(0, 0);
    seam.plugin.getActiveEditor = () => ed;
    seam.plugin.navRuntime = {};
    await internals.runNavigationGuard(seam.plugin, "navigation",
      (editor) => { editor.moveTo(9, 0); }, "");
    assert.equal(seam.fired.length, 0, "не прыжок — круга нет, как бы курсор ни двигался");
  }
  ok("Н5: круг просят только там, где прыжок и правда переставил курсор");
}

/* ---- 4. Тумблеры решают, доходит ли сигнал до слоя ---------------------- */
{
  function makeView() {
    const fired = [];
    return { fired, entry: { view: { hasFocus: true }, fire: (look) => fired.push(look) } };
  }
  const run = (cfg, kind) => {
    const v = makeView();
    const plugin = { getConfig: () => cfg, __ioJumpFlashViews: [v.entry] };
    const answer = decorations.fireJumpFlash(plugin, kind);
    return { answer: answer, fired: v.fired.length };
  };

  const off = run(configWith({ enabled: false }), "jump");
  assert.deepEqual([off.answer, off.fired], [false, 0], "выключенная подсветка молчит");

  const on = run(configWith({ enabled: true }), "jump");
  assert.deepEqual([on.answer, on.fired], [true, 1], "включённая рисует на прыжке по заголовкам");

  const inlineOff = run(configWith({ enabled: true, inLine: false }), "inline");
  assert.deepEqual([inlineOff.answer, inlineOff.fired], [false, 0],
    "шаг внутри строки без своего тумблера круга не получает");

  const inlineOn = run(configWith({ enabled: true, inLine: true }), "inline");
  assert.deepEqual([inlineOn.answer, inlineOn.fired], [true, 1],
    "а с ним получает");

  /* Слоя нет вовсе — рисовать негде, и это ответ, а не отказ. */
  const noViews = decorations.fireJumpFlash({ getConfig: () => configWith({ enabled: true }) }, "jump");
  assert.equal(noViews, false, "без единого живого редактора круг не рисуется и никто не падает");
  ok("Н5: тумблеры решают судьбу сигнала, и оба рода прыжка разведены");
}

seamSuite().then(() => {
  console.log("\n" + passed + " проверок пройдено");
}).catch((e) => { console.error(e); process.exit(1); });
