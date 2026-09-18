/**
 * Панель настроек открывается там, где её закрыли (`Р-13`).
 *
 * **Его слово — «вернуть память»** (В-143, 2026-09-18). Функция была у старой
 * панели и потерялась при её снятии 2026-08-29: ключ `ui.activeSettingsTab` в
 * конфиге остался — его нормализуют и переносят миграцией, — а читать и писать
 * перестали. Работа — соединить два конца; снятие ключа, назначенное PRD
 * (строка 8009), отменено его словом.
 *
 * **Оговорка, названная до правки:** запись не должна попадать в стек отмены.
 * «Отменить» после перехода по вкладкам обязано отменять правку человека, а не
 * переход. Спрашивается это у **настоящего** `ConfigStore`, а не у хранилища в
 * памяти: стек ведёт он, и только он может ответить (У-4).
 *
 * **Подвкладок в этой работе нет, и это измерено, а не решено.** Ревизия
 * называла три ключа — вкладка, подвкладка `Visual`, подвкладка `Hotkeys`, — но
 * подвкладок у новой панели нет ни одной: в слое настроек нет ни одного места,
 * которое бы их рисовало. Ключи `ui.visualSubTab` и `ui.hotkeysSubTab` живут
 * дольше своих контролов (У-16), и что с ними делать — вопрос заказчика, а не
 * этой правки.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";

setupGlobals();

import { SCHEMA, TABS } from "../../src/ui/settings/schema/index.ts";
import { ConfigStoreAdapter, MemoryStore } from "../../src/ui/settings/store.ts";
import { SettingsPane } from "../../src/ui/settings/settings_tab.ts";
import type { TabDef } from "../../src/ui/settings/types.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = Module.createRequire(path.join(root, "main.js"));
const { ConfigStore } = requireCjs("./src/core/config_store.js") as Any;
const su = requireCjs("./src/core/shared_utils.js") as Any;

const ACTIVE_TAB_PATH = "ui.activeSettingsTab";

let ran = 0;
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  ran++;
  return Promise.resolve()
    .then(fn)
    .then(() => { console.log("  ok   " + name); })
    .catch((e: unknown) => {
      console.log("  FAIL " + name);
      throw e;
    });
}

const fragments = {
  createFragment(): StubNode { return makeNode("fragment"); },
};

/** Первая вкладка, у которой есть хоть одна группа: с неё панель открывается. */
const firstTabWithGroups = (): string =>
  String((TABS.find(t => SCHEMA.some(g => g.tab === t.id)) as TabDef).id);

function makePane(initial: Record<string, unknown> = {}, tabs: readonly TabDef[] = TABS) {
  const store = new MemoryStore(initial);
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs,
    store,
    actions: {},
    fragments: fragments as never,
    rebuild: () => { /* пересборку считает своя панель там, где она предмет */ },
  });
  return { store, pane };
}

/** Панель на настоящем `ConfigStore`: стек отмены ведёт он. */
function makeRealStorePane(initial: Record<string, unknown>) {
  const saved: Any[] = [];
  const plugin = {
    loadData: async (): Promise<Any> => JSON.parse(JSON.stringify(initial)),
    saveData: async (cfg: Any): Promise<void> => { saved.push(JSON.parse(JSON.stringify(cfg))); },
  };
  const store = new ConfigStore(plugin, {
    defaults: { configVersion: 2, ui: {} },
    cloneJson: su.cloneJson,
    isObj: su.isObj,
    deepMerge: su.deepMerge,
    /* Миграция здесь не предмет: мерим стек отмены, а не нормализацию. */
    migrateConfig: (c: Any): Any => su.cloneJson(c),
    Notice: function (): void { /* сообщений в этой проверке нет */ },
    saveDebounceMs: 10,
  });
  /*
   * Форма, которой панель кормит адаптер в бою (`storeFor` в `obsidian_tab.ts`):
   * `ConfigStore` отдаёт снимок `getSnapshot`, а мутатор адаптера правит объект
   * на месте и ничего не возвращает. Своей копией этой формы здесь не завести —
   * она уже стоит так же в `migrate_stage_order_tests.ts`.
   */
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store: new ConfigStoreAdapter({
      getConfig: () => store.getSnapshot(),
      subscribe: (listener: Any) => store.subscribe(listener),
      update: (mutator: (c: Any) => void, reason: string, opts?: Any) => {
        store.update((prev: Any) => { mutator(prev); return prev; }, reason, opts);
      },
    } as never),
    actions: {},
    fragments: fragments as never,
    rebuild: () => { /* не предмет */ },
  });
  return { store, pane, saved };
}

