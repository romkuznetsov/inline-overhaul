/**
 * Binder (PRD 10.4, фаза 3c).
 *
 * Что здесь настоящее. Путь записи — плагиновый: `ConfigStore` из `src/core`,
 * `deepMerge` и `cloneJson` из `shared_utils.js`, `migrateConfig` из `main.js`
 * (`tests/harness/plugin_internals.ts`) — а значит и `normalizeBinderRows`,
 * которая идёт внутри него. Команды считает реестр: `buildBinderCommandDefs`
 * из `src/features/command_registry.js`, та самая функция, по которой плагин
 * их и регистрирует.
 *
 * Отсюда главная проверка блока: она не сверяет ключи в конфиге, а спрашивает
 * реестр. Строка заводится нажатиями в панели — и реестр обязан увидеть новую
 * команду с непустым идентификатором и тем именем, которое человек увидит в
 * списке хоткеев. Удалили строку — команда обязана исчезнуть.
 *
 * Подделаны две вещи, обе названы:
 *   * DOM — блок рисуется в Obsidian, другого способа нажать нет;
 *   * `app.hotkeyManager` и `app.setting` — приватное API Obsidian, в Node их
 *     нет вовсе. Именно про их отсутствие и написан К-2, и это отсутствие
 *     здесь тоже проверяется.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { createBinderModel, SYSTEM_ROW_ID } from "../../src/ui/settings/custom/binder_model.ts";
import {
  renderBinder,
  renderAddForm,
  HEAD,
  HOTKEY_NONE,
  rowTitle,
} from "../../src/ui/settings/custom/binder_view.ts";
import {
  canOpenHotkeys,
  fullCommandId,
  hotkeyOf,
  openHotkeys,
} from "../../src/ui/settings/custom/hotkeys.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);

const shared = requireCjs(path.join(root, "src", "core", "shared_utils.js")) as {
  cloneJson: (x: Any) => Any;
  isObj: (x: Any) => boolean;
  deepMerge: (a: Any, b: Any) => Any;
};
const { ConfigStore } = requireCjs(path.join(root, "src", "core", "config_store.js")) as {
  ConfigStore: new (plugin: Any, options: Any) => Any;
};
const registry = requireCjs(path.join(root, "src", "features", "command_registry.js")) as {
  buildBinderCommandDefs: (cfg: Any) => Array<{ id: string; name: string; run: (p: Any) => void }>;
};
const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

/** Всё дерево словами: так проверяется отсутствие идентификаторов (Б2). */
function everyText(node: StubNode): string[] {
  const out: string[] = [];
  const walk = (n: StubNode): void => {
    out.push(n.ownText);
    for (const key of Object.keys(n.attrs)) out.push(n.attrs[key] || "");
    out.push(n.title || "");
    n.children.forEach(walk);
  };
  walk(node);
  return out.filter(Boolean);
}

const byLabel = (node: StubNode, prefix: string): StubNode | undefined =>
  all(node, "io-icon").concat(all(node, "io-btn"), all(node, "io-hk"))
    .find(n => String(n.getAttribute("aria-label") || "").startsWith(prefix));

/* ---- панель на настоящем пути записи ----------------------------------- */

/** Хоткеи, «назначенные» в Obsidian: подделка приватного API, см. шапку. */
interface FakeHotkeys {
  customKeys?: Record<string, Array<{ modifiers: string[]; key: string }>>;
  /** Пусто — `app.setting` нет, и кнопка обязана стать неактивной (К-2). */
  withSetting?: boolean;
}

interface Panel {
  host: StubNode;
  cfg: () => Any;
  rows: () => Any[];
  defs: () => Array<{ id: string; name: string }>;
  writes: Array<{ reason: string }>;
  draw: () => void;
  /** Что «введёт» человек в окне при следующем нажатии `Add command`. */
  answer: (draft: Any) => void;
  opened: string[];
}

