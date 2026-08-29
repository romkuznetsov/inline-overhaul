/**
 * Мост путей: настройка панели пишет туда, откуда читает рантайм.
 *
 * Что здесь проверяется и почему это важнее, чем кажется. Схема панели
 * выведена из прототипа и пользуется путями **версии 2**; движки читают
 * **версию 1**, потому что миграция ещё не подключена. Настройка, записанная
 * по пути v2, лежит в конфиге мёртвым грузом — контрол двигается, значение
 * сохраняется, и не меняется ничего.
 *
 * Это не гипотеза: 2026-08-29, после удаления старой панели, **52 из 87
 * настроек вели себя ровно так**. Нашлось перебором путей схемы против карты
 * миграции, а не глазами.
 *
 * Главная проверка — **карта маршрутов самой миграции**: путь схемы обязан быть
 * либо целью маршрута (значит, у него есть пара в версии 1), либо назван в
 * списке настроек, которых в версии 1 не было вовсе. Третьего не дано, и новую
 * настройку это заставит объяснить, а не тихо оставить мёртвой.
 *
 * `DEFAULT_CONFIG` оракулом быть не может: настройки Transform нормализует
 * `transform_feature.js`, приоритет Prefix — `pkm_line_finalize_unified.js`, и у
 * каждого свои значения по умолчанию.
 */

import assert from "node:assert/strict";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";
import { bridge, bridgedPaths } from "../../src/ui/settings/v1_bridge.ts";
import { ROUTES } from "../../src/core/config_migration_v2.ts";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigStoreAdapter } from "../../src/ui/settings/store.ts";
import { getIn, isBound } from "../../src/ui/settings/types.ts";

type Any = ReturnType<typeof JSON.parse>;

const internals = loadPluginInternals();

/* Движок Transform нормализует свою ветку сам, и умолчания там его. */
const here = path.dirname(fileURLToPath(import.meta.url));
const requireCjs = createRequire(import.meta.url);
const transform = requireCjs(path.resolve(here, "..", "..", "src", "features", "transform_feature.js")) as {
  normalizeTransformConfig: (cfg: unknown) => unknown;
};

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
  "navigation.moveSelection.rightCycles": "симметричный цикл — отложенная работа движка (5.3.1)",
};

/* ---- главная проверка --------------------------------------------------- */

{
  /** Все цели маршрутов: путь версии 2, у которого есть пара в версии 1. */
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
  /* Перевод берётся из карты миграции, а не из своей копии. */
  const back = bridgedPaths();
  assert.ok(back.size > 40, "карта перевода непустая: " + back.size);
  assert.equal(bridge("editor.selectAll.enabled").path,
    "globalFunctions.enhancedSelectAll.enabled", "путь переведён как в карте 8.1");
  assert.equal(bridge("navigation.moveLine.enabled").path, "navigation.moveLine.enabled",
    "путь, одинаковый в обеих версиях, не трогается");
  assert.equal(bridge("advanced.showSettingIds").path, "advanced.showSettingIds",
    "настройка без пары в версии 1 остаётся на своём пути");
  ok("перевод пути идёт по карте миграции");
}

{
  /*
   * Правила сборки карты проверяются напрямую, а не через поведение: обе
   * мутации ниже сегодня ничего не ломают, потому что ни одна настройка
   * схемы не смотрит внутрь непрозрачной ветки. Появится такая — сломает,
   * и молча.
   */
  for (const [v2, b] of bridgedPaths()) {
    assert.notEqual(b.path, v2,
      "в карте перевода путь, который никуда не переводится: " + v2);
    const route = ROUTES.get(b.path);
    assert.ok(route, "путь версии 1 без маршрута: " + b.path);
    assert.ok(!route?.whole,
      "непрозрачная ветка в карте перевода: " + b.path + " -> " + v2
      + ". Внутрь таких схема не смотрит, там живут свои блоки, и они пишут v1 сами");
    assert.ok(!route?.drop, "удаляемая ветка в карте перевода: " + b.path);
  }
  ok("в карте перевода только листья, и каждый и правда переводится");
}

/* ---- запись доходит до конфига в форме версии 1 ------------------------- */

/**
 * Хранилище плагина в том виде, в каком его видит панель. Проводка повторяет
 * `storeFor` в `obsidian_tab.ts`: слой настроек отдаёт правку функцией,
 * которая **меняет конфиг на месте**, а возвращать следующий конфиг — забота
 * обёртки. Настоящая нормализация плагина (`migrateConfig`) идёт следом, как
 * и в `ConfigStore`.
 */
