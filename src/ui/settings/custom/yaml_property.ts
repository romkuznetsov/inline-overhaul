/**
 * Раздел `YAML property` правой колонки редактора Fields (PRD 10.9): подсказка
 * имён свойств из vault (Я4), пример записи и его вычисление. Не в
 * `fields_editor_view.ts`: пример зовёт движок, а вёрстку рисует заглушка Г16.
 * Пример считает движок (Я1, П9): `parseInlineLine` → `buildTransformContext` →
 * `buildYamlMapFromContext` → `renderYamlBlockWithOrder`. Отсюда кавычки
 * (`status: "#todo"` — иначе `#` в YAML комментарий) и форма «значение/список».
 * Строка примера без Separator: каждое совпадение получает сторону `any`, и Field
 * не выпадает из-за своего Block (ловушка `leftMode` / `rightMode`).
 */

import { btn, el, textInput, type El } from "./dom.ts";
import { BLOCK_TEXTS } from "../texts_blocks.ts";
import type { YamlFieldRow } from "./fields_model.ts";

/* Движок `Inline to note` — тот же модуль, не второй экземпляр (У-89). */
import transformFeature from "../../../features/transform_feature.js";

/** Только то, что нужно примеру. Остального движка раздел не касается. */
interface TransformYamlApi {
  parseInlineLine: (line: string, cfg: unknown) => unknown;
  buildTransformContext: (parsed: unknown, cfg: unknown) => { matches?: unknown[] };
  buildYamlMapFromContext: (
    ctx: unknown, cfg: unknown, propertyTypes?: Record<string, string>,
  ) => Record<string, unknown>;
  renderYamlBlockWithOrder: (lines: string[], patch: Record<string, unknown>, cfg: unknown) => string[];
  /** Типы свойств хранилища — у движка, чтобы пример совпадал с заметкой (B21). */
  readVaultPropertyTypes: (app: unknown) => Record<string, string>;
}

const engine = transformFeature as unknown as TransformYamlApi;

/* Видимые строки — в каталоге (10.13.47, У-32); списки несут имя строки. */
const T = BLOCK_TEXTS["field-editor"];

/** Свойства нет — Field в заметку не попадает. Одно слово на оба случая. */
export const NOT_WRITTEN = T.YAML_NOT_WRITTEN;

export const CARDINALITY_OPTIONS = [
  { value: "auto", name: "YAML_KIND_AUTO", label: T.YAML_KIND_AUTO },
  { value: "one", name: "YAML_KIND_ONE", label: T.YAML_KIND_ONE },
  { value: "list", name: "YAML_KIND_LIST", label: T.YAML_KIND_LIST },
] as const;

export const VALUE_RULE_OPTIONS = [
  { value: "raw", name: "YAML_FORM_RAW", label: T.YAML_FORM_RAW },
  { value: "clean", name: "YAML_FORM_CLEAN", label: T.YAML_FORM_CLEAN },
] as const;

/* ---- свойства vault: Я4 ------------------------------------------------ */

export interface VaultProperty {
  name: string;
  /** Пусто — тип неизвестен, и подсказка его не показывает. */
  type: string;
}

/**
 * Свойства vault с типом от Obsidian (Я4). `app.metadataTypeManager` —
 * приватное API без типов: feature-detect и тихий отказ обязательны.
 */
export function vaultProperties(app: unknown): VaultProperty[] {
  const out: VaultProperty[] = [];
  try {
    const mgr = (app as { metadataTypeManager?: unknown } | null)?.metadataTypeManager;
    if (!mgr || typeof mgr !== "object") return out;
    const holder = mgr as {
      getAllProperties?: () => unknown;
      properties?: unknown;
      types?: unknown;
    };
    const raw = typeof holder.getAllProperties === "function"
      ? holder.getAllProperties()
      : (holder.properties ?? holder.types);
    if (!raw || typeof raw !== "object") return out;
    const rows = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as { name?: unknown; type?: unknown };
      const name = String(r.name ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ name, type: String(r.type ?? "").trim() });
    }
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch (e) {
    /* Приватное API имеет право пропасть. Раздел от этого не падает. */
    console.error("inline-overhaul: свойства vault не прочитались", e);
    return [];
  }
  return out;
}

/* ---- пример: строка отдаётся движку ----------------------------------- */

/** Выдуманная строка со всеми Fields: форму «значение/список» движок решает по
 * всем Fields, делящим свойство. */
function fakeLine(rows: readonly YamlFieldRow[]): string {
  const tokens = rows.map(r => r.lineToken).filter(Boolean);
  return tokens.length ? "- " + tokens.join(" ") : "";
}

/**
 * Что запишет движок — по строке на Field: ключ — ключ Order, значение — строка
 * YAML целиком (Я2). Показан вклад своего Field, не свойство целиком (B11);
 * цена названа в подсказке строки. Форму решает движок по всем Fields — иначе
 * `Property type` разошёлся бы с заметкой.
 */
