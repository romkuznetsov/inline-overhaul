/**
 * Пути схемы против карты миграции (PRD 8.1, М-2).
 *
 * **Зачем это осталось после снятия моста.** Проверка выросла из
 * `v1_bridge_tests.ts`, и вместе с мостом ушла только половина — та, что
 * сверяла перевод пути. Вторая половина закрывает класс ошибки, который никуда
 * не делся: **настройка панели, у которой нет пары в конфиге**. Именно так
 * 2026-08-29 нашлись 52 настройки из 87, писавшие туда, куда рантайм не
 * смотрит: контрол двигался, значение сохранялось, и не менялось ничего — ровно
 * то, что запрещает З8, только не на одном контроле, а на большей части панели.
 *
 * Правило: путь каждой привязанной настройки схемы обязан быть либо целью
 * маршрута миграции (значит, у него есть ветка, которую движок читал и раньше),
 * либо назван в закрытом списке настроек, которых в версии 1 не было вовсе.
 * Третьего не дано, и новая настройка обязана объяснить, кто её читает.
 *
 * Здесь же — сверка умолчаний. Умолчание схемы работает в одном месте, в кнопке
 * `Reset group`, и расхождение с умолчанием движка означает, что кнопка вернёт
 * человеку не то, с чего он начинал.
 *
 * **Расхождений больше нет.** Двадцать одно, найденное 2026-08-29, закрыто
 * 2026-08-31 ответом заказчика на В-7: двадцать умолчаний приведены к движку
 * правкой прототипа, одно (`## Captured`) — к схеме правкой движка. Список
 * известных расхождений поэтому **пуст**, и это не ослабление проверки, а её
 * усиление: теперь любое расхождение роняет её, а не только двадцать второе.
 *
 * `DEFAULT_CONFIG` оракулом быть не может: ветку Transform нормализует
 * `transform_feature.js`, приоритет Prefix — скелет миграции, и у каждого свои
 * умолчания. Поэтому оракул один — настоящий `migrateConfig` из `main.js`.
 */

import assert from "node:assert/strict";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";
import { ROUTES } from "../../src/core/config_migration_v2.ts";
import { getIn, isBound } from "../../src/ui/settings/types.ts";

type Any = ReturnType<typeof JSON.parse>;

const internals = loadPluginInternals();

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/** Все настройки схемы, привязанные к пути конфига. */
function boundItems(): Array<{ group: string; id: string; path: string; name: string }> {
  const out: Array<{ group: string; id: string; path: string; name: string }> = [];
  for (const g of SCHEMA) {
    for (const it of g.items) {
      if (!isBound(it)) continue;
      out.push({ group: g.id, id: it.id, path: it.path, name: it.name });
    }
  }
  return out;
}

/**
 * Настройки, которых в версии 1 не было вовсе: они заведены вместе с новой
 * панелью и живут по своему пути с самого начала. Список закрытый — появится
 * ещё одна, проверка заставит её сюда вписать и объяснить.
 */
