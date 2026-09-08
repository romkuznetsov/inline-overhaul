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
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { previewFields, fieldOptions, resolveSlots, EXAMPLE_FIELDS } from "../../src/ui/settings/custom/preview_data.ts";
import {
  barsPreview,
  floatingButton,
  linePreview,
  sourcePreview,
  tagPreview,
  wheelPreview,
} from "../../src/ui/settings/custom/previews.ts";
import { PREVIEW_EXAMPLE, PREVIEW_TEXTS } from "../../src/ui/settings/schema/custom_texts.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";
import { buildDefaultConfig, getIn } from "../../src/ui/settings/types.ts";
import type { El } from "../../src/ui/settings/custom/dom.ts";
import type { SettingsCtx } from "../../src/ui/settings/types.ts";
import { FRAME_TEXTS } from "../../src/ui/settings/texts_custom.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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
  /*
   * **Утверждение переехало за предметом** (У-94). В `EXAMPLE_FIELDS` у Field
   * теперь стоит не имя, а **адрес строки каталога**: слова `Status` и
   * `Priority` лежали здесь литералами при живых строках `frame.example-status`
   * и `frame.example-priority`, которые никто не спрашивал (долг A46). Подпись
   * подставляет `previewFields`, и сверять надо с подставленным.
   */
  const named = EXAMPLE_FIELDS.map(f => ({
    ...f,
    name: String((FRAME_TEXTS as Record<string, string>)[f.name] || f.name),
  }));
  assert.deepEqual(got.fields, named, "и это ровно примерный набор, с подставленными именами");
  assert.deepEqual(got.fields.map(f => f.name), ["Status", "Priority"],
    "подписи примера — слова, а не адреса каталога: " + got.fields.map(f => f.name).join(", "));

  /*
   * И перевод доезжает: подстановка спрашивается по ключу, а не берётся из
   * таблицы. Без этой половины утверждение выше было бы верным и у литерала.
   */
  const asked: string[] = [];
  const ru = previewFields({
    ...makeCtx(null),
    t: (key: string, fallback: string) => {
      asked.push(key);
      return key === "frame.example-status" ? "Статус" : fallback;
    },
  } as never);
  assert.equal(ru.fields[0]?.name, "Статус", "перевод имени примера не доехал до предпросмотра");
  assert.ok(asked.includes("frame.example-priority"),
    "второе имя примера у каталога не спрошено: " + asked.join(", "));

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
  /*
   * Имён у Field два, и фикстура нарочно даёт им **разные** значения: строгое
   * (`Name`) и короткое для TagWheel (`Name in TagWheel`). Пока `name` нёс
   * короткое, а `short` не заполнялся вовсе, расхождения не видел никто —
   * предпросмотры читают `short || name` и получали одно и то же (У-47).
   * Видно оно было только в выпадающем списке `Field for the Bars`, и это
   * замечание заказчика от 2026-09-07.
   */
  assert.deepEqual(got.fields.map(f => f.name), ["state", "urgency", "client"],
    "`name` — строгое имя Field, то же, каким его зовут команды");
  assert.deepEqual(got.fields.map(f => f.short), ["State", "Urgency", "Client"],
    "`short` — короткое имя для TagWheel");
  assert.deepEqual(
    fieldOptions(makeCtx(cfg), f => f.kind === "tag").map(o => o.label),
    ["state", "urgency"],
    "в выпадающем списке Fields зовутся строгим именем, а не коротким");
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

/* ======================================================================
 * 8. Разбор строки (10.3 П3): Fields, а не значения одного Field.
 *
 * Проверка по выводу: читается, что встало в каждую ячейку сетки. Разбор
 * строки объясняет её устройство — Prefix, два Block, два Separator и текст
 * между ними, — и подписи обязаны стоять под тем, что подписывают.
 * ====================================================================== */

