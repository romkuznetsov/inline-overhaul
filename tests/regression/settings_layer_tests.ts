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
  /*
   * Сброс группы спрашивает (Н3), и без окна не идёт. Здесь оно всегда
   * соглашается; проверки, которым нужен отказ или сам вопрос, заводят свою
   * панель.
   */
  const asked: Def[] = [];
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store,
    actions: {},
    fragments: fragments as never,
    confirm: async (o: Def) => { asked.push(o); return true; },
  });
  return { store, pane, asked };
}

/**
 * Панель, которая считает пересборки: слайдер не должен их вызывать, иначе
 * платформа заменяет узел контрола и перетаскивание обрывается.
 */
function makeCountingPane(initial: Record<string, unknown> = {}) {
  const store = new MemoryStore(initial);
  const counts = { rebuild: 0, refresh: 0 };
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store,
    actions: {},
    fragments: fragments as never,
    rebuild: () => { counts.rebuild++; },
    refresh: () => { counts.refresh++; },
  });
  return { store, pane, counts };
}

/** Свой блок группы по её заголовку: предпросмотр всегда первый в группе. */
const blockOf = (pane: SettingsPane, tab: string, heading: string): Def => {
  const group = groupOf(pane, tab, heading);
  /* Первой строкой группы идёт её вводная фраза, свой блок — следующим. */
  const block = (group?.items || []).find((it: Def) => typeof it.render === "function");
  assert.ok(block, heading + ": в группе нет своего блока");
  return block as Def;
};

/** Отрисовать свой блок на заглушке и вернуть корень строки. */
function drawBlock(def: Def): StubNode {
  const host = makeNode("div");
  const setting = { settingEl: host };
  const cleanup = def.render(setting, {});
  assert.equal(typeof cleanup, "function", "свой блок обязан вернуть функцию очистки (С5)");
  return host;
}

/** Компонент кнопки в терминах теста: запоминает, что на нём вызвали. */
function fakeButton() {
  const calls: string[] = [];
  const btn: Def = {
    calls,
    setIcon(v: string) { calls.push("icon:" + v); return btn; },
    setTooltip(v: string) { calls.push("tooltip:" + v); return btn; },
    setDisabled(v: boolean) { calls.push("disabled:" + String(v)); return btn; },
    onClick(fn: () => void) { calls.push("onClick"); btn.click = fn; return btn; },
    click: () => {},
  };
  return btn;
}

/** Последнее состояние неактивности, которое кнопке выставили. */
const lastDisabled = (btn: Def): string | undefined =>
  (btn.calls as string[]).filter((c: string) => c.startsWith("disabled:")).pop();

const lastTooltip = (btn: Def): string | undefined =>
  (btn.calls as string[]).filter((c: string) => c.startsWith("tooltip:")).pop();

