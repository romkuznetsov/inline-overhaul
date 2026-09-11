/**
 * Навигация читает правила из настроек: сверка с ходом через документ
 * (PRD 10.13.52, П-8, шаг первый; решение заказчика 2026-09-11).
 *
 * **Зачем отдельный файл, когда есть `rules_document_roundtrip_tests.ts`.** Тот
 * сверяет форму целиком с тем, что из документа достаёт `parseRulesFromMarkdown`
 * — разборщик TagWheel. Навигации он не судья по двум причинам, и обе видны
 * только если спросить:
 *
 *   1. блок `tagwheel-date-rules` разборщик TagWheel **не читает вовсе**, а
 *      навигация из него берёт метки дат;
 *   2. блоки `left-mode` и `right-mode` разборщик TagWheel прогоняет через
 *      `normalizeMode`, а навигация читала их **сырыми**. Сверка «через
 *      normalizeMode» о сыром равенстве не говорит ничего.
 *
 * Поэтому здесь сверяются ровно те четыре блока, из которых навигация строит
 * правила, и сами правила: одна сторона — сегодняшний код
 * (`buildNavigateRules` из настроек), вторая — документ, который плагин всё ещё
 * пишет, разобранный тем же разборщиком блоков, что и у движков
 * (`src/core/markdown_json_block_parser.js`). Двух копий разбора не заводится.
 *
 * **Конфиг берётся из фикстур и прогоняется настоящим `migrateConfig`**
 * (правило 2 раздела «Проверки»).
 *
 * **Положительные контроли — не украшение.** Сверка «одно равно другому» лучше
 * всего проходит на пустоте: нет Field — нет и меток, и обе стороны пусты. У
 * каждой фикстуры поэтому спрашивается, что в ней есть чему разойтись, и
 * разделитель у одной из них нарочно отличается от умолчания навигации (У-147).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const nodeRequire = Module.createRequire(import.meta.url);

const internals = loadPluginInternals();
const builderMod = nodeRequire(path.join(root, "src", "features", "rules_markdown_builder.js"));
const shared = nodeRequire(path.join(root, "src", "core", "shared_utils.js"));
const blockParser = nodeRequire(path.join(root, "src", "core", "markdown_json_block_parser.js"));
const nav = nodeRequire(path.join(root, "navigation_runtime.js"));

const builder = builderMod.createRulesMarkdownBuilder({ toPrettyJson: shared.toPrettyJson });

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function blockOf(md: string, name: string): Any {
  return blockParser.parseJsonBlock(md, name, false, (m: string) => { throw new Error(m); }) || {};
}

/**
 * Правила навигации, выведенные **из документа**: вторая сторона сверки.
 *
 * Это и есть тот код, который до 2026-09-11 стоял в `navigation_runtime.js`.
 * Здесь он остаётся ровно для сверки: пока обе стороны равны на настоящих
 * фикстурах, перевод навигации на прямое чтение доказан не словами.
 */
function navigateRulesFromDocument(md: string): { delim: string; markers: string[] } {
  const io = blockOf(md, "tagwheel-io");
  const dateRules = blockOf(md, "tagwheel-date-rules");
  const leftMode = blockOf(md, "tagwheel-left-mode");
  const rightMode = blockOf(md, "tagwheel-right-mode");

  const markers: string[] = [];
  for (const key of ["due", "done", "cancelled", "start"]) {
    const rule = dateRules[key];
    if (!rule) continue;
    if (typeof rule.preferredMarker === "string" && rule.preferredMarker) markers.push(rule.preferredMarker);
    if (Array.isArray(rule.markers)) for (const m of rule.markers) if (typeof m === "string" && m) markers.push(m);
  }
  for (const block of [leftMode, rightMode]) {
    const list = Array.isArray(block.fields) ? block.fields : [];
    for (const f of list) {
      if (f && typeof f.marker === "string" && f.marker) markers.push(f.marker);
    }
  }

  return {
    delim: typeof io.separator1 === "string" && io.separator1 ? io.separator1 : "||",
    markers: Array.from(new Set(markers)),
  };
}

/** Что в фикстуре должно найтись, иначе сверять нечего. */
const FIXTURES = [
  { name: "config_v1_full.json", wantMarkers: false, wantSeparator: "//" },
  { name: "config_v1_realistic.json", wantMarkers: true, wantSeparator: "||" },
];

