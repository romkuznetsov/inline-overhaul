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
  assert.ok(commands.has("state-next"), "S6: переименованный Field не получил команду нового имени");
  assert.ok(!commands.has("status-next") && removed.includes("status-next"), "S6: прежнее имя осталось в палитре");

  const gone = I.migrateConfig({ ...cfg, pkm: { fields: { order: { left: [], right: [], strictNames: {}, types: {} }, tags: { fields: [] } } } });
  write(gone);
  assert.ok(!commands.has("state-next"), "S7: команда удалённого Field осталась");

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

/* 4. BUGHUNT R4 (F8, T20): двери PKM и Transform не пускают на код и таблицу. */
{
  const cfg = config([]);
  cfg.transform.inline2note.enabled = true;
  const lines = ["- текст", "```js", "let x=1;", "```", "| 1 | 2 |"];
  const said: string[] = [];
  const at = (line: number): Any => ({
    getConfig: () => cfg,
    notice: (m: string) => { said.push(m); },
    getActiveEditor: () => ({ getCursor: () => ({ line, ch: 0 }), getLine: (n: number) => lines[n] }),
    devLogEvent: () => {},
  });
  const ran: number[] = [];
  const before = notices.length;
  for (const line of [0, 1, 2, 3, 4]) await I.runPkmGuard(at(line), async () => { ran.push(line); });
  said.push(...notices.slice(before));
  assert.deepEqual(ran, [0], "F8: команда PKM прошла на строку кода или таблицы: " + ran.join(","));
  assert.ok(said.some((m) => /code block or a table/.test(m)), "F8: отказ молчит");
  said.length = 0;
  await I.runInlineToNote(at(1));
  assert.ok(said.some((m) => /code block or a table/.test(m)), "T20: Transform не отказал на ограде кода: " + said.join(" | "));
  ok("PKM и Transform не трогают строку кода и таблицы, отрицательный контроль — строка текста");
}

console.log(passed + " проверок пройдено");
