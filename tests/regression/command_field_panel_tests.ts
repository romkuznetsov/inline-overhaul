/**
 * Command Field, этап 1: тип в панели, таблица категорий, пары команд и отбор
 * «Fields строки» (постановка `test-vault/command-field.md`, 4.1–4.4; разбор 2.10).
 *
 * Путь записи настоящий, как в `fields_editor_config_roundtrip_tests.ts`:
 * `ConfigStore` → `deepMerge` → `migrateConfig` (правила 1, 2). Подделаны
 * только DOM и редактор Obsidian.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import { renderFieldsEditor, type FieldsViewState } from "../../src/ui/settings/custom/fields_editor_view.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import * as deepStateModule from "../../src/core/order_deep_editor_state.js";
import { renderNewFieldForm } from "../../src/ui/settings/custom/new_field_dialog.ts";
import { sayIn } from "../../src/ui/settings/texts_blocks.ts";

setupGlobals();
type Any = ReturnType<typeof JSON.parse>;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const requireCjs = createRequire(import.meta.url);
const shared = requireCjs(path.join(root, "src", "core", "shared_utils.js")) as Any;
const { ConfigStore } = requireCjs(path.join(root, "src", "core", "config_store.js")) as Any;
const rulesShape = requireCjs(path.join(root, "src", "core", "pkm_rules_shape.js")) as Any;
const orderConfig = requireCjs(path.join(root, "src", "core", "pkm_order_config.js")) as Any;
const registry = requireCjs(path.join(root, "src", "features", "command_registry.js")) as Any;
const CF = requireCjs(path.join(root, "src", "features", "command_field.js")) as Any;
const wheelMod = requireCjs(path.join(root, "src", "features", "command_field_wheel.js")) as Any;
const internals = loadPluginInternals();
const deepState = (deepStateModule as { default?: unknown }).default || deepStateModule;

let passed = 0;
const ok = (what: string): void => { passed++; console.log("  ok " + what); };

function all(n: StubNode, cls: string, out: StubNode[] = []): StubNode[] {
  if (n.classList.contains(cls)) out.push(n);
  n.children.forEach(c => all(c, cls, out));
  return out;
}
const labelled = (n: StubNode, label: string): StubNode => {
  const hit: StubNode[] = [];
  const go = (x: StubNode): void => { if (String(x.getAttribute("aria-label")) === label) hit.push(x); x.children.forEach(go); };
  go(n);
  assert.ok(hit.length, "нет узла «" + label + "»");
  return hit[0] as StubNode;
};
const click = (n: StubNode): void => { n.dispatch("click", { preventDefault() {}, stopPropagation() {}, target: n }); };
const text = (n: StubNode): string => [String(n.textContent || "")].concat(n.children.map(text)).join(" ");
/* Выбор списком: подпись узла — `<что> — <выбранное — подсказка>`, у варианта — `<вариант> — <подсказка>`. */
const named = (n: StubNode, label: string): boolean => {
  const a = String(n.getAttribute("aria-label"));
  return a === label || a.startsWith(label + " — ");
};
const opener = (host: StubNode, label: string): StubNode => {
  const hit = all(host, "io-cats__tbtn").find(n => named(n, label));
  assert.ok(hit, "нет выбора «" + label + "»");
  return hit as StubNode;
};
const pickIn = (host: StubNode, label: string, item: string): void => {
  click(opener(host, label));
  const it = all(host, "io-cats__titem").find(n => named(n, item));
  assert.ok(it, "у «" + label + "» нет варианта «" + item + "»");
  click(it as StubNode);
};
const shown = (host: StubNode, label: string): string => String((all(opener(host, label), "io-cats__tname")[0] as StubNode).textContent);
const addCategory = (host: StubNode, name: string): void => {
  pickIn(host, "Category to add to Fmt", name);
  click(all(host, "io-btn").find(n => n.textContent === "Add category") as StubNode);
};

