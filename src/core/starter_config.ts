/**
 * Стартовый набор Fields свежей установки (PRD ПЗ1).
 *
 * **Зачем.** Без единого Field таблица Fields пуста, TagWheel открывать нечего,
 * а предпросмотры показывают выдуманный пример и честно помечают его примером
 * (`EXAMPLE_FIELDS` в `custom/preview_data.ts`). Человек видит два разных
 * экрана — на одном `Status` и `Priority`, на другом пустота — и не понимает,
 * что плагин делает. Заказчик назвал это дефектом 2026-09-05; требование
 * лежало в PRD с самого начала и исполнения не имело.
 *
 * **Когда ставится.** Ровно один раз: когда файла настроек не было вовсе
 * (`state === "absent"` у `loadConfig`). Не при нечитаемом файле — там у
 * человека настройки были, и подсовывать ему чужие поверх аварии нельзя.
 *
 * **Почему не в `DEFAULT_CONFIG`.** `Delete all my settings` пишет пустой
 * конфиг и берёт умолчания оттуда (`actions.ts`, `reset-settings`). Лежи набор
 * в умолчаниях — сброс возвращал бы его, а заказчик просил обратного: набор
 * есть только при первой установке. Здесь это выходит само, второго правила
 * заводить не пришлось.
 *
 * **Форма не выдумана.** Все ключи сняты с настоящего конфига заказчика:
 * определения тегов лежат в `pkm.fields.tags`, ссылок и элементов — в
 * `pkm.fields.links` (имена веток — по типу Field, не по стороне строки),
 * стороны и подписи — в `pkm.fields.order`, цвета Values — в
 * `visual.tags.byTag`, где ключ значения идёт **с решёткой**, а в определении
 * Field тот же токен лежит без неё.
 *
 * **Цвета — литералами, и это не нарушение З6.** Поле выбора цвета принимает
 * только `#rrggbb` (У-60): переменная темы в значение не влезает. Пары
 * проверены `contrastRatio` из `custom/contrast.ts` — от 3.3:1 до 5.4:1 при
 * пороге `CONTRAST_FLOOR` 3:1.
 */

/** Ветка конфига произвольной формы: та же, что у модуля миграции. */
type Dict = Record<string, unknown>;

/** Маркер Field `Due`. Он же ключ элемента и он же то, что видно в строке. */
const DUE_MARKER = "\u{1F4C5}";

/**
 * Значение Field-тега: токен без решётки и пара цветов к нему.
 *
 * Цвет текста задан у каждого значения, а не оставлен теме: пузырь красится
 * своим фоном, и в светлой теме тёмный текст темы на этом фоне пропадает.
 */
interface StarterTagValue {
  token: string;
  fill: string;
  text: string;
}

const STATUS_VALUES: readonly StarterTagValue[] = [
  { token: "todo", fill: "#3b6fd4", text: "#ffffff" },
  { token: "doing", fill: "#c77b26", text: "#ffffff" },
  { token: "done", fill: "#2f8a4c", text: "#ffffff" },
];

const PRIORITY_VALUES: readonly StarterTagValue[] = [
  { token: "low", fill: "#6b7280", text: "#ffffff" },
  { token: "med", fill: "#b07d10", text: "#ffffff" },
  { token: "high", fill: "#c0392b", text: "#ffffff" },
];

/**
 * Значения Field-ссылки. Заметок с такими именами в свежем vault нет, и
 * ссылки поначалу будут несуществующими — выбор заказчика 2026-09-05: он
 * предпочёл, чтобы сразу было видно, что Field делает и как ссылка выглядит
 * в строке.
 */
const PROJECT_VALUES: readonly string[] = ["Project A", "Project B"];

/** Ключи стартовых Fields в том порядке, в каком они встают в строку. */
export const STARTER_LEFT_BLOCK: readonly string[] = ["Status", "Priority"];
export const STARTER_RIGHT_BLOCK: readonly string[] = ["Due", "Project"];

/** Определение Field-тега: три значения плюс пустой список подзначений. */
function tagField(id: string, values: readonly StarterTagValue[]): Dict {
  return {
    id,
    prefix: "#",
    placeholder: id,
    values: values.map(v => ({ token: v.token, subtags: [], active: true })),
    yamlValueRule: "raw",
  };
}

/**
 * Дочерний Field тега. Заводится выключенным и неактивным — ровно так же, как
 * его заводит кнопка `Add a Field` в панели (`addField` в `fields_model.ts`):
 * без него у родителя нет места, куда положить подзначение.
 */
function subField(parentId: string): Dict {
  return {
    id: `${parentId}_sub`,
    prefix: "#",
    enabled: false,
    dependsOn: parentId,
    disabledForParentValues: [],
    placeholder: "sub",
    values: [],
  };
}

/** Карта цветов одного Field: ключ значения идёт с решёткой. */
function colorsOf(values: readonly StarterTagValue[]): Dict {
  const out: Dict = {};
  for (const v of values) {
    out["#" + v.token] = {
      fillColor: v.fill,
      textColor: v.text,
      visibility: "default",
      customText: "",
    };
  }
  return out;
}

