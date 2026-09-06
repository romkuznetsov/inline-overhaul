/**
 * Smart Rules в новой панели (PRD 10.8, фаза 3c).
 *
 * Здесь только подключение: вёрстка в `smart_rules_view.ts`, записи в
 * `smart_rules_model.ts`, а этот файл сводит их с платформой. Разделение то
 * же, что у редактора Fields, и по той же причине: вёрстка обязана рисоваться
 * на заглушке DOM (гейт Г16), а `Modal` заглушке недоступен — окно выбора
 * значения открывается отсюда и приходит в блок обратным вызовом.
 *
 * Спор правил и список шаблонов считает движок: `validateSmartRules` и
 * `collectTemplateOptions` из `transform_feature.js`. Свой разбор того же
 * разошёлся бы с ним на первой правке — это П9 по смыслу.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El, type ElInput } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";
import { createRulesModel, type RuleKind } from "./smart_rules_model.ts";
import {
  CONDITION_DIALOG_NOTE,
  conditionDialogTitle,
  renderConditionPicker,
  renderSmartRules,
} from "./smart_rules_view.ts";

/* Помощники состояния дерева значений — оттуда же, откуда их берут редактор
   Fields и раздел свойств заметки: у поиска есть откат на заглушку, и двух
   таких откатов быть не должно. */
import legacy from "./fields_editor_legacy.js";

/* Движок Transform: тот же модуль, что грузит плагин. */
import transformFeature from "../../../features/transform_feature.js";

interface LegacyModule {
  getOrderDeepEditorState: () => DeepState;
}

const helpers = legacy as unknown as LegacyModule;

/** Только то, что нужно блоку. Остального движка он не касается. */
interface TransformRulesApi {
  validateSmartRules: (rules: unknown[]) => unknown[];
  collectTemplateOptions: (app: unknown, folder: string) => unknown;
}

const engine = transformFeature as unknown as TransformRulesApi;

/** Пути, на которых блок перерисовывается целиком. */
const RULES_PATHS = [
  "features.transform.enabled",
  "transform.inline2note.enabled",
  "transform.inline2note.templatesFolder",
  "general.help.showTips",
  "advanced.showSettingIds",
] as const;

/* ---- окно выбора значения (С-5) ---------------------------------------- */

interface ModalCtor {
  new (app: unknown): {
    contentEl: El;
    open(): void;
    close(): void;
    onOpen?(): void;
    onClose?(): void;
  };
}

/**
 * Окно «Add a tag / element / link»: сперва Field, потом его Value. Ввода
 * «через запятую» нет — С-5 требует выбор из того, что уже настроено.
 */
function askConditionModal(
  Modal: ModalCtor,
  app: unknown,
  o: {
    kind: RuleKind;
    choices: ReadonlyArray<{ label: string; fieldId?: string; values: readonly string[] }>;
    /** Fields, у которых условие «любое значение» в правиле уже есть. */
    fieldsTaken: readonly string[];
    /**
     * Что выбрали: значение или Field целиком (10.13.14). Вид ответа названа
     * полем, а не угадывается по строке: id Field и токен значения бывают
     * одинаковыми на вид, и разбирать их обратно значило бы гадать.
     */
    done: (answer: { kind: "value" | "field"; id: string } | null) => void;
  },
): void {
  let answered = false;
  const finish = (answer: { kind: "value" | "field"; id: string } | null): void => {
    if (answered) return;
    answered = true;
    o.done(answer);
  };

  class ConditionModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", undefined, conditionDialogTitle(o.kind));
      el(box, "p", "io-item__desc", CONDITION_DIALOG_NOTE);
      renderConditionPicker(box, {
        kind: o.kind,
        choices: o.choices,
        fieldsTaken: o.fieldsTaken,
        pick: value => { finish({ kind: "value", id: value }); this.close(); },
        pickField: fieldId => { finish({ kind: "field", id: fieldId }); this.close(); },
      });
      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button", { cls: "io-btn", text: "Cancel", attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустой выбор. */
      finish(null);
      this.contentEl.empty();
    }
  }

  new ConditionModal(app).open();
}

/* ---- подсказчик папок (10.13.8) ---------------------------------------- */

/** Форма `AbstractInputSuggest` в том виде, в каком она нужна здесь. */
interface SuggestInstance {
  setValue(value: string): void;
  close(): void;
  limit: number;
}
type SuggestCtor = new (app: unknown, input: unknown) => SuggestInstance;

/** Папки vault. Приватного API тут нет: `getAllFolders` — публичный. */
function vaultFolders(app: unknown): string[] {
  try {
    const vault = (app as { vault?: { getAllFolders?: (root?: boolean) => Array<{ path?: unknown }> } }).vault;
    if (!vault || typeof vault.getAllFolders !== "function") return [];
    return vault.getAllFolders(false)
      .map(f => String(f && f.path || "").trim())
      .filter(Boolean)
      .sort();
  } catch (e) {
    /* Vault имеет право не ответить: в проверках его нет вовсе. */
    console.error("inline-overhaul: папки vault не прочитались", e);
    return [];
  }
}

