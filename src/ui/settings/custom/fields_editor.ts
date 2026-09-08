/**
 * Редактор Fields в новой панели (PRD 10.2, фаза 3b пункт 4).
 *
 * Здесь только подключение: вёрстка лежит в `fields_editor_view.ts`, записи —
 * в `fields_model.ts`, а этот файл сводит их с платформой. Разделение не
 * ради красоты: вёрстка обязана рисоваться на заглушке DOM (гейт Г16), а
 * `Modal` и `Notice` заглушке недоступны, поэтому окна открываются отсюда и
 * приходят в блок обратными вызовами.
 *
 * Старая доска (`fields_editor_legacy.js`) отсюда больше не зовётся: её
 * держит только старая панель, до её удаления в фазе 3c. Записи у обеих
 * общие — модель одна, — и разойтись им не на чем.
 */

import type { CustomRender, SettingsCtx } from "../types.ts";
import { el, type El } from "./dom.ts";
import { keepView } from "./keepview.ts";
import { createFieldsModel, type DeepState } from "./fields_model.ts";
import {
  renderFieldsEditor,
  type FieldsViewState,
  type NewField,
} from "./fields_editor_view.ts";

/*
 * Помощники состояния дерева значений — **напрямую из модуля** (последний
 * пункт фазы 6, 2026-09-08).
 *
 * До этого их брал шов `fields_editor_legacy.js`: `globalThis`, `require` по
 * относительному пути и заглушка на случай отказа. Довод у шва был честный —
 * «у поиска есть откат на заглушку, и двух таких откатов быть не должно», —
 * но откат оказался лишним целиком: `globalThis.__inlineOrderDeepEditorState`
 * не ставил **никто**, а `require` стоял литералом и в бандле разрешался
 * всегда. То есть заглушка была недостижима, и её единственным делом было
 * прятать отказ загрузки, если бы он случился (У-90).
 */
import deepStateModule from "../../../core/order_deep_editor_state.js";
import { sayIn } from "../texts_blocks.ts";

const deepState = deepStateModule as unknown as DeepState;

/** Как окно спрашивает свой текст (10.13.47). */
type Say = (name: string, ...args: readonly (string | number)[]) => string;

/** Пути, на которых редактор перерисовывается целиком. */
const EDITOR_PATHS = ["features.pkm.enabled", "general.help.showTips", "advanced.showSettingIds"] as const;

/* ---- окна платформы ---------------------------------------------------- */

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
 * Окно «Add a Field»: имя и тип (решение заказчика 2026-08-27, PRD 10.2 Ф5).
 * Тип выбирается один раз — он решает, что Field пишет в строку, — и после
 * создания не меняется, поэтому спросить его надо здесь.
 */
function askNewFieldModal(
  Modal: ModalCtor,
  app: unknown,
  done: (answer: NewField | null) => void,
  say: Say,
): void {
  let answered = false;
  const finish = (answer: NewField | null): void => {
    if (answered) return;
    answered = true;
    done(answer);
  };

  class AddFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", undefined, say("NEW_FIELD_TITLE"));

      const nameRow = el(box, "div", "io-item");
      const nameInfo = el(nameRow, "div", "io-item__info");
      el(nameInfo, "div", "io-item__name", say("NEW_FIELD_NAME"));
      el(nameInfo, "div", "io-item__desc", say("NEW_FIELD_NAME_LABEL"));
      const name = el(nameRow, "div", "io-item__control").createEl("input", {
        cls: "io-text",
        type: "text",
        placeholder: say("NEW_FIELD_NAME_HINT"),
        attr: { "aria-label": say("NEW_FIELD_NAME_ARIA") },
      }) as El & { value: string };

      const typeRow = el(box, "div", "io-item");
      const typeInfo = el(typeRow, "div", "io-item__info");
      el(typeInfo, "div", "io-item__name", say("NEW_FIELD_TYPE"));
      el(typeInfo, "div", "io-item__desc", say("NEW_FIELD_TYPE_LABEL"));
      const type = el(typeRow, "div", "io-item__control").createEl("select", {
        cls: "io-select",
        attr: { "aria-label": say("NEW_FIELD_TYPE_ARIA") },
      }) as El & { value: string };
      for (const opt of [
        { value: "tag", name: "NEW_FIELD_TYPE_TAG" },
        { value: "wikilink", name: "NEW_FIELD_TYPE_LINK" },
        { value: "element", name: "NEW_FIELD_TYPE_ELEMENT" },
      ]) type.createEl("option", { text: say(opt.name), value: opt.value });
      type.value = "tag";

      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      const add = foot.createEl("button", {
        cls: "io-btn io-btn--cta",
        text: say("NEW_FIELD_ADD"),
        attr: { type: "button" },
      }) as El & { disabled: boolean };
      add.disabled = true;
      /* Кнопка молчит, пока имени нет: Field без имени завести нечем. */
      name.addEventListener("input", (() => {
        add.disabled = !String(name.value || "").trim();
      }) as never);
      add.addEventListener("click", (() => {
        const value = String(name.value || "").trim();
        if (!value) return;
        finish({ name: value, kind: type.value as NewField["kind"] });
        this.close();
      }) as never);
    }

    override onClose(): void {
      /* Закрытие мимо кнопок — это отказ, а не пустой ответ. */
      finish(null);
      this.contentEl.empty();
    }
  }

  new AddFieldModal(app).open();
}

