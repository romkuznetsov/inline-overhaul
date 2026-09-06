/**
 * Поведение редактора Fields в интерфейсе, снятое ДО переноса (PRD фаза 3b,
 * пункт 1). Второй файл пары: состояние закреплено в
 * `order_deep_editor_state_tests.js`, здесь — то, что живёт в рендерере и
 * состоянием не описывается: диалог конфликта несохранённого черновика и
 * удаление Field.
 *
 * Смысл тот же: перенос обязан пройти эти проверки без единой правки, иначе
 * это не перенос, а переписывание (Ф12–Ф16).
 *
 * Рендерер получает всё через `ctx`, поэтому его можно позвать на заглушке
 * DOM с поддельным плагином — Obsidian для этого не нужен. Подделки здесь
 * намеренно тонкие: чем меньше в них логики, тем честнее пин.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { Modal, Notice, Setting, setupGlobals, modalsOpened, notices } from "../harness/obsidian_stub.ts";

const require_ = createRequire(import.meta.url);
setupGlobals();

/* Подделки описывают чужие формы, которых у нас нет типами: конфиг плагина,
   контекст рендерера, компоненты Obsidian. Отдельное имя для этого честнее,
   чем any в двадцати местах. */
type Any = ReturnType<typeof JSON.parse>;

const renderer = require_("../../src/ui/settings/custom/fields_editor_legacy.js");

let ran = 0;
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  ran++;
  try {
    await fn();
    console.log("  ok   " + name);
  } catch (e) {
    console.log("  FAIL " + name);
    throw e;
  }
}

/* ---- подделки ---------------------------------------------------------- */

/**
 * Нормализация Order: тонкая замена той, что живёт в `main.js`. Пин здесь про
 * логику удаления, а не про нормализацию, поэтому подделка только доводит
 * форму до полной — как это делает настоящая.
 */
function normalizePkmOrder(raw: Any): Any {
  const o = raw && typeof raw === "object" ? raw : {};
  const map = (x: Any) => (x && typeof x === "object" ? { ...x } : {});
  return {
    left: Array.isArray(o.left) ? o.left.slice() : [],
    right: Array.isArray(o.right) ? o.right.slice() : [],
    lead: map(o.lead),
    labels: map(o.labels),
    strictNames: map(o.strictNames),
    types: map(o.types),
    active: map(o.active),
    freeRoam: map(o.freeRoam),
    enabled: map(o.enabled),
    propertiesByField: map(o.propertiesByField),
  };
}

/** Конфиг с двумя Fields: `status` с подполем слева и `project` справа. */
function makeConfig(): Any {
  return {
    ui: { pkmSubTab: "main", orderShowDeepEditor: true, orderShowInfoTips: false },
    pkm: {
      taxonomy: {},
      lineFormat: { separator1: "||", separator2: "||" },
      fields: {
        order: {
          left: ["status", "status_sub"],
          right: ["project"],
          lead: { left: "status", right: "project" },
          labels: { status: "Status", status_sub: "Status sub", project: "Project" },
          strictNames: { status: "status" },
          types: { status: "tag", status_sub: "tag", project: "wikilink" },
          active: { status: "yes", status_sub: "yes", project: "yes" },
          freeRoam: { status: "off", status_sub: "off", project: "off" },
          enabled: { status: true, status_sub: true, project: true },
        },
        tags: {
          fields: [
            { id: "status", orderKey: "status", values: [{ token: "#todo" }] },
            { id: "status_sub", orderKey: "status_sub", values: [{ token: "#early", allowedParentValues: ["#todo"] }] },
          ],
        },
        links: {
          fields: [{ id: "project", orderKey: "project", source: "projects", values: [{ token: "[[A]]" }] }],
        },
        elements: { fields: ["status"], byField: { status: { emoji: "x" } } },
      },
    },
    visual: {
      tags: { byTag: {}, byField: {} },
    },
  };
}

interface Patch { patch: Any; reason: string }

