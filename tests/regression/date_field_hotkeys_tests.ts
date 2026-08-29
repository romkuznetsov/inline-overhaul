/**
 * Хоткеи поля-даты в заметке конфигурации (PRD 10.4, Б-11).
 *
 * Заметка показывает у каждого поля-даты хоткеи его команд `increase` и
 * `decrease`. До 2026-08-29 они были пустыми **всегда**: `getBoundHotkeyForCommand`
 * спрашивала `app.hotkeyManager` голым идентификатором команды
 * (`inlineOverhaul_Hotkey_<field>_increase`), а менеджер хранит их полными —
 * `<id плагина>:<id команды>`. Найти он не мог.
 *
 * Дефект найден при переносе Binder: колонка `Hotkey` там читает те же ключи,
 * и на них он и вылез. Правка сделана решением заказчика 2026-08-29.
 *
 * Настоящая здесь сама функция: она берётся из `main.js` обвязкой
 * `plugin_internals.ts`. Подделан `app.hotkeyManager` — это приватное API
 * Obsidian, в Node его нет вовсе.
 */

import assert from "node:assert/strict";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/** Менеджер хоткеев Obsidian: ключи полные, значения — списки привязок. */
function fakeApp(keys: Record<string, Array<{ modifiers: string[]; key: string }>>): Any {
  return { hotkeyManager: { customKeys: keys } };
}

const CFG = { pkm: { behavior: { elements: { byField: { due: {} } } } } };

{
  const app = fakeApp({
    "inline-overhaul:inlineOverhaul_Hotkey_due_increase": [{ modifiers: ["Mod"], key: "]" }],
    "inline-overhaul:inlineOverhaul_Hotkey_due_decrease": [{ modifiers: ["Mod"], key: "[" }],
  });
  const hk = internals.detectDateFieldHotkeys(app, CFG, "due", "inline-overhaul");
  assert.equal(hk.increase, "Mod + ]", "хоткей increase найден");
  assert.equal(hk.decrease, "Mod + [", "и decrease тоже");
  ok("хоткеи поля-даты находятся по полному идентификатору команды");
}

{
  /*
   * Та самая ошибка, ради которой проверка и написана: с голым ключом
   * менеджер молчит. Если правку однажды откатят, здесь станет красно.
   */
  const app = fakeApp({
    "inlineOverhaul_Hotkey_due_increase": [{ modifiers: ["Mod"], key: "]" }],
  });
  const hk = internals.detectDateFieldHotkeys(app, CFG, "due", "inline-overhaul");
  assert.equal(hk.increase, "",
    "голый ключ не находится — менеджер хранит их не так");
  ok("голый идентификатор в менеджере не ищется");
}

{
  /* Имени плагина нет — спрашиваем как раньше, но не падаем. */
  const app = fakeApp({
    "inlineOverhaul_Hotkey_due_increase": [{ modifiers: [], key: "F5" }],
  });
  const hk = internals.detectDateFieldHotkeys(app, CFG, "due");
  assert.equal(hk.increase, "F5", "без имени плагина остаётся прежнее поведение");
  assert.equal(hk.decrease, "", "и пустое остаётся пустым");
  ok("без имени плагина функция не падает");
}

{
  /* Ни поля, ни менеджера: пустой ответ, а не исключение. */
  assert.deepEqual(internals.detectDateFieldHotkeys(fakeApp({}), CFG, "", "inline-overhaul"),
    { increase: "", decrease: "" }, "поле не названо");
  assert.deepEqual(internals.detectDateFieldHotkeys({}, CFG, "due", "inline-overhaul"),
    { increase: "", decrease: "" }, "менеджера хоткеев нет");
  ok("на пустом входе — пустой ответ");
}

console.log("\n" + passed + " проверок пройдено");
