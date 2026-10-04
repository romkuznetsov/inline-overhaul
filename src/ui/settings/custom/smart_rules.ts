/**
 * Smart Rules в панели (PRD 10.8): подключение к платформе. Вёрстка —
 * `smart_rules_view.ts` (рисуется на заглушке DOM, Г16), записи —
 * `smart_rules_model.ts`; `Modal` открывается отсюда. Спор правил и шаблоны
 * считает движок `transform_feature.js` (П9).
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El, type ElInput } from "./dom.ts";
import { paintTip, type DocLike } from "../describe.ts";
import { inSettingsWindow } from "../settings_window.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";
import { createRulesModel, type RuleKind } from "./smart_rules_model.ts";
import {
  CONDITION_DIALOG_NOTE,
  conditionDialogTitle,
  renderConditionPicker,
  renderSmartRules,
} from "./smart_rules_view.ts";

/* Общий с редактором Fields модуль; снятие шва — `fields_editor.ts`. */
import deepStateModule from "../../../core/order_deep_editor_state.js";

/* Движок Transform: тот же модуль, что грузит плагин. */
import transformFeature from "../../../features/transform_feature.js";
import { sayIn } from "../texts_blocks.ts";

const deepState = deepStateModule as unknown as DeepState;

/** Только то, что нужно блоку. Остального движка он не касается. */
interface TransformRulesApi {
  validateSmartRules: (rules: unknown[]) => unknown[];
  collectTemplateOptions: (app: unknown, folder: string) => unknown;
  normalizePlacement: (raw: unknown) => unknown;
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

/** Окно «Add a tag / element / link»: Field, потом Value — только из настроенного (С-5). */
function askConditionModal(
  Modal: ModalCtor,
  app: unknown,
  o: {
    kind: RuleKind;
    choices: ReadonlyArray<{ label: string; fieldId?: string; values: readonly string[] }>;
    /** Fields, у которых условие «любое значение» в правиле уже есть. */
    fieldsTaken: readonly string[];
    /** Значение или Field целиком (10.13.14); вид — полем: id и токен бывают равны. */
    done: (answer: { kind: "value" | "field"; id: string } | null) => void;
    /** Видимый текст по имени из каталога (10.13.47). */
    say: (name: string, ...args: readonly (string | number)[]) => string;
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
      el(box, "h4", "io-dlg__title", conditionDialogTitle(o.kind, o.say));
      /* Текст с `<code>` — разметкой подсказки, а не строкой (В-288). */
      paintTip(el(box, "div", "io-item__desc") as unknown as DocLike, o.say(CONDITION_DIALOG_NOTE));
      renderConditionPicker(box, {
        kind: o.kind,
        /* Подстановка едет и в список: без неё половина окна английская. */
        say: o.say,
        choices: o.choices,
        fieldsTaken: o.fieldsTaken,
        pick: value => { finish({ kind: "value", id: value }); this.close(); },
        pickField: fieldId => { finish({ kind: "field", id: fieldId }); this.close(); },
      });
      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: o.say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустой выбор. */
      finish(null);
      this.contentEl.empty();
    }
  }

  inSettingsWindow(() => new ConditionModal(app).open());
}

/* ---- подсказчик папок (10.13.8) ---------------------------------------- */

/** Форма `AbstractInputSuggest` в том виде, в каком она нужна здесь. */
interface SuggestInstance {
  setValue(value: string): void;
  close(): void;
  limit: number;
}
type SuggestCtor = new (app: unknown, input: unknown) => SuggestInstance;

/** Папки vault (`getAllFolders` — публичный API). */
/* Один дом на панель: берут и `Templates folder`, `New notes folder` (В-131, У-32). */
export function vaultFolders(app: unknown): string[] {
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
 * Подсказчик папок платформы (`AbstractInputSuggest`, с 1.4.10). Нет класса
 * (заглушка DOM) — остаётся обычное поле.
 */
export function attachFolderSuggest(ctor: unknown, app: unknown, input: ElInput, write: (value: string) => void): void {
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

  /** Шаблоны из vault — функцией движка; vault не ответил — список пуст. */
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

  /**
   * Развёрнутые карточки (З-6) — состояние вида, не конфиг (О0). Живёт с
   * блоком: перерисовку переживает, смену вкладки — нет (по умолчанию свёрнуты).
   */
  const expanded = new Set<string>();

  let mounted: El | null = null;
  const draw = (): void => {
    /* Скролл и фокус снимаются до подмены узла и возвращаются после (A8). */
    const keep = keepView(box);
    const next = el(box, "div", "io-rulesblock__mount");
    try {
      const model = createRulesModel({
        plugin: p.plugin as never,
        validate: rules => engine.validateSmartRules(rules) as unknown[],
        blankPlacement: () => engine.normalizePlacement({}),
        fieldTokens: () => createFieldsModel({
          plugin: p.plugin as never,
          normalizePkmOrder: p.normalizePkmOrder as never,
          pkmOrderFields: p.pkmOrderFields,
          cfg: p.getConfig() as never,
          deepState,
        }).listFieldTokens(),
      });
      renderSmartRules(next, {
        model,
        expanded,
        /* Без подстановки вёрстка берёт `PLAIN` и рисует по-английски (A46). */
        say: sayIn("smart-rules-list", ctx),
        enabled: Boolean(ctx.get("transform.inline2note.enabled")),
        templates: templates(),
        /* Для подписи пустого списка, как у `Default template`. */
        templatesFolder: String(ctx.get("transform.inline2note.templatesFolder") || ""),
        redraw: () => { draw(); },
        /* Выбор из подсказчика пишется сразу, не по уходу из поля. */
        folderSuggest: (input, write) => attachFolderSuggest(
          p.AbstractInputSuggest, app, input,
          value => { input.value = value; write(value); }),
        askCondition: (kind, done) => askConditionModal(Modal, app, {
          kind,
          choices: model.choicesFor(kind),
          /* Fields с условием «любое значение» — неактивны в окне (10.13.14 Н4). */
          fieldsTaken: model.listRules().flatMap(r => r.conditions.fields),
          done,
          say: sayIn("smart-rules-list", ctx),
        }),
      });
    } catch (e) {
      /* Неудача выбрасывается, на экране остаётся прежнее (как в редакторе Fields). */
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
