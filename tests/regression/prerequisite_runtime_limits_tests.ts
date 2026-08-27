/**
 * Что движок делает с предусловием Field (PRD 10.13.4, Н20–Н29).
 *
 * Проверка на НАСТОЯЩИХ функциях движка, без единой подделки. Берётся вся
 * цепочка, по которой идёт открытие TagWheel, а не её середина:
 *
 *   `applyOrderToRules`  (`src/core/pkm_rules_runtime_helpers.js`)
 *        ↓
 *   `validateRules`      (`pkm_v2/TagWheel/tagwheel_core.js`) — бросает
 *        ↓
 *   `renderControlLine` / `getNavigableFieldSequence` — отрисовка панели
 *        ↓
 *   `isFieldEnabled` — показывать Field или нет
 *
 * Цепочка целиком здесь не случайно. Первая редакция этой проверки звала
 * только `applyOrderToRules` и `isFieldEnabled` — то есть проверяла путь, до
 * которого TagWheel не доходил: раньше срабатывал `validateMode` внутри
 * `validateRules` и клал открытие целиком (находка Н-1 из vault, 2026-08-28).
 * Правило, купленное этой ошибкой: звать ту функцию, с которой работа
 * начинается, а не ту, до которой дочитал.
 *
 * Проходов, отвергавших связь через границу списков определений, оказалось
 * три, а не один. Два из них живут в `tagwheel_core.js` и открыты вторым
 * исключением из З3 (разрешено заказчиком 2026-08-28, записано в PRD 3.3):
 *
 *   1. `reconcileModeDependencies` — стирал `dependsOn` и выключал Field.
 *   2. `validateMode` — бросал исключение, и TagWheel не открывался вовсе.
 *   3. `allowInPanel` — молча прятал Field из обеих панелей, потому что брал
 *      Block родителя вместо своего собственного.
 *
 * Здесь закреплены три факта, и третий — оставшееся ограничение:
 *
 *  1. Field, ждущий соседа по своему списку определений, включается ровно
 *     тогда, когда у того выбрано значение (и то самое, если оно названо).
 *  2. Field ПРАВОГО списка — ссылка или элемент — может ждать Field из
 *     любого списка, в том числе тег. Так решил заказчик 2026-08-27, и ради
 *     этого в `reconcileModeDependencies` открыта граница списков в одну
 *     сторону (исключение из З3, записано в PRD 3.3 и 10.13.4).
 *  3. Field ЛЕВОГО списка по-прежнему ждёт только своего. Граница открыта
 *     в одну сторону намеренно: `dependsOn` у левого Field значит для движка
 *     ещё и «дочерний тег», и его читают сборка `techOrder` и слияние в
 *     `#parent/child`.
 *
 * Третий факт — причина, по которой панель у Field типа `tag` не предлагает
 * ссылки и элементы в кандидаты (Н24). Если движок научится и этому, проверка
 * упадёт — и упасть она должна: вместе с ней меняется фильтр кандидатов.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Any = ReturnType<typeof JSON.parse>;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const requireCjs = createRequire(import.meta.url);

const helpers = requireCjs(path.join(root, "src", "core", "pkm_rules_runtime_helpers.js")) as {
  applyOrderToRules: (rules: Any, orderCfg: Any, options?: Any) => void;
};
const core = requireCjs(path.join(root, "pkm_v2", "TagWheel", "tagwheel_core.js")) as {
  isFieldEnabled: (mode: Any, state: Any, field: Any, rules: Any) => boolean;
  validateRules: (rules: Any) => void;
  parseLine: (line: string, rules: Any) => Any;
  makeInitialState: (rules: Any, modeName: string) => Any;
  renderControlLine: (rules: Any, state: Any, parsedLine: Any) => string;
  getNavigableFieldSequence: (rules: Any, state: Any) => string[];
};

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

/**
 * Два Fields в конфиге: `status` — тег с двумя значениями, `projects` —
 * ссылка. Третий, `second`, ставится в тот список, который назван, и ждёт
 * того, кто назван.
 */