{
  const cfg = realConfig();
  const host = makeNode("div");
  const close = linePreview(host as unknown as El, makeCtx(cfg, {
    "pkm.lineFormat.separator1": "//",
    "pkm.lineFormat.separator2": "\\\\",
  }));

  /* Ряд первый: сама строка. */
  const sides = all(host, "io-struct__side");
  assert.equal(sides.length, 2, "два Block: левый и правый");
  assert.deepEqual(
    (sides[0] as StubNode).children.map(n => n.textContent),
    ["State", "Urgency"],
    "в левом Block чипы настоящих Fields, по имени");
  assert.deepEqual(
    (sides[1] as StubNode).children.map(n => n.textContent),
    ["Client"],
    "в правом — тот, который стоит справа");
  assert.deepEqual(texts(host, "io-line__sep"), ["//", "\\\\"],
    "Separator показаны те, что стоят в настройках");
  assert.equal(texts(host, "io-line__text")[0], "your text", "текст строки — выдуманный (П1)");
  assert.equal(texts(host, "io-line__prefix")[0], "- ", "Prefix на своём месте");

  /* Ряд второй и третий: подписи под Blocks и Separator. */
  assert.deepEqual(texts(host, "io-struct__name"), ["Left Block", "Right Block"],
    "скобки подписаны Blocks");
  assert.deepEqual(texts(host, "io-struct__sepname"), ["separator 1", "separator 2"],
    "и Separator подписаны по порядку");
  assert.equal(all(host, "io-struct__tick").length, 2, "по засечке под каждым Separator");

  /*
   * Сетка одна на все три ряда: ячейки лежат в одном узле подряд, и ряды не
   * могут разъехаться. Шесть колонок на три ряда — восемнадцать ячеек.
   */
  const grid = all(host, "io-struct")[0] as StubNode;
  assert.equal(grid.children.length, 18,
    "три ряда по шесть ячеек в одной сетке: " + grid.children.length);
  assert.ok(!texts(host, "io-preview__note").some(t => t.includes("Example Fields")),
    "Fields настоящие — пометки о примере нет");
  close();
  ok("разбор строки: настоящие Fields, Separator из настроек, подписи под своими местами");
}

{
  /* Правый Block пуст — одно слово вместо чипов, а не пустая ячейка. */
  const base = realConfig();
  base.pkm.fields.order.right = [];
  base.pkm.fields.order.left = ["state", "urgency", "client"];
  const cfg = internals.migrateConfig(base);
  const host = makeNode("div");
  const close = linePreview(host as unknown as El, makeCtx(cfg));
  const sides = all(host, "io-struct__side");
  assert.equal(all(sides[1] as StubNode, "io-line__hint").length, 1,
    "у пустого правого Block — подпись, а не пустота");
  assert.equal(texts(host, "io-line__hint")[0], "empty");
  close();
  ok("разбор строки: пустой правый Block подписан");
}

{
  /*
   * Пример помечается и здесь. Проверка добавлена мутационным прогоном:
   * дефект «пометка не ставится» выжил, потому что все случаи разбора строки
   * шли на настоящих Fields, где пометки и не должно быть.
   */
  const host = makeNode("div");
  const close = linePreview(host as unknown as El, makeCtx(null));
  assert.ok(texts(host, "io-preview__note").some(t => t.includes("Example Fields")),
    "без платформы разбор строки помечает пример: " + texts(host, "io-preview__note").join(" | "));
  assert.deepEqual(texts(host, "io-struct__name"), ["Left Block", "Right Block"],
    "и сам разбор при этом на месте");
  close();
  ok("разбор строки: пример помечен, как и в остальных предпросмотрах");
}

/* ---- плавающая кнопка (10.3) ------------------------------------------- */

