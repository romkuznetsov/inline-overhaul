"use strict";
/**
 * Вход команды текста — `textCommandBlocked` в `plugin_commands.js` (H2.3 и
 * H3.1 прогона 2026-10-02).
 *
 * **Что здесь настоящее.** Сам шов и решение о фокусе. Подделаны редактор
 * (`view.dispatch` запоминает, что ему прислали) и `@codemirror/commands` —
 * названной заглушкой харнесса `ISOLATE_STUB`: настоящий модуль в Node не
 * грузится, он тянет `@codemirror/view` (У-1).
 *
 * **Чего здесь нет.** Того, что история CodeMirror и правда разводит набор и
 * команду: это меряет стенд `node tools/obsidian_bench.js undo-after-typing`
 * в настоящем Obsidian, и его контроль — прежняя сборка через `IO_MAIN`.
 * Эта проверка отвечает на «шов не замолчал»: мутация «не посылать пометку»
 * роняет её (правило 124).
 */

const path = require("path");
const assert = require("assert");

const ROOT = path.join(__dirname, "..", "..");
const { loadPluginInternals } = require(path.join(ROOT, "tests", "harness", "plugin_internals.ts"));
const internals = loadPluginInternals();

let passed = 0;
function ok(what) { passed += 1; console.log("  ok " + what); }

function pluginWithView() {
  const sent = [];
  const plugin = { app: { workspace: { activeEditor: { editor: { cm: { dispatch: (spec) => sent.push(spec) } } } } } };
  return { plugin, sent };
}

{
  const { plugin, sent } = pluginWithView();
  /* Контроль среды: фокус в Node нигде, значит команда идёт. */
  assert.equal(internals.textCommandBlocked(plugin), false, "фокус в тексте — команда не заблокирована");
  assert.equal(sent.length, 1, "редактору послана ровно одна транзакция: " + JSON.stringify(sent));
  assert.deepEqual(sent[0], { annotations: { isolateHistory: "before" } },
    "и это пустая транзакция с isolateHistory = before — своя ступень отмены у команды");
  ok("команда текста закрывает группу набора перед своей правкой");
}

{
  const { plugin, sent } = pluginWithView();
  const prev = globalThis.activeDocument;
  globalThis.activeDocument = { activeElement: { closest: (sel) => (/metadata-container/.test(sel) ? {} : null) } };
  try {
    assert.equal(internals.textCommandBlocked(plugin), true, "фокус в свойствах — команда молчит");
    assert.equal(sent.length, 0, "и редактору ничего не посылается");
  } finally {
    globalThis.activeDocument = prev;
  }
  ok("фокус в свойствах: команда молчит и историю не трогает");
}

{
  /* Редактора нет (открыт не Markdown) — шов молчит, а не падает. */
  assert.equal(internals.textCommandBlocked({ app: { workspace: { activeEditor: null } } }), false);
  ok("без редактора шов не падает");
}

console.log("\n" + passed + " passed");
