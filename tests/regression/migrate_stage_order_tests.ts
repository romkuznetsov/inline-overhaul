/**
 * Порядок трёх ступеней `migrateConfig` (PRD фаза 2, Ф2-4).
 *
 * **Что здесь на самом деле закрепляется.** Не «функции вызываются в таком
 * порядке» — это можно было бы прочитать глазами, — а то, что от порядка
 * зависит **продуктовое решение**.
 *
 *   1. `normalizeConfigV1` ставит умолчания движка;
 *   2. миграция `1 → 2` досыпает недостающее из схемы, то есть из прототипа;
 *   3. `normalizeConfigV2` доводит форму версии 2.
 *
 * Досыпка заполняет только отсутствующее.
 *
 * **Чем этот пин держался до 2026-08-31 и почему это пришлось переделать.**
 * Опорой были двадцать одно расхождение умолчаний схемы и движка (В-7):
 * переставь ступени — и на свежей установке победил бы прототип, Transform
 * включился бы из коробки. 2026-08-31 заказчик ответил на В-7, расхождения
 * закрыты, схема и движок теперь дают одно и то же — и та опора **ослепла**:
 * перестановка ступеней перестала менять умолчания.
 *
 * **Новая опора не зависит от умолчаний вовсе.** Переименования старой формы
 * (`leftToRight` → `cycleOrder`, `tagSizePct` → `tagTextSizePct`,
 * `logSize` → `generateAiLog`, `multiPressWindowMs` → `delayMs`,
 * `insideTarget` → `edgeMode`) знает **только первая ступень**. Пройди миграция
 * раньше — этих имён нет в карте маршрутов, они уедут в `_unmigrated`, а
 * настройка получит умолчание. То есть человек, обновившийся со старой версии,
 * потеряет свой цикл Prefix, свой размер тегов и свою задержку. Это следствие
 * порядка, а не значений, и закрыть его ответом заказчика нельзя.
 *
 * Значения на свежей установке пин по-прежнему проверяет: они больше не ловят
 * перестановку, но остаются тем, что плагин отдаёт людям, и меняться молча не
 * должны.
 *
 * Рядом ещё три вещи, которые порядок ступеней ломает по-разному:
 *
 *   * первая ступень не идёт для патча из панели (иначе она пересоздаёт ветки
 *     версии 1 из `DEFAULT_CONFIG` и стравливает их с нажатием человека);
 *   * третья ступень идёт на **каждом** патче, а не только на загрузке;
 *   * легаси-ветка `pkm.behavior.dates` доезжает до третьей ступени, а не
 *     уходит в `_unmigrated`.
 *
 * Подделок здесь нет: `migrateConfig` берётся из `main.js` загрузчиком
 * `tests/harness/plugin_internals.ts`, записи идут настоящим `ConfigStore` с
 * настоящим `deepMerge`.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);
const shared = requireCjs(path.join(root, "src", "core", "shared_utils.js")) as Any;
const { ConfigStore } = requireCjs(path.join(root, "src", "core", "config_store.js")) as Any;

const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function getIn(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/**
 * Значения на свежей установке.
 *
 * Двадцать один путь, которые до 2026-08-31 расходились со схемой (В-7), а
 * теперь совпадают с ней: заказчик ответил, и прототип приведён к движку —
 * кроме текста заголовка вставки, где движок приведён к прототипу. Список
 * оставлен: это то, что плагин отдаёт людям, и меняться молча оно не должно.
 */
const ENGINE_DEFAULTS: Record<string, unknown> = {
  "visual.tagBars.active": false,
  "visual.tagBars.fieldId": "",
  "visual.tagBars.thickness": 2,
  "visual.tagBars.childOffset": 12,
  "visual.tagBars.spacing": 20,
  "visual.tagWheel.textColor": "",
  "visual.tagWheel.fillColor": "",
  "visual.tagWheel.scroller.enabled": false,
  "transform.inline2note.enabled": false,
  "transform.inline2note.templatesFolder": "",
  "transform.inline2note.defaultTemplate": "",
  "transform.inline2note.noteName.delimiters": "[]",
  "transform.inline2note.noteName.wordCount": 6,
  "transform.inline2note.placement.position": "end",
  "transform.inline2note.placement.headerMode": "datetime",
  /*
   * Единственная строка В-7, где заказчик выбрал схему (2026-08-31). Решётки
   * ушли из неё 2026-09-01 вместе с появлением `Line above is header`
   * (10.13.9): их ставит уровень, и текст держит только слова. Видимое не
   * изменилось — с уровнем 2 в заметку идёт всё тот же `## Captured`.
   */
  "transform.inline2note.placement.customHeader": "Captured",
  "transform.inline2note.placement.headerLevel": "3",
  "transform.inline2note.placement.datetimeFormat": "YYYY-MM-DD HH:mm",
  "transform.inline2note.openTarget": false,
  "transform.inline2note.sourceProcessing.token": "#processed",
};

