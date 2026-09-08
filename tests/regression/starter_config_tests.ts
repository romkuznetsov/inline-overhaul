/**
 * Стартовый набор Fields свежей установки (PRD ПЗ1).
 *
 * **Что проверяется и почему именно так.** Дефект, который нашёл заказчик
 * 2026-09-05, звучал не «в конфиге нет ветки», а «предпросмотр показывает
 * `Status` и `Priority`, а таблица Fields пустая». Поэтому проверка читает
 * **то, что увидит человек**: список Fields читается моделью редактора
 * (`fields_model.ts`) — тем же кодом, который рисует таблицу, — а согласие
 * предпросмотра с таблицей спрашивается у `previewFields`, у её признака
 * `example`.
 *
 * **Ожидания выписаны отдельно от набора** (У-5): имена, стороны, типы и
 * значения перечислены здесь литералами. Импортируй проверка те же константы,
 * из которых собран набор, — она была бы зелёной при любом их содержимом.
 *
 * **Конфиг проезжает настоящую миграцию** (У-2): `loadConfig` отдаёт форму
 * версии 2, а `migrateConfig` из `main.js` гоняет её всеми тремя ступенями —
 * ровно так же, как при загрузке плагина и на каждом патче панели. Набор,
 * который не пережил бы третью ступень, здесь и покраснеет.
 */

import assert from "node:assert/strict";
import { setupGlobals, Setting, Notice, Modal } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { loadConfig, type VaultFiles } from "../../src/core/config_migration_v2.ts";
import { createFieldsModel } from "../../src/ui/settings/custom/fields_model.ts";
import deepStateModule from "../../src/core/order_deep_editor_state.js";
import { previewFields } from "../../src/ui/settings/custom/preview_data.ts";
import { contrastRatio, CONTRAST_FLOOR } from "../../src/ui/settings/custom/contrast.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";
import { buildDefaultConfig, getIn } from "../../src/ui/settings/types.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

const internals = loadPluginInternals();
const DEFAULTS = buildDefaultConfig(SCHEMA);
const deepState = deepStateModule as unknown as Any;

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

const PLUGIN_DIR = ".obsidian/plugins/inline-overhaul";

/** Файлы vault в памяти: тот же шов, каким модулю миграции их подаёт плагин. */
function vault(seed?: Record<string, string>): VaultFiles & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(seed || {}));
  return {
    store,
    exists: async (p: string) => store.has(p),
    read: async (p: string) => store.get(p) as string,
    write: async (p: string, d: string) => { store.set(p, d); },
    remove: async (p: string) => { store.delete(p); },
  };
}

/** Конфиг первой установки, проехавший все три ступени миграции. */
async function freshInstall(): Promise<{ cfg: Any; starterSet: boolean; state: string }> {
  const out = await loadConfig(vault(), PLUGIN_DIR);
  return {
    cfg: internals.migrateConfig(JSON.parse(JSON.stringify(out.config))),
    starterSet: Boolean(out.starterSet),
    state: String(out.state),
  };
}

/** Модель редактора Fields на этом конфиге — то, из чего рисуется таблица. */
function fieldsOf(cfg: Any): ReturnType<typeof createFieldsModel> {
  return createFieldsModel({
    plugin: { app: {}, getConfig: () => cfg, setConfigPatch: () => {} } as never,
    normalizePkmOrder: internals.normalizePkmOrder as never,
    pkmOrderFields: [] as string[],
    cfg: cfg as never,
    deepState,
  });
}

/** Контекст панели с этим конфигом: `previewFields` читает Fields через него. */
function ctxOf(cfg: Any): SettingsCtx {
  const ctx: Any = {
    get: (p: string) => getIn(DEFAULTS, p),
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
    platform: {
      Setting,
      Notice,
      Modal,
      setIcon: () => {},
      plugin: { app: {}, getConfig: () => cfg, setConfigPatch: () => {} },
      getConfig: () => cfg,
      normalizePkmOrder: internals.normalizePkmOrder,
      pkmOrderFields: [] as string[],
    },
  };
  return ctx as SettingsCtx;
}