function build(o: {
  /** Где лежит определение зависимого Field. */
  where: "left" | "right";
  /** Кого он ждёт. */
  dependsOn: string;
  /** Какого значения ждёт; пусто — любого. */
  needs?: string;
}): { field: Any; mode: Any; rules: Any } {
  const second = o.where === "left"
    ? { id: "second", prefix: "#", values: [{ token: "#a" }] }
    : { id: "second", source: "wikilinks:second", values: [{ token: "B" }] };
  const dependent: Any = { ...second, dependsOn: o.dependsOn };
  if (o.needs) dependent.enabledForParentValues = [o.needs];

  /* Секции `io`, `behavior.defaultMode` и `projects` обязательны для
     `validateRules`: без них он падает на другой причине и до предусловия
     не доходит. */
  const rules: Any = {
    io: { separator1: " | ", separator2: " -- " },
    leftMode: {
      fields: [
        { id: "status", prefix: "#", values: [{ token: "#work" }, { token: "#home" }] },
        ...(o.where === "left" ? [dependent] : []),
      ],
    },
    rightMode: {
      fields: [
        { id: "projects", source: "wikilinks:projects", values: [{ token: "Alpha" }, { token: "Beta" }] },
        ...(o.where === "right" ? [dependent] : []),
      ],
    },
    behavior: { defaultMode: "left", order: {} },
    projects: { items: [] },
  };
  const orderCfg: Any = {
    left: ["status"].concat(o.where === "left" ? ["second"] : []),
    right: ["projects"].concat(o.where === "right" ? ["second"] : []),
    labels: {}, strictNames: {}, lead: {}, freeRoam: {},
    types: { status: "tag", projects: "wikilink", second: o.where === "left" ? "tag" : "wikilink" },
    active: { status: "yes", projects: "yes", second: "yes" },
    enabled: { status: true, projects: true, second: true },
  };
  helpers.applyOrderToRules(rules, orderCfg, {});
  const mode = o.where === "left" ? rules.leftMode : rules.rightMode;
  return { field: (mode.fields as Any[]).find((f: Any) => f.id === "second"), mode, rules };
}

const shown = (b: { field: Any; mode: Any; rules: Any }, selected: Any): boolean =>
  core.isFieldEnabled(b.mode, { selected }, b.field, b.rules);

/* ======================================================================
 * Свой список определений: настройка работает.
 * ====================================================================== */

{
  const b = build({ where: "left", dependsOn: "status" });
  assert.equal(b.field.dependsOn, "status", "`dependsOn` пережил применение Order к правилам");
  assert.equal(shown(b, {}), false, "у Field-предусловия значения нет — зависимый молчит");
  assert.equal(shown(b, { status: "#home" }), true, "значение появилось — зависимый показан");
  assert.equal(shown(b, { status: "#work" }), true, "и годится любое: конкретного мы не называли");
  ok("свой список: Field ждёт любое значение соседа");
}

{
  const b = build({ where: "left", dependsOn: "status", needs: "#work" });
  assert.deepEqual(b.field.enabledForParentValues, ["#work"],
    "названное значение дошло до правил");
  assert.equal(shown(b, { status: "#home" }), false, "выбрано другое значение — зависимый молчит");
  assert.equal(shown(b, { status: "#work" }), true, "выбрано названное — показан");
  ok("свой список: Field ждёт названное значение соседа");
}

{
  /* Тот же механизм у правого списка: ссылка ждёт ссылку. */
  const b = build({ where: "right", dependsOn: "projects", needs: "Alpha" });
  assert.equal(b.field.dependsOn, "projects", "`dependsOn` на месте и справа");
  assert.equal(shown(b, { projects: "Beta" }), false, "другое значение — молчит");
  assert.equal(shown(b, { projects: "Alpha" }), true, "названное — показан");
  ok("свой список: то же самое у ссылок и элементов");
}

/* ======================================================================
 * Чужой список определений: открыт в одну сторону.
 * ====================================================================== */

/**
 * Определения тегов лежат в `leftMode.fields`, ссылок и элементов — в
 * `rightMode.fields`; раскладывает их по типу `ensureBehaviorModesFromOrder`
 * в `main.js`, и это НЕ Block, в который Field пишется.
 *
 * Ровно тот случай, который назвал заказчик: выбран тег `#work`, и после
 * этого появляется зависимая от него ссылка `projects`.
 */
{
  const b = build({ where: "right", dependsOn: "status", needs: "#work" });
  assert.equal(b.field.dependsOn, "status",
    "связь ссылки с тегом пережила применение Order: до правки движок её стирал");
  assert.notEqual(b.field.enabled, false, "и Field не выключен");
  assert.equal(shown(b, {}), false, "у тега значения нет — ссылка молчит");
  assert.equal(shown(b, { status: "#home" }), false, "выбрано другое значение тега — молчит");
  assert.equal(shown(b, { status: "#work" }), true,
    "выбран #work — ссылка показана: это и есть случай заказчика");
  ok("чужой список: ссылка ждёт тег и появляется вместе с его значением");
}

