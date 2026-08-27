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
}

const here = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(here, "..", "..", "main.js");

/*
 * Хвост добавляется к исходнику, а не правит его: имена уже есть в области
 * видимости модуля, их надо только вынести наружу. Сам `main.js` от этого не
 * меняется, и проверка читает ровно тот код, который грузит Obsidian.
 */
const EXPORT_TAIL = "\n;module.exports.__internals = "
  + "{ migrateConfig, normalizePkmOrder, ensureBehaviorModesFromOrder, DEFAULT_CONFIG };\n";

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
    construct: () => ({}),
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