/** Ветка `pkm.fields.order`: стороны, типы, подписи и признаки каждого ключа. */
function starterOrder(): Dict {
  return {
    left: STARTER_LEFT_BLOCK.slice(),
    right: STARTER_RIGHT_BLOCK.slice(),
    lead: {},
    active: {
      Status: "yes", Status_sub: "no",
      Priority: "yes", Priority_sub: "no",
      Due: "yes", Project: "yes",
    },
    freeRoam: {
      Status: "off", Status_sub: "off",
      Priority: "off", Priority_sub: "off",
      Due: "off", Project: "off",
    },
    enabled: {
      Status: true, Status_sub: false,
      Priority: true, Priority_sub: false,
      Due: true, Project: true,
    },
    types: {
      Status: "tag", Status_sub: "tag",
      Priority: "tag", Priority_sub: "tag",
      Due: "element", Project: "wikilink",
    },
    /* Подпись для TagWheel. Дочернему Field её не пишут: своё короткое имя он
       выводит из родителя (`shortNameFor` в `pkm_rules_runtime_helpers.js`). */
    labels: { Status: "Status", Priority: "Priority", Due: "Due", Project: "Project" },
    strictNames: {
      Status: "Status", Status_sub: "Status_sub",
      Priority: "Priority", Priority_sub: "Priority_sub",
      Due: "Due", Project: "Project",
    },
    propertiesByField: {},
  };
}

/**
 * Стартовый набор одной веткой конфига версии 2.
 *
 * Отдаётся новым объектом на каждый вызов: конфиг после этого правится
 * панелью, и общая на всех константа разъехалась бы с тем, что лежит на диске.
 */
export function starterConfigPatch(): Dict {
  return {
    pkm: {
      fields: {
        order: starterOrder(),
        tags: {
          fields: [
            tagField("Status", STATUS_VALUES),
            subField("Status"),
            tagField("Priority", PRIORITY_VALUES),
            subField("Priority"),
          ],
        },
        links: {
          fields: [
            {
              id: "Due",
              kind: "genericElement",
              marker: DUE_MARKER,
              placeholder: "Due",
              values: [""],
              yamlValueRule: "clean",
            },
            {
              id: "Project",
              prefix: "#",
              source: "wikilinks:Project",
              placeholder: "Project",
              values: PROJECT_VALUES.map(token => ({
                token,
                allowedParentValues: [],
                __ioParentBinding: "",
                __ioParentFieldId: "",
                active: true,
              })),
              yamlValueRule: "raw",
            },
          ],
        },
        elements: {
          fields: ["Due"],
          byField: {
            Due: {
              emoji: DUE_MARKER,
              format: "YYYY-MM-DD",
              increment: {
                mode: "standard",
                incrementBy: 1,
                command: "now",
                customRaw: [],
                custom: [],
              },
            },
          },
        },
      },
    },
    visual: {
      tags: {
        byTag: {
          Status: colorsOf(STATUS_VALUES),
          Priority: colorsOf(PRIORITY_VALUES),
        },
      },
    },
  };
}

/** Есть ли в конфиге хоть один Field. Пусто — набор ещё не ставили. */
function hasAnyField(cfg: Dict): boolean {
  const pkm = cfg["pkm"];
  const fields = pkm && typeof pkm === "object" ? (pkm as Dict)["fields"] : null;
  const order = fields && typeof fields === "object" ? (fields as Dict)["order"] : null;
  if (!order || typeof order !== "object") return false;
  const o = order as Dict;
  const left = Array.isArray(o["left"]) ? (o["left"] as unknown[]) : [];
  const right = Array.isArray(o["right"]) ? (o["right"] as unknown[]) : [];
  return left.length > 0 || right.length > 0;
}

/**
 * Положить стартовый набор в конфиг.
 *
 * Возвращает `true`, если положили. Конфиг с Fields не трогается: сюда можно
 * прийти только с пустым, но проверка стоит здесь, а не у зовущего, — это
 * единственное место, где условие «набора ещё нет» имеет смысл.
 */
export function applyStarterSet(cfg: Dict): boolean {
  if (!cfg || typeof cfg !== "object") return false;
  if (hasAnyField(cfg)) return false;
  const patch = starterConfigPatch();
  mergeInto(cfg, patch);
  return true;
}

/**
 * Слияние ветки в конфиг: объекты сливаются, всё остальное заменяется.
 *
 * Своё, а не `deepMerge` из `main.js`: у модуля миграции обращений к `main.js`
 * нет и быть не должно — он гоняется в проверках без Obsidian.
 */
function mergeInto(target: Dict, patch: Dict): void {
  for (const key of Object.keys(patch)) {
    const next = patch[key];
    const cur = target[key];
    if (next && typeof next === "object" && !Array.isArray(next)
      && cur && typeof cur === "object" && !Array.isArray(cur)) {
      mergeInto(cur as Dict, next as Dict);
    } else {
      target[key] = next;
    }
  }
}
