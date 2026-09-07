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
  /**
   * Все команды плагина одним списком (10.5). Настоящая функция из `main.js`:
   * проверка справочника обязана спрашивать её, а не собирать список своей
   * копией правил — иначе она проверяет копию.
   */
  buildOwnCommandList: (plugin: Any) => Any[];
  normalizePkmOrder: (raw: Any) => Any;
  ensureBehaviorModesFromOrder: (cfg: Any) => void;
  DEFAULT_CONFIG: Any;
  /* Разрешение цвета тега: те самые функции, которыми плагин решает, каким
     цветом рисовать токен в строке. */
  buildFieldTagVisualMap: (cfg: Any) => Any;
  buildGlobalTagVisualMap: (cfg: Any) => Any;
  readTagVisualRowByTokenMaps: (token: string, fieldMap: Any, userTags: Any, globalMap: Any) => Any;
  getTagVisualsFromConfig: (cfg: Any) => Any;
  resolveEffectiveTagVisualMode: (row: Any) => string;
  /** Виджет, которым плагин рисует токен Value в строке заметки. */
  TagVisualTokenWidget: Any;
  /* Сканер токенов строки и правило стиля блока: ими плагин решает, кому
     достанутся прозрачность и размер текста (И-2.2). */
  scanLineVisualTokens: (text: string, sep1: string, sep2: string, markers: readonly Any[]) => Any[];
  buildElementMarkersFromConfig: (cfg: Any) => Any[];
  /* Отрезок, который забирает себе слой TagWheel: по нему слой пузырей
     узнаёт, что эти символы не его (B2). */
  tagwheelPanelSpanInLine: (text: string, colors: Any) => Any;
  /**
   * Один токен панели TagWheel без приставки. Слой панели больше не заменяет
   * отрезок целиком — он ставит пометки, — и виджет остался только на случае
   * спрятанных решёток (B2, 2026-09-02).
   */
  TagwheelTokenWidget: Any;
  /**
   * Что оформляется в панели TagWheel на одной строке и **чем**. Проверка
   * смотрит сюда, а не на отдельный виджет: дефект B2 был в том, что отрезок
   * подменялся целиком, а не в том, что нарисовал виджет. CodeMirror здесь не
   * участвует, поэтому утверждение можно выписать машиной.
   */
  tagwheelPanelSpans: (text: string, colors: Any, placeholders: Set<string>) => Any[];
  buildTagwheelPlaceholderSetFromConfig: (cfg: Any) => Set<string>;
  getTagwheelHeaderColorsFromConfig: (cfg: Any) => Any;
  buildBlockStyleCss: (entry: Any, visuals: Any) => string;
  computeTagVisualStyle: (textSizePct: number, bubbleWidthPct: number, bubbleHeightPct: number, shapePct: number) => Any;
  TAG_EMPTY_BUBBLE_BASE_PX: number;
  /* Имя Field, каким его увидит заметка конфигурации (1.3.1). */
  getOrderStrictName: (cfg: Any, orderKey: string) => string;
  /* Отметки на строке: подсветка обработанной и `Floating button` (10.13.12). */
  getSourceMarksFromConfig: (cfg: Any) => Any;
  lineHasProcessedToken: (text: string, token: string) => boolean;
  FloatingTransformButtonWidget: Any;
  normalizeHexColorInput: (v: unknown) => string;
  /* Каретка: цвет, толщина и мерцание. Выключенная половина группы не
     объявляет ничего, и тогда своё берёт тема (10.13.33). */
  buildCaretStyleCss: (look: Any) => string;
  caretLookFromConfig: (cfg: Any) => Any;
  caretBlinkMsFromSpeed: (speed: number) => number;
  /* Своя каретка на строке без выделения (10.13.33 Ц9). */
  caretShapeActive: (plugin: Any) => boolean;
  caretLayerRangeFor: (plugin: Any, state: Any) => Any;
  /* Цвета панели, которыми и правда красят: пусто — переменная темы. */
  resolveTagwheelPaintColors: (colors: Any) => Any;
  TAGWHEEL_THEME_COLOR_VARS: Record<string, string>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(here, "..", "..", "main.js");

/*
 * Хвост добавляется к исходнику, а не правит его: имена уже есть в области
 * видимости модуля, их надо только вынести наружу. Сам `main.js` от этого не
 * меняется, и проверка читает ровно тот код, который грузит Obsidian.
 */
const EXPORT_TAIL = "\n;module.exports.__internals = {\n"
  + "  migrateConfig, normalizeConfigV1, normalizeConfigV2, buildOwnCommandList,\n"
  + "  normalizePkmOrder, ensureBehaviorModesFromOrder, DEFAULT_CONFIG,\n"
  + "  TagVisualTokenWidget,\n"
  + "  scanLineVisualTokens, buildElementMarkersFromConfig, buildBlockStyleCss,\n"
  + "  tagwheelPanelSpanInLine, getTagwheelHeaderColorsFromConfig, TagwheelTokenWidget,\n"
  + "  tagwheelPanelSpans, buildTagwheelPlaceholderSetFromConfig,\n"
  + "  getOrderStrictName, getSourceMarksFromConfig, lineHasProcessedToken,\n"
  + "  FloatingTransformButtonWidget,\n"
  + "  computeTagVisualStyle, TAG_EMPTY_BUBBLE_BASE_PX,\n"
  + "  buildFieldTagVisualMap, buildGlobalTagVisualMap, readTagVisualRowByTokenMaps,\n"
  + "  getTagVisualsFromConfig, resolveEffectiveTagVisualMode, normalizeHexColorInput,\n"
  + "  resolveTagwheelPaintColors, TAGWHEEL_THEME_COLOR_VARS,\n"
  + "  buildCaretStyleCss, caretLookFromConfig, caretBlinkMsFromSpeed,\n"
  + "  caretShapeActive, caretLayerRangeFor,\n"
  + "};\n";

/**
 * Заглушка CodeMirror: любое имя отдаёт функцию, от которой можно наследовать
 * и которую можно позвать. `main.js` объявляет виджеты декораций на верхнем
 * уровне, а настоящий пакет при загрузке требует браузерный `document`.
 */
export function cmStub(): Any {
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
