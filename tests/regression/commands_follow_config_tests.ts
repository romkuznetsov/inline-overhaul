/**
 * Набор команд идёт за настройками (BUGHUNT 2026-09-26, корень R3; ревизия Д-1).
 *
 * **Что было.** Команды PKM и Binder строятся из конфига, а заводились один
 * раз — при загрузке и на трёх действиях с custom block. Переименованный Field
 * жил в палитре прежним именем (S6), удалённый — молчащей командой (S7),
 * строка Binder после восстановления копии вставляла прежний текст (Д-1), а
 * строка Binder, названная `Priority next`, получала идентификатор команды
 * поля и забирала её вместе с хоткеем (K1).
 *
 * **Что закреплено.**
 *   1. Разводка идентификатора Binder против команд Field — на конфиге через
 *      `migrateConfig` (правило 2), с отрицательным контролем: строка с
 *      несовпадающим именем идентификатор не меняет.
 *   2. Подписка загрузки (`followConfigWithCommands`) на запись в хранилище
 *      переименовывает и снимает команды Field и строки Binder.
 *   3. Команда Binder спрашивает текст у нынешнего конфига, а не у того, с
 *      которым её завели.
 *
 * Подделан Obsidian (`addCommand`/`removeCommand`) и хранилище (подписка):
 * реестр команд, нормализация и регистрация — настоящие (правило 1).
 */