/** Первая группа вкладки: у каждой вкладки это вводный коллаут. */
const firstGroup = (pane: SettingsPane, tab: string): Def => {
  pane.setActiveTab(tab as never);
  const groups = allDefs(pane).filter((d: Def) => d.type === "group");
  return groups[0] as Def;
};

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
    assert.deepEqual(ids, ["general-intro", "help", "modules"]);
  });

  await test("все семь вкладок на месте и в порядке 6.1", () => {
    assert.deepEqual(activeTabs().map(t => t.id),
      ["general", "keyboard", "navigation", "pkm", "visual", "transform", "advanced"]);
  });

  await test("перенесены все группы с настройками", () => {
    assert.equal(SCHEMA.length, 33,
      "групп в схеме: 22 с настройками, 7 вводных коллаутов, группа Fields, "
      + "группа Smart Rules, группа Binder и группа `Color your Tags`. Группа "
      + "`Setting ids` добавлена 2026-08-28 по заказу, Binder перенесён "
      + "2026-08-29, `Color your Tags` заведена в тот же день, `Generated "
      + "files` вернулась 2026-08-29 вместе с реестром действий");
    const bound = SCHEMA.flatMap(g => g.items).filter(isBound);
    assert.equal(bound.length, 87,
      "настроек, привязанных к путям конфига. Тумблер `Floating button` снят "
      + "2026-08-29: за ним нет движка, а контрол без движка в панели не "
      + "показывается (Ж2, З8)");
  });

  await test("ни одна группа не потерялась молча", () => {
    /*
     * В прототипе 34 группы. Одной здесь быть не может, и у неё своя
     * причина: либо она целиком свой блок и ждёт рендерера (фаза 3), либо
     * состоит из кнопок, которым нужно действие из реестра (фаза 5, З8).
     * Список закрытый: если группа исчезнет по другой причине, тест упадёт.
     */
    const AWAITED = [
      "command-reference",           // ждёт ID команд из фазы 2
    ];
    const have = new Set(SCHEMA.map(g => g.id));
    for (const id of AWAITED) {
      assert.ok(!have.has(id), id + " уже в схеме: обновите список ожидающих");
    }
    assert.equal(SCHEMA.length + AWAITED.length, 34,
      "34 группы прототипа разложены без остатка: группа Note properties удалена 2026-08-28 (её настройки уехали к Field, 10.9), группа Setting ids добавлена в тот же день, Binder перенесён 2026-08-29, тогда же заведена группа Color your Tags и вернулась Generated files");
  });

  await test("кнопка действия гаснет на время работы (5.6)", async () => {
    /*
     * Второе нажатие по `Apply` запускало бы применение конфиг-заметки поверх
     * незаконченного первого. Пока действие идёт, его кнопка неактивна, а по
     * окончании оживает — в том числе если действие бросило.
     */
    let release: (() => void) | null = null;
    const store = new MemoryStore({});
    const pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store,
      actions: {
        "apply-config-note": () => new Promise<void>(res => { release = res; }),
      },
      fragments: fragments as never,
    });
    pane.setActiveTab("pkm");

    const rowOf = (): Def => {
      const group = groupOf(pane, "pkm", "Config note");
      const row = (group?.items || []).find((it: Def) => typeof it.action === "function");
      assert.ok(row, "строка кнопок конфиг-заметки нашлась");
      return row as Def;
    };

    const before = rowOf();
    assert.equal(typeof before.disabled, "function", "у строки кнопок есть предикат неактивности");
    assert.equal((before.disabled as () => boolean)(), false, "до нажатия кнопка активна");

    const running = pane.run("apply-config-note");
    assert.equal((rowOf().disabled as () => boolean)(), true,
      "пока действие идёт, кнопка неактивна");

    (release as unknown as () => void)();
    await running;
    assert.equal((rowOf().disabled as () => boolean)(), false,
      "и оживает, когда действие закончилось");
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
    assert.deepEqual(list.map((d: Def) => d.heading), [undefined, "Help", "Modules"]);
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
    assert.equal(list[1]?.cls, "io-group-general-intro", "за полосой — группы вкладки");
    list[0].render();
    assert.equal(picked, "general");
  });

  await test("контролы получают правильный тип и ключ", () => {
    const { pane } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded 'Ctrl+A'")?.items || [];
    const byName = (n: string) => items.find((i: Def) => i.name === n);

    assert.equal(byName("Expanded 'Ctrl+A'")?.control?.type, "toggle");
    assert.equal(byName("Expanded 'Ctrl+A'")?.control?.key, "editor.selectAll.enabled");

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
    const items = groupOf(pane, "keyboard", "Expanded 'Ctrl+A'")?.items || [];
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

  /* ---- вводные коллауты (10.1) ---------------------------------------- */

  await test("вводный коллаут — первый блок каждой вкладки (К1)", () => {
    const { pane } = makePane();
    for (const tab of TABS) {
      const group = firstGroup(pane, tab.id);
      /*
       * Заголовка у вводной группы нет: коллаут показывается сразу. Так же
       * устроен прототип, а «Before you start» над коллаутом было
       * расхождением с ним.
       */
      assert.ok(/^io-group-[a-z]+-intro$/.test(String(group.cls)),
        tab.id + ": первой идёт не вводная группа, а " + group.cls);
      assert.equal(group.heading, undefined, tab.id + ": над коллаутом не должно быть заголовка");
      const row = group.items?.[0];
      assert.equal(typeof row?.render, "function", tab.id + ": коллаут рисуется не своим блоком");
      assert.equal(row?.searchable, false, tab.id + ": коллаут не должен попадать в поиск");
      assert.equal(row?.name, "", tab.id + ": у своего блока имени нет");
      assert.equal(row?.control, undefined, tab.id + ": у коллаута нет контрола");
    }
  });

  await test("коллаут несёт фразу вкладки и абзац (К1)", () => {
    const { pane } = makePane();
    const host = drawBlock(firstGroup(pane, "navigation").items[0]);
    const text = host.textContent;
    assert.ok(text.includes("This menu helps to make inline navigation"),
      "нет фразы о том, что делает вкладка: " + text.slice(0, 80));
    assert.ok(text.includes("Moving lines and whole trees"), "нет абзаца о содержимом вкладки");
  });

  await test("подсказка коллаута открывается под коллаутом, а не внутри (К2)", () => {
    const { pane } = makePane();
    const host = drawBlock(firstGroup(pane, "navigation").items[0]);
    const box = host.querySelector(".io-callout");
    assert.ok(box, "коллаут не нарисован");

    const mark = host.querySelector(".io-help");
    assert.ok(mark, "нет «?» в шапке коллаута");
    assert.equal(box?.querySelectorAll(".io-tip").length, 0, "до нажатия подсказки нет");

    mark?.click();
    /*
     * Ровно то, о чём говорил заказчик: раскрытие внутри рамки раздвигало
     * текст коллаута. Подсказка обязана быть ребёнком строки, а не бокса.
     */
    assert.equal(box?.querySelectorAll(".io-tip").length, 0,
      "подсказка не должна открываться внутри коллаута");
    const tips = host.children.filter((n: StubNode) => n.classList.contains("io-tip"));
    assert.equal(tips.length, 1, "подсказка должна быть под коллаутом, одна");
    assert.ok(String(tips[0]?.textContent).includes("None of these commands has a key by default"),
      "в подсказке не тот текст: " + tips[0]?.textContent);
    assert.equal(mark?.getAttribute("aria-expanded"), "true");

    mark?.click();
    assert.equal(host.children.filter((n: StubNode) => n.classList.contains("io-tip")).length, 0,
      "повторное нажатие должно закрывать подсказку");
    assert.equal(mark?.getAttribute("aria-expanded"), "false");
  });

  await test("в коллауте нет кнопки перехода (решение заказчика 2026-08-26)", () => {
    /*
     * Кнопка вела на настройку двумя строками ниже и ценности не давала;
     * заодно ушёл и весь шов перехода. Проверка держит это: единственная
     * кнопка коллаута — «?», и та появляется только при включённых подсказках.
     */
    const { pane } = makePane();
    for (const tab of TABS) {
      const host = drawBlock(firstGroup(pane, tab.id).items[0]);
      const buttons = host.querySelectorAll("BUTTON");
      assert.equal(buttons.length, 1, tab.id + ": в коллауте лишние кнопки");
      assert.equal(buttons[0]?.classList.contains("io-help"), true,
        tab.id + ": единственная кнопка коллаута — «?»");
    }
  });

  await test("подсказка коллаута исчезает при выключенном Show tips", () => {
    const { pane } = makePane({ general: { help: { showTips: false } } });
    const host = drawBlock(firstGroup(pane, "navigation").items[0]);
    assert.equal(host.querySelectorAll(".io-help").length, 0, "«?» осталось");
    assert.ok(host.textContent.includes("This menu helps"), "сам коллаут должен остаться");
  });

  await test("очистка блока убирает открытую подсказку (С5)", () => {
    const { pane } = makePane();
    const host = makeNode("div");
    const cleanup = firstGroup(pane, "navigation").items[0].render({ settingEl: host }, {});
    host.querySelector(".io-help")?.click();
    assert.equal(host.children.filter((n: StubNode) => n.classList.contains("io-tip")).length, 1);
    cleanup();
    assert.equal(host.children.filter((n: StubNode) => n.classList.contains("io-tip")).length, 0,
      "подсказка должна уйти вместе с блоком");
  });

  /* ---- предпросмотр тегов (10.3, проверка по выводу Г20) -------------- */

  const bubbles = (host: StubNode): StubNode[] => host.querySelectorAll(".io-bubble");

  await test("предпросмотр тегов рисует строку целиком", () => {
    const { pane } = makePane();
    const host = drawBlock(blockOf(pane, "visual", "Tag appearance"));
    const text = host.textContent;

    assert.equal(host.querySelectorAll(".io-preview").length, 1, "нет рамки предпросмотра");
    assert.ok(text.includes("Rewrite the settings copy"), "нет текста выдуманной строки");
    assert.ok(text.includes("2026-08-24"), "нет элемента справа");
    assert.ok(text.includes("[[ClientA]]"), "нет ссылки справа");
    /* П9: предпросмотр обязан сказать, что он не редактор */
    assert.ok(text.includes("Close to what the editor draws"), "нет пометки о приблизительности");
    /* ПЗ2: и что Fields пока примерные */
    assert.ok(text.includes("Example Fields"), "нет пометки о примере");
  });

  await test("Value с подзначением слитно и раздельно (Г20)", () => {
    const separate = makePane({ pkm: { behavior: { childTagFormat: "separate" } } });
    const two = bubbles(drawBlock(blockOf(separate.pane, "visual", "Tag appearance")));
    /* два пузыря Status плюс пустой пузырь Priority */
    assert.equal(two.length, 3, "раздельно должно быть три пузыря: " +
      two.map(b => b.textContent).join(" | "));
    assert.equal(two[0]?.textContent, "#doing");
    assert.equal(two[1]?.textContent, "#review");

    const combined = makePane({ pkm: { behavior: { childTagFormat: "combined" } } });
    const one = bubbles(drawBlock(blockOf(combined.pane, "visual", "Tag appearance")));
    assert.equal(one.length, 2, "слитно должно быть два пузыря");
    assert.equal(one[0]?.textContent, "#doing/review",
      "слитная запись — один пузырь с обоими значениями");
  });

  await test("Value с показом empty остаётся пузырём без текста", () => {
    const { pane } = makePane();
    const list = bubbles(drawBlock(blockOf(pane, "visual", "Tag appearance")));
    const empty = list.filter(b => b.classList.contains("io-bubble--empty"));
    assert.equal(empty.length, 1, "у Priority должен быть один пустой пузырь");
    assert.equal(empty[0]?.textContent.trim(), "", "в пустом пузыре не должно быть надписи");
    assert.ok(String(empty[0]?.style.getPropertyValue("--io-bubble-bg")).length > 0,
      "цвет у пустого пузыря остаётся: он и есть всё, что видно");
  });

  await test("оформление тегов уезжает в переменные, а не в стили (Г1)", () => {
    const { pane } = makePane({
      visual: { tags: { opacityLeft: 40, textSizePct: 120, cornersPct: 100 } },
    });
    const host = drawBlock(blockOf(pane, "visual", "Tag appearance"));
    const line = host.querySelector(".io-line");
    assert.equal(line?.style.getPropertyValue("--io-opacity-left"), "0.4");
    assert.equal(line?.style.getPropertyValue("--io-text-scale"), "1.2");
    /* 100% «квадратности» — это ноль скругления */
    assert.equal(line?.style.getPropertyValue("--io-corners"), "0");
  });

  await test("Separator в предпросмотре берётся из настройки", () => {
    const { pane } = makePane({ pkm: { lineFormat: { separator1: "//" } } });
    const text = drawBlock(blockOf(pane, "visual", "Tag appearance")).textContent;
    assert.ok(text.includes("//"), "первый Separator должен прийти из настройки: " + text);
  });

  await test("предпросмотр перерисовывается точечно, без пересборки панели (П2)", async () => {
    const { pane, counts } = makeCountingPane();
    const host = makeNode("div");
    const cleanup = blockOf(pane, "visual", "Tag appearance").render({ settingEl: host }, {});
    counts.rebuild = 0;

    assert.equal(pane.watcherCount(), 1, "блок должен подписаться на свои пути");
    await pane.setControlValue("visual.tags.opacityLeft", 55);

    assert.equal(counts.rebuild, 0, "шаг слайдера не должен пересобирать панель");
    assert.equal(host.querySelector(".io-line")?.style.getPropertyValue("--io-opacity-left"), "0.55",
      "предпросмотр обязан перерисоваться сам");

    cleanup();
    assert.equal(pane.watcherCount(), 0, "очистка блока обязана снять подписку (С5)");
  });

  await test("панель пересобирается только из-за подсказок (П2)", async () => {
    const { pane, counts } = makeCountingPane();
    const btn = fakeButton();
    groupOf(pane, "visual", "Tag appearance")?.extraButtons?.[0](btn);
    counts.rebuild = 0;   // переключение вкладки — законная пересборка

    /* ни первый шаг слайдера, ни последующие панель не пересобирают */
    await pane.setControlValue("visual.tags.opacityLeft", 55);
    await pane.setControlValue("visual.tags.opacityLeft", 60);
    assert.equal(counts.rebuild, 0, "перетаскивание слайдера не пересобирает панель");
    assert.equal(lastDisabled(btn), "disabled:false",
      "кнопка сброса при этом обязана ожить на месте");

    await pane.setControlValue("general.help.showTips", false);
    assert.equal(counts.rebuild, 1, "«?» появляется и исчезает только пересборкой");
  });

  /* ---- предпросмотр TagWheel (10.3 П7, П8, проверка по выводу Г20) ---- */

  /**
   * Снимок скроллера: что стоит на чипе и что в панелях, сверху вниз.
   * Направление проверяется только так: перевёрнутый порядок читается в коде
   * как правильный, и увидеть ошибку можно лишь в выводе.
   */
  function wheelShot(pane: SettingsPane): { chip: string; up: string[]; down: string[] } {
    const host = makeNode("div");
    blockOf(pane, "visual", "TagWheel").render({ settingEl: host }, {});
    const panel = (where: string): string[] => {
      const p = host.querySelectorAll(".io-wheelpanel--" + where)[0];
      return p ? p.children.map((c: StubNode) => c.textContent) : [];
    };
    return {
      chip: host.querySelectorAll(".io-bubble--current")[0]?.textContent || "",
      up: panel("up"),
      down: panel("down"),
    };
  }

  await test("вверх — следующие значения, вниз — предыдущие, круг замкнут (П7)", () => {
    const { pane } = makePane({
      visual: { tagWheel: { showMarkers: false, scroller: { enabled: true, size: 3, direction: "full" } } },
    });
    const shot = wheelShot(pane);

    /*
     * Скроллер сидит на втором Field слева — Priority, значения верхнего
     * уровня: none, low, med, high. Середина — med.
     */
    assert.equal(shot.chip, "med", "в середине стоит текущее значение");
    /* вверх идут следующие, и снизу вверх они удаляются от текущего:
       ближайшее к чипу — high, дальше круг заходит на none и low */
    assert.deepEqual(shot.up, ["low", "none", "high"],
      "панель сверху читается сверху вниз, ближайшее значение — у чипа");
    /* вниз идут предыдущие, тоже по кругу */
    assert.deepEqual(shot.down, ["low", "none", "high"],
      "вниз — предыдущие значения, список замкнут");
  });

  await test("направление скроллера решает, какая панель есть (П7)", () => {
    const only = (direction: string) => wheelShot(makePane({
      visual: { tagWheel: { scroller: { enabled: true, size: 2, direction } } },
    }).pane);

    const both = only("full");
    assert.equal(both.up.length, 2);
    assert.equal(both.down.length, 2);

    const upOnly = only("up");
    assert.equal(upOnly.up.length, 2, "вверх — панель есть");
    assert.equal(upOnly.down.length, 0, "и только она");

    const downOnly = only("down");
    assert.equal(downOnly.up.length, 0);
    assert.equal(downOnly.down.length, 2);
  });

  await test("выключенный скроллер не рисует ни одной панели", () => {
    const { pane } = makePane({ visual: { tagWheel: { scroller: { enabled: false } } } });
    const shot = wheelShot(pane);
    assert.equal(shot.up.length + shot.down.length, 0, "панелей быть не должно");
    assert.ok(shot.chip.length > 0, "но значение на чипе остаётся");
  });

  await test("Values per side задаёт число строк в панели", () => {
    const rows = (size: number) => wheelShot(makePane({
      visual: { tagWheel: { scroller: { enabled: true, size, direction: "full" } } },
    }).pane).up.length;
    assert.equal(rows(1), 1);
    assert.equal(rows(3), 3);
  });

  await test("маркеры добавляют решётку к значениям, и только их", () => {
    const withMarks = wheelShot(makePane({
      visual: { tagWheel: { showMarkers: true, scroller: { enabled: true, size: 1, direction: "up" } } },
    }).pane);
    assert.ok(withMarks.chip.startsWith("#"), "с маркерами значение с решёткой: " + withMarks.chip);
    assert.ok(withMarks.up.every(v => v.startsWith("#")), "и в панели тоже");

    const without = wheelShot(makePane({
      visual: { tagWheel: { showMarkers: false, scroller: { enabled: true, size: 1, direction: "up" } } },
    }).pane);
    assert.ok(!without.chip.startsWith("#"), "без маркеров — одни слова");
  });

  await test("место под панели резервируется на подложке, а не на рамке (П8)", () => {
    const { pane } = makePane({
      visual: { tagWheel: { scroller: { enabled: true, size: 3, direction: "full" } } },
    });
    const host = makeNode("div");
    blockOf(pane, "visual", "TagWheel").render({ settingEl: host }, {});
    const box = host.querySelector(".io-preview");
    assert.equal(box?.style.getPropertyValue("--io-wheel-up"), "81px",
      "три строки по 21 плюс рамка панели: 3*21+18");
    assert.equal(box?.style.getPropertyValue("--io-wheel-down"), "81px");

    /* Пометка о примере обязана лежать под подложкой, иначе нижняя панель
       её закрывает — заказчик увидел это первым. */
    const stage = host.querySelector(".io-wheelstage");
    assert.equal(stage?.querySelectorAll(".io-preview__note").length, 0,
      "внутри подложки пометок быть не должно");
    const foot = host.querySelector(".io-preview__foot");
    assert.equal(foot?.querySelectorAll(".io-preview__note").length, 1,
      "пометка о примере — под подложкой");
  });

  await test("форма линии: чип на каждый Field и пустое состояние правого Block", () => {
    const { pane } = makePane();
    const host = makeNode("div");
    blockOf(pane, "visual", "TagWheel").render({ settingEl: host }, {});
    const text = host.textContent;
    assert.ok(text.includes("your text"), "нет текста выдуманной строки");
    assert.ok(text.includes("nothing on the right yet"),
      "у пустой стороны должно быть пустое состояние, а не пустота (ПЗ2)");
    assert.equal(host.querySelectorAll(".io-line__side--right").length, 0,
      "правой стороны нет: оба примерных Field в левом Block");
    /* один чип на Field: Status обычным, Priority — со скроллером */
    assert.equal(host.querySelectorAll(".io-wheelcol").length, 2);
  });

  /* ---- предпросмотр Bars (10.3 П4—П6, проверка по выводу Г20) --------- */

  /**
   * Снимок дерева: для каждой строки её текст и дорожки полос, которые над
   * ней стоят. Читается результат рендера, а не исходник — иначе проверка
   * ничего не проверяет.
   */
  function barsShot(store: MemoryStore, pane: SettingsPane): { lines: string[]; bars: string[] } {
    const host = makeNode("div");
    blockOf(pane, "visual", "Tag Bars").render({ settingEl: host }, {});
    const lines: string[] = [];
    const bars: string[] = [];

    const walk = (node: StubNode, lanes: string[]): void => {
      const own = node.classList.contains("io-node--bar")
        ? lanes.concat([node.style.getPropertyValue("--io-lane") + ":" +
                        node.style.getPropertyValue("--io-bar-color")])
        : lanes;
      if (node.classList.contains("io-line")) {
        lines.push(node.textContent.replace(/\s+/g, " ").trim());
        bars.push(lanes.join(" ") || "no bar");
        return;
      }
      node.children.forEach(c => walk(c, own));
    };
    const tree = host.querySelector(".io-tree");
    assert.ok(tree, "нет дерева предпросмотра");
    (tree as StubNode).children.forEach(c => walk(c, []));
    void store;
    return { lines, bars };
  }

  await test("текст строк не зависит от того, какой Field рисует полосы (П4)", () => {
    const byStatus = makePane({ visual: { tagBars: { fieldId: "status", stripesToShow: 3 } } });
    const byPriority = makePane({ visual: { tagBars: { fieldId: "priority", stripesToShow: 3 } } });

    const a = barsShot(byStatus.store, byStatus.pane);
    const b = barsShot(byPriority.store, byPriority.pane);

    assert.ok(a.lines.length >= 9, "дерево должно быть непустым: " + a.lines.length);
    assert.deepEqual(a.lines, b.lines,
      "требование заказчика: переключение Field не меняет ни одной строки текста");
    assert.notDeepEqual(a.bars, b.bars, "а полосы обязаны стать другими");
  });

  await test("полоса идёт во всю высоту поддерева, дорожки считаются слева (П6)", () => {
    const { store, pane } = makePane({ visual: { tagBars: { fieldId: "status", stripesToShow: 3 } } });
    const shot = barsShot(store, pane);

    /* первая строка несёт Status, значит у неё своя полоса в дорожке 0 */
    assert.ok(shot.bars[0]?.startsWith("0:"), "у родителя дорожка 0: " + shot.bars[0]);
    /* её ребёнок тоже несёт Status, значит получает следующую дорожку, а
       полоса родителя над ним остаётся */
    assert.equal(shot.bars[1]?.split(" ").length, 2,
      "над ребёнком две полосы: своя и родительская — " + shot.bars[1]);
    assert.ok(shot.bars[1]?.startsWith("0:"), "родительская дорожка остаётся левой");
    assert.ok(shot.bars[1]?.includes("1:"), "ребёнок берёт следующую дорожку");
  });

  await test("Number of Bars ограничивает число дорожек, не сдвигая текст", () => {
    const deep = makePane({ visual: { tagBars: { fieldId: "status", stripesToShow: 3 } } });
    const flat = makePane({ visual: { tagBars: { fieldId: "status", stripesToShow: 1 } } });

    const a = barsShot(deep.store, deep.pane);
    const b = barsShot(flat.store, flat.pane);
    assert.deepEqual(a.lines, b.lines, "текст не зависит от числа полос (П5)");

    const most = (shot: { bars: string[] }) =>
      Math.max(...shot.bars.map(x => (x === "no bar" ? 0 : x.split(" ").length)));
    assert.equal(most(a), 3, "при трёх разрешённых глубже трёх полос не бывает");
    assert.equal(most(b), 1, "при одной разрешённой полоса только у верхней строки");
  });

  await test("выключенные Bars не рисуют ни одной полосы", () => {
    const { store, pane } = makePane({ visual: { tagBars: { active: false } } });
    const shot = barsShot(store, pane);
    assert.ok(shot.bars.every(b => b === "no bar"), "полосы выключены, а нарисованы: " + shot.bars.join(", "));
    assert.ok(shot.lines.some(l => l.includes("#todo")), "теги при этом остаются на строках");
  });

  await test("скрывается ровно тег того Field, что рисует полосу (П4)", () => {
    const shown = makePane({ visual: { tagBars: { fieldId: "status", tagVisibility: true } } });
    const hidden = makePane({ visual: { tagBars: { fieldId: "status", tagVisibility: false } } });

    const a = barsShot(shown.store, shown.pane).lines.join(" | ");
    const b = barsShot(hidden.store, hidden.pane).lines.join(" | ");

    assert.ok(a.includes("#todo"), "с включённым показом тег Status на месте");
    assert.ok(!b.includes("#todo"), "с выключенным он уходит: " + b.slice(0, 120));
    /* а чужой Field при этом не трогается */
    assert.ok(b.includes("#none") || b.includes("#low") || b.includes("#med") || b.includes("#high")
      || b.includes("||"), "тег другого Field и Separator остаются: " + b.slice(0, 120));
  });

  await test("толщина и отступы полос уезжают в переменные", () => {
    const { pane } = makePane({ visual: { tagBars: { thickness: 7, childOffset: 15, spacing: 22 } } });
    const host = makeNode("div");
    blockOf(pane, "visual", "Tag Bars").render({ settingEl: host }, {});
    const tree = host.querySelector(".io-tree");
    assert.equal(tree?.style.getPropertyValue("--io-bar-thickness"), "7px");
    assert.equal(tree?.style.getPropertyValue("--io-bar-gap"), "15px");
    assert.equal(tree?.style.getPropertyValue("--io-bar-distance"), "22px");
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
    const items = groupOf(pane, "keyboard", "Expanded 'Ctrl+A'")?.items || [];
    const it = items.find((i: Def) => i.name === "Expanded 'Ctrl+A'");
    /* Оба прежних имени: и до PRD, и то, что панель носила до 2026-08-26. */
    assert.deepEqual(it?.aliases, ["Enhanced Mod+A", "Expanded select all"],
      "старые имена должны попасть в aliases");
    const text = String((it?.desc as StubNode | undefined)?.textContent || "");
    assert.ok(!text.includes("Enhanced Mod+A"), "и не должно попасть в видимое описание: " + text);
  });

  await test("единица слайдера уходит в displayFormat (Ст5)", () => {
    const { pane } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded 'Ctrl+A'")?.items || [];
    const delay = items.find((i: Def) => i.name === "Time between presses");
    assert.equal(delay?.control?.displayFormat?.(700), "700 ms");
  });

  await test("неактивность живёт в контроле, а не в определении", () => {
    const { pane, store } = makePane();
    const items = groupOf(pane, "keyboard", "Expanded 'Ctrl+A'")?.items || [];
    const steps = items.find((i: Def) => i.name === "Selection steps");
    assert.equal(steps?.disabled, undefined, "у определения контрола disabled нет");
    assert.equal(steps?.control?.disabled?.(), true);
    void store.set("editor.selectAll.enabled", true);
    assert.equal(steps?.control?.disabled?.(), false);
  });

  await test("подсказка уходит из описания, когда Show tips выключен", () => {
    const { pane } = makePane({ general: { help: { showTips: false } } });
    const items = groupOf(pane, "keyboard", "Expanded 'Ctrl+A'")?.items || [];
    const it = items.find((i: Def) => i.name === "Expanded 'Ctrl+A'");
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

  await test("Н3: сброс спрашивает и показывает, что изменится", async () => {
    const { pane, asked } = makePane();
    const modules = SCHEMA.find((g: Def) => g.id === "modules");
    assert.ok(modules);
    await pane.setControlValue("features.visual.enabled", false);
    await pane.setControlValue("features.transform.enabled", false);

    await pane.resetGroup(modules);
    assert.equal(asked.length, 1, "спросили один раз");
    const q = asked[0] as Def;
    assert.ok(String(q.title).includes(modules.heading), "в заголовке названа группа");
    assert.equal(q.rows.length, 2, "по строке на каждую изменённую настройку");
    assert.ok(q.rows.every((r: string) => r.includes("off") && r.includes("on")),
      "и в строке видно, из чего во что: " + q.rows.join(" | "));
    assert.ok(String(q.note).includes("Fields"),
      "Н5: сказано, что данные человека не трогаются");
  });

  await test("Н3: отказ ничего не меняет", async () => {
    const store = new MemoryStore({});
    const pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store,
      actions: {},
      fragments: fragments as never,
      confirm: async () => false,
    });
    const modules = SCHEMA.find((g: Def) => g.id === "modules");
    assert.ok(modules);
    await pane.setControlValue("features.visual.enabled", false);
    store.writes.length = 0;

    const n = await pane.resetGroup(modules);
    assert.equal(n, 0, "сброс не состоялся");
    assert.deepEqual(store.writes, [], "и ни одной записи не было");
    assert.equal(pane.getControlValue("features.visual.enabled"), false,
      "значение осталось тем, которое человек выставил");
  });

  await test("Н3: без окна подтверждения сброс не идёт вовсе", async () => {
    /*
     * Молчаливое согласие в действии, которое меняет разом всю группу, хуже
     * неработающей кнопки. Так же устроено применение конфиг-заметки (5.6).
     */
    const store = new MemoryStore({});
    const pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store,
      actions: {},
      fragments: fragments as never,
    });
    const modules = SCHEMA.find((g: Def) => g.id === "modules");
    assert.ok(modules);
    await pane.setControlValue("features.visual.enabled", false);
    store.writes.length = 0;

    assert.equal(await pane.resetGroup(modules), 0, "сброса нет");
    assert.deepEqual(store.writes, [], "и записей нет");
  });

  await test("Н3: длинный список сворачивается", async () => {
    /*
     * Самая длинная группа схемы — `tag-bars`, в ней девять настроек, и до
     * порога в десять строк она не достаёт. Порог всё равно обязан работать:
     * группы растут. Поэтому группа здесь выдуманная — двенадцать тумблеров,
     * — и это единственная подделка в проверке: панель и хранилище настоящие.
     */
    const store = new MemoryStore({});
    const asked: Def[] = [];
    const twelve = {
      id: "made-up", tab: "general", order: 999, heading: "Made up",
      items: Array.from({ length: 12 }, (_, i) => ({
        kind: "toggle",
        id: "made-up-" + i,
        path: "advanced.madeUp" + i,
        default: false,
        name: "Made up " + i,
      })),
    };
    const pane = new SettingsPane({
      schema: SCHEMA.concat([twelve as never]),
      tabs: TABS,
      store,
      actions: {},
      fragments: fragments as never,
      confirm: async (o: Def) => { asked.push(o); return true; },
    });
    for (const it of twelve.items) await pane.setControlValue(it.path, true);

    assert.equal(await pane.resetGroup(twelve as never), 12, "сбросились все двенадцать");
    const rows = (asked[0]?.rows || []) as string[];
    assert.equal(rows.length, 11, "десять строк и одна про остаток");
    assert.equal(rows[10], "and 2 more", "остаток назван числом: " + rows[10]);
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
    const buttons = groupOf(pane, "general", "Modules")?.extraButtons;
    assert.ok(Array.isArray(buttons) && buttons.length === 1, "одна кнопка в заголовке");
    assert.equal(typeof buttons[0], "function", "элемент extraButtons обязан быть функцией");

    const btn = fakeButton();
    buttons[0](btn);
    assert.ok((btn.calls as string[]).includes("icon:rotate-ccw"));
    assert.ok((btn.calls as string[]).includes("onClick"));
  });

  await test("место кнопки сброса занято всегда, гаснет она сама (Н1, Н2)", async () => {
    /*
     * Раньше кнопка появлялась и исчезала — и этим меняла определение группы
     * на первом же шаге слайдера: платформа пересобирала страницу, заменяла
     * узел слайдера, и перетаскивание обрывалось.
     */
    const { pane } = makePane();
    const mount = () => {
      const btn = fakeButton();
      const fn = groupOf(pane, "general", "Modules")?.extraButtons?.[0];
      assert.equal(typeof fn, "function", "кнопка должна быть в заголовке всегда");
      fn(btn);
      return btn;
    };

    const idle = mount();
    assert.equal(lastDisabled(idle), "disabled:true", "сбрасывать нечего — кнопка неактивна");
    assert.equal(lastTooltip(idle), "tooltip:Everything here is already at its default",
      "неактивная кнопка объясняет причину (Н2)");

    /* Изменение значения меняет состояние на самой кнопке, без пересборки. */
    const live = mount();
    await pane.setControlValue("features.visual.enabled", false);
    assert.equal(lastDisabled(live), "disabled:false", "появилось отличие — кнопка ожила");
    assert.ok(String(lastTooltip(live)).includes("1 setting differs"),
      "подсказка называет число отличий: " + lastTooltip(live));
  });

  /* ---- подпись id в подсказках (10.13.5, заказ 2026-08-28) ------------ */

  /**
   * Текст подсказки настройки: что реально попало в описание. Читается вывод,
   * а не схема — подпись id живёт в собранном фрагменте, и увидеть её можно
   * только там.
   */
  const tipTextOf = (pane: SettingsPane, tab: string, heading: string, name: string): string => {
    const group = groupOf(pane, tab, heading);
    const row = (group?.items || []).find((it: Def) => it.name === name);
    assert.ok(row, "не нашлась строка " + name + " в группе " + heading);
    const desc = row.desc as StubNode | string | undefined;
    return typeof desc === "string" ? desc : String(desc?.textContent || "");
  };

  await test("тумблер подписи id выключен по умолчанию", () => {
    const defaults = buildDefaultConfig(SCHEMA);
    assert.equal(getIn(defaults, "advanced.showSettingIds"), false,
      "по умолчанию id не показываются: это подпись для разговора, а не для работы");
    const { pane } = makePane();
    const tip = tipTextOf(pane, "advanced", "Diagnostics", "Developer logging");
    assert.ok(!tip.includes("dev-mode"), "id в подсказке быть не должно: " + tip);
  });

  await test("с тумблером id стоит последней строкой подсказки", async () => {
    const { pane } = makePane();
    await pane.setControlValue("advanced.showSettingIds", true);
    const tip = tipTextOf(pane, "advanced", "Diagnostics", "Developer logging");
    assert.ok(tip.includes("Leave this off day to day"), "своя подсказка осталась: " + tip);
    assert.ok(tip.trimEnd().endsWith("dev-mode"), "id идёт последним: " + tip);
  });

  await test("настройка без своей подсказки получает подсказку ради id", async () => {
    const { pane } = makePane();
    /* `New notes folder` — настройка с описанием, но без подсказки. */
    const before = tipTextOf(pane, "transform", "Inline to note", "New notes folder");
    assert.ok(!before.includes("i2n-output-folder"), "до тумблера id нет: " + before);
    await pane.setControlValue("advanced.showSettingIds", true);
    const after = tipTextOf(pane, "transform", "Inline to note", "New notes folder");
    assert.ok(after.includes("i2n-output-folder"),
      "у настройки без подсказки подсказка появляется ради id: " + after);
  });

  await test("id группы дописан к её вводной строке", async () => {
    const { pane } = makePane();
    const introOf = (): string => {
      const group = groupOf(pane, "advanced", "Diagnostics");
      const row = (group?.items || [])[0] as Def;
      const desc = row?.desc as StubNode | string | undefined;
      return typeof desc === "string" ? desc : String(desc?.textContent || "");
    };
    assert.ok(!introOf().includes("diagnostics"), "до тумблера id группы нет");
    await pane.setControlValue("advanced.showSettingIds", true);
    assert.ok(introOf().endsWith("diagnostics"), "id группы в конце вводной строки: " + introOf());
  });

  await test("id появляется только вместе с подсказками", async () => {
    const { pane } = makePane({ general: { help: { showTips: false } } });
    await pane.setControlValue("advanced.showSettingIds", true);
    const tip = tipTextOf(pane, "advanced", "Diagnostics", "Developer logging");
    assert.ok(!tip.includes("dev-mode"),
      "подсказок нет — значит и подписи id негде быть: " + tip);
  });

  await test("тумблер id пересобирает определения, а не только значения", async () => {
    const { pane, counts } = makeCountingPane();
    await pane.setControlValue("advanced.showSettingIds", true);
    assert.equal(counts.rebuild, 1,
      "описания кешируются (П-11), и без пересборки подпись id не появилась бы");
  });

  console.log("\n" + ran + " проверок пройдено");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