/**
 * Умолчания приоритета Prefix. Стоят отдельным списком, потому что приходят не
 * от первой ступени, а от **скелета внутри миграции** (8.3): ветки
 * `prefixRules` в `DEFAULT_CONFIG` нет вовсе, и значения берутся у
 * `getPrefixRulesFromCfg`. У схемы, снятой с прототипа, два из трёх других
 * (`auto` и `tag-over-subtag`), и досыпка схемой раньше скелета переписала бы
 * вид уже написанных строк тем, кто эти настройки не трогал.
 */
const PREFIX_PRIORITY_DEFAULTS: Record<string, unknown> = {
  "pkm.prefixPriority.decideBy": "by-section",
  "pkm.prefixPriority.fieldOrderSource": "manual",
  "pkm.prefixPriority.parentOrChild": "subtag-over-tag",
};

/* ---- главный пин: свежая установка получает умолчания движка ------------ */

{
  const fresh = internals.migrateConfig(null) as Any;
  const wrong: string[] = [];
  for (const dotted of Object.keys(ENGINE_DEFAULTS)) {
    const got = getIn(fresh, dotted);
    if (JSON.stringify(got) !== JSON.stringify(ENGINE_DEFAULTS[dotted])) {
      wrong.push(dotted + ": движок " + JSON.stringify(ENGINE_DEFAULTS[dotted])
        + ", получено " + JSON.stringify(got));
    }
  }
  assert.deepEqual(wrong, [],
    "свежая установка отдаёт не то, что решил заказчик по В-7:\n  " + wrong.join("\n  "));
  ok("свежая установка отдаёт двадцать одно значение, названное в ответе на В-7");

  const prefixWrong: string[] = [];
  for (const dotted of Object.keys(PREFIX_PRIORITY_DEFAULTS)) {
    const got = getIn(fresh, dotted);
    if (JSON.stringify(got) !== JSON.stringify(PREFIX_PRIORITY_DEFAULTS[dotted])) {
      prefixWrong.push(dotted + ": движок " + JSON.stringify(PREFIX_PRIORITY_DEFAULTS[dotted])
        + ", получено " + JSON.stringify(got));
    }
  }
  assert.deepEqual(prefixWrong, [],
    "приоритет Prefix получил не то умолчание, которое кладёт движок: вид уже"
    + " написанных строк изменился у тех, кто эти настройки не трогал (8.3):\n  "
    + prefixWrong.join("\n  "));
  ok("умолчания приоритета Prefix приходят от движка");
}

{
  /* И то же самое на пустом объекте: версии в нём нет, ветка 1 → 2 выполняется. */
  const fresh = internals.migrateConfig({}) as Any;
  assert.equal(getIn(fresh, "transform.inline2note.enabled"), false,
    "Transform выключен из коробки: это решение заказчика, а не порядок вызовов");
  assert.equal(getIn(fresh, "schemaVersion"), 2, "и конфиг стал версии 2");
  ok("пустой конфиг проходит все три ступени и остаётся с умолчаниями движка");
}

/* ---- умолчания, которых схема не знает вовсе ---------------------------- */

{
  /*
   * Настройка без контрола. Схема о ней не знает, скелет миграции — тоже: её
   * значение приносит **только** первая ступень, из `DEFAULT_CONFIG`. Если бы
   * умолчания собирались не приёмником старой формы, а схемой, здесь оказалось
   * бы `undefined` — и третья ступень записала бы `undefined` в конфиг.
   *
   * Эта проверка заменила ту, что держалась на расхождениях В-7: после ответа
   * заказчика схема и движок дают одно и то же, и по значениям контролов
   * подмену источника умолчаний больше не отличить.
   */
  const fresh = internals.migrateConfig(null) as Any;
  assert.equal(getIn(fresh, "advanced.devMode.traceTagVisualLine"), false,
    "умолчание настройки без контрола пришло не от движка: "
    + JSON.stringify(getIn(fresh, "advanced.devMode.traceTagVisualLine")));
  assert.equal(getIn(fresh, "pkm.fields.defaultBlock"), "left",
    "с какого Block открывается TagWheel — тоже настройка без контрола");
  ok("умолчания настроек без контрола приходят от движка, а не от схемы");
}

