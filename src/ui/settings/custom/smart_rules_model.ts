/**
 * Модель Smart Rules (PRD 10.8, фаза 3c): чтение конфига и патчи, без DOM и
 * `Notice` (гейт Г16). Форма правила — движка (`conditions` из трёх массивов,
 * `targetTemplate`; `normalizeSmartRules`, `selectSmartTemplate`), не моков
 * прототипа (З8, П13). Оператора в конфиге нет: внутри типа ИЛИ, между
 * типами И — свойство движка; чип `and`/`or` — подпись (С-7).
 */

import { asObject, asArray } from "../types.ts";
import type { FieldKind } from "../types.ts";
import type { FieldTokens } from "./fields_model.ts";

/** Плагин в том виде, в каком его зовёт блок правил. */
export interface RulesPlugin {
  getConfig: () => unknown;
  setConfigPatch: (patch: unknown, reason: string) => void;
}

/**
 * Виды условия — те, что различает движок. `fields` (10.13.7) хранит id Fields,
 * не токены: Field целиком, без разворота в значения (1.6.6.1, 1.4.4.1).
 */
export type RuleKind = "tags" | "emojiFields" | "wikilinks" | "fields";

export const RULE_KINDS: readonly RuleKind[] = ["tags", "emojiFields", "wikilinks", "fields"];

/** Вид условия, у которого есть **своя строка** в карточке правила. */
export type RowKind = Exclude<RuleKind, "fields">;

/**
 * Строки карточки. У `fields` своей строки нет: Field стоит в строке своего
 * типа через `or` (2026-09-03); в конфиге — `conditions.fields` с id (З1).
 * Выводится из `RULE_KINDS` (У-111); `KIND_OF_FIELD` как `Record<RowKind, …>`
 * требует описать новый вид.
 */
export const ROW_KINDS: readonly RowKind[] =
  RULE_KINDS.filter((kind): kind is RowKind => kind !== "fields");

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

/**
 * Своя ветка `Note content` у правила (З-5). `default` — как в `Note content`,
 * ветка при этом хранится. Умолчаний здесь нет: их знает движок
 * (`DEFAULT_INLINE2NOTE.placement`), `normalizeSmartRules` идёт в `migrateConfig` (У-32).
 */
export type RulePlacementMode = "default" | "custom";

/** Значения ветки. Все строками: список схемы хранит строки, и уровень тоже. */
export interface RulePlacement {
  position: string;
  targetHeader: string;
  fallback: string;
  headerMode: string;
  headerLevel: string;
  customHeader: string;
  datetimeFormat: string;
}

export const EMPTY_PLACEMENT: RulePlacement = {
  position: "",
  targetHeader: "",
  fallback: "",
  headerMode: "",
  headerLevel: "",
  customHeader: "",
  datetimeFormat: "",
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
  /** Своя ветка `Note content` или общая (З-5). */
  placementMode: RulePlacementMode;
  /** Значения своей ветки; значимы только при `custom`. */
  placement: RulePlacement;
  conditions: Record<RuleKind, string[]>;
  /** Разбор движка: правило спорит с другим или осталось без условий. */
  conflict: string;
  /** С кем спорит правило: номера соседей в списке. Пусто при споре — условий нет (C16). */
  conflictWith: number[];
}

export interface RulesModelDeps {
  plugin: RulesPlugin;
  /** Разбор правил движком (`validateSmartRules`), снаружи: блок не зависит от загрузки движка. */
  validate: (rules: unknown[]) => unknown[];
  /** Значения Fields для условий: то же чтение, что у редактора. */
  fieldTokens: () => readonly FieldTokens[];
  /** Ветка `placement`, которой никто не касался: `normalizePlacement({})` движка (C21). */
  blankPlacement?: () => unknown;
}