{
  /*
   * Кнопка в предпросмотре — картинка, а не контрол. В прототипе на этом
   * месте `<button>`, который ничего не делает; в панели нажимаемый контрол,
   * который ничем не отвечает, запрещён (З8). Проверка держит именно это.
   */
  const host = makeNode("div");
  const close = floatingButton(host as unknown as El, makeCtx(realConfig()));

  /*
   * Класс тот же, что у кнопки в заметке (`io-flybtn`), и надпись та же —
   * одна стрелка. Заказчик 2026-09-04: «в io-tip-i2n-button-preview button
   * отображается как `-> note`, сделай чтобы было как в заметке (т.е. просто
   * стрелочка)». Два вида одного элемента разошлись бы молча (У-32).
   */
  const float = all(host, "io-flybtn");
  assert.equal(float.length, 1, "кнопка нарисована один раз");
  assert.equal(float[0]?.tagName, "SPAN", "и это не кнопка, а её вид");
  assert.equal(float[0]?.textContent, "\u2192",
    "надпись — одна стрелка, как в заметке");
  assert.equal(all(host, "io-float").length, 0,
    "прежней таблетки в предпросмотре быть не должно");
  /* Отступ от текста едет из слайдера той же переменной, что в заметке. */
  assert.equal(float[0]?.style.getPropertyValue("--io-flybtn-gap"), "12px",
    "кнопка не получила отступ из настройки: "
    + float[0]?.style.getPropertyValue("--io-flybtn-gap"));
  assert.equal(all(host, "io-line").length, 1,
    "рядом стоит строка, на которой она появляется");
  assert.ok(texts(host, "io-preview__note").some(t => t.includes("cursor")),
    "и сказано, на какой именно строке: "
    + texts(host, "io-preview__note").join(" | "));

  /*
   * П9 и П10: предпросмотр по-прежнему говорит о себе, что он не редактор,
   * но говорит это в своём «?», а не серой строкой над картинкой (замечание
   * заказчика 1.4.1.1.1). Здесь — что строки в рамке больше нет; что фраза
   * никуда не делась, держит проверка ниже, по всем пяти предпросмотрам.
   */
  assert.equal(texts(host, "io-preview__note--top").length, 0,
    "серой строки над картинкой в рамке предпросмотра больше нет");

  close();
  ok("плавающая кнопка: вид кнопки без кнопки, и строка рядом");
}

/* ---- оговорка «это не редактор» (10.3 П9, П10) ------------------------- */

{
  /*
   * П9 оставляет два варианта, и выбран второй: предпросмотр объявлен
   * приблизительным, и это сказано в интерфейсе. Сказано теперь в «?»
   * каждого предпросмотра, а не отдельной строкой над картинкой.
   *
   * Проверяется каждый предпросмотр, а не один: снятие строки из общей рамки
   * убрало оговорку сразу у всех пяти, и вернуть её поимённо — ровно та
   * правка, которую легко забыть на новом предпросмотре.
   */
  const CAVEAT = "close likeness of what the editor shows";
  const silent = Object.keys(PREVIEW_TEXTS)
    .filter(id => !String(PREVIEW_TEXTS[id]?.tip || "").includes(CAVEAT));
  assert.deepEqual(silent, [],
    "предпросмотр не говорит, что он не редактор: " + silent.join(", "));
  assert.ok(Object.keys(PREVIEW_TEXTS).length >= 5,
    "предпросмотров стало меньше пяти — проверять нечего");
  ok("каждый предпросмотр говорит в «?», что он не редактор");
}


/* ======================================================================
 * `Number of Bars` меняет число дорожек (замечание заказчика 1.4.2.1).
 *
 * Заказчик написал, что при значении 3 в предпросмотре ничего не происходит.
 * Чтением воспроизвести не удалось, и прогон на его собственном `data.json`
 * дал 2, 4 и 7 полос на значениях 1, 2 и 3. Поэтому здесь не починка, а
 * замер: пин печатает получившиеся дорожки (У-8) и покраснеет, если третья
 * когда-нибудь пропадёт по-настоящему.
 * ====================================================================== */

{
  const cfg = realConfig();
  const lanes = (cap: number): { bars: number; lanes: string[] } => {
    const host = makeNode("div");
    const close = barsPreview(host as unknown as El, makeCtx(cfg, {
      "visual.tagBars.active": true,
      "visual.tagBars.fieldId": "state",
      "visual.tagBars.tagVisibility": true,
      "visual.tagBars.stripesToShow": cap,
    }));
    const bars = all(host, "io-node--bar");
    const out = Array.from(new Set(bars.map(n => n.style.getPropertyValue("--io-lane")))).sort();
    close();
    return { bars: bars.length, lanes: out };
  };

  const one = lanes(1);
  const two = lanes(2);
  const three = lanes(3);
  const shape = "1 → " + JSON.stringify(one.lanes) + ", 2 → " + JSON.stringify(two.lanes)
    + ", 3 → " + JSON.stringify(three.lanes);

  assert.deepEqual(one.lanes, ["0"], "при 1 полоса одна, самая левая: " + shape);
  assert.deepEqual(two.lanes, ["0", "1"], "при 2 добавляется дорожка ребёнка: " + shape);
  assert.deepEqual(three.lanes, ["0", "1", "2"], "при 3 добавляется дорожка внука: " + shape);
  assert.ok(three.bars > two.bars && two.bars > one.bars,
    "каждое следующее значение рисует больше полос: " + one.bars + " → " + two.bars + " → " + three.bars);
  ok("Number of Bars двигает дорожки: " + one.bars + " → " + two.bars + " → " + three.bars + " полос");
}

