/**
 * Порядок Prefix: три списка (PRD 10.7, Ц1–Ц4).
 *
 * Что здесь настоящее. Путь записи — плагиновый: `ConfigStore`, `deepMerge`,
 * `migrateConfig` из `main.js`. Цикл Prefix проверяется **самим рантаймом**:
 * записанный список отдаётся `cycleLineTypeRaw` из `navigation_runtime.js`, и
 * тот обязан провести строку по нему. Так проверяется не форма записи, а то,
 * что записанное читается тем, для кого оно писалось.
 *
 * Подделан только DOM. Файл рантайма под З3 и только читается.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals, Setting, Notice, Modal } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { cycleOrder, fieldOrderList, prefixOrderList } from "../../src/ui/settings/custom/order_lists.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";

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

const texts = (node: StubNode, cls: string): string[] => all(node, cls).map(n => n.textContent);

const byLabel = (node: StubNode, prefix: string): StubNode | undefined =>
  all(node, "io-icon").concat(all(node, "io-btn"))
    .find(n => String(n.getAttribute("aria-label") || "").startsWith(prefix));

/* ---- панель на настоящем пути записи ----------------------------------- */

interface Panel {
  host: StubNode;
  cfg: () => Any;
  writes: Array<{ reason: string }>;
  cleanup: () => void;
}

function makeBlock(
  render: typeof cycleOrder,
  base: Any,
  over?: Record<string, unknown>,
): Panel {
  const host = makeNode("div");
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
  const plugin: Any = {
    app: {},
    getConfig: () => store.getSnapshot(),
    setConfigPatch: (patch: Any, reason: string) => {
      writes.push({ reason: reason || "settings" });
      store.patch(patch, reason || "settings");
    },
  };
  const values: Record<string, unknown> = {
    "navigation.moveSelection.prefixCyclerEnabled": true,
    "features.pkm.enabled": true,
    ...(over || {}),
  };
  const ctx = {
    get: (p: string) => values[p],
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
    platform: {
      Setting,
      Notice,
      Modal,
      setIcon: () => {},
      plugin,
      getConfig: () => store.getSnapshot(),
      normalizePkmOrder: internals.normalizePkmOrder,
      pkmOrderFields: [] as string[],
    },
  } as unknown as SettingsCtx;

  const cleanup = render(host as unknown as El, ctx);
  return { host, cfg: () => store.getSnapshot(), writes, cleanup };
}

function baseConfig(over?: Any): Any {
  const cfg: Any = {
    navigation: { moveSelection: { cycleOrder: ["#", "- ", ""] } },
    pkm: {
      behavior: {
        io: { separator1: "||", separator2: "||" },
        order: {
          left: ["status"],
          right: ["project"],
          labels: { status: "Status", project: "Project" },
          strictNames: { status: "status", project: "project" },
          types: { status: "tag", project: "wikilink" },
          active: { status: "yes", project: "yes" },
          enabled: { status: true, project: true },
        },
        leftMode: { fields: [{ id: "status", prefix: "#", values: [{ token: "todo" }] }] },
        rightMode: { fields: [{ id: "project", source: "wikilinks:project", values: [] }] },
        prefixRules: { priorityTargets: [], priorityCheckboxes: ["[ ]", "[x]", "[!]"] },
      },
    },
  };
  return JSON.parse(JSON.stringify(over ? { ...cfg, ...over } : cfg));
}

const cycleOf = (cfg: Any): string[] => cfg.navigation.moveSelection.cycleOrder as string[];
const rulesOf = (cfg: Any): Any => cfg.pkm.prefixRules;

/* ======================================================================
 * 1. Цикл Prefix: что записано, то рантайм и проходит.
 * ====================================================================== */

{
  const p = makeBlock(cycleOrder, baseConfig());
  assert.deepEqual(texts(p.host, "io-sortrow__n"), ["1", "2", "3"], "три строки, пронумерованы");

  /* Ц1: пустая строка подписана словами, а не оставлена пустой. */
  const inputs = all(p.host, "io-text");
  assert.equal(inputs[2]?.value, "", "третья строка — обычная строка без Prefix");
  assert.equal(inputs[2]?.placeholder, "no Prefix (plain text)",
    "и она подписана словами (Ц1)");

  /* Перестановка: `- ` уходит наверх. */
  (byLabel(p.host, "Move Prefix 2 up") as StubNode).click();
  assert.deepEqual(cycleOf(p.cfg()), ["- ", "#", ""], "порядок записан");

  /*
   * А теперь спросим сам рантайм. Зовётся `moveSelection` — та функция, с
   * которой начинается работа команды, а не её внутренности: `З5` запрещает
   * `new Function`, а вытаскивать внутреннюю функцию иначе нечем, да и
   * проверять надо вход, а не середину пути.
   *
   * Редактор подделан: другого способа позвать команду вне Obsidian нет, и
   * подделка — ровно те четыре метода, которые команда трогает без выделения.
   */
  const nav = requireCjs(path.join(root, "navigation_runtime.js")) as {
    moveSelection: (editor: Any, direction: string, cfg: Any) => void;
  };
  /*
   * Строка — заголовок: не элемент списка и без отступа, поэтому `Move right`
   * идёт именно циклом (у элемента списка он увеличил бы отступ — так сказано
   * в таблице разбора, 10.6). И не последняя в цикле: на последней рантайм при
   * умолчании `onCycleEnd: indent` цикл не замыкает, а добавляет отступ.
   */
  const lines = ["# text"];
  const editor: Any = {
    getLine: (n: number) => lines[n],
    setLine: (n: number, value: string) => { lines[n] = value; },
    getCursor: () => ({ line: 0, ch: 0 }),
    setCursor: () => {},
    getSelection: () => "",
  };
  nav.moveSelection(editor, "right", p.cfg().navigation.moveSelection);
  assert.equal(lines[0], "text",
    "рантайм идёт по записанному списку: после `#` следует обычная строка");

  ok("цикл Prefix: перестановка записана, и рантайм идёт по ней");
  p.cleanup();
}

