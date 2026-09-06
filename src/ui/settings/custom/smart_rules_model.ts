/**
 * Модель Smart Rules (PRD 10.8, фаза 3c).
 *
 * Здесь только чтение конфига и сборка патчей: ни обращения к DOM, ни
 * `Notice`. Так же устроена модель редактора Fields, и по той же причине —
 * вёрстка обязана рисоваться на заглушке (гейт Г16).
 *
 * **Форма правила — движка, а не прототипа.** Прототип держит условия плоским
 * списком `{kind, value, op}` и шаблон в ключе `template`; движок читает три
 * массива в `conditions` и ключ `targetTemplate` (`normalizeSmartRules`,
 * `selectSmartTemplate` в `transform_feature.js`). Пишется то, что читает
 * движок: иначе правило выглядело бы настроенным и не срабатывало (З8).
 * Прототип нормативен по виду и поведению блока, а не по форме своих моков —
 * то же решение, что уже принято для дерева предпросмотра Bars (П13).
 *
 * **Оператора между условиями в конфиге нет.** Внутри одного типа условия
 * соединяются как ИЛИ, между типами — как И, и это свойство самого движка
 * (`selectSmartTemplate`), а не настройка. Чип `and` / `or` в вёрстке —
 * подпись, а не контрол (С-7). Выбор соединения внутри типа — работа фазы 5.
 */

import type { FieldKind } from "../types.ts";
import type { FieldTokens } from "./fields_model.ts";

/** Плагин в том виде, в каком его зовёт блок правил. */
export interface RulesPlugin {
  getConfig: () => unknown;
  setConfigPatch: (patch: unknown, reason: string) => void;
}

/**
 * Виды условия — ровно те, что различает движок.
 *
 * `fields` — «любое значение Field» (10.13.7): в нём лежат **id Fields**, а не
 * токены. Заказчик просил добавлять Field целиком, а не накликивать значения
 * по одному, и разворота в список отдельных условий не будет: значение,
 * добавленное завтра, в такой список не попало бы (замечания 1.6.6.1, 1.4.4.1).
 */
export type RuleKind = "tags" | "emojiFields" | "wikilinks" | "fields";

export const RULE_KINDS: readonly RuleKind[] = ["tags", "emojiFields", "wikilinks", "fields"];

/** Вид условия, у которого есть **своя строка** в карточке правила. */
export type RowKind = Exclude<RuleKind, "fields">;

/**
 * Строки карточки правила. `fields` своей строки не имеет: Field попадает в
 * строку **своего типа** и читается там наравне со значениями, через `or`.
 *
 * Так решил заказчик 2026-09-03. Прежняя отдельная строка `Field` соединялась
 * с остальными через `and` — то есть Field требовался **вместе** с тегом, — а
 * просил он обратное: «вместо того, чтобы накликивать отдельные values `#/1`,
 * `#/2`». Ветка конфига при этом не менялась: условие по-прежнему лежит в
 * `conditions.fields` и хранит id Field (З1).
 */
export const ROW_KINDS: readonly RowKind[] = ["tags", "emojiFields", "wikilinks"];

/** Какой тип Field даёт значения этому виду условия. */
const KIND_OF_FIELD: Record<RowKind, FieldKind> = {
  tags: "tag",
  emojiFields: "element",
  wikilinks: "wikilink",
};

/** Обратная карта: в какой строке стоит Field этого типа. */
const ROW_OF_FIELD_KIND: Record<string, RowKind> = {
  tag: "tags",
  element: "emojiFields",
  wikilink: "wikilinks",
};

/** Как выбирается папка новой заметки у правила (10.13.8). */
export type RuleFolderMode = "default" | "near" | "folder";

/** Одно правило так, как его читает вёрстка. */
export interface RuleRow {
  id: string;
  /** Имя от человека; пусто — вёрстка показывает `Rule N` (С-3). */
  name: string;
  enabled: boolean;
  /** Шаблон новой заметки; пусто — правило ничего не выбирает. */
  targetTemplate: string;
  /** Папка новой заметки: своя у правила или общая (10.13.8). */
  folderMode: RuleFolderMode;
  /** Путь своей папки; значим только при `folder`. */
  folder: string;
  conditions: Record<RuleKind, string[]>;
  /** Разбор движка: правило спорит с другим или осталось без условий. */
  conflict: string;
}

export interface RulesModelDeps {
  plugin: RulesPlugin;
  /**
   * Разбор правил движком: `validateSmartRules` из `transform_feature.js`.
   * Приходит снаружи, а не импортом, по той же причине, что и остальное, —
   * блок не должен зависеть от того, как загружен движок.
   */
  validate: (rules: unknown[]) => unknown[];
  /** Значения Fields для условий: то же чтение, что у редактора. */
  fieldTokens: () => readonly FieldTokens[];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice() : [];
}