function makePanel(rows: Any[], hk?: FakeHotkeys): Panel {
  const host = makeNode("div");
  const base = { ui: { binderRows: rows } };
  const store = new ConfigStore(
    { loadData: async () => base, saveData: async () => {} },
    {
      defaults: internals.migrateConfig(base),
      cloneJson: shared.cloneJson,
      isObj: shared.isObj,
      deepMerge: shared.deepMerge,
      migrateConfig: internals.migrateConfig,
      Notice: class StubNotice { },
    },
  );
  const writes: Array<{ reason: string }> = [];
  const opened: string[] = [];
  const app: Any = {
    hotkeyManager: { customKeys: (hk && hk.customKeys) || {} },
  };
  if (hk && hk.withSetting) {
    app.setting = {
      open: () => {},
      openTabById: (id: string) => (
        id === "hotkeys" ? { setQuery: (q: string) => opened.push(q) } : null
      ),
    };
  }
  const plugin: Any = {
    app,
    manifest: { id: "inline-overhaul" },
    getConfig: () => store.getSnapshot(),
    setConfigPatch: (patch: Any, reason: string) => {
      writes.push({ reason: reason || "settings" });
      store.patch(patch, reason || "settings");
    },
    registerBinderCommands: () => {},
  };

  let draft: Any = null;
  const canOpen = canOpenHotkeys(plugin);
  const draw = (): void => {
    host.empty();
    const model = createBinderModel({
      plugin,
      commandDefs: cfg => registry.buildBinderCommandDefs(cfg),
    });
    renderBinder(host as unknown as El, {
      rows: model.listRows(),
      hotkeyOf: row => hotkeyOf(plugin, row.commandId),
      openHotkey: canOpen ? row => { openHotkeys(plugin, row.commandLabel); } : null,
      onDescription: (row, text) => { model.setDescription(row.rowId, text); draw(); },
      onRemove: row => { model.remove(row.rowId); draw(); },
      onMove: (from, to) => { model.move(from, to); draw(); },
      onAdd: () => { if (draft) model.add(draft); draw(); },
    });
  };
  draw();
  return {
    host,
    cfg: () => store.getSnapshot(),
    rows: () => (store.getSnapshot().ui?.binderRows || []) as Any[],
    defs: () => registry.buildBinderCommandDefs(store.getSnapshot()),
    writes,
    draw,
    answer: value => { draft = value; },
    opened,
  };
}

/** Одна своя строка рядом с системной: этого хватает всем проверкам. */
const ARROW_ROW = {
  rowId: "binder-arrow",
  insertText: "→",
  commandName: "Arrow",
  description: "Right arrow",
  commandId: "inlineOverhaul_Binder_Arrow",
};

/* ---- что рисуется ------------------------------------------------------ */

{
  const p = makePanel([ARROW_ROW]);
  const head = all(p.host, "io-tablehead")[0];
  assert.ok(head, "шапка таблицы нарисовалась");
  assert.deepEqual(head.children.map(n => n.textContent), Array.from(HEAD),
    "колонки те же, что в прототипе");
  assert.equal(all(p.host, "io-tablerow").length, 2, "две строки: системная и своя");

  /* Б2: ни идентификатора команды, ни подписи `inlineOverhaul_Binder_*`. */
  const said = everyText(p.host);
  assert.ok(!said.some(t => t.includes("inlineOverhaul")),
    "идентификаторов команд в таблице нет: "
    + said.filter(t => t.includes("inlineOverhaul")).join(" | "));
  assert.ok(!said.some(t => t.includes("Command ID")), "и колонки Command ID тоже");
  ok("Б2: таблица без идентификаторов команд");
}

