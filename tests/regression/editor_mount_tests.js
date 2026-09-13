"use strict";

/**
 * Пересборка расширений редактора против того, **как их ставит Obsidian**.
 *
 * **Зачем проверка заведена.** До 2026-09-14 пересборка сначала пробовала
 * «дослать» расширения редактору, которого ещё не обслуживала: считалось, что
 * Obsidian ставит расширения плагина только тем редакторам, что откроются
 * после загрузки. Спрошено это было не у него. `registerEditorExtension` кладёт
 * расширение в `workspace.editorExtensions` и зовёт `updateOptions()`, а тот
 * обходит **все** листы и пересобирает свой компартмент
 * (`NJ.reconfigure(getDynamicExtensions())`, `app.js` 1.13.7).
 *
 * То есть наши компартменты уже лежат в сборке — внутри компартмента
 * платформы, — и второй `Compartment.of` того же компартмента это
 * `RangeError: Duplicate use of compartment in extensions`. Падал он на каждом
 * патче настроек и на каждой открытой заметке, а вместе с ним не выполнялся
 * толчок к перерисовке, стоящий следом.
 *
 * **Редактор здесь настоящий ровно там, где это решает вопрос** (У-1):
 * `EditorState` из того же пакета, что в сборке Obsidian, и его настоящая
 * пересборка. Подделан только `cm` — обёртка с `dispatch`, применяющим
 * транзакцию к состоянию: именно так к плагину и приходит редактор Obsidian.
 * `EditorView` тут не нужен и не годится — ему нужен DOM, а проверяемое
 * правило живёт в состоянии.
 */

const assert = require("node:assert");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const cmState = require(path.join(root, "node_modules", "@codemirror", "state"));
const mount = require(path.join(root, "src", "ui", "editor", "mount.js"));

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/** Плагин — ровно те поля, которые трогают `mountExtensions` и пересборка. */
function makePlugin() {
  const registered = [];
  return {
    registered,
    getConfig: () => ({}),
    registerEditorExtension: (ext) => { registered.push(ext); },
    handleEnhancedSelectAllKeymap: () => false,
    handleSmartDeleteKeymap: () => false,
    handleSmartBackspaceKeymap: () => false,
    handleSmartEnterKeymap: () => false,
    getLineTraceTxId: () => "test",
    _tagVisualCompartment: new cmState.Compartment(),
    _stripCompartment: new cmState.Compartment(),
    _tagwheelHeaderCompartment: new cmState.Compartment(),
    _sourceMarksCompartment: new cmState.Compartment(),
    app: null,
  };
}

/**
 * Редактор, собранный **как это делает Obsidian**: все расширения плагинов
 * лежат в одном компартменте платформы и приезжают в него `reconfigure`-ом.
 */
function makeObsidianEditor(plugin) {
  const platform = new cmState.Compartment();
  const box = {
    state: cmState.EditorState.create({
      doc: "- [ ] #todo :: 1 :: #processed",
      extensions: [platform.of(plugin.registered.slice())],
    }),
    dispatches: 0,
  };
  box.dispatch = (spec) => {
    box.dispatches += 1;
    box.state = box.state.update(spec).state;
  };
  return box;
}

function withCapturedErrors(fn) {
  const said = [];
  const real = console.error;
  console.error = (...args) => { said.push(args.map(String).join(" ")); };
  try { fn(); } finally { console.error = real; }
  return said;
}

test("пересборка на редакторе Obsidian не ругается и доезжает до толчка", () => {
  const plugin = makePlugin();
  mount.mountExtensions(plugin);
  const cm = makeObsidianEditor(plugin);
  plugin.app = { workspace: { getLeavesOfType: () => [{ view: { editor: { cm } } }] } };

  const said = withCapturedErrors(() => mount.refreshOpenEditors(plugin));
  assert.deepEqual(said, [],
    "пересборка пожаловалась в журнал: " + said.join(" ;; "));
  /*
   * Два `dispatch`: пересборка компартментов и толчок к перерисовке. Второй и
   * есть то, ради чего обход заведён, — без него правка настройки доезжает до
   * открытой заметки только после её следующей правки (У-56). Считается он
   * здесь, потому что до 2026-09-14 не выполнялся ни разу.
   */
  assert.equal(cm.dispatches, 2,
    "ожидалось два dispatch (пересборка и толчок), а было " + cm.dispatches);
});

test("контроль: второй `Compartment.of` в такой сборке и правда падает", () => {
  /*
   * Положительный контроль к предыдущему (У-88): «ошибок нет» обязано быть
   * правдой от правила, а не от того, что ронять нечем. Здесь то же
   * состояние получает ровно тот `appendConfig`, который стоял в пересборке до
   * 2026-09-14.
   */
  const plugin = makePlugin();
  mount.mountExtensions(plugin);
  const cm = makeObsidianEditor(plugin);
  let message = "";
  try {
    cm.dispatch({ effects: cmState.StateEffect.appendConfig.of([
      plugin._sourceMarksCompartment.of(plugin._sourceMarksExtension),
    ]) });
  } catch (e) {
    message = String((e && e.message) || e);
  }
  assert.match(message, /Duplicate use of compartment/,
    "досылка того же компартмента должна падать, а сказала: " + JSON.stringify(message));
});

test("пересборка переживает редактор, который упал на dispatch", () => {
  /*
   * Обход не имеет права бросить одну заметку без оформления из-за другой:
   * отказ сообщается в журнал, а обход продолжается. Правило это старое
   * (Д-4), и снимать его правкой 2026-09-14 не следовало.
   */
  const plugin = makePlugin();
  mount.mountExtensions(plugin);
  const good = makeObsidianEditor(plugin);
  const bad = { state: good.state, dispatch: () => { throw new Error("редактора больше нет"); } };
  plugin.app = { workspace: { getLeavesOfType: () => [
    { view: { editor: { cm: bad } } },
    { view: { editor: { cm: good } } },
  ] } };

  const said = withCapturedErrors(() => mount.refreshOpenEditors(plugin));
  assert.equal(said.length, 1, "об отказе должна быть ровно одна запись: " + said.join(" ;; "));
  assert.match(said[0], /editor-mount/, "запись не та: " + said[0]);
  assert.equal(good.dispatches, 2, "вторая заметка осталась без пересборки");
});

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log("  ok   " + t.name);
  } catch (e) {
    failed += 1;
    console.log("  FAIL " + t.name + ": " + String((e && e.message) || e));
  }
}
if (failed) process.exit(1);
