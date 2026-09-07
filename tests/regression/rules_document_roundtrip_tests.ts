/**
 * Служебный файл правил: сверка двух ходов на одних входах (В-77, PRD 10.13.52).
 *
 * **Зачем это здесь.** Решение по служебному файлу заказчик поручил принять мне,
 * и решение принято: файл снимается целиком, порядком, после его проверки
 * (PRD 10.13.52, П-8). Первый пункт того порядка — не код в движках, а **эта
 * проверка**: пока она зелёная, «прямое чтение конфига» доказано равным
 * «чтению через файл», и переводить движки можно по одному.
 *
 * **Что сверяется.** Два хода из одного конфига:
 *
 *   1. сегодняшний: конфиг → `buildTagWheelRulesMarkdownFromConfig` → документ
 *      → `parseRulesFromMarkdown` → правила;
 *   2. завтрашний: конфиг → `buildRulesShapeFromConfig` → правила.
 *
 * Второй ход уже существует в коде: сборщик документа сам строит форму, а потом
 * лишь печатает её JSON-блоками. Значит вопрос ровно один: **что теряется и что
 * меняется по дороге через диск.**
 *
 * **Что нашлось этой сверкой, и это не мелочь.** Из десяти блоков документа
 * `parseRulesFromMarkdown` читает восемь. Блок `tagwheel-date-rules`
 * записывается и этим разборщиком не читается вовсе — его читают своими
 * разборами `navigation_runtime.js` и `status_date.js`. То есть у одного файла
 * не один читатель, а несколько, и читают они его по-разному. Список того, что
 * меняет ход через диск, выписан ниже утверждениями, а не словами: он и есть
 * задание на перевод движков.
 *
 * **Конфиг взят из фикстуры и прогнан настоящим `migrateConfig`** (правило 2
 * раздела «Проверки»): форма версии 2 приезжает оттуда же, откуда её берёт
 * плагин, а не пишется здесь руками.
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
const core = nodeRequire(path.join(root, "pkm_v2", "TagWheel", "tagwheel_core.js"));
const shared = nodeRequire(path.join(root, "src", "core", "shared_utils.js"));
const normalizer = nodeRequire(path.join(root, "src", "core", "tagwheel_rules_normalizer.js"));

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

const builder = builderMod.createRulesMarkdownBuilder({
  isObj: shared.isObj,
  cloneJson: shared.cloneJson,
  toPrettyJson: shared.toPrettyJson,
});

/**
 * Блоки документа, которые `parseRulesFromMarkdown` читает обратно.
 *
 * `dateRules` в списке нет намеренно: разборщик TagWheel его не читает. Это
 * утверждение о состоянии, и снимается оно тем, что блок начнут читать (У-71).
 */
const READ_BACK = ["io", "inlineLayout", "behavior", "ui", "leftMode", "rightMode", "projects", "colors"];

/**
 * Фикстуры конфига: обе прогоняются настоящей миграцией плагина.
 *
 * Приватного снимка конфига заказчика здесь нет намеренно — от него не зависит
 * ни одна проверка набора: у меня он есть, у CI и на свежем клоне его нет
 * (У-78). Сторож этого правила — `repo_completeness_tests.js`, и он покраснел
 * на первой же версии этого файла.
 */
const FIXTURES = ["config_v1_full.json", "config_v1_realistic.json"];

for (const name of FIXTURES) {
  const file = path.join(root, "tests", "fixtures", name);
  assert.ok(fs.existsSync(file), `фикстура на месте: ${name}`);
  const cfg = internals.migrateConfig(JSON.parse(fs.readFileSync(file, "utf8")));

  const shape = builder.buildRulesShapeFromConfig(cfg);
  const md = builder.buildTagWheelRulesMarkdownFromConfig(cfg);
  const parsed = core.parseRulesFromMarkdown(md);

  /*
   * Положительный контроль (У-88). Сверка «ничего не потерялось» лучше всех
   * проходит на пустых формах: у обеих сторон пусто, и они равны. Поэтому
   * сначала спрашивается, что в форме вообще есть чему теряться.
   */
  const orderKeys = Object.keys((shape.behavior && shape.behavior.order) || {});
  assert.ok(orderKeys.length > 0, `${name}: в форме есть порядок Fields — сверять есть что`);
  assert.ok(Object.keys(shape.io || {}).length > 0, `${name}: в форме есть разделители строки`);

  /* Ход через диск обязан вернуть ровно то же по каждому читаемому блоку. */
  for (const key of READ_BACK) {
    if (key === "leftMode" || key === "rightMode") continue;
    assert.deepStrictEqual(
      parsed[key],
      shape[key],
      `${name}: блок ${key} проходит через документ без изменений`,
    );
  }

  /*
   * Два блока ход через диск **меняет**, и меняет предсказуемо:
   * `normalizeMode` досыпает форму списка Fields. Это и есть то, что придётся
   * позвать самому, когда движки начнут читать конфиг напрямую, — иначе
   * прямое чтение отдаст форму, которой движок не ждёт.
   *
   * **Спрашивается вынесенный модуль `src/core/tagwheel_rules_normalizer.js`, и
   * тут важна оговорка.** В Node `tagwheel_core` этот модуль находит и зовёт;
   * **в установленном плагине — нет**, и работает там его внутренняя копия.
   * Причина та же, что у дефекта A33: путь к модулю стоит в переменной, и
   * сборщик его не разрешает, а глобальную переменную
   * `__inlineTagwheelRulesNormalizer` не публикует никто. Поэтому одного этого
   * утверждения мало, и ниже стоит второе — сверка копии с модулем на том же
   * входе (У-89: у сборки свой вопрос).
   */
  for (const key of ["leftMode", "rightMode"]) {
    const direct = shape[key] as Any;
    const viaDisk = parsed[key] as Any;
    assert.deepStrictEqual(
      viaDisk,
      normalizer.normalizeMode(shared.cloneJson(direct), key, { isObj: shared.isObj, err: (m: string) => { throw new Error(m); } }),
      `${name}: блок ${key} проходит через документ ровно через normalizeMode`,
    );
  }

  /*
   * Блок дат: записан и этим разборщиком не прочитан. Утверждение стоит в обе
   * стороны — блок в документе есть, а в разобранном его нет, — потому что
   * молчаливая потеря блока и есть то, чего нельзя не заметить при переводе.
   */
  assert.ok(md.includes("```tagwheel-date-rules"), `${name}: блок дат в документе записан`);
  assert.strictEqual(
    (parsed as Any).dateRules,
    undefined,
    `${name}: и разборщиком TagWheel не читается — его читают своими разборами навигация и элементы-даты`,
  );

  ok(`${name}: ход через документ равен прямому чтению по восьми блокам из десяти`);
}