/** Панель на настоящем хранилище: `getConfig` и `setConfigPatch` — как у плагина. */
function makePanel(base: Any): { host: StubNode; cfg: () => Any; draw: () => void; model: () => Any; state: FieldsViewState } {
  const host = makeNode("div");
  const store = new ConfigStore(
    { loadData: async () => base, saveData: async () => {} },
    { defaults: internals.migrateConfig(base), cloneJson: shared.cloneJson, isObj: shared.isObj, deepMerge: shared.deepMerge, migrateConfig: internals.migrateConfig, Notice: class { } },
  );
  const plugin = { getConfig: () => store.getSnapshot(), setConfigPatch: (patch: Any, reason: string) => store.patch(patch, reason || "settings") };
  const state: FieldsViewState = { selected: "" };
  let cleanup: (() => void) | null = null;
  let last: Any = null;
  const draw = (): void => {
    if (cleanup) cleanup();
    host.empty();
    last = createFieldsModel({ plugin: plugin as never, normalizePkmOrder: internals.normalizePkmOrder as never, pkmOrderFields: [], cfg: plugin.getConfig() as never, deepState: deepState as never });
    cleanup = renderFieldsEditor(host as unknown as El, {
      model: last,
      ctx: { get: () => 100, set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
      state, enabled: true, showTips: false, redraw: draw, notice: () => {},
      askNewField: done => done(null), confirmDeleteField: (_n, done) => done(false),
    });
  };
  draw();
  return { host, cfg: () => store.getSnapshot(), draw, model: () => last, state };
}

const base = {
  pkm: { fields: {
    order: { left: ["status"], right: [], labels: { status: "Status" }, strictNames: { status: "status" }, types: { status: "tag" }, active: { status: "yes" } },
    tags: { fields: [{ id: "status", prefix: "#", values: [{ token: "todo", active: true }, { token: "done", active: true }] }] },
  } },
};
const panel = makePanel(base);

/* 1. Заведение: тип живёт, определения строки нет, таблица категорий пуста (4.1). */
{
  const res = panel.model().addField("Fmt", "command");
  assert.equal(res.ok, true, String(res.error));
  const cfg = panel.cfg();
  assert.equal(cfg.pkm.fields.order.types.Fmt, "command", "тип command стал другим");
  const defs = [].concat(cfg.pkm.fields.tags.fields, cfg.pkm.fields.links.fields).map((f: Any) => f.id);
  assert.ok(!defs.some((id: string) => /^Fmt/.test(id)), "у Command Field завелось определение строки: " + defs.join());
  assert.deepEqual(cfg.pkm.fields.commands.byField.Fmt, { categories: [] });
  panel.draw();
  assert.ok(panel.model().listFields().some((r: Any) => r.key === "Fmt"), "в списке Fields его нет");
  assert.ok(!panel.model().listLineFields().some((r: Any) => r.key === "Fmt"), "он среди Fields строки");
  assert.ok(!panel.model().listYamlFields().some((r: Any) => r.key === "Fmt"), "он среди свойств заметки");
  assert.ok(!panel.model().listFieldTokens().some((r: Any) => r.key === "Fmt"), "он среди Smart Rules");
  ok("Command Field заводится без определения строки и не виден читателям строки");
}

/* 2. Таблица: категория из выбора приходит с пресетами; глаз, клон, удаление — одной записью. */
{
  panel.state.selected = "Fmt";
  panel.draw();
  const h = panel.host;
  assert.equal(all(h, "io-cats").length, 1, "таблицы категорий нет");
  assert.equal(all(h, "io-vals__row--child").length, 0);
  const pick = labelled(h, "Category to add to Fmt");
  const addBtn = all(h, "io-btn").find(n => n.textContent === "Add category") as StubNode;
  /* До выбора — серый прочерк (его пункт «Новое» 2026-10-03), кнопка выключена. */
  assert.ok(pick.classList.contains("io-cats__tbtn--unset") && (addBtn as Any).disabled, "пустой выбор не серый или кнопка не выключена");
  assert.equal(shown(h, "Category to add to Fmt"), "—", "пустой выбор не прочерк");
  click(pick);
  const offers = all(h, "io-cats__titem").map(n => String(n.getAttribute("aria-label")));
  assert.deepEqual(offers.map(a => a.split(" — ")[0]), ["Insert callout", "Cleanup", "Insert codeblock", "Tree ↔ section"]);
  assert.ok(offers.every(a => a.split(" — ")[1]), "у варианта категории нет подсказки: " + offers.join(" | "));
  click(all(h, "io-cats__titem")[0] as StubNode);
  assert.ok(!(addBtn as Any).disabled && !opener(h, "Category to add to Fmt").classList.contains("io-cats__tbtn--unset"), "после выбора кнопка не включилась");
  click(all(h, "io-btn").find(n => n.textContent === "Add category") as StubNode);
  assert.deepEqual(all(panel.host, "io-cats__cap").map(n => n.textContent), ["Type", "Fold"], "подписи колонок коллаута");
  let cats = panel.cfg().pkm.fields.commands.byField.Fmt.categories;
  assert.deepEqual(cats.map((c: Any) => c.key + ":" + c.presets.map((p: Any) => p.type).join("/")), ["callouts:note/tip/warning"]);
  assert.equal(all(panel.host, "io-vals__row--child").length, 3, "строк пресетов не три");
  click(labelled(panel.host, "Hide Tip"));
  click(labelled(panel.host, "Clone the preset Note"));
  cats = panel.cfg().pkm.fields.commands.byField.Fmt.categories;
  assert.deepEqual(cats[0].presets.map((p: Any) => p.name + (p.hidden ? "-" : "")), ["Note", "Note (copy)", "Tip-", "Warning"]);
  assert.match(text(all(panel.host, "io-cats__same")[0] as StubNode), /same as Note/, "совпавший клон не помечен (В-281)");
  ok("категория приходит с пресетами; глаз, клон и пометка совпавшего");
}

/* 2б. Тип коллаута — свой выбор со значком (его `💬` к тесту 1 цикла 125); свёрнутость — Open и Closed. */
{
  click(opener(panel.host, "Callout type of Warning"));
  const items = all(panel.host, "io-cats__titem");
  assert.equal(items.length, 13, "в списке не все типы коллаутов");
  click(items.find(n => n.getAttribute("aria-label") === "danger") as StubNode);
  const presets = panel.cfg().pkm.fields.commands.byField.Fmt.categories[0].presets;
  assert.equal(presets[3].type, "danger", "выбор типа не записался");
  /* Свёрнутость — переключатель (его 💬 к тесту 1 цикла 127): подпись называет положение и подсказку. */
  const fold = (): StubNode => all(panel.host, "io-cats__fold").find(n => named(n, "Fold of Note")) as StubNode;
  assert.ok(fold(), "у пресета Note нет переключателя свёрнутости");
  assert.equal(all(panel.host, "io-cats__tbtn").filter(n => named(n, "Fold of Note")).length, 0, "свёрнутость осталась списком");
  assert.match(String(fold().getAttribute("aria-label")), /^Fold of Note — Open: \S/, "подпись не называет положение Open с подсказкой");
  click(fold());
  assert.equal(panel.cfg().pkm.fields.commands.byField.Fmt.categories[0].presets[0].fold, "-", "свёрнутость не записалась");
  assert.match(String(fold().getAttribute("aria-label")), /— Closed: \S/, "после щелчка подпись не Closed");
  click(fold());
  assert.equal(panel.cfg().pkm.fields.commands.byField.Fmt.categories[0].presets[0].fold, "", "второй щелчок не открыл коллаут");
  /* Обратно — дальше проверки опираются на Warning. */
  pickIn(panel.host, "Callout type of Warning", "warning");
  ok("выбор типа коллаута списком со значком; свёрнутость — переключатель Open/Closed");
}

/* 3. У Command Field нет Prefix behavior и свойства заметки; есть пара команд на категорию. */
{
  const all_ = text(panel.host);
  assert.ok(!/Prefix behavior/.test(all_), "Prefix behavior у Command Field");
  assert.ok(!/YAML property/.test(all_), "свойство заметки у Command Field");
  const cfg = panel.cfg();
  const defs = registry.buildPkmCommandDefs(orderConfig.serializePkmOrderForMacro, orderConfig.serializeDateRuntimeConfigForMacro, orderConfig.normalizePkmOrder, cfg, []);
  assert.deepEqual(defs.filter((d: Any) => d.orderKey === "Fmt").map((d: Any) => d.id + "=" + d.name),
    ["fmt-callouts-next=Fmt · Insert callout next", "fmt-callouts-previous=Fmt · Insert callout previous"]);
  assert.ok(!defs.some((d: Any) => d.id === "fmt-next"), "у самого Command Field завелась пара (4.4)");
  const rules = rulesShape.buildRulesForEngines(cfg);
  assert.ok(!JSON.stringify(rules.behavior.order).includes("Fmt"), "движки видят Command Field в Order");
  assert.ok(!orderConfig.serializePkmOrderForMacro(cfg).includes("Fmt"), "порядок для макро видит Command Field");
  ok("пара команд на категорию, движки строки Command Field не видят");
}

/* 3в. Вставка блока (6.3): обёртка — одна из трёх, у каждой свои настройки (его 💬 к тесту 6 цикла 126). */
{
  addCategory(panel.host, "Insert codeblock");
  const block = (): Any => panel.cfg().pkm.fields.commands.byField.Fmt.categories.find((c: Any) => c.id === "block");
  assert.equal(block().presets[0].content, "```table-of-contents\n```", "пресет по умолчанию не пример 6.3");
  const area = labelled(panel.host, "Text that Contents inserts");
  (area as Any).value = "```dataview\nLIST\n```";
  area.dispatch("change", { target: area });
  assert.equal(block().presets[0].content, "```dataview\nLIST\n```", "содержимое не записалось");
  assert.equal(shown(panel.host, "Wrap of Contents"), "Heading", "обёртка по умолчанию не заголовок");
  labelled(panel.host, "Heading text of Contents");
  assert.equal(shown(panel.host, "Heading level of Contents"), "Auto", "уровень по умолчанию не на один ниже заголовка выше");
  assert.throws(() => labelled(panel.host, "Callout title of Contents"), /нет узла/, "у заголовка настройки коллаута");
  pickIn(panel.host, "Wrap of Contents", "Callout");
  assert.equal(block().presets[0].mode, "callout", "обёртка не записалась");
  assert.throws(() => labelled(panel.host, "Heading text of Contents"), /нет узла/, "у коллаута осталось поле заголовка");
  const title = labelled(panel.host, "Callout title of Contents");
  (title as Any).value = "TOC";
  title.dispatch("change", { target: title });
  assert.equal(block().presets[0].title, "TOC", "заголовок коллаута не записался");
  pickIn(panel.host, "Wrap of Contents", "Plain");
  assert.throws(() => opener(panel.host, "Callout type of Contents"), /нет выбора/, "у простой вставки настройки коллаута");
  /* Дальше проверки опираются на одну категорию Коллауты. */
  click(labelled(panel.host, "Remove the category Insert codeblock"));
  ok("вставка блока в таблице: обёртка одна из трёх, у каждой свои настройки, содержимое пишется");
}

/* 3г. Дерево ↔ раздел (6.4): четыре выбора с подписями колонок и умолчаниями постановки, выбор пишется. */
{
  addCategory(panel.host, "Tree ↔ section");
  const name = "Section · after the list";
  const values = ["Heading level of {0}", "Where the section of {0} goes", "Code blocks of {0}", "Tables of {0}"].map(a => shown(panel.host, a.replace("{0}", name)));
  assert.deepEqual(values, ["Auto", "After list", "Nested", "After tree"], "умолчания пресета не те, что в постановке");
  assert.deepEqual(all(panel.host, "io-cats__cap").map(n => n.textContent).slice(-4), ["Heading", "Where", "Code blocks", "Tables"], "подписи колонок раздела");
  pickIn(panel.host, "Where the section of " + name + " goes", "In place");
  const sec = panel.cfg().pkm.fields.commands.byField.Fmt.categories.find((c: Any) => c.id === "section");
  assert.equal(sec.presets[0].place, "in-place", "положение не записалось");
  click(labelled(panel.host, "Remove the category Tree ↔ section"));
  ok("дерево ↔ раздел в таблице: подписи колонок, четыре выбора с умолчаниями постановки, выбор пишется");
}

/* 3б. `Child name in tagWheel` у Command Field — подпись ячейки пресетов, без своего имени `preset`. */
{
  const input = labelled(panel.host, "Child name in tagWheel for Fmt");
  assert.equal((input as Any).placeholder, "preset", "умолчание ячейки пресетов не preset");
  let p: Any = input;
  while (p && !p.classList.contains("io-item")) p = p.parent;
  assert.ok(p && !p.hidden, "у категории три пресета, а строка подписи спрятана");
  (input as Any).value = "style";
  input.dispatch("change", { target: input });
  const wheel = wheelMod.wheelInput(panel.cfg());
  assert.equal(wheel.fields.find((f: Any) => f.key === "Fmt").subLabel, "style", "подпись не дошла до колеса");
  panel.model().setSubLabel("Fmt_sub", "");
  assert.equal(wheelMod.wheelInput(panel.cfg()).fields.find((f: Any) => f.key === "Fmt").subLabel, "preset", "пустая подпись не вернула preset");
  ok("Child name in tagWheel у Command Field: виден, пишется, доходит до колеса, пустое — preset");
}

/* 4. Исполнение в редакторе — одна транзакция (R-1); скрытый пресет перебор пропускает. */
{
  const cfg = panel.cfg();
  const calls: Any[] = [];
  const ed = (doc: string, line = 0, ch = 0): Any => ({
    getValue: () => doc, getCursor: () => ({ line, ch }), somethingSelected: () => false,
    transaction: (tx: Any) => calls.push(tx),
  });
  assert.equal(CF.runInEditor(ed("- a"), cfg, "Fmt", "callouts", 1), "done");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].changes[0].text, "> [!note]\n> - a");
  assert.equal(CF.runInEditor(ed("> [!note]\n> - a", 1, 3), cfg, "Fmt", "callouts", 1), "done");
  assert.equal(calls[1].changes[0].text, "> [!warning]", "клон Note узнан не первым или скрытый Tip не пропущен");
  assert.equal(CF.runInEditor(ed("- a"), cfg, "Fmt", "cleanup", 1), "unknown", "категории нет, а команда что-то сделала");
  ok("одна транзакция на команду; совпавший клон — первый, скрытый пропущен");
}

