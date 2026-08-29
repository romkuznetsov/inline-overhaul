/**
 * Реестр действий кнопок (PRD 5.6).
 *
 * Кнопка в схеме называет действие именем, а что оно делает — решается здесь.
 * Реестр отвечает на два вопроса сразу: **можно ли показывать кнопку** и
 * **что произойдёт при нажатии**. Первое важнее: кнопка, за которой нет
 * действия, в панель не попадает вовсе (З8) — генератор схемы отбрасывает её
 * запись, сверяясь со списком `READY_ACTIONS` ниже.
 *
 * Здесь нет ни `obsidian`, ни DOM: окно подтверждения и уведомление приходят
 * швом, как и всё остальное платформенное. Поэтому реестр проверяется без
 * Obsidian, а окно подтверждения — настоящее.
 *
 * Четыре действия из семи. Остальные три:
 *
 *   * `open-howto` — заметки-руководства в плагине нет вовсе. Это не перенос,
 *     а новая работа: сперва надо написать саму заметку;
 *   * `restore-backup` — восстановления настроек из резервной копии в плагине
 *     тоже нет. `backups.tagWheelConfigApplies` копит копии применений
 *     конфиг-заметки, а не настроек до обновления;
 *   * `open-hotkey` — ждёт имён команд из фазы 2 вместе со справочником
 *     команд (К-2). Само чтение хоткея уже написано (`custom/hotkeys.ts`).
 */

import type { ActionId } from "./types.ts";

/**
 * Действия, за которыми есть работающий метод плагина. Список читает и
 * генератор схемы (`build/gen_schema.js`): кнопки с действием не из него в
 * схему не попадают. Совпадение двух списков закреплено проверкой — разойтись
 * они не должны, иначе в панели появится кнопка без действия.
 */
export const READY_ACTIONS: readonly ActionId[] = [
  "generate-config-note",
  "apply-config-note",
  "open-config-template",
  "regenerate-rules",
];

/** Методы плагина, которые зовут действия. Каждый может отсутствовать. */
export interface ActionHost {
  openTagWheelConfigNote?: () => Promise<unknown> | unknown;
  openTagWheelConfigTemplateNote?: () => Promise<unknown> | unknown;
  applyTagWheelConfigNote?: () => Promise<unknown> | unknown;
  ensureGeneratedRulesNow?: (reason: string) => Promise<unknown> | unknown;
}

export interface ConfirmRequest {
  title: string;
  body: string;
  /** Подпись кнопки согласия: она же говорит, что именно произойдёт. */
  confirmLabel: string;
  /** Действие уносит данные: кнопка согласия красная. */
  danger?: true;
}

export interface ActionDeps {
  plugin: ActionHost;
  notify: (message: string) => void;
  /**
   * Спросить подтверждение. Без него разрушительное действие не идёт: если
   * окна нет (проверка, заглушка), ответом считается отказ, а не согласие.
   */
  confirm?: (o: ConfirmRequest) => Promise<boolean>;
}

/* ---- тексты: видимые строки английские, точек в конце нет (Р10) -------- */

const APPLY_TITLE = "Apply the config note";
const APPLY_BODY =
  "This replaces your current setup with what the note says. The previous setup is kept aside first";
const APPLY_CONFIRM = "Replace my setup";
const APPLY_DONE = "Settings replaced with the config note";
const GENERATED = "Config note written and opened";
const TEMPLATE_OPENED = "Template note opened";
const RULES_DONE = "Generated file rebuilt from your Fields";
/** Метода нет — говорим об этом, а не молчим. */
const NO_METHOD = "This build cannot do that yet";

/** Путь заметки из ответа метода: он возвращает его строкой. */
function pathOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function said(message: string, path: string): string {
  return path ? message + ": " + path : message;
}

export function buildActions(deps: ActionDeps): Partial<Record<ActionId, () => Promise<void>>> {
  const { plugin, notify } = deps;

  /**
   * Общая обвязка: метода может не быть (старая сборка, неполный модуль), и
   * любой из них может бросить. И то и другое — сообщение человеку, а не
   * молчание и не падение панели.
   */
  const guard = async (
    what: string,
    call: (() => Promise<unknown> | unknown) | undefined,
    done: (result: unknown) => string,
  ): Promise<void> => {
    if (typeof call !== "function") {
      notify(NO_METHOD);
      console.error("inline-overhaul: у плагина нет метода для действия " + what);
      return;
    }
    try {
      notify(done(await Promise.resolve(call())));
    } catch (e) {
      const message = e && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e);
      notify(message);
      console.error("inline-overhaul: действие " + what + " не выполнилось", e);
    }
  };

  return {
    "generate-config-note": () => guard(
      "generate-config-note",
      plugin.openTagWheelConfigNote && (() => plugin.openTagWheelConfigNote!()),
      result => said(GENERATED, pathOf(result)),
    ),

    "open-config-template": () => guard(
      "open-config-template",
      plugin.openTagWheelConfigTemplateNote && (() => plugin.openTagWheelConfigTemplateNote!()),
      result => said(TEMPLATE_OPENED, pathOf(result)),
    ),

    "regenerate-rules": () => guard(
      "regenerate-rules",
      plugin.ensureGeneratedRulesNow && (() => plugin.ensureGeneratedRulesNow!("manual")),
      () => RULES_DONE,
    ),

    /**
     * Применение заметки переписывает настройки целиком, поэтому спрашивает
     * (Э2). Отказ — это отказ: ничего не зовётся.
     */
    "apply-config-note": async () => {
      const ask = deps.confirm;
      if (typeof ask !== "function") {
        console.error("inline-overhaul: применение заметки без окна подтверждения не идёт");
        return;
      }
      const yes = await ask({
        title: APPLY_TITLE,
        body: APPLY_BODY,
        confirmLabel: APPLY_CONFIRM,
        danger: true,
      });
      if (!yes) return;
      await guard(
        "apply-config-note",
        plugin.applyTagWheelConfigNote && (() => plugin.applyTagWheelConfigNote!()),
        () => APPLY_DONE,
      );
    },
  };
}

/** Тексты наружу: их проверяет пин, а не сверка строк с самими собой. */
export const ACTION_TEXTS = {
  APPLY_TITLE,
  APPLY_BODY,
  APPLY_CONFIRM,
  APPLY_DONE,
  GENERATED,
  TEMPLATE_OPENED,
  RULES_DONE,
  NO_METHOD,
} as const;