/*
 * Служебный блок `meta` несёт отметку времени, и равенства по нему быть не
 * может. Проверяется, что в нём нет ничего, кроме служебного: иначе через него
 * уезжала бы настройка, и «прямое чтение» её потеряло бы.
 */
{
  const cfg = internals.migrateConfig(
    JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", "config_v1_full.json"), "utf8")),
  );
  const meta = builder.buildRulesShapeFromConfig(cfg).meta as Any;
  assert.deepStrictEqual(
    Object.keys(meta).sort(),
    ["generatedAt", "generatedBy"],
    "в служебном блоке только служебное: кем и когда собран",
  );
  ok("служебный блок не несёт настроек — терять в нём нечего");
}

/*
 * Внутренняя копия нормализатора против вынесенного модуля.
 *
 * **Зачем это здесь.** В установленном плагине `tagwheel_core` идёт своим
 * запасным путём: глобальной переменной `__inlineTagwheelRulesNormalizer` не
 * ставит никто, а путь к модулю стоит в переменной и сборщиком не
 * разрешается — та же причина, что у дефекта A33. Значит форму списка Fields в
 * продукте досыпает **копия внутри `tagwheel_core`**, а вынесенный модуль
 * `src/core/tagwheel_rules_normalizer.js` в сборке мёртв. Два объявления одного
 * правила расходятся молча (У-32), и держит их вместе только эта проверка.
 *
 * **Как копия вызывается.** `require` модуля стоит не при загрузке
 * `tagwheel_core`, а **внутри геттера**, то есть выполняется на каждом вызове.
 * Поэтому ломать резолв надо вокруг ВЫЗОВА, а не вокруг `require` самого
 * `tagwheel_core`: первая версия этой проверки ломала загрузку, была зелёной и
 * мерила модуль против модуля — мутация в модуле её не покраснела (У-37).
 *
 * **Снимается эта проверка тем, что копия уйдёт** — вместе с мостом модулей
 * (PRD, раздел 11, «Кусок третий»).
 */
{
  const normalizerPath = nodeRequire.resolve(path.join(root, "src", "core", "tagwheel_rules_normalizer.js"));
  const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };

  /** Позвать так, как зовётся в сборке: вынесенного модуля не видно. */
  function asInBundle<T>(fn: () => T): T {
    const origLoad = loader._load;
    delete nodeRequire.cache[normalizerPath];
    loader._load = function (request: string, parent: unknown, isMain: boolean): unknown {
      if (/tagwheel_rules_normalizer\.js$/.test(String(request))) {
        throw new Error("нет такого модуля: так это выглядит в сборке");
      }
      return origLoad.call(this, request, parent, isMain);
    };
    try {
      return fn();
    } finally {
      loader._load = origLoad;
      delete nodeRequire.cache[normalizerPath];
    }
  }

  /*
   * Положительный контроль самого приёма (У-88): пока резолв сломан, модуль
   * действительно не находится. Без этого утверждения вся проверка была бы
   * сверкой модуля с самим собой — ровно то, чем она и была в первой версии.
   */
  let reachable = true;
  asInBundle(() => {
    try {
      nodeRequire(normalizerPath);
    } catch (_e) {
      reachable = false;
    }
  });
  assert.strictEqual(reachable, false, "положительный контроль: пока резолв сломан, модуль не находится");

  for (const name of FIXTURES) {
    const cfg = internals.migrateConfig(
      JSON.parse(fs.readFileSync(path.join(root, "tests", "fixtures", name), "utf8")),
    );
    const md = builder.buildTagWheelRulesMarkdownFromConfig(cfg);
    const viaModule = core.parseRulesFromMarkdown(md);
    const viaCopy = asInBundle(() => core.parseRulesFromMarkdown(md));

    assert.ok(
      viaModule.leftMode && Array.isArray(viaModule.leftMode.fields),
      `${name}: положительный контроль — модуль вернул форму списка Fields`,
    );
    assert.deepStrictEqual(
      viaCopy,
      viaModule,
      `${name}: внутренняя копия нормализатора равна вынесенному модулю`,
    );
  }
  ok("внутренняя копия нормализатора равна вынесенному модулю (в сборке работает копия)");
}

console.log(`Rules document roundtrip tests: OK (${passed} checks)`);
