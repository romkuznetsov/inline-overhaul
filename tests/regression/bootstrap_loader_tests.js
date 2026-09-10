"use strict";

const fs = require("fs");
const path = require("path");

function assertTrue(v, name) {
  if (!v) throw new Error(name + ": expected truthy");
}

function assertFalse(v, name) {
  if (v) throw new Error(name + ": expected falsy");
}

function assertEq(actual, expected, name) {
  if (actual !== expected) {
    throw new Error(name + ": expected '" + expected + "' got '" + actual + "'");
  }
}

function assertAnyMatch(source, patterns, name) {
  const src = String(source || "");
  const list = Array.isArray(patterns) ? patterns : [];
  for (const p of list) {
    if (p && p.test(src)) return;
  }
  throw new Error(name + ": expected at least one pattern to match");
}

function collectDeclaredIdentifiers(source) {
  const src = String(source || "");
  const out = new Set();
  const RESERVED = new Set(["true", "false", "null", "undefined", "NaN", "Infinity", "return", "if", "else", "for", "while", "switch", "case", "default", "function", "const", "let", "var"]);
  const addName = (name) => {
    const n = String(name || "").trim();
    if (!n) return;
    if (!/^[A-Za-z_$][\w$]*$/.test(n)) return;
    if (RESERVED.has(n)) return;
    out.add(n);
  };
  const addParamNames = (rawParam) => {
    const p = String(rawParam || "").replace(/=.*$/, "").trim();
    if (!p) return;
    if (/^[A-Za-z_$][\w$]*$/.test(p)) {
      addName(p);
      return;
    }
    if (/^\{[\s\S]*\}$/.test(p)) {
      let mm;
      const aliasRe = /\b([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\b/g;
      while ((mm = aliasRe.exec(p))) addName(mm[2]);
      const keyRe = /\b([A-Za-z_$][\w$]*)\b/g;
      while ((mm = keyRe.exec(p))) addName(mm[1]);
    }
  };

  let m;
  const fnDeclRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fnDeclRe.exec(src))) addName(m[1]);

  const fnAnyRe = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g;
  while ((m = fnAnyRe.exec(src))) {
    const raw = String(m[1] || "");
    const parts = raw.split(",");
    for (let i = 0; i < parts.length; i++) {
      addParamNames(parts[i]);
    }
  }

  const varRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g;
  while ((m = varRe.exec(src))) addName(m[1]);

  const arrowOneRe = /\b([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = arrowOneRe.exec(src))) addName(m[1]);

  const arrowManyRe = /\(([^)]*)\)\s*=>/g;
  while ((m = arrowManyRe.exec(src))) {
    const raw = String(m[1] || "");
    const parts = raw.split(",");
    for (let i = 0; i < parts.length; i++) {
      addParamNames(parts[i]);
    }
  }

  return out;
}

function findSuspiciousObjectValueRefs(source) {
  const src = String(source || "");
  const declared = collectDeclaredIdentifiers(src);
  const suspicious = [];
  const ignore = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);
  const pairRe = /\b([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g;
  let m;
  while ((m = pairRe.exec(src))) {
    const lhs = String(m[1] || "").trim();
    const rhs = String(m[2] || "").trim();
    if (!lhs || !rhs) continue;
    if (lhs !== rhs) continue;
    if (!rhs || ignore.has(rhs)) continue;
    if (declared.has(rhs)) continue;
    const upTo = src.slice(0, m.index);
    const lineNo = upTo.split(/\r?\n/).length;
    suspicious.push({ line: lineNo, expr: String(m[0] || "").trim() });
  }
  return suspicious;
}

function assertNoDanglingObjectValueRefs(source, name) {
  const bad = findSuspiciousObjectValueRefs(source);
  if (!bad.length) return;
  const top = bad.slice(0, 6).map((x) => `L${x.line}:${x.expr}`).join(", ");
  throw new Error(name + ": dangling object value refs detected: " + top);
}

function assertNoCanonicalOrderKeyLiteralsInRuntime(filePath, source) {
  const src = String(source || "");
  const banned = [
    /"importance"|'importance'/g,
    /"type"|'type'/g,
    /"category"|'category'/g,
    /"project"|'project'/g,
    /"date_due"|'date_due'/g,
    /"date_start"|'date_start'/g,
    /"type_sub"|'type_sub'/g,
    /"category_sub"|'category_sub'/g,
  ];
  const hits = [];
  for (const rx of banned) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(src)) !== null) {
      const idx = Number(m.index || 0);
      const line = src.slice(0, idx).split(/\r?\n/).length;
      hits.push(`L${line}:${String(m[0] || "")}`);
      if (hits.length >= 8) break;
    }
    if (hits.length >= 8) break;
  }
  if (hits.length) {
    throw new Error(`${filePath}: forbidden canonical key literals in runtime: ${hits.join(", ")}`);
  }
}