function makeStore(initial?: Any): { adapter: ConfigStoreAdapter; cfg: () => Any; reasons: string[] } {
  let cfg: Any = internals.migrateConfig(initial || {});
  const reasons: string[] = [];
  const adapter = new ConfigStoreAdapter({
    getConfig: () => cfg,
    update: (mutator: (c: Any) => void, reason: string) => {
      reasons.push(reason);
      const next = JSON.parse(JSON.stringify(cfg));
      mutator(next);
      cfg = internals.migrateConfig(next);
    },
  } as never);
  return { adapter, cfg: () => cfg, reasons };
}

{
  const s = makeStore();
  await s.adapter.set("editor.selectAll.enabled", true);

  assert.equal(getIn(s.cfg(), "globalFunctions.enhancedSelectAll.enabled"), true,
    "значение легло по пути версии 1 — тому, который читает плагин");
  assert.equal(getIn(s.cfg(), "editor.selectAll.enabled"), undefined,
    "и по пути версии 2 ничего не осталось");
  assert.equal(s.adapter.get("editor.selectAll.enabled"), true,
    "а панель читает его обратно по своему пути");
  assert.deepEqual(s.reasons, ["settings:editor.selectAll.enabled"],
    "причина записи названа путём схемы: по ней узнают контрол, а не ветку конфига");
  ok("запись доходит до конфига в форме версии 1");
}

{
  /*
   * Прозрачность — единственный перенос, который меняет не только путь, но и
   * значение: в версии 1 это доля `0..1`, в схеме — проценты. Мост обязан
   * переводить в обе стороны, иначе `70 %` станет `7000 %` или тегов не
   * станет видно вовсе.
   */
  const s = makeStore();
  await s.adapter.set("visual.tags.opacityLeft", 70);
  assert.equal(getIn(s.cfg(), "pkm.behavior.tagVisuals.opacity.left"), 0.7,
    "в конфиг ушла доля");
  assert.equal(s.adapter.get("visual.tags.opacityLeft"), 70,
    "а панель читает проценты");
  ok("прозрачность переводится в обе стороны");
}

{
  /*
   * И самое главное: то, что записала панель, видит движок. Спрашивается не
   * ключ конфига, а функция, которая решает, каким цветом и с какой
   * прозрачностью рисовать тег.
   */
  const s = makeStore();
  await s.adapter.set("visual.tags.opacityLeft", 40);
  const visuals = internals.getTagVisualsFromConfig(s.cfg());
  assert.equal(visuals.opacityLeft, 0.4,
    "движок прочитал прозрачность, которую выставили в панели: "
    + JSON.stringify(visuals.opacityLeft));
  ok("движок видит то, что записала панель");
}

/* ---- умолчание панели и умолчание движка -------------------------------- */

/**
 * Расхождения, известные на 2026-08-29. Каждое — продуктовый вопрос, а не
 * ошибка кода: `Transform включён из коробки` или `Bars рисуются сразу` решает
 * заказчик, а не исполнитель. Вопрос записан как В-7 в `docs/OPEN_QUESTIONS.md`.
 *
 * Список закрытый и **не должен расти**: новая настройка обязана прийти с тем
 * же умолчанием, что кладёт движок, иначе кнопка сброса группы вернёт человеку
 * не то, с чего он начинал.
 */
const KNOWN_DEFAULT_GAPS: Record<string, unknown> = {
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
  "transform.inline2note.placement.customHeader": "### Inline transformed",
  "transform.inline2note.placement.datetimeFormat": "YYYY-MM-DD HH:mm",
  "transform.inline2note.openTarget": false,
  "transform.inline2note.sourceProcessing.token": "#processed",
};

{
  /*
   * Умолчание схемы работает ровно в одном месте — кнопке сброса группы: она
   * считает «по умолчанию» то, что написано в схеме. Разойдись оно с движком —
   * и на свежей установке кнопка покажет отличия там, где человек ничего не
   * менял, а нажатие переведёт настройки в значения из прототипа.
   */
  const engine = transform.normalizeTransformConfig(internals.migrateConfig({})) as Any;
  const fresh: string[] = [];
  const stale: string[] = [];

  for (const it of boundItems()) {
    const b = bridge(it.path);
    const raw = getIn(engine, b.path);
    if (raw === undefined) continue;
    const shown = b.read(raw);
    const known = Object.prototype.hasOwnProperty.call(KNOWN_DEFAULT_GAPS, it.path);
    const def = (SCHEMA.flatMap(g => g.items).find(x => isBound(x) && x.path === it.path) as Any).default;
    const same = JSON.stringify(shown) === JSON.stringify(def);

    if (same && known) stale.push(it.path);
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
  ok("умолчание панели совпадает с умолчанием движка, кроме девятнадцати названных");
}

console.log("\n" + passed + " проверок пройдено");