/* 5. Удаление Field снимает категории надгробием, команды уходят. */
{
  panel.model().deleteField("Fmt");
  const cfg = panel.cfg();
  assert.equal(cfg.pkm.fields.commands.byField.Fmt, null);
  const defs = registry.buildPkmCommandDefs(orderConfig.serializePkmOrderForMacro, orderConfig.serializeDateRuntimeConfigForMacro, orderConfig.normalizePkmOrder, cfg, []);
  assert.ok(!defs.some((d: Any) => d.orderKey === "Fmt"));
  ok("удаление снимает категории и команды");
}

/* 6. Окно `Add a Field`: категории настраиваются сразу (его `💬` к тесту 1 цикла 125). */
{
  const box = makeNode("div");
  let answer: Any = null;
  renderNewFieldForm(box as unknown as El, {
    say: sayIn("field-editor", {}),
    ctx: { get: (p: string) => (/separator/.test(p) ? "::" : 100), set: async () => {}, run: async () => {}, watch: () => () => {} } as never,
    showTips: false, showIds: false, blocks: [], checkName: () => "",
    lineFields: panel.model().listLineFields(),
    done: a => { answer = a; },
  });
  const card = all(box, "io-nf__type")[3] as StubNode;
  card.dispatch("pointerdown", { target: card });
  const name = labelled(box, "Name of the new Field");
  (name as Any).value = "Wrap";
  name.dispatch("input", { target: name });
  click(all(all(box, "io-cats__pick")[0] as StubNode, "io-cats__tbtn")[0] as StubNode);
  click(all(box, "io-cats__titem").find(n => named(n, "Cleanup")) as StubNode);
  click(all(box, "io-btn").find(n => n.textContent === "Add category") as StubNode);
  click(labelled(box, "Keep the Values of status"));
  assert.equal(all(box, "io-vals__row--child").length, 1, "пресет Очистки не встал в окне");
  assert.match(text(all(box, "io-nf__pane")[0] as StubNode), /Cleanup/, "скроллер предпросмотра не показывает категорию");
  click(all(box, "io-btn--cta").find(n => n.textContent === "Add Field") as StubNode);
  assert.ok(answer, "окно не ответило");
  const res = panel.model().addField(answer.name, answer.kind);
  panel.model().configureNewField(res.key, answer.setup);
  const cats = panel.cfg().pkm.fields.commands.byField.Wrap.categories;
  assert.deepEqual(cats.map((c: Any) => c.id + ":" + JSON.stringify(c.presets[0].keep)), ['cleanup:["status"]']);
  ok("окно Add a Field: категория и её пресет настраиваются сразу и доходят до конфига");
}

console.log(`command_field_panel: ${passed} passed`);