/* ======================================================================
 * Дорожка полосы — это глубина строки, а не счётчик нарисованных полос.
 *
 * Заказчик 2026-09-02 назвал Field (`bars-field = type`), у которого значение
 * есть у родительской и внучатой строк и нет у дочерней: рисовались дорожки 0
 * и 1, а вторая полоса обязана стоять на дорожке 2 — дочерняя дорожка остаётся
 * пустой. Прежний пин про число полос это переживал зелёным: полос было
 * правильное количество, ошибка была в их месте (замечание B22).
 *
 * В выдуманном дереве предпросмотра место `priority` устроено так же: оно есть
 * у корня, нет у его ребёнка и снова есть у внука. Норматив — движок
 * (`priority_strip_engine.js`): он считает `depthFromRoot` и наследует цвет
 * вниз независимо от того, есть ли у строки своё значение (П9).
 * ====================================================================== */

{
  const cfg = realConfig();
  /* Место `priority` в дереве достаётся Field `urgency`: имён `status` и
     `priority` в конфиге нет, и места раздаёт `resolveSlots` по порядку. */
  const host = makeNode("div");
  const close = barsPreview(host as unknown as El, makeCtx(cfg, {
    "visual.tagBars.active": true,
    "visual.tagBars.fieldId": "urgency",
    "visual.tagBars.tagVisibility": true,
    "visual.tagBars.stripesToShow": 3,
  }));
  const bars = all(host, "io-node--bar");
  const lanes = Array.from(new Set(bars.map(n => n.style.getPropertyValue("--io-lane")))).sort();
  close();

  assert.ok(bars.length > 0, "полосы вообще нарисовались");
  assert.deepEqual(lanes, ["0", "2"],
    "дочерняя дорожка остаётся пустой, внучатая — третья: получилось "
    + JSON.stringify(lanes));
  /* --------------------------------------------------------------------
   * И тот же вопрос — самому нормативу.
   *
   * Выше написано «норматив — движок», и до 2026-09-07 это было
   * **утверждением о чужом состоянии**, которого никто не проверял (У-71).
   * Движок считал глубину по строкам со значением, а не по уровням дерева: у
   * заказчика внучатая полоса встала на дорожку дочерней, и предпросмотр с
   * заметкой расходились ровно на то, что здесь объявлено совпадающим
   * (замечание по M1, дефект A40).
   *
   * Поэтому норматив спрашивается, а не называется: то же дерево — значение у
   * корня, ничего у его ребёнка, значение у внука — уезжает в движок, и
   * дорожки сверяются с теми, что нарисовал предпросмотр (У-92).
   */
  const engine = createRequire(import.meta.url)(
    path.join(root, "src", "core", "priority_strip_engine.js")) as Any;
  const specs = engine.buildStripSpecs([
    { lineNo: 1, text: "- #open root" },
    { lineNo: 2, text: "\t- child without a value" },
    { lineNo: 3, text: "\t\t- #shut grandchild" },
  ], {
    tokenSet: new Set(["#open", "#shut"]),
    readRowForToken: (token: string) => ({ fillColor: token === "#open" ? "#111111" : "#222222" }),
    stripesToShow: 3,
  });
  const engineLanes = Array.from(new Set(
    specs.flatMap((spec: Any) => (spec.rails || [])
      .map((rail: Any, lane: number) => (String(rail && rail.color || "").trim() ? String(lane) : ""))
      .filter((x: string) => x !== "")),
  )).sort();

  assert.deepEqual(engineLanes, ["0", "2"],
    "движок ставит полосы на дорожки уровней, дочерняя остаётся пустой: "
    + JSON.stringify(engineLanes));
  assert.deepEqual(engineLanes, lanes,
    "предпросмотр и движок сошлись по дорожкам: предпросмотр "
    + JSON.stringify(lanes) + ", движок " + JSON.stringify(engineLanes));
  ok("норматив спрошен: дорожки движка совпали с дорожками предпросмотра");
  ok("пропущенный уровень не сдвигает дорожку: " + JSON.stringify(lanes));
}

