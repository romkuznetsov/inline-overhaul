/**
 * Слой настроек: схема, отображение в API Obsidian и шов хранилища.
 * Запускается на обвязке tests/harness, без Obsidian.
 */

import assert from "node:assert/strict";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { SCHEMA, TABS, groupsFor, activeTabs } from "../../src/ui/settings/schema/index.ts";
import { buildDefaultConfig, getIn, isBound } from "../../src/ui/settings/types.ts";
import { MemoryStore } from "../../src/ui/settings/store.ts";
import { SettingsPane } from "../../src/ui/settings/settings_tab.ts";
import { richParts } from "../../src/ui/settings/describe.ts";

/** Определение как свободная запись: тесту нужна форма, а не сужение union. */
type Def = Record<string, any>;
const allDefs = (pane: SettingsPane): Def[] => pane.getSettingDefinitions() as unknown as Def[];

/** Открыть вкладку и вернуть её группу по заголовку. */
const groupOf = (pane: SettingsPane, tab: string, heading: string): Def | undefined => {
  pane.setActiveTab(tab as never);
  return allDefs(pane).find((d: Def) => d.heading === heading);
};

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

/** DocumentFragment в терминах заглушки: тот же узел, что и элемент. */
const fragments = {
  createFragment(): StubNode {
    return makeNode("fragment");
  },
};

function makePane(initial: Record<string, unknown> = {}) {
  const store = new MemoryStore(initial);
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store,
    actions: {},
    fragments: fragments as never,
  });
  return { store, pane };
}