/** Плагин в объёме, который нужен рендереру: конфиг, запись, приложение. */
function makePlugin(cfg: Any) {
  const patches: Patch[] = [];
  const merge = (dst: Any, src: Any): void => {
    for (const key of Object.keys(src || {})) {
      const v = src[key];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!dst[key] || typeof dst[key] !== "object") dst[key] = {};
        merge(dst[key], v);
      } else {
        dst[key] = v;
      }
    }
  };
  const plugin: Any = {
    app: { workspace: {}, vault: {} },
    patches,
    applied: 0,
    getConfig: () => cfg,
    setConfigPatch(patch: Any, reason: string) {
      patches.push({ patch, reason });
      /* Настоящий ConfigStore сливает патч в конфиг: без этого повторное
         чтение внутри одного обработчика видит старое состояние. */
      merge(cfg, patch);
    },
    async applyTagWheelConfigNote() { plugin.applied++; },
    async openTagWheelConfigNote() { return "config.md"; },
    saveSettings() {},
  };
  return plugin;
}

/** Контекст доски Order. */
function boardCtx(host: StubNode, cfg: Any, plugin: Any): Any {
  return {
    Setting,
    Notice,
    Modal,
    containerEl: host,
    cfg,
    enabled: true,
    plugin,
    normalizePkmOrder,
    /* В плагине это пустой список известных заранее ключей (main.js:1804):
       Fields целиком приходят из конфига. */
    pkmOrderFields: [] as string[],
    setIcon: () => {},
  };
}

/** Контекст секций конфиг-заметки: там живёт кнопка Apply и диалог конфликта. */
function configCtx(host: StubNode, cfg: Any, plugin: Any): Any {
  return {
    ...boardCtx(host, cfg, plugin),
    tagwheelConfigModeDetailed: "detailed",
    tagwheelConfigModeMinimal: "minimal",
    pkmBackends: { internalV2: "internal-v2" },
    getActiveTagWheelRulesPath: () => "rules.md",
    refreshSettings: () => {},
  };
}