/* ======================================================================
 * Зазор между полосами и слитное дерево в предпросмотре (PRD 10.13.16 Н6).
 *
 * Величина зазора объявлена в двух местах на двух потребителей — отрисовка
 * заметки и этот предпросмотр, — и обязана совпадать (У-32). До 2026-09-03
 * она стояла литералом в обоих; теперь это настройка, и совпадение сторожит
 * проверка, а не память.
 * ====================================================================== */

{
  const gapsWith = (over: Record<string, unknown>): string[] => {
    const host = makeNode("div");
    const close = barsPreview(host as unknown as El, makeCtx(realConfig(), {
      "visual.tagBars.active": true,
      "visual.tagBars.fieldId": "urgency",
      "visual.tagBars.tagVisibility": true,
      "visual.tagBars.stripesToShow": 3,
      ...over,
    }));
    const out = all(host, "io-node--bar").map(n => n.style.getPropertyValue("--io-bar-inset"));
    close();
    return out;
  };

  /* Тумблер выключен: зазор одинаков у всех полос и равен настройке. */
  const off = gapsWith({ "visual.tagBars.lineGap": 5, "visual.tagBars.joinTree": false });
  assert.ok(off.length > 1, "полос для сравнения набралось мало: " + off.length);
  assert.deepEqual(Array.from(new Set(off)), ["5px"],
    "с выключенным тумблером зазор у всех один и из настройки: " + JSON.stringify(off));

  /*
   * Тумблер `Join Bars in a tree` в предпросмотре ничего не меняет, и это
   * утверждение, а не пропуск: здесь полоса рисуется на **поддереве** целиком
   * (П6), рвать её внутри дерева нечему. В заметке полосу рисует каждая
   * строка своей пометкой — там тумблер и работает, и его держат проверки
   * движка и адаптера (`priority_strip_engine_tests.js`).
   */
  const on = gapsWith({ "visual.tagBars.lineGap": 5, "visual.tagBars.joinTree": true });
  assert.deepEqual(on, off,
    "предпросмотр от тумблера не зависит: " + JSON.stringify(on));

  /* Ноль на слайдере: зазора нет нигде, и тумблер тут ничего не меняет. */
  const zero = gapsWith({ "visual.tagBars.lineGap": 0, "visual.tagBars.joinTree": false });
  assert.deepEqual(Array.from(new Set(zero)), ["0px"],
    "ноль означает «полосы стыкуются»: " + JSON.stringify(zero));

  /* Число берётся из настройки, а не из литерала: другое значение — другой
     зазор. Прежний литерал эту проверку не переживёт. */
  const seven = gapsWith({ "visual.tagBars.lineGap": 7, "visual.tagBars.joinTree": false });
  assert.deepEqual(Array.from(new Set(seven)), ["7px"],
    "зазор следует за слайдером: " + JSON.stringify(seven));

  ok("зазор между полосами в предпросмотре считается настройкой");
}

/* ======================================================================
 * Цвет чипа Field — цвет его вида, тот же, что в таблице Fields.
 *
 * Брался цвет первого Value тега, и один и тот же Field выглядел в таблице
 * коричневым, а в предпросмотре — цветом своего первого значения (замечание
 * заказчика C20, 2026-09-02). Ожидание выписано переменными темы отдельно от
 * карты, из которой чип красится (У-5).
 * ====================================================================== */