const V2_ONLY: Record<string, string> = {
  "general.help.showTips": "подсказки «?» — новая функция панели (10.13.5, И4)",
  "advanced.showSettingIds": "подпись id в подсказке — заказ 2026-08-28 (10.13.5)",
  "advanced.backups.beforeRestore": "копия перед восстановлением — заказ C56, 2026-09-04; читает backupBeforeRestore в settings_backup.js",
  "navigation.moveSelection.rightCycles": "симметричный цикл — оживлён 2026-09-01 (В-12, 10.13.11)",
  "navigation.moveSelection.inlineBoundaryJump": "перенос текста через Separator — заказ 2026-09-04, парная опция к navigateInline.boundaryJump; читает moveTextBounds в navigation_runtime.js",
  "navigation.moveSelection.inlineWordEscape": "часть слова уезжает за пределы своего слова — замечание 2026-09-08, умолчание выключено; читает decideMoveMode в navigation_runtime.js",
  "visual.tagWheel.activeTextColor": "цвет активного Field в TagWheel — заказ D6, 2026-09-02 (10.13.15)",
  "visual.tagWheel.scroller.fillColor": "фон коробки скроллера — заказ D6, 2026-09-02 (10.13.15)",
  "visual.tagWheel.scroller.textColor": "цвет текста в коробке скроллера — заказ D6, 2026-09-02 (10.13.15)",
  "visual.tagBars.lineGap": "зазор между полосами соседних строк — заказ B22, 2026-09-03 (10.13.16)",
  "visual.tagBars.joinTree": "слитная полоса у дерева — заказ B22, 2026-09-03 (10.13.16)",
  "visual.tagBars.drawWholeTree": "полоса по всему поддереву — заказ H1, 2026-09-04 (10.13.21); читает buildStripSpecs в priority_strip_engine.js",
  "editor.smartDelete.enabled": "Smart Delete — заказ 2026-09-05 (10.13.32); читает handleSmartDeleteKeymap в smart_delete_engine.js",
  "editor.smartDelete.dropPrefix": "снимать ли Prefix приехавшей строки — там же (10.13.32 Д7)",
  "editor.smartDelete.joinWithSpace": "пробел на стыке — там же (10.13.32 Д6)",
  "editor.smartDelete.onBackspace": "тот же разбор на Backspace — заказ 2026-09-05, ответ «отдельным тумблером» (10.13.32 Д9)",
  "visual.caret.enabled": "цвет каретки — заказ 2026-09-05 (10.13.33); читает caretLookFromConfig в main.js",
  "visual.caret.color": "сам цвет каретки — там же (10.13.33 Ц2)",
  "visual.caret.shapeEnabled": "толщина и мерцание каретки — заказ 2026-09-05, поздний вечер (10.13.33 Ц6); своя половина группы, цвету не подчинена",
  "visual.caret.width": "толщина каретки в пикселях — там же (10.13.33 Ц6); уезжает в border-left-width и парный сдвиг",
  "visual.caret.blinkSpeed": "скорость мерцания 0..10, ноль значит «не мигает» — там же (10.13.33 Ц7)",
  "visual.tagWheel.edgeMode": "что делает стрелка на краю Block — заказ 2026-09-05, поздний вечер (10.13.35); доезжает ключом настройки TAGWHEEL_EDGE_MODE до planFieldStep в tagwheel.js",
  "navigation.moveLine.keepInView": "следовать ли экрану за перемещённой строкой — заказ 2026-09-05, поздний вечер (10.13.36); читает maybeRevealMovedRange в navigation_runtime.js",
  "navigation.moveLine.viewPosition": "куда встаёт перемещённая строка на экране — там же (10.13.36); читает revealLineAt в navigation_runtime.js",
  "navigation.jumpToHeader.viewPosition": "куда встаёт строка на экране после перехода по заголовкам — заказ 2026-09-06 (10.13.37); читает та же revealLineAt в navigation_runtime.js",
};

/* ---- каждая настройка панели имеет пару в конфиге ----------------------- */

{
  const targets = new Set<string>();
  for (const [, route] of ROUTES) if (route.to) targets.add(route.to);

  const orphans: string[] = [];
  for (const it of boundItems()) {
    if (targets.has(it.path)) continue;
    if (Object.prototype.hasOwnProperty.call(V2_ONLY, it.path)) continue;
    orphans.push(it.group + "/" + it.id + ": " + it.path);
  }
  assert.deepEqual(orphans, [],
    "эти настройки не значатся в карте миграции и не названы новыми: значит,"
    + " они пишут туда, куда никто не смотрит:" + JSON.stringify(orphans, null, 2));
  ok("каждая настройка панели либо имеет пару в версии 1, либо названа новой");
}

{
  /* И обратное: список исключений не разрастается молча. */
  const bound = new Set(boundItems().map(i => i.path));
  for (const path of Object.keys(V2_ONLY)) {
    assert.ok(bound.has(path), "исключение указывает на настройку, которой в схеме нет: " + path);
  }
  ok("список настроек без пары в версии 1 закрыт и весь на месте");
}