{
  const p = makePanel([ARROW_ROW]);
  const rows = all(p.host, "io-tablerow");
  const system = rows[0];
  const mine = rows[1];
  assert.ok(system && mine, "обе строки нашлись");
  assert.equal(all(system, "io-mono")[0]?.textContent, "[]",
    "системная строка первая и вставляет скобки");

  /* Б5: системную не удалить. */
  assert.equal(all(system, "io-icon")[0]?.disabled, true,
    "кнопка удаления системной строки неактивна");
  assert.equal(all(mine, "io-icon")[0]?.disabled, false, "а своя строка удаляется");

  /*
   * И её описание не редактируется. Это не строгость: `normalizeBinderRows`
   * переписывает описание системной строки своим на каждом патче, и поле для
   * правки было бы полем, которое ничего не меняет (З8).
   */
  assert.equal(all(system, "io-text")[0]?.disabled, true,
    "описание системной строки не правится");
  assert.equal(all(mine, "io-text")[0]?.disabled, false, "описание своей — правится");
  ok("Б5: системная строка не удаляется и её описание не правится");
}

/* ---- записи на настоящем пути ------------------------------------------ */

{
  const p = makePanel([ARROW_ROW]);
  const mine = all(p.host, "io-tablerow")[1] as StubNode;
  const input = all(mine, "io-text")[0] as StubNode;
  input.value = "Arrow to the right";
  input.dispatch("change");

  const stored = p.rows().find((r: Any) => r.rowId === "binder-arrow");
  assert.equal(stored?.description, "Arrow to the right", "описание доехало до конфига");
  assert.deepEqual(p.writes.map(w => w.reason), ["settings:binder:description"],
    "и записалось одним патчем с понятной причиной");
  assert.equal(p.rows().length, 2, "остальные строки на месте");
  ok("правка описания идёт в конфиг настоящим патчем");
}

{
  /* Системную строку не тронуть и в обход вёрстки: модель отказывает сама. */
  const p = makePanel([ARROW_ROW]);
  const model = createBinderModel({
    plugin: {
      getConfig: () => p.cfg(),
      setConfigPatch: () => { throw new Error("сюда доходить не должно"); },
    },
    commandDefs: cfg => registry.buildBinderCommandDefs(cfg),
  });
  model.remove(SYSTEM_ROW_ID);
  model.setDescription(SYSTEM_ROW_ID, "что-нибудь");
  ok("Б5: модель не пишет патч для системной строки вовсе");
}

{
  const p = makePanel([ARROW_ROW]);
  assert.ok(p.defs().map(d => d.id).includes("inlineOverhaul_Binder_Arrow"),
    "реестр видел команду строки");

  const drop = all(all(p.host, "io-tablerow")[1] as StubNode, "io-icon")[0] as StubNode;
  drop.click();

  assert.deepEqual(p.rows().map((r: Any) => r.rowId), [SYSTEM_ROW_ID],
    "строка ушла из конфига");
  assert.ok(!p.defs().map(d => d.id).includes("inlineOverhaul_Binder_Arrow"),
    "и команда исчезла у реестра");
  assert.deepEqual(p.writes.map(w => w.reason), ["settings:binder:delete"],
    "причина записи названа");
  ok("удаление строки уносит команду у реестра");
}

{
  /*
   * Главная проверка блока. Строка заводится нажатиями, а идентификатор
   * команды не выдумывается панелью: его ставит `normalizeBinderRows` внутри
   * `migrateConfig` на том же патче. Спрашиваем реестр.
   */
  const p = makePanel([ARROW_ROW]);
  p.answer({ insertText: "✔", commandName: "Check", description: "Tick" });
  const add = byLabel(p.host, "Add command") as StubNode;
  assert.ok(add, "кнопка Add command нашлась");
  add.click();

  const rows = p.rows();
  assert.equal(rows.length, 3, "строка добавилась");
  const added = rows[rows.length - 1];
  assert.equal(added.insertText, "✔", "с тем текстом, который ввели");
  assert.ok(String(added.commandId).startsWith("inlineOverhaul_Binder_"),
    "идентификатор поставила нормализация: " + added.commandId);
  assert.ok(String(added.rowId).startsWith("binder-"), "и rowId тоже (Б7)");

  const def = p.defs().find(d => d.id === added.commandId);
  assert.ok(def, "реестр увидел новую команду");
  assert.equal(def?.name, "Binder: Check",
    "и назвал её так, как человек увидит в списке хоткеев");
  assert.deepEqual(p.writes.map(w => w.reason), ["settings:binder:add"],
    "причина записи названа");
  ok("новая строка становится командой реестра, и идентификатор даёт нормализация");
}

