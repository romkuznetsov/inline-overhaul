/**
 * Отметки на строке: подсветка обработанной и `Floating button` (PRD 10.13.12).
 *
 * Проверка на НАСТОЯЩИХ функциях плагина: `getSourceMarksFromConfig`,
 * `lineHasProcessedToken` и виджет кнопки берутся из `main.js` загрузчиком
 * `tests/harness/plugin_internals.ts`. Подделан только DOM — кнопка живёт в
 * редакторе Obsidian, и другого способа посмотреть на её узел нет.
 *
 * Что здесь важно про смысл. Обработанной строку делает **метка**
 * (`Mark the line as done`), другого признака у плагина нет: он потребовал бы
 * держать состояние рядом с заметкой, а заметка — единственный источник
 * правды о том, что в ней написано. Отсюда всё остальное: пустая метка
 * означает, что подсвечивать нечего.
 */

import assert from "node:assert/strict";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;
const I = loadPluginInternals();

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

/** Конфиг ровно тех веток, которые читают отметки. */
function cfg(over: Any): Any {
  const sp = Object.assign({ token: "#processed" }, over.sourceProcessing || {});
  return {
    features: { transform: { enabled: over.moduleOn !== false } },
    transform: {
      inline2note: {
        enabled: over.i2nOn !== false,
        floatingButton: over.floatingButton === true,
        sourceProcessing: Object.assign(sp, {
          visual: Object.assign({ enabled: false, color: "", opacity: 65 }, over.visual || {}),
        }),
      },
    },
  };
}

{
  const marks = I.getSourceMarksFromConfig(cfg({ visual: { enabled: true } }));
  assert.equal(marks.highlight, true, "подсветка включается тумблером");
  assert.equal(marks.opacity, 0.65, "процент из конфига становится долей для CSS");
  ok("подсветка читает свои ключи");
}

{
  /* Метка — единственный признак обработанной строки, и без неё подсвечивать
     нечего (Н3). Именно это, а не тумблер, решает судьбу контрола в панели. */
  const marks = I.getSourceMarksFromConfig(cfg({ visual: { enabled: true }, sourceProcessing: { token: "" } }));
  assert.equal(marks.highlight, false, "пустая метка отменяет подсветку, чего бы ни стоял тумблер");
  ok("нет метки — нет подсветки");
}

{
  const off = I.getSourceMarksFromConfig(cfg({ visual: { enabled: true }, floatingButton: true, moduleOn: false }));
  assert.equal(off.highlight, false, "выключенный модуль убирает подсветку");
  assert.equal(off.button, false, "и кнопку");
  const noI2n = I.getSourceMarksFromConfig(cfg({ visual: { enabled: true }, floatingButton: true, i2nOn: false }));
  assert.equal(noI2n.highlight, false, "выключенный Inline to note — тоже");
  assert.equal(noI2n.button, false, "и кнопку тоже");
  ok("выключенный модуль сильнее обоих тумблеров");
}

{
  const t = (line: string): boolean => I.lineHasProcessedToken(line, "#processed");
  assert.equal(t("- text || #processed"), true, "метка в конце строки находится");
  assert.equal(t("#processed || text"), true, "и в начале");
  assert.equal(t("- text"), false, "строки без метки не трогаются");
  /* Метка — отдельный токен, а не кусок слова: иначе зажглась бы половина
     страницы у того, кто пишет `#processed-later`. */
  assert.equal(t("- text || #processed-later"), false, "часть длинного тега меткой не считается");
  assert.equal(t("- text || ##processed"), false, "и хвост чужого тега тоже");
  assert.equal(I.lineHasProcessedToken("- text", ""), false, "пустая метка не находится нигде");
  ok("метка ищется целым токеном");
}

{
  /* Кнопка зовёт тот же метод плагина, что и команда (Н9). Проверяется это
     единственным способом, который не повторяет её код: нажатием. */
  let calls = 0;
  const plugin: Any = { runInlineToNote: () => { calls++; return Promise.resolve(); } };
  const node = new I.FloatingTransformButtonWidget(plugin).toDOM();
  assert.ok(String(node.getAttribute("aria-label") || "").length, "у кнопки есть подпись для чтения с экрана");
  node.dispatch("mousedown", { preventDefault: () => {}, stopPropagation: () => {} });
  assert.equal(calls, 1, "нажатие зовёт перенос строки один раз");
  ok("кнопка и команда ходят одним путём");
}

{
  /* Его слово 2026-09-25: на обработанной строке кнопки нет — «чтобы
     пользователь случайно не нажал повторно». */
  const plugin: Any = { getConfig: () => cfg({ floatingButton: true }) };
  const at = (text: string): number => I.floatingButtonLineNumber({ state: {
    selection: { main: { head: 0 } },
    doc: { lineAt: () => ({ number: 1, text }), line: () => ({ text }) },
  } }, plugin);
  /* Документ из нескольких строк — у CodeMirror `doc.line(n)` (У-172); каретка на строке `at`. */
  const atLine = (lines: string[], n: number): number => I.floatingButtonLineNumber({ state: {
    selection: { main: { head: 0 } },
    doc: { lineAt: () => ({ number: n + 1, text: lines[n] }), line: (k: number) => ({ text: lines[k - 1] }) },
  } }, plugin);
  assert.equal(at("- text"), 1, "на обычной строке кнопка есть");
  assert.equal(at("- [[text]] #processed"), -1, "на строке с меткой кнопки нет");
  assert.equal(at("- text #processed-later"), 1, "часть длинного тега меткой не считается");
  /* BUGHUNT T20: ограда кода, код и таблица в заметку не превращаются — кнопки нет. */
  const code = ["```js", "let x=1;", "```", "| 1 | 2 |", "- text"];
  assert.deepEqual([0, 1, 2, 3, 4].map((n) => atLine(code, n)), [-1, -1, -1, -1, 5], "кнопка на коде или таблице");
  ok("на обработанной строке плавающей кнопки нет");
}

console.log("\n" + passed + " проверок пройдено");