/**
 * Подтверждение удаления Field. Удаление уносит с собой Values, цвета и
 * свойство заметки, и переспросить дешевле, чем восстанавливать.
 */
function confirmDeleteModal(
  Modal: ModalCtor,
  app: unknown,
  fieldName: string,
  done: (yes: boolean) => void,
  say: Say,
): void {
  let answered = false;
  const finish = (yes: boolean): void => {
    if (answered) return;
    answered = true;
    done(yes);
  };

  class DeleteFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", undefined, say("DELETE_TITLE"));
      el(box, "p", "io-item__desc", say("DELETE_BODY", fieldName));
      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(false); this.close(); }) as never);
      const del = foot.createEl("button",
        { cls: "io-danger", text: say("DELETE_CONFIRM"), attr: { type: "button" } });
      del.addEventListener("click", (() => { finish(true); this.close(); }) as never);
    }

    override onClose(): void {
      finish(false);
      this.contentEl.empty();
    }
  }

  new DeleteFieldModal(app).open();
}

/**
 * Окно «Rename Field»: новое имя и цена, которую за него платят.
 *
 * Решение заказчика 2026-08-31 по замечанию 1.4.1.2.2: переименовывать
 * системное имя можно, но молча — нельзя. Имя стоит в ваших заметках и в
 * идентификаторах команд Field, и после переименования старый тег в заметках
 * остаётся, а назначенный хоткей отвязывается: Obsidian держит хоткей за
 * идентификатором, а тот собран из имени.
 *
 * Поэтому окно не спрашивает «уверены?» — оно **перечисляет последствия**.
 */
function askRenameModal(
  Modal: ModalCtor,
  app: unknown,
  current: string,
  done: (next: string | null) => void,
  say: Say,
): void {
  let answered = false;
  const finish = (next: string | null): void => {
    if (answered) return;
    answered = true;
    done(next);
  };

  class RenameFieldModal extends Modal {
    override onOpen(): void {
      const box = this.contentEl;
      box.empty();
      box.addClass("io-dlg");
      el(box, "h4", undefined, say("RENAME_TITLE"));

      const row = el(box, "div", "io-item");
      const info = el(row, "div", "io-item__info");
      el(info, "div", "io-item__name", say("RENAME_LABEL"));
      el(info, "div", "io-item__desc", say("RENAME_HINT"));
      const input = el(row, "div", "io-item__control").createEl("input", {
        cls: "io-text io-text--mono",
        type: "text",
        value: current,
        attr: { "aria-label": say("RENAME_ARIA", current) },
      }) as El & { value: string };

      /* Цена названа до нажатия, а не после (З8 наоборот: это человеку). */
      const warn = el(box, "div", "io-dlg__warn");
      el(warn, "p", "io-item__desc", say("RENAME_WARNING"));
      const list = el(warn, "ul", "io-dlg__list");
      el(list, "li", "io-item__desc", say("RENAME_WARNING_NOTES"));
      el(list, "li", "io-item__desc", say("RENAME_WARNING_HOTKEY"));

      const foot = el(box, "div", "io-dlg__foot");
      const cancel = foot.createEl("button",
        { cls: "io-btn", text: say("CANCEL"), attr: { type: "button" } });
      cancel.addEventListener("click", (() => { finish(null); this.close(); }) as never);
      const go = foot.createEl("button", {
        cls: "io-btn io-btn--cta",
        text: say("RENAME_CONFIRM"),
        attr: { type: "button" },
      }) as El & { disabled: boolean };
      const same = (): boolean =>
        !String(input.value || "").trim() || String(input.value || "").trim() === current;
      go.disabled = same();
      input.addEventListener("input", (() => { go.disabled = same(); }) as never);
      go.addEventListener("click", (() => {
        if (same()) return;
        finish(String(input.value || "").trim());
        this.close();
      }) as never);
    }

    override onClose(): void {
      finish(null);
      this.contentEl.empty();
    }
  }

  new RenameFieldModal(app).open();
}