/** Узел по свойству ariaLabel: именно так помечена кнопка удаления. */
function byAria(root: StubNode, label: string): Any {
  const found: Any[] = [];
  const walk = (n: StubNode): void => {
    if ((n as Any).ariaLabel === label) found.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return found[0] || null;
}

/** Кнопка диалога по надписи. */
function byText(root: StubNode, text: string): Any {
  return root.querySelectorAll("BUTTON").find(b => b.textContent === text) || null;
}

/** Открытый диалог: заглушка Modal рисует в свой contentEl. */
function lastModalContent(): StubNode | null {
  return openedModals.length ? openedModals[openedModals.length - 1] as StubNode : null;
}

/* Заглушка Modal не отдаёт наружу свой contentEl, поэтому запоминаем его на
   открытии: тесту нужно нажимать кнопки в диалоге. */
const openedModals: StubNode[] = [];
const openOriginal = Modal.prototype.open;
Modal.prototype.open = function patchedOpen(this: Any) {
  openOriginal.call(this);
  openedModals.push(this.contentEl);
};

async function settle(): Promise<void> {
  /* Обработчики в рендерере асинхронные: диалог возвращает обещание, за ним
     идут записи в конфиг. Двух оборотов очереди хватает. */
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(r => setTimeout(r, 0));
}

/* ---- удаление Field ---------------------------------------------------- */

async function main(): Promise<void> {
  await test("доска Order строится на заглушке", () => {
    const cfg = makeConfig();
    const host = makeNode("div");
    renderer.renderPkmOrderBoardSection(boardCtx(host, cfg, makePlugin(cfg)));
    assert.ok(host.children.length, "доска ничего не нарисовала");
    assert.ok(byAria(host, "delete status"), "нет кнопки удаления Field");
  });

  await test("отказ в диалоге удаления не меняет конфиг", async () => {
    const cfg = makeConfig();
    const plugin = makePlugin(cfg);
    const host = makeNode("div");
    renderer.renderPkmOrderBoardSection(boardCtx(host, cfg, plugin));
    openedModals.length = 0;

    void byAria(host, "delete status").onclick();
    const dialog = lastModalContent();
    assert.ok(dialog, "диалог подтверждения не открылся");
    assert.ok(dialog.textContent.includes("Delete field"), "диалог не про удаление: " + dialog.textContent);
    assert.ok(dialog.textContent.includes("'status'"), "в вопросе должно быть имя Field");

    byText(dialog, "Cancel").onclick();
    await settle();
    assert.equal(plugin.patches.length, 0, "после отказа не должно быть ни одной записи");
    assert.deepEqual(cfg.pkm.fields.order.left, ["status", "status_sub"], "Order остался как был");
  });

  await test("подтверждение удаляет Field вместе с подполем", async () => {
    const cfg = makeConfig();
    const plugin = makePlugin(cfg);
    const host = makeNode("div");
    renderer.renderPkmOrderBoardSection(boardCtx(host, cfg, plugin));
    openedModals.length = 0;

    void byAria(host, "delete status").onclick();
    byText(lastModalContent() as StubNode, "Delete").onclick();
    await settle();

    const orderPatch = plugin.patches.find((p: Patch) => p.reason.startsWith("pkm:behavior:order:delete:"));
    assert.ok(orderPatch, "нет записи Order: " + plugin.patches.map((p: Patch) => p.reason).join(", "));
    const order = orderPatch.patch.pkm.fields.order;

    assert.deepEqual(order.left, [], "из левой стороны уходит и Field, и его подполе");
    assert.deepEqual(order.right, ["project"], "чужая сторона не трогается");
    assert.equal(order.lead.left, "", "ведущий Field очищается, если удалили его");
    assert.equal(order.lead.right, "project", "ведущий на другой стороне остаётся");

    /* Удалённые ключи уходят надгробием null, иначе слияние патча вернёт их. */
    for (const map of ["labels", "types", "active", "freeRoam", "enabled", "strictNames"]) {
      assert.equal(order[map].status, null, map + ": удалённый ключ должен уйти надгробием");
      if (map !== "strictNames") {
        assert.equal(order[map].status_sub, null, map + ": подполе тоже");
      }
    }
    assert.equal(order.labels.project, "Project", "чужие ключи остаются значениями");
  });

  await test("подтверждение убирает Field и из описаний, и из элементов", async () => {
    const cfg = makeConfig();
    const plugin = makePlugin(cfg);
    const host = makeNode("div");
    renderer.renderPkmOrderBoardSection(boardCtx(host, cfg, plugin));
    openedModals.length = 0;

    void byAria(host, "delete status").onclick();
    byText(lastModalContent() as StubNode, "Delete").onclick();
    await settle();

    const fieldsPatch = plugin.patches.find((p: Patch) => p.reason.startsWith("pkm:behavior:delete-field:"));
    assert.ok(fieldsPatch, "нет записи описаний Field");
    const behavior = fieldsPatch.patch.pkm.fields;

    assert.deepEqual(behavior.tags.fields, [], "описания Field и подполя уходят");
    assert.equal(behavior.links.fields.length, 1, "правая сторона не трогается");
    assert.deepEqual(behavior.elements.fields, [], "из списка элементов ключ уходит");
    assert.ok(!Object.prototype.hasOwnProperty.call(behavior.elements.byField, "status"),
      "и из настроек элемента тоже");
  });

  await test("удаление другого Field не задевает соседей", async () => {
    const cfg = makeConfig();
    const plugin = makePlugin(cfg);
    const host = makeNode("div");
    renderer.renderPkmOrderBoardSection(boardCtx(host, cfg, plugin));
    openedModals.length = 0;

    void byAria(host, "delete project").onclick();
    byText(lastModalContent() as StubNode, "Delete").onclick();
    await settle();

    const orderPatch = plugin.patches.find((p: Patch) => p.reason.startsWith("pkm:behavior:order:delete:"));
    const order = orderPatch.patch.pkm.fields.order;
    assert.deepEqual(order.left, ["status", "status_sub"], "левая сторона цела");
    assert.deepEqual(order.right, [], "удалённый Field уходит из своей стороны");
    assert.equal(order.lead.right, "", "ведущий справа очищен");
    assert.equal(order.lead.left, "status", "ведущий слева остался");
  });

  /* ---- дефекты, найденные заказчиком 2026-08-26 ------------------------ */

  await test("тумблеры вида доски просят перерисовку, а не молчат (A14)", async () => {
    /*
     * Заказчик: «не работает Show color settings, ничего не происходит».
     * Причина — доска зовёт `deferRefreshSettings(refreshSettings)`, а имени в
     * её области видимости не было ни у одной панели: значение записывалось,
     * а перерисовка падала с ReferenceError. Проверка держит договор: доска
     * получает перерисовку из контекста и зовёт её после записи.
     */
    const cfg = makeConfig();
    const plugin = makePlugin(cfg);
    const host = makeNode("div");
    let redraws = 0;
    const ctx = boardCtx(host, cfg, plugin);
    ctx.refreshSettings = () => { redraws++; };
    renderer.renderPkmOrderBoardSection(ctx);

    /* тумблер ищем по имени его строки, как это делает человек глазами */
    const row: Any = host.querySelectorAll(".setting-item")
      .find(n => n.querySelector(".setting-item-name")?.textContent === "Show Color Settings");
    assert.ok(row, "не нашёл тумблер Show Color Settings");
    row.querySelector("INPUT").click();
    await settle();

    const wrote = plugin.patches.find((p: Patch) => p.reason === "settings:ui:orderShowColorSettings");
    assert.ok(wrote, "значение тумблера должно записаться");
    assert.equal(wrote.patch.ui.orderShowColorSettings, false, "и записаться правильным");
    assert.equal(redraws, 1, "и попросить перерисовку ровно один раз");
  });

  await test("доска не исчезает после выключения и включения модуля", async () => {
    /*
     * Заказчик: «при выключении модуля доска пропадает, при включении не
     * появляется, приходится перезагружать Obsidian». Причина — блок чистил
     * узел и рисовал заново на месте: неудачная отрисовка оставляла пустоту
     * навсегда. Теперь неудачная попытка выбрасывается, а работающая доска
     * остаётся.
     */
    const { makeNode: node } = await import("../harness/dom_stub.ts");
    const { MemoryStore } = await import("../../src/ui/settings/store.ts");
    const { SettingsPane } = await import("../../src/ui/settings/settings_tab.ts");
    const { SCHEMA, TABS } = await import("../../src/ui/settings/schema/index.ts");

    const cfg = makeConfig();
    const plugin = makePlugin(cfg);
    const store = new MemoryStore({ features: { pkm: { enabled: true } } });
    const pane = new SettingsPane({
      schema: SCHEMA, tabs: TABS, store, actions: {},
      fragments: { createFragment: () => node("fragment") } as never,
      platform: {
        Setting, Notice, Modal, setIcon: () => {}, plugin,
        getConfig: () => cfg, normalizePkmOrder, pkmOrderFields: [],
      },
    });
    pane.setActiveTab("pkm" as never);
    const defs = pane.getSettingDefinitions() as Any[];
    const group = defs.find((d: Any) => d.heading === "Fields");
    /*
     * Своих блоков в группе `Fields` теперь два: разбор строки (10.3 П3) и сам
     * редактор. Берётся не первый попавшийся, а тот, который нарисовал
     * редактор, — иначе проверка молча переехала бы на предпросмотр.
     */
    const customs = group.items.filter((i: Any) => typeof i.render === "function");
    let host = node("div");
    for (const candidate of customs) {
      const probe = node("div");
      candidate.render({ settingEl: probe }, {});
      if (probe.querySelectorAll(".io-fieldsblock__mount").length) { host = probe; break; }
    }
    assert.ok(host.querySelectorAll(".io-fieldsblock__mount").length,
      "редактор Fields не нашёлся среди своих блоков группы");

    /*
     * Класс сменился вместе с блоком: новая панель показывает новую вёрстку
     * редактора (`io-fieldsblock__mount`), а не перенесённую доску
     * (`io-legacy__mount`). Проверка та же и про то же — редактор не должен
     * исчезать при выключении и включении модуля.
     */
    const drawn = () => host.querySelectorAll(".io-fieldsblock__mount").length;
    const text = () => host.textContent.length;
    assert.equal(drawn(), 1, "доска нарисована один раз");
    const before = text();

    await pane.setControlValue("features.pkm.enabled", false);
    assert.equal(drawn(), 1, "после выключения на экране ровно одна доска, а не пустота");

    await pane.setControlValue("features.pkm.enabled", true);
    assert.equal(drawn(), 1, "после включения — тоже одна: старая снята, новая на месте");
    assert.equal(text(), before, "и содержимое вернулось к прежнему");
  });

  /*
   * Четыре проверки про секции конфиг-заметки сняты 2026-08-29 вместе со
   * старой панелью. Их предмет — диалог конфликта несохранённого черновика
   * доски: новый редактор черновиков не ведёт, он пишет сразу, а применение
   * конфиг-заметки спрашивает своим окном (`actions_tests.ts`, Э2).
   */

  console.log("\n" + ran + " проверок пройдено");
  if (!notices.length) console.log("  (уведомлений не показано)");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