export function yamlExamples(
  rows: readonly YamlFieldRow[],
  cfg: unknown,
  app?: unknown,
): Readonly<Record<string, string>> {
  const line = fakeLine(rows);
  if (!line || !cfg) return {};
  /* Тип свойства из хранилища сильнее догадки — и в заметке, и здесь. */
  const propertyTypes = app ? engine.readVaultPropertyTypes(app) : {};
  try {
    const ctx = engine.buildTransformContext(engine.parseInlineLine(line, cfg), cfg);
    const matches = Array.isArray(ctx.matches) ? ctx.matches : [];
    const out: Record<string, string> = {};
    for (const row of rows) {
      /* Половина пары `Nested` — вклад родителя: тег пишется целиком (тест 2 цикла 138). */
      const own = matches.filter((m) => {
        const r = m as { fieldId?: unknown; nested?: { parentId?: unknown } };
        return [r.fieldId, r.nested?.parentId].some(id => String(id ?? "").trim() === row.fieldId);
      });
      if (!own.length) continue;
      /* Свойства Field — тем же движком по контексту только с его совпадениями;
       * своей арифметики здесь нет (У-4). */
      const mine = Object.assign({}, ctx as Record<string, unknown>, { matches: own });
      const patch = engine.buildYamlMapFromContext(mine, cfg, propertyTypes) as Record<string, unknown>;
      if (!patch || !Object.keys(patch).length) continue;
      const text = engine.renderYamlBlockWithOrder([], patch, cfg).filter(Boolean).join(" ");
      if (text) out[row.key] = text;
    }
    return out;
  } catch (e) {
    /* Отказ движка не уносит раздел: остальное правится без примера (З8). */
    console.error("inline-overhaul: пример свойства не посчитался", e);
    return {};
  }
}

/* ---- подсказка имён свойств: родная, а не своя ------------------------- */

/** Форма `AbstractInputSuggest`. Класс — швом `ctx.platform`, не импортом (Г16). */
interface SuggestInstance<T> {
  setValue(value: string): void;
  close(): void;
  onSelect(cb: (value: T, ev: unknown) => unknown): unknown;
  limit: number;
}

type SuggestCtor = new (app: unknown, input: unknown) => SuggestInstance<VaultProperty>;

/**
 * Поле имени свойства с подсказкой из vault. Подсказка родная —
 * `AbstractInputSuggest` (Obsidian 1.4.10+): клавиатура и тема (2026-08-28).
 * Нет класса (заглушка DOM) — обычное поле (Я4). Запись на `change`, не на
 * каждую букву: иначе запись в конфиг и шаг отмены на каждое нажатие. Выбор из
 * подсказки пишет сразу.
 */
export function propertyPicker(host: El, o: {
  /** Что стоит в поле сейчас. */
  value: string;
  /** Имя Field: уходит в подпись для программы чтения с экрана. */
  label: string;
  /** Подсказка в пустом поле (2026-08-27). */
  placeholder: string;
  props: readonly VaultProperty[];
  enabled: boolean;
  /** Класс подсказки и `app` от платформы; без них подсказки просто нет. */
  suggest?: { ctor: unknown; app: unknown } | undefined;
  write: (value: string) => void;
  /** Видимый текст по имени из каталога (10.13.47). */
  say: (name: string, ...args: readonly (string | number)[]) => string;
}): void {
  /* Поле и крестик в одной коробке постоянной ширины: крестик сжимает поле, а не
   * раздвигает строку (1.3.2.2). Класс как в прототипе — `io-pick2`. */
  const box = el(host, "div", "io-pick2");
  const input = textInput(box, "io-text io-text--mono io-text--prop", {
    value: o.value,
    placeholder: o.placeholder,
    label: o.say("YAML_FOR", o.label),
  });
  input.disabled = !o.enabled;
  input.addEventListener("change", (() => {
    if (!o.enabled) return;
    o.write(input.value);
  }) as never);

  /* Стереть свойство одним нажатием (1.4.1.2.6); без значения кнопки нет (З8). */
  if (o.enabled && String(o.value || "").trim()) {
    const clear = btn(box, "io-clear", {
      text: "\u2715",
      label: o.say("YAML_CLEAR", o.label),
    });
    clear.addEventListener("click", (() => {
      input.value = "";
      o.write("");
    }) as never);
  }

  if (!o.enabled || !o.suggest || typeof o.suggest.ctor !== "function") return;

  try {
    const Base = o.suggest.ctor as SuggestCtor;
    const props = o.props;
    class PropertySuggest extends Base {
      /** Что показать по набранному. Пусто в поле — весь список. */
      getSuggestions(query: string): VaultProperty[] {
        const q = String(query || "").trim().toLowerCase();
        return props.filter(p => !q || p.name.toLowerCase().includes(q)).slice();
      }

      /** Строка подсказки: имя свойства и его тип в vault (Я4). */
      renderSuggestion(p: VaultProperty, node: El): void {
        el(node, "span", "io-suggest__name", p.name);
        /* Типа может не быть: `metadataTypeManager` его не обязан отдать. */
        if (p.type) el(node, "span", "io-suggest__type", p.type);
      }

      /** Выбор — это уже нажатие, поэтому пишется сразу. */
      selectSuggestion(p: VaultProperty): void {
        this.setValue(p.name);
        this.close();
        o.write(p.name);
      }
    }
    const live = new PropertySuggest(o.suggest.app, input);
    /* Список свойств в vault короткий; ограничение платформы (100) не мешает. */
    live.limit = 100;
  } catch (e) {
    /* Класс мог измениться формой: поле остаётся рабочим, без подсказки (З8). */
    console.error("inline-overhaul: подсказка имён свойств не подключилась", e);
  }
}
