/**
 * Раздел `YAML property` правой колонки редактора Fields (PRD 10.9).
 *
 * Решение заказчика 2026-08-28: свойства заметки живут у Field, а не своим
 * блоком на вкладке Transform. Прототип рисовал их таблицей в `Note
 * properties`; блок удалён, а четыре его настройки — имя свойства, тип,
 * правило значения и то, что будет записано — стоят строками в том разделе,
 * где Field и настраивается. Раздел 10.9 PRD переписан под это.
 *
 * Здесь три вещи, которые редактору Fields нужны только для этого раздела:
 * подсказка имён свойств из vault (Я4), пример записи и его вычисление. В
 * `fields_editor_view.ts` их держать нельзя: пример зовёт движок, а вёрстка
 * не должна ничего знать о движке — иначе её не отрисует заглушка гейта Г16.
 *
 * **Пример считает движок, а не панель.** Я1 требует показать то, что
 * **будет записано**, поэтому строка собирается из токенов Fields и уходит в
 * те же функции, которыми пишет команда `Inline to note`: `parseInlineLine`,
 * `buildTransformContext`, `buildYamlMapFromContext`,
 * `renderYamlBlockWithOrder`. Это первый вариант П9 — тот же код разметки, —
 * а не пометка о приблизительности, которой обошлись живые предпросмотры.
 *
 * Отсюда два отличия от прототипа, и оба — правда, а не расхождение.
 * Значения печатаются в кавычках (`status: "#todo"`): так их печатает
 * `renderYamlScalar`, а незакавыченный `#todo` в YAML был бы комментарием. И
 * решение «одно значение или список» принимает движок.
 *
 * Строка выдуманная и **без Separator**: `buildTransformContext` сверяет
 * сторону совпадения со списком определений (`leftMode` держит теги,
 * `rightMode` — ссылки и элементы), а не с Block из Order. Строка без
 * Separator даёт каждому совпадению сторону `any`, и ни один Field не выпадает
 * из примера из-за того, в каком Block он стоит. Это та же ловушка
 * `leftMode` / `rightMode`, что стреляла трижды.
 */

import { btn, el, textInput, type El } from "./dom.ts";
import { BLOCK_TEXTS } from "../texts_blocks.ts";
import type { YamlFieldRow } from "./fields_model.ts";

/*
 * Движок команды `Inline to note`. Модуль самостоятельный — ни одного
 * `require` внутри, — и в сборке он уже есть: `release_entry.js` кладёт его в
 * реестр модулей vault. Импорт здесь берёт тот же модуль, а не второй его
 * экземпляр.
 */
import transformFeature from "../../../features/transform_feature.js";

/** Только то, что нужно примеру. Остального движка раздел не касается. */
interface TransformYamlApi {
  parseInlineLine: (line: string, cfg: unknown) => unknown;
  buildTransformContext: (parsed: unknown, cfg: unknown) => { matches?: unknown[] };
  buildYamlMapFromContext: (
    ctx: unknown, cfg: unknown, propertyTypes?: Record<string, string>,
  ) => Record<string, unknown>;
  renderYamlBlockWithOrder: (lines: string[], patch: Record<string, unknown>, cfg: unknown) => string[];
  /**
   * Типы свойств, объявленные в хранилище. Берётся у движка, а не читается
   * здесь второй раз: пример обязан показывать то же, что получит заметка
   * (B21, решение заказчика 2026-09-02).
   */
  readVaultPropertyTypes: (app: unknown) => Record<string, string>;
}

const engine = transformFeature as unknown as TransformYamlApi;

/*
 * Видимые строки живут в каталоге (10.13.47). Здесь — имена и английское,
 * взятое оттуда же: второго объявления текста в продукте нет (У-32). Списки
 * несут **имя** строки, а слово подставляет тот, кто рисует.
 */
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
 * Свойства, которые в vault уже есть, с типом от Obsidian (Я4).
 *
 * `app.metadataTypeManager` — приватное API: его нет в типах пакета
 * `obsidian`, и полагаться на его форму нельзя. Поэтому обязателен
 * feature-detect и тихий отказ: без него раздел работает, просто не
 * подсказывает имена и не показывает тип.
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

/**
 * Выдуманная строка со всеми Fields, у которых есть что записать. Нужна
 * целиком, а не для одного Field: решение «одно значение или список» движок
 * принимает по всем Fields, делящим одно свойство.
 */
function fakeLine(rows: readonly YamlFieldRow[]): string {
  const tokens = rows.map(r => r.lineToken).filter(Boolean);
  return tokens.length ? "- " + tokens.join(" ") : "";
}

