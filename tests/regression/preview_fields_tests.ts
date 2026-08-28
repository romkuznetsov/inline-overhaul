/**
 * Предпросмотры на настоящих Fields (PRD 10.3 П11, П13; гейт Г20).
 *
 * Проверка по выводу: блоки рисуются на заглушке DOM, и читается результат —
 * какие чипы встали в строку, какого цвета полоса и что показано вместо
 * значения. Читать код здесь бессмысленно: П13 и П4 — про то, что видно.
 *
 * Что настоящее: конфиг проходит через `migrateConfig` из `main.js`, Fields
 * читаются моделью редактора (`fields_model.ts`), значения настроек берутся
 * из **умолчаний схемы** — тех же, что кладёт в хранилище панель. Подделан
 * DOM: другого способа нажать на панель нет.
 *
 * До 2026-08-28 `previewFields` отдавала примерные Fields и не смотрела в
 * конфиг вовсе (`_ctx` не использовался). Эта проверка — и есть закрытие П11.
 */

import assert from "node:assert/strict";
import { makeNode, type StubNode } from "../harness/dom_stub.ts";
import { setupGlobals, Setting, Notice, Modal } from "../harness/obsidian_stub.ts";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { previewFields, resolveSlots, EXAMPLE_FIELDS } from "../../src/ui/settings/custom/preview_data.ts";
import { barsPreview, tagPreview, wheelPreview } from "../../src/ui/settings/custom/previews.ts";
import { PREVIEW_EXAMPLE, PREVIEW_TEXTS } from "../../src/ui/settings/schema/custom_texts.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";
import { buildDefaultConfig, getIn } from "../../src/ui/settings/types.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";

setupGlobals();

type Any = ReturnType<typeof JSON.parse>;

const internals = loadPluginInternals();
/** Значения настроек по умолчанию — из схемы, как их кладёт панель (С1). */
const DEFAULTS = buildDefaultConfig(SCHEMA);

let passed = 0;
function ok(label: string): void {
  passed++;
  console.log("  ok " + label);
}

function all(node: StubNode, cls: string): StubNode[] {
  const out: StubNode[] = [];
  const walk = (n: StubNode): void => {
    if (n.classList.contains(cls)) out.push(n);
    n.children.forEach(walk);
  };
  walk(node);
  return out;
}

const texts = (node: StubNode, cls: string): string[] => all(node, cls).map(n => n.textContent);

/**
 * Контекст панели. `get` отдаёт умолчание схемы, если проверка не сказала
 * иного; `platform` появляется только когда есть конфиг — так же, как в
 * панели: без плагина её не передаёт никто.
 */
function makeCtx(cfg: Any | null, over?: Record<string, unknown>): SettingsCtx {
  const ctx: Any = {
    get: (p: string) => (over && p in over ? over[p] : getIn(DEFAULTS, p)),
    set: async () => {},
    run: async () => {},
    watch: () => () => {},
  };
  if (cfg) {
    ctx.platform = {
      Setting,
      Notice,
      Modal,
      setIcon: () => {},
      plugin: { app: {}, getConfig: () => cfg, setConfigPatch: () => {} },
      getConfig: () => cfg,
      normalizePkmOrder: internals.normalizePkmOrder,
      pkmOrderFields: [] as string[],
    };
  }
  return ctx as SettingsCtx;
}

/**
 * Конфиг с двумя тегами и ссылкой. Имена намеренно НЕ совпадают с именами
 * мест в текстах предпросмотров (`status`, `priority`): П13 требует, чтобы
 * одно и то же дерево читалось и против примерных Fields, и против своих.
 */