{
  /* Без названного значения — годится любое значение тега. */
  const b = build({ where: "right", dependsOn: "status" });
  assert.equal(shown(b, {}), false, "значения у тега нет — молчит");
  assert.equal(shown(b, { status: "#home" }), true, "любое значение тега открывает ссылку");
  ok("чужой список: ссылка ждёт любое значение тега");
}

{
  /*
   * Обратное направление осталось закрытым, и это решение, а не забывчивость:
   * `dependsOn` у левого Field движок читает ещё и как «дочерний тег».
   */
  const b = build({ where: "left", dependsOn: "projects", needs: "Alpha" });
  assert.equal(b.field.enabled, false, "тег не может ждать ссылку: движок выключает его");
  assert.equal(String(b.field.dependsOn || ""), "", "связь стёрта");
  assert.equal(shown(b, { projects: "Alpha" }), false, "тег не появляется");
  ok("чужой список: тег ждать ссылку по-прежнему не может — граница открыта в одну сторону");
}

{
  /*
   * Порядок полей в своём списке не поехал. Зависимый от чужого списка Field
   * считается корнем: иначе он уехал бы в конец, и токен встал бы в строке не
   * туда, куда его поставил человек.
   */
  const b = build({ where: "right", dependsOn: "status", needs: "#work" });
  assert.deepEqual((b.mode.fields as Any[]).map((f: Any) => f.id), ["projects", "second"],
    "порядок правого списка тот же, что и был");
  ok("чужой список: порядок полей внутри списка не меняется");
}

/* ======================================================================
 * Отрисовка TagWheel: проходов три, а не один.
 *
 * Всё, что выше, спрашивает `isFieldEnabled` — а до него TagWheel сперва
 * надо открыть и панель собрать. Ниже зовутся обе функции, стоящие раньше.
 * ====================================================================== */

/** Открывается ли TagWheel вообще: `validateRules` бросает, а не возвращает. */
function opens(rules: Any): string {
  try {
    core.validateRules(rules);
    return "";
  } catch (e) {
    return String(e && (e as Error).message ? (e as Error).message : e);
  }
}

/** Что панель показывает и чем можно ходить по стрелкам. */
function panel(rules: Any, panelName: "left" | "right", selected: Any): { seq: string[]; line: string } {
  const state = core.makeInitialState(rules, panelName);
  state.selected = selected;
  const parsed = core.parseLine("task", rules);
  return {
    seq: core.getNavigableFieldSequence(rules, state),
    line: core.renderControlLine(rules, state, parsed),
  };
}

{
  /*
   * Тот самый отказ из vault: `[tagwheel] rightMode.fields[second].dependsOn
   * references missing field: status`. `validateMode` обходит поля ОДНОГО
   * списка, а `status` лежит в другом.
   */
  const b = build({ where: "right", dependsOn: "status", needs: "#work" });
  assert.equal(opens(b.rules), "",
    "TagWheel открывается: `validateMode` больше не считает связь через границу списков сломанной");
  ok("проход validateMode: ссылка, ждущая тег, не кладёт открытие TagWheel");
}

{
  /*
   * Проверка на месте и не выродилась: `dependsOn` на Field, которого нет
   * нигде, — по-прежнему отказ. Иначе «открыть границу» превратилось бы в
   * «снять проверку».
   *
   * Зовётся на СЫРЫХ правилах, без `applyOrderToRules`: тот идёт первым и
   * связь с несуществующим Field стирает сам (`f.dependsOn = ""` в
   * `reconcileModeDependencies`), так что до `validateMode` она не доживает.
   * Это и есть разделение труда двух проходов, и проверять их надо порознь.
   */
  const raw: Any = {
    io: { separator1: " | ", separator2: " -- " },
    leftMode: { fields: [{ id: "status", prefix: "#", values: [{ token: "#work" }] }] },
    rightMode: {
      fields: [{
        id: "second", source: "wikilinks:second", values: [{ token: "B" }],
        dependsOn: "nobody",
      }],
    },
    behavior: { defaultMode: "left", order: {} },
    projects: { items: [] },
  };
  assert.match(opens(raw), /dependsOn references missing field: nobody/,
    "несуществующий Field-предусловие по-прежнему отказ");
  ok("проход validateMode: связь с несуществующим Field по-прежнему отвергается");
}

