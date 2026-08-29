/**
 * Настоящие внутренности плагина для проверок: `migrateConfig`,
 * `normalizePkmOrder` и всё, что они за собой тянут.
 *
 * Зачем это нужно. Проверки редактора Fields до сих пор гоняли записи через
 * самодельную нормализацию Order и самодельное слияние патчей. Дефект ссылки
 * от этого зазеленел дважды: на заглушке круговой обход проходил, а в vault
 * значение исчезало — потому что настоящий путь записи другой. Плагин пишет
 * через `deepMerge` из `src/core/shared_utils.js` и прогоняет **каждый** патч
 * через `migrateConfig` (`src/core/config_store.js`), а тот зовёт
 * `normalizePkmOrder` и `ensureBehaviorModesFromOrder`, которые правят
 * `leftMode.fields` / `rightMode.fields` сами.
 *
 * Подделать эти функции значит завести вторую реализацию и проверять её.
 * Поэтому здесь берётся сам `main.js`: он читается как есть и исполняется
 * своим же модульным загрузчиком, а наружу отдаются его собственные функции.
 * Единственное, что подменяется, — модуль `obsidian`: его в Node нет вовсе
 * (пакет содержит одни типы), а `main.js` требует его первой строкой.
 */

import Module from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as obsidianStub from "./obsidian_stub.ts";

type Any = ReturnType<typeof JSON.parse>;