{
  /*
   * Порядок внутри досыпки умолчаний: скелет движка идёт раньше схемы (8.3).
   *
   * Проверка **структурная**, и это честно сказано. По значениям её больше не
   * поставить: три умолчания приоритета Prefix, на которых она держалась,
   * 2026-08-31 приведены к движку и в схеме — расхождения не осталось. Порядок
   * при этом остаётся обязательным для любой будущей настройки, у которой
   * умолчание движка разойдётся с прототипом, и потерять его нельзя.
   */
  const src = fs.readFileSync(path.join(root, "src", "core", "config_migration_v2.ts"), "utf8");
  const skeletonAt = src.indexOf("for (const path of Object.keys(V2_SKELETON))");
  const schemaAt = src.indexOf('fill(fromSchema, "")');
  assert.ok(skeletonAt > 0 && schemaAt > 0, "не нашёл досыпку умолчаний в миграции");
  assert.ok(skeletonAt < schemaAt,
    "скелет умолчаний движка идёт ПОСЛЕ схемы: настройка, у которой умолчание"
    + " движка расходится с прототипом, получит значение прототипа (8.3)");
  ok("в досыпке умолчаний скелет движка идёт раньше схемы");
}

/* ---- главная опора: переименования старой формы знает только первая ступень */

{
  /*
   * Конфиг, набранный **только старыми именами**. Ни одного из них нет в карте
   * маршрутов миграции: их переводит приёмник старой формы, и никто больше.
   * Пройди миграция раньше — каждое уехало бы в `_unmigrated`, а настройка
   * получила бы умолчание. Человек, обновившийся со старой версии, потерял бы
   * свой цикл Prefix, свой размер тегов, свою задержку и свой режим прыжка.
   */
  const legacy = internals.migrateConfig({
    schemaVersion: 1,
    navigation: {
      moveSelection: { leftToRight: ["##", "- ", ""] },
      jumpToHeader: { insideTarget: "section-end", boundaryTarget: "section-end" },
    },
    globalFunctions: { enhancedSelectAll: { multiPressWindowMs: 1234 } },
    devMode: { logSize: "for AI" },
    pkm: { behavior: { tagVisuals: { tagSizePct: 133 } } },
  }) as Any;

  const lost: string[] = [];
  const check = (dotted: string, want: unknown, why: string): void => {
    const got = getIn(legacy, dotted);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      lost.push(dotted + ": ждали " + JSON.stringify(want) + ", получили "
        + JSON.stringify(got) + " — " + why);
    }
  };

  check("navigation.moveSelection.cycleOrder", ["##", "- ", ""],
    "цикл Prefix задан старым именем `leftToRight`");
  check("visual.tags.textSizePct", 133,
    "размер тегов задан старым именем `tagSizePct`");
  check("editor.selectAll.delayMs", 1234,
    "задержка задана старым именем `multiPressWindowMs`");
  check("advanced.devMode.aiLog", true,
    "лог для ИИ выведен из старого `logSize`");
  check("navigation.jumpToHeader.edgeMode", "end",
    "режим прыжка выведен из старых `insideTarget` и `boundaryTarget`");

  assert.deepEqual(lost, [],
    "переименования старой формы не сработали. Так выглядит переставленный"
    + " порядок ступеней: миграция прошла раньше приёмника, старых имён в её"
    + " карте нет, и настройки человека заменились умолчаниями:\n  "
    + lost.join("\n  "));

  /* И ни одно старое имя не осело в `_unmigrated`: их разобрали, а не сложили. */
  const unmigrated = Object.keys((legacy._unmigrated || {}) as Record<string, unknown>);
  const strays = unmigrated.filter(k =>
    /leftToRight|tagSizePct|multiPressWindowMs|logSize|insideTarget|boundaryTarget/.test(k));
  assert.deepEqual(strays, [],
    "старое имя уехало в `_unmigrated` вместо перевода: " + strays.join(", "));
  ok("переименования старой формы переживают миграцию: приёмник идёт первым");
}

/* ---- первая ступень не идёт для формы версии 2 -------------------------- */

{
  /*
   * Патч из панели уже версии 2. Прогон его через приёмник старой формы заново
   * создал бы ветки версии 1 из `DEFAULT_CONFIG` — и они стравились бы с тем,
   * что человек только что нажал (правило МГ7 решает спор в пользу v2, но
   * спора здесь быть не должно вовсе).
   */
  const v2 = internals.migrateConfig(null) as Any;
  const again = internals.migrateConfig(v2) as Any;

  assert.equal(getIn(again, "pkm.behavior.leftMode"), undefined,
    "ветки версии 1 не появились заново: приёмник старой формы не выполнялся");
  assert.equal(getIn(again, "globalFunctions"), undefined, "и `globalFunctions` тоже");
  assert.equal(getIn(again, "pkm.behavior.io"), undefined, "и `pkm.behavior.io`");
  assert.deepEqual(again._unmigrated, undefined, "спорить было не о чем");
  assert.equal(JSON.stringify(again), JSON.stringify(v2), "МГ1: второй прогон ничего не меняет");
  ok("для формы версии 2 приёмник старой формы молчит");
}