/* ======================================================================
 * 2. Цикл: добавление, правка и удаление строки.
 * ====================================================================== */

{
  const p = makeBlock(cycleOrder, baseConfig());
  (byLabel(p.host, "Add Prefix") as StubNode).click();
  assert.equal(cycleOf(p.cfg()).length, 4, "строка добавлена");

  const inputs = all(p.host, "io-text");
  const last = inputs[inputs.length - 1] as StubNode;
  last.value = "> ";
  last.dispatch("change");
  assert.deepEqual(cycleOf(p.cfg()), ["#", "- ", "", "> "], "и её текст записан");

  (byLabel(p.host, "Remove Prefix 1") as StubNode).click();
  assert.deepEqual(cycleOf(p.cfg()), ["- ", "", "> "], "удалена та строка, у которой нажали");
  ok("цикл Prefix: добавление, правка и удаление строки");
  p.cleanup();
}

/* ======================================================================
 * 3. Выключенный цикл читается, но не правится.
 * ====================================================================== */

{
  const p = makeBlock(cycleOrder, baseConfig(),
    { "navigation.moveSelection.prefixCyclerEnabled": false });
  assert.equal(all(p.host, "io-sortable--off").length, 1, "список помечен выключенным");
  assert.equal((all(p.host, "io-text")[0] as StubNode).disabled, true, "поля не правятся");
  (byLabel(p.host, "Move Prefix 2 up") as StubNode).click();
  (byLabel(p.host, "Add Prefix") as StubNode).click();
  assert.deepEqual(cycleOf(p.cfg()), ["#", "- ", ""], "и ничего не записалось");
  assert.equal(p.writes.length, 0, "ни одной записи");
  ok("выключенный цикл виден, но не правится");
  p.cleanup();
}

/* ======================================================================
 * 4. Порядок Fields: пустой список показывает все Fields по порядку.
 *
 * Так же ведёт себя рантайм: `pkm_line_finalize_unified.js` заполняет пустой
 * `priorityTargets` полями левого Block. Панель не должна показывать пустоту
 * там, где движок уже что-то решил.
 * ====================================================================== */

{
  const p = makeBlock(fieldOrderList, baseConfig());
  assert.deepEqual(texts(p.host, "io-sortrow__label"), ["Status", "Project"],
    "показаны Fields по именам, а не по ключам");

  (byLabel(p.host, "Move Project up") as StubNode).click();
  assert.deepEqual(rulesOf(p.cfg()).priorityTargets, ["project", "status"],
    "порядок записан ключами Fields — так его читает движок");
  assert.deepEqual(texts(p.host, "io-sortrow__label"), ["Project", "Status"],
    "и виден в новом порядке");
  ok("порядок Fields: имена на экране, ключи в конфиге");
  p.cleanup();
}

/* ======================================================================
 * 5. Порядок Prefix: токены в том виде, в каком их хранит конфиг.
 * ====================================================================== */

{
  const p = makeBlock(prefixOrderList, baseConfig());
  assert.deepEqual(texts(p.host, "io-mono"), ["[ ]", "[x]", "[!]"],
    "показаны те же токены, что записаны");

  (byLabel(p.host, "Move [!] up") as StubNode).click();
  assert.deepEqual(rulesOf(p.cfg()).priorityCheckboxes, ["[ ]", "[!]", "[x]"],
    "перестановка записана");

  /* Токены не переписываются: значения в конфиге не меняются (З1). */
  assert.ok(rulesOf(p.cfg()).priorityCheckboxes.every((t: string) => t.startsWith("[")),
    "и остаются в своей форме");
  ok("порядок Prefix: перестановка записана, форма токенов не тронута");
  p.cleanup();
}

/* ======================================================================
 * 6. Списки приоритета не правятся при выключенном модуле.
 * ====================================================================== */

{
  const p = makeBlock(fieldOrderList, baseConfig(), { "features.pkm.enabled": false });
  const up = byLabel(p.host, "Move Project up") as StubNode;
  assert.equal(up.disabled, true, "стрелка выключена");
  up.click();
  assert.deepEqual(rulesOf(p.cfg()).priorityTargets, [], "и ничего не записалось");
  assert.equal(p.writes.length, 0, "ни одной записи");
  ok("выключенный модуль: списки приоритета не правятся");
  p.cleanup();
}

/* ======================================================================
 * 7. Очистка снимает своё поддерево, а не строку настройки.
 * ====================================================================== */

{
  const p = makeBlock(cycleOrder, baseConfig());
  assert.ok(all(p.host, "io-sortrow").length, "список нарисован");
  p.cleanup();
  assert.equal(all(p.host, "io-sortrow").length, 0, "и снят");
  assert.equal(all(p.host, "io-cycleorder").length, 1,
    "но строка настройки осталась: она принадлежит платформе (С5)");
  ok("очистка снимает только своё");
}

console.log("\n" + passed + " проверок пройдено");
