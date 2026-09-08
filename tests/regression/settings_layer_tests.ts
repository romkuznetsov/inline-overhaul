/**
 * Слой настроек: схема, отображение в API Obsidian и шов хранилища.
 * Запускается на обвязке tests/harness, без Obsidian.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
/* Настоящая цепочка `Setting` из заглушки Obsidian: строка с кнопками рисует
   их через `addButton`, и проверять надо то, что она нарисовала (C9). */
import { Setting, setupGlobals } from "../harness/obsidian_stub.ts";

/* Документ нужен одной проверке: «?» заголовка ищет тело подсказки по id, как
   в браузере (B7). Без глобального документа искать негде. */
setupGlobals();
import { SCHEMA, TABS, groupsFor, activeTabs } from "../../src/ui/settings/schema/index.ts";
import { buildDefaultConfig, getIn, isBound } from "../../src/ui/settings/types.ts";
import { MemoryStore } from "../../src/ui/settings/store.ts";
import { SettingsPane } from "../../src/ui/settings/settings_tab.ts";
import { richParts } from "../../src/ui/settings/describe.ts";
import { findScrollHost } from "../../src/ui/settings/custom/dom.ts";
import { tabStripRow } from "../../src/ui/settings/custom/tab_strip.ts";

/** Корень репозитория: одна проверка читает `styles.css` с диска. */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Определение как свободная запись: тесту нужна форма, а не сужение union. */
type Def = Record<string, any>;
/** Свободное значение: у заглушек форма не сужается. */
type Any = ReturnType<typeof JSON.parse>;
const allDefs = (pane: SettingsPane): Def[] => pane.getSettingDefinitions() as unknown as Def[];

/*
 * Заголовок группы здесь — адрес, а не предмет проверки: проверяются типы и
 * ключи контролов внутри неё. Поэтому он берётся у схемы, а не переписывается
 * в шести местах при каждом переименовании (замечание заказчика 1.2.1.1).
 */
const SELECT_ALL_HEADING = String(
  SCHEMA.find(g => g.id === "select-all")?.heading || "");
/* То же и по той же причине: группа `tag-appearance` переименована в
   `Inline appearance` (замечание заказчика 2026-09-04), и адрес брать надо у
   схемы, а не переписывать заголовок в семи местах. */
const TAG_APPEARANCE_HEADING = String(
  SCHEMA.find(g => g.id === "tag-appearance")?.heading || "");

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