{
  /* И то же самое в другую сторону: левый список чужого родителя не видит,
     как и раньше — граница у обоих проходов открыта в одну сторону. */
  const raw: Any = {
    io: { separator1: " | ", separator2: " -- " },
    leftMode: {
      fields: [
        { id: "status", prefix: "#", values: [{ token: "#work" }] },
        { id: "second", prefix: "#", values: [{ token: "#a" }], dependsOn: "projects" },
      ],
    },
    rightMode: { fields: [{ id: "projects", source: "wikilinks:projects", values: [{ token: "Alpha" }] }] },
    behavior: { defaultMode: "left", order: {} },
    projects: { items: [] },
  };
  assert.match(opens(raw), /leftMode\.fields\[second\]\.dependsOn references missing field: projects/,
    "тег, ждущий ссылку, для `validateMode` по-прежнему сломанная связь");
  ok("проход validateMode: обратное направление осталось закрытым");
}

{
  /*
   * Третий проход. `allowInPanel` у зависимого Field брал Block РОДИТЕЛЯ, а
   * свой `orderKey` не смотрел вовсе. Тег `status` стоит в Left Block, ссылка
   * `second` — в Right, и ссылка пропадала из обеих панелей: слева потому что
   * её ключ лежит в чужом Block, справа потому что там нет ключа родителя.
   */
  const b = build({ where: "right", dependsOn: "status", needs: "#work" });
  const shownRight = panel(b.rules, "right", { status: "#work" });
  assert.ok(shownRight.seq.includes("second"),
    "ссылка с предусловием стоит в своём Block и по ней можно ходить стрелками");
  assert.match(shownRight.line, /second/,
    "и она же напечатана в панели, а не пропущена молча");
  ok("проход allowInPanel: Field с предусловием остаётся в своём Block");
}

{
  /* Обещание Н21 на пути отрисовки, а не только у `isFieldEnabled`: пока у
     тега значения нет, ссылки в панели нет. */
  const b = build({ where: "right", dependsOn: "status", needs: "#work" });
  const empty = panel(b.rules, "right", {});
  assert.ok(!empty.seq.includes("second"), "значения у тега нет — ссылки в панели нет");
  assert.doesNotMatch(empty.line, /second/, "и в строке её тоже нет");
  const other = panel(b.rules, "right", { status: "#home" });
  assert.ok(!other.seq.includes("second"), "выбрано другое значение тега — ссылки нет");
  ok("отрисовка: ссылка появляется в панели ровно с нужным значением тега");
}

{
  /* Свой список не поехал: тег с предусловием по-прежнему рисуется слева. */
  const b = build({ where: "left", dependsOn: "status", needs: "#work" });
  assert.equal(opens(b.rules), "", "свой список открывается");
  const shown = panel(b.rules, "left", { status: "#work" });
  assert.ok(shown.seq.includes("second"), "тег с предусловием на месте в левой панели");
  ok("отрисовка: предусловие внутри своего списка работало и работает");
}

{
  /*
   * Дочерний Field (`<name>_sub`) — не Field с предусловием, и различать их
   * надо по признаку, а не по наличию `dependsOn`. Своего ключа в Block у
   * него нет (`normalizePkmOrder` выбрасывает `_sub` из `left` и `right`),
   * поэтому он обязан по-прежнему идти за родителем. Если правка
   * `allowInPanel` это сломает, дочерний тег исчезнет из панели.
   */
  const rules: Any = {
    io: { separator1: " | ", separator2: " -- " },
    leftMode: {
      fields: [
        { id: "status", prefix: "#", values: [{ token: "#work" }] },
        { id: "status_sub", prefix: "#", dependsOn: "status", placeholder: "sub", values: [{ token: "#a" }] },
      ],
    },
    rightMode: { fields: [{ id: "projects", source: "wikilinks:projects", values: [{ token: "Alpha" }] }] },
    behavior: { defaultMode: "left", order: {} },
    projects: { items: [] },
  };
  helpers.applyOrderToRules(rules, {
    left: ["status"], right: ["projects"],
    labels: {}, strictNames: {}, lead: {}, freeRoam: {},
    types: { status: "tag", projects: "wikilink" },
    active: { status: "yes", status_sub: "yes", projects: "yes" },
    enabled: { status: true, status_sub: true, projects: true },
  }, {});
  const sub = (rules.leftMode.fields as Any[]).find((f: Any) => f.id === "status_sub");
  assert.equal(String(sub.orderKey || ""), "status_sub", "свой ключ у дочернего Field есть");
  assert.equal(String(sub.panel || ""), "", "но ни в одном Block он не лежит — Block берётся у родителя");
  const shown = panel(rules, "left", { status: "#work" });
  assert.ok(shown.seq.includes("status_sub"), "дочерний Field идёт за родителем и остаётся в его панели");
  ok("отрисовка: дочерний Field по-прежнему наследует Block родителя");
}

console.log("\n" + passed + " проверок пройдено");