function realConfig(): Any {
  return internals.migrateConfig(JSON.parse(JSON.stringify({
    pkm: {
      behavior: {
        io: { separator1: "||", separator2: "||" },
        order: {
          left: ["state", "urgency"],
          right: ["client"],
          labels: { state: "State", urgency: "Urgency", client: "Client" },
          strictNames: { state: "state", urgency: "urgency", client: "client" },
          types: { state: "tag", urgency: "tag", client: "wikilink" },
          active: { state: "yes", state_sub: "yes", urgency: "yes", client: "yes" },
          enabled: { state: true, state_sub: true, urgency: true, client: true },
        },
        leftMode: {
          fields: [
            { id: "state", prefix: "#",
              values: [{ token: "open", active: true }, { token: "shut", active: true }] },
            /*
             * Дочернее значение живёт не в родительском Field, а в дочернем
             * `<name>_sub` — так его кладёт стрелка `Level` в редакторе, и так
             * его читает `buildTagTree`. Токены с решёткой: в этой ветке
             * плагин хранит их именно так.
             */
            {
              id: "state_sub", prefix: "#", dependsOn: "state", enabled: true,
              placeholder: "sub",
              values: [{ token: "#wip", active: true, allowedParentValues: ["#open"] }],
            },
            { id: "urgency", prefix: "#", values: [{ token: "now", active: true }] },
          ],
        },
        rightMode: {
          fields: [
            { id: "client", source: "wikilinks:client", values: [{ token: "ClientA", active: true }] },
          ],
        },
        /*
         * Ключи `byTag` — с решёткой. Это не украшение: `migrateConfig`
         * прогоняет их через свою `normalizeTagToken`, и токен без решётки
         * она выбрасывает молча. Фикстура без решётки давала пустые цвета,
         * и проверка нашла это первым же прогоном.
         */
        tagVisuals: {
          byTag: {
            state: {
              "#open": { fillColor: "#112233", textColor: "#ffffff" },
              "#wip": { fillColor: "#778899" },
              "#shut": { visibility: "empty" },
            },
            urgency: { "#now": { fillColor: "#445566", visibility: "custom", customText: "!" } },
          },
        },
      },
    },
  })));
}

/* ======================================================================
 * 1. Без платформы — пример, и панель об этом говорит (ПЗ2).
 * ====================================================================== */

{
  const got = previewFields(makeCtx(null));
  assert.equal(got.example, true, "читать нечем — значит пример");
  assert.deepEqual(got.fields, EXAMPLE_FIELDS, "и это ровно примерный набор");

  const host = makeNode("div");
  const close = tagPreview(host as unknown as El, makeCtx(null));
  assert.ok(texts(host, "io-preview__note").some(t => t.includes("Example Fields")),
    "пометка о примере на месте: " + texts(host, "io-preview__note").join(" | "));
  close();
  ok("без платформы предпросмотр показывает пример и помечает его");
}

/* ======================================================================
 * 2. Есть Fields — они настоящие, и пометки о примере больше нет.
 * ====================================================================== */

{
  const cfg = realConfig();
  const got = previewFields(makeCtx(cfg));
  assert.equal(got.example, false, "Fields настоящие — пример не нужен");
  assert.deepEqual(got.fields.map(f => f.id), ["state", "urgency", "client"],
    "Fields в порядке строки: левый Block, потом правый");
  assert.deepEqual(got.fields.map(f => f.name), ["State", "Urgency", "Client"],
    "имена — те, что человек видит в панели");
  assert.deepEqual(got.fields.map(f => f.side), ["left", "left", "right"]);
  assert.deepEqual(got.fields.map(f => f.kind), ["tag", "tag", "link"],
    "тип ссылки в конфиге называется wikilink, а предпросмотр знает его как link");

  const state = got.fields[0];
  assert.deepEqual(state?.values.map(v => v.token), ["open", "wip", "shut"],
    "значения без решётки: её ставит отрисовка пузыря");
  assert.deepEqual(state?.values.map(v => v.depth), [0, 1, 0],
    "дочернее значение прочитано и стоит за своим родителем (Ф8)");
  const byToken = new Map((state?.values || []).map(v => [v.token, v]));
  assert.equal(byToken.get("open")?.fill, "#112233", "цвет значения прочитан из конфига");
  assert.equal(byToken.get("open")?.text, "#ffffff");
  assert.equal(byToken.get("wip")?.fill, "#778899",
    "и цвет дочернего значения тоже — он лежит у родительского Field, "
    + "а не у дочернего (дефект редактора, купленный дважды)");
  assert.equal(byToken.get("shut")?.shown, "empty", "показ значения прочитан из конфига");
  assert.equal(got.fields[1]?.values[0]?.shown, "custom");
  assert.equal(got.fields[1]?.values[0]?.custom, "!", "и свой текст вместе с ним");

  const host = makeNode("div");
  const close = tagPreview(host as unknown as El, makeCtx(cfg));
  assert.ok(!texts(host, "io-preview__note").some(t => t.includes("Example Fields")),
    "пометки о примере больше нет: " + texts(host, "io-preview__note").join(" | "));
  close();
  ok("П11: Fields читаются из конфига тем же чтением, что у редактора");
}

