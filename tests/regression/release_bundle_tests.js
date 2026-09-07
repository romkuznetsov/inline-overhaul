"use strict";

/**
 * Сборка релиза: что в ней есть и чего в ней быть не должно.
 *
 * **Чего здесь больше нет и почему.** До 2026-09-07 половина файла проверяла
 * мост модулей и реестр забандленных путей: что реестр покрывает все пути,
 * которые рантайм просит у vault; что реестр сильнее устаревшего кеша; что вне
 * Obsidian мост резолвит плагин-локальный путь через `require`, а в релизе эта
 * ветка мертва. Моста и реестра больше нет — модули приезжают литеральным
 * `require` (У-89), — и все эти утверждения потеряли предмет.
 *
 * **Но одно из них не исчезло, а стало сильнее.** Было: «каждый путь внутри
 * vault, который просит рантайм, лежит в реестре». Стало: **рантайм не просит
 * у vault ни одного пути**. Это то же требование в пределе, и проверяется оно
 * сплошным обходом (У-85), а не списком файлов.
 *
 * Остальное прежнее: состав папки `dist`, отсутствие локальных `require` в
 * бандле, наличие панели настроек и отсутствие старой.
 */

const assert = require("assert");
const fs = require("fs");
const Module = require("module");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");

function walkJs(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".js") ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => (
    walkJs(path.join(target, entry.name))
  ));
}

/**
 * Пути внутри vault, по которым рантайм просил бы модуль.
 *
 * Ищется тот же признак, каким его искала прежняя версия файла, — литерал вида
 * `.obsidian/plugins/inline-overhaul/<...>.js`. Разница в ожидании: раньше
 * каждый такой путь обязан был лежать в реестре, теперь их не должно быть
 * вовсе.
 *
 * Служебный файл правил под это не попадает: он `.md`, и читается он как
 * данные, а не как модуль.
 */
function collectRuntimeVaultModulePaths() {
  const files = [
    path.join(root, "main.js"),
    path.join(root, "navigation_runtime.js"),
    path.join(root, "pkm_runtime_v2.js"),
    ...walkJs(path.join(root, "pkm_v2")),
    ...walkJs(path.join(root, "src")),
  ];
  const pattern = /(?:\.\/)?(?:\.obsidian\/)?plugins\/inline-overhaul\/[^"'`\s]+\.js(?=["'`])/g;
  const found = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.match(pattern) || []) {
      found.push(`${path.relative(root, file).replace(/\\/g, "/")}: ${match}`);
    }
  }
  return { files: files.length, found };
}