/**
 * Верхние Values одного Field ровно в том виде, в каком их печатает таблица:
 * у тега — с решёткой, у ссылки — в скобках. Снимать оформление здесь нельзя:
 * тогда проверка перестанет замечать, что Field завели не того типа.
 */
function tokensOf(model: ReturnType<typeof createFieldsModel>, key: string): string[] {
  return model.valuesEditor(key).tree.map(row => String(row.token || ""));
}

async function run(): Promise<void> {
  console.log("Стартовый набор Fields (ПЗ1)");

  /* ---- 1. Свежая установка получает четыре Field ----------------------- */
  {
    const { cfg, starterSet, state } = await freshInstall();
    assert.equal(state, "absent", "конфига на диске не было");
    assert.equal(starterSet, true, "loadConfig обязан сказать, что положил набор");

    const rows = fieldsOf(cfg).listFields().filter(r => !r.parent);
    assert.deepEqual(
      rows.map(r => r.label),
      ["Status", "Priority", "Due", "Project"],
      "в таблице Fields видны четыре Field заказанного набора",
    );
    ok("свежая установка: в таблице Fields четыре Field, а не пусто");

    assert.deepEqual(
      rows.map(r => [r.label, r.side]),
      [["Status", "left"], ["Priority", "left"], ["Due", "right"], ["Project", "right"]],
      "Status и Priority в Left Block, Due и Project в Right Block",
    );
    ok("стороны: два Field слева от текста, два справа");

    assert.deepEqual(
      rows.map(r => [r.label, r.kind]),
      [["Status", "tag"], ["Priority", "tag"], ["Due", "element"], ["Project", "wikilink"]],
      "два тега, эмодзи-элемент и ссылка",
    );
    ok("типы: два тега, элемент и ссылка");
  }

  /* ---- 2. У каждого Field есть чем пользоваться сразу ------------------ */
  {
    const { cfg } = await freshInstall();
    const model = fieldsOf(cfg);

    assert.deepEqual(tokensOf(model, "Status"), ["#todo", "#doing", "#done"]);
    ok("Status: три значения");
    assert.deepEqual(tokensOf(model, "Priority"), ["#low", "#med", "#high"]);
    ok("Priority: три значения");
    assert.deepEqual(tokensOf(model, "Project"), ["[[Project A]]", "[[Project B]]"]);
    ok("Project: две ссылки-примера");

    /*
     * У эмодзи-элемента списка Values не бывает: панель показывает ему
     * маркер, формат и шаг. «Преднастроенное значение» для него — это
     * маркер и формат, их и спрашиваем у того же редактора, что их рисует.
     */
    const due = model.elementEditor("Due");
    assert.equal(due.emoji, "\u{1F4C5}", "у Due стоит календарь");
    assert.equal(due.format, "YYYY-MM-DD", "и формат даты");
    ok("Due: маркер и формат на месте");
  }

  /* ---- 3. Предпросмотр и таблица показывают одно и то же --------------- */
  {
    const { cfg } = await freshInstall();
    const shown = previewFields(ctxOf(cfg));
    assert.equal(shown.example, false,
      "на свежей установке предпросмотр показывает настоящие Fields, а не пример");
    assert.deepEqual(shown.fields.map(f => f.name), ["Status", "Priority", "Due", "Project"]);
    ok("предпросмотр показывает те же Fields, что таблица, и не помечает их примером");
  }

  /* ---- 4. Цвета значений читаемы ---------------------------------------- */
  {
    const { cfg } = await freshInstall();
    const model = fieldsOf(cfg);
    let checked = 0;
    for (const key of ["Status", "Priority"]) {
      const ve = model.valuesEditor(key);
      const fieldId = ve.parentFieldId;
      for (const row of ve.tree) {
        const visual = model.getValueVisual(fieldId, String(row.token || ""));
        const fill = String(visual.fillColor || "");
        const text = String(visual.textColor || "");
        assert.match(fill, /^#[0-9a-f]{6}$/i,
          key + " / " + row.token + ": заливка обязана быть #rrggbb — поле цвета другого не принимает");
        assert.match(text, /^#[0-9a-f]{6}$/i,
          key + " / " + row.token + ": цвет текста задан, иначе в светлой теме он пропадёт на заливке");
        const ratio = contrastRatio(fill, text);
        assert.ok(ratio >= CONTRAST_FLOOR,
          key + " / " + row.token + ": контраст " + ratio.toFixed(2) + ":1 ниже порога");
        checked++;
      }
    }
    assert.equal(checked, 6, "покрашены все шесть значений двух тегов");
    ok("шесть значений покрашены, и каждая пара проходит порог контраста");
  }

  /* ---- 5. Набор ставится один раз, и сброс его не возвращает ----------- */
  {
    /*
     * `Delete all my settings` пишет пустой конфиг и берёт умолчания из
     * миграции (`actions.ts`, `reset-settings`). Если набор однажды переедет
     * в `DEFAULT_CONFIG`, сброс начнёт его возвращать — и покраснеет здесь.
     */
    const afterReset = internals.migrateConfig({});
    const rows = fieldsOf(afterReset).listFields().filter(r => !r.parent);
    assert.deepEqual(rows.map(r => r.label), [],
      "после сброса Fields не остаётся: набор бывает только при первой установке");
    ok("сброс настроек стартовый набор не возвращает");
  }

  /* ---- 6. Второй запуск набор не переставляет --------------------------- */
  {
    /* Человек удалил все Fields и перезапустил Obsidian: файл на диске есть,
       и подсовывать ему набор заново нельзя — он их убрал нарочно. */
    const empty = JSON.stringify({ schemaVersion: 2 });
    const out = await loadConfig(vault({ [PLUGIN_DIR + "/data.json"]: empty }), PLUGIN_DIR);
    assert.equal(out.state, "read");
    assert.equal(out.starterSet, undefined, "файл был — набор не ставится");
    const rows = fieldsOf(internals.migrateConfig(out.config)).listFields().filter(r => !r.parent);
    assert.deepEqual(rows.map(r => r.label), []);
    ok("конфиг на диске есть и пуст: набор второй раз не приезжает");
  }

  /* ---- 7. Нечитаемый файл набором не лечится ---------------------------- */
  {
    /* У человека настройки были, файл побился (МГ6). Класть ему поверх
       аварии чужие Fields нельзя: он решит, что потерял свои. */
    const out = await loadConfig(
      vault({ [PLUGIN_DIR + "/data.json"]: "{ это не json" }), PLUGIN_DIR);
    assert.equal(out.state, "broken");
    assert.equal(out.starterSet, undefined, "у сломанного файла набора не бывает");
    const rows = fieldsOf(internals.migrateConfig(out.config)).listFields().filter(r => !r.parent);
    assert.deepEqual(rows.map(r => r.label), []);
    ok("нечитаемый конфиг: набор не подставляется");
  }

  /* ---- 8. Переезд с версии 1 набора не получает ------------------------- */
  {
    /* У переезжающего Fields свои, и они приедут миграцией. */
    const v1 = JSON.stringify({
      schemaVersion: 1,
      pkm: {
        behavior: {
          order: {
            left: ["mine"], right: [],
            types: { mine: "tag" }, labels: { mine: "Mine" },
            strictNames: { mine: "mine" }, active: { mine: "yes" }, enabled: { mine: true },
          },
          leftMode: { fields: [{ id: "mine", prefix: "#", values: [{ token: "one", active: true }] }] },
        },
      },
    });
    const out = await loadConfig(vault({ [PLUGIN_DIR + "/data.json"]: v1 }), PLUGIN_DIR);
    assert.equal(out.state, "read");
    assert.equal(out.starterSet, undefined);
    const rows = fieldsOf(internals.migrateConfig(out.config)).listFields().filter(r => !r.parent);
    assert.deepEqual(rows.map(r => r.label), ["Mine"],
      "приехали Fields человека, и только они");
    ok("переезд с версии 1: свои Fields на месте, чужих не добавилось");
  }

  console.log("Проверок: " + passed);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