/* ======================================================================
 * 3. Место — не id (П13).
 * ====================================================================== */

{
  const fields = previewFields(makeCtx(realConfig())).fields;
  const slots = resolveSlots(fields, ["status", "priority"]);
  assert.equal(slots.get("status")?.id, "state", "первое место взял первый Field строки");
  assert.equal(slots.get("priority")?.id, "urgency", "второе — второй");

  /* А если Field и правда назван именем места — дерево ложится на него. */
  const named = resolveSlots(
    [
      { id: "a", name: "A", kind: "tag", side: "left", values: [] },
      { id: "priority", name: "P", kind: "tag", side: "left", values: [] },
    ],
    ["priority", "status"],
  );
  assert.equal(named.get("priority")?.id, "priority", "совпадение по имени сильнее порядка");
  assert.equal(named.get("status")?.id, "a", "а остальным местам достаётся остаток");

  /* Fields меньше, чем мест: строка несёт меньше чипов, а не пустоту. */
  const few = resolveSlots([{ id: "only", name: "Only", kind: "tag", side: "left", values: [] }],
    ["status", "priority"]);
  assert.equal(few.size, 1, "лишнему месту Field не выдуман");
  ok("П13: имя в текстах предпросмотра — это место, а не id");
}

/* ======================================================================
 * 4. Предпросмотр оформления: чипы — из настоящих Values.
 * ====================================================================== */

{
  const cfg = realConfig();
  const draw = (childFormat: string): StubNode[] => {
    const host = makeNode("div");
    const close = tagPreview(host as unknown as El, makeCtx(cfg, {
      "pkm.behavior.childTagFormat": childFormat,
    }));
    const out = all(host, "io-bubble");
    close();
    return out;
  };

  /* Слитно: родитель и подзначение одним пузырём. */
  const combined = draw("combined");
  assert.equal(combined.length, 2, "два места слева — два пузыря: "
    + combined.map(n => n.textContent).join(" | "));
  assert.equal(combined[0]?.textContent, "#open/wip",
    "родитель и подзначение слитно, из настоящих Values");
  assert.equal(combined[0]?.style.getPropertyValue("--io-bubble-bg"), "#778899",
    "слитный пузырь берёт цвет подзначения");
  /* Значение с показом `custom` печатает свой текст, а не токен. */
  assert.equal(combined[1]?.textContent, "!", "второе место — Field с показом custom");

  /* Раздельно: два пузыря вместо одного, и цвета у каждого свои. */
  const split = draw("separate");
  assert.equal(split.length, 3, "раздельно — на пузырь больше: "
    + split.map(n => n.textContent).join(" | "));
  assert.deepEqual(split.slice(0, 2).map(n => n.textContent), ["#open", "#wip"]);
  assert.equal(split[0]?.style.getPropertyValue("--io-bubble-bg"), "#112233",
    "и его цвет из конфига");
  ok("предпросмотр оформления рисует настоящие Values, их цвета и обе формы дочернего тега");
}

/* ======================================================================
 * 5. Bars: текст строки не зависит от выбранного Field (П4).
 * ====================================================================== */