/* ---- третья ступень идёт на каждом патче ------------------------------- */

/** Хранилище плагина без диска: настоящий `ConfigStore`, настоящий `deepMerge`. */
function makeStore(initial: Any): Any {
  return new ConfigStore(
    { loadData: async () => initial, saveData: async () => {} },
    {
      defaults: internals.migrateConfig(shared.cloneJson(initial)),
      cloneJson: shared.cloneJson,
      isObj: shared.isObj,
      deepMerge: shared.deepMerge,
      migrateConfig: internals.migrateConfig,
      Notice: class StubNotice { },
    },
  );
}

{
  const store = makeStore({});

  /* Order: третья ступень нормализует его и достраивает определения Fields. */
  store.patch({ pkm: { fields: { order: { left: ["status"], types: { status: "tag" } } } } }, "test:order");
  const afterOrder = store.getSnapshot() as Any;
  assert.ok(Array.isArray(getIn(afterOrder, "pkm.fields.order.right")),
    "normalizePkmOrder дописал недостающую половину Order");
  assert.ok(Array.isArray(getIn(afterOrder, "pkm.fields.tags.fields")),
    "ensureBehaviorModesFromOrder завёл список определений тегов");
  assert.ok((getIn(afterOrder, "pkm.fields.tags.fields") as Any[]).some((f: Any) => f && f.id === "status"),
    "и само определение Field появилось из Order");

  /* Свой тег: надгробие `null` обязано убирать ключ, а не оживать цветами темы. */
  store.patch({ visual: { tags: { userTags: { "#own": { fillColor: "#112233" } } } } }, "test:user-tag");
  assert.ok(Object.prototype.hasOwnProperty.call(getIn(store.getSnapshot(), "visual.tags.userTags") as Any, "#own"),
    "свой тег записался");
  store.patch({ visual: { tags: { userTags: { "#own": null } } } }, "test:user-tag:delete");
  assert.equal(Object.prototype.hasOwnProperty.call(getIn(store.getSnapshot(), "visual.tags.userTags") as Any, "#own"),
    false, "надгробие `null` унесло свой тег, а не вернуло его с цветами темы");

  /* Токен без решётки карты вида не держат. */
  store.patch({ visual: { tags: { byTag: { status: { "no-hash": { fillColor: "#112233" } } } } } }, "test:byTag");
  assert.deepEqual(getIn(store.getSnapshot(), "visual.tags.byTag.status"), {},
    "токен без решётки третья ступень выбросила");

  /* Полоса: форму задаёт движок полосы, а не патч. */
  store.patch({ visual: { tagBars: { thickness: 999 } } }, "test:bars");
  const thickness = Number(getIn(store.getSnapshot(), "visual.tagBars.thickness"));
  assert.ok(thickness <= 12, "normalizeStripConfig отсёк толщину полосы: " + thickness);

  /* Binder: строка без идентификатора получает его от нормализации. */
  store.patch({ editor: { binder: { rows: [{ insertText: "()", commandName: "Round" }] } } }, "test:binder");
  const rows = getIn(store.getSnapshot(), "editor.binder.rows") as Any[];
  assert.ok(rows.length >= 2, "системная строка Binder на месте вместе с новой");
  assert.ok(rows.every((r: Any) => String(r && r.commandId || "").trim()),
    "normalizeBinderRows выдал идентификатор каждой строке");

  /* Клампы и перечисления — тоже каждый патч. */
  store.patch({ visual: { tags: { opacityLeft: 500 } } }, "test:opacity");
  assert.equal(getIn(store.getSnapshot(), "visual.tags.opacityLeft"), 100,
    "прозрачность отсечена по краю в процентах");
  store.patch({ pkm: { behavior: { cursorPolicy: "nonsense" } } }, "test:cursor");
  assert.equal(getIn(store.getSnapshot(), "pkm.behavior.cursorPolicy"), "text_end",
    "негодное значение перечисления заменено умолчанием движка");

  /*
   * И самое важное про подмену испорченного значения: умолчание берётся у
   * ДВИЖКА, а не у схемы. У скроллера TagWheel они разные — движок выключает
   * его, прототип включает (одно из девятнадцати расхождений В-7), — и если бы
   * третья ступень спрашивала схему, она включила бы человеку скроллер на
   * первом же негодном значении.
   */
  store.patch({ visual: { tagWheel: { scroller: { enabled: "nope" } } } }, "test:scroller");
  assert.equal(getIn(store.getSnapshot(), "visual.tagWheel.scroller.enabled"), false,
    "испорченный тумблер заменён умолчанием движка, а не прототипа");

  /*
   * И то же на настройке, о которой схема не знает вовсе: контрола у
   * `traceTagVisualLine` нет, значение приносит только `DEFAULT_CONFIG`. Если
   * умолчания для подмены брать у схемы, здесь окажется `undefined` — то есть
   * в конфиг ляжет отсутствие значения.
   */
  store.patch({ advanced: { devMode: { traceTagVisualLine: "nonsense" } } }, "test:trace");
  assert.equal(getIn(store.getSnapshot(), "advanced.devMode.traceTagVisualLine"), false,
    "умолчание настройки без контрола пришло не от движка: "
    + JSON.stringify(getIn(store.getSnapshot(), "advanced.devMode.traceTagVisualLine")));

  ok("третья ступень отрабатывает на каждом патче, а не только на загрузке");
}