function strings(value: unknown): string[] {
  const out: string[] = [];
  for (const raw of asArray(value)) {
    const v = String(raw || "").trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** `default` | `near` | `folder`; всё незнакомое — `default` (10.13.8 Н2). */
function normalizeFolderMode(raw: unknown): RuleFolderMode {
  const v = String(raw || "").trim().toLowerCase();
  return v === "near" || v === "folder" ? v : "default";
}

function inline2note(cfg: unknown): Record<string, unknown> {
  return asObject(asObject(asObject(cfg)["transform"])["inline2note"]);
}

export function createRulesModel(deps: RulesModelDeps) {
  const { plugin, validate, fieldTokens } = deps;

  const rawRules = (): unknown[] => asArray(inline2note(plugin.getConfig())["smartRules"]);

  /**
   * Правила для вёрстки. Спор правил считает движок — та же
   * `validateSmartRules`, которой он пользуется сам: второй разбор разошёлся
   * бы с ним на первой же правке (П9 по смыслу).
   */
  const listRules = (): RuleRow[] => {
    const raw = rawRules();
    const checked = validate(raw);
    return raw.map((rawRule, i) => {
      const r = asObject(rawRule);
      const conditions = asObject(r["conditions"]);
      const validation = asObject(asObject(checked[i])["validation"]);
      return {
        id: String(r["id"] || "rule-" + (i + 1)).trim() || "rule-" + (i + 1),
        name: String(r["name"] || "").trim(),
        /*
         * Состояние берётся у ХРАНИМОГО правила, а разбор — у проверенного.
         * Разделение не формальность: `validateSmartRules` выключает правило,
         * которое спорит с соседом или осталось без условий, и это его вывод,
         * а не выбор человека. Пока эти два состояния были одним, любая правка
         * записывала вывод движка обратно в конфиг — и простое перетаскивание
         * молча выключало спорные правила навсегда. Найдено проверкой
         * 2026-08-29.
         */
        enabled: r["enabled"] !== false,
        targetTemplate: String(r["targetTemplate"] || "").trim(),
        folderMode: normalizeFolderMode(r["targetFolderMode"]),
        folder: String(r["targetFolder"] || "").trim(),
        conditions: {
          tags: strings(conditions["tags"]),
          emojiFields: strings(conditions["emojiFields"]),
          wikilinks: strings(conditions["wikilinks"]),
          fields: strings(conditions["fields"]),
        },
        conflict: validation["isConflict"] ? String(validation["message"] || "").trim() : "",
      };
    });
  };

  /**
   * Что можно выбрать условием этого вида: Field и его значения (С-5).
   * Fields без значений в списке остаются — у них просто нечего выбрать, и
   * это видно, а не скрыто.
   */
  const choicesFor = (kind: RuleKind): Array<{ label: string; fieldId?: string; values: string[] }> => {
    /*
     * Своего окна у «любого значения Field» нет: Field выбирается нажатием на
     * его имя в окне своей строки (10.13.14). Отдельная ветка здесь была
     * нужна прежней строке `Field`, и вместе с ней ушла.
     */
    if (kind === "fields") return [];
    const want = KIND_OF_FIELD[kind];
    /*
     * `fieldId` у группы — чтобы имя Field в окне выбора можно было нажать и
     * завести условие «любое значение этого Field» (10.13.14, замечание
     * заказчика B14 от 2026-09-02). Раньше имя было только подписью, и
     * завести Field целиком можно было лишь через отдельную строку `Field`.
     */
    return fieldTokens()
      .filter(f => f.kind === want)
      .map(f => ({ label: f.label, fieldId: f.key, values: f.tokens.slice() }));
  };

  /** Имя Field по его id: условие хранит id, а человек знает имя. */
  const fieldLabel = (key: string): string => {
    const hit = fieldTokens().find(f => f.key === key);
    return hit ? hit.label || hit.key : key;
  };

  /**
   * В какой строке карточки стоит условие «любое значение этого Field».
   *
   * Тип Field спрашивается у того же чтения, которым живут значения, — второй
   * разбор того же формата разошёлся бы с первым (У-32). Field, которого в
   * конфиге больше нет, строки не получает: показывать его негде, и молча
   * блокировать правило он тоже не должен.
   */
  const fieldRowKind = (key: string): RowKind | null => {
    const hit = fieldTokens().find(f => f.key === key);
    const row = hit ? ROW_OF_FIELD_KIND[String(hit.kind)] : undefined;
    return row || null;
  };

  /* ---- записи ----------------------------------------------------------- */

  /**
   * Запись правил целиком. Массив пишется целиком намеренно: `deepMerge`
   * сливает объекты, а массив заменяет, и частичный патч правила оставил бы
   * от удалённого условия хвост.
   */
  const save = (rules: RuleRow[], reason: string): void => {
    const out = rules.map(r => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      targetTemplate: r.targetTemplate,
      targetFolderMode: r.folderMode,
      targetFolder: r.folder,
      conditions: {
        tags: r.conditions.tags.slice(),
        emojiFields: r.conditions.emojiFields.slice(),
        wikilinks: r.conditions.wikilinks.slice(),
        fields: r.conditions.fields.slice(),
      },
    }));
    plugin.setConfigPatch({ transform: { inline2note: { smartRules: out } } }, reason);
  };

  /** Следующий свободный id: правила ссылаются на него в разборе спора. */
  const nextId = (rules: readonly RuleRow[]): string => {
    let n = rules.length + 1;
    const taken = new Set(rules.map(r => r.id));
    while (taken.has("rule-" + n)) n++;
    return "rule-" + n;
  };

  const addRule = (): void => {
    const rules = listRules();
    rules.push({
      id: nextId(rules),
      name: "",
      enabled: true,
      targetTemplate: "",
      folderMode: "default",
      folder: "",
      conditions: { tags: [], emojiFields: [], wikilinks: [], fields: [] },
      conflict: "",
    });
    save(rules, "transform:smart-rules:add");
  };

  const removeRule = (id: string): void => {
    save(listRules().filter(r => r.id !== id), "transform:smart-rules:remove:" + id);
  };

  /** Правка одного правила: остальные переписываются как есть. */
  const patchRule = (id: string, patch: Partial<RuleRow>, reason: string): void => {
    const rules = listRules().map(r => (r.id === id ? { ...r, ...patch } : r));
    save(rules, reason);
  };

  const setName = (id: string, name: string): void => {
    patchRule(id, { name: String(name || "").trim() }, "transform:smart-rules:name:" + id);
  };

  const setEnabled = (id: string, enabled: boolean): void => {
    patchRule(id, { enabled }, "transform:smart-rules:enabled:" + id);
  };

  const setTemplate = (id: string, template: string): void => {
    patchRule(id, { targetTemplate: String(template || "").trim() },
      "transform:smart-rules:template:" + id);
  };

  const addCondition = (id: string, kind: RuleKind, value: string): void => {
    const v = String(value || "").trim();
    if (!v) return;
    const rules = listRules().map(r => {
      if (r.id !== id || r.conditions[kind].includes(v)) return r;
      const conditions = { ...r.conditions, [kind]: r.conditions[kind].concat(v) };
      /*
       * Состояние правила не трогается. Раньше здесь стояла починка «первое
       * условие включает правило обратно»: новое правило рождается пустым,
       * движок его тут же выключал, и оно оставалось выключенным навсегда.
       * Причина была не тут, а в том, что панель записывала вывод движка в
       * конфиг; починка сделана в `listRules`, и подпорка больше не нужна.
       */
      return { ...r, conditions };
    });
    save(rules, "transform:smart-rules:condition-add:" + id);
  };

  const removeCondition = (id: string, kind: RuleKind, value: string): void => {
    const rules = listRules().map(r => {
      if (r.id !== id) return r;
      const conditions = { ...r.conditions, [kind]: r.conditions[kind].filter(v => v !== value) };
      return { ...r, conditions };
    });
    save(rules, "transform:smart-rules:condition-remove:" + id);
  };

  /**
   * Папка новой заметки у правила (10.13.8). Режим и путь пишутся вместе:
   * путь без режима `folder` ничего не значит, а режим без пути — значит.
   */
  const setFolder = (id: string, mode: RuleFolderMode, folder: string): void => {
    const rules = listRules().map(r => (r.id === id
      ? { ...r, folderMode: mode, folder: mode === "folder" ? String(folder || "").trim() : "" }
      : r));
    save(rules, "transform:smart-rules:folder:" + id);
  };

  /**
   * Перенос правила. Порядок значим — правила читаются сверху вниз, и
   * срабатывает первое подходящее (С-6), — поэтому это настройка, а не вид.
   */
  const moveRule = (from: number, to: number): void => {
    const rules = listRules();
    if (from < 0 || from >= rules.length || to < 0 || to >= rules.length || from === to) return;
    const moved = rules.splice(from, 1)[0];
    if (!moved) return;
    rules.splice(to, 0, moved);
    save(rules, "transform:smart-rules:move");
  };

  return {
    listRules,
    choicesFor,
    addRule,
    removeRule,
    setName,
    setEnabled,
    setTemplate,
    setFolder,
    fieldLabel,
    fieldRowKind,
    addCondition,
    removeCondition,
    moveRule,
  };
}

export type RulesModel = ReturnType<typeof createRulesModel>;
