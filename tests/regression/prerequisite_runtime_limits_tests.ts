/**
 * Что движок делает с предусловием Field (PRD 10.13.4, Н20–Н29).
 *
 * Проверка на НАСТОЯЩИХ функциях движка, без единой подделки: `applyOrderToRules`
 * из `src/core/pkm_rules_runtime_helpers.js` и `isFieldEnabled` из
 * `pkm_v2/TagWheel/tagwheel_core.js` — те самые, что решают, показывать Field
 * или нет. Слой настроек пишет форму, которую разбирают они, и обещание из
 * подсказки держится ровно настолько, насколько её держат они.
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

  const rules: Any = {
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
    behavior: { order: {} },
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

console.log("\n" + passed + " проверок пройдено");