/**
 * Подсказчик папок на поле своей папки правила.
 *
 * Рисует его **платформа**: `AbstractInputSuggest` — публичный API Obsidian с
 * 1.4.10, а `minAppVersion` у нас 1.13. Класса может не быть (у заглушки DOM
 * его нет), и тогда поле остаётся обычным полем ввода — папку вписывают
 * руками, и она создаётся при первом срабатывании правила.
 */
function attachFolderSuggest(ctor: unknown, app: unknown, input: ElInput, write: (value: string) => void): void {
  if (typeof ctor !== "function") return;
  try {
    const Base = ctor as SuggestCtor;
    const folders = vaultFolders(app);
    class FolderSuggest extends Base {
      getSuggestions(query: string): string[] {
        const q = String(query || "").trim().toLowerCase();
        return folders.filter(f => !q || f.toLowerCase().includes(q));
      }
      renderSuggestion(value: string, node: El): void {
        el(node, "span", "io-suggest__name", value);
      }
      selectSuggestion(value: string): void {
        this.setValue(value);
        this.close();
        write(value);
      }
    }
    const live = new FolderSuggest(app, input);
    live.limit = 50;
  } catch (e) {
    console.error("inline-overhaul: подсказчик папок не встал", e);
  }
}

/* ---- блок --------------------------------------------------------------- */

export const smartRules: CustomRender = (host: El, ctx: SettingsCtx) => {
  const p = ctx.platform;
  const box = el(host, "div", "io-rulesblock");

  /* Без платформы блок наполнить нечем: правила и Fields лежат в конфиге. */
  if (!p) return () => { box.empty(); };

  const Modal = p.Modal as ModalCtor;
  const app = (p.plugin as { app?: unknown }).app;

  /**
   * Шаблоны из vault. Список читает движок — та же функция, что выбирает
   * шаблон при переносе строки. Vault может не ответить (в проверках его нет
   * вовсе), и тогда список пуст: выбрать нечего, но блок работает.
   */
  const templates = (): string[] => {
    try {
      const folder = String(ctx.get("transform.inline2note.templatesFolder") || "");
      const raw = engine.collectTemplateOptions(app, folder);
      if (!Array.isArray(raw)) return [];
      return raw.map(x => String(x || "").trim()).filter(Boolean);
    } catch (e) {
      console.error("inline-overhaul: список шаблонов не прочитался", e);
      return [];
    }
  };

  let mounted: El | null = null;
  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    const next = el(box, "div", "io-rulesblock__mount");
    try {
      const model = createRulesModel({
        plugin: p.plugin as never,
        validate: rules => engine.validateSmartRules(rules) as unknown[],
        fieldTokens: () => createFieldsModel({
          plugin: p.plugin as never,
          normalizePkmOrder: p.normalizePkmOrder as never,
          pkmOrderFields: p.pkmOrderFields,
          cfg: p.getConfig() as never,
          deepState: helpers.getOrderDeepEditorState(),
        }).listFieldTokens(),
      });
      renderSmartRules(next, {
        model,
        enabled: Boolean(ctx.get("transform.inline2note.enabled")),
        templates: templates(),
        /* Имя папки нужно самой подписи: пустой список обязан сказать,
           чего не хватает, теми же словами, что и `Default template`. */
        templatesFolder: String(ctx.get("transform.inline2note.templatesFolder") || ""),
        redraw: () => { draw(); },
        /* Выбор из подсказчика — это уже нажатие: значение пишется сразу, а
           не ждёт, пока человек уйдёт из поля. */
        folderSuggest: (input, write) => attachFolderSuggest(
          p.AbstractInputSuggest, app, input,
          value => { input.value = value; write(value); }),
        askCondition: (kind, done) => askConditionModal(Modal, app, {
          kind,
          choices: model.choicesFor(kind),
          /* Какие Fields уже стоят условием «любое значение»: их имя в окне
             неактивно (10.13.14 Н4). Считается по правилам, а не по памяти. */
          fieldsTaken: model.listRules().flatMap(r => r.conditions.fields),
          done,
        }),
      });
    } catch (e) {
      /* Неудачная попытка выбрасывается целиком, а на экране остаётся то, что
         работало: так же устроен редактор Fields (замечание заказчика). */
      next.remove();
      console.error("inline-overhaul: Smart Rules не отрисовались", e);
      return;
    }
    if (mounted) mounted.remove();
    mounted = next;
    keep.restore();
  };

  draw();
  const unwatch = ctx.watch(RULES_PATHS, draw);
  return () => {
    unwatch();
    mounted = null;
    box.empty();
  };
};