{
  /* Два одинаковых имени не дают двух одинаковых команд. */
  const p = makePanel([ARROW_ROW]);
  p.answer({ insertText: "✔", commandName: "Arrow", description: "" });
  (byLabel(p.host, "Add command") as StubNode).click();
  const ids = p.rows().map((r: Any) => String(r.commandId));
  assert.equal(new Set(ids).size, ids.length, "идентификаторы разошлись: " + ids.join(", "));
  ok("совпадение имён разводит нормализация, а не панель");
}

{
  /* Б6: порядок меняется перетаскиванием за ручку. */
  const second = {
    ...ARROW_ROW,
    rowId: "binder-dash",
    insertText: "—",
    commandName: "Dash",
    commandId: "inlineOverhaul_Binder_Dash",
  };
  const p = makePanel([ARROW_ROW, second]);
  const rows = all(p.host, "io-tablerow");
  const grip = all(rows[2] as StubNode, "io-grip")[0] as StubNode;
  assert.equal(grip.draggable, true, "ручка перетаскивается");
  grip.dispatch("dragstart", { dataTransfer: { setData: () => {} } });
  (rows[1] as StubNode).dispatch("drop", { preventDefault: () => {} });

  assert.deepEqual(p.rows().map((r: Any) => r.rowId),
    [SYSTEM_ROW_ID, "binder-dash", "binder-arrow"],
    "строка встала на место той, на которую её бросили");
  assert.deepEqual(p.writes.map(w => w.reason), ["settings:binder:reorder"],
    "причина записи названа");
  ok("Б6: порядок строк меняется перетаскиванием");
}

/* ---- колонка Hotkey (К-2) ---------------------------------------------- */

{
  /* Приватного API нет: кнопка неактивна, панель работает. */
  const p = makePanel([ARROW_ROW]);
  const hk = all(p.host, "io-hk");
  assert.equal(hk.length, 2, "кнопка хоткея есть у каждой строки");
  assert.equal(hk[0]?.disabled, true, "без app.setting кнопка неактивна");
  assert.equal(hk[0]?.textContent, HOTKEY_NONE, "и говорит, что хоткея нет");
  assert.ok(hk[0]?.classList.contains("io-hk--none"), "и отмечена как пустая");
  ok("К-2: без приватного API кнопка хоткея неактивна, а блок рисуется");
}

{
  const p = makePanel([ARROW_ROW], {
    withSetting: true,
    customKeys: {
      "inline-overhaul:inlineOverhaul_Binder_Arrow": [{ modifiers: ["Mod", "Shift"], key: "K" }],
    },
  });
  const hk = all(p.host, "io-hk");
  assert.equal(hk[1]?.textContent, "Ctrl + Shift + K", "назначенный хоткей показан словами");
  assert.equal(hk[1]?.disabled, false, "и кнопка активна");
  assert.equal(hk[0]?.textContent, HOTKEY_NONE, "у строки без хоткея — прочерк словами");

  (hk[1] as StubNode).click();
  assert.deepEqual(p.opened, ["Binder: Arrow"],
    "нажатие открывает список хоткеев Obsidian на имени этой команды");
  ok("К-2: назначенный хоткей показан, и кнопка ведёт к нему");
}

