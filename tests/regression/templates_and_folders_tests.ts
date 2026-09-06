/**
 * Папки и шаблоны в панели (замечания заказчика 1.6.2.3 и 1.6.2.4).
 *
 * **1.6.2.3.** `Templates folder` и `New notes folder` были простым полем
 * ввода: имя папки приходилось помнить и печатать без ошибок. У Obsidian с
 * 1.13 для этого есть свой контрол `folder` — поле с подсказчиком папок vault
 * и свободным вводом, — и панель обязана просить именно его. Своего списка
 * папок мы не собираем: подсказчик платформы знает vault лучше.
 *
 * **1.6.2.4.** `Default template` предлагал три выдуманных имени из прототипа.
 * Теперь список — заметки из назначенной папки и ничего кроме; папки нет —
 * вместо пустоты сказано, чего не хватает.
 *
 * Проверка идёт по определениям, которые панель отдаёт платформе: именно из
 * них Obsidian рисует контрол, и подделать здесь нечего.
 */

import assert from "node:assert/strict";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals } from "../harness/obsidian_stub.ts";
import { SCHEMA, TABS } from "../../src/ui/settings/schema/index.ts";
import { SettingsPane } from "../../src/ui/settings/settings_tab.ts";
import { MemoryStore } from "../../src/ui/settings/store.ts";
import { templateOptions } from "../../src/ui/settings/templates.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

const fragments = {
  createFragment(): StubNode {
    return makeNode("fragment");
  },
};

/** Панель со своим списком заметок vault: его отдаёт платформа. */
function makePane(config: Record<string, unknown>, notes: readonly string[]) {
  const store = new MemoryStore(JSON.parse(JSON.stringify(config)) as Record<string, unknown>);
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store,
    actions: {},
    fragments: fragments as never,
    platform: { listNotes: () => notes } as never,
  });
  return { pane, store };
}

/** Строка панели по ключу контрола: её же читает платформа. */
function itemFor(pane: SettingsPane, tab: string, key: string): Any {
  pane.setActiveTab(tab as never);
  const defs = pane.getSettingDefinitions() as unknown as Any[];
  for (const group of defs) {
    for (const it of (group.items || []) as Any[]) {
      if (it && it.control && it.control.key === key) return it;
    }
  }
  assert.fail("строки с ключом " + key + " в панели нет");
}

/* ---- 1: правило «только из назначенной папки» -------------------------- */

{
  const notes = [
    "Templates/task.md",
    "Templates/nested/meeting.md",
    "Templates/alpha.md",
    "Inbox/today.md",
    "TemplatesOther/looks-close.md",
  ];

  assert.deepEqual(templateOptions("", notes),
    [{ value: "", label: "Set a Templates folder first" }],
    "без папки список говорит, чего не хватает, а не молчит пустотой");

  assert.deepEqual(templateOptions("Empty", notes),
    [{ value: "", label: "No templates in Empty" }],
    "папка есть, шаблонов нет — сказано и это");

  const inside = templateOptions("Templates", notes);
  assert.deepEqual(inside.map(o => o.label),
    ["None", "alpha.md", "nested/meeting.md", "task.md"],
    "заметки из папки, по алфавиту, подпись — путь внутри папки");
  assert.deepEqual(inside.map(o => o.value),
    ["", "Templates/alpha.md", "Templates/nested/meeting.md", "Templates/task.md"],
    "записывается полный путь: по нему шаблон и ищут");

  /*
   * `TemplatesOther` начинается с тех же букв. Без разделителя в сравнении
   * соседняя папка попала бы в список — и человек выбрал бы шаблон, которого
   * в его папке нет.
   */
  assert.ok(!inside.some(o => o.value.includes("TemplatesOther")),
    "соседняя папка с похожим именем в список не попадает");

  /* Хвостовая косая черта — обычная опечатка, и списка она ломать не должна. */
  assert.deepEqual(templateOptions("Templates/", notes).map(o => o.value),
    inside.map(o => o.value),
    "лишняя косая черта в имени папки ничего не меняет");
  ok("шаблоны берутся только из назначенной папки, и пустота объяснена");
}

/* ---- 2: папка выбирается контролом платформы, а не печатается ---------- */

{
  const { pane } = makePane({ transform: { inline2note: { enabled: true } } }, []);
  for (const key of [
    "transform.inline2note.templatesFolder",
    "transform.inline2note.outputFolder",
  ]) {
    const it = itemFor(pane, "transform", key);
    assert.equal(it.control.type, "folder",
      key + ": контрол остался текстовым полем — папку опять приходится печатать наизусть");
    assert.ok(String(it.control.placeholder || "").length,
      key + ": у поля нет подсказки, что в нём ждут");
  }
  ok("обе папки просят у платформы контрол с подсказчиком vault");
}

/* ---- 3: список шаблонов в панели собирается из папки ------------------- */