export interface PluginInternals {
  migrateConfig: (raw: Any) => Any;
  normalizePkmOrder: (raw: Any) => Any;
  ensureBehaviorModesFromOrder: (cfg: Any) => void;
  DEFAULT_CONFIG: Any;
  /**
   * Контекст, который плагин передаёт конфиг-заметке. Собирается тем же
   * кодом и из тех же имён, что и в `main.js` (метод
   * `applyTagWheelConfigNote`), — иначе проверка гоняла бы свою проводку
   * вместо плагиновой.
   *
   * Снаружи приходят три вещи, и все три — граница с миром, а не логика:
   * `app` (чтение заметки из vault), `cfg` (снимок конфига) и `store`.
   */
  buildConfigNoteCtx: (o: { app: Any; cfg: Any; store: Any }) => Any;
  /**
   * Подгрузить разборщик и кодек заметки теми же загрузчиками, что и плагин.
   * Вне Obsidian они находят модули через `require` — первым делом загрузчик
   * пробует именно его, — так что подменять тут нечего.
   */
  loadConfigNoteModules: (app: Any) => Promise<void>;
  /** Кодек заметки: `buildTagWheelConfigMarkdown` и разбор обратно. */
  getTagWheelConfigCodec: () => Any;
  /* Разрешение цвета тега: те самые функции, которыми плагин решает, каким
     цветом рисовать токен в строке. */
  buildFieldTagVisualMap: (cfg: Any) => Any;
  buildGlobalTagVisualMap: (cfg: Any) => Any;
  readTagVisualRowByTokenMaps: (token: string, fieldMap: Any, userTags: Any, globalMap: Any) => Any;
  getTagVisualsFromConfig: (cfg: Any) => Any;
  resolveEffectiveTagVisualMode: (row: Any) => string;
  /** Виджет, которым плагин рисует токен Value в строке заметки. */
  TagVisualTokenWidget: Any;
  normalizeHexColorInput: (v: unknown) => string;
  /**
   * Хоткеи поля-даты для заметки конфигурации. Вынесены наружу, потому
   * что до 2026-08-29 они не находились никогда: менеджер хоткеев
   * спрашивали голым идентификатором команды вместо полного (PRD 10.4,
   * Б-11).
   */
  detectDateFieldHotkeys: (
    app: Any, cfg: Any, fieldId: string, pluginId?: string,
  ) => { increase: string; decrease: string };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(here, "..", "..", "main.js");

/*
 * Хвост добавляется к исходнику, а не правит его: имена уже есть в области
 * видимости модуля, их надо только вынести наружу. Сам `main.js` от этого не
 * меняется, и проверка читает ровно тот код, который грузит Obsidian.
 */
/*
 * Сборка контекста повторяет метод `applyTagWheelConfigNote` в `main.js`
 * поле в поле. Скопировано намеренно: если проводка там изменится, а здесь
 * нет, проверка начнёт врать — поэтому её сходство закреплено гейтом
 * `bootstrap_loader_tests.js`.
 */
const EXPORT_TAIL = "\n;module.exports.__internals = {\n"
  + "  migrateConfig, normalizePkmOrder, ensureBehaviorModesFromOrder, DEFAULT_CONFIG,\n"
  + "  getTagWheelConfigCodec, TagVisualTokenWidget, detectDateFieldHotkeys,\n"
  + "  buildFieldTagVisualMap, buildGlobalTagVisualMap, readTagVisualRowByTokenMaps,\n"
  + "  getTagVisualsFromConfig, resolveEffectiveTagVisualMode, normalizeHexColorInput,\n"
  + "  loadConfigNoteModules: async function (app) {\n"
  + "    await loadTagWheelConfigParserSafe(app);\n"
  + "    await loadTagWheelConfigCodecSafe(app);\n"
  + "  },\n"
  + "  buildConfigNoteCtx: function (o) {\n"
  + "    var helpers = getConfigNoteHelpers();\n"
  + "    return {\n"
  + "      app: o.app,\n"
  + "      cfg: o.cfg,\n"
  + "      tagWheelConfigCodec: getTagWheelConfigCodec(),\n"
  + "      store: o.store,\n"
  + "      readVaultText: readVaultText,\n"
  + "      getOrderStrictName: getOrderStrictName,\n"
  + "      isObj: isObj,\n"
  + "      cloneJson: cloneJson,\n"
  + "      collectTagSections: helpers.collectTagSections,\n"
  + "      getFieldById: helpers.getFieldById,\n"
  + "      extractFieldMetaMap: extractFieldMetaMap,\n"
  + "      rebuildTagValues: rebuildTagValues,\n"
  + "      rebuildSubtagValues: rebuildSubtagValues,\n"
  + "      denormTagToken: denormTagToken,\n"
  + "      getPrefixRulesFromCfg: helpers.getPrefixRulesFromCfg,\n"
  + "      collectCheckboxTokensFromMap: helpers.collectCheckboxTokensFromMap,\n"
  + "      deepMerge: deepMerge,\n"
  + "      syncCustomPrefixResolverBlock: helpers.syncCustomPrefixResolverBlock,\n"
  + "      normalizePkmOrder: normalizePkmOrder,\n"
  + "      CFG_H2_DATES: CFG_H2_DATES,\n"
  + "    };\n"
  + "  },\n"
  + "};\n";

/**
 * Заглушка CodeMirror: любое имя отдаёт функцию, от которой можно наследовать
 * и которую можно позвать. `main.js` объявляет виджеты декораций на верхнем
 * уровне, а настоящий пакет при загрузке требует браузерный `document`.
 */
function cmStub(): Any {
  const fn = function cmAny(): Any { return cmStub(); } as Any;
  return new Proxy(fn, {
    get: (target: Any, prop: string | symbol) => (prop === "prototype" ? target.prototype : cmStub()),
    apply: () => cmStub(),
    /*
     * Заглушка обязана вернуть объект С ПРАВИЛЬНЫМ прототипом наследника.
     * Плоский `{}` рвал цепочку: `class TagVisualTokenWidget extends
     * cmView.WidgetType` получал `this` без своих методов, и `toDOM` у
     * готового виджета не находился вовсе. Проверка при этом падала не на
     * поведении, а на том, что звать нечего.
     */
    construct: (_target: Any, _args: Any, newTarget: Any) =>
      Object.create((newTarget && newTarget.prototype) || Object.prototype),
  });
}

let cached: PluginInternals | null = null;

export function loadPluginInternals(): PluginInternals {
  if (cached) return cached;
  const src = fs.readFileSync(mainPath, "utf8") + EXPORT_TAIL;
  const platform = { ...obsidianStub, setIcon: () => {}, MarkdownView: class {} };
  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
    _nodeModulePaths: (dir: string) => string[];
  };
  const origLoad = loader._load;
  loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
    if (request === "obsidian") return platform;
    /* CodeMirror живёт в редакторе Obsidian и к записи настроек отношения не
       имеет: его модуль требует настоящий браузерный `document` уже при
       загрузке. Пустая заглушка тут ничего не подделывает — путь записи она
       не проходит. */
    if (request === "@codemirror/view" || request === "@codemirror/state") return cmStub();
    return origLoad.call(this, request, parent, isMain);
  };
  try {
    const mod = new (Module as unknown as new (id: string, parent: unknown) => {
      filename: string;
      paths: string[];
      exports: Any;
      _compile: (code: string, filename: string) => void;
    })(mainPath, null);
    mod.filename = mainPath;
    mod.paths = loader._nodeModulePaths(path.dirname(mainPath));
    mod._compile(src, mainPath);
    cached = mod.exports.__internals as PluginInternals;
  } finally {
    loader._load = origLoad;
  }
  if (!cached || typeof cached.migrateConfig !== "function") {
    throw new Error("main.js internals not available: migrateConfig missing");
  }
  return cached;
}