{
  /*
   * Идентификатор в менеджере хоткеев — полный, с именем плагина.
   * `getBoundHotkeyForCommand` в `main.js` спрашивает голым и не находит
   * ничего никогда; этот пин закрывает ту же ошибку здесь.
   */
  const plugin = {
    manifest: { id: "inline-overhaul" },
    app: {
      hotkeyManager: {
        customKeys: { "inlineOverhaul_Binder_Arrow": [{ modifiers: [], key: "F2" }] },
      },
    },
  };
  assert.equal(fullCommandId(plugin, "inlineOverhaul_Binder_Arrow"),
    "inline-overhaul:inlineOverhaul_Binder_Arrow", "идентификатор собирается из manifest.id");
  assert.equal(hotkeyOf(plugin, "inlineOverhaul_Binder_Arrow"), "",
    "по голому идентификатору хоткей не находится — и не должен");
  assert.equal(canOpenHotkeys(plugin), false, "без app.setting открывать нечего");
  assert.equal(openHotkeys(plugin, "Binder: Arrow"), false,
    "и попытка отвечает отказом, а не падает");
  ok("хоткей ищется по полному идентификатору команды");
}

{
  /* Свой хоткей человека перекрывает заводской, и снятый — это снятый. */
  const plugin = {
    manifest: { id: "inline-overhaul" },
    app: {
      hotkeyManager: {
        customKeys: { "inline-overhaul:x": [] },
        getHotkeys: () => [{ modifiers: ["Alt"], key: "J" }],
      },
    },
  };
  assert.equal(hotkeyOf(plugin, "x"), "", "снятый хоткей не подменяется заводским");
  const other = {
    manifest: { id: "inline-overhaul" },
    app: {
      hotkeyManager: { customKeys: {}, getHotkeys: () => [{ modifiers: ["Alt"], key: "J" }] },
    },
  };
  assert.equal(hotkeyOf(other, "x"), "Alt + J", "а без своей записи берётся то, что даёт менеджер");
  ok("свой хоткей важнее заводского, и снятый остаётся снятым");
}

/* ---- окно «завести строку» --------------------------------------------- */

{
  const box = makeNode("div");
  let got: Any = null;
  let cancelled = false;
  renderAddForm(box as unknown as El, {
    add: draft => { got = draft; },
    cancel: () => { cancelled = true; },
  });

  const add = byLabel(box, "Add command") as StubNode;
  assert.ok(add, "кнопка Add в окне нашлась");
  assert.equal(add.disabled, true, "и молчит, пока нет текста вставки");

  const inputs = all(box, "io-text");
  assert.equal(inputs.length, 3, "три поля: вставка, имя, описание");
  (inputs[0] as StubNode).value = "✔";
  (inputs[0] as StubNode).dispatch("input");
  assert.equal(add.disabled, false, "с текстом вставки кнопка оживает");
  (inputs[1] as StubNode).value = "Check";
  (inputs[2] as StubNode).value = "Tick";
  add.click();
  assert.deepEqual(got, { insertText: "✔", commandName: "Check", description: "Tick" },
    "окно отдало ровно то, что ввели");

  (byLabel(box, "Cancel") as StubNode).click();
  assert.equal(cancelled, true, "и отказ — это отказ");
  ok("окно не заводит строку без текста вставки");
}

{
  /* Строка без текста вставки не заводится и в обход окна. */
  const p = makePanel([ARROW_ROW]);
  p.answer({ insertText: "   ", commandName: "Nothing", description: "" });
  (byLabel(p.host, "Add command") as StubNode).click();
  assert.equal(p.rows().length, 2, "пустая строка не добавилась");
  assert.deepEqual(p.writes, [], "и патча не было");
  ok("З8: строка без текста вставки не заводится");
}

/* ---- подписи ----------------------------------------------------------- */

{
  const p = makePanel([{ ...ARROW_ROW, commandName: "" }]);
  const mine = all(p.host, "io-tablerow")[1] as StubNode;
  assert.equal(all(mine, "io-cellname")[0]?.textContent, "→",
    "строка без имени зовётся тем, что вставляет — как её зовёт и реестр");
  assert.equal(
    rowTitle({
      rowId: "x",
      insertText: "→",
      commandName: "",
      description: "",
      commandId: "id",
      commandLabel: "Binder: Arrow",
      system: false,
    }),
    "Arrow",
    "а если реестр дал имя — берётся оно, без служебной приставки",
  );
  ok("строка подписана тем же именем, что и команда в списке хоткеев");
}

console.log("\n" + passed + " проверок пройдено");