{
  const notes = ["Templates/task.md", "Templates/meeting.md", "Inbox/today.md"];
  const { pane } = makePane(
    { transform: { inline2note: { enabled: true, templatesFolder: "Templates" } } },
    notes,
  );
  const it = itemFor(pane, "transform", "transform.inline2note.defaultTemplate");
  const options = it.control.options as Record<string, string>;

  assert.ok(!("task.md" in options),
    "в списке остались выдуманные имена прототипа (Р8): " + Object.keys(options).join(", "));
  assert.deepEqual(Object.keys(options).sort(),
    ["", "Templates/meeting.md", "Templates/task.md"],
    "в списке ровно заметки из папки и пустой выбор");
  assert.ok(!Object.keys(options).some(k => k.startsWith("Inbox/")),
    "заметка вне папки шаблонов в список не попала");
  ok("Default template предлагает заметки назначенной папки и только их");
}

/* ---- 4: папки нет — список говорит об этом прямо в контроле ------------ */

{
  const { pane } = makePane(
    { transform: { inline2note: { enabled: true, templatesFolder: "" } } },
    ["Templates/task.md"],
  );
  const it = itemFor(pane, "transform", "transform.inline2note.defaultTemplate");
  const labels = Object.values(it.control.options as Record<string, string>);
  assert.deepEqual(labels, ["Set a Templates folder first"],
    "без папки список обязан сказать, чего не хватает: " + labels.join(", "));
  ok("без назначенной папки список шаблонов объясняет себя, а не пустует");
}

/* ---- 5: назначили папку — список пересобрался (C44) -------------------- */

/*
 * Заказчик 2026-09-02: «назначил папку 111, в которой был template.md, однако
 * Default template = set a template folder first».
 *
 * Список значений собирает `getSettingDefinitions` и кеширует (П-11), а
 * пересобирать определения панель соглашалась ровно на двух ключах — тумблере
 * подсказок и подписи id. Запись папки шаблонов идёт через шов панели и в эти
 * два ключа не попадала, поэтому список оставался тем, каким собрался при
 * открытии вкладки: пустым.
 *
 * Проверяется путь целиком: пишем значение так, как его пишет панель
 * (`setControlValue`), и смотрим, что панель попросила пересборку и что новый
 * список содержит шаблон. Ожидание выписано отдельно от того, из чего список
 * строится (У-5): здесь названы путь папки и имя заметки.
 */
{
  let rebuilds = 0;
  const store = new MemoryStore(JSON.parse(JSON.stringify(
    { transform: { inline2note: { enabled: true, templatesFolder: "" } } },
  )) as Record<string, unknown>);
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store,
    actions: {},
    fragments: fragments as never,
    platform: { listNotes: () => ["111/template.md", "Inbox/note.md"] } as never,
    rebuild: () => { rebuilds++; },
  });

  const options = (): Record<string, string> => {
    pane.setActiveTab("transform" as never);
    const defs = pane.getSettingDefinitions() as unknown as Any[];
    for (const group of defs) {
      for (const it of (group.items || []) as Any[]) {
        if (it && it.control && it.control.key === "transform.inline2note.defaultTemplate") {
          return it.control.options as Record<string, string>;
        }
      }
    }
    assert.fail("строки Default template в панели нет");
  };

  const before = Object.values(options());
  assert.deepEqual(before, ["Set a Templates folder first"],
    "до записи папки список объясняет себя: " + before.join(", "));

  rebuilds = 0;
  await pane.setControlValue("transform.inline2note.templatesFolder", "111");
  assert.ok(rebuilds > 0,
    "запись папки шаблонов обязана попросить пересборку определений");

  const after = options();
  assert.ok(Object.prototype.hasOwnProperty.call(after, "111/template.md"),
    "шаблон из назначенной папки попал в список: " + Object.keys(after).join(", "));
  assert.ok(!Object.keys(after).some(k => k.startsWith("Inbox/")),
    "заметка вне папки в список не попала");
  ok("назначенная папка шаблонов доезжает до списка Default template");
}

/* ---- 6: обычная запись пересборку не просит ---------------------------- */

/*
 * Обратная сторона пятой проверки, и она важнее её: пересборка на каждой
 * записи заменяет узел контрола под руками человека — так однажды у слайдера
 * отобрали перетаскивание. Просить пересборку обязан только тот путь, от
 * которого зависит **список** значений.
 */
{
  let rebuilds = 0;
  const store = new MemoryStore(JSON.parse(JSON.stringify(
    { transform: { inline2note: { enabled: true, templatesFolder: "111" } } },
  )) as Record<string, unknown>);
  const pane = new SettingsPane({
    schema: SCHEMA,
    tabs: TABS,
    store,
    actions: {},
    fragments: fragments as never,
    platform: { listNotes: () => ["111/template.md"] } as never,
    rebuild: () => { rebuilds++; },
  });
  pane.setActiveTab("transform" as never);
  pane.getSettingDefinitions();

  rebuilds = 0;
  await pane.setControlValue("transform.inline2note.noteName.wordCount", 8);
  assert.equal(rebuilds, 0, "обычная запись пересборку не просит");

  await pane.setControlValue("transform.inline2note.templatesFolder", "222");
  assert.ok(rebuilds > 0, "а запись папки шаблонов — просит");
  ok("пересборку просит только путь, от которого зависит список значений");
}

console.log("\n" + passed + " проверок пройдено");