async function run(): Promise<void> {

  await test("контроль: без запомненного панель открывается на первой вкладке", () => {
    const { pane } = makePane({});
    assert.equal(pane.activeTab(), firstTabWithGroups());
  });

  await test("запомненная вкладка открывается", () => {
    const { pane } = makePane({ ui: { activeSettingsTab: "visual" } });
    assert.equal(pane.activeTab(), "visual");
    /* Контроль на саму фикстуру: «visual» не совпадает с умолчанием, иначе
       проверка была бы зелёной и без чтения ключа (У-147). */
    assert.notEqual("visual", firstTabWithGroups());
  });

  await test("переход по вкладке записывает её тем же швом, каким панель пишет всё", () => {
    const { store, pane } = makePane({});
    pane.setActiveTab("visual" as never);
    const write = store.writes.find(w => w.path === ACTIVE_TAB_PATH);
    assert.ok(write, "запись открытой вкладки ушла в хранилище");
    assert.equal(write.value, "visual");
    assert.equal(store.get(ACTIVE_TAB_PATH), "visual");
  });

  await test("запись помечена как не идущая в стек отмены", () => {
    const { store, pane } = makePane({});
    pane.setActiveTab("visual" as never);
    const write = store.writes.find(w => w.path === ACTIVE_TAB_PATH) as Any;
    assert.equal(write.opts && write.opts.undoable, false);
  });

  await test("ступени отмены от перехода по вкладкам не появляется", async () => {
    const { store, pane } = makeRealStorePane({ configVersion: 2, ui: {} });
    await store.init();
    /* Правка человека: вот её и должен отменять `Ctrl+Z`. */
    store.patch({ general: { language: "ru" } }, "правка человека");
    pane.setActiveTab("visual" as never);
    pane.setActiveTab("transform" as never);
    await Promise.resolve();

    assert.equal(store.getSnapshot().ui.activeSettingsTab, "transform", "вкладка записана");
    assert.equal(store.undo(), true, "отменять есть что");
    assert.equal(
      String(store.getSnapshot().general && store.getSnapshot().general.language || ""),
      "",
      "отмена вернула состояние до правки человека, а не до перехода по вкладкам");
    assert.equal(store.undo(), false, "переходы своих ступеней не завели");
  });

  await test("повторный щелчок по открытой вкладке записи не делает", () => {
    const { store, pane } = makePane({ ui: { activeSettingsTab: "visual" } });
    store.writes.length = 0;
    pane.setActiveTab("visual" as never);
    assert.equal(store.writes.length, 0);
  });

  await test("имя вкладки, которой в панели нет, память не ломает", () => {
    /* `hotkeys` — имя из старой панели: оно до сих пор стоит в списке
       нормализации конфига, а у новой панели вкладка называется `keyboard`. */
    const { pane } = makePane({ ui: { activeSettingsTab: "hotkeys" } });
    assert.equal(pane.activeTab(), firstTabWithGroups());
    assert.ok(!TABS.some(t => String(t.id) === "hotkeys"), "контроль: такой вкладки и правда нет");
  });

  await test("вкладка без единой группы не открывается: пустых страниц не рисуем", () => {
    const ghost = { id: "ghost", label: "Ghost" } as unknown as TabDef;
    const { pane } = makePane({ ui: { activeSettingsTab: "ghost" } }, [...TABS, ghost]);
    assert.equal(pane.activeTab(), firstTabWithGroups());
    /* Контроль формы (У-189): признак, которым панель отбирает вкладки, на
       этой и правда отвечает «нет». */
    assert.ok(!SCHEMA.some(g => String(g.tab) === "ghost"), "у призрачной вкладки групп нет");
  });

  await test("круг замкнут: записанное одной панелью читает следующая", () => {
    const store = new MemoryStore({});
    const first = new SettingsPane({
      schema: SCHEMA, tabs: TABS, store, actions: {}, fragments: fragments as never,
      rebuild: () => { /* не предмет */ },
    });
    first.setActiveTab("advanced" as never);

    const next = new SettingsPane({
      schema: SCHEMA, tabs: TABS, store, actions: {}, fragments: fragments as never,
      rebuild: () => { /* не предмет */ },
    });
    assert.equal(next.activeTab(), "advanced");
  });

  await test("подвкладок, о которых говорила ревизия, в панели не спрашивает никто", () => {
    /*
     * Ревизия называла три ключа памяти, а подвкладок у новой панели нет ни
     * одной: спрашивается не «решили ли мы их делать», а **кто их читает**
     * (У-141). Обход сплошной по слою настроек, а не список файлов (У-111), и у
     * него положительный контроль: тот же обход обязан находить ключ вкладки,
     * который эта правка как раз оживила. Без контроля ноль значил бы «искали не
     * там» (У-203).
     */
    const layer = path.join(root, "src", "ui", "settings");
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|js)$/.test(name)) files.push(p);
      }
    };
    walk(layer);
    assert.ok(files.length > 20, "контроль: обход и правда прошёл по слою, файлов " + files.length);

    const hits = (needle: string): string[] =>
      files.filter(f => fs.readFileSync(f, "utf8").includes(needle))
        .map(f => path.relative(root, f).replace(/\\/g, "/"));

    assert.ok(hits("ui.activeSettingsTab").length > 0,
      "положительный контроль: ключ открытой вкладки обход находит");
    assert.deepEqual(hits("ui.visualSubTab"), [],
      "ключ подвкладки Visual в слое настроек не спрашивает никто");
    assert.deepEqual(hits("ui.hotkeysSubTab"), [],
      "ключ подвкладки Hotkeys в слое настроек не спрашивает никто");
  });

  console.log("Settings tab memory tests: OK (" + ran + " checks)");
}

run().catch((e) => {
  console.error(e && (e as Error).stack ? (e as Error).stack : String(e));
  process.exit(1);
});