for (const fixture of FIXTURES) {
  const file = path.join(root, "tests", "fixtures", fixture.name);
  assert.ok(fs.existsSync(file), `фикстура на месте: ${fixture.name}`);
  const cfg = internals.migrateConfig(JSON.parse(fs.readFileSync(file, "utf8")));

  const shape = builder.buildRulesShapeFromConfig(cfg);
  const md = builder.buildTagWheelRulesMarkdownFromConfig(cfg);

  /*
   * Первая половина: четыре блока, которые нужны навигации, проходят через
   * документ без изменений. Про два из них общая сверка форм молчит.
   */
  const BLOCKS: Array<[string, string]> = [
    ["tagwheel-io", "io"],
    ["tagwheel-date-rules", "dateRules"],
    ["tagwheel-left-mode", "leftMode"],
    ["tagwheel-right-mode", "rightMode"],
  ];
  for (const [block, key] of BLOCKS) {
    assert.deepStrictEqual(
      blockOf(md, block),
      JSON.parse(JSON.stringify(shape[key])),
      `${fixture.name}: блок ${block} проходит через документ без изменений`,
    );
  }

  /* Вторая половина: сами правила навигации с обеих сторон. */
  const fromConfig = nav.buildNavigateRules(cfg);
  const fromDocument = navigateRulesFromDocument(md);

  /*
   * Положительный контроль (У-88, У-147). Без него равенство ниже бывает
   * правдой от пустоты: у фикстуры без Field с меткой обе стороны отдают
   * пустой список, а разделитель, равный умолчанию навигации, совпадёт и при
   * не доехавшей настройке.
   */
  assert.equal(
    cfg.pkm.lineFormat.separator1,
    fixture.wantSeparator,
    `${fixture.name}: разделитель в фикстуре тот, на который рассчитана сверка`,
  );
  assert.equal(
    fromDocument.markers.length > 0,
    fixture.wantMarkers,
    `${fixture.name}: меток в документе ${fromDocument.markers.length} — сверять есть что`,
  );

  assert.equal(fromConfig.delim, fromDocument.delim,
    `${fixture.name}: разделитель у прямого чтения и у хода через документ разошёлся`);
  assert.deepStrictEqual(fromConfig.trailingMarkers, fromDocument.markers,
    `${fixture.name}: метки дат у прямого чтения и у хода через документ разошлись`);

  ok(`${fixture.name}: правила навигации из настроек равны правилам из документа`);
}

/*
 * Запрет по симптому: навигация файлов больше не читает.
 *
 * Утверждение о состоянии, и зелено оно бывает от того, что искать нечего
 * (У-71), поэтому рядом стоит порог: исходник обязан найтись и быть непустым, а
 * сборка правил — в нём объявлена.
 */
{
  const src = fs.readFileSync(path.join(root, "navigation_runtime.js"), "utf8");
  assert.ok(src.length > 10000, `положительный контроль: исходник навигации прочитан (${src.length} знаков)`);
  assert.match(src, /function buildNavigateRules\(cfg\) \{/, "правила навигации собираются одной названной функцией");

  /* Маска: комментарии тут же рассказывают о снятом чтении файла (У-138). */
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, " "))
    .join("\n");
  assert.ok(code.includes("buildNavigateRules"), "положительный контроль маски: код после снятия комментариев не пуст");

  for (const forbidden of ["vault.read", "getAbstractFileByPath", "adapter.read", "generated_rules", "RULES_TagWheel"]) {
    assert.ok(!code.includes(forbidden),
      `навигация снова читает служебный файл правил: в коде есть «${forbidden}»`);
  }
  ok("навигация не читает ни файла: ни через индекс vault, ни через адаптер");
}

/*
 * **Чего эта сверка не доказывает, и это проверено мутацией, а не выведено.**
 *
 * Обе её стороны растут из одного места: документ печатается **из той же
 * формы**, с которой сверяется прямое чтение. Значит ошибка в самой перекладке
 * значений — «разделители берутся не из `pkm.lineFormat`, а из соседней ветки»
 * — уедет в обе стороны сразу, и сверка останется зелёной. Подмена
 * `io: slice(pkm, "lineFormat")` на `slice(pkm, "placement")` в
 * `pkm_rules_shape.js` этот файл не роняет; не роняет она и
 * `rules_document_roundtrip_tests.ts` — по той же причине (У-92).
 *
 * Краснеет на ней **поведение**: `navigation_jumps_tests.js` называет значение
 * из фикстуры (`//`) и ставит каретку на настоящей строке. Так и распределены
 * роли: здесь — что ход через диск ничего не менял, там — что настройка
 * доезжает туда, куда человек смотрит.
 */

console.log(`Navigate rules direct tests: OK (${passed} checks)`);