{
  const cfg = realConfig();
  const lineTexts = (fieldId: string, showTag: boolean): string[] => {
    const host = makeNode("div");
    const close = barsPreview(host as unknown as El, makeCtx(cfg, {
      "visual.tagBars.active": true,
      "visual.tagBars.fieldId": fieldId,
      "visual.tagBars.tagVisibility": showTag,
      "visual.tagBars.stripesToShow": 3,
    }));
    const out = texts(host, "io-line__text");
    close();
    return out;
  };

  const withState = lineTexts("state", true);
  const withUrgency = lineTexts("urgency", true);
  assert.ok(withState.length > 3, "дерево нарисовано: строк " + withState.length);
  assert.deepEqual(withState, withUrgency,
    "П4: переключение Field меняет полосы, а не текст строк");

  /*
   * Полоса берёт цвет значения ВЫБРАННОГО Field. Выбран второй, а не первый:
   * на первом «полоса берёт первый Field» и «полоса берёт выбранный» дают
   * один и тот же цвет, и проверка не различала бы их. Мутационный прогон
   * это и показал.
   */
  const barColors = (fieldId: string): Set<string> => {
    const host = makeNode("div");
    const close = barsPreview(host as unknown as El, makeCtx(cfg, {
      "visual.tagBars.active": true,
      "visual.tagBars.fieldId": fieldId,
      "visual.tagBars.tagVisibility": true,
      "visual.tagBars.stripesToShow": 3,
    }));
    const bars = all(host, "io-node--bar");
    assert.ok(bars.length, "полосы нарисованы для " + fieldId);
    const out = new Set(bars.map(n => n.style.getPropertyValue("--io-bar-color")));
    close();
    return out;
  };

  const urgencyColors = barColors("urgency");
  assert.ok(urgencyColors.has("#445566"),
    "цвет полосы — цвет значения выбранного Field: " + Array.from(urgencyColors).join(", "));
  assert.ok(!urgencyColors.has("#112233"),
    "а не первого Field строки: " + Array.from(urgencyColors).join(", "));
  const stateColors = barColors("state");
  assert.ok(stateColors.has("#112233") && !stateColors.has("#445566"),
    "и наоборот: " + Array.from(stateColors).join(", "));
  assert.ok(!stateColors.has("var(--color-blue)"), "и это не цвет примерного набора");

  /* Скрывается ровно один тег — тот, чей Field рисует полосу. */
  const shownTag = lineTexts("state", true);
  const hiddenTag = lineTexts("state", false);
  assert.deepEqual(shownTag, hiddenTag, "текст строк не меняется и от этого");
  const bubblesWith = (showTag: boolean): number => {
    const h = makeNode("div");
    const c = barsPreview(h as unknown as El, makeCtx(cfg, {
      "visual.tagBars.active": true,
      "visual.tagBars.fieldId": "state",
      "visual.tagBars.tagVisibility": showTag,
      "visual.tagBars.stripesToShow": 3,
    }));
    const n = all(h, "io-bubble").length;
    c();
    return n;
  };
  assert.ok(bubblesWith(false) < bubblesWith(true),
    "выключенный показ тега убирает пузыри выбранного Field: "
    + bubblesWith(false) + " против " + bubblesWith(true));
  ok("Bars: полосы от настоящих Values, текст строк от выбора Field не зависит");
}

/* ======================================================================
 * 6. TagWheel: значения в скроллере — настоящие.
 * ====================================================================== */

{
  const cfg = realConfig();
  const host = makeNode("div");
  const close = wheelPreview(host as unknown as El, makeCtx(cfg, {
    "visual.tagWheel.scroller.enabled": true,
    "visual.tagWheel.scroller.size": 1,
    "visual.tagWheel.scroller.direction": "full",
    "visual.tagWheel.showMarkers": true,
  }));
  const values = texts(host, "io-wheelval");
  assert.ok(values.length, "скроллер нарисован");
  /*
   * Скроллер садится на второй Field слева — это `urgency`, и его значение
   * одно. Список замкнут, поэтому и вверх, и вниз показано оно же.
   */
  assert.deepEqual(Array.from(new Set(values)), ["#now"],
    "значения из конфига, с маркером: " + values.join(" | "));
  close();
  ok("TagWheel: скроллер показывает настоящие Values");
}

/* ======================================================================
 * 7. Fields не завели — снова пример, а не пустая строка.
 * ====================================================================== */

{
  const empty = internals.migrateConfig(JSON.parse(JSON.stringify({
    pkm: { behavior: { io: { separator1: "||", separator2: "||" } } },
  })));
  const got = previewFields(makeCtx(empty));
  assert.equal(got.example, true, "Fields нет — предпросмотру нечего показывать, кроме примера");
  assert.equal(got.fields.length, EXAMPLE_FIELDS.length);
  assert.equal(PREVIEW_EXAMPLE.length > 0, true, "и текст пометки на месте");
  assert.ok((PREVIEW_TEXTS["bars-preview"]?.tree || []).length, "дерево Bars живёт в текстах");
  ok("пустой vault: пример вместо пустой строки");
}

console.log("\n" + passed + " проверок пройдено");