{
  /*
   * Цель маршрута обязана быть путём версии 2. Проверка смотрит на карту
   * саму: путь, который переносится «в себя же» и при этом начинается с ветки,
   * которой в целевой форме нет, — забытый маршрут.
   */
  const legacyRoots = ["globalFunctions.", "devMode.", "ui.binderRows", "pkm.behavior.leftMode",
    "pkm.behavior.rightMode", "pkm.behavior.tagVisuals", "pkm.behavior.io.", "pkm.behavior.freeRoam",
    "pkm.behavior.order", "pkm.behavior.elements", "pkm.taxonomy", "pkm.tagWheelConfig",
    "pkm.configExportMode", "pkm.generatedRulesPath", "pkm.behavior.prefixRules"];
  const stale: string[] = [];
  for (const [from, route] of ROUTES) {
    if (!route.to || route.drop) continue;
    for (const root of legacyRoots) {
      if (route.to.startsWith(root)) stale.push(from + " -> " + route.to);
    }
  }
  assert.deepEqual(stale, [],
    "маршрут ведёт в ветку версии 1: " + stale.join(", "));
  ok("все цели маршрутов — пути версии 2");
}

/* ---- умолчание панели против умолчания движка --------------------------- */

/**
 * Известные расхождения умолчаний. **Список пуст, и это нормальное состояние.**
 *
 * Двадцать одно расхождение, найденное 2026-08-29, закрыто 2026-08-31 ответом
 * заказчика на В-7. Механизм оставлен намеренно: он не про те двадцать одно, а
 * про класс ошибки. Новая настройка, пришедшая с умолчанием прототипа вместо
 * умолчания движка, уронит проверку — и придётся объяснить, а не оставить
 * кнопку сброса врать.
 *
 * Запись сюда добавляется только вместе с решением заказчика и датой.
 */
const KNOWN_DEFAULT_GAPS: Record<string, unknown> = {};

{
  /* Оракул — свежая установка, прогнанная настоящим `migrateConfig`. */
  const engine = internals.migrateConfig(null) as Any;
  const fresh: string[] = [];
  const stale: string[] = [];
  const wrongValue: string[] = [];

  for (const it of boundItems()) {
    const shown = getIn(engine, it.path);
    if (shown === undefined) continue;
    const known = Object.prototype.hasOwnProperty.call(KNOWN_DEFAULT_GAPS, it.path);
    const def = (SCHEMA.flatMap(g => g.items).find(x => isBound(x) && x.path === it.path) as Any).default;
    const same = JSON.stringify(shown) === JSON.stringify(def);

    if (same && known) stale.push(it.path);
    if (known && !same && JSON.stringify(shown) !== JSON.stringify(KNOWN_DEFAULT_GAPS[it.path])) {
      wrongValue.push(it.path + ": в списке " + JSON.stringify(KNOWN_DEFAULT_GAPS[it.path])
        + ", движок кладёт " + JSON.stringify(shown));
    }
    if (same || known) continue;
    fresh.push(it.id + " (" + it.path + "): движок " + JSON.stringify(shown)
      + ", схема " + JSON.stringify(def));
  }

  assert.deepEqual(fresh, [],
    "у этих настроек панель считает умолчанием не то, что кладёт движок, и"
    + " кнопка сброса вернёт человеку не то, с чего он начинал:\n  "
    + fresh.join("\n  "));
  assert.deepEqual(stale, [],
    "эти расхождения уже устранены — уберите их из списка известных: "
    + stale.join(", "));
  assert.deepEqual(wrongValue, [],
    "список известных расхождений разошёлся с движком:\n  " + wrongValue.join("\n  "));
  ok("умолчание панели совпадает с умолчанием движка, и названных исключений больше нет");
}

{
  /*
   * H8: умолчание `Cursor on arrival` — `End of your text` (заказ заказчика
   * 2026-09-04, вечер). Сверка схемы с движком выше поймала бы расхождение, но
   * молчит о том, какое значение верное: их два, и совпасть они могут на любом.
   * Поэтому значение выписано словом, отдельно от того, из чего считается (У-5).
   */
  const fresh = internals.migrateConfig(null) as Any;
  assert.equal(getIn(fresh, "navigation.jumpToHeader.jumpCursorPosition"), "section-end",
    "движок кладёт новому человеку `End of your text`");
  const shown = (SCHEMA.flatMap(g => g.items)
    .find(x => isBound(x) && x.path === "navigation.jumpToHeader.jumpCursorPosition") as Any).default;
  assert.equal(shown, "section-end", "и панель считает умолчанием то же");
  ok("H8: умолчание `Cursor on arrival` — `End of your text`");
}

console.log("\n" + passed + " проверок пройдено");