function uniqueStrings(value: unknown): string[] {
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

/** Ветка правила как есть: пустое поле значит «движок ещё не нормализовал». */
function readPlacement(raw: unknown): RulePlacement {
  const p = asObject(raw);
  const text = (key: string): string => String(p[key] == null ? "" : p[key]).trim();
  return {
    position: text("position"),
    targetHeader: text("targetHeader"),
    fallback: text("fallback"),
    headerMode: text("headerMode"),
    headerLevel: text("headerLevel"),
    customHeader: text("customHeader"),
    datetimeFormat: text("datetimeFormat"),
  };
}

function inline2note(cfg: unknown): Record<string, unknown> {
  return asObject(asObject(asObject(cfg)["transform"])["inline2note"]);
}

export function createRulesModel(deps: RulesModelDeps) {
  const { plugin, validate, fieldTokens } = deps;

  const rawRules = (): unknown[] => asArray(inline2note(plugin.getConfig())["smartRules"]);

  /** Правила для вёрстки; спор считает `validateSmartRules` движка (П9). */
  const listRules = (): RuleRow[] => {
    const raw = rawRules();
    const checked = validate(raw);
    const ids = raw.map((rawRule, i) => String(asObject(rawRule)["id"] || "rule-" + (i + 1)).trim() || "rule-" + (i + 1));
    return raw.map((rawRule, i) => {
      const r = asObject(rawRule);
      const conditions = asObject(r["conditions"]);
      const validation = asObject(asObject(checked[i])["validation"]);
      return {
        id: String(r["id"] || "rule-" + (i + 1)).trim() || "rule-" + (i + 1),
        name: String(r["name"] || "").trim(),
        /*
         * Состояние — у ХРАНИМОГО правила, разбор — у проверенного: `validateSmartRules`
         * выключает спорные правила, и запись его вывода в конфиг выключала бы их
         * навсегда (2026-08-29).
         */
        enabled: r["enabled"] !== false,
        targetTemplate: String(r["targetTemplate"] || "").trim(),
        folderMode: normalizeFolderMode(r["targetFolderMode"]),
        folder: String(r["targetFolder"] || "").trim(),
        placementMode: String(r["placementMode"] || "").trim().toLowerCase() === "custom" ? "custom" : "default",
        placement: readPlacement(r["placement"]),
        conditions: {
          tags: uniqueStrings(conditions["tags"]),
          emojiFields: uniqueStrings(conditions["emojiFields"]),
          wikilinks: uniqueStrings(conditions["wikilinks"]),
          fields: uniqueStrings(conditions["fields"]),
        },
        conflict: validation["isConflict"] ? String(validation["message"] || "").trim() : "",
        conflictWith: validation["isConflict"]
          ? [...new Set(asArray(validation["details"]).map(d => ids.indexOf(String(asObject(d)["peerRuleId"] || ""))))]
            .filter(n => n >= 0)
          : [],
      };
    });
  };

  /** Что можно выбрать условием: Field и его значения (С-5); Fields без значений остаются видны. */
  const choicesFor = (kind: RuleKind): Array<{ label: string; fieldId?: string; values: string[] }> => {
    /* Своего окна у «любого значения Field» нет: Field выбирается по имени в окне строки (10.13.14). */
    if (kind === "fields") return [];
    const want = KIND_OF_FIELD[kind];
    /* `fieldId` у группы — имя Field в окне нажимается как условие «любое значение» (10.13.14, B14). */
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
   * Строка карточки для условия «любое значение Field»; тип — тем же чтением (У-32).
   * Удалённый Field строки не получает и правило не блокирует.
   */
  const fieldRowKind = (key: string): RowKind | null => {
    const hit = fieldTokens().find(f => f.key === key);
    const row = hit ? ROW_OF_FIELD_KIND[String(hit.kind)] : undefined;
    return row || null;
  };

  /* ---- записи ----------------------------------------------------------- */

  /** Запись правил целиком: `deepMerge` массив заменяет, частичный патч оставил бы хвост. */
  const save = (rules: RuleRow[], reason: string): void => {
    const out = rules.map(r => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      targetTemplate: r.targetTemplate,
      targetFolderMode: r.folderMode,
      targetFolder: r.folder,
      placementMode: r.placementMode,
      placement: { ...r.placement },
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

  /** Отдаёт id заведённого правила: вёрстка разворачивает именно его (З-6). */
  const addRule = (): string => {
    const rules = listRules();
    const id = nextId(rules);
    rules.push({
      id,
      name: "",
      enabled: true,
      targetTemplate: "",
      folderMode: "default",
      folder: "",
      /* Новое правило ведёт себя как `Note content`. */
      placementMode: "default",
      placement: { ...EMPTY_PLACEMENT },
      conditions: { tags: [], emojiFields: [], wikilinks: [], fields: [] },
      conflict: "",
      conflictWith: [],
    });
    save(rules, "transform:smart-rules:add");
    return id;
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
      /* Состояние правила не трогается: починка — в `listRules`. */
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

  /** Папка новой заметки (10.13.8): режим и путь пишутся вместе. */
  const setFolder = (id: string, mode: RuleFolderMode, folder: string): void => {
    const rules = listRules().map(r => (r.id === id
      ? { ...r, folderMode: mode, folder: mode === "folder" ? String(folder || "").trim() : "" }
      : r));
    save(rules, "transform:smart-rules:folder:" + id);
  };

  /** Своя ветка `Note content` (З-5). Режим и значения пишутся врозь: переключение не стирает ветку. */
  const setPlacementMode = (id: string, mode: RulePlacementMode): void => {
    /* Нетронутая ветка открывается значениями `Note content`, не умолчаниями (BUGHUNT 2026-09-30, C21). */
    const rule = listRules().find(r => r.id === id);
    const blank = deps.blankPlacement ? readPlacement(deps.blankPlacement()) : null;
    const untouched = !!rule && !!blank && JSON.stringify(rule.placement) === JSON.stringify(blank);
    const patch: Partial<RuleRow> = { placementMode: mode };
    if (mode === "custom" && untouched) patch.placement = readPlacement(inline2note(plugin.getConfig())["placement"]);
    patchRule(id, patch, "transform:smart-rules:placement-mode:" + id);
  };

  const setPlacement = (id: string, patch: Partial<RulePlacement>): void => {
    const rules = listRules().map(r => (r.id === id
      ? { ...r, placement: { ...r.placement, ...patch } }
      : r));
    save(rules, "transform:smart-rules:placement:" + id);
  };

  /** Перенос правила: срабатывает первое подходящее сверху (С-6), порядок — настройка. */
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
    setPlacementMode,
    setPlacement,
    fieldLabel,
    fieldRowKind,
    addCondition,
    removeCondition,
    moveRule,
  };
}

export type RulesModel = ReturnType<typeof createRulesModel>;