import assert from "node:assert/strict";
import { notices, setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

setupGlobals();
type Any = ReturnType<typeof JSON.parse>;
const I = loadPluginInternals();

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

function config(rows: Any[]): Any {
  return I.migrateConfig({
    schemaVersion: 2,
    pkm: {
      fields: {
        order: { left: ["Status"], right: [], strictNames: { Status: "Status" }, types: { Status: "tag" } },
        tags: { fields: [{ id: "Status", prefix: "#", values: [{ token: "todo" }, { token: "done" }] }] },
      },
    },
    editor: { binder: { rows } },
  });
}

const rowIds = (cfg: Any): string[] => cfg.editor.binder.rows.map((r: Any) => r.commandId);

/* 1. K1: строка Binder не забирает идентификатор команды Field. */
{
  const cfg = config([
    { rowId: "r1", insertText: "PP", commandName: "Status next", commandId: "" },
    { rowId: "r2", insertText: "QQ", commandName: "Quote", commandId: "" },
  ]);
  const ids = rowIds(cfg);
  assert.ok(!ids.includes("status-next"), "строка Binder забрала идентификатор команды поля: " + ids.join(", "));
  assert.ok(ids.includes("status-next-2"), "строка Binder не получила разведённый идентификатор: " + ids.join(", "));
  assert.ok(ids.includes("quote"), "отрицательный контроль: строка без совпадения сменила идентификатор");
  /* Строка, уже записанная с чужим идентификатором (так её оставил 0.10.0), разводится при чтении. */
  const old = config([{ rowId: "r1", insertText: "PP", commandName: "Status next", commandId: "status-next" }]);
  assert.ok(!rowIds(old).includes("status-next"), "занятый идентификатор из файла не разведён");
  ok("идентификатор строки Binder разводится с командами Field, прочее не трогается");
}

/* 2 и 3. Подписка сверяет набор команд; Binder берёт текст у нынешнего конфига. */
{
  let cfg = config([{ rowId: "r2", insertText: "QQ", commandName: "Quote", commandId: "" }]);
  const listeners: Array<() => void> = [];
  const commands = new Map<string, Any>();
  const removed: string[] = [];
  const inserted: string[] = [];
  const editor = {
    getCursor: () => ({ line: 0, ch: 0 }),
    replaceRange: (t: string) => { inserted.push(t); },
    setCursor: () => {},
  };
  const plugin: Any = {
    getConfig: () => cfg,
    getActiveEditor: () => editor,
    addCommand: (c: Any) => { commands.set(c.id, c); },
    removeCommand: (id: string) => { removed.push(id); commands.delete(id); },
    register: () => {},
    store: { subscribe: (fn: () => void) => { listeners.push(fn); return () => {}; } },
    registerPkmCommands() { I.registerPkm(this); },
    registerBinderCommands() { I.registerBinder(this); },
  };
  I.registerPkm(plugin);
  I.registerBinder(plugin);
  I.followConfigWithCommands(plugin);
  assert.equal(listeners.length, 1, "загрузка не подписалась на хранилище");
  const write = (next: Any): void => { cfg = next; listeners.forEach((fn) => fn()); };

  assert.ok(commands.has("status-next"), "команды поля не заведены");
  const renamed = config([{ rowId: "r2", insertText: "QQ", commandName: "Quote", commandId: "quote" }]);
  renamed.pkm.fields.order.strictNames.Status = "State";
  write(I.migrateConfig(renamed));
  /* В-275: адрес — из ключа, хоткей держится; имя в палитре — новое (S6). */
  assert.ok(!commands.has("state-next"), "В-275: переименование сменило адрес команды");
  assert.match(String(commands.get("status-next") && commands.get("status-next").name), /State next/, "S6: в палитре прежнее имя");

  const gone = I.migrateConfig({ ...cfg, pkm: { fields: { order: { left: [], right: [], strictNames: {}, types: {} }, tags: { fields: [] } } } });
  write(gone);
  assert.ok(!commands.has("status-next") && removed.includes("status-next"), "S7: команда удалённого Field осталась");

  await commands.get("quote").callback();
  assert.deepEqual(inserted, ["QQ"], "Binder не вставил свой текст");
  const edited = JSON.parse(JSON.stringify(cfg));
  edited.editor.binder.rows.find((r: Any) => r.commandId === "quote").insertText = "NEW";
  write(I.migrateConfig(edited));
  await commands.get("quote").callback();
  assert.deepEqual(inserted, ["QQ", "NEW"], "Д-1: команда Binder вставила прежний текст");

  const dropped = JSON.parse(JSON.stringify(cfg));
  dropped.editor.binder.rows = dropped.editor.binder.rows.filter((r: Any) => r.commandId !== "quote");
  write(I.migrateConfig(dropped));
  assert.ok(!commands.has("quote") && removed.includes("quote"), "Д-1: удалённая строка Binder осталась командой");
  ok("запись в хранилище переименовывает и снимает команды Field и Binder, текст Binder — нынешний");
}

/*
 * 2а. В-275: у Field, переименованного до перехода на адрес из ключа, хоткей
 * переезжает со старого адреса при загрузке; у непереименованного — не трогается.
 */
{
  const cfg = config([]);
  cfg.pkm.fields.order.strictNames.Status = "State";
  const custom: Record<string, unknown> = {
    "inline-overhaul:state-next": [{ modifiers: ["Mod"], key: "J" }],
    "inline-overhaul:other": [{ modifiers: ["Mod"], key: "K" }],
  };
  let saves = 0;
  const hotkeyManager = {
    get customKeys() { return { ...custom }; },
    setHotkeys: (id: string, keys: unknown[]) => { custom[id] = keys; },
    removeHotkeys: (id: string) => { delete custom[id]; },
    save: () => { saves++; },
  };
  const plugin: Any = { getConfig: () => cfg, addCommand: () => {}, removeCommand: () => {}, app: { hotkeyManager } };
  I.registerPkm(plugin);
  assert.deepEqual(custom["inline-overhaul:status-next"], [{ modifiers: ["Mod"], key: "J" }], "хоткей не переехал на адрес из ключа");
  assert.ok(!("inline-overhaul:state-next" in custom) && saves === 1, "старый адрес не снят или файл не записан");
  assert.ok("inline-overhaul:other" in custom, "тронут чужой хоткей");
  const fresh: Any = { getConfig: () => config([]), addCommand: () => {}, removeCommand: () => {}, app: { hotkeyManager } };
  I.registerPkm(fresh);
  assert.equal(saves, 1, "отрицательный контроль: у непереименованного Field что-то переносилось");
  ok("В-275: хоткей переименованного раньше Field переезжает на адрес из ключа");
}

/* 3а. BUGHUNT S19, S20: запись не из панели пересобирает панель, своя — нет. */
{
  const cfg = config([]);
  const listeners: Array<(p: Any) => void> = [];
  let updates = 0;
  const plugin: Any = {
    getConfig: () => cfg,
    addCommand: () => {},
    removeCommand: () => {},
    register: () => {},
    store: { subscribe: (fn: (p: Any) => void) => { listeners.push(fn); return () => {}; } },
    registerPkmCommands() {},
    registerBinderCommands() {},
    _settingTab: { update: () => { updates++; } },
  };
  I.followConfigWithCommands(plugin);
  for (const reason of ["command:undo", "toggle:pkm", "external"]) listeners.forEach((fn) => fn({ reason }));
  assert.equal(updates, 3, "отмена, тумблер командой или внешняя правка не пересобрали панель");
  for (const reason of ["settings:pkm.behavior.cursorPolicy", "pkm:behavior:order:block-add:b1"]) listeners.forEach((fn) => fn({ reason }));
  assert.equal(updates, 3, "отрицательный контроль: своя запись панели пересобрала её");
  ok("панель пересобирается на записи не из неё, и только на них");
}

/* 3б. D22 перечня 2026-09-30: строку с фокусом платформа при пересборке
   пропускает (`app.js` 1.13.7), поэтому фокус внутри панели снимается до
   `update()`; фокус вне панели не трогается. */
{
  const listeners: Array<(p: Any) => void> = [];
  const order: string[] = [];
  const inside = { blur: () => { order.push("blur"); } };
  const outside = { blur: () => { order.push("blur-outside"); } };
  let focused: Any = inside;
  const containerEl = { doc: { get activeElement() { return focused; } }, contains: (n: Any) => n === inside };
  const plugin: Any = {
    getConfig: () => config([]), addCommand: () => {}, removeCommand: () => {}, register: () => {},
    store: { subscribe: (fn: (p: Any) => void) => { listeners.push(fn); return () => {}; } },
    registerPkmCommands() {}, registerBinderCommands() {},
    _settingTab: { containerEl, update: () => { order.push("update"); } },
  };
  I.followConfigWithCommands(plugin);
  listeners.forEach((fn) => fn({ reason: "command:undo" }));
  assert.deepEqual(order, ["blur", "update"], "фокус в панели не снят до пересборки: " + order.join(","));
  focused = outside;
  listeners.forEach((fn) => fn({ reason: "command:undo" }));
  assert.deepEqual(order, ["blur", "update", "update"], "снят фокус вне панели: " + order.join(","));
  ok("D22: отмена командой снимает фокус в панели, и щёлкнутый тумблер перерисовывается");
}

/* 4. BUGHUNT R4 (F8, T20): двери PKM и Transform не пускают на код и таблицу. */
{
  const cfg = config([]);
  cfg.transform.inline2note.enabled = true;
  /* Таблица — с рядом-разделителем, как её рисует Obsidian (Q1). */
  const lines = ["- текст", "```js", "let x=1;", "```", "| a | b |", "|---|---|"];
  const said: string[] = [];
  const at = (line: number): Any => ({
    getConfig: () => cfg,
    notice: (m: string) => { said.push(m); },
    getActiveEditor: () => ({ getCursor: () => ({ line, ch: 0 }), getLine: (n: number) => lines[n] }),
    devLogEvent: () => {},
  });
  const ran: number[] = [];
  const before = notices.length;
  for (const line of [0, 1, 2, 3, 4, 5]) await I.runPkmGuard(at(line), async () => { ran.push(line); });
  said.push(...notices.slice(before));
  assert.deepEqual(ran, [0], "F8: команда PKM прошла на строку кода или таблицы: " + ran.join(","));
  assert.ok(said.some((m) => /code block, a table/.test(m)), "F8: отказ молчит");
  said.length = 0;
  await I.runInlineToNote(at(1));
  assert.ok(said.some((m) => /code block, a table/.test(m)), "T20: Transform не отказал на ограде кода: " + said.join(" | "));
  ok("PKM и Transform не трогают строку кода и таблицы, отрицательный контроль — строка текста");
}

/* 5. Команда Field без Value не молчит (обход line_matrix на его конфиге: Field `AI` с `values: [""]`). */
{
  const cfg = I.migrateConfig({
    schemaVersion: 2,
    pkm: {
      fields: {
        order: { left: ["Status", "Empty"], right: [], strictNames: { Status: "Status", Empty: "Empty" }, types: { Status: "tag", Empty: "tag" } },
        tags: { fields: [
          { id: "Status", prefix: "#", values: [{ token: "todo" }] },
          { id: "Empty", prefix: "#", values: [""] },
        ] },
      },
    },
  });
  const callbacks = new Map<string, () => Promise<void>>();
  const plugin: Any = {
    getConfig: () => cfg,
    addCommand: (c: Any) => { callbacks.set(c.id, c.callback); },
    removeCommand: () => {},
    getActiveEditor: () => ({ getCursor: () => ({ line: 0, ch: 0 }), getLine: () => "- текст" }),
    devLogEvent: () => {},
  };
  I.registerPkm(plugin);
  const run = callbacks.get("empty-next");
  assert.ok(run, "команда Field без Value не заведена: " + Array.from(callbacks.keys()).join(", "));
  const before = notices.length;
  await run!();
  const said = notices.slice(before);
  assert.ok(said.some((m: string) => /Empty has no Values yet/.test(m)), "команда Field без Value молчит: " + said.join(" | "));
  /* Отрицательный контроль: у Field с Value этого отказа нет (движок здесь может упасть на подделке — это не предмет). */
  const mark = notices.length;
  await callbacks.get("status-next")!();
  assert.ok(!notices.slice(mark).some((m: string) => /has no Values/.test(m)), "отказ сказан и у Field с Value");
  ok("команда Field без Value говорит, что Value нет");
}

/*
 * 6. Фокус в свойствах заметки или в её заголовке — команды текста молчат, как
 * у платформы (`addCommand` в `app.js` 1.13.7; прогон 2026-10-02, H3.1). Без
 * правки хоткей в поле свойства правил текст по невидимой каретке.
 * Контроль «команда дошла бы до дела»: при фокусе в тексте каждая доходит до
 * своего отказа на подделке и говорит его вслух.
 */
{
  const cfg = config([{ rowId: "r1", insertText: "XX", commandName: "Insert XX", commandId: "" }]);
  cfg.transform.inline2note.enabled = true;
  const callbacks = new Map<string, () => Promise<void>>();
  const plugin: Any = {
    getConfig: () => cfg,
    addCommand: (c: Any) => { callbacks.set(c.id, c.callback); },
    removeCommand: () => {},
    notice: (m: string) => { notices.push(m); },
    getActiveEditor: () => null,
    devLogEvent: () => {},
    _registeredBinderCommandIds: new Set(), _registeredBinderCommandNames: new Map(),
  };
  I.registerNavigation(plugin);
  I.registerPkm(plugin);
  I.registerBinder(plugin);
  I.registerTransform(plugin);
  const ids = ["move-line-up", "status-next", "insert-xx", "transform-inline-to-note"];
  for (const id of ids) assert.ok(callbacks.has(id), "нет команды " + id + ": " + Array.from(callbacks.keys()).join(", "));
  const g = globalThis as Any;
  const saved = g.activeDocument;
  const focusIn = (sel: string | null): void => {
    g.activeDocument = { activeElement: { closest: (q: string) => (sel && q.includes(sel) ? {} : null) } };
  };
  try {
    for (const where of [".metadata-container", ".inline-title", ".view-header-title"]) {
      focusIn(where);
      for (const id of ids) {
        const mark = notices.length;
        await callbacks.get(id)!();
        assert.deepEqual(notices.slice(mark), [], id + " при фокусе в " + where + " исполнилась: " + notices.slice(mark).join(" | "));
      }
    }
    focusIn(null);
    for (const id of ids) {
      const mark = notices.length;
      await callbacks.get(id)!();
      assert.ok(notices.length > mark, "контроль: " + id + " при фокусе в тексте не дошла до дела");
    }
  } finally {
    g.activeDocument = saved;
  }
  ok("фокус в свойствах и заголовке — команды текста молчат, в тексте — исполняются");
}

console.log(passed + " проверок пройдено");