{
  const cfg = realConfig();
  const host = makeNode("div");
  const close = linePreview(host as unknown as El, makeCtx(cfg));
  const chips = all(host, "io-bubble");
  const colors = Array.from(new Set(chips.map(n => n.style.getPropertyValue("--io-bubble-bg"))));
  close();

  assert.ok(chips.length >= 3, "чипы Fields нарисованы: " + chips.length);
  const allowed = ["var(--io-type-tag)", "var(--io-type-link)", "var(--io-type-element)"];
  const stray = colors.filter(c => !allowed.includes(c));
  assert.deepEqual(stray, [],
    "чип красится только цветом вида: лишние цвета " + JSON.stringify(stray));
  assert.ok(colors.includes("var(--io-type-tag)"), "тег коричневый: " + JSON.stringify(colors));
  assert.ok(colors.includes("var(--io-type-link)"), "ссылка синяя: " + JSON.stringify(colors));
  ok("цвет чипа Field взят из карты видов: " + JSON.stringify(colors));
}

/* ======================================================================
 * 9. Коробка скроллера не гаснет вместе с блоком (B2).
 * ====================================================================== */

{
  /*
   * Прозрачность блока объявлена у контейнера стороны, а коробка скроллера
   * лежала внутри него: CSS `opacity` предка потомком не отменяется, и яркость
   * коробки ехала за настройкой — «в io-tip-wheel-preview яркость scroller
   * ретушируется при изменении opacity» (B2, 2026-09-02).
   *
   * Утверждение про механизм, а не про вид: у коробки не должно быть предка,
   * несущего прозрачность блока. Проверяется подъёмом по дереву — так же, как
   * это делает браузер.
   */
  const cfg = realConfig();
  const host = makeNode("div");
  const close = wheelPreview(host as unknown as El, makeCtx(cfg, {
    "visual.tagWheel.scroller.enabled": true,
    "visual.tagWheel.scroller.size": 1,
    "visual.tagWheel.scroller.direction": "full",
    "visual.tags.opacityLeft": 40,
    "visual.tags.opacityRight": 40,
  }));

  const panels = all(host, "io-wheelpanel");
  assert.ok(panels.length, "коробка скроллера нарисована");

  /* Строка помечена своим классом: по нему CSS и снимает прозрачность. */
  const lines = all(host, "io-line--wheel");
  assert.ok(lines.length, "строка предпросмотра помечена как строка TagWheel");

  /*
   * Сама прозрачность живёт в CSS, и дерево о ней не знает. Поэтому вторая
   * половина утверждения читается из `styles.css`: под классом строки
   * прозрачность снимается со стороны и переносится на чипы. Так же в этом
   * проекте проверяется геометрия таблицы Values — заглушка DOM ничего не
   * раскладывает, но текст правил прочитать не мешает.
   */
  const css = readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(/\.io-line--wheel \.io-line__side--left,[\s\S]{0,120}opacity:\s*1/.test(css),
    "под классом строки TagWheel прозрачность со стороны снята");
  assert.ok(/\.io-line--wheel \.io-line__side--left[\s\S]{0,200}--io-opacity-left/.test(css),
    "и перенесена на чипы этой стороны");
  close();
  ok("B2: коробка скроллера не наследует прозрачность блока");
}

/* ======================================================================
 * 10. Предпросмотр `Source line` не склеен (B13).
 * ====================================================================== */

{
  /*
   * Строка резалась `split(/\s+/)`, и пробелы выбрасывались: куски вставлялись
   * строчными узлами подряд, и весь текст выглядел склеенным
   * («в io-tip-source-preview отсутствуют пробелы», B13, 2026-09-02).
   *
   * Пробел вернулся текстовым узлом, а не зазором flex, ровно затем, чтобы это
   * можно было проверить: текст нарисованной строки обязан совпадать с
   * исходной посимвольно.
   */
  const cfg = realConfig();
  const host = makeNode("div");
  const close = sourcePreview(host as unknown as El, makeCtx(cfg));
  const rows = all(host, "io-srcprev__line");
  assert.ok(rows.length, "половины предпросмотра нарисованы: " + rows.length);
  for (const row of rows) {
    const text = String(row.textContent || "");
    assert.ok(text.includes(" "),
      "в нарисованной строке есть пробелы: " + JSON.stringify(text));
    assert.ok(!/\S{25,}/.test(text),
      "и нет склеенного куска: " + JSON.stringify(text));
  }
  close();
  ok("B13: предпросмотр `Source line` сохраняет пробелы");
}

console.log("\n" + passed + " проверок пройдено");
