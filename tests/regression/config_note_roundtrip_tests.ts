/**
 * Круговой обход конфиг-заметки: выгрузить настройку Fields в заметку и
 * применить её обратно (PRD 10.12, Э1).
 *
 * Заметка объявлена резервной копией настройки Fields — значит обход через
 * неё обязан ничего не терять. Проверяется это на НАСТОЯЩЕМ пути: кодек и
 * оркестратор те же, что в плагине, контекст собирается тем же кодом, что и
 * в `applyTagWheelConfigNote` (`tests/harness/plugin_internals.ts`), а запись
 * идёт через настоящий `ConfigStore` с настоящими `deepMerge` и
 * `migrateConfig`.
 *
 * Подделаны две вещи, и обе — граница с миром, а не логика:
 *   - `app.vault` отдаёт текст заметки из памяти вместо файла;
 *   - `plugin.loadData` / `saveData` ничего не пишут на диск.
 * Всё, что между ними, — плагиновое.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

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
const orchestrator = requireCjs(path.join(root, "src", "features", "config_note_orchestrator.js")) as {
  applyTagWheelConfigNote: (ctx: Any) => Promise<Any>;
};
const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

const NOTE_PATH = "InlineOverhaul_Config.md";

/**
 * Конфиг с тегом `status`, ссылкой `project` и дочерним Field ссылки
 * `project_sub`. У ссылки стоит предусловие: она ждёт значения `#work`
 * у тега (PRD 10.13.4).
 */
function baseConfig(): Any {
  return shared.cloneJson({
    pkm: {
      tagWheelConfigPath: NOTE_PATH,
      behavior: {
        order: {
          left: ["status"],
          right: ["project"],
          labels: { status: "Status", project: "Project" },
          strictNames: { status: "status", project: "project" },
          types: { status: "tag", project: "wikilink" },
          active: { status: "yes", project: "yes", project_sub: "yes" },
          freeRoam: { status: "off", project: "off" },
          enabled: { status: true, project: true, project_sub: true },
        },
        leftMode: {
          fields: [
            {
              id: "status", prefix: "#", placeholder: "Status",
              /* Форма значений снята с настоящего конфига в тестовом vault. */
              values: [
                { token: "#work", subtags: [], active: true },
                { token: "#home", subtags: [], active: true },
              ],
            },
          ],
        },
        rightMode: {
          fields: [
            {
              id: "project", prefix: "#", source: "wikilinks:project", placeholder: "Project",
              values: [{ id: "Alpha", token: "Alpha" }, { id: "Beta", token: "Beta" }],
              dependsOn: "status",
              enabledForParentValues: ["#work"],
            },
            {
              id: "project_sub", prefix: "#", source: "wikilinks:project_sub", placeholder: "sub",
              values: [{ id: "Gamma", token: "Gamma" }],
              dependsOn: "project",
            },
          ],
        },
      },
    },
  });
}

/** Хранилище и плагин — как в `main.js`, только без диска. */
function makeStore(base: Any): Any {
  return new ConfigStore(
    { loadData: async () => base, saveData: async () => {} },
    {
      defaults: internals.migrateConfig(shared.cloneJson(base)),
      cloneJson: shared.cloneJson,
      isObj: shared.isObj,
      deepMerge: shared.deepMerge,
      migrateConfig: internals.migrateConfig,
      Notice: class StubNotice { },
    },
  );
}

/**
 * Vault, в котором лежит одна заметка. Подделан только файл: чтение отдаёт
 * текст из памяти, запись в него же. Писать оркестратору есть что — он
 * возвращает в заметку служебный блок Prefix Resolver.
 */
function makeApp(noteText: string): Any {
  const file = { path: NOTE_PATH };
  let text = noteText;
  return {
    vault: {
      getAbstractFileByPath: (p: string) => (String(p) === NOTE_PATH ? file : null),
      read: async () => text,
      modify: async (_f: Any, next: string) => { text = String(next || ""); },
      create: async (_p: string, next: string) => { text = String(next || ""); return file; },
    },
  };
}

/** Выгрузить конфиг в заметку и применить её обратно. */
async function roundTrip(base: Any): Promise<Any> {
  const store = makeStore(base);
  const cfg = store.getSnapshot();
  await internals.loadConfigNoteModules(makeApp(""));
  const codec = internals.getTagWheelConfigCodec();
  const note = codec.buildTagWheelConfigMarkdown(cfg, "full");
  assert.ok(String(note || "").trim(), "заметка собралась непустой");
  await orchestrator.applyTagWheelConfigNote(
    internals.buildConfigNoteCtx({ app: makeApp(note), cfg, store }),
  );
  return store.getSnapshot();
}

const rightField = (cfg: Any, id: string): Any =>
  (cfg?.pkm?.behavior?.rightMode?.fields || []).find((f: Any) => String(f && f.id || "") === id) || null;

/* ======================================================================
 * Предусловие ссылки и её дочерний Field переживают обход.
 * ====================================================================== */

{
  const before = baseConfig();
  const after = await roundTrip(before);

  const link = rightField(after, "project");
  assert.ok(link, "ссылка на месте после применения заметки");
  assert.equal(String(link.dependsOn || ""), "status",
    "предусловие ссылки пережило применение заметки");
  assert.deepEqual(link.enabledForParentValues, ["#work"],
    "и названное значение предусловия тоже");
  ok("применение заметки не стирает предусловие ссылки");
}

{
  const after = await roundTrip(baseConfig());
  const sub = rightField(after, "project_sub");
  assert.ok(sub, "дочерний Field ссылки пережил применение заметки");
  assert.equal(String(sub && sub.dependsOn || ""), "project",
    "и остался привязан к своей ссылке");
  ok("применение заметки не удаляет дочерний Field ссылки");
}

{
  /* Тег и его значения — то, что заметка описывает и обязана вернуть. */
  const after = await roundTrip(baseConfig());
  const tag = (after?.pkm?.behavior?.leftMode?.fields || []).find((f: Any) => f.id === "status");
  assert.ok(tag, "тег на месте");
  const tokens = (tag.values || []).map((v: Any) => String(v && v.token || "")).filter(Boolean);
  assert.deepEqual(tokens.slice().sort(), ["home", "work"], "оба значения тега вернулись из заметки");
  ok("обход возвращает то, что заметка и правда описывает");
}

{
  /*
   * Наблюдение, закреплённое как есть, а не как желаемое.
   *
   * Обход через заметку хранит теги БЕЗ решётки: `rebuildTagValues` в
   * `main.js` кладёт в конфиг `denormTagToken(...)`, а решётка живёт
   * отдельным полем `prefix`. В конфиге, который заметку не видел, значения
   * лежат с решёткой (снято с тестового vault: `#todo`, `#/1`). То есть одна
   * и та же настройка представлена двумя способами, и какой из них верный —
   * вопрос к слою данных Fields, а не к этому обходу.
   *
   * Проверка стоит здесь, чтобы разница не считалась случайностью: если
   * форму приведут к одной, она упадёт — и упасть должна.
   */
  const after = await roundTrip(baseConfig());
  const tag = (after?.pkm?.behavior?.leftMode?.fields || []).find((f: Any) => f.id === "status");
  assert.equal(String(tag.prefix || ""), "#", "решётка не пропала, а переехала в `prefix`");
  assert.ok((tag.values || []).every((v: Any) => String(v && v.token || "").charAt(0) !== "#"),
    "в значениях решётки нет");
  ok("обход хранит теги без решётки, решётка живёт в `prefix` (закреплено как есть)");
}

console.log("\n" + passed + " проверок пройдено");