/**
 * Что запишет движок — по строке на Field. Ключ карты — ключ Order, значение —
 * строка YAML целиком, вместе с именем свойства и формой списка (Я2).
 *
 * Строка показывает вклад **своего** Field, а не свойство целиком (замечание
 * B11, 2026-09-02). До этого показывалось свойство целиком: тогда в настройках
 * `Category` было видно `tags: [1, work, "[[test1]]"]` — значения трёх чужих
 * Fields, — и заказчик написал, что не понимает, почему в настройках одного
 * Field видит значения других. Его слово здесь главнее прежнего решения.
 *
 * **Цена названа в подсказке строки:** там, где одно свойство делят несколько
 * Fields, заметка получит их вместе одним списком, а здесь виден только свой
 * вклад.
 *
 * Форму — одно значение или список — по-прежнему решает движок и по-прежнему
 * по всем Fields: строка собирается со всеми, а фильтруются уже совпадения.
 * Иначе `Property type` показывал бы одно, а заметка получала другое.
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
      const own = matches.filter(m => String((m as { fieldId?: unknown }).fieldId ?? "").trim() === row.fieldId);
      if (!own.length) continue;
      /*
       * Свойства этого Field считает тот же движок, но по контексту, в котором
       * оставлены **его** совпадения. Своей арифметики здесь нет: правила
       * (`raw`/`clean`, форма списка, кавычки) живут у движка, и вторая их
       * копия разошлась бы с ним на первой правке (У-4).
       */
      const mine = Object.assign({}, ctx as Record<string, unknown>, { matches: own });
      const patch = engine.buildYamlMapFromContext(mine, cfg, propertyTypes) as Record<string, unknown>;
      if (!patch || !Object.keys(patch).length) continue;
      const text = engine.renderYamlBlockWithOrder([], patch, cfg).filter(Boolean).join(" ");
      if (text) out[row.key] = text;
    }
    return out;
  } catch (e) {
    /*
     * Отказ движка не должен уносить с собой раздел: имя свойства, тип и
     * правило человек правит и без примера. Сообщение — в консоль, а не в
     * интерфейс (З8).
     */
    console.error("inline-overhaul: пример свойства не посчитался", e);
    return {};
  }
}

/* ---- подсказка имён свойств: родная, а не своя ------------------------- */

/**
 * Форма `AbstractInputSuggest`, в том виде, в каком она нужна здесь. Класс
 * приходит швом платформы (`ctx.platform`), а не импортом: блок не знает про
 * модуль `obsidian` — иначе его не отрисует заглушка гейта Г16.
 */
interface SuggestInstance<T> {
  setValue(value: string): void;
  close(): void;
  onSelect(cb: (value: T, ev: unknown) => unknown): unknown;
  limit: number;
}

type SuggestCtor = new (app: unknown, input: unknown) => SuggestInstance<VaultProperty>;

/**
 * Поле имени свойства с подсказкой из vault.
 *
 * Подсказку рисует **платформа**: `AbstractInputSuggest` — публичный API
 * Obsidian с 1.4.10, а `minAppVersion` у нас 1.13. Свой список из кнопок,
 * который стоял здесь сначала, отдавал только мышь и выглядел не как остальной
 * Obsidian; родной поповер даёт клавиатуру (стрелки, Enter, Esc), попадание в
 * тему и правильное положение относительно поля (замечание заказчика
 * 2026-08-28).
 *
 * Класса может не быть: у заглушки DOM его нет вовсе, а у старого Obsidian он
 * появился не сразу. Тогда поле остаётся обычным полем ввода — без подсказок,
 * но рабочим (Я4, тот же тихий отказ).
 *
 * Запись идёт на `change`, то есть по уходу из поля и по Enter, а не на каждой
 * букве: иначе каждое нажатие становилось бы своей записью в конфиг и своим
 * шагом отмены. Выбор из подсказки пишет сразу — это уже осознанное нажатие.
 */
export function propertyPicker(host: El, o: {
  /** Что стоит в поле сейчас. */
  value: string;
  /** Имя Field: уходит в подпись для программы чтения с экрана. */
  label: string;
  /** Подсказка в пустом поле. Утверждена заказчиком 2026-08-27. */
  placeholder: string;
  props: readonly VaultProperty[];
  enabled: boolean;
  /** Класс подсказки и `app` от платформы; без них подсказки просто нет. */
  suggest?: { ctor: unknown; app: unknown } | undefined;
  write: (value: string) => void;
  /** Видимый текст по имени из каталога (10.13.47). */
  say: (name: string, ...args: readonly (string | number)[]) => string;
}): void {
  /*
   * Поле и крестик стоят в одной коробке постоянной ширины: появившийся
   * крестик **сжимает поле**, а не сдвигает его влево. Раньше он вставал
   * рядом, коробка становилась шире на его ширину, и строка уезжала из общей
   * геометрии панели (замечание заказчика 1.3.2.2). Класс тот же, что в
   * прототипе, — `io-pick2`.
   */
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

  /*
   * Стереть выбранное свойство одним нажатием (замечание заказчика
   * 1.4.1.2.6). Раньше приходилось выделять текст и удалять его руками, а
   * поле с подсказчиком на каждое нажатие открывает список — стирание
   * выходило борьбой с подсказками.
   *
   * Кнопка исчезает, когда стирать нечего: кнопка, которая ничего не делает,
   * хуже её отсутствия (З8).
   */
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
    /* Приватного тут ничего нет, но класс мог измениться формой. Поле
       остаётся рабочим, подсказки просто не будет (З8: молчим в интерфейсе). */
    console.error("inline-overhaul: подсказка имён свойств не подключилась", e);
  }
}