/* ---- блок --------------------------------------------------------------- */

export const fieldsEditor: CustomRender = (host: El, ctx: SettingsCtx) => {
  const p = ctx.platform;
  const box = el(host, "div", "io-fieldsblock");

  /*
   * Без платформы блок не рисуется, и это не пользовательская ситуация:
   * платформу передаёт либо плагин, либо проверка. Молча оставить пустое
   * место хуже, чем не показать блок вовсе.
   */
  if (!p) return () => { box.empty(); };

  const Modal = p.Modal as ModalCtor;
  const app = (p.plugin as { app?: unknown }).app;
  const notice = (text: string): void => {
    const N = p.Notice as new (message: string) => unknown;
    try { new N(text); } catch { console.error("inline-overhaul: " + text); }
  };

  /** Выбранный Field — состояние вида, в конфиг не пишется (О0). */
  const state: FieldsViewState = { selected: "" };

  /*
   * Перерисовка идёт подменой узла, а не очисткой на месте. Причина из
   * практики: заказчик выключил модуль, отрисовка не удалась, и редактор
   * исчез до перезапуска Obsidian. Теперь неудачная попытка выбрасывается
   * целиком, а на экране остаётся то, что работало.
   */
  let mounted: El | null = null;
  let closeMounted: (() => void) | null = null;
  const draw = (): void => {
    /*
     * Скролл и фокус снимаются ДО подмены узла и возвращаются после неё
     * (дефект A8). Каждый контрол редактора зовёт `redraw`, и без этого
     * панель прыгала к началу на любое нажатие, а поле ввода теряло каретку
     * (замечание заказчика 2026-08-27).
     */
    const keep = keepView(box);
    const next = el(box, "div", "io-fieldsblock__mount");
    let close: () => void;
    try {
      /*
       * Модель собирается на каждой отрисовке: она снимает конфиг, а конфиг
       * между отрисовками меняется — и её же записями тоже.
       */
      const model = createFieldsModel({
        plugin: p.plugin as never,
        normalizePkmOrder: p.normalizePkmOrder as never,
        pkmOrderFields: p.pkmOrderFields,
        cfg: p.getConfig() as never,
        deepState,
      });
      const say = sayIn("field-editor", ctx);
      close = renderFieldsEditor(next, {
        model,
        ctx,
        state,
        enabled: Boolean(ctx.get("features.pkm.enabled")),
        showTips: Boolean(ctx.get("general.help.showTips")),
        showIds: Boolean(ctx.get("advanced.showSettingIds")),
        redraw: () => { draw(); },
        notice,
        askNewField: done => askNewFieldModal(Modal, app, done, say),
        confirmDeleteField: (name, done) => confirmDeleteModal(Modal, app, name, done, say),
        askRename: (name, done) => askRenameModal(Modal, app, name, done, say),
      });
    } catch (e) {
      next.remove();
      console.error("inline-overhaul: редактор Fields не отрисовался", e);
      return;
    }
    if (closeMounted) closeMounted();
    if (mounted) mounted.remove();
    mounted = next;
    closeMounted = close;
    /* Только теперь: пока в дереве стоят оба поддерева, высота больше
       настоящей, и возвращённая прокрутка была бы не той. */
    keep.restore();
  };

  draw();
  const unwatch = ctx.watch(EDITOR_PATHS, draw);
  return () => {
    unwatch();
    if (closeMounted) closeMounted();
    closeMounted = null;
    mounted = null;
    box.empty();
  };
};