/* ---- легаси-ветка дат доезжает до третьей ступени ---------------------- */

{
  const migrated = internals.migrateConfig({
    schemaVersion: 1,
    pkm: {
      behavior: {
        order: { left: [], right: ["date_due"], types: { date_due: "element" }, active: { date_due: "yes" }, enabled: { date_due: true } },
        dates: { fields: ["date_due"], byField: { date_due: { emoji: "\u{1F4C5}", format: "YYYY-MM-DD" } } },
      },
    },
  }) as Any;

  assert.equal(getIn(migrated, "pkm.fields.dates"), undefined,
    "легаси-ветка дат свёрнута и удалена третьей ступенью");
  const unmigrated = (migrated._unmigrated || {}) as Record<string, unknown>;
  const strayDates = Object.keys(unmigrated).filter(k => k.startsWith("pkm.behavior.dates"));
  assert.deepEqual(strayDates, [],
    "и ни один её лист не уехал в _unmigrated: " + strayDates.join(", "));
  assert.equal(getIn(migrated, "pkm.fields.elements.byField.date_due.emoji"), "\u{1F4C5}",
    "значок поля-даты доехал до элементов");
  assert.equal(getIn(migrated, "pkm.fields.elements.byField.date_due.format"), "YYYY-MM-DD",
    "и формат тоже");
  ok("маршрут `pkm.behavior.dates` доводит ветку до третьей ступени, а не до `_unmigrated`");
}

/* ---- мост путей снят --------------------------------------------------- */

{
  /*
   * М-5: когда движки читают версию 2, переводить нечего. Пин смотрит на
   * результат, а не на наличие файла: путь схемы и путь конфига обязаны
   * совпасть, и настройка, записанная панелью, обязана дойти до движка.
   */
  const store = makeStore({});
  const { ConfigStoreAdapter } = await import("../../src/ui/settings/store.ts");
  const adapter = new ConfigStoreAdapter({
    getConfig: () => store.getSnapshot(),
    update: (mutator: (c: Any) => void, reason: string) => {
      store.update((prev: Any) => { mutator(prev); return prev; }, reason);
    },
  } as never);

  await adapter.set("visual.tags.opacityLeft", 40);
  assert.equal(getIn(store.getSnapshot(), "visual.tags.opacityLeft"), 40,
    "значение легло по пути схемы, без перевода");
  assert.equal(adapter.get("visual.tags.opacityLeft"), 40,
    "и читается обратно тем же путём: мост снят с обеих сторон, а не только на записи");
  assert.equal(getIn(store.getSnapshot(), "pkm.behavior.tagVisuals.opacity.left"), undefined,
    "по пути версии 1 ничего не осталось");
  const visuals = internals.getTagVisualsFromConfig(store.getSnapshot());
  assert.equal(visuals.opacityLeft, 0.4,
    "а движок прочитал его долей, как и просит CSS: " + JSON.stringify(visuals.opacityLeft));

  await adapter.set("editor.selectAll.enabled", true);
  assert.equal(getIn(store.getSnapshot(), "editor.selectAll.enabled"), true,
    "и у настройки клавиатуры путь тот же");
  assert.equal(getIn(store.getSnapshot(), "globalFunctions.enhancedSelectAll.enabled"), undefined,
    "ветки версии 1 в конфиге не появилось");
  ok("мост путей снят: путь схемы и путь конфига — один и тот же");
}

console.log("\n" + passed + " проверок пройдено");