function makePane(initial: Record<string, unknown> = {}, over: Partial<Def> = {}) {
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
    ...over,
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

/**
 * Строки группы без её вводной фразы.
 *
 * Фраза рисуется через `render` — иначе платформа не рисовала бы её вовсе
 * (B7), — и потому «первая строка с `render`» перестала значить «свой блок».
 * Есть ли фраза, спрашивается у схемы, а не угадывается по содержимому.
 */
const rowsOf = (pane: SettingsPane, tab: string, heading: string): Def[] => {
  const group = groupOf(pane, tab, heading);
  const items = ((group?.items || []) as Def[]).slice();
  /* Вводной строки в группе больше нет: с 2026-09-04 фраза едет коллаутом
     между заголовком и карточкой, а не первой строкой внутри неё. */
  return items;
};

/** Свой блок группы по её заголовку: предпросмотр всегда первый после фразы. */
const blockOf = (pane: SettingsPane, tab: string, heading: string): Def => {
  const block = rowsOf(pane, tab, heading).find((it: Def) => typeof it.render === "function");
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
  /* Узел кнопки: панель заменяет на нём значок знаком вопроса и ставит класс. */
  const node = makeNode("button");
  const btn: Def = {
    calls,
    extraSettingsEl: node,
    node,
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

/**
 * Кнопка заголовка группы — по тому, что она делает, а не по месту в массиве.
 *
 * С 2026-09-02 в заголовке две кнопки: «?» подсказки группы и сброс, и «?»
 * стоит первым (порядок прототипа). Проверки, искавшие сброс по индексу 0,
 * покраснели ровно от этого — и правильно: опора на порядок и была
 * ненадёжной (У-5).
 */
function headerButtons(group: Def | undefined): Def[] {
  const list = group && Array.isArray(group.extraButtons) ? group.extraButtons : [];
  const out: Def[] = [];
  for (const make of list) {
    if (typeof make !== "function") continue;
    const btn = fakeButton();
    make(btn);
    out.push(btn);
  }
  return out;
}

/** Сброс узнаётся по своему значку. */
const resetButton = (group: Def | undefined): Def | undefined =>
  headerButtons(group).find(b => (b.calls as string[]).includes("icon:rotate-ccw"));

/** «?» узнаётся по классу, который панель ставит на узел кнопки. */
const tipButton = (group: Def | undefined): Def | undefined =>
  headerButtons(group).find(b => (b.node as { classList: { contains: (c: string) => boolean } })
    .classList.contains("io-help--group"));

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
    /*
     * `language` встал **над** `help` 2026-09-06 по замечанию заказчика к K2
     * («перенеси этот блок над help»): язык решается до того, как читать
     * подсказки, — читать их человек будет уже на своём языке.
     */
    assert.deepEqual(ids, ["general-intro", "language", "help", "modules"]);
  });

  await test("все семь вкладок на месте и в порядке 6.1", () => {
    assert.deepEqual(activeTabs().map(t => t.id),
      ["general", "keyboard", "navigation", "pkm", "visual", "transform", "advanced"]);
  });

  await test("перенесены все группы с настройками", () => {
    assert.equal(SCHEMA.length, 36,
      "групп в схеме: 22 с настройками, 7 вводных коллаутов, группа Fields, "
      + "группа Smart Rules, группа Binder, группа `Color your Tags` и группа "
      + "`Commands & Hotkeys`. Группа `Options IDs` добавлена 2026-08-28 по "
      + "заказу, Binder перенесён 2026-08-29, `Color your Tags` заведена в тот "
      + "же день, `Generated files` вернулась 2026-08-29 вместе с реестром "
      + "действий, справочник команд перенесён 2026-08-31 вместе с именами "
      + "команд из фазы 2, а `Backup` заведена в тот же день вместо "
      + "строки отката обновления (10.13.2) — то есть в схеме больше не "
      + "осталось ни одной группы прототипа, которая ждала бы своей фазы. "
      + "`Config note` и `Generated files` сняты 2026-09-03 вместе с "
      + "конфиг-заметкой (10.12, решения В-28 и В-29): их не ждут, их больше "
      + "нет. Группа `Language` заведена 2026-09-06 вместе с каталогом "
      + "текстов (10.13.38)");
    const bound = SCHEMA.flatMap(g => g.items).filter(isBound);
    assert.equal(bound.length, 119,
      "настроек, привязанных к путям конфига. Тумблер `Floating button` снят "
      + "2026-08-29: за ним нет движка, а контрол без движка в панели не "
      + "показывается (Ж2, З8). Путь папки копий добавлен 2026-08-31 (10.13.2). "
      + "Две строки `Source line` добавлены 2026-09-01: судьба текста и число "
      + "слов. Обе за настоящим движком — он их читал и раньше, панель просто "
      + "не давала их задать (замечание заказчика 1.6.5.1). Тумблер "
      + "`Step out of the word` добавлен 2026-09-08 по замечанию заказчика (перенос части слова за его пределы, тридцать четвёртое исключение к З3). Тумблер `Highlight the line` добавлен 2026-09-01 (10.13.6): движок обёртку "
      + "рисовать умел всегда, а записать ему значение было некому. Строка "
      + "`Line above is header` добавлена 2026-09-01 (10.13.9): три решётки "
      + "стояли жёстко в коде, а подсказка советовала вписать их в текст. "
      + "Четыре строки добавлены 2026-09-01 вместе с декорациями CM6 "
      + "(10.13.12): `Floating button` вернулся из списка ожидающих движка, а "
      + "подсветка обработанной строки получила тумблер, цвет и прозрачность "
      + "на ключах, которые нормализовались с самого начала и не читались "
      + "никем. Три цвета TagWheel добавлены 2026-09-02 (10.13.15, замечание "
      + "заказчика D6): фон и текст коробки скроллера, которая не читала ни "
      + "одной настройки цвета, и цвет активного Field на строке. Две строки "
      + "Tag Bars добавлены 2026-09-03 (10.13.16, замечание B22): зазор между "
      + "полосами соседних строк и слитная полоса у дерева — прежде зазор "
      + "стоял литералом в двух местах. Плюс строка "
      + "`Fields to keep` — она без пути, и в этот счёт не входит. Две строки "
      + "конфиг-заметки — путь и подробность — ушли 2026-09-03 вместе с ней. "
      + "Тумблер `Continue past a Separator` у переноса текста добавлен "
      + "2026-09-04 (замечание заказчика): у курсора внутри строки такая "
      + "опция была, а у переноса текста нет, и выделенная фраза уезжала за "
      + "разделитель в теги и в даты. Тумблер `Save a backup before "
      + "restoring` добавлен 2026-09-04 (замечание заказчика C56): копия "
      + "перед записью снималась всегда и выбора не было. Слайдер "
      + "`Distance from the text` добавлен 2026-09-04 вечером "
      + "(замечание заказчика): плавающая кнопка стояла к тексту "
      + "вплотную, и отступ был литералом в стилях. Тумблер `Show callouts` "
      + "добавлен 2026-09-04 вечером (замечание заказчика): вводные тексты "
      + "стали коллаутами, и их понадобилось уметь выключать. "
      + "Две группы и пять строк добавлены 2026-09-05 вечером по заказу: "
      + "`Smart Delete` на вкладке Keyboard четырьмя тумблерами (10.13.32, "
      + "четвёртый — Backspace, добавлен тем же вечером ответом заказчика) и "
      + "`Text cursor` на Visual тумблером и цветом каретки (10.13.33). "
      + "Три строки добавлены 2026-09-05 поздним вечером по заказу: "
      + "тумблер формы каретки, её толщина и скорость мерцания "
      + "(10.13.33 Ц6-Ц7). Обе прочитаны в app.js Obsidian, а не "
      + "выведены из типов: толщина живёт в border-left-width с парным "
      + "сдвигом, мерцание - в длительности анимации слоя каретки. "
      + "Строка `TagWheel navigation behavior` добавлена тогда же (10.13.35, "
      + "заводилась под именем `At the last Field`, переименована заказчиком "
      + "2026-09-06): край Block замыкал кольцо внутри своей стороны, и выбора "
      + "не было. "
      + "Две строки прокрутки при перемещении строки добавлены тогда же "
      + "(10.13.36): свой код до платформы не доезжал, прыжок решала она, "
      + "и выбора не было вовсе. "
      + "Строка `Where the target lands` добавлена 2026-09-06 по заказу "
      + "(10.13.37): у перехода по заголовкам прокрутка была, но только "
      + "«по центру», а заказчик попросил те же три положения, что у "
      + "перемещения строки. "
      + "Строка `Language` добавлена 2026-09-06 вместе с каталогом текстов "
      + "(10.13.38): панель заговорила не только по-английски");
  });

  await test("ни одна группа не потерялась молча", () => {
    /*
     * В прототипе 36 групп, и все 36 в схеме. Справочник команд был последним,
     * кто ждал своей фазы, и приехал 2026-08-31 вместе с именами команд;
     * `Backup` появилась в прототипе в тот же день уже готовой.
     *
     * Список оставлен пустым намеренно. Он не про те группы, что ждали, а про
     * класс ошибки: группа, исчезнувшая из схемы без записанной причины,
     * обязана уронить проверку. Запись сюда добавляется только с причиной.
     */
    const AWAITED: string[] = [];
    const have = new Set(SCHEMA.map(g => g.id));
    for (const id of AWAITED) {
      assert.ok(!have.has(id), id + " уже в схеме: обновите список ожидающих");
    }
    assert.equal(SCHEMA.length + AWAITED.length, 36,
      "36 групп прототипа разложены без остатка: группа Note properties удалена 2026-08-28 (её настройки уехали к Field, 10.9), группа Options IDs добавлена в тот же день, Binder перенесён 2026-08-29, тогда же заведена группа Color your Tags, Backup заведена 2026-08-31 (10.13.2), а Config note и Generated files сняты 2026-09-03 вместе с конфиг-заметкой (10.12); Smart Delete и Text cursor заведены 2026-09-05 вечером по заказу (10.13.32 и 10.13.33), а Language — 2026-09-06 вместе с каталогом текстов (10.13.38)");
  });

  await test("кнопка действия гаснет на время работы (5.6)", async () => {
    /*
     * Второе нажатие запускало бы действие поверх незаконченного первого.
     * Пока действие идёт, его кнопка неактивна, а по окончании оживает — в
     * том числе если действие бросило.
     *
     * Предмет проверки — `Save a backup`: до 2026-09-03 здесь стояла кнопка
     * `Apply` конфиг-заметки, и вместе с заметкой она снята (10.12). Правило
     * от предмета не зависит, а кнопка нужна любая настоящая, из схемы.
     */
    let release: (() => void) | null = null;
    const store = new MemoryStore({});
    const pane = new SettingsPane({
      schema: SCHEMA,
      tabs: TABS,
      store,
      actions: {
        "save-backup": () => new Promise<void>(res => { release = res; }),
      },
      fragments: fragments as never,
    });
    pane.setActiveTab("advanced");

    /*
     * Спрашивается **сама кнопка**, а не строка.
     *
     * До 2026-09-02 пункт схемы становился строкой-действием, у которой
     * неактивность лежала полем `disabled`. Теперь строка рисует настоящие
     * кнопки с подписями (C9), и гаснет та кнопка, чьё действие идёт, — а
     * подпись заодно проверяется здесь же: безымянная кнопка и была дефектом.
     */
    const saveButton = (): { label: string; disabled: boolean } => {
      const row = rowsOf(pane, "advanced", "Backup").find((it: Def) => typeof it.render === "function");
      assert.ok(row, "строка кнопок копии настроек нашлась");
      const setting = new Setting(makeNode("div"));
      (row as Def).render(setting, {});
      const found = setting.components.find((c: Any) => String(c.label || "") === "Save a backup");
      assert.ok(found, "кнопка `Save a backup` нарисована со своей подписью: "
        + JSON.stringify(setting.components.map((c: Any) => c.label)));
      return found as { label: string; disabled: boolean };
    };

    assert.equal(saveButton().disabled, false, "до нажатия кнопка активна");

    const running = pane.run("save-backup");
    assert.equal(saveButton().disabled, true, "пока действие идёт, кнопка неактивна");

    (release as unknown as () => void)();
    await running;
    assert.equal(saveButton().disabled, false, "и оживает, когда действие закончилось");
  });

  await test("строка с кнопками рисует кнопку на каждую, со своей подписью (C9)", () => {
    /*
     * Заказчик просил трижды: «из строки-кнопки сделай строку с кнопкой
     * Read». Прототип — источник истины — рисует здесь настоящие кнопки
     * (`RENDER.buttons`), а панель делала кликабельной всю строку, и подписи
     * не было видно нигде. Второй и следующие кнопки уезжали в `extraButtons`
     * — платформенные кнопки без значка: `Apply` и `Restore a backup` были
     * **безымянными**, и найти их человек не мог.
     *
     * Ожидание выписано отдельно от того, из чего строка рисуется (У-5):
     * здесь названы строки и подписи их кнопок. Строк было пять: три из них
     * — `Generate and apply`, `Template note` и `Regenerate` — ушли
     * 2026-09-03 вместе с конфиг-заметкой (10.12).
     */
    const want: Record<string, string[]> = {
      Guide: ["Read"],
      "Your settings": ["Save a backup", "Restore a backup"],
    };

    const { pane } = makePane();
    const seen: Record<string, string[]> = {};
    for (const tab of ["general", "advanced"]) {
      pane.setActiveTab(tab as never);
      for (const group of allDefs(pane)) {
        for (const row of (group.items || []) as Def[]) {
          const name = String(row.name || "");
          if (!want[name] || typeof row.render !== "function") continue;
          const setting = new Setting(makeNode("div"));
          row.render(setting, {});
          seen[name] = setting.components.map((c: Any) => String(c.label || ""));
        }
      }
    }

    for (const name of Object.keys(want)) {
      assert.deepEqual(seen[name], want[name],
        "у строки «" + name + "» кнопки со своими подписями: " + JSON.stringify(seen[name]));
    }
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
    assert.deepEqual(list.map((d: Def) => d.heading), [undefined, "Language", "Help", "Modules"]);
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
    const items = groupOf(pane, "keyboard", SELECT_ALL_HEADING)?.items || [];
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
    const items = groupOf(pane, "keyboard", SELECT_ALL_HEADING)?.items || [];
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

  /*
   * Отступ плавающей кнопки уходит вместе с самой кнопкой, а не гаснет.
   * Заказчик 2026-09-05: «i2n-floating-gap всегда видна, а должна быть видна
   * только когда i2n-floating = ON». До этого строка стояла всегда и была
   * неактивной — то есть обещала настройку у кнопки, которой нет (З8).
   */
  await test("отступ плавающей кнопки виден только вместе с кнопкой", () => {
    const { pane, store } = makePane();
    void store.set("transform.inline2note.enabled", true);
    const gap = (groupOf(pane, "transform", "Inline to note")?.items || [])
      .find((i: Def) => i.name === "Distance from the text");

    assert.ok(gap, "строка отступа пропала из группы");
    assert.equal(typeof gap?.visible, "function", "видимость должна доехать функцией");
    assert.equal(gap?.visible?.(), false, "кнопка выключена — отступа быть не должно");
    assert.equal(gap?.control?.disabled?.() ?? false, false,
      "гашения больше нет: строка не показывается вовсе");

    void store.set("transform.inline2note.floatingButton", true);
    assert.equal(gap?.visible?.(), true, "кнопка включена — отступ виден");

    void store.set("transform.inline2note.enabled", false);
    assert.equal(gap?.visible?.(), false, "модуль выключен — отступа тоже нет");
  });

  /*
   * Две клавиши — два хозяина у одной настройки (10.13.32 Д11).
   *
   * `Drop the line Prefix` и `Join with a space` относятся и к `Del`, и к
   * `Backspace`. Пока они висели на `not(enabled)`, включённый в одиночку
   * `Smart backspace` работал, а обе его настройки стояли погашенными — то
   * есть панель врала о том, что на них можно нажать. Отсюда `neither`.
   *
   * Проверяются все четыре сочетания: гасить строку можно ровно тогда, когда
   * не включена ни одна клавиша.
   */
  await test("настройки склейки живут, пока включена хотя бы одна из двух клавиш", () => {
    const { pane, store } = makePane();
    const items = groupOf(pane, "keyboard", "Smart Delete\\Backspace")?.items || [];
    const back = items.find((i: Def) => i.name === "Smart backspace");
    const prefix = items.find((i: Def) => i.name === "Drop the line Prefix");
    const space = items.find((i: Def) => i.name === "Join with a space");

    assert.ok(back, "тумблер Smart backspace пропал из группы");
    assert.equal(back?.control?.disabled?.() ?? false, false,
      "Smart backspace больше никому не подчинён и гаснуть не должен");

    assert.equal(prefix?.control?.disabled?.(), true, "обе клавиши выключены — настройка мертва");
    assert.equal(space?.control?.disabled?.(), true, "обе клавиши выключены — настройка мертва");

    void store.set("editor.smartDelete.onBackspace", true);
    assert.equal(prefix?.control?.disabled?.(), false,
      "один Smart backspace уже делает настройку живой");
    assert.equal(space?.control?.disabled?.(), false,
      "один Smart backspace уже делает настройку живой");

    void store.set("editor.smartDelete.onBackspace", false);
    void store.set("editor.smartDelete.enabled", true);
    assert.equal(prefix?.control?.disabled?.(), false, "один Smart Delete — то же самое");

    void store.set("editor.smartDelete.onBackspace", true);
    assert.equal(prefix?.control?.disabled?.(), false, "обе включены — тем более");
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

  /* ---- субхедер внутри группы (замечание G3) --------------------------- */

  /**
   * Отрисованный субхедер по его id.
   *
   * Ищется по пометке, которую панель ставит на строку (`data-io-item`), а не
   * по месту в массиве: у своего блока в определении нет ни имени, ни id —
   * есть только `render`, — а порядок строк в группе меняется (У-5).
   */
  const drawSubheader = (pane: SettingsPane, id: string): StubNode => {
    pane.setActiveTab("navigation" as never);
    for (const g of allDefs(pane)) {
      for (const it of (g.items || []) as Def[]) {
        if (!it || typeof it.render !== "function") continue;
        const host = makeNode("div");
        const cleanup = it.render({ settingEl: host }, {});
        if (host.getAttribute("data-io-item") === id) {
          assert.equal(typeof cleanup, "function", id + ": свой блок обязан вернуть очистку (С5)");
          return host;
        }
        if (typeof cleanup === "function") cleanup();
      }
    }
    throw new Error("субхедера " + id + " нет среди отрисованных блоков");
  };

  await test("«?» у субхедера открывает и снимает подсказку (G3)", () => {
    /*
     * Заказчик: «у этих субхедеров также должны появиться tips».
     *
     * Проверяется **нажатие**, а не размещение. Гейт Г20 сторожит знак у
     * заголовка **группы**, и субхедера он не касается вовсе: это свой блок
     * внутри группы. А подделка кнопки, выбрасывающая обработчик, доказывает
     * размещение и молчит про то, что кнопка делает, — на этом «?» у
     * заголовка четыре захода считался сделанным (У-43). Здесь кнопка
     * настоящая, узел заглушки помнит обработчик, и нажатие настоящее.
     */
    const { pane } = makePane();
    const host = drawSubheader(pane, "move-text-sub");

    const row = host.querySelector(".io-sub--group");
    assert.ok(row, "подпись субхедера не нарисована");
    assert.ok(String(host.textContent).includes("Move text"),
      "в подписи не тот текст: " + host.textContent);

    const mark = row?.querySelector(".io-help");
    assert.ok(mark, "«?» должен стоять в строке подписи, а не под ней");
    assert.equal(host.children.filter((n: StubNode) => n.classList.contains("io-tip")).length, 0,
      "до нажатия подсказки нет");

    mark?.click();
    /* Тело открывается под подписью: строка подписи узкая, и раскрытие
       внутри неё растолкало бы её пополам. */
    assert.equal(row?.querySelectorAll(".io-tip").length, 0,
      "подсказка не должна открываться внутри строки подписи");
    const tips = host.children.filter((n: StubNode) => n.classList.contains("io-tip"));
    assert.equal(tips.length, 1, "подсказка должна быть под подписью, одна");
    assert.ok(String(tips[0]?.textContent).includes("needs a selection"),
      "в подсказке не тот текст: " + tips[0]?.textContent);
    assert.equal(mark?.getAttribute("aria-expanded"), "true");

    mark?.click();
    assert.equal(host.children.filter((n: StubNode) => n.classList.contains("io-tip")).length, 0,
      "повторное нажатие должно закрывать подсказку");
  });

  await test("подсказка есть у обоих субхедеров, и своя у каждого (G3)", () => {
    const { pane } = makePane();
    const texts = ["move-text-sub", "move-line-sub"].map(id => {
      const host = drawSubheader(pane, id);
      host.querySelector(".io-help")?.click();
      const tip = host.children.find((n: StubNode) => n.classList.contains("io-tip"));
      assert.ok(tip, id + ": подсказка не открылась");
      return String(tip?.textContent || "");
    });
    assert.ok(texts[0] && texts[1], "у каждого субхедера свой текст");
    assert.notEqual(texts[0], texts[1], "оба субхедера показали одну и ту же подсказку");
  });

  await test("с выключенным Show tips «?» у субхедера нет, подпись остаётся", () => {
    const { pane } = makePane({ general: { help: { showTips: false } } });
    const host = drawSubheader(pane, "move-text-sub");
    assert.equal(host.querySelectorAll(".io-help").length, 0, "«?» осталось");
    assert.ok(String(host.textContent).includes("Move text"), "сама подпись должна остаться");
  });

  /* ---- предпросмотр тегов (10.3, проверка по выводу Г20) -------------- */

  const bubbles = (host: StubNode): StubNode[] => host.querySelectorAll(".io-bubble");

  await test("предпросмотр тегов рисует строку целиком", () => {
    const { pane } = makePane();
    const host = drawBlock(blockOf(pane, "visual", TAG_APPEARANCE_HEADING));
    const text = host.textContent;

    assert.equal(host.querySelectorAll(".io-preview").length, 1, "нет рамки предпросмотра");
    assert.ok(text.includes("Rewrite the settings copy"), "нет текста выдуманной строки");
    assert.ok(text.includes("2026-08-24"), "нет элемента справа");
    assert.ok(text.includes("[[ClientA]]"), "нет ссылки справа");
    /*
     * П9 и П10: предпросмотр обязан сказать, что он не редактор, и говорит это
     * в своём «?» — серой строки над картинкой больше нет (замечание
     * заказчика 1.4.1.1.1). Что фраза никуда не делась, держит проверка по всем
     * пяти предпросмотрам в `preview_fields_tests.ts`; здесь — что она не
     * вернулась в рамку.
     */
    assert.ok(!text.includes("Close to what the editor draws"),
      "старая серая строка вернулась в рамку предпросмотра");
    /* ПЗ2: и что Fields пока примерные */
    assert.ok(text.includes("Example Fields"), "нет пометки о примере");
  });

  await test("Value с подзначением слитно и раздельно (Г20)", () => {
    const separate = makePane({ pkm: { behavior: { childTagFormat: "separate" } } });
    const two = bubbles(drawBlock(blockOf(separate.pane, "visual", TAG_APPEARANCE_HEADING)));
    /* два пузыря Status плюс пустой пузырь Priority */
    assert.equal(two.length, 3, "раздельно должно быть три пузыря: " +
      two.map(b => b.textContent).join(" | "));
    assert.equal(two[0]?.textContent, "#doing");
    assert.equal(two[1]?.textContent, "#review");

    const combined = makePane({ pkm: { behavior: { childTagFormat: "combined" } } });
    const one = bubbles(drawBlock(blockOf(combined.pane, "visual", TAG_APPEARANCE_HEADING)));
    assert.equal(one.length, 2, "слитно должно быть два пузыря");
    assert.equal(one[0]?.textContent, "#doing/review",
      "слитная запись — один пузырь с обоими значениями");
  });

  await test("Value с показом empty остаётся пузырём без текста", () => {
    const { pane } = makePane();
    const list = bubbles(drawBlock(blockOf(pane, "visual", TAG_APPEARANCE_HEADING)));
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
    const host = drawBlock(blockOf(pane, "visual", TAG_APPEARANCE_HEADING));
    const line = host.querySelector(".io-line");
    assert.equal(line?.style.getPropertyValue("--io-opacity-left"), "0.4");
    assert.equal(line?.style.getPropertyValue("--io-text-scale"), "1.2");
    /* 100% «квадратности» — это ноль скругления */
    assert.equal(line?.style.getPropertyValue("--io-corners"), "0");
  });

  await test("Separator в предпросмотре берётся из настройки", () => {
    const { pane } = makePane({ pkm: { lineFormat: { separator1: "//" } } });
    const text = drawBlock(blockOf(pane, "visual", TAG_APPEARANCE_HEADING)).textContent;
    assert.ok(text.includes("//"), "первый Separator должен прийти из настройки: " + text);
  });

  await test("предпросмотр перерисовывается точечно, без пересборки панели (П2)", async () => {
    const { pane, counts } = makeCountingPane();
    const host = makeNode("div");
    const cleanup = blockOf(pane, "visual", TAG_APPEARANCE_HEADING).render({ settingEl: host }, {});
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
    const btn = resetButton(groupOf(pane, "visual", TAG_APPEARANCE_HEADING));
    assert.ok(btn, "кнопка сброса должна быть в заголовке группы");
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
  interface WheelShot {
    chip: string; up: string[]; down: string[];
    cells: string[]; activeColor: string; cellColor: string;
    lit: boolean; litColor: string;
    /* Цвета самой коробки скроллера — не панели: у неё свои настройки. */
    boxFill: string; boxText: string;
  }

  /**
   * Читает снимок с уже отрисованного узла. Отдельно от `wheelShot`, потому
   * что пробуждение блока рисует в **тот же** узел, и снимок надо снять
   * второй раз, ничего не рендеря заново (Пр3).
   */
  function readWheel(host: StubNode): WheelShot {
    const panel = (where: string): string[] => {
      const p = host.querySelectorAll(".io-wheelpanel--" + where)[0];
      return p ? p.children.map((c: StubNode) => c.textContent) : [];
    };
    const active = host.querySelectorAll(".io-wheelcell--active")[0];
    const plain = host.querySelectorAll(".io-wheelcell")
      .filter((c: StubNode) => !c.classList.contains("io-wheelcell--active"));
    const side = host.querySelectorAll(".io-wheelline")[0];
    const varOf = (node: StubNode | undefined, name: string): string =>
      node ? String(node.style.getPropertyValue(name) || "") : "";
    return {
      /*
       * Активная ячейка панели, а не чип Value: до 2026-09-04 предпросмотр
       * рисовал Fields пузырями и цветами панели не управлялся (H2, 10.13.22).
       */
      chip: active ? String(active.textContent || "") : "",
      up: panel("up"),
      down: panel("down"),
      cells: plain.map((c: StubNode) => String(c.textContent || "")),
      activeColor: varOf(active, "--io-wheel-cell-active"),
      cellColor: varOf(plain[0], "--io-wheel-cell"),
      lit: Boolean(side && side.classList.contains("io-wheelline--lit")),
      litColor: varOf(side, "--io-wheel-lit"),
      boxFill: varOf(host.querySelectorAll(".io-wheelpanel")[0], "--io-wheel-bg"),
      boxText: varOf(host.querySelectorAll(".io-wheelpanel")[0], "--io-wheel-fg"),
    };
  }

  function wheelHost(pane: SettingsPane): StubNode {
    const host = makeNode("div");
    blockOf(pane, "visual", "TagWheel").render({ settingEl: host }, {});
    return host;
  }

  function wheelShot(pane: SettingsPane): WheelShot {
    return readWheel(wheelHost(pane));
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
    /* Активная ячейка пишется как в заметке, в квадратных скобках (10.13.22). */
    assert.equal(shot.chip, "[med]", "в середине стоит текущее значение");
    /* вверх идут следующие, и снизу вверх они удаляются от текущего:
       ближайшее к чипу — high, дальше круг заходит на none и low */
    assert.deepEqual(shot.up, ["low", "none", "high"],
      "панель сверху читается сверху вниз, ближайшее значение — у чипа");
    /* вниз идут предыдущие, тоже по кругу */
    assert.deepEqual(shot.down, ["low", "none", "high"],
      "вниз — предыдущие значения, список замкнут");
  });

  /* ---- H2: предпросмотр показывает панель, а не пузыри (10.13.22) ------ */

  await test("панель предпросмотра — текст: активная ячейка в скобках, остальные словами", () => {
    const { pane } = makePane({
      visual: { tagWheel: { showMarkers: false, scroller: { enabled: false } } },
    });
    const shot = wheelShot(pane);
    assert.ok(/^\[.+\]$/.test(shot.chip),
      "активная ячейка написана как в заметке, в квадратных скобках: " + shot.chip);
    assert.ok(shot.cells.length > 0, "и рядом с ней есть неактивные Fields");
    for (const c of shot.cells) {
      assert.ok(!/^\[/.test(c), "в скобках ровно одна ячейка: " + c);
    }
  });

  await test("цвета панели красят её ячейки, а не только коробку скроллера", () => {
    const { pane } = makePane({
      visual: { tagWheel: { textColor: "#322b2a", activeTextColor: "#ff0000" } },
    });
    const shot = wheelShot(pane);
    assert.equal(shot.activeColor, "#ff0000",
      "активный Field красится своим цветом: " + shot.activeColor);
    assert.equal(shot.cellColor, "#322b2a",
      "неактивные — общим цветом текста: " + shot.cellColor);
  });

  await test("Highlight the TagWheel line включает и снимает заливку панели", () => {
    const off = wheelShot(makePane({
      visual: { tagWheel: { highlightLine: false, fillColor: "#f0e17f" } },
    }).pane);
    assert.equal(off.lit, false, "тумблер выключен — заливки нет");

    const on = wheelShot(makePane({
      visual: { tagWheel: { highlightLine: true, fillColor: "#f0e17f" } },
    }).pane);
    assert.equal(on.lit, true, "включён — есть");
    assert.equal(on.litColor, "#f0e17f", "и красит она заданным цветом: " + on.litColor);
  });

  await test("предпросмотр просыпается на цвет активного Field и на подсветку", async () => {
    /*
     * Пр3: этих двух путей в подписке не значилось, и блок на их изменение не
     * просыпался вовсе (У-24). Спрашивается **пробуждение**, а не список
     * путей: без него человек видит прежнюю картинку и решает, что настройка
     * не работает. Снимок снимается с того же узла, в который рисует блок.
     */
    const { store, pane } = makePane({ visual: { tagWheel: {} } });
    const host = wheelHost(pane);
    assert.equal(readWheel(host).activeColor, "", "до правки своего цвета нет");

    await store.set("visual.tagWheel.activeTextColor", "#00ff00");
    assert.equal(readWheel(host).activeColor, "#00ff00",
      "цвет активного Field доехал без перехода по вкладкам");

    assert.equal(readWheel(host).lit, false, "подсветка выключена");
    await store.set("visual.tagWheel.highlightLine", true);
    assert.equal(readWheel(host).lit, true, "и тумблер подсветки тоже будит блок");
  });

  await test("коробка скроллера красится своими цветами, а не цветами панели", () => {
    /*
     * Заказчик: «в io-tip-wheel-preview panel-background меняет цвет и заливки
     * tagwheel и заливки scroller. Заливка scroller должна быть как у
     * scroller-fill» (замечание к H2, 2026-09-04).
     *
     * Спрашиваются обе стороны сразу: цвет панели до коробки не доезжает, а
     * цвет коробки — доезжает. Одного утверждения тут мало: «коробка не
     * красится панелью» было бы верно и у коробки, которая не красится вовсе.
     */
    const shot = wheelShot(makePane({
      visual: { tagWheel: {
        fillColor: "#f0e17f", textColor: "#322b2a",
        scroller: { enabled: true, size: 2, direction: "full", fillColor: "#0000ff", textColor: "#00ff00" },
      } },
    }).pane);
    assert.equal(shot.boxFill, "#0000ff",
      "заливка коробки — из Scroller background color: " + shot.boxFill);
    assert.equal(shot.boxText, "#00ff00",
      "текст в коробке — из Scroller text color: " + shot.boxText);

    /* Цвета панели заданы, цвета коробки — нет: коробка остаётся на теме. */
    const themed = wheelShot(makePane({
      visual: { tagWheel: {
        fillColor: "#f0e17f", textColor: "#322b2a", highlightLine: true,
        scroller: { enabled: true, size: 2, direction: "full" },
      } },
    }).pane);
    assert.equal(themed.boxFill, "",
      "цвет панели не должен доезжать до коробки: " + themed.boxFill);
    assert.equal(themed.boxText, "",
      "и цвет текста панели тоже: " + themed.boxText);
    assert.equal(themed.litColor, "#f0e17f",
      "при этом сама панель своим цветом красится по-прежнему: " + themed.litColor);
  });

  await test("предпросмотр просыпается на цвета коробки скроллера", async () => {
    /* Та же половина дефекта, что у цвета активного Field (У-24): без пути в
       подписке человек меняет цвет и видит прежнюю картинку. */
    const { store, pane } = makePane({
      visual: { tagWheel: { scroller: { enabled: true, size: 2, direction: "full" } } },
    });
    const host = wheelHost(pane);
    assert.equal(readWheel(host).boxFill, "", "до правки цвета коробки нет");
    await store.set("visual.tagWheel.scroller.fillColor", "#0000ff");
    assert.equal(readWheel(host).boxFill, "#0000ff",
      "заливка коробки доехала без перехода по вкладкам");
    await store.set("visual.tagWheel.scroller.textColor", "#00ff00");
    assert.equal(readWheel(host).boxText, "#00ff00",
      "и цвет текста в коробке тоже");
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
    /* Активная ячейка стоит в квадратных скобках, решётка — внутри них. */
    assert.ok(withMarks.chip.startsWith("[#"), "с маркерами значение с решёткой: " + withMarks.chip);
    assert.ok(withMarks.up.every(v => v.startsWith("#")), "и в панели тоже");

    const without = wheelShot(makePane({
      visual: { tagWheel: { showMarkers: false, scroller: { enabled: true, size: 1, direction: "up" } } },
    }).pane);
    assert.ok(!without.chip.startsWith("[#"), "без маркеров — одни слова");
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
    const byStatus = makePane({ visual: { tagBars: { active: true, fieldId: "status", stripesToShow: 3 } } });
    const byPriority = makePane({ visual: { tagBars: { active: true, fieldId: "priority", stripesToShow: 3 } } });

    const a = barsShot(byStatus.store, byStatus.pane);
    const b = barsShot(byPriority.store, byPriority.pane);

    assert.ok(a.lines.length >= 9, "дерево должно быть непустым: " + a.lines.length);
    assert.deepEqual(a.lines, b.lines,
      "требование заказчика: переключение Field не меняет ни одной строки текста");
    assert.notDeepEqual(a.bars, b.bars, "а полосы обязаны стать другими");
  });

  await test("полоса идёт во всю высоту поддерева, дорожки считаются слева (П6)", () => {
    const { store, pane } = makePane({ visual: { tagBars: { active: true, fieldId: "status", stripesToShow: 3 } } });
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
    const deep = makePane({ visual: { tagBars: { active: true, fieldId: "status", stripesToShow: 3 } } });
    const flat = makePane({ visual: { tagBars: { active: true, fieldId: "status", stripesToShow: 1 } } });

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
    const shown = makePane({ visual: { tagBars: { active: true, fieldId: "status", tagVisibility: true } } });
    const hidden = makePane({ visual: { tagBars: { active: true, fieldId: "status", tagVisibility: false } } });

    const a = barsShot(shown.store, shown.pane).lines.join(" | ");
    const b = barsShot(hidden.store, hidden.pane).lines.join(" | ");

    assert.ok(a.includes("#todo"), "с включённым показом тег Status на месте");
    assert.ok(!b.includes("#todo"), "с выключенным он уходит: " + b.slice(0, 120));
    /* а чужой Field при этом не трогается */
    assert.ok(b.includes("#none") || b.includes("#low") || b.includes("#med") || b.includes("#high")
      || b.includes("||"), "тег другого Field и Separator остаются: " + b.slice(0, 120));
  });

  await test("толщина и отступы полос уезжают в переменные", () => {
    const { pane } = makePane({ visual: { tagBars: { active: true, thickness: 7, childOffset: 15, spacing: 22 } } });
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
    const items = groupOf(pane, "keyboard", SELECT_ALL_HEADING)?.items || [];
    const it = items.find((i: Def) => i.name === "Expanded 'Ctrl+A'");
    /* Оба прежних имени: и до PRD, и то, что панель носила до 2026-08-26. */
    assert.deepEqual(it?.aliases, ["Enhanced Mod+A", "Expanded select all"],
      "старые имена должны попасть в aliases");
    const text = String((it?.desc as StubNode | undefined)?.textContent || "");
    assert.ok(!text.includes("Enhanced Mod+A"), "и не должно попасть в видимое описание: " + text);
  });

  await test("единица слайдера уходит в displayFormat (Ст5)", () => {
    const { pane } = makePane();
    const items = groupOf(pane, "keyboard", SELECT_ALL_HEADING)?.items || [];
    const delay = items.find((i: Def) => i.name === "Time between presses");
    /*
     * Пробел между числом и единицей — **неразрывный**: обычный переносился, и
     * на трёхзначном значении знак уезжал под число («символ % переносится на
     * следующую строку», заказчик 2026-09-07). Здесь он выписан кодом знака, а
     * не набран: в исходнике проверки он был бы неотличим от обычного, и
     * возврат правки прошёл бы молча.
     */
    const nbsp = String.fromCharCode(160);
    assert.equal(delay?.control?.displayFormat?.(700), "700" + nbsp + "ms");
    assert.ok(!String(delay?.control?.displayFormat?.(700) || "").includes(String.fromCharCode(32)),
      "обычного пробела в подписи слайдера быть не должно — он и переносится");
  });

  await test("неактивность живёт в контроле, а не в определении", () => {
    const { pane, store } = makePane();
    const items = groupOf(pane, "keyboard", SELECT_ALL_HEADING)?.items || [];
    const steps = items.find((i: Def) => i.name === "Selection steps");
    assert.equal(steps?.disabled, undefined, "у определения контрола disabled нет");
    assert.equal(steps?.control?.disabled?.(), true);
    void store.set("editor.selectAll.enabled", true);
    assert.equal(steps?.control?.disabled?.(), false);
  });

  await test("подсказка уходит из описания, когда Show tips выключен", () => {
    const { pane } = makePane({ general: { help: { showTips: false } } });
    const items = groupOf(pane, "keyboard", SELECT_ALL_HEADING)?.items || [];
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

  await test("строку без имени и без render платформа не рисует (B7)", () => {
    /*
     * Правило платформы, из-за которого «?» у заголовка не работал пять
     * заходов подряд. `app.js`, функция `Z2`, зовётся из `n6` первым же
     * `e.filter(Z2)` — то есть **до** отрисовки:
     *
     *     Z2(def) = !!(def.name || def.render || def.control || def.action)
     *
     * Вводная строка группы была `{ name: "", desc, searchable: false }` —
     * платформа выбрасывала её молча, вместе с вводной фразой и телом
     * подсказки группы, которое ехало в том же `desc`. В типах пакета
     * (`SettingDefinitionBase`) этого правила нет ни словом, поэтому ни одна
     * проверка на определениях его не видела: они смотрели на то, что панель
     * **отдала**, а не на то, что платформа станет рисовать.
     *
     * Здесь правило выписано отдельно от кода панели (У-5) и проверяется на
     * всех вкладках сразу.
     */
    const rendered = (d: Def): boolean => {
      if ("type" in d && d["type"] === "page") return Boolean(d["items"] || d["page"]);
      return Boolean(d["name"] || d["render"] || d["control"] || d["action"]);
    };

    const { pane } = makePane({ "general.help.showTips": true });
    let rows = 0;
    const lost: string[] = [];
    for (const tab of TABS) {
      pane.setActiveTab(tab.id as never);
      for (const def of allDefs(pane)) {
        const where = String(def["cls"] || def["heading"] || tab.id);
        for (const it of ((def["items"] || []) as Def[])) {
          rows++;
          if (!rendered(it)) lost.push(where + " → «" + String(it["name"] ?? "") + "»");
        }
        if (!Array.isArray(def["items"]) && !rendered(def)) lost.push(where);
      }
    }
    assert.ok(rows > 100, "строк для проверки набралось мало: " + rows);
    assert.deepEqual(lost, [],
      "платформа не станет рисовать эти строки: " + lost.slice(0, 6).join("; "));
  });

  await test("«?» в заголовке группы создаёт и снимает подсказку (B7)", () => {
    /*
     * Заказчик написал про этот знак пять заходов подряд. Гейт Г20 при этом
     * был зелёный: сначала потому, что подделка кнопки выбрасывала обработчик
     * (У-43), а потом потому, что проверял тело подсказки **в определениях**,
     * а до окна оно не доезжало вовсе (см. проверку выше).
     *
     * Поэтому здесь ничего не берётся из определений, кроме самой кнопки:
     * дерево собирается такое же, какое строит платформа (`Xb` в `app.js`:
     * группа, внутри неё отдельная строка заголовка с колонкой контролов, и
     * список строк рядом), обработчик СОХРАНЯЕТСЯ и зовётся.
     */
    const { pane } = makePane({ "general.help.showTips": true });
    pane.setActiveTab("general" as never);

    const group = allDefs(pane).find((g: Def) =>
      String(g["cls"] || "").startsWith("io-group-")
      && Array.isArray(g["extraButtons"]) && g["extraButtons"].length);
    assert.ok(group, "нашлась группа со знаком в заголовке");
    const id = String(group["cls"]).slice("io-group-".length);
    const tip = String(SCHEMA.find(g => g.id === id)?.tip || "");
    assert.ok(tip, "у группы " + id + " есть подсказка в схеме");

    /* Дерево платформы: группа, строка заголовка с колонкой контролов, список. */
    const box = makeNode("div");
    box.className = String(group["cls"]);
    const heading = box.createDiv({ cls: "setting-item setting-item-heading" });
    heading.createDiv({ cls: "setting-item-name" });
    const control = heading.createDiv({ cls: "setting-item-control" });
    box.createDiv({ cls: "setting-items" });
    /*
     * Кнопка ищется по тому, что она делает, а не по месту в массиве (У-5):
     * с 2026-09-04 первой в `extraButtons` идёт точка опоры коллаута, и
     * опора на индекс покраснела бы ровно от этого. У каждой кнопки свой
     * узел и свой компонент — иначе обработчики трёх кнопок сложились бы в
     * один.
     */
    let handler: (() => void) | null = null;
    let node: StubNode | null = null;
    for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
      const own = control.createDiv({ cls: "clickable-icon" });
      let cb: (() => void) | null = null;
      const stub: Def = {
        extraSettingsEl: own,
        setIcon() { return stub; },
        setTooltip() { return stub; },
        setDisabled() { return stub; },
        /* Обработчик СОХРАНЯЕТСЯ — в этом вся разница с прежним гейтом. */
        onClick(fn: () => void) { cb = fn; return stub; },
      };
      make(stub);
      if (own.classList.contains("io-help--group")) { node = own; handler = cb; }
    }
    assert.ok(node, "знака «?» в заголовке нет ни на одной кнопке");
    assert.equal(typeof handler, "function", "кнопка заголовка завела обработчик нажатия");

    const bodies = (): StubNode[] => box.querySelectorAll(".io-grouptip");
    assert.equal(bodies().length, 0, "до нажатия подсказки нет");

    (handler as unknown as () => void)();
    const open = bodies();
    assert.equal(open.length, 1, "нажатие создало тело подсказки");
    const body = open[0] as StubNode;
    /* Место: сразу за строкой заголовка, то есть между ним и списком строк. */
    assert.equal(box.children.indexOf(body), box.children.indexOf(heading) + 1,
      "тело встало сразу за строкой заголовка");
    assert.ok(body.querySelectorAll(".io-tip__body").length, "в теле есть текст подсказки");
    assert.equal(node?.getAttribute("aria-expanded"), "true", "и знак говорит об этом вслух");

    (handler as unknown as () => void)();
    assert.equal(bodies().length, 0, "повторное нажатие снимает подсказку");
    assert.equal(node?.getAttribute("aria-expanded"), "false", "знак закрылся");
  });

  /**
   * Дерево платформы вокруг группы: строка заголовка с колонкой контролов и
   * карточка со строками. Собирается один раз на все проверки коллаута —
   * второе такое дерево разошлось бы с первым (У-32).
   */
  const platformGroup = (cls: string): { box: StubNode; heading: StubNode; control: StubNode } => {
    const box = makeNode("div");
    box.className = cls;
    const heading = box.createDiv({ cls: "setting-item setting-item-heading" });
    heading.createDiv({ cls: "setting-item-name" });
    const control = heading.createDiv({ cls: "setting-item-control" });
    box.createDiv({ cls: "setting-items" });
    return { box, heading, control };
  };

  await test("вводная фраза группы едет коллаутом до карточки настроек", () => {
    /*
     * Заказчик 2026-09-04: «для каждого хедера ты сделал текст, объясняющий
     * суть этого блока настроек, но это сделано не красиво, как plain text
     * сверху над настройками. Я хочу, чтобы ты сделал этот текст в виде
     * коллаута… Эти коллауты должны размещаться под хедерами настроек и до
     * самих настроек (т.е. до серого поля)».
     *
     * Проверяется **место**, а не наличие: строка заголовка у платформы стоит
     * вне карточки, и коллаут обязан встать между ними. Проверять «коллаут
     * нарисован» было бы верно и для коллаута внутри серого поля — то есть
     * ровно для того, на что заказчик и пожаловался.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help");
    assert.ok(group, "группа Help нашлась");
    const intro = String(SCHEMA.find(g => g.id === "help")?.intro || "");
    assert.ok(intro, "у группы Help есть вводная фраза в схеме");

    /* Вводной строки внутри карточки быть не должно: она ушла. */
    for (const row of (group["items"] || []) as Def[]) {
      assert.notEqual(row["name"], "", "внутри карточки осталась безымянная вводная строка");
    }

    const { box, heading, control } = platformGroup(String(group["cls"]));
    const node = control.createDiv({ cls: "clickable-icon" });
    const stub: Def = {
      extraSettingsEl: node,
      setIcon() { return stub; },
      setTooltip() { return stub; },
      setDisabled() { return stub; },
      onClick() { return stub; },
    };
    const makers = group["extraButtons"] as Array<(b: unknown) => unknown>;
    for (const make of makers) make(stub);

    const drawn = box.querySelectorAll(".io-callout--group");
    assert.equal(drawn.length, 1, "коллаут группы нарисован один раз");
    assert.equal(box.children.indexOf(drawn[0] as StubNode), box.children.indexOf(heading) + 1,
      "коллаут встал между заголовком и карточкой настроек");
    /* Текст сверяется с тем, что в схеме, без разметки `<code>` и `<b>`. */
    const plain = intro.replace(/<\/?(code|b)>/g, "");
    assert.equal((drawn[0] as StubNode).textContent, plain,
      "нарисовано то же, что в схеме: " + (drawn[0] as StubNode).textContent);
    /* Узел слота скрыт: коллаут не кнопка, нажимать нечего. */
    assert.ok(node.classList.contains("io-calloutslot"),
      "слот коллаута не помечен своим классом — кнопка осталась бы видимой");
  });

  await test("знак сворачивания стоит до названия и прячет группу (2026-09-04)", () => {
    /*
     * Заказчик: «приходится много скролить. Сделай каждый хедер сворачиваемым…
     * Кнопка сворачивания должна быть в строке хедера до названия. Визуально
     * кнопка должна различаться для свернутого и развернутого положения».
     *
     * Проверяется **нажатие и место**, а не наличие узла: подделка кнопки,
     * выбрасывающая обработчик, доказывает размещение и молчит про то, что
     * кнопка делает (У-43). Здесь знак — свой узел заглушки, и нажатие
     * настоящее.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const { box, heading, control } = platformGroup(String(group["cls"]));
    const name = heading.children[0] as StubNode;

    for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
      const node = control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; }, onClick() { return stub; },
      };
      make(stub);
    }

    const marks = heading.querySelectorAll(".io-fold");
    assert.equal(marks.length, 1, "знак сворачивания нарисован один раз");
    const mark = marks[0] as StubNode;
    assert.equal(heading.children.indexOf(mark), 0,
      "знак должен стоять первым в строке заголовка, до названия");
    assert.ok(heading.children.indexOf(name) > 0, "а название — после него");

    /* Развёрнутое положение: группа видна, знак смотрит вниз. */
    assert.equal(mark.textContent, "\u25BE", "развёрнутая группа помечена знаком вниз");
    assert.equal(mark.getAttribute("aria-expanded"), "true");
    assert.equal(box.classList.contains("io-group--shut"), false, "группа не свёрнута");

    mark.click();
    assert.equal(box.classList.contains("io-group--shut"), true,
      "нажатие должно свернуть группу");
    assert.equal(mark.textContent, "\u25B8", "и знак меняется на свёрнутый");
    assert.ok(mark.classList.contains("io-fold--shut"),
      "свёрнутое положение отличается не только знаком, но и пометкой");
    assert.equal(mark.getAttribute("aria-expanded"), "false");
    assert.equal(pane.isFolded("help"), true, "панель запомнила, что группа свёрнута");

    mark.click();
    assert.equal(box.classList.contains("io-group--shut"), false, "второе нажатие разворачивает");
    assert.equal(pane.isFolded("help"), false, "и панель это тоже запомнила");
  });

  await test("свёрнутое состояние переживает пересборку определений", () => {
    /*
     * Ровно то, о чём просил заказчик: «хочу, чтобы запоминалось состояние
     * хедеров… чтобы при повторном открытии настроек они были в том виде, в
     * котором их оставил пользователь». Окно закрывается и открывается —
     * панель собирает определения заново, и знак обязан прийти свёрнутым.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const drawFold = (): { box: StubNode; mark: StubNode } => {
      const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
      const { box, control } = platformGroup(String(group["cls"]));
      for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
        const node = control.createDiv({ cls: "clickable-icon" });
        const stub: Def = {
          extraSettingsEl: node,
          setIcon() { return stub; }, setTooltip() { return stub; },
          setDisabled() { return stub; }, onClick() { return stub; },
        };
        make(stub);
      }
      const mark = box.querySelectorAll(".io-fold")[0] as StubNode;
      return { box, mark };
    };

    drawFold().mark.click();
    assert.equal(pane.isFolded("help"), true, "свернули");

    /* Панель собрала определения заново — то же, что открыть окно снова. */
    const again = drawFold();
    assert.equal(again.mark.textContent, "\u25B8",
      "знак пришёл развёрнутым, хотя группу оставляли свёрнутой");
    assert.equal(again.box.classList.contains("io-group--shut"), true,
      "и сама группа должна прийти свёрнутой");
  });

  await test("ни одно правило стилей не ищет класс, которого никто не ставит", () => {
    /*
     * Заказчик дважды написал, что таблица `Color your Tags` серая. Первая
     * правка была верной по смыслу и **мёртвой по имени**: она красила
     * `.io-usertags`, а такого класса в панели нет — он живёт в прототипе,
     * где блок собран иначе. Панель ставит `io-usertagsblock` и рисует
     * таблицу `io-vals--tags`. Ни один гейт этого не видел: правило было
     * синтаксически безупречным и просто ни к чему не относилось; целый его
     * блок пережил так две сессии.
     *
     * Проверяется **пересечение**: каждый класс `io-*`, по которому
     * `styles.css` кого-то разыскивает, обязан встречаться в исходниках —
     * в слое настроек, в `main.js` или в движке навигации. Спрашивать «есть
     * ли правило» было бы мало: мёртвое правило тоже есть.
     *
     * Модификатор засчитывается по основе (`io-x--y` живёт, если жив
     * `io-x`): такие имена собираются склейкой строк и целиком в исходниках
     * не встречаются.
     *
     * Сверяются **наборы имён**, а не вхождение подстроки, и это выяснила
     * мутация: `io-usertags` — начало живого `io-usertagsblock`, и поиск
     * подстрокой считал мёртвый класс живым. Проверка молчала ровно на том
     * случае, ради которого заведена.
     */
    const read = (rel: string): string => fs.readFileSync(path.join(repoRoot, rel), "utf8");
    const css = read("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");

    const sources: string[] = [read("main.js"), read("navigation_runtime.js")];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
        const rel = dir + "/" + entry.name;
        if (entry.isDirectory()) walk(rel);
        else if (/\.(ts|js)$/.test(entry.name)) sources.push(read(rel));
      }
    };
    walk("src");
    const blob = sources.join("\n");

    const names = new Set<string>();
    for (const m of css.matchAll(/\.(io-[A-Za-z0-9_-]+)/g)) names.add(String(m[1]));
    assert.ok(names.size > 100, "классов в стилях подозрительно мало: " + names.size);

    const used = new Set<string>();
    for (const m of blob.matchAll(/(io-[A-Za-z0-9_-]+)/g)) used.add(String(m[1]));

    const dead = Array.from(names).filter(n => {
      if (used.has(n)) return false;
      const stem = String(n.split("--")[0] || "");
      return !(stem && stem !== n && (used.has(stem) || used.has(stem + "--")));
    }).sort();

    assert.deepEqual(dead, [],
      "эти правила разыскивают классы, которых никто не ставит — они не красят "
      + "ничего:\n  " + dead.join("\n  "));
  });

  await test("подсказка не раскрывается в узел, который стили прячут", () => {
    /*
     * Шесть подсказок редактора Fields не открывались вовсе, и разобрать это
     * можно было только глазами: узел создавался, текст в него писался, а
     * класс, который на него ставили, — `io-tipslot` — в `styles.css` значит
     * «спрятать» (`display: none !important`). Класс с таким именем там уже
     * жил и прятал **кнопку платформы** у заголовка группы; редактор Fields
     * взял то же имя под другое дело. Заказчик написал: «в таблице fields не
     * работают tips» (A44, 2026-09-07).
     *
     * Проверка идёт **на симптом**, а не на имя (У-96): собираются все классы,
     * которые слой настроек ставит на узел-хозяин подсказки, и все классы,
     * которые стили прячут. Пересечение обязано быть пустым — как бы ни звали
     * следующий такой класс.
     */
    const read = (rel: string): string => fs.readFileSync(path.join(repoRoot, rel), "utf8");
    const sources: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
        const rel = dir + "/" + entry.name;
        if (entry.isDirectory()) walk(rel);
        else if (/\.(ts|js)$/.test(entry.name)) sources.push(read(rel));
      }
    };
    walk("src/ui/settings");
    const blob = sources.join("\n");

    /* Хозяин подсказки, названный литералом прямо на месте вызова. */
    const hosts = new Set<string>();
    for (const m of blob.matchAll(/host:\s*el\([^,]+,\s*"[a-z]+",\s*"(io-[A-Za-z0-9_-]+)"\)/g)) {
      hosts.add(String(m[1]));
    }
    assert.ok(hosts.size > 0,
      "ни одного узла-хозяина подсказки не найдено — проверка ищет пустоту");

    /* Классы, которым стили говорят «тебя не видно». */
    const css = read("styles.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const hidden = new Set<string>();
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/display:\s*none/.test(String(m[2] || ""))) continue;
      for (const sel of String(m[1] || "").split(",")) {
        for (const cls of sel.match(/\.(io-[A-Za-z0-9_-]+)/g) || []) hidden.add(cls.slice(1));
      }
    }
    assert.ok(hidden.has("io-tipslot"),
      "положительный контроль: прячущий класс в стилях есть, значит ищется предмет");

    const clash = Array.from(hosts).filter(h => hidden.has(h)).sort();
    assert.deepEqual(clash, [],
      "подсказка раскрывается в узел, который стили прячут, — она не появится "
      + "на экране ни разу:\n  " + clash.join("\n  "));
  });

  await test("объявленный отступ коллаута и правда выигрывает у соседа по классу", () => {
    /*
     * Правило было живым, класс — настоящим, и всё равно оно ничего не
     * делало. Узел несёт **два** класса, `io-callout io-callout--group`, и
     * ниже по файлу `.io-callout` задаёт `margin: 0 0 2px`. Специфичность у
     * них была одинаковая, и побеждало то, что стоит позже. Правка 2026-09-05
     * ужала отступ заголовка и объявила «двенадцать и двенадцать», а на
     * экране было «двадцать два и две»: заказчик увидел ровно это — «нет,
     * визуально стоит там же где и раньше».
     *
     * Пин из-за этого спрашивает не «есть ли правило», а **кто побеждает**:
     * берётся набор классов, который панель и правда ставит на узел, и по
     * нему разбирается каскад `styles.css`. Мёртвое правило тоже есть, а
     * побеждает всегда одно.
     */
    const css = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    type Rule = { selector: string; prop: string; value: string; order: number; spec: number };
    const rules: Rule[] = [];
    let order = 0;
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const body = String(m[2] || "");
      for (const selector of String(m[1] || "").split(",")) {
        const sel = selector.trim();
        if (!sel || sel.startsWith("@")) continue;
        order += 1;
        /*
         * Специфичность считается по всему селектору, а совпадение — только
         * по его **последнему** сочетанию: предки в разборе не участвуют,
         * поэтому правило, которое до узла может и не дотянуться, считается
         * дотянувшимся. Это в нужную сторону: пин скорее покраснеет зря, чем
         * промолчит о победителе.
         */
        const spec = (sel.match(/\.[A-Za-z0-9_-]+|\[[^\]]*\]|:[a-z-]+/g) || []).length;
        for (const decl of body.split(";")) {
          const at = decl.indexOf(":");
          if (at < 0) continue;
          const prop = decl.slice(0, at).trim();
          const value = decl.slice(at + 1).trim();
          if (!prop || !value) continue;
          rules.push({ selector: sel, prop, value, order, spec });
          /* Сокращённая запись объявляет и стороны: `margin` задаёт и низ. */
          if (prop === "margin") {
            rules.push({ selector: sel, prop: "margin-bottom", value, order, spec });
          }
        }
      }
    }
    assert.ok(rules.length > 500, "правил в стилях подозрительно мало: " + rules.length);

    /** Кто победит на узле с этими классами. Предки считаются подходящими. */
    const winner = (classes: readonly string[], prop: string): Rule | null => {
      const own = new Set(classes);
      let best: Rule | null = null;
      for (const r of rules) {
        if (r.prop !== prop) continue;
        const subject = String(r.selector.split(/[\s>+~]+/).pop() || "");
        const asked = subject.match(/\.[A-Za-z0-9_-]+/g) || [];
        if (!asked.length) continue;
        if (!asked.every(c => own.has(c.slice(1)))) continue;
        /* Хвост сочетания, который разобрать нечем, — не наш случай. */
        if (/::|:hover|:focus|:not\(/.test(subject)) continue;
        if (!best || r.spec > best.spec || (r.spec === best.spec && r.order > best.order)) best = r;
      }
      return best;
    };

    /*
     * Узел коллаута группы: `host.createDiv({ cls: "io-callout io-callout--group" })`
     * в `settings_tab.ts`. Отступ снизу обязан прийти от правила, отобранного
     * по группе, — оно и держит «двенадцать снизу».
     */
    const bottom = winner(["io-callout", "io-callout--group"], "margin-bottom");
    assert.ok(bottom, "у коллаута группы никто не задаёт отступ снизу");
    assert.ok(bottom.selector.includes("io-group--callout"),
      "отступ снизу у коллаута группы выигрывает не то правило, которое его "
      + "задаёт: победил `" + bottom.selector + " { " + bottom.prop + ": "
      + bottom.value + " }`");

    /* И отступ сверху — у строки заголовка такой же группы. */
    const top = winner(["setting-item", "setting-item-heading"], "margin-bottom");
    assert.ok(top && top.selector.includes("io-group--callout"),
      "отступ под заголовком группы с коллаутом задаёт не наше правило: "
      + (top ? top.selector : "никто"));

    /*
     * Тот же счёт — панели TagWheel, и там он бы сработал: заказчик написал
     * про неё в четвёртый раз, и причина была ровно эта.
     *
     * Разметку строки он прислал из DevTools, и в ней видно то, чего не было
     * видно ни на одном скриншоте: **тег внутри панели и подсветка — это один
     * узел**, `<span class="cm-hashtag cm-hashtag-end cm-highlight cm-meta
     * cm-tag-todo">`; вставка кода тоже — `<span class="cm-highlight
     * cm-inline-code">`. Правило «погасить фон тега» стояло ниже правила
     * «покрасить подсветку», специфичность одинаковая — и тег с плейсхолдером
     * оставались белыми посреди залитой панели.
     *
     * Классы взяты из присланной разметки дословно.
     */
    const inPanel = ["cm-line", "io-twline", "cm-active", "cm-highlight"];
    for (const extra of [
      ["cm-hashtag", "cm-hashtag-end", "cm-meta", "cm-tag-todo"],
      ["cm-inline-code"],
      ["cm-hmd-barelink", "cm-link", "cm-strong"],
      [],
    ]) {
      const bg = winner(inPanel.concat(extra), "background-color");
      const what = extra.length ? extra[0] : "подсветка и пробелы между ячейками";
      assert.ok(bg && String(bg.value).includes("--io-twfill"),
        "внутри панели TagWheel `" + what + "` красится не заливкой панели: "
        + (bg
          ? "победил `" + bg.selector + " { background-color: " + bg.value + " }`"
          : "не красит никто"));
    }

    /*
     * **Шапки таблиц: приглушённый акцент, текст обычного цвета** (В-85,
     * вариант 2, решение заказчика 2026-09-08).
     *
     * Впи́сано сюда, а не проверено поиском по файлу, ровно по правилу У-67:
     * «завели правило, решающее вид, — впишите его набор». Мёртвое правило в
     * файле тоже бывает, а побеждает всегда одно, и вид решает победитель.
     *
     * Ходов до этого места было два — серым по серому (до 2026-09-07) и
     * сплошным акцентом (после), — и оба заказчик забраковал глазами. Третий
     * закреплён здесь: заливка обязана быть **прозрачной долей** акцента, а
     * не самим акцентом, а текст — обычным, а не текстом-на-акценте.
     */
    for (const head of ["io-vals__head", "io-tablehead", "io-cmd__head", "io-fields__colhead"]) {
      const fill = winner([head], "background");
      assert.ok(fill, "шапку `" + head + "` не красит никто");
      assert.ok(/color-mix\(/.test(String(fill.value)) && /--interactive-accent/.test(String(fill.value)),
        "заливка шапки `" + head + "` не приглушённый акцент: победил `"
        + fill.selector + " { background: " + fill.value + " }`");
      assert.ok(/transparent/.test(String(fill.value)),
        "заливка шапки `" + head + "` подмешана к фону, а не прозрачна: на карточке "
        + "`--background-primary-alt` это даст пятно другого оттенка — `" + fill.value + "`");

      const ink = winner([head], "color");
      assert.ok(ink && String(ink.value).includes("--text-normal"),
        "текст шапки `" + head + "` не обычного цвета: победил `"
        + (ink ? ink.selector + " { color: " + ink.value + " }" : "никто") + "`");
    }

    /*
     * И знак «?» на этой шапке: он больше не переворачивается. Пока заливка
     * была сплошной, нажатый знак красился текстом-на-акценте на фоне
     * текста-на-акценте — и правило про это стояло рядом. Оно снято, а не
     * переписано: общее правило нажатого знака делает то же самое, и второе
     * его объявление разошлось бы с первым молча (У-32).
     */
    const markInk = winner(["io-help"], "color");
    assert.ok(markInk, "у знака «?» никто не задаёт цвет");
    const pressed = rules.filter(r => r.selector.includes("aria-expanded")
      && /io-vals__head|io-tablehead|io-cmd__head|io-fields__colhead/.test(r.selector));
    assert.deepEqual(pressed.map(r => r.selector + " { " + r.prop + " }"), [],
      "у нажатого «?» на шапке снова своё правило — оно повторяет общее (У-32)");
  });

  await test("список Fields стоит вплотную к своей строке", () => {
    /*
     * «Черты нет, но есть много пустого места между source-fields-head и
     * списком Fields — сделай, чтобы список шёл сразу после
     * source-fields-head» (заказчик 2026-09-05).
     *
     * Пустоту давала не черта, а поля строк: платформа кладёт каждой строке
     * настройки по двадцать точек сверху и снизу, и между двумя строками их
     * складывалось сорок. Правило снимает обе половины и отбирает строку по
     * пометке `data-io-item`, то есть **по id блока из схемы**. Переименуют
     * id — правило перестанет кого-либо находить и промолчит об этом: ровно
     * так уже прожил два захода мёртвый блок правил по прототипным именам
     * (У-65).
     */
    const css = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const ids = new Set<string>();
    for (const g of SCHEMA) for (const it of g.items) if (it.id) ids.add(String(it.id));

    for (const m of css.matchAll(/data-io-item="([^"]+)"/g)) {
      assert.ok(ids.has(String(m[1])),
        "правило отбирает строку по id `" + String(m[1]) + "`, а такого блока "
        + "в схеме нет — правило не найдёт никого");
    }
    assert.ok(/data-io-item="source-fields"\]\s*\{[^}]*padding-top:\s*0/.test(css),
      "у списка Fields вернулось верхнее поле — между ним и его строкой снова пусто");
    assert.ok(/:has\(\+ \.setting-item\[data-io-item="source-fields"\]\)\s*\{[^}]*padding-bottom:\s*0/.test(css),
      "у строки над списком Fields вернулось нижнее поле — половина пустоты осталась");
  });

  await test("цвет панели TagWheel есть кому прочитать", () => {
    /*
     * Цвет заливки панели приезжает на строку переменной `--io-twfill`
     * (`src/core/editor_visuals_config.js`, разбор панели на отрезки; до
     * 2026-09-07 это лежало в `main.js`). Сама по себе она не красит ничего:
     * красит правило в `styles.css`, которое ею перекрашивает подсветку
     * `==…==` самой Obsidian — единственный сплошной слой на этой строке.
     *
     * Вопрос к любому такому шву один и тот же: **кто подаёт сюда значение и
     * кто его читает** (У-56). Три захода по одному замечанию заказчика
     * прошли через две мёртвые связки: сперва красили поверх чужого
     * полупрозрачного слоя, потом гасили его и остались вовсе без сплошного —
     * «пустоты стали белого цвета» (`12.png`).
     */
    const css = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8");
    const engine = fs.readFileSync(
      path.join(repoRoot, "src", "core", "editor_visuals_config.js"), "utf8");

    assert.ok(engine.includes("--io-twfill: "),
      "строка панели больше не несёт цвет заливки — красить будет нечем");
    assert.ok(/io-twline[^{}]*cm-highlight/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")),
      "правило, красящее подсветку Obsidian цветом панели, пропало");
    assert.ok(/io-twline[^{}]*cm-formatting-highlight/.test(css.replace(/\/\*[\s\S]*?\*\//g, "")),
      "метки `==` перестали краситься вместе с панелью");
    assert.ok(css.includes("var(--io-twfill"),
      "цвет со строки никто не читает: переменная объявлена и не нужна");

    /*
     * И обратная сторона: своя коробка у тега и у вставки кода внутри панели
     * снимается. Покрасить их мало — у тега `--tag-padding-y` и свой кегль, у
     * вставки кода `padding: .15em .3em` и моноширинный шрифт, и именно они
     * делали заливку разной высоты («по прежнему различается высота
     * элементов»). Правило одно на всё, поэтому и спрашивается по нему.
     */
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const panelRule = /io-twline span\.cm-inline-code \{([^}]*)\}/.exec(bare);
    assert.ok(panelRule, "правило вида панели пропало целиком");
    for (const decl of ["padding: 0", "font-size: inherit", "border: none", "border-radius: 0"]) {
      assert.ok(String(panelRule[1]).includes(decl),
        "из правила панели пропало `" + decl + "` — вернётся разная высота заливки");
    }
  });

  await test("Show callouts убирает и возвращает коллаут, не пересобирая группу", async () => {
    /*
     * Заказчик написал об этом дважды. Сначала: «обновление экрана происходит
     * только при перещелкивании вкладок… должно быть онлайн». Тумблер после
     * этого стали добавлять в `definitionsChanged` — и заказчик написал во
     * второй раз: «нет, по прежнему требуется перещелкивать вкладки».
     *
     * **Пересборка тут не помогает и не могла помочь.** Платформа
     * **переиспользует** группу, если совпали её тип и заголовок (`$2` и `t6`
     * в `app.js`), а `extraButtons` зовёт только у созданной заново. Коллаут
     * приезжает как раз оттуда. Прежний пин спрашивал, попросила ли панель
     * пересборку, — и был зелёным всё это время, потому что панель её и
     * правда просила (У-58, У-69).
     *
     * Поэтому здесь спрашивается **что стало с экраном**: `extraButtons`
     * зовутся ровно один раз, как у платформы, и после этого тумблер обязан
     * убрать коллаут и вернуть его сам.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const { box, control } = platformGroup(String(group["cls"]));
    for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
      const node = control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; }, onClick() { return stub; },
      };
      make(stub);
    }
    assert.equal(box.querySelectorAll(".io-callout--group").length, 1,
      "коллаут не нарисован — дальше проверять нечего");

    await pane.setControlValue("general.help.showCallouts", false);
    assert.equal(box.querySelectorAll(".io-callout--group").length, 0,
      "коллаут остался на экране: тумблер снова действует только после "
      + "перехода по вкладкам");
    assert.equal(box.classList.contains("io-group--callout"), false,
      "пометка выравнивания осталась у группы, у которой коллаута больше нет");

    await pane.setControlValue("general.help.showCallouts", true);
    assert.equal(box.querySelectorAll(".io-callout--group").length, 1,
      "обратно тумблер коллаут не вернул");
    assert.ok(box.classList.contains("io-group--callout"),
      "и пометка выравнивания обязана вернуться вместе с ним");

    /*
     * И та же дорога с другого конца: окно открыли, когда коллауты **уже**
     * выключены. Тогда рисовать нечего — но слот всё равно обязан завестись,
     * иначе включить их на лету будет некуда. Без этого проверка выше
     * оставалась бы зелёной: она начинает с включённого тумблера.
     */
    const off = makePane({ general: { help: { showCallouts: false } } });
    off.pane.setActiveTab("general" as never);
    const offGroup = allDefs(off.pane)
      .find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const offBox = platformGroup(String(offGroup["cls"]));
    for (const make of (offGroup["extraButtons"] || []) as Array<(b: unknown) => unknown>) {
      const node = offBox.control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; }, onClick() { return stub; },
      };
      make(stub);
    }
    assert.equal(offBox.box.querySelectorAll(".io-callout--group").length, 0,
      "с выключенным тумблером коллаут нарисовался");

    await off.pane.setControlValue("general.help.showCallouts", true);
    assert.equal(offBox.box.querySelectorAll(".io-callout--group").length, 1,
      "включить коллауты в уже открытом окне не вышло: слота у группы нет");
  });

  await test("Show tips убирает и возвращает «?» у заголовка группы без пересборки", async () => {
    /*
     * Найдено разбором 2026-09-05, заказчиком не названо, починено по его
     * слову тем же заходом (A30). Корень тот же, что у коллаутов: «?»
     * приезжает из `extraButtons`, а платформа зовёт их только у группы,
     * созданной заново (У-69). Пересборка определений знак не убирала — он
     * исчезал после перехода по вкладкам.
     *
     * Спрашивается узел, а не определение: узел платформа отдала один раз, и
     * второй раз его никто не создаст.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const { box, control } = platformGroup(String(group["cls"]));
    for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
      const node = control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; }, onClick() { return stub; },
      };
      make(stub);
    }
    const mark = (): StubNode | undefined => box.querySelectorAll(".io-help--group")[0] as StubNode;
    assert.ok(mark(), "знак «?» не нарисован — дальше проверять нечего");
    assert.equal(mark()?.textContent, "?", "знак должен быть вопросительным");

    await pane.setControlValue("general.help.showTips", false);
    assert.equal(box.querySelectorAll(".io-help--group").length, 0,
      "знак «?» остался: тумблер действует только после перехода по вкладкам");
    assert.equal(box.querySelectorAll(".io-tipslot").length, 1,
      "узел кнопки обязан остаться на месте и спрятаться: второй раз платформа "
      + "его не создаст");

    await pane.setControlValue("general.help.showTips", true);
    assert.ok(mark(), "обратно тумблер знак не вернул");
    assert.equal(mark()?.textContent, "?", "вернулся не знак вопроса");

    /*
     * И с другого конца: окно открыли, когда подсказки **уже** выключены.
     * Слот всё равно обязан завестись — платформа второй раз узел не создаст,
     * и включать знак было бы негде. Без этой половины проверка выше
     * оставалась бы зелёной: она начинает с включённого тумблера.
     */
    const off = makePane({ general: { help: { showTips: false } } });
    off.pane.setActiveTab("general" as never);
    const offGroup = allDefs(off.pane)
      .find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const offBox = platformGroup(String(offGroup["cls"]));
    for (const make of (offGroup["extraButtons"] || []) as Array<(b: unknown) => unknown>) {
      const node = offBox.control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; }, onClick() { return stub; },
      };
      make(stub);
    }
    assert.equal(offBox.box.querySelectorAll(".io-help--group").length, 0,
      "с выключенными подсказками знак нарисовался");

    await off.pane.setControlValue("general.help.showTips", true);
    assert.equal(offBox.box.querySelectorAll(".io-help--group").length, 1,
      "включить подсказки в уже открытом окне не вышло: слота у группы нет");
  });

  await test("подпись id читается в момент открытия подсказки", async () => {
    /*
     * Тот же счёт к `Show option IDs`: тумблер человек щёлкает при открытом
     * окне, а `extraButtons` к тому времени отработали. Значение, взятое при
     * сборке определений, устарело бы молча (У-69).
     */
    const { pane } = makePane({ advanced: { showSettingIds: false } });
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const { box, control } = platformGroup(String(group["cls"]));
    let press: (() => void) | null = null;
    for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
      const node = control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; },
        onClick(cb: () => void) { if (node.classList.contains("io-help--group")) press = cb; return stub; },
      };
      make(stub);
    }
    assert.ok(press, "«?» у группы не завёл обработчик нажатия");

    (press as unknown as () => void)();
    assert.equal(box.querySelectorAll(".io-tip__id").length, 0,
      "подпись id пришла при выключенном тумблере");
    (press as unknown as () => void)();

    await pane.setControlValue("advanced.showSettingIds", true);
    (press as unknown as () => void)();
    assert.equal(box.querySelectorAll(".io-tip__id").length, 1,
      "подпись id не появилась: значение взято при сборке определений и "
      + "устарело");
  });

  await test("обычное значение пересборки не требует", async () => {
    /* Пересборка заменяет узел контрола, и перетаскивание слайдера
       обрывается: слайдер её просить не должен. */
    const { pane, counts } = makeCountingPane();
    const before = counts.rebuild;
    await pane.setControlValue("visual.tags.bubbleWidthPct", 110);
    assert.equal(counts.rebuild, before,
      "обычное значение пересборки требовать не должно");
  });

  await test("группа с коллаутом помечена своим классом (выравнивание)", () => {
    /*
     * По этой пометке стили ужимают отступ заголовка снизу, и коллаут встаёт
     * посередине между заголовком и карточкой — «под хедером много пустого
     * места, затем коллаут, сразу после которого идут настройки» (2026-09-05).
     * Пометки нет — отступы разъезжаются, и заметно это только глазами.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const { box, control } = platformGroup(String(group["cls"]));
    for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
      const node = control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; }, onClick() { return stub; },
      };
      make(stub);
    }
    assert.ok(box.classList.contains("io-group--callout"),
      "узел группы не помечен: отступ заголовка снизу останется платформенным");
  });

  await test("повторная отрисовка не множит коллауты группы", () => {
    /*
     * Платформа зовёт функции `extraButtons` на каждой сборке определений, а
     * строку заголовка может и переиспользовать. Без снятия прежнего коллаут
     * добавлялся бы по одному на отрисовку — и заметил бы это заказчик, а не
     * проверка.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const { box, control } = platformGroup(String(group["cls"]));
    const makers = group["extraButtons"] as Array<(b: unknown) => unknown>;
    for (let pass = 0; pass < 3; pass++) {
      const node = control.createDiv({ cls: "clickable-icon" });
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; }, setTooltip() { return stub; },
        setDisabled() { return stub; }, onClick() { return stub; },
      };
      for (const make of makers) make(stub);
    }
    assert.equal(box.querySelectorAll(".io-callout--group").length, 1,
      "после трёх отрисовок коллаут должен остаться один");
  });

  await test("Show callouts выключен — коллаута группы нет, настройки остались", () => {
    const { pane } = makePane({ general: { help: { showCallouts: false } } });
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-help") as Def;
    const { box, control } = platformGroup(String(group["cls"]));
    const node = control.createDiv({ cls: "clickable-icon" });
    const stub: Def = {
      extraSettingsEl: node,
      setIcon() { return stub; }, setTooltip() { return stub; },
      setDisabled() { return stub; }, onClick() { return stub; },
    };
    for (const make of (group["extraButtons"] || []) as Array<(b: unknown) => unknown>) make(stub);
    assert.equal(box.querySelectorAll(".io-callout--group").length, 0, "коллаут остался");
    assert.ok(((group["items"] || []) as Def[]).some(it => it["control"]),
      "настройки группы при этом на месте");

    /* И вводная группа вкладки закрыта тем же тумблером: заказчик просил
       «при off все коллауты должны быть скрыты, это относится и к главным
       коллаутам, которые сверху в каждой вкладке». */
    const intros = allDefs(pane).filter((g: Def) => /-intro$/.test(String(g["cls"] || "")));
    for (const g of intros) {
      assert.equal((g["visible"] as () => boolean)(), false,
        "вводная группа вкладки осталась видимой: " + String(g["cls"]));
    }
  });

  await test("сброс группы помечен своим классом и уезжает вправо (B7)", () => {
    /*
     * «?» и сброс платформа кладёт в одну колонку контролов, поэтому правило
     * CSS, придвинувшее «?» к тексту заголовка, придвинуло и сброс —
     * заказчик написал «сдвинь reset group обратно вправо». Развести их
     * может только пометка на узле кнопки; здесь проверяется, что она есть.
     */
    const { pane } = makePane();
    pane.setActiveTab("general" as never);
    const group = allDefs(pane).find((g: Def) =>
      String(g["cls"] || "").startsWith("io-group-")
      && Array.isArray(g["extraButtons"]) && g["extraButtons"].length > 1);
    assert.ok(group, "нашлась группа, у которой в заголовке две кнопки");

    const nodes: StubNode[] = [];
    for (const make of (group["extraButtons"] as Array<(b: unknown) => unknown>)) {
      const node = makeNode("div");
      const stub: Def = {
        extraSettingsEl: node,
        setIcon() { return stub; },
        setTooltip() { return stub; },
        setDisabled() { return stub; },
        onClick() { return stub; },
      };
      make(stub);
      nodes.push(node);
    }
    const marked = nodes.filter(n => n.classList.contains("io-groupreset"));
    assert.equal(marked.length, 1, "пометка стоит ровно на кнопке сброса");
    assert.ok(!marked[0]?.classList.contains("io-help--group"),
      "и это не знак вопроса");
  });

  await test("перевёрнутый слайдер: человек видит одно, конфиг хранит другое", async () => {
    /*
     * Заказчик попросил, чтобы `Opacity of transformed line` росла вправо
     * (2026-09-02). В конфиге по этому пути лежит **доля оставшейся яркости**
     * — так её читает движок, — и менять смысл записанного нельзя (З1), а
     * починить это миграцией негде: третья ступень идёт на каждом патче и
     * «уже перевёрнуто» от «ещё нет» не отличит.
     *
     * Поэтому переворот живёт на шве с платформой. Здесь закреплён круговой
     * обход: показали одно — в конфиге другое, и обратно.
     */
    const PATH = "transform.inline2note.sourceProcessing.visual.opacity";
    const store = new MemoryStore({});
    const pane = new SettingsPane({
      schema: SCHEMA, tabs: TABS, store, actions: {}, fragments: fragments as never,
    });

    /* Умолчание в схеме — записанное; платформе оно уходит перевёрнутым. */
    assert.equal(pane.getControlValue(PATH), 35, "65 в конфиге — это 35 на слайдере");

    await pane.setControlValue(PATH, 80);
    assert.equal(store.get(PATH), 20, "показали 80 — в конфиг ушло 20");
    assert.equal(pane.getControlValue(PATH), 80, "и обратно читается 80");

    /* Соседний слайдер без переворота не задет. */
    await pane.setControlValue("visual.tags.opacityLeft", 55);
    assert.equal(store.get("visual.tags.opacityLeft"), 55,
      "обычный слайдер пишет то, что показал");
  });

  await test("прокручиваемый предок находится сквозь скрытый overflow (10.13.13)", () => {
    /*
     * Полоса вкладок приклеена `position: sticky`, а он держится на том, что
     * между полосой и прокруткой нет предка с `overflow`, отличным от
     * `visible`. Заказчик написал, что полоса не приклеена (2026-09-02), и
     * проверить это в живом окне из репозитория нечем: DOM Obsidian
     * недостижим, библиотеки DOM в проекте нет.
     *
     * Поэтому полоса переезжает первым ребёнком самой прокрутки, а машиной
     * закрепляется то, что можно: **прокрутка находится** — в том числе через
     * узел со скрытым переполнением, который и был подозреваемым. Сам вид
     * по-прежнему смотрится глазами.
     */
    const scroller = makeNode("div");
    scroller.style.setProperty("overflow-y", "auto");
    const hidden = scroller.createDiv({ cls: "wrap" });
    hidden.style.setProperty("overflow", "hidden");
    const row = hidden.createDiv({ cls: "setting-item" });

    assert.equal(findScrollHost(row as never), scroller as never,
      "прокрутка найдена сквозь узел со скрытым переполнением");
    assert.equal(findScrollHost(scroller as never), null,
      "выше прокрутки искать нечего");

    /* Узел без прокрутки над собой не выдумывает её. */
    const lonely = makeNode("div").createDiv({});
    assert.equal(findScrollHost(lonely as never), null, "без прокрутки ответ пустой");
  });

  await test("полоса вкладок переживает пересборку страницы (10.13.13)", () => {
    /*
     * Заказчик написал трижды, что полоса уезжает при прокрутке. Проверить
     * приклеивание в живом окне из репозитория нечем — DOM Obsidian
     * недостижим, — но **причина** проверяется целиком, потому что она не в
     * CSS.
     *
     * Платформа возвращает узел строки на место дважды за отрисовку
     * (`app.js` 1.13.7): `i6` заканчивает группу вызовом
     * `listEl.setChildrenInPlace(<узлы своих строк>)`, а `e6` заканчивает
     * страницу вызовом `containerEl.setChildrenInPlace(<узлы групп>)`. Здесь
     * оба вызова воспроизведены — и полоса обязана остаться на месте.
     *
     * Прежнее решение (переезд строки первым ребёнком прокрутки) этой
     * проверки не переживает, и это её главное свойство: она и есть мутация.
     */
    const outer = makeNode("div");
    outer.style.setProperty("overflow", "hidden");
    const scroll = outer.createDiv({ cls: "vertical-tab-content" });
    scroll.style.setProperty("overflow-y", "auto");
    const groupEl = scroll.createDiv({ cls: "setting-group io-group-strip" });
    const listEl = groupEl.createDiv({ cls: "setting-items" });
    const rowEl = listEl.createDiv({ cls: "setting-item" });

    const picked: string[] = [];
    const strip = tabStripRow({
      tabs: TABS.map(t => ({ id: String(t.id), label: t.label })),
      active: String(TABS[0]?.id || ""),
      pick: (id: string) => { picked.push(id); },
    });
    strip.render({ settingEl: rowEl as never });

    const barOf = (): StubNode | null => outer.querySelector(".io-tabsbar");
    assert.ok(barOf(), "полоса нарисована своим узлом рядом с прокруткой");
    assert.equal(outer.children.indexOf(barOf() as StubNode), 0,
      "и стоит первой, над прокруткой");
    assert.ok(rowEl.classList.contains("io-tabsrow--parked"),
      "своя строка осталась пустой и помеченной как скрытая");
    assert.equal(rowEl.children.length, 0, "в строке ничего не нарисовано");
    assert.ok(outer.classList.contains("io-tabshost")
      && scroll.classList.contains("io-tabsscroll"),
      "родитель прокрутки стал колонкой, прокрутка забирает остаток");

    /* Так платформа заканчивает группу и страницу. */
    listEl.setChildrenInPlace([rowEl]);
    scroll.setChildrenInPlace([groupEl]);

    assert.ok(barOf(), "полоса на месте и после пересборки страницы");
    assert.equal(rowEl.parentElement, listEl, "строка вернулась в список группы, как и должна");

    /* Вторая отрисовка не удваивает полосу. */
    strip.render({ settingEl: rowEl as never });
    assert.equal(outer.querySelectorAll(".io-tabsbar").length, 1,
      "полоса одна, прежний экземпляр снят");

    /* Кнопки живые: выбор вкладки доходит до панели. */
    const buttons = outer.querySelectorAll(".io-tab");
    assert.equal(buttons.length, TABS.length, "кнопок столько же, сколько вкладок");
    (buttons[1] as StubNode).click();
    assert.deepEqual(picked, [String(TABS[1]?.id)], "нажатие выбрало вкладку");
  });

  await test("без прокрутки полоса рисуется в своей строке", () => {
    /*
     * Обратная проверка: незнакомая разметка не должна оставлять человека без
     * вкладок вовсе. Гейт Г16 рисует блоки именно так — на голом узле.
     */
    const row = makeNode("div");
    const strip = tabStripRow({
      tabs: TABS.map(t => ({ id: String(t.id), label: t.label })),
      active: String(TABS[0]?.id || ""),
      pick: () => {},
    });
    strip.render({ settingEl: row as never });
    assert.equal(row.querySelectorAll(".io-tab").length, TABS.length,
      "вкладки нарисованы в самой строке");
    assert.ok(!row.classList.contains("io-tabsrow--parked"), "и строка не скрыта");
  });

  await test("внутри описания строки нет ни одного обработчика (C9)", () => {
    /*
     * Прежнее утверждение здесь было обратным: подсказка обязана съедать
     * нажатие, потому что у строки с действием платформа делает кликабельной
     * всю строку, и нажатие на «?» исполняло действие (C9, 2026-09-02).
     *
     * Утверждение перевёрнуто, и вот почему. Платформа описание **клонирует**:
     * `s.setDesc(d.desc ? sg(d.desc) : "")`, где
     * `sg(e) = "string" == typeof e ? e : e.cloneNode(!0)` (`app.js` 1.13.7).
     * `cloneNode` обработчиков не переносит — значит в живом окне того
     * слушателя не было **никогда**, и проверка была зелёной ни о чём: она
     * звала обработчик на узле, который до окна не доезжает.
     *
     * Перехватывать при этом больше нечего: строк с действием у панели нет
     * (по тому же замечанию C9 все пять стали строками с настоящими
     * кнопками), и здесь это проверяется вторым утверждением.
     *
     * Правило, которое отсюда следует: **внутри `desc` не бывает
     * обработчиков.** Всё, что отвечает на нажатие, живёт там, где узел
     * принадлежит нам, — как тело подсказки группы (B7).
     */
    const { pane } = makePane();
    const tips: string[] = [];
    const withHandler: string[] = [];
    const actionRows: string[] = [];

    for (const tab of TABS) {
      pane.setActiveTab(tab.id as never);
      for (const group of allDefs(pane)) {
        for (const row of (group.items || []) as Def[]) {
          const name = String(row.name || "");
          if (row["action"]) actionRows.push(name || "без имени");
          const desc = row.desc as unknown as StubNode | string | undefined;
          if (!desc || typeof desc === "string") continue;
          const nodes = [desc, ...desc.querySelectorAll("*")] as StubNode[];
          for (const node of nodes) {
            const kinds = Object.keys(node.listeners || {})
              .filter(k => (node.listeners[k] || []).length);
            if (kinds.length) withHandler.push(name + " → " + kinds.join(","));
          }
          for (const tip of desc.querySelectorAll(".io-tip")) {
            void tip;
            tips.push(name);
          }
        }
      }
    }

    assert.ok(tips.length >= 5,
      "подсказок в описаниях строк должно быть не меньше пяти: " + tips.length);
    assert.deepEqual(withHandler, [],
      "платформа клонирует описание, и обработчик внутри него мёртв: " + withHandler.slice(0, 5).join("; "));
    assert.deepEqual(actionRows, [],
      "строк-действий быть не должно, их заменили строки с кнопками (C9): " + actionRows.join(", "));
  });

  await test("вкладка выключенного модуля показывает калитку (C7)", async () => {
    /*
     * Прототип держит калитку с самого начала: выключенный модуль оставляет на
     * вкладке свой тумблер и строку о том, что остальное скрыто. В панели этого
     * не было **ни одной строкой** — поле `module` у вкладки не читалось нигде,
     * сверено поиском по всему `src/ui`. Заказчик: «при выключении модуля в
     * General при переключении на соответствующий модуль он выглядит только
     * что» (C7, 2026-09-02).
     *
     * Ожидание выписано отдельно от того, из чего калитка строится (У-5):
     * здесь названы заголовок вкладки, ключ тумблера и текст.
     */
    let rebuilds = 0;
    const { pane } = makePane({}, { rebuild: () => { rebuilds++; } });

    pane.setActiveTab("visual" as never);
    const live = allDefs(pane);
    assert.ok(live.length > 1, "включённый модуль показывает свои группы: " + live.length);

    await pane.setControlValue("features.visual.enabled", false);
    assert.ok(rebuilds > 0, "тумблер модуля открытой вкладки обязан попросить пересборку");

    const gated = allDefs(pane);
    assert.equal(gated.length, 1, "выключенный модуль оставляет одну группу: " + gated.length);
    const gate = gated[0] as Def;
    assert.equal(gate.heading, "Visual", "заголовок калитки — имя вкладки");

    const rows = (gate.items || []) as Def[];
    assert.equal(rows.length, 2, "в калитке две строки: тумблер и объяснение");
    assert.equal(rows[0]?.control?.key, "features.visual.enabled",
      "первая строка — тот самый тумблер модуля");
    assert.ok(String(rows[1]?.desc || "").includes("This module is off"),
      "вторая строка объясняет, почему вкладка пуста: " + String(rows[1]?.desc));

    /* Обратно: включили — вкладка вернулась, и без перехода по вкладкам. */
    await pane.setControlValue("features.visual.enabled", true);
    assert.ok(allDefs(pane).length > 1, "включённый модуль снова показывает свои группы");
  });

  await test("калитка не запирает вкладку без выхода", () => {
    /*
     * У вкладок General, Keyboard и Advanced модуля нет: выключать нечего, и
     * калитка на них не появляется ни при каком значении конфига.
     */
    const { pane } = makePane();
    for (const tab of ["general", "keyboard", "advanced"]) {
      pane.setActiveTab(tab as never);
      const defs = allDefs(pane);
      assert.ok(defs.length > 1, tab + ": вкладка без модуля рисуется целиком");
      assert.ok(!defs.some((d: Def) => String(d.cls || "") === "io-group-module-off"),
        tab + ": калитки на вкладке без модуля быть не может");
    }
  });

  await test("вводная фраза не занимает строку внутри карточки", () => {
    /*
     * Фраза жила строкой внутри карточки, и это решало одну задачу (строку
     * с одним `desc` платформа отбрасывает до отрисовки, `app.js`, `Z2`) и
     * создавало другую: текст стоял на сером поле, вместе с настройками.
     * С 2026-09-04 он едет коллаутом до карточки, а первой строкой группы
     * снова стоит настоящая настройка.
     */
    const { pane } = makePane();
    const modules = groupOf(pane, "general", "Modules");
    const first = modules?.items?.[0] as Def;
    assert.ok(String(first?.["name"] || ""), "первой строкой группы стоит настройка с именем");
    assert.ok(first?.["control"], "и у неё есть контрол");
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
    const group = groupOf(pane, "general", "Modules");
    const buttons = group?.extraButtons;
    /* Четыре записи: точки опоры знака сворачивания и коллаута, «?» подсказки
       группы и сброс. Все четыре — функции; кнопок платформы видно две,
       остальные два узла скрыты, а знак сворачивания рисуется своим. */
    assert.ok(Array.isArray(buttons) && buttons.length === 4, "четыре записи в заголовке");
    for (const make of buttons) {
      assert.equal(typeof make, "function", "элемент extraButtons обязан быть функцией");
    }

    const btn = resetButton(group);
    assert.ok(btn, "сброс среди них есть");
    assert.ok((btn.calls as string[]).includes("onClick"));

    const help = tipButton(group);
    assert.ok(help, "«?» среди них есть");
    assert.equal((help.node as { textContent: string }).textContent, "?",
      "и на его узле стоит знак вопроса");
  });

  await test("место кнопки сброса занято всегда, гаснет она сама (Н1, Н2)", async () => {
    /*
     * Раньше кнопка появлялась и исчезала — и этим меняла определение группы
     * на первом же шаге слайдера: платформа пересобирала страницу, заменяла
     * узел слайдера, и перетаскивание обрывалось.
     */
    const { pane } = makePane();
    const mount = () => {
      const btn = resetButton(groupOf(pane, "general", "Modules"));
      assert.ok(btn, "кнопка сброса должна быть в заголовке всегда");
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

  await test("id группы виден в её подсказке", async () => {
    /*
     * Id группы человеку нужен там же, где id настройки: последней строкой
     * открытой подсказки (A3, C52). До 2026-09-02 он дописывался к вводной
     * строке — той самой, которую платформа не рисует, — то есть не был виден
     * никогда. Теперь он в теле, которое создаёт «?».
     */
    const { pane } = makePane();
    const openTip = (): StubNode | null => {
      pane.setActiveTab("advanced" as never);
      const group = allDefs(pane).find((g: Def) => String(g["cls"] || "") === "io-group-diagnostics");
      assert.ok(group, "группа Diagnostics нашлась");
      const box = makeNode("div");
      box.className = String(group["cls"]);
      const heading = box.createDiv({ cls: "setting-item setting-item-heading" });
      const control = heading.createDiv({ cls: "setting-item-control" });
      box.createDiv({ cls: "setting-items" });
      /* Знак ищется по своей пометке, а не по месту в массиве (У-5): первой
         записью в `extraButtons` с 2026-09-04 идёт точка опоры коллаута. */
      let handler: (() => void) | null = null;
      for (const make of group["extraButtons"] as Array<(b: unknown) => unknown>) {
        const node = control.createDiv({ cls: "clickable-icon" });
        let cb: (() => void) | null = null;
        const stub: Def = {
          extraSettingsEl: node,
          setIcon() { return stub; },
          setTooltip() { return stub; },
          setDisabled() { return stub; },
          onClick(fn: () => void) { cb = fn; return stub; },
        };
        make(stub);
        if (node.classList.contains("io-help--group")) handler = cb;
      }
      assert.equal(typeof handler, "function", "знак завёл обработчик");
      (handler as unknown as () => void)();
      return box.querySelector(".io-grouptip");
    };

    const before = openTip();
    assert.ok(before, "подсказка открылась");
    assert.equal(before?.querySelectorAll(".io-tip__id").length, 0, "до тумблера id группы нет");

    await pane.setControlValue("advanced.showSettingIds", true);
    const after = openTip();
    const line = after?.querySelector(".io-tip__id");
    assert.ok(line, "с тумблером в подсказке появилась строка с id");
    assert.equal(line?.textContent, "diagnostics", "и это id группы: " + String(line?.textContent));
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

  /*
   * Субхедеры внутри группы `Move left and move right` (замечание заказчика
   * 2026-09-04). Проверяется не наличие двух своих блоков в схеме, а то, что
   * **нарисуется** на экране и **где**: подпись без контрола платформа не
   * рисует вовсе (У-44), а порядок берётся из списка определений, а не из
   * места в массиве схемы (У-5).
   */
  await test("группу Move left and move right делят субхедеры Move text и Move line", () => {
    const { pane } = makePane();
    const group = groupOf(pane, "navigation", "Move left and move right") as Def;
    assert.ok(group, "группы Move left and move right на вкладке нет");
    const items = group.items as Def[];

    /*
     * Подпись ищется по тому, над чем она стоит, а не по месту в массиве
     * схемы (У-5): требование заказчика ровно такое — над переносом текста
     * одна подпись, над работой со строкой другая.
     */
    const rowAbove = (name: string): Def => {
      const at = items.findIndex((d: Def) => d.name === name);
      assert.ok(at > 0, "в группе нет строки «" + name + "» или она первая");
      return items[at - 1] as Def;
    };

    const textSub = rowAbove("Move selected text");
    const lineSub = rowAbove("Cycle line Prefixes");
    assert.equal(typeof textSub.render, "function",
      "над переносом выделенного текста стоит не свой блок, а строка настройки");
    assert.equal(typeof lineSub.render, "function",
      "над цикличностью Prefix стоит не свой блок, а строка настройки");
    assert.equal(textSub.searchable, false, "субхедер не должен попадать в поиск");
    assert.equal(textSub.control, undefined, "у субхедера нет контрола");
    assert.equal(textSub.name, "", "у своего блока имени нет");

    /* Сам текст подписи лежит своим узлом: рядом с ним в строке стоит «?»
       (G3), и `textContent` всей строки несёт теперь и его. */
    const labelOf = (row: Def): string =>
      String(drawBlock(row).querySelector(".io-sub__text")?.textContent || "");
    assert.equal(labelOf(textSub), "Move text",
      "первая подпись должна назваться словами заказчика");
    /* Переименована 2026-09-04 по заказу H3: `Move line` стало
       `Moving lines (left and right)` — парно группе `Moving lines (up and
       down)`. `Move text` заказчик оставил как есть. */
    assert.equal(labelOf(lineSub), "Moving lines (left and right)",
      "вторая подпись должна назваться словами заказчика");

    /* Ниже второй подписи — только работа со строкой: шаг переноса текста
       остался выше неё, а смена отступа ушла под неё. */
    const idx = (name: string): number => items.findIndex((d: Def) => d.name === name);
    const lineSubAt = items.indexOf(lineSub);
    assert.ok(idx("Movement step") < lineSubAt,
      "шаг переноса текста относится к Move text, а не к Move line");
    assert.ok(idx("Change the indent") > lineSubAt,
      "смена отступа — тоже работа со строкой, и живёт под Move line");
  });

  /* Переименование группы переходов по заголовкам (замечание заказчика
     2026-09-04): её имя парно `Moving cursor inside a line`. */
  await test("группа переходов по заголовкам называется Moving cursor inside a note", () => {
    const { pane } = makePane();
    assert.ok(groupOf(pane, "navigation", "Moving cursor inside a note"),
      "группы с новым именем на вкладке нет");
    assert.equal(groupOf(pane, "navigation", "Jumping between headings"), undefined,
      "прежнее имя группы остаться не должно");
  });

  /*
   * Окна панели: заголовки с подсказками и текст, который читается
   * (замечания заказчика 2026-09-06 к окну после восстановления и к окну
   * состава копии).
   *
   * Пин по исходнику, и это здесь единственный доступный способ: разметку
   * окон рисует `obsidian_tab.ts`, а он единственный файл слоя, который
   * знает про модуль `obsidian`, — на заглушке его не поднять. Поэтому
   * проверяется не поведение, а **шов**: чем нарисован заголовок, откуда он
   * берёт тумблер подсказок и что про размер сказано в стилях.
   */
  await test("у окон панели есть заголовки с подсказками, и текст в них не мельче читаемого", () => {
    const tab = fs.readFileSync(path.join(repoRoot, "src/ui/settings/obsidian_tab.ts"), "utf8");
    const css = fs.readFileSync(path.join(repoRoot, "styles.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    /*
     * `io-item__desc` — размер и цвет описания строки настройки. В строке он
     * верен: описание читается вторым, после имени. В окне читать нечего,
     * кроме него, и решение о нажатии принимается по нему же — «текст
     * слишком мелкий».
     */
    assert.ok(!/io-item__desc/.test(tab),
      "окно снова берёт размер описания строки настройки — это и был «слишком мелкий» текст");

    /* Три заголовка окна состава, у каждого своя подсказка со своим id. */
    for (const id of ["backup-save-tip", "backup-parts-tip", "backup-hotkeys-tip"]) {
      assert.ok(tab.indexOf('id: "' + id + '"') >= 0,
        "у окна состава копии нет заголовка с подсказкой " + id);
    }
    /* Заголовков ровно три, и каждый слушает тумблер, а не решает сам. */
    assert.equal((tab.match(/dlgHead\(box, \{/g) || []).length, 3,
      "заголовков с подсказкой в окне состава не три");
    assert.equal((tab.match(/showTips: o\.showTips,/g) || []).length, 3,
      "подсказка окна решает про тумблер `Show tips` сама");
    /* Помощник тот же, что у подсказок панели: второго правила быть не должно. */
    assert.ok(/tipBelow\(\{/.test(tab),
      "подсказка окна рисуется не тем помощником, что подсказка панели");

    const body = /\.io-dlg__body\s*\{([^}]*)\}/.exec(css);
    assert.ok(body && /font-size:\s*var\(--font-ui-small\)/.test(String(body[1])),
      "у текста окна нет своего размера: " + (body ? String(body[1]) : "правила нет вовсе"));
    const note = /\.io-dlg__note\s*\{([^}]*)\}/.exec(css);
    assert.ok(note && /font-weight:\s*var\(--font-semibold\)/.test(String(note[1])),
      "строка «что делать дальше» не полужирная: " + (note ? String(note[1]) : "правила нет вовсе"));
  });

  console.log("\n" + ran + " проверок пройдено");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