async function run() {
  const mainPath = path.join(__dirname, "..", "..", "main.js");
  const configMigrationPath = path.join(__dirname, "..", "..", "src", "core", "config_migration.js");
  const runtimeLiteralGuardPaths = [
    path.join(__dirname, "..", "..", "main.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "status_tags.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "status_date.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel_core.js"),
    path.join(__dirname, "..", "..", "src", "core", "pkm_rules_runtime_helpers.js"),
    path.join(__dirname, "..", "..", "src", "core", "date_runtime_shared.js"),
    path.join(__dirname, "..", "..", "src", "core", "tagwheel_rules_normalizer.js"),
    path.join(__dirname, "..", "..", "pkm_v2", "field_model.js"),
  ];
  const linePipelinePath = path.join(__dirname, "..", "..", "src", "core", "line_pipeline.js");
  const pkmMacroSharedPath = path.join(__dirname, "..", "..", "src", "core", "pkm_macro_shared.js");
  const pkmRulesHelpersPath = path.join(__dirname, "..", "..", "src", "core", "pkm_rules_runtime_helpers.js");
  const pkmRuntimeBootstrapPath = path.join(__dirname, "..", "..", "src", "core", "pkm_runtime_bootstrap.js");
  const pkmRuntimePreloadFacadePath = path.join(__dirname, "..", "..", "src", "core", "pkm_runtime_preload_facade.js");
  const pkmMacroRuntimeEntryPath = path.join(__dirname, "..", "..", "src", "core", "pkm_macro_runtime_entry.js");
  const pkmMacroRuntimeSharedPath = path.join(__dirname, "..", "..", "src", "core", "pkm_macro_runtime_shared.js");
  const pkmLineFinalizeUnifiedPath = path.join(__dirname, "..", "..", "src", "core", "pkm_line_finalize_unified.js");
  const pkmDomainRegistryPath = path.join(__dirname, "..", "..", "src", "core", "pkm_domain_registry.js");
  const fieldModelPath = path.join(__dirname, "..", "..", "pkm_v2", "field_model.js");
  const navigationRuntimePath = path.join(__dirname, "..", "..", "navigation_runtime.js");
  const statusRuntimeCommonPath = path.join(__dirname, "..", "..", "src", "core", "status_runtime_common.js");
  const statusLineRuntimeUnifiedPath = path.join(__dirname, "..", "..", "src", "core", "status_line_runtime_unified.js");
  const pkmRuntimeV2Path = path.join(__dirname, "..", "..", "pkm_runtime_v2.js");
  const rulesMarkdownBuilderPath = path.join(__dirname, "..", "..", "src", "features", "rules_markdown_builder.js");
  const commandIdsPath = path.join(__dirname, "..", "..", "src", "features", "command_ids.js");
  const commandRegistryPath = path.join(__dirname, "..", "..", "src", "features", "command_registry.js");
  const priorityStripEnginePath = path.join(__dirname, "..", "..", "src", "core", "priority_strip_engine.js");
  const priorityStripAdapterPath = path.join(__dirname, "..", "..", "src", "core", "priority_strip_cm6_adapter.js");
  const statusTagsPath = path.join(__dirname, "..", "..", "pkm_v2", "status_tags.js");
  const statusDatePath = path.join(__dirname, "..", "..", "pkm_v2", "status_date.js");
  const tagwheelPath = path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel.js");
  const tagwheelCorePath = path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel_core.js");
  const src = fs.readFileSync(mainPath, "utf8");
  /*
   * Слой оформления редактора — два модуля с 2026-09-07 (кусок второй
   * разбора A3). Утверждения о том, ГДЕ объявлено, читают их; о том, что
   * расширение доехало до регистрации, — по-прежнему `main.js`.
   *
   * Переведены они не по именам, а сплошным обходом: у каждого утверждения
   * о тексте `main.js` спросили, где теперь лежит его предмет. Иначе
   * `assertFalse` на переехавшее осталось бы зелёным и охраняло пустоту
   * (У-71).
   */
  const visualsSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "core", "editor_visuals_config.js"), "utf8");
  const decorSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "ui", "editor", "decorations.js"), "utf8");
  /* Порядок Fields и нормализация конфига — модули с 2026-09-07, кусок
     третий разбора A3. */
  const cfgSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "core", "config_normalize.js"), "utf8");
  const orderSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "core", "pkm_order_config.js"), "utf8");
  const devLogSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "core", "dev_log.js"), "utf8");
  const mountSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "ui", "editor", "mount.js"), "utf8");
  const commandsSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "plugin_commands.js"), "utf8");
  const rulesSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "generated_rules.js"), "utf8");
  const configWriteSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "core", "config_write.js"), "utf8");
  const bootstrapSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "features", "plugin_bootstrap.js"), "utf8");
  const configMigrationSrc = fs.readFileSync(configMigrationPath, "utf8");
  const linePipelineSrc = fs.readFileSync(linePipelinePath, "utf8");
  const pkmMacroSharedSrc = fs.readFileSync(pkmMacroSharedPath, "utf8");
  const pkmRulesHelpersSrc = fs.readFileSync(pkmRulesHelpersPath, "utf8");
  const pkmRuntimeBootstrapSrc = fs.readFileSync(pkmRuntimeBootstrapPath, "utf8");
  const pkmRuntimePreloadFacadeSrc = fs.readFileSync(pkmRuntimePreloadFacadePath, "utf8");
  const pkmMacroRuntimeEntrySrc = fs.readFileSync(pkmMacroRuntimeEntryPath, "utf8");
  const pkmMacroRuntimeSharedSrc = fs.readFileSync(pkmMacroRuntimeSharedPath, "utf8");
  const pkmLineFinalizeUnifiedSrc = fs.readFileSync(pkmLineFinalizeUnifiedPath, "utf8");
  const pkmDomainRegistrySrc = fs.readFileSync(pkmDomainRegistryPath, "utf8");
  const fieldModelSrc = fs.readFileSync(fieldModelPath, "utf8");
  const navigationRuntimeSrc = fs.readFileSync(navigationRuntimePath, "utf8");
  const statusRuntimeCommonSrc = fs.readFileSync(statusRuntimeCommonPath, "utf8");
  const statusLineRuntimeUnifiedSrc = fs.readFileSync(statusLineRuntimeUnifiedPath, "utf8");
  const pkmRuntimeV2Src = fs.readFileSync(pkmRuntimeV2Path, "utf8");
  const rulesMarkdownBuilderSrc = fs.readFileSync(rulesMarkdownBuilderPath, "utf8");
  const commandIdsSrc = fs.readFileSync(commandIdsPath, "utf8");
  const commandRegistrySrc = fs.readFileSync(commandRegistryPath, "utf8");
  /*
   * Редактор Fields и его помощники переехали в слой настроек (фаза 3b, пункт
   * 2), а записи в конфиг оттуда — в модель (пункт 4). Проверки по тексту
   * читают оба файла как один: разделение файлов — не изменение поведения.
   * Старой панели среди них больше нет, она удалена 2026-08-29.
   */
  /*
   * **С 2026-09-06 источник один — модель.** Пара была парой, пока во втором
   * файле лежала доска Order; доска снята вместе с фазой 6, и читать её
   * исходник больше нечем.
   *
   * Из двадцати двух утверждений по этой паре осталось шесть — те, чей предмет
   * переехал в модель, и они пошли за ним (У-56). Шестнадцать сняты, и вот что
   * с ними было. Двенадцать искали строку в исходнике доски: без доски они
   * покраснели бы честно — предмета нет. Ещё четыре были **запретами**
   * (`assertFalse`) — «в исходнике не должно быть такого-то старого контрола»,
   * — и вот они не покраснели бы никогда: запрет по пустому тексту зелен
   * всегда, и зелен он ровно тогда, когда сторожить уже нечего (У-71). Второй
   * вид опаснее первого, и заметен только при сплошном разборе.
   *
   * Куда переехала каждая гарантия, чтобы её не искали заново:
   *
   * | Что проверяли | Где это теперь |
   * |---|---|
   * | `readTagVisualsConfig` — чтение вида тегов | своя копия в `main.js`, оттуда рисует рантайм; `tag_visual_render_tests.ts` |
   * | тумблер `Show Color Settings` | снят целиком (Ф15); запрет на имя — в `REMOVED` в `docs_terms_tests.ts` |
   * | подпись `link` у типа Field | новый редактор, `fields_editor_view_tests.ts` |
   * | вывод привязки ссылки без отката на `allowedParentValues` | там же, и по поведению, а не по тексту |
   * | `renderUserTagsEditor`, заголовок `Color your Tags`, предупреждение про 300 тегов | блок `user-tag-list`, `user_tags_tests.ts` (14 проверок) |
   * | подсказка «цвета спрятаны, включите в Order» | текста нет: подвкладки `Order` не существует (Р5) |
   * | списки `Free roam` и `Active`, их наборы значений | схема выводится из прототипа, сверяется `gen_schema` и Г24 |
   * | путь к правилам TagWheel, размер журнала, эмодзи-умолчания элементов | снято вместе со старой панелью; схема их не объявляет, и Г7 не даст объявить |
   * | `custom` в видимости Value и placeholder `print` | новый редактор, `fields_editor_view_tests.ts` |
   */
  const fieldsModelSrc = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "ui", "settings", "custom", "fields_model.ts"), "utf8");
  const rendererPairSrc = fieldsModelSrc;
  const priorityStripEngineSrc = fs.readFileSync(priorityStripEnginePath, "utf8");
  const priorityStripAdapterSrc = fs.readFileSync(priorityStripAdapterPath, "utf8");
  for (const guardPath of runtimeLiteralGuardPaths) {
    const guardSrc = fs.readFileSync(guardPath, "utf8");
    assertNoCanonicalOrderKeyLiteralsInRuntime(path.relative(path.join(__dirname, "..", ".."), guardPath), guardSrc);
  }
  const statusTagsSrc = fs.readFileSync(statusTagsPath, "utf8");
  const statusDateSrc = fs.readFileSync(statusDatePath, "utf8");
  const tagwheelSrc = fs.readFileSync(tagwheelPath, "utf8");
  const tagwheelCoreSrc = fs.readFileSync(tagwheelCorePath, "utf8");

  assertTrue(/function\s+enforceOffModeFinalPrefix\(/.test(statusTagsSrc), "status_tags has off-mode final prefix guard");
  assertTrue(/lineFinalize\.enforceOffModeFinalPrefixUnified\(/.test(statusTagsSrc), "status_tags delegates off-mode final prefix behavior to shared core");
  assertTrue(/function\s+enforceOffModeFinalPrefixUnified\(/.test(pkmLineFinalizeUnifiedSrc), "shared finalize core owns off-mode final prefix behavior");
  assertTrue(/finalize\.enforceOffModeFinalPrefixUnified\(/.test(tagwheelSrc), "tagwheel delegates off-mode final prefix behavior to shared core");
  assertFalse(/function\s+enforceOffModeFinalPrefixTagWheel\(/.test(tagwheelSrc), "tagwheel does not duplicate off-mode final prefix behavior");

  assertNoDanglingObjectValueRefs(statusTagsSrc, "status_tags dangling-ref guard");
  assertNoDanglingObjectValueRefs(statusDateSrc, "status_date dangling-ref guard");
  assertNoDanglingObjectValueRefs(tagwheelSrc, "tagwheel dangling-ref guard");
  assertNoDanglingObjectValueRefs(tagwheelCoreSrc, "tagwheel_core dangling-ref guard");
  const linePipeline = require(linePipelinePath);
  const pkmMacroShared = require(pkmMacroSharedPath);
  const pkmMacroRuntimeShared = require(pkmMacroRuntimeSharedPath);
  const pkmMacroRuntimeEntry = require(pkmMacroRuntimeEntryPath);
  const pkmRulesHelpers = require(pkmRulesHelpersPath);
  const configMigration = require(configMigrationPath);
  const pkmRuntimeV2 = require(pkmRuntimeV2Path);
  const tagwheelCore = require(tagwheelCorePath);
  const lineFinalizerUnified = require(pkmLineFinalizeUnifiedPath);
  const priorityStripEngine = require(priorityStripEnginePath);
  const priorityStripAdapter = require(priorityStripAdapterPath);

  assertTrue(/buildStripSpecs\(/.test(priorityStripEngineSrc), "priority strip engine exports buildStripSpecs");
  assertTrue(/normalizeStripConfig\(/.test(priorityStripEngineSrc), "priority strip engine exports normalizeStripConfig");
  assertTrue(/buildStripDecorationRanges\(/.test(priorityStripAdapterSrc), "priority strip cm6 adapter exports buildStripDecorationRanges");
  assertTrue(typeof priorityStripEngine.buildStripSpecs === "function", "priority strip engine runtime export buildStripSpecs");
  assertTrue(typeof priorityStripEngine.normalizeStripConfig === "function", "priority strip engine runtime export normalizeStripConfig");
  assertTrue(typeof priorityStripAdapter.buildStripDecorationRanges === "function", "priority strip adapter runtime export buildStripDecorationRanges");

  assertEq(lineFinalizerUnified.normalizeCheckboxToken("[]"), "[ ]", "shared checkbox normalizer maps [] to [ ]");
  assertEq(lineFinalizerUnified.normalizeCheckboxToken("[   ]"), "[ ]", "shared checkbox normalizer trims blank checkbox token");
  assertEq(lineFinalizerUnified.normalizeCheckboxToken("[I]"), "[I]", "shared checkbox normalizer preserves non-empty token");

  /* Фикстуры разборщика и помощников конфиг-заметки сняты 2026-09-03
     вместе с ней: разбирать больше нечего (PRD 10.12). */


  assertTrue(/separator1:\s*"\|\|"/.test(cfgSrc), "default config contains separator1");
  assertFalse(/`📅DATE\/🕑TIME ➕ELEMENTS`/.test(orderSrc), "main has no hardcoded emoji section title for date\/time elements");
  assertFalse(/isTimeLike \? "🕒" : \(isDateLike \? "📅" : ""\)/.test(orderSrc), "main infer-element defaults have no hardcoded emoji markers");
  assertTrue(/separator2:\s*"\|\|"/.test(cfgSrc), "default config contains separator2");
  /*
   * Пин переехал за предметом (У-94): нормализатор ключа Order живёт в
   * `pkm_order_config.js` с куска третьего, а спрашивал этот пин **весь
   * текст main.js** — «есть ли где-нибудь `replace(` и где-нибудь
   * пробельный образец». Зелёным он был оттого, что и то и другое нашлось
   * в журнале разработчика; журнал уехал в свой модуль — и пин покраснел,
   * ничего при этом не сломав.
   */
  assertTrue(/function normalizeOrderFieldKey\(key\) \{/.test(orderSrc),
    "order key normalizer lives in the order module");
  assertTrue(/String\(key \|\| ""\)\.trim\(\)\.replace\(\/\\s\+\/g, " "\)/.test(orderSrc),
    "order key normalizer collapses whitespace");
  assertTrue(/\^\[a-z0-9_\\- \]\+\$/.test(orderSrc), "order key validators allow space-containing field ids");
  assertTrue(/function makeDefaultPkmOrder\(\)/.test(orderSrc), "default order factory exists");
  assertTrue(/left:\s*\[\]/.test(orderSrc), "default order config starts empty left");
  assertTrue(/right:\s*\[\]/.test(orderSrc), "default order config starts empty right");
  assertTrue(/hotkey_only/.test(orderSrc), "order active mode supports hotkey_only");
  assertTrue(/function getRulesSyncOrchestrator\(\)/.test(rulesSrc), "rules sync orchestrator getter exists");
  /*
   * Служебный файл правил и запись конфига уехали в свои модули (кусок
   * четвёртый разбора `main.js`, 2026-09-07). В точке входа остались швы:
   * подписка на хранилище и единственный путь записи настроек.
   */
  assertTrue(/__generatedRules\.registerStoreEvents\(plugin\);/.test(bootstrapSrc), "загрузка подписывается на хранилище через модуль");
  assertTrue(/return __configWrite\.applyPatch\(this, patchObj, reason\);/.test(src), "запись настроек идёт одним швом в модуль");
  assertTrue(/function getStoreEventsOrchestrator\(\)/.test(rulesSrc), "store events orchestrator getter exists");

  assertTrue(/function reportLoaderFallback\(stage, err\)/.test(commandsSrc), "main exposes debug-gated loader fallback reporter");
  /*
   * Тринадцать проверок сняты 2026-08-29 вместе со старой панелью: их
   * предмет -- ползунки вида тегов, тумблеры журнала и поле пути к нему --
   * уехал в схему, которая выводится из прототипа и закреплена своими
   * гейтами. Здесь их держать больше не на чем: исходника, в котором они
   * искались, нет.
   */
  assertTrue(/\^\[a-z0-9_\\- \]\+\$/.test(rendererPairSrc), "settings renderer allows spaces in name_strict validation");
  /*
   * Текст сообщения уехал в каталог (10.13.47), а ветка осталась: пин идёт
   * за текстом в его новый дом и спрашивает имя строки. Ловить здесь слова
   * значило бы держать пин на том, чего в файле больше нет (У-56).
   */
  assertTrue(/SAY\.ERR_LINK_NO_TARGET/.test(rendererPairSrc), "settings renderer fails fast when it cannot resolve the wikilink target field");
  assertTrue(/tokens\.push\(\{ value: `s:\$\{stok\}\|p:\$\{ptok\}\|f:\$\{fid\}`, label: `└ \$\{stok\} \(\$\{ptok\}\)` \}\);/.test(rendererPairSrc), "wikilink parent token selector disambiguates duplicate subtags by parent context");
  /*
   * **Три утверждения сняты 2026-09-06 вместе со своим предметом** (фаза 6,
   * пункт 1). Они стерегли отладочные сообщения трёх запасных путей загрузки
   * модуля: `loadVaultBridgeSafe.require`, `loadVaultBridgeSafe.vaultEval` и
   * `tryLoadWithVaultBridge.load`. Путей больше нет — в `main.js` остался
   * один, `require`, — и держать пин на сообщение из удалённой ветки значило
   * бы держать пин без предмета (У-56).
   *
   * На их месте — утверждение о **новом** состоянии, и оно сильнее: не «ветка
   * умеет рассказать о себе», а «ветки нет вовсе». Именно это и спрашивает
   * community review, и именно это молча вернётся первой же правкой, если не
   * стеречь.
   */
  {
    /* Читается живой код: строка комментария рядом со снятой веткой цитирует
       её имя, и это правильно — она говорит, чего там больше нет и почему. */
    const live = src.split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    assertFalse(/new Function/.test(live), "main.js снова выполняет код модуля через new Function (A1, фаза 6 пункт 1)");
    assertFalse(/\beval\(/.test(live), "main.js снова выполняет код через eval (A1)");
    assertFalse(/loadVaultBridgeSafe|tryLoadWithVaultBridge/.test(live), "main.js снова грузит модули мостом из vault");
    assertFalse(/uiVaultEvalFallback/.test(live), "ветка uiVaultEvalFallback вернулась — её не включал ни один вызов");
  }
  /*
   * Загрузка модулей плагина (фаза 6, пункт 1; дефект A33).
   *
   * **Здесь стояло сорок утверждений, и почти все описывали машинерию, которой
   * больше нет:** «загрузчик существует», «загрузчик позван в onload», «ключ
   * кеша заведён». Машинерия свёрнута в один статический `require` на модуль.
   * Пересаживать такие пины было нельзя: три из них держали не поведение, а
   * ЗАПРЕТ, зелёный именно тем, что предмет исчез (У-71), и один из этих трёх
   * прямо требовал того, что и стало дефектом:
   *
   *   * `const mod = require(requirePath)` — пин требовал ДИНАМИЧЕСКИЙ
   *     `require`. Путь в переменной esbuild не разрешает: в бандле такой вызов
   *     остаётся вызовом `require` хоста, а рядом с плагином лежит один плоский
   *     файл. Заказчик получил плагин без единой команды, и пин был зелёный;
   *   * `buildCoreCommandDefs: () => []` — пин на заглушку реестра команд. Эта
   *     заглушка отвечала утвердительно на свой же вопрос «годен ли модуль», и
   *     синхронная попытка `require` за ней не выполнялась никогда;
   *   * `class FallbackConfigStore` — пин на встроенную копию единственного пути
   *     записи конфига (A14).
   *
   * Вместо них стоят два утверждения, и они отвечают на разные вопросы.
   * **Причину** ловит сплошной обход всех `require` в `main.js`: каждый обязан
   * быть литералом, и перепись модулей сходится в обе стороны (У-85).
   * **Следствие** ловит `bundle_onload_tests.ts`: он включает СБОРКУ и
   * спрашивает у неё список команд — то, что видит человек в палитре.
   *
   * Чтобы это снять, должно случиться одно из двух: плагин перестал ставиться
   * плоским бандлом, или сборщик научился разрешать путь в переменной. Ни того,
   * ни другого не произошло.
   */
  {
    /* Читается код, а не проза: строка комментария рядом умеет процитировать
       снятый вызов, и это правильно — она говорит, чего там больше нет. */
    const code = src.split("\n").filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join("\n");
    const requireArgs = Array.from(code.matchAll(/\brequire\(([^)]*)\)/g), (m) => m[1].trim());
    /*
     * Положительный контроль: требования в точке входа есть, и их не одно.
     * Порог был `> 15` — до разбора класса плагина их было двадцать шесть.
     * Теперь одиннадцать: точка входа подключает ровно то, что зовёт сама
     * (кусок четвёртый разбора `main.js`, 2026-09-07). Порог обязан двигаться
     * за предметом, иначе он не контроль, а память о прошлом (У-94).
     */
    assertTrue(requireArgs.length > 8, "положительный контроль: require в main.js есть, и их много");
    const dynamic = requireArgs.filter((arg) => !/^"[^"]+"$/.test(arg));
    assertEq(dynamic.join(" | "), "", "каждый require в main.js — литерал (A33)");

    /*
     * Перепись модулей: слева то, что `main.js` подключает, справа — то, что
     * он обязан подключать. Список пишется здесь, а не выводится из файла:
     * выведенный из того же файла список сошёлся бы сам с собой всегда.
     *
     * **Список короче на десять имён** (кусок четвёртый разбора `main.js`,
     * 2026-09-07). Точка входа подключает ровно то, что зовёт сама; всё
     * остальное подключает тот модуль, который этим пользуется — движки и
     * реестр команд ушли к `plugin_commands`, слой оформления к `ui/editor`,
     * ключи и профиль совместимости к `core`. Сплошной обход требований
     * рантайма от этого не ослаб: он идёт по всем файлам, а не по `main.js`.
     */
    const own = Array.from(new Set(requireArgs
      .map((arg) => arg.replace(/^"|"$/g, ""))
      .filter((p) => p.startsWith("./")))).sort();
    const expected = [
      "./src/core/config_write.js",
      "./src/core/dev_log.js",
      "./src/core/shared_utils.js",
      "./src/features/enhanced_select_all_engine.js",
      "./src/features/generated_rules.js",
      "./src/features/plugin_bootstrap.js",
      "./src/features/plugin_commands.js",
      "./src/features/smart_delete_engine.js",
      "./src/ui/editor/styles.js",
    ];
    assertEq(own.join("\n"), expected.join("\n"), "main.js подключает ровно свои модули, и каждый один раз");

    /* Ни одного пути к модулю через папку плагина: их читал мост из vault. */
    assertFalse(/plugins\/inline-overhaul\/[^"']*\.js/.test(src), "в main.js не осталось путей к своим модулям через папку плагина");
  }

  /*
   * Заглушек модулей в `main.js` больше нет, и это запрет, а не наблюдение.
   * Заглушка, которая отвечает на свой же вопрос «годен ли модуль»
   * утвердительно, делает недостижимой загрузку — так и вышло с реестром
   * команд. Снимается этот запрет только тем, что модуль снова может не
   * доехать, то есть возвратом динамической загрузки.
   */
  assertFalse(/class FallbackConfigStore/.test(src), "встроенной копии ConfigStore в main.js нет (A14)");
  assertFalse(/buildCoreCommandDefs:\s*\(\)\s*=>\s*\[\]/.test(src), "заглушки реестра команд в main.js нет (A33)");
  assertFalse(/__safeModuleCache/.test(src), "своего кеша модулей нет: его помнит require");
  assertFalse(/loadModuleWithVaultFallback/.test(src), "общего загрузчика модулей нет");
  assertFalse(/async function load[A-Za-z]*Safe\(app\)/.test(src), "асинхронных загрузчиков модулей нет");
  assertFalse(/cacheKey/.test(src), "ключей кеша нет вместе с кешем");
  assertTrue(/function getCommandRegistry\(\)/.test(commandsSrc), "command registry getter exists");
  /*
   * Команды и их охрана уехали в `src/features/plugin_commands.js` (кусок
   * четвёртый разбора `main.js`, 2026-09-07). Восемь утверждений о них уехали
   * туда же и покраснели сами — искались они не по именам, а совпадением
   * образца по всем файлам рантайма (У-94). В `main.js` остались швы, их и
   * спрашиваем.
   */
  assertTrue(/__pluginCommands\.registerAll\(this\);/.test(src), "точка входа зовёт регистрацию команд из модуля");
  assertTrue(/return __pluginCommands\.ownCommandList\(this\);/.test(src), "справочник команд спрашивает тот же модуль");
  assertTrue(/return __pluginCommands\.runInlineToNote\(this\);/.test(src), "команда и плавающая кнопка ходят одним швом");
  assertTrue(/function getConfigStoreCtor\(\)/.test(bootstrapSrc), "config store ctor getter exists");
  /*
   * Обёртка над модулем миграции уехала из точки входа вместе со своим
   * единственным вызовом: спрашивает миграцию `config_normalize.js`, он же
   * её и подключает (кусок четвёртый разбора `main.js`).
   */
  assertTrue(/getConfigMigrationV2Module/.test(cfgSrc), "config migration getter exists");
  assertTrue(/function getEnhancedSelectAllEngine\(\)/.test(src), "enhanced select-all getter exists");
  assertTrue(/function getRulesMarkdownBuilder\(\)/.test(rulesSrc), "rules markdown builder getter exists");
  assertTrue(/publishPkmMacroRuntimeEntry\(\);/.test(bootstrapSrc), "onload публикует шов макро-рантайма PKM");
  /*
   * Загрузка уехала в `src/features/plugin_bootstrap.js` (кусок четвёртый
   * разбора `main.js`, 2026-09-07): порядок в ней — требование, а не список
   * дел, и линтер точку входа не видит вовсе (PRD 12). В `main.js` остался
   * вызов — им Obsidian и запускает плагин.
   */
  assertTrue(/async onload\(\) \{\s*return __bootstrap\.load\(this\);\s*\}/.test(src),
    "точка входа зовёт загрузку одним швом");
  assertTrue(/plugin\.navRuntime = __pluginCommands\.navigationRuntime\(\);/.test(bootstrapSrc), "onload берёт движок навигации");
  assertTrue(/plugin\.pkmRuntimeV2 = __pluginCommands\.pkmRuntime\(\);/.test(bootstrapSrc), "onload берёт движок PKM");
  /*
   * Мост модулей снят целиком (У-89): модули команд приезжают литеральным
   * `require`, и своего кеша у загрузки больше нет — кешем является сам граф
   * сборки. Пин на «зовёт мост со своим ключом кеша» предмета лишился.
   */
  assertTrue(/statusTags: require\("\.\/pkm_v2\/status_tags\.js"\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 requires the statusTags macro literally");
  assertTrue(/statusDate: require\("\.\/pkm_v2\/status_date\.js"\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 requires the statusDate macro literally");
  assertTrue(/tagWheel: require\("\.\/pkm_v2\/TagWheel\/tagwheel\.js"\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 requires the tagWheel macro literally");
  assertFalse(/loadVaultModule/.test(pkmRuntimeV2Src), "and does not load a module by a vault path at all");


  /*
   * Загрузчики роутера вкладок и рендерера секций сняты 2026-08-29 вместе со
   * старой панелью: этих модулей больше нет. Панель настроек теперь одна, и
   * проверяется то, что запасного пути к старой у неё не осталось.
   */
  assertTrue(/function getDeclarativeSettingTabCtor\(\)/.test(bootstrapSrc), "declarative settings pane loader exists");
  assertTrue(/require\("\.\.\/ui\/settings\/obsidian_tab\.ts"\)/.test(bootstrapSrc), "settings pane is loaded from the settings layer");
  assertTrue(/const Declarative = getDeclarativeSettingTabCtor\(\);/.test(bootstrapSrc), "createSettingTab asks the loader every time");
  assertFalse(/newSettingsPane/.test(src), "the settings pane flag is gone: there is nothing to choose between");
  assertFalse(/InlineOverhaulSettingTab/.test(src), "the old settings tab class is gone");
  /*
   * addSettingTab стоит внутри onload: исключение оттуда роняет загрузку
   * плагина целиком — ни команд, ни рантайма. Панель важна, но не настолько.
   */
  assertTrue(/const tab = createSettingTab\(plugin\);[\s\S]{0,80}if \(tab\) plugin\.addSettingTab\(tab\);/.test(bootstrapSrc),
    "a settings pane that failed to build does not break onload");
  assertFalse(/throw new Error\("inlineOverhaul: settings pane/.test(src),
    "createSettingTab reports the failure instead of throwing out of onload");

  /*
   * Схема идентификатора команды живёт в одном модуле (`command_ids.js`), и
   * реестр её не повторяет: из трёх копий вырос дефект Б-11. Проверяется не
   * шаблон строки, а то, что реестр спрашивает модуль.
   */
  assertTrue(/__commandIds\.pkmFieldCommandId\(strict, dir, usedIds\)/.test(commandRegistrySrc), "command registry asks the shared module for field command IDs");
  assertFalse(/inlineOverhaul_/.test(commandRegistrySrc), "command registry has no legacy command ID of its own");
  /*
   * **Старую форму идентификатора помнит карта, а не функция** (ревизия
   * 2026-09-09). Пин стоял на теле `legacyPkmFieldCommandId`, и это был пин не
   * на своём предмете (У-56): карту переименования читают двое — уведомление
   * о смене хоткеев (`plugin_bootstrap.js`) и документ
   * `docs/command_ids_v1_v2.md`, — и оба берут `RENAME_RULES`, а функцию не
   * звал никто. Она была третьим объявлением того же правила, мёртвым, с
   * комментарием «нужен карте переименования» — то есть утверждением о
   * состоянии, которое врало (У-64). Функция снята, пин переехал на предмет.
   */
  assertTrue(/\["inlineOverhaul_Hotkey_<field>_increase", "<field>-next"\]/.test(commandIdsSrc),
    "карта переименования помнит старую форму идентификатора команды поля");
  assertTrue(/\["inlineOverhaul_Binder_<name>", "<name>"\]/.test(commandIdsSrc),
    "и старую форму идентификатора строки Binder");
  assertFalse(/function legacyPkmFieldCommandId\(/.test(commandIdsSrc),
    "третье объявление старой формы не вернулось: её помнит только RENAME_RULES");
  assertTrue(/\["inlineOverhaul_Navigation_MoveUp", "move-line-up"\]/.test(commandIdsSrc), "rename map carries the fixed commands");
  assertFalse(/inlineOverhaul_PKM_/.test(commandRegistrySrc), "command registry has no legacy PKM command IDs");
  assertTrue(/cycle_field:importance|cycle_field:\$\{key\}/.test(commandRegistrySrc), "importance hotkeys route through generic cycle_field action");
  assertFalse(/"statusImportance"/.test(commandRegistrySrc), "command registry no longer binds importance hotkeys to statusImportance runtime");
  assertFalse(/command === "statusImportance"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 has no statusImportance command route");
  assertFalse(/status_importance\.js/.test(pkmRuntimeV2Src), "pkm_runtime_v2 no longer loads status_importance module");

  assertTrue(/command registry unavailable: core commands skipped/.test(commandsSrc), "core skip guard exists");
  assertTrue(/command registry unavailable: navigation commands skipped/.test(commandsSrc), "navigation skip guard exists");
  assertTrue(/command registry unavailable: PKM commands skipped/.test(commandsSrc), "pkm skip guard exists");
  assertTrue(/const moveKeys = \[key\];/.test(rendererPairSrc), "модель Fields: перетаскивание собирает связку ключей");
  assertTrue(/const subKey = getSubKeyForParent\(key\);/.test(rendererPairSrc), "модель Fields: у родителя находится ключ дочернего");
  assertTrue(/target\.splice\(idx, 0, \.\.\.moveKeys\);/.test(rendererPairSrc), "модель Fields: родитель и дочерний встают вместе");


  assertTrue(/buildRulesMarkdown: \(cfg\) => getRulesMarkdownBuilder\(\)\.buildTagWheelRulesMarkdownFromConfig\(cfg\)/.test(rulesSrc), "rules sync uses extracted rules markdown builder");
  /*
   * Здесь стояли три запрета на написание внутри разбора текста для
   * правил — «не режет ведущую косую», «нет догадки про project», «разбор
   * чекбокса не сужен до [ ] и [x]». Сняты 2026-09-07 вместе с предметом:
   * восемь функций той связки не звал никто, и запреты были зелены именно
   * потому, что сторожить было нечего (У-71).
   *
   * Куда переехало то, что они держали: знак чекбокса — сплошной обход
   * ниже в этом же файле (A34, ровно один знак), ведущая косая у #/1 —
   * движки PKM и их проверки поведения, разбор ссылки — Field типа
   * wikilink в редакторе Fields.
   */


  assertTrue(/normalizePkmBehaviorShape\(cfg, \{ cloneJson, isObj \}\)/.test(cfgSrc), "migrateConfig applies behavior shape normalization");
  /*
   * Здесь стоял `assertTrue(/return "element"/)` — «модель Fields относит
   * ключи вида даты к типу element». Утверждение было верно про **текст**
   * файла и неверно про продукт, и охраняло оно заплатку внутри мёртвого кода
   * (У-56, У-58, У-71): ветку `element` отдавала запасная копия внутри
   * `keyKind`, которую не звал никто ни в одном коммите с первого релиза, а
   * достаться она могла бы только при отказе модуля, лежащего в бандле.
   * Настоящее правило типа знает `wikilink` и `tag`, а `element` — не знает.
   *
   * Пин переписан на то, что верно: **тип ключа Order решается в одном
   * месте**, и модель Fields своего ответа на этот вопрос не заводит (У-32).
   */
  /*
   * Комментарии снимаются: запрет про **код**, а не про объяснение, почему
   * кода нет. Первая версия этой строки покраснела на собственном абзаце в
   * `field_model.js`, где эти слова названы — та же половина вопроса, о
   * которой У-108.
   */
  const fieldModelCode = fieldModelSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assertFalse(/inferOrderFieldType|wikilink|element/.test(fieldModelCode),
    "модель Fields не объявляет своего правила о типе ключа Order: правило живёт в pkm_domain_registry.js");
  assertTrue(/wikilink/.test(pkmDomainRegistrySrc),
    "положительный контроль: правило о типе ключа действительно лежит в pkm_domain_registry.js");
  assertFalse(/return "date"/.test(fieldModelSrc), "field model has no legacy date kind token");
  assertFalse(/createFieldModelFromOrder/.test(fieldModelSrc), "field model has no dead createFieldModelFromOrder export");
  assertTrue(/const deprecatedRules = Array\.isArray\(__compatProfile\.DEPRECATED_CONFIG_KEYS\?\.rules\)/.test(cfgSrc), "migrateConfig resolves deprecated rules keys from shared compat profile module");
  assertTrue(/__compatProfile\.isCompatEnabled\("ENABLE_CONFIG_MIGRATION_SHIMS"\)/.test(cfgSrc) && /cfg\.pkm\.generatedRulesPath = String\(cfg\.rules\.tagWheelPath\)\.trim\(\);/.test(cfgSrc), "migrateConfig keeps migration-only shim for rules.tagWheelPath when compat flag enabled");
  assertFalse(/cfg\.pkm\.sourceOfTruth\s*=/.test(cfgSrc), "migrateConfig no longer writes dead pkm.sourceOfTruth field");
  assertFalse(/cfg\.pkm\.autoGenerateRules\s*=/.test(cfgSrc), "migrateConfig no longer writes dead pkm.autoGenerateRules field");
  /* Снято 2026-09-06 вместе с предметом: общий загрузчик `main.js` мостом
     больше не пользуется, и «канонический путь через мост» проверять не на
     чем (У-56). Кеш `__inlineOverhaulMainModuleCache` ушёл вместе с ним.
     Новое состояние стережёт блок выше — «путь один, и это `require`». */
  assertFalse(/console\.log\("\[inline-overhaul\] loaded"\)/.test(src), "main has no unconditional production console.log on plugin load");
  assertTrue(/cfg\.pkm\.behavior\.io\.separator1 = s1 \|\| DEFAULT_CONFIG\.pkm\.behavior\.io\.separator1;/.test(cfgSrc), "migrateConfig normalizes separator1");
  assertTrue(/cfg\.pkm\.behavior\.io\.separator2 = s2 \|\| DEFAULT_CONFIG\.pkm\.behavior\.io\.separator2;/.test(cfgSrc), "migrateConfig normalizes separator2");
  /*
   * Разделители доезжают до перехода по заголовкам, а не спрашиваются у ветки,
   * в которой их нет.
   *
   * Здесь остался пин по ИСХОДНИКУ, потому что предмет — шов между командой и
   * движком: цепочку рвал не расчёт, а то, что `pickJumpCfg` не называл эти
   * поля, а команда их не передавала. Сам результат — позиция курсора —
   * закреплён поведением в `navigation_jumps_tests.js`, и это главный пин.
   *
   * Прежний пин здесь сверял строку про «configurable separator1 fallback» и
   * был зелёный ровно столько, сколько режим `End of your text` не работал ни
   * у кого (замечание заказчика 2026-09-04, У-53).
   */
  assertTrue(/function pickJumpCfg\(cfg, lineFormat\)/.test(navigationRuntimeSrc), "jump cfg accepts the line format alongside the jump branch");
  assertTrue(/separator2: sep\(lf\.separator2, sep\(c\.separator2, separator1\)\),/.test(navigationRuntimeSrc), "jump cfg carries both separators, second defaulting to the first");
  assertTrue(/const second = s\.indexOf\(sep2, first \+ sep\.length\);/.test(navigationRuntimeSrc), "section-end cursor looks for the second separator with the second separator");
  assertTrue(/rt\.jumpToHeader\(ed, "up", nav\.jumpToHeader, getLineFormat\(fullCfg\)\);/.test(commandRegistrySrc), "jump-back hands the line format to the runtime");
  assertTrue(/rt\.jumpToHeader\(ed, "down", nav\.jumpToHeader, getLineFormat\(fullCfg\)\);/.test(commandRegistrySrc), "jump-next hands the line format to the runtime");
  /* Тот же шов у переноса выделенного текста: тумблер `Continue past a
     Separator` без разделителей ничего не ограничил бы. */
  assertTrue(/rt\.moveSelection\(ed, "left", nav\.moveSelection, getLineFormat\(fullCfg\)\);/.test(commandRegistrySrc), "move-left hands the line format to the runtime");
  assertTrue(/rt\.moveSelection\(ed, "right", nav\.moveSelection, getLineFormat\(fullCfg\)\);/.test(commandRegistrySrc), "move-right hands the line format to the runtime");
  /*
   * Тридцать четвёртое исключение к З3 (замечание заказчика 2026-09-08): часть
   * слова уезжает за пределы своего слова, если это разрешено тумблером.
   *
   * Поведение закреплено в `navigation_jumps_tests.js` — оба направления, оба
   * положения тумблера, — и это главный пин. Здесь спрашивается то, чего с
   * поведения не видно: **что именно** изменилось в файле под запретом, то
   * есть один аргумент решения о шаге и одно имя в сборщике правил. Без имени
   * в сборщике настройка до движка не доезжает молча (У-56).
   */
  assertTrue(/if \(!neighborInDirection\) return wordEscape === true \? "char" : "noop";/.test(navigationRuntimeSrc),
    "отказ на краю слова снимается тумблером, а не убран совсем");
  assertTrue(/inlineWordEscape: typeof c\.inlineWordEscape === "boolean" \? c\.inlineWordEscape : false,/.test(navigationRuntimeSrc),
    "сборщик правил переноса называет ключ тумблера и держит выключенное умолчание");
  assertTrue(/if \(!isObj\(cfg\.pkm\.behavior\.freeRoam\)\) cfg\.pkm\.behavior\.freeRoam = cloneJson\(DEFAULT_CONFIG\.pkm\.behavior\.freeRoam\);/.test(cfgSrc), "migrateConfig initializes freeRoam behavior block");
  assertTrue(/if \(typeof fr\.minimalSeparator !== "boolean"\) fr\.minimalSeparator = DEFAULT_CONFIG\.pkm\.behavior\.freeRoam\.minimalSeparator;/.test(cfgSrc), "migrateConfig normalizes minimalSeparator toggle");
  assertTrue(/if \(typeof fr\.minimalPrefix !== "boolean"\) fr\.minimalPrefix = DEFAULT_CONFIG\.pkm\.behavior\.freeRoam\.minimalPrefix;/.test(cfgSrc), "migrateConfig normalizes minimalPrefix toggle");
  assertTrue(/fr\.fullPlacement = \["smart", "left", "right"\]\.includes\(place\)/.test(cfgSrc), "migrateConfig normalizes fullPlacement");
  assertTrue(/devMode:\s*\{[\s\S]*generateAiLog:\s*true[\s\S]*logPath:\s*"InlineOverhaul_DevLog"/.test(cfgSrc), "default config includes simplified devMode fields with AI log toggle");
  assertTrue(/if \(!isObj\(cfg\.devMode\)\) cfg\.devMode = cloneJson\(DEFAULT_CONFIG\.devMode\);/.test(cfgSrc), "migrateConfig initializes devMode block");
  /*
   * Переименования старой формы читают ИСХОДНЫЙ файл, а не слитый с
   * умолчаниями: `deepMerge(DEFAULT_CONFIG, source)` кладёт новый ключ раньше,
   * чем код успевает спросить старый, и до 2026-08-31 все они были мертвы.
   */
  assertTrue(/const fromFile = \(dotted\) => \{/.test(cfgSrc), "первая ступень читает исходный файл помощником fromFile");
  assertTrue(/const own = fromFile\("devMode\.generateAiLog"\);/.test(cfgSrc), "generateAiLog спрашивается у исходного файла");
  assertTrue(/const oldSize = String\(fromFile\("devMode\.logSize"\) \|\| ""\)\.trim\(\);/.test(cfgSrc), "и старое имя logSize тоже");
  assertTrue(/const legacyCycle = fromFile\("navigation\.moveSelection\.leftToRight"\);/.test(cfgSrc), "цикл Prefix берёт старое имя из исходного файла");
  assertTrue(/pickPct\(B \+ "tagTextSizePct", \[B \+ "tagSizePct"\]/.test(cfgSrc), "размер тегов берёт старое имя из исходного файла");
  assertTrue(/const deprecatedDevMode = Array\.isArray\(__compatProfile\.DEPRECATED_CONFIG_KEYS\?\.devMode\)/.test(cfgSrc), "migrateConfig resolves deprecated devMode keys from shared compat profile module");
  assertTrue(/for \(const key of deprecatedDevMode\) delete cfg\.devMode\[key\];/.test(cfgSrc), "migrateConfig drops deprecated devMode keys through centralized loop");
  assertTrue(/devLog: \(event, payload\) => plugin\.devLogEvent\(event, payload, "info", cfg\)/.test(commandsSrc), "runPkmRuntimeV2 forwards devLog callback into runtime");
  /*
   * Журнал разработчика уехал в `src/core/dev_log.js` (кусок четвёртый разбора
   * `main.js`, 2026-09-07). Утверждения о его устройстве переехали туда же:
   * `assertTrue` на переехавшее краснеет сам, и все семь покраснели (У-94).
   * В `main.js` осталось три шва — их и спрашиваем здесь.
   */
  assertTrue(/return __devLog\.event\(this, eventName, payload, level, cfg\);/.test(src),
    "devLogEvent — шов к модулю: его зовут слой редактора и TagWheel");
  assertTrue(/return __devLog\.startSession\(this, cfg\);/.test(src), "начало сессии — шов к модулю");
  assertTrue(/return __devLog\.closeSession\(this, cfg, forceWrite\);/.test(src), "конец сессии — тоже");
  assertTrue(/function logPathParts\(dm\) \{/.test(devLogSrc), "модуль журнала разбирает путь записи");
  assertTrue(/function logFilePath\(parts, role, ts\) \{/.test(devLogSrc), "и собирает имя файла со временем");
  assertTrue(/async function listLogFiles\(adapter, parts\) \{/.test(devLogSrc), "и перечисляет прежние записи");
  assertTrue(/function trimAiLogContent\(content, dm\) \{/.test(devLogSrc), "машинная запись обрезается по времени и числу");
  assertTrue(/function trimHumanLogContent\(content, dm\) \{/.test(devLogSrc), "человеческая — тоже");
  assertTrue(devLogSrc.includes("const maybeDir = /\\/$/.test(asForward);"), "путь, кончающийся косой, читается как папка");
  assertTrue(/async function ensureDirectoryForFilePath\(adapter, filePath\)/.test(devLogSrc), "папки под запись создаются до записи");
  assertTrue(/try \{\s*await plugin\.initializeDevLogSession\(plugin\.getConfig\(\)\);\s*\} catch \(e\)/.test(bootstrapSrc), "onload guards dev-log session init with fail-open try/catch");
  assertTrue(/await plugin\.initializeDevLogSession\(plugin\.getConfig\(\)\);/.test(bootstrapSrc), "onload initializes dev log session rotation");
  assertTrue(/session\.start/.test(devLogSrc) && /session\.end/.test(devLogSrc), "модуль журнала пишет начало и конец сессии");
  assertTrue(/if \(!wasEnabled && isEnabled\) \{[\s\S]*initializeDevLogSession\(after\)/.test(configWriteSrc), "setConfigPatch starts new dev log session on dev_mode ON transition");
  assertTrue(/if \(wasEnabled && !isEnabled\) \{[\s\S]*closeDevLogSession\(before, true\)/.test(configWriteSrc), "setConfigPatch closes dev log session on dev_mode OFF transition");
  assertTrue(/if \(wasEnabled && isEnabled && \(beforePath !== afterPath \|\| beforeAi !== afterAi\)\) \{[\s\S]*dev-mode-log:reinit/.test(configWriteSrc), "setConfigPatch reinitializes log session when path or AI toggle changes while enabled");
  assertTrue(/if \(mdLine\) await writeLine\(plugin, dm, "md", mdLine\);/.test(devLogSrc), "человеческая запись пишется всегда");
  assertTrue(/if \(aiLine\) await writeLine\(plugin, dm, "ndjson", aiLine\);/.test(devLogSrc), "машинная — когда её включили");
  assertTrue(/const marker = String\(elemCfg\.emoji \|\| inferElementDefaultsByKey\(key\)\.marker \|\| ""\)\.trim\(\);/.test(orderSrc), "ensureBehaviorModesFromOrder syncs custom element marker from behavior config");
  /*
   * Сборка заметки правил живёт в одном месте. Копия в `main.js` снята
   * 2026-08-31: форма документа правил осталась версии 1, конфиг переехал на
   * версию 2, и перекладка значений между ними — ровно то, что нельзя
   * держать в двух экземплярах.
   */
  assertFalse(/buildTagWheelRulesMarkdownFromConfig\(cfg\) \{[\s\S]*tagwheel-behavior/.test(src), "main has no second copy of the rules note builder");
  assertTrue(/behavior\.defaultMode = String\(fields\.defaultBlock \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "right" \? "right" : "left";/.test(rulesMarkdownBuilderSrc), "rules builder maps pkm.fields.defaultBlock into the rules document");
  assertTrue(/behavior\.subtagFormat = behaviorCfg\.childTagFormat === "combined"/.test(rulesMarkdownBuilderSrc), "rules builder maps pkm.behavior.childTagFormat into the rules document");
  /* 10.13.6: подсветка строки приходит настройкой, а ветка `ui` больше не
     отдаётся пустой. `showMarkers` внутри `activePanel` — обёртки `{TW}`, а не
     тумблер списка, и записи ему здесь быть не должно (Н4). */
  assertTrue(/activePanel\.useHighlight = wheel\.highlightLine === true;/.test(rulesMarkdownBuilderSrc), "rules builder maps visual.tagWheel.highlightLine into the rules document");
  /*
   * 1.3.1: правило имени Field объявлено в двух файлах, и они обязаны
   * совпадать буквой в букву. Разошлись — переименование молча откатывается,
   * а панель об этом не знает. Поведение держит
   * `fields_editor_config_roundtrip_tests.ts`, форму — этот пин.
   */
  {
    const fieldsModelSrc = fs.readFileSync(path.join(__dirname, "..", "..", "src", "ui", "settings", "custom", "fields_model.ts"), "utf8");
    const inMain = /const STRICT_FIELD_NAME_RE = (\/.+\/i?);/.exec(orderSrc);
    const inPanel = /const STRICT_NAME_RE = (\/.+\/i?);/.exec(fieldsModelSrc);
    assertTrue(!!inMain, "config normalizer names the Field-name rule in one place");
    assertTrue(!!inPanel, "the panel names the Field-name rule in one place");
    assertEq(inMain[1], inPanel[1], "panel and config agree letter for letter on what a Field may be called");
    assertFalse(/\/\^\[a-z0-9_-\]\+\$\//.test(orderSrc), "the stricter second rule that silently reverted renames is gone");
  }
  assertFalse(/activePanel\.showMarkers\s*=/.test(rulesMarkdownBuilderSrc), "rules builder never writes the text wrappers of the active panel");
  assertFalse(/for \(const k of orderFields\) \{[\s\S]*if \(!rightSet\.has\(k\)\) continue;[\s\S]*out\.right = out\.right\.filter\(\(x\) => x !== k\);[\s\S]*out\.left\.push\(k\);[\s\S]*\}/.test(orderSrc), "normalizePkmOrder does not force right fields back to left by sub presence");

  assertTrue(/handleEnhancedSelectAllKeymap\(\) \{\s*return getEnhancedSelectAllEngine\(\)\.handleEnhancedSelectAllKeymap\(this\);\s*\}/.test(src), "enhanced select-all delegated to extracted engine");
  assertFalse(/function buildDefaultTagWheelDetailedTemplateMarkdown\(/.test(src), "no legacy codec wrapper buildDefault template in main");
  assertFalse(/function buildMinimalFromRenderedTemplate\(/.test(src), "no legacy codec wrapper buildMinimal in main");
  assertFalse(/cfg\.pkm\.legacy/.test(cfgSrc), "no direct cfg.pkm.legacy reads in main");
  assertFalse(/\|\|\s*s\s*===\s*"legacy"/.test(statusTagsSrc), "status_tags cursor policy has no legacy alias");
  assertFalse(/\|\|\s*s\s*===\s*"legacy"/.test(statusDateSrc), "status_date cursor policy has no legacy alias");
  assertFalse(/\|\|\s*s\s*===\s*'legacy'/.test(tagwheelSrc), "tagwheel cursor policy has no legacy alias");
  assertTrue(/collectMissingEmojiFieldsFromRules\(rules, dateRuntimeCfg\)/.test(tagwheelSrc), "tagwheel validates required Emoji before activation");
  assertTrue(/collectMissingEmojiFields\(rules, dateRuntimeCfg\)/.test(statusDateSrc), "status_date validates required Emoji before actions");
  assertFalse(/Object\.keys\(byField\)/.test(tagwheelSrc), "tagwheel emoji gate does not validate orphan byField keys outside active panel");
  assertFalse(/Object\.keys\(byField\)/.test(statusDateSrc), "status_date emoji gate does not validate orphan byField keys outside active panel");
  /*
   * Здесь стояли ещё два утверждения о том же разборе ссылки — про
   * неизвестный Field и про «ни один Field не объявлен ссылкой». Сняты
   * 2026-09-07 вместе с предметом: обе строки жили внутри
   * `parseWikilinkLineStrict`, которую не звал никто. Их и искать больше
   * негде — во всём репозитории эти сообщения были только тут (У-71).
   */
  assertTrue(/if \(!nonEmpty\(src\.emoji\) && Object\.prototype\.hasOwnProperty\.call\(dst, "emoji"\)\) out\.emoji = String\(dst\.emoji \|\| ""\);/.test(orderSrc), "runtime date serializer does not overwrite non-empty emoji with empty element emoji");
  assertTrue(/const modeRaw = String\(incCur\.mode \|\| "standard"\)\.trim\(\)\.toLowerCase\(\);/.test(orderSrc), "behavior sync preserves configured increment mode for elements");
  assertTrue(/mode,\s*incrementBy,\s*command,\s*customRaw,\s*custom/.test(orderSrc), "behavior sync writes normalized increment fields without forcing standard mode");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(app_, "loadLinePipeline"\)/, /await loadLinePipeline\(app_\);/], "status_tags preloads shared line pipeline");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(app_, "loadLinePipeline"\)/, /await loadLinePipeline\(app_\);/], "status_date preloads shared line pipeline");
  assertTrue(/linePipeline\.splitSegments\(line, rules\)|linePipeline\.splitSegments\(lineInput, runtimeRules\)|linePipeline\.splitSegments\(segLine, rules\)/.test(tagwheelSrc), "tagwheel split delegates to shared line pipeline");
  assertTrue(/linePipeline\.buildFromSegments\(seg, rules\)|linePipeline\.buildFromSegments\(seg, runtimeRules\)/.test(tagwheelSrc), "tagwheel render delegates to shared line pipeline");
  assertTrue(/function getControlCursorCh\(state, controlLine\)/.test(tagwheelSrc), "tagwheel control cursor uses cursorPolicy-aware helper");
  assertTrue(/state\.editor\.setCursor\(\{ line: state\.lineNumber, ch: getControlCursorCh\(state, control\) \}\)/.test(tagwheelSrc), "tagwheel updates cursor using cursorPolicy in active control mode");
  assertTrue(/linePipeline\.splitSegments\(rawLine, rules\)|linePipeline\.splitSegments\(line, rules\)|linePipeline\.splitSegments\(out, rules\)/.test(statusTagsSrc), "status_tags split delegates to shared line pipeline");
  assertTrue(/linePipeline\.splitSegments\(rawLine, rules\)|linePipeline\.splitSegments\(line, rules\)/.test(statusDateSrc), "status_date split delegates to shared line pipeline");
  assertTrue(/throw new Error\("line_pipeline unavailable: splitSegments"\);/.test(statusTagsSrc), "status_tags split fallback removed in favor of shared line pipeline");
  assertFalse(/function stripPrefixKeepIndent\(/.test(statusTagsSrc), "status_tags has no local stripPrefixKeepIndent wrapper");
  assertTrue(/linePipeline\.stripPrefixKeepIndent\(line, removeCheckbox\)/.test(statusTagsSrc), "status_tags cycle-end strip-prefix callback delegates to shared line-pipeline helper");
  assertTrue(/function getFieldFreeRoamMode\(orderCfg, fieldKey\)|statusCommon\.getFieldFreeRoamMode\(orderCfg, actionFieldKey\)/.test(statusTagsSrc), "status_tags resolves free roam mode via shared runtime common");
  assertFalse(/actionFieldKey\s*===\s*"type"/.test(statusTagsSrc), "status_tags has no hardcoded actionFieldKey type branch");
  assertFalse(/actionFieldKey\s*===\s*"category"/.test(statusTagsSrc), "status_tags has no hardcoded actionFieldKey category branch");
  assertTrue(/function getFreeRoamBehavior\(orderCfg\)|statusCommon\.getFreeRoamBehavior\(orderCfg\)/.test(statusTagsSrc), "status_tags resolves free roam behavior via shared runtime common");
  assertTrue(/targetPanel === "left" && freeRoamMode === "off"/.test(statusTagsSrc), "status_tags applies left text enforcement only for freeRoam off");
  assertTrue(/const mixedMinimalSeparatorOff = isPriorityAction && mixedPolicy\.applyMinimalSeparatorCollapse;/.test(statusTagsSrc), "status_tags defines mixed minimal-separator-off guard from shared mixed policy");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusTagsSrc), "status_tags gates trailing separator via shared trailing-separator policy helper");
  assertTrue(/function getFieldFreeRoamMode\(orderCfg, fieldKey\)|statusCommon\.getFieldFreeRoamMode\(orderCfg, actionFieldKey\)/.test(statusDateSrc), "status_date resolves free roam mode via shared runtime common");
  assertTrue(/function getFreeRoamBehavior\(orderCfg\)|statusCommon\.getFreeRoamBehavior\(orderCfg\)/.test(statusDateSrc), "status_date resolves free roam behavior via shared runtime common");
  assertTrue(/targetPanel === "left" && freeRoamMode === "off"/.test(statusDateSrc), "status_date applies left text enforcement only for freeRoam off");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusDateSrc), "status_date gates trailing separator via shared trailing-separator policy helper");
  assertTrue(/function applyMinimalLeftTagNormalization\(finalLine, state, core, options\)/.test(tagwheelSrc), "tagwheel exposes minimal-left normalization helper");
  assertTrue(/finalLine = applyMinimalLeftTagNormalization\(finalLine, state, core, \{[\s\S]*preserveExistingTokens:\s*hasOffSelected[\s\S]*\}\)\s*;?/.test(tagwheelSrc), "tagwheel applies minimal-left normalization in applySelection pipeline");
  assertTrue(/var hasOffSelected = !!policy\.hasOffSelected/.test(tagwheelSrc), "tagwheel derives off-mode selection from shared mixed policy");
  assertTrue(/if \(hasMinimalSelected\)\s*\{\s*finalLine = applyMinimalLeftTagNormalization\(finalLine, state, core, \{[\s\S]*preserveExistingTokens:\s*hasOffSelected/.test(tagwheelSrc), "tagwheel applies minimal normalization for mixed off+minimal selections with token preservation");
  assertTrue(/throw new Error\("line_pipeline unavailable: splitSegments"\);/.test(statusDateSrc), "status_date split fallback removed in favor of shared line pipeline");
  assertTrue(/throw new Error\('line_pipeline unavailable: splitSegments'\)/.test(tagwheelSrc), "tagwheel split fallback removed in favor of shared line pipeline");
  assertTrue(/throw new Error\('line_pipeline unavailable: buildFromSegments'\)/.test(tagwheelSrc), "tagwheel render fallback removed in favor of shared line pipeline");
  assertFalse(/\^\[📅🛫🕒⌛\]\\S\+\$/.test(linePipelineSrc), "line pipeline has no hardcoded emoji marker regex");
  assertFalse(/\[📅🗓️🛫🕒⌛\]/.test(pkmLineFinalizeUnifiedSrc), "line finalizer has no hardcoded emoji marker regex fallback");
  assertFalse(/return indent \+ left \+ ' ' \+ sep1/.test(tagwheelSrc), "tagwheel has no manual line assembly leftovers");
  assertTrue(/function enforceTextSegmentForLeftTag\(/.test(linePipelineSrc), "line pipeline exports enforceTextSegment helper");
  assertTrue(/function extractOriginalTextFromRawLine\(/.test(linePipelineSrc), "line pipeline exports extractOriginalText helper");
  assertTrue(/function relocateMarkerSetByFieldOrder\(/.test(linePipelineSrc), "line pipeline exports marker-set relocation helper");
  assertTrue(/function removeCombinedByParentTokens\(/.test(linePipelineSrc), "line pipeline exports combined-subtag cleanup helper");
  assertTrue(/function removeExactTokens\(/.test(linePipelineSrc), "line pipeline exports exact-token stripping helper");
  assertTrue(/function detectMarkerPanel\(/.test(linePipelineSrc), "line pipeline exports marker-panel detection helper");
  assertTrue(/function resolvePanelByMarkerPresence\(/.test(linePipelineSrc), "line pipeline exports marker-panel resolve helper");
  assertTrue(/function getPanelSearchText\(/.test(linePipelineSrc), "line pipeline exports panel search-text helper");
  assertTrue(/function removeDateTimeMarkers\(/.test(linePipelineSrc), "line pipeline exports date-time marker cleanup helper");
  assertTrue(/function collectDateLikeMarkersFromRules\(/.test(linePipelineSrc), "line pipeline exports date-like marker collection helper");
  assertTrue(/function removeTokensAcrossSegments\(/.test(linePipelineSrc), "line pipeline exports segment-wide token stripping helper");
  assertTrue(/function cleanOriginalTextForLeftDate\(/.test(linePipelineSrc), "line pipeline exports left-date original-text cleaner helper");
  assertTrue(/\^\\d\+\\\.\(\?:\\s\|\$\)/.test(linePipelineSrc), "line pipeline treats numbered prefixes with optional trailing space");
  assertTrue(/linePipeline\.enforceTextSegmentForLeftTag\(finalLine, rules, originalText\)/.test(statusTagsSrc), "status_tags text enforcement delegates to shared line-pipeline helper");
  assertTrue(/function normalizeCycleEndBehavior\(/.test(pkmMacroSharedSrc), "pkm macro shared exports cycle behavior normalizer");
  assertTrue(/function escapeRegex\(/.test(pkmMacroSharedSrc), "pkm macro shared exports regex escaper");
  assertTrue(/function segmentHasToken\(/.test(pkmMacroSharedSrc), "pkm macro shared exports segment token matcher");
  assertTrue(/function removeTokensFromSegment\(/.test(pkmMacroSharedSrc), "pkm macro shared exports segment token remover");
  assertTrue(/function removePatternFromSegment\(/.test(pkmMacroSharedSrc), "pkm macro shared exports segment pattern remover");
  assertFalse(/\[📅🗓️🛫🕒⌛\]/.test(pkmMacroSharedSrc), "pkm macro shared has no hardcoded emoji marker regex fallback");
  assertFalse(/"📅"|"🗓️"|"🛫"|"🕒"|"⌛"/.test(pkmRulesHelpersSrc), "pkm rules helper has no hardcoded emoji marker defaults");
  assertTrue(/function firstTokenByPattern\(/.test(pkmMacroSharedSrc), "pkm macro shared exports pattern token finder");
  assertTrue(/function getCursorForPanel\(/.test(pkmMacroSharedSrc), "pkm macro shared exports panel cursor helper");
  assertTrue(/function applyKeepBullet\(/.test(pkmMacroSharedSrc), "pkm macro shared exports keep-bullet helper");
  assertTrue(/function isNoContentParsed\(/.test(pkmMacroSharedSrc), "pkm macro shared exports no-content parsed helper");
  assertTrue(/function parseOrderConfig\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export order parser");
  assertTrue(/lead:\s*\{\}/.test(pkmRulesHelpersSrc), "order parser initializes lead container");
  assertTrue(/if \(src\.lead && typeof src\.lead === "object" && !Array\.isArray\(src\.lead\)\)/.test(pkmRulesHelpersSrc), "order parser reads lead config block");
  assertTrue(/lead:\s*isObj\(orderCfg && orderCfg\.lead\) \? \{ \.\.\.orderCfg\.lead \} : \{\}/.test(pkmRulesHelpersSrc), "applyOrderToRules preserves lead config in behavior order");
  assertTrue(/function resolvePanelForField\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export panel resolver");
  assertTrue(/function buildPanelOrderKeys\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export panel order builder");
  assertTrue(/function buildDateMarkers\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-markers builder");
  assertTrue(/function getDateFieldsFromRules\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-fields resolver");
  assertTrue(/function getDateValuePatterns\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date value-patterns helper");
  assertTrue(/function getDefaultDateLikeMarkers\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-like markers helper");
  assertTrue(/function isDateLikeToken\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-like token classifier");
  assertTrue(/function hasDateLikeMarkerInText\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date-like marker text classifier");
  assertTrue(/function removeMarkerTokensFromSegment\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export marker-token remover helper");
  assertTrue(/function getDateMarkersFromRules\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export date marker resolver");
  assertTrue(/function reorderSegmentTokensByOrder\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export segment reorder helper");
  assertTrue(/function getDefaultTagTokenKeyMapOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export default token-key-map options helper");
  assertTrue(/function getStatusTagReorderOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export status-tag reorder options helper");
  assertTrue(/function getStatusMixedReorderOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export status-mixed reorder options helper");
  assertTrue(/function getTagWheelMixedReorderOptions\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export tagwheel-mixed reorder options helper");
  assertTrue(/function buildTagTokenKeyMap\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export tag token-key map builder");
  /*
   * В-12: тумблер `Cycle in both directions` читается движком, а `isBullet`
   * больше не решает судьбу правой ветки в одиночку. Поведение держит
   * `navigation_prefix_cycle_tests.js`, форму — этот пин: ключ, который
   * никто не читает, уже стоял в панели и ничего не делал.
   */
  /*
   * 10.13.12: отметки на строке — декорации CM6. Расширение должно быть не
   * только создано, но и **примонтировано** к уже открытым редакторам: два
   * предыдущих расширения монтируются в двух местах, и третье, забытое в
   * одном из них, работало бы через раз.
   */
  assertTrue(/function buildSourceMarkDecorations\(/.test(decorSrc), "main registers the source-mark decorations");
  /*
   * Постановка расширений уехала в `src/ui/editor/mount.js` (кусок четвёртый
   * разбора `main.js`, 2026-09-07) — вместе с ней уехали и эти два
   * утверждения. Спрашивается то же самое: расширение создано и
   * примонтировано **везде**, где монтируются два соседних (У-94).
   */
  assertTrue(/plugin\._sourceMarksExtension = createSourceMarkDecorationExtension\(plugin\);/.test(mountSrc), "and builds the extension on load");
  assertEq((mountSrc.match(/_sourceMarksCompartment\.(of|reconfigure)\(/g) || []).length, 3, "and mounts it everywhere the other two are mounted");
  assertTrue(/__editorMount\.mountExtensions\(plugin\);/.test(bootstrapSrc), "и загрузка зовёт постановку один раз");
  assertTrue(/__editorMount\.refreshOpenEditors\(plugin\);/.test(configWriteSrc), "а пересборку — из записи патча конфига");
  /* Кнопка и команда ходят одним путём (Н9): у команды своего тела нет. */
  assertTrue(/callback: async \(\) => \{ await runInlineToNote\(plugin\); \},/.test(commandsSrc), "the transform command delegates to the shared method");
  assertTrue(/this\.plugin\.runInlineToNote\(\)/.test(decorSrc), "and so does the floating button");

  {
    const navSrc = fs.readFileSync(path.join(__dirname, "..", "..", "navigation_runtime.js"), "utf8");
    assertTrue(/rightCycles: typeof c\.rightCycles === "boolean"/.test(navSrc), "navigation runtime reads the both-directions toggle");
    assertTrue(/const rightMayCycle = rules\.prefixCyclerEnabled && rules\.rightCycles;/.test(navSrc), "navigation runtime decides the right-hand cycle from the toggle");
    assertFalse(/if \(currentIndent > 0 \|\| isBullet\(line\)\) \{/.test(navSrc), "a list item no longer goes straight to indenting");

    /*
     * Правило «где кончается слово» объявлено **один раз** — в
     * `src/core/shared_utils.js` (З-3, У-32). До 2026-09-08 оно жило здесь, а
     * ступени `word` расширенного `Ctrl+A` понадобилось то же самое: вторая
     * копия разошлась бы с первой молча, как это уже трижды случилось с
     * формами начала строки.
     *
     * Запрет идёт с положительным контролем: класс знаков обязан найтись в
     * `shared_utils.js`. Без него запрет зелен именно тогда, когда правила не
     * стало нигде (У-71).
     */
    const sharedSrc = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "core", "shared_utils.js"), "utf8");
    const selectAllSrc = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "enhanced_select_all_engine.js"), "utf8");
    const WORD_CLASS = /\[0-9A-Za-zА-Яа-яЁё_\]/;
    assertTrue(WORD_CLASS.test(sharedSrc), "правило «где кончается слово» живёт в shared_utils.js");
    assertTrue(/function isWordChar/.test(sharedSrc), "и объявлено там функцией isWordChar");
    assertFalse(WORD_CLASS.test(navSrc),
      "у движка навигации снова своя копия правила «где кончается слово» (У-32)");
    assertTrue(/__sharedUtils\.isWordChar\(/.test(navSrc),
      "движок навигации спрашивает правило у общего модуля");
    assertFalse(WORD_CLASS.test(selectAllSrc),
      "у движка `Ctrl+A` своя копия правила «где кончается слово» (У-32)");
    assertTrue(/__sharedUtils\.isWordChar/.test(selectAllSrc),
      "и он тоже спрашивает её у общего модуля");
  }
  {
    /*
     * Чей `placement` едет дальше (З-5). Ответ считается **один раз** —
     * `resolvePlacementSource`, — и дальше его обязаны взять все три места:
     * тело новой заметки, блок дописывания и сама запись. Место, оставшееся
     * с общей настройкой, молча игнорировало бы `Advanced settings` у
     * правила: поведение видно только на конкретном правиле, а тут его
     * ловит один взгляд в исходник (У-56).
     */
    const transformSrc = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "transform_feature.js"), "utf8");
    assertTrue(/const placementSource = resolvePlacementSource\(i2n, smartRule\);/.test(transformSrc),
      "чей placement работает, решается один раз");
    assertTrue(/composeBodyWithPlacement\(body, noteBlockText, placementSource, newline\)/.test(transformSrc),
      "тело новой заметки собирается по этому ответу");
    assertTrue(/composeAppendBlock\(noteBlockText, placementSource\)/.test(transformSrc),
      "блок дописывания — по нему же");
    assertTrue(/writeInline2Note\(plugin, target, noteContent, appendBlock, placementSource\)/.test(transformSrc),
      "и сама запись получает его же");
  }

  /* И-4: карта токенов читает обе корзины, иначе Field типа link не участвует
     в перестановке по Order и уезжает в конец блока. Пин на исходник, потому
     что чтение правой корзины легко потерять при следующей правке функции. */
  assertTrue(/const rightFields = rules && rules\.rightMode && Array\.isArray\(rules\.rightMode\.fields\)/.test(pkmRulesHelpersSrc), "tag token-key map reads the links bucket, not only the tags one");
  assertTrue(/addFieldTokens\(key, field, true\);/.test(pkmRulesHelpersSrc), "tag token-key map adds links-bucket tokens without overwriting the tags bucket");
  assertTrue(/function readRulesMarkdownWithFallback\(/.test(pkmRulesHelpersSrc), "pkm rules helpers export rules reader");
  /*
   * Прослойка макро-рантайма: один статический `require` на модуль (У-89).
   *
   * **Что здесь стояло раньше и куда ушло.** Семь пинов держали машинерию
   * загрузки через мост: `loadSharedModule`, `loadVaultModuleBridgeShared`,
   * `normalizeOrderKeyFallback` и по два сообщения отладочного отчёта на
   * каждый из двух файлов. Предмета у них больше нет — модули приезжают
   * литеральным `require`, — и **пин без предмета зелен именно тогда,
   * когда сторожить уже нечего** (У-71). Их гарантия переехала сюда: не
   * «обёртка загрузки на месте», а «в этих файлах нет ни одного `require`
   * по переменной». Это то самое утверждение, которое поймало бы A33.
   *
   * Чтобы это снять, должно случиться одно из двух: плагин перестал
   * ставиться плоским бандлом, или сборщик научился разрешать путь в
   * переменной. Ни того, ни другого не произошло.
   */
  {
    /*
     * Обход сплошной, а не по списку файлов (У-85): корень репозитория,
     * `src/**` и `pkm_v2/**`. Предмет может завестись в любом файле, и первая
     * версия этого запрета покрывала только четыре файла прослойки — мутация
     * «путь в переменной в `tagwheel_core.js`» её не роняла.
     */
    const repoRoot = path.join(__dirname, "..", "..");
    const walked = fs.readdirSync(repoRoot)
      .filter((name) => /\.js$/.test(name))
      .map((name) => path.join(repoRoot, name));
    for (const dir of ["src", "pkm_v2"]) {
      (function walk(target) {
        for (const name of fs.readdirSync(target)) {
          const abs = path.join(target, name);
          if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
          if (/\.(?:js|ts)$/.test(name)) walked.push(abs);
        }
      })(path.join(repoRoot, dir));
    }

    let total = 0;
    const dynamicRequires = [];
    for (const abs of walked) {
      /* Читается код, а не проза: комментарий умеет процитировать снятый вызов. */
      const text = fs.readFileSync(abs, "utf8");
      const code = text.split("\n").filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join("\n");
      const args = Array.from(code.matchAll(/\brequire\(([^)]*)\)/g), (m) => m[1].trim());
      total += args.length;
      for (const arg of args) {
        if (!/^"[^"]+"$/.test(arg) && !/^'[^']+'$/.test(arg)) {
          dynamicRequires.push(path.relative(repoRoot, abs) + ": " + arg);
        }
      }
    }
    assertTrue(walked.length > 50,
      "положительный контроль: обход нашёл файлы рантайма (" + walked.length + ")");
    assertTrue(total > 40,
      "положительный контроль: require в рантайме есть, и их много (" + total + ")");
    assertEq(dynamicRequires.join(" | "), "",
      "каждый require в рантайме — литерал, ни одного по переменной (A33, У-89)");

    /*
     * **И ни одной заглушки на месте модуля** — последний пункт фазы 6,
     * 2026-09-08. Пункт 1 фазы требовал снять все `hasValidX`, `loadXSafe`,
     * `createXFallback` и файлы `*_fallback.js`; из точки входа они ушли
     * 2026-09-07, а в слое настроек прожили ещё сутки — `fields_editor_legacy.js`
     * держал `hasValidOrderDeepEditorState` и
     * `createOrderDeepEditorStateUnavailable` при живом литеральном `require`.
     *
     * **Запрет по семье имён, а не по имени файла.** Файл можно переименовать,
     * а заглушку — завести заново под другим именем; ловится она тем, что
     * такой код всегда выглядит одинаково. Ищется по живому коду: комментарий
     * умеет процитировать снятое, и запрещать объяснения значило бы вычистить
     * ровно ту память, ради которой они написаны.
     *
     * Что означает заглушка на месте модуля, записано правилом: не «переживём
     * отказ», а «работаем наполовину и молчим» (У-90).
     */
    const STUB_NAME = /\b(hasValid[A-Z]\w*|load\w*Safe|create\w*(?:Fallback|Unavailable))\b/g;
    const stubs = [];
    for (const abs of walked) {
      const text = fs.readFileSync(abs, "utf8");
      const lines = text.split("\n");
      const code = lines.filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line)).join("\n");
      for (const m of code.matchAll(STUB_NAME)) {
        stubs.push(path.relative(repoRoot, abs) + ": " + m[1]);
      }
    }
    assertEq(stubs.join(" | "), "",
      "заглушка на месте модуля вернулась. Она означает не «переживём отказ», а "
      + "«работаем наполовину и молчим» (У-90): модуль лежит в бандле, не приехал — "
      + "плагин обязан упасть громко");

    /*
     * **И тот же запрет по форме, а не по имени** (Д-4, 2026-09-09).
     *
     * Запрет выше ищет по семье имён, и 2026-09-09 выяснилось, что этого мало:
     * шесть заглушек на месте модулей были **безымянными** — `const __x = (()
     * => { try { require(…) } catch (_) {} return {…копия правила…}; })()`. Имён
     * из семьи в них нет ни одного, и запрет их не видел ни дня. Тот самый
     * грех, о котором У-111: список имён проверяет список, а не предмет.
     *
     * Форма же у такого кода всегда одна: **свой `require` внутри `try`**.
     * Ищется она, а не имя.
     *
     * **Осталось одно место, и причина названа здесь же.** Молчаливый
     * список исключений и есть тот способ, каким «проверено автоматически»
     * превращается в «проверено ничего»; список с причинами — это разбор.
     *
     * Два места ушли отсюда 2026-09-10, первым куском В-97:
     * `pkm_rules_runtime_helpers.js` и `pkm_v2/field_model.js` держали ту же
     * заглушку, что снята 2026-09-09 вне З3, и заказчик разрешил снять её и
     * под З3. Держать их в списке дальше значило бы разрешать вернуть то,
     * чего уже нет.
     */
    const TRY_REQUIRE_ALLOWED = {
      "src/features/plugin_bootstrap.js":
        "вкладка настроек на TypeScript. Из исходников без esbuild файл не "
        + "разрешается, и набор берёт `main.js` именно так. Отказ не молчит: "
        + "он идёт в консоль с приставкой плагина",
    };
    const tryRequires = [];
    for (const abs of walked) {
      const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
      const text = fs.readFileSync(abs, "utf8");
      const lines = text.replace(/\/\*[\s\S]*?\*\//g, "").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!/^\s*try\s*\{\s*$/.test(lines[i])) continue;
        /* Окно в шесть строк: дальше это уже не обёртка вокруг загрузки. */
        const window = lines.slice(i + 1, i + 7).join("\n");
        if (!/\brequire\((["'])\.{1,2}\//.test(window)) continue;
        if (Object.prototype.hasOwnProperty.call(TRY_REQUIRE_ALLOWED, rel)) continue;
        tryRequires.push(rel + ":" + (i + 1));
      }
    }
    assertEq(tryRequires.join(" | "), "",
      "свой `require` внутри `try` — это заглушка на месте модуля, даже "
      + "безымянная (У-90, Д-4). Модуль лежит в бандле; не приехал — плагин "
      + "обязан упасть громко. Если место законно, назовите его причину в "
      + "`TRY_REQUIRE_ALLOWED`");
    /*
     * Положительный контроль на форму: без него «ни одного» выполняется само,
     * и первым же ложным успехом стало бы окно не той длины (У-88).
     */
    const shapeProbe = [
      "const __x = (() => {",
      "  try {",
      "    const mod = require(\"../core/say.js\");",
      "    if (mod) return mod;",
      "  } catch (_) {}",
      "  return null;",
      "})();",
    ].join("\n");
    const probeLines = shapeProbe.split("\n");
    let shapeHits = 0;
    for (let i = 0; i < probeLines.length; i++) {
      if (!/^\s*try\s*\{\s*$/.test(probeLines[i])) continue;
      if (/\brequire\((["'])\.{1,2}\//.test(probeLines.slice(i + 1, i + 7).join("\n"))) shapeHits += 1;
    }
    assertEq(shapeHits, 1, "образец формы не находит собственный пример — запрет выше мерит пустоту");
    /*
     * И контроль на сам список причин: он обязан быть занят. Опустел — значит
     * места разобраны, и список надо снять тем же коммитом, иначе он разрешает
     * вернуть то, чего уже нет.
     */
    let allowedSeen = 0;
    for (const abs of walked) {
      const rel = path.relative(repoRoot, abs).split(path.sep).join("/");
      if (!Object.prototype.hasOwnProperty.call(TRY_REQUIRE_ALLOWED, rel)) continue;
      const lines = fs.readFileSync(abs, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!/^\s*try\s*\{\s*$/.test(lines[i])) continue;
        if (/\brequire\((["'])\.{1,2}\//.test(lines.slice(i + 1, i + 7).join("\n"))) { allowedSeen += 1; break; }
      }
    }
    assertEq(allowedSeen, Object.keys(TRY_REQUIRE_ALLOWED).length,
      "в списке причин " + Object.keys(TRY_REQUIRE_ALLOWED).length + " файлов, а форма "
      + "нашлась в " + allowedSeen + ": разобранное обязано уйти из списка тем же коммитом");
    /*
     * Положительный контроль: сам образец умеет находить. Без него запрет
     * зелен и от опечатки в регулярном выражении — на пустом множестве
     * «ни одного» выполняется само (У-88).
     */
    const probe = "function hasValidThing(m) { return !!m } "
      + "function loadThingSafe() {} "
      + "function createThingUnavailable() {}";
    STUB_NAME.lastIndex = 0;
    const probeHits = Array.from(probe.matchAll(STUB_NAME), (m) => m[1]);
    assertEq(probeHits.join(","), "hasValidThing,loadThingSafe,createThingUnavailable",
      "образец заглушки не находит собственный пример — запрет выше мерит пустоту");
  }
  assertTrue(/function reportLoaderFallback\(stage, err\)/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exposes debug-gated loader fallback reporter");
  assertFalse(/function cycleStatusTags\(/.test(pkmRuntimeV2Src), "pkm_runtime_v2 no longer keeps legacy cycleStatusTags runtime path");
  assertFalse(/function cycleStatusDate\(/.test(pkmRuntimeV2Src), "pkm_runtime_v2 no longer keeps legacy cycleStatusDate runtime path");
  assertEq(typeof pkmRuntimeV2.runCommand, "function", "pkm_runtime_v2 exports runCommand entry");
  assertEq(typeof pkmRuntimeV2.loadPkmRules, "undefined", "pkm_runtime_v2 no longer exports legacy loadPkmRules helper");
  assertEq(typeof pkmRuntimeV2.cycleStatusTags, "undefined", "pkm_runtime_v2 no longer exports legacy cycleStatusTags helper");
  assertEq(typeof pkmRuntimeV2.cycleStatusDate, "undefined", "pkm_runtime_v2 no longer exports legacy cycleStatusDate helper");
  assertTrue(/function loadRuntimeBootstrap\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports bootstrap resolver");
  assertTrue(/function loadLinePipeline\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports line pipeline loader");
  assertTrue(/function loadMacroShared\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports macro loader");
  assertTrue(/function loadRulesRuntimeHelpers\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports rules helpers loader");
  assertTrue(/function resolveOrderConfig\(/.test(pkmRuntimePreloadFacadeSrc), "runtime preload facade exports order resolver");
  assertTrue(/function loadOrderKeyNormalizer\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports order-key normalizer loader");
  assertTrue(/function loadOrderConfigFromPluginData\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports plugin data order-config loader");
  assertTrue(/function resolveOrderConfig\(/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap exports order-config resolver");
  assertTrue(/const hasSettingsOrder = rawSettings !== undefined && rawSettings !== null/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap detects explicit settings order config");
  assertTrue(/if \(hasSettingsOrder\) \{\s*return parseOrderConfig\(rawSettings, normalizeKey\);\s*\}/.test(pkmRuntimeBootstrapSrc), "runtime bootstrap prioritizes settings order config over plugin data fallback");
  /*
   * Пин «мост экспортирует загрузчик» снят вместе с самим мостом: файла
   * `src/core/vault_module_bridge.js` больше нет. Что мост не вернулся,
   * держит запрет в `release_bundle_tests.js` — по СБОРКЕ, а не по
   * исходнику, — и запрет `require` по переменной ниже.
   */
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(ctxApp, "loadRuntimePreloadFacade"\)/, /loadRuntimePreloadFacade\(app_\)/], "status_tags uses runtime preload facade");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(ctxApp, "loadRuntimePreloadFacade"\)/, /loadRuntimePreloadFacade\(app_\)/], "status_date uses runtime preload facade");
  assertAnyMatch(tagwheelSrc, [/loadRuntimePreloadFacade\(\)/, /callRuntimeApi\(app_, 'loadRuntimePreloadFacade'\)/, /runtimeApi\.loadRuntimePreloadFacade/], "tagwheel uses runtime preload facade");
  assertTrue(/__inlineGetPkmMacroRuntime/.test(statusTagsSrc), "status_tags uses global reusable macro runtime getter");
  assertTrue(/__inlineGetPkmMacroRuntime/.test(statusDateSrc), "status_date uses global reusable macro runtime getter");
  assertTrue(/__inlineGetPkmMacroRuntime/.test(tagwheelSrc), "tagwheel uses global reusable macro runtime getter");
  /*
   * Реестр областей PKM точка входа больше не подключает: его спрашивают те
   * восемь файлов, которым он нужен, — от порядка Fields до TagWheel. Пин
   * переехал за предметом и спрашивает **сплошным обходом**: одно имя модуля
   * на весь рантайм, второго объявления быть не должно (У-94).
   */
  assertTrue(/require\("\.\/pkm_domain_registry\.js"\)/.test(orderSrc),
    "main loads canonical pkm domain registry module");
  assertTrue(/pkm_domain_registry\.js/.test(pkmRulesHelpersSrc), "rules runtime helpers reference canonical pkm domain registry module");
  assertTrue(/pkm_domain_registry\.js/.test(statusDateSrc), "status_date references canonical pkm domain registry module");
  assertTrue(/pkm_domain_registry\.js/.test(tagwheelSrc), "tagwheel references canonical pkm domain registry module");
  assertTrue(/status_runtime_common\.js/.test(statusTagsSrc), "status_tags references shared status runtime common module");
  assertTrue(/status_runtime_common\.js/.test(statusDateSrc), "status_date references shared status runtime common module");
  assertTrue(/date_runtime_shared\.js/.test(statusDateSrc), "status_date references shared date runtime module");
  assertTrue(/date_runtime_shared\.js/.test(tagwheelSrc), "tagwheel references shared date runtime module");
  assertTrue(/tagwheel_rules_normalizer\.js/.test(tagwheelCoreSrc), "tagwheel_core references shared rules normalizer module");
  assertTrue(/require\("\.\.\/src\/core\/pkm_line_finalize_unified\.js"\)/.test(statusDateSrc), "status_date requires the unified line finalizer literally (У-89)");
  assertTrue(/function createStatusRuntimeCommon\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared status runtime factory");
  assertTrue(/function resolvePanelKeyForField\(/.test(tagwheelSrc), "tagwheel defines panel-key resolver for field placement");
  assertTrue(/field\.dependsOn/.test(tagwheelSrc), "tagwheel panel-key resolver handles dependsOn inheritance for child fields");
  assertTrue(/function enforceDependentAdjacencyBySelection\(/.test(tagwheelSrc), "tagwheel defines dependent adjacency post-order pass");
  assertTrue(/finalLine = enforceDependentAdjacencyBySelection\(finalLine, state, core\)/.test(tagwheelSrc), "tagwheel applies dependent adjacency pass after reorder");
  assertTrue(/status(?:LineRuntime|Rt)\.enforceDependentAdjacencyForStatusLine\(\{/.test(tagwheelSrc), "tagwheel dependent adjacency pass delegates to shared status-line runtime helper");
  assertFalse(/function findTokenInBuckets\(/.test(tagwheelSrc), "tagwheel has no local dependent-adjacency bucket matcher logic");
  assertTrue(/function resolveOrderKeyFromFieldId\(/.test(pkmDomainRegistrySrc), "domain registry exports field->order resolver");
  assertTrue(/function resolveRightFieldIdByOrderKey\(/.test(pkmDomainRegistrySrc), "domain registry exports order->right-field resolver");
  assertFalse(/DEFAULT_(?:LEFT|RIGHT)_ORDER|DEFAULT_ORDER_KEYS|DEFAULT_ACTIVE|DEFAULT_ENABLED/.test(pkmDomainRegistrySrc), "domain registry has no built-in default order dictionaries");
  assertFalse(/ORDER_KEY_TO_(?:LEFT|RIGHT)_FIELD_ID_DEFAULT|BUILT_IN_(?:LEFT|RIGHT)_IDS|BUILT_IN_ORDER_KEYS|\bORDER_KEYS\b/.test(pkmDomainRegistrySrc), "domain registry has no canonical order-key dictionary exports");
  assertFalse(/DEFAULT_(?:LEFT|RIGHT)_ORDER|ORDER_KEY_TO_(?:LEFT|RIGHT)_FIELD_ID_DEFAULT/.test(pkmRulesHelpersSrc), "rules helpers do not depend on registry default key maps");
  assertFalse(/BUILT_IN_(?:LEFT|RIGHT)_IDS|BUILT_IN_ORDER_KEYS/.test(orderSrc), "main does not depend on registry built-in key dictionaries");
  assertFalse(/function resolveLegacyTagActionToOrderKey\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy tag-action resolver");
  assertFalse(/function resolveLegacyDateActionToOrderKey\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy date-action resolver");
  assertFalse(/function resolveLegacyDateActionDirection\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy date-action direction resolver");
  assertFalse(/function resolveLegacyDateActionMeta\(/.test(pkmDomainRegistrySrc), "domain registry has no legacy date-action meta resolver");
  assertTrue(/bootstrapMacroRuntime\(app_, normalizeOrderKeyLocal\)/.test(statusTagsSrc), "status_tags uses reusable macro runtime bootstrap call");
  assertTrue(/bootstrapMacroRuntime\(app_, normalizeOrderKeyLocal\)/.test(statusDateSrc), "status_date uses reusable macro runtime bootstrap call");
  assertTrue(/bootstrapMacroRuntime\(app_, normalizeOrderKeyLocal\)/.test(tagwheelSrc), "tagwheel uses reusable macro runtime bootstrap call");
  assertFalse(/async function loadMacroRuntimeEntry\(/.test(statusTagsSrc), "status_tags no longer defines local loadMacroRuntimeEntry pair function");
  assertFalse(/async function loadMacroRuntimeEntry\(/.test(statusDateSrc), "status_date no longer defines local loadMacroRuntimeEntry pair function");
  assertFalse(/async function loadMacroRuntimeEntry\(/.test(tagwheelSrc), "tagwheel no longer defines local loadMacroRuntimeEntry pair function");
  assertFalse(/async function loadMacroRuntimeShared\(/.test(statusTagsSrc), "status_tags no longer defines local loadMacroRuntimeShared pair function");
  assertFalse(/async function loadMacroRuntimeShared\(/.test(statusDateSrc), "status_date no longer defines local loadMacroRuntimeShared pair function");
  assertFalse(/async function loadMacroRuntimeShared\(/.test(tagwheelSrc), "tagwheel no longer defines local loadMacroRuntimeShared pair function");
  /*
   * Ключи настроек — один модуль на весь плагин (У-32). Пин раньше искал
   * вызов загрузчика; загрузки больше нет, модуль приезжает `require` при
   * загрузке файла и подставляется тут же. Утверждение то же — ключи
   * берутся из общего модуля, а не объявлены рядом, — предмет другой.
   */
  assertTrue(/require\("\.\.\/src\/core\/pkm_option_keys\.js"\)/.test(statusTagsSrc), "status_tags requires the shared pkm option keys literally");
  assertTrue(/applyPkmOptionKeys\(__pkmOptionKeys\);/.test(statusTagsSrc), "and applies them at load time, not per call");
  assertTrue(/require\("\.\.\/src\/core\/pkm_option_keys\.js"\)/.test(statusDateSrc), "status_date requires the shared pkm option keys literally");
  assertTrue(/applyPkmOptionKeys\(__pkmOptionKeys\);/.test(statusDateSrc), "and applies them at load time, not per call");
  assertTrue(/require\('\.\.\/\.\.\/src\/core\/pkm_option_keys\.js'\)/.test(tagwheelSrc), "tagwheel requires the shared pkm option keys literally (У-89)");
  assertTrue(/pkm_macro_runtime_shared\.js/.test(pkmMacroRuntimeEntrySrc), "macro runtime entry resolves shared runtime module path");
  assertTrue(/async function bootstrapMacroRuntime\(/.test(pkmMacroRuntimeEntrySrc), "macro runtime entry exports reusable bootstrap function");
  assertTrue(/pkm_option_keys\.js/.test(pkmMacroRuntimeSharedSrc), "shared macro runtime references centralized pkm option keys module");
  assertTrue(/async function loadPkmOptionKeys\(/.test(pkmMacroRuntimeSharedSrc), "shared macro runtime exports pkm option keys loader");
  /*
   * Здесь стояли три пина «загрузчик сначала смотрит в кеш»: у прослойки, у
   * загрузчика и у прогрева моста. Кешем теперь является сам статический
   * `require` — модуль в графе сборки один и отдаётся один, — и сторожить в
   * этом месте больше нечего. Гарантия переехала в запрет `require` по
   * переменной выше.
   */
  /*
   * `forceReload` ушёл вместе с мостом: в сборке он не значил ничего — реестр
   * отдавал один и тот же объект при любом флаге, — а вне Obsidian сбрасывал
   * кеш загрузчика, чего ни одна проверка не просила.
   */
  assertTrue(/function macroModuleForCommand\(command\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 resolves the macro module by command name, not by a path");
  assertTrue(/async function ensureMacroRuntimeBootstrap\(\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 preloads macro runtime bootstrap helper");
  assertFalse(/async function readVaultMtime\(pathKey\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 has no local mtime cache fallback loader");
  assertFalse(/new Function\("module", "exports", "app", "Notice"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 has no local dynamic module eval fallback");
  assertTrue(/emitDev\("pkm\.run\.start"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits dev start event");
  assertTrue(/emitDev\("pkm\.run\.result"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits dev result event");
  assertTrue(/emitDev\("pkm\.run\.error"/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits dev error event");
  assertTrue(/orderConfigHash: hashShort\(String\(nz\(settings\["Order config"\], ""\)\)\)/.test(pkmRuntimeV2Src), "pkm_runtime_v2 emits order config hash in dev start event");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(app_, "loadRulesRuntimeHelpers"\)/, /await loadRulesRuntimeHelpers\(app_\);/], "status_tags preloads shared rules helpers");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(app_, "loadRulesRuntimeHelpers"\)/, /await loadRulesRuntimeHelpers\(app_\);/], "status_date preloads shared rules helpers");
  assertFalse(/function resolveLegacyTagActionOrderKey\(/.test(statusTagsSrc), "status_tags has no legacy tag-action resolver ingress");
  assertFalse(/const legacy = resolveLegacyTagActionOrderKey\(actionKey\);/.test(statusTagsSrc), "status_tags field action resolver has no legacy resolver helper path");
  assertFalse(/const legacy = resolveLegacyTagActionOrderKey\(v\);/.test(statusTagsSrc), "status_tags minimal-off action resolver has no legacy helper path");
  assertFalse(/resolveLegacyDateActionMeta|resolveLegacyDateActionToOrderKey/.test(statusDateSrc), "status_date has no legacy date-action parsing path");
  assertTrue(/getStatusRuntimeCommon\(\)\.resolveOrderConfig\(app_, settings\)|statusCommon\.resolveOrderConfig\(app_, settings\)/.test(statusTagsSrc), "status_tags order-config resolver is shared runtime-common backed");
  assertTrue(/getStatusRuntimeCommon\(\)\.resolveOrderConfig\(app_, settings\)|statusCommon\.resolveOrderConfig\(app_, settings\)/.test(statusDateSrc), "status_date order-config resolver is shared runtime-common backed");
  assertFalse(/stripPrefixWhenSourceHasNoPrefix:\s*true/.test(statusTagsSrc), "status_tags has no unconditional stripPrefixWhenSourceHasNoPrefix=true");
  assertTrue(/freeRoamMode\s*!==\s*"off"[\s\S]*removeSyntheticLeadingPrefix\(/.test(statusTagsSrc), "status_tags guards synthetic prefix removal for off mode");
  assertTrue(/enforceOffModeFinalPrefix\([\s\S]*freeRoamMode[\s\S]*lineFinalize[\s\S]*cycleEndBehavior/.test(statusTagsSrc), "status_tags enforces off-mode list prefix fallback when missing");
  assertTrue(statusTagsSrc.indexOf("statusCommon.applyOrderToRules(rules, orderCfg);") < statusTagsSrc.indexOf("core.validateRules(rules);"), "status_tags applies order before validateRules");
  assertTrue(statusDateSrc.indexOf("statusCommon.applyOrderToRules(rules, orderCfg);") < statusDateSrc.indexOf("core.validateRules(rules);"), "status_date applies order before validateRules");
  assertTrue(/getFieldById\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared field resolver");
  assertTrue(/getActiveValues\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared active-values resolver");
  assertTrue(/getFieldValueById\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared value-by-id resolver");
  assertTrue(/getFieldValueByToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared value-by-token resolver");
  assertTrue(/getValueId\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared value-id resolver");
  assertTrue(/resolveSubtagFormat\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared subtag-format resolver");
  assertTrue(/getAllowedSubValues\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared sub-value resolver");
  assertTrue(/setCursorIfChanged\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared cursor setter");
  assertTrue(/parseIsoDateSafe\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared ISO date parser");
  assertTrue(/getTodayIso\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared current-date formatter");
  assertTrue(/escapeRx\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared regex-escape helper");
  assertTrue(/getReferenceDateForUnit\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared reference-date resolver");
  assertTrue(/getSearchLimitByUnit\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared search-limit resolver");
  assertTrue(/addByUnitUtc\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared UTC date-step helper");
  assertTrue(/buildPriorityTokenMapFromLine\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority token-map builder");
  assertTrue(/buildPriorityCycleTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority cycle-token builder");
  assertTrue(/buildPriorityCycleTokensFromRules\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority cycle-from-rules builder");
  assertTrue(/resolvePriorityCycleTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority cycle resolver");
  assertTrue(/normalizePriorityToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority-token normalizer");
  assertTrue(/countPriorityTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority-token counter");
  assertTrue(/stripPriorityTokens\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared priority-token stripper");
  assertTrue(/parseDateByFormat\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date parser by format");
  assertTrue(/formatDateByFormat\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date formatter by format");
  assertTrue(/replaceRange\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared replace-range helper");
  assertTrue(/cleanupSpacing\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared spacing cleanup helper");
  assertTrue(/fieldKeyByAction\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared field-key-by-action resolver");
  assertTrue(/isMinimalOffNoSeparatorAction\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared minimal-off action detector");
  assertTrue(/hasToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared segment-token detector");
  assertTrue(/composeToken\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared token composer");
  assertTrue(/normalizeImportanceTokenShape\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared importance-token normalizer");
  assertTrue(/detectDateUnit\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date-unit detector");
  assertTrue(/getDateProgressForStep\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared date-progress resolver");
  assertTrue(/normalizeDirection\(/.test(statusRuntimeCommonSrc), "status runtime common exports shared direction normalizer");
  /*
   * **Один обход по форме вместо тридцати пяти пинов по именам** — 2026-09-10,
   * второй кусок В-97 (У-85, У-111, У-126).
   *
   * Здесь стояли утверждения вида «`status_tags` делегирует такую-то функцию
   * общему модулю», каждое — образец с полным списком аргументов. У такого
   * списка два порока. Он проверяет **список, а не предмет**: новая обёртка в
   * него не попадает, а переименование параметра красит его без причины. И
   * держал он форму `common.X(...)` — а это был признак не делегирования, а
   * **копии за молчаливым `catch`**: у всех тридцати двух за вызовом лежал
   * собственный ответ на тот же вопрос (У-32).
   *
   * Правило спрашивается по форме: функция, которая зовёт общую реализацию, не
   * имеет права **проглотить её отказ молча** — за таким `catch` и лежала
   * копия. Предмет здесь именно молчание, а не длина: `panelForTagKey` и
   * `resolveActionFieldKey` зовут общий модуль внутри настоящей логики, и они
   * законны. Первая версия этого обхода мерила длину и назвала их нарушением.
   *
   * Второе утверждение — про количество тонких обёрток: без него запрет
   * «ни одной» выполнялся бы сам на пустом множестве (У-88).
   */
  const scanWrappers = (src) => {
    const thin = [];
    const swallowing = [];
    const decl = /^function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/gm;
    let m;
    while ((m = decl.exec(src)) !== null) {
      const open = src.indexOf("{", m.index);
      let depth = 0;
      let end = -1;
      for (let j = open; j < src.length; j++) {
        if (src[j] === "{") depth += 1;
        else if (src[j] === "}") { depth -= 1; if (depth === 0) { end = j + 1; break; } }
      }
      if (end < 0) continue;
      const text = src.slice(m.index, end);
      if (!/getStatusRuntimeCommon\(\)/.test(text)) continue;
      const work = text.slice(text.indexOf("{") + 1, text.length - 1)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .trim();
      if (/\}\s*catch\s*\(\s*_\s*\)\s*\{\s*\}/.test(text)) swallowing.push(m[1]);
      if (/^return getStatusRuntimeCommon\(\)\.[A-Za-z_$][\w$]*\([\s\S]*\);$/.test(work)) thin.push(m[1]);
    }
    return { thin, swallowing };
  };

  {
    const tags = scanWrappers(statusTagsSrc);
    const date = scanWrappers(statusDateSrc);
    const swallowing = tags.swallowing.map((n) => "status_tags::" + n)
      .concat(date.swallowing.map((n) => "status_date::" + n));
    assertEq(swallowing.join(" | "), "",
      "функция зовёт общую реализацию и глотает её отказ молча — за таким `catch` "
      + "лежит второе объявление того же правила (У-32), и достаётся оно тогда, "
      + "когда общая реализация бросила");
    const thinCount = tags.thin.length + date.thin.length;
    assertTrue(thinCount >= 30,
      "обход нашёл только " + thinCount + " тонких обёрток — значит он смотрит не туда, "
      + "и запрет выше мерит пустоту (У-88)");

    /*
     * Положительный контроль: прежняя форма обязана быть опознана как толстая.
     * Без него запрет зелен от опечатки в образце — на пустом множестве
     * «ни одной» выполняется само.
     */
    const sample = [
      "function escapeRx(s) {",
      "  try {",
      "    const common = getStatusRuntimeCommon();",
      "    if (common && typeof common.escapeRx === \"function\") {",
      "      return common.escapeRx(s);",
      "    }",
      "  } catch (_) {}",
      "  return String(s || \"\");",
      "}",
      "function thinOne(x) {",
      "  return getStatusRuntimeCommon().escapeRx(x);",
      "}",
    ].join("\n");
    const probe = scanWrappers(sample);
    assertEq(probe.swallowing.join(","), "escapeRx", "образец прежней формы не опознан как копия — обход слеп");
    assertEq(probe.thin.join(","), "thinOne", "образец тонкой обёртки не опознан — обход слеп в другую сторону");
  }
  assertTrue(/function ensureStatusRuntimeCommonFns\(/.test(tagwheelCoreSrc), "tagwheel_core bootstraps shared status runtime common helpers");
  assertTrue(/common\.resolveSubtagFormat\(null, rules\)/.test(tagwheelCoreSrc), "tagwheel_core delegates subtag-format resolution to shared runtime common");
  assertTrue(/common\.getSearchLimitByUnit\(unit, getSharedUtils\(\)\)/.test(tagwheelCoreSrc), "tagwheel_core delegates search-limit resolver to shared runtime common");
  assertTrue(/common\.detectDateUnit\(format, normalizeFormatMask, hasFormatTokens, getSharedUtils\(\)\)/.test(tagwheelCoreSrc), "tagwheel_core delegates date-unit detection to shared runtime common");
  assertTrue(/common\.getDateProgressForStep\(state, fieldId, format\)/.test(tagwheelCoreSrc), "tagwheel_core delegates date-progress resolver to shared runtime common");
  assertTrue(/facade\.resolveOrderConfig/.test(tagwheelSrc), "tagwheel order-config resolver is preload-facade backed");
  assertAnyMatch(statusTagsSrc, [/callRuntimeApi\(app_, "loadMacroShared"\)/, /await loadMacroShared\(app_\);/], "status_tags preloads shared macro helpers");
  assertAnyMatch(statusDateSrc, [/callRuntimeApi\(app_, "loadMacroShared"\)/, /await loadMacroShared\(app_\);/], "status_date preloads shared macro helpers");
  assertTrue(/const __lineFinalizeUnified = require\(/.test(statusDateSrc), "status_date gets the unified line finalizer by a literal require (У-89)");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusDateSrc) || /lineFinalize\.applyMixedPostPolicies\(rawLine, finalLine, rules, \{/.test(statusDateSrc), "status_date applies shared mixed post-policy through unified finalizer helper");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusDateSrc), "status_date applies shared trailing-separator policy helper");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusDateSrc) || /lineFinalize\.applyFinalLineInvariants\(\{/.test(statusDateSrc), "status_date applies shared final-line invariants through unified finalizer path");
  assertTrue(/lineFinalize\.applyCycleEndAndInvariants\(\{/.test(statusDateSrc) || /applyCycleEndPostProcessing\(\{/.test(statusDateSrc), "status_date delegates cycle-end post-processing through shared finalizer helper");
  assertTrue(/resolveCursorByPolicy\(\{/.test(statusDateSrc), "status_date delegates cursor policy resolution to shared finalizer");
  assertTrue(/macroShared\.getCursorAtTextEnd\(line, runtimeRules\)/.test(statusTagsSrc), "status_tags text-end cursor delegates to shared helper");
  assertTrue(/macroShared\.getCursorAtTextEnd\(line, runtimeRules\)/.test(statusDateSrc), "status_date text-end cursor delegates to shared helper");
  assertTrue(/getStatusRuntimeCommon\(\)\.applyOrderToRules\(rules, orderCfg\)|statusCommon\.applyOrderToRules\(rules, orderCfg\)/.test(statusTagsSrc), "status_tags order-apply helper is shared runtime-common backed");
  assertTrue(/getStatusRuntimeCommon\(\)\.getPanelForField\(orderCfg, fieldKey\)|statusCommon\.getPanelForField\(orderCfg, "type"\)|statusCommon\.getPanelForField\(orderCfg, k\.slice\(0, -4\)\)/.test(statusTagsSrc), "status_tags panel resolver is shared runtime-common backed");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder"\);/.test(statusTagsSrc), "status_tags segment reorder helper is shared-only");
  assertTrue(/rulesHelpers\.getStatusTagReorderOptions\(\)/.test(statusTagsSrc), "status_tags tag-only reorder options come from shared helper");
  assertTrue(/rulesHelpers\.getStatusMixedReorderOptions\(markers\)/.test(statusTagsSrc), "status_tags mixed reorder options come from shared helper");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules"\);/.test(statusTagsSrc), "status_tags date marker helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap"\);/.test(statusTagsSrc), "status_tags token-key map helper is shared-only");
  assertTrue(/rulesHelpers\.getDefaultTagTokenKeyMapOptions\(\)/.test(statusTagsSrc), "status_tags token-key map options come from shared helper");
  assertTrue(/function buildOutputTokenForField\(/.test(statusTagsSrc), "status_tags has unified output-token builder for tag\/link fields");
  assertTrue(/lineFinalize\.normalizeMinimalOffFinalLine\(rawLine, finalLine, rules, \{/.test(statusTagsSrc), "status_tags minimal-off normalization is delegated to unified line finalizer");
  assertFalse(/function reapplyOriginalPrefix\(rawLine, nextLine\)/.test(statusTagsSrc), "status_tags has no local prefix-reapply wrapper");
  assertTrue(/function reapplyOriginalPrefix\(rawLine, nextLine\)/.test(pkmMacroSharedSrc), "pkm_macro_shared exposes shared prefix reapply helper");
  assertTrue(/function preserveOriginalPrefixShape\(rawLine, nextLine\)/.test(pkmMacroSharedSrc), "pkm_macro_shared exposes shared prefix shape helper");
  assertTrue(/require\("\.\.\/src\/core\/pkm_line_finalize_unified\.js"\)/.test(statusTagsSrc), "status_tags requires the unified line finalizer literally (У-89)");
  assertTrue(/const __lineFinalizeUnified = require\(/.test(statusTagsSrc), "status_tags gets the unified line finalizer by a literal require (У-89)");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusTagsSrc) || /lineFinalize\.applyMixedPostPolicies\(rawLine, finalLine, rules, \{/.test(statusTagsSrc), "status_tags applies shared mixed post-policy through unified finalizer path");
  assertTrue(/lineFinalize\.applyTrailingSeparatorPolicy\(\{/.test(statusTagsSrc), "status_tags applies shared trailing-separator policy helper from unified finalizer");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusTagsSrc) || /lineFinalize\.applyFinalLineInvariants\(\{/.test(statusTagsSrc), "status_tags applies shared final-line invariants through unified finalizer path");
  assertTrue(/lineFinalize\.applyCycleEndAndInvariants\(\{/.test(statusTagsSrc) || /lineFinalize\.applyCycleEndPostProcessing\(\{/.test(statusTagsSrc), "status_tags delegates cycle-end post-processing through shared finalizer helper");
  assertTrue(/lineFinalize\.isSimplePlainRaw\(rawLine, rules/.test(statusTagsSrc), "status_tags plain-raw minimal guard delegates to shared finalizer helper");
  assertTrue(/lineFinalize\.resolveCursorByPolicy\(\{/.test(statusTagsSrc), "status_tags delegates cursor policy resolution to shared finalizer");
  assertTrue(/require\('\.\.\/\.\.\/src\/core\/pkm_line_finalize_unified\.js'\)/.test(tagwheelSrc), "tagwheel requires the unified line finalizer literally (У-89)");
  assertTrue(/loadLineFinalizeUnified\(app_\)/.test(tagwheelSrc), "tagwheel loads unified line finalizer module");
  assertTrue(/finalize\.applyUnifiedPostFinalize\(\{/.test(tagwheelSrc) || /finalLine = finalize\.applyMixedPostPolicies\(state\.originalLine, finalLine, state\.rules, policy\)/.test(tagwheelSrc), "tagwheel applies shared mixed post policies through unified finalizer path");
  assertTrue(/finalize\.applyUnifiedPostFinalize\(\{/.test(tagwheelSrc) || /finalLine = finalize\.applyFinalLineInvariants\(\{/.test(tagwheelSrc), "tagwheel applies shared final-line invariants through unified finalizer path");
  assertTrue(/applyCycleEndAndInvariants\(/.test(tagwheelSrc) || /applyCycleEndPostProcessing\(/.test(tagwheelSrc), "tagwheel delegates cycle-end post-processing to shared finalizer");
  assertTrue(/resolveCursorByPolicy\(/.test(tagwheelSrc), "tagwheel delegates cursor policy resolution to shared finalizer");
  assertFalse(/function removeTokenWholeLine\(/.test(tagwheelSrc), "tagwheel no longer defines local removeTokenWholeLine helper");
  assertFalse(/function insertTokenAtIndex\(/.test(tagwheelSrc), "tagwheel no longer defines local insertTokenAtIndex helper");
  assertFalse(/function resolveInsertIndexByPlacement\(/.test(tagwheelSrc), "tagwheel no longer defines local resolveInsertIndexByPlacement helper");
  assertTrue(/function applyPrefixPolicy\(rawLine, builtLine, options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports applyPrefixPolicy helper");
  assertTrue(/function applyMixedPostPolicies\(rawLine, line, rules, policy\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports mixed post-policy helper");
  assertTrue(/function applyCycleEndPostProcessing\(options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports cycle-end post-processing helper");
  assertTrue(/function applyFinalLineInvariants\(options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports final-line invariant helper");
  assertTrue(/function removeTokenWholeLine\(line, token\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared removeTokenWholeLine primitive");
  assertTrue(/function insertTokenAtIndex\(src, token, idx\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared insertTokenAtIndex primitive");
  assertTrue(/function resolveInsertIndexByPlacement\(src, cursorAt, placement\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared resolveInsertIndexByPlacement primitive");
  assertTrue(/function isSimplePlainRaw\(rawLine, rules, options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports shared plain-raw guard helper");
  assertTrue(/function resolveCursorByPolicy\(options\)/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports cursor policy resolver");
  assertTrue(/macroShared\.applyKeepBullet\(editor, lineNo, parsedWork, \{ keepParsedPrefix: true, keepCheckbox: false \}\)/.test(statusTagsSrc), "status_tags keep-bullet preserves parsed bullet prefix without stale checkbox");
  assertTrue(/linePipeline\.splitLeftPrefix\(seg\.left\)/.test(statusTagsSrc), "status_tags relocation uses shared left-prefix splitter");
  assertTrue(/linePipeline\.joinLeftPrefix\(leftParts\.prefix, orderedLeftBody\)/.test(statusTagsSrc), "status_tags relocation uses shared left-prefix joiner");
  assertTrue(/linePipeline\.buildFromSegments\(seg, rules\)/.test(statusTagsSrc), "status_tags render path uses shared buildFromSegments helper");
  assertTrue(/customRelocation = \{/.test(statusTagsSrc), "status_tags stores relocation plan for cycle_field custom fields");
  assertTrue(/selectedTokenFromState\(customRelocation\.field, state, rules\)/.test(statusTagsSrc), "status_tags applies relocated custom field token from state");
  assertTrue(/selectedTokenFromState\(customParentRelocation\.field, state, rules\)/.test(statusTagsSrc), "status_tags applies relocated custom parent token for sub-actions");
  assertTrue(/function enforceDependentAdjacencyForStatusLine\(/.test(statusTagsSrc), "status_tags has dedicated dependent-adjacency stabilization for cycle runtime");
  assertTrue(/const __statusLineRuntimeUnified = require\(/.test(statusTagsSrc), "status_tags gets the shared status-line runtime by a literal require");
  assertTrue(/runtime\.relocateCoreTagsByOrder\(\{/.test(statusTagsSrc), "status_tags core tag relocation delegates to shared status-line runtime module");
  assertTrue(/runtime\.enforceDependentAdjacencyForStatusLine\(\{/.test(statusTagsSrc), "status_tags dependent adjacency delegates to shared status-line runtime module");
  /*
   * Здесь стояли четырнадцать пинов вида «загрузчик требует помощника X».
   * Загрузки больше нет: модуль приезжает литеральным `require` (У-89), и
   * спрашивать у графа сборки, тот ли модуль приехал, нечем и незачем.
   *
   * Гарантию они не унесли с собой — она была объявлена дважды. У каждого
   * помощника рядом стоит второй пин, и он сильнее: не «загрузчик назвал X»,
   * а «движок ЗОВЁТ X у общего модуля». Эти вторые пины на месте, все до
   * одного, и именно они держат «своей копии помощника в движке нет» (У-32).
   */
  assertTrue(/runtime\.stripFieldTokenSetFromLine\(\{/.test(statusTagsSrc) || /getStatusLineRuntimeUnified\(\)\.stripFieldTokenSetFromLine\(\{/.test(statusTagsSrc), "status_tags field-token stripping delegates to shared status-line runtime module");
  assertTrue(/runtime\.clearDependentSelections\(\{ rules, state, parentFieldId \}\)/.test(statusTagsSrc) || /getStatusLineRuntimeUnified\(\)\.clearDependentSelections\(\{[\s\S]*rules,[\s\S]*state,[\s\S]*parentFieldId: targetField\.id/.test(statusTagsSrc), "status_tags dependent-selection clear delegates to shared status-line runtime module");
  assertTrue(/function relocateCoreTagsByOrder\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports relocation algorithm");
  assertTrue(/function normalizeFieldList\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime normalizes relocation fields generically");
  assertFalse(/activeKey === "type"|activeKey === "category"|activeKey === "type_sub"|activeKey === "category_sub"/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime has no canonical active-key hardcode branches");
  assertTrue(/function buildCombinedSelectionSet\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports generic combined-selection builder");
  assertTrue(/function applyCombinedToTokenList\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports generic combined token collapse helper");
  assertTrue(/function stripFieldTokenSetFromLine\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports field-token stripping helper");
  assertTrue(/function clearDependentSelections\(/.test(statusLineRuntimeUnifiedSrc), "shared status-line runtime exports dependent-selection clear helper");
  assertTrue(/runtime\.buildCombinedSelectionSet\(\{/.test(statusTagsSrc), "status_tags combined render delegates pair-build logic to shared status-line runtime");
  assertTrue(/require\('\.\.\/\.\.\/src\/core\/status_line_runtime_unified\.js'\)/.test(tagwheelSrc) && /loadStatusLineRuntimeUnified\(\)/.test(tagwheelSrc), "tagwheel runtime preloads shared status-line runtime for universal combined behavior");
  /*
   * И такие же у TagWheel. Тот же разбор: пин на проверку годности
   * помощника дублировал пин на его ВЫЗОВ, а предмет ушёл вместе с
   * загрузкой (У-89, У-71). Пины на вызовы — ниже, все на месте.
   */
  assertTrue(/function normalizeMinimalOffFinalLine\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes minimal-off normalizer");
  assertTrue(/function alignMinimalNoSeparatorPrefix\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes minimal no-separator prefix aligner");
  assertTrue(/function relocateOffEntriesToRightPanel\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes off-right relocation helper");
  assertTrue(/function applyFullNoSourceNormalization\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes full-no-source normalization helper");
  assertTrue(/function applyOffSelectionPostPolicies\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes off-selection post-policy helper");
  assertTrue(/function applyMinimalSelectionNormalization\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes minimal-selection normalization helper");
  assertTrue(/function resolveEffectiveSelectionPolicy\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes active-mode-aware mixed policy helper");
  assertTrue(/function hasAnySeparator\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes separator-presence helper");
  assertTrue(/hasCheckboxListPrefix,/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exports checkbox-list prefix helper");
  assertTrue(/function applyResolvedPrefixToLine\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes resolved-prefix application helper");
  assertTrue(/function applyUnifiedPostFinalize\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes unified post-finalize pipeline helper");
  assertTrue(/function applyCycleEndAndInvariants\(/.test(pkmLineFinalizeUnifiedSrc), "unified line finalizer exposes cycle-end plus invariants helper");
  assertTrue(/finalLine = lineFinalize\.normalizeMinimalOffFinalLine\(rawLine, finalLine, rules(?:, \{[\s\S]*?\})?\);/.test(statusTagsSrc), "status_tags minimal-off normalization uses unified finalizer pass");
  assertTrue(/lineFinalize\.alignMinimalNoSeparatorPrefix\(\{/.test(statusTagsSrc), "status_tags minimal no-separator prefix rewrite delegates to shared finalizer");
  assertFalse(/const desiredCheckbox\s*=/.test(statusTagsSrc), "status_tags has no local desiredCheckbox rewrite branch");
  assertTrue(/relocateOffEntriesToRightPanel\(\{/.test(pkmLineFinalizeUnifiedSrc), "off-right relocation is implemented in shared finalizer helper");
  assertFalse(/var offTokens = \[\]/.test(tagwheelSrc), "tagwheel has no local off-right token relocation accumulator");
  assertTrue(/finalLine = enforceDependentAdjacencyForStatusLine\(finalLine, rules, state, core\);/.test(statusTagsSrc), "status_tags applies dependent adjacency stabilization in final runtime path");
  assertFalse(/const fallback = direction === "decrease" \? cycle\[cycle\.length - 1\] : cycle\[0\];/.test(statusTagsSrc), "status_tags custom cycle has no edge fallback wrap");
  /*
   * Предмет этого утверждения переехал 2026-09-10 (У-94): «сопоставитель
   * токена шаблонный, и отказ у него громкий» жило в копии внутри `hasToken`
   * в `status_tags.js`, а копия снята вторым куском В-97. В общем модуле тот
   * же бросок стоял всё это время — теперь он там один, и спрашивается там.
   * Плюс запрет на возврат: своей копии в `status_tags.js` быть не должно.
   */
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: segmentHasToken"\);/.test(statusRuntimeCommonSrc), "shared runtime common token matcher fails loudly");
  assertFalse(/segmentHasToken/.test(statusTagsSrc), "status_tags has no local token matcher of its own");
  assertTrue(/throw new Error\("line_pipeline unavailable: removeExactTokens"\);/.test(statusTagsSrc), "status_tags token remover delegates to shared line-pipeline helper");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: getCursorAtTextEnd"\);/.test(statusTagsSrc), "status_tags text-end helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: applyKeepBullet"\);/.test(statusTagsSrc), "status_tags keep-bullet helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: isOrphanCheckboxBulletLine"\);/.test(statusDateSrc), "status_date orphan-checkbox helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: isNoContentParsed"\);/.test(statusTagsSrc), "status_tags no-content helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: isNoContentParsed"\);/.test(statusDateSrc), "status_date no-content helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: getCursorAtTextEnd"\);/.test(statusDateSrc), "status_date text-end helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: buildBulletOnlyLine"\);/.test(statusDateSrc), "status_date bullet-only helper is shared-only");
  assertTrue(/throw new Error\("pkm_macro_shared unavailable: applyKeepBullet"\);/.test(statusDateSrc), "status_date keep-bullet helper is shared-only");
  assertFalse(/resolveLegacyDateActionMeta|resolveLegacyDateActionToOrderKey/.test(statusDateSrc), "status_date no longer parses legacy date-action aliases");
  assertTrue(/getStatusRuntimeCommon\(\)\.applyOrderToRules\(rules, orderCfg\)|statusCommon\.applyOrderToRules\(rules, orderCfg\)/.test(statusDateSrc), "status_date order-apply helper is shared runtime-common backed");
  assertTrue(/getStatusRuntimeCommon\(\)\.getPanelForField\(orderCfg, fieldKey\)|statusCommon\.getPanelForField\(orderCfg, actionFieldKey\)/.test(statusDateSrc), "status_date panel resolver is shared runtime-common backed");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildPanelOrderKeys"\);/.test(statusDateSrc), "status_date panel-order helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder"\);/.test(statusDateSrc), "status_date segment reorder helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: getStatusMixedReorderOptions"\);/.test(statusDateSrc), "status_date mixed reorder options helper is shared-only");
  assertTrue(/shared\.getStatusMixedReorderOptions\(markers\)/.test(statusDateSrc), "status_date mixed reorder options come from shared helper");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap"\);/.test(statusDateSrc), "status_date token-key map helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: buildDateMarkers"\);/.test(statusDateSrc) || /throw new Error\("pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules"\);/.test(statusDateSrc), "status_date date-markers helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: getDateValuePatterns"\);/.test(statusDateSrc), "status_date date value-patterns helper is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: isDateLikeToken"\);/.test(statusDateSrc), "status_date date-like token classifier is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: hasDateLikeMarkerInText"\);/.test(statusDateSrc), "status_date date-like marker text classifier is shared-only");
  assertTrue(/throw new Error\("pkm_rules_runtime_helpers unavailable: removeMarkerTokensFromSegment"\);/.test(statusDateSrc), "status_date marker-token remover helper is shared-only");
  assertTrue(/buildDateMarkers\(timeMarker, startMarker, dueMarker\)/.test(statusDateSrc) || /rulesHelpersForDates\.getDateMarkersFromRules\(rules\)/.test(statusDateSrc), "status_date runtime markers are resolved via shared helper");
  assertTrue(/\.\.\.dateMarkers,\s*generic:\s*actionMarker/.test(statusDateSrc), "status_date extends shared date-markers map with active generic marker for reorder");
  assertTrue(/rulesHelpersForDates\.getDateValuePatterns\(\)/.test(statusDateSrc), "status_date text cleanup uses shared date value-patterns helper");
  assertFalse(/\[📅🛫\]/.test(statusDateSrc), "status_date has no hardcoded date emoji regex class in marker cleanup");
  assertFalse(/\)🕒/.test(statusDateSrc), "status_date has no hardcoded time emoji token in marker cleanup");
  assertTrue(/offPrefix: false/.test(cfgSrc), "main default config includes offPrefix toggle with OFF default");
  assertTrue(/tagwheelHeader:\s*\{[\s\S]*defaultTextColor:\s*""[\s\S]*fillColor:\s*""[\s\S]*showPrefix:\s*true/.test(cfgSrc), "main default config includes tagwheel header visual colors and showPrefix toggle");
  assertTrue(/tagVisuals:\s*\{[\s\S]*showColorSettings:\s*false[\s\S]*tagTextSizePct:\s*100,[\s\S]*tagBubbleWidthPct:\s*100,[\s\S]*tagBubbleHeightPct:\s*100,[\s\S]*emptyBubbleSizePct:\s*100,[\s\S]*tagShapePct:\s*0,[\s\S]*opacity:\s*\{[\s\S]*left:\s*1,[\s\S]*right:\s*1[\s\S]*\}[\s\S]*strip:\s*\{[\s\S]*active:\s*false,[\s\S]*fieldId:\s*""[\s\S]*thickness:\s*2,[\s\S]*childOffset:\s*12/.test(cfgSrc), "main default config includes strip-only tagVisuals defaults (text-size/bubble-width/bubble-height/empty-size/shape/opacity/strip)");
  assertTrue(/if \(!isObj\(cfg\.pkm\.behavior\.tagVisuals\)\) cfg\.pkm\.behavior\.tagVisuals = cloneJson\(DEFAULT_CONFIG\.pkm\.behavior\.tagVisuals\);/.test(cfgSrc), "main migration initializes tagVisuals block when missing");
  assertTrue(/const normOpacity = \(value, fallback\) => \{[\s\S]*Math\.max\(0, Math\.min\(1, n\)\)/.test(cfgSrc), "main migration clamps tagVisuals opacity to 0..1");
  assertTrue(/const normalizeTagToken = \(token\) => \{[\s\S]*return src\.charAt\(0\) === "#" \? src : "";/.test(cfgSrc), "main migration keeps tagVisuals tokens strictly hash-prefixed");
  assertTrue(/function normalizeTagVisualMapsV2\(cfg\) \{/.test(cfgSrc), "third stage normalizes tag visual maps on v2 paths");
  assertTrue(/if \(userTagsIn\[rawToken\] === null\) continue;/.test(cfgSrc), "third stage keeps the null tombstone for user tags");
  assertTrue(/writeCfgPath\(cfg, "visual\.tagBars", __priorityStripEngine\.normalizeStripConfig\(/.test(cfgSrc), "third stage normalizes Tag Bars through the shared strip engine");
  assertTrue(/offPrefix: placement\.bulletInStrict === true/.test(orderSrc), "order serializer exports offPrefix behavior flag from pkm.placement");
  assertTrue(/offPrefix/.test(pkmRulesHelpersSrc), "shared rules helper parses and resolves offPrefix behavior");
  assertTrue(/offPrefix: false/.test(statusRuntimeCommonSrc), "status runtime common fallback includes offPrefix default OFF");
  assertTrue(/function resolveOffPrefixFlagsUnified\(/.test(pkmLineFinalizeUnifiedSrc), "line finalizer exports unified off-prefix resolver");
  assertTrue(/lineFinalize\.resolveOffPrefixFlagsUnified\(\{/.test(statusTagsSrc), "status_tags delegates off-prefix resolution to shared line finalizer");
  assertTrue(/throw new Error\("line_pipeline unavailable: removeCombinedByParentTokens"\);/.test(statusTagsSrc), "status_tags combined-subtag cleanup requires shared line-pipeline helper");
  assertTrue(/shared\.removeCombinedByParentTokens\(\{/.test(statusTagsSrc), "status_tags combined-subtag cleanup delegates to shared line-pipeline helper");
  assertTrue(/throw new Error\("line_pipeline unavailable: removeTokensAcrossSegments"\);/.test(statusTagsSrc), "status_tags field-token stripping requires shared line-pipeline helper");
  assertTrue(/shared\.removeTokensAcrossSegments\(\{/.test(statusTagsSrc), "status_tags field-token stripping delegates to shared line-pipeline helper");
  assertTrue(/const hasAnySeparatorFn = lineFinalize\.hasAnySeparator;/.test(statusTagsSrc), "status_tags separator-presence checks strictly use shared finalizer helper");
  assertTrue(/lineFinalize\.resolveEffectiveSelectionPolicy\(\{/.test(statusTagsSrc), "status_tags resolves mixed policy via shared finalizer effective-policy helper");
  assertTrue(/lineFinalize\.applyResolvedPrefixToLine\(\{/.test(statusTagsSrc), "status_tags prefix rewrite delegates to shared resolved-prefix helper");
  assertFalse(/function resolveOffPrefixFlags\(/.test(statusTagsSrc), "status_tags has no local off-prefix resolver implementation");
  assertTrue(/finalize\.applyMinimalSelectionNormalization\(\{/.test(tagwheelSrc), "tagwheel minimal-left normalization delegates to shared finalizer helper");
  assertTrue(/finalize\.applyOffSelectionPostPolicies\(\{/.test(tagwheelSrc), "tagwheel off-selection post-policy delegates to shared finalizer helper");
  assertTrue(/finalize\.applyFullNoSourceNormalization\(\{/.test(tagwheelSrc), "tagwheel full-mode no-source normalization delegates to shared finalizer helper");
  assertTrue(/finalize\.applyCycleEndAndInvariants\(\{/.test(tagwheelSrc), "tagwheel cycle-end plus final-invariants flow delegates to shared finalizer helper");
  assertTrue(/lineFinalize\.applyUnifiedPostFinalize\(\{/.test(statusDateSrc), "status_date post-finalize chain delegates to shared unified helper");
  assertTrue(/lineFinalize\.resolveEffectiveSelectionPolicy\(\{/.test(statusDateSrc), "status_date mixed policy uses shared effective-policy helper");
  assertTrue(/throw new Error\("line_pipeline unavailable: resolvePanelByMarkerPresence"\);/.test(statusDateSrc), "status_date marker-panel resolve requires shared line-pipeline helper");
  assertTrue(/linePipeline\.resolvePanelByMarkerPresence\(\{[\s\S]*line: rawLine,[\s\S]*rules,[\s\S]*marker: actionMarker,[\s\S]*panelByOrder/.test(statusDateSrc), "status_date marker-panel resolve delegates to shared line-pipeline helper");
  assertTrue(/runtime\.selectMarkerValueByPanelOrder\(\{[\s\S]*line: rawLine,[\s\S]*rules,[\s\S]*panel: targetPanel,[\s\S]*marker: markerSafe/.test(statusDateSrc), "status_date date-offset hydration delegates panel-aware marker selection to shared runtime helper");
  assertTrue(/throw new Error\("line_pipeline unavailable: cleanOriginalTextForLeftDate"\);/.test(statusDateSrc), "status_date left-date text cleanup requires shared line-pipeline cleaner helper");
  assertTrue(/linePipeline\.cleanOriginalTextForLeftDate\(\{/.test(statusDateSrc), "status_date left-date text cleanup delegates to shared line-pipeline cleaner helper");
  assertTrue(/lineFinalize\.applyCycleEndAndInvariants\(\{/.test(statusDateSrc), "status_date cycle-end plus final-invariants flow delegates to shared helper");
  assertTrue(/finalize\.resolveOffPrefixFlagsUnified\(\{/.test(tagwheelSrc), "tagwheel delegates off-prefix resolution to shared line finalizer");
  /*
   * И-1: успешное открытие TagWheel молчит.
   *
   * Пин смотрит не на текст сообщения, а на **участок**: от отрисовки панели
   * до конца успешной ветки уведомлений быть не должно. Так он ловит и другое
   * сообщение, если его туда положат, а не одну снятую строку.
   *
   * Уведомления в ветках отказа не трогаются: там человеку иначе не понять,
   * почему ничего не произошло.
   */
  const openTail = (() => {
    const from = tagwheelSrc.indexOf("var initialControl = withKeptPrefix(originalLine,");
    assertTrue(from > 0, "tagwheel open path still renders the initial control line");
    const to = tagwheelSrc.indexOf("} catch (e) {", from);
    assertTrue(to > from, "tagwheel open path still has its catch branch");
    return tagwheelSrc.slice(from, to);
  })();
  assertFalse(/notice\(/.test(openTail), "opening TagWheel says nothing when it works");
  /* Ищется вызов, а не слова: объяснение в комментарии рядом со снятой
     строкой цитирует её текст, и это правильно — оно говорит, чего там больше
     нет и почему. */
  assertFalse(/notice\('TagWheel: режим активирован/.test(tagwheelSrc), "the activation notice is not raised anywhere in tagwheel");
  /*
   * **Пины пошли за текстом в его новый дом** (У-56, 10.13.50). С 2026-09-06
   * сообщения TagWheel спрашивают текст у каталога: форма вызова стала
   * `notice(ключ, английское, …)`. Искать прежний литерал значило бы держать
   * пин без предмета — он покраснел бы честно, и покраснел.
   *
   * Ищется теперь **пара**: что сообщение поднимается и что ключ ему строит
   * функция, а не литерал (У-82). Второе важнее первого: разойтись молча
   * может только ключ.
   */
  assertTrue(/notice\(tagWheelNoticeKey\('no-app'\), 'TagWheel: no app context'\)/.test(tagwheelSrc),
    "tagwheel still reports a missing app context, through the catalogue");
  assertTrue(/notice\(tagWheelNoticeKey\('error'\), 'TagWheel error: \{0\}'/.test(tagwheelSrc),
    "tagwheel still reports its errors, through the catalogue");
  assertTrue(/function tagWheelNoticeKey\(name\)/.test(tagwheelSrc),
    "tagwheel builds its catalogue keys with one function, not with literals (У-82)");
  assertFalse(/notice\('notice\.tagwheel\./.test(tagwheelSrc),
    "a literal stands where the catalogue key should be built (У-82)");
  /*
   * Русская строка на экране была дефектом, а не выбором: интерфейс
   * английский (Р9). Запрет именно на неё, потому что вернуться она может
   * только правкой этого места.
   */
  assertFalse(/нет активного редактора/.test(tagwheelSrc),
    "tagwheel shows a Russian string to the user again (Р9)");
  assertTrue(/notice\(tagWheelNoticeKey\('no-editor'\), 'TagWheel: open a note first'\)/.test(tagwheelSrc),
    "tagwheel still tells the user there is no editor");

  /*
   * И-3: два хода обязаны считать `clearedOwnCheckbox`, а не подставлять его
   * константой. Именно литерал `false` в TagWheel и был всей разницей между
   * ними; поведение общего решения держит `runtime_unified_parity_tests.js`,
   * а то, что аргумент считается на обоих ходах, — этот пин.
   */
  assertFalse(/clearedOwnCheckbox:\s*false/.test(tagwheelSrc), "tagwheel no longer hard-codes the cleared-checkbox flag");
  assertTrue(/function fieldHasAnyCheckboxRule\(/.test(tagwheelSrc), "tagwheel knows whether a field has any checkbox rule at all");
  assertTrue(/function fieldHasAnyCheckboxRule\(/.test(statusTagsSrc), "status_tags knows whether a field has any checkbox rule at all");
  assertTrue(/clearedOwnCheckbox:\s*clearedOwnCheckbox/.test(tagwheelSrc), "tagwheel passes the computed cleared-checkbox flag");
  assertTrue(/clearedOwnCheckbox:\s*targetSelectionClearedByAction && fieldHasAnyCheckboxRule\(/.test(statusTagsSrc), "status_tags passes the computed cleared-checkbox flag");
  assertTrue(/hasDateLikeMarkerInText\(textOnly\)/.test(statusDateSrc), "status_date due-left guard uses shared marker text classifier");
  assertTrue(/removeMarkerTokensFromSegment\(src, marker, valueRxSrc \|\| ""\)/.test(statusDateSrc), "status_date date marker cleanup uses shared marker-token remover helper");
  assertTrue(/function resolveFieldIdByOrderKey\(/.test(statusDateSrc), "status_date resolves generic order-key fields");
  assertTrue(/function getRuntimeFieldConfigRow\(/.test(statusDateSrc) && /function getElementRuntimeCfg\(/.test(statusDateSrc), "status_date resolves element runtime config via generic runtime-field lookup");
  assertTrue(/function hydrateGenericElementFromRawLine\(/.test(statusDateSrc), "status_date hydrates generic element values from line");
  assertTrue(/function applyGenericElementIncrementByFormat\(/.test(statusDateSrc), "status_date mutates generic elements via increment behavior config");
  assertTrue(/function buildGenericElementTokenFromState\(/.test(statusDateSrc), "status_date builds generic element token from format state");
  assertTrue(/shared\.relocateMarkerTokenByPanel\(\{/.test(statusDateSrc), "status_date marker relocation delegates to shared line-pipeline helper");
  assertTrue(/shared\.clearMarkerFromLine\(\{/.test(statusDateSrc), "status_date marker clear delegates to shared line-pipeline helper");
  assertTrue(/shared\.clearMarkersFromLine\(\{/.test(statusDateSrc), "status_date marker-multi-clear delegates to shared line-pipeline helper");
  assertTrue(/if \(!inc && curNum <= 0\)/.test(statusDateSrc), "status_date date-offset decrement clears only from zero-progress state");
  assertTrue(/applyGenericElementIncrementByFormat\(state, actionField\.id, runtimeCfg\.increment, actionFormat, actionMeta\.increase, actionCycleValues\)/.test(statusDateSrc), "status_date applies generic element increment logic via unified action field executor");
  assertTrue(/if \(idx >= arr\.length - 1\) return "";/.test(statusDateSrc), "status_date generic increase exits cycle to null at upper bound");
  assertTrue(/if \(idx <= 0\) return "";/.test(statusDateSrc), "status_date generic decrease exits cycle to null at lower bound");
  assertTrue(/shared\.getDefaultTagTokenKeyMapOptions\(\)/.test(statusDateSrc), "status_date token-key map options come from shared helper");
  assertTrue(/throw new Error\("shared_utils unavailable: buildTokenlessValueRegexSource"\);/.test(statusDateSrc), "status_date tokenless regex builder is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: parseTokenlessProgress"\);/.test(statusDateSrc), "status_date tokenless parser is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: parseHhmm"\);/.test(statusDateSrc), "status_date HH:mm parser is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: addMinutesHhmm"\);/.test(statusDateSrc), "status_date HH:mm adder is shared-utils-only");
  assertTrue(/throw new Error\("shared_utils unavailable: formatNowByMask"\);/.test(statusDateSrc), "status_date now-mask formatter is shared-utils-only");
  assertTrue(/buildBulletOnlyLine\(parsed, \{ keepParsedPrefix: true, keepCheckbox: false \}\)/.test(tagwheelSrc), "tagwheel keep-bullet line preserves parsed bullet prefix without stale checkbox");
  assertTrue(/linePipeline\.splitLeftPrefix\(seg\.left\)/.test(tagwheelSrc), "tagwheel reorder\/relocate uses shared left-prefix splitter");
  assertTrue(/linePipeline\.joinLeftPrefix\(leftParts\.prefix, orderedLeft\)/.test(tagwheelSrc), "tagwheel reorder\/relocate uses shared left-prefix joiner");
  assertTrue(/state\.session\.activeField = state\.core\.resolveInitialActiveField\(state\.rules, state\.session, state\.session\.mode\)/.test(tagwheelSrc), "tagwheel reapplies lead/default field resolver on Tab mode switch");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: normalizeCycleEndBehavior'\)/.test(tagwheelSrc), "tagwheel cycle behavior helper is shared-only");
  assertTrue(/resolvePrefixBehaviorShared\(rules, state, deps\)/.test(tagwheelCoreSrc), "tagwheel_core resolves shared prefix behavior from injected deps/state");
  assertFalse(/loadCoreHelperFromGlobalOrRequire\('__inlinePkmLineFinalizeUnified'/.test(tagwheelCoreSrc), "tagwheel_core does not self-load shared prefix module");
  assertTrue(/shared\.buildPrefixUnified\(/.test(tagwheelCoreSrc), "tagwheel_core buildPrefix delegates to shared prefix behavior");
  assertFalse(/startsWith\('📅'\)|startsWith\('🗓️'\)|startsWith\('🛫'\)|startsWith\('🕒'\)|startsWith\('⌛'\)/.test(tagwheelCoreSrc), "tagwheel_core date-like token classifier has no hardcoded emoji prefixes");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: reorderSegmentTokensByOrder'\)/.test(tagwheelSrc), "tagwheel segment reorder helper is shared-only");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: resolvePanelForField'\)/.test(tagwheelSrc), "tagwheel panel resolver helper is shared-only");
  assertTrue(/rulesHelpers\.resolvePanelForField\(orderCfg, fieldKey, \{ defaultPanel: modeName \}\)|rulesHelpers\.resolvePanelForField\(runtimeOrderCfg, key, \{ defaultPanel: 'right' \}\)|rulesHelpers\.resolvePanelForField\(state\.orderCfg, panelKey, \{ defaultPanel: 'right' \}\)/.test(tagwheelSrc), "tagwheel panel resolver delegates to shared helper");
  assertTrue(/if \(hasMinimalSelected\) \{\s*finalLine = applyMinimalLeftTagNormalization\(finalLine, state, core, \{[\s\S]*preserveExistingTokens:\s*hasOffSelected/.test(tagwheelSrc), "tagwheel applies minimal normalization whenever minimal selection exists");
  assertTrue(/resolveEffectiveSelectionPolicy\(\{[\s\S]*selectedEntries:[\s\S]*freeRoamBehavior:[\s\S]*activeMode:/.test(tagwheelSrc) || /resolveMixedSelectionPolicy\(selectedEntries, freeRoamBehavior\)/.test(tagwheelSrc), "tagwheel resolves mixed selection policy via shared finalizer effective-policy helper");
  assertTrue(/applyUnifiedPostFinalize\(\{/.test(tagwheelSrc) || /applyMixedPostPolicies\(state\.originalLine, finalLine, state\.rules, policy\)/.test(tagwheelSrc), "tagwheel delegates minimal prefix\/separator post-processing through shared finalizer path");
  assertTrue(/__prefixIgnoreFieldIds/.test(tagwheelSrc), "tagwheel computes prefix-ignore map for minimal fields when minimalPrefix is off");
  assertTrue(/shared\.resolvePrefixCheckboxUnified\(/.test(tagwheelCoreSrc), "tagwheel_core resolvePrefixCheckbox delegates to shared prefix behavior");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: getDateMarkersFromRules'\)/.test(tagwheelSrc), "tagwheel date-marker resolver is shared-only");
  assertTrue(/async function callRuntimeApi\(app_, method\)/.test(tagwheelSrc), "tagwheel defines runtime api dispatcher helper");
  assertFalse(/loadVaultModule/.test(tagwheelSrc), "tagwheel does not load modules by a vault path at all any more (У-89)");
  assertFalse(/runtimeApi\.load[A-Za-z]+\(/.test(tagwheelSrc), "tagwheel has no direct runtimeApi.load* calls in adapter flow");
  assertFalse(/<span style=\"color: /.test(tagwheelCoreSrc), "tagwheel_core does not inject inline HTML color wrappers");
  assertFalse(/<mark style=\"background-color: /.test(tagwheelCoreSrc), "tagwheel_core does not inject inline HTML fill wrappers");
  assertTrue(/createTagwheelHeaderDecorationExtension\(plugin\)/.test(mountSrc), "main registers live-preview tagwheel color decoration extension");
  assertTrue(/function getTagVisualsFromConfig\(/.test(visualsSrc), "main exposes tagVisuals config reader for runtime painter");
  assertTrue(/function buildFieldTagVisualMap\(/.test(visualsSrc), "main builds deterministic field-tag visual map");
  assertTrue(/function resolveEffectiveTagVisualMode\(/.test(visualsSrc), "main defines effective tag visual mode resolver with custom fallback");
  assertTrue(/function normalizeRuntimeTagVisualRow\(/.test(visualsSrc), "main defines shared runtime tag visual row normalizer");
  assertTrue(/function scoreTagVisualRow\(/.test(visualsSrc), "main defines deterministic tag visual row scoring");
  assertTrue(/function pickStrongerTagVisualRow\(/.test(visualsSrc), "main defines deterministic tag visual row merge chooser");
  assertFalse(/Object\.prototype\.hasOwnProperty\.call\(out, token\)\) continue;/.test(visualsSrc), "main no longer uses first-win continue for token visual map merges");
  assertTrue(/mode === "custom" \? "empty"/.test(visualsSrc) || /return String\(row && row\.customText \|\| ""\)\.trim\(\) \? "custom" : "empty"/.test(visualsSrc), "main maps custom mode with empty text to empty behavior");
  assertTrue(/function resolveTagVisualZone\(/.test(visualsSrc), "main defines zone resolver for left/right opacity");
  assertTrue(/class TagVisualTokenWidget extends cmView\.WidgetType/.test(decorSrc), "main defines unified tag visual widget for full and empty rendering");
  assertTrue(/this\.displayTextOverride = String\(displayTextOverride \|\| ""\)/.test(decorSrc), "tag visual widget supports custom display text override");
  assertTrue(/displayTextOverride \|\| this\.tokenText/.test(decorSrc), "tag visual widget renders custom text when provided");
  assertTrue(/function createTagVisualDecorationExtension\(plugin\)/.test(decorSrc), "main defines tag visual CM6 extension");
  assertTrue(/createTagVisualDecorationExtension\(plugin\)/.test(mountSrc), "main registers tag visual CM6 extension");
  assertFalse(/rt\.loadPkmOptionKeys\(\)/.test(tagwheelSrc), "tagwheel option key preload avoids direct runtime object method calls");
  assertFalse(/getDateFieldsFromRules/.test(tagwheelSrc), "tagwheel has no local getDateFieldsFromRules wrapper");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: getDateValuePatterns'\)/.test(tagwheelSrc), "tagwheel date value-patterns helper is shared-only");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: removeMarkerTokensFromSegment'\)/.test(tagwheelSrc), "tagwheel marker-token remover helper is shared-only");
  assertTrue(/core\.getNavigableFieldSequence\(rules, session\)/.test(tagwheelSrc), "tagwheel virtual field navigation uses core navigable sequence");
  assertTrue(/function getNavigableFieldSequence\(/.test(tagwheelCoreSrc), "tagwheel_core exports navigable field sequence helper");
  assertTrue(/getRenderedGroupsForMode\(/.test(tagwheelCoreSrc), "tagwheel_core reuses rendered groups for navigation parity");
  assertTrue(/function buildPanelGroupsFromTechOrder\(/.test(tagwheelCoreSrc), "tagwheel_core uses unified panel-group builder for left/right");
  assertTrue(/state\.mode === 'left'\) return buildPanelGroupsFromTechOrder\(rules, mode, 'left'\)/.test(tagwheelCoreSrc), "tagwheel_core left panel render path uses unified panel-group builder");
  assertTrue(/buildPanelGroupsFromTechOrder\(rules, mode, 'right'\)/.test(tagwheelCoreSrc), "tagwheel_core builds right panel groups via unified panel-group builder");
  assertFalse(/orderMode === 'manual' && Array\.isArray\(rules\.ui\.leftGroups\)/.test(tagwheelCoreSrc), "tagwheel_core has no left-only manual branch in runtime group render path");
  assertFalse(/state\.mode === 'right' && Array\.isArray\(rules\.ui\.rightGroups\)/.test(tagwheelCoreSrc), "tagwheel_core does not use static rightGroups-only branch");
  assertFalse(/rules\.ui\.rightGroups\s*=/.test(pkmRulesHelpersSrc), "runtime rules helper does not emit legacy ui.rightGroups runtime source");
  assertFalse(/!isFieldEnabled\(fieldMode, state, field, rules\) && field\.dependsOn/.test(tagwheelCoreSrc), "tagwheel_core group rendering does not leak disabled fields into placeholders");
  assertTrue(/if \(!hasVisibleField\) \{\s*return \{ hidden: true, active: false, text: '' \}/.test(tagwheelCoreSrc), "tagwheel_core hides group when no visible fields remain");
  assertTrue(/getDateMarkersFromRules\(rules\)/.test(tagwheelSrc), "tagwheel order flow uses shared date-marker resolver");
  assertFalse(/getDateFieldsFromRules\(rules\)/.test(tagwheelSrc), "tagwheel relocate-date flow does not depend on date-fields helper wrapper");
  assertTrue(/getDateValuePatterns\(\)/.test(tagwheelSrc), "tagwheel relocate-date flow uses shared date value-patterns helper");
  assertTrue(/shared\.relocateMarkerSetByFieldOrder\(\{/.test(tagwheelSrc), "tagwheel relocate-date flow delegates marker-set relocation to shared line-pipeline helper");
  assertTrue(/throw new Error\('line_pipeline unavailable: relocateMarkerSetByFieldOrder'\)/.test(tagwheelSrc), "tagwheel relocate-date flow requires shared line-pipeline marker-set relocation helper");
  assertTrue(/shared\.relocateTokenSetByPanel\(\{/.test(tagwheelSrc), "tagwheel tag-field relocation delegates to shared line-pipeline helper");
  assertTrue(/throw new Error\('line_pipeline unavailable: relocateTokenSetByPanel'\)/.test(tagwheelSrc), "tagwheel tag-field relocation requires shared line-pipeline helper");
  assertTrue(/status(?:LineRuntime|Rt)\.relocateCoreTagsByOrder\(\{/.test(tagwheelSrc), "tagwheel tag relocation order pass delegates to shared status-line runtime helper");
  assertTrue(/var rightSourceEntries = rightEntries\.filter\(function \(e\)/.test(tagwheelSrc), "tagwheel collects right-panel source-driven entries for apply path");
  /* Здесь стоял пин на литерал `'right'` в этом вызове — то есть на сам
     дефект Н-3. Заменён ниже на проверку посчитанной панели. */
  assertTrue(/removeMarkerTokens:\s*function\(segLine, mk, valueRx\)\s*\{[\s\S]*removeMarkerTokensFromSegment\(segLine, mk, valueRx\)/.test(tagwheelSrc), "tagwheel relocate-date cleanup uses shared marker-token remover helper through adapter callback");
  assertTrue(/shared\.getTagWheelMixedReorderOptions\(markers\)/.test(tagwheelSrc), "tagwheel mixed reorder options come from shared helper");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: buildTagTokenKeyMap'\)/.test(tagwheelSrc), "tagwheel token-key map helper is shared-only");
  assertTrue(/shared\.getDefaultTagTokenKeyMapOptions\(\)/.test(tagwheelSrc), "tagwheel token-key map options come from shared helper");
  assertFalse(/function getCursorForPanel\(/.test(tagwheelSrc), "tagwheel no longer defines local panel-cursor wrapper");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: firstTokenByPattern'\)/.test(tagwheelSrc), "tagwheel first-token helper is shared-only");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: segmentHasToken'\)/.test(tagwheelSrc), "tagwheel token matcher is shared-only");
  assertFalse(/function removeByPattern\(/.test(tagwheelSrc), "tagwheel no longer defines local removeByPattern wrapper");
  assertTrue(/removeCombinedByParentToken:\s*function\(seg, parentToken\)/.test(tagwheelSrc) && /removeMarkerTokensFromSegment\(seg, parentToken, '.*\\S\+'\)/.test(tagwheelSrc), "tagwheel combined-subtag cleanup uses shared marker-token remover path");
  assertTrue(/statusLineRuntime\.buildCombinedSelectionSet\(\{/.test(tagwheelCoreSrc) && /statusLineRuntime\.applyCombinedToTokenList\(tags, combinedEntries\)/.test(tagwheelCoreSrc), "tagwheel_core combined render uses shared status-line runtime helpers");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: removeTokensFromSegment'\)/.test(tagwheelSrc), "tagwheel token remover is shared-only");
  assertFalse(/removeTokens:\s*removeTokens\b/.test(tagwheelSrc), "tagwheel has no dangling removeTokens reference in off-selection post policy path");
  assertTrue(/removeTokens:\s*function\(seg, tokenList\)\s*\{[\s\S]*macroShared\.removeTokensFromSegment\(seg, tokenList\)/.test(tagwheelSrc), "tagwheel off-selection post policy delegates removeTokens via shared macro helper");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: normalizeCursorPolicy'\)/.test(tagwheelSrc), "tagwheel cursor policy helper is shared-only");
  assertTrue(/throw new Error\('pkm_macro_shared unavailable: isNoContentParsed'\)/.test(tagwheelSrc), "tagwheel no-content helper is shared-only");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: parseOrderConfig'\)/.test(tagwheelSrc), "tagwheel order parser helper is shared-only");
  assertTrue(/throw new Error\('shared_utils unavailable: buildTokenlessValueRegexSource'\)/.test(tagwheelCoreSrc), "tagwheel_core tokenless regex builder is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: parseTokenlessProgress'\)/.test(tagwheelCoreSrc), "tagwheel_core tokenless parser is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: parseHhmm'\)/.test(tagwheelCoreSrc), "tagwheel_core HH:mm parser is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: addMinutesHhmm'\)/.test(tagwheelCoreSrc), "tagwheel_core HH:mm adder is shared-utils-only");
  assertTrue(/throw new Error\('shared_utils unavailable: formatNowByMask'\)/.test(tagwheelCoreSrc), "tagwheel_core now-mask formatter is shared-utils-only");
  /*
   * Разбор правил у `tagwheel_core` **только** общим модулем: копии сняты
   * 2026-09-07 вместе с мостом. Слово «when available» в прежней формулировке
   * и было всей проблемой — «а если недоступен, то своей копией», и в сборке
   * недоступен он был всегда (У-89). Теперь недоступным ему быть негде.
   */
  assertTrue(/__tagwheelRulesNormalizer\.normalizeMode\(mode, modeName, \{ isObj: isObj, err: err \}\)/.test(tagwheelCoreSrc), "tagwheel_core normalizeMode delegates to the shared rules normalizer, with no local copy");
  assertTrue(/__tagwheelRulesNormalizer\.normalizeField\(/.test(tagwheelCoreSrc), "and so does normalizeField");
  assertTrue(/__tagwheelRulesNormalizer\.normalizeValue\(/.test(tagwheelCoreSrc), "and normalizeValue");
  assertTrue(/__markdownJsonBlockParser\.parseJsonBlock\(/.test(tagwheelCoreSrc), "and the JSON block parser");
  assertFalse(/if \(normalizer && typeof normalizer\./.test(tagwheelCoreSrc), "tagwheel_core keeps no fallback branch around the shared rules normalizer");
  assertFalse(/if \(parser && typeof parser\./.test(tagwheelCoreSrc), "and none around the shared JSON block parser");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: applyOrderToRules'\)/.test(tagwheelSrc), "tagwheel order apply helper is shared-only");
  assertTrue(/if \(\/_sub\$\/\.test\(raw\) && collapsed === raw\) return raw\.slice\(0, -4\);/.test(pkmRulesHelpersSrc), "rules helpers collapseSubOrderKey force-collapses _sub when registry fallback returns unchanged key");
  assertTrue(/const seen = visited instanceof Set \? visited : new Set\(\);/.test(pkmRulesHelpersSrc) && /if \(seen\.has\(k\)\) return "";/.test(pkmRulesHelpersSrc), "rules helpers resolveIdByOrderKey guards against recursive key resolution loops");
  assertTrue(/const runtimeExcludedIds = new Set\(\);/.test(pkmRulesHelpersSrc) && /const reconcileModeDependencies = \(mode, scopeFields\) => \{/.test(pkmRulesHelpersSrc), "rules helpers define mode dependency reconcile pass with runtime exclusion tracking");
  assertTrue(/if \(!parentExists \|\| !runtimeEligible\.has\(fid\)\) \{[\s\S]*?f\.enabled = false;[\s\S]*?runtimeExcludedIds\.add\(fid\);/.test(pkmRulesHelpersSrc), "rules helpers disable and runtime-exclude children with invalid dependency placement");
  assertTrue(/if \(!parentExists\) \{[\s\S]*?f\.dependsOn = "";/.test(pkmRulesHelpersSrc), "rules helpers preserve model safely by clearing broken dependsOn links");
  /*
   * Левый список ищет родителя только у себя, правый — в обоих: ссылка и
   * элемент могут ждать тег, тег ждёт только тега (PRD 10.13.4, Н24).
   */
  assertTrue(/reconcileModeDependencies\(rules\.leftMode, leftFields\);[\s\S]*?reconcileModeDependencies\(rules\.rightMode, leftFields\.concat\(rightFields\)\);/.test(pkmRulesHelpersSrc), "rules helpers reconcile dependencies for both panels, right one across both lists");
  /*
   * Второй проход, отвергавший ту же связь, — `validateMode` в
   * `tagwheel_core.js`: он не выключал Field, а бросал исключение, и TagWheel
   * не открывался вовсе (находка Н-1 из vault, 2026-08-28). Границу ему
   * открыли ровно ту же и в ту же сторону, что и первому: два прохода обязаны
   * сходиться, иначе один стирает связь, а второй на неё ругается.
   */
  assertTrue(/function validateMode\(mode, modeName, scopeFields\) \{/.test(tagwheelCoreSrc), "tagwheel_core validateMode takes an explicit dependency scope");
  assertTrue(/validateMode\(rules\.leftMode, 'leftMode', leftScope\)[\s\S]*?validateMode\(rules\.rightMode, 'rightMode', leftScope\.concat\(rightScope\)\)/.test(tagwheelCoreSrc), "tagwheel_core validates dependencies for both lists, right one across both");
  assertTrue(/if \(field\.dependsOn && !depIds\[field\.dependsOn\]\) \{/.test(tagwheelCoreSrc), "tagwheel_core still rejects a dependsOn that names no field at all");
  /*
   * Третий проход — `allowInPanel`: он брал Block родителя и молча прятал
   * Field с предусловием из обеих панелей. Признак, разводящий дочерний Field
   * и Field с предусловием, — свой ключ, лежащий в одном из Block.
   */
  assertTrue(/function ownOrderKeyPlaced\(field\) \{/.test(tagwheelCoreSrc), "tagwheel_core tells a child field from a field with a prerequisite by its own placed order key");
  assertTrue(/if \(field\.dependsOn && !ownOrderKeyPlaced\(field\)\) \{/.test(tagwheelCoreSrc), "tagwheel_core panel membership prefers the field's own Block over its parent's");
  assertTrue(/var depIsChild = !!dep\.dependsOn && !ownOrderKeyPlaced\(dep\)/.test(tagwheelCoreSrc), "tagwheel_core keeps the `sub` placeholder for child fields only");
  /*
   * Н-3: Block ссылки берётся из Order, а не ставится литералом. Закреплено по
   * исходнику, потому что `tagwheel.js` вне Obsidian не запускается — он
   * просит редактор. Поведение самого инструмента перекладывания проверено
   * по-настоящему в `block_placement_tests.ts`; здесь проверяется, что его
   * зовут с посчитанной панелью.
   */
  assertTrue(/panel: rulesHelpers\.resolvePanelForField\(state\.orderCfg, entryOrderKey, \{ defaultPanel: 'right' \}\)/.test(tagwheelSrc), "tagwheel resolves the Block of a link from Order instead of hardcoding right");
  assertTrue(/relocateTagFieldByPanel\(finalLine, state\.rules, rs\.tokens, rs\.token, rs\.panel,/.test(tagwheelSrc), "tagwheel relocates a link to the Block it was resolved for");
  assertFalse(/relocateTagFieldByPanel\([^)]*'right'/.test(tagwheelSrc), "tagwheel has no hardcoded right panel left in the relocation call");
  /*
   * Н-5: Field с пустым значением всё равно даёт запись — иначе старый
   * wikilink некому убрать из строки при выходе из цикла.
   */
  assertTrue(/if \(!selected && !isSourceDriven\) continue/.test(tagwheelSrc), "tagwheel keeps an entry for a source-driven field with an empty value");
  assertTrue(/var token = isSourceDriven && selected \? selectedTagTokenForField/.test(tagwheelSrc), "tagwheel leaves the token empty when the cycle is exited");
  assertFalse(/return !!\(e && e\.token && Array\.isArray\(e\.tokens\)/.test(tagwheelSrc), "tagwheel no longer drops empty-token entries before relocation");
  /*
   * Н-6 и Н-8: разбор строки не считает текст левым сегментом. Проверка на
   * поведении — `block_placement_tests.ts`; здесь закреплено, что развязка
   * делается только у строк с маркером списка, иначе сборка подставит `-`.
   */
  assertTrue(/function demoteLeftBodyToText\(leftRaw, markers\) \{/.test(linePipelineSrc), "line pipeline tells a text-only left segment from a token one");
  assertTrue(/if \(!parts\.prefix \|\| !parts\.body\) return null;/.test(linePipelineSrc), "line pipeline demotes the left body only for list lines");
  assertFalse(/category_sub|clients/.test(pkmRulesHelpersSrc.slice(pkmRulesHelpersSrc.indexOf("const runtimeExcludedIds = new Set();"), pkmRulesHelpersSrc.indexOf("for (const f of allFields)"))), "rules helpers dependency reconcile has no hardcoded domain field names");
  /*
   * Десятое исключение к З3, разрешение заказчика 2026-09-02 по замечанию D6
   * (PRD 10.13.15): цвета коробки скроллера доезжают до неё.
   *
   * Закреплено по исходнику по той же причине, что и Н-3 выше: `tagwheel.js`
   * вне Obsidian не запускается — он просит редактор. Само применение цветов
   * проверено по-настоящему в оверлее (`tagwheel_scroller_overlay_tests.js`);
   * здесь закреплено, что цвета до него доходят и что форму им проверяют.
   */
  assertTrue(/fillColor: hex\(raw\.scrollerFillColor\)/.test(tagwheelSrc), "tagwheel normalizes the scroller fill colour");
  assertTrue(/textColor: hex\(raw\.scrollerTextColor\)/.test(tagwheelSrc), "tagwheel normalizes the scroller text colour");
  assertTrue(/fillColor: scrollerCfg\.fillColor/.test(tagwheelSrc), "tagwheel passes the scroller fill colour to the overlay");
  assertTrue(/textColor: scrollerCfg\.textColor/.test(tagwheelSrc), "tagwheel passes the scroller text colour to the overlay");
  /*
   * Край Block (10.13.35). Решение проверено по-настоящему в
   * `tests/TagWheel/tagwheel_tests.js` — `planFieldStep` чистая функция и
   * запускается без Obsidian. Здесь закреплён **шов**: кто подаёт сюда
   * значение (У-56). Настройка панели проходит четыре руки — конфиг,
   * `main.js`, разбор опций, состояние сессии, — и обрыв в любой из них
   * оставил бы решение зелёным при мёртвом контроле.
   */
  assertTrue(/TAGWHEEL_EDGE_MODE\]: readCfgPath\(cfg, "visual\.tagWheel\.edgeMode"\)/.test(commandsSrc), "main passes the Block edge mode into the runtime settings");
  assertTrue(/out\.edgeMode = qa\[TAGWHEEL_EDGE_MODE_OPTION\]/.test(tagwheelSrc), "tagwheel reads the Block edge mode out of the runtime settings");
  assertTrue(/edgeMode: normalizeEdgeMode\(runtimeInput\.edgeMode\)/.test(tagwheelSrc), "tagwheel keeps the normalized edge mode on the session state");
  assertTrue(/plan = planFieldStep\(\{/.test(tagwheelSrc), "tagwheel arrow step delegates the decision to the pure planner");
  /*
   * Своя каретка (10.13.33 Ц9). Решение проверено по-настоящему в
   * `caret_color_tests.ts`, здесь закреплён **шов**: слой, который никто не
   * зарегистрировал, не нарисует ничего, а обе проверки останутся зелёными
   * (У-56). Ровно этим и был прежний дефект: код каретки был, а до экрана не
   * доезжал.
   */
  assertTrue(/registerEditorExtension\(createCaretLayerExtension\(plugin\)\)/.test(mountSrc), "main registers the own caret layer as an editor extension");
  assertTrue(/cmView\.layer\(\{/.test(decorSrc), "own caret layer is built with the platform layer helper");
  assertTrue(/cmView\.RectangleMarker\.forRange\(view, CARET_MARKER_CLASS, range\)/.test(decorSrc), "own caret layer measures its marker with the platform helper");
  assertTrue(/class: CARET_LAYER_CLASS,/.test(decorSrc), "own caret layer names itself from the same constant the stylesheet uses");
  assertTrue(/module\.exports\.planFieldStep = planFieldStep/.test(tagwheelSrc), "tagwheel exports the pure planner so the decision can be checked without Obsidian");
  assertFalse(/isObj\s*:\s*isObj/.test(tagwheelSrc), "tagwheel does not reference removed isObj helper");
  assertTrue(/throw new Error\('pkm_rules_runtime_helpers unavailable: readRulesMarkdownWithFallback'\)/.test(tagwheelSrc), "tagwheel rules reader helper is shared-only");
  /*
   * Здесь стояли три пина «движок прогревает мост модулей» — по одному на
   * status_tags, status_date и TagWheel. Прогревать больше нечего: модули
   * приезжают литеральным `require`, и три вызова сняты вместе с методом
   * `loadVaultModuleBridgeShared`. Оставить пины значило бы держать
   * утверждение о снятой вещи (У-71).
   */
  assertAnyMatch(tagwheelSrc, [/await callRuntimeApi\(app_, 'loadRulesRuntimeHelpers'\)/, /await runtimeApi\.loadRulesRuntimeHelpers\(\)/], "tagwheel preloads shared rules helpers");
  assertAnyMatch(tagwheelSrc, [/await callRuntimeApi\(app_, 'loadMacroShared'\)/, /await runtimeApi\.loadMacroShared\(\)/], "tagwheel preloads shared macro helpers");
  assertAnyMatch(tagwheelSrc, [/await callRuntimeApi\(app_, 'loadLinePipeline'\)/, /await runtimeApi\.loadLinePipeline\(\)/], "tagwheel preloads shared line pipeline");
  assertFalse(/typeCheckboxByValue/.test(cfgSrc), "main has no typeCheckboxByValue fallback reads");
  assertFalse(/typeCheckboxByValue/.test(statusTagsSrc), "status_tags has no typeCheckboxByValue reads");
  assertFalse(/typeCheckboxByValue/.test(tagwheelSrc), "tagwheel runtime has no typeCheckboxByValue reads");
  assertFalse(/out\.pkm\.legacy\s*=/.test(configMigrationSrc), "config migration has no legacy mirror write");

  const testRules = { io: { separator1: "||", separator2: "||" } };
  const sampleSpaces = "    - [ ] #todo || 111";
  const segSpaces = linePipeline.splitSegments(sampleSpaces, testRules);
  assertEq(segSpaces.indent, "    ", "line pipeline preserves spaces indent");
  assertEq(linePipeline.buildFromSegments(segSpaces, testRules), sampleSpaces, "line pipeline roundtrip keeps spaces indent");

  const sampleTabs = "\t\t- [ ] #todo || 111";
  const segTabs = linePipeline.splitSegments(sampleTabs, testRules);
  assertEq(segTabs.indent, "\t\t", "line pipeline preserves tabs indent");
  assertEq(linePipeline.buildFromSegments(segTabs, testRules), sampleTabs, "line pipeline roundtrip keeps tabs indent");

  const sampleMixed = " \t  - [ ] #todo || 111";
  const stripped = linePipeline.stripPrefixKeepIndent(sampleMixed, true);
  assertTrue(/^ \t  /.test(stripped), "stripPrefixKeepIndent preserves mixed leading whitespace");

  const runtimeMarkerRules = {
    io: { separator1: "::", separator2: "::" },
    behavior: {
      dateRuntimeConfig: {
        byField: {
          date_due: { emoji: "📅" },
          time: { emoji: "🕒" },
        },
        canonical: {},
      },
    },
    rightMode: {
      fields: [
        { id: "date_due", orderKey: "date_due", kind: "genericElement", marker: "" },
        { id: "time", orderKey: "time", kind: "genericElement", marker: "" },
      ],
    },
  };
  const segRuntimeMarkers = linePipeline.splitSegments("111 :: 📅2026-04-27 🕒20:16", runtimeMarkerRules);
  assertEq(segRuntimeMarkers.text, "", "line pipeline treats runtime-config date markers as right payload text separator split");
  assertEq(segRuntimeMarkers.dates, "📅2026-04-27 🕒20:16", "line pipeline routes runtime-config marker tokens into right segment");
  const normalizedRightTail = linePipeline.normalizeRightPayloadTailToDates({
    line: "111 📅2026-04-27 🕒20:16 :: #account-alpha [[Entity-Alpha]]",
    rules: runtimeMarkerRules,
  });
  assertEq(
    normalizedRightTail,
    "111 :: 📅2026-04-27 🕒20:16 #account-alpha [[Entity-Alpha]]",
    "line pipeline moves right-like tail tokens from left body into right segment"
  );

  const cursorRules = { io: { separator1: "||", separator2: "||" }, dates: { markers: ["📅"] } };
  const cursorLine = "1111 || 📅2026-04-08";
  assertEq(pkmMacroShared.getCursorAtTextEnd(cursorLine, cursorRules), 4, "text_end cursor stays on text slot when tail is date payload");
  const cursorLineWithTextAndDate = "[ ] #todo || 1111 || 📅2026-04-08";
  assertEq(pkmMacroShared.getCursorAtTextEnd(cursorLineWithTextAndDate, cursorRules), 17, "text_end cursor stays at text segment end when second separator exists");
  assertEq(pkmMacroShared.getCursorForPanel(cursorLineWithTextAndDate, cursorRules, "right", { rightMode: "before_sep1" }), 9, "panel cursor before sep1 mode");
  assertEq(pkmMacroShared.getCursorForPanel(cursorLineWithTextAndDate, cursorRules, "right", { rightMode: "after_sep1" }), 13, "panel cursor after sep1 mode");
  assertEq(pkmMacroShared.getCursorForPanel(cursorLineWithTextAndDate, cursorRules, "right", { rightMode: "tag_slot" }), 17, "panel cursor tag slot mode");
  assertTrue(pkmMacroShared.segmentHasToken("#a #b", "#b"), "segment token matcher detects exact token");
  assertEq(pkmMacroShared.removeTokensFromSegment("#a #b #c", ["#b"]), "#a #c", "segment token remover keeps remaining tokens");
  assertEq(pkmMacroShared.firstTokenByPattern("📅2026-04-09 x", "📅", "\\d{4}-\\d{2}-\\d{2}"), "📅2026-04-09", "pattern token finder extracts first marker token");
  assertFalse(pkmMacroShared.isNoContentParsed({ tags: ["#todo"], text: "", dates: "", headingToken: "" }, { includeTags: true }), "no-content helper treats tags as content by default");
  assertTrue(pkmMacroShared.isNoContentParsed({ tags: [], text: "", dates: "", headingToken: "" }, { includeTags: true }), "no-content helper accepts truly empty payload");

  const markers = pkmRulesHelpers.getDateMarkersFromRules({
    behavior: {
      dateRuntimeConfig: {
        canonical: { due: "slotA", time: "slotClock" },
      },
    },
    rightMode: {
      fields: [
        { id: "slotA", orderKey: "slotA", kind: "dateOffset", marker: "📆" },
        { id: "slotClock", orderKey: "slotClock", kind: "nowTime", marker: "🕐" },
      ],
    },
  });
  assertTrue(Array.isArray(markers.due) && markers.due.indexOf("📆") !== -1, "date marker resolver picks due marker from canonical runtime mapping");
  const runtimeMarkers = pkmRulesHelpers.getDateMarkersFromRules({
    behavior: {
      dateRuntimeConfig: {
        byField: {
          date_due: { emoji: "📅" },
        },
        canonical: {},
      },
    },
    rightMode: {
      fields: [{ id: "date_due", orderKey: "date_due", kind: "genericElement", marker: "" }],
    },
  });
  assertEq(runtimeMarkers.orderKeysByMarker["📅"], "date_due", "date marker resolver uses runtime date config emoji when field marker is empty");
  const reorderedSeg = pkmRulesHelpers.reorderSegmentTokensByOrder(
    "- #/2 #todo [[proj]] 📅2026-04-09",
    { left: ["project", "importance"], right: ["date_due"], enabled: { project: true, importance: true, date_due: true } },
    "left",
    { "#/2": "importance", "[[proj]]": "project" },
    { includeKeys: ["project", "importance", "date_due"], projectFromWikilink: true, markers: markers }
  );
  assertEq(reorderedSeg, "- [[proj]] #/2 #todo 📅2026-04-09", "segment reorder helper keeps configured order and unknown tail");
  const tokenMap = pkmRulesHelpers.buildTagTokenKeyMap({
    leftMode: {
      fields: [
        { id: "priority", prefix: "#", values: [{ token: "/2", active: true }] },
        { id: "type", prefix: "#", values: [{ token: "todo", active: true }] },
        { id: "modal", prefix: "#", values: [{ token: "fast", active: true }] },
        { source: "projects", prefix: "#", values: [{ token: "ops", link: "Ops", active: true }] },
      ],
    },
    projects: { output: "wikilink" },
  }, { projectTagWhenWikilink: true, activeFlagKeys: ["active", "enabled"] });
  assertEq(tokenMap["#/2"], "priority", "token-key map resolves priority token by field id");
  assertTrue(tokenMap["#todo/fast"] === undefined || tokenMap["#todo/fast"] === "type" || tokenMap["#todo/fast"] === "modal", "token-key map combined token is optional without explicit relation metadata");
  assertEq(tokenMap["[[Ops]]"], "project", "token-key map resolves project wikilink token");

  const strictPanelRules = {
    io: { separator1: "||", separator2: "||" },
    behavior: {
      defaultMode: "left",
      order: {
        left: ["importance", "type", "category"],
        right: ["project"],
      },
    },
    inlineLayout: { techOrder: ["priority", "type", "context", "otherTags"] },
    ui: { leftPanelOrderMode: "fromTechOrder", leftGroups: [], rightGroups: [] },
    projects: { items: ["[[Ops]]"] },
    leftMode: {
      fields: [
        { id: "priority", placeholder: "важность", orderKey: "importance", values: [{ id: "", token: "" }, { id: "p2", token: "/2" }] },
        { id: "type", placeholder: "тип", orderKey: "type", values: [{ id: "", token: "" }, { id: "todo", token: "todo" }] },
        { id: "context", placeholder: "категория", orderKey: "category", values: [{ id: "", token: "" }, { id: "work", token: "work" }] },
        { id: "project", placeholder: "проект", source: "projects", orderKey: "project", values: [{ id: "", token: "" }] },
        { id: "stray", placeholder: "stray", values: [{ id: "", token: "" }, { id: "x", token: "x" }] },
      ],
    },
    rightMode: { fields: [] },
  };
  const strictState = tagwheelCore.makeInitialState(strictPanelRules, "left");
  strictState.mode = "left";
  strictState.activeFieldId = "priority";
  const strictSeq = tagwheelCore.getNavigableFieldSequence(strictPanelRules, strictState);
  assertTrue(strictSeq.indexOf("priority") !== -1, "strict order keeps left order field priority");
  assertTrue(strictSeq.indexOf("type") !== -1, "strict order keeps left order field type");
  assertTrue(strictSeq.indexOf("context") !== -1, "strict order keeps left order field category");
  assertFalse(strictSeq.indexOf("project") !== -1, "strict order hides right-only project from left panel");
  assertFalse(strictSeq.indexOf("stray") !== -1, "strict order hides unknown field outside order panels");

  const orderDrivenRules = {
    io: { separator1: "||", separator2: "||" },
    behavior: { defaultMode: "left" },
    inlineLayout: { techOrder: ["priority", "type", "context", "otherTags"] },
    ui: { leftPanelOrderMode: "fromTechOrder", leftGroups: [], rightGroups: [] },
    projects: { items: ["[[Ops]]"] },
    leftMode: {
      fields: [
        { id: "priority", prefix: "#", placeholder: "важность", values: [{ id: "", token: "" }, { id: "p2", token: "/2" }] },
        { id: "type", prefix: "#", placeholder: "тип", values: [{ id: "", token: "" }, { id: "todo", token: "todo" }] },
        { id: "context", prefix: "#", placeholder: "категория", values: [{ id: "", token: "" }, { id: "work", token: "work" }] },
        { id: "project", prefix: "#", placeholder: "проект", source: "projects", values: [{ id: "", token: "" }] },
        { id: "client", prefix: "#", placeholder: "client", values: [{ id: "", token: "" }, { id: "c1", token: "tenant-alpha" }] },
        { id: "client1", prefix: "#", placeholder: "client1", values: [{ id: "", token: "" }, { id: "c2", token: "account-alpha" }] },
      ],
    },
    rightMode: { fields: [] },
  };
  pkmRulesHelpers.applyOrderToRules(orderDrivenRules, {
    left: ["priority", "type", "context", "client", "client1", "project"],
    right: ["timeNow", "start", "due", "effort"],
    active: {
      priority: "yes",
      type: "yes",
      context: "yes",
      client: "yes",
      client1: "yes",
      project: "yes",
    },
    enabled: {
      priority: true,
      type: true,
      context: true,
      client: true,
      client1: true,
      project: true,
    },
    labels: {
      priority: "важность",
      type: "тип",
      context: "категория",
      client: "client",
      client1: "client1",
      project: "проект",
    },
    strictNames: {
      priority: "priority",
      type: "type",
      context: "context",
      client: "client",
      client1: "client1",
      project: "project",
    },
    types: {
      priority: "tag",
      type: "tag",
      context: "tag",
      client: "tag",
      client1: "tag",
      project: "wikilink",
    },
  });
  const orderDrivenState = tagwheelCore.makeInitialState(orderDrivenRules, "left");
  orderDrivenState.mode = "left";
  orderDrivenState.activeFieldId = "priority";
  const orderDrivenSeq = tagwheelCore.getNavigableFieldSequence(orderDrivenRules, orderDrivenState);
  assertEq(
    JSON.stringify(orderDrivenSeq),
    JSON.stringify(["priority", "type", "context", "client", "client1", "project"]),
    "left panel sequence follows Order.left exactly for custom + project placement"
  );

  const migratedDefaultMode = configMigration.normalizePkmBehaviorShape({ pkm: { fields: { defaultBlock: "RIGHT" } } });
  assertEq(migratedDefaultMode.pkm.fields.defaultBlock, "right", "config migration normalizes default block casing");

  const migratedLegacyCheckbox = configMigration.normalizePkmBehaviorShape({
    pkm: {
      prefixRules: {
        checkboxByFieldValue: {
          type: {
            todo: "[  ]",
            in_progress: "[I]",
            bad: "oops",
          },
        },
      },
    },
  });
  assertEq(migratedLegacyCheckbox.pkm.prefixRules.checkboxByFieldValue.type.todo, "[ ]", "config migration normalizes empty checkbox token");
  assertEq(migratedLegacyCheckbox.pkm.prefixRules.checkboxByFieldValue.type.in_progress, "[I]", "config migration preserves explicit checkbox state");
  assertTrue(!Object.prototype.hasOwnProperty.call(migratedLegacyCheckbox.pkm.prefixRules.checkboxByFieldValue.type, "bad"), "config migration removes invalid checkbox tokens");
  assertEq(migratedLegacyCheckbox.pkm.fields.checkboxByValue.in_progress, "[I]", "config migration fills checkboxByValue from the prefix rules map");
  assertEq(migratedLegacyCheckbox.pkm.fields.checkboxByValue.todo, "[ ]", "and fills it with already normalized tokens");
  assertTrue(!Object.prototype.hasOwnProperty.call(migratedLegacyCheckbox.pkm.fields.checkboxByValue, "bad"), "invalid tokens do not reach checkboxByValue");

  /*
   * У макро-рантайма не осталось загрузки модулей вовсе.
   *
   * Здесь по очереди стояли три поколения одного утверждения. Сначала два
   * пина про мост: «мост отдал не то — бросаем», «мост упал — не глушим».
   * Потом, когда мост сняли, — «неизвестный путь роняет загрузку, а не
   * отдаёт null», по временной таблице «путь → модуль». Таблица ушла
   * вместе с последним чтением по пути, и осталось самое сильное из трёх:
   * **способа попросить модуль по пути в этом API больше нет**.
   *
   * Почему это важнее, чем выглядит (У-90): прежняя цепочка на каждом слое
   * умела вернуть `null`, и на этом `null` плагин работал наполовину.
   * Теперь вернуть `null` неоткуда.
   */
  {
    assertEq(typeof pkmMacroRuntimeShared.loadVaultModule, "undefined",
      "у общей части макро-рантайма нет загрузки модуля по пути");
    assertEq(typeof pkmMacroRuntimeShared.MODULES_BY_VAULT_PATH, "undefined",
      "и таблицы путей тоже нет");

    /*
     * Положительный контроль (У-88): API не пустое, и то, что в нём есть,
     * отдаёт настоящие модули.
     */
    const api = await pkmMacroRuntimeEntry.bootstrapMacroRuntime({}, null);
    assertEq(typeof api.loadVaultModule, "undefined",
      "и в объекте, который получают движки, его тоже нет");
    const keys = await api.loadPkmOptionKeys();
    assertTrue(keys && keys.KEYS && typeof keys.KEYS === "object",
      "положительный контроль: ключи настроек приезжают настоящим модулем");
    const helpers = await api.loadRulesRuntimeHelpers();
    assertTrue(helpers && typeof helpers.parseOrderConfig === "function",
      "и помощники правил — тоже");
  }

  /*
   * Запасного пути служебного файла в `main.js` больше нет, и это запрет.
   *
   * Копия была вторым объявлением одного значения (У-32) и разошлась молча:
   * переезд файла в папку плагина (В-39) правил модуль и не тронул запаску, и
   * та двое суток указывала в корень vault. Теперь путь один — в
   * `pkm_option_keys`, — и разойтись ему не с чем. Снять этот запрет можно
   * только тем, что модуль снова может не доехать.
   */
  {
    assertFalse(/DEFAULT_RULES_PATH:\s*"/.test(src + cfgSrc), "в main.js нет второго объявления пути служебного файла");
    assertFalse(/LEGACY_RULES_PATH:\s*"/.test(src + cfgSrc), "в main.js нет второго объявления прежнего пути");
    const optionKeys = require(path.join(__dirname, "..", "..", "src", "core", "pkm_option_keys.js"));
    assertTrue(typeof optionKeys.DEFAULT_RULES_PATH === "string" && optionKeys.DEFAULT_RULES_PATH.length > 0,
      "положительный контроль: путь объявлен в модуле");
  }
  /*
   * Шов после восстановления копии (10.13.40). Закрепляется два факта,
   * которые поведением вне Obsidian не спросить: что шов делает обе вещи,
   * и что место служебного файла решает **та же** функция миграции, что и при
   * загрузке, а не второе объявление того же правила (У-32).
   */
  {
    /*
     * Шов уехал в `src/features/generated_rules.js` (кусок четвёртый разбора
     * `main.js`): в точке входа осталась обёртка, потому что зовёт его
     * восстановление копии через объект плагина. Утверждения спрашивают то же
     * самое там, где предмет теперь (У-94).
     */
    assertTrue(/return __generatedRules\.rebuildFromConfig\(this\);/.test(src),
      "main.js keeps the rebuildFromConfig seam used after a backup restore");
    const seam = /async function rebuildFromConfig\(plugin\)\s*\{[\s\S]*?\n\}/.exec(rulesSrc);
    assertTrue(!!seam, "модуль служебного файла держит сам шов");
    assertTrue(seam[0].indexOf("plugin.registerCommands()") !== -1,
      "rebuildFromConfig re-registers commands");
    assertTrue(seam[0].indexOf("reapplyLocation(plugin)") !== -1,
      "rebuildFromConfig re-applies the generated rules location");
    const move = /async function reapplyLocation\(plugin\)\s*\{[\s\S]*?\n\}/.exec(rulesSrc);
    assertTrue(!!move, "и держит переезд служебного файла");
    assertTrue(move[0].indexOf("await migration.moveGeneratedRulesIntoPluginFolder(") !== -1,
      "the rules location is decided by the migration function, not by a second copy of the rule");
    assertTrue(move[0].indexOf("plugin.pluginFolderPath()") !== -1,
      "and the plugin folder is computed, not spelled out");
  }
  /*
   * Знак чекбокса — ровно один, и это правило платформы (У-91):
   * Obsidian 1.13.7 разбирает строку списка регуляркой, где на месте
   * знака стоит одна точка, и пишет его в разметку как `data-task="(.)"`.
   * Скобки с содержимым длиннее одного знака платформа задачей не
   * считает — значит это текст человека.
   *
   * Правило жило в трёх расходящихся написаниях в 72 местах, и широкое
   * из них съедало первую пару скобок целиком: `- [test-transform] x`
   * превращалось в `- [ ] #todo :: x`, а у Transform то же место
   * съедало явное имя заметки. Поведением частичный возврат не
   * поймать: пока хоть одно место узкое, текст выживает, — поэтому
   * широкое написание запрещено здесь, сплошным обходом (У-85).
   *
   * Что должно случиться, чтобы запрет сняли (У-71): чекбокс перестанет
   * быть чекбоксом Obsidian, то есть платформа начнёт считать задачей
   * скобки с несколькими знаками. Тогда правило меняется ЗДЕСЬ и
   * в `normalizeCheckboxToken`, а не в отдельном месте разбора.
   *
   * Положительный контроль обязателен (У-88): и файлов, и узких
   * написаний должно быть больше нуля — запрет, которому нечего
   * запрещать, зелен всегда.
   */
  {
    const BS = String.fromCharCode(92);
    const WIDE_PLUS = BS + "[[^" + BS + "]]+" + BS + "]";
    const WIDE_STAR = BS + "[[^" + BS + "]]*" + BS + "]";
    const NARROW = BS + "[[^" + BS + "]]" + BS + "]";
    const WIKI_PRE = BS + "[";
    const WIKI_POST = BS + "]";

    function countOutsideWikilink(text, needle) {
      let n = 0;
      let i = 0;
      for (;;) {
        const j = text.indexOf(needle, i);
        if (j < 0) return n;
        const pre = text.slice(Math.max(0, j - 2), j);
        const post = text.slice(j + needle.length, j + needle.length + 2);
        if (!(pre === WIKI_PRE && post === WIKI_POST)) n += 1;
        i = j + 1;
      }
    }

    const roots = [
      path.join(__dirname, "..", "..", "src"),
      path.join(__dirname, "..", "..", "pkm_v2"),
    ];
    /*
     * Корень репозитория обходится наравне с папками: первая версия
     * этого сторожа перечисляла `main.js` руками и пропустила
     * `pkm_runtime_v2.js`, где широкое написание и осталось. Нашлось
     * оно не здесь, а в СБОРКЕ (У-89) — сторож был зелёный.
     */
    const repoRoot = path.join(__dirname, "..", "..");
    const walked = fs.readdirSync(repoRoot)
      .filter((name) => /\.(?:js|ts)$/.test(name))
      .map((name) => path.join(repoRoot, name));
    for (const r of roots) {
      (function walk(dir) {
        for (const name of fs.readdirSync(dir)) {
          const abs = path.join(dir, name);
          if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
          if (/\.(?:js|ts)$/.test(name)) walked.push(abs);
        }
      })(r);
    }

    let narrow = 0;
    const offenders = [];
    for (const abs of walked) {
      const text = fs.readFileSync(abs, "utf8");
      const wide = countOutsideWikilink(text, WIDE_PLUS) + countOutsideWikilink(text, WIDE_STAR);
      if (wide) offenders.push(path.relative(path.join(__dirname, "..", ".."), abs) + " x" + wide);
      narrow += countOutsideWikilink(text, NARROW);
    }
    assertTrue(walked.length > 50,
      "положительный контроль: обход нашёл исходники, а не пустоту (" + walked.length + ")");
    assertTrue(narrow > 30,
      "положительный контроль: узкое написание в исходниках есть (" + narrow + ")");
    assertEq(offenders.join("; "), "",
      "a checkbox is one character: brackets with a wider body are the human's text, not ours");
  }
  /*
   * Вид панели TagWheel пишется мимо истории отмен — и пишется так ВЕЗДЕ.
   *
   * **Что теперь проверено поведением, а что держит только этот сторож.**
   * Открытие панели, нажатия внутри неё и применение гоняются целиком — на
   * сборке, в `bundle_onload_tests.ts`: обработчик берётся оттуда, куда его
   * повесил движок, и считается то, что видит история. Так что «поведение
   * только у применения» здесь больше не написано — это было утверждение о
   * состоянии, и оно перестало быть верным (У-64).
   *
   * Держит этот сторож другое, и снимать его поэтому нельзя: **места записи,
   * по которым та проверка не ходит**, — выход по `Esc` (`cancelSelection`),
   * ветка выхода из цикла с сохранением буллита и любое место, которое здесь
   * появится завтра. Пин на одну функцию зелен и тогда, когда её перестали
   * звать (У-56), поэтому спрашивается не наличие функции, а **все** места
   * записи строки в этом файле.
   *
   * Разрешены ровно два прямых `setLine`: запасной путь внутри самой
   * `setLineOutsideHistory` и запись итога — она в историю попасть обязана,
   * иначе отменять человеку будет нечего.
   */
  {
    const twPath = path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel.js");
    const src = fs.readFileSync(twPath, "utf8");
    const ALLOWED = [
      "  editor.setLine(lineNumber, text)",
      "    state.editor.setLine(state.lineNumber, finalLine)",
    ];
    const lines = src.split("\n");
    const offenders = [];
    let allowedSeen = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/\.setLine\(/.test(line)) continue;
      if (ALLOWED.includes(line)) {
        allowedSeen++;
        continue;
      }
      offenders.push((i + 1) + ": " + line.trim());
    }
    assertEq(allowedSeen, ALLOWED.length,
      "положительный контроль: обе разрешённые записи на месте, значит ищется предмет, а не пустота");
    assertTrue(/setLineOutsideHistory\(state\.editor, state\.lineNumber, control\)/.test(src),
      "вид панели при нажатии пишется мимо истории");
    assertTrue(/setLineOutsideHistory\(editor, lineNumber, initialControl\)/.test(src),
      "первый вид панели тоже пишется мимо истории");
    /*
     * И оба вида собираются с сохранённым началом строки (A43). Пометки
     * «мимо истории» и записи различием для целой истории мало: знака списка
     * `renderControlLine` не рисует, и без `withKeptPrefix` панель снимала со
     * строки `- `, унося его из чужой ступени отмены. Поведение закреплено в
     * `tagwheel_tests.js`, но там вид панели собирает сама проверка — а вот
     * **кто зовёт** эту функцию в плагине, видно только отсюда (У-56).
     */
    for (const call of [
      "var control = withKeptPrefix(state.originalLine,",
      "var initialControl = withKeptPrefix(originalLine,",
    ]) {
      assertTrue(src.includes(call),
        "вид панели собирается без сохранённого начала строки: нет `" + call + "`");
    }
    assertEq(offenders.join("; "), "",
      "в TagWheel строка пишется через setLineOutsideHistory: прямой setLine оставляет ступень отмены");
  }

  /*
   * **Выгрузка плагина закрывает открытую панель** (Д-2 разбора готовности,
   * 2026-09-08).
   *
   * Поведение закреплено на сборке — `bundle_onload_tests.ts` открывает
   * настоящую сессию и зовёт настоящий `onunload`. Здесь спрашивается то, чего
   * оттуда не видно: **чем именно** сессия закрывается. Своё закрытие
   * («снять обработчик и вернуть строку») было бы вторым ответом на вопрос
   * «как закрывается панель», и он разошёлся бы с `Esc` молча (У-32).
   */
  {
    const twPath = path.join(__dirname, "..", "..", "pkm_v2", "TagWheel", "tagwheel.js");
    const tw = fs.readFileSync(twPath, "utf8");
    assertTrue(/state\.cancel = function\(\) \{/.test(tw),
      "у сессии TagWheel нет шва закрытия: выгрузка плагина не сможет её закрыть");
    const seam = tw.slice(tw.indexOf("state.cancel = function()"), tw.indexOf("window.__tagWheelState = state"));
    assertTrue(/cancelSelection\(state\)/.test(seam),
      "шов закрытия зовёт не cancelSelection: у «как закрывается панель» появился второй ответ");
    assertTrue(/cleanupTagWheelState\(state\)/.test(seam),
      "при отказе записи шов не снимает перехват клавиш — а снятие важнее возврата строки");

    const mainSrc = fs.readFileSync(path.join(__dirname, "..", "..", "main.js"), "utf8");
    const unload = mainSrc.slice(mainSrc.indexOf("onunload()"), mainSrc.indexOf("async ensureGeneratedRulesNow"));
    assertTrue(/closeTagWheelSession\(\)/.test(unload),
      "onunload не закрывает сессию TagWheel: перехват клавиш переживёт выключение плагина");

    const cmdSrc = fs.readFileSync(
      path.join(__dirname, "..", "..", "src", "features", "plugin_commands.js"), "utf8");
    assertTrue(/state\.active !== true\) return false/.test(cmdSrc),
      "живость сессии спрашивается не у флага: шов __tagWheelState остаётся на месте и после закрытия");
    assertTrue(/typeof state\.cancel !== "function"\) return false/.test(cmdSrc),
      "закрытие не проверяет наличие шва: у старой сборки его нет, и выгрузка упадёт");
  }

  console.log("Bootstrap loader regression tests: OK");
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
