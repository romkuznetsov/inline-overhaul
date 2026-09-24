/**
 * Какая запись настроек доходит до пересборки оформления в открытых заметках
 * (`Р-8`, `Ф-4`).
 *
 * **Зачем это пин, а не заметка.** У панели две дороги записи, и они разные:
 * обычный контрол пишет `store.update` напрямую, а свой блок — через
 * `plugin.setConfigPatch`, то есть через `config_write.applyPatch`. Пересборку
 * заметок зовёт только вторая. Пробой со счётчиком 2026-09-19 намерил: обычная
 * запись — **ноль** вызовов, патч своего блока — **один**.
 *
 * Число здесь не украшение. Пока оно такое, «всегда перестраивать» у двух
 * расширений оформления — не лень, а единственный путь настройки до заметки
 * (разбор — у `createTagVisualDecorationExtension`). Поменяется шов —
 * покраснеет эта проверка, и следующая правка оформления будет сделана с
 * открытыми глазами, а не по памяти о том, как оно было.
 *
 * **Что здесь настоящее** (У-1). Настоящие: `ConfigStore`, `ConfigStoreAdapter`
 * — тот самый шов, которым панель пишет значение, — и `config_write` целиком.
 * Подделаны границы с миром: `obsidian`, CodeMirror и диск.
 */

import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigStoreAdapter } from "../../src/ui/settings/store.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = Module.createRequire(path.join(root, "src", "main.js"));

/* Границы с миром: их в Node нет, и подделка названа (У-1). */
const loader = Module as unknown as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const origLoad = loader._load;
loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
  if (request === "obsidian") {
    /* Параметры-свойства конструктора Node не поддерживает (стирание типов),
       поэтому заглушка простая. */
    return { Notice: class { }, MarkdownView: class { } };
  }
  if (request === "@codemirror/state" || request === "@codemirror/view" || request === "@codemirror/language") {
    return new Proxy({}, { get: () => function (): unknown { return {}; } });
  }
  return origLoad.call(this, request, parent, isMain);
};

const { ConfigStore } = requireCjs("./core/config_store.js") as Any;
const su = requireCjs("./core/shared_utils.js") as Any;
const mount = requireCjs("./ui/editor/mount.js") as Any;
const configWrite = requireCjs("./core/config_write.js") as Any;

loader._load = origLoad;

let refreshes = 0;
const origRefresh = mount.refreshOpenEditors;
mount.refreshOpenEditors = (...a: Any[]): Any => { refreshes++; return origRefresh(...a); };

let passed = 0;
function ok(what: string): void { passed++; console.log("  ok " + what); }

async function run(): Promise<void> {
  const plugin: Any = {
    app: {},
    _lineTraceSeq: 0,
    getConfig: (): Any => plugin.store.getSnapshot(),
    initializeDevLogSession: async (): Promise<void> => {},
    closeDevLogSession: async (): Promise<void> => {},
    getLineTraceTxId: (): string => "",
    loadData: async (): Promise<Any> => ({ configVersion: 2, visual: { tags: {} } }),
    saveData: async (): Promise<void> => {},
  };
  plugin.store = new ConfigStore(plugin, {
    defaults: { configVersion: 2, visual: { tags: {} } },
    cloneJson: su.cloneJson,
    isObj: su.isObj,
    deepMerge: su.deepMerge,
    /* Миграция здесь не предмет: мерим, кто зовёт пересборку. */
    migrateConfig: (c: Any): Any => su.cloneJson(c),
    Notice: function (): void {},
    saveDebounceMs: 10,
  });
  await plugin.store.init();

  /* Тот же шов, которым панель пишет значение контрола. */
  const adapter = new ConfigStoreAdapter({
    getConfig: (): Any => plugin.store.getSnapshot(),
    subscribe: (l: Any): Any => plugin.store.subscribe(l),
    update: (mutator: (c: Any) => void, reason: string, opts?: Any): void => {
      plugin.store.update((prev: Any) => { mutator(prev); return prev; }, reason, opts);
    },
  } as never);

  /* ---- контроль: счётчик и правда считает --------------------------------- */
  refreshes = 0;
  configWrite.applyPatch(plugin, { pkm: { fields: { order: { left: ["a"] } } } }, "pkm:behavior:order");
  assert.equal(refreshes, 1, "патч своего блока зовёт пересборку заметок");
  ok("контроль: патч своего блока доходит до заметок");

  /* ---- предмет: обычная запись контрола до заметок не доходит -------------- */
  refreshes = 0;
  await adapter.set("visual.tags.textSizePct", 120);
  assert.equal(refreshes, 0,
    "обычная запись контрола зовёт пересборку заметок " + refreshes + " раз —"
    + " шов изменился: перечитайте объяснение у createTagVisualDecorationExtension");
  ok("обычная запись контрола пересборку заметок не зовёт");

  /* ---- причина, которую видит одна панель, заметок не трогает -------------- */
  refreshes = 0;
  configWrite.applyPatch(plugin, { ui: { activeSettingsTab: "visual" } }, "settings:tab");
  assert.equal(refreshes, 0, "переход по вкладке заметки не дёргает");
  ok("правка, которую видит одна панель, заметок не дёргает");

  /* ---- и приём внешней правки заметки пересобирает ------------------------- */
  refreshes = 0;
  plugin.loadData = async (): Promise<Any> => ({ configVersion: 2, visual: { tags: { textSizePct: 140 } } });
  const took = await configWrite.applyExternalChange(plugin);
  assert.equal(took, true, "контроль: внешняя правка и правда принята");
  assert.equal(refreshes, 1, "принятая снаружи правка доезжает до открытых заметок");
  ok("внешняя правка доходит до заметок наравне с патчем своего блока");

  console.log("Settings refresh road tests: OK (" + passed + " checks)");
}

run().catch((e) => {
  console.error(e && (e as Error).stack ? (e as Error).stack : String(e));
  process.exit(1);
});