async function run() {
  /*
   * Положительный контроль (У-88): обход обязан найти файлы, иначе «путей нет»
   * будет зелёным от пустоты.
   */
  const scan = collectRuntimeVaultModulePaths();
  assert.ok(scan.files > 30, `положительный контроль: обход нашёл файлы рантайма (${scan.files})`);
  assert.deepStrictEqual(
    scan.found.sort(),
    [],
    `рантайм не просит модуль по пути внутри vault (У-89):\n${scan.found.join("\n")}`,
  );

  const dist = path.join(root, "dist");
  const distMain = path.join(dist, "main.js");
  assert.ok(fs.existsSync(distMain), "dist/main.js exists");
  assert.ok(fs.existsSync(path.join(dist, "manifest.json")), "dist/manifest.json exists");
  assert.ok(!fs.existsSync(path.join(dist, "data.json")), "dist excludes data.json");
  assert.ok(fs.readFileSync(path.join(root, ".gitignore"), "utf8").split(/\r?\n/).includes("data.json"), ".gitignore excludes local data.json");
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(dist, "manifest.json"), "utf8")),
    JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")),
    "release manifest matches source manifest"
  );
  const sourceStyles = path.join(root, "styles.css");
  assert.strictEqual(fs.existsSync(path.join(dist, "styles.css")), fs.existsSync(sourceStyles), "styles.css copied only when source exists");
  const expectedAssets = sourceStyles && fs.existsSync(sourceStyles)
    ? ["main.js", "manifest.json", "styles.css"]
    : ["main.js", "manifest.json"];
  assert.deepStrictEqual(fs.readdirSync(dist).sort(), expectedAssets.sort(), "dist contains only BRAT release assets");

  const bundledSource = fs.readFileSync(distMain, "utf8");
  assert.ok(!/PrivateTaxonomySentinel/.test(bundledSource), "bundle contains no hardcoded private taxonomy sentinel");
  assert.ok(!/require\(["']\.\.?\//.test(bundledSource), "bundle has no local runtime require calls");
  const allowedExternals = new Set(["obsidian", "@codemirror/view", "@codemirror/state"]);
  const bundledRequires = Array.from(bundledSource.matchAll(/require\(["']([^"']+)["']\)/g), (match) => match[1]);
  const unexpectedRequires = Array.from(new Set(bundledRequires.filter((item) => !allowedExternals.has(item)))).sort();
  assert.deepStrictEqual(unexpectedRequires, [], `bundle has unexpected external requires: ${unexpectedRequires.join(", ")}`);

  /*
   * Мост модулей и его реестр: снятого в сборке быть не должно. Запрет
   * назван, а не подразумевается, и снимается он только тем, что плагин снова
   * начнёт читать модули из vault (У-71).
   */
  const bridgeMarks = [
    "__inlineOverhaulBundledVaultModules",
    "__inlineVaultModuleBridge",
    "vault_module_bridge",
  ];
  for (const mark of bridgeMarks) {
    assert.ok(!bundledSource.includes(mark), `bundle no longer contains the vault module bridge: ${mark}`);
  }
  assert.ok(
    !/new Function\(\s*["']module["']/.test(bundledSource),
    "bundle has no dynamic module eval left (A1)",
  );

  /*
   * Панель настроек теперь одна: старая удалена 2026-08-29. Значит собранный
   * файл обязан её содержать — иначе у человека не будет настроек вовсе, а
   * гейты этого не увидят: они гоняют исходники на заглушке, а не сборку.
   *
   * Признаки выбраны такие, которых больше нигде нет: заголовок группы из
   * схемы, фраза панели про версию Obsidian и класс своей вёрстки.
   */
  const paneMarks = [
    "Binder (custom insert commands)",
    "settings need Obsidian 1.13 or newer",
    "io-fieldsblock",
  ];
  for (const mark of paneMarks) {
    assert.ok(bundledSource.includes(mark), `bundle contains the settings pane: ${mark}`);
  }

  /*
   * И наоборот: старой панели в сборке остаться не должно. Признаки — только
   * имена из кода: её видимые тексты живут дальше в `searchTerms` новой схемы
   * (С4), и искать по ним значило бы искать не то.
   */
  const goneMarks = [
    "renderPkmConfigSections",
    "renderSettingsDisplaySection",
    "createSettingsSectionsRendererFallback",
    "hasValidSettingsSectionsRenderer",
  ];
  for (const mark of goneMarks) {
    assert.ok(!bundledSource.includes(mark), `bundle no longer contains the old pane: ${mark}`);
  }

  const originalLoad = Module._load;
  const baseClass = class {};
  Module._load = function (request, parent, isMain) {
    if (request === "obsidian") {
      return {
        Plugin: baseClass,
        PluginSettingTab: baseClass,
        Setting: baseClass,
        Notice: baseClass,
        Modal: baseClass,
        MarkdownView: baseClass,
        setIcon() {},
      };
    }
    if (request === "@codemirror/view") return { WidgetType: baseClass };
    if (request === "@codemirror/state") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(distMain)];
    const PluginExport = require(distMain);
    assert.strictEqual(typeof PluginExport, "function", "bundle exports plugin class");
  } finally {
    Module._load = originalLoad;
  }

  console.log(`Release bundle regression tests: OK (${scan.files} runtime files scanned, no vault module paths)`);
}

run().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