async function main(): Promise<void> {
  /* ---- схема ---------------------------------------------------------- */

  await test("id настроек уникальны", () => {
    const seen = new Set<string>();
    for (const g of SCHEMA) {
      assert.ok(!seen.has(g.id), "дубль группы " + g.id);
      seen.add(g.id);
      for (const it of g.items) {
        assert.ok(!seen.has(it.id), "дубль настройки " + it.id);
        seen.add(it.id);
      }
    }
  });

  await test("каждый путь предиката есть в схеме (С6)", () => {
    const paths = new Set<string>();
    for (const g of SCHEMA) for (const it of g.items) if (isBound(it)) paths.add(it.path);
    for (const g of SCHEMA) {
      for (const it of g.items) {
        for (const p of [it.visible, it.disabled]) {
          if (!p) continue;
          assert.ok(p.deps.length, it.id + ": предикат без deps");
          for (const d of p.deps) assert.ok(paths.has(d), it.id + ": deps на неизвестный путь " + d);
        }
      }
    }
  });

  await test("значения по умолчанию строятся из схемы (С1)", () => {
    const defaults = buildDefaultConfig(SCHEMA);
    assert.equal(getIn(defaults, "features.navigation.enabled"), true);
    assert.equal(getIn(defaults, "editor.selectAll.delayMs"), 700);
    assert.equal(getIn(defaults, "general.help.showTips"), true);
    /* ветка ui.* удалена в конфиге v2, подсказки живут в general.help */
    assert.equal(getIn(defaults, "ui.showTips"), undefined);
  });

  await test("группы отдаются в порядке order", () => {
    const ids = groupsFor("general").map(g => g.id);
    assert.deepEqual(ids, ["help", "modules"]);
  });

  await test("все семь вкладок на месте и в порядке 6.1", () => {
    assert.deepEqual(activeTabs().map(t => t.id),
      ["general", "keyboard", "navigation", "pkm", "visual", "transform", "advanced"]);
  });

  await test("перенесены все группы с настройками", () => {
    assert.equal(SCHEMA.length, 20, "групп с настройками");
    const bound = SCHEMA.flatMap(g => g.items).filter(isBound);
    assert.equal(bound.length, 87, "настроек, привязанных к путям конфига");
  });

  await test("ни одна группа не потерялась молча", () => {
    /*
     * В прототипе 33 группы. Тринадцати здесь быть не может, и у каждой своя
     * причина: либо она целиком свой блок и ждёт рендерера (фаза 3), либо
     * состоит из кнопок, которым нужно действие из реестра (фаза 5, З8).
     * Список закрытый: если группа исчезнет по другой причине, тест упадёт.
     */
    const AWAITED = [
      "general-intro", "keyboard-intro", "nav-intro", "pkm-intro",
      "visual-intro", "transform-intro", "advanced-intro",   // вводные коллауты
      "binder", "command-reference",                          // свои блоки, фаза 3c
      "fields", "note-properties", "smart-rules",             // свои блоки, фаза 3b и 3c
      "generated-files",                                      // кнопки без действий, фаза 5
    ];
    const have = new Set(SCHEMA.map(g => g.id));
    for (const id of AWAITED) {
      assert.ok(!have.has(id), id + " уже в схеме: обновите список ожидающих");
    }
    assert.equal(20 + AWAITED.length, 33, "33 группы прототипа разложены без остатка");
  });

  await test("тумблер модуля есть у четырёх вкладок и только у них", () => {
    const withModule = TABS.filter(t => t.module).map(t => t.id);
    assert.deepEqual(withModule, ["navigation", "pkm", "visual", "transform"]);
  });

  /* ---- отображение в определения -------------------------------------- */

  await test("отображение чисто: два вызова дают одинаковую форму (С11)", () => {
    const { pane } = makePane();
    const shape = (d: unknown) => JSON.stringify(d, (k, v) => {
      if (typeof v === "function") return "fn";
      /* desc — узел заглушки: сравниваем его текст, а не структуру */
      if (k === "desc" && v && typeof v === "object") return String((v as StubNode).textContent);
      return v;
    });
    assert.equal(shape(allDefs(pane)), shape(allDefs(pane)));
  });

  await test("показываются группы открытой вкладки", () => {
    const { pane } = makePane();
    const list = allDefs(pane);
    assert.equal(pane.activeTab(), "general", "на старте открыта первая вкладка с группами");
    assert.deepEqual(list.map((d: Def) => d.heading), ["Help", "Modules"]);
    for (const d of list) assert.equal(d.type, "group", "страниц-переходов больше нет");
  });

  await test("переключение вкладки меняет содержимое", () => {
    const { pane } = makePane();
    pane.setActiveTab("visual");
    assert.equal(pane.activeTab(), "visual");
    const headings = allDefs(pane).map((d: Def) => d.heading);
    assert.ok(headings.includes("Tag Bars"), "видны группы Visual: " + headings.join(", "));
    assert.ok(!headings.includes("Modules"), "групп другой вкладки быть не должно");
  });

  await test("вкладки без групп не предлагаются", () => {
    const { pane } = makePane();
    assert.deepEqual(pane.tabsWithGroups().map(t => t.id),
      ["general", "keyboard", "navigation", "pkm", "visual", "transform", "advanced"]);
  });

  await test("полоса вкладок — первая строка и не участвует в поиске", () => {
    const store = new MemoryStore({});
    let picked: string | null = null;
    const pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store,
      actions: {},
      fragments: fragments as never,
      tabStrip: state => {
        /* полосу рисует слой платформы; тесту важно, что её просят и что
           обратный вызов переключает вкладку */
        return { name: "", searchable: false, render: () => { picked = state.active; } };
      },
    });
    const list = allDefs(pane);
    assert.equal(list[0]?.name, "", "первой идёт полоса");
    assert.equal(list[0]?.searchable, false, "полоса не должна попадать в поиск");
    assert.equal(typeof list[0]?.render, "function");
    assert.equal(list[1]?.heading, "Help", "за полосой — группы вкладки");
    list[0].render();
    assert.equal(picked, "general");
  });

  await test("контролы получают правильный тип и ключ", () => {
    const { pane } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded select all")?.items || [];
    const byName = (n: string) => items.find((i: Def) => i.name === n);

    assert.equal(byName("Expanded select all")?.control?.type, "toggle");
    assert.equal(byName("Expanded select all")?.control?.key, "editor.selectAll.enabled");

    const steps = byName("Selection steps");
    assert.equal(steps?.control?.type, "dropdown");
    assert.deepEqual(steps?.control?.options, {
      "line-note": "Line, then note",
      "line-tree-note": "Line, tree, then note",
      "line-tree-header-note": "Line, tree, heading, then note",
    });

    const delay = byName("Time between presses");
    assert.equal(delay?.control?.type, "slider");
    assert.equal(delay?.control?.min, 250);
    assert.equal(delay?.control?.max, 2000);
    assert.equal(delay?.control?.step, 50);
  });

  await test("предикаты доходят до платформы как функции", () => {
    const { pane, store } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded select all")?.items || [];
    const delay = items.find((i: Def) => i.name === "Time between presses");
    const steps = items.find((i: Def) => i.name === "Selection steps");

    assert.equal(typeof delay?.visible, "function");
    assert.equal(delay?.visible?.(), false, "таймер выключен — задержки не видно");
    void store.set("editor.selectAll.useDelay", true);
    assert.equal(delay?.visible?.(), true, "таймер включён — задержка видна");

    assert.equal(steps?.control?.disabled?.(), true, "пока функция выключена, шаги неактивны");
    void store.set("editor.selectAll.enabled", true);
    assert.equal(steps?.control?.disabled?.(), false);
  });

  /* ---- описания ------------------------------------------------------- */

  await test("разбор мини-разметки описания", () => {
    assert.deepEqual(richParts("press <code>Ctrl/Cmd + A</code> twice"), [
      { tag: "text", text: "press " },
      { tag: "code", text: "Ctrl/Cmd + A" },
      { tag: "text", text: " twice" },
    ]);
  });

  await test("старое имя уходит в aliases, а не в видимый текст (П-4)", () => {
    const { pane } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded select all")?.items || [];
    const it = items.find((i: Def) => i.name === "Expanded select all");
    assert.deepEqual(it?.aliases, ["Enhanced Mod+A"], "старое имя должно попасть в aliases");
    const text = String((it?.desc as StubNode | undefined)?.textContent || "");
    assert.ok(!text.includes("Enhanced Mod+A"), "и не должно попасть в видимое описание: " + text);
  });

  await test("единица слайдера уходит в displayFormat (Ст5)", () => {
    const { pane } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded select all")?.items || [];
    const delay = items.find((i: Def) => i.name === "Time between presses");
    assert.equal(delay?.control?.displayFormat?.(700), "700 ms");
  });

  await test("неактивность живёт в контроле, а не в определении", () => {
    const { pane, store } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded select all")?.items || [];
    const steps = items.find((i: Def) => i.name === "Selection steps");
    assert.equal(steps?.disabled, undefined, "у определения контрола disabled нет");
    assert.equal(steps?.control?.disabled?.(), true);
    void store.set("editor.selectAll.enabled", true);
    assert.equal(steps?.control?.disabled?.(), false);
  });

  await test("подсказка уходит из описания, когда Show tips выключен", () => {
    const { pane } = makePane({ general: { help: { showTips: false } } });
    const items = groupOf(pane, "keyboard", "Expanded select all")?.items || [];
    const it = items.find((i: Def) => i.name === "Expanded select all");
    const text = String((it?.desc as StubNode | undefined)?.textContent || "");
    assert.ok(!text.includes("On a task list"), "подсказка осталась при выключенном Show tips");
  });

  /* ---- шов хранилища --------------------------------------------------- */

  await test("чтение падает на значение по умолчанию, если в конфиге пусто", () => {
    const { pane } = makePane();
    assert.equal(pane.getControlValue("editor.selectAll.delayMs"), 700);
  });

  await test("запись идёт через хранилище с ключом склейки по id (CS9, П-2)", async () => {
    const { pane, store } = makePane();
    await pane.setControlValue("editor.selectAll.delayMs", 900);
    assert.equal(store.get("editor.selectAll.delayMs"), 900);
    assert.equal(store.writes.length, 1);
    assert.equal(store.writes[0]?.opts?.coalesceKey, "select-all-delay",
      "ключ склейки должен быть id настройки, а не путём");
    assert.equal(store.writes[0]?.opts?.undoable, true);
  });

  /* ---- сброс группы ---------------------------------------------------- */

  await test("сброс группы возвращает значения и не трогает чужие", async () => {
    const { pane, store } = makePane();
    const modules = SCHEMA.find((g: Def) => g.id === "modules");
    assert.ok(modules);
    assert.equal(pane.drift(modules).length, 0, "на старте отличий быть не должно");

    await pane.setControlValue("features.visual.enabled", false);
    await pane.setControlValue("editor.selectAll.enabled", true);
    assert.equal(pane.drift(modules).length, 1, "изменилась одна настройка группы");

    const n = await pane.resetGroup(modules);
    assert.equal(n, 1);
    assert.equal(pane.getControlValue("features.visual.enabled"), true);
    assert.equal(store.get("editor.selectAll.enabled"), true,
      "сброс группы Modules не должен трогать вкладку Keyboard");
  });

  await test("сброс пишется одной записью undo (Н4)", async () => {
    const { pane, store } = makePane();
    const modules = SCHEMA.find((g: Def) => g.id === "modules");
    assert.ok(modules);
    await pane.setControlValue("features.visual.enabled", false);
    await pane.setControlValue("features.transform.enabled", false);
    store.writes.length = 0;

    await pane.resetGroup(modules);
    const undoable = store.writes.filter(w => w.opts?.undoable === true);
    assert.equal(undoable.length, 1, "в undo должна попасть одна запись, а не по одной на настройку");
  });

  await test("вводная фраза группы становится строкой без контрола", () => {
    const { pane } = makePane();
    const modules = groupOf(pane, "general", "Modules");
    const first = modules?.items?.[0];
    assert.equal(first?.name, "", "вводная строка без имени");
    assert.ok(String(first?.desc).startsWith("Four separate things"),
      "у группы нет поля desc, поэтому вводная фраза - первая строка");
    assert.equal(first?.searchable, false, "вводный текст не должен попадать в поиск");
    assert.equal(first?.control, undefined);
  });

  await test("кнопка сброса объявлена функцией, а не объектом", async () => {
    /*
     * Именно здесь была ошибка, из-за которой страницы не открывались:
     * extraButtons это массив функций, платформа вызывает каждую с
     * компонентом кнопки. Объект вместо функции ронял отрисовку заголовка,
     * и переход на страницу молча ничего не делал.
     */
    const { pane } = makePane();
    await pane.setControlValue("features.visual.enabled", false);
    const modules = groupOf(pane, "general", "Modules");
    const buttons = modules?.extraButtons;
    assert.ok(Array.isArray(buttons) && buttons.length === 1, "одна кнопка в заголовке");
    assert.equal(typeof buttons[0], "function", "элемент extraButtons обязан быть функцией");

    const calls: string[] = [];
    const component: Def = {
      setIcon(v: string) { calls.push("icon:" + v); return component; },
      setTooltip(v: string) { calls.push("tooltip:" + v.slice(0, 11)); return component; },
      onClick(_fn: () => void) { calls.push("onClick"); return component; },
    };
    buttons[0](component);
    assert.deepEqual(calls, ["icon:rotate-ccw", "tooltip:Reset group", "onClick"]);
  });

  await test("кнопка сброса появляется только когда есть что сбрасывать (Н2)", async () => {
    const { pane } = makePane();
    const groupDef = () => groupOf(pane, "general", "Modules");
    assert.equal(groupDef()?.extraButtons, undefined, "всё по умолчанию — кнопки нет");
    await pane.setControlValue("features.visual.enabled", false);
    assert.equal(groupDef()?.extraButtons?.length, 1, "появилось отличие — появилась кнопка");
  });

  console.log("\n" + ran + " проверок пройдено");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
