/**
 * Шкала ползунка против клампа нормализации — **сплошным обходом схемы**.
 *
 * **Зачем.** Границы шкалы объявлены дважды и в разных домах: `min`/`max` — в
 * прототипе, откуда выводится схема, а кламп — в `normalizeConfigV2`
 * (`src/core/config_normalize.js`). Разойдись они, и человек получает контрол,
 * который двигается, а значение не сохраняется: ползунок сползает обратно при
 * следующем открытии панели. Это ровно то, что запрещает З8, и молчит это
 * тише всего — панель показывает то, что он выбрал, до первой перерисовки.
 *
 * Ловится это только обходом: 2026-09-09 заказчик попросил опустить нижние
 * границы четырёх ползунков вида, и клампы стояли **в трёх местах** —
 * нормализация, `getTagVisualsFromConfig` и `computeTagVisualStyle`. Список
 * имён тут не годится: настройка заводится в прототипе, а дописывать список
 * будет тот, кто вспомнит (У-111, У-85).
 *
 * **Оракул — настоящая `migrateConfig`** (У-4), а не копия правила здесь: у
 * значения один путь записи, и спрашивать надо его.
 *
 * У проверки два конца, и второй важнее:
 *
 *   1. **края шкалы доезжают** — значение, равное `min` и равное `max`,
 *      переживает запись без изменений;
 *   2. **и кламп при этом существует** — значение за шкалой прижимается. Без
 *      второго первый был бы зелен и у настройки, которую нормализация не
 *      трогает вовсе, то есть проверял бы отсутствие предмета (У-88).
 */

import assert from "node:assert/strict";
import { loadPluginInternals } from "../harness/plugin_internals.ts";
import { SCHEMA } from "../../src/ui/settings/schema/index.ts";
import { getIn, isBound, setIn } from "../../src/ui/settings/types.ts";

type Any = ReturnType<typeof JSON.parse>;

const internals = loadPluginInternals();

interface SliderDef {
  id: string;
  path: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /**
   * `invert` — шов между тем, что человек видит, и тем, что лежит в конфиге:
   * `Opacity of transformed line` показывает «насколько погасить», а хранит
   * «сколько осталось». Значит края **хранимой** шкалы — это `invert - max` и
   * `invert - min`, и проверять надо их: проверка, взявшая `min`/`max` как
   * есть, спрашивала бы про значения, которых панель не выдаёт, и молчала бы
   * про те, которые выдаёт.
   */
  invert: number;
}

function sliders(): SliderDef[] {
  const out: SliderDef[] = [];
  for (const group of SCHEMA) {
    for (const item of group.items) {
      if (!isBound(item)) continue;
      const it = item as Any;
      if (it.kind !== "slider") continue;
      out.push({
        id: String(it.id),
        path: String(it.path),
        min: Number(it.min),
        max: Number(it.max),
        step: Number(it.step),
        default: Number(it.default),
        invert: Number.isFinite(Number(it.invert)) ? Number(it.invert) : 0,
      });
    }
  }
  return out;
}

/** Один патч конфига версии 2 через настоящий путь записи. */
function writeThrough(path: string, value: number): unknown {
  const cfg: Record<string, unknown> = { schemaVersion: 2 };
  setIn(cfg, path, value);
  return getIn(internals.migrateConfig(cfg) as Any, path);
}

const problems: string[] = [];
function bad(msg: string): void { problems.push(msg); }

const all = sliders();
/* У-110: обход обязан что-то обойти. Число не сверяется с литералом — оно
   меняется от каждой новой настройки, — но пустой обход это не проверка. */
assert.ok(all.length >= 20, `ползунков в схеме ${all.length}, а их два десятка — обход ничего не нашёл`);

let clamped = 0;
for (const s of all) {
  if (!Number.isFinite(s.min) || !Number.isFinite(s.max)) {
    bad(`${s.id}: у ползунка нет границ шкалы (${s.min}…${s.max})`);
    continue;
  }
  if (!(s.default >= s.min && s.default <= s.max)) {
    bad(`${s.id}: умолчание ${s.default} вне своей шкалы ${s.min}…${s.max}`);
  }

  /* Края **хранимой** шкалы: у инвертированного ползунка они переставлены. */
  const a = s.invert ? s.invert - s.max : s.min;
  const b = s.invert ? s.invert - s.min : s.max;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);

  /* 1. Края шкалы доезжают до конфига без изменений. */
  for (const edge of [lo, hi]) {
    const got = writeThrough(s.path, edge);
    if (got !== edge) {
      bad(`${s.id} (${s.path}): край шкалы ${edge} записался как ${String(got)}`
        + " — панель даёт выбрать то, чего нормализация не пускает");
    }
  }

  /*
   * 2. И кламп существует: значение за шкалой прижимается. Берётся заведомо
   * далёкое число, а не `hi + step`: у части путей кламп идёт по перечислению
   * или по своей нормализации, и шаг за краем бывает законным.
   *
   * **Равенства кламп = шкала тут нет нарочно.** Кламп шире шкалы человеку не
   * виден: панель такого значения не выдаёт, а рукописный `data.json` — это
   * его собственная правка мимо панели. Требовать равенство значило бы гонять
   * правки, у которых на экране нет последствий.
   */
  const far = hi + Math.max(1000, (hi - lo) * 10);
  const got = writeThrough(s.path, far);
  if (got === far) {
    bad(`${s.id} (${s.path}): значение ${far} записалось как есть`
      + " — у шкалы нет клампа, и рукописный `data.json` уедет за неё");
  } else {
    clamped += 1;
  }
}

if (problems.length) {
  for (const p of problems) console.error("  " + p);
  assert.fail(`шкала и кламп расходятся у ${problems.length} ползунк(ов) из ${all.length}`);
}

console.log(`Slider bounds tests: OK (ползунков ${all.length}, с клампом ${clamped})`);
